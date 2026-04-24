/**
 * Agent Service — State Machine
 *
 * States:
 *   NOVO                   → first contact, show job list
 *   SELECIONANDO_VAGA      → waiting for job choice
 *   AGUARDANDO_CURRICULO   → waiting for PDF
 *   ANALISANDO             → PDF being processed (lock to prevent double send)
 *   CURRICULO_RECEBIDO     → analysis done, waiting for recruiter to approve
 *   AGUARDANDO_ESCOLHA_SLOT → slots sent to candidate, waiting for choice
 *   ENTREVISTA_CONFIRMADA  → interview booked, flow complete
 *   REPROVADO / EM_ANALISE → terminal states after CV analysis
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { analyzeResume } from './openaiService.js';
import * as evo from './evolutionService.js';
import { mirrorMessage } from './chatwootService.js';
import { deleteCalendarEvent } from './googleCalendarService.js';
import crypto from 'crypto';

// ─────────────────────────── Helpers ─────────────────────────

const INVALID_NAME_WORDS = ['erro', 'error', 'null', 'undefined', 'candidato', 'não', 'nao', 'análise', 'analise', 'identificado', 'whatsapp', 'desconhecido'];

function isValidName(name: string): boolean {
  if (!name || name.length < 3) return false;
  const lower = name.toLowerCase();
  return !INVALID_NAME_WORDS.some(w => lower.includes(w));
}

function normalizeName(raw: string): string {
  if (!isValidName(raw)) return raw;
  const parts = raw.trim().toLowerCase().split(/\s+/);
  const capitalize = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
  if (parts.length <= 1) return capitalize(parts[0] || raw);
  return capitalize(parts[0]) + ' ' + capitalize(parts[1]);
}

// ─────────────────────────── Slot Helpers ────────────────────

/** Retorna true se o slot (data + hora) já passou */
function isSlotExpired(slotDate: string, slotTime: string): boolean {
  const now = new Date();
  const slotDt = new Date(`${slotDate}T${slotTime}`);
  return slotDt <= now;
}

/**
 * Sincroniza interview_slots de um job com availability_slots do usuário.
 * - Remove slots vencidos (is_booked=false e data/hora passada)
 * - Adiciona slots novos que existem em availability_slots mas não em interview_slots
 * - Preserva slots já reservados (is_booked=true)
 */
async function syncInterviewSlots(jobId: string, userId: string, supabase: SupabaseClient): Promise<void> {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM

  // 1. Deletar slots vencidos e não reservados
  const { data: allSlots } = await supabase
    .from('interview_slots')
    .select('id, slot_date, slot_time, is_booked')
    .eq('job_id', jobId)
    .eq('is_booked', false);

  const expiredIds = (allSlots || [])
    .filter((s: any) => isSlotExpired(s.slot_date, s.slot_time))
    .map((s: any) => s.id);

  if (expiredIds.length > 0) {
    await supabase.from('interview_slots').delete().in('id', expiredIds);
  }

  // 2. Buscar slots disponíveis do usuário (source of truth)
  const { data: availSlots } = await supabase
    .from('availability_slots')
    .select('slot_date, slot_time, format, location, interviewer_name')
    .eq('user_id', userId)
    .or(`slot_date.gt.${today},and(slot_date.eq.${today},slot_time.gt.${currentTime})`)
    .order('slot_date', { ascending: true })
    .order('slot_time', { ascending: true });

  if (!availSlots?.length) return;

  // 3. Buscar interview_slots existentes para evitar duplicatas
  const { data: existing } = await supabase
    .from('interview_slots')
    .select('slot_date, slot_time')
    .eq('job_id', jobId);

  const existingKeys = new Set((existing || []).map((s: any) => `${s.slot_date}|${s.slot_time}`));

  // 4. Inserir apenas os slots que ainda não existem
  const toInsert = availSlots
    .filter((s: any) => !existingKeys.has(`${s.slot_date}|${s.slot_time}`))
    .map((s: any) => ({
      job_id: jobId,
      format: s.format,
      location: s.location,
      interviewer_name: s.interviewer_name,
      slot_date: s.slot_date,
      slot_time: s.slot_time,
      is_booked: false,
    }));

  if (toInsert.length > 0) {
    await supabase.from('interview_slots').insert(toInsert);
  }
}

// ─────────────────────────── Types ───────────────────────────

interface ConversationContext {
  candidate_name?: string;
  candidate_id?: string;
  job_title?: string;
  job_id?: string;
  jobs?: Array<{ id: string; title: string }>;
  niches?: Array<{ id: string; name: string }>;
  niche_id?: string;
  niche_name?: string;
  interview_id?: string;
  scheduling_token?: string;
  reminder_interview_id?: string;
  pos_cancelamento?: boolean;
}

interface Conversation {
  id: string;
  phone: string;
  user_id: string;
  job_id: string | null;
  state: string;
  context: ConversationContext;
  human_takeover?: boolean;
  chatwoot_conversation_id?: number;
}

// ─────────────────────────── Helpers ───────────────────────────


// ─────────────────────────── DB helpers ───────────────────────────

async function getOrCreateConversation(
  phone: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<Conversation> {
  // Tenta encontrar conversa existente — inclui variante com + para compatibilidade
  // com registros antigos que podem ter sido salvos com o prefixo +
  const phoneVariants = [phone, `+${phone}`];
  const { data: existing } = await supabase
    .from('agent_conversations')
    .select('*')
    .in('phone', phoneVariants)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    // Normaliza o telefone salvo se ainda tiver + (migração silenciosa)
    if (existing.phone !== phone) {
      await supabase
        .from('agent_conversations')
        .update({ phone })
        .eq('id', existing.id);
      existing.phone = phone;
    }
    return existing as Conversation;
  }

  const { data: created, error } = await supabase
    .from('agent_conversations')
    .insert({ phone, user_id: userId, state: 'NOVO', context: {} })
    .select()
    .single();

  if (error || !created) throw new Error(`[Agent] create conversation: ${error?.message}`);
  return created as Conversation;
}

async function updateConversation(
  id: string,
  updates: Partial<{ state: string; job_id: string | null; context: ConversationContext }>,
  supabase: SupabaseClient,
): Promise<void> {
  await supabase
    .from('agent_conversations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
}

// ─────────────────────────── State handlers ───────────────────────────

type SendFn = (jid: string, text: string) => Promise<void>;

async function handleNovo(
  conv: Conversation,
  _instance: string,
  phone: string,
  pushName: string,
  _portalCode: string,
  supabase: SupabaseClient,
  send: SendFn,
): Promise<void> {
  // Busca nichos ativos do recrutador ordenados por posição
  const { data: niches } = await supabase
    .from('niches')
    .select('id, name')
    .eq('user_id', conv.user_id)
    .order('order_pos', { ascending: true });

  const greeting = pushName ? `Olá, *${pushName}*! 👋` : 'Olá! 👋';

  // Se não há nichos cadastrados, vai direto para lista de vagas
  if (!niches || niches.length === 0) {
    await handleNovo_SemNichos(conv, phone, greeting, supabase, send);
    return;
  }

  // Se há apenas 1 nicho, pula a seleção e vai direto para as vagas desse nicho
  if (niches.length === 1) {
    const onlyNiche = niches[0];
    const { data: jobs } = await supabase
      .from('jobs')
      .select('id, title')
      .eq('user_id', conv.user_id)
      .eq('niche_id', onlyNiche.id)
      .eq('is_paused', false)
      .order('created_at', { ascending: false });

    if (!jobs || jobs.length === 0) {
      await send(phone, `${greeting} Sou o *Bento*, assistente de recrutamento. 🤖\n\nNo momento não há vagas abertas. Em breve novas oportunidades serão divulgadas!`);
      return;
    }

    const jobList = jobs.map((j, i) => `${i + 1}. ${j.title}`).join('\n');
    await send(phone,
      `${greeting} Sou o *Bento*, assistente de recrutamento. 🤖\n\n` +
      `Temos as seguintes vagas abertas:\n\n${jobList}\n\n` +
      `Responda com o *número* da vaga desejada.`
    );

    await updateConversation(conv.id, {
      state: 'SELECIONANDO_VAGA',
      context: {
        ...conv.context,
        niches,
        niche_id: onlyNiche.id,
        niche_name: onlyNiche.name,
        jobs,
      },
    }, supabase);
    return;
  }

  const nicheList = niches.map((n, i) => `${i + 1}. ${n.name}`).join('\n');

  await send(phone,
    `${greeting} Sou o *Bento*, assistente de recrutamento. 🤖\n\n` +
    `Temos vagas abertas em diversas áreas! Em qual delas você tem interesse?\n\n` +
    `${nicheList}\n\n` +
    `Responda com o *número* da área desejada.`
  );

  await updateConversation(conv.id, {
    state: 'SELECIONANDO_NICHO',
    context: { ...conv.context, niches },
  }, supabase);
}

async function handleNovo_SemNichos(
  conv: Conversation,
  phone: string,
  greeting: string,
  supabase: SupabaseClient,
  send: SendFn,
): Promise<void> {
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title')
    .eq('user_id', conv.user_id)
    .eq('is_paused', false)
    .order('created_at', { ascending: false });

  if (!jobs || jobs.length === 0) {
    await send(phone, `${greeting} Sou o *Bento*, assistente de recrutamento. 🤖\n\nNo momento não há vagas abertas. Em breve novas oportunidades serão divulgadas!`);
    return;
  }

  const jobList = jobs.map((j, i) => `${i + 1}. ${j.title}`).join('\n');
  await send(phone,
    `${greeting} Sou o *Bento*, assistente de recrutamento. 🤖\n\n` +
    `Temos as seguintes vagas abertas:\n\n${jobList}\n\n` +
    `Responda com o *número* da vaga desejada.`
  );

  await updateConversation(conv.id, {
    state: 'SELECIONANDO_VAGA',
    context: { ...conv.context, jobs },
  }, supabase);
}

async function handleSelecionandoNicho(
  conv: Conversation,
  phone: string,
  text: string,
  supabase: SupabaseClient,
  send: SendFn,
): Promise<void> {
  const niches = conv.context.niches || [];
  let selectedNiche: { id: string; name: string } | undefined;

  // Tenta por número
  const num = parseInt(text, 10);
  if (!isNaN(num) && num >= 1 && num <= niches.length) {
    selectedNiche = niches[num - 1];
  }

  // Tenta por nome (fuzzy)
  if (!selectedNiche && text.length > 1) {
    const lower = text.toLowerCase();
    selectedNiche = niches.find(n => n.name.toLowerCase().includes(lower));
  }

  if (!selectedNiche) {
    const list = niches.map((n, i) => `${i + 1}. ${n.name}`).join('\n');
    await send(phone, `Não entendi. Por favor, responda com o *número* da área:\n\n${list}`);
    return;
  }

  // Busca vagas do nicho selecionado
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title')
    .eq('user_id', conv.user_id)
    .eq('niche_id', selectedNiche.id)
    .eq('is_paused', false)
    .order('created_at', { ascending: false });

  if (!jobs || jobs.length === 0) {
    const list = niches.map((n, i) => `${i + 1}. ${n.name}`).join('\n');
    await send(phone, `No momento não há vagas abertas em *${selectedNiche.name}*. 😔\n\nEscolha outra área:\n\n${list}`);
    return;
  }

  const jobList = jobs.map((j, i) => `${i + 1}. ${j.title}`).join('\n');
  await send(phone,
    `Ótimo! Vagas disponíveis em *${selectedNiche.name}*:\n\n${jobList}\n\n` +
    `Responda com o *número* da vaga que deseja se candidatar.`
  );

  await updateConversation(conv.id, {
    state: 'SELECIONANDO_VAGA',
    context: {
      ...conv.context,
      niche_id: selectedNiche.id,
      niche_name: selectedNiche.name,
      jobs,
    },
  }, supabase);
}

async function handleSelecionandoVaga(
  conv: Conversation,
  instance: string,
  phone: string,
  text: string,
  selectedRowId: string | null,
  supabase: SupabaseClient,
  send: SendFn,
): Promise<void> {
  const jobs = conv.context.jobs || [];
  let selectedJob: { id: string; title: string } | undefined;

  // 1. List response (rowId = "1", "2", ...)
  if (selectedRowId) {
    const idx = parseInt(selectedRowId, 10) - 1;
    selectedJob = jobs[idx];
  }

  // 2. Plain number typed by user
  if (!selectedJob && text) {
    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 1 && num <= jobs.length) {
      selectedJob = jobs[num - 1];
    }
  }

  // 3. Fuzzy title match (e.g. "ajudante" matches "Ajudante de Carga")
  if (!selectedJob && text) {
    const lower = text.toLowerCase();
    selectedJob = jobs.find(j => j.title.toLowerCase().includes(lower));
    if (!selectedJob) {
      selectedJob = jobs.find(j =>
        j.title.toLowerCase().split(' ').some(word => lower.includes(word) && word.length > 3),
      );
    }
  }

  if (!selectedJob) {
    const listText = jobs.map((j, i) => `${i + 1}. ${j.title}`).join('\n');
    await send(phone, `Não entendi. Por favor, responda com o número da vaga:\n\n${listText}`);
    return;
  }

  // Reuse existing candidate for this phone + job (prevents duplicates on conversation restart)
  const { data: existing } = await supabase
    .from('candidates')
    .select('id, status')
    .eq('job_id', selectedJob.id)
    .eq('WhatsApp com DDD', phone)
    .maybeSingle();

  let candidate: { id: string } | null = existing;

  if (!existing) {
    const { data: inserted, error: candidateError } = await supabase
      .from('candidates')
      .insert({
        job_id: selectedJob.id,
        user_id: conv.user_id,
        'WhatsApp com DDD': phone,
        'Nome Completo': conv.context.candidate_name || 'Candidato via WhatsApp',
        status: 'PENDING',
      })
      .select('id')
      .single();

    if (candidateError || !inserted) {
      console.error('[Agent] insert candidate:', candidateError);
      await send(phone, 'Ocorreu um erro. Por favor, tente novamente em instantes.');
      return;
    }
    candidate = inserted;
  } else {
    // Reset existing candidate to PENDING so it can be reanalyzed
    await supabase
      .from('candidates')
      .update({ status: 'PENDING', analysis_result: null, match_score: 0, file_name: null, file_path: null })
      .eq('id', existing.id);
  }

  await send(phone, `✅ A vaga de *${selectedJob.title}* foi registrada!\n\nAgora, por favor, envie seu currículo em formato *PDF*.`);

  await updateConversation(conv.id, {
    state: 'AGUARDANDO_CURRICULO',
    job_id: selectedJob.id,
    context: { ...conv.context, job_title: selectedJob.title, candidate_id: candidate.id },
  }, supabase);
}

async function handleAguardandoCurriculo(
  conv: Conversation,
  instance: string,
  phone: string,
  messageType: string,
  mediaData: {
    key: Record<string, unknown>;
    message: Record<string, unknown>;
    embeddedBase64?: string;
    embeddedMimetype?: string;
  } | null,
  supabase: SupabaseClient,
  send: SendFn,
  instanceToken?: string,
): Promise<void> {
  const isPDF = ['documentMessage', 'documentWithCaptionMessage'].includes(messageType);

  if (!isPDF || !mediaData) {
    await send(phone, 'Por favor, envie seu currículo em formato *PDF* para prosseguir. 📄');
    return;
  }

  // Lock state immediately to prevent duplicate processing if message fires twice
  await updateConversation(conv.id, { state: 'ANALISANDO' }, supabase);

  // Use embedded base64 from webhook (webhook_base64:true) — avoids a separate download call
  let media: { base64: string; mimetype: string } | null = null;

  if (mediaData.embeddedBase64) {
    // Strip data URL prefix if present (e.g. "data:application/pdf;base64,...")
    const rawBase64 = mediaData.embeddedBase64.replace(/^data:[^;]+;base64,/, '');
    media = { base64: rawBase64, mimetype: mediaData.embeddedMimetype || 'application/pdf' };
    console.log('[Agent] Using embedded base64 from webhook payload, length:', rawBase64.length);
  } else {
    // Try to extract base64 from nested documentWithCaptionMessage if not already extracted
    const msg = mediaData.message;
    const dwc = msg?.documentWithCaptionMessage as Record<string, unknown> | undefined;
    if (dwc) {
      const innerMsg = dwc.message as Record<string, unknown> | undefined;
      const innerDoc = innerMsg?.documentMessage as Record<string, unknown> | undefined;
      const nestedBase64 = innerDoc?.base64 || dwc?.base64;
      if (nestedBase64) {
        const rawBase64 = String(nestedBase64).replace(/^data:[^;]+;base64,/, '');
        const mimetype = String(innerDoc?.mimetype || dwc?.mimetype || 'application/pdf');
        media = { base64: rawBase64, mimetype };
        console.log('[Agent] Extracted base64 from nested documentWithCaptionMessage, length:', rawBase64.length);
      }
    }

    // Fallback: download via Evolution API
    if (!media) {
      media = await evo.downloadMediaBase64(instance, { key: mediaData.key, message: mediaData.message }, instanceToken);
      console.log('[Agent] Downloaded base64 via API call, success:', !!media?.base64);
    }
  }

  if (!media?.base64) {
    await send(phone, 'Não consegui abrir o arquivo. Por favor, envie novamente em formato *PDF*.');
    await updateConversation(conv.id, { state: 'AGUARDANDO_CURRICULO' }, supabase);
    return;
  }

  // Confirma recebimento somente após download bem-sucedido (evita dupla resposta)
  await send(phone, '✅ Currículo recebido! Vamos analisar o seu perfil e entraremos em contato em breve com os próximos passos.');

  // Get job details
  const { data: job } = await supabase
    .from('jobs')
    .select('id, title, criteria, user_id')
    .eq('id', conv.job_id!)
    .single();

  if (!job) {
    await updateConversation(conv.id, { state: 'CURRICULO_RECEBIDO' }, supabase);
    return;
  }

  // Analyze with Gemini
  const analysis = await analyzeResume(media.base64, job.title, job.criteria || '');

  // Upload to Supabase Storage
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`;
  const filePath = `${job.id}/${fileName}`;
  const buffer = Buffer.from(media.base64, 'base64');

  await supabase.storage
    .from('curriculos')
    .upload(filePath, buffer, { contentType: 'application/pdf', upsert: false });

  // Determine status from score
  let status = 'REPROVADO';
  if (analysis.matchScore >= 7) status = 'APROVADO';
  else if (analysis.matchScore >= 4) status = 'EM_ANALISE';

  const aiName = analysis.candidateName && analysis.candidateName !== 'Não identificado' && isValidName(analysis.candidateName)
    ? analysis.candidateName
    : null;
  const rawName = aiName || conv.context.candidate_name || 'Candidato via WhatsApp';
  const finalName = isValidName(rawName) ? normalizeName(rawName) : rawName;

  // Update candidate record with analysis result
  if (conv.context.candidate_id) {
    const updatePayload = {
      file_name: fileName,
      file_path: filePath,
      status,
      match_score: analysis.matchScore,
      analysis_result: analysis,
      'Nome Completo': finalName,
    };

    console.log('[Agent] Updating candidate', conv.context.candidate_id, 'with:', JSON.stringify({
      file_name: fileName, status, match_score: analysis.matchScore, name: finalName,
    }));

    const { error: updateError } = await supabase
      .from('candidates')
      .update(updatePayload)
      .eq('id', conv.context.candidate_id);

    if (updateError) {
      console.error('[Agent] FAILED to update candidate:', updateError);
    } else {
      console.log('[Agent] Candidate updated successfully');
    }
  } else {
    console.warn('[Agent] No candidate_id in context — skipping update');
  }

  await updateConversation(conv.id, {
    state: 'CURRICULO_RECEBIDO',
    context: { ...conv.context, candidate_name: finalName },
  }, supabase);
}


async function handleConfirmacaoLembrete(
  conv: Conversation,
  instance: string,
  phone: string,
  text: string,
  supabase: SupabaseClient,
  send: SendFn,
): Promise<void> {
  const interviewId = conv.context.reminder_interview_id;

  const confirmKw = ['sim', 'confirmo', 'vou', 'estarei', 'ok', 'yes', 'pode ser', 'claro', 'com certeza'];
  const cancelKw = ['cancelar', 'cancela', 'não vou', 'nao vou', 'não irei', 'nao irei',
    'desistir', 'desisto', 'não quero', 'nao quero', 'não posso ir', 'nao posso ir', 'não vai dar', 'nao vai dar'];
  const rescheduleKw = ['reagendar', 'remarcar', 'mudar', 'trocar', 'outro horário', 'outro horario'];

  if (confirmKw.some(k => text.includes(k))) {
    await send(phone, '✅ Presença confirmada! Nos vemos em breve. Boa sorte! 🍀');
    await updateConversation(conv.id, { state: 'ENTREVISTA_CONFIRMADA' }, supabase);

  } else if (rescheduleKw.some(k => text.includes(k))) {
    await handleReschedule(conv, instance, phone, supabase, send);

  } else if (cancelKw.some(k => text.includes(k))) {
    if (interviewId) {
      const { data: interview } = await supabase.from('interviews')
        .select('id, slot_id, google_event_id')
        .eq('id', interviewId).single();

      if (interview) {
        if (interview.slot_id) {
          await supabase.from('interview_slots')
            .update({ is_booked: false }).eq('id', interview.slot_id);
        }
        await supabase.from('interviews')
          .update({ status: 'CANCELADA' }).eq('id', interview.id);
      }
    }
    await send(phone, 'Entendido. Sua entrevista foi cancelada. Desejamos sucesso! 🙏');
    await updateConversation(conv.id, { state: 'CANCELADA', context: { pos_cancelamento: true } }, supabase);
    await send(phone, 'Você pode se candidatar a outras oportunidades disponíveis ou aguardar um novo convite para entrevista. O que prefere?\n\n1️⃣ Ver outras vagas disponíveis\n2️⃣ Aguardar um novo convite');

  } else {
    await send(phone, 'Por favor, responda com:\n\n✅ *SIM* — confirmo presença\n🔄 *REAGENDAR* — preciso de outro horário\n❌ *CANCELAR* — não irei participar');
  }
}

async function handleReschedule(
  conv: Conversation,
  instance: string,
  phone: string,
  supabase: SupabaseClient,
  send: SendFn,
): Promise<void> {
  // Resolve candidate_id: from context or by phone lookup
  let candidateId = conv.context.candidate_id;

  if (!candidateId) {
    // Try to find candidate by phone number
    const cleanedPhone = phone.replace(/@.*$/, '');
    const { data: candidates } = await supabase
      .from('candidates')
      .select('id')
      .or(`"WhatsApp com DDD".eq.${cleanedPhone},"WhatsApp com DDD".eq.${cleanedPhone.replace(/^55/, '')}`)
      .limit(1);

    candidateId = candidates?.[0]?.id;
    console.log(`[Agent] Reschedule: candidate_id not in context, phone lookup: ${candidateId || 'NOT FOUND'}`);

    if (candidateId) {
      conv.context = { ...conv.context, candidate_id: candidateId };
      await updateConversation(conv.id, { context: conv.context }, supabase);
    }
  }

  if (!candidateId) {
    await send(phone, 'Não encontrei uma entrevista agendada para você. Se precisar de ajuda, fale com o recrutador.');
    return;
  }

  // Find the confirmed interview for this candidate
  const { data: interview } = await supabase
    .from('interviews')
    .select('id, job_id, slot_id, scheduling_token, google_event_id')
    .eq('candidate_id', candidateId)
    .in('status', ['CONFIRMADA', 'AGENDADA', 'REMARCADA'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!interview) {
    console.log(`[Agent] Reschedule: no interview found for candidate ${candidateId}`);
    await send(phone, 'Não encontrei uma entrevista agendada para você. Se precisar de ajuda, fale com o recrutador.');
    return;
  }

  // Check available slots for the job
  const { data: slots } = await supabase
    .from('interview_slots')
    .select('id')
    .eq('job_id', interview.job_id)
    .eq('is_booked', false);

  if (!slots || slots.length === 0) {
    const candidateName = conv.context.candidate_name || 'Um candidato';
    const jobTitle = conv.context.job_title || 'uma vaga';

    console.log(`[Agent] No slots available for reschedule. Candidate: ${candidateName}, Job: ${jobTitle}. Setting AGUARDANDO_NOVOS_HORARIOS.`);

    // Mark interview as waiting for new slots
    await supabase.from('interviews')
      .update({ status: 'AGUARDANDO_NOVOS_HORARIOS' })
      .eq('id', interview.id);

    // Update conversation state
    await updateConversation(conv.id, {
      state: 'AGUARDANDO_NOVOS_HORARIOS',
      context: {
        ...conv.context,
        interview_id: interview.id,
        job_id: interview.job_id,
      },
    }, supabase);

    await send(phone, `Entendi que você precisa reagendar, *${conv.context.candidate_name || 'candidato'}*.\n\nInfelizmente, não há outros horários disponíveis no momento. Já notificamos o recrutador para liberar novas datas.\n\nAssim que houver novos horários, enviaremos o link para você escolher. 😊`);
    return;
  }

  // Delete old Google Calendar event
  if (interview.google_event_id) {
    await deleteCalendarEvent(interview.google_event_id);
    console.log(`[Agent] Reschedule: deleted Google Calendar event ${interview.google_event_id}`);
  }

  // Free the old slot
  if (interview.slot_id) {
    await supabase
      .from('interview_slots')
      .update({ is_booked: false })
      .eq('id', interview.slot_id);
  }

  // Reset interview status
  await supabase
    .from('interviews')
    .update({
      slot_id: null,
      slot_date: null,
      slot_time: null,
      meeting_link: null,
      google_event_id: null,
      status: 'REMARCADA',
    })
    .eq('id', interview.id);

  // Ensure scheduling token exists
  let token = interview.scheduling_token;
  if (!token) {
    token = crypto.randomBytes(6).toString('base64url');
    await supabase
      .from('interviews')
      .update({ scheduling_token: token })
      .eq('id', interview.id);
  }

  // Update conversation state
  await updateConversation(conv.id, {
    state: 'AGUARDANDO_ESCOLHA_SLOT',
    context: {
      ...conv.context,
      interview_id: interview.id,
      scheduling_token: token,
    },
  }, supabase);

  const baseUrl = process.env.BASE_URL || 'https://app.elevva.net.br';
  const link = `${baseUrl}/agendar/${token}`;

  await send(phone, `Sem problemas, *${conv.context.candidate_name || 'candidato'}*! Vamos reagendar.\n\nEscolha um novo horário no link abaixo:\n\n${link}\n\n_Clique no link para selecionar seu novo horário._`);
}

async function handleAguardandoEscolhaSlot(
  conv: Conversation,
  instance: string,
  phone: string,
  _text: string,
  _selectedRowId: string | null,
  supabase: SupabaseClient,
  send: SendFn,
): Promise<void> {
  // With the new link-based scheduling, if candidate sends any WhatsApp message
  // while waiting, resend the link
  const token = conv.context.scheduling_token;
  if (token) {
    const baseUrl = process.env.BASE_URL || 'https://app.elevva.net.br';

    const link = `${baseUrl}/agendar/${token}`;
    await send(phone, `Para escolher seu horário de entrevista, acesse o link abaixo:\n\n${link}\n\n_Se precisar de ajuda, fale com o recrutador._`);
  } else {
    await send(phone, 'Sua entrevista está sendo agendada. Em breve você receberá o link para escolher o horário.');
  }
}

// ─────────────────────────── Main entry point ───────────────────────────

/**
 * Process an incoming WhatsApp message from the Evolution API webhook.
 */
export async function processIncomingMessage(
  instance: string,
  phone: string,
  pushName: string,
  messageType: string,
  textContent: string | null,
  mediaData: {
    key: Record<string, unknown>;
    message: Record<string, unknown>;
    embeddedBase64?: string;
    embeddedMimetype?: string;
  } | null,
  selectedRowId: string | null,
  supabase: SupabaseClient,
  webhookToken?: string,   // token enviado diretamente pelo Evolution GO no payload
): Promise<void> {
  console.log(`[Agent] START instance="${instance}" phone="${phone}" type="${messageType}"`);

  // Identify recruiter from Evolution instance name
  // portal_code is fetched separately to avoid query failure if the column doesn't exist yet
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, name, status_automacao, evolution_token, chatwoot_account_id, chatwoot_token, chatwoot_inbox_id')
    .eq('instancia_evolution', instance)
    .eq('status_automacao', true)
    .maybeSingle();

  if (profileError) {
    console.error(`[Agent] Profile query error: ${profileError.message}`);
  }

  if (!profile) {
    console.log(`[Agent] No active profile for instance "${instance}" (error: ${profileError?.message || 'none'})`);
    return;
  }

  console.log(`[Agent] Profile found id="${profile.id}" hasToken=${!!profile.evolution_token}`);

  // portal_code mantido apenas para compatibilidade com rotas de agendamento
  let portalCodeRaw: string = profile.id;
  try {
    const { data: pcRow } = await supabase
      .from('profiles')
      .select('portal_code')
      .eq('id', profile.id)
      .maybeSingle();
    if (pcRow?.portal_code) portalCodeRaw = pcRow.portal_code;
  } catch (_) {
    // coluna ainda não existe — usa UUID como fallback
  }

  // Prioridade: token do payload (Evolution GO) > token do DB > env var
  const instanceToken: string | undefined = webhookToken || profile.evolution_token || undefined;

  // Helper bound — envia via WhatsApp E espelha no Chatwoot como mensagem de saída
  const send = async (jid: string, text: string) => {
    await evo.sendText(instance, jid, text, instanceToken);
    if (chatwootConfig) {
      const cwConvId = conv.chatwoot_conversation_id;
      const mirroredId = await mirrorMessage(
        chatwootConfig.accountId,
        chatwootConfig.token,
        chatwootConfig.inboxId,
        evo.cleanPhone(jid),
        text,
        'outgoing',
        undefined,
        cwConvId,
      );
      if (mirroredId && mirroredId !== conv.chatwoot_conversation_id) {
        conv.chatwoot_conversation_id = mirroredId;
        await supabase
          .from('agent_conversations')
          .update({ chatwoot_conversation_id: mirroredId })
          .eq('id', conv.id);
      }
    }
  };

  const conv = await getOrCreateConversation(phone, profile.id, supabase);

  // ── Chatwoot: mirror candidate message (incoming) ──
  const chatwootConfig = profile.chatwoot_account_id && profile.chatwoot_token && profile.chatwoot_inbox_id
    ? {
        accountId: profile.chatwoot_account_id as number,
        token: profile.chatwoot_token as string,
        inboxId: profile.chatwoot_inbox_id as number,
      }
    : null;

  if (chatwootConfig && textContent) {
    const chatwootConvId = await mirrorMessage(
      chatwootConfig.accountId,
      chatwootConfig.token,
      chatwootConfig.inboxId,
      phone,
      textContent,
      'incoming',
      conv.context.candidate_name || pushName || undefined,
      conv.chatwoot_conversation_id,
    );
    // Store chatwoot_conversation_id in agent_conversations for future messages
    if (chatwootConvId && chatwootConvId !== conv.chatwoot_conversation_id) {
      await supabase
        .from('agent_conversations')
        .update({ chatwoot_conversation_id: chatwootConvId })
        .eq('id', conv.id);
      conv.chatwoot_conversation_id = chatwootConvId;
    }
  }

  // ── Human takeover: se humano assumiu no Chatwoot, Bento não responde ──
  if (conv.human_takeover) {
    console.log(`[Agent] Human takeover active for ${phone} — Bento skipping`);
    return;
  }

  // Store WhatsApp display name on first contact
  if (pushName && !conv.context.candidate_name) {
    conv.context = { ...conv.context, candidate_name: normalizeName(pushName) };
    await updateConversation(conv.id, { context: conv.context }, supabase);
  }

  const text = (textContent || '').trim().toLowerCase();

  // Detect reschedule intent for confirmed interviews
  const rescheduleKeywords = ['reagendar', 'remarcar', 'mudar horário', 'mudar horario', 'trocar horário', 'trocar horario', 'alterar data', 'mudar data', 'outro horário', 'outro horario', 'não posso', 'nao posso', 'cancelar entrevista', 'desmarcar'];
  const isRescheduleIntent = rescheduleKeywords.some(k => text.includes(k));

  if (isRescheduleIntent && (conv.state === 'ENTREVISTA_CONFIRMADA' || conv.state === 'AGUARDANDO_ESCOLHA_SLOT')) {
    await handleReschedule(conv, instance, phone, supabase, send);
    return;
  }

  const portalCode: string = portalCodeRaw;

  switch (conv.state) {

    // ── Primeiro contato: envia lista de nichos ──
    case 'NOVO':
    case 'LINK_ENVIADO':
      await handleNovo(conv, instance, phone, pushName, portalCode, supabase, send);
      break;

    // ── Candidato escolhendo nicho ──
    case 'SELECIONANDO_NICHO':
      await handleSelecionandoNicho(conv, phone, text, supabase, send);
      break;

    // ── Candidato escolhendo vaga dentro do nicho ──
    case 'SELECIONANDO_VAGA':
      await handleSelecionandoVaga(conv, instance, phone, text, selectedRowId, supabase, send);
      break;

    // ── Aguardando currículo via WhatsApp ──
    case 'AGUARDANDO_CURRICULO':
      await handleAguardandoCurriculo(conv, instance, phone, messageType, mediaData, supabase, send, instanceToken);
      break;

    // ── Currículo em análise ──
    case 'ANALISANDO':
      await send(phone, 'Seu currículo está sendo analisado... ⏳ Aguarde, em breve você receberá um retorno.');
      break;

    // ── Currículo recebido / em avaliação ──
    case 'CURRICULO_RECEBIDO':
    case 'EM_ANALISE':
      await send(phone, 'Seu currículo está em análise. 🔍 Em breve nossa equipe entrará em contato com os próximos passos. 😊');
      break;

    // ── Reprovado: reinicia fluxo com lista de nichos ──
    case 'REPROVADO':
      await send(phone,
        `Obrigado pelo interesse! No momento o seu perfil não foi selecionado para esta vaga.\n\n` +
        `Mas não desanime — temos outras oportunidades disponíveis! 💪`
      );
      await updateConversation(conv.id, { state: 'NOVO', context: { candidate_name: conv.context.candidate_name } }, supabase);
      await handleNovo(conv, instance, phone, '', portalCode, supabase, send);
      break;

    // ── Cancelado: trata resposta pós-cancelamento ou reinicia ──
    case 'CANCELADA': {
      if (conv.context?.pos_cancelamento) {
        const lower = text.toLowerCase().trim();
        const wantsJobs =
          lower === '1' ||
          lower.includes('vaga') ||
          lower.includes('oportunidade') ||
          lower.includes('candidatar') ||
          lower.includes('outra');
        const wantsWait =
          lower === '2' ||
          lower.includes('aguardar') ||
          lower.includes('esperar') ||
          lower.includes('convite');

        if (wantsJobs) {
          // Limpa flag e inicia fluxo normal (busca vagas)
          await updateConversation(conv.id, {
            state: 'NOVO',
            context: { candidate_name: conv.context.candidate_name },
          }, supabase);
          await handleNovo(conv, instance, phone, pushName, portalCode, supabase, send);
        } else if (wantsWait) {
          await send(phone, 'Entendido! Quando houver um novo convite de entrevista, entraremos em contato. Boa sorte! 🍀');
          await updateConversation(conv.id, {
            state: 'NOVO',
            context: { candidate_name: conv.context.candidate_name },
          }, supabase);
        } else {
          // Não entendeu — repete as opções
          await send(phone,
            'Não entendi. Por favor, escolha uma das opções:\n\n' +
            '1️⃣ Ver outras vagas disponíveis\n' +
            '2️⃣ Aguardar um novo convite'
          );
        }
      } else {
        await handleNovo(conv, instance, phone, pushName, portalCode, supabase, send);
      }
      break;
    }

    // ── Fluxo de entrevista: mantido intacto ──
    case 'ENTREVISTA_CONFIRMADA':
      await send(phone, 'Sua entrevista já está confirmada! Se precisar reagendar, basta digitar *reagendar*. 😊');
      break;

    case 'AGUARDANDO_CONFIRMACAO_LEMBRETE':
      await handleConfirmacaoLembrete(conv, instance, phone, text, supabase, send);
      break;

    case 'AGUARDANDO_NOVOS_HORARIOS':
      await send(phone, 'Ainda estamos aguardando o recrutador liberar novos horários. Assim que houver disponibilidade, enviaremos o link para você escolher. 😊');
      break;

    case 'AGUARDANDO_ESCOLHA_SLOT':
      await handleAguardandoEscolhaSlot(conv, instance, phone, text, selectedRowId, supabase, send);
      break;

    default:
      await handleNovo(conv, instance, phone, pushName, portalCode, supabase, send);
  }
}

// ─────────────────────────── Scheduling trigger ───────────────────────────

/**
 * Called by the recruiter dashboard when they want to schedule interviews.
 * Sends WhatsApp messages to each candidate with available slot options.
 */
export async function triggerSchedulingForCandidates(
  userId: string,
  jobId: string,
  interviewIds: string[],
  supabase: SupabaseClient,
): Promise<{ sent: number; errors: number }> {
  // Get recruiter's Evolution instance
  const { data: profile } = await supabase
    .from('profiles')
    .select('instancia_evolution, evolution_instance, evolution_token')
    .eq('id', userId)
    .single();

  const instanceName = profile?.evolution_instance || profile?.instancia_evolution;
  if (!instanceName) {
    throw new Error('Instância Evolution não configurada. Configure em Configurações da conta.');
  }

  const instance = instanceName;
  const instanceToken: string | undefined = profile.evolution_token || undefined;

  // Get job title
  const { data: job } = await supabase
    .from('jobs')
    .select('title')
    .eq('id', jobId)
    .single();

  // Sync interview_slots with availability_slots (removes expired, adds new)
  await syncInterviewSlots(jobId, userId, supabase);

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().slice(0, 5);

  // Get available slots for this job (already synced, filter expired by date+time)
  const { data: slots } = await supabase
    .from('interview_slots')
    .select('id, slot_date, slot_time, format, location, interviewer_name')
    .eq('job_id', jobId)
    .eq('is_booked', false)
    .or(`slot_date.gt.${today},and(slot_date.eq.${today},slot_time.gt.${currentTime})`)
    .order('slot_date', { ascending: true })
    .order('slot_time', { ascending: true });

  if (!slots || slots.length === 0) {
    throw new Error('Nenhum horário disponível. Cadastre horários em "Horários Disponíveis" antes de disparar o agente.');
  }

  // Determine base URL for scheduling links
  const baseUrl = process.env.BASE_URL || 'https://app.elevva.net.br';

  // Get first slot info for the WhatsApp message
  const firstSlot = slots[0];
  const interviewerName = firstSlot.interviewer_name;

  let sent = 0;
  let errors = 0;

  for (const interviewId of interviewIds) {
    try {
      const { data: interview } = await supabase
        .from('interviews')
        .select('id, candidate_id, scheduling_token')
        .eq('id', interviewId)
        .single();

      if (!interview) { errors++; continue; }

      const { data: candidate } = await supabase
        .from('candidates')
        .select('"WhatsApp com DDD", "Nome Completo"')
        .eq('id', interview.candidate_id)
        .single();

      const rawPhone = candidate?.['WhatsApp com DDD' as keyof typeof candidate] as string | undefined;
      if (!rawPhone) { errors++; continue; }

      // Remove toda formatação: mantém apenas dígitos, remove + e @suffix
      const digitsOnly = rawPhone.replace(/@.*$/, '').replace(/\D/g, '');

      // Prefere o número verificado do agent_conversations (JID real do WhatsApp)
      // em vez do número digitado no formulário (pode ter formatação incorreta)
      let phone = digitsOnly;
      const { data: existingConv } = await supabase
        .from('agent_conversations')
        .select('phone')
        .eq('user_id', userId)
        .ilike('phone', `%${digitsOnly.slice(-8)}%`)   // últimos 8 dígitos como chave de busca
        .maybeSingle();

      if (existingConv?.phone) {
        // Usa o número já verificado pelo WhatsApp (cleanPhone do JID real)
        phone = existingConv.phone.replace(/^\+/, '');
        console.log(`[Agent] triggerScheduling: usando phone verificado ${phone} (era ${digitsOnly})`);
      }

      const candidateName = candidate?.['Nome Completo' as keyof typeof candidate] as string | undefined;
      const firstName = candidateName?.split(' ')[0] || 'Candidato';

      // Generate scheduling token if not exists
      let token = interview.scheduling_token;
      if (!token) {
        token = crypto.randomBytes(6).toString('base64url');
        await supabase
          .from('interviews')
          .update({ scheduling_token: token })
          .eq('id', interview.id);
      }

      const schedulingLink = `${baseUrl}/agendar/${token}`;

      // Upsert conversation state → AGUARDANDO_ESCOLHA_SLOT
      await supabase
        .from('agent_conversations')
        .upsert(
          {
            phone,
            user_id: userId,
            job_id: jobId,
            state: 'AGUARDANDO_ESCOLHA_SLOT',
            context: {
              job_title: job?.title || 'a vaga',
              candidate_name: candidateName,
              interview_id: interview.id,
              scheduling_token: token,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'phone,user_id' },
        );

      // Send WhatsApp message with scheduling link
      const interviewerLine = interviewerName ? `\n👤 *Entrevistador(a):* ${interviewerName}` : '';
      const locationLine = firstSlot.format === 'PRESENCIAL' && firstSlot.location
        ? `\n📍 *Local:* ${firstSlot.location}`
        : '';
      const formatNote = firstSlot.format === 'ONLINE'
        ? '\n💻 *Formato:* Online'
        : '\n🏢 *Formato:* Presencial';

      const delivered = await evo.sendText(instance, phone, `🎉 Parabéns, *${firstName}*! Você foi aprovado(a) para a próxima fase da vaga de *${job?.title || 'a vaga'}*!${interviewerLine}${formatNote}${locationLine}\n\n📅 Escolha o melhor horário para sua entrevista:\n${schedulingLink}\n\n_Clique no link acima para selecionar seu horário._`, instanceToken);

      if (delivered) {
        sent++;
      } else {
        console.warn(`[Agent] triggerScheduling: mensagem não entregue para ${phone} (número possivelmente sem WhatsApp)`);
        errors++;
      }
    } catch (err) {
      console.error(`[Agent] triggerScheduling error for interview ${interviewId}:`, err);
      errors++;
    }
  }

  return { sent, errors };
}

/**
 * Re-send scheduling links to candidates whose interviews are AGUARDANDO_NOVOS_HORARIOS.
 * Called after recruiter adds new slots for a job.
 */
export async function notifyPendingReschedules(
  userId: string,
  jobId: string,
  supabase: SupabaseClient,
): Promise<{ sent: number; errors: number }> {
  // Find interviews waiting for new slots
  const { data: pendingInterviews } = await supabase
    .from('interviews')
    .select('id, candidate_id, scheduling_token, job_id')
    .eq('job_id', jobId)
    .eq('status', 'AGUARDANDO_NOVOS_HORARIOS');

  if (!pendingInterviews || pendingInterviews.length === 0) {
    return { sent: 0, errors: 0 };
  }

  // Check there are now available slots
  const { data: slots } = await supabase
    .from('interview_slots')
    .select('id')
    .eq('job_id', jobId)
    .eq('is_booked', false)
    .limit(1);

  if (!slots || slots.length === 0) {
    return { sent: 0, errors: 0 };
  }

  // Get recruiter's Evolution instance
  const { data: profile } = await supabase
    .from('profiles')
    .select('instancia_evolution, evolution_token')
    .eq('id', userId)
    .single();

  if (!profile?.instancia_evolution) {
    throw new Error('Instância Evolution não configurada.');
  }

  const instance = profile.instancia_evolution;
  const instanceToken: string | undefined = profile.evolution_token || undefined;
  const baseUrl = process.env.BASE_URL || 'https://app.elevva.net.br';

  // Get job title
  const { data: job } = await supabase
    .from('jobs')
    .select('title')
    .eq('id', jobId)
    .single();

  let sent = 0;
  let errors = 0;

  for (const iv of pendingInterviews) {
    try {
      const { data: candidate } = await supabase
        .from('candidates')
        .select('"WhatsApp com DDD", "Nome Completo"')
        .eq('id', iv.candidate_id)
        .single();

      const phone = candidate?.['WhatsApp com DDD' as keyof typeof candidate] as string | undefined;
      if (!phone) { errors++; continue; }

      const candidateName = candidate?.['Nome Completo' as keyof typeof candidate] as string | undefined;
      const firstName = candidateName?.split(' ')[0] || 'Candidato';

      // Ensure scheduling token
      let token = iv.scheduling_token;
      if (!token) {
        token = crypto.randomBytes(6).toString('base64url');
        await supabase.from('interviews')
          .update({ scheduling_token: token })
          .eq('id', iv.id);
      }

      const link = `${baseUrl}/agendar/${token}`;

      // Update interview status back to REMARCADA
      await supabase.from('interviews')
        .update({ status: 'REMARCADA' })
        .eq('id', iv.id);

      // Update conversation state
      await supabase.from('agent_conversations')
        .update({
          state: 'AGUARDANDO_ESCOLHA_SLOT',
          context: {
            job_title: job?.title || 'a vaga',
            candidate_name: candidateName,
            interview_id: iv.id,
            scheduling_token: token,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('phone', phone)
        .eq('user_id', userId);

      // Send WhatsApp message
      await evo.sendText(instance, phone, `Ótima notícia, *${firstName}*! 🎉\n\nNovos horários foram liberados para sua entrevista na vaga de *${job?.title || 'a vaga'}*.\n\n📅 Escolha o melhor horário:\n${link}\n\n_Clique no link para selecionar seu horário._`, instanceToken);

      sent++;
    } catch (err) {
      console.error(`[Agent] notifyPendingReschedules error for interview ${iv.id}:`, err);
      errors++;
    }
  }

  console.log(`[Agent] notifyPendingReschedules: ${sent} sent, ${errors} errors for job ${jobId}`);
  return { sent, errors };
}
