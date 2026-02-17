
import { GoogleGenAI, Type, Schema, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AnalysisResult } from "../types";

// NÃO inicialize o 'ai' aqui fora. Isso causa erro se a chave não estiver pronta ao carregar a página.

const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    candidateName: {
      type: Type.STRING,
      description: "Nome do candidato ou 'Não identificado'.",
    },
    matchScore: {
      type: Type.NUMBER,
      description: "Nota de 0.0 a 10.0. SE NÃO TIVER EXPERIÊNCIA NO CARGO EXATO, A NOTA MÁXIMA É 6.0.",
    },
    yearsExperience: {
      type: Type.STRING,
      description: "Tempo TOTAL de experiência ESTRITAMENTE no cargo solicitado. Ignore funções correlatas. Se zero, retorne 'Sem experiência'.",
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
      description: "Análise técnica detalhada (aprox. 400 caracteres). Deve justificar a nota. Se a nota for baixa por falta de experiência exata, diga isso explicitamente.",
    },
    pros: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3 pontos fortes técnicos específicos (Hard Skills) que atendem à vaga.",
    },
    cons: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3 pontos de atenção técnicos (Falta de experiência no cargo exato é o principal ponto de atenção).",
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
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
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
  
  // 1. Verificação de Segurança (Runtime)
  // Tenta pegar de process.env (injetado pelo Vite) ou import.meta.env (padrão Vite)
  const apiKey = process.env.API_KEY || (import.meta as any).env?.VITE_API_KEY || (import.meta as any).env?.API_KEY;
  
  if (!apiKey || apiKey.trim() === '') {
      console.error("ERRO CRÍTICO: Chave de API não encontrada.");
      return {
        candidateName: "Erro de Configuração",
        matchScore: 0,
        yearsExperience: "-",
        city: "-",
        neighborhood: "-",
        phoneNumbers: [],
        summary: "A chave de API do Google (Gemini) não foi detectada. Verifique se o arquivo .env contendo 'API_KEY' está na raiz do projeto e reinicie o servidor.",
        pros: [],
        cons: ["Chave API_KEY ausente ou vazia"],
        workHistory: []
      };
  }

  // Inicializa o cliente APENAS agora que temos certeza da chave
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    DADOS DA VAGA:
    Cargo: "${jobTitle}"
    Requisitos: "${criteria}"
    
    INSTRUÇÕES DE ANÁLISE (SEJA RIGOROSO):
    1. MATCH SCORE (0-10):
       - 9.0-10.0: Experiência EXATA no cargo + Requisitos.
       - 0.0-6.5: Se o cargo atual/anterior NÃO for igual ou sinônimo direto (Ex: "Auxiliar" para vaga de "Operador"). Experiência correlata NÃO conta como experiência exata.
    
    2. EXTRAÇÃO:
       - Resuma a experiência focando APENAS no que é relevante para "${jobTitle}".
       - Se não tiver experiência exata, deixe claro no resumo.
    
    Analise o PDF e retorne JSON.
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
          temperature: 0.1,
          topK: 20,
          safetySettings: safetySettings
        },
      });

      const text = response.text;
      if (!text) throw new Error("Resposta vazia da IA");
      
      const cleanedText = cleanJsonString(text);
      const parsed = JSON.parse(cleanedText) as AnalysisResult;
      
      if (!parsed.candidateName) parsed.candidateName = "Candidato (Nome não identificado)";
      
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
    summary: "O arquivo não pôde ser processado pela IA. Tente novamente mais tarde.",
    pros: [],
    cons: ["Falha de processamento"],
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
