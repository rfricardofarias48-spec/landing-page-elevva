import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { analyzeResume } from "./src/services/openaiService.js";
import { processIncomingMessage, triggerSchedulingForCandidates, notifyPendingReschedules } from "./src/services/agentService.js";
import { processSdrMessage, runSdrFollowUps, runSdrDemoReminders } from "./src/services/sdrAgentService.js";
import { cleanPhone, sendText, configureWebhookBase64 } from "./src/services/evolutionService.js";
import { mirrorMessage, configureChatwootOnEvolution } from "./src/services/chatwootService.js";
import { createMeetingEvent, deleteCalendarEvent } from "./src/services/googleCalendarService.js";
import { renderSchedulingPage, SchedulingPageData } from "./src/services/schedulingPage.js";
import { renderSdrSchedulingPage, SdrSchedulingPageData } from "./src/services/sdrSchedulingPage.js";
import { validateWalletId, generatePaymentLink, validateWebhookToken, PLAN_PRICES, syncPaymentStatus, getSubaccountInfo, listPayments, getPaymentsByExternalReference } from "./src/services/asaasService.js";
import { provisionClient } from "./src/services/onboardingService.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

dotenv.config();

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

const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '' });

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
    const finalName = nome_candidato ? normalizeName(nome_candidato) : "Candidato via WhatsApp";
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
    const aiName = analysisResult.candidateName && analysisResult.candidateName !== "Não identificado" && isValidName(analysisResult.candidateName)
      ? analysisResult.candidateName
      : null;
    const baseName = aiName || candidateData["Nome Completo"];
    const newName = isValidName(baseName) ? normalizeName(baseName) : baseName;

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
// ADMIN: Configurar webhook_base64 na instância Evolution GO
// Chamado pelo Admin ao salvar configurações do agente
// ─────────────────────────────────────────────────────────────────────
app.post("/api/admin/configure-evolution-webhook", async (req, res) => {
  try {
    const { instance, token } = req.body as { instance: string; token: string };
    if (!instance || !token) {
      return res.status(400).json({ error: "instance e token são obrigatórios" });
    }
    const webhookUrl = `${process.env.BASE_URL || 'https://app.elevva.net.br'}/api/webhooks/agent/whatsapp`;
    const ok = await configureWebhookBase64(instance, webhookUrl, token);
    return res.json({ success: ok, webhookUrl });
  } catch (err) {
    console.error("[Admin] configure-evolution-webhook error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

// ─────────────────────────────────────────────────────────────────────
// ADMIN: Configura integração Chatwoot na instância Evolution GO
// POST /api/admin/configure-chatwoot
// Body: { instance, evolutionToken, chatwootAccountId, chatwootToken, chatwootInboxId }
// ─────────────────────────────────────────────────────────────────────
app.post("/api/admin/configure-chatwoot", async (req, res) => {
  try {
    const { instance, evolutionToken, chatwootAccountId, chatwootToken, chatwootInboxId } =
      req.body as {
        instance: string;
        evolutionToken: string;
        chatwootAccountId: number;
        chatwootToken: string;
        chatwootInboxId: number;
      };

    if (!instance || !evolutionToken || !chatwootAccountId || !chatwootToken || !chatwootInboxId) {
      return res.status(400).json({ error: "Todos os campos são obrigatórios" });
    }

    const ok = await configureChatwootOnEvolution(
      instance,
      evolutionToken,
      chatwootAccountId,
      chatwootToken,
      chatwootInboxId,
    );
    return res.json({ ok });
  } catch (err) {
    console.error("[Admin] configure-chatwoot error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

// ─────────────────────────────────────────────────────────────────────
// ADMIN: Deletar usuário (profiles + Supabase Auth)
// DELETE /api/admin/delete-user/:id
// ─────────────────────────────────────────────────────────────────────
app.delete("/api/admin/delete-user/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "id obrigatório" });

    // 1. Busca vagas do usuário para deletar candidatos relacionados
    const { data: jobs } = await supabaseAdmin.from('jobs').select('id').eq('user_id', id);
    const jobIds = (jobs || []).map((j: { id: string }) => j.id);

    if (jobIds.length > 0) {
      await supabaseAdmin.from('candidates').delete().in('job_id', jobIds);
      await supabaseAdmin.from('interview_slots').delete().in('job_id', jobIds);
      await supabaseAdmin.from('interviews').delete().in('job_id', jobIds);
      await supabaseAdmin.from('admissions').delete().in('job_id', jobIds);
      await supabaseAdmin.from('jobs').delete().in('id', jobIds);
    }

    // 2. Deleta dados diretos do usuário
    await supabaseAdmin.from('agent_conversations').delete().eq('user_id', id);
    await supabaseAdmin.from('announcements').delete().eq('user_id', id);
    await supabaseAdmin.from('profiles').delete().eq('id', id);

    // 3. Deleta do Auth
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) {
      console.error(`[Admin] delete-user auth error: ${error.message}`);
      return res.status(500).json({ error: error.message });
    }

    console.log(`[Admin] User deleted: ${id}`);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[Admin] delete-user error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

// ─────────────────────────────────────────────────────────────────────
// CHATWOOT: Webhook de eventos (mensagens humanas → WhatsApp)
// Configure este URL no Chatwoot: Settings → Integrations → Webhooks
// POST /api/webhooks/chatwoot
// ─────────────────────────────────────────────────────────────────────
app.post("/api/webhooks/chatwoot", async (req, res) => {
  // Verificar segredo do webhook
  const secret = process.env.CHATWOOT_WEBHOOK_SECRET;
  if (secret) {
    const incoming = req.headers['x-chatwoot-signature'] as string | undefined;
    if (incoming !== secret) {
      console.warn('[Chatwoot Webhook] Segredo inválido — requisição rejeitada');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const payload = req.body as {
      event?: string;
      message_type?: string;
      content?: string;
      sender?: { type?: string; name?: string };
      conversation?: {
        id?: number;
        status?: string;
        inbox_id?: number;
        meta?: { sender?: { phone_number?: string } };
        account_id?: number;
      };
    };

    const { event, message_type, content, sender, conversation } = payload;

    console.log(`[Chatwoot Webhook] event=${event}, message_type=${message_type}, sender_type=${sender?.type}`);

    // ── Detectar quando humano assume (conversation_status_changed ou message de agente) ──
    const isHumanMessage =
      event === 'message_created' &&
      message_type === 'outgoing' &&
      sender?.type === 'user'; // 'user' = human agent, 'agent_bot' = bot

    const isConversationResolved =
      event === 'conversation_status_changed' &&
      conversation?.status === 'resolved';

    const accountId = conversation?.account_id;
    const conversationId = conversation?.id;
    const phone = conversation?.meta?.sender?.phone_number?.replace(/^\+/, '');

    if (!phone && !isConversationResolved) {
      return res.json({ ok: true, skipped: 'no phone' });
    }

    // Busca o perfil do recrutador pelo inbox_id + account_id
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, instancia_evolution, evolution_token, chatwoot_account_id')
      .eq('chatwoot_account_id', accountId)
      .maybeSingle();

    if (!profile) {
      console.warn(`[Chatwoot Webhook] No profile found for account_id=${accountId}`);
      return res.json({ ok: true, skipped: 'no profile' });
    }

    // ── Humano assumiu: ativa flag e envia para WhatsApp ──
    if (isHumanMessage && content && phone) {
      // Marca human_takeover na conversa do agente
      await supabaseAdmin
        .from('agent_conversations')
        .update({ human_takeover: true, updated_at: new Date().toISOString() })
        .eq('phone', phone)
        .eq('user_id', profile.id);

      console.log(`[Chatwoot Webhook] Human takeover ON for phone=${phone}`);

      // Envia a resposta humana para o candidato via WhatsApp
      if (profile.instancia_evolution) {
        await sendText(
          profile.instancia_evolution,
          phone,
          content,
          profile.evolution_token || undefined,
        );
        console.log(`[Chatwoot Webhook] Human reply sent to WhatsApp: ${phone}`);
      }
    }

    // ── Conversa resolvida: desativa flag, Bento volta a responder ──
    if (isConversationResolved && phone) {
      await supabaseAdmin
        .from('agent_conversations')
        .update({ human_takeover: false, updated_at: new Date().toISOString() })
        .eq('phone', phone)
        .eq('user_id', profile.id);

      console.log(`[Chatwoot Webhook] Human takeover OFF (resolved) for phone=${phone}`);
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("[Chatwoot Webhook] Error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

// ─────────────────────────────────────────────────────────────────────
// AGENT: Evolution API webhook  (replaces n8n)
// Configure este URL no painel da Evolution API como webhook de entrada
// POST https://seu-dominio.com/api/webhooks/agent/whatsapp
// ─────────────────────────────────────────────────────────────────────
app.post("/api/webhooks/agent/whatsapp", async (req, res) => {
  // ARQUITETURA: processar PRIMEIRO, responder DEPOIS.
  // Vercel encerra o Lambda imediatamente após res.json(), mesmo com await.
  // Processar antes garante que toda a lógica roda dentro do contexto ativo.
  // O Evolution GO (Go-http-client) aguarda até ~30s pela resposta.
  try {
    const payload = req.body as Record<string, unknown>;

    const eventName     = String(payload.event || "").toLowerCase().replace(/_/g, ".");
    const instance      = String(payload.instanceName || payload.instance || "");
    const instanceToken = String(payload.instanceToken || "");
    const data          = payload.data as Record<string, unknown> | undefined;

    console.log(`[Webhook] Received event="${eventName}" instance="${instance}" hasData=${!!data}`);

    // Aceita "message" (Evolution GO) e "messages.upsert" (Evolution API v2)
    const isMessageEvent = eventName === "message" || eventName.includes("messages.upsert");
    if (!isMessageEvent || !data) {
      res.status(200).json({ received: true });
      return;
    }

    // ── Normaliza payload: Evolution GO usa data.Info / data.Message (capitals)
    const isEvolutionGO = !!(data.Info);

    let remoteJid: string;
    let fromMe: boolean;
    let pushName: string;
    let messageType: string;
    let message: Record<string, unknown>;
    let msgKey: Record<string, unknown>;

    if (isEvolutionGO) {
      const info = data.Info as Record<string, unknown>;
      remoteJid   = String(info.Chat || "");
      fromMe      = info.IsFromMe === true;
      pushName    = String(info.PushName || "");
      const msg   = (data.Message as Record<string, unknown>) || {};
      msgKey      = { remoteJid, fromMe, id: info.ID };

      if (data.IsDocumentWithCaption || msg.documentMessage) {
        messageType = "documentMessage";
        message     = msg;
      } else if (msg.extendedTextMessage) {
        messageType = "extendedTextMessage";
        message     = msg;
      } else if (msg.conversation !== undefined) {
        messageType = "conversation";
        message     = msg;
      } else {
        messageType = "unknown";
        message     = msg;
      }
    } else {
      const key = data.key as Record<string, unknown> | undefined;
      remoteJid   = String(key?.remoteJid || "");
      fromMe      = key?.fromMe === true;
      pushName    = String(data.pushName || "");
      messageType = String(data.messageType || "");
      message     = (data.message as Record<string, unknown>) || {};
      msgKey      = key || {};
    }

    if (!remoteJid || fromMe || remoteJid.endsWith("@g.us")) {
      console.log(`[Webhook] Skipped: remoteJid="${remoteJid}" fromMe=${fromMe}`);
      res.status(200).json({ received: true });
      return;
    }

    const phone = cleanPhone(remoteJid);

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

    let selectedRowId: string | null = null;
    if (messageType === "listResponseMessage") {
      const lr  = message.listResponseMessage as Record<string, unknown> | undefined;
      const ssr = lr?.singleSelectReply as Record<string, unknown> | undefined;
      selectedRowId = ssr?.selectedRowId ? String(ssr.selectedRowId) : null;
    }

    let mediaData: {
      key: Record<string, unknown>;
      message: Record<string, unknown>;
      embeddedBase64?: string;
      embeddedMimetype?: string;
    } | null = null;

    if (["documentMessage", "documentWithCaptionMessage"].includes(messageType)) {
      let docMsg = message.documentMessage as Record<string, unknown> | undefined;
      if (!docMsg && (message.DocumentMessage || message.Document)) {
        docMsg = (message.DocumentMessage || message.Document) as Record<string, unknown>;
      }
      if (!docMsg && message.documentWithCaptionMessage) {
        const wrapper = message.documentWithCaptionMessage as Record<string, unknown>;
        const innerMsg = wrapper.message as Record<string, unknown> | undefined;
        docMsg = (innerMsg?.documentMessage as Record<string, unknown> | undefined) ?? wrapper;
      }

      // Log para debug: ver quais campos o Evolution GO envia no documento
      if (docMsg) {
        const docKeys = Object.keys(docMsg);
        console.log(`[Webhook] Document fields: ${docKeys.join(', ')}, hasBase64: ${!!docMsg.base64}, size: ${docMsg.base64 ? String(docMsg.base64).length : 0}`);
      } else {
        console.log(`[Webhook] No docMsg found. Message keys: ${Object.keys(message).join(', ')}`);
      }

      mediaData = {
        key: msgKey,
        message,
        embeddedBase64: docMsg?.base64 ? String(docMsg.base64) : undefined,
        embeddedMimetype: docMsg?.mimetype ? String(docMsg.mimetype) : 'application/pdf',
      };
    }

    console.log(`[Webhook] Processing instance="${instance}" phone="${phone}" type="${messageType}" go=${isEvolutionGO} token=${instanceToken ? 'yes' : 'no'}`);

    await processIncomingMessage(
      instance,
      phone,
      pushName,
      messageType,
      textContent,
      mediaData,
      selectedRowId,
      supabaseAdmin,
      instanceToken || undefined,
    );

    console.log(`[Webhook] Done instance="${instance}" phone="${phone}"`);
    res.status(200).json({ received: true });

  } catch (err) {
    console.error("[Agent Webhook] Error:", err);
    res.status(200).json({ received: true });
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
// Notifica candidatos com reagendamento pendente quando novos slots são adicionados
// POST /api/agent/notify-pending-reschedules
// Body: { user_id: string, job_id: string }
// ─────────────────────────────────────────────────────────────────────
app.post("/api/agent/notify-pending-reschedules", async (req, res) => {
  try {
    const { user_id, job_id } = req.body as { user_id: string; job_id: string };

    if (!user_id || !job_id) {
      return res.status(400).json({ error: "Campos obrigatórios: user_id, job_id" });
    }

    const result = await notifyPendingReschedules(user_id, job_id, supabaseAdmin);

    return res.status(200).json({
      ok: true,
      message: `${result.sent} candidato(s) notificado(s).`,
      ...result,
    });
  } catch (err: unknown) {
    console.error("[Notify Pending Reschedules] Error:", err);
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

// Fast analysis endpoint — server downloads PDF from Storage directly (no base64 round-trip)
app.post("/api/analyze-fast", async (req, res) => {
  try {
    const { file_path, job_title, criteria } = req.body as {
      file_path: string;
      job_title: string;
      criteria: string;
    };

    if (!file_path || !job_title) {
      return res.status(400).json({ error: "Campos obrigatórios: file_path, job_title" });
    }

    // Download PDF directly from Supabase Storage (server-side, fast)
    const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
      .from('curriculos')
      .download(file_path);

    if (downloadError || !fileBlob) {
      console.error("[Analyze Fast] Download error:", downloadError);
      return res.status(404).json({ error: "Arquivo não encontrado no storage." });
    }

    // Convert blob to base64
    const arrayBuffer = await fileBlob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    const result = await analyzeResume(base64, job_title, criteria || '');
    return res.status(200).json(result);
  } catch (err: unknown) {
    console.error("[Analyze Fast] Error:", err);
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
      // Buscar calendarId do recrutador para deletar no calendário correto
      const { data: jobForDelete } = await supabaseAdmin.from('jobs').select('user_id').eq('id', interview.job_id).maybeSingle();
      let rescheduleCalendarId: string | undefined;
      if (jobForDelete?.user_id) {
        const { data: profForDelete } = await supabaseAdmin.from('profiles').select('google_calendar_id').eq('id', jobForDelete.user_id).maybeSingle();
        rescheduleCalendarId = profForDelete?.google_calendar_id || undefined;
      }
      const deleted = await deleteCalendarEvent(interview.google_event_id, false, rescheduleCalendarId);
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

    // Get recruiter email and calendar ID
    let recruiterEmail: string | undefined;
    let recruiterCalendarId: string | undefined;
    if (job?.user_id) {
      const { data: recruiterProfile } = await supabaseAdmin
        .from('profiles')
        .select('email, google_calendar_id')
        .eq('id', job.user_id)
        .single();
      recruiterEmail = recruiterProfile?.email || undefined;
      recruiterCalendarId = recruiterProfile?.google_calendar_id || undefined;
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
      calendarId: recruiterCalendarId,
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
          .select('instancia_evolution, evolution_token')
          .eq('id', job.user_id)
          .single();

        console.log('[Book Slot] Profile lookup:', { success: !!profile, error: profErr?.message });
        const instance = profile?.instancia_evolution;
        const evoToken = profile?.evolution_token || undefined;

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
            evoToken,
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

// ── Delete interview silently (Google Calendar deletion, no WhatsApp) ──
app.delete("/api/interviews/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Fetch interview with job info to get calendar_id
    const { data: interview } = await supabaseAdmin
      .from('interviews')
      .select('id, google_event_id, slot_id, job_id, jobs(user_id)')
      .eq('id', id)
      .maybeSingle();

    if (!interview) return res.status(404).json({ ok: false, error: 'Entrevista não encontrada' });

    // Delete from Google Calendar
    if (interview.google_event_id) {
      let calendarId: string | undefined;
      const jobUserId = (interview.jobs as any)?.user_id;
      if (jobUserId) {
        const { data: prof } = await supabaseAdmin.from('profiles').select('google_calendar_id').eq('id', jobUserId).maybeSingle();
        calendarId = prof?.google_calendar_id || undefined;
      }
      const deleted = await deleteCalendarEvent(interview.google_event_id, false, calendarId);
      console.log(`[Delete Interview] Calendar event ${interview.google_event_id}: ${deleted ? 'DELETED' : 'FAILED'}`);
    }

    // Free the slot
    if (interview.slot_id) {
      await supabaseAdmin.from('interview_slots').update({ is_booked: false, booked_by: null }).eq('id', interview.slot_id);
    }

    // Delete the interview record
    await supabaseAdmin.from('interviews').delete().eq('id', id);

    return res.json({ ok: true });
  } catch (err) {
    console.error('[Delete Interview] Error:', err);
    return res.status(500).json({ ok: false, error: 'Erro interno' });
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
    let cancelToken: string | undefined;
    let recruiterCalendarId: string | undefined;
    if (job?.user_id) {
      const { data: profile, error: profErr } = await supabaseAdmin
        .from('profiles')
        .select('instancia_evolution, evolution_token, google_calendar_id')
        .eq('id', job.user_id)
        .single();
      instance = profile?.instancia_evolution || null;
      cancelToken = profile?.evolution_token || undefined;
      recruiterCalendarId = profile?.google_calendar_id || undefined;
      console.log(`[Cancel] Evolution instance:`, instance || 'NOT FOUND', profErr?.message || '');
      console.log(`[Cancel] Recruiter calendar:`, recruiterCalendarId || 'NOT FOUND');
    }

    // 3. Delete from Google Calendar
    if (interview.google_event_id) {
      const deleted = await deleteCalendarEvent(interview.google_event_id, false, recruiterCalendarId);
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
        cancelToken,
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
    // Calculate window: from now to +2h05min
    const now = new Date();
    const windowEnd = new Date(now.getTime() + (2 * 60 + 5) * 60 * 1000);

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
          .select('instancia_evolution, evolution_token')
          .eq('id', job.user_id)
          .single();

        const instance = profile?.instancia_evolution;
        const evoToken = profile?.evolution_token || undefined;
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
          `⏰ *Lembrete de Entrevista*\n\nOlá, *${firstName}*! Sua entrevista é hoje:\n\n📅 *Data:* ${dateLabel}\n⏰ *Horário:* ${timeLabel}${interviewer}${meetLink}\n\nVocê confirma sua presença?\nResponda:\n✅ *SIM* — confirmo presença\n🔄 *REAGENDAR* — preciso de outro horário\n❌ *CANCELAR* — não irei participar`,
          evoToken,
        );

        // Mark as reminded + mudar estado da conversa para aguardar resposta
        await supabaseAdmin.from('interviews').update({ lembrete_enviado: true }).eq('id', interview.id);

        // Buscar conversa do candidato e mudar para AGUARDANDO_CONFIRMACAO_LEMBRETE
        const { data: convData } = await supabaseAdmin.from('agent_conversations')
          .select('id, context')
          .eq('phone', phone)
          .eq('user_id', job.user_id)
          .maybeSingle();

        if (convData) {
          const ctx = (convData.context || {}) as Record<string, unknown>;
          await supabaseAdmin.from('agent_conversations').update({
            state: 'AGUARDANDO_CONFIRMACAO_LEMBRETE',
            context: { ...ctx, reminder_interview_id: interview.id },
            updated_at: new Date().toISOString(),
          }).eq('id', convData.id);
        }

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
      .select('instancia_evolution, evolution_token')
      .eq('id', userId)
      .single();

    const instance = profile?.instancia_evolution;
    const evoToken = profile?.evolution_token || undefined;

    if (instance) {
      const firstName = (candidate_name || 'Candidato').split(' ')[0];
      const docCount = required_docs.length;

      const message = `🎉 *Parabéns, ${firstName}!*\n\n` +
        `Você foi *aprovado(a)* no processo seletivo!\n\n` +
        `Para seguirmos com sua admissão, precisamos de *${docCount} documento${docCount > 1 ? 's' : ''}*.\n\n` +
        `📋 Acesse seu portal seguro para envio:\n${portalUrl}\n\n` +
        `⏰ *Importante:* O link expira em *5 dias* após o envio dos documentos.\n\n` +
        `Caso tenha dúvidas, entre em contato conosco.`;

      // Format phone for WhatsApp JID
      const phone = candidate_phone.replace(/\D/g, '');
      const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

      await sendText(instance, jid, message, evoToken);
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
    const expiresAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 dias

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

    // Extract candidate name — handle both object and array from Supabase join
    let candidateName = admission.candidate_name || 'Candidato';
    const candidateData = Array.isArray(admission.candidates) ? admission.candidates[0] : admission.candidates;
    if (candidateData?.analysis_result) {
      try {
        const parsed = typeof candidateData.analysis_result === 'string'
          ? JSON.parse(candidateData.analysis_result)
          : candidateData.analysis_result;
        if (parsed?.candidateName) candidateName = parsed.candidateName;
      } catch {}
    }

    const jobData = Array.isArray(admission.jobs) ? admission.jobs[0] : admission.jobs;
    const jobTitle = jobData?.title || admission.job_title || 'Vaga';
    const whatsapp = candidateData?.['WhatsApp com DDD'] || admission.candidate_phone || 'N/A';

    // Sanitize text for pdf-lib StandardFonts (Latin-1 only — strip unsupported chars)
    const sanitize = (text: any): string => {
      const str = String(text ?? '');
      // Replace common problematic chars and strip anything outside printable Latin-1
      return str
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\u2014/g, '-')
        .replace(/\u2013/g, '-')
        .replace(/\u2026/g, '...')
        .replace(/[^\x20-\xFF]/g, '');
    };

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const A4_WIDTH = 595.28;
    const A4_HEIGHT = 841.89;
    const MARGIN = 56;
    const CONTENT_WIDTH = A4_WIDTH - MARGIN * 2;

    // Minimal palette
    const C = {
      black: rgb(0.10, 0.10, 0.10),
      dark: rgb(0.22, 0.22, 0.22),
      text: rgb(0.30, 0.30, 0.30),
      label: rgb(0.52, 0.52, 0.52),
      muted: rgb(0.68, 0.68, 0.68),
      line: rgb(0.90, 0.90, 0.90),
      bg: rgb(0.965, 0.965, 0.965),
      white: rgb(1, 1, 1),
      accent: rgb(0.396, 0.639, 0.051), // #65a30d
    };

    // Separate text docs from file docs
    const textDocs = admission.submitted_docs.filter((d: any) => d.value && !d.file_path);
    const fileDocs = admission.submitted_docs.filter((d: any) => d.file_path);

    // Helper: draw page header on every page
    const drawPageHeader = (page: any) => {
      // Thin top line accent
      page.drawRectangle({ x: 0, y: A4_HEIGHT - 2.5, width: A4_WIDTH, height: 2.5, color: C.black });
      // Brand + doc type inline
      page.drawText('elevva', { x: MARGIN, y: A4_HEIGHT - 28, size: 9, font: fontBold, color: C.accent });
      page.drawText('|', { x: MARGIN + 38, y: A4_HEIGHT - 28, size: 9, font, color: C.line });
      page.drawText('Documentos de Admissao', { x: MARGIN + 48, y: A4_HEIGHT - 28, size: 9, font, color: C.muted });
      // Header separator
      page.drawLine({ start: { x: MARGIN, y: A4_HEIGHT - 38 }, end: { x: A4_WIDTH - MARGIN, y: A4_HEIGHT - 38 }, thickness: 0.5, color: C.line });
    };

    // Helper: draw page footer
    const drawPageFooter = (page: any, pageNum: number, totalHint?: string) => {
      page.drawLine({ start: { x: MARGIN, y: 38 }, end: { x: A4_WIDTH - MARGIN, y: 38 }, thickness: 0.5, color: C.line });
      page.drawText('LGPD — Dados pessoais. Originais deletados automaticamente apos 5 dias.', { x: MARGIN, y: 24, size: 6.5, font, color: C.muted });
      const pageStr = totalHint ? `${pageNum} / ${totalHint}` : `${pageNum}`;
      const pageWidth = font.widthOfTextAtSize(pageStr, 7);
      page.drawText(pageStr, { x: A4_WIDTH - MARGIN - pageWidth, y: 24, size: 7, font, color: C.muted });
    };

    // =============================================
    // PAGE 1 — Main data page
    // =============================================
    const page1 = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    drawPageHeader(page1);

    let y = A4_HEIGHT - 62;

    // Title
    page1.drawText('Documentos de Admissao', { x: MARGIN, y, size: 20, font: fontBold, color: C.black });
    y -= 14;

    // Subtitle with candidate name
    page1.drawText(sanitize(candidateName), { x: MARGIN, y, size: 11, font, color: C.label });
    y -= 30;

    // Info card — light background box
    const infoBoxH = 70;
    page1.drawRectangle({ x: MARGIN, y: y - infoBoxH + 16, width: CONTENT_WIDTH, height: infoBoxH, color: C.bg, borderColor: C.line, borderWidth: 0.5 });

    const infoY = y;
    const col1 = MARGIN + 16;
    const col2 = MARGIN + CONTENT_WIDTH / 2;

    const drawInfoField = (x: number, yy: number, label: string, value: string) => {
      page1.drawText(label, { x, y: yy, size: 7, font: fontBold, color: C.muted });
      page1.drawText(sanitize(value || '—'), { x, y: yy - 13, size: 9.5, font, color: C.dark });
    };

    drawInfoField(col1, infoY, 'CANDIDATO', sanitize(candidateName));
    drawInfoField(col2, infoY, 'VAGA', sanitize(jobTitle));
    drawInfoField(col1, infoY - 32, 'WHATSAPP', whatsapp);
    drawInfoField(col2, infoY - 32, 'ENVIADO EM', admission.submitted_at
      ? new Date(admission.submitted_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'N/A');

    y -= (infoBoxH + 12);

    // ---- Text fields as clean label:value rows ----
    let currentPage = page1;
    let pageCount = 1;

    const ensureSpace = (needed: number) => {
      if (y < 60 + needed) {
        drawPageFooter(currentPage, pageCount);
        pageCount++;
        currentPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
        drawPageHeader(currentPage);
        y = A4_HEIGHT - 58;
      }
    };

    if (textDocs.length > 0) {
      y -= 10;
      // Section divider with label
      currentPage.drawLine({ start: { x: MARGIN, y }, end: { x: A4_WIDTH - MARGIN, y }, thickness: 0.5, color: C.line });
      y -= 20;
      currentPage.drawText('DADOS PESSOAIS', { x: MARGIN, y, size: 8, font: fontBold, color: C.label });
      y -= 6;

      for (let i = 0; i < textDocs.length; i++) {
        const doc = textDocs[i];
        ensureSpace(36);
        y -= 28;

        // Label
        currentPage.drawText(sanitize(doc.name), { x: MARGIN, y: y + 12, size: 7.5, font: fontBold, color: C.muted });

        // Value with underline
        currentPage.drawText(sanitize(doc.value || '—'), { x: MARGIN, y: y - 4, size: 10.5, font, color: C.black });

        // Subtle underline
        y -= 10;
        currentPage.drawLine({ start: { x: MARGIN, y }, end: { x: A4_WIDTH - MARGIN, y }, thickness: 0.3, color: C.line });
      }
    }

    // ---- Attachments index ----
    if (fileDocs.length > 0) {
      ensureSpace(50);
      y -= 28;
      currentPage.drawLine({ start: { x: MARGIN, y: y + 8 }, end: { x: A4_WIDTH - MARGIN, y: y + 8 }, thickness: 0.5, color: C.line });
      currentPage.drawText('ANEXOS', { x: MARGIN, y: y - 10, size: 8, font: fontBold, color: C.label });
      y -= 14;

      for (let i = 0; i < fileDocs.length; i++) {
        ensureSpace(24);
        y -= 18;

        // Bullet
        currentPage.drawRectangle({ x: MARGIN + 2, y: y + 2, width: 4, height: 4, color: C.accent });
        currentPage.drawText(sanitize(fileDocs[i].name), { x: MARGIN + 14, y, size: 9, font, color: C.text });
      }
    }

    // Footer on last data page
    drawPageFooter(currentPage, pageCount);

    // =============================================
    // ATTACHMENT PAGES (only for file uploads)
    // =============================================
    for (const doc of fileDocs) {
      try {
        const { data: fileData, error: downloadError } = await supabaseAdmin.storage
          .from('admission_docs')
          .download(doc.file_path);

        if (downloadError || !fileData) {
          console.error(`[Dossier] Failed to download ${doc.file_path}:`, downloadError);
          pageCount++;
          const errPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
          drawPageHeader(errPage);
          errPage.drawText(sanitize(doc.name), { x: MARGIN, y: A4_HEIGHT - 65, size: 12, font: fontBold, color: C.black });
          errPage.drawText('Arquivo nao encontrado.', { x: MARGIN, y: A4_HEIGHT - 82, size: 10, font, color: rgb(0.7, 0.2, 0.2) });
          drawPageFooter(errPage, pageCount);
          continue;
        }

        const arrayBuffer = await fileData.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);

        const isPdf = doc.file_path.toLowerCase().endsWith('.pdf') ||
          (uint8[0] === 0x25 && uint8[1] === 0x50 && uint8[2] === 0x44 && uint8[3] === 0x46);

        if (isPdf) {
          try {
            const embeddedPdf = await PDFDocument.load(uint8);
            const pageIndices = embeddedPdf.getPageIndices();
            const copiedPages = await pdfDoc.copyPages(embeddedPdf, pageIndices);
            copiedPages.forEach(p => { pageCount++; pdfDoc.addPage(p); });
          } catch (pdfErr) {
            console.error(`[Dossier] Error embedding PDF ${doc.name}:`, pdfErr);
            pageCount++;
            const errPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
            drawPageHeader(errPage);
            errPage.drawText(sanitize(`${doc.name} — PDF corrompido ou protegido.`), { x: MARGIN, y: A4_HEIGHT - 65, size: 10, font, color: rgb(0.7, 0.2, 0.2) });
            drawPageFooter(errPage, pageCount);
          }
        } else {
          // Image attachment
          pageCount++;
          const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
          drawPageHeader(page);

          // Document label below header
          page.drawText(sanitize(doc.name), { x: MARGIN, y: A4_HEIGHT - 58, size: 11, font: fontBold, color: C.dark });

          try {
            let image;
            const isJpeg = uint8[0] === 0xFF && uint8[1] === 0xD8;
            const isPng = uint8[0] === 0x89 && uint8[1] === 0x50;

            if (isPng) image = await pdfDoc.embedPng(uint8);
            else if (isJpeg) image = await pdfDoc.embedJpg(uint8);
            else image = await pdfDoc.embedJpg(uint8);

            const maxImgWidth = CONTENT_WIDTH;
            const maxImgHeight = A4_HEIGHT - 120; // header + footer space
            const imgDims = image.scaleToFit(maxImgWidth, maxImgHeight);
            const imgX = MARGIN + (maxImgWidth - imgDims.width) / 2;
            const imgY = 50 + (maxImgHeight - imgDims.height) / 2;

            page.drawImage(image, { x: imgX, y: imgY, width: imgDims.width, height: imgDims.height });
          } catch (imgErr) {
            console.error(`[Dossier] Error embedding image ${doc.name}:`, imgErr);
            page.drawText('Erro ao processar imagem.', { x: MARGIN, y: A4_HEIGHT / 2, size: 10, font, color: rgb(0.7, 0.2, 0.2) });
          }

          drawPageFooter(page, pageCount);
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
    res.setHeader('Content-Disposition', `attachment; filename="admissao_${safeName}.pdf"`);
    res.setHeader('Content-Length', pdfBytes.length.toString());
    return res.send(Buffer.from(pdfBytes));

  } catch (err: any) {
    console.error('[Dossier] Error:', err?.message || err, err?.stack);
    return res.status(500).json({ error: "Erro ao gerar dossiê PDF." });
  }
});

// GET /api/cron/admission-cleanup — Cron job para limpeza LGPD 5 dias
app.get("/api/cron/admission-cleanup", async (req, res) => {
  // Verify cron secret
  const secret = req.headers['authorization']?.replace('Bearer ', '') || req.query.secret;
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const now = new Date().toISOString();

    // 1. Find admissions that expired (submitted_at + 5 dias < now)
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
        .select('instancia_evolution, evolution_token, phone')
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
        await sendText(profile.instancia_evolution, jid, message, profile.evolution_token || undefined);

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

// ═══════════════════════════════════════════════════════════════════════
// SDR AGENT — Endpoints
// ═══════════════════════════════════════════════════════════════════════

// SDR Webhook — Evolution API webhook for SDR chip
// Configure this URL in Evolution API panel for the SDR instance
// POST https://seu-dominio.com/api/webhooks/sdr/whatsapp
// PAUSADO — aguardando novo número de WhatsApp para o SDR
const SDR_PAUSED = true;

app.post("/api/webhooks/sdr/whatsapp", async (req, res) => {
  if (SDR_PAUSED) {
    console.log("[SDR Webhook] Agente SDR pausado — mensagem ignorada");
    return res.status(200).json({ received: true, paused: true });
  }
  try {
    const payload = req.body as Record<string, unknown>;
    console.log("[SDR Webhook] RAW payload:", JSON.stringify(payload).substring(0, 2000));
    const eventRaw = String(payload.event || "");

    // Evolution GO: event "Message" for incoming messages
    if (eventRaw.toLowerCase() !== "message") {
      console.log(`[SDR Webhook] Ignored event: "${eventRaw}"`);
      return res.status(200).json({ received: true });
    }

    const data = payload.data as Record<string, unknown> | undefined;
    if (!data) { console.log("[SDR Webhook] No data field"); return res.status(200).json({ received: true }); }

    // Evolution GO: Chat, IsFromMe, PushName are inside data.Info
    const info = data.Info as Record<string, unknown> | undefined;

    console.log(`[SDR Webhook] IsFromMe=${info?.IsFromMe}, Chat=${info?.Chat}, PushName=${info?.PushName}`);

    // Ignore messages sent by the bot
    if (info?.IsFromMe === true) { console.log("[SDR Webhook] Skipped: IsFromMe"); return res.status(200).json({ received: true }); }

    // Evolution GO: phone is in data.Info.Chat (format: "5551...@s.whatsapp.net")
    const chatJid = String(info?.Chat || "");
    if (!chatJid || chatJid.endsWith("@g.us")) { console.log("[SDR Webhook] Skipped: no chatJid or group"); return res.status(200).json({ received: true }); }

    const instance = String(payload.instanceName || "");
    const phone = cleanPhone(chatJid);
    const pushName = String(info?.PushName || "");

    // Evolution GO: text is in data.Message.conversation or data.Message.extendedTextMessage.text
    const messageObj = data.Message as Record<string, unknown> | undefined;
    console.log(`[SDR Webhook] Message obj keys: ${messageObj ? Object.keys(messageObj).join(',') : 'null'}`);
    let textContent: string | null = null;
    if (messageObj) {
      if (messageObj.conversation) {
        textContent = String(messageObj.conversation).trim();
      } else if (messageObj.extendedTextMessage) {
        const ext = messageObj.extendedTextMessage as Record<string, unknown>;
        textContent = String(ext.text || "").trim();
      }
    }
    if (!textContent) textContent = null;

    // CTWA referral data (from ad clicks)
    const msgContextInfo = (messageObj?.extendedTextMessage as Record<string, unknown>)?.contextInfo as Record<string, unknown> | undefined;
    const referralData = msgContextInfo?.externalAdReply as Record<string, unknown> | null || null;

    console.log(`[SDR Webhook] PARSED → Instance: ${instance}, Phone: ${phone}, Text: "${textContent}", PushName: ${pushName}`);

    try {
      await processSdrMessage(
        instance,
        phone,
        pushName,
        textContent,
        referralData,
        supabaseAdmin,
      );
      console.log("[SDR Webhook] processSdrMessage completed OK");
    } catch (procErr) {
      console.error("[SDR Webhook] processSdrMessage FAILED:", procErr);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("[SDR Webhook] Error:", err);
    return res.status(200).json({ received: true });
  }
});

// SDR Scheduling Page — serves HTML page for demo slot selection
app.get("/api/sdr/agendar/:token", async (req, res) => {
  try {
    const { token } = req.params;

    // Find conversation by scheduling token
    const { data: conv } = await supabaseAdmin
      .from('sdr_conversations')
      .select('id, phone, lead_id, context')
      .contains('context', { scheduling_token: token })
      .maybeSingle();

    if (!conv) return res.status(404).send('Link inválido ou expirado.');

    const ctx = (conv.context || {}) as Record<string, unknown>;
    const leadName = String(ctx.name || 'Visitante');

    // Get available demo slots (next 30 days)
    const today = new Date().toISOString().split('T')[0];
    const in30d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: slots } = await supabaseAdmin
      .from('sdr_demo_slots')
      .select('id, slot_date, slot_time, duration_minutes, is_booked')
      .gte('slot_date', today)
      .lte('slot_date', in30d)
      .order('slot_date', { ascending: true })
      .order('slot_time', { ascending: true });

    // Check if lead has current booking
    let currentBooking: SdrSchedulingPageData['currentBooking'] = null;
    const currentSlotId = ctx.demo_slot_id as string | undefined;
    if (currentSlotId) {
      const currentSlot = (slots || []).find((s: Record<string, unknown>) => s.id === currentSlotId);
      if (currentSlot) {
        currentBooking = {
          slotId: currentSlot.id,
          date: currentSlot.slot_date,
          time: currentSlot.slot_time.substring(0, 5),
        };
      }
    }

    const pageData: SdrSchedulingPageData = {
      token,
      leadName,
      currentBooking,
      slots: (slots || []).map((s: Record<string, unknown>) => {
        const [year, month, day] = String(s.slot_date).split('-').map(Number);
        return {
          id: String(s.id),
          date: String(s.slot_date),
          time: String(s.slot_time).substring(0, 5),
          dateLabel: new Date(year, month - 1, day).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }),
          timeLabel: String(s.slot_time).substring(0, 5),
          isBooked: Boolean(s.is_booked),
          durationMinutes: Number(s.duration_minutes) || 30,
        };
      }),
    };

    const html = renderSdrSchedulingPage(pageData);
    return res.type('html').send(html);
  } catch (err) {
    console.error('[SDR Scheduling Page] Error:', err);
    return res.status(500).send('Erro ao carregar a página.');
  }
});

// SDR Book Slot — lead picks a demo time
app.post("/api/sdr/agendar/:token/book", async (req, res) => {
  try {
    const { token } = req.params;
    const { slot_id } = req.body as { slot_id: string };

    if (!slot_id) return res.status(400).json({ ok: false, error: 'slot_id obrigatório' });

    // Find conversation
    const { data: conv } = await supabaseAdmin
      .from('sdr_conversations')
      .select('id, phone, lead_id, instance_name, context')
      .contains('context', { scheduling_token: token })
      .maybeSingle();

    if (!conv) return res.status(404).json({ ok: false, error: 'Link inválido' });

    const ctx = (conv.context || {}) as Record<string, unknown>;

    // If reschedule: free old slot and delete old calendar event
    if (ctx.demo_slot_id) {
      await supabaseAdmin.from('sdr_demo_slots')
        .update({ is_booked: false, booked_by: null })
        .eq('id', ctx.demo_slot_id);
    }
    if (ctx.google_event_id) {
      await deleteCalendarEvent(String(ctx.google_event_id));
    }

    // Book the new slot (optimistic concurrency)
    const { data: booked, error: bookErr } = await supabaseAdmin
      .from('sdr_demo_slots')
      .update({ is_booked: true, booked_by: conv.lead_id })
      .eq('id', slot_id)
      .eq('is_booked', false)
      .select()
      .maybeSingle();

    if (bookErr || !booked) {
      return res.status(409).json({ ok: false, error: 'Horário já foi preenchido. Escolha outro.' });
    }

    // Create Google Calendar + Meet event
    const leadName = String(ctx.name || 'Lead');
    let meetLink = '';
    let eventId = '';

    const googleEvent = await createMeetingEvent({
      candidateName: leadName,
      jobTitle: 'Demonstração Elevva',
      slotDate: booked.slot_date,
      slotTime: booked.slot_time,
      candidatePhone: conv.phone,
      recruiterEmail: process.env.SDR_EMAIL,
      calendarId: process.env.SDR_GOOGLE_CALENDAR_ID || process.env.GOOGLE_CALENDAR_ID,
      useSdrCredentials: true,
    });

    if (googleEvent?.meetLink) {
      meetLink = googleEvent.meetLink;
      eventId = googleEvent.eventId;

      // Save meet link to slot
      await supabaseAdmin.from('sdr_demo_slots').update({
        google_event_id: eventId,
        meeting_link: meetLink,
      }).eq('id', slot_id);
    }

    // Update conversation state
    await supabaseAdmin.from('sdr_conversations').update({
      state: 'DEMO_AGENDADA',
      context: {
        ...ctx,
        demo_slot_id: slot_id,
        google_event_id: eventId || null,
        meeting_link: meetLink || null,
      },
      updated_at: new Date().toISOString(),
    }).eq('id', conv.id);

    // Update lead status
    if (conv.lead_id) {
      await supabaseAdmin.from('sdr_leads').update({
        status: 'DEMO_AGENDADA',
        updated_at: new Date().toISOString(),
      }).eq('id', conv.lead_id);
    }

    // Send WhatsApp confirmation
    const [year, month, day] = booked.slot_date.split('-').map(Number);
    const dateLabel = new Date(year, month - 1, day).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    const timeLabel = booked.slot_time.substring(0, 5);
    const firstName = String(ctx.name || 'Visitante').split(' ')[0];
    const meetText = meetLink ? `\n\n📅 Link da reunião:\n${meetLink}` : '';

    await sendText(
      conv.instance_name,
      conv.phone,
      `✅ *Demonstração Confirmada!*\n\n${firstName}, seu horário foi reservado.\n\n📅 *Data:* ${dateLabel}\n⏰ *Horário:* ${timeLabel}\n💻 *Formato:* Online via Google Meet${meetText}\n\nNos vemos lá.`,
    );

    return res.json({ ok: true, slot: booked });
  } catch (err) {
    console.error('[SDR Book Slot] Error:', err);
    return res.status(500).json({ ok: false, error: 'Erro interno' });
  }
});

// SDR Funnel — returns funnel metrics
app.get("/api/sdr/funnel", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('sdr_funnel').select('*').single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  } catch (err) {
    console.error('[SDR Funnel] Error:', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

// SDR Leads — list leads with filters
app.get("/api/sdr/leads", async (req, res) => {
  try {
    const { status, source, limit: limitStr } = req.query;
    let query = supabaseAdmin.from('sdr_leads').select('*').order('created_at', { ascending: false });

    if (status) query = query.eq('status', String(status));
    if (source) query = query.eq('source', String(source));

    const limitNum = parseInt(String(limitStr || '50'), 10);
    query = query.limit(limitNum);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  } catch (err) {
    console.error('[SDR Leads] Error:', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

// SDR Demo Slots — CRUD for demo availability
app.get("/api/sdr/slots", async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabaseAdmin
      .from('sdr_demo_slots')
      .select('*')
      .gte('slot_date', today)
      .order('slot_date', { ascending: true })
      .order('slot_time', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno' });
  }
});

app.post("/api/sdr/slots", async (req, res) => {
  try {
    const { slots } = req.body as { slots: Array<{ slot_date: string; slot_time: string; duration_minutes?: number }> };

    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ error: 'Envie um array de slots com slot_date e slot_time' });
    }

    const toInsert = slots.map(s => ({
      slot_date: s.slot_date,
      slot_time: s.slot_time,
      duration_minutes: s.duration_minutes || 30,
    }));

    const { data, error } = await supabaseAdmin
      .from('sdr_demo_slots')
      .upsert(toInsert, { onConflict: 'slot_date,slot_time' })
      .select();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, created: data?.length || 0 });
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno' });
  }
});

app.delete("/api/sdr/slots/:id", async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('sdr_demo_slots')
      .delete()
      .eq('id', req.params.id)
      .eq('is_booked', false); // Can only delete unbooked slots

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno' });
  }
});

// SDR — Manual demo booking by recruiter
app.post("/api/sdr/demos/manual", async (req, res) => {
  try {
    const { slot_id, slot_date, slot_time, name, phone, email, company, notes } = req.body as {
      slot_id?: string; slot_date?: string; slot_time?: string;
      name: string; phone?: string; email?: string; company?: string; notes?: string;
    };
    if (!name) return res.status(400).json({ ok: false, error: 'name é obrigatório' });
    if (!slot_id && (!slot_date || !slot_time)) return res.status(400).json({ ok: false, error: 'Informe slot_id ou slot_date+slot_time' });

    let slotId = slot_id;

    if (!slotId) {
      // Find or create the slot by date+time
      const { data: found } = await supabaseAdmin
        .from('sdr_demo_slots')
        .select('id, is_booked')
        .eq('slot_date', slot_date!)
        .eq('slot_time', slot_time!)
        .maybeSingle();

      if (found) {
        if (found.is_booked) return res.status(409).json({ ok: false, error: 'Horário já reservado. Escolha outro.' });
        slotId = found.id;
      } else {
        // Create new slot
        const { data: created } = await supabaseAdmin
          .from('sdr_demo_slots')
          .insert({ slot_date: slot_date!, slot_time: slot_time!, duration_minutes: 30 })
          .select('id')
          .maybeSingle();
        if (!created) return res.status(500).json({ ok: false, error: 'Erro ao criar horário.' });
        slotId = created.id;
      }
    } else {
      // Validate existing slot
      const { data: existingSlot } = await supabaseAdmin
        .from('sdr_demo_slots')
        .select('id, is_booked')
        .eq('id', slotId)
        .maybeSingle();
      if (!existingSlot) return res.status(404).json({ ok: false, error: 'Horário não encontrado.' });
      if (existingSlot.is_booked) return res.status(409).json({ ok: false, error: 'Horário já reservado. Escolha outro.' });
    }

    // Book the slot
    await supabaseAdmin
      .from('sdr_demo_slots')
      .update({ is_booked: true, booked_by: `manual:${name}` })
      .eq('id', slotId);

    const { data: booked } = await supabaseAdmin
      .from('sdr_demo_slots')
      .select('*')
      .eq('id', slotId)
      .maybeSingle();

    // Create Google Calendar + Meet event
    let meetLink = '';
    let eventId = '';
    try {
      const googleEvent = await createMeetingEvent({
        candidateName: name,
        jobTitle: 'Demonstração Elevva',
        slotDate: booked.slot_date,
        slotTime: booked.slot_time,
        candidatePhone: phone || '',
        recruiterEmail: process.env.SDR_EMAIL,
        calendarId: process.env.SDR_GOOGLE_CALENDAR_ID || process.env.GOOGLE_CALENDAR_ID,
        useSdrCredentials: true,
      });
      if (googleEvent?.meetLink) {
        meetLink = googleEvent.meetLink;
        eventId = googleEvent.eventId;
        await supabaseAdmin.from('sdr_demo_slots').update({ google_event_id: eventId, meeting_link: meetLink }).eq('id', slotId);
      }
    } catch (_) { /* calendar optional */ }

    // Upsert lead record
    let leadId: string | null = null;
    if (phone) {
      const { data: existingLead } = await supabaseAdmin.from('sdr_leads').select('id').eq('phone', phone).maybeSingle();
      if (existingLead) {
        leadId = existingLead.id;
        await supabaseAdmin.from('sdr_leads').update({ status: 'DEMO_AGENDADA', name, company, updated_at: new Date().toISOString() }).eq('id', leadId);
      } else {
        const { data: newLead } = await supabaseAdmin.from('sdr_leads').insert({ phone, name, email, company, source: 'MANUAL', status: 'DEMO_AGENDADA' }).select('id').maybeSingle();
        leadId = newLead?.id || null;
      }
      if (leadId) await supabaseAdmin.from('sdr_demo_slots').update({ booked_by: leadId }).eq('id', slotId);
    }

    // Save notes if provided
    if (notes && leadId) {
      await supabaseAdmin.from('sdr_messages').insert({ lead_id: leadId, direction: 'OUT', content: `[Nota manual] ${notes}`, message_type: 'note' });
    }

    return res.json({ ok: true, slot: booked, meeting_link: meetLink });
  } catch (err) {
    console.error('[SDR Manual Demo] Error:', err);
    return res.status(500).json({ ok: false, error: 'Erro interno' });
  }
});

// SDR — List booked demos
app.get("/api/sdr/demos", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('sdr_demo_slots')
      .select('*')
      .eq('is_booked', true)
      .gte('slot_date', new Date().toISOString().split('T')[0])
      .order('slot_date', { ascending: true })
      .order('slot_time', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno' });
  }
});

// SDR Cron — Follow-ups and demo reminders
// GET /api/cron/sdr-follow-ups
app.get("/api/cron/sdr-follow-ups", async (req, res) => {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers['authorization'] !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const followUpResult = await runSdrFollowUps(supabaseAdmin);
    const reminderCount = await runSdrDemoReminders(supabaseAdmin);

    return res.json({
      ok: true,
      follow_ups_sent: followUpResult.sent,
      leads_marked_lost: followUpResult.lost,
      demo_reminders_sent: reminderCount,
    });
  } catch (err) {
    console.error('[SDR Cron] Error:', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

// SDR Messages — conversation history for a lead
app.get("/api/sdr/leads/:leadId/messages", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('sdr_messages')
      .select('*')
      .eq('lead_id', req.params.leadId)
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno' });
  }
});

// ── Gerador de Leads via Apify ────────────────────────────────────────────────
// Passo 1: inicia o run e retorna runId imediatamente
app.post("/api/sdr/leads/generate", async (req, res) => {
  const { nicho, regiao, quantidade } = req.body as { nicho: string; regiao: string; quantidade: number };
  if (!nicho || !regiao || !quantidade) {
    return res.status(400).json({ error: 'Parâmetros obrigatórios: nicho, regiao, quantidade' });
  }

  const token = process.env.APIFY_TOKEN;
  if (!token) return res.status(500).json({ error: 'APIFY_TOKEN não configurado no servidor' });

  const maxItems = Math.min(Number(quantidade) || 20, 100);
  const searchQuery = `${nicho} ${regiao}`;

  try {
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/compass~crawler-google-places/runs`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          searchStringsArray: [searchQuery],
          maxCrawledPlacesPerSearch: maxItems,
          maxCrawledPlaces: maxItems,
          language: 'pt-BR',
          countryCode: 'br',
          searchMatching: 'all',
        }),
      }
    );

    const rawText = await runRes.text();
    let runData: any;
    try { runData = JSON.parse(rawText); } catch { runData = { raw: rawText }; }

    if (!runData?.data?.id) {
      const apifyMsg = runData?.error?.message || runData?.error?.type || rawText.slice(0, 300);
      return res.status(500).json({ error: `Apify erro (${runRes.status}): ${apifyMsg}` });
    }

    return res.json({ runId: runData.data.id, status: runData.data.status });
  } catch (err: any) {
    console.error('[Apify] Erro ao iniciar run:', err);
    return res.status(500).json({ error: 'Erro interno ao iniciar busca', detail: err.message });
  }
});

// Passo 2: consulta status/resultado do run pelo runId
app.get("/api/sdr/leads/result/:runId", async (req, res) => {
  const { runId } = req.params;
  const token = process.env.APIFY_TOKEN;
  if (!token) return res.status(500).json({ error: 'APIFY_TOKEN não configurado no servidor' });

  try {
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/compass~crawler-google-places/runs/${runId}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const runData = await runRes.json() as any;
    const status = runData?.data?.status;

    if (!status) {
      return res.status(500).json({ error: 'Não foi possível obter o status do run', detail: runData });
    }

    if (status === 'RUNNING' || status === 'READY' || status === 'ABORTING') {
      return res.json({ status });
    }

    if (status !== 'SUCCEEDED') {
      return res.status(500).json({ error: `Run finalizado com status: ${status}` });
    }

    const datasetId = runData.data.defaultDatasetId;
    const limit = 100;
    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?limit=${limit}&clean=true`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const items = await itemsRes.json() as any[];

    const leads = items.map((item: any) => {
      const city = item.city || item.addressParsed?.city || '';
      const state = item.state || item.addressParsed?.state || '';
      const regiao = city && state ? `${city}/${state}` : city || state || '';
      return {
        nome: item.title || '',
        categoria: item.categoryName || '',
        endereco: item.address || '',
        cidade: regiao,
        telefone: item.phone || '',
        site: item.website || '',
        email: item.email || '',
        rating: item.totalScore ?? null,
        reviews: item.reviewsCount || 0,
      };
    });

    return res.json({ status: 'SUCCEEDED', leads, total: leads.length });
  } catch (err: any) {
    console.error('[Apify] Erro ao buscar resultado:', err);
    return res.status(500).json({ error: 'Erro interno ao buscar resultado', detail: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/system-prompt/:id — busca prompt ('recruiter' | 'sdr' | 'attendance')
// PUT /api/system-prompt/:id — salva prompt (apenas admin/sdr autenticado)
// ──────────────────────────────────────────────────────────────────────────────

const VALID_PROMPT_IDS = ['recruiter', 'sdr', 'attendance'];

// Prompt padrão do agente Bento — descreve exatamente o comportamento do agente de atendimento
const DEFAULT_ATTENDANCE_PROMPT = `Você é Bento, assistente virtual de recrutamento que atende candidatos pelo WhatsApp.

## Identidade
- Nome: Bento
- Função: triagem e agendamento de candidatos para vagas de emprego
- Tom: amigável, objetivo, profissional. Use emojis com moderação.
- Idioma: sempre português do Brasil

## Fluxo de atendimento (estados)

### 1. Primeiro contato (NOVO)
Mensagem de boas-vindas:
"Olá, *{nome do candidato}*! 👋 Sou o Bento, assistente de recrutamento.

Nossas vagas abertas:

*1.* {título da vaga 1}
*2.* {título da vaga 2}
...

Responda com o *número* da vaga que deseja se candidatar."

Se não houver vagas abertas: "Olá! No momento não há vagas abertas. Fique atento às nossas oportunidades!"

### 2. Seleção de vaga (SELECIONANDO_VAGA)
O candidato responde com o número da vaga. Ao confirmar:
"✅ A vaga de *{título da vaga}* foi registrada!

Agora, por favor, envie seu currículo em formato *PDF*."

Se não entender a resposta: "Não entendi. Por favor, responda com o número da vaga:" (e repete a lista)

### 3. Aguardando currículo (AGUARDANDO_CURRICULO)
Se o candidato enviar texto em vez de PDF: "Por favor, envie seu currículo em formato *PDF* para prosseguir. 📄"
Ao receber o PDF: "✅ Currículo recebido! Vamos analisar o seu perfil e entraremos em contato em breve com os próximos passos."

### 4. Análise em andamento (ANALISANDO)
Se o candidato enviar mensagem enquanto analisa: "Aguarde! Estamos analisando seu currículo... ⏳"

### 5. Currículo recebido / aguardando decisão (CURRICULO_RECEBIDO)
"Seu currículo já foi recebido! Em breve nossa equipe entrará em contato com os próximos passos. 😊"

### 6. Candidato aprovado — aguardando escolha de horário (AGUARDANDO_ESCOLHA_SLOT)
O recrutador aprova e envia link de agendamento. Se candidato mandar mensagem:
"Para escolher seu horário de entrevista, acesse o link abaixo:

{link de agendamento}

_Se precisar de ajuda, fale com o recrutador._"

### 7. Entrevista confirmada (ENTREVISTA_CONFIRMADA)
Se candidato enviar qualquer mensagem: "Sua entrevista já está confirmada! Se precisar reagendar, basta digitar *reagendar*. 😊"

### 8. Lembrete 2h antes (AGUARDANDO_CONFIRMACAO_LEMBRETE)
Mensagem enviada automaticamente:
"⏰ *Lembrete de Entrevista*

Olá, *{nome}*! Sua entrevista é hoje:

📅 *Data:* {data}
⏰ *Horário:* {horário}
👤 *Entrevistador:* {nome do entrevistador}
🎥 *Link:* {link Google Meet}

Você confirma sua presença?
Responda:
✅ *SIM* — confirmo presença
🔄 *REAGENDAR* — preciso de outro horário
❌ *CANCELAR* — não irei participar"

Respostas possíveis:
- SIM / confirmo / vou / ok → "✅ Presença confirmada! Nos vemos em breve. Boa sorte! 🍀"
- REAGENDAR / remarcar / mudar → inicia fluxo de reagendamento
- CANCELAR / não vou / desisto → "Entendido. Sua entrevista foi cancelada.\n\nCaso mude de ideia, entre em contato conosco. Desejamos sucesso! 🙏"
- Resposta não reconhecida → "Por favor, responda com:\n\n✅ *SIM* — confirmo presença\n🔄 *REAGENDAR* — preciso de outro horário\n❌ *CANCELAR* — não irei participar"

### 9. Reagendamento
Se não houver horários disponíveis:
"Entendi que você precisa reagendar, *{nome}*.

Infelizmente, não há outros horários disponíveis no momento. Já notificamos o recrutador para liberar novas datas.

Assim que houver novos horários, enviaremos o link para você escolher. 😊"

Se houver horários:
"Sem problemas, *{nome}*! Vamos reagendar.

Escolha um novo horário no link abaixo:

{link de agendamento}

_Clique no link para selecionar seu novo horário._"

## Regras importantes
- Nunca invente vagas, horários ou links — diga que não tem a informação
- Se o candidato perguntar algo fora do fluxo, redirecione educadamente para o processo de candidatura
- Não discuta salário, benefícios ou detalhes da empresa — oriente a perguntar ao recrutador na entrevista
- Human takeover: se um humano assumir o atendimento no Chatwoot, o Bento para de responder automaticamente`;

app.get("/api/system-prompt/:id", async (req, res) => {
  const { id } = req.params;
  if (!VALID_PROMPT_IDS.includes(id)) return res.status(400).json({ error: 'ID inválido' });
  const { data, error } = await supabaseAdmin
    .from('system_prompts')
    .select('prompt, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (data) return res.json(data);
  // Return built-in default for attendance prompt so UI always shows the actual prompt
  if (id === 'attendance') return res.json({ prompt: DEFAULT_ATTENDANCE_PROMPT, updated_at: null });
  return res.json({ prompt: '', updated_at: null });
});

app.put("/api/system-prompt/:id", async (req, res) => {
  const { id } = req.params;
  const { prompt } = req.body as { prompt?: string };
  if (!VALID_PROMPT_IDS.includes(id)) return res.status(400).json({ error: 'ID inválido' });
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'Campo prompt obrigatório' });
  const { error } = await supabaseAdmin
    .from('system_prompts')
    .upsert({ id, prompt, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

// ── Training chat: simula conversa com o Bento via IA ────────────────────────
// POST /api/admin/training-chat
// Body: { message, history: [{role, content}], attendancePrompt }
// ──────────────────────────────────────────────────────────────────────────────

app.post("/api/admin/training-chat", async (req, res) => {
  const { message, history, attendancePrompt } = req.body as {
    message?: string;
    history?: { role: 'user' | 'assistant'; content: string }[];
    attendancePrompt?: string;
  };
  if (!message) return res.status(400).json({ error: 'message obrigatório' });

  try {
    const systemPrompt = attendancePrompt || DEFAULT_ATTENDANCE_PROMPT;
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...(history || []).map(m => ({ role: m.role, content: m.content } as OpenAI.Chat.ChatCompletionMessageParam)),
      { role: 'user', content: message },
    ];

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || '...';
    return res.json({ response });
  } catch (err) {
    console.error('[Training Chat] Error:', err);
    return res.status(500).json({ error: 'Erro ao processar mensagem' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SISTEMA DE VENDAS, COMISSIONAMENTO E ONBOARDING AUTOMÁTICO
// ══════════════════════════════════════════════════════════════════════════════

// ── POST /api/salespeople/login — Login do vendedor ──────────────────────────
app.post("/api/salespeople/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: 'email e password são obrigatórios' });

  const { data: sp, error } = await supabaseAdmin
    .from('salespeople')
    .select('*')
    .eq('email', email.trim().toLowerCase())
    .eq('status', 'active')
    .single();

  if (error || !sp) return res.status(401).json({ error: 'Vendedor não encontrado ou inativo' });

  if (!sp.password_hash) {
    return res.status(401).json({ error: 'Senha não definida. Peça ao administrador para configurar sua senha.' });
  }

  const senhaValida = await bcrypt.compare(password, sp.password_hash);
  if (!senhaValida) return res.status(401).json({ error: 'Senha incorreta' });

  return res.json({
    ok: true,
    salesperson: {
      id: sp.id,
      name: sp.name,
      email: sp.email,
      commission_pct: sp.commission_pct,
      asaas_wallet_id: sp.asaas_wallet_id,
    },
  });
});

// ── POST /api/salespeople/:id/change-password — Vendedor troca própria senha ──
app.post("/api/salespeople/:id/change-password", async (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword e newPassword são obrigatórios' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });
  }
  try {
    const { data: sp } = await supabaseAdmin.from('salespeople').select('password_hash').eq('id', id).single();
    if (!sp?.password_hash) return res.status(404).json({ error: 'Vendedor não encontrado' });
    const ok = await bcrypt.compare(currentPassword, sp.password_hash);
    if (!ok) return res.status(401).json({ error: 'Senha atual incorreta' });
    const hash = await bcrypt.hash(newPassword, 10);
    await supabaseAdmin.from('salespeople').update({ password_hash: hash }).eq('id', id);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/salespeople/:id/reset-password — Admin reseta senha do vendedor ─
app.post("/api/salespeople/:id/reset-password", async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body as { newPassword?: string };
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'newPassword deve ter pelo menos 6 caracteres' });
  }
  try {
    const hash = await bcrypt.hash(newPassword, 10);
    const { error } = await supabaseAdmin.from('salespeople').update({ password_hash: hash }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/salespeople/validate-wallet — Validar Wallet ID do vendedor ─────
app.post("/api/salespeople/validate-wallet", async (req, res) => {
  const { walletId } = req.body as { walletId?: string };
  if (!walletId) return res.status(400).json({ error: 'walletId obrigatório' });

  try {
    const result = await validateWalletId(walletId.trim());
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/salespeople — Cadastrar vendedor ────────────────────────────────
// O vendedor deve ter conta própria no Asaas e fornecer o Wallet ID dela.
// Não criamos mais subconta — o split vai direto para a conta do vendedor.
app.post("/api/salespeople", async (req, res) => {
  const { name, email, phone, commissionPct, asaasWalletId, password } = req.body as {
    name?: string; email?: string; phone?: string;
    commissionPct?: number; asaasWalletId?: string; password?: string;
  };

  if (!name || !email) {
    return res.status(400).json({ error: 'name e email são obrigatórios' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Defina uma senha de acesso com pelo menos 6 caracteres' });
  }

  try {
    if (asaasWalletId) {
      const validation = await validateWalletId(asaasWalletId.trim());
      if (!validation.valid) {
        return res.status(400).json({ error: 'Wallet ID do Asaas inválido ou não encontrado.' });
      }
    }

    const password_hash = await bcrypt.hash(password, 10);

    const { data, error } = await supabaseAdmin
      .from('salespeople')
      .insert({
        name,
        email,
        phone: phone || null,
        commission_pct: commissionPct ?? 15,
        asaas_wallet_id: asaasWalletId?.trim() || null,
        password_hash,
        status: 'active',
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({
      ok: true,
      salesperson: data,
      asaasLinked: !!asaasWalletId,
      message: asaasWalletId
        ? 'Vendedor cadastrado com Wallet ID validado. Split configurado.'
        : 'Vendedor cadastrado sem Wallet ID. Adicione o Wallet ID Asaas para ativar o split.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/salespeople — Listar vendedores com resumo de comissões ──────────
app.get("/api/salespeople", async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('salesperson_commission_summary')
      .select('*')
      .order('total_revenue', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/salespeople/:id — Atualizar vendedor ────────────────────────────
app.put("/api/salespeople/:id", async (req, res) => {
  const { id } = req.params;
  const { name, phone, commissionPct, status, asaasWalletId } = req.body as {
    name?: string; phone?: string; commissionPct?: number;
    status?: string; asaasWalletId?: string;
  };

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (commissionPct !== undefined) updates.commission_pct = commissionPct;
  if (status !== undefined) updates.status = status;
  if (asaasWalletId !== undefined) updates.asaas_wallet_id = asaasWalletId;

  const { data, error } = await supabaseAdmin
    .from('salespeople').update(updates).eq('id', id).select().single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true, salesperson: data });
});

// ── GET /api/sales — Todas as vendas (admin) ─────────────────────────────────
app.get("/api/sales", async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('sales')
      .select('*, salespeople(name, email)')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/sales/:id — Cancelar e deletar venda pendente ───────────────
app.delete("/api/sales/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Só permite deletar vendas com status pending
    const { data: sale, error: fetchErr } = await supabaseAdmin
      .from('sales').select('id, status').eq('id', id).single();
    if (fetchErr || !sale) return res.status(404).json({ error: 'Venda não encontrada' });
    if (sale.status !== 'pending') {
      return res.status(400).json({ error: 'Apenas vendas pendentes podem ser canceladas' });
    }
    const { error: delErr } = await supabaseAdmin.from('sales').delete().eq('id', id);
    if (delErr) return res.status(500).json({ error: delErr.message });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Encode/decode metadata do link (viaja no externalReference do Asaas) ────────
// O banco só recebe o registro após pagamento confirmado — Asaas é a fonte da verdade
function encodeLinkMeta(meta: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(meta)).toString('base64');
}
function decodeLinkMeta(ref: string): Record<string, unknown> | null {
  try { return JSON.parse(Buffer.from(ref, 'base64').toString('utf8')); } catch { return null; }
}

// ── POST /api/sales/direct-link — Venda direta pelo sócio (sem vendedor) ───────
// Cria registro pending no banco para usar UUID como externalReference (max 100 chars no Asaas)
app.post("/api/sales/direct-link", async (req, res) => {
  const { clientName, clientEmail, clientPhone, plan, billing, customAmount } = req.body as {
    clientName?: string; clientEmail?: string; clientPhone?: string;
    plan?: string; billing?: string; customAmount?: number;
  };

  if (!clientName || !clientEmail || !clientPhone || !plan) {
    return res.status(400).json({ error: 'clientName, clientEmail, clientPhone e plan são obrigatórios' });
  }

  const VALID_PLANS = ['ESSENCIAL', 'ESSENCIAL_ANUAL', 'PRO', 'PRO_ANUAL', 'ENTERPRISE'];
  if (!VALID_PLANS.includes(plan)) {
    return res.status(400).json({ error: `plan inválido: ${plan}` });
  }

  try {
    const amountReais = customAmount || (PLAN_PRICES[plan] / 100);
    const planLabel = plan.replace('_ANUAL', ' Anual').replace('_', ' ');
    const billingValue = (billing || 'mensal') as 'mensal' | 'anual';

    // Cria registro pending — UUID vira externalReference (≤36 chars, dentro do limite Asaas)
    const { data: saleRecord, error: saleErr } = await supabaseAdmin
      .from('sales')
      .insert({
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
        plan,
        amount: amountReais,
        commission_amount: 0,
        status: 'pending',
        billing: billingValue,
      })
      .select('id')
      .single();

    if (saleErr || !saleRecord) {
      throw new Error(`Erro ao criar registro de venda: ${saleErr?.message}`);
    }

    const link = await generatePaymentLink({
      clientName, clientEmail,
      plan: planLabel,
      amount: amountReais,
      commissionPct: 0,
      walletId: '',
      salespersonName: 'Elevva',
      saleId: saleRecord.id,  // UUID de 36 chars — dentro do limite Asaas
      billing: billingValue,
    });

    // Salva o link gerado no registro
    await supabaseAdmin.from('sales').update({ asaas_link_url: link.url }).eq('id', saleRecord.id);

    return res.json({ ok: true, paymentLink: link.url, amount: amountReais });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/salespeople/:id/link — Gerar link de pagamento com comissão ──────
// Cria registro pending no banco para usar UUID como externalReference (max 100 chars no Asaas)
app.post("/api/salespeople/:id/link", async (req, res) => {
  const { id } = req.params;
  const { clientName, clientEmail, clientPhone, plan, billing, customAmount } = req.body as {
    clientName?: string; clientEmail?: string; clientPhone?: string;
    plan?: string; billing?: string; customAmount?: number;
  };

  if (!clientName || !clientEmail || !clientPhone || !plan) {
    return res.status(400).json({ error: 'clientName, clientEmail, clientPhone e plan são obrigatórios' });
  }

  const VALID_PLANS_SP = ['ESSENCIAL', 'ESSENCIAL_ANUAL', 'PRO', 'PRO_ANUAL', 'ENTERPRISE'];
  if (!VALID_PLANS_SP.includes(plan)) {
    return res.status(400).json({ error: `plan inválido: ${plan}` });
  }

  try {
    const { data: sp, error: spErr } = await supabaseAdmin
      .from('salespeople').select('*').eq('id', id).eq('status', 'active').single();

    if (spErr || !sp) return res.status(404).json({ error: 'Vendedor não encontrado ou inativo' });

    const amountReais = customAmount || (PLAN_PRICES[plan] / 100);
    const hasSplit = !!sp.asaas_wallet_id && sp.commission_pct > 0;
    const commissionAmount = hasSplit
      ? parseFloat((amountReais * sp.commission_pct / 100).toFixed(2))
      : 0;
    const planLabel = plan.replace('_ANUAL', ' Anual').replace('_', ' ');
    const billingValue = (billing || 'mensal') as 'mensal' | 'anual';

    // Cria registro pending — UUID vira externalReference (≤36 chars, dentro do limite Asaas)
    const { data: saleRecord, error: saleErr } = await supabaseAdmin
      .from('sales')
      .insert({
        salesperson_id: id,
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
        plan,
        amount: amountReais,
        commission_amount: commissionAmount,
        status: 'pending',
        billing: billingValue,
      })
      .select('id')
      .single();

    if (saleErr || !saleRecord) {
      throw new Error(`Erro ao criar registro de venda: ${saleErr?.message}`);
    }

    const link = await generatePaymentLink({
      clientName, clientEmail,
      plan: planLabel,
      amount: amountReais,
      commissionPct: hasSplit ? sp.commission_pct : 0,
      walletId: sp.asaas_wallet_id || '',
      salespersonName: sp.name,
      saleId: saleRecord.id,  // UUID de 36 chars — dentro do limite Asaas
      billing: billingValue,
    });

    // Salva o link gerado no registro
    await supabaseAdmin.from('sales').update({ asaas_link_url: link.url }).eq('id', saleRecord.id);

    return res.json({
      ok: true,
      paymentLink: link.url,
      amount: amountReais,
      commission: commissionAmount,
      splitActive: hasSplit,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/salespeople/:id/sales — Histórico de vendas do vendedor ──────────
app.get("/api/salespeople/:id/sales", async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabaseAdmin
      .from('sales')
      .select('*')
      .eq('salesperson_id', id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/chips-pool — Listar chips do pool ────────────────────────────────
app.get("/api/chips-pool", async (_req, res) => {
  try {
    const { data: chips } = await supabaseAdmin
      .from('chips_pool').select('*').order('created_at', { ascending: false });
    const { data: summary } = await supabaseAdmin
      .from('chips_pool_summary').select('*').single();
    return res.json({ chips: chips || [], summary: summary || {} });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/chips-pool — Registrar novo chip no pool ───────────────────────
app.post("/api/chips-pool", async (req, res) => {
  const { phoneNumber, evolutionInstance, displayName, notes } = req.body as {
    phoneNumber?: string; evolutionInstance?: string;
    displayName?: string; notes?: string;
  };

  if (!phoneNumber || !evolutionInstance) {
    return res.status(400).json({ error: 'phoneNumber e evolutionInstance são obrigatórios' });
  }

  const { data, error } = await supabaseAdmin.from('chips_pool').insert({
    phone_number: phoneNumber.replace(/\D/g, ''),
    evolution_instance: evolutionInstance,
    display_name: displayName || null,
    notes: notes || null,
    status: 'disponivel',
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true, chip: data });
});

// ── PUT /api/chips-pool/:id — Atualizar chip ─────────────────────────────────
app.put("/api/chips-pool/:id", async (req, res) => {
  const { id } = req.params;
  const { status, displayName, notes } = req.body as {
    status?: string; displayName?: string; notes?: string;
  };

  const updates: Record<string, unknown> = {};
  if (status !== undefined) updates.status = status;
  if (displayName !== undefined) updates.display_name = displayName;
  if (notes !== undefined) updates.notes = notes;

  const { data, error } = await supabaseAdmin
    .from('chips_pool').update(updates).eq('id', id).select().single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true, chip: data });
});

// ── POST /api/webhooks/asaas — Webhook de pagamento Asaas ─────────────────────
// Dispara o onboarding automático quando o cliente paga
app.post("/api/webhooks/asaas", async (req, res) => {
  // Validar token do webhook
  const headerToken = req.headers['asaas-access-token'] as string | undefined;
  if (!validateWebhookToken(headerToken)) {
    console.warn('[Asaas Webhook] Token inválido');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { event, payment } = req.body as {
    event?: string;
    payment?: { id?: string; externalReference?: string; status?: string; value?: number };
  };

  console.log(`[Asaas Webhook] Evento: ${event}, Payment: ${payment?.id}`);

  // Só processa confirmações de pagamento
  if (!['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(event || '')) {
    return res.json({ ok: true, ignored: true });
  }

  const externalRef = payment?.externalReference;
  if (!externalRef) {
    console.warn('[Asaas Webhook] externalReference ausente — não é uma venda Elevva');
    return res.json({ ok: true, ignored: true });
  }

  // Responde imediatamente ao Asaas (evita timeout)
  res.json({ ok: true, received: true });

  // Processar onboarding em background
  (async () => {
    try {
      // Decodificar metadata do link (novo formato: base64 JSON)
      const meta = decodeLinkMeta(externalRef) as any;

      let saleId: string;

      if (meta?.clientEmail) {
        // ── Novo fluxo: criar registro no banco agora que pagamento foi confirmado
        console.log(`[Asaas Webhook] Novo fluxo — criando venda para ${meta.clientEmail}`);

        // Evitar duplicatas: verificar se já existe sale com esse asaas_payment_id
        const { data: existing } = await supabaseAdmin
          .from('sales').select('id').eq('asaas_payment_id', payment!.id!).maybeSingle();

        if (existing) {
          console.warn(`[Asaas Webhook] Pagamento ${payment!.id} já processado (sale ${existing.id}) — ignorando`);
          return;
        }

        const { data: sale, error: saleErr } = await supabaseAdmin
          .from('sales')
          .insert({
            salesperson_id: meta.salespersonId || null,
            client_name: meta.clientName,
            client_email: meta.clientEmail,
            client_phone: meta.clientPhone,
            plan: meta.plan,
            amount: meta.amount,
            commission_amount: meta.commissionAmount || 0,
            asaas_payment_id: payment!.id,
            asaas_link_url: null,
            status: 'paid',
            paid_at: new Date().toISOString(),
            onboarding_status: 'aguardando',
          })
          .select()
          .single();

        if (saleErr || !sale) {
          console.error('[Asaas Webhook] Erro ao criar venda:', saleErr?.message);
          return;
        }

        saleId = sale.id;
      } else {
        // ── Legado: externalReference é um UUID de venda pendente existente
        saleId = externalRef;
        await supabaseAdmin.from('sales').update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          asaas_payment_id: payment?.id || null,
        }).eq('id', saleId);
      }

      console.log(`[Asaas Webhook] Iniciando onboarding para venda ${saleId}`);
      const result = await provisionClient(saleId);

      if (result.success) {
        console.log(`[Asaas Webhook] ✅ Onboarding concluído: ${result.clientEmail}`);
      } else {
        console.error(`[Asaas Webhook] ❌ Onboarding falhou: ${result.error}`);
      }
    } catch (err: any) {
      console.error('[Asaas Webhook] Erro inesperado:', err.message);
    }
  })();
});

// ── GET /api/salespeople/:id/asaas — Dados reais da subconta no Asaas ─────────
app.get("/api/salespeople/:id/asaas", async (req, res) => {
  const { id } = req.params;

  const { data: sp } = await supabaseAdmin
    .from('salespeople').select('asaas_wallet_id, asaas_customer_id, name').eq('id', id).single();

  if (!sp?.asaas_wallet_id) return res.status(404).json({ error: 'Vendedor sem subconta Asaas' });

  try {
    const info = await getSubaccountInfo(sp.asaas_wallet_id);
    return res.json({ ok: true, asaas: info });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/salespeople/sync — Sincronizar todas as vendas com Asaas ────────
// Percorre todas as sales com status 'pending' e atualiza pelo Asaas real
app.post("/api/salespeople/sync", async (req, res) => {
  // Responde imediatamente, processa em background
  res.json({ ok: true, message: 'Sincronização iniciada' });

  (async () => {
    try {
      const { data: pendingSales } = await supabaseAdmin
        .from('sales')
        .select('id, asaas_payment_id, status')
        .in('status', ['pending'])
        .not('asaas_payment_id', 'is', null);

      if (!pendingSales?.length) {
        console.log('[Sync Asaas] Nenhuma venda pendente para sincronizar');
        return;
      }

      console.log(`[Sync Asaas] Sincronizando ${pendingSales.length} vendas...`);
      let updated = 0;

      for (const sale of pendingSales) {
        try {
          const result = await syncPaymentStatus(sale.asaas_payment_id);
          if (!result) continue;

          const CONFIRMED = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'];
          const CANCELLED = ['REFUNDED', 'REFUND_REQUESTED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL', 'DUNNING_REQUESTED', 'DUNNING_RECEIVED'];

          if (CONFIRMED.includes(result.asaasStatus) && sale.status !== 'paid') {
            await supabaseAdmin.from('sales').update({
              status: 'paid',
              paid_at: result.confirmedAt || new Date().toISOString(),
            }).eq('id', sale.id);

            // Disparar onboarding se ainda não foi feito
            const { data: updatedSale } = await supabaseAdmin
              .from('sales').select('onboarding_status').eq('id', sale.id).single();

            if (updatedSale?.onboarding_status === 'aguardando') {
              const { provisionClient } = await import('./src/services/onboardingService.js');
              provisionClient(sale.id).catch(e => console.error('[Sync] Onboarding error:', e.message));
            }
            updated++;
          } else if (CANCELLED.includes(result.asaasStatus) && sale.status !== 'cancelled') {
            await supabaseAdmin.from('sales').update({ status: 'cancelled' }).eq('id', sale.id);
            updated++;
          }
        } catch (err: any) {
          console.error(`[Sync Asaas] Erro na venda ${sale.id}:`, err.message);
        }
      }

      console.log(`[Sync Asaas] ✅ ${updated} vendas atualizadas`);
    } catch (err: any) {
      console.error('[Sync Asaas] Erro geral:', err.message);
    }
  })();
});

// ── GET /api/salespeople/finance — Dados financeiros reais do Asaas ────────────
// Retorna resumo de pagamentos confirmados/pendentes direto do Asaas
app.get("/api/salespeople/finance", async (_req, res) => {
  try {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    // Buscar pagamentos confirmados do mês no Asaas
    const [confirmed, pending] = await Promise.all([
      listPayments({ status: 'RECEIVED', dateCreatedStart: firstOfMonth, dateCreatedEnd: todayStr, limit: 100 }),
      listPayments({ status: 'PENDING', dateCreatedStart: firstOfMonth, dateCreatedEnd: todayStr, limit: 100 }),
    ]);

    const totalConfirmed = confirmed.data.reduce((acc: number, p: any) => acc + (p.netValue || 0), 0);
    const totalPending = pending.data.reduce((acc: number, p: any) => acc + (p.value || 0), 0);

    return res.json({
      ok: true,
      month: firstOfMonth.substring(0, 7),
      confirmed: {
        count: confirmed.totalCount,
        totalNet: parseFloat(totalConfirmed.toFixed(2)),
      },
      pending: {
        count: pending.totalCount,
        totalGross: parseFloat(totalPending.toFixed(2)),
      },
      payments: confirmed.data.slice(0, 20).map((p: any) => ({
        id: p.id,
        value: p.value,
        netValue: p.netValue,
        status: p.status,
        externalReference: p.externalReference,
        confirmedDate: p.confirmedDate || p.paymentDate,
        billingType: p.billingType,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/sales/:id/retry — Reprocessar onboarding com falha ──────────────
app.post("/api/sales/:id/retry", async (req, res) => {
  const { id } = req.params;

  const { data: sale } = await supabaseAdmin
    .from('sales').select('onboarding_status').eq('id', id).single();

  if (!sale) return res.status(404).json({ error: 'Venda não encontrada' });
  if (sale.onboarding_status === 'concluido') {
    return res.status(400).json({ error: 'Onboarding já concluído' });
  }

  res.json({ ok: true, message: 'Retry iniciado em background' });

  (async () => {
    try {
      const result = await provisionClient(id);
      console.log(`[Retry] ${result.success ? '✅' : '❌'} ${id}: ${result.error || 'OK'}`);
    } catch (err: any) {
      console.error('[Retry] Erro:', err.message);
    }
  })();
});

// ══════════════════════════════════════════════════════════════════════════════

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
