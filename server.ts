import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { analyzeResume } from "./src/services/openaiService.js";
import { processIncomingMessage, triggerSchedulingForCandidates } from "./src/services/agentService.js";
import { cleanPhone, sendText } from "./src/services/evolutionService.js";
import { renderSchedulingPage, SchedulingPageData } from "./src/services/schedulingPage.js";
import crypto from "crypto";

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
      const docMsg = (message.documentMessage ?? message.documentWithCaptionMessage) as Record<string, unknown> | undefined;
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
      supabase,
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

    if (!slot_id) return res.status(400).json({ ok: false, error: 'slot_id obrigatorio' });

    // Find interview
    const { data: interview } = await supabase
      .from('interviews')
      .select('id, job_id, candidate_id, status, scheduling_token')
      .eq('scheduling_token', token)
      .single();

    if (!interview) return res.status(404).json({ ok: false, error: 'Link invalido' });

    // Book the slot (optimistic concurrency)
    const { data: booked, error: bookErr } = await supabase
      .from('interview_slots')
      .update({ is_booked: true })
      .eq('id', slot_id)
      .eq('is_booked', false)
      .select()
      .maybeSingle();

    if (bookErr || !booked) {
      return res.status(409).json({ ok: false, error: 'Horario ja foi preenchido. Escolha outro.' });
    }

    // Update interview (columns: slot_id, slot_date, slot_time, status)
    const { error: interviewErr } = await supabaseAdmin.from('interviews').update({
      slot_id,
      slot_date: booked.slot_date,
      slot_time: booked.slot_time,
      status: 'ENTREVISTA_CONFIRMADA',
    }).eq('id', interview.id);

    if (interviewErr) {
      console.error('[Book Slot] Failed to update interview:', interviewErr);
      return res.status(500).json({ ok: false, error: 'Erro ao atualizar entrevista' });
    }

    // Update agent_conversation state + send WhatsApp confirmation
    const { data: candidate } = await supabase.from('candidates').select('"WhatsApp com DDD", "Nome Completo"').eq('id', interview.candidate_id).single();
    const phone = (candidate as Record<string, string>)?.['WhatsApp com DDD'];
    if (phone) {
      await supabase.from('agent_conversations').update({
        state: 'ENTREVISTA_CONFIRMADA',
        updated_at: new Date().toISOString(),
      }).eq('phone', phone);

      // Send WhatsApp confirmation message
      const { data: profile } = await supabase
        .from('profiles')
        .select('instancia_evolution')
        .eq('id', (await supabase.from('jobs').select('user_id').eq('id', interview.job_id).single()).data?.user_id)
        .single();

      const instance = profile?.instancia_evolution;
      if (instance) {
        const [year, month, day] = booked.slot_date.split('-').map(Number);
        const dateLabel = new Date(year, month - 1, day).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
        const timeLabel = booked.slot_time.substring(0, 5);
        const interviewer = booked.interviewer_name ? `\n👤 *Entrevistador:* ${booked.interviewer_name}` : '';
        const location = booked.location ? `\n📍 *Local/Link:* ${booked.location}` : '';
        const firstName = ((candidate as Record<string, string>)?.['Nome Completo'] || '').split(' ')[0] || 'Candidato';

        await sendText(
          instance,
          phone,
          `✅ *Entrevista Confirmada!*\n\nOlá, *${firstName}*! Seu horário foi reservado com sucesso.\n\n📅 *Data:* ${dateLabel}\n⏰ *Horário:* ${timeLabel}${interviewer}${location}\n\nQualquer dúvida, entre em contato. Boa sorte! 🍀`,
        );
      }
    }

    return res.json({ ok: true, slot: booked });
  } catch (err) {
    console.error('[Book Slot] Error:', err);
    return res.status(500).json({ ok: false, error: 'Erro interno' });
  }
});

app.post("/api/agendar/:token/reschedule", async (req, res) => {
  try {
    const { token } = req.params;
    const { slot_id } = req.body as { slot_id: string };

    if (!slot_id) return res.status(400).json({ ok: false, error: 'slot_id obrigatorio' });

    // Find interview
    const { data: interview } = await supabase
      .from('interviews')
      .select('id, job_id, candidate_id, slot_id, scheduling_token')
      .eq('scheduling_token', token)
      .single();

    if (!interview) return res.status(404).json({ ok: false, error: 'Link invalido' });

    // Free the old slot
    if (interview.slot_id) {
      await supabase.from('interview_slots').update({ is_booked: false }).eq('id', interview.slot_id);
    }

    // Book new slot
    const { data: booked, error: bookErr } = await supabase
      .from('interview_slots')
      .update({ is_booked: true })
      .eq('id', slot_id)
      .eq('is_booked', false)
      .select()
      .maybeSingle();

    if (bookErr || !booked) {
      // Re-book old slot if new one failed
      if (interview.slot_id) {
        await supabase.from('interview_slots').update({ is_booked: true }).eq('id', interview.slot_id);
      }
      return res.status(409).json({ ok: false, error: 'Horario ja foi preenchido. Escolha outro.' });
    }

    // Update interview with new slot
    await supabase.from('interviews').update({
      slot_id,
      scheduled_date: booked.slot_date,
      scheduled_time: booked.slot_time,
      status: 'REMARCADA',
    }).eq('id', interview.id);

    return res.json({ ok: true });
  } catch (err) {
    console.error('[Reschedule] Error:', err);
    return res.status(500).json({ ok: false, error: 'Erro interno' });
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
