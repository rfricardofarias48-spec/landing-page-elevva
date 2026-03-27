
export interface WorkExperience {
  company: string;
  role: string;
  duration: string;
}

export interface AnalysisResult {
  candidateName: string;
  matchScore: number; // Agora escala de 1 a 10
  summary: string;
  city: string;        
  neighborhood: string; 
  phoneNumbers: string[]; 
  pros: string[];
  cons: string[];
  yearsExperience?: string; 
  workHistory?: WorkExperience[]; // Novo campo para lista de empresas
}

export enum CandidateStatus {
  PENDING = 'PENDING',
  UPLOADING = 'UPLOADING', // Status novo para Interface Otimista
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
  EM_ANALISE = 'EM_ANALISE',
  APROVADO = 'APROVADO',
  REPROVADO = 'REPROVADO'
}

export interface Candidate {
  id: string;
  file: File;
  fileName?: string;
  filePath?: string; // CAMPO NOVO: Caminho do arquivo no Storage
  base64Data?: string;
  status: CandidateStatus;
  result?: AnalysisResult;
  isSelected?: boolean; // Novo campo para controle de seleção
  whatsapp?: string; // WhatsApp real do banco de dados
  chatwoot_conversation_id?: string; // ID da conversa no Chatwoot
  createdAt?: number;
}

export interface Job {
  id: string;
  title: string;
  description: string;
  criteria: string;
  createdAt: number;
  candidates: Candidate[];
  isPinned?: boolean; // Novo campo para destacar a vaga
  ownerEmail?: string; // NOVO: Email do dono da vaga (visível apenas para admin)
  short_code?: string; // NOVO: Código de 5 dígitos para link curto
  auto_analyze?: boolean; // NOVO: Analisar automaticamente ao receber upload
  is_paused?: boolean; // NOVO: Impedir novos uploads
}

export type PlanType = 'ESSENCIAL' | 'PRO' | 'ENTERPRISE' | 'ADMIN';

export interface Announcement {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  isActive: boolean;
  createdAt: string;
  targetPlans: PlanType[]; // NOVO: Array de planos que podem ver o anúncio
}

export interface User {
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role?: 'ADMIN' | 'USER'; 
  status?: 'ACTIVE' | 'BLOCKED'; 
  
  // Campos de Assinatura e Limites
  plan: PlanType;
  job_limit: number;      // Máximo de vagas ativas
  resume_limit: number;   // Máximo de currículos (ciclo ou total)
  resume_usage: number;   // Currículos já usados
  subscription_status?: 'active' | 'past_due' | 'canceled' | 'trialing';
  current_period_end?: string; // NOVO: Data de renovação do plano
  features?: {
    public_link: boolean;
    priority_support: boolean;
  };
  salesperson?: string; // NOVO: Nome do vendedor (apenas admin)
  instancia_evolution?: string;
  telefone_agente?: string;
  status_automacao?: boolean;
}

// Interface para o Dashboard do Admin
export interface AdminUserProfile {
  id: string;
  email: string;
  name?: string; 
  phone?: string; 
  role: string;
  plan: string;
  status: 'ACTIVE' | 'BLOCKED';
  created_at: string;
  jobs_count?: number; 
  resume_usage?: number; // Adicionado para coluna da tabela
  last_active?: string;
  job_limit?: number; // Limite de vagas (customizável para Enterprise)
  subscription_status?: 'active' | 'past_due' | 'canceled' | 'trialing'; // Novo campo para cancelamentos
  current_period_end?: string; // NOVO: Data de renovação do plano
  salesperson?: string; // NOVO: Nome do vendedor
  instancia_evolution?: string;
  telefone_agente?: string;
  status_automacao?: boolean;
}

export interface Interview {
  id: string;
  job_id: string;
  candidate_id: string;
  slot_id?: string;
  slot_date?: string;
  slot_time?: string;
  meeting_link?: string;
  status: 'AGUARDANDO_RESPOSTA' | 'AGENDADA' | 'CONFIRMADA' | 'REMARCADA' | 'COMPLETED' | 'CANCELADA' | 'REALIZADA';
  lembrete_enviado?: boolean;
  created_at: string;
  // Relational data for UI
  candidate_name?: string;
  candidate_phone?: string;
  candidate_file_path?: string;
  job_title?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  format?: string;
  interviewer_name?: string;
}

export type ViewState = 'DASHBOARD' | 'JOB_DETAILS' | 'CREATE_JOB' | 'EDIT_JOB' | 'PUBLIC_UPLOAD' | 'SCHEDULING';

// ============================================================
// MÓDULO DE ADMISSÃO
// ============================================================

export type AdmissionStatus = 'PENDING' | 'SUBMITTED' | 'DOWNLOADED' | 'EXPIRED';

export interface RequiredDoc {
  name: string;
  required: boolean;
  frontBack: boolean; // Se exige frente e verso
  type: 'text' | 'upload'; // text = campo digitável, upload = envio de arquivo
}

export interface SubmittedDoc {
  name: string;
  file_path?: string;
  uploaded_at: string;
  file_name?: string;
  value?: string; // Valor digitado (para campos tipo text)
}

export interface Admission {
  id: string;
  user_id: string;
  job_id: string;
  candidate_id: string;
  token: string;
  required_docs: RequiredDoc[];
  submitted_docs: SubmittedDoc[];
  status: AdmissionStatus;
  created_at: string;
  submitted_at?: string;
  expires_at?: string;
  expiry_notified: boolean;
  // Campos relacionais para UI
  candidate_name?: string;
  candidate_phone?: string;
  job_title?: string;
}

// Documentos comuns pré-configurados para o modal do recrutador
export const DEFAULT_ADMISSION_DOCS: RequiredDoc[] = [
  { name: 'Nome Completo', required: true, frontBack: false, type: 'text' },
  { name: 'RG', required: true, frontBack: false, type: 'text' },
  { name: 'CPF', required: true, frontBack: false, type: 'text' },
  { name: 'Data de Nascimento', required: true, frontBack: false, type: 'text' },
  { name: 'Endereço Completo', required: true, frontBack: false, type: 'text' },
  { name: 'Número da CTPS', required: false, frontBack: false, type: 'text' },
  { name: 'PIS/PASEP', required: false, frontBack: false, type: 'text' },
  { name: 'Título de Eleitor', required: false, frontBack: false, type: 'text' },
  { name: 'CNH', required: false, frontBack: false, type: 'text' },
  { name: 'Certificado de Reservista', required: false, frontBack: false, type: 'text' },
  { name: 'Comprovante de Residência', required: false, frontBack: false, type: 'upload' },
  { name: 'Foto 3x4', required: false, frontBack: false, type: 'upload' },
];
