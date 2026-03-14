import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { analyzeResume } from "./src/services/geminiService.js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" })); // Increase limit for base64 PDFs

// Initialize Supabase for backend
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://dbfttgtntntuiimbqzgu.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZnR0Z3RudG50dWlpbWJxemd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTUwODksImV4cCI6MjA4NTg5MTA4OX0.H36Kv-PzK8Ab8FN5HzAWO5S_y8t-z8gExl5GsDBQchs';
const supabase = createClient(supabaseUrl, supabaseKey);

// API routes FIRST
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Tarefa 4: Rota GET (Listagem Dinâmica de Vagas)
app.get("/api/webhooks/enterprise/vagas-ativas", async (req, res) => {
  try {
    // 1. Extração e Limpeza Segura
    const token = req.headers.authorization || '';
    const tokenLimpo = token.replace(/^Bearer\s+/i, '').trim();

    // 2. Limpeza da Instância
    const instancia = req.query.instancia || '';
    const instanciaLimpa = String(instancia).trim();

    if (!tokenLimpo) {
      return res.status(401).json({ error: "Unauthorized: Missing or invalid Authorization header." });
    }

    if (!instanciaLimpa) {
      return res.status(400).json({ error: "Missing 'instancia' query parameter." });
    }

    // 3. Logs de Raio-X
    console.log('--- INICIANDO DEBUG WEBHOOK ---');
    console.log('Instância Query:', instanciaLimpa);
    console.log('Token Limpo:', tokenLimpo);

    // 4. A Consulta
    const { data: user, error: userError } = await supabase
      .from("profiles")
      .select("id, plan, status_automacao, api_token")
      .eq('api_token', tokenLimpo)
      .eq('instancia_evolution', instanciaLimpa)
      .single();

    // 5. Log do Resultado
    if (userError || !user) {
      console.log('--- ERRO SUPABASE ---');
      console.log('Erro:', userError);
      console.log('Usuário retornado:', user);
      return res.status(403).json({ 
        error: "Instância não encontrada ou usuário inválido.",
        details: userError ? userError.message : "Nenhum usuário encontrado com esses dados.",
        hint: userError ? userError.hint : null,
        code: userError ? userError.code : null
      });
    }

    if (user.plan !== "ENTERPRISE") {
      return res.status(403).json({ error: "Acesso negado: O plano do usuário não é Enterprise." });
    }

    if (!user.status_automacao) {
      return res.status(403).json({ error: "Acesso negado: Automação desativada para esta instância." });
    }

    // 3. Buscar vagas ativas do usuário
    const { data: vagas, error: vagasError } = await supabase
      .from("jobs")
      .select("id, title")
      .eq("user_id", user.id)
      .eq("is_paused", false); // Assumindo que is_paused = false significa "Aberta"

    if (vagasError) {
      console.error("Erro ao buscar vagas:", vagasError);
      return res.status(500).json({ error: "Erro ao buscar vagas ativas." });
    }

    // 4. Formatar a resposta
    const vagasFormatadas = vagas.map((vaga, index) => ({
      opcao: index + 1,
      id_vaga: vaga.id,
      titulo: vaga.title
    }));

    return res.status(200).json(vagasFormatadas);

  } catch (error: any) {
    console.error("Webhook Error:", error);
    return res.status(500).json({ error: "Internal server error.", details: error.message });
  }
});

app.post("/api/webhooks/enterprise/resume", async (req, res) => {
  try {
    // 1. Security: Verify API Key
    const authHeader = req.headers.authorization;
    const expectedKey = process.env.ENTERPRISE_API_KEY;
    
    if (!expectedKey) {
      return res.status(500).json({ error: "Server configuration error: ENTERPRISE_API_KEY is not set." });
    }

    if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
      return res.status(401).json({ error: "Unauthorized: Invalid or missing API Key." });
    }

    // 2. Parse JSON Payload
    console.log('--- PAYLOAD RECEBIDO DO N8N ---');
    console.log(JSON.stringify(req.body, null, 2));
    
    // Agora aceitamos 'job_id' para facilitar o JSON no n8n (mantendo os antigos como fallback)
    const { job_id, vaga_id, id_vaga, telefone, telefone_candidato, nome_candidato, arquivo_base64, mimetype } = req.body;
    
    // Fallback para pegar o ID da vaga de qualquer um dos campos (priorizando job_id)
    const rawJobId = job_id || vaga_id || id_vaga;
    let cleanJobId = rawJobId ? String(rawJobId).trim() : "";

    // Se o n8n não conseguiu resolver a variável, ela chega como a própria string da variável
    if (cleanJobId === "{{ $json.job_id }}" || cleanJobId === "undefined" || cleanJobId === "null") {
        cleanJobId = "";
    }

    // Fallbacks para nome e telefone caso o agente não envie
    // Tenta pegar de várias chaves possíveis para garantir
    const rawPhone = telefone || telefone_candidato || req.body.phone || req.body.Phone || req.body.Telefone;
    const finalName = nome_candidato || "Candidato via WhatsApp";
    const finalPhone = rawPhone ? String(rawPhone).trim() : "Não informado";
    
    console.log('Telefone extraído:', finalPhone);

    // Criando um client Supabase Admin (Service Role) para garantir bypass do RLS
    const adminSupabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://dbfttgtntntuiimbqzgu.supabase.co';
    const adminSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
    const supabaseAdmin = createClient(adminSupabaseUrl, adminSupabaseKey);

    // [NOVO] SUPER FALLBACK PARA DESCUBRIR A VAGA PELO TELEFONE
    // Se o webhook não recebeu a vaga, mas temos o telefone, vamos procurar a linha que o bot criou
    // MESMO QUE O N8N ENVIE UMA VAGA, VAMOS PRIORIZAR A VAGA QUE O BOT REGISTROU PARA EVITAR DUPLICIDADE
    if (finalPhone !== "Não informado") {
        console.log("Buscando a vaga real que o bot registrou para este telefone...");
        
        const { data: pendingCandidate } = await supabaseAdmin
            .from("candidates")
            .select("job_id")
            .eq("WhatsApp com DDD", finalPhone)
            .is("filename", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (pendingCandidate && pendingCandidate.job_id) {
            if (cleanJobId && cleanJobId !== pendingCandidate.job_id) {
                console.log(`ALERTA: O n8n enviou a vaga ${cleanJobId}, mas o bot registrou o candidato na vaga ${pendingCandidate.job_id}. Corrigindo para a vaga do bot para evitar duplicidade!`);
            }
            cleanJobId = pendingCandidate.job_id;
            console.log("Vaga definida com sucesso pelo telefone:", cleanJobId);
        }
    }

    if (!cleanJobId || !arquivo_base64 || !mimetype) {
      return res.status(400).json({ error: "Missing required fields in payload (job_id, arquivo_base64, mimetype)." });
    }

    // 4. Validation: Check mimetype and size
    if (mimetype !== "application/pdf") {
      return res.status(400).json({ error: "Invalid mimetype. Only application/pdf is supported." });
    }

    // Decode base64 to check size (approximate)
    const base64Data = arquivo_base64.replace(/^data:application\/pdf;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const sizeInMB = buffer.length / (1024 * 1024);

    if (sizeInMB > 5) {
      return res.status(400).json({ error: "File size exceeds the 5MB limit." });
    }

    // Fetch Job Details to get title and criteria for Gemini
    console.log('--- INICIANDO BUSCA DA VAGA ---');
    console.log('Identificador da Vaga recebido no body:', cleanJobId);

    // [NOVO PASSO] Busca inteligente da vaga (por ID ou por Título)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanJobId);
    
    let jobData = null;
    let jobError = null;

    if (isUUID) {
      // Busca por ID
      const { data, error } = await supabaseAdmin
        .from("jobs")
        .select("id, title, criteria, user_id")
        .eq("id", cleanJobId)
        .single();
      jobData = data;
      jobError = error;
    } else {
      // Busca por Título (caso o n8n envie o nome da vaga por engano)
      console.log('Identificador não é um UUID válido. Buscando vaga pelo título...');
      const { data, error } = await supabaseAdmin
        .from("jobs")
        .select("id, title, criteria, user_id")
        .ilike("title", cleanJobId)
        .eq("is_paused", false) // Prioriza vagas abertas
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      jobData = data;
      jobError = error;
    }

    if (jobError || !jobData) {
      console.log('--- ERRO AO BUSCAR VAGA NO SUPABASE ---');
      console.log('Erro retornado:', jobError);
      console.log('Dados retornados:', jobData);
      
      return res.status(404).json({ 
        error: "Vaga não encontrada",
        received_id: cleanJobId,
        detalhes: jobError || "Nenhum registro retornado para este ID ou Título."
      });
    }

    // Atualiza o finalJobId para o ID real encontrado no banco (útil se a busca foi por título)
    const finalJobId = jobData.id;

    // 5. Flow: Upload to Supabase Storage
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`;
    const filePath = `${finalJobId}/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("resumes")
      .upload(filePath, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage Upload Error:", uploadError);
      return res.status(500).json({ error: "Failed to upload file to storage." });
    }

    // [NOVO PASSO] Verificar se o candidato já existe pelo telefone e vaga
    let candidateData;

    if (finalPhone !== "Não informado") {
      const { data: existingCandidate, error: searchError } = await supabaseAdmin
        .from("candidates")
        .select("*")
        .eq("job_id", finalJobId)
        .eq("WhatsApp com DDD", finalPhone)
        .maybeSingle();

      if (!searchError && existingCandidate) {
        candidateData = existingCandidate;
      }
    } else {
      // Fallback: Se o n8n não enviou o telefone (veio vazio), tenta encontrar a linha vazia que o bot criou
      console.log("Telefone não recebido do n8n. Tentando encontrar candidato recém-criado pelo bot (sem currículo)...");
      const { data: recentCandidate, error: recentError } = await supabaseAdmin
        .from("candidates")
        .select("*")
        .eq("job_id", finalJobId)
        .is("filename", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (!recentError && recentCandidate) {
        candidateData = recentCandidate;
        console.log("Candidato encontrado por fallback (linha vazia do bot):", candidateData.id);
      }
    }

    if (candidateData) {
      // UPDATE: Candidato já existe (criado pelo bot)
      const { data: updatedCandidate, error: updateError } = await supabaseAdmin
        .from("candidates")
        .update({
          "Nome Completo": finalName !== "Candidato via WhatsApp" ? finalName : candidateData["Nome Completo"],
          filename: fileName,
          file_path: filePath,
          status: "ANALISANDO",
          match_score: 0,
          analysis_result: null,
        })
        .eq("id", candidateData.id)
        .select()
        .single();

      if (updateError || !updatedCandidate) {
        console.error("Database Update Error (Existing Candidate):", updateError);
        return res.status(500).json({ error: "Failed to update existing candidate record." });
      }
      candidateData = updatedCandidate;
    } else {
      // INSERT: Candidato não existe
      const { data: newCandidate, error: insertError } = await supabaseAdmin
        .from("candidates")
        .insert([
          {
            job_id: finalJobId,
            user_id: jobData.user_id, // Vinculando o dono da vaga ao candidato
            "Nome Completo": finalName,
            "WhatsApp com DDD": finalPhone,
            filename: fileName,
            file_path: filePath,
            status: "ANALISANDO",
            match_score: 0,
            analysis_result: null,
          },
        ])
        .select()
        .single();

      if (insertError || !newCandidate) {
        console.error("Database Insert Error:", insertError);
        return res.status(500).json({ error: "Failed to insert candidate record." });
      }
      candidateData = newCandidate;
    }

    // Immediately trigger Gemini Analysis
    // We don't await this to respond quickly to the webhook, or we can await it if the client expects the result synchronously.
    // Usually webhooks prefer fast responses, but let's await it so we can return the result, or process it in the background.
    // The prompt implies "IMEDIATAMENTE acionar a função interna... Atualizar o registro". Let's do it asynchronously to not block the webhook response, or synchronously if it's fast. Gemini might take a few seconds. Let's do it synchronously so the webhook gets the final status, or asynchronously and return 202 Accepted.
    // Let's do it synchronously for simplicity, as it's an API endpoint.
    
    const analysisResult = await analyzeResume(base64Data, jobData.title, jobData.criteria || "");

    let finalStatus = "REPROVADO";
    if (analysisResult.matchScore >= 7) finalStatus = "APROVADO";
    else if (analysisResult.matchScore >= 4) finalStatus = "EM_ANALISE";

    // Atualiza o nome se a IA encontrou um nome válido no currículo
    const newName = analysisResult.candidateName && analysisResult.candidateName !== "Não identificado" 
      ? analysisResult.candidateName 
      : candidateData["Nome Completo"];

    const { error: updateError } = await supabaseAdmin
      .from("candidates")
      .update({
        status: finalStatus,
        match_score: analysisResult.matchScore,
        analysis_result: analysisResult,
        "Nome Completo": newName,
      })
      .eq("id", candidateData.id);

    if (updateError) {
      console.error("Database Update Error:", updateError);
      // Even if update fails, we return success for the upload, but let's return 500
      return res.status(500).json({ error: "Failed to save analysis results." });
    }

    return res.status(200).json({
      success: true,
      message: "Candidate processed successfully.",
      candidate_id: candidateData.id,
      analysis: {
        score: analysisResult.matchScore,
        status: finalStatus,
      }
    });

  } catch (error: any) {
    console.error("Webhook Error:", error);
    return res.status(500).json({ error: "Internal server error.", details: error.message });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
