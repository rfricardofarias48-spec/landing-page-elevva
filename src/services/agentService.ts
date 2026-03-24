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
import { analyzeResume } from './geminiService.js';
import * as evo from './evolutionService.js';

// ─────────────────────────── Types ───────────────────────────

interface SlotOption {
  slot_id: string;
  label: string;
  date: string;
  time: string;
  format: string;
  location?: string;
  interviewer?: string;
}

interface ConversationContext {
  candidate_name?: string;
  candidate_id?: string;
  job_title?: string;
  jobs?: Array<{ id: string; title: string }>;
  slots?: SlotOption[];
  interview_id?: string;
}

interface Conversation {
  id: string;
  phone: string;
  user_id: string;
  job_id: string | null;
  state: string;
  context: ConversationContext;
}

// ─────────────────────────── Helpers ───────────────────────────

function formatDatePTBR(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
  });
}

function buildSlotLabel(s: { slot_date: string; slot_time: string; format: string }): string {
  return `${formatDatePTBR(s.slot_date)} às ${s.slot_time} (${s.format === 'ONLINE' ? 'Online' : 'Presencial'})`;
}

function buildGoogleCalendarLink(slot: SlotOption, jobTitle: string): string {
  const [year, month, day] = slot.date.split('-').map(Number);
  const [hour, minute] = slot.time.split(':').map(Number);
  const start = new Date(year, month - 1, day, hour, minute);
  const end   = new Date(year, month - 1, day, hour + 1, minute);
  const fmt   = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0];

  const params = new URLSearchParams({
    action:   'TEMPLATE',
    text:     `Entrevista - ${jobTitle}`,
    dates:    `${fmt(start)}/${fmt(end)}`,
    details:  slot.interviewer ? `Entrevistador(a): ${slot.interviewer}` : `Entrevista para ${jobTitle}`,
    location: slot.location || (slot.format === 'ONLINE' ? 'Online (link será enviado)' : ''),
  });

  return `https://calendar.google.com/calendar/event?${params.toString()}`;
}

// ─────────────────────────── DB helpers ───────────────────────────

async function getOrCreateConversation(
  phone: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<Conversation> {
  const { data: existing } = await supabase
    .from('agent_conversations')
    .select('*')
    .eq('phone', phone)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) return existing as Conversation;

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

async function handleNovo(
  conv: Conversation,
  instance: string,
  phone: string,
  pushName: string,
  supabase: SupabaseClient,
): Promise<void> {
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title')
    .eq('user_id', conv.user_id)
    .eq('is_paused', false)
    .order('created_at', { ascending: false });

  if (!jobs || jobs.length === 0) {
    await evo.sendText(instance, phone, 'Olá! No momento não há vagas abertas. Fique atento às nossas oportunidades!');
    return;
  }

  const rows = jobs.map((j, i) => ({
    title: j.title,
    description: 'Toque para se candidatar',
    rowId: String(i + 1),
  }));

  const greeting = pushName ? `Olá, *${pushName}*! ` : 'Olá! ';

  await evo.sendList(
    instance, phone,
    'Vagas Disponíveis',
    `${greeting}Sou o Bento, assistente de recrutamento da Elevva. Nossas vagas abertas:`,
    'Ver vagas',
    [{ title: 'Vagas abertas', rows }],
  );

  await updateConversation(conv.id, {
    state: 'SELECIONANDO_VAGA',
    context: { ...conv.context, jobs: jobs.map((j, i) => ({ id: j.id, title: j.title, index: i + 1 })) },
  }, supabase);
}

async function handleSelecionandoVaga(
  conv: Conversation,
  instance: string,
  phone: string,
  text: string,
  selectedRowId: string | null,
  supabase: SupabaseClient,
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
    await evo.sendText(instance, phone, `Não entendi. Por favor, responda com o número da vaga:\n\n${listText}`);
    return;
  }

  // Create candidate record
  const { data: candidate, error: candidateError } = await supabase
    .from('candidates')
    .insert({
      job_id: selectedJob.id,
      user_id: conv.user_id,
      'WhatsApp com DDD': phone,
      'Nome Completo': conv.context.candidate_name || 'Candidato via WhatsApp',
      status: 'PENDING',
    })
    .select()
    .single();

  if (candidateError || !candidate) {
    console.error('[Agent] insert candidate:', candidateError);
    await evo.sendText(instance, phone, 'Ocorreu um erro. Por favor, tente novamente em instantes.');
    return;
  }

  await evo.sendText(
    instance, phone,
    `✅ A vaga de *${selectedJob.title}* foi registrada!\n\nAgora, por favor, envie seu currículo em formato *PDF*.`,
  );

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
  mediaData: { key: Record<string, unknown>; message: Record<string, unknown> } | null,
  supabase: SupabaseClient,
): Promise<void> {
  const isPDF = ['documentMessage', 'documentWithCaptionMessage'].includes(messageType);

  if (!isPDF || !mediaData) {
    await evo.sendText(instance, phone, 'Por favor, envie seu currículo em formato *PDF* para prosseguir. 📄');
    return;
  }

  // Lock state immediately to prevent duplicate processing if message fires twice
  await updateConversation(conv.id, { state: 'ANALISANDO' }, supabase);

  await evo.sendText(
    instance, phone,
    '✅ Currículo recebido! Vamos analisar o seu perfil e entraremos em contato em breve com os próximos passos.',
  );

  // Download PDF
  const media = await evo.downloadMediaBase64(instance, mediaData);

  if (!media || media.mimetype !== 'application/pdf') {
    await evo.sendText(instance, phone, 'Não consegui abrir o arquivo. Por favor, envie novamente em formato *PDF*.');
    await updateConversation(conv.id, { state: 'AGUARDANDO_CURRICULO' }, supabase);
    return;
  }

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

  const finalName =
    analysis.candidateName && analysis.candidateName !== 'Não identificado'
      ? analysis.candidateName
      : conv.context.candidate_name || 'Candidato via WhatsApp';

  // Update candidate record with analysis result
  if (conv.context.candidate_id) {
    await supabase
      .from('candidates')
      .update({
        file_name: fileName,
        file_path: filePath,
        status,
        match_score: analysis.matchScore,
        analysis_result: analysis,
        'Nome Completo': finalName,
      })
      .eq('id', conv.context.candidate_id);
  }

  await updateConversation(conv.id, {
    state: 'CURRICULO_RECEBIDO',
    context: { ...conv.context, candidate_name: finalName },
  }, supabase);
}

async function sendSlotOptions(
  instance: string,
  phone: string,
  slots: SlotOption[],
  jobTitle: string,
): Promise<void> {
  const rows = slots.map(s => ({
    title: s.label,
    description: s.format === 'PRESENCIAL' && s.location ? `Presencial: ${s.location}` : 'Online',
    rowId: s.slot_id,
  }));

  await evo.sendList(
    instance, phone,
    'Horários Disponíveis',
    `Parabéns! Você foi selecionado(a) para a vaga de *${jobTitle}*!\n\nEscolha um horário para sua entrevista:`,
    'Escolher horário',
    [{ title: 'Horários disponíveis', rows }],
  );
}

async function handleAguardandoEscolhaSlot(
  conv: Conversation,
  instance: string,
  phone: string,
  text: string,
  selectedRowId: string | null,
  supabase: SupabaseClient,
): Promise<void> {
  const slots = conv.context.slots || [];

  if (slots.length === 0) {
    await evo.sendText(instance, phone, 'Ocorreu um erro ao buscar os horários. Por favor, aguarde contato do recrutador.');
    return;
  }

  let selectedSlot: SlotOption | undefined;

  // 1. List response (rowId = slot_id UUID)
  if (selectedRowId) {
    selectedSlot = slots.find(s => s.slot_id === selectedRowId);
  }

  // 2. Plain number
  if (!selectedSlot && text) {
    const num = parseInt(text.trim(), 10);
    if (!isNaN(num) && num >= 1 && num <= slots.length) {
      selectedSlot = slots[num - 1];
    }
  }

  if (!selectedSlot) {
    await evo.sendText(instance, phone, 'Não entendi. Por favor, escolha um dos horários abaixo:');
    await sendSlotOptions(instance, phone, slots, conv.context.job_title || 'a vaga');
    return;
  }

  // Try to book the slot (mark as booked)
  const { error: slotError } = await supabase
    .from('interview_slots')
    .update({ is_booked: true })
    .eq('id', selectedSlot.slot_id)
    .eq('is_booked', false); // optimistic concurrency — only succeeds if still free

  if (slotError) {
    const remaining = slots.filter(s => s.slot_id !== selectedSlot!.slot_id);
    if (remaining.length === 0) {
      await evo.sendText(instance, phone, 'Infelizmente todos os horários foram preenchidos. Em breve o recrutador enviará novas opções.');
      await updateConversation(conv.id, { state: 'CURRICULO_RECEBIDO' }, supabase);
      return;
    }
    await evo.sendText(instance, phone, 'Este horário já foi preenchido. Por favor, escolha outro:');
    await sendSlotOptions(instance, phone, remaining, conv.context.job_title || 'a vaga');
    await updateConversation(conv.id, {
      context: { ...conv.context, slots: remaining },
    }, supabase);
    return;
  }

  // Update interview record
  if (conv.context.interview_id) {
    await supabase
      .from('interviews')
      .update({
        slot_id: selectedSlot.slot_id,
        scheduled_date: selectedSlot.date,
        scheduled_time: selectedSlot.time,
        status: 'AGENDADA',
      })
      .eq('id', conv.context.interview_id);
  }

  // Build confirmation message with Google Calendar link
  const calLink = buildGoogleCalendarLink(selectedSlot, conv.context.job_title || 'Entrevista');
  const locationLine  = selectedSlot.format === 'PRESENCIAL' && selectedSlot.location
    ? `\n📍 Local: ${selectedSlot.location}`
    : '';
  const interviewerLine = selectedSlot.interviewer
    ? `\n👤 Entrevistador(a): ${selectedSlot.interviewer}`
    : '';

  await evo.sendText(
    instance, phone,
    `✅ *Entrevista confirmada!*\n\n📅 ${selectedSlot.label}${locationLine}${interviewerLine}\n\n🗓️ Adicione à sua agenda:\n${calLink}\n\nAguardamos você! Qualquer dúvida, basta responder aqui.`,
  );

  await updateConversation(conv.id, { state: 'ENTREVISTA_CONFIRMADA' }, supabase);
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
  mediaData: { key: Record<string, unknown>; message: Record<string, unknown> } | null,
  selectedRowId: string | null,
  supabase: SupabaseClient,
): Promise<void> {
  // Identify recruiter from Evolution instance name
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, status_automacao')
    .eq('instancia_evolution', instance)
    .eq('status_automacao', true)
    .maybeSingle();

  if (!profile) {
    console.log(`[Agent] No active profile for instance "${instance}"`);
    return;
  }

  const conv = await getOrCreateConversation(phone, profile.id, supabase);

  // Store WhatsApp display name on first contact
  if (pushName && !conv.context.candidate_name) {
    conv.context = { ...conv.context, candidate_name: pushName };
    await updateConversation(conv.id, { context: conv.context }, supabase);
  }

  const text = (textContent || '').trim().toLowerCase();

  switch (conv.state) {
    // Terminal / restart states — treat as new candidate
    case 'NOVO':
    case 'REPROVADO':
    case 'EM_ANALISE':
    case 'ENTREVISTA_CONFIRMADA':
      await handleNovo(conv, instance, phone, pushName, supabase);
      break;

    case 'SELECIONANDO_VAGA':
      await handleSelecionandoVaga(conv, instance, phone, text, selectedRowId, supabase);
      break;

    case 'AGUARDANDO_CURRICULO':
      await handleAguardandoCurriculo(conv, instance, phone, messageType, mediaData, supabase);
      break;

    case 'ANALISANDO':
      await evo.sendText(instance, phone, 'Aguarde! Estamos analisando seu currículo... ⏳');
      break;

    case 'CURRICULO_RECEBIDO':
      await evo.sendText(instance, phone, 'Seu currículo já foi recebido! Em breve nossa equipe entrará em contato com os próximos passos. 😊');
      break;

    case 'AGUARDANDO_ESCOLHA_SLOT':
      await handleAguardandoEscolhaSlot(conv, instance, phone, text, selectedRowId, supabase);
      break;

    default:
      await handleNovo(conv, instance, phone, pushName, supabase);
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
    .select('instancia_evolution')
    .eq('id', userId)
    .single();

  if (!profile?.instancia_evolution) {
    throw new Error('Instância Evolution não configurada. Configure em Configurações da conta.');
  }

  const instance = profile.instancia_evolution;

  // Get job title
  const { data: job } = await supabase
    .from('jobs')
    .select('title')
    .eq('id', jobId)
    .single();

  // Get available slots for this job
  const { data: slots } = await supabase
    .from('interview_slots')
    .select('id, slot_date, slot_time, format, location, interviewer_name')
    .eq('job_id', jobId)
    .eq('is_booked', false)
    .order('slot_date', { ascending: true })
    .order('slot_time', { ascending: true });

  if (!slots || slots.length === 0) {
    throw new Error('Nenhum horário disponível para esta vaga. Adicione horários antes de disparar o agente.');
  }

  const slotOptions: SlotOption[] = slots.map(s => ({
    slot_id: s.id,
    label: buildSlotLabel(s),
    date: s.slot_date,
    time: s.slot_time,
    format: s.format,
    location: s.location,
    interviewer: s.interviewer_name,
  }));

  // Get interviews with candidate phone numbers
  let sent = 0;
  let errors = 0;

  for (const interviewId of interviewIds) {
    try {
      const { data: interview } = await supabase
        .from('interviews')
        .select('id, candidate_id')
        .eq('id', interviewId)
        .single();

      if (!interview) { errors++; continue; }

      const { data: candidate } = await supabase
        .from('candidates')
        .select('"WhatsApp com DDD", "Nome Completo"')
        .eq('id', interview.candidate_id)
        .single();

      const phone = candidate?.['WhatsApp com DDD' as keyof typeof candidate] as string | undefined;

      if (!phone) { errors++; continue; }

      const candidateName = candidate?.['Nome Completo' as keyof typeof candidate] as string | undefined;

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
              slots: slotOptions,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'phone,user_id' },
        );

      // Send slot options via WhatsApp
      await sendSlotOptions(instance, phone, slotOptions, job?.title || 'a vaga');
      sent++;
    } catch (err) {
      console.error(`[Agent] triggerScheduling error for interview ${interviewId}:`, err);
      errors++;
    }
  }

  return { sent, errors };
}
