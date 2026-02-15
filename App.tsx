
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
  Briefcase, CreditCard, Star, Zap, Crown, ArrowUpRight, Save, Key, Mail, Lock, Database, FileText, Check, ArrowRight, ShieldCheck, FileWarning, ExternalLink
} from 'lucide-react';

const INFINITE_PAY_LINKS = {
    MENSAL: "https://invoice.infinitepay.io/plans/velorh/fIPbnJ9j", 
    ANUAL: "https://invoice.infinitepay.io/plans/velorh/3csXVcCRLP"
};

type UserTab = 'OVERVIEW' | 'JOBS' | 'BILLING' | 'SETTINGS';

const App: React.FC = () => {
  // --- STATE ---
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [view, setView] = useState<ViewState>('DASHBOARD');
  const [currentTab, setCurrentTab] = useState<UserTab>('JOBS');
  
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

  // Public Upload
  const [publicUploadJobId, setPublicUploadJobId] = useState<string | null>(null);
  const [publicJobTitle, setPublicJobTitle] = useState<string>('');

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- INIT & AUTH ---
  useEffect(() => {
    checkSession();
    
    // Check URL for public upload
    // Case 1: Legacy ?uploadJobId=XYZ
    const params = new URLSearchParams(window.location.search);
    const legacyUploadId = params.get('uploadJobId');
    
    // Case 2: Short Code /12345
    const path = window.location.pathname;
    const shortCodeMatch = path.match(/^\/(\d{5})$/);

    if (legacyUploadId) {
        setPublicUploadJobId(legacyUploadId);
        fetchPublicJobTitle(legacyUploadId);
        setView('PUBLIC_UPLOAD');
    } else if (shortCodeMatch) {
        const code = shortCodeMatch[1];
        fetchPublicJobByCode(code);
    }
  }, []);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await fetchUserProfile(session.user.id, session.user.email!);
    } else {
      setLoading(false);
    }
  };

  const fetchUserProfile = async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      
      if (error && error.code !== 'PGRST116') {
        console.error("Erro ao buscar perfil:", error);
      }

      const profile = data ? {
        ...data,
        name: data.name || 'Usuário'
      } : {
        id: userId,
        email: email,
        name: 'Usuário',
        plan: 'FREE',
        job_limit: 3,
        resume_limit: 25, // NOVO LIMITE PADRÃO
        resume_usage: 0,
        role: 'USER'
      };

      setUser(profile);
      await fetchJobs(userId);
      await fetchAnnouncements(); // Buscar Anúncios
    } catch (error) {
      console.error("Erro no fluxo de perfil:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (email: string, pass: string, name?: string, phone?: string, isRegister?: boolean) => {
    try {
      let result;
      if (isRegister) {
        result = await supabase.auth.signUp({ 
            email, 
            password: pass,
            options: { data: { name, phone } }
        });
        if (result.data.user) {
           // Create profile
           await supabase.from('profiles').insert([{
             id: result.data.user.id,
             email,
             name: name || 'Usuário',
             phone,
             plan: 'FREE',
             job_limit: 3,
             resume_limit: 25, // NOVO LIMITE PADRÃO
             resume_usage: 0
           }]);
           await fetchUserProfile(result.data.user.id, email);
           return { success: true };
        }
      } else {
        result = await supabase.auth.signInWithPassword({ email, password: pass });
        if (result.data.user) {
            await fetchUserProfile(result.data.user.id, email);
            return { success: true };
        }
      }
      return { success: false, error: result.error?.message };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setJobs([]);
    setView('DASHBOARD');
  };

  // --- DATA FETCHING ---
  const fetchJobs = async (userId: string) => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*, candidates(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Erro ao buscar vagas:", error);
      return;
    }

    const formattedJobs: Job[] = data.map((j: any) => ({
      ...j,
      createdAt: new Date(j.created_at).getTime(),
      candidates: j.candidates ? j.candidates.map(mapCandidateFromDB) : []
    }));

    setJobs(formattedJobs);
  };

  const fetchAnnouncements = async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (!error && data) {
          const mappedAds: Announcement[] = data.map((a: any) => {
              const { data: urlData } = supabase.storage.from('marketing').getPublicUrl(a.image_path);
              return {
                  id: a.id,
                  title: a.title,
                  imageUrl: urlData.publicUrl,
                  linkUrl: a.link_url,
                  isActive: a.is_active,
                  createdAt: a.created_at,
                  targetPlans: a.target_plans || ['FREE', 'MENSAL', 'ANUAL'] // Map target plans
              };
          });
          setAnnouncements(mappedAds);
      }
  };

  const fetchPublicJobTitle = async (id: string) => {
      const { data } = await supabase.from('jobs').select('title').eq('id', id).single();
      if (data) setPublicJobTitle(data.title);
  };

  const fetchPublicJobByCode = async (code: string) => {
      const { data, error } = await supabase.from('jobs').select('id, title').eq('short_code', code).single();
      if (data) {
          setPublicUploadJobId(data.id);
          setPublicJobTitle(data.title);
          setView('PUBLIC_UPLOAD');
      } else {
          console.error("Vaga não encontrada para o código:", code);
          // Opcional: Redirecionar para home se não achar
          window.history.pushState({}, '', '/');
      }
  };

  const mapCandidateFromDB = (c: any): Candidate => ({
    id: c.id,
    file: new File([], c.filename || 'currículo.pdf'), // Placeholder file object
    fileName: c.filename,
    filePath: c.file_path,
    status: c.status as CandidateStatus,
    result: c.analysis_result,
    isSelected: c.is_selected
  });

  // --- ACTIONS ---
  
  const generateShortCode = () => {
      return Math.floor(10000 + Math.random() * 90000).toString();
  };

  const handleJobFormSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const title = (form.elements.namedItem('title') as HTMLInputElement).value;
      const description = (form.elements.namedItem('description') as HTMLTextAreaElement).value;
      const criteria = (form.elements.namedItem('criteria') as HTMLTextAreaElement).value;

      if (isEditing && activeJob) {
          const { error } = await supabase
            .from('jobs')
            .update({ title, description, criteria })
            .eq('id', activeJob.id);

          if (!error) {
              setJobs(prev => prev.map(j => j.id === activeJob.id ? { ...j, title, description, criteria } : j));
              setActiveJob(prev => prev ? { ...prev, title, description, criteria } : null);
          }
      } else if (user) {
          // Geração de Código Curto
          const shortCode = generateShortCode();
          
          const { data, error } = await supabase
            .from('jobs')
            .insert([{ 
                user_id: user.id, 
                title, 
                description, 
                criteria,
                short_code: shortCode
            }])
            .select()
            .single();
            
          if (error) {
              console.error("Erro ao criar vaga:", error);
              // Fallback para erro de coluna: tenta criar sem short_code (compatibilidade)
              if (error.message?.includes('short_code')) {
                   alert("Atenção: Seu banco de dados precisa ser atualizado para suportar links curtos. Vá em Configurações > Banco de Dados.");
              }
              return;
          }

          if (data) {
              const newJob: Job = {
                  ...data,
                  createdAt: new Date(data.created_at).getTime(),
                  candidates: []
              };
              setJobs([newJob, ...jobs]);
          }
      }
      setShowCreateModal(false);
      setIsEditing(false);
  };

  const handleDeleteJob = async (id: string) => {
      await supabase.from('jobs').delete().eq('id', id);
      setJobs(prev => prev.filter(j => j.id !== id));
  };

  const handlePinJob = async (id: string) => {
      const job = jobs.find(j => j.id === id);
      if (job) {
          const newPinned = !job.isPinned;
          await supabase.from('jobs').update({ isPinned: newPinned }).eq('id', id);
          setJobs(prev => prev.map(j => j.id === id ? { ...j, isPinned: newPinned } : j));
      }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) { alert("Digite a senha atual."); return; }
    if (newPassword.length < 6) { alert("Senha muito curta."); return; }
    
    setChangingPassword(true);
    // Verificar senha atual tentando login
    const { error: loginError } = await supabase.auth.signInWithPassword({ email: user?.email || '', password: currentPassword });
    
    if (loginError) {
        alert("Senha atual incorreta.");
        setChangingPassword(false);
        return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    
    if (error) alert("Erro ao atualizar senha: " + error.message);
    else {
        alert("Senha alterada com sucesso!");
        setCurrentPassword('');
        setNewPassword('');
    }
  };

  const handleUpdateProfile = async () => {
      if (!user) return;
      setChangingPassword(true);
      const { error } = await supabase.from('profiles').update({ name: user.name, phone: user.phone }).eq('id', user.id);
      setChangingPassword(false);
      if (error) alert("Erro ao atualizar: " + error.message);
      else alert("Perfil atualizado!");
  };
  
  const handleUpgrade = (planKey: string) => {
      if (!user) return;
      const link = INFINITE_PAY_LINKS[planKey as keyof typeof INFINITE_PAY_LINKS];
      if (!link) return;
      const separator = link.includes('?') ? '&' : '?';
      const finalUrl = `${link}${separator}customer_email=${encodeURIComponent(user.email)}`;
      window.open(finalUrl, '_blank');
  };

  // --- CANDIDATES ---
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
          let encoded = reader.result as string;
          // Remove prefix like "data:application/pdf;base64,"
          encoded = encoded.replace(/^data:.+;base64,/, '');
          resolve(encoded);
      };
      reader.onerror = error => reject(error);
    });
  };

  // FUNÇÃO CRÍTICA: Remove caracteres que quebram o upload do Supabase/Storage
  const sanitizeFileName = (name: string) => {
    return name
      .normalize('NFD') // Separa acentos
      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/[^a-zA-Z0-9.-]/g, "_") // Substitui tudo que não for letra, número, ponto ou traço por underscore
      .toLowerCase();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && activeJob) {
        await uploadCandidates(Array.from(e.target.files), activeJob.id);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && activeJob) {
        await uploadCandidates(Array.from(e.dataTransfer.files), activeJob.id);
    }
  };
  
  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
  };

  const uploadCandidates = async (files: File[], jobId: string) => {
    // Optimistic Update
    const newCandidates: Candidate[] = files.map(f => ({
        id: Math.random().toString(36).substr(2, 9),
        file: f,
        fileName: f.name,
        status: CandidateStatus.UPLOADING
    }));

    if (activeJob) {
        setActiveJob({ ...activeJob, candidates: [...newCandidates, ...activeJob.candidates] });
    }

    for (const c of newCandidates) {
        try {
            // CORREÇÃO: Usar nome sanitizado para o Storage, mas manter original para o Display
            const cleanName = sanitizeFileName(c.file.name);
            const fileName = `${Date.now()}_${cleanName}`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('resumes')
                .upload(fileName, c.file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            const { data: dbData, error: dbError } = await supabase
                .from('candidates')
                .insert([{
                    job_id: jobId,
                    filename: c.file.name, // Nome bonito no banco
                    file_path: uploadData.path, // Caminho seguro no storage
                    status: 'PENDING'
                }])
                .select()
                .single();

            if (dbError) throw dbError;

            if (dbData && activeJob) {
                const finalCandidate = mapCandidateFromDB(dbData);
                // Substitui o candidato otimista pelo real
                setActiveJob(prev => {
                    if (!prev) return null;
                    const others = prev.candidates.filter(cand => cand.id !== c.id);
                    return { ...prev, candidates: [finalCandidate, ...others] };
                });
                // Atualiza lista global de vagas
                setJobs(prev => prev.map(j => j.id === jobId ? { ...j, candidates: [finalCandidate, ...j.candidates] } : j));
            }

        } catch (err: any) {
            console.error("Upload failed details:", err.message);
            
            if (err.message && err.message.includes("violates not-null constraint") && err.message.includes("file_name")) {
                alert("ERRO CRÍTICO DE BANCO DE DADOS: Coluna 'file_name' bloqueada.\n\nPor favor, vá em Configurações > Banco de Dados > e execute o SCRIPT V17.");
                setShowSqlModal(true);
            }

            // Mark as error
            setActiveJob(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    candidates: prev.candidates.map(cand => cand.id === c.id ? { ...cand, status: CandidateStatus.ERROR } : cand)
                };
            });
        }
    }
  };

  const handlePublicUpload = async (files: File[]) => {
      if (publicUploadJobId) {
          for (const file of files) {
              const cleanName = sanitizeFileName(file.name);
              const fileName = `${Date.now()}_${cleanName}`;
              
              const { data: uploadData, error: uploadError } = await supabase.storage
                  .from('resumes')
                  .upload(fileName, file);
              
              if (uploadError) throw uploadError;

              const { error: dbError } = await supabase.from('candidates').insert([{
                  job_id: publicUploadJobId,
                  filename: file.name,
                  file_path: uploadData.path,
                  status: 'PENDING'
              }]);

              if (dbError) throw dbError;
          }
      }
  };

  const runAnalysis = async () => {
    if (!activeJob) return;

    const pendingCandidates = activeJob.candidates.filter(c => c.status === CandidateStatus.PENDING);
    if (pendingCandidates.length === 0) return;

    // Refresh session to avoid Auth errors during long process
    await supabase.auth.refreshSession();

    setAnalysisMetrics({ isAnalyzing: true, processedCount: 0, timeTaken: null });
    const startTime = Date.now();

    // Mark as analyzing visually
    const updatedWithAnalyzing = activeJob.candidates.map(c => 
        c.status === CandidateStatus.PENDING ? { ...c, status: CandidateStatus.ANALYZING } : c
    );
    setActiveJob({ ...activeJob, candidates: updatedWithAnalyzing });

    let processedGlobal = 0;

    // --- FUNÇÃO DE PROCESSAMENTO INDIVIDUAL ---
    const processCandidate = async (candidate: Candidate) => {
        try {
            // 1. Download file from storage
            if (!candidate.filePath) throw new Error("File path missing");
            
            const { data: fileBlob, error: downloadError } = await supabase.storage
                .from('resumes')
                .download(candidate.filePath);

            if (downloadError || !fileBlob) {
                console.error("Erro ao baixar arquivo do Supabase:", downloadError);
                throw new Error("Falha no download");
            }

            // 2. Convert blob to base64
            const file = new File([fileBlob], candidate.fileName || 'resume.pdf', { type: 'application/pdf' });
            const base64 = await fileToBase64(file);

            // 3. Analyze
            const result = await analyzeResume(base64, activeJob.title, activeJob.criteria);
            
            // 4. Update DB
            const { error: updateError } = await supabase.from('candidates')
                .update({ 
                    status: 'COMPLETED',
                    analysis_result: result,
                    match_score: result.matchScore 
                })
                .eq('id', candidate.id);
            
            if (updateError) {
                console.error("DB Save Failed:", updateError);
                throw new Error("Falha ao salvar no banco: " + updateError.message);
            }
            
            // 5. Update UI State (Individual Success)
            setActiveJob(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    candidates: prev.candidates.map(c => 
                        c.id === candidate.id 
                        ? { ...c, status: CandidateStatus.COMPLETED, result: result } 
                        : c
                    )
                };
            });

            processedGlobal++;
            setAnalysisMetrics(prev => ({ ...prev, processedCount: processedGlobal }));

        } catch (err: any) {
            console.error("Analysis FAILURE for", candidate.fileName, err);
            
            await supabase.from('candidates').update({ status: 'ERROR' }).eq('id', candidate.id);
            
            setActiveJob(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    candidates: prev.candidates.map(c => c.id === candidate.id ? { ...c, status: CandidateStatus.ERROR } : c)
                };
            });
        }
    };

    // --- PROMISE POOL PATTERN (CONCORRÊNCIA MÁXIMA) ---
    // Em vez de esperar lotes de 8 em 8, criamos uma fila onde 15 executam ao mesmo tempo.
    // Assim que um termina, outro entra na vaga imediatamente.
    
    const CONCURRENCY_LIMIT = 20; // 20 conexões simultâneas para acelerar
    const queue = [...pendingCandidates];
    
    const worker = async () => {
        while (queue.length > 0) {
            const candidate = queue.shift();
            if (candidate) {
                await processCandidate(candidate);
            }
        }
    };

    // Inicia N workers que consomem da mesma fila
    const workers = Array(Math.min(pendingCandidates.length, CONCURRENCY_LIMIT))
        .fill(null)
        .map(() => worker());

    await Promise.all(workers);

    // Finish
    const diff = Date.now() - startTime;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    const formattedTime = minutes > 0 ? `${minutes}min e ${seconds}seg` : `${seconds}seg`;

    setAnalysisMetrics({ isAnalyzing: false, processedCount: processedGlobal, timeTaken: formattedTime });
    
    // Update global job list
    if (activeJob) {
        const { data } = await supabase.from('candidates').select('*').eq('job_id', activeJob.id);
        if (data) {
            const freshCandidates = data.map(mapCandidateFromDB);
            setJobs(prev => prev.map(j => j.id === activeJob.id ? { ...j, candidates: freshCandidates } : j));
            setActiveJob(prev => prev ? { ...prev, candidates: freshCandidates } : null);
        }
    }

    // Decrement usage quota if needed
    if (user && user.resume_limit < 9999) {
        const newUsage = user.resume_usage + processedGlobal;
        await supabase.from('profiles').update({ resume_usage: newUsage }).eq('id', user.id);
        setUser({ ...user, resume_usage: newUsage });
    }
  };

  const handleDeleteCandidate = async (id: string) => {
      // Verifica se o candidato é um item temporário com erro (não salvo no banco)
      const isErrorItem = activeJob?.candidates.find(c => c.id === id && (c.status === CandidateStatus.ERROR || c.status === CandidateStatus.UPLOADING));
      
      // Se for um item de erro, apenas remove da tela (não chama API, pois ID não existe no DB)
      if (!isErrorItem) {
          await supabase.from('candidates').delete().eq('id', id);
      }
      
      if (activeJob) {
          const newCandidates = activeJob.candidates.filter(c => c.id !== id);
          setActiveJob({ ...activeJob, candidates: newCandidates });
          setJobs(prev => prev.map(j => j.id === activeJob.id ? { ...j, candidates: newCandidates } : j));
      }
  };

  const handleClearAllCandidates = async () => {
      if (!activeJob) return;
      await supabase.from('candidates').delete().eq('job_id', activeJob.id);
      setActiveJob({ ...activeJob, candidates: [] });
      setJobs(prev => prev.map(j => j.id === activeJob.id ? { ...j, candidates: [] } : j));
      setConfirmClearAll(false);
  };

  const handleToggleSelection = async (id: string) => {
      if (!activeJob) return;
      const candidate = activeJob.candidates.find(c => c.id === id);
      if (candidate) {
          const newSelected = !candidate.isSelected;
          await supabase.from('candidates').update({ is_selected: newSelected }).eq('id', id);
          
          setActiveJob({
              ...activeJob,
              candidates: activeJob.candidates.map(c => c.id === id ? { ...c, isSelected: newSelected } : c)
          });
      }
  };

  // --- RENDERING HELPERS ---

  const renderOverview = () => {
      // Filtrar Anúncios baseados no plano do usuário
      const visibleAnnouncements = announcements.filter(ad => {
          // Se o usuário não tiver plano definido (null), assume FREE
          const userPlan = user?.plan || 'FREE';
          // Verifica se o plano do usuário está na lista de planos alvo do anúncio
          return ad.targetPlans.includes(userPlan);
      });

      return (
      <div className="space-y-8 animate-fade-in max-w-6xl mx-auto font-sans">
          <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Visão Geral</h2>
              <p className="text-slate-500 font-medium">
                  Bem-vindo de volta, <span className="text-slate-900 font-bold capitalize">{(user?.name || 'Usuário').split(' ')[0].toLowerCase()}</span>.
              </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* VAGAS ATIVAS */}
              <div className="bg-white p-8 rounded-[2rem] border-2 border-black relative overflow-hidden group shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all">
                  <div className="relative z-10">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">VAGAS ATIVAS</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-6xl font-black text-slate-900">{jobs.length}</span>
                        <span className="text-xl font-black text-slate-300">/ {user?.job_limit >= 9999 ? '∞' : user?.job_limit}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
                          <div className="bg-slate-900 h-full rounded-full" style={{ width: `${Math.min(100, (jobs.length / (user?.job_limit || 1)) * 100)}%` }}></div>
                      </div>
                  </div>
                  <Briefcase className="absolute -right-6 -bottom-6 w-40 h-40 text-slate-50 transform -rotate-12 group-hover:scale-110 transition-transform duration-500" />
              </div>

              {/* CURRÍCULOS */}
              <div className="bg-white p-8 rounded-[2rem] border-2 border-black relative overflow-hidden group shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all">
                  <div className="relative z-10">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">CURRÍCULOS ANALISADOS</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-6xl font-black text-slate-900">{user?.resume_usage}</span>
                        <span className="text-xl font-black text-slate-300">/ {user?.resume_limit >= 9999 ? '∞' : user?.resume_limit}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
                          <div className={`bg-[#CCF300] h-full rounded-full`} style={{ width: `${Math.min(100, (user?.resume_usage! / (user?.resume_limit || 1)) * 100)}%` }}></div>
                      </div>
                  </div>
                  <FileText className="absolute -right-6 -bottom-6 w-40 h-40 text-slate-50 transform -rotate-12 group-hover:scale-110 transition-transform duration-500" />
              </div>

              {/* PLANO ATUAL */}
              <div className="bg-black p-8 rounded-[2rem] border-2 border-black relative overflow-hidden flex flex-col justify-between shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                   <div className="relative z-10">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">PLANO ATUAL</p>
                      <h3 className="text-5xl font-black text-white mb-2">{user?.plan}</h3>
                      <p className="text-zinc-400 text-xs font-medium">Faça upgrade para liberar recursos.</p>
                   </div>
                   <button onClick={() => setCurrentTab('BILLING')} className="mt-6 w-full bg-[#CCF300] hover:bg-[#bce000] text-black font-black py-3 rounded-xl text-xs uppercase tracking-widest transition-transform active:scale-95 border-2 border-black">
                       Ver Planos
                   </button>
                   <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-800 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
              </div>
          </div>

          {/* ANÚNCIOS (NOVOS) - FILTRADOS POR PLANO */}
          {visibleAnnouncements.length > 0 && (
              <div className="animate-slide-up">
                  <h3 className="text-lg font-black text-slate-900 mb-6 tracking-tight flex items-center gap-2">
                      <Star className="w-5 h-5 text-[#CCF300] fill-current" /> Novidades & Ofertas
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {visibleAnnouncements.map(ad => (
                          <a 
                            key={ad.id} 
                            href={ad.linkUrl || '#'} 
                            target={ad.linkUrl ? "_blank" : undefined}
                            rel="noopener noreferrer"
                            className={`block group relative rounded-[1.5rem] overflow-hidden border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all bg-white ${!ad.linkUrl ? 'cursor-default' : ''}`}
                          >
                              <div className="h-48 overflow-hidden bg-slate-200 relative">
                                  <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                  <div className="absolute top-3 left-3 bg-black text-[#CCF300] text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest border border-black">
                                      Anúncio
                                  </div>
                              </div>
                              <div className="p-5">
                                  <h4 className="font-black text-lg text-slate-900 leading-tight mb-2 line-clamp-2">{ad.title}</h4>
                                  {ad.linkUrl && (
                                      <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 uppercase tracking-wide group-hover:underline">
                                          Saiba mais <ExternalLink className="w-3 h-3" />
                                      </div>
                                  )}
                              </div>
                          </a>
                      ))}
                  </div>
              </div>
          )}
          
          <div>
              <h3 className="text-lg font-black text-slate-900 mb-6 tracking-tight">Atividade Recente</h3>
              <div className="space-y-4">
                  {jobs.length > 0 ? jobs.slice(0, 3).map(j => (
                      <div key={j.id} onClick={() => { setActiveJob(j); setView('JOB_DETAILS'); setCurrentTab('JOBS'); }} className="bg-white p-6 rounded-[1.5rem] border-2 border-slate-100 hover:border-black transition-all cursor-pointer flex justify-between items-center group shadow-sm hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5">
                          <div>
                              <h4 className="font-black text-slate-900 text-lg group-hover:text-black transition-colors">{j.title}</h4>
                              <p className="text-xs text-slate-400 font-bold mt-1">{j.candidates.length} currículos • Criada em {new Date(j.createdAt).toLocaleDateString()}</p>
                          </div>
                          <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all border border-slate-200 group-hover:border-black">
                              <ArrowRight className="w-4 h-4" />
                          </div>
                      </div>
                  )) : (
                      <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50">
                          <p className="text-slate-400 font-bold text-sm">Nenhuma atividade recente.</p>
                      </div>
                  )}
              </div>
          </div>
      </div>
  );
  };

  const renderBilling = () => (
      <div className="space-y-12 animate-fade-in max-w-6xl mx-auto font-sans p-4">
          <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Minha Assinatura</h2>
              <p className="text-slate-500 font-medium mt-1">Gerencie seu plano e limites de uso.</p>
          </div>

          {/* Current Plan Card - Black */}
          <div className="bg-black rounded-[2.5rem] p-10 md:p-12 relative overflow-hidden text-white shadow-2xl">
              <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-6">
                      <span className="text-[#CCF300] font-black text-xs uppercase tracking-widest">Plano Ativo</span>
                      <span className="bg-zinc-800 text-zinc-500 px-3 py-1 rounded text-[10px] font-mono">Renova em: --/--/----</span>
                  </div>
                  
                  <div className="flex justify-between items-start">
                      <h3 className="text-7xl font-black tracking-tighter text-white mb-10">{user?.plan}</h3>
                      <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800">
                          <Zap className="w-8 h-8 text-zinc-600" />
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      {/* Vagas Bar */}
                      <div>
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">
                              <span>Vagas Ativas</span>
                              <span className="text-white">{user?.job_limit >= 9999 ? '∞' : `${jobs.length} / ${user?.job_limit}`}</span>
                          </div>
                          <div className="w-full bg-zinc-900 h-3 rounded-full overflow-hidden border border-zinc-800">
                              <div className="bg-zinc-600 h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (jobs.length / (user?.job_limit || 1)) * 100)}%` }}></div>
                          </div>
                      </div>

                      {/* Curriculos Bar */}
                      <div>
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">
                              <span>Currículos Analisados</span>
                              <span className="text-white">{user?.resume_limit >= 9999 ? '∞' : `${user?.resume_usage} / ${user?.resume_limit}`}</span>
                          </div>
                          <div className="w-full bg-zinc-900 h-3 rounded-full overflow-hidden border border-zinc-800">
                              <div className="bg-zinc-600 h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (user?.resume_usage! / (user?.resume_limit || 1)) * 100)}%` }}></div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          {/* Upgrade Options */}
          <div>
              <h3 className="text-xl font-black text-slate-900 mb-8 tracking-tight flex items-center gap-2">
                  <ArrowUpRight className="w-5 h-5" /> Opções de Upgrade
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Free Plan */}
                  <div className="bg-white border-[3px] border-black rounded-[2.5rem] p-8 flex flex-col items-center text-center relative group hover:-translate-y-1 transition-transform duration-300 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">FREE</span>
                      <div className="text-slate-900 mb-6 flex items-center justify-center h-[72px]">
                          <span className="text-5xl font-black tracking-tighter">Grátis</span>
                      </div>
                      <div className="space-y-1 mb-8 text-sm font-bold text-slate-600">
                          <p>3 Vagas</p>
                          <p>25 Currículos/mês</p>
                      </div>
                      <button disabled className="w-full bg-black text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest cursor-default border-2 border-black opacity-90">
                          (Atual)
                      </button>
                  </div>

                  {/* Mensal */}
                  <div className="bg-white border-[3px] border-black rounded-[2.5rem] p-8 flex flex-col items-center text-center relative group hover:-translate-y-1 transition-transform duration-300 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Mensal</span>
                      <div className="text-slate-900 mb-6 flex items-baseline justify-center h-[72px]">
                          <span className="text-xl font-bold mr-1 text-slate-400">R$</span>
                          <span className="text-6xl font-black tracking-tighter">329</span>
                          <span className="text-xl font-bold text-slate-400">,90</span>
                          <span className="text-[10px] font-bold text-slate-400 ml-1">/MÊS</span>
                      </div>
                      <div className="space-y-1 mb-8 text-sm font-bold text-slate-600">
                          <p>5 Vagas</p>
                          <p>+ Link Público</p>
                      </div>
                      <button onClick={() => handleUpgrade('MENSAL')} className="w-full bg-black text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest hover:bg-zinc-800 transition-colors">
                          ESCOLHER PLANO
                      </button>
                  </div>

                  {/* Anual - Destaque */}
                  <div className="bg-black border-[3px] border-black rounded-[2.5rem] p-8 flex flex-col items-center text-center relative group hover:-translate-y-1 transition-transform duration-300 overflow-hidden shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
                      <div className="absolute top-0 right-0 bg-[#CCF300] text-black text-[10px] font-black px-4 py-2 rounded-bl-2xl uppercase tracking-widest z-10">
                          Melhor Valor
                      </div>
                      
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 mt-2">Anual</span>
                      <div className="text-white mb-6 flex items-baseline justify-center h-[72px]">
                          <span className="text-xl font-bold mr-1 text-zinc-500">R$</span>
                          <span className="text-6xl font-black tracking-tighter">289</span>
                          <span className="text-xl font-bold text-zinc-500">,90</span>
                          <span className="text-[10px] font-bold text-zinc-600 ml-1">/MÊS</span>
                      </div>
                      <div className="space-y-1 mb-8 text-sm font-bold text-white">
                          <p>Vagas Ilimitadas</p>
                          <p className="text-[#CCF300]">+ Link Público</p>
                      </div>
                      <button onClick={() => handleUpgrade('ANUAL')} className="w-full bg-[#CCF300] text-black font-black py-4 rounded-xl text-xs uppercase tracking-widest hover:bg-[#bce000] transition-colors">
                          ESCOLHER PLANO
                      </button>
                  </div>
              </div>
          </div>
      </div>
  );

  const renderSettings = () => (
    <div className="space-y-8 animate-fade-in max-w-3xl mx-auto">
         <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Configurações</h2>
            <p className="text-slate-500 font-bold">Gerencie seus dados pessoais e segurança.</p>
         </div>

         <div className="bg-white p-8 rounded-[2rem] border-2 border-slate-200 shadow-sm">
             <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2"><UserIcon className="w-5 h-5"/> Dados Pessoais</h3>
             <div className="space-y-4 max-w-lg">
                 <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Nome Completo</label>
                     <input 
                       type="text" 
                       value={user?.name || ''} 
                       onChange={(e) => setUser(user ? {...user, name: e.target.value} : null)} 
                       className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm focus:border-black focus:ring-0 outline-none transition-all"
                     />
                 </div>
                 <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Email de Acesso</label>
                     <input 
                       type="email" 
                       value={user?.email || ''} 
                       disabled
                       className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm text-slate-500 cursor-not-allowed"
                     />
                 </div>
                 <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Telefone / WhatsApp</label>
                     <input 
                       type="text" 
                       value={user?.phone || ''} 
                       onChange={(e) => setUser(user ? {...user, phone: e.target.value} : null)} 
                       className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm focus:border-black focus:ring-0 outline-none transition-all"
                     />
                 </div>
                 <div className="pt-2">
                    <button onClick={handleUpdateProfile} disabled={changingPassword} className="bg-black text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg hover:translate-y-0.5 active:translate-y-1 transition-all flex items-center gap-2 disabled:opacity-50">
                        {changingPassword ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4 text-[#CCF300]" />} Salvar Alterações
                    </button>
                 </div>
             </div>
         </div>

         <div className="bg-white p-8 rounded-[2rem] border-2 border-slate-200 shadow-sm">
             <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2"><Lock className="w-5 h-5"/> Segurança</h3>
             <div className="space-y-4 max-w-lg">
                 <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Senha Atual</label>
                     <input 
                       type="password" 
                       value={currentPassword}
                       onChange={(e) => setCurrentPassword(e.target.value)}
                       className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm focus:border-black focus:ring-0 outline-none transition-all"
                     />
                 </div>
                 <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Nova Senha</label>
                     <input 
                       type="password" 
                       value={newPassword}
                       onChange={(e) => setNewPassword(e.target.value)}
                       className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm focus:border-black focus:ring-0 outline-none transition-all"
                     />
                 </div>
                 <div className="pt-2">
                    <button onClick={handleChangePassword} disabled={changingPassword} className="bg-white text-black border-2 border-slate-200 hover:border-black px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-50">
                        {changingPassword ? <Loader2 className="w-4 h-4 animate-spin"/> : <Key className="w-4 h-4" />} Alterar Senha
                    </button>
                 </div>
             </div>
         </div>

         <div className="bg-white p-8 rounded-[2rem] border-2 border-slate-200 shadow-sm">
             <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2"><Database className="w-5 h-5"/> Banco de Dados</h3>
             <p className="text-sm text-slate-500 font-bold mb-4">Se estiver com problemas de upload ou permissão, use o script de correção.</p>
             <button onClick={() => setShowSqlModal(true)} className="bg-white text-black border-2 border-slate-200 hover:border-black px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
                 <Settings className="w-4 h-4" /> Abrir Script V22
             </button>
         </div>
    </div>
  );

  // --- MAIN RENDER (User Dashboard / Details) ---
  
  // Public Upload View
  if (view === 'PUBLIC_UPLOAD') {
      return (
          <PublicUploadScreen 
            jobTitle={publicJobTitle}
            onUpload={handlePublicUpload}
            onBack={() => {
                setPublicUploadJobId(null);
                setView(user ? 'DASHBOARD' : 'DASHBOARD');
                // Remove o código curto da URL sem recarregar a página
                window.history.pushState({}, '', '/');
            }}
          />
      );
  }

  // Loading
  if (loading) {
      return (
          <div className="h-screen flex items-center justify-center bg-white">
              <Loader2 className="w-10 h-10 animate-spin text-black" />
          </div>
      );
  }

  // Auth
  if (!user) {
      return (
          <LoginScreen 
            onLogin={handleLogin}
            onGoogleLogin={async () => { /* Implement Google Auth if needed */ }}
            onShowTerms={() => setShowTerms(true)}
            onShowPrivacy={() => setShowPrivacy(true)}
          />
      );
  }

  // Admin
  if (user.role === 'ADMIN' && view === 'DASHBOARD') { 
      return <AdminDashboard />;
  }
  
  // Main App Helpers
  const handleEditJobSetup = (job: Job) => {
      setActiveJob(job);
      setIsEditing(true);
      setShowCreateModal(true);
  };

  const handleOpenShareModal = () => {
      if (activeJob) setShowShareModal(true);
  };

  return (
    <div className="h-screen bg-white flex overflow-hidden font-sans text-slate-900 selection:bg-[#CCF300] selection:text-black">
      
      {/* SIDEBAR */}
      <aside className="w-20 lg:w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 transition-all duration-300 z-40">
        <div className="h-24 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-100">
           <img src="https://ik.imagekit.io/xsbrdnr0y/elevva-logo.png" alt="Logo" className="h-14 w-auto hidden lg:block" />
            <div className="w-10 h-10 bg-black rounded-xl lg:hidden flex items-center justify-center text-[#CCF300] font-black text-xl">E</div>
            {/* Added plan badge back if user exists */}
            {user && (
                 <span className={`hidden lg:inline-flex ml-3 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                     user.plan === 'ANUAL' ? 'bg-black text-[#CCF300] border-black' :
                     user.plan === 'FREE' ? 'bg-zinc-100 text-zinc-500 border-zinc-200' : 'bg-black text-white border-black'
                 }`}>
                     {user.plan}
                 </span>
            )}
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto custom-scrollbar">
            <button 
                onClick={() => { setCurrentTab('OVERVIEW'); setView('DASHBOARD'); }}
                className={`w-full flex items-center justify-center lg:justify-start p-3 rounded-xl transition-all group ${currentTab === 'OVERVIEW' && view === 'DASHBOARD' ? 'bg-black text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 hover:text-black'}`}
            >
                <LayoutDashboard className="w-6 h-6 lg:mr-3" />
                <span className="hidden lg:block font-bold text-sm">Visão Geral</span>
            </button>
            <button 
                onClick={() => { setCurrentTab('JOBS'); setView('DASHBOARD'); }}
                className={`w-full flex items-center justify-center lg:justify-start p-3 rounded-xl transition-all group ${currentTab === 'JOBS' ? 'bg-black text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 hover:text-black'}`}
            >
                <Briefcase className="w-6 h-6 lg:mr-3" />
                <span className="hidden lg:block font-bold text-sm">Minhas Vagas</span>
            </button>
            <button 
                onClick={() => { setCurrentTab('BILLING'); setView('DASHBOARD'); }}
                className={`w-full flex items-center justify-center lg:justify-start p-3 rounded-xl transition-all group ${currentTab === 'BILLING' ? 'bg-black text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 hover:text-black'}`}
            >
                <CreditCard className="w-6 h-6 lg:mr-3" />
                <span className="hidden lg:block font-bold text-sm">Minha Assinatura</span>
            </button>
            <button 
                onClick={() => { setCurrentTab('SETTINGS'); setView('DASHBOARD'); }}
                className={`w-full flex items-center justify-center lg:justify-start p-3 rounded-xl transition-all group ${currentTab === 'SETTINGS' ? 'bg-black text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 hover:text-black'}`}
            >
                <Settings className="w-6 h-6 lg:mr-3" />
                <span className="hidden lg:block font-bold text-sm">Configurações</span>
            </button>
        </nav>
        
        <div className="p-4 border-t border-slate-100">
             <div className="flex items-center gap-3 mb-4 px-2 hidden lg:flex">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold border border-slate-200">
                    {user?.name?.charAt(0) || user?.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate">{user?.name || 'Usuário'}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                </div>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center justify-center lg:justify-start p-3 rounded-xl text-slate-400 hover:text-red-500 transition-colors font-bold text-sm group">
                <LogOut className="w-5 h-5 lg:mr-2" />
                <span className="hidden lg:block">Sair da Conta</span>
            </button>
        </div>
      </aside>

      {/* MAIN CONTENT Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50 relative">
        
        {/* VIEW: DASHBOARD (Includes TABS) */}
        {view === 'DASHBOARD' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
               {currentTab === 'OVERVIEW' && renderOverview()}
               {currentTab === 'BILLING' && renderBilling()}
               {currentTab === 'SETTINGS' && renderSettings()}
               {currentTab === 'JOBS' && (
                   <>
                       <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 animate-fade-in">
                          <div>
                              <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Painel de Vagas</h1>
                              <p className="text-slate-500 font-bold mt-1">Gerencie seus processos seletivos.</p>
                          </div>
                          <button 
                            onClick={() => { setShowCreateModal(true); setIsEditing(false); }}
                            className="bg-black text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-[4px_4px_0px_0px_rgba(204,243,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(204,243,0,1)] hover:translate-y-0.5 active:translate-y-1 active:shadow-none border-2 border-black transition-all"
                          >
                             <Plus className="w-5 h-5" /> Nova Vaga
                          </button>
                       </div>
                       
                       {jobs.length === 0 ? (
                           <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400 animate-fade-in">
                               <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-200 mb-4 shadow-sm">
                                   <LayoutDashboard className="w-10 h-10 text-slate-300" />
                               </div>
                               <p className="font-bold text-lg text-slate-900">Nenhuma vaga criada</p>
                               <p className="text-sm">Clique em "Nova Vaga" para começar.</p>
                           </div>
                       ) : (
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-slide-up">
                               {jobs.map(job => (
                                   <JobCard 
                                      key={job.id} 
                                      job={job}
                                      onClick={(j) => { setActiveJob(j); setView('JOB_DETAILS'); }}
                                      onDelete={handleDeleteJob}
                                      onEdit={handleEditJobSetup}
                                      onPin={handlePinJob}
                                      onShare={(j) => { setActiveJob(j); setShowShareModal(true); }}
                                   />
                               ))}
                           </div>
                       )}
                   </>
               )}
            </div>
        )}

        {/* VIEW: JOB DETAILS */}
        {view === 'JOB_DETAILS' && activeJob && (
           <div className="w-full h-full flex flex-col animate-fade-in relative p-8">
            <div className="bg-slate-50 rounded-[2.5rem] p-8 mb-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row justify-between items-center relative overflow-hidden transition-all shrink-0">
               <div className="relative z-10 flex items-center gap-8 w-full md:w-auto">
                 <button onClick={() => setView('DASHBOARD')} className="group p-4 rounded-2xl bg-black hover:bg-zinc-900 text-white border-2 border-black transition-all duration-300 shadow-[4px_4px_0px_0px_rgba(204,243,0,1)] hover:shadow-none hover:translate-y-1 flex items-center justify-center">
                   <ArrowLeft className="w-5 h-5 text-[#CCF300] transition-colors" />
                 </button>
                 <div>
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight truncate max-w-[300px] md:max-w-md" title={activeJob.title}>{activeJob.title}</h1>
                        <button onClick={() => handleEditJobSetup(activeJob)} className="p-2 text-slate-300 hover:text-black bg-transparent hover:bg-slate-200 rounded-xl transition-all" title="Editar vaga"><Pencil className="w-5 h-5" /></button>
                    </div>
                    <div className="flex items-center gap-4 mt-3 ml-1">
                      <p className="text-slate-500 text-sm font-bold">{activeJob.candidates.length} Currículos</p>
                      <div className="text-xs text-slate-400 flex items-center gap-1 border-l-2 border-slate-200 pl-3 font-medium">
                          Uso: <span className={`${user!.resume_usage >= user!.resume_limit ? 'text-red-500 font-bold' : 'text-slate-600'}`}>{user!.resume_usage} / {user!.resume_limit >= 9999 ? '∞' : user!.resume_limit}</span>
                      </div>
                    </div>
                 </div>
               </div>
               <div className="relative z-10 flex gap-3 mt-6 md:mt-0 w-full md:w-auto justify-end">
                 <input type="file" multiple accept="application/pdf" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                 
                 <button onClick={handleOpenShareModal} className="bg-[#CCF300] hover:bg-[#bce000] border-2 border-black text-black px-5 py-4 rounded-xl font-black text-sm flex items-center transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 active:translate-y-1 active:shadow-none"><Share2 className="w-5 h-5 mr-2 text-black"/> Link</button>
                 
                 {activeJob.candidates.some(c=>c.isSelected) && (
                   <button onClick={()=>setShowReport(true)} className="bg-white border-2 border-black text-black px-6 py-4 rounded-xl font-black text-sm flex items-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"><FileCheck className="w-5 h-5 mr-2"/> Relatório</button>
                 )}
                 
                 <button onClick={()=>fileInputRef.current?.click()} className="bg-black hover:bg-slate-900 text-white px-6 py-4 rounded-xl font-black text-sm flex items-center transition-all shadow-[4px_4px_0px_0px_rgba(204,243,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(204,243,0,1)] hover:translate-y-0.5 active:translate-y-1 active:shadow-none border-2 border-black"><Upload className="w-5 h-5 mr-2 text-[#CCF300]"/> Upload</button>
                 
                 {activeJob.candidates.filter(c => c.status === CandidateStatus.PENDING).length > 0 && (
                   <button onClick={runAnalysis} className="bg-[#CCF300] hover:bg-[#bce000] text-black border-2 border-black px-8 py-4 rounded-xl font-black text-sm flex flex-row items-center gap-2 whitespace-nowrap animate-pulse shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"><Play className="w-5 h-5 fill-current"/> ANALISAR ({activeJob.candidates.filter(c => c.status === CandidateStatus.PENDING).length})</button>
                 )}
                 
                 {activeJob.candidates.length > 0 && (
                    !confirmClearAll ? (
                       <button onClick={() => setConfirmClearAll(true)} className="bg-white text-slate-400 hover:text-red-500 px-4 py-4 rounded-xl hover:bg-red-50 transition-colors border-2 border-slate-200 hover:border-red-500 shadow-sm group relative" title="Limpar todos os currículos"><Trash2 className="w-5 h-5"/></button>
                    ) : (
                       <div className="flex items-center gap-2 bg-red-50 p-1.5 rounded-xl border-2 border-red-100 animate-fade-in shadow-lg h-[60px]">
                           <span className="text-[10px] font-black text-red-500 px-2 uppercase hidden md:inline">Apagar Tudo?</span>
                           <button onClick={handleClearAllCandidates} className="w-10 h-full flex items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors shadow-md active:scale-95 border border-red-700" title="Confirmar exclusão de TODOS"><CheckCircle2 className="w-5 h-5" /></button>
                           <button onClick={() => setConfirmClearAll(false)} className="w-10 h-full flex items-center justify-center rounded-lg bg-white border-2 border-slate-200 text-slate-400 hover:text-slate-600 transition-colors active:scale-95" title="Cancelar"><X className="w-5 h-5" /></button>
                       </div>
                    )
                 )}
               </div>
            </div>

            {analysisMetrics.timeTaken && !analysisMetrics.isAnalyzing && (
                <div className="bg-[#CCF300]/20 border-2 border-[#CCF300] p-4 rounded-2xl mb-4 flex justify-between items-center animate-slide-up shadow-sm shrink-0">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-[#CCF300] flex items-center justify-center border-2 border-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                           <Timer className="w-6 h-6" />
                       </div>
                       <div>
                           <h4 className="text-black font-black text-sm uppercase tracking-wide">Análise Concluída!</h4>
                           <p className="text-slate-900 text-xs font-bold mt-1">Processamos <strong>{analysisMetrics.processedCount} currículos</strong> em <strong>{analysisMetrics.timeTaken}</strong>.</p>
                       </div>
                    </div>
                    <button onClick={() => setAnalysisMetrics(prev => ({...prev, timeTaken: null}))} className="p-2 hover:bg-[#CCF300]/30 rounded-lg text-black transition-colors"><X className="w-5 h-5" /></button>
                </div>
            )}
            
            <div className={`flex-1 overflow-y-auto custom-scrollbar transition-all duration-300 rounded-2xl p-2 ${isDragging ? 'bg-slate-50 border-4 border-dashed border-black ring-4 ring-slate-200' : 'border-2 border-transparent'}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
               {activeJob.candidates.length===0 ? (
                 <div className="flex flex-col items-center justify-center h-full text-slate-400 animate-fade-in pointer-events-none">
                    <div className={`p-8 rounded-[2rem] bg-slate-50 mb-6 transition-transform duration-300 border-2 border-slate-200 ${isDragging ? 'scale-125 bg-slate-100 border-black' : ''}`}>
                        <CloudUpload className={`w-16 h-16 ${isDragging ? 'text-black' : 'text-slate-300'}`} />
                    </div>
                    <h3 className={`text-2xl font-black mb-2 transition-colors tracking-tight ${isDragging ? 'text-black' : 'text-slate-900'}`}>{isDragging ? 'Solte para Upload' : 'Arraste os PDFs aqui'}</h3>
                    <p className="text-slate-400 font-bold">ou use o botão Upload acima</p>
                 </div>
               ) : (
                 <>
                    {isDragging && (<div className="mb-6 p-8 border-4 border-dashed border-black bg-[#CCF300]/10 rounded-2xl flex items-center justify-center text-black font-black uppercase tracking-widest animate-pulse"><CloudUpload className="w-8 h-8 mr-4" /> Solte para adicionar</div>)}
                    {[...activeJob.candidates].sort((a,b)=>(b.result?.matchScore||0)-(a.result?.matchScore||0)).map((c,i)=>(<AnalysisResultCard key={c.id} candidate={c} index={i} onToggleSelection={c.status===CandidateStatus.COMPLETED?handleToggleSelection:undefined} onDelete={handleDeleteCandidate}/>))}
                 </>
               )}
            </div>
          </div>
        )}

      </main>

      {/* CREATE JOB MODAL */}
      {showCreateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl relative animate-slide-up border border-zinc-200">
                  <button onClick={() => setShowCreateModal(false)} className="absolute top-6 right-6 p-2 bg-zinc-50 hover:bg-zinc-100 rounded-full transition-colors border border-zinc-100 hover:border-zinc-300 text-zinc-400 hover:text-black">
                      <X className="w-5 h-5"/>
                  </button>
                  
                  <div className="mb-8">
                      {/* Icone: Fundo Preto, Icone Lime */}
                      <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mb-6 shadow-xl transform -rotate-3 border-2 border-black">
                          <BriefcaseIcon className="w-8 h-8 text-[#CCF300]" />
                      </div>
                      <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">{isEditing ? 'Editar Vaga' : 'Nova Vaga'}</h2>
                      <p className="text-slate-500 font-bold text-sm">Defina os critérios para a IA analisar.</p>
                  </div>

                  <form onSubmit={handleJobFormSubmit} className="space-y-5">
                      <div>
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">Título do Cargo</label>
                          <input name="title" defaultValue={isEditing ? activeJob?.title : ''} required placeholder="Ex: Desenvolvedor Front-end Senior" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-5 text-slate-900 font-bold text-sm focus:outline-none focus:border-black focus:bg-white transition-all placeholder:font-medium placeholder:text-slate-400" />
                      </div>
                      
                      <div>
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">Descrição (Opcional)</label>
                          <textarea name="description" defaultValue={isEditing ? activeJob?.description : ''} placeholder="Breve resumo das responsabilidades..." className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-5 text-slate-900 font-bold text-sm focus:outline-none focus:border-black focus:bg-white transition-all min-h-[80px] placeholder:font-medium placeholder:text-slate-400" />
                      </div>

                      <div>
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">Requisitos Obrigatórios</label>
                          <textarea name="criteria" defaultValue={isEditing ? activeJob?.criteria : ''} required placeholder="Liste os requisitos chave (ex: React, Inglês Fluente, 3 anos de xp...)" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-5 text-slate-900 font-bold text-sm focus:outline-none focus:border-black focus:bg-white transition-all min-h-[120px] placeholder:font-medium placeholder:text-slate-400" />
                      </div>

                      <button type="submit" className="w-full bg-black text-white font-black py-5 rounded-2xl hover:bg-zinc-900 transition-all flex items-center justify-center gap-2 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 border-b-4 border-[#CCF300] hover:border-[#CCF300] mt-6">
                          {isEditing ? 'Salvar Alterações' : 'Criar Vaga com IA'}
                      </button>
                  </form>
              </div>
          </div>
      )}

      {/* SHARE MODAL */}
      {showShareModal && activeJob && (
          <ShareLinkModal 
             job={activeJob}
             onClose={() => setShowShareModal(false)}
          />
      )}

      {/* REPORT MODAL */}
      {showReport && activeJob && (
          <InterviewReportModal 
             jobTitle={activeJob.title}
             candidates={activeJob.candidates.filter(c => c.isSelected)}
             onClose={() => setShowReport(false)}
          />
      )}

      {/* SQL SETUP MODAL */}
      {showSqlModal && (
          <SqlSetupModal onClose={() => setShowSqlModal(false)} />
      )}

      {/* LEGAL MODALS */}
      {showTerms && (
          <LegalModal title="Termos de Uso" onClose={() => setShowTerms(false)} />
      )}
      {showPrivacy && (
          <LegalModal title="Política de Privacidade" onClose={() => setShowPrivacy(false)} />
      )}

      {/* Floating Footer Area: Legal Buttons + WhatsApp */}
      <div className="fixed bottom-0 right-6 z-50 flex items-center gap-4 pb-2">
          {/* Legal Buttons Container - Text Only */}
          <div className="flex items-center gap-4 animate-fade-in hidden md:flex mr-2">
                <button 
                    onClick={() => setShowTerms(true)} 
                    className="text-[10px] font-black text-slate-400 hover:text-slate-900 transition-colors uppercase tracking-widest shadow-sm"
                    style={{ textShadow: '0px 1px 2px rgba(255,255,255,0.8)' }}
                >
                    Termos de Uso
                </button>
                <button 
                    onClick={() => setShowPrivacy(true)} 
                    className="text-[10px] font-black text-slate-400 hover:text-slate-900 transition-colors uppercase tracking-widest shadow-sm"
                    style={{ textShadow: '0px 1px 2px rgba(255,255,255,0.8)' }}
                >
                    Privacidade
                </button>
          </div>

          {/* Floating WhatsApp Button */}
          <a 
            href="https://wa.me/5551994396089" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-[#25D366] hover:bg-[#20bd5a] text-white p-4 rounded-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 border-2 border-black transition-all group"
            title="Falar no WhatsApp"
          >
            <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
          </a>
      </div>

    </div>
  );
};

// --- SIMPLE LEGAL MODAL ---
const LegalModal: React.FC<{ title: string; onClose: () => void }> = ({ title, onClose }) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative border border-slate-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-200">
                            <ShieldCheck className="w-5 h-5 text-slate-900" />
                        </div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">{title}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500"/></button>
                </div>
                
                <div className="p-8 overflow-y-auto custom-scrollbar">
                    <div className="prose prose-sm prose-slate max-w-none">
                        <p className="font-bold text-slate-900 mb-4">Última atualização: {new Date().toLocaleDateString()}</p>
                        <p>
                            Este é um documento legal padrão para o uso da plataforma Elevva. Ao utilizar nossos serviços de análise de currículos com Inteligência Artificial, você concorda com o processamento de dados conforme descrito abaixo.
                        </p>
                        
                        <h4 className="font-black text-slate-900 mt-6 mb-2">1. Coleta de Dados</h4>
                        <p>
                            Coletamos apenas os dados necessários para a prestação do serviço, incluindo nome, email e os arquivos de currículo (PDF) enviados para análise. Estes dados são processados temporariamente pelos nossos algoritmos de IA.
                        </p>

                        <h4 className="font-black text-slate-900 mt-6 mb-2">2. Uso da Inteligência Artificial</h4>
                        <p>
                            Utilizamos modelos de IA (Google Gemini) para processar e extrair informações dos currículos. Embora nos esforcemos pela máxima precisão, a análise automatizada pode conter imprecisões e deve servir como ferramenta de apoio à decisão humana, não como substituto total.
                        </p>

                        <h4 className="font-black text-slate-900 mt-6 mb-2">3. Privacidade e Segurança</h4>
                        <p>
                            Levamos a segurança a sério. Seus dados são armazenados de forma segura e não são vendidos a terceiros. Os candidatos têm direito de solicitar a exclusão de seus dados a qualquer momento através do contato com o recrutador responsável.
                        </p>
                        
                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl mt-6 flex gap-3">
                            <FileWarning className="w-5 h-5 text-amber-500 shrink-0" />
                            <p className="text-xs font-bold text-amber-700 leading-relaxed">
                                Importante: Ao fazer upload de currículos de terceiros, você declara ter autorização ou base legal (como legítimo interesse) para processar esses dados pessoais no contexto de um processo seletivo.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 text-right">
                    <button onClick={onClose} className="bg-black text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-slate-900 transition-all shadow-lg">
                        Entendi e Concordo
                    </button>
                </div>
            </div>
        </div>
    );
}

// Helper Component for Icon in Modal (avoiding conflict)
const BriefcaseIcon = (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
);

export default App;
