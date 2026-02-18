import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

console.log("InfinitePay Webhook Handler Iniciado")

serve(async (req) => {
  try {
    // 1. Configuração do Supabase Admin (Bypass RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Parse do Payload da InfinitePay
    const payload = await req.json()
    console.log("Webhook recebido:", JSON.stringify(payload))

    // Estrutura comum de Webhook (pode variar, ajustado para padrão v2)
    // Se o status não vier no root, tenta buscar dentro de 'data'
    const status = payload.status || payload.data?.status;
    const metadata = payload.metadata || payload.data?.metadata;
    const customer = payload.customer || payload.data?.customer;
    
    // O valor vem em CENTAVOS (ex: 32990 = R$ 329,90)
    const amount = payload.amount || payload.data?.amount || 0;

    // 3. Validação de Segurança
    if (status !== 'approved' && status !== 'paid') {
      return new Response(JSON.stringify({ message: "Ignorado: Pagamento não aprovado" }), { status: 200 })
    }

    // Tenta extrair o email do cliente (Metadados > Cliente)
    const userEmail = metadata?.customer_email || customer?.email;

    if (!userEmail) {
      console.error("Email não identificado no pagamento.")
      return new Response(JSON.stringify({ error: "Email missing" }), { status: 400 })
    }

    // 4. Lógica de Decisão do Plano (Mensal vs Anual)
    // Se o valor for maior que R$ 1.000,00 (100000 centavos), é ANUAL.
    // Caso contrário, é MENSAL.
    let newPlan = 'MENSAL';
    let jobLimit = 5;
    let resumeLimit = 150;

    if (amount > 100000) { 
        newPlan = 'ANUAL';
        jobLimit = 9999; // Ilimitado
        resumeLimit = 9999; // Ilimitado
    }

    console.log(`Processando upgrade para ${userEmail} -> Plano: ${newPlan}`);

    // 5. Busca o ID do usuário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', userEmail)
      .single()

    if (userError || !userData) {
      console.error("Usuário não encontrado no banco:", userEmail)
      return new Response("User not found", { status: 404 })
    }

    // 6. Atualiza o Plano e Limites
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        plan: newPlan,
        job_limit: jobLimit,
        resume_limit: resumeLimit,
        subscription_status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', userData.id)

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, plan: newPlan }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })

  } catch (error) {
    console.error("Erro interno:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    })
  }
})