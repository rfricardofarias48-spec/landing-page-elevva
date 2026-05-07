/**
 * Recruiter Agent Service
 * Handles WhatsApp conversations between the SDR number and active recruiters.
 * Uses Groq/LLaMA for responses with per-recruiter context (jobs, candidates, interviews).
 */

import OpenAI from 'openai';
import { SupabaseClient } from '@supabase/supabase-js';

type Message = { role: 'user' | 'assistant'; content: string };

const conversationHistory = new Map<string, Message[]>();
const profileCache = new Map<string, { id: string; name: string; fetchedAt: number }>();

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_HISTORY = 16;

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

async function fetchRecruiterContext(recruiterId: string, supabase: SupabaseClient) {
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // jobs usa user_id (padrão do sistema)
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title')
    .eq('user_id', recruiterId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(15);

  const jobIds = (jobs ?? []).map((j: any) => j.id);

  const [interviewsRes, newCandidatesRes] = await Promise.all([
    supabase
      .from('interviews')
      .select('candidate_name, scheduled_at, job_title, status')
      .eq('recruiter_id', recruiterId)
      .gte('scheduled_at', now.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(8),
    jobIds.length > 0
      ? supabase
          .from('candidates')
          .select('name, match_score, status')
          .in('job_id', jobIds)
          .gte('created_at', since24h)
          .neq('status', 'ERROR')
          .order('match_score', { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),
  ]);

  return {
    jobs: jobs ?? [],
    interviews: interviewsRes.data ?? [],
    newCandidates: newCandidatesRes.data ?? [],
  };
}

function buildSystemPrompt(
  name: string,
  plan: string,
  ctx: { jobs: any[]; interviews: any[]; newCandidates: any[] },
): string {
  const jobList = ctx.jobs.length > 0
    ? ctx.jobs.map((j: any) => `• ${j.title}`).join('\n')
    : '• Nenhuma vaga ativa no momento';

  const interviewList = ctx.interviews.length > 0
    ? ctx.interviews.map((i: any) => {
        const d = new Date(i.scheduled_at);
        return `• ${i.candidate_name} — ${i.job_title} (${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`;
      }).join('\n')
    : '• Nenhuma entrevista próxima';

  const candidateList = ctx.newCandidates.length > 0
    ? ctx.newCandidates.map((c: any) => `• ${c.name} — nota ${Number(c.match_score || 0).toFixed(1)}/10`).join('\n')
    : '• Nenhum candidato novo nas últimas 24h';

  return `Você é a *Elevva AI*, assistente pessoal de recrutamento de *${name}* (plano ${plan}).
Você responde via *WhatsApp*. Seja objetivo, profissional e amigável.
Use *negrito* e _itálico_ do WhatsApp quando útil. Respostas curtas (máx. 3 parágrafos).
Responda sempre em português brasileiro.

CONTEXTO ATUAL DE ${name.toUpperCase()}:
Vagas ativas:
${jobList}

Próximas entrevistas:
${interviewList}

Candidatos novos (últimas 24h):
${candidateList}

Você pode: resumir vagas e candidatos, informar sobre entrevistas, ajudar com estratégias de recrutamento e tirar dúvidas sobre a plataforma Elevva.`;
}

export async function handleRecruiterMessage(
  phone: string,
  text: string,
  supabase: SupabaseClient,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey || apiKey.length < 10) {
    console.error('[RecruiterAgent] OPENAI_API_KEY não configurada');
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
    console.warn(`[RecruiterAgent] Perfil não encontrado para ${phone}`);
    return '';
  }

  profileCache.set(phone, { id: profile.id, name: profile.full_name, fetchedAt: Date.now() });

  const ctx = await fetchRecruiterContext(profile.id, supabase);
  const systemPrompt = buildSystemPrompt(profile.full_name, profile.plan || 'ESSENCIAL', ctx);

  const msgs = conversationHistory.get(phone) || [];
  msgs.push({ role: 'user', content: text });
  if (msgs.length > MAX_HISTORY) msgs.splice(0, msgs.length - MAX_HISTORY);

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: 'gpt-5.4-nano',
      temperature: 0.5,
      max_tokens: 512,
      messages: [
        { role: 'system', content: systemPrompt },
        ...msgs,
      ],
    });

    const reply = completion.choices[0]?.message?.content?.trim() || '';
    if (reply) {
      msgs.push({ role: 'assistant', content: reply });
      conversationHistory.set(phone, msgs);
    }
    console.log(`[RecruiterAgent] Resposta para ${profile.full_name} (${phone}): ${reply.substring(0, 80)}...`);
    return reply;
  } catch (err) {
    console.error('[RecruiterAgent] Erro ao chamar Groq:', err);
    return '';
  }
}
