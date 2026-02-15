
import { GoogleGenAI, Type, Schema, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AnalysisResult } from "../types";

// CHAVE PAGAMENTO POR USO (PAY-AS-YOU-GO) - ALTA CAPACIDADE
const API_KEY = "AIzaSyC4ck5oaFDCAS-TIeqoK__OQhOkf403xpI";

const ai = new GoogleGenAI({ apiKey: API_KEY });

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
  
  const prompt = `
    Você é um Recrutador Técnico Sênior (Headhunter) EXTREMAMENTE CRÍTICO, CÉTICO e RIGOROSO.
    
    DADOS DA VAGA:
    - Título Exato: "${jobTitle}"
    - Requisitos Obrigatórios: "${criteria}"
    
    REGRAS DE OURO PARA PONTUAÇÃO (MATCH SCORE):
    1. EXPERIÊNCIA EXATA É OBRIGATÓRIA PARA NOTAS ALTAS:
       - Se o candidato NÃO trabalhou em um cargo com título IGUAL ou SINÔNIMO DIRETO da vaga, a nota MÁXIMA é 6.5.
       - Exemplo: Se a vaga é "Ajudante de Carga e Descarga" e o candidato foi "Auxiliar de Produção", a nota NÃO PODE passar de 6.5, mesmo que as tarefas sejam parecidas. Isso é experiência correlata, não direta.
    
    2. ESCALA DE NOTAS (SEJA SEVERO):
       - 9.0 a 10.0: O candidato JÁ ATUOU EXATAMENTE no cargo solicitado por mais de 2 anos E tem todos os requisitos.
       - 7.0 a 8.9: O candidato JÁ ATUOU no cargo solicitado, mas por pouco tempo ou falta algum requisito secundário.
       - 5.0 a 6.9: O candidato NUNCA atuou no cargo, mas tem experiência em áreas próximas (Ex: Produção p/ Logística).
       - 0.0 a 4.9: Sem experiência relevante.

    3. ANÁLISE:
       - No 'summary': Se ele não tem o cargo exato, comece a frase dizendo: "O candidato não possui experiência direta como ${jobTitle}...".
       - No 'cons': Cite explicitamente a falta de experiência no título da vaga como ponto negativo principal.

    4. CÁLCULO DE TEMPO DE EXPERIÊNCIA (RIGOR MÁXIMO):
       - O campo 'yearsExperience' deve somar APENAS o tempo em cargos que são IDÊNTICOS ao título da vaga.
       - VETO TOTAL a cargos correlatos. Ex: Se a vaga é "Motorista", experiência de "Ajudante de Motorista" conta como ZERO.
       - VETO TOTAL a áreas próximas. Ex: "Auxiliar de Produção" para vaga de "Carga e Descarga" conta como ZERO.
       - Se o candidato não tem experiência EXATA no título, 'yearsExperience' deve ser "Sem experiência direta".

    Analise o PDF em anexo e retorne APENAS o JSON.
  `;

  // MODELOS OTIMIZADOS PARA VELOCIDADE (SPEED FIRST)
  // Gemini 3 Flash Preview é atualmente o estado da arte em velocidade
  const modelsToTry = [
    "gemini-3-flash-preview", 
    "gemini-2.5-flash",
    "gemini-1.5-flash"
  ];

  // Configuração de segurança permissiva para currículos
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
          temperature: 0.1, // Leve aumento para evitar bloqueios de repetição, mas mantendo determinismo
          topK: 20, // Otimização de performance: reduz espaço de busca
          safetySettings: safetySettings
        },
      });

      const text = response.text;
      if (!text) throw new Error("Resposta vazia da IA");
      
      const parsed = JSON.parse(cleanJsonString(text)) as AnalysisResult;
      
      // Validação básica
      if (!parsed.candidateName) parsed.candidateName = "Candidato (Nome não encontrado)";
      
      return parsed;

    } catch (error: any) {
      const isRateLimit = error.status === 429 || (error.message && error.message.includes("429"));
      if (isRateLimit) {
         console.warn(`Rate limit hit for ${modelName}, waiting briefly...`);
         // Delay curto progressivo
         await sleep(1000); 
         continue;
      }
      console.warn(`Erro no modelo ${modelName}:`, error);
    }
  }

  // Fallback final de erro
  return {
    candidateName: "Erro na Análise",
    matchScore: 0,
    yearsExperience: "-",
    city: "-",
    neighborhood: "-",
    phoneNumbers: [],
    summary: "A IA não conseguiu processar este arquivo. Verifique se o PDF contém texto selecionável (não é apenas uma imagem) ou se o arquivo não está corrompido.",
    pros: [],
    cons: ["Arquivo ilegível ou erro de conexão com a IA"],
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
