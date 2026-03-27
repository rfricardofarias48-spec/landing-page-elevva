import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { analyzeResume } from "./src/services/openaiService.js";
import { processIncomingMessage, triggerSchedulingForCandidates } from "./src/services/agentService.js";
import { cleanPhone, sendText } from "./src/services/evolutionService.js";
import { createMeetingEvent, deleteCalendarEvent } from "./src/services/googleCalendarService.js";
import { renderSchedulingPage, SchedulingPageData } from "./src/services/schedulingPage.js";
import crypto from "crypto";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" })); // Large limit for base64 PDFs from Evolution API

// Initialize Supabase for backend
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://dbfttgtntntuiimbqzgu.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZnR0Z3RudG50dWlpbWJxemd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTUwODksImV4cCI6MjA4NTg5MTA4OX0.H36Kv-PzK8Ab8FN5HzAWO5S_y8t-z8gExl5GsDBQchs';
const supabase = createClient(supabaseUrl, supabaseKey);

// Admin client with service role key for RLS-protected tables
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey);

// API routes FIRST
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Diagnóstico da API OpenAI
app.get("/api/test-openai", async (req, res) => {
  try {
    const { default: OpenAI } = await import("openai");
    const apiKey = process.env.OPENAI_API_KEY || '';
    const keyPreview = apiKey ? `${apiKey.substring(0, 10)}...` : '(não encontrada)';

    if (!apiKey || apiKey.length < 10) {
      return res.json({ ok: false, error: 'OPENAI_API_KEY não encontrada', keyPreview });
    }

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Responda apenas: OK' }],
      max_tokens: 5,
    });

    return res.json({ ok: true, keyPreview, response: completion.choices[0]?.message?.content });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    return res.json({ ok: false, error: e.message, status: e.status });
  }
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

  } catch (error: unknown) {
    console.error("Webhook Error:", error);
    return res.status(500).json({ error: "Internal server error.", details: error instanceof Error ? error.message : String(error) });
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
            .is("file_name", null)
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

    // Fetch Job Details to get title and criteria for OpenAI analysis
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
      .from("curriculos")
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
        .is("file_name", null)
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
          file_name: fileName,
          file_path: filePath,
          status: "ANALYZING",
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
            file_name: fileName,
            file_path: filePath,
            status: "ANALYZING",
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

    // Immediately trigger OpenAI Analysis
    // We don't await this to respond quickly to the webhook, or we can await it if the client expects the result synchronously.
    // Usually webhooks prefer fast responses, but let's await it so we can return the result, or process it in the background.
    // Run synchronously so the response includes the final analysis status.
    
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

  } catch (error: unknown) {
    console.error("Webhook Error:", error);
    return res.status(500).json({ error: "Internal server error.", details: error instanceof Error ? error.message : String(error) });
  }
});

// Endpoint para confirmar entrevista via link (GET)
app.get("/api/interviews/:id/confirm", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Atualiza o status da entrevista para CONFIRMADA
    const { data, error } = await supabase
      .from('interviews')
      .update({ status: 'CONFIRMADA' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error("Erro ao confirmar entrevista:", error);
      return res.status(500).send("Erro ao confirmar entrevista. Por favor, tente novamente ou contate o recrutador.");
    }

    // Retorna uma página HTML simples de sucesso
    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Entrevista Confirmada</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #f0fdf4; color: #166534; text-align: center; padding: 20px; }
            .container { background: white; padding: 40px 30px; border-radius: 24px; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); max-width: 400px; width: 100%; }
            h1 { margin-top: 0; font-size: 24px; margin-bottom: 12px; }
            p { color: #4b5563; line-height: 1.5; margin-bottom: 0; }
            svg { width: 72px; height: 72px; color: #22c55e; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <h1>Entrevista Confirmada!</h1>
            <p>Sua presença foi confirmada com sucesso. Aguardamos você no horário agendado.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Erro no endpoint de confirmação:", error);
    res.status(500).send("Erro interno do servidor.");
  }
});

// Endpoint para confirmar entrevista via Webhook (POST) - Ex: n8n ou Chatwoot
app.post("/api/webhooks/interviews/confirm", async (req, res) => {
  try {
    const { interview_id, candidate_phone } = req.body;

    if (!interview_id && !candidate_phone) {
      return res.status(400).json({ error: "É necessário informar o interview_id ou candidate_phone." });
    }

    let query = supabase.from('interviews').update({ status: 'CONFIRMADA' });

    if (interview_id) {
      query = query.eq('id', interview_id);
    } else if (candidate_phone) {
      // Busca o candidato pelo telefone para achar a entrevista pendente
      const { data: candidate } = await supabase
        .from('candidates')
        .select('id')
        .eq('WhatsApp com DDD', candidate_phone)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (candidate) {
        // Atualiza a entrevista do candidato que está aguardando ou agendada
        const { data: updateData, error: updateError } = await supabase
          .from('interviews')
          .update({ status: 'CONFIRMADA' })
          .eq('candidate_id', candidate.id)
          .in('status', ['AGENDADA', 'AGUARDANDO_RESPOSTA'])
          .select();
          
        if (updateError) {
          console.error("Erro ao confirmar entrevista via webhook:", updateError);
          return res.status(500).json({ error: "Erro ao confirmar entrevista." });
        }
        return res.status(200).json({ success: true, message: "Entrevista confirmada com sucesso.", data: updateData });
      } else {
        return res.status(404).json({ error: "Candidato não encontrado com este telefone." });
      }
    }

    const { data, error } = await query.select();

    if (error) {
      console.error("Erro ao confirmar entrevista via webhook:", error);
      return res.status(500).json({ error: "Erro ao confirmar entrevista." });
    }

    return res.status(200).json({ success: true, message: "Entrevista confirmada com sucesso.", data });
  } catch (error) {
    console.error("Erro no webhook de confirmação:", error);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─────────────────────────────────────────────────────────────────────
// AGENT: Evolution API webhook  (replaces n8n)
// Configure este URL no painel da Evolution API como webhook de entrada
// POST https://seu-dominio.com/api/webhooks/agent/whatsapp
// ─────────────────────────────────────────────────────────────────────
app.post("/api/webhooks/agent/whatsapp", async (req, res) => {
  try {
    const payload = req.body as Record<string, unknown>;

    // Only process incoming messages — handle both formats (messages.upsert and MESSAGES_UPSERT)
    const eventName = String(payload.event || "").toLowerCase().replace(/_/g, ".");
    if (!eventName.includes("messages.upsert")) return;

    const data = payload.data as Record<string, unknown> | undefined;
    if (!data) return;

    const key = data.key as Record<string, unknown> | undefined;
    if (!key) return;

    // Ignore messages sent by the bot itself
    if (key.fromMe === true) return;

    const remoteJid = String(key.remoteJid || "");

    // Ignore group messages
    if (remoteJid.endsWith("@g.us")) return;

    const instance    = String(payload.instance || "");
    const phone       = cleanPhone(remoteJid);
    const pushName    = String(data.pushName || "");
    const messageType = String(data.messageType || "");
    const message     = (data.message as Record<string, unknown>) || {};

    // Extract text content from various message types
    let textContent: string | null = null;
    if (messageType === "conversation") {
      textContent = String(message.conversation || "");
    } else if (messageType === "extendedTextMessage") {
      const ext = message.extendedTextMessage as Record<string, unknown> | undefined;
      textContent = String(ext?.text || "");
    } else if (messageType === "listResponseMessage") {
      const lr = message.listResponseMessage as Record<string, unknown> | undefined;
      textContent = String(lr?.title || "");
    }

    // Extract list response row ID (when candidate picks from a list)
    let selectedRowId: string | null = null;
    if (messageType === "listResponseMessage") {
      const lr  = message.listResponseMessage as Record<string, unknown> | undefined;
      const ssr = lr?.singleSelectReply as Record<string, unknown> | undefined;
      selectedRowId = ssr?.selectedRowId ? String(ssr.selectedRowId) : null;
    }

    // Build media data — extract embedded base64 if webhook_base64:true is set
    let mediaData: {
      key: Record<string, unknown>;
      message: Record<string, unknown>;
      embeddedBase64?: string;
      embeddedMimetype?: string;
    } | null = null;

    if (["documentMessage", "documentWithCaptionMessage"].includes(messageType)) {
      // documentMessage: { documentMessage: { base64, mimetype, fileName, ... } }
      // documentWithCaptionMessage: { documentWithCaptionMessage: { message: { documentMessage: { base64, ... } }, caption } }
      let docMsg = message.documentMessage as Record<string, unknown> | undefined;
      if (!docMsg && message.documentWithCaptionMessage) {
        const wrapper = message.documentWithCaptionMessage as Record<string, unknown>;
        // Try nested structure first: wrapper.message.documentMessage
        const innerMsg = wrapper.message as Record<string, unknown> | undefined;
        docMsg = (innerMsg?.documentMessage as Record<string, unknown> | undefined) ?? wrapper;
      }
      mediaData = {
        key: key as Record<string, unknown>,
        message,
        embeddedBase64: docMsg?.base64 ? String(docMsg.base64) : undefined,
        embeddedMimetype: docMsg?.mimetype ? String(docMsg.mimetype) : 'application/pdf',
      };
    }

    await processIncomingMessage(
      instance,
      phone,
      pushName,
      messageType,
      textContent,
      mediaData,
      selectedRowId,
      supabaseAdmin,
    );

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("[Agent Webhook] Error:", err);
    return res.status(200).json({ received: true }); // always ACK even on error
  }
});

// ─────────────────────────────────────────────────────────────────────
// AGENT: Start scheduling — called by ScheduleInterviewsModal
// POST /api/agent/start-scheduling
// Body: { user_id, job_id, interview_ids: string[] }
// ─────────────────────────────────────────────────────────────────────
app.post("/api/agent/start-scheduling", async (req, res) => {
  try {
    const { user_id, job_id, interview_ids } = req.body as {
      user_id: string;
      job_id: string;
      interview_ids: string[];
    };

    if (!user_id || !job_id || !Array.isArray(interview_ids) || interview_ids.length === 0) {
      return res.status(400).json({ error: "Campos obrigatórios: user_id, job_id, interview_ids[]" });
    }

    const result = await triggerSchedulingForCandidates(user_id, job_id, interview_ids, supabase);

    return res.status(200).json({
      success: true,
      message: `Agente disparado: ${result.sent} mensagens enviadas, ${result.errors} erros.`,
      ...result,
    });
  } catch (err: unknown) {
    console.error("[Start Scheduling] Error:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Erro interno do servidor.",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────
// Análise de currículo via OpenAI — chamado pelo frontend (App.tsx)
// POST /api/analyze-resume
// Body: { base64: string, job_title: string, criteria: string }
// ─────────────────────────────────────────────────────────────────────
app.post("/api/analyze-resume", async (req, res) => {
  try {
    const { base64, job_title, criteria } = req.body as {
      base64: string;
      job_title: string;
      criteria: string;
    };

    if (!base64 || !job_title) {
      return res.status(400).json({ error: "Campos obrigatórios: base64, job_title" });
    }

    const result = await analyzeResume(base64, job_title, criteria || '');
    return res.status(200).json(result);
  } catch (err: unknown) {
    console.error("[Analyze Resume] Error:", err);
    return res.status(500).json({ error: err instanceof Error ? err.message : "Erro interno." });
  }
});

// ─────────────────────────────────────────────────────────────────────
// Scheduling Page — Public routes for candidates to pick interview slots
// ─────────────────────────────────────────────────────────────────────

// JSON data endpoint for the React scheduling page
app.get("/api/agendar/:token/data", async (req, res) => {
  try {
    const { token } = req.params;

    const { data: interview, error } = await supabase
      .from('interviews')
      .select('id, job_id, candidate_id, status, slot_id, scheduling_token')
      .eq('scheduling_token', token)
      .single();

    if (error || !interview) return res.status(404).json({ ok: false, error: 'Link invalido ou expirado' });

    const [candidateRes, jobRes, slotsRes] = await Promise.all([
      supabase.from('candidates').select('"Nome Completo"').eq('id', interview.candidate_id).single(),
      supabase.from('jobs').select('title').eq('id', interview.job_id).single(),
      supabase.from('interview_slots')
        .select('id, slot_date, slot_time, format, location, interviewer_name')
        .eq('job_id', interview.job_id)
        .eq('is_booked', false)
        .order('slot_date', { ascending: true })
        .order('slot_time', { ascending: true }),
    ]);

    return res.json({
      ok: true,
      status: interview.status,
      candidateName: (candidateRes.data as Record<string, string>)?.['Nome Completo'] || '',
      jobTitle: jobRes.data?.title || '',
      slots: slotsRes.data || [],
    });
  } catch (err) {
    console.error('[Scheduling Data] Error:', err);
    return res.status(500).json({ ok: false, error: 'Erro interno' });
  }
});

app.get("/api/agendar/:token", async (req, res) => {
  try {
    const { token } = req.params;

    // Find interview by scheduling_token
    const { data: interview, error } = await supabase
      .from('interviews')
      .select('id, job_id, candidate_id, status, slot_id, scheduled_date, scheduled_time, interviewer_name, scheduling_token')
      .eq('scheduling_token', token)
      .single();

    if (error || !interview) {
      return res.status(404).send('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h1>Link invalido ou expirado</h1><p>Entre em contato com o recrutador.</p></body></html>');
    }

    // Get job details
    const { data: job } = await supabase.from('jobs').select('title').eq('id', interview.job_id).single();

    // Get candidate name
    const { data: candidate } = await supabase.from('candidates').select('"Nome Completo"').eq('id', interview.candidate_id).single();
    const candidateName = (candidate as Record<string, string>)?.['Nome Completo'] || 'Candidato';

    // Get available slots for this job
    const { data: allSlots } = await supabase
      .from('interview_slots')
      .select('id, slot_date, slot_time, format, location, interviewer_name, is_booked')
      .eq('job_id', interview.job_id)
      .order('slot_date', { ascending: true })
      .order('slot_time', { ascending: true });

    const slots = (allSlots || []).map(s => {
      const [year, month, day] = s.slot_date.split('-').map(Number);
      const dateLabel = new Date(year, month - 1, day).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
      return {
        id: s.id,
        date: s.slot_date,
        time: s.slot_time,
        dateLabel,
        timeLabel: s.slot_time.substring(0, 5),
        isBooked: s.is_booked && s.id !== interview.slot_id, // Show own booked slot as available
      };
    });

    // Determine format/location from the first slot
    const firstSlot = allSlots?.[0];
    const currentBooking = interview.slot_id ? {
      slotId: interview.slot_id,
      date: interview.scheduled_date,
      time: interview.scheduled_time?.substring(0, 5) || '',
    } : null;

    const pageData: SchedulingPageData = {
      token,
      candidateName,
      jobTitle: job?.title || 'Vaga',
      interviewerName: interview.interviewer_name || firstSlot?.interviewer_name || null,
      format: firstSlot?.format || 'ONLINE',
      location: firstSlot?.location || null,
      currentBooking,
      slots,
    };

    const html = renderSchedulingPage(pageData);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (err) {
    console.error('[Scheduling Page] Error:', err);
    return res.status(500).send('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h1>Erro interno</h1><p>Tente novamente em instantes.</p></body></html>');
  }
});

app.post("/api/agendar/:token/book", async (req, res) => {
  try {
    const { token } = req.params;
    const { slot_id } = req.body as { slot_id: string };

    console.log('[Book Slot] Starting with token:', token, 'slot_id:', slot_id);
    if (!slot_id) return res.status(400).json({ ok: false, error: 'slot_id obrigatorio' });

    // Find interview (use supabaseAdmin for RLS-protected table)
    const { data: interview, error: intErr } = await supabaseAdmin
      .from('interviews')
      .select('id, job_id, candidate_id, status, scheduling_token, slot_id, google_event_id')
      .eq('scheduling_token', token)
      .single();

    console.log('[Book Slot] Interview lookup:', { success: !!interview, error: intErr?.message });
    if (intErr || !interview) return res.status(404).json({ ok: false, error: 'Link invalido' });

    // If reschedule: free old slot and cancel old Google Calendar event
    if (interview.slot_id) {
      console.log('[Book Slot] Reschedule detected — freeing old slot:', interview.slot_id);
      await supabaseAdmin.from('interview_slots').update({ is_booked: false }).eq('id', interview.slot_id);
    }
    if (interview.google_event_id) {
      const deleted = await deleteCalendarEvent(interview.google_event_id);
      console.log(`[Book Slot] Old Google Calendar event: ${deleted ? 'deleted' : 'failed to delete'}`);
    }

    // Book the slot (optimistic concurrency)
    const { data: booked, error: bookErr } = await supabaseAdmin
      .from('interview_slots')
      .update({ is_booked: true })
      .eq('id', slot_id)
      .eq('is_booked', false)
      .select()
      .maybeSingle();

    console.log('[Book Slot] Slot booking:', { success: !!booked, error: bookErr?.message });
    if (bookErr || !booked) {
      return res.status(409).json({ ok: false, error: 'Horario ja foi preenchido. Escolha outro.' });
    }

    // Update interview (columns: slot_id, slot_date, slot_time, status)
    const { error: interviewErr } = await supabaseAdmin.from('interviews').update({
      slot_id,
      slot_date: booked.slot_date,
      slot_time: booked.slot_time,
      status: 'CONFIRMADA',
    }).eq('id', interview.id);

    console.log('[Book Slot] Interview update:', { success: !interviewErr, error: interviewErr?.message });
    if (interviewErr) {
      console.error('[Book Slot] Failed to update interview:', interviewErr);
      return res.status(500).json({ ok: false, error: 'Erro ao atualizar entrevista: ' + interviewErr.message });
    }

    // Get candidate and job data for Google Calendar event
    const { data: candData, error: candErr } = await supabaseAdmin
      .from('candidates')
      .select('"WhatsApp com DDD", "Nome Completo"')
      .eq('id', interview.candidate_id)
      .single();

    console.log('[Book Slot] Candidate lookup:', { success: !!candData, error: candErr?.message });

    const { data: job, error: jobErr } = await supabaseAdmin
      .from('jobs')
      .select('user_id, title')
      .eq('id', interview.job_id)
      .single();

    // Get recruiter email
    let recruiterEmail: string | undefined;
    if (job?.user_id) {
      const { data: recruiterProfile } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('id', job.user_id)
        .single();
      recruiterEmail = recruiterProfile?.email || undefined;
    }

    // Create Google Calendar event + Google Meet
    let meetLink = '';
    const candidateName = (candData as Record<string, string>)?.['Nome Completo'] || 'Candidato';
    const jobTitle = job?.title || 'Vaga';

    const candidatePhone = (candData as Record<string, string>)?.['WhatsApp com DDD'];

    const googleEvent = await createMeetingEvent({
      candidateName,
      jobTitle,
      slotDate: booked.slot_date,
      slotTime: booked.slot_time,
      interviewerName: booked.interviewer_name || undefined,
      recruiterEmail,
      candidatePhone: candidatePhone || undefined,
    });

    if (googleEvent?.meetLink) {
      meetLink = googleEvent.meetLink;
      console.log('[Book Slot] Google Meet link created:', meetLink);

      // Save meeting link and event ID to interviews table
      await supabaseAdmin.from('interviews').update({
        meeting_link: meetLink,
        google_event_id: googleEvent.eventId || null,
      }).eq('id', interview.id);
    } else {
      console.warn('[Book Slot] Failed to create Google Meet event');
    }

    console.log('[Book Slot] Job lookup:', { success: !!job, error: jobErr?.message });

    // Use phone already extracted for WhatsApp
    const phone = candidatePhone;

    if (phone) {
      await supabaseAdmin.from('agent_conversations').update({
        state: 'ENTREVISTA_CONFIRMADA',
        updated_at: new Date().toISOString(),
      }).eq('phone', phone);

      // Send WhatsApp confirmation message
      if (job?.user_id) {
        const { data: profile, error: profErr } = await supabaseAdmin
          .from('profiles')
          .select('instancia_evolution')
          .eq('id', job.user_id)
          .single();

        console.log('[Book Slot] Profile lookup:', { success: !!profile, error: profErr?.message });
        const instance = profile?.instancia_evolution;

        if (instance) {
          const [year, month, day] = booked.slot_date.split('-').map(Number);
          const dateLabel = new Date(year, month - 1, day).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
          const timeLabel = booked.slot_time.substring(0, 5);
          const interviewer = booked.interviewer_name ? `\n👤 *Entrevistador:* ${booked.interviewer_name}` : '';
          const location = booked.location ? `\n📍 *Local/Link:* ${booked.location}` : '';
          const firstName = ((candData as Record<string, string>)?.['Nome Completo'] || '').split(' ')[0] || 'Candidato';
          const meetLinkText = meetLink ? `\n🎥 *Google Meet:* ${meetLink}\n_Clique no link acima para acessar a sala no dia da entrevista._` : '';

          console.log('[Book Slot] Sending WhatsApp to:', phone);
          await sendText(
            instance,
            phone,
            `✅ *Entrevista Confirmada!*\n\nOlá, *${firstName}*! Seu horário foi reservado com sucesso.\n\n📅 *Data:* ${dateLabel}\n⏰ *Horário:* ${timeLabel}${interviewer}${location}${meetLinkText}\n\nQualquer dúvida, entre em contato. Boa sorte! 🍀`,
            false,
          );
        } else {
          console.warn('[Book Slot] No Evolution instance found');
        }
      } else {
        console.warn('[Book Slot] No job user_id found');
      }
    } else {
      console.warn('[Book Slot] No candidate phone found');
    }

    console.log('[Book Slot] Success');
    return res.json({ ok: true, slot: booked });
  } catch (err) {
    console.error('[Book Slot] Error:', err);
    return res.status(500).json({ ok: false, error: 'Erro interno: ' + (err instanceof Error ? err.message : String(err)) });
  }
});

// ── Cancel interview (WhatsApp notification + Google Calendar deletion) ──
app.post("/api/interviews/:id/cancel", async (req, res) => {
  const { id } = req.params;
  console.log(`[Cancel] ▶ Starting cancellation for interview ${id}`);

  try {
    // 1. Fetch interview data BEFORE deleting
    const { data: interview, error: intErr } = await supabaseAdmin
      .from('interviews')
      .select('id, candidate_id, job_id, slot_id, slot_date, slot_time, google_event_id, interviewer_name, status')
      .eq('id', id)
      .single();

    if (intErr || !interview) {
      console.error(`[Cancel] Interview not found: ${id}`, intErr?.message);
      return res.status(404).json({ ok: false, error: 'Entrevista não encontrada' });
    }

    console.log(`[Cancel] Interview found:`, {
      id: interview.id,
      candidate_id: interview.candidate_id,
      job_id: interview.job_id,
      status: interview.status,
      google_event_id: interview.google_event_id || 'none',
      slot_date: interview.slot_date,
      slot_time: interview.slot_time,
    });

    // 2. Get candidate + job data BEFORE deleting the interview
    const { data: candidate, error: candErr } = await supabaseAdmin
      .from('candidates')
      .select('"WhatsApp com DDD", "Nome Completo"')
      .eq('id', interview.candidate_id)
      .single();

    console.log(`[Cancel] Candidate lookup:`, { found: !!candidate, error: candErr?.message });

    const phone = (candidate as Record<string, string>)?.['WhatsApp com DDD'];
    const firstName = ((candidate as Record<string, string>)?.['Nome Completo'] || '').split(' ')[0] || 'Candidato';
    console.log(`[Cancel] Candidate: ${firstName}, phone: ${phone || 'NOT FOUND'}`);

    const { data: job, error: jobErr } = await supabaseAdmin
      .from('jobs')
      .select('user_id, title')
      .eq('id', interview.job_id)
      .single();

    console.log(`[Cancel] Job lookup:`, { found: !!job, user_id: job?.user_id, error: jobErr?.message });

    let instance: string | null = null;
    if (job?.user_id) {
      const { data: profile, error: profErr } = await supabaseAdmin
        .from('profiles')
        .select('instancia_evolution')
        .eq('id', job.user_id)
        .single();
      instance = profile?.instancia_evolution || null;
      console.log(`[Cancel] Evolution instance:`, instance || 'NOT FOUND', profErr?.message || '');
    }

    // 3. Delete from Google Calendar
    if (interview.google_event_id) {
      const deleted = await deleteCalendarEvent(interview.google_event_id);
      console.log(`[Cancel] Google Calendar event ${interview.google_event_id}: ${deleted ? 'DELETED' : 'FAILED'}`);
    } else {
      console.log(`[Cancel] No Google Calendar event to delete`);
    }

    // 4. Free the slot
    if (interview.slot_id) {
      await supabaseAdmin.from('interview_slots').update({ is_booked: false }).eq('id', interview.slot_id);
      console.log(`[Cancel] Slot ${interview.slot_id} freed`);
    }

    // 5. Delete the interview record
    const { error: delErr } = await supabaseAdmin.from('interviews').delete().eq('id', id);
    if (delErr) {
      console.error('[Cancel] Delete error:', delErr.message);
      return res.status(500).json({ ok: false, error: delErr.message });
    }
    console.log(`[Cancel] Interview record deleted`);

    // 6. Delete free (unbooked) slots for this job
    await supabaseAdmin.from('interview_slots').delete().eq('job_id', interview.job_id).eq('is_booked', false);

    // 7. Send WhatsApp cancellation message
    let whatsappSent = false;
    if (!phone) {
      console.warn(`[Cancel] SKIP WhatsApp: no phone number for candidate ${interview.candidate_id}`);
    } else if (!instance) {
      console.warn(`[Cancel] SKIP WhatsApp: no Evolution instance for job owner`);
    } else {
      let dateInfo = '';
      if (interview.slot_date && interview.slot_time) {
        const [year, month, day] = interview.slot_date.split('-').map(Number);
        const dateLabel = new Date(year, month - 1, day).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
        const timeLabel = interview.slot_time.substring(0, 5);
        dateInfo = `\n\n📅 ${dateLabel} às ${timeLabel}`;
      }

      console.log(`[Cancel] Sending WhatsApp to ${phone} via instance ${instance}`);
      await sendText(
        instance,
        phone,
        `Olá, *${firstName}*.\n\nInformamos que, infelizmente, sua entrevista foi cancelada.${dateInfo}\n\nPedimos desculpas pelo inconveniente.\n\nAtenciosamente,\nEquipe de Recrutamento`,
        false,
      );
      whatsappSent = true;
      console.log(`[Cancel] ✓ WhatsApp sent successfully to ${phone}`);
    }

    // 8. Update agent conversation state
    if (phone) {
      await supabaseAdmin.from('agent_conversations').update({
        state: 'CANCELADA',
        updated_at: new Date().toISOString(),
      }).eq('phone', phone);
      console.log(`[Cancel] Conversation state updated to CANCELADA`);
    }

    console.log(`[Cancel] ✓ Cancellation complete. WhatsApp: ${whatsappSent ? 'SENT' : 'NOT SENT'}`);
    return res.json({ ok: true, whatsapp_sent: whatsappSent });
  } catch (err) {
    console.error('[Cancel] ✗ FATAL ERROR:', err);
    return res.status(500).json({ ok: false, error: 'Erro interno: ' + (err instanceof Error ? err.message : String(err)) });
  }
});

// ── Cron: interview reminders (~2h before) ──────────────────────────
app.get("/api/cron/interview-reminders", async (req, res) => {
  // Vercel cron sends Authorization header — validate it
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Calculate window: from now to +2.5h (to catch interviews with 15-min cron granularity)
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 2.5 * 60 * 60 * 1000);

    // Format as YYYY-MM-DD and HH:MM:SS for comparison
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // YYYY-MM-DD
    const windowEndDate = windowEnd.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const nowTime = now.toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour12: false });
    const windowEndTime = windowEnd.toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour12: false });

    console.log(`[Reminder Cron] Running at ${todayStr} ${nowTime}, window until ${windowEndDate} ${windowEndTime}`);

    // Query confirmed interviews within the time window that haven't been reminded
    let query = supabaseAdmin
      .from('interviews')
      .select('id, candidate_id, job_id, slot_date, slot_time, meeting_link, interviewer_name, lembrete_enviado')
      .eq('status', 'CONFIRMADA')
      .eq('lembrete_enviado', false);

    if (todayStr === windowEndDate) {
      // Same day: slot_date = today AND slot_time between now and window end
      query = query
        .eq('slot_date', todayStr)
        .gte('slot_time', nowTime)
        .lte('slot_time', windowEndTime);
    } else {
      // Crosses midnight: get today's remaining + tomorrow's early slots
      // For simplicity, query both dates and filter
      query = query
        .in('slot_date', [todayStr, windowEndDate])
        .gte('slot_time', '00:00:00')
        .lte('slot_time', '23:59:59');
    }

    const { data: interviews, error: intErr } = await query;

    if (intErr) {
      console.error('[Reminder Cron] Query error:', intErr.message);
      return res.status(500).json({ error: intErr.message });
    }

    console.log(`[Reminder Cron] Found ${interviews?.length || 0} interviews to remind`);

    let sent = 0;
    for (const interview of interviews || []) {
      try {
        // Get candidate phone
        const { data: candidate } = await supabaseAdmin
          .from('candidates')
          .select('"WhatsApp com DDD", "Nome Completo"')
          .eq('id', interview.candidate_id)
          .single();

        const phone = (candidate as Record<string, string>)?.['WhatsApp com DDD'];
        const firstName = ((candidate as Record<string, string>)?.['Nome Completo'] || '').split(' ')[0] || 'Candidato';

        if (!phone) {
          console.warn(`[Reminder Cron] No phone for candidate ${interview.candidate_id}`);
          continue;
        }

        // Get job to find recruiter's Evolution instance
        const { data: job } = await supabaseAdmin
          .from('jobs')
          .select('user_id, title')
          .eq('id', interview.job_id)
          .single();

        if (!job?.user_id) {
          console.warn(`[Reminder Cron] No job/user_id for interview ${interview.id}`);
          continue;
        }

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('instancia_evolution')
          .eq('id', job.user_id)
          .single();

        const instance = profile?.instancia_evolution;
        if (!instance) {
          console.warn(`[Reminder Cron] No Evolution instance for user ${job.user_id}`);
          continue;
        }

        // Format date and time
        const [year, month, day] = interview.slot_date.split('-').map(Number);
        const dateLabel = new Date(year, month - 1, day).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
        const timeLabel = interview.slot_time.substring(0, 5);
        const interviewer = interview.interviewer_name ? `\n👤 *Entrevistador:* ${interview.interviewer_name}` : '';
        const meetLink = interview.meeting_link ? `\n🎥 *Google Meet:* ${interview.meeting_link}` : '';

        await sendText(
          instance,
          phone,
          `⏰ *Lembrete de Entrevista*\n\nOlá, *${firstName}*! Sua entrevista está chegando:\n\n📅 *Data:* ${dateLabel}\n⏰ *Horário:* ${timeLabel}${interviewer}${meetLink}\n\nPrepare-se e boa sorte! 🍀`,
          false,
        );

        // Mark as reminded
        await supabaseAdmin.from('interviews').update({ lembrete_enviado: true }).eq('id', interview.id);
        sent++;
        console.log(`[Reminder Cron] Sent reminder for interview ${interview.id} to ${phone}`);
      } catch (err) {
        console.error(`[Reminder Cron] Error processing interview ${interview.id}:`, err);
      }
    }

    return res.json({ ok: true, reminders_sent: sent, total_found: interviews?.length || 0 });
  } catch (err) {
    console.error('[Reminder Cron] Error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Reschedule is now handled by the /book endpoint (it detects existing slot_id and frees it)
// This route is kept for backwards compatibility but redirects to /book
app.post("/api/agendar/:token/reschedule", async (req, res) => {
  const { token } = req.params;
  const { slot_id } = req.body as { slot_id: string };

  // Forward to book endpoint which handles both new bookings and reschedules
  const bookUrl = `${req.protocol}://${req.get('host')}/api/agendar/${token}/book`;
  try {
    const response = await fetch(bookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot_id }),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('[Reschedule] Forward error:', err);
    return res.status(500).json({ ok: false, error: 'Erro interno' });
  }
});

// ============================================================
// MÓDULO DE ADMISSÃO - API Routes
// ============================================================

// POST /api/admissions — Cria solicitação de documentação e envia WhatsApp
app.post("/api/admissions", async (req, res) => {
  try {
    const { candidate_id, job_id, required_docs, candidate_phone, candidate_name } = req.body;

    if (!candidate_id || !job_id || !required_docs?.length) {
      return res.status(400).json({ error: "candidate_id, job_id e required_docs são obrigatórios" });
    }

    if (!candidate_phone) {
      return res.status(400).json({ error: "Candidato não possui WhatsApp cadastrado." });
    }

    // Get the authenticated user from Supabase auth header
    const authHeader = req.headers.authorization;
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user: authUser } } = await supabase.auth.getUser(token);
      userId = authUser?.id || null;
    }

    // Fallback: get user_id from the job record
    if (!userId) {
      const { data: jobData } = await supabaseAdmin
        .from('jobs')
        .select('user_id')
        .eq('id', job_id)
        .single();
      userId = jobData?.user_id;
    }

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    // Check if there's already a PENDING admission for this candidate+job
    const { data: existing } = await supabaseAdmin
      .from('admissions')
      .select('id, token')
      .eq('candidate_id', candidate_id)
      .eq('job_id', job_id)
      .in('status', ['PENDING', 'SUBMITTED'])
      .maybeSingle();

    let admissionToken: string;

    if (existing) {
      // Update existing admission with new required_docs (re-send scenario)
      admissionToken = existing.token;
      await supabaseAdmin
        .from('admissions')
        .update({ required_docs, status: 'PENDING', submitted_at: null, submitted_docs: [] })
        .eq('id', existing.id);
    } else {
      // Create new admission
      const { data: newAdmission, error: insertError } = await supabaseAdmin
        .from('admissions')
        .insert({
          user_id: userId,
          job_id,
          candidate_id,
          required_docs,
          status: 'PENDING',
        })
        .select('token')
        .single();

      if (insertError || !newAdmission) {
        console.error('[Admissions] Insert error:', insertError);
        return res.status(500).json({ error: "Erro ao criar solicitação de admissão" });
      }

      admissionToken = newAdmission.token;
    }

    // Build public URL — prefer BASE_URL (custom domain), fallback to known domain, then VERCEL_URL
    const baseUrl = process.env.BASE_URL
      || 'https://app.elevva.net.br';
    const portalUrl = `${baseUrl}/admissao/${admissionToken}`;

    // Get user's Evolution instance
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('instancia_evolution')
      .eq('id', userId)
      .single();

    const instance = profile?.instancia_evolution;

    if (instance) {
      const firstName = (candidate_name || 'Candidato').split(' ')[0];
      const docCount = required_docs.length;

      const message = `🎉 *Parabéns, ${firstName}!*\n\n` +
        `Você foi *aprovado(a)* no processo seletivo!\n\n` +
        `Para seguirmos com sua admissão, precisamos de *${docCount} documento${docCount > 1 ? 's' : ''}*.\n\n` +
        `📋 Acesse seu portal seguro para envio:\n${portalUrl}\n\n` +
        `⏰ *Importante:* O link expira em *48 horas* após o envio dos documentos.\n\n` +
        `Caso tenha dúvidas, entre em contato conosco.`;

      // Format phone for WhatsApp JID
      const phone = candidate_phone.replace(/\D/g, '');
      const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

      await sendText(instance, jid, message);
      console.log(`[Admissions] WhatsApp sent to ${phone} with token ${admissionToken}`);
    } else {
      console.warn(`[Admissions] No Evolution instance for user ${userId}. WhatsApp not sent.`);
    }

    return res.json({ ok: true, token: admissionToken });
  } catch (err) {
    console.error('[Admissions] Error:', err);
    return res.status(500).json({ error: "Erro interno ao processar admissão" });
  }
});

// GET /api/admissions/:token — Busca dados da admissão pelo token (portal público)
app.get("/api/admissions/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const { data, error } = await supabaseAdmin
      .from('admissions')
      .select(`
        id, token, required_docs, submitted_docs, status, created_at, submitted_at,
        candidates (analysis_result),
        jobs (title)
      `)
      .eq('token', token)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Solicitação não encontrada ou expirada." });
    }

    if (data.status === 'EXPIRED') {
      return res.status(410).json({ error: "Esta solicitação expirou. Os documentos foram deletados conforme a LGPD." });
    }

    const analysisResult = data.candidates?.analysis_result;
    let candidateName = 'Candidato';
    if (analysisResult) {
      try {
        const parsed = typeof analysisResult === 'string' ? JSON.parse(analysisResult) : analysisResult;
        candidateName = parsed?.candidateName || 'Candidato';
      } catch {}
    }

    return res.json({
      id: data.id,
      token: data.token,
      required_docs: data.required_docs,
      submitted_docs: data.submitted_docs || [],
      status: data.status,
      candidate_name: candidateName,
      job_title: data.jobs?.title || '',
    });
  } catch (err) {
    console.error('[Admissions] GET error:', err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/admissions/:token/upload — Candidato faz upload de um documento
app.post("/api/admissions/:token/upload", async (req, res) => {
  try {
    const { token } = req.params;
    const { doc_name, file_base64, file_name, content_type } = req.body;

    if (!doc_name || !file_base64 || !file_name) {
      return res.status(400).json({ error: "doc_name, file_base64 e file_name são obrigatórios" });
    }

    // Validate admission exists and is PENDING
    const { data: admission, error } = await supabaseAdmin
      .from('admissions')
      .select('id, token, status, submitted_docs')
      .eq('token', token)
      .single();

    if (error || !admission) {
      return res.status(404).json({ error: "Solicitação não encontrada." });
    }

    if (admission.status === 'EXPIRED') {
      return res.status(410).json({ error: "Solicitação expirada." });
    }

    // Upload file to admission_docs bucket
    const buffer = Buffer.from(file_base64, 'base64');
    const safeFileName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${token}/${Date.now()}_${safeFileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('admission_docs')
      .upload(filePath, buffer, {
        contentType: content_type || 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('[Admissions] Upload error:', uploadError);
      return res.status(500).json({ error: "Erro ao fazer upload do documento." });
    }

    // Update submitted_docs in the admission record
    const existingDocs = admission.submitted_docs || [];
    const updatedDocs = [
      ...existingDocs.filter((d: any) => d.name !== doc_name), // Replace if same doc name
      {
        name: doc_name,
        file_path: filePath,
        file_name: safeFileName,
        uploaded_at: new Date().toISOString(),
      },
    ];

    await supabaseAdmin
      .from('admissions')
      .update({ submitted_docs: updatedDocs })
      .eq('id', admission.id);

    return res.json({ ok: true, file_path: filePath });
  } catch (err) {
    console.error('[Admissions] Upload error:', err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/admissions/:token/text — Candidato salva um campo de texto
app.post("/api/admissions/:token/text", async (req, res) => {
  try {
    const { token } = req.params;
    const { doc_name, value } = req.body;

    if (!doc_name || !value?.trim()) {
      return res.status(400).json({ error: "doc_name e value são obrigatórios" });
    }

    const { data: admission, error } = await supabaseAdmin
      .from('admissions')
      .select('id, token, status, submitted_docs')
      .eq('token', token)
      .single();

    if (error || !admission) {
      return res.status(404).json({ error: "Solicitação não encontrada." });
    }

    if (admission.status === 'EXPIRED') {
      return res.status(410).json({ error: "Solicitação expirada." });
    }

    const existingDocs = admission.submitted_docs || [];
    const updatedDocs = [
      ...existingDocs.filter((d: any) => d.name !== doc_name),
      {
        name: doc_name,
        value: value.trim(),
        uploaded_at: new Date().toISOString(),
      },
    ];

    await supabaseAdmin
      .from('admissions')
      .update({ submitted_docs: updatedDocs })
      .eq('id', admission.id);

    return res.json({ ok: true });
  } catch (err) {
    console.error('[Admissions] Text save error:', err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/admissions/:token/submit — Candidato finaliza envio de documentos
app.post("/api/admissions/:token/submit", async (req, res) => {
  try {
    const { token } = req.params;

    const { data: admission, error } = await supabaseAdmin
      .from('admissions')
      .select('id, status, submitted_docs, required_docs')
      .eq('token', token)
      .single();

    if (error || !admission) {
      return res.status(404).json({ error: "Solicitação não encontrada." });
    }

    if (admission.status !== 'PENDING') {
      return res.status(400).json({ error: "Documentos já foram enviados." });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48h

    await supabaseAdmin
      .from('admissions')
      .update({
        status: 'SUBMITTED',
        submitted_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', admission.id);

    return res.json({ ok: true });
  } catch (err) {
    console.error('[Admissions] Submit error:', err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

// GET /api/admissions/:id/dossier — Gera PDF dossiê com pdf-lib
app.get("/api/admissions/:id/dossier", async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch admission with related data
    const { data: admission, error } = await supabaseAdmin
      .from('admissions')
      .select(`
        *,
        candidates (analysis_result, "WhatsApp com DDD"),
        jobs (title)
      `)
      .eq('id', id)
      .single();

    if (error || !admission) {
      return res.status(404).json({ error: "Admissão não encontrada." });
    }

    if (admission.status === 'EXPIRED') {
      return res.status(410).json({ error: "Documentos expirados e deletados conforme LGPD." });
    }

    if (!admission.submitted_docs?.length) {
      return res.status(400).json({ error: "Nenhum documento foi enviado ainda." });
    }

    // Extract candidate name
    let candidateName = 'Candidato';
    if (admission.candidates?.analysis_result) {
      try {
        const parsed = typeof admission.candidates.analysis_result === 'string'
          ? JSON.parse(admission.candidates.analysis_result)
          : admission.candidates.analysis_result;
        candidateName = parsed?.candidateName || 'Candidato';
      } catch {}
    }

    const jobTitle = admission.jobs?.title || 'Vaga';

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const A4_WIDTH = 595.28;
    const A4_HEIGHT = 841.89;
    const MARGIN = 50;
    const CONTENT_WIDTH = A4_WIDTH - MARGIN * 2;

    // --- COVER PAGE ---
    const coverPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

    // Header bar
    coverPage.drawRectangle({
      x: 0, y: A4_HEIGHT - 120,
      width: A4_WIDTH, height: 120,
      color: rgb(0.05, 0.05, 0.05),
    });

    // Title
    coverPage.drawText('DOSSIÊ DE ADMISSÃO', {
      x: MARGIN, y: A4_HEIGHT - 55,
      size: 24, font: fontBold,
      color: rgb(0.52, 0.8, 0.08), // #84cc16
    });

    // Subtitle
    coverPage.drawText('Documentação do Candidato', {
      x: MARGIN, y: A4_HEIGHT - 80,
      size: 12, font,
      color: rgb(0.7, 0.7, 0.7),
    });

    // Elevva branding
    coverPage.drawText('Elevva', {
      x: A4_WIDTH - MARGIN - 60, y: A4_HEIGHT - 55,
      size: 18, font: fontBold,
      color: rgb(0.52, 0.8, 0.08),
    });

    // Candidate info section
    let y = A4_HEIGHT - 180;

    const drawInfoLine = (label: string, value: string) => {
      coverPage.drawText(label, {
        x: MARGIN, y,
        size: 10, font: fontBold,
        color: rgb(0.4, 0.4, 0.4),
      });
      coverPage.drawText(value, {
        x: MARGIN + 120, y,
        size: 11, font,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= 24;
    };

    drawInfoLine('Candidato:', candidateName);
    drawInfoLine('Vaga:', jobTitle);
    drawInfoLine('WhatsApp:', admission.candidates?.['WhatsApp com DDD'] || 'N/A');
    drawInfoLine('Data de envio:', admission.submitted_at
      ? new Date(admission.submitted_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'N/A');
    drawInfoLine('Total de docs:', `${admission.submitted_docs.length} documento(s)`);

    // Separator
    y -= 10;
    coverPage.drawLine({
      start: { x: MARGIN, y },
      end: { x: A4_WIDTH - MARGIN, y },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.85),
    });

    // Documents index
    y -= 30;
    coverPage.drawText('DOCUMENTOS INCLUÍDOS', {
      x: MARGIN, y,
      size: 12, font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 25;

    for (let i = 0; i < admission.submitted_docs.length; i++) {
      const doc = admission.submitted_docs[i];
      const label = doc.value ? `${doc.name}: ${doc.value}` : doc.name;
      coverPage.drawText(`${i + 1}.  ${label}`, {
        x: MARGIN + 10, y,
        size: 10, font,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= 20;
    }

    // LGPD notice
    y -= 30;
    coverPage.drawRectangle({
      x: MARGIN, y: y - 50,
      width: CONTENT_WIDTH, height: 60,
      color: rgb(0.98, 0.96, 0.9),
      borderColor: rgb(0.9, 0.85, 0.7),
      borderWidth: 1,
    });
    coverPage.drawText('AVISO LGPD', {
      x: MARGIN + 15, y: y - 10,
      size: 9, font: fontBold,
      color: rgb(0.6, 0.5, 0.2),
    });
    coverPage.drawText('Este documento contém dados pessoais sensíveis. Manuseie conforme a Lei Geral de', {
      x: MARGIN + 15, y: y - 25,
      size: 8, font,
      color: rgb(0.5, 0.4, 0.2),
    });
    coverPage.drawText('Proteção de Dados (LGPD). Os originais foram deletados automaticamente após 48 horas.', {
      x: MARGIN + 15, y: y - 37,
      size: 8, font,
      color: rgb(0.5, 0.4, 0.2),
    });

    // --- DOCUMENT PAGES ---
    for (const doc of admission.submitted_docs) {
      try {
        // Text field — render as text on a page
        if (doc.value && !doc.file_path) {
          const textPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
          textPage.drawRectangle({
            x: 0, y: A4_HEIGHT - 45,
            width: A4_WIDTH, height: 45,
            color: rgb(0.96, 0.96, 0.96),
          });
          textPage.drawText(doc.name, {
            x: MARGIN, y: A4_HEIGHT - 30,
            size: 12, font: fontBold,
            color: rgb(0.2, 0.2, 0.2),
          });
          textPage.drawText(doc.value, {
            x: MARGIN, y: A4_HEIGHT - 80,
            size: 14, font,
            color: rgb(0.1, 0.1, 0.1),
          });
          continue;
        }

        if (!doc.file_path) continue;

        // Download file from storage
        const { data: fileData, error: downloadError } = await supabaseAdmin.storage
          .from('admission_docs')
          .download(doc.file_path);

        if (downloadError || !fileData) {
          console.error(`[Dossier] Failed to download ${doc.file_path}:`, downloadError);
          // Add error page
          const errorPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
          errorPage.drawText(`Documento: ${doc.name}`, {
            x: MARGIN, y: A4_HEIGHT - MARGIN - 20,
            size: 14, font: fontBold,
            color: rgb(0.1, 0.1, 0.1),
          });
          errorPage.drawText('Erro: arquivo não encontrado no storage.', {
            x: MARGIN, y: A4_HEIGHT - MARGIN - 50,
            size: 11, font,
            color: rgb(0.8, 0.2, 0.2),
          });
          continue;
        }

        const arrayBuffer = await fileData.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);

        // Check if it's a PDF
        const isPdf = doc.file_path.toLowerCase().endsWith('.pdf') ||
          (uint8[0] === 0x25 && uint8[1] === 0x50 && uint8[2] === 0x44 && uint8[3] === 0x46); // %PDF

        if (isPdf) {
          // Embed PDF pages
          try {
            const embeddedPdf = await PDFDocument.load(uint8);
            const pageIndices = embeddedPdf.getPageIndices();
            const copiedPages = await pdfDoc.copyPages(embeddedPdf, pageIndices);

            // Add label page before the document
            const labelPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
            labelPage.drawRectangle({
              x: 0, y: A4_HEIGHT / 2 - 30,
              width: A4_WIDTH, height: 60,
              color: rgb(0.96, 0.96, 0.96),
            });
            labelPage.drawText(doc.name, {
              x: MARGIN, y: A4_HEIGHT / 2 - 5,
              size: 20, font: fontBold,
              color: rgb(0.1, 0.1, 0.1),
            });
            labelPage.drawText(`Documento PDF — ${copiedPages.length} página(s)`, {
              x: MARGIN, y: A4_HEIGHT / 2 - 25,
              size: 10, font,
              color: rgb(0.5, 0.5, 0.5),
            });

            copiedPages.forEach(page => pdfDoc.addPage(page));
          } catch (pdfErr) {
            console.error(`[Dossier] Error embedding PDF ${doc.name}:`, pdfErr);
            const errorPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
            errorPage.drawText(`Documento: ${doc.name}`, {
              x: MARGIN, y: A4_HEIGHT - MARGIN - 20,
              size: 14, font: fontBold, color: rgb(0.1, 0.1, 0.1),
            });
            errorPage.drawText('Erro: PDF corrompido ou protegido.', {
              x: MARGIN, y: A4_HEIGHT - MARGIN - 50,
              size: 11, font, color: rgb(0.8, 0.2, 0.2),
            });
          }
        } else {
          // It's an image — embed on A4 page with label
          const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

          // Document label header
          page.drawRectangle({
            x: 0, y: A4_HEIGHT - 45,
            width: A4_WIDTH, height: 45,
            color: rgb(0.96, 0.96, 0.96),
          });
          page.drawText(doc.name, {
            x: MARGIN, y: A4_HEIGHT - 30,
            size: 12, font: fontBold,
            color: rgb(0.2, 0.2, 0.2),
          });

          try {
            // Detect image type and embed
            let image;
            const isJpeg = uint8[0] === 0xFF && uint8[1] === 0xD8;
            const isPng = uint8[0] === 0x89 && uint8[1] === 0x50;

            if (isPng) {
              image = await pdfDoc.embedPng(uint8);
            } else if (isJpeg) {
              image = await pdfDoc.embedJpg(uint8);
            } else {
              // Try JPEG as fallback (our compression outputs JPEG)
              image = await pdfDoc.embedJpg(uint8);
            }

            // Scale to fit within page margins with padding
            const imgPadding = 20;
            const maxImgWidth = CONTENT_WIDTH;
            const maxImgHeight = A4_HEIGHT - MARGIN * 2 - 45 - imgPadding; // account for header

            const imgDims = image.scaleToFit(maxImgWidth, maxImgHeight);

            // Center image horizontally
            const imgX = MARGIN + (maxImgWidth - imgDims.width) / 2;
            const imgY = MARGIN + (maxImgHeight - imgDims.height) / 2;

            page.drawImage(image, {
              x: imgX, y: imgY,
              width: imgDims.width,
              height: imgDims.height,
            });
          } catch (imgErr) {
            console.error(`[Dossier] Error embedding image ${doc.name}:`, imgErr);
            page.drawText('Erro ao processar imagem.', {
              x: MARGIN, y: A4_HEIGHT / 2,
              size: 11, font,
              color: rgb(0.8, 0.2, 0.2),
            });
          }
        }
      } catch (docErr) {
        console.error(`[Dossier] Error processing ${doc.name}:`, docErr);
      }
    }

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();

    // Update admission status to DOWNLOADED
    await supabaseAdmin
      .from('admissions')
      .update({ status: 'DOWNLOADED' })
      .eq('id', id);

    // Send PDF response
    const safeName = candidateName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="dossie_${safeName}.pdf"`);
    res.setHeader('Content-Length', pdfBytes.length.toString());
    return res.send(Buffer.from(pdfBytes));

  } catch (err) {
    console.error('[Dossier] Error:', err);
    return res.status(500).json({ error: "Erro ao gerar dossiê PDF." });
  }
});

// GET /api/cron/admission-cleanup — Cron job para limpeza LGPD 48h
app.get("/api/cron/admission-cleanup", async (req, res) => {
  // Verify cron secret
  const secret = req.headers['authorization']?.replace('Bearer ', '') || req.query.secret;
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const now = new Date().toISOString();

    // 1. Find admissions that expired (submitted_at + 48h < now)
    const { data: expired, error } = await supabaseAdmin
      .from('admissions')
      .select('id, token, user_id, candidate_id')
      .eq('status', 'SUBMITTED')
      .lt('expires_at', now);

    if (error) {
      console.error('[LGPD Cleanup] Query error:', error);
      return res.status(500).json({ error: "Query error" });
    }

    // Also handle DOWNLOADED status past expiry
    const { data: downloadedExpired } = await supabaseAdmin
      .from('admissions')
      .select('id, token, user_id, candidate_id')
      .eq('status', 'DOWNLOADED')
      .lt('expires_at', now);

    const allExpired = [...(expired || []), ...(downloadedExpired || [])];

    let cleaned = 0;

    for (const admission of allExpired) {
      // Delete files from storage
      const { data: files } = await supabaseAdmin.storage
        .from('admission_docs')
        .list(admission.token);

      if (files?.length) {
        const paths = files.map(f => `${admission.token}/${f.name}`);
        await supabaseAdmin.storage
          .from('admission_docs')
          .remove(paths);
      }

      // Mark as expired
      await supabaseAdmin
        .from('admissions')
        .update({ status: 'EXPIRED' })
        .eq('id', admission.id);

      cleaned++;
    }

    // 2. Send warnings for admissions expiring in the next 12h
    const warningThreshold = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const { data: soonExpiring } = await supabaseAdmin
      .from('admissions')
      .select('id, token, user_id, candidate_id, expires_at')
      .in('status', ['SUBMITTED', 'DOWNLOADED'])
      .gt('expires_at', now)
      .lt('expires_at', warningThreshold)
      .eq('expiry_notified', false);

    let notified = 0;

    for (const admission of soonExpiring || []) {
      // Get recruiter's Evolution instance
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('instancia_evolution, phone')
        .eq('id', admission.user_id)
        .single();

      if (profile?.instancia_evolution && profile?.phone) {
        const { data: candidate } = await supabaseAdmin
          .from('candidates')
          .select('analysis_result')
          .eq('id', admission.candidate_id)
          .single();

        let candidateName = 'Candidato';
        if (candidate?.analysis_result) {
          try {
            const parsed = typeof candidate.analysis_result === 'string'
              ? JSON.parse(candidate.analysis_result)
              : candidate.analysis_result;
            candidateName = parsed?.candidateName || 'Candidato';
          } catch {}
        }

        const expiresAt = new Date(admission.expires_at);
        const hoursLeft = Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));

        const message = `⚠️ *Aviso LGPD - Documentos Expirando*\n\n` +
          `Os documentos de admissão de *${candidateName}* serão deletados automaticamente em *${hoursLeft} hora${hoursLeft !== 1 ? 's' : ''}*.\n\n` +
          `📥 Baixe o dossiê PDF antes do prazo no painel Elevva.`;

        const phone = profile.phone.replace(/\D/g, '');
        const jid = `${phone}@s.whatsapp.net`;
        await sendText(profile.instancia_evolution, jid, message);

        // Mark as notified
        await supabaseAdmin
          .from('admissions')
          .update({ expiry_notified: true })
          .eq('id', admission.id);

        notified++;
      }
    }

    return res.json({
      ok: true,
      cleaned,
      notified,
      total_expired: allExpired.length,
      total_warning: soonExpiring?.length || 0,
    });
  } catch (err) {
    console.error('[LGPD Cleanup] Error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Serve the admission portal SPA page
app.get("/admissao/:token", async (req, res) => {
  // Return a simple HTML page that loads the React app
  // The React app will handle the token-based routing
  if (process.env.NODE_ENV === 'production') {
    // In production, serve the SPA
    res.sendFile('index.html', { root: 'dist' });
  } else {
    // In dev, let Vite handle it
    res.redirect(`/?admissao=${req.params.token}`);
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
