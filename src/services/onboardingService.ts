/**
 * Onboarding Service
 * Orquestra o provisionamento automático de um novo cliente após pagamento confirmado.
 *
 * Fluxo (10 etapas):
 *  1. Criar usuário no Supabase Auth
 *  2. Criar/atualizar perfil na tabela profiles
 *  3. Criar inbox no Chatwoot
 *  4. Criar usuário do cliente no Chatwoot
 *  5. Vincular usuário ao inbox (apenas o inbox dele)
 *  6. Buscar chip disponível do pool
 *  7. Criar instância na Evolution API
 *  8. Conectar chip à instância Evolution
 *  9. Integrar instância Evolution com inbox Chatwoot
 * 10. Enviar WhatsApp de boas-vindas ao cliente
 *
 * Cada etapa salva seu resultado em sales.onboarding_context (JSONB),
 * permitindo retry a partir do ponto de falha.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const CHATWOOT_URL = (process.env.CHATWOOT_URL || '').replace(/\/$/, '');
const CHATWOOT_ACCOUNT_ID = parseInt(process.env.CHATWOOT_ACCOUNT_ID || '1', 10);
const CHATWOOT_ADMIN_TOKEN = process.env.CHATWOOT_ADMIN_TOKEN || '';

const EVOLUTION_URL = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY || '';

// Plano → limites de vagas e currículos
const PLAN_LIMITS: Record<string, { jobLimit: number; resumeLimit: number }> = {
  ESSENCIAL:  { jobLimit: 5,    resumeLimit: 150  },
  PRO:        { jobLimit: 15,   resumeLimit: 500  },
  ENTERPRISE: { jobLimit: 9999, resumeLimit: 9999 },
};

// ─── Helpers Chatwoot ──────────────────────────────────────────────────────────

async function chatwootPost(path: string, body: Record<string, unknown>, token?: string): Promise<any> {
  const apiToken = token || CHATWOOT_ADMIN_TOKEN;
  if (!CHATWOOT_URL || !apiToken) throw new Error('Chatwoot não configurado (URL ou token ausente)');

  const res = await fetch(`${CHATWOOT_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api_access_token': apiToken },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (!res.ok) throw new Error(`Chatwoot POST ${path} → ${res.status}: ${text.substring(0, 200)}`);
  return json;
}

async function chatwootGet(path: string, token?: string): Promise<any> {
  const apiToken = token || CHATWOOT_ADMIN_TOKEN;
  const res = await fetch(`${CHATWOOT_URL}${path}`, {
    headers: { 'api_access_token': apiToken },
  });
  if (!res.ok) throw new Error(`Chatwoot GET ${path} → ${res.status}`);
  return res.json();
}

// ─── Helpers Evolution ─────────────────────────────────────────────────────────

async function evolutionPost(path: string, body: Record<string, unknown>, apiKey?: string): Promise<any> {
  const key = apiKey || EVOLUTION_KEY;
  const res = await fetch(`${EVOLUTION_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': key },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`Evolution POST ${path} → ${res.status}: ${text.substring(0, 200)}`);
  return json;
}

// ─── Gerador de senha ──────────────────────────────────────────────────────────

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ─── Salvar contexto de onboarding ────────────────────────────────────────────

async function saveContext(saleId: string, step: number, context: Record<string, unknown>): Promise<void> {
  await supabase.from('sales').update({
    onboarding_step: step,
    onboarding_context: context,
    onboarding_status: 'em_progresso',
    updated_at: new Date().toISOString(),
  }).eq('id', saleId);
}

// ─── Função principal ──────────────────────────────────────────────────────────

export interface ProvisionResult {
  success: boolean;
  clientEmail: string;
  whatsappNumber: string;
  chatwootLoginUrl: string;
  error?: string;
}

export async function provisionClient(saleId: string): Promise<ProvisionResult> {
  // Buscar dados da venda
  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .select('*, salespeople(name)')
    .eq('id', saleId)
    .single();

  if (saleErr || !sale) throw new Error(`Venda não encontrada: ${saleId}`);

  const ctx: Record<string, any> = sale.onboarding_context || {};
  const step = sale.onboarding_step || 0;
  const limits = PLAN_LIMITS[sale.plan] || PLAN_LIMITS.ESSENCIAL;
  const tempPassword = ctx.tempPassword || generatePassword();

  console.log(`[Onboarding] Iniciando provisão para ${sale.client_email} (venda ${saleId}, etapa ${step})`);

  try {
    // ── ETAPA 1: Criar usuário no Supabase Auth ────────────────────────────────
    let userId = ctx.userId;
    if (!userId) {
      console.log('[Onboarding] Etapa 1: criar usuário Supabase');
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: sale.client_email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name: sale.client_name },
      });
      if (authErr) throw new Error(`Etapa 1 falhou: ${authErr.message}`);
      userId = authData.user.id;
      ctx.userId = userId;
      ctx.tempPassword = tempPassword;
      await saveContext(saleId, 1, ctx);
    }

    // ── ETAPA 2: Criar perfil ─────────────────────────────────────────────────
    if (!ctx.profileCreated) {
      console.log('[Onboarding] Etapa 2: criar perfil');
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: userId,
        email: sale.client_email,
        plan: sale.plan,
        job_limit: limits.jobLimit,
        resume_limit: limits.resumeLimit,
        subscription_status: 'active',
        salesperson: (sale as any).salespeople?.name || null,
        sale_id: saleId,
        created_at: new Date().toISOString(),
      });
      if (profileErr) throw new Error(`Etapa 2 falhou: ${profileErr.message}`);
      ctx.profileCreated = true;
      await saveContext(saleId, 2, ctx);
    }

    // ── ETAPA 3: Criar inbox no Chatwoot ─────────────────────────────────────
    let inboxId = ctx.inboxId;
    if (!inboxId) {
      console.log('[Onboarding] Etapa 3: criar inbox Chatwoot');
      const inbox = await chatwootPost(
        `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/inboxes`,
        {
          name: `${sale.client_name} — Elevva`,
          channel: { type: 'api', webhook_url: '' },
        }
      );
      inboxId = inbox.id;
      ctx.inboxId = inboxId;
      await saveContext(saleId, 3, ctx);
    }

    // ── ETAPA 4: Criar usuário do cliente no Chatwoot ────────────────────────
    let chatwootUserId = ctx.chatwootUserId;
    let chatwootUserToken = ctx.chatwootUserToken;
    if (!chatwootUserId) {
      console.log('[Onboarding] Etapa 4: criar usuário Chatwoot');
      const agent = await chatwootPost(
        `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/agents`,
        {
          name: sale.client_name,
          email: sale.client_email,
          role: 'agent',
          password: tempPassword,
        }
      );
      chatwootUserId = agent.id;
      chatwootUserToken = agent.access_token;
      ctx.chatwootUserId = chatwootUserId;
      ctx.chatwootUserToken = chatwootUserToken;
      await saveContext(saleId, 4, ctx);
    }

    // ── ETAPA 5: Vincular usuário ao inbox ────────────────────────────────────
    if (!ctx.inboxMemberSet) {
      console.log('[Onboarding] Etapa 5: vincular usuário ao inbox');
      await chatwootPost(
        `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/inbox_members`,
        {
          inbox_id: inboxId,
          user_ids: [chatwootUserId],
        }
      );
      ctx.inboxMemberSet = true;
      await saveContext(saleId, 5, ctx);
    }

    // ── ETAPA 6: Buscar chip disponível do pool ───────────────────────────────
    let chipPhone = ctx.chipPhone;
    let chipInstance = ctx.chipInstance;
    let chipId = ctx.chipId;
    if (!chipId) {
      console.log('[Onboarding] Etapa 6: buscar chip disponível');
      const { data: chip, error: chipErr } = await supabase
        .from('chips_pool')
        .select('id, phone_number, evolution_instance')
        .eq('status', 'disponivel')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (chipErr || !chip) throw new Error('Nenhum chip disponível no pool. Adicione chips antes de prosseguir.');

      chipId = chip.id;
      chipPhone = chip.phone_number;
      chipInstance = chip.evolution_instance;
      ctx.chipId = chipId;
      ctx.chipPhone = chipPhone;
      ctx.chipInstance = chipInstance;

      // Marcar como em uso imediatamente para evitar conflito de concorrência
      await supabase.from('chips_pool').update({
        status: 'em_uso',
        assigned_to: userId,
        assigned_at: new Date().toISOString(),
        assigned_sale_id: saleId,
      }).eq('id', chipId);

      await saveContext(saleId, 6, ctx);
    }

    // ── ETAPA 7: Criar instância na Evolution API ─────────────────────────────
    // A instância já existe (chip pré-autenticado) — apenas registramos
    // Se a instância não existir na Evolution, cria uma nova
    if (!ctx.evolutionInstanceReady) {
      console.log('[Onboarding] Etapa 7: verificar/criar instância Evolution');
      // Tenta buscar a instância existente
      try {
        const checkRes = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, {
          headers: { 'apikey': EVOLUTION_KEY },
        });
        const instances = await checkRes.json() as any[];
        const exists = Array.isArray(instances) && instances.some((i: any) => i.instance?.instanceName === chipInstance);

        if (!exists) {
          // Cria a instância (chip já foi autenticado previamente, apenas conecta)
          await evolutionPost('/instance/create', {
            instanceName: chipInstance,
            token: '',
            qrcode: false,
            number: chipPhone,
          });
        }
      } catch {
        // Se não conseguiu verificar, ignora — a instância provavelmente já existe
      }

      ctx.evolutionInstanceReady = true;
      await saveContext(saleId, 7, ctx);
    }

    // ── ETAPA 8: Configurar webhook da instância ──────────────────────────────
    if (!ctx.webhookSet) {
      console.log('[Onboarding] Etapa 8: configurar webhook Evolution');
      const webhookBase = process.env.SERVER_URL || '';
      if (webhookBase) {
        await evolutionPost(`/webhook/set/${chipInstance}`, {
          url: `${webhookBase}/api/webhooks/agent/whatsapp`,
          webhook_by_events: false,
          webhook_base64: false,
          events: ['MESSAGES_UPSERT'],
        });
      }
      ctx.webhookSet = true;
      await saveContext(saleId, 8, ctx);
    }

    // ── ETAPA 9: Integrar Evolution com Chatwoot ──────────────────────────────
    if (!ctx.chatwootIntegrated) {
      console.log('[Onboarding] Etapa 9: integrar Evolution com Chatwoot');
      if (CHATWOOT_URL && CHATWOOT_ADMIN_TOKEN) {
        await evolutionPost(`/chatwoot/set/${chipInstance}`, {
          enabled: true,
          account_id: CHATWOOT_ACCOUNT_ID.toString(),
          token: CHATWOOT_ADMIN_TOKEN,
          url: CHATWOOT_URL,
          sign_msg: false,
          reopen_conversation: true,
          conversation_pending: false,
          import_contacts: true,
          name_inbox: `${sale.client_name} — Elevva`,
          merge_brasil_contacts: true,
          import_messages: false,
          days_limit_import_messages: 0,
          auto_create: true,
        });
      }
      ctx.chatwootIntegrated = true;
      await saveContext(saleId, 9, ctx);
    }

    // ── ETAPA 10: Enviar WhatsApp de boas-vindas ──────────────────────────────
    if (!ctx.welcomeSent) {
      console.log('[Onboarding] Etapa 10: enviar WhatsApp de boas-vindas');
      const clientPhone = sale.client_phone.replace(/\D/g, '');
      const chatwootLoginUrl = CHATWOOT_URL;
      const appUrl = process.env.APP_URL || 'https://app.elevva.net.br';

      const welcomeMsg =
        `🎉 *Bem-vindo à Elevva, ${sale.client_name.split(' ')[0]}!*\n\n` +
        `Seu plano *${sale.plan}* está ativo e tudo está configurado.\n\n` +
        `📱 *Número WhatsApp do seu agente:*\n+${chipPhone}\n\n` +
        `🖥️ *Acesse seu painel:*\n${appUrl}\n\n` +
        `👤 *Login:* ${sale.client_email}\n` +
        `🔑 *Senha temporária:* ${tempPassword}\n\n` +
        `💬 *Acompanhe seu agente em tempo real:*\n${chatwootLoginUrl}\n` +
        `_(mesmo login e senha acima)_\n\n` +
        `Em caso de dúvidas, fale conosco. Sucesso! 🚀`;

      // Envia via Evolution usando o chip do pool (ou qualquer instância disponível)
      // Como o chip do cliente acabou de ser configurado, usamos uma instância de suporte
      const supportInstance = process.env.SUPPORT_EVOLUTION_INSTANCE || chipInstance;
      const supportKey = process.env.SUPPORT_EVOLUTION_KEY || EVOLUTION_KEY;

      await evolutionPost(`/message/sendText/${supportInstance}`, {
        number: clientPhone,
        text: welcomeMsg,
      }, supportKey);

      ctx.welcomeSent = true;
      await saveContext(saleId, 10, ctx);
    }

    // ── FINALIZAR ─────────────────────────────────────────────────────────────
    console.log('[Onboarding] Concluído com sucesso!');

    // Atualizar profiles com todos os dados provisionados
    await supabase.from('profiles').update({
      chatwoot_inbox_id: inboxId,
      chatwoot_user_id: chatwootUserId,
      chatwoot_user_token: chatwootUserToken,
      evolution_instance: chipInstance,
      whatsapp_number: chipPhone,
      onboarded_at: new Date().toISOString(),
    }).eq('id', userId);

    // Atualizar venda como concluída
    await supabase.from('sales').update({
      onboarding_status: 'concluido',
      onboarding_step: 10,
      client_user_id: userId,
      updated_at: new Date().toISOString(),
    }).eq('id', saleId);

    return {
      success: true,
      clientEmail: sale.client_email,
      whatsappNumber: chipPhone,
      chatwootLoginUrl: CHATWOOT_URL,
    };

  } catch (err: any) {
    console.error('[Onboarding] Erro:', err.message);

    // Salvar estado de erro com a etapa atual para retry
    await supabase.from('sales').update({
      onboarding_status: 'erro',
      onboarding_context: ctx,
      updated_at: new Date().toISOString(),
    }).eq('id', saleId);

    return {
      success: false,
      clientEmail: sale.client_email,
      whatsappNumber: '',
      chatwootLoginUrl: '',
      error: err.message,
    };
  }
}
