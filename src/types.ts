
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
  ERROR = 'ERROR'
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

export type PlanType = 'FREE' | 'MENSAL' | 'TRIMESTRAL' | 'ANUAL';

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
  features?: {
    public_link: boolean;
    priority_support: boolean;
  };
  salesperson?: string; // NOVO: Nome do vendedor (apenas admin)
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
  subscription_status?: 'active' | 'past_due' | 'canceled' | 'trialing'; // Novo campo para cancelamentos
  salesperson?: string; // NOVO: Nome do vendedor
}

export type ViewState = 'DASHBOARD' | 'JOB_DETAILS' | 'CREATE_JOB' | 'EDIT_JOB' | 'PUBLIC_UPLOAD';
