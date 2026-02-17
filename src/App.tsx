
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './services/supabaseClient';
import { analyzeResume } from './services/geminiService';
import { Job, Candidate, CandidateStatus, User, ViewState, AnalysisResult, Announcement } from './types';
import { JobCard } from './components/JobCard';
import { AnalysisResultCard } from './components/AnalysisResultCard';
import { LoginScreen } from './components/LoginScreen';
import { AdminDashboard } from './components/AdminDashboard';
import { PublicUploadScreen } from './components/PublicUploadScreen';
import { InterviewReportModal } from './components/InterviewReportModal';
import { ShareLinkModal } from './components/ShareLinkModal';
import { SqlSetupModal } from './components/SqlSetupModal';
import { 
  Plus, LogOut, Search, Settings, LayoutDashboard, User as UserIcon, 
  ArrowLeft, Pencil, Share2, FileCheck, Upload, Play, Trash2, CheckCircle2, X, Timer, CloudUpload, Loader2,
  Briefcase, CreditCard, Star, Zap, Crown, ArrowUpRight, Save, Key, Mail, Lock, Database, FileText, Check, ArrowRight, ShieldCheck, FileWarning, ExternalLink, RefreshCcw, Clock, Sparkles
} from 'lucide-react';

const INFINITE_PAY_LINKS = {
    MENSAL: "https://invoice.infinitepay.io/plans/velorh/fIPbnJ9j", 
    ANUAL: "https://invoice.infinitepay.io/plans/velorh/3csXVcCRLP"
};

type UserTab = 'OVERVIEW' | 'JOBS' | 'BILLING' | 'SETTINGS';

// Helper function moved outside to be accessible by effects
const mapCandidateFromDB = (c: any): Candidate => ({
  id: c.id,
  file: new File([], c.filename || 'currículo.pdf'), // Placeholder file object
  fileName: c.filename,
  filePath: c.file_path,
  status: c.status as CandidateStatus,
  result: c.analysis_result,
  isSelected: c.is_selected
});

// Helper para detecção robusta de rota pública
const isPublicRoute = () => {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    const path = window.location.pathname;
    
    // Verifica se existe QUALQUER coisa relevante na URL que indique acesso a vaga
    // #123456, ?uploadJobId=..., ou /123456
    const hasHash = hash.length > 1; // Apenas # não conta
    const hasParam = !!params.get('uploadJobId');
    const hasPathId = path.length > 1 && /^\/\d+/.test(path);
    
    return hasHash || hasParam || hasPathId;
};

const LegalModal: React.FC<{ title: string; onClose: () => void }> = ({ title, onClose }) => (
  <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in font-sans">
    <div className="bg-white rounded-[2rem] w-full max-w-2xl p-8 shadow-2xl relative animate-slide-up border-4 border-black">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors border border-slate-200 hover:border-black text-slate-400 hover:text-black">
            <X className="w-5 h-5"/>
        </button>
        <h2 className="text-3xl font-black text-slate-900 mb-6 tracking-tighter">{title}</h2>
        <div className="space-y-4 text-sm font-medium text-slate-600 overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
            <p className="font-bold text-slate-900">1. Introdução</p>
            <p>Bem-vindo ao VeloRH. Ao utilizar nossa plataforma, você concorda com os termos descritos abaixo.</p>
            
            <p className="font-bold text-slate-900 mt-4">2. Dados e Privacidade</p>
            <p>Respeitamos a LGPD. Seus dados são utilizados apenas para fins de recrutamento e seleção, processados de forma segura e confidencial.</p>
            
            <p className="font-bold text-slate-900 mt-4">3. Responsabilidades</p>
            <p>O VeloRH atua como facilitador tecnológico. A responsabilidade pela seleção final dos candidatos é exclusiva da empresa anunciante.</p>
            
            <p className="mt-4 text-xs text-slate-400 uppercase font-bold">Última atualização: {new Date().toLocaleDateString()}</p>
        </div>
        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
            <button onClick={onClose} className="bg-black text-white px-6 py-3 rounded-xl font-bold text-sm shadow-[4px_4px_0px_0px_rgba(204,243,0,1)] hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(204,243,0,1)] transition-all border-2 border-black">
                Entendido
            </button>
        </div>
    </div>
  </div>
);

export const App: React.FC = () => {
  // --- STATE ---
  const [user, setUser] = useState<User | null>(null);
  const [isOAuthUser, setIsOAuthUser] = useState(false); // Detecta se é login Google
  const [loading, setLoading] = useState(true);
  
  // INICIALIZAÇÃO PREGUIÇOSA (LAZY STATE) PARA DETECTAR URL ANTES DO RENDER
  // Isso evita o "flicker" da tela de login
  const [view, setView] = useState<ViewState>(() => {
      return isPublicRoute() ? 'PUBLIC_UPLOAD' : 'DASHBOARD';
  });

  const [currentTab, setCurrentTab] = useState<UserTab>('OVERVIEW');
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  
  // UI Controls
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Name Update Modal State
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempName, setTempName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  // Recovery Password Modal State
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [isSavingRecovery, setIsSavingRecovery] = useState(false);

  // Legal Modals
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  
  // Settings State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Drag & Drop
  const [isDragging, setIsDragging] = useState(false);

  // Analysis
  const [analysisMetrics, setAnalysisMetrics] = useState<{ isAnalyzing: boolean; processedCount: number; timeTaken: string | null }>({
    isAnalyzing: false,
    processedCount: 0,
    timeTaken: null
  });

  // Public Upload State
  const [publicUploadJobId, setPublicUploadJobId] = useState<string | null>(null);
  // Guardamos informações extras para auto-análise e pausa
  const [publicJobData, setPublicJobData] = useState<{ title: string; criteria?: string; autoAnalyze?: boolean; isPaused?: boolean }>({ title: '' });

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- REALTIME SUBSCRIPTION ---
  useEffect(() => {
    if (!user) return;

    // Escuta mudanças na tabela 'candidates' para atualizar a tela em tempo real
    const channel = supabase
      .channel('realtime-candidates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'candidates' },
        (payload) => {
          const newRecord = payload.new;
          
          // Atualiza a lista de Jobs globalmente
          setJobs(currentJobs => {
              // Verifica se a vaga pertence a este usuário
              const jobExists = currentJobs.some(j => j.id === newRecord.job_id);
              if (!jobExists) return currentJobs;

              const newCandidate = mapCandidateFromDB(newRecord);
              
              return currentJobs.map(j => {
                  if (j.id === newRecord.job_id) {
                      // Evita duplicatas se já tivermos adicionado (ex: upload manual)
                      if (j.candidates.some(c => c.id === newCandidate.id)) return j;
                      return { ...j, candidates: [newCandidate, ...j.candidates] };
                  }
                  return j;
              });
          });

          // Atualiza a Vaga Ativa se ela estiver aberta na tela
          setActiveJob(currentActive => {
              if (currentActive && currentActive.id === newRecord.job_id) {
                   const newCandidate = mapCandidateFromDB(newRecord);
                   if (currentActive.candidates.some(c => c.id === newCandidate.id)) return currentActive;
                   return { ...currentActive, candidates: [newCandidate, ...currentActive.candidates] };
              }
              return currentActive;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // --- INIT & AUTH ---
  useEffect(() => {
    // Timeout de segurança: Se o Supabase não responder em 10s, para o loading
    const safetyTimer = setTimeout(() => {
        if (loading) {
            console.warn("Auth check timed out - forcing loading stop");
            setLoading(false);
        }
    }, 10000);

    // FIX: Proactively check for "Invalid Refresh Token" error to prevent white screen
    supabase.auth.getSession().then(({ error }) => {
        if (error) {
            console.warn("Session check warning:", error.message);
            // Se o token de refresh não for encontrado, força logout para limpar o localStorage
            if (error.message.includes("Refresh Token") || error.message.includes("Invalid Refresh Token")) {
                 console.log("Cleaning up invalid session...");
                 supabase.auth.signOut().then(() => {
                     setLoading(false);
                     setUser(null);
                 });
            }
        }
    });

    // 1. Configura ouvinte de autenticação (Melhor para OAuth/Google Login)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        // DETECTA EVENTO DE RECUPERAÇÃO DE SENHA
        if (event === 'PASSWORD_RECOVERY') {
            setShowRecoveryModal(true);
        }

        if (session) {
             // Limpa a hash da URL (token) para deixar limpo e evitar erros de roteamento
             if (window.location.hash && window.location.hash.includes('access_token')) {
                 window.history.replaceState(null, '', window.location.pathname);
             }
             
             // Detecta se o usuário fez login com Google (provider)
             const providers = session.user.app_metadata.providers || [];
             if (providers.includes('google')) {
                 setIsOAuthUser(true);
             } else {
                 setIsOAuthUser(false);
             }
             
             // Se tiver sessão, busca o perfil.
             fetchUserProfile(session.user.id, session.user.email!);
        } else {
             // Se não tiver sessão (logout ou inicial), para o loading
             setLoading(false);
             setUser(null);
             setJobs([]);
             setIsOAuthUser(false);
             
             // VERIFICAÇÃO CRÍTICA: Só redireciona para Dashboard se NÃO for rota pública
             // Isso impede que quem está enviando currículo caia no login
             if (!isPublicRoute()) {
                 setView('DASHBOARD');
             } else {
                 // Garante que a view permaneça PUBLIC_UPLOAD
                 setView('PUBLIC_UPLOAD');
             }
        }
    });

    // 2. CHECK FOR OAUTH ERRORS (Novo)
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const errorCode = params.get('error_code');
    const errorDesc = params.get('error_description');

    if (error) {
        console.error("OAuth Error Detected:", error, errorCode, errorDesc);
        
        // Tratamento específico para o erro de 'bad_oauth_state' que ocorre quando há mismatch de porta
        if (errorCode === 'bad_oauth_state' || errorDesc?.includes('state')) {
            alert(
                "Atenção: Erro de Configuração de Login\n\n" +
                "O Google redirecionou para uma porta diferente da que você iniciou.\n" +
                "Isso geralmente acontece quando o Supabase está configurado para 'localhost:3000' mas você está usando 'localhost:5173'.\n\n" +
                "SOLUÇÃO:\n" +
                "1. Vá ao painel do Supabase > Authentication > URL Configuration.\n" +
                "2. Mude o 'Site URL' para http://localhost:5173\n" +
                "3. Adicione http://localhost:5173 na lista de Redirect URLs."
            );
        } else {
            alert(`Erro no Login: ${errorDesc || error}. Tente novamente.`);
        }
        // Limpa a URL para não ficar mostrando o erro
        window.history.replaceState(null, '', window.location.pathname);
    }
    
    // 3. Lógica de Upload Público (URL Checks - Execução Imediata)
    const legacyUploadId = params.get('uploadJobId');
    const hash = window.location.hash;
    const hashMatch = hash.match(/^#\/?(\d+)$/); // Permissive regex
    const path = window.location.pathname;
    const pathMatch = path.match(/^\/(\d+)$/);

    // Prioriza configuração da rota pública para garantir que os dados da vaga sejam carregados
    if (legacyUploadId) {
        setPublicUploadJobId(legacyUploadId);
        fetchPublicJobTitle(legacyUploadId);
        setView('PUBLIC_UPLOAD');
    } else if (hashMatch) {
        const code = hashMatch[1];
        setView('PUBLIC_UPLOAD');
        fetchPublicJobByCode(code);
    } else if (pathMatch) {
        const code = pathMatch[1];
        setView('PUBLIC_UPLOAD');
        fetchPublicJobByCode(code);
    }
    
    // Limpeza na desmontagem
    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, []);

  // --- RESTO DO CÓDIGO PERMANECE O MESMO ---
  
  // --- RETENTION POLICY CLEANUP ---
  const runDataRetentionCleanup = async (userId: string) => {
    // Apaga currículos com mais de 10 dias
    const RETENTION_DAYS = 10;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    const cutoffISO = cutoffDate.toISOString();

    try {
        // 1. Identificar currículos antigos
        // Nota: Precisamos selecionar apenas os candidatos que TEM file_path
        const { data: oldCandidates, error } = await supabase
            .from('candidates')
            .select('id, file_path, created_at')
            .lt('created_at', cutoffISO)
            .not('file_path', 'is', null);

        if (error) {
            console.error("Erro ao verificar retenção:", error);
            return;
        }

        if (oldCandidates && oldCandidates.length > 0) {
            console.log(`🧹 Iniciando limpeza de ${oldCandidates.length} currículos expirados (>10 dias)...`);

            // 2. Apagar Arquivos do Storage
            const filesToRemove = oldCandidates.map(c => c.file_path).filter(Boolean);
            if (filesToRemove.length > 0