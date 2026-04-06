import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { AdminUserProfile, Announcement, PlanType } from '../types';
import { SqlSetupModal } from './SqlSetupModal';
import { 
  Users, Calendar, CreditCard, Search, Activity,
  Loader2, ArrowUpRight, Ban, CheckCircle2, X, Megaphone, Image as ImageIcon, Upload, Trash2, Filter, UserX, Wallet, Database, TrendingUp, FileText, PieChart, DollarSign, LayoutDashboard, LogOut, Edit3, Save, Banknote, Briefcase, Bot, AlertTriangle
} from 'lucide-react';

// Tipos auxiliares para o Dashboard
type AdminView = 'OVERVIEW' | 'USERS' | 'ADS' | 'FINANCE' | 'CANCELLATIONS' | 'DATABASE' | 'COMMISSIONS' | 'PROMPTS';

interface AdminJob {
  id: string;
  title: string;
  created_at: string;
  candidates_count: number;
  owner_name: string;
  owner_email: string;
  status: 'ACTIVE' | 'CLOSED'; 
}

export const AdminDashboard: React.FC = () => {
  const [currentView, setCurrentView] = useState<AdminView>('OVERVIEW');
  const [users, setUsers] = useState<AdminUserProfile[]>([]);
  const [allJobs, setAllJobs] = useState<AdminJob[]>([]);
  const [ads, setAds] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State para o Modal de Detalhes de Usuário
  const [selectedUser, setSelectedUser] = useState<AdminUserProfile | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [tempPlanPrice, setTempPlanPrice] = useState('');
  const [isEditingSalesperson, setIsEditingSalesperson] = useState(false);
  const [tempSalesperson, setTempSalesperson] = useState(''); 

  // States para Edição Enterprise
  const [isEditingEnterprise, setIsEditingEnterprise] = useState(false);
  const [tempInstancia, setTempInstancia] = useState('');
  const [tempEvolutionToken, setTempEvolutionToken] = useState('');
  const [tempTelefoneAgente, setTempTelefoneAgente] = useState('');
  const [tempStatusAutomacao, setTempStatusAutomacao] = useState(false);
  const [tempJobLimit, setTempJobLimit] = useState<number>(9999);
  const [tempCalendarId, setTempCalendarId] = useState('');
  const [tempChatwootAccountId, setTempChatwootAccountId] = useState('');
  const [tempChatwootToken, setTempChatwootToken] = useState('');
  const [tempChatwootInboxId, setTempChatwootInboxId] = useState('');

  // States para Prompt System (recrutador)
  const [recruiterPrompt, setRecruiterPrompt] = useState('');
  const [recruiterPromptDraft, setRecruiterPromptDraft] = useState('');
  const [promptUpdatedAt, setPromptUpdatedAt] = useState<string | null>(null);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptSaving, setPromptSaving] = useState(false);

  // States para Criação de Anúncio
  const [newAdTitle, setNewAdTitle] = useState('');
  const [newAdImage, setNewAdImage] = useState<File | null>(null);
  const [newAdPreview, setNewAdPreview] = useState<string | null>(null);
  const [newAdPlans, setNewAdPlans] = useState<PlanType[]>(['ESSENCIAL', 'PRO', 'ENTERPRISE']);
  const [isPostingAd, setIsPostingAd] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State Financeiro
  const [financeDate] = useState(new Date());

  // Error State
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Sempre que o usuário selecionado muda, reinicia os campos do agente com os dados DESSE usuário
  useEffect(() => {
    if (selectedUser) {
      setTempInstancia(selectedUser.instancia_evolution || '');
      setTempEvolutionToken(selectedUser.evolution_token || '');
      setTempTelefoneAgente(selectedUser.telefone_agente || '');
      setTempStatusAutomacao(selectedUser.status_automacao || false);
      setTempJobLimit(selectedUser.job_limit ?? 9999);
      setTempCalendarId(selectedUser.google_calendar_id || selectedUser.email || '');
      setTempChatwootAccountId(selectedUser.chatwoot_account_id != null ? String(selectedUser.chatwoot_account_id) : '');
      setTempChatwootToken(selectedUser.chatwoot_token || '');
      setTempChatwootInboxId(selectedUser.chatwoot_inbox_id != null ? String(selectedUser.chatwoot_inbox_id) : '');
      setIsEditingEnterprise(true);
    }
  }, [selectedUser?.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setDataError(null);
      
      const { data: profilesData, error: profilesError } = await supabase.from('profiles').select('*');
      if (profilesError) {
          throw new Error(`Erro ao buscar perfis: ${profilesError.message} (Dica: Rode o Script V43)`);
      }

      const { data: jobsData, error: jobsError } = await supabase.from('jobs').select('*, candidates(id)');
      if (jobsError) {
          console.warn("Erro não crítico ao buscar jobs:", jobsError);
      }

      const { data: adsData, error: adsError } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
      if (adsError && adsError.code !== '42P01') console.error("Erro ao buscar anúncios:", adsError);

      const mappedUsers: AdminUserProfile[] = profilesData.map((u: Record<string, unknown>) => {
          const userJobs = jobsData?.filter((j: Record<string, unknown>) => j.user_id === u.id) || [];
          
          // Mapeamento de planos antigos para ESSENCIAL (exceto ADMIN)
          let currentPlan = u.plan as string;
          if (['FREE', 'MENSAL', 'TRIMESTRAL', 'ANUAL'].includes(currentPlan)) {
              currentPlan = 'ESSENCIAL';
          }

          return {
            id: u.id,
            email: u.email,
            name: u.name,
            phone: u.phone,
            role: u.role,
            plan: currentPlan,
            status: u.status || 'ACTIVE',
            created_at: u.created_at,
            jobs_count: userJobs.length,
            resume_usage: u.resume_usage || 0,
            last_active: u.updated_at || u.created_at,
            job_limit: u.job_limit,
            subscription_status: u.subscription_status,
            current_period_end: u.current_period_end,
            salesperson: u.salesperson, // Mapeia o vendedor
            instancia_evolution: u.instancia_evolution,
            evolution_token: u.evolution_token,
            telefone_agente: u.telefone_agente,
            status_automacao: u.status_automacao,
            google_calendar_id: u.google_calendar_id,
            plan_price: u.plan_price != null ? Number(u.plan_price) : undefined,
            chatwoot_account_id: u.chatwoot_account_id != null ? Number(u.chatwoot_account_id) : undefined,
            chatwoot_token: u.chatwoot_token as string | undefined,
            chatwoot_inbox_id: u.chatwoot_inbox_id != null ? Number(u.chatwoot_inbox_id) : undefined,
          };
      });

      const mappedJobs: AdminJob[] = jobsData?.map((j: Record<string, unknown>) => {
          const owner = mappedUsers.find(u => u.id === j.user_id);
          return {
              id: j.id,
              title: j.title,
              created_at: j.created_at,
              candidates_count: j.candidates ? j.candidates.length : 0,
              owner_name: owner?.name || 'Desconhecido',
              owner_email: owner?.email || 'N/A',
              status: 'ACTIVE'
          };
      }) || [];

      const mappedAds: Announcement[] = adsData?.map((a: Record<string, unknown>) => {
          const { data } = supabase.storage.from('marketing').getPublicUrl(a.image_path as string);
          return {
              id: a.id,
              title: a.title,
              imageUrl: data.publicUrl,
              linkUrl: a.link_url,
              isActive: a.is_active,
              createdAt: a.created_at,
              targetPlans: a.target_plans || ['ESSENCIAL', 'PRO', 'ENTERPRISE']
          };
      }) || [];

      setUsers(mappedUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setAllJobs(mappedJobs);
      setAds(mappedAds);

    } catch (error: unknown) {
      console.error("Erro crítico no Admin:", error);
      setDataError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBlock = async (user: AdminUserProfile) => {
      setActionLoading(true);
      const newStatus = user.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';
      
      try {
          const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', user.id);
          if (error) throw error;
          
          setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
          if (selectedUser && selectedUser.id === user.id) {
              setSelectedUser({ ...selectedUser, status: newStatus });
          }
      } catch (err: unknown) {
          alert("Erro ao atualizar status: " + (err instanceof Error ? err.message : String(err)));
      } finally {
          setActionLoading(false);
      }
  };

  const handleDeleteUser = async (user: AdminUserProfile) => {
      if (!confirm(`Tem certeza que deseja DELETAR a conta de ${user.name || user.email}? Esta ação é irreversível.`)) return;
      setActionLoading(true);
      try {
          const res = await fetch(`/api/admin/delete-user/${user.id}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Erro ao deletar');
          setUsers(prev => prev.filter(u => u.id !== user.id));
          setSelectedUser(null);
      } catch (err: unknown) {
          alert("Erro ao deletar conta: " + (err instanceof Error ? err.message : String(err)));
      } finally {
          setActionLoading(false);
      }
  };

  const handleUpdatePlan = async (newPlan: string, customPrice?: number) => {
      if (!selectedUser) return;
      setActionLoading(true);

      let newJobLimit = 3;
      const newResumeLimit = 9999; // Unlimited for all plans

      if (newPlan === 'PRO') {
          newJobLimit = 10;
      } else if (newPlan === 'ENTERPRISE' || newPlan === 'ADMIN') {
          newJobLimit = 9999;
      }

      const priceToSave = customPrice != null ? customPrice : (newPlan === 'ESSENCIAL' ? 499.90 : newPlan === 'PRO' ? 799.90 : 0);

      try {
          const { error } = await supabase
            .from('profiles')
            .update({
                plan: newPlan,
                job_limit: newJobLimit,
                resume_limit: newResumeLimit,
                subscription_status: 'active',
                plan_price: priceToSave,
            })
            .eq('id', selectedUser.id);

          if (error) throw error;

          const updatedUser = {
              ...selectedUser,
              plan: newPlan,
              job_limit: newJobLimit,
              resume_limit: newResumeLimit,
              subscription_status: 'active' as const,
              plan_price: priceToSave,
          };
          setSelectedUser(updatedUser);
          setUsers(prev => prev.map(u => u.id === selectedUser.id ? updatedUser : u));
          setIsEditingPlan(false);
          alert(`Plano alterado para ${newPlan} — R$ ${priceToSave.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês`);

      } catch (err: unknown) {
          console.error("Erro ao atualizar plano:", err);
          alert("Erro ao atualizar plano. Verifique se o Script V43 foi executado.");
      } finally {
          setActionLoading(false);
      }
  };

  const handleUpdateSalesperson = async () => {
      if (!selectedUser) return;
      setActionLoading(true);
      try {
          const { error } = await supabase
            .from('profiles')
            .update({ salesperson: tempSalesperson })
            .eq('id', selectedUser.id);

          if (error) throw error;

          const updatedUser = { ...selectedUser, salesperson: tempSalesperson };
          setSelectedUser(updatedUser);
          setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, salesperson: tempSalesperson } : u));
          setIsEditingSalesperson(false);
      } catch (err: unknown) {
          alert("Erro ao atualizar vendedor: " + (err instanceof Error ? err.message : String(err)));
      } finally {
          setActionLoading(false);
      }
  };

  const handleUpdateEnterprise = async () => {
      if (!selectedUser) return;
      setActionLoading(true);
      try {
          const jobLimitValue = tempJobLimit > 0 ? tempJobLimit : 9999;
          const { error } = await supabase
            .from('profiles')
            .update({
                instancia_evolution: tempInstancia,
                evolution_token: tempEvolutionToken || null,
                telefone_agente: tempTelefoneAgente,
                status_automacao: tempStatusAutomacao,
                job_limit: jobLimitValue,
                google_calendar_id: tempCalendarId || null,
                chatwoot_account_id: tempChatwootAccountId ? parseInt(tempChatwootAccountId) : null,
                chatwoot_token: tempChatwootToken || null,
                chatwoot_inbox_id: tempChatwootInboxId ? parseInt(tempChatwootInboxId) : null,
            })
            .eq('id', selectedUser.id);

          if (error) throw error;

          // Configura webhook_base64 automaticamente na instância Evolution GO
          if (tempInstancia && tempEvolutionToken) {
            try {
              await fetch('/api/admin/configure-evolution-webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instance: tempInstancia, token: tempEvolutionToken }),
              });
            } catch (e) {
              console.warn('Falha ao configurar webhook_base64:', e);
            }

            // Configura integração Chatwoot na instância Evolution GO (se preenchido)
            if (tempChatwootAccountId && tempChatwootToken && tempChatwootInboxId) {
              try {
                await fetch('/api/admin/configure-chatwoot', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    instance: tempInstancia,
                    evolutionToken: tempEvolutionToken,
                    chatwootAccountId: parseInt(tempChatwootAccountId),
                    chatwootToken: tempChatwootToken,
                    chatwootInboxId: parseInt(tempChatwootInboxId),
                  }),
                });
              } catch (e) {
                console.warn('Falha ao configurar Chatwoot:', e);
              }
            }
          }

          const updatedUser = {
              ...selectedUser,
              instancia_evolution: tempInstancia,
              evolution_token: tempEvolutionToken || undefined,
              telefone_agente: tempTelefoneAgente,
              status_automacao: tempStatusAutomacao,
              job_limit: jobLimitValue,
              google_calendar_id: tempCalendarId || undefined,
              chatwoot_account_id: tempChatwootAccountId ? parseInt(tempChatwootAccountId) : undefined,
              chatwoot_token: tempChatwootToken || undefined,
              chatwoot_inbox_id: tempChatwootInboxId ? parseInt(tempChatwootInboxId) : undefined,
          };
          setSelectedUser(updatedUser);
          setUsers(prev => prev.map(u => u.id === selectedUser.id ? updatedUser : u));
      } catch (err: unknown) {
          alert("Erro ao atualizar dados Enterprise: " + (err instanceof Error ? err.message : String(err)));
      } finally {
          setActionLoading(false);
      }
  };

  const DEFAULT_RECRUITER_PROMPT = `Você é um especialista em recrutamento e seleção. Analise o currículo abaixo para a vaga indicada e retorne APENAS um JSON válido, sem markdown, sem explicações.

VAGA: {jobTitle}
REQUISITOS DA VAGA: {criteria}

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

  const fetchRecruiterPrompt = async () => {
      setPromptLoading(true);
      try {
          const res = await fetch('/api/system-prompt/recruiter');
          const data = await res.json() as { prompt?: string; updated_at?: string };
          const text = data.prompt || DEFAULT_RECRUITER_PROMPT;
          setRecruiterPrompt(text);
          setRecruiterPromptDraft(text);
          setPromptUpdatedAt(data.updated_at || null);
      } catch (err) {
          console.error('Erro ao buscar prompt:', err);
          setRecruiterPrompt(DEFAULT_RECRUITER_PROMPT);
          setRecruiterPromptDraft(DEFAULT_RECRUITER_PROMPT);
      } finally {
          setPromptLoading(false);
      }
  };

  const saveRecruiterPrompt = async () => {
      setPromptSaving(true);
      try {
          const res = await fetch('/api/system-prompt/recruiter', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: recruiterPromptDraft }),
          });
          if (!res.ok) throw new Error('Erro ao salvar');
          setRecruiterPrompt(recruiterPromptDraft);
          setPromptUpdatedAt(new Date().toISOString());
          setIsEditingPrompt(false);
      } catch (err) {
          alert('Erro ao salvar prompt: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
          setPromptSaving(false);
      }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setNewAdImage(file);
          setNewAdPreview(URL.createObjectURL(file));
      }
  };

  const togglePlan = (plan: PlanType) => {
      if (newAdPlans.includes(plan)) {
          setNewAdPlans(newAdPlans.filter(p => p !== plan));
      } else {
          setNewAdPlans([...newAdPlans, plan]);
      }
  };

  const handlePostAd = async () => {
      if (!newAdTitle || !newAdImage) {
          alert("Título e Imagem são obrigatórios.");
          return;
      }
      if (newAdPlans.length === 0) {
          alert("Selecione pelo menos um plano alvo.");
          return;
      }
      setIsPostingAd(true);
      try {
          const fileExt = newAdImage.name.split('.').pop();
          const fileName = `${Date.now()}_ad.${fileExt}`;
          const { error: uploadError, data: uploadData } = await supabase.storage.from('marketing').upload(fileName, newAdImage);
          if (uploadError) throw uploadError;

          const { error: dbError } = await supabase.from('announcements').insert([{
              title: newAdTitle,
              link_url: null,
              image_path: uploadData.path,
              is_active: true,
              target_plans: newAdPlans
          }]);
          if (dbError) throw dbError;

          alert("Anúncio publicado com sucesso!");
          setNewAdTitle('');
          setNewAdImage(null);
          setNewAdPreview(null);
          setNewAdPlans(['ESSENCIAL', 'PRO', 'ENTERPRISE']);
          fetchData();
      } catch (err: unknown) {
          alert("Erro ao postar anúncio: " + (err instanceof Error ? err.message : String(err)));
      } finally {
          setIsPostingAd(false);
      }
  };

  const handleDeleteAd = async (id: string) => {
      if (!confirm("Tem certeza que deseja apagar este anúncio?")) return;
      try {
          const { error } = await supabase.from('announcements').delete().eq('id', id);
          if (error) throw error;
          setAds(prev => prev.filter(a => a.id !== id));
      } catch (err: unknown) {
          alert("Erro ao apagar: " + (err instanceof Error ? err.message : String(err)));
      }
  };
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const getFinancialData = () => {
      const targetMonthEnd = new Date(financeDate.getFullYear(), financeDate.getMonth() + 1, 0);
      const historicalUsers = users.filter(u => {
          const userCreated = new Date(u.created_at);
          return userCreated <= targetMonthEnd;
      });

      const stats = {
          ESSENCIAL: { count: 0, price: 499.90, revenue: 0 },
          PRO: { count: 0, price: 799.90, revenue: 0 },
          ENTERPRISE: { count: 0, price: 0, revenue: 0 },
          totalUsers: historicalUsers.length,
          totalRevenue: 0,
          mrr: 0, // Monthly Recurring Revenue (Normalized)
          payingUsers: 0,
          totalResumeUsage: 0 
      };

      historicalUsers.forEach(u => {
          const defaultPrice = u.plan === 'ESSENCIAL' ? 499.90 : u.plan === 'PRO' ? 799.90 : 0;
          const userPrice = u.plan_price != null ? u.plan_price : defaultPrice;

          if (u.plan in stats) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (stats as any)[u.plan].count++;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (stats as any)[u.plan].revenue += userPrice;

              // Calculate MRR using per-user price
              stats.mrr += userPrice;
          }
          stats.totalResumeUsage += (u.resume_usage || 0);
      });

      stats.payingUsers = stats.ESSENCIAL.count + stats.PRO.count + stats.ENTERPRISE.count;
      stats.totalRevenue = stats.ESSENCIAL.revenue + stats.PRO.revenue + stats.ENTERPRISE.revenue;

      return stats;
  };

  // --- RENDERS ---

  const renderSidebar = () => (
    <div className="w-64 bg-white border-r border-zinc-200 flex flex-col fixed left-0 top-0 bottom-0 z-50">
        <div className="h-20 flex flex-col items-start justify-center px-8 border-b border-zinc-100 shrink-0">
            <img src="https://ik.imagekit.io/xsbrdnr0y/Elevva_Logo_Black.png" alt="Logo" className="h-[56px] w-auto mb-0.5" />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded">Admin Panel</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
            <button onClick={() => setCurrentView('OVERVIEW')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentView === 'OVERVIEW' ? 'bg-black text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-50 hover:text-black'}`}>
                <LayoutDashboard className="w-5 h-5" /> Visão Geral
            </button>
            <button onClick={() => setCurrentView('USERS')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentView === 'USERS' ? 'bg-black text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-50 hover:text-black'}`}>
                <Users className="w-5 h-5" /> Usuários
            </button>
            <button onClick={() => setCurrentView('FINANCE')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentView === 'FINANCE' ? 'bg-black text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-50 hover:text-black'}`}>
                <DollarSign className="w-5 h-5" /> Faturamento
            </button>
            <button onClick={() => { setCurrentView('PROMPTS'); fetchRecruiterPrompt(); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentView === 'PROMPTS' ? 'bg-black text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-50 hover:text-black'}`}>
                <Bot className="w-5 h-5" /> Prompt System
            </button>
        </nav>

        <div className="p-4 border-t border-zinc-100">
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 transition-colors">
                <LogOut className="w-5 h-5" /> Sair
            </button>
        </div>
    </div>
  );

  const renderOverview = () => {
    const currentFinancials = getFinancialData();
    return (
    <div className="space-y-8 animate-fade-in">
        <div>
            <h2 className="text-3xl font-black text-zinc-900 tracking-tighter">Visão Geral</h2>
            <p className="text-zinc-500 font-medium">Métricas de hoje, {new Date().toLocaleDateString('pt-BR')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-zinc-100 rounded-2xl"><Users className="w-6 h-6 text-zinc-900"/></div>
                    <span className="text-emerald-500 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1"><TrendingUp className="w-3 h-3"/> +{users.length}</span>
                </div>
                <h3 className="text-4xl font-black text-zinc-900">{users.length}</h3>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Total de Usuários</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-zinc-100 rounded-2xl"><Megaphone className="w-6 h-6 text-zinc-900"/></div>
                </div>
                <h3 className="text-4xl font-black text-zinc-900">{ads.length}</h3>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Anúncios Ativos</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-zinc-100 rounded-2xl"><FileText className="w-6 h-6 text-zinc-900"/></div>
                </div>
                <h3 className="text-4xl font-black text-zinc-900">{allJobs.reduce((acc, job) => acc + job.candidates_count, 0)}</h3>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Currículos Processados</p>
            </div>
            <div className="bg-black text-white p-6 rounded-[2rem] border border-zinc-900 shadow-xl">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-zinc-900 rounded-2xl"><DollarSign className="w-6 h-6 text-[#84cc16]"/></div>
                </div>
                <h3 className="text-4xl font-black text-white">R$ {currentFinancials.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">MRR Atual (Estimado)</p>
            </div>
        </div>
    </div>
    );
  };

  const renderUsersList = () => {
      const filteredUsers = users.filter(u => 
          u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
          u.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
      const totalEssencial = users.filter(u => u.plan === 'ESSENCIAL').length;
      const totalPro = users.filter(u => u.plan === 'PRO').length;
      const totalEnterprise = users.filter(u => u.plan === 'ENTERPRISE').length;

      return (
          <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center">
                  <div>
                      <h2 className="text-3xl font-black text-zinc-900 tracking-tighter">Usuários</h2>
                      <p className="text-zinc-500 font-medium">Gerencie o acesso à plataforma.</p>
                  </div>
                  <div className="flex gap-4">
                      <div className="bg-white border border-zinc-200 px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm">
                          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Essencial</span>
                          <span className="text-lg font-black text-zinc-900">{totalEssencial}</span>
                      </div>
                      <div className="bg-black text-white px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm">
                          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Pro</span>
                          <span className="text-lg font-black text-[#65a30d]">{totalPro}</span>
                      </div>
                      <div className="bg-zinc-800 text-white px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm">
                          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Enterprise</span>
                          <span className="text-lg font-black text-purple-400">{totalEnterprise}</span>
                      </div>
                  </div>
                  <div className="relative">
                      <Search className="w-5 h-5 absolute left-4 top-3.5 text-zinc-400" />
                      <input type="text" placeholder="Buscar nome ou email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-xl text-sm font-bold focus:border-black focus:ring-0 outline-none w-64 md:w-80 shadow-sm" />
                  </div>
              </div>
              <div className="bg-white border border-zinc-200 rounded-[2rem] overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                      <thead className="bg-zinc-50 text-zinc-400 text-[10px] font-black uppercase tracking-widest border-b border-zinc-100">
                          <tr>
                              <th className="p-6">Usuário</th>
                              <th className="p-6">Plano</th>
                              <th className="p-6">Cadastro</th>
                              <th className="p-6">Último Acesso</th>
                              <th className="p-6">Uso</th>
                              <th className="p-6">Status</th>
                              <th className="p-6 text-right">Ações</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50 text-sm">
                          {filteredUsers.map(user => (
                              <tr key={user.id} className="hover:bg-zinc-50/50 transition-colors">
                                  <td className="p-6"><div className="font-bold text-zinc-900">{user.name || 'Sem nome'}</div><div className="text-xs text-zinc-500">{user.email}</div></td>
                                  <td className="p-6"><span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${user.plan === 'ENTERPRISE' ? 'bg-purple-600 text-white' : user.plan === 'PRO' ? 'bg-[#65a30d] text-black' : user.plan === 'ESSENCIAL' ? 'bg-zinc-100 text-zinc-500' : 'bg-black text-white'}`}>{user.plan}</span></td>
                                  <td className="p-6"><span className="text-xs font-bold text-zinc-500">{new Date(user.created_at).toLocaleDateString('pt-BR')}</span></td>
                                  <td className="p-6"><span className="text-xs font-bold text-zinc-500">{user.last_active ? new Date(user.last_active).toLocaleDateString('pt-BR') : '-'}</span></td>
                                  <td className="p-6"><div className="flex items-center gap-2"><div className="w-16 h-1.5 bg-zinc-100 rounded-full overflow-hidden"><div className="h-full bg-black rounded-full" style={{ width: `${Math.min(100, user.resume_usage / 25 * 100)}%`}}></div></div><span className="text-xs font-bold text-zinc-600">{user.resume_usage}</span></div></td>
                                  <td className="p-6">{user.status === 'BLOCKED' ? (<span className="flex items-center gap-1 text-red-500 font-bold text-xs"><Ban className="w-3 h-3"/> Bloqueado</span>) : (<span className="flex items-center gap-1 text-emerald-500 font-bold text-xs"><CheckCircle2 className="w-3 h-3"/> Ativo</span>)}</td>
                                  <td className="p-6 text-right"><button onClick={() => setSelectedUser(user)} className="text-zinc-400 hover:text-black font-bold text-xs underline">Detalhes</button></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      );
  };

  const renderAdsManager = () => (
      <div className="space-y-8 animate-fade-in h-[calc(100vh-140px)] flex flex-col">
          <div>
              <h2 className="text-3xl font-black text-zinc-900 tracking-tighter">Gerenciador de Anúncios</h2>
              <p className="text-zinc-500 font-medium">Crie cards visíveis para todos os usuários.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-0">
              
              {/* COLUNA ESQUERDA: CRIAÇÃO */}
              <div className="bg-white rounded-[2rem] p-8 border border-zinc-200 shadow-sm flex flex-col overflow-y-auto">
                  <h3 className="text-lg font-black text-zinc-900 mb-6 flex items-center gap-2"><Upload className="w-5 h-5"/> Novo Anúncio</h3>
                  
                  <div className="space-y-6 flex-1">
                      <div>
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Título / Chamada</label>
                          <input 
                              type="text" 
                              value={newAdTitle}
                              onChange={(e) => setNewAdTitle(e.target.value)}
                              placeholder="Ex: Promoção de Black Friday!"
                              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 font-bold text-sm focus:border-black focus:ring-0 outline-none transition-all"
                          />
                      </div>

                      <div>
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 block flex items-center gap-2">
                              <Filter className="w-3 h-3"/> Visibilidade por Plano
                          </label>
                          <div className="flex flex-wrap gap-2">
                              {(['ESSENCIAL', 'PRO', 'ENTERPRISE'] as PlanType[]).map(plan => (
                                  <button
                                      key={plan}
                                      onClick={() => togglePlan(plan)}
                                      className={`flex-1 py-3 px-2 rounded-xl text-xs font-bold border-2 transition-all ${
                                          newAdPlans.includes(plan) 
                                          ? 'bg-black text-white border-black' 
                                          : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300'
                                      }`}
                                  >
                                      {plan}
                                  </button>
                              ))}
                          </div>
                      </div>

                      <div>
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Arte do Anúncio</label>
                          <div 
                              onClick={() => fileInputRef.current?.click()}
                              className="border-2 border-dashed border-zinc-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-50 hover:border-zinc-400 transition-all text-zinc-400 h-32"
                          >
                              <ImageIcon className="w-8 h-8 mb-2" />
                              <span className="text-xs font-bold uppercase">Clique para Upload</span>
                              <input 
                                  type="file" 
                                  ref={fileInputRef} 
                                  onChange={handleImageSelect} 
                                  className="hidden" 
                                  accept="image/*"
                              />
                          </div>
                      </div>

                      <button 
                          onClick={handlePostAd}
                          disabled={isPostingAd || !newAdImage}
                          className="w-full bg-black text-white font-bold py-4 rounded-xl shadow-lg hover:bg-zinc-900 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                          {isPostingAd ? <Loader2 className="w-5 h-5 animate-spin"/> : <CheckCircle2 className="w-5 h-5"/>}
                          Publicar Anúncio
                      </button>
                  </div>
              </div>

              {/* COLUNA DIREITA: PREVIEW & LISTA */}
              <div className="flex flex-col gap-6 h-full min-h-0">
                  {/* PREVIEW */}
                  <div className="bg-zinc-100 rounded-[2rem] p-8 border border-zinc-200 flex flex-col items-center justify-center relative overflow-hidden shrink-0">
                      <div className="absolute top-4 left-4 bg-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-400 border border-zinc-200">Live Preview</div>
                      
                      {/* CARD SIMULADO */}
                      <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-100 shadow-[0px_4px_20px_rgba(0,0,0,0.05)] overflow-hidden relative group cursor-default transform hover:-translate-y-1 hover:shadow-[0px_4px_25px_rgba(0,0,0,0.08)] transition-all duration-300">
                          <div className="h-40 bg-zinc-200 relative">
                              {newAdPreview ? (
                                  <img src={newAdPreview} className="w-full h-full object-cover" alt="Preview" />
                              ) : (
                                  <div className="w-full h-full flex items-center justify-center text-zinc-400">
                                      <ImageIcon className="w-8 h-8" />
                                  </div>
                              )}
                              <div className="absolute top-3 right-3 bg-black text-white text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest">
                                  Anúncio
                              </div>
                          </div>
                          <div className="p-5">
                              <h4 className="font-black text-lg text-zinc-900 leading-tight mb-2 line-clamp-2">
                                  {newAdTitle || 'Título do Anúncio'}
                              </h4>
                          </div>
                      </div>
                  </div>

                  {/* LISTA DE ANÚNCIOS */}
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                      <h3 className="text-lg font-black text-zinc-900 mb-4 sticky top-0 bg-white/80 backdrop-blur py-2 z-10 flex items-center gap-2">
                          <Megaphone className="w-5 h-5"/> Ativos ({ads.length})
                      </h3>
                      <div className="space-y-4">
                          {ads.length === 0 && (
                              <p className="text-zinc-400 text-sm font-medium text-center py-8">Nenhum anúncio ativo.</p>
                          )}
                          {ads.map(ad => (
                              <div key={ad.id} className="flex gap-4 p-4 border border-zinc-200 rounded-xl hover:border-black transition-all group bg-white">
                                  <img src={ad.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover bg-zinc-100 border border-zinc-100" />
                                  <div className="flex-1 min-w-0">
                                      <h4 className="font-bold text-zinc-900 text-sm truncate">{ad.title}</h4>
                                      <div className="flex gap-1 mt-2">
                                          {ad.targetPlans.map(p => (
                                              <span key={p} className="text-[9px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded font-bold">{p}</span>
                                          ))}
                                      </div>
                                  </div>
                                  <button onClick={() => handleDeleteAd(ad.id)} className="text-zinc-300 hover:text-red-500 transition-colors self-start">
                                      <Trash2 className="w-4 h-4" />
                                  </button>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      </div>
  );

  const renderCommissions = () => {
      const salesStats: Record<string, { name: string, clients: number, essencial: number, pro: number, enterprise: number, commission: number }> = {};

      users.forEach(user => {
          if (user.salesperson && user.plan !== 'ADMIN') {
              const key = user.salesperson.trim().toLowerCase();
              const name = user.salesperson.trim();
              
              if (!salesStats[key]) {
                  salesStats[key] = { name, clients: 0, essencial: 0, pro: 0, enterprise: 0, commission: 0 };
              }

              salesStats[key].clients++;

              if (user.plan === 'ESSENCIAL') {
                  salesStats[key].essencial++;
                  salesStats[key].commission += 100;
              } else if (user.plan === 'PRO') {
                   salesStats[key].pro++;
                   salesStats[key].commission += 200;
              } else if (user.plan === 'ENTERPRISE') {
                  salesStats[key].enterprise++;
                  salesStats[key].commission += 300;
              }
          }
      });

      const sortedSalespeople = Object.values(salesStats).sort((a, b) => b.commission - a.commission);
      const totalCommission = sortedSalespeople.reduce((acc, curr) => acc + curr.commission, 0);

      return (
          <div className="space-y-8 animate-fade-in">
              <div>
                  <h2 className="text-3xl font-black text-zinc-900 tracking-tighter">Comissões</h2>
                  <p className="text-zinc-500 font-medium">Gestão de vendedores e pagamentos.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-black text-white p-6 rounded-[2rem] border border-zinc-900 shadow-xl">
                      <div className="flex justify-between items-start mb-4">
                          <div className="p-3 bg-zinc-900 rounded-2xl"><Banknote className="w-6 h-6 text-[#84cc16]"/></div>
                      </div>
                      <h3 className="text-4xl font-black text-white">R$ {totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Total em Comissões</p>
                  </div>
                  <div className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                          <div className="p-3 bg-zinc-100 rounded-2xl"><Users className="w-6 h-6 text-zinc-900"/></div>
                      </div>
                      <h3 className="text-4xl font-black text-zinc-900">{sortedSalespeople.length}</h3>
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Vendedores Ativos</p>
                  </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-[2rem] overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                      <thead className="bg-zinc-50 text-zinc-400 text-[10px] font-black uppercase tracking-widest border-b border-zinc-100">
                          <tr>
                              <th className="p-6">Vendedor</th>
                              <th className="p-6">Clientes Ativos</th>
                              <th className="p-6">Vendas (Essencial/Pro/Ent)</th>
                              <th className="p-6 text-right">Comissão Total (Est.)</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50 text-sm">
                          {sortedSalespeople.map((stat, idx) => (
                              <tr key={idx} className="hover:bg-zinc-50/50 transition-colors">
                                  <td className="p-6 font-bold text-zinc-900">{stat.name}</td>
                                  <td className="p-6 font-bold text-zinc-600">{stat.clients}</td>
                                  <td className="p-6">
                                      <div className="flex gap-2">
                                          <span className="bg-zinc-100 text-zinc-500 px-2 py-1 rounded text-[10px] font-bold">{stat.essencial} Essencial</span>
                                          <span className="bg-[#65a30d] text-black px-2 py-1 rounded text-[10px] font-bold">{stat.pro} Pro</span>
                                          <span className="bg-purple-600 text-white px-2 py-1 rounded text-[10px] font-bold">{stat.enterprise} Ent</span>
                                      </div>
                                  </td>
                                  <td className="p-6 text-right font-black text-emerald-600 text-lg">
                                      R$ {stat.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </td>
                              </tr>
                          ))}
                          {sortedSalespeople.length === 0 && (
                              <tr>
                                  <td colSpan={4} className="p-12 text-center text-zinc-400 font-medium">
                                      Nenhum vendedor com vendas registradas.
                                  </td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      );
  };

  const renderFinance = () => {
      const stats = getFinancialData();
      const arpu = stats.payingUsers > 0 ? stats.mrr / stats.payingUsers : 0;
      
      const recentTransactions = users
          .filter(u => u.plan !== 'ADMIN')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5);

      return (
          <div className="space-y-8 animate-fade-in pb-12">
              <div className="flex justify-between items-end">
                  <div>
                      <h2 className="text-3xl font-black text-zinc-900 tracking-tighter">Faturamento</h2>
                      <p className="text-zinc-500 font-medium">Gestão financeira e métricas de receita.</p>
                  </div>
                  <div className="bg-white px-4 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-500 shadow-sm flex items-center gap-2">
                      <Calendar className="w-4 h-4"/>
                      {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </div>
              </div>

              {/* KPIS PRINCIPAIS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* MRR CARD - BLACK */}
                  <div className="bg-black text-white p-8 rounded-[2.5rem] border border-zinc-800 shadow-xl relative overflow-hidden group">
                      <div className="relative z-10">
                          <div className="flex justify-between items-start mb-6">
                              <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800">
                                  <Wallet className="w-6 h-6 text-[#84cc16]"/>
                              </div>
                              <span className="text-[#84cc16] bg-[#84cc16]/10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-[#84cc16]/20">
                                  Mensal
                              </span>
                          </div>
                          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">MRR (Receita Recorrente)</p>
                          <h3 className="text-5xl font-black text-white tracking-tighter mb-2">
                              R$ {stats.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </h3>
                          <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold mt-4">
                              <TrendingUp className="w-4 h-4 text-emerald-500" />
                              <span className="text-emerald-500">Projeção Anual:</span> 
                              R$ {(stats.mrr * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                      </div>
                      <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-800/30 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                  </div>

                  {/* PAYING USERS CARD */}
                  <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm flex flex-col justify-between">
                      <div>
                          <div className="flex justify-between items-start mb-6">
                              <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
                                  <CreditCard className="w-6 h-6 text-zinc-900"/>
                              </div>
                          </div>
                          <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-1">Assinantes Ativos</p>
                          <h3 className="text-5xl font-black text-zinc-900 tracking-tighter">
                              {stats.payingUsers}
                          </h3>
                      </div>
                      <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden mt-6">
                          <div className="bg-black h-full rounded-full" style={{ width: `${(stats.payingUsers / (stats.totalUsers || 1)) * 100}%` }}></div>
                      </div>
                      <p className="text-[10px] font-bold text-zinc-400 mt-2 text-right">
                          {((stats.payingUsers / (stats.totalUsers || 1)) * 100).toFixed(1)}% da base total
                      </p>
                  </div>

                  {/* ARPU CARD */}
                  <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm flex flex-col justify-between">
                      <div>
                          <div className="flex justify-between items-start mb-6">
                              <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
                                  <Briefcase className="w-6 h-6 text-zinc-900"/>
                              </div>
                          </div>
                          <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-1">Ticket Médio (ARPU)</p>
                          <h3 className="text-5xl font-black text-zinc-900 tracking-tighter">
                              R$ {arpu.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                          </h3>
                      </div>
                      <div className="flex gap-2 mt-6">
                          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1 border border-emerald-100">
                              <ArrowUpRight className="w-3 h-3" /> Saudável
                          </span>
                      </div>
                  </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* BREAKDOWN DE PLANOS */}
                  <div className="bg-white rounded-[2rem] border border-zinc-200 shadow-sm p-8">
                      <h3 className="text-lg font-black text-zinc-900 mb-6 flex items-center gap-2">
                          <PieChart className="w-5 h-5"/> Distribuição de Receita
                      </h3>
                      
                      <div className="space-y-6">
                          {/* Essencial */}
                          <div>
                              <div className="flex justify-between items-end mb-2">
                                  <div>
                                      <span className="text-sm font-bold text-zinc-900 block">Plano Essencial</span>
                                      <span className="text-xs text-zinc-500 font-medium">R$ 499,90 / mês</span>
                                  </div>
                                  <div className="text-right">
                                      <span className="text-lg font-black text-zinc-900">{stats.ESSENCIAL.count}</span>
                                      <span className="text-xs text-zinc-400 font-bold ml-1">usuários</span>
                                  </div>
                              </div>
                              <div className="w-full bg-zinc-100 h-3 rounded-full overflow-hidden">
                                  <div className="bg-zinc-900 h-full rounded-full" style={{ width: `${(stats.ESSENCIAL.count / (stats.payingUsers || 1)) * 100}%` }}></div>
                              </div>
                          </div>

                          {/* Pro */}
                          <div>
                              <div className="flex justify-between items-end mb-2">
                                  <div>
                                      <span className="text-sm font-bold text-zinc-900 block">Plano Pro</span>
                                      <span className="text-xs text-zinc-500 font-medium">R$ 799,90 / mês</span>
                                  </div>
                                  <div className="text-right">
                                      <span className="text-lg font-black text-zinc-900">{stats.PRO.count}</span>
                                      <span className="text-xs text-zinc-400 font-bold ml-1">usuários</span>
                                  </div>
                              </div>
                              <div className="w-full bg-zinc-100 h-3 rounded-full overflow-hidden">
                                  <div className="bg-[#65a30d] h-full rounded-full" style={{ width: `${(stats.PRO.count / (stats.payingUsers || 1)) * 100}%` }}></div>
                              </div>
                          </div>

                          {/* Enterprise */}
                          <div>
                              <div className="flex justify-between items-end mb-2">
                                  <div>
                                      <span className="text-sm font-bold text-zinc-900 block">Plano Enterprise</span>
                                      <span className="text-xs text-zinc-500 font-medium">A consultar</span>
                                  </div>
                                  <div className="text-right">
                                      <span className="text-lg font-black text-zinc-900">{stats.ENTERPRISE.count}</span>
                                      <span className="text-xs text-zinc-400 font-bold ml-1">usuários</span>
                                  </div>
                              </div>
                              <div className="w-full bg-zinc-100 h-3 rounded-full overflow-hidden">
                                  <div className="bg-purple-600 h-full rounded-full" style={{ width: `${(stats.ENTERPRISE.count / (stats.payingUsers || 1)) * 100}%` }}></div>
                              </div>
                          </div>
                      </div>

                      <div className="mt-8 pt-6 border-t border-zinc-100 flex justify-between items-center text-xs font-bold text-zinc-500">
                          <span>Conversão: <strong className="text-zinc-900">{((stats.payingUsers / (stats.totalUsers || 1)) * 100).toFixed(1)}%</strong></span>
                      </div>
                  </div>

                  {/* TRANSAÇÕES RECENTES (SIMULADO VIA USERS) */}
                  <div className="bg-white rounded-[2rem] border border-zinc-200 shadow-sm p-8 flex flex-col">
                      <h3 className="text-lg font-black text-zinc-900 mb-6 flex items-center gap-2">
                          <Activity className="w-5 h-5"/> Últimas Conversões
                      </h3>
                      
                      <div className="flex-1 overflow-auto custom-scrollbar">
                          {recentTransactions.length === 0 ? (
                              <div className="flex flex-col items-center justify-center h-full text-zinc-400 py-10">
                                  <Ban className="w-8 h-8 mb-2 opacity-50" />
                                  <p className="text-xs font-bold uppercase">Nenhuma venda recente</p>
                              </div>
                          ) : (
                              <div className="space-y-4">
                                  {recentTransactions.map(user => (
                                      <div key={user.id} className="flex items-center justify-between p-4 rounded-xl border border-zinc-100 bg-zinc-50/50 hover:bg-zinc-50 transition-colors">
                                          <div className="flex items-center gap-3">
                                              <div className="w-10 h-10 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-400 font-bold">
                                                  {user.name?.charAt(0)}
                                              </div>
                                              <div>
                                                  <p className="text-sm font-bold text-zinc-900">{user.name}</p>
                                                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{user.plan}</p>
                                              </div>
                                          </div>
                                          <div className="text-right">
                                              <p className="text-sm font-black text-emerald-600">
                                                  + R$ {user.plan === 'ENTERPRISE' ? 'A consultar' : user.plan === 'PRO' ? '799,90' : '499,90'}
                                              </p>
                                              <p className="text-[10px] text-zinc-400">
                                                  {new Date(user.created_at).toLocaleDateString('pt-BR')}
                                              </p>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-zinc-50"><Loader2 className="w-10 h-10 animate-spin text-black" /></div>;

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 flex">
        {renderSidebar()}
        
        <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen">
            {dataError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3 animate-fade-in shadow-sm">
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                        <h3 className="text-sm font-black text-red-900 mb-1">Erro de Permissão (Dados Zerados)</h3>
                        <p className="text-xs text-red-700 font-medium mb-3">
                            O Supabase bloqueou a leitura dos dados de outros usuários. Isso acontece porque a política de segurança padrão protege a privacidade.
                        </p>
                        <button 
                            onClick={() => setCurrentView('DATABASE')} 
                            className="bg-red-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-red-700 transition-colors"
                        >
                            Corrigir Agora (Ir para Banco de Dados &gt; Script V43)
                        </button>
                    </div>
                </div>
            )}

            {currentView === 'OVERVIEW' && renderOverview()}
            {currentView === 'USERS' && renderUsersList()}
            {currentView === 'ADS' && renderAdsManager()}
            {currentView === 'FINANCE' && renderFinance()} 
            {currentView === 'COMMISSIONS' && renderCommissions()}
            {currentView === 'PROMPTS' && (
                <div className="max-w-3xl">
                    <div className="mb-6">
                        <h1 className="text-2xl font-black text-zinc-900">Prompt System</h1>
                        <p className="text-sm text-zinc-500 mt-1">Instruções enviadas para a IA ao analisar currículos. Use <code className="bg-zinc-100 px-1 rounded text-xs">{'{jobTitle}'}</code> e <code className="bg-zinc-100 px-1 rounded text-xs">{'{criteria}'}</code> como variáveis dinâmicas.</p>
                    </div>

                    <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
                        {/* Header do card */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-zinc-900 rounded-xl flex items-center justify-center">
                                    <Bot className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-zinc-900">Agente Recrutador</p>
                                    <p className="text-xs text-zinc-400">
                                        {promptUpdatedAt
                                            ? `Atualizado em ${new Date(promptUpdatedAt).toLocaleString('pt-BR')}`
                                            : 'Nunca editado — usando prompt padrão'}
                                    </p>
                                </div>
                            </div>
                            {!isEditingPrompt && (
                                <button
                                    onClick={() => { setRecruiterPromptDraft(recruiterPrompt || DEFAULT_RECRUITER_PROMPT); setIsEditingPrompt(true); }}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition-colors"
                                >
                                    <Edit3 className="w-4 h-4" /> Editar
                                </button>
                            )}
                        </div>

                        {/* Corpo */}
                        <div className="p-6">
                            {promptLoading ? (
                                <div className="flex items-center justify-center py-16">
                                    <Loader2 className="w-6 h-6 animate-spin text-zinc-300" />
                                </div>
                            ) : isEditingPrompt ? (
                                <div className="space-y-4">
                                    <textarea
                                        value={recruiterPromptDraft}
                                        onChange={e => setRecruiterPromptDraft(e.target.value)}
                                        rows={26}
                                        className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-zinc-400 resize-none"
                                        placeholder="Digite o prompt do agente recrutador..."
                                    />
                                    <div className="flex gap-3 justify-end">
                                        <button
                                            onClick={() => setIsEditingPrompt(false)}
                                            className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-500 hover:bg-zinc-50 transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={saveRecruiterPrompt}
                                            disabled={promptSaving}
                                            className="flex items-center gap-2 px-5 py-2 bg-black text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-colors disabled:opacity-50"
                                        >
                                            {promptSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Salvar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <pre className="whitespace-pre-wrap text-sm text-zinc-700 bg-zinc-50 rounded-xl px-4 py-3 min-h-[200px]">
                                    {recruiterPrompt || DEFAULT_RECRUITER_PROMPT}
                                </pre>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {currentView === 'DATABASE' && <SqlSetupModal onClose={() => setCurrentView('OVERVIEW')} />}
            {currentView === 'CANCELLATIONS' && (
                <div className="text-center py-20">
                    <UserX className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-zinc-900">Em Desenvolvimento</h3>
                    <p className="text-zinc-500">Módulo de cancelamentos em breve.</p>
                </div>
            )}
        </main>

        {/* USER DETAILS MODAL */}
        {selectedUser && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[95vh] overflow-y-auto p-8 shadow-2xl relative">
                    <button onClick={() => { setSelectedUser(null); setIsEditingPlan(false); }} className="absolute top-6 right-6 p-2 bg-zinc-50 hover:bg-zinc-100 rounded-full transition-colors z-10"><X className="w-5 h-5"/></button>

                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center text-2xl font-black text-zinc-400">
                            {selectedUser.name?.charAt(0) || selectedUser.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-zinc-900 leading-none">{selectedUser.name || 'Sem nome'}</h3>
                            <p className="text-zinc-500 font-medium text-sm mt-1">{selectedUser.email}</p>
                        </div>
                    </div>


                    <div className="space-y-6">
                        <div className="bg-zinc-50 p-5 rounded-2xl border border-zinc-100 relative group">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Plano Atual (Manual)</p>
                                <button onClick={() => { setIsEditingPlan(!isEditingPlan); if (!isEditingPlan && selectedUser) { const defPrice = selectedUser.plan_price != null ? selectedUser.plan_price : (selectedUser.plan === 'ESSENCIAL' ? 499.90 : selectedUser.plan === 'PRO' ? 799.90 : 0); setTempPlanPrice(String(defPrice)); } }} className="text-zinc-400 hover:text-black transition-colors bg-white p-1 rounded-md border border-zinc-200" title="Trocar Plano">
                                    {isEditingPlan ? <X className="w-4 h-4"/> : <Edit3 className="w-4 h-4" />}
                                </button>
                            </div>
                            
                            {isEditingPlan ? (
                                <div className="space-y-3 animate-fade-in">
                                    <p className="text-xs text-zinc-500 font-medium">Selecione o plano e defina o valor mensal.</p>
                                    <div>
                                        <label className="text-xs font-bold text-zinc-600 block mb-1">Valor Mensal (R$)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={tempPlanPrice}
                                            onChange={(e) => setTempPlanPrice(e.target.value)}
                                            placeholder="Ex: 499.90"
                                            className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        <button onClick={() => handleUpdatePlan('ESSENCIAL', tempPlanPrice ? parseFloat(tempPlanPrice) : 499.90)} className="text-xs font-bold py-3 px-3 rounded-xl border flex justify-between items-center transition-colors bg-white text-zinc-600 border-zinc-200 hover:border-black hover:text-black">
                                            <span>ESSENCIAL</span> <span className="text-[10px] text-zinc-400 font-normal">3 Vagas / CVs Ilimitados</span>
                                        </button>
                                        <button onClick={() => handleUpdatePlan('PRO', tempPlanPrice ? parseFloat(tempPlanPrice) : 799.90)} className="text-xs font-bold py-3 px-3 rounded-xl border flex justify-between items-center transition-colors bg-[#65a30d] text-black border-[#65a30d] hover:bg-[#4d7c0f]">
                                            <span>PRO</span> <span className="text-[10px] text-black/60 font-normal">10 Vagas / CVs Ilimitados</span>
                                        </button>
                                        <button onClick={() => handleUpdatePlan('ENTERPRISE', tempPlanPrice ? parseFloat(tempPlanPrice) : 0)} className="text-xs font-bold py-3 px-3 rounded-xl border flex justify-between items-center transition-colors bg-purple-600 text-white border-purple-600 hover:bg-purple-700">
                                            <span>ENTERPRISE</span> <span className="text-[10px] text-white/60 font-normal">Ilimitado + API</span>
                                        </button>
                                        <button onClick={() => handleUpdatePlan('ADMIN', 0)} className="text-xs font-bold py-3 px-3 rounded-xl border flex justify-between items-center transition-colors bg-black text-white border-black hover:bg-zinc-800">
                                            <span>ADMIN</span> <span className="text-[10px] text-zinc-400 font-normal">Acesso Total</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-3xl font-black text-zinc-900">{selectedUser.plan}</p>
                                    <p className="text-sm font-bold text-[#65a30d] mt-1">
                                        R$ {(selectedUser.plan_price != null ? selectedUser.plan_price : (selectedUser.plan === 'ESSENCIAL' ? 499.90 : selectedUser.plan === 'PRO' ? 799.90 : 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / mês
                                    </p>
                                    <p className="text-xs text-zinc-400 font-bold mt-1">
                                        {selectedUser.plan === 'ESSENCIAL' ? 'Limites: 3 Vagas / CVs Ilimitados' : selectedUser.plan === 'PRO' ? 'Limites: 10 Vagas / CVs Ilimitados' : selectedUser.plan === 'ENTERPRISE' ? `Limites: ${selectedUser.job_limit === 9999 ? 'Ilimitado' : (selectedUser.job_limit ?? 'Ilimitado')} Vagas / CVs Ilimitados` : 'Limites: ILIMITADO'}
                                    </p>
                                    {selectedUser.plan !== 'ADMIN' && selectedUser.current_period_end && (
                                        <p className="text-xs text-zinc-500 font-bold mt-2">
                                            Renova em: {selectedUser.current_period_end && !isNaN(new Date(selectedUser.current_period_end).getTime()) ? new Date(selectedUser.current_period_end).toLocaleDateString('pt-BR') : '--/--/----'}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {selectedUser.plan !== 'ADMIN' && (
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 relative group">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Configurações do Agente</p>

                                <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs font-bold text-slate-700 block mb-1">Instância Evolution</label>
                                                <input
                                                    type="text"
                                                    value={tempInstancia}
                                                    onChange={(e) => setTempInstancia(e.target.value)}
                                                    placeholder="Ex: Farilog"
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none"
                                                />
                                                <p className="text-[10px] text-slate-400 mt-1">Nome exato da instância no Evolution GO (case-sensitive)</p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-700 block mb-1">Token da Instância Evolution</label>
                                                <input
                                                    type="password"
                                                    value={tempEvolutionToken}
                                                    onChange={(e) => setTempEvolutionToken(e.target.value)}
                                                    placeholder="Token da instância no Evolution GO"
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none"
                                                />
                                                <p className="text-[10px] text-slate-400 mt-1">Evolution GO → instância → "Token da Instância"</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <label className="text-xs font-bold text-slate-700 block mb-1">Telefone do Agente</label>
                                                <input
                                                    type="text"
                                                    value={tempTelefoneAgente}
                                                    onChange={(e) => setTempTelefoneAgente(e.target.value)}
                                                    placeholder="Ex: 5511999999999"
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-700 block mb-1">Google Calendar ID</label>
                                                <input
                                                    type="text"
                                                    value={tempCalendarId}
                                                    onChange={(e) => setTempCalendarId(e.target.value)}
                                                    placeholder="Ex: cliente@gmail.com"
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-700 block mb-1">Limite de Vagas</label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={tempJobLimit}
                                                        onChange={(e) => setTempJobLimit(parseInt(e.target.value) || 1)}
                                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setTempJobLimit(9999)}
                                                        className={`text-xs font-bold px-3 py-2 rounded-lg border transition-colors whitespace-nowrap ${tempJobLimit === 9999 ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-200 hover:border-purple-400'}`}
                                                    >
                                                        Ilimitado
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Chatwoot */}
                                        <div className="pt-2 border-t border-slate-200">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Chatwoot</p>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div>
                                                    <label className="text-xs font-bold text-slate-700 block mb-1">Account ID</label>
                                                    <input
                                                        type="number"
                                                        value={tempChatwootAccountId}
                                                        onChange={(e) => setTempChatwootAccountId(e.target.value)}
                                                        placeholder="Ex: 1"
                                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-slate-700 block mb-1">Inbox ID</label>
                                                    <input
                                                        type="number"
                                                        value={tempChatwootInboxId}
                                                        onChange={(e) => setTempChatwootInboxId(e.target.value)}
                                                        placeholder="Ex: 3"
                                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-slate-700 block mb-1">Token de Acesso</label>
                                                    <input
                                                        type="password"
                                                        value={tempChatwootToken}
                                                        onChange={(e) => setTempChatwootToken(e.target.value)}
                                                        placeholder="User Access Token"
                                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none"
                                                    />
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-slate-400 mt-1">Chatwoot → Configurações → Integrações → API de Acesso</p>
                                        </div>

                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id="statusAutomacao"
                                                    checked={tempStatusAutomacao}
                                                    onChange={(e) => setTempStatusAutomacao(e.target.checked)}
                                                    className="w-4 h-4 text-black rounded border-slate-300 focus:ring-black"
                                                />
                                                <label htmlFor="statusAutomacao" className="text-sm font-bold text-slate-900 cursor-pointer">
                                                    Ativar Automação (Bot)
                                                </label>
                                            </div>
                                            <button
                                                onClick={handleUpdateEnterprise}
                                                disabled={actionLoading}
                                                className="bg-black text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors font-bold text-sm flex justify-center items-center gap-2"
                                            >
                                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                                                Salvar
                                            </button>
                                        </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Vagas Criadas</p>
                                <p className="text-lg font-black text-zinc-900">{selectedUser.jobs_count}</p>
                            </div>
                            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Currículos</p>
                                <p className="text-lg font-black text-zinc-900">{selectedUser.resume_usage}</p>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-zinc-100 flex gap-3">
                            <button
                                onClick={() => handleToggleBlock(selectedUser)}
                                disabled={actionLoading}
                                className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${selectedUser.status === 'BLOCKED' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}
                            >
                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : (selectedUser.status === 'BLOCKED' ? <CheckCircle2 className="w-4 h-4"/> : <Ban className="w-4 h-4"/>)}
                                {selectedUser.status === 'BLOCKED' ? 'Desbloquear Conta' : 'Bloquear Acesso'}
                            </button>
                            <button
                                onClick={() => handleDeleteUser(selectedUser)}
                                disabled={actionLoading}
                                className="py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all bg-zinc-100 text-zinc-500 hover:bg-red-600 hover:text-white"
                                title="Deletar conta permanentemente"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};