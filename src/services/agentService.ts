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
import { deleteCalendarEvent } from './googleCalendarService.js';
import crypto from 'crypto';

// ─────────────────────────── Types ───────────────────────────

interface ConversationContext {
  candidate_name?: string;
  candidate_id?: string;
  job_title?: string;
  jobs?: Array<{ id: string; title: string }>;
  interview_id?: string;
  scheduling_token?: string;
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

  const greeting = pushName ? `Olá, *${pushName}*! 👋` : 'Olá! 👋';
  const jobList = jobs.map((j, i) => `*${i + 1}.* ${j.title}`).join('\n');

  await evo.sendText(
    instance, phone,
    `${greeting} Sou o Bento, assistente de recrutamento.\n\nNossas vagas abertas:\n\n${jobList}\n\nResponda com o *número* da vaga que deseja se candidatar.`,
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
      await evo.sendText(instance, phone, 'Ocorreu um erro. Por favor, tente novamente em instantes.');
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
  mediaData: {
    key: Record<string, unknown>;
    message: Record<string, unknown>;
    embeddedBase64?: string;
    embeddedMimetype?: string;
  } | null,
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

  // Use embedded base64 from webhook (webhook_base64:true) — avoids a separate download call
  let media: { base64: string; mimetype: string } | null = null;

  if (mediaData.embeddedBase64) {
    // Strip data URL prefix if present (e.g. "data:application/pdf;base64,...")
    const rawBase64 = mediaData.embeddedBase64.replace(/^data:[^;]+;base64,/, '');
    media = { base64: rawBase64, mimetype: mediaData.embeddedMimetype || 'application/pdf' };
    console.log('[Agent] Using embedded base64 from webhook payload, length:', rawBase64.length);
  } else {
    media = await evo.downloadMediaBase64(instance, { key: mediaData.key, message: mediaData.message });
    console.log('[Agent] Downloaded base64 via API call');
  }

  if (!media?.base64) {
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


async function handleReschedule(
  conv: Conversation,
  instance: string,
  phone: string,
  supabase: SupabaseClient,
): Promise<void> {
  // Find the confirmed interview for this candidate
  const { data: interview } = await supabase
    .from('interviews')
    .select('id, job_id, slot_id, scheduling_token, google_event_id')
    .eq('candidate_id', conv.context.candidate_id)
    .in('status', ['CONFIRMADA', 'AGENDADA', 'REMARCADA'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!interview) {
    await evo.sendText(instance, phone, 'Não encontrei uma entrevista agendada para você. Se precisar de ajuda, fale com o recrutador.');
    return;
  }

  // Check available slots for the job
  const { data: slots } = await supabase
    .from('interview_slots')
    .select('id')
    .eq('job_id', interview.job_id)
    .eq('is_booked', false);

  if (!slots || slots.length === 0) {
    // Notify recruiter
    const { data: recruiterProfile } = await supabase
      .from('profiles')
      .select('instancia_evolution, id')
      .eq('id', conv.user_id)
      .single();

    const candidateName = conv.context.candidate_name || 'Um candidato';
    const jobTitle = conv.context.job_title || 'uma vaga';

    console.log(`[Agent] No slots available for reschedule. Candidate: ${candidateName}, Job: ${jobTitle}. Recruiter: ${recruiterProfile?.id}`);

    await evo.sendText(
      instance, phone,
      `Entendi que você precisa reagendar, *${conv.context.candidate_name || 'candidato'}*.\n\nInfelizmente, não há outros horários disponíveis no momento. Já notificamos o recrutador para liberar novas datas.\n\nAssim que houver novos horários, enviaremos o link para você escolher. 😊`,
    );
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
      status: 'AGUARDANDO_RESPOSTA',
    })
    .eq('id', interview.id);

  // Ensure scheduling token exists
  let token = interview.scheduling_token;
  if (!token) {
    token = crypto.randomBytes(16).toString('hex');
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

  await evo.sendText(
    instance, phone,
    `Sem problemas, *${conv.context.candidate_name || 'candidato'}*! Vamos reagendar.\n\nEscolha um novo horário no link abaixo:\n\n${link}\n\n_Clique no link para selecionar seu novo horário._`,
    false,
  );
}

async function handleAguardandoEscolhaSlot(
  conv: Conversation,
  instance: string,
  phone: string,
  _text: string,
  _selectedRowId: string | null,
  supabase: SupabaseClient,
): Promise<void> {
  // With the new link-based scheduling, if candidate sends any WhatsApp message
  // while waiting, resend the link
  const token = conv.context.scheduling_token;
  if (token) {
    const baseUrl = process.env.BASE_URL || 'https://app.elevva.net.br';

    const link = `${baseUrl}/agendar/${token}`;
    await evo.sendText(
      instance, phone,
      `Para escolher seu horário de entrevista, acesse o link abaixo:\n\n${link}\n\n_Se precisar de ajuda, fale com o recrutador._`,
    );
  } else {
    await evo.sendText(
      instance, phone,
      'Sua entrevista está sendo agendada. Em breve você receberá o link para escolher o horário.',
    );
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
): Promise<void> {
  // Identify recruiter from Evolution instance name
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, status_automacao')
    .eq('instancia_evolution', instance)
    .eq('status_automacao', true)
    .maybeSingle();

  if (!profile) {
    console.log(`[Agent] No active profile for instance "${instance}" — check instancia_evolution and status_automacao in profiles`);
    return;
  }

  const conv = await getOrCreateConversation(phone, profile.id, supabase);

  // Store WhatsApp display name on first contact
  if (pushName && !conv.context.candidate_name) {
    conv.context = { ...conv.context, candidate_name: pushName };
    await updateConversation(conv.id, { context: conv.context }, supabase);
  }

  const text = (textContent || '').trim().toLowerCase();

  // Detect reschedule intent for confirmed interviews
  const rescheduleKeywords = ['reagendar', 'remarcar', 'mudar horário', 'mudar horario', 'trocar horário', 'trocar horario', 'alterar data', 'mudar data', 'outro horário', 'outro horario', 'não posso', 'nao posso', 'cancelar entrevista', 'desmarcar'];
  const isRescheduleIntent = rescheduleKeywords.some(k => text.includes(k));

  if (isRescheduleIntent && (conv.state === 'ENTREVISTA_CONFIRMADA' || conv.state === 'AGUARDANDO_ESCOLHA_SLOT')) {
    await handleReschedule(conv, instance, phone, supabase);
    return;
  }

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
      // If a PDF arrives while stuck in ANALISANDO, the previous attempt failed — retry
      if (['documentMessage', 'documentWithCaptionMessage'].includes(messageType) && mediaData) {
        await handleAguardandoCurriculo(conv, instance, phone, messageType, mediaData, supabase);
      } else {
        await evo.sendText(instance, phone, 'Aguarde! Estamos analisando seu currículo... ⏳');
      }
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

      const phone = candidate?.['WhatsApp com DDD' as keyof typeof candidate] as string | undefined;
      if (!phone) { errors++; continue; }

      const candidateName = candidate?.['Nome Completo' as keyof typeof candidate] as string | undefined;
      const firstName = candidateName?.split(' ')[0] || 'Candidato';

      // Generate scheduling token if not exists
      let token = interview.scheduling_token;
      if (!token) {
        token = crypto.randomBytes(16).toString('hex');
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

      await evo.sendText(
        instance, phone,
        `🎉 Parabéns, *${firstName}*! Você foi aprovado(a) para a próxima fase da vaga de *${job?.title || 'a vaga'}*!${interviewerLine}${formatNote}${locationLine}\n\n📅 Escolha o melhor horário para sua entrevista:\n${schedulingLink}\n\n_Clique no link acima para selecionar seu horário._`,
      );

      sent++;
    } catch (err) {
      console.error(`[Agent] triggerScheduling error for interview ${interviewId}:`, err);
      errors++;
    }
  }

  return { sent, errors };
}
