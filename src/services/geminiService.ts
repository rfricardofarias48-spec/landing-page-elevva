
import { GoogleGenAI, Type, Schema, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AnalysisResult } from "../types";

// NOTA: A inicialização global foi removida para evitar que o app quebre ao carregar
// se a API Key não estiver presente. Agora a verificação é feita no momento do uso.

const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    candidateName: {
      type: Type.STRING,
      description: "Nome do candidato ou 'Não identificado'.",
    },
    matchScore: {
      type: Type.NUMBER,
      description: "Nota de 0.0 a 10.0. AVALIAÇÃO COMPORTAMENTAL E TÉCNICA. Se o candidato tem histórico de trabalho, a nota mínima é 3.0.",
    },
    yearsExperience: {
      type: Type.STRING,
      description: "Tempo TOTAL de experiência profissional somada. Se zero ou não encontrado, retorne 'Sem experiência'.",
    },
    city: {
      type: Type.STRING,
      description: "Cidade de residência ou 'Não informado'.",
    },
    neighborhood: {
      type: Type.STRING,
      description: "Bairro ou 'Não informado'.",
    },
    phoneNumbers: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Lista de telefones encontrados.",
    },
    summary: {
      type: Type.STRING,
      description: "Resumo focando em: Estabilidade, Cargos Anteriores e Potencial para a vaga atual.",
    },
    pros: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3 pontos fortes (Hard Skills, Soft Skills, Estabilidade, Distância, etc).",
    },
    cons: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3 pontos de atenção.",
    },
    workHistory: {
      type: Type.ARRAY,
      description: "3 experiências profissionais mais relevantes.",
      items: {
        type: Type.OBJECT,
        properties: {
          company: { type: Type.STRING, description: "Empresa" },
          role: { type: Type.STRING, description: "Cargo" },
          duration: { type: Type.STRING, description: "Duração calculada (Ex: '1 ano e 5 meses'). Não use datas." }
        }
      }
    }
  },
  required: ["candidateName", "matchScore", "summary", "city", "neighborhood", "phoneNumbers", "pros", "cons", "workHistory"],
};

function cleanJsonString(text: string): string {
  if (!text) return "{}";
  // Remove markdown code blocks e espaços extras
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  
  // Tenta encontrar o JSON válido mais externo
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  
  return cleaned;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const analyzeResume = async (
  base64Pdf: string,
  jobTitle: string,
  criteria: string
): Promise<AnalysisResult> => {
  
  // 1. Verificação de Segurança da API Key (Runtime)
  // Isso impede que o app trave inteiramente se a chave estiver faltando.
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey.trim() === '') {
      console.error("CRITICAL ERROR: API_KEY is missing in environment variables.");
      return {
        candidateName: "Erro de Configuração",
        matchScore: 0,
        yearsExperience: "-",
        city: "-",
        neighborhood: "-",
        phoneNumbers: [],
        summary: "A chave de API do Google (Gemini) não foi detectada. Se estiver rodando localmente, verifique se o arquivo .env contendo API_KEY está na raiz do projeto. Se estiver na Vercel, adicione a Environment Variable 'API_KEY'.",
        pros: [],
        cons: ["Contate o administrador do sistema"],
        workHistory: []
      };
  }

  // Inicializa o cliente APENAS quando a função é chamada e temos certeza que a chave existe
  const ai = new GoogleGenAI({ apiKey });

  // Tratamento para vagas de teste ou títulos muito curtos
  const isGenericJob = !jobTitle || jobTitle.length < 3 || ['teste', 'test', 'vaga', 'geral', 'admin'].includes(jobTitle.toLowerCase());
  
  const safeTitle = isGenericJob ? "Profissional (Análise Geral)" : jobTitle;
  const safeCriteria = isGenericJob 
    ? "Avalie a qualidade do currículo, estabilidade profissional, clareza e soft skills." 
    : criteria;

  const prompt = `
    VOCÊ É UM RECRUTADOR HUMANO E SENSATO.
    
    ANALISE O CURRÍCULO PARA: "${safeTitle}"
    CONTEXTO: "${safeCriteria}"
    
    SUA MISSÃO: DAR UMA NOTA JUSTA (0 a 10).
    
    REGRAS DE PONTUAÇÃO (MATCH SCORE):
    1. **NOTA 0.0 A 2.9 (REJEIÇÃO)**: 
       - APENAS para currículos ilegíveis, em branco, ou candidatos sem NENHUMA experiência profissional (primeiro emprego sem curso).
    
    2. **NOTA 3.0 A 5.9 (POTENCIAL / TRANSIÇÃO)**:
       - Candidato tem experiência de trabalho (ex: Operacional, Vendas), mas em área diferente da vaga.
       - TEM VALOR: Mostra responsabilidade, pontualidade e soft skills. NÃO DÊ ZERO.
    
    3. **NOTA 6.0 A 8.5 (BOM CANDIDATO)**:
       - Tem experiência correlata ou skills transferíveis.
       - Ex: "Auxiliar Administrativo" aplicando para "Financeiro".
    
    4. **NOTA 8.6 A 10.0 (EXCELENTE)**:
       - Experiência exata no cargo e atende todos os requisitos.

    ATENÇÃO: Se a vaga for "teste" ou genérica, baseie a nota na qualidade geral do profissional (tempo de casa nas empresas anteriores conta muito pontos).

    Retorne APENAS o JSON.
  `;

  const modelsToTry = [
    "gemini-3-flash-preview", 
    "gemini-2.0-flash-exp"
  ];

  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ];

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            { inlineData: { mimeType: "application/pdf", data: base64Pdf } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: analysisSchema,
          temperature: 0.2, 
          topK: 20,
          safetySettings: safetySettings
        },
      });

      const text = response.text;
      if (!text) throw new Error("Resposta vazia da IA");
      
      const cleanedText = cleanJsonString(text);
      const parsed = JSON.parse(cleanedText) as AnalysisResult;
      
      // Sanitização básica
      if (!parsed.candidateName) parsed.candidateName = "Candidato (Nome não identificado)";
      
      // --- FALLBACK DE SEGURANÇA CONTRA NOTA ZERO ---
      const hasExperience = parsed.workHistory && parsed.workHistory.length > 0;
      const experienceText = parsed.yearsExperience ? parsed.yearsExperience.toLowerCase() : '';
      const notZeroExp = !experienceText.includes('sem experiência') && !experienceText.includes('nunca trabalhou');

      if ((parsed.matchScore < 3.0) && (hasExperience || notZeroExp)) {
          // Nota de corte para "Tem experiência mas não é da área"
          parsed.matchScore = 4.5; 
          if (!parsed.summary.includes("nota")) {
             parsed.summary += " (Nota ajustada baseada no histórico profissional pregresso e soft skills identificadas).";
          }
      }
      
      return parsed;

    } catch (error: any) {
      const isRateLimit = error.status === 429 || (error.message && error.message.includes("429"));
      
      if (isRateLimit) {
         console.warn(`Rate limit hit for ${modelName}.`);
         if (modelName !== modelsToTry[modelsToTry.length - 1]) {
             await sleep(1500); 
             continue; 
         }
      }
      
      console.warn(`Erro no modelo ${modelName}:`, error);
      if (modelName !== modelsToTry[modelsToTry.length - 1]) {
          continue;
      }
    }
  }

  return {
    candidateName: "Erro na Análise",
    matchScore: 0,
    yearsExperience: "-",
    city: "-",
    neighborhood: "-",
    phoneNumbers: [],
    summary: "O arquivo não pôde ser processado. Verifique se é um PDF válido com texto selecionável.",
    pros: [],
    cons: ["Falha de processamento ou arquivo corrompido"],
    workHistory: []
  };
};

export const analyzeText = async (resumeText: string): Promise<AnalysisResult> => {
  return {
    candidateName: "Função Desativada",
    matchScore: 0,
    summary: "Use upload de PDF.",
    city: "", neighborhood: "", phoneNumbers: [], pros: [], cons: [], yearsExperience: "", workHistory: []
  };
};
