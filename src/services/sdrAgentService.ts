/**
 * SDR Agent Service — State Machine (Bento Comercial)
 *
 * States:
 *   NOVO                    → lead arrives via CTWA, first contact
 *   SAUDACAO_ENVIADA        → greeting sent, waiting for response
 *   QUALIFICANDO            → collecting lead info (company, role, size, pain)
 *   TIRANDO_DUVIDAS         → answering questions about Elevva
 *   OFERECENDO_DEMO         → demo proposed, sending scheduling link
 *   AGUARDANDO_ESCOLHA_SLOT → waiting for lead to pick a demo slot
 *   DEMO_AGENDADA           → demo booked (terminal success)
 *   FOLLOW_UP_1 / 2         → automated follow-up states
 *   CONVERTIDO / PERDIDO    → terminal states
 *   ESCALADO_HUMANO         → handed off to human agent
 */

import { SupabaseClient } from '@supabase/supabase-js';
import * as evo from './evolutionService.js';
import { createMeetingEvent, deleteCalendarEvent } from './googleCalendarService.js';
import { SdrConversationContext } from '../types.js';
import crypto from 'crypto';

// ─────────────────────────── Knowledge Base (inline) ───────────────────────────

const PITCH_CURTO = `A Elevva é uma IA que cuida de toda a burocracia do recrutamento — triagem, relatórios e agendamento de entrevistas. Tudo pelo WhatsApp, sem instalar nada.

Quer ver funcionando?`;

const PITCH_MEDIO = `Você cria a vaga, define os critérios e recebe um WhatsApp exclusivo para os anúncios. A partir daí:

📄 A IA recebe e analisa cada currículo em segundos
⚙️ Gera relatório com nota de compatibilidade
📅 Agenda entrevistas no Google Calendar + Meet

Tudo automático. O que um analista leva horas, a Elevva faz em segundos com 50 candidatos ao mesmo tempo.`;

const PLANOS = `Temos dois planos:

*Plano Essencial — R$ 499/mês*
✅ Até 5 vagas simultâneas
✅ WhatsApp autônomo + triagem com ranking
✅ Agendamento automático (Calendar + Meet)

*Plano Pro — R$ 899/mês*
✅ Tudo do Essencial + até 10 vagas
✅ Portal de Admissão + dossiê PDF
✅ Exclusão automática de dados em 48h (LGPD)

Também temos opção de plano anual com desconto. Posso detalhar na demonstração.`;

// ─────────────────────────── Intent Detection ───────────────────────────

type Intent = 'GREETING' | 'PRICE' | 'DISCOUNT' | 'HOW_IT_WORKS' | 'INTEGRATION' | 'DEMO_REQUEST' | 'OBJECTION_EXPENSIVE' | 'OBJECTION_SMALL_COMPANY' | 'OBJECTION_AI_TRUST' | 'OBJECTION_COMPETITOR' | 'LGPD' | 'TALK_TO_HUMAN' | 'YES' | 'NO' | 'RESCHEDULE' | 'UNKNOWN';

function detectIntent(text: string): Intent {
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Talk to human
  if (/falar com (alguem|pessoa|humano|atendente|vendedor)|quero (um|uma) (pessoa|humano|atendente)/.test(t)) return 'TALK_TO_HUMAN';

  // Yes / No
  if (/^(sim|s|claro|com certeza|quero|bora|vamos|pode ser|ok|beleza|show|top|massa|perfeito|isso|isso mesmo|fechou)$/i.test(t.trim())) return 'YES';
  if (/^(nao|n|nope|agora nao|sem interesse|nao quero|nao preciso|nao obrigado)$/i.test(t.trim())) return 'NO';

  // Demo request — must not match "antes de agendar", "sem agendar", etc.
  if (/\b(demonstra(cao|ção)|demo|ver funciona|mostrar|apresenta(cao|ção)|quero ver|quero conhecer)\b/.test(t)) return 'DEMO_REQUEST';
  if (/^(agendar|quero agendar|marca|bora agendar|vamos agendar)/.test(t.trim())) return 'DEMO_REQUEST';

  // Discount / negotiation
  if (/desconto|promocao|cupom|condicao especial|negociar|mais barato|abatimento|plano anual|anual/.test(t)) return 'DISCOUNT';

  // Price
  if (/pre(co|ço)|quanto custa|valor|plano|mensalidade|investimento|quanto (e|é)|tabela/.test(t)) return 'PRICE';

  // Integration
  if (/integra(cao|ção)?|conecta|api|sistema|erp|software|ferramenta/.test(t)) return 'INTEGRATION';

  // How it works
  if (/como funciona|funciona como|o que (e|é)|como (e|é)|explica|me (conta|fala)|detalhe|mais (sobre|info)|entender melhor/.test(t)) return 'HOW_IT_WORKS';

  // Objections
  if (/caro|muito caro|puxado|fora do orcamento|nao tenho budget|nao cabe/.test(t)) return 'OBJECTION_EXPENSIVE';
  if (/pequena|pequeno|so eu|sozinho|micro|pouca gente|poucos funcionarios/.test(t)) return 'OBJECTION_SMALL_COMPANY';
  if (/nao confio|ia nao|robo|maquina|nao acredito|inteligencia artificial (nao|não)/.test(t)) return 'OBJECTION_AI_TRUST';
  if (/ja uso|ja tenho|gupy|kenoby|solides|pandape|quickin|recrutai|inhire/.test(t)) return 'OBJECTION_COMPETITOR';

  // LGPD / security
  if (/lgpd|dados? (seguros?|protegidos?)|seguranca|privacidade|seguranca/.test(t)) return 'LGPD';

  // Reschedule
  if (/reagendar|remarcar|mudar horario|trocar horario|outro horario|cancelar demo|desmarcar/.test(t)) return 'RESCHEDULE';

  // Greeting
  if (/^(oi|ola|bom dia|boa tarde|boa noite|hey|hello|e ai|eai|fala)/.test(t)) return 'GREETING';

  return 'UNKNOWN';
}

// ─────────────────────────── Qualification Questions ───────────────────────────

const QUALIFICATION_QUESTIONS = [
  { key: 'name', question: 'Para eu te atender melhor, como posso te chamar?' },
  { key: 'company', question: 'Prazer, *{name}*! E qual o nome da sua empresa? Atuam em qual segmento?' },
  { key: 'role', question: 'Boa! E qual a sua função lá na *{company}*?' },
  { key: 'company_size', question: 'Entendi, {name}. E mais ou menos quantos funcionários vocês têm hoje?' },
  { key: 'pain', question: 'E no dia a dia, qual a maior dificuldade de vocês com recrutamento? Triagem demorada, agendamento manual, volume grande de currículos...?' },
];

/** Acknowledgments to make qualification feel more human */
const ACKNOWLEDGMENTS: Record<string, string[]> = {
  name: [],  // handled by the next question template
  company: ['Legal!', 'Interessante!', 'Boa!'],
  role: ['Entendi!', 'Perfeito!', 'Boa!'],
  company_size: ['Certo!', 'Entendi!', 'Legal!'],
  pain: [],  // last question, transitions to demo offer
};

function randomAck(key: string): string {
  const acks = ACKNOWLEDGMENTS[key] || [];
  if (acks.length === 0) return '';
  return acks[Math.floor(Math.random() * acks.length)] + ' ';
}

/** Get contextual greeting based on time of day (Brazil timezone) */
function getTimeGreeting(): string {
  const now = new Date();
  // Brazil UTC-3
  const brHour = (now.getUTCHours() - 3 + 24) % 24;
  if (brHour >= 5 && brHour < 12) return 'Bom dia';
  if (brHour >= 12 && brHour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Replace placeholders like {name}, {company} with context values */
function personalize(text: string, ctx: SdrConversationContext): string {
  return text
    .replace(/\{name\}/g, ctx.name || '')
    .replace(/\{company\}/g, ctx.company || '');
}

// ─────────────────────────── Types ───────────────────────────

interface SdrConv {
  id: string;
  phone: string;
  lead_id: string | null;
  instance_name: string;
  state: string;
  context: SdrConversationContext;
}

// ─────────────────────────── DB Helpers ───────────────────────────

async function getOrCreateConversation(
  phone: string,
  instanceName: string,
  supabase: SupabaseClient,
): Promise<SdrConv> {
  const { data: existing } = await supabase
    .from('sdr_conversations')
    .select('*')
    .eq('phone', phone)
    .eq('instance_name', instanceName)
    .maybeSingle();

  if (existing) return existing as SdrConv;

  // Create lead first
  const { data: lead } = await supabase
    .from('sdr_leads')
    .insert({ phone, source: 'CTWA', status: 'NOVO' })
    .select('id')
    .single();

  const { data: created, error } = await supabase
    .from('sdr_conversations')
    .insert({
      phone,
      lead_id: lead?.id || null,
      instance_name: instanceName,
      state: 'NOVO',
      context: {},
    })
    .select()
    .single();

  if (error || !created) throw new Error(`[SDR] create conversation: ${error?.message}`);
  return created as SdrConv;
}

async function updateConv(
  id: string,
  updates: Partial<{ state: string; lead_id: string | null; context: SdrConversationContext }>,
  supabase: SupabaseClient,
): Promise<void> {
  await supabase
    .from('sdr_conversations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
}

async function updateLead(
  leadId: string,
  updates: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<void> {
  await supabase
    .from('sdr_leads')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', leadId);
}

async function saveMessage(
  leadId: string,
  convId: string,
  direction: 'IN' | 'OUT',
  content: string,
  supabase: SupabaseClient,
): Promise<void> {
  await supabase.from('sdr_messages').insert({
    lead_id: leadId,
    conversation_id: convId,
    direction,
    content,
    message_type: 'text',
  });
}

async function sendAndLog(
  instance: string,
  phone: string,
  text: string,
  leadId: string | null,
  convId: string,
  supabase: SupabaseClient,
): Promise<void> {
  await evo.sendText(instance, phone, text);
  if (leadId) {
    await saveMessage(leadId, convId, 'OUT', text, supabase);
  }
}

// ─────────────────────────── Pain Questions (conversion ammo) ───────────────────────────

const PAIN_QUESTIONS = [
  { id: 'triagem', trigger: /triagem|filtrar|curriculo|currículo|volume/, text: 'Hoje, quanto tempo o seu RH gasta apenas filtrando candidatos que sequer possuem o perfil básico para a vaga?' },
  { id: 'turnover', trigger: /rotatividade|demissao|turnover|contrata(cao|ção) errada/, text: 'Você já calculou quanto custa para a empresa uma contratação errada que dura apenas 3 meses e pede demissão?' },
  { id: 'custo', trigger: /atraso|demora|lento|tempo|urgente|urgencia/, text: 'Quanto dinheiro sua empresa deixa na mesa por atrasos operacionais causados por falta de contingência de pessoal?' },
  { id: 'escala', trigger: /crescer|crescimento|escala|dobrar|expandir|grande/, text: 'Sua estrutura atual permite que você dobre o tamanho da sua empresa este ano sem que o RH se torne o seu principal gargalo?' },
  { id: 'risco', trigger: /pessoa|sozinho|depende|chave|processo/, text: 'O que acontece com a sua operação se o responsável atual pelo recrutamento sair da empresa hoje? O processo está documentado ou está na cabeça de alguém?' },
];

/** Pick the best pain question based on context, or a random one */
function pickPainQuestion(ctx: SdrConversationContext): string {
  const painText = (ctx.pain || '').toLowerCase();
  const sizeText = (ctx.company_size || '').toLowerCase();

  // Try to match based on stated pain
  for (const pq of PAIN_QUESTIONS) {
    if (pq.trigger.test(painText)) return pq.text;
  }

  // Small company → risk question
  if (/1|2|3|4|5|6|7|8|9|10|peque|micro|pouc/.test(sizeText)) {
    return PAIN_QUESTIONS[4].text; // risco
  }

  // Large company → scale question
  if (/50|100|200|500|1000|grand|muit/.test(sizeText)) {
    return PAIN_QUESTIONS[3].text; // escala
  }

  // Default: triagem (most universal)
  return PAIN_QUESTIONS[0].text;
}

// ─────────────────────────── Objection Handlers ───────────────────────────

function handleObjection(intent: Intent): string {
  switch (intent) {
    case 'OBJECTION_EXPENSIVE':
      return `Se um analista de R$ 3.000 perde duas horas por dia abrindo e-mails e cobrando candidatos no WhatsApp, são R$ 750 jogados fora todo mês. A Elevva automatiza isso 24h por R$ 29,90 ao dia, liberando a equipe para o que dá lucro.

O próximo passo é ver o sistema funcionando. Posso liberar um horário para a demonstração?`;

    case 'OBJECTION_SMALL_COMPANY':
      return `Exatamente por ser uma operação enxuta, quem lê os currículos costuma ser o dono ou um gestor-chave. O seu tempo é o ativo mais caro da empresa.

Se você abre uma vaga e recebe 150 currículos, a rotina paralisa. A Elevva analisa todos em segundos e entrega o ranking pronto.

Quer ver isso ao vivo? Posso liberar um horário para a demonstração.`;

    case 'OBJECTION_AI_TRUST':
      return `Você não precisa confiar cegamente. A Elevva é 100% transparente.

Ao lado de cada relatório gerado pela IA, existe o botão "Abrir PDF". O sistema faz a triagem para você ganhar tempo, mas o currículo original está a um clique de distância. A IA trabalha, o humano decide.

Quer ver como funciona na prática? Posso liberar um horário para a demonstração.`;

    case 'OBJECTION_COMPETITOR':
      return `Quando você clica em "Aprovar" na ferramenta atual, o que acontece depois? Quem da sua equipe chama o candidato no WhatsApp, cobra foto de CNH, confere comprovante de residência e monta o dossiê para a contabilidade?

A Elevva automatiza esse processo completo — da triagem até o dossiê final. Quer ver a diferença na prática?`;

    default:
      return '';
  }
}

// ─────────────────────────── State Handlers ───────────────────────────

async function handleNovo(
  conv: SdrConv,
  instance: string,
  phone: string,
  pushName: string,
  referralData: Record<string, unknown> | null,
  supabase: SupabaseClient,
): Promise<void> {
  const name = pushName || '';
  const timeGreet = getTimeGreeting();

  const nameRef = name ? `, *${name}*` : '';
  const greeting = `${timeGreet}${nameRef}! Sou o Bento, da Elevva.

${PITCH_CURTO}`;

  await sendAndLog(instance, phone, greeting, conv.lead_id, conv.id, supabase);

  // Save referral data from CTWA if present
  if (conv.lead_id) {
    const leadUpdate: Record<string, unknown> = { name, status: 'QUALIFICANDO' };
    if (referralData) {
      leadUpdate.referral_data = referralData;
      leadUpdate.utm_source = referralData.sourceUrl || referralData.source_url || null;
      leadUpdate.ad_id = referralData.adId || referralData.ad_id || null;
    }
    await updateLead(conv.lead_id, leadUpdate, supabase);
  }

  await updateConv(conv.id, {
    state: 'SAUDACAO_ENVIADA',
    context: { ...conv.context, name },
  }, supabase);
}

async function handleSaudacaoEnviada(
  conv: SdrConv,
  instance: string,
  phone: string,
  text: string,
  supabase: SupabaseClient,
): Promise<void> {
  const intent = detectIntent(text);

  if (intent === 'TALK_TO_HUMAN') {
    await escalateToHuman(conv, instance, phone, supabase);
    return;
  }

  if (intent === 'NO') {
    await sendAndLog(instance, phone,
      'Sem problemas. Se precisar de ajuda com recrutamento no futuro, é só me chamar aqui.',
      conv.lead_id, conv.id, supabase);
    await updateConv(conv.id, { state: 'PERDIDO' }, supabase);
    if (conv.lead_id) await updateLead(conv.lead_id, { status: 'PERDIDO', lost_reason: 'Sem interesse no primeiro contato' }, supabase);
    return;
  }

  if (intent === 'DEMO_REQUEST' || intent === 'YES') {
    // Lead already wants demo — skip qualification, go straight to scheduling
    await offerDemo(conv, instance, phone, supabase);
    return;
  }

  if (intent === 'PRICE') {
    await sendAndLog(instance, phone, PLANOS, conv.lead_id, conv.id, supabase);
    await sendAndLog(instance, phone,
      'Quer ver o sistema funcionando antes de decidir? Posso liberar um horário para a demonstração.',
      conv.lead_id, conv.id, supabase);
    await updateConv(conv.id, { state: 'TIRANDO_DUVIDAS' }, supabase);
    return;
  }

  if (intent === 'HOW_IT_WORKS') {
    await sendAndLog(instance, phone, PITCH_MEDIO, conv.lead_id, conv.id, supabase);
    await sendAndLog(instance, phone,
      'Posso liberar um horário para você ver ao vivo?',
      conv.lead_id, conv.id, supabase);
    await updateConv(conv.id, { state: 'TIRANDO_DUVIDAS' }, supabase);
    return;
  }

  // If lead just replied with a greeting, acknowledge warmly and start qualification
  if (intent === 'GREETING') {
    await sendAndLog(instance, phone,
      'Vou te fazer umas perguntas rápidas para entender melhor o seu cenário.',
      conv.lead_id, conv.id, supabase);
  }

  // Start qualification
  await startQualification(conv, instance, phone, text, supabase);
}

async function startQualification(
  conv: SdrConv,
  instance: string,
  phone: string,
  text: string,
  supabase: SupabaseClient,
): Promise<void> {
  // If the text itself looks like a name (short, no question marks), save it
  const looksLikeName = text.length > 2 && text.length < 50 && !text.includes('?');

  const ctx = { ...conv.context };
  let step = 0;

  if (looksLikeName && !ctx.name) {
    ctx.name = text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    step = 1; // skip name question
    if (conv.lead_id) await updateLead(conv.lead_id, { name: ctx.name }, supabase);
  }

  // Ask first unanswered question
  const question = QUALIFICATION_QUESTIONS[step];
  if (question) {
    const questionText = personalize(question.question, ctx);
    await sendAndLog(instance, phone, questionText, conv.lead_id, conv.id, supabase);
    ctx.qualification_step = step;
    ctx.pending_question = question.key;
  }

  await updateConv(conv.id, {
    state: 'QUALIFICANDO',
    context: ctx,
  }, supabase);
}

async function handleQualificando(
  conv: SdrConv,
  instance: string,
  phone: string,
  text: string,
  supabase: SupabaseClient,
): Promise<void> {
  const intent = detectIntent(text);

  // Priority intents override qualification
  if (intent === 'TALK_TO_HUMAN') { await escalateToHuman(conv, instance, phone, supabase); return; }
  if (intent === 'DEMO_REQUEST' || intent === 'YES') { await offerDemo(conv, instance, phone, supabase); return; }
  if (intent === 'PRICE' || intent === 'DISCOUNT' || intent === 'INTEGRATION' || intent === 'HOW_IT_WORKS' || intent === 'LGPD') {
    await updateConv(conv.id, { state: 'TIRANDO_DUVIDAS' }, supabase);
    await handleTirandoDuvidas(conv, instance, phone, text, supabase);
    return;
  }

  // Handle objections inline
  if (['OBJECTION_EXPENSIVE', 'OBJECTION_SMALL_COMPANY', 'OBJECTION_AI_TRUST', 'OBJECTION_COMPETITOR'].includes(intent)) {
    await sendAndLog(instance, phone, handleObjection(intent), conv.lead_id, conv.id, supabase);
    await updateConv(conv.id, { state: 'TIRANDO_DUVIDAS' }, supabase);
    return;
  }

  // Save answer to pending question
  const ctx = { ...conv.context };
  const pendingKey = ctx.pending_question;
  const currentStep = ctx.qualification_step ?? 0;

  if (pendingKey && conv.lead_id) {
    // Save to context and lead
    (ctx as Record<string, unknown>)[pendingKey] = text;
    const leadUpdate: Record<string, unknown> = {};

    switch (pendingKey) {
      case 'name':
        ctx.name = text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        leadUpdate.name = ctx.name;
        break;
      case 'company':
        ctx.company = text;
        leadUpdate.company = text;
        break;
      case 'role':
        ctx.role = text;
        leadUpdate.role = text;
        break;
      case 'company_size':
        ctx.company_size = text;
        leadUpdate.company_size = text;
        break;
      case 'pain':
        ctx.pain = text;
        leadUpdate.main_pain = text;
        break;
    }

    if (Object.keys(leadUpdate).length > 0) {
      await updateLead(conv.lead_id, leadUpdate, supabase);
    }
  }

  // Move to next question
  const nextStep = currentStep + 1;

  if (nextStep >= QUALIFICATION_QUESTIONS.length) {
    // Qualification complete — fire a pain question to deepen engagement before demo
    if (conv.lead_id) await updateLead(conv.lead_id, { status: 'QUALIFICADO' }, supabase);

    const painQ = pickPainQuestion(ctx);
    await sendAndLog(instance, phone, painQ, conv.lead_id, conv.id, supabase);

    // Move to OFERECENDO_DEMO — next message will trigger demo offer
    ctx.pain_question_sent = true;
    await updateConv(conv.id, { state: 'OFERECENDO_DEMO', context: ctx }, supabase);
    return;
  }

  // Ask next question
  const nextQ = QUALIFICATION_QUESTIONS[nextStep];
  // Skip if already answered in context
  if ((ctx as Record<string, unknown>)[nextQ.key]) {
    ctx.qualification_step = nextStep;
    ctx.pending_question = nextQ.key;
    await updateConv(conv.id, { context: ctx }, supabase);
    // Recurse to skip
    await handleQualificando(conv, instance, phone, '', supabase);
    return;
  }

  const questionText = personalize(nextQ.question, ctx);
  await sendAndLog(instance, phone, questionText, conv.lead_id, conv.id, supabase);
  ctx.qualification_step = nextStep;
  ctx.pending_question = nextQ.key;
  await updateConv(conv.id, { context: ctx }, supabase);
}

async function handleTirandoDuvidas(
  conv: SdrConv,
  instance: string,
  phone: string,
  text: string,
  supabase: SupabaseClient,
): Promise<void> {
  const intent = detectIntent(text);
  const firstName = conv.context.name?.split(' ')[0] || '';
  const ctx = { ...conv.context };

  // Track how many questions the lead has asked (indecision counter)
  const questionCount = (ctx.question_count ?? 0) + 1;
  ctx.question_count = questionCount;

  if (intent === 'TALK_TO_HUMAN') { await escalateToHuman(conv, instance, phone, supabase); return; }

  if (intent === 'YES' || intent === 'DEMO_REQUEST') {
    await offerDemo(conv, instance, phone, supabase);
    return;
  }

  if (intent === 'NO') {
    // Before giving up — if lead is just indecisive, fire a pain question
    if (questionCount >= 2) {
      const painQ = pickPainQuestion(ctx);
      await sendAndLog(instance, phone, painQ, conv.lead_id, conv.id, supabase);
      ctx.pain_question_sent = true;
      await updateConv(conv.id, { state: 'OFERECENDO_DEMO', context: ctx }, supabase);
      return;
    }
    const nameRef = firstName ? `, ${firstName}` : '';
    await sendAndLog(instance, phone,
      `Sem problemas${nameRef}! Fico por aqui caso precise.`,
      conv.lead_id, conv.id, supabase);
    await updateConv(conv.id, { state: 'PERDIDO', context: ctx }, supabase);
    if (conv.lead_id) await updateLead(conv.lead_id, { status: 'PERDIDO', lost_reason: 'Recusou demonstração' }, supabase);
    return;
  }

  // Answer the question first
  let answered = false;

  if (intent === 'PRICE') {
    await sendAndLog(instance, phone, PLANOS, conv.lead_id, conv.id, supabase);
    answered = true;
  } else if (intent === 'DISCOUNT') {
    await sendAndLog(instance, phone,
      `Temos opção de plano anual com condições especiais. Na demonstração, consigo apresentar os valores e alinhar a melhor opção.`,
      conv.lead_id, conv.id, supabase);
    answered = true;
  } else if (intent === 'HOW_IT_WORKS') {
    await sendAndLog(instance, phone, PITCH_MEDIO, conv.lead_id, conv.id, supabase);
    answered = true;
  } else if (intent === 'INTEGRATION') {
    await sendAndLog(instance, phone,
      `Integração nativa com Google Calendar e Meet. A IA agenda e cria salas automaticamente. Funciona no navegador, login com Google.`,
      conv.lead_id, conv.id, supabase);
    answered = true;
  } else if (intent === 'LGPD') {
    await sendAndLog(instance, phone,
      `📄 Docs por portal seguro\n⚙️ Dossiê PDF gerado\n✅ Arquivos sensíveis deletados em 48h\n\nConformidade automática.`,
      conv.lead_id, conv.id, supabase);
    answered = true;
  } else if (['OBJECTION_EXPENSIVE', 'OBJECTION_SMALL_COMPANY', 'OBJECTION_AI_TRUST', 'OBJECTION_COMPETITOR'].includes(intent)) {
    await sendAndLog(instance, phone, handleObjection(intent), conv.lead_id, conv.id, supabase);
    answered = true;
  }

  // On 3rd+ question: fire a pain question to break indecision
  if (questionCount >= 3 && !ctx.pain_question_sent) {
    const painQ = pickPainQuestion(ctx);
    await sendAndLog(instance, phone, painQ, conv.lead_id, conv.id, supabase);
    ctx.pain_question_sent = true;
    await updateConv(conv.id, { state: 'OFERECENDO_DEMO', context: ctx }, supabase);
    return;
  }

  // On 5th+ question: be more direct
  if (questionCount >= 5) {
    const painQs = PAIN_QUESTIONS.filter(pq => pq.id !== 'triagem'); // pick a different one
    const randomPain = painQs[Math.floor(Math.random() * painQs.length)];
    await sendAndLog(instance, phone,
      `${firstName ? firstName + ', ' : ''}Deixa eu te fazer uma pergunta:\n\n${randomPain.text}`,
      conv.lead_id, conv.id, supabase);
    await updateConv(conv.id, { state: 'OFERECENDO_DEMO', context: ctx }, supabase);
    return;
  }

  if (answered) {
    // After answering, gentle CTA
    if (questionCount >= 2) {
      await sendAndLog(instance, phone,
        'Quer ver tudo isso na prática? A demo dura 30 min.',
        conv.lead_id, conv.id, supabase);
    }
    await updateConv(conv.id, { context: ctx }, supabase);
    return;
  }

  // Unknown question — varied responses
  const unknownResponses = [
    `Posso te ajudar com preços, funcionalidades, integrações ou segurança. O que quer saber?`,
    `Pode perguntar o que quiser — estou aqui para ajudar.`,
    `Não entendi bem. Pode reformular?`,
  ];
  const unknownIdx = (ctx.unknown_count ?? 0);
  ctx.unknown_count = unknownIdx + 1;
  await sendAndLog(instance, phone, unknownResponses[unknownIdx % unknownResponses.length], conv.lead_id, conv.id, supabase);
  await updateConv(conv.id, { context: ctx }, supabase);
}

/** Suggest a concrete demo time based on current time (Brazil UTC-3) */
function suggestDemoSlot(): { date: string; time: string; label: string } {
  const now = new Date();
  const brNow = new Date(now.getTime() - 3 * 60 * 60 * 1000); // UTC-3
  const brHour = brNow.getUTCHours();
  const brMinutes = brNow.getUTCMinutes();

  // Work with a copy for date calculations
  let targetDate = new Date(brNow);
  let targetHour: number;

  if (brHour < 16) {
    // Still time today — suggest 2 hours from now, rounded to next full hour
    targetHour = brHour + 2;
    if (brMinutes > 0) targetHour++;
    if (targetHour < 9) targetHour = 9;
    if (targetHour > 18) {
      // Too late today, go to tomorrow
      targetDate.setUTCDate(targetDate.getUTCDate() + 1);
      targetHour = 10;
    }
  } else {
    // Too late today — suggest tomorrow
    targetDate.setUTCDate(targetDate.getUTCDate() + 1);
    targetHour = 10;
  }

  // Skip weekends
  const dayOfWeek = targetDate.getUTCDay();
  if (dayOfWeek === 0) targetDate.setUTCDate(targetDate.getUTCDate() + 1); // Sunday → Monday
  if (dayOfWeek === 6) targetDate.setUTCDate(targetDate.getUTCDate() + 2); // Saturday → Monday

  const y = targetDate.getUTCFullYear();
  const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getUTCDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;
  const timeStr = `${String(targetHour).padStart(2, '0')}:00`;

  // Format label: "amanhã (30/03) às 10h" or "segunda (31/03) às 10h"
  const isToday = targetDate.getUTCDate() === brNow.getUTCDate() && targetDate.getUTCMonth() === brNow.getUTCMonth();
  const tomorrow = new Date(brNow);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const isTomorrow = targetDate.getUTCDate() === tomorrow.getUTCDate() && targetDate.getUTCMonth() === tomorrow.getUTCMonth();

  const weekDays = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  let dayLabel: string;
  if (isToday) dayLabel = 'hoje';
  else if (isTomorrow) dayLabel = 'amanhã';
  else dayLabel = weekDays[targetDate.getUTCDay()];

  const label = `${dayLabel} (${d}/${m}) às ${targetHour}h`;

  return { date: dateStr, time: timeStr, label };
}

/** Format a date string YYYY-MM-DD as DD/MM */
function formatDateBR(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

async function offerDemo(
  conv: SdrConv,
  instance: string,
  phone: string,
  supabase: SupabaseClient,
): Promise<void> {
  const firstName = conv.context.name?.split(' ')[0] || '';
  const nameRef = firstName ? `, *${firstName}*` : '';
  const slot = suggestDemoSlot();

  await sendAndLog(instance, phone,
    `Ótimo${nameRef}! A demo dura 30 min e é online pelo Google Meet.\n\nConsigo encaixar ${slot.label}. Funciona para você?`,
    conv.lead_id, conv.id, supabase);

  const ctx = { ...conv.context, proposed_date: slot.date, proposed_time: slot.time };
  await updateConv(conv.id, {
    state: 'NEGOCIANDO_HORARIO',
    context: ctx,
  }, supabase);

  if (conv.lead_id) await updateLead(conv.lead_id, { status: 'DEMO_OFERECIDA' }, supabase);
}

async function handleOferecendoDemo(
  conv: SdrConv,
  instance: string,
  phone: string,
  text: string,
  supabase: SupabaseClient,
): Promise<void> {
  const intent = detectIntent(text);
  const firstName = conv.context.name?.split(' ')[0] || '';

  if (intent === 'TALK_TO_HUMAN') { await escalateToHuman(conv, instance, phone, supabase); return; }
  if (intent === 'NO') {
    await sendAndLog(instance, phone,
      `Sem problemas${firstName ? ', ' + firstName : ''}! Fico por aqui se precisar.`,
      conv.lead_id, conv.id, supabase);
    await updateConv(conv.id, { state: 'PERDIDO' }, supabase);
    if (conv.lead_id) await updateLead(conv.lead_id, { status: 'PERDIDO', lost_reason: 'Declinou após pergunta de dor' }, supabase);
    return;
  }

  // Any other response to the pain question — acknowledge and connect to demo
  const nameRef = firstName ? `, *${firstName}*` : '';
  await sendAndLog(instance, phone,
    `É exatamente isso que a Elevva resolve${nameRef}. Na demonstração, mostro na prática como o sistema elimina esse problema da sua rotina.`,
    conv.lead_id, conv.id, supabase);

  await offerDemo(conv, instance, phone, supabase);
}

/** Try to extract a time from text like "14h", "às 15", "10:30", "as 9" */
function extractTime(text: string): string | null {
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // "14h", "14h30", "14:30", "às 14", "as 14"
  const match = t.match(/(\d{1,2})\s*[:h]\s*(\d{2})?/);
  if (match) {
    const hour = parseInt(match[1]);
    const min = match[2] ? parseInt(match[2]) : 0;
    if (hour >= 8 && hour <= 20) return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }
  // "às 14", "as 9"
  const match2 = t.match(/(?:as|às)\s*(\d{1,2})/);
  if (match2) {
    const hour = parseInt(match2[1]);
    if (hour >= 8 && hour <= 20) return `${String(hour).padStart(2, '0')}:00`;
  }
  return null;
}

/** Try to extract a date reference from text */
function extractDate(text: string, refDate?: string): string | null {
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const now = new Date();
  const brNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);

  // "hoje"
  if (/\bhoje\b/.test(t)) {
    const y = brNow.getUTCFullYear(), m = brNow.getUTCMonth() + 1, d = brNow.getUTCDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  // "amanha"
  if (/\bamanha\b/.test(t)) {
    const tm = new Date(brNow);
    tm.setUTCDate(tm.getUTCDate() + 1);
    return `${tm.getUTCFullYear()}-${String(tm.getUTCMonth() + 1).padStart(2, '0')}-${String(tm.getUTCDate()).padStart(2, '0')}`;
  }
  // Day of week: "segunda", "terca", etc.
  const weekDays: Record<string, number> = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
  for (const [name, dow] of Object.entries(weekDays)) {
    if (t.includes(name)) {
      const target = new Date(brNow);
      const diff = (dow - target.getUTCDay() + 7) % 7 || 7;
      target.setUTCDate(target.getUTCDate() + diff);
      return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(target.getUTCDate()).padStart(2, '0')}`;
    }
  }
  // DD/MM pattern
  const dateMatch = t.match(/(\d{1,2})\s*[\/\-]\s*(\d{1,2})/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]), month = parseInt(dateMatch[2]);
    const year = brNow.getUTCFullYear();
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return null;
}

/** Book the demo: create Google Calendar event with Meet and notify lead */
async function confirmDemo(
  conv: SdrConv,
  instance: string,
  phone: string,
  date: string,
  time: string,
  supabase: SupabaseClient,
): Promise<void> {
  const firstName = conv.context.name?.split(' ')[0] || '';
  const leadName = conv.context.name || 'Lead SDR';

  // Create Google Calendar + Meet event
  const result = await createMeetingEvent({
    candidateName: leadName,
    jobTitle: 'Demonstração Elevva',
    slotDate: date,
    slotTime: time,
    candidatePhone: phone,
  });

  const meetLink = result?.meetLink || '';
  const eventId = result?.eventId || '';
  const dateLabel = formatDateBR(date);
  const hourLabel = time.replace(':00', 'h').replace(':30', 'h30');

  if (meetLink) {
    await sendAndLog(instance, phone,
      `✅ *Demonstração confirmada!*\n\n📅 ${dateLabel} às ${hourLabel}\n💻 Online via Google Meet\n\n${meetLink}\n\nNos vemos lá${firstName ? ', *' + firstName + '*' : ''}!`,
      conv.lead_id, conv.id, supabase);
  } else {
    await sendAndLog(instance, phone,
      `✅ *Demonstração confirmada!*\n\n📅 ${dateLabel} às ${hourLabel}\n\nVou te enviar o link da reunião em breve${firstName ? ', *' + firstName + '*' : ''}.`,
      conv.lead_id, conv.id, supabase);
  }

  const ctx = { ...conv.context, google_event_id: eventId, meeting_link: meetLink, proposed_date: date, proposed_time: time };
  await updateConv(conv.id, { state: 'DEMO_AGENDADA', context: ctx }, supabase);
  if (conv.lead_id) await updateLead(conv.lead_id, { status: 'DEMO_AGENDADA' }, supabase);
}

async function handleNegociandoHorario(
  conv: SdrConv,
  instance: string,
  phone: string,
  text: string,
  supabase: SupabaseClient,
): Promise<void> {
  const intent = detectIntent(text);
  const firstName = conv.context.name?.split(' ')[0] || '';
  const proposedDate = conv.context.proposed_date || '';
  const proposedTime = conv.context.proposed_time || '';

  if (intent === 'TALK_TO_HUMAN') { await escalateToHuman(conv, instance, phone, supabase); return; }

  if (intent === 'NO') {
    await sendAndLog(instance, phone,
      `Sem problemas${firstName ? ', ' + firstName : ''}! Tem algum dia e horário que funcione melhor para você?`,
      conv.lead_id, conv.id, supabase);
    return; // Stay in NEGOCIANDO_HORARIO
  }

  // Lead accepted the proposed time
  if (intent === 'YES') {
    if (proposedDate && proposedTime) {
      const dateLabel = formatDateBR(proposedDate);
      const hourLabel = proposedTime.replace(':00', 'h').replace(':30', 'h30');
      await sendAndLog(instance, phone,
        `Perfeito! Vou agendar para *${dateLabel} às ${hourLabel}*. Um momento...`,
        conv.lead_id, conv.id, supabase);
      await confirmDemo(conv, instance, phone, proposedDate, proposedTime, supabase);
    } else {
      await offerDemo(conv, instance, phone, supabase);
    }
    return;
  }

  // Lead has questions — answer them without leaving negotiation
  if (['PRICE', 'DISCOUNT', 'HOW_IT_WORKS', 'INTEGRATION', 'LGPD'].includes(intent)) {
    await updateConv(conv.id, { state: 'TIRANDO_DUVIDAS' }, supabase);
    await handleTirandoDuvidas(conv, instance, phone, text, supabase);
    return;
  }

  if (['OBJECTION_EXPENSIVE', 'OBJECTION_SMALL_COMPANY', 'OBJECTION_AI_TRUST', 'OBJECTION_COMPETITOR'].includes(intent)) {
    await sendAndLog(instance, phone, handleObjection(intent), conv.lead_id, conv.id, supabase);
    return;
  }

  // Try to extract a counter-proposal (time and/or date)
  const newTime = extractTime(text);
  const newDate = extractDate(text, proposedDate);

  if (newTime || newDate) {
    const finalDate = newDate || proposedDate;
    const finalTime = newTime || proposedTime;
    const dateLabel = formatDateBR(finalDate);
    const hourLabel = finalTime.replace(':00', 'h').replace(':30', 'h30');

    // Validate business hours
    const hour = parseInt(finalTime.split(':')[0]);
    if (hour < 8 || hour > 19) {
      await sendAndLog(instance, phone,
        `Os horários disponíveis são das 8h às 19h. Qual horário funciona para você?`,
        conv.lead_id, conv.id, supabase);
      return;
    }

    // Confirm the counter-proposal
    await sendAndLog(instance, phone,
      `Combinado! *${dateLabel} às ${hourLabel}*. Posso confirmar na agenda?`,
      conv.lead_id, conv.id, supabase);

    const ctx = { ...conv.context, proposed_date: finalDate, proposed_time: finalTime };
    await updateConv(conv.id, { context: ctx }, supabase);
    return;
  }

  // Couldn't understand — ask again naturally
  await sendAndLog(instance, phone,
    `Me diz um dia e horário que funcione para você. A demo dura 30 min, pode ser de segunda a sexta das 8h às 19h.`,
    conv.lead_id, conv.id, supabase);
}

async function handleAguardandoSlot(
  conv: SdrConv,
  instance: string,
  phone: string,
  text: string,
  supabase: SupabaseClient,
): Promise<void> {
  const intent = detectIntent(text);

  if (intent === 'TALK_TO_HUMAN') { await escalateToHuman(conv, instance, phone, supabase); return; }
  if (intent === 'RESCHEDULE') { await handleReschedule(conv, instance, phone, supabase); return; }

  // Lead has questions — switch to TIRANDO_DUVIDAS to answer without loop
  if (['HOW_IT_WORKS', 'PRICE', 'DISCOUNT', 'INTEGRATION', 'LGPD', 'OBJECTION_EXPENSIVE', 'OBJECTION_SMALL_COMPANY', 'OBJECTION_AI_TRUST', 'OBJECTION_COMPETITOR', 'UNKNOWN', 'GREETING'].includes(intent)) {
    // Keep scheduling token in context so we can offer the link later
    await updateConv(conv.id, { state: 'TIRANDO_DUVIDAS' }, supabase);
    await handleTirandoDuvidas(conv, instance, phone, text, supabase);
    return;
  }

  if (intent === 'YES' || intent === 'DEMO_REQUEST') {
    const token = conv.context.scheduling_token;
    if (token) {
      const baseUrl = process.env.BASE_URL || 'https://app.elevva.net.br';
      await sendAndLog(instance, phone,
        `📅 Segue o link para escolher o horário:\n${baseUrl}/api/sdr/agendar/${token}`,
        conv.lead_id, conv.id, supabase);
    } else {
      await offerDemo(conv, instance, phone, supabase);
    }
    return;
  }

  if (intent === 'NO') {
    await sendAndLog(instance, phone,
      'Sem problemas! Fico por aqui se precisar.',
      conv.lead_id, conv.id, supabase);
    await updateConv(conv.id, { state: 'PERDIDO' }, supabase);
    if (conv.lead_id) await updateLead(conv.lead_id, { status: 'PERDIDO', lost_reason: 'Desistiu após oferta de demo' }, supabase);
    return;
  }
}

async function handleDemoAgendada(
  conv: SdrConv,
  instance: string,
  phone: string,
  text: string,
  supabase: SupabaseClient,
): Promise<void> {
  const intent = detectIntent(text);

  if (intent === 'TALK_TO_HUMAN') { await escalateToHuman(conv, instance, phone, supabase); return; }

  if (intent === 'RESCHEDULE') {
    await handleReschedule(conv, instance, phone, supabase);
    return;
  }

  // Any other message in this state
  const meetLink = conv.context.meeting_link;
  const meetText = meetLink ? `\n\n📅 Link da reunião: ${meetLink}` : '';

  await sendAndLog(instance, phone,
    `Sua demonstração já está confirmada.${meetText}\n\nSe precisar reagendar, é só me avisar.`,
    conv.lead_id, conv.id, supabase);
}

async function handleReschedule(
  conv: SdrConv,
  instance: string,
  phone: string,
  supabase: SupabaseClient,
): Promise<void> {
  // Delete old Google Calendar event if exists
  if (conv.context.google_event_id) {
    await deleteCalendarEvent(conv.context.google_event_id);
  }

  // Free old slot if exists
  if (conv.context.demo_slot_id) {
    await supabase
      .from('sdr_demo_slots')
      .update({ is_booked: false, booked_by: null })
      .eq('id', conv.context.demo_slot_id);
  }

  // Generate new token and offer demo again
  const token = crypto.randomBytes(16).toString('hex');
  const baseUrl = process.env.BASE_URL || 'https://app.elevva.net.br';
  const link = `${baseUrl}/api/sdr/agendar/${token}`;

  await sendAndLog(instance, phone,
    `Sem problemas. Escolha um novo horário para a demonstração:\n\n${link}`,
    conv.lead_id, conv.id, supabase);

  await updateConv(conv.id, {
    state: 'AGUARDANDO_ESCOLHA_SLOT',
    context: {
      ...conv.context,
      scheduling_token: token,
      google_event_id: undefined,
      meeting_link: undefined,
      demo_slot_id: undefined,
    },
  }, supabase);
}

async function escalateToHuman(
  conv: SdrConv,
  instance: string,
  phone: string,
  supabase: SupabaseClient,
): Promise<void> {
  await sendAndLog(instance, phone,
    'Vou conectar você com nosso time agora. Um momento.',
    conv.lead_id, conv.id, supabase);

  await updateConv(conv.id, { state: 'ESCALADO_HUMANO' }, supabase);
}

// ─────────────────────────── Main Entry Point ───────────────────────────

export async function processSdrMessage(
  instance: string,
  phone: string,
  pushName: string,
  textContent: string | null,
  referralData: Record<string, unknown> | null,
  supabase: SupabaseClient,
): Promise<void> {
  const conv = await getOrCreateConversation(phone, instance, supabase);
  const text = (textContent || '').trim();

  // Log incoming message
  if (conv.lead_id && text) {
    await saveMessage(conv.lead_id, conv.id, 'IN', text, supabase);
  }

  // Update name from pushName if not set
  if (pushName && !conv.context.name) {
    conv.context = { ...conv.context, name: pushName };
    await updateConv(conv.id, { context: conv.context }, supabase);
    if (conv.lead_id) await updateLead(conv.lead_id, { name: pushName }, supabase);
  }

  switch (conv.state) {
    case 'NOVO':
      await handleNovo(conv, instance, phone, pushName, referralData, supabase);
      break;

    case 'SAUDACAO_ENVIADA':
      await handleSaudacaoEnviada(conv, instance, phone, text, supabase);
      break;

    case 'QUALIFICANDO':
      await handleQualificando(conv, instance, phone, text, supabase);
      break;

    case 'TIRANDO_DUVIDAS':
    case 'OFERECENDO_DEMO':
      await handleOferecendoDemo(conv, instance, phone, text, supabase);
      break;

    case 'NEGOCIANDO_HORARIO':
      await handleNegociandoHorario(conv, instance, phone, text, supabase);
      break;

    case 'AGUARDANDO_ESCOLHA_SLOT':
      await handleAguardandoSlot(conv, instance, phone, text, supabase);
      break;

    case 'DEMO_AGENDADA':
      await handleDemoAgendada(conv, instance, phone, text, supabase);
      break;

    case 'FOLLOW_UP_1':
    case 'FOLLOW_UP_2':
      // Lead responded to follow-up — treat as re-engagement
      await handleTirandoDuvidas(conv, instance, phone, text, supabase);
      break;

    case 'ESCALADO_HUMANO':
      // Already escalated — do nothing, human is handling
      break;

    case 'PERDIDO':
      // Lead re-engaged — restart flow
      await handleNovo(conv, instance, phone, pushName, referralData, supabase);
      break;

    case 'CONVERTIDO':
      await sendAndLog(instance, phone,
        'Que bom ter você como cliente da Elevva! Se precisar de qualquer ajuda, é só chamar.',
        conv.lead_id, conv.id, supabase);
      break;

    default:
      await handleNovo(conv, instance, phone, pushName, referralData, supabase);
  }
}

// ─────────────────────────── Follow-up Cron ───────────────────────────

export async function runSdrFollowUps(supabase: SupabaseClient): Promise<{ sent: number; lost: number }> {
  let sent = 0;
  let lost = 0;

  // Find conversations that need follow-up:
  // - State is AGUARDANDO_ESCOLHA_SLOT or TIRANDO_DUVIDAS or OFERECENDO_DEMO
  // - Last updated > 24h ago (for first follow-up) or > 48h (for second)
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  // First follow-up: conversations idle for 24h+
  const { data: needFollowUp1 } = await supabase
    .from('sdr_conversations')
    .select('*')
    .in('state', ['AGUARDANDO_ESCOLHA_SLOT', 'TIRANDO_DUVIDAS', 'OFERECENDO_DEMO', 'SAUDACAO_ENVIADA'])
    .lt('updated_at', cutoff24h)
    .not('state', 'in', '(FOLLOW_UP_1,FOLLOW_UP_2,PERDIDO,CONVERTIDO,DEMO_AGENDADA,ESCALADO_HUMANO)');

  for (const conv of (needFollowUp1 || [])) {
    const c = conv as SdrConv;
    const name = c.context.name || 'Visitante';

    if (c.context.scheduling_token) {
      const baseUrl = process.env.BASE_URL || 'https://app.elevva.net.br';
      const link = `${baseUrl}/api/sdr/agendar/${c.context.scheduling_token}`;
      await evo.sendText(c.instance_name, c.phone,
        `${name}, vi que você ainda não escolheu o horário da demonstração.\n\nOs horários disponíveis estão neste link:\n${link}\n\nSe tiver alguma dúvida antes, é só responder aqui.`);
    } else {
      await evo.sendText(c.instance_name, c.phone,
        `${name}, ficou com alguma dúvida sobre a Elevva? Posso te ajudar ou liberar um horário para a demonstração.`);
    }

    await updateConv(c.id, { state: 'FOLLOW_UP_1', context: { ...c.context, follow_up_count: 1, last_follow_up_at: new Date().toISOString() } }, supabase);
    sent++;
  }

  // Second follow-up: conversations in FOLLOW_UP_1 idle for 48h+
  const { data: needFollowUp2 } = await supabase
    .from('sdr_conversations')
    .select('*')
    .eq('state', 'FOLLOW_UP_1')
    .lt('updated_at', cutoff48h);

  for (const conv of (needFollowUp2 || [])) {
    const c = conv as SdrConv;
    const name = c.context.name || 'Visitante';

    await evo.sendText(c.instance_name, c.phone,
      `${name}, última mensagem sobre isso. Se tiver interesse em conhecer a Elevva no futuro, é só me chamar aqui. Fico à disposição.`);

    await updateConv(c.id, { state: 'FOLLOW_UP_2' }, supabase);
    sent++;
  }

  // Mark as lost: conversations in FOLLOW_UP_2 idle for 48h+
  const { data: markLost } = await supabase
    .from('sdr_conversations')
    .select('id, lead_id')
    .eq('state', 'FOLLOW_UP_2')
    .lt('updated_at', cutoff48h);

  for (const conv of (markLost || [])) {
    await updateConv(conv.id, { state: 'PERDIDO' }, supabase);
    if (conv.lead_id) {
      await updateLead(conv.lead_id, { status: 'PERDIDO', lost_reason: 'Sem resposta após follow-ups' }, supabase);
    }
    lost++;
  }

  return { sent, lost };
}

// ─────────────────────────── Demo Reminder Cron ───────────────────────────

export async function runSdrDemoReminders(supabase: SupabaseClient): Promise<number> {
  let sent = 0;

  // Find demos happening in next 24h that haven't been reminded
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const todayStr = now.toISOString().split('T')[0];
  const tomorrowStr = in24h.toISOString().split('T')[0];

  const { data: upcomingSlots } = await supabase
    .from('sdr_demo_slots')
    .select('id, slot_date, slot_time, meeting_link, booked_by')
    .eq('is_booked', true)
    .in('slot_date', [todayStr, tomorrowStr]);

  for (const slot of (upcomingSlots || [])) {
    if (!slot.booked_by) continue;

    // Find the conversation for this lead
    const { data: conv } = await supabase
      .from('sdr_conversations')
      .select('id, phone, instance_name, context')
      .eq('lead_id', slot.booked_by)
      .eq('state', 'DEMO_AGENDADA')
      .maybeSingle();

    if (!conv) continue;

    // Check if already reminded (use metadata)
    const ctx = (conv.context || {}) as SdrConversationContext;
    if ((ctx as Record<string, unknown>).reminder_sent) continue;

    const [year, month, day] = slot.slot_date.split('-').map(Number);
    const dateLabel = new Date(year, month - 1, day).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    const timeLabel = slot.slot_time.substring(0, 5);
    const meetText = slot.meeting_link ? `\n\n📅 Link da reunião: ${slot.meeting_link}` : '';
    const name = ctx.name || 'Visitante';

    await evo.sendText(conv.instance_name, conv.phone,
      `${name}, lembrete da sua demonstração da Elevva:\n\n📅 ${dateLabel} às ${timeLabel}${meetText}\n\nNos vemos lá.`);

    await updateConv(conv.id, { context: { ...ctx, reminder_sent: true } as SdrConversationContext }, supabase);
    sent++;
  }

  return sent;
}
