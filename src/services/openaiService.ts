/**
 * OpenAI Service — Análise de Currículos e Intent Detection (gpt-5.4-nano)
 */

import { createRequire } from 'module';
import OpenAI from 'openai';
import { AnalysisResult } from '../types.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;

const ERROR_BASE: Omit<AnalysisResult, 'candidateName' | 'summary' | 'cons'> = {
  matchScore: 0,
  yearsExperience: '-',
  city: '-',
  neighborhood: '-',
  phoneNumbers: [],
  pros: [],
  workHistory: [],
};

async function fetchRecruiterPrompt(jobTitle: string, criteria: string): Promise<string> {
  try {
    const res = await fetch(`${process.env.BASE_URL || 'http://localhost:3000'}/api/system-prompt/recruiter`);
    if (res.ok) {
      const { prompt } = await res.json() as { prompt?: string };
      if (prompt) {
        return prompt
          .replace('{jobTitle}', jobTitle)
          .replace('{criteria}', criteria || 'Não especificados');
      }
    }
  } catch { /* fallback silencioso */ }
  return '';
}

function buildClient(): OpenAI {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
}

/** Retry com backoff exponencial — tenta até 3 vezes */
async function withRetry<T>(fn: () => Promise<T>, label: string, maxAttempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const wait = attempt * 1500;
      console.warn(`[OpenAI] ${label} tentativa ${attempt}/${maxAttempts} falhou, aguardando ${wait}ms...`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

// ─── Análise de Currículos ────────────────────────────────────────────────────

export const analyzeResume = async (
  base64Pdf: string,
  jobTitle: string,
  criteria: string,
): Promise<AnalysisResult> => {
  const apiKey = process.env.OPENAI_API_KEY || '';

  if (!apiKey || apiKey.length < 10) {
    console.error('[OpenAI] OPENAI_API_KEY não encontrada.');
    return {
      ...ERROR_BASE,
      candidateName: 'Erro de Configuração',
      summary: 'ERRO: Configure OPENAI_API_KEY nas variáveis de ambiente da Vercel.',
      cons: ['Chave de API ausente'],
    };
  }

  // 1. PDF → texto
  let pdfText = '';
  try {
    const cleanBase64 = base64Pdf.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const parsed = await pdfParse(buffer);
    pdfText = parsed.text?.trim() || '';
    console.log('[OpenAI] PDF extraído, caracteres:', pdfText.length);
  } catch (pdfErr) {
    console.error('[OpenAI] Erro ao extrair texto do PDF:', pdfErr);
    return {
      ...ERROR_BASE,
      candidateName: 'Erro na Análise',
      summary: 'Não foi possível extrair o texto do PDF. O arquivo deve conter texto selecionável.',
      cons: ['PDF sem texto selecionável ou corrompido'],
    };
  }

  if (pdfText.length < 50) {
    return {
      ...ERROR_BASE,
      candidateName: 'Erro na Análise',
      summary: 'O PDF não contém texto legível. Envie um PDF com texto selecionável (não escaneado).',
      cons: ['PDF sem conteúdo de texto detectado'],
    };
  }

  // 2. Prompt
  const customPrompt = await fetchRecruiterPrompt(jobTitle, criteria);
  const systemPrompt = customPrompt || `Você é um especialista sênior em recrutamento e seleção com 15 anos de experiência. Analise o currículo abaixo para a vaga indicada e retorne SOMENTE um JSON válido, sem markdown, sem texto adicional.

VAGA: ${jobTitle}
REQUISITOS: ${criteria || 'Não especificados'}

JSON de saída (todos os campos obrigatórios):
{
  "candidateName": "Nome Sobrenome do candidato extraído do currículo",
  "matchScore": <número decimal de 0.0 a 10.0>,
  "yearsExperience": "tempo EXATO de experiência no cargo solicitado (ex: '3 anos e 2 meses' ou 'Sem experiência direta')",
  "city": "cidade de residência ou 'Não informado'",
  "neighborhood": "bairro ou 'Não informado'",
  "phoneNumbers": ["telefone com DDD"],
  "summary": "análise objetiva em ~400 caracteres: justifique a nota, destaque o mais relevante para a vaga",
  "pros": ["hard skill ou experiência positiva 1", "ponto forte 2", "ponto forte 3"],
  "cons": ["ponto de atenção 1", "ponto de atenção 2", "ponto de atenção 3"],
  "workHistory": [
    { "company": "empresa", "role": "cargo exato", "duration": "duração calculada ex: '1 ano e 5 meses'" }
  ]
}

CRITÉRIO DE PONTUAÇÃO (matchScore):
- 9.0 a 10.0: Cargo EXATO na vaga + todos os requisitos atendidos + experiência sólida
- 7.0 a 8.9: Cargo exato na vaga, mas falta 1 ou 2 requisitos secundários
- 4.0 a 6.9: Experiência correlata ao cargo (similar, mas não idêntico)
- 0.0 a 3.9: Sem experiência relevante para a vaga

REGRAS:
- candidateName: extraia do cabeçalho do currículo, jamais invente
- workHistory: inclua as 3 experiências mais recentes
- phoneNumbers: inclua todos os telefones encontrados no currículo
- summary: seja específico sobre a vaga ${jobTitle}, cite experiências concretas`;

  // 3. Chamada com retry
  try {
    const client = buildClient();

    const result = await withRetry(async () => {
      const completion = await client.chat.completions.create({
        model: 'gpt-5.4-nano',
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_completion_tokens: 1500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `CURRÍCULO:\n\n${pdfText.substring(0, 12000)}` },
        ],
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('Resposta vazia da OpenAI');
      return JSON.parse(content) as AnalysisResult;
    }, 'analyzeResume');

    // Sanitização
    if (!result.candidateName || result.candidateName.length < 2) result.candidateName = 'Candidato (Nome não identificado)';
    if (typeof result.matchScore !== 'number' || result.matchScore < 0 || result.matchScore > 10) result.matchScore = 0;
    if (!Array.isArray(result.pros)) result.pros = [];
    if (!Array.isArray(result.cons)) result.cons = [];
    if (!Array.isArray(result.workHistory)) result.workHistory = [];
    if (!Array.isArray(result.phoneNumbers)) result.phoneNumbers = [];
    if (!result.yearsExperience) result.yearsExperience = '-';
    if (!result.city) result.city = '-';
    if (!result.neighborhood) result.neighborhood = '-';

    console.log('[OpenAI] Análise concluída:', result.candidateName, '| Score:', result.matchScore);
    return result;

  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    console.error('[OpenAI] Erro após retries:', e.message, e.status);
    return {
      ...ERROR_BASE,
      candidateName: 'Erro na Análise',
      summary: `Erro ao processar: ${e.message || 'Erro desconhecido'}.`,
      cons: ['Falha na API OpenAI após 3 tentativas', e.message || ''],
    };
  }
};

// ─── Intent Detection para SDR (fallback quando regex não reconhece) ──────────

export type SdrIntent =
  | 'GREETING' | 'PRICE' | 'DISCOUNT' | 'HOW_IT_WORKS' | 'INTEGRATION'
  | 'DEMO_REQUEST' | 'OBJECTION_EXPENSIVE' | 'OBJECTION_SMALL_COMPANY'
  | 'OBJECTION_AI_TRUST' | 'OBJECTION_COMPETITOR' | 'LGPD'
  | 'TALK_TO_HUMAN' | 'YES' | 'NO' | 'RESCHEDULE' | 'UNKNOWN';

const INTENT_SYSTEM = `Você classifica mensagens de WhatsApp de leads interessados em um software de RH chamado Elevva.

Retorne SOMENTE um JSON: { "intent": "<INTENT>", "confidence": <0.0-1.0> }

INTENTS disponíveis:
- YES: confirmação, aceite, interesse positivo ("pode ser", "tô dentro", "fechou", "bora")
- NO: recusa, desinteresse ("não curto", "agora não dá", "sem interesse")
- DEMO_REQUEST: quer ver demo/apresentação ("quero ver", "me mostra", "faz uma demo")
- PRICE: pergunta sobre preço/planos/valor
- DISCOUNT: quer desconto/condição especial/negociar
- HOW_IT_WORKS: quer entender como funciona
- INTEGRATION: pergunta sobre integrações/APIs/sistemas
- OBJECTION_EXPENSIVE: acha caro ou sem orçamento
- OBJECTION_SMALL_COMPANY: empresa pequena, poucos funcionários
- OBJECTION_AI_TRUST: desconfia de IA
- OBJECTION_COMPETITOR: já usa outro sistema de RH
- LGPD: pergunta sobre dados/privacidade/segurança
- TALK_TO_HUMAN: quer falar com pessoa humana
- RESCHEDULE: quer remarcar/reagendar
- GREETING: cumprimento inicial
- UNKNOWN: mensagem ambígua sem intenção clara`;

/**
 * Classifica a intenção de uma mensagem SDR usando gpt-5.4-nano.
 * Retorna UNKNOWN se a API falhar (não bloqueia o fluxo).
 */
export async function classifyIntent(
  text: string,
  context?: string,
): Promise<{ intent: SdrIntent; confidence: number }> {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey || apiKey.length < 10) return { intent: 'UNKNOWN', confidence: 0 };

  try {
    const client = buildClient();
    const userMsg = context
      ? `Contexto da conversa: ${context}\n\nMensagem do lead: "${text}"`
      : `Mensagem do lead: "${text}"`;

    const completion = await client.chat.completions.create({
      model: 'gpt-5.4-nano',
      response_format: { type: 'json_object' },
      temperature: 0,
      max_completion_tokens: 60,
      messages: [
        { role: 'system', content: INTENT_SYSTEM },
        { role: 'user', content: userMsg },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return { intent: 'UNKNOWN', confidence: 0 };

    const parsed = JSON.parse(content) as { intent: SdrIntent; confidence: number };
    console.log(`[OpenAI] classifyIntent "${text.substring(0, 40)}" → ${parsed.intent} (${parsed.confidence})`);
    return parsed;
  } catch (err) {
    console.warn('[OpenAI] classifyIntent falhou:', (err as Error).message);
    return { intent: 'UNKNOWN', confidence: 0 };
  }
}
