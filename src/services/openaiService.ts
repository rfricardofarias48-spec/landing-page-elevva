/**
 * OpenAI Service — Análise de Currículos
 * Extrai texto do PDF com pdf-parse e analisa com gpt-4o-mini.
 */

import { createRequire } from 'module';
import OpenAI from 'openai';
import { AnalysisResult } from '../types.js';

// Busca o prompt configurável do banco; usa padrão se não encontrar
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
  } catch {
    // fallback silencioso
  }
  return ''; // vazio = usa o padrão hardcoded
}

// pdf-parse é CJS — usar createRequire para compatibilidade com ESM
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

export const analyzeResume = async (
  base64Pdf: string,
  jobTitle: string,
  criteria: string,
): Promise<AnalysisResult> => {
  const apiKey = process.env.OPENAI_API_KEY || '';

  if (!apiKey || apiKey.length < 10) {
    console.error('[OpenAI] OPENAI_API_KEY não encontrada nas variáveis de ambiente.');
    return {
      ...ERROR_BASE,
      candidateName: 'Erro de Configuração',
      summary: 'ERRO: A variável OPENAI_API_KEY não foi encontrada. Configure-a nas variáveis de ambiente da Vercel.',
      cons: ['Chave de API ausente — configure OPENAI_API_KEY na Vercel'],
    };
  }

  // 1. Converter base64 → Buffer → texto
  let pdfText = '';
  try {
    const cleanBase64 = base64Pdf.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const parsed = await pdfParse(buffer) as { text: string };
    pdfText = parsed.text?.trim() || '';
    console.log('[OpenAI] PDF extraído, caracteres:', pdfText.length);
  } catch (pdfErr) {
    console.error('[OpenAI] Erro ao extrair texto do PDF:', pdfErr);
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

  // 2. Chamar gpt-4o-mini
  try {
    const client = new OpenAI({ apiKey });

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
      model: 'gpt-5.4-nano',
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 800,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `CURRÍCULO:\n\n${pdfText.substring(0, 8000)}` },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('Resposta vazia da OpenAI');

    const result = JSON.parse(content) as AnalysisResult;

    // Sanitização básica
    if (!result.candidateName) result.candidateName = 'Candidato (Nome não identificado)';
    if (typeof result.matchScore !== 'number' || result.matchScore < 0 || result.matchScore > 10) {
      result.matchScore = 0;
    }
    if (!Array.isArray(result.pros)) result.pros = [];
    if (!Array.isArray(result.cons)) result.cons = [];
    if (!Array.isArray(result.workHistory)) result.workHistory = [];
    if (!Array.isArray(result.phoneNumbers)) result.phoneNumbers = [];

    console.log('[OpenAI] Análise concluída:', result.candidateName, '| Score:', result.matchScore);
    return result;

  } catch (err: unknown) {
    const e = err as Error & { status?: number; code?: string };
    console.error('[OpenAI] Erro na chamada da API:', e.message, e.status, e.code);
    return {
      ...ERROR_BASE,
      candidateName: 'Erro na Análise',
      summary: `Erro ao processar com OpenAI: ${e.message || 'Erro desconhecido'}. Verifique os logs da Vercel.`,
      cons: ['Falha na API OpenAI', e.message || 'Erro desconhecido'],
    };
  }
};
