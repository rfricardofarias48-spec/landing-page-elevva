/**
 * Bento — Assistente de Atendimento da Elevva
 * Atende usuários cadastrados via WhatsApp com acesso completo à conta.
 */

import OpenAI from 'openai';
import { SupabaseClient } from '@supabase/supabase-js';

type Message = { role: 'user' | 'assistant'; content: string };

// In-memory cache para velocidade; DB é a fonte persistente
const conversationCache = new Map<string, Message[]>();
const profileCache = new Map<string, { id: string; name: string; fetchedAt: number }>();

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_HISTORY = 20;

async function loadHistory(phone: string, supabase: SupabaseClient): Promise<Message[]> {
  if (conversationCache.has(phone)) return conversationCache.get(phone)!;

  const { data } = await supabase
    .from('bento_conversations')
    .select('role, content')
    .eq('phone', phone)
    .order('created_at', { ascending: true })
    .limit(MAX_HISTORY);

  const msgs: Message[] = (data ?? []).map((r: any) => ({ role: r.role as 'user' | 'assistant', content: r.content }));
  conversationCache.set(phone, msgs);
  return msgs;
}

async function saveMessages(phone: string, messages: Message[], supabase: SupabaseClient): Promise<void> {
  if (!messages.length) return;
  await supabase.from('bento_conversations').insert(
    messages.map(m => ({ phone, role: m.role, content: m.content }))
  );
}

function phoneVariants(phone: string): string[] {
  const cleaned = phone.replace(/\D/g, '');
  return [
    cleaned,
    cleaned.startsWith('55') ? cleaned.slice(2) : `55${cleaned}`,
    cleaned.slice(-11),
    cleaned.slice(-10),
  ];
}

export async function isKnownRecruiter(phone: string, supabase: SupabaseClient): Promise<boolean> {
  const cached = profileCache.get(phone);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return true;

  const variants = phoneVariants(phone);
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .or(variants.map(v => `phone.ilike.%${v}%`).join(','))
    .limit(1)
    .maybeSingle();

  if (data) {
    profileCache.set(phone, { id: data.id, name: data.full_name, fetchedAt: Date.now() });
    return true;
  }
  return false;
}

async function fetchAccountContext(recruiterId: string, supabase: SupabaseClient) {
  const now = new Date();
  const since48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, status, created_at')
    .eq('user_id', recruiterId)
    .order('created_at', { ascending: false })
    .limit(20);

  const jobIds = (jobs ?? []).map((j: any) => j.id);

  const [interviewsRes, candidatesRes] = await Promise.all([
    supabase
      .from('interviews')
      .select('candidate_name, scheduled_at, job_title, status, meet_link')
      .eq('recruiter_id', recruiterId)
      .gte('scheduled_at', now.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(10),
    jobIds.length > 0
      ? supabase
          .from('candidates')
          .select('name, match_score, status, job_id, created_at')
          .in('job_id', jobIds)
          .neq('status', 'ERROR')
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
  ]);

  const candidates = candidatesRes.data ?? [];
  const jobMap = Object.fromEntries((jobs ?? []).map((j: any) => [j.id, j.title]));

  type Pipeline = { title: string; total: number; approved: number; scheduled: number; pending: number };
  const pipelineByJob: Record<string, Pipeline> = {};
  for (const c of candidates) {
    if (!pipelineByJob[c.job_id]) {
      pipelineByJob[c.job_id] = { title: jobMap[c.job_id] || c.job_id, total: 0, approved: 0, scheduled: 0, pending: 0 };
    }
    pipelineByJob[c.job_id].total++;
    const s = String(c.status || '').toUpperCase();
    if (s === 'APPROVED') pipelineByJob[c.job_id].approved++;
    else if (s === 'INTERVIEW_SCHEDULED' || s === 'SCHEDULED') pipelineByJob[c.job_id].scheduled++;
    else pipelineByJob[c.job_id].pending++;
  }

  return {
    jobs: jobs ?? [],
    interviews: interviewsRes.data ?? [],
    candidates,
    recentCandidates: candidates.filter((c: any) => c.created_at >= since48h),
    pipelineByJob,
  };
}

type AccountContext = Awaited<ReturnType<typeof fetchAccountContext>>;

function buildSystemPrompt(name: string, plan: string, ctx: AccountContext): string {
  const activeJobs = ctx.jobs.filter((j: any) => j.status === 'active');
  const pausedJobs  = ctx.jobs.filter((j: any) => j.status !== 'active');

  const jobList = activeJobs.length
    ? activeJobs.map((j: any) => `• ${j.title}`).join('\n')
    : '• Nenhuma vaga ativa no momento';

  const pausedSection = pausedJobs.length
    ? `\nVAGAS PAUSADAS/ENCERRADAS (${pausedJobs.length}):\n` + pausedJobs.map((j: any) => `• ${j.title}`).join('\n')
    : '';

  const pipelineLines = Object.values(ctx.pipelineByJob).length
    ? Object.values(ctx.pipelineByJob)
        .map((p: any) => `• ${p.title}: ${p.total} candidatos — ${p.approved} aprovados, ${p.scheduled} agendados, ${p.pending} em análise`)
        .join('\n')
    : '• Sem candidatos no pipeline';

  const recentList = ctx.recentCandidates.length
    ? ctx.recentCandidates.map((c: any) => `• ${c.name} — nota ${Number(c.match_score || 0).toFixed(1)}/10 (${c.status})`).join('\n')
    : '• Nenhum candidato novo nas últimas 48h';

  const interviewList = ctx.interviews.length
    ? ctx.interviews.map((i: any) => {
        const d = new Date(i.scheduled_at);
        const link = i.meet_link ? ` | 🔗 ${i.meet_link}` : '';
        return `• ${i.candidate_name} — ${i.job_title} | ${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${link}`;
      }).join('\n')
    : '• Nenhuma entrevista agendada';

  const totalCandidates = ctx.candidates.length;
  const totalApproved   = ctx.candidates.filter((c: any) => String(c.status).toUpperCase() === 'APPROVED').length;
  const totalScheduled  = ctx.interviews.length;

  return `Você é o *Bento*, assistente de atendimento da Elevva.
Você está atendendo *${name}* (plano ${plan}) via WhatsApp.

REGRAS DE ATENDIMENTO:
- Seja direto, amigável e profissional. Nunca finja não saber algo que está no contexto abaixo.
- Use formatação WhatsApp: *negrito*, _itálico_, listas com •
- Máximo 4 parágrafos por resposta. Respostas curtas quando possível.
- Sempre em português brasileiro.
- Você TEM ACESSO à conta de ${name}. Use os dados abaixo para responder com precisão.
- Quando o usuário perguntar "quantas vagas", "quantos candidatos" etc., responda com os números reais do contexto.
- Se o usuário pedir para *agendar* ou *remarcar* uma entrevista, informe que ele pode fazer isso diretamente na plataforma em app.elevva.net.br ou perguntar ao suporte.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 CONTA: ${name.toUpperCase()} | PLANO: ${plan}
━━━━━━━━━━━━━━━━━━━━━━━━━━━

RESUMO GERAL:
• Vagas ativas: ${activeJobs.length}
• Total de candidatos: ${totalCandidates}
• Candidatos aprovados: ${totalApproved}
• Entrevistas agendadas: ${totalScheduled}

VAGAS ATIVAS (${activeJobs.length}):
${jobList}
${pausedSection}

PIPELINE POR VAGA:
${pipelineLines}

CANDIDATOS NOVOS NAS ÚLTIMAS 48h (${ctx.recentCandidates.length}):
${recentList}

PRÓXIMAS ENTREVISTAS (${ctx.interviews.length}):
${interviewList}
━━━━━━━━━━━━━━━━━━━━━━━━━━━

AÇÕES QUE VOCÊ PODE REALIZAR:
✅ Informar quantas vagas, candidatos e entrevistas há na conta
✅ Listar candidatos por vaga com nota e status
✅ Mostrar detalhes das próximas entrevistas (data, horário, link)
✅ Gerar relatório completo da conta (quando solicitado)
✅ Tirar dúvidas sobre a plataforma Elevva
✅ Orientar sobre agendamento e reagendamento de entrevistas

FORMATO DO RELATÓRIO (use quando pedirem "relatório" ou "resumo da conta"):
📊 *Relatório da Conta — ${name}*
▸ *Vagas ativas:* X
▸ *Candidatos em análise:* X | *Aprovados:* X | *Agendados:* X
▸ *Entrevistas próximas:* X
[listar entrevistas com data e candidato]
▸ *Candidatos em destaque por vaga:*
[listar top candidatos por nota]`;
}

export async function handleRecruiterMessage(
  phone: string,
  text: string,
  supabase: SupabaseClient,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey || apiKey.length < 10) {
    console.error('[Bento] OPENAI_API_KEY não configurada');
    return '';
  }

  const variants = phoneVariants(phone);
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, plan, subscription_status')
    .or(variants.map(v => `phone.ilike.%${v}%`).join(','))
    .limit(1)
    .maybeSingle();

  if (!profile) {
    console.warn(`[Bento] Perfil não encontrado para ${phone}`);
    return '';
  }

  profileCache.set(phone, { id: profile.id, name: profile.full_name, fetchedAt: Date.now() });

  const ctx = await fetchAccountContext(profile.id, supabase);
  const systemPrompt = buildSystemPrompt(profile.full_name, profile.plan || 'ESSENCIAL', ctx);

  const msgs = await loadHistory(phone, supabase);
  msgs.push({ role: 'user', content: text });
  if (msgs.length > MAX_HISTORY) msgs.splice(0, msgs.length - MAX_HISTORY);

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: 'gpt-5.4-nano',
      temperature: 0.4,
      max_tokens: 600,
      messages: [
        { role: 'system', content: systemPrompt },
        ...msgs,
      ],
    });

    const reply = completion.choices[0]?.message?.content?.trim() || '';
    if (reply) {
      msgs.push({ role: 'assistant', content: reply });
      conversationCache.set(phone, msgs);
      // Persiste apenas as 2 últimas mensagens (user + assistant) no DB
      await saveMessages(phone, [{ role: 'user', content: text }, { role: 'assistant', content: reply }], supabase);
    }
    console.log(`[Bento] ${profile.full_name} (${phone}): ${reply.substring(0, 80)}...`);
    return reply;
  } catch (err) {
    console.error('[Bento] Erro ao chamar OpenAI:', err);
    return '';
  }
}
