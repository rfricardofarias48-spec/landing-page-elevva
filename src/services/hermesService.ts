/**
 * Hermes Service — Análise de Currículos com LLaMA 4 Scout via Groq
 * Substitui GPT-4o-mini: melhor performance, mais barato ($0.11/$0.34 vs $0.15/$0.60 /1M),
 * 594 TPS, 10M context window. Usado em todas as features de IA do Elevva.
 */

import { createRequire } from 'module';
import Groq from 'groq-sdk';
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

export const analyzeResume = async (
  base64Pdf: string,
  jobTitle: string,
  criteria: string,
): Promise<AnalysisResult> => {
  const apiKey = process.env.GROQ_API_KEY || '';

  if (!apiKey || apiKey.length < 10) {
    console.error('[Hermes] GROQ_API_KEY não encontrada nas variáveis de ambiente.');
    return {
      ...ERROR_BASE,
      candidateName: 'Erro de Configuração',
      summary: 'ERRO: A variável GROQ_API_KEY não foi encontrada. Configure-a nas variáveis de ambiente da Vercel.',
      cons: ['Chave de API ausente — configure GROQ_API_KEY na Vercel'],
    };
  }

  // 1. Converter base64 → Buffer → texto
  let pdfText = '';
  try {
    const cleanBase64 = base64Pdf.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const parsed = await pdfParse(buffer);
    pdfText = parsed.text?.trim() || '';
    console.log('[Hermes] PDF extraído, caracteres:', pdfText.length);
  } catch (pdfErr) {
    console.error('[Hermes] Erro ao extrair texto do PDF:', pdfErr);
    return {
      ...ERROR_BASE,
      candidateName: 'Erro na Análise',
      summary: 'Não foi possível extrair o texto do PDF. Verifique se o arquivo contém texto selecionável.',
      cons: ['PDF sem texto selecionável ou corrompido'],
    };
  }

  if (pdfText.length < 30) {
    return {
      ...ERROR_BASE,
      candidateName: 'Erro na Análise',
      summary: 'O PDF não contém texto legível. Envie um PDF com texto selecionável (não escaneado).',
      cons: ['PDF sem conteúdo de texto detectado'],
    };
  }

  // 2. Chamar Hermes 3 70B via Groq
  try {
    const client = new Groq({ apiKey });

    const customPrompt = await fetchRecruiterPrompt(jobTitle, criteria);
    const systemPrompt = customPrompt || `Você é um especialista em recrutamento e seleção. Analise o currículo abaixo para a vaga indicada e retorne APENAS um JSON válido, sem markdown, sem explicações.

VAGA: ${jobTitle}
REQUISITOS DA VAGA: ${criteria || 'Não especificados'}

Estrutura JSON obrigatória:
{
  "candidateName": "nome completo do candidato",
  "matchScore": <número de 0.0 a 10.0>,
  "yearsExperience": "tempo total de experiência exata no cargo (ex: '2 anos e 3 meses' ou 'Sem experiência')",
  "city": "cidade de residência ou 'Não informado'",
  "neighborhood": "bairro ou 'Não informado'",
  "phoneNumbers": ["telefone1", "telefone2"],
  "summary": "análise técnica de aproximadamente 400 caracteres justificando a nota",
  "pros": ["ponto forte 1", "ponto forte 2", "ponto forte 3"],
  "cons": ["ponto de atenção 1", "ponto de atenção 2", "ponto de atenção 3"],
  "workHistory": [
    { "company": "nome da empresa", "role": "cargo", "duration": "duração calculada (ex: '1 ano e 5 meses')" }
  ]
}

REGRAS DE PONTUAÇÃO (matchScore):
- 9.0 a 10.0: Experiência EXATA no cargo + todos os requisitos atendidos
- 7.0 a 8.9: Experiência exata no cargo, mas falta algum requisito
- 4.0 a 6.9: Experiência correlata, mas não exata no cargo solicitado
- 0.0 a 3.9: Sem experiência relevante para a vaga

Inclua as 3 experiências profissionais mais recentes em workHistory.`;

    const completion = await client.chat.completions.create({
      model: process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `CURRÍCULO:\n\n${pdfText.substring(0, 12000)}` },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('Resposta vazia do Hermes');

    const result = JSON.parse(content) as AnalysisResult;

    // Sanitização
    if (!result.candidateName) result.candidateName = 'Candidato (Nome não identificado)';
    if (typeof result.matchScore !== 'number' || result.matchScore < 0 || result.matchScore > 10) {
      result.matchScore = 0;
    }
    if (!Array.isArray(result.pros)) result.pros = [];
    if (!Array.isArray(result.cons)) result.cons = [];
    if (!Array.isArray(result.workHistory)) result.workHistory = [];
    if (!Array.isArray(result.phoneNumbers)) result.phoneNumbers = [];

    console.log('[Hermes] Análise concluída:', result.candidateName, '| Score:', result.matchScore);
    return result;

  } catch (err: unknown) {
    const e = err as Error & { status?: number; code?: string };
    console.error('[Hermes] Erro na chamada da API:', e.message, e.status, e.code);
    return {
      ...ERROR_BASE,
      candidateName: 'Erro na Análise',
      summary: `Erro ao processar com Hermes: ${e.message || 'Erro desconhecido'}. Verifique os logs da Vercel.`,
      cons: ['Falha na API Groq/Hermes', e.message || 'Erro desconhecido'],
    };
  }
};

// ── Tipos para o briefing diário ──────────────────────────────────────

export interface BriefingJob {
  title: string;
  newCandidates: number;
  highlights: Array<{ name: string; score: number }>;
  todayInterviews: Array<{ name: string; time: string }>;
  daysWithoutCandidates?: number;
}

export interface BriefingData {
  recruiterName: string;
  jobs: BriefingJob[];
  totalNew: number;
  totalHighlights: number;
  totalInterviewsToday: number;
}

export const generateDailyBriefing = async (data: BriefingData): Promise<string> => {
  const apiKey = process.env.GROQ_API_KEY || '';
  if (!apiKey || apiKey.length < 10) return '';

  // Se não há nada relevante para reportar, não envia
  if (data.totalNew === 0 && data.totalInterviewsToday === 0 && data.totalHighlights === 0) {
    return '';
  }

  const client = new Groq({ apiKey });

  const jobsSummary = data.jobs
    .filter(j => j.newCandidates > 0 || j.todayInterviews.length > 0 || j.highlights.length > 0 || j.daysWithoutCandidates)
    .map(j => {
      const parts: string[] = [`Vaga: ${j.title}`];
      if (j.newCandidates > 0) parts.push(`${j.newCandidates} novo(s) candidato(s)`);
      if (j.highlights.length > 0) parts.push(`Destaques: ${j.highlights.map(h => `${h.name} (${h.score}/10)`).join(', ')}`);
      if (j.todayInterviews.length > 0) parts.push(`Entrevistas hoje: ${j.todayInterviews.map(i => `${i.name} às ${i.time}`).join(', ')}`);
      if (j.daysWithoutCandidates) parts.push(`⚠️ Sem candidatos há ${j.daysWithoutCandidates} dias`);
      return parts.join(' | ');
    }).join('\n');

  try {
    const completion = await client.chat.completions.create({
      model: process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
      temperature: 0.4,
      max_tokens: 512,
      messages: [
        {
          role: 'system',
          content: `Você é o assistente de recrutamento da Elevva. Gere um resumo diário via WhatsApp para o recrutador.
Seja direto, use emojis com moderação, linguagem profissional mas amigável.
Use formatação WhatsApp (*negrito*, _itálico_).
Máximo 300 palavras. NÃO use markdown com #. Termine com uma pergunta curta de engajamento.`,
        },
        {
          role: 'user',
          content: `Gere o briefing matinal para ${data.recruiterName}.\n\nDados:\n${jobsSummary}`,
        },
      ],
    });

    return completion.choices[0]?.message?.content?.trim() || '';
  } catch (err) {
    console.error('[Hermes] Erro ao gerar briefing:', err);
    return '';
  }
};
