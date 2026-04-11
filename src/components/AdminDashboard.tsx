import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { AdminUserProfile, Announcement, PlanType } from '../types';
import { SqlSetupModal } from './SqlSetupModal';
import {
  Users, Calendar, CreditCard, Search, Activity,
  Loader2, ArrowUpRight, Ban, CheckCircle2, X, Megaphone, Image as ImageIcon, Upload, Trash2, Filter, UserX, Wallet, Database, TrendingUp, FileText, PieChart, DollarSign, LayoutDashboard, LogOut, Edit3, Save, Banknote, Briefcase, Bot, AlertTriangle, Send, RefreshCw, MessageSquare, Sliders, GraduationCap, Plus, Link as LinkIcon
} from 'lucide-react';

// Tipos auxiliares para o Dashboard
type AdminView = 'OVERVIEW' | 'USERS' | 'ADS' | 'FINANCE' | 'CANCELLATIONS' | 'DATABASE' | 'COMMISSIONS' | 'PROMPTS' | 'VENDEDORES' | 'CHIPS' | 'VENDAS';

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

  // States para Controle Agente
  const [agentSubTab, setAgentSubTab] = useState<'trabalho' | 'atendimento' | 'treinamento'>('trabalho');

  // Prompt Trabalho (análise de currículo)
  const [recruiterPrompt, setRecruiterPrompt] = useState('');
  const [recruiterPromptDraft, setRecruiterPromptDraft] = useState('');
  const [promptUpdatedAt, setPromptUpdatedAt] = useState<string | null>(null);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptSaving, setPromptSaving] = useState(false);

  // Prompt Atendimento (personalidade do agente)
  const [attendancePrompt, setAttendancePrompt] = useState('');
  const [attendancePromptDraft, setAttendancePromptDraft] = useState('');
  const [attendanceUpdatedAt, setAttendanceUpdatedAt] = useState<string | null>(null);
  const [isEditingAttendance, setIsEditingAttendance] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);

  // Treinamento
  const [trainingMessages, setTrainingMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [trainingInput, setTrainingInput] = useState('');
  const [trainingSending, setTrainingSending] = useState(false);
  const trainingChatRef = useRef<HTMLDivElement>(null);

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

      const priceToSave = customPrice != null ? customPrice : (newPlan === 'ESSENCIAL' ? 649.90 : newPlan === 'PRO' ? 999.90 : 0);

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

  const fetchAttendancePrompt = async () => {
      setAttendanceLoading(true);
      try {
          const res = await fetch('/api/system-prompt/attendance');
          const data = await res.json() as { prompt?: string; updated_at?: string };
          const text = data.prompt || '';
          setAttendancePrompt(text);
          setAttendancePromptDraft(text);
          setAttendanceUpdatedAt(data.updated_at || null);
      } catch (err) {
          console.error('Erro ao buscar prompt de atendimento:', err);
      } finally {
          setAttendanceLoading(false);
      }
  };

  const saveAttendancePrompt = async () => {
      setAttendanceSaving(true);
      try {
          const res = await fetch('/api/system-prompt/attendance', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: attendancePromptDraft }),
          });
          if (!res.ok) throw new Error('Erro ao salvar');
          setAttendancePrompt(attendancePromptDraft);
          setAttendanceUpdatedAt(new Date().toISOString());
          setIsEditingAttendance(false);
      } catch (err) {
          alert('Erro ao salvar: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
          setAttendanceSaving(false);
      }
  };

  const sendTrainingMessage = async () => {
      if (!trainingInput.trim() || trainingSending) return;
      const userMsg = trainingInput.trim();
      setTrainingInput('');
      const newHistory = [...trainingMessages, { role: 'user' as const, content: userMsg }];
      setTrainingMessages(newHistory);
      setTrainingSending(true);
      try {
          const res = await fetch('/api/admin/training-chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: userMsg, history: trainingMessages, attendancePrompt }),
          });
          const data = await res.json() as { response?: string; error?: string };
          if (data.response) {
              setTrainingMessages([...newHistory, { role: 'assistant', content: data.response }]);
          }
      } catch (err) {
          setTrainingMessages([...newHistory, { role: 'assistant', content: '⚠️ Erro ao processar mensagem.' }]);
      } finally {
          setTrainingSending(false);
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
          ESSENCIAL: { count: 0, price: 649.90, revenue: 0 },
          PRO: { count: 0, price: 999.90, revenue: 0 },
          ENTERPRISE: { count: 0, price: 0, revenue: 0 },
          totalUsers: historicalUsers.length,
          totalRevenue: 0,
          mrr: 0, // Monthly Recurring Revenue (Normalized)
          payingUsers: 0,
          totalResumeUsage: 0 
      };

      historicalUsers.forEach(u => {
          const defaultPrice = u.plan === 'ESSENCIAL' ? 649.90 : u.plan === 'PRO' ? 999.90 : 0;
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
            <button onClick={() => { setCurrentView('PROMPTS'); fetchRecruiterPrompt(); fetchAttendancePrompt(); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentView === 'PROMPTS' ? 'bg-black text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-50 hover:text-black'}`}>
                <Sliders className="w-5 h-5" /> Controle Agente
            </button>
            <div className="pt-2 pb-1 px-4">
                <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">Comercial</p>
            </div>
            <button onClick={() => { setCurrentView('VENDAS'); fetchAllSales(); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentView === 'VENDAS' ? 'bg-black text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-50 hover:text-black'}`}>
                <CreditCard className="w-5 h-5" /> Vendas
            </button>
            <button onClick={() => { setCurrentView('VENDEDORES'); fetchSalespeople(); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentView === 'VENDEDORES' ? 'bg-black text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-50 hover:text-black'}`}>
                <Briefcase className="w-5 h-5" /> Vendedores
            </button>
            <button onClick={() => { setCurrentView('CHIPS'); fetchChips(); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentView === 'CHIPS' ? 'bg-black text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-50 hover:text-black'}`}>
                <Bot className="w-5 h-5" /> Chips WhatsApp
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
    const fin = getFinancialData();
    const totalCandidates = allJobs.reduce((acc, job) => acc + job.candidates_count, 0);
    const activeUsers = users.filter(u => u.status !== 'BLOCKED').length;
    const blockedUsers = users.filter(u => u.status === 'BLOCKED').length;
    const essencialCount = users.filter(u => u.plan === 'ESSENCIAL').length;
    const proCount       = users.filter(u => u.plan === 'PRO').length;
    const enterpriseCount= users.filter(u => u.plan === 'ENTERPRISE').length;
    const arpu = fin.payingUsers > 0 ? fin.mrr / fin.payingUsers : 0;
    const arr  = fin.mrr * 12;
    const now  = new Date();

    // ── 6 meses de dados ─────────────────────────────────────────────────────
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return { label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.',''), year: d.getFullYear(), month: d.getMonth() };
    });

    // MRR acumulado até o fim de cada mês
    const monthlyMRR = months.map(m => {
      const endOfMonth = new Date(m.year, m.month + 1, 0, 23, 59, 59);
      return users
        .filter(u => new Date(u.created_at) <= endOfMonth && u.plan !== 'ADMIN')
        .reduce((acc, u) => {
          const defaultPrice = u.plan === 'PRO' ? 999.90 : u.plan === 'ENTERPRISE' ? 0 : 649.90;
          return acc + (u.plan_price ?? defaultPrice);
        }, 0);
    });

    // Novos clientes por mês (barras secundárias)
    const monthNewUsers = months.map(m =>
      users.filter(u => { const d = new Date(u.created_at); return d.getFullYear() === m.year && d.getMonth() === m.month && u.plan !== 'ADMIN'; }).length
    );

    // Vendas
    const paidSales = allSales.filter(s => s.status === 'paid');
    const salesThisMonth = paidSales.filter(s => {
      const d = new Date(s.paid_at || s.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const revenueThisMonth = salesThisMonth.reduce((acc, s) => acc + (s.amount || 0), 0);

    // ── SVG área chart ────────────────────────────────────────────────────────
    const W = 560, H = 200;
    const PAD = { top: 24, right: 24, bottom: 44, left: 72 };
    const iW = W - PAD.left - PAD.right;
    const iH = H - PAD.top - PAD.bottom;
    const maxMRR = Math.max(...monthlyMRR, 1);
    const maxNew = Math.max(...monthNewUsers, 1);

    const mrrPts = monthlyMRR.map((v, i) => ({
      x: PAD.left + (months.length === 1 ? iW / 2 : (i / (months.length - 1)) * iW),
      y: PAD.top + iH - (v / maxMRR) * iH,
      v,
      label: months[i].label,
      newUsers: monthNewUsers[i],
    }));

    // Smooth bezier path
    const toPath = (pts: typeof mrrPts) =>
      pts.reduce((path, pt, i) => {
        if (i === 0) return `M ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
        const prev = pts[i - 1];
        const cpX = ((prev.x + pt.x) / 2).toFixed(1);
        return `${path} C ${cpX},${prev.y.toFixed(1)} ${cpX},${pt.y.toFixed(1)} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      }, '');

    const linePath = toPath(mrrPts);
    const areaPath = `${linePath} L ${mrrPts[mrrPts.length-1].x.toFixed(1)},${(PAD.top + iH).toFixed(1)} L ${mrrPts[0].x.toFixed(1)},${(PAD.top + iH).toFixed(1)} Z`;

    // Grid Y lines (4 levels)
    const yGridVals = [0, 0.25, 0.5, 0.75, 1].map(f => ({
      y: PAD.top + iH - f * iH,
      label: `R$${((maxMRR * f) / 1000).toFixed(0)}k`,
    }));

    // ── Render ────────────────────────────────────────────────────────────────
    return (
    <div className="space-y-6 animate-fade-in pb-8">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tighter">Visão Geral</h2>
          <p className="text-zinc-400 font-medium text-sm mt-0.5 capitalize">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR — destaque */}
        <div className="col-span-2 lg:col-span-1 relative overflow-hidden rounded-[1.75rem] bg-zinc-950 p-6 shadow-xl">
          {/* Glow decorativo */}
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #84cc16 0%, transparent 70%)' }} />
          <div className="relative">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">MRR Estimado</p>
            <p className="text-3xl font-black text-white leading-none">R$ {fin.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 font-bold uppercase">ARR</span>
              <span className="text-sm font-black text-[#84cc16]">R$ {(arr / 1000).toFixed(1)}k</span>
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] bg-white border border-zinc-100 p-6 shadow-sm flex flex-col justify-between">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Clientes Ativos</p>
          <div>
            <p className="text-4xl font-black text-zinc-900 mt-2">{activeUsers}</p>
            {blockedUsers > 0
              ? <p className="text-[11px] text-red-400 font-bold mt-1">{blockedUsers} bloqueado{blockedUsers > 1 ? 's' : ''}</p>
              : <p className="text-[11px] text-zinc-300 font-bold mt-1">todos ativos</p>}
          </div>
        </div>

        <div className="rounded-[1.75rem] bg-white border border-zinc-100 p-6 shadow-sm flex flex-col justify-between">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Vendas este Mês</p>
          <div>
            <p className="text-4xl font-black text-zinc-900 mt-2">{salesThisMonth.length}</p>
            <p className="text-[11px] font-bold mt-1" style={{ color: revenueThisMonth > 0 ? '#65a30d' : '#a1a1aa' }}>
              R$ {revenueThisMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="rounded-[1.75rem] bg-white border border-zinc-100 p-6 shadow-sm flex flex-col justify-between">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Currículos</p>
          <div>
            <p className="text-4xl font-black text-zinc-900 mt-2">{totalCandidates}</p>
            <p className="text-[11px] text-zinc-300 font-bold mt-1">{allJobs.length} vagas ativas</p>
          </div>
        </div>
      </div>

      {/* Gráfico principal + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Chart card dark ── */}
        <div className="lg:col-span-2 rounded-[1.75rem] overflow-hidden" style={{ background: '#0c0c0c' }}>
          <div className="px-7 pt-6 pb-3 flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#84cc16' }}>Receita Recorrente</p>
              <p className="text-white font-black text-xl mt-0.5">MRR · Últimos 6 meses</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Atual</p>
              <p className="text-white font-black text-lg">R$ {(fin.mrr / 1000).toFixed(1)}k</p>
            </div>
          </div>

          {/* SVG */}
          <div className="px-2 pb-5">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 220 }}>
              <defs>
                {/* Gradiente da área */}
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#84cc16" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#84cc16" stopOpacity="0" />
                </linearGradient>
                {/* Glow do ponto */}
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>

              {/* Grid lines horizontais */}
              {yGridVals.map((g, i) => (
                <g key={i}>
                  <line x1={PAD.left} y1={g.y} x2={W - PAD.right} y2={g.y}
                    stroke="#1f1f1f" strokeWidth="1" strokeDasharray={i === 0 ? 'none' : '4,4'} />
                  <text x={PAD.left - 8} y={g.y + 4} textAnchor="end" fontSize={10} fontWeight="700" fill="#3f3f46">
                    {g.label}
                  </text>
                </g>
              ))}

              {/* Grid lines verticais (meses) */}
              {mrrPts.map((pt, i) => (
                <line key={i} x1={pt.x} y1={PAD.top} x2={pt.x} y2={PAD.top + iH}
                  stroke="#161616" strokeWidth="1" />
              ))}

              {/* Área preenchida */}
              <path d={areaPath} fill="url(#areaGrad)" />

              {/* Linha principal */}
              <path d={linePath} fill="none" stroke="#84cc16" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round" />

              {/* Barras de novos usuários (fundo, pequenas) */}
              {mrrPts.map((pt, i) => {
                const bH = monthNewUsers[i] > 0 ? (monthNewUsers[i] / maxNew) * 20 : 0;
                const bW = 16;
                return bH > 0 ? (
                  <rect key={i} x={pt.x - bW / 2} y={PAD.top + iH - bH} width={bW} height={bH}
                    rx={3} fill="#84cc16" opacity="0.15" />
                ) : null;
              })}

              {/* Pontos da linha */}
              {mrrPts.map((pt, i) => (
                <g key={i}>
                  {/* Halo */}
                  <circle cx={pt.x} cy={pt.y} r={8} fill="#84cc16" opacity="0.12" />
                  {/* Ponto */}
                  <circle cx={pt.x} cy={pt.y} r={4} fill="#84cc16" filter="url(#glow)" />
                  <circle cx={pt.x} cy={pt.y} r={2} fill="#fff" />
                </g>
              ))}

              {/* Labels dos meses */}
              {mrrPts.map((pt, i) => (
                <text key={i} x={pt.x} y={H - 8} textAnchor="middle"
                  fontSize={11} fontWeight="700" fill="#52525b" style={{ textTransform: 'uppercase' }}>
                  {pt.label}
                </text>
              ))}

              {/* Valores MRR acima dos pontos */}
              {mrrPts.map((pt, i) => pt.v > 0 ? (
                <text key={i} x={pt.x} y={pt.y - 13} textAnchor="middle"
                  fontSize={10} fontWeight="900" fill="#84cc16">
                  {pt.v >= 1000 ? `R$${(pt.v / 1000).toFixed(1)}k` : `R$${pt.v.toFixed(0)}`}
                </text>
              ) : null)}

              {/* Novos usuários badge (pequeno, abaixo) */}
              {mrrPts.map((pt, i) => monthNewUsers[i] > 0 ? (
                <text key={i} x={pt.x} y={PAD.top + iH - 24}
                  textAnchor="middle" fontSize={9} fontWeight="700" fill="#3f3f46">
                  +{monthNewUsers[i]}
                </text>
              ) : null)}
            </svg>
          </div>

          {/* Legenda */}
          <div className="px-7 pb-5 flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-5 h-0.5 rounded-full" style={{ background: '#84cc16' }} />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">MRR acumulado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm opacity-40" style={{ background: '#84cc16' }} />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Novos clientes/mês</span>
            </div>
          </div>
        </div>

        {/* ── Sidebar métricas ── */}
        <div className="flex flex-col gap-4">

          {/* Mix de planos */}
          <div className="flex-1 bg-white border border-zinc-100 rounded-[1.75rem] p-6 shadow-sm">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-5">Mix de Planos</p>
            <div className="space-y-4">
              {[
                { label: 'Essencial', count: essencialCount, hex: '#d4d4d8' },
                { label: 'Pro',       count: proCount,       hex: '#84cc16' },
                { label: 'Enterprise',count: enterpriseCount,hex: '#9333ea' },
              ].map(({ label, count, hex }) => {
                const pct = fin.payingUsers > 0 ? Math.round(count / fin.payingUsers * 100) : 0;
                return (
                  <div key={label}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: hex }} />
                        <span className="text-xs font-bold text-zinc-600">{label}</span>
                      </div>
                      <span className="text-xs font-black text-zinc-900">{count} <span className="text-zinc-300">({pct}%)</span></span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: hex }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ARPU + Pagantes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-950 rounded-[1.25rem] p-4 flex flex-col gap-1">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">ARPU</p>
              <p className="text-xl font-black text-white leading-none mt-1">R$ {arpu.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-zinc-950 rounded-[1.25rem] p-4 flex flex-col gap-1">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Pagantes</p>
              <p className="text-xl font-black text-white leading-none mt-1">{fin.payingUsers}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Últimas vendas */}
      {paidSales.length > 0 && (
        <div className="bg-white border border-zinc-100 rounded-[1.75rem] overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-zinc-50 flex items-center justify-between">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Últimas Vendas Confirmadas</p>
            <button onClick={() => setCurrentView('VENDAS')} className="text-xs font-bold text-zinc-400 hover:text-black transition-colors">Ver todas →</button>
          </div>
          <div className="divide-y divide-zinc-50">
            {paidSales.slice(0, 5).map(s => (
              <div key={s.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-zinc-50/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center font-black text-zinc-600 text-xs">
                    {(s.client_name || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-zinc-900 text-sm leading-none">{s.client_name}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{s.client_email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                    s.plan?.includes('PRO') ? 'bg-[#84cc16] text-black' :
                    s.plan?.includes('ENTERPRISE') ? 'bg-purple-600 text-white' : 'bg-zinc-100 text-zinc-600'
                  }`}>{s.plan}</span>
                  <span className="font-black text-zinc-900 text-sm">R$ {(s.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  <span className="text-[11px] text-zinc-400 w-20 text-right">{s.paid_at ? new Date(s.paid_at).toLocaleDateString('pt-BR') : '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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

  // ── Filtro de período global (Vendas / Vendedores / Faturamento) ─────────────
  const now = new Date();
  const [periodMode, setPeriodMode] = useState<'mes' | 'ano'>('mes');
  const [periodMonth, setPeriodMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`); // YYYY-MM
  const [periodYear, setPeriodYear] = useState(String(now.getFullYear()));

  const filterSalesByPeriod = (sales: any[]) => {
      return sales.filter(s => {
          const dateStr = s.paid_at || s.created_at;
          if (!dateStr) return false;
          const d = new Date(dateStr);
          if (periodMode === 'mes') {
              const [y, m] = periodMonth.split('-');
              return d.getFullYear() === parseInt(y) && d.getMonth() + 1 === parseInt(m);
          } else {
              return d.getFullYear() === parseInt(periodYear);
          }
      });
  };

  // ── State para o novo sistema de comissões ──────────────────────────────────
  const [spList, setSpList] = useState<any[]>([]);
  const [spLoading, setSpLoading] = useState(false);
  const [showAddSp, setShowAddSp] = useState(false);
  const [spForm, setSpForm] = useState({ name: '', email: '', phone: '', commissionPct: 15, asaasWalletId: '', password: '' });
  const [spSaving, setSpSaving] = useState(false);
  const [spError, setSpError] = useState('');
  const [editSp, setEditSp] = useState<any | null>(null);
  const [editSpForm, setEditSpForm] = useState({ name: '', phone: '', commissionPct: 15, asaasWalletId: '', status: 'active' });
  const [editSpSaving, setEditSpSaving] = useState(false);
  const [editSpError, setEditSpError] = useState('');
  const [confirmDeleteSpId, setConfirmDeleteSpId] = useState<string | null>(null);
  const [deletingSpId, setDeletingSpId] = useState<string | null>(null);

  const handleEditSp = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editSp) return;
      setEditSpSaving(true); setEditSpError('');
      try {
          const res = await fetch(`/api/salespeople/${editSp.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  name: editSpForm.name,
                  phone: editSpForm.phone,
                  commissionPct: editSpForm.commissionPct,
                  asaasWalletId: editSpForm.asaasWalletId || null,
                  status: editSpForm.status,
              }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
          setEditSp(null);
          fetchSalespeople();
      } catch (err: any) {
          setEditSpError(err.message);
      } finally {
          setEditSpSaving(false);
      }
  };

  const handleDeleteSp = async (id: string) => {
      setDeletingSpId(id);
      try {
          const res = await fetch(`/api/salespeople/${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Erro ao deletar');
          setConfirmDeleteSpId(null);
          fetchSalespeople();
      } catch (err: any) {
          alert(err.message);
      } finally {
          setDeletingSpId(null);
      }
  };
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordSaving, setResetPasswordSaving] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState('');

  const handleResetPassword = async () => {
      if (!resetPasswordId || resetPasswordValue.length < 6) return;
      setResetPasswordSaving(true);
      setResetPasswordError('');
      try {
          const res = await fetch(`/api/salespeople/${resetPasswordId}/reset-password`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ newPassword: resetPasswordValue }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Erro ao resetar');
          setResetPasswordId(null);
          setResetPasswordValue('');
      } catch (err: any) {
          setResetPasswordError(err.message);
      } finally {
          setResetPasswordSaving(false);
      }
  };
  const [walletValidating, setWalletValidating] = useState(false);
  const [walletInfo, setWalletInfo] = useState<{ valid: boolean; name?: string } | null>(null);

  // ── State para todas as vendas ────────────────────────────────────────────────
  const [allSales, setAllSales] = useState<any[]>([]);
  const [allSalesLoading, setAllSalesLoading] = useState(false);

  const fetchAllSales = async () => {
      setAllSalesLoading(true);
      try {
          const res = await fetch('/api/sales');
          if (res.ok) setAllSales(await res.json());
      } finally {
          setAllSalesLoading(false);
      }
  };

  // ── State para venda direta (sócio) ──────────────────────────────────────────
  const [showDirectLink, setShowDirectLink] = useState(false);
  const [directLinkForm, setDirectLinkForm] = useState({ clientName: '', clientEmail: '', clientPhone: '', plan: 'ESSENCIAL', billing: 'mensal', customAmount: '' });
  const [directLinkResult, setDirectLinkResult] = useState('');
  const [directLinkSaving, setDirectLinkSaving] = useState(false);
  const [directLinkError, setDirectLinkError] = useState('');
  const [directLinkCopied, setDirectLinkCopied] = useState(false);

  // ── State para dados Asaas em tempo real ─────────────────────────────────────
  const [asaasFinance, setAsaasFinance] = useState<any>(null);
  const [asaasFinanceLoading, setAsaasFinanceLoading] = useState(false);
  const [asaasSyncing, setAsaasSyncing] = useState(false);
  const [asaasSyncResult, setAsaasSyncResult] = useState('');

  const fetchAsaasFinance = async () => {
      setAsaasFinanceLoading(true);
      try {
          const res = await fetch('/api/salespeople/finance');
          if (res.ok) setAsaasFinance(await res.json());
      } finally {
          setAsaasFinanceLoading(false);
      }
  };

  const handleDirectLink = async (e: React.FormEvent) => {
      e.preventDefault();
      setDirectLinkSaving(true);
      setDirectLinkError('');
      setDirectLinkResult('');
      try {
          // Montar plan key incluindo billing (ex: ESSENCIAL ou ESSENCIAL_ANUAL)
          const isEnterprise = directLinkForm.plan === 'ENTERPRISE';
          const planKey = isEnterprise ? 'ENTERPRISE'
              : directLinkForm.billing === 'anual' ? `${directLinkForm.plan}_ANUAL` : directLinkForm.plan;
          const body: any = {
              clientName: directLinkForm.clientName,
              clientEmail: directLinkForm.clientEmail,
              clientPhone: directLinkForm.clientPhone,
              plan: planKey,
              billing: directLinkForm.billing,
          };
          if (isEnterprise && directLinkForm.customAmount) body.customAmount = parseFloat(directLinkForm.customAmount);
          const res = await fetch('/api/sales/direct-link', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Erro ao gerar link');
          setDirectLinkResult(data.paymentLink);
      } catch (err: any) {
          setDirectLinkError(err.message);
      } finally {
          setDirectLinkSaving(false);
      }
  };

  const handleAsaasSync = async () => {
      setAsaasSyncing(true);
      setAsaasSyncResult('');
      try {
          await fetch('/api/salespeople/sync', { method: 'POST' });
          setAsaasSyncResult('Sincronização iniciada! Aguarde alguns segundos e atualize.');
          setTimeout(() => { fetchSalespeople(); setAsaasSyncResult(''); }, 4000);
      } finally {
          setAsaasSyncing(false);
      }
  };

  // ── State para chips ─────────────────────────────────────────────────────────
  const [chips, setChips] = useState<any[]>([]);
  const [chipsSummary, setChipsSummary] = useState<any>({});
  const [chipsLoading, setChipsLoading] = useState(false);
  const [chipsChecking, setChipsChecking] = useState<Record<string, 'idle' | 'checking' | 'online' | 'offline'>>({});
  const [showAddChip, setShowAddChip] = useState(false);
  const [chipForm, setChipForm] = useState({ phoneNumber: '', evolutionInstance: '', displayName: '', notes: '' });
  const [chipSaving, setChipSaving] = useState(false);
  const [chipError, setChipError] = useState('');

  const fetchChips = async () => {
      setChipsLoading(true);
      try {
          const res = await fetch('/api/chips-pool');
          if (res.ok) {
              const data = await res.json();
              setChips(data.chips || []);
              setChipsSummary(data.summary || {});
          }
      } finally {
          setChipsLoading(false);
      }
  };

  const handleAddChip = async (e: React.FormEvent) => {
      e.preventDefault();
      setChipSaving(true);
      setChipError('');
      try {
          const res = await fetch('/api/chips-pool', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(chipForm),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar chip');
          setShowAddChip(false);
          setChipForm({ phoneNumber: '', evolutionInstance: '', displayName: '', notes: '' });
          fetchChips();
      } catch (err: any) {
          setChipError(err.message);
      } finally {
          setChipSaving(false);
      }
  };

  const handleChipStatus = async (chipId: string, newStatus: string) => {
      await fetch(`/api/chips-pool/${chipId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
      });
      fetchChips();
  };

  const checkChipOnline = async (chip: any) => {
      setChipsChecking(prev => ({ ...prev, [chip.id]: 'checking' }));
      try {
          const evolutionUrl = (import.meta.env.VITE_EVOLUTION_API_URL || 'https://api.elevva.net.br').replace(/\/$/, '');
          const evolutionKey = import.meta.env.VITE_EVOLUTION_API_KEY || '';
          const res = await fetch(`${evolutionUrl}/instance/connectionState/${chip.evolution_instance}`, {
              headers: { apikey: evolutionKey },
          });
          const data = await res.json() as any;
          const state = data?.instance?.state || data?.state || '';
          const online = state === 'open';
          setChipsChecking(prev => ({ ...prev, [chip.id]: online ? 'online' : 'offline' }));
      } catch {
          setChipsChecking(prev => ({ ...prev, [chip.id]: 'offline' }));
      }
  };

  const checkAllChips = async () => {
      for (const chip of chips) {
          if (chip.status !== 'cancelado') await checkChipOnline(chip);
      }
  };

  const fetchSalespeople = async () => {
      setSpLoading(true);
      try {
          const res = await fetch('/api/salespeople');
          if (res.ok) setSpList(await res.json());
      } finally {
          setSpLoading(false);
      }
  };

  const handleValidateWallet = async () => {
      if (!spForm.asaasWalletId.trim()) return;
      setWalletValidating(true);
      setWalletInfo(null);
      try {
          const res = await fetch('/api/salespeople/validate-wallet', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ walletId: spForm.asaasWalletId.trim() }),
          });
          const data = await res.json();
          setWalletInfo(data);
      } finally {
          setWalletValidating(false);
      }
  };

  const handleAddSalesperson = async (e: React.FormEvent) => {
      e.preventDefault();
      setSpSaving(true);
      setSpError('');
      try {
          const res = await fetch('/api/salespeople', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(spForm),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar');
          setShowAddSp(false);
          setSpForm({ name: '', email: '', phone: '', commissionPct: 15, asaasWalletId: '' });
          setWalletInfo(null);
          fetchSalespeople();
      } catch (err: any) {
          setSpError(err.message);
      } finally {
          setSpSaving(false);
      }
  };

  // ── Render Vendedores ─────────────────────────────────────────────────────────
  const renderVendedores = () => {
      if (spList.length === 0 && !spLoading) fetchSalespeople();
      if (!asaasFinance && !asaasFinanceLoading) fetchAsaasFinance();

      // Filtra vendas dos vendedores por período (usa allSales para cruzar billing)
      const salesByPeriod = filterSalesByPeriod(allSales).filter((s: any) => s.status === 'paid');
      const spFiltered = spList.map(sp => {
          // always recalculate using filtered
          const spSales = salesByPeriod.filter((s: any) => s.salesperson_id === sp.id);
          return {
              ...sp,
              paid_sales: spSales.length,
              total_commission: spSales.reduce((a: number, s: any) => a + (s.commission_amount || 0), 0),
              total_revenue: spSales.reduce((a: number, s: any) => a + (s.amount || 0), 0),
              pending_commission: 0,
              essencial_count: spSales.filter((s: any) => s.plan === 'ESSENCIAL' || s.plan === 'ESSENCIAL_ANUAL').length,
              pro_count: spSales.filter((s: any) => s.plan === 'PRO' || s.plan === 'PRO_ANUAL').length,
              enterprise_count: spSales.filter((s: any) => s.plan === 'ENTERPRISE').length,
          };
      });

      const totalCommission = spFiltered.reduce((acc, sp) => acc + (sp.total_commission || 0), 0);
      const totalPending = spFiltered.reduce((acc, sp) => acc + (sp.pending_commission || 0), 0);
      const totalSales = spFiltered.reduce((acc, sp) => acc + (sp.paid_sales || 0), 0);

      return (
          <div className="space-y-8 animate-fade-in">
              <div className="flex items-start justify-between">
                  <div>
                      <h2 className="text-3xl font-black text-zinc-900 tracking-tighter">Vendedores</h2>
                      <p className="text-zinc-500 font-medium">Gestão de afiliados e comissionamento — dados sincronizados com Asaas.</p>
                  </div>
                  <div className="flex items-center gap-3">
                      <PeriodSelector />
                      <button onClick={handleAsaasSync} disabled={asaasSyncing}
                          className="flex items-center gap-2 border border-[#65a30d] text-[#65a30d] font-bold px-4 py-2.5 rounded-2xl text-sm hover:bg-[#65a30d]/5 transition-colors disabled:opacity-50">
                          {asaasSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          Sync Asaas
                      </button>
                      <button onClick={() => { setShowDirectLink(true); setDirectLinkResult(''); setDirectLinkError(''); setDirectLinkCopied(false); }}
                          className="flex items-center gap-2 border border-zinc-300 text-zinc-700 font-bold px-4 py-2.5 rounded-2xl text-sm hover:bg-zinc-50 transition-colors">
                          <LinkIcon className="w-4 h-4" /> Venda Direta
                      </button>
                      <button onClick={() => setShowAddSp(true)} className="flex items-center gap-2 bg-black text-white font-bold px-5 py-2.5 rounded-2xl text-sm hover:bg-zinc-800 transition-colors">
                          <Plus className="w-4 h-4" /> Novo Vendedor
                      </button>
                  </div>
              </div>

              {asaasSyncResult && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3 text-sm font-medium text-emerald-700">{asaasSyncResult}</div>
              )}

              {/* Painel Asaas em tempo real */}
              {asaasFinance && (
                  <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-[2rem] p-6 text-white">
                      <div className="flex items-center justify-between mb-5">
                          <div>
                              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Asaas — Dados Reais do Mês</p>
                              <p className="text-sm text-zinc-300 mt-0.5">{asaasFinance.month}</p>
                          </div>
                          <button onClick={fetchAsaasFinance} disabled={asaasFinanceLoading} className="text-zinc-400 hover:text-white transition-colors">
                              {asaasFinanceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          </button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
                          <div className="bg-white/10 rounded-2xl p-4">
                              <p className="text-2xl font-black text-emerald-400">
                                  R$ {(asaasFinance.confirmed?.totalNet || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                              <p className="text-xs text-zinc-400 mt-1 font-bold uppercase tracking-wider">Recebido Líquido</p>
                              <p className="text-xs text-zinc-500 mt-0.5">{asaasFinance.confirmed?.count || 0} pagamentos</p>
                          </div>
                          <div className="bg-white/10 rounded-2xl p-4">
                              <p className="text-2xl font-black text-amber-400">
                                  R$ {(asaasFinance.pending?.totalGross || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                              <p className="text-xs text-zinc-400 mt-1 font-bold uppercase tracking-wider">Pendente</p>
                              <p className="text-xs text-zinc-500 mt-0.5">{asaasFinance.pending?.count || 0} aguardando</p>
                          </div>
                          <div className="bg-white/10 rounded-2xl p-4">
                              <p className="text-2xl font-black text-[#84cc16]">
                                  R$ {totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                              <p className="text-xs text-zinc-400 mt-1 font-bold uppercase tracking-wider">Comissões (DB)</p>
                              <p className="text-xs text-zinc-500 mt-0.5">{totalSales} vendas confirmadas</p>
                          </div>
                      </div>
                      {/* Últimas transações do Asaas */}
                      {asaasFinance.payments?.length > 0 && (
                          <div>
                              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Últimas Transações Asaas</p>
                              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                  {asaasFinance.payments.slice(0, 8).map((p: any) => (
                                      <div key={p.id} className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2">
                                          <div className="flex items-center gap-2">
                                              <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">{p.billingType}</span>
                                              <span className="text-xs text-zinc-400 font-mono">{p.id.substring(0, 12)}…</span>
                                          </div>
                                          <span className="text-sm font-black text-emerald-400">
                                              R$ {(p.netValue || p.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                          </span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
              )}

              {/* Modal Venda Direta (Sócio) */}
              {showDirectLink && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
                          <div className="flex items-center justify-between mb-6">
                              <div>
                                  <h3 className="text-xl font-black text-zinc-900">Venda Direta</h3>
                                  <p className="text-xs text-zinc-400 mt-0.5 font-medium">Sem comissão — 100% Elevva</p>
                              </div>
                              <button onClick={() => { setShowDirectLink(false); setDirectLinkResult(''); }} className="text-zinc-400 hover:text-zinc-700"><X className="w-5 h-5" /></button>
                          </div>
                          {!directLinkResult ? (
                              <form onSubmit={handleDirectLink} className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                      <div className="col-span-2">
                                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Nome do cliente</label>
                                          <input value={directLinkForm.clientName} onChange={e => setDirectLinkForm(f => ({...f, clientName: e.target.value}))}
                                              className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" placeholder="João Silva" required />
                                      </div>
                                      <div className="col-span-2">
                                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">E-mail Google do cliente</label>
                                          <input type="email" value={directLinkForm.clientEmail} onChange={e => setDirectLinkForm(f => ({...f, clientEmail: e.target.value}))}
                                              className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" placeholder="joao@gmail.com" required />
                                      </div>
                                      <div>
                                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">WhatsApp</label>
                                          <input value={directLinkForm.clientPhone} onChange={e => setDirectLinkForm(f => ({...f, clientPhone: e.target.value}))}
                                              className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" placeholder="(11) 99999-9999" required />
                                      </div>
                                      <div>
                                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Plano</label>
                                          <select value={directLinkForm.plan} onChange={e => setDirectLinkForm(f => ({...f, plan: e.target.value}))}
                                              className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 bg-white">
                                              <option value="ESSENCIAL">Essencial</option>
                                              <option value="PRO">Pro</option>
                                              <option value="ENTERPRISE">Enterprise — personalizado</option>
                                          </select>
                                      </div>
                                      {directLinkForm.plan !== 'ENTERPRISE' && (
                                          <div>
                                              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Período</label>
                                              <div className="flex gap-2">
                                                  <button type="button" onClick={() => setDirectLinkForm(f => ({...f, billing: 'mensal'}))}
                                                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${directLinkForm.billing === 'mensal' ? 'bg-black text-white border-black' : 'border-zinc-200 text-zinc-500 hover:border-zinc-400'}`}>
                                                      Mensal
                                                  </button>
                                                  <button type="button" onClick={() => setDirectLinkForm(f => ({...f, billing: 'anual'}))}
                                                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors relative ${directLinkForm.billing === 'anual' ? 'bg-black text-white border-black' : 'border-zinc-200 text-zinc-500 hover:border-zinc-400'}`}>
                                                      Anual <span className="text-[10px] text-[#84cc16] font-black">20% OFF</span>
                                                  </button>
                                              </div>
                                          </div>
                                      )}
                                      <div className="col-span-2 bg-zinc-50 rounded-xl px-4 py-3 text-sm">
                                          {directLinkForm.plan === 'ENTERPRISE' ? (
                                              <span className="text-zinc-500 font-medium">Valor personalizado abaixo</span>
                                          ) : directLinkForm.billing === 'anual' ? (
                                              <span className="font-black text-zinc-900">
                                                  {directLinkForm.plan === 'ESSENCIAL' ? 'R$ 6.230,40/ano' : 'R$ 9.599,04/ano'}
                                                  <span className="ml-2 text-xs text-zinc-400 font-medium line-through">
                                                      {directLinkForm.plan === 'ESSENCIAL' ? 'R$ 7.798,80' : 'R$ 11.998,80'}
                                                  </span>
                                              </span>
                                          ) : (
                                              <span className="font-black text-zinc-900">
                                                  {directLinkForm.plan === 'ESSENCIAL' ? 'R$ 649,90/mês' : 'R$ 999,90/mês'}
                                              </span>
                                          )}
                                      </div>
                                      {directLinkForm.plan === 'ENTERPRISE' && (
                                          <div className="col-span-2">
                                              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Valor personalizado (R$)</label>
                                              <input type="number" step="0.01" min="1" value={directLinkForm.customAmount} onChange={e => setDirectLinkForm(f => ({...f, customAmount: e.target.value}))}
                                                  className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" placeholder="0,00" required />
                                          </div>
                                      )}
                                  </div>
                                  {directLinkError && <p className="text-red-500 text-xs font-medium">{directLinkError}</p>}
                                  <button type="submit" disabled={directLinkSaving}
                                      className="w-full bg-black text-white font-bold py-3 rounded-xl text-sm hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                      {directLinkSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><LinkIcon className="w-4 h-4" /> Gerar Link de Pagamento</>}
                                  </button>
                              </form>
                          ) : (
                              <div className="space-y-5">
                                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                                      <p className="text-emerald-700 font-bold text-sm mb-1">Link gerado com sucesso!</p>
                                      <p className="text-emerald-600 text-xs">Envie ao cliente para realizar o pagamento</p>
                                  </div>
                                  <div className="bg-zinc-50 rounded-xl p-3 flex items-center gap-3">
                                      <p className="flex-1 text-xs text-zinc-600 font-mono truncate">{directLinkResult}</p>
                                      <button onClick={() => { navigator.clipboard.writeText(directLinkResult); setDirectLinkCopied(true); setTimeout(() => setDirectLinkCopied(false), 2000); }}
                                          className="shrink-0 px-3 py-1.5 bg-black text-white text-xs font-bold rounded-lg hover:bg-zinc-800 transition-colors">
                                          {directLinkCopied ? '✓ Copiado' : 'Copiar'}
                                      </button>
                                  </div>
                                  <button onClick={() => { setShowDirectLink(false); setDirectLinkResult(''); setDirectLinkForm({ clientName: '', clientEmail: '', clientPhone: '', plan: 'ESSENCIAL', billing: 'mensal', customAmount: '' }); }}
                                      className="w-full border border-zinc-200 text-zinc-600 font-bold py-2.5 rounded-xl text-sm hover:bg-zinc-50 transition-colors">
                                      Fechar
                                  </button>
                              </div>
                          )}
                      </div>
                  </div>
              )}

              {/* Modal cadastro */}
              {showAddSp && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
                          <div className="flex items-center justify-between mb-6">
                              <h3 className="text-xl font-black text-zinc-900">Novo Vendedor</h3>
                              <button onClick={() => setShowAddSp(false)} className="text-zinc-400 hover:text-zinc-700"><X className="w-5 h-5" /></button>
                          </div>
                          <form onSubmit={handleAddSalesperson} className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                  <div className="col-span-2">
                                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Nome completo</label>
                                      <input value={spForm.name} onChange={e => setSpForm(f => ({...f, name: e.target.value}))}
                                          className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" placeholder="João Silva" required />
                                  </div>
                                  <div className="col-span-2">
                                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">E-mail</label>
                                      <input type="email" value={spForm.email} onChange={e => setSpForm(f => ({...f, email: e.target.value}))}
                                          className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" placeholder="joao@email.com" required />
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Comissão (%)</label>
                                      <input type="number" min="1" max="50" step="0.5" value={spForm.commissionPct}
                                          onChange={e => setSpForm(f => ({...f, commissionPct: parseFloat(e.target.value)}))}
                                          className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" required />
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">WhatsApp (opcional)</label>
                                      <input value={spForm.phone} onChange={e => setSpForm(f => ({...f, phone: e.target.value}))}
                                          className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" placeholder="(11) 99999-9999" />
                                  </div>
                                  <div className="col-span-2">
                                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">
                                          Wallet ID Asaas <span className="text-zinc-400 normal-case font-medium">(opcional agora — obrigatório para split)</span>
                                      </label>
                                      <div className="flex gap-2">
                                          <input value={spForm.asaasWalletId} onChange={e => { setSpForm(f => ({...f, asaasWalletId: e.target.value})); setWalletInfo(null); }}
                                              className="flex-1 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                                              placeholder="ex: f0e1d2c3-a4b5-..." />
                                          <button type="button" onClick={handleValidateWallet} disabled={walletValidating || !spForm.asaasWalletId}
                                              className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-sm rounded-xl transition-colors disabled:opacity-40 whitespace-nowrap">
                                              {walletValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Validar'}
                                          </button>
                                      </div>
                                      {walletInfo && (
                                          <p className={`mt-1.5 text-xs font-medium ${walletInfo.valid ? 'text-green-600' : 'text-red-500'}`}>
                                              {walletInfo.valid ? `✓ Conta verificada: ${walletInfo.name}` : '✗ Wallet ID não encontrado no Asaas'}
                                          </p>
                                      )}
                                      <p className="mt-1 text-[11px] text-zinc-400">O vendedor encontra o Wallet ID em: Asaas → Configurações → Dados da Conta</p>
                                                                    <div className="col-span-2">
                                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Senha de acesso</label>
                                      <input type="password" value={spForm.password} onChange={e => setSpForm(f => ({...f, password: e.target.value}))}
                                          className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                                          placeholder="Mínimo 6 caracteres" required minLength={6} />
                                      <p className="mt-1 text-[11px] text-zinc-400">O vendedor poderá trocar a senha após o primeiro acesso.</p>
                                  </div>
</div>
                              </div>
                              {spError && <p className="text-red-500 text-xs font-medium">{spError}</p>}
                              <button type="submit" disabled={spSaving}
                                  className="w-full bg-black text-white font-bold py-3 rounded-xl text-sm hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                  {spSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cadastrar Vendedor'}
                              </button>
                          </form>
                      </div>
                  </div>
              )}

              {/* Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-black text-white p-6 rounded-[2rem] shadow-xl">
                      <div className="p-3 bg-zinc-900 rounded-2xl w-fit mb-4"><Banknote className="w-6 h-6 text-[#84cc16]"/></div>
                      <h3 className="text-4xl font-black">R$ {totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Comissões Pagas</p>
                  </div>
                  <div className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm">
                      <div className="p-3 bg-amber-50 rounded-2xl w-fit mb-4"><TrendingUp className="w-6 h-6 text-amber-500"/></div>
                      <h3 className="text-4xl font-black text-zinc-900">R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">A Confirmar</p>
                  </div>
                  <div className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm">
                      <div className="p-3 bg-zinc-100 rounded-2xl w-fit mb-4"><Users className="w-6 h-6 text-zinc-900"/></div>
                      <h3 className="text-4xl font-black text-zinc-900">{spList.filter(s => s.status === 'active').length}</h3>
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Ativos · {totalSales} vendas</p>
                  </div>
              </div>

              {/* Tabela */}
              <div className="bg-white border border-zinc-200 rounded-[2rem] overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                      <thead className="bg-zinc-50 text-zinc-400 text-[10px] font-black uppercase tracking-widest border-b border-zinc-100">
                          <tr>
                              <th className="p-5">Vendedor</th>
                              <th className="p-5">Comissão</th>
                              <th className="p-5">Vendas</th>
                              <th className="p-5 text-right">Confirmado</th>
                              <th className="p-5 text-right">Pendente</th>
                              <th className="p-5 text-center">Asaas</th>
                              <th className="p-5 text-center">Status</th>
                              <th className="p-5"></th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50 text-sm">
                          {spLoading ? (
                              <tr><td colSpan={8} className="p-12 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-zinc-300" /></td></tr>
                          ) : spList.length === 0 ? (
                              <tr><td colSpan={8} className="p-12 text-center text-zinc-400 font-medium">Nenhum vendedor cadastrado ainda.</td></tr>
                          ) : spList.map((sp) => (
                              <tr key={sp.id} className="hover:bg-zinc-50/50 transition-colors">
                                  <td className="p-5">
                                      <p className="font-bold text-zinc-900">{sp.name}</p>
                                      <p className="text-xs text-zinc-400">{sp.email}</p>
                                  </td>
                                  <td className="p-5 font-black text-[#65a30d] text-lg">{sp.commission_pct}%</td>
                                  <td className="p-5">
                                      <div className="flex gap-1.5">
                                          <span className="bg-zinc-100 text-zinc-500 px-2 py-1 rounded text-[10px] font-bold">{sp.essencial_count || 0} E</span>
                                          <span className="bg-[#65a30d]/20 text-[#3d6b06] px-2 py-1 rounded text-[10px] font-bold">{sp.pro_count || 0} P</span>
                                          <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-[10px] font-bold">{sp.enterprise_count || 0} Ent</span>
                                      </div>
                                  </td>
                                  <td className="p-5 text-right font-black text-emerald-600">R$ {(sp.total_commission || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                  <td className="p-5 text-right font-bold text-amber-600">R$ {(sp.pending_commission || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                  <td className="p-5 text-center">
                                      {sp.asaas_wallet_id
                                          ? <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Conectado</span>
                                          : <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-1 rounded-full">Pendente</span>}
                                  </td>
                                  <td className="p-5 text-center">
                                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${sp.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                                          {sp.status === 'active' ? 'Ativo' : 'Inativo'}
                                      </span>
                                  </td>
                                  <td className="p-5 text-center">
                                      <div className="flex items-center justify-center gap-1">
                                          <button onClick={() => { setEditSp(sp); setEditSpForm({ name: sp.name, phone: sp.phone || '', commissionPct: sp.commission_pct, asaasWalletId: sp.asaas_wallet_id || '', status: sp.status }); setEditSpError(''); }}
                                              className="text-[10px] font-bold text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition-colors">
                                              Editar
                                          </button>
                                          <button onClick={() => { setResetPasswordId(sp.id); setResetPasswordValue(''); setResetPasswordError(''); }}
                                              className="text-[10px] font-bold text-amber-600 hover:bg-amber-50 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap">
                                              Senha
                                          </button>
                                          {confirmDeleteSpId === sp.id ? (
                                              <div className="flex items-center gap-1">
                                                  <button onClick={() => handleDeleteSp(sp.id)} disabled={deletingSpId === sp.id}
                                                      className="text-[10px] font-black bg-red-500 text-white px-2 py-1 rounded-lg hover:bg-red-600 disabled:opacity-50">
                                                      {deletingSpId === sp.id ? '...' : 'Ok'}
                                                  </button>
                                                  <button onClick={() => setConfirmDeleteSpId(null)} className="text-[10px] text-zinc-400 hover:text-zinc-600 px-1.5 py-1">Não</button>
                                              </div>
                                          ) : (
                                              <button onClick={() => setConfirmDeleteSpId(sp.id)}
                                                  className="text-[10px] font-bold text-red-400 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors">
                                                  Excluir
                                              </button>
                                          )}
                                      </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>

              {/* Modal Editar Vendedor */}
              {editSp && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
                          <div className="flex items-center justify-between mb-6">
                              <h3 className="text-xl font-black text-zinc-900">Editar Vendedor</h3>
                              <button onClick={() => setEditSp(null)} className="text-zinc-400 hover:text-zinc-700"><X className="w-5 h-5" /></button>
                          </div>
                          <form onSubmit={handleEditSp} className="space-y-4">
                              <div>
                                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Nome</label>
                                  <input value={editSpForm.name} onChange={e => setEditSpForm(f => ({...f, name: e.target.value}))}
                                      className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" required />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">WhatsApp</label>
                                      <input value={editSpForm.phone} onChange={e => setEditSpForm(f => ({...f, phone: e.target.value}))}
                                          className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" placeholder="(11) 99999-9999" />
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Comissão (%)</label>
                                      <input type="number" min="1" max="50" step="0.5" value={editSpForm.commissionPct}
                                          onChange={e => setEditSpForm(f => ({...f, commissionPct: parseFloat(e.target.value)}))}
                                          className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" required />
                                  </div>
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Wallet ID Asaas</label>
                                  <input value={editSpForm.asaasWalletId} onChange={e => setEditSpForm(f => ({...f, asaasWalletId: e.target.value}))}
                                      className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" placeholder="Deixe em branco para remover" />
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Status</label>
                                  <select value={editSpForm.status} onChange={e => setEditSpForm(f => ({...f, status: e.target.value}))}
                                      className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 bg-white">
                                      <option value="active">Ativo</option>
                                      <option value="inactive">Inativo</option>
                                  </select>
                              </div>
                              {editSpError && <p className="text-red-500 text-xs font-medium">{editSpError}</p>}
                              <button type="submit" disabled={editSpSaving}
                                  className="w-full bg-black text-white font-bold py-3 rounded-xl text-sm hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                  {editSpSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Alterações'}
                              </button>
                          </form>
                      </div>
                  </div>
              )}

              {/* Modal Resetar Senha */}
              {resetPasswordId && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                      <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl">
                          <div className="flex items-center justify-between mb-6">
                              <h3 className="text-xl font-black text-zinc-900">Resetar Senha</h3>
                              <button onClick={() => setResetPasswordId(null)} className="text-zinc-400 hover:text-zinc-700"><X className="w-5 h-5" /></button>
                          </div>
                          <p className="text-sm text-zinc-500 mb-4">Defina uma nova senha para o vendedor. Informe-o diretamente após o reset.</p>
                          <div className="space-y-4">
                              <div>
                                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Nova senha</label>
                                  <input type="password" value={resetPasswordValue} onChange={e => setResetPasswordValue(e.target.value)}
                                      className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                                      placeholder="Mínimo 6 caracteres" minLength={6} />
                              </div>
                              {resetPasswordError && <p className="text-red-500 text-xs font-medium">{resetPasswordError}</p>}
                              <button onClick={handleResetPassword} disabled={resetPasswordSaving || resetPasswordValue.length < 6}
                                  className="w-full bg-black text-white font-bold py-3 rounded-xl text-sm hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                  {resetPasswordSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Reset'}
                              </button>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      );
  };

  // ── Render Chips ──────────────────────────────────────────────────────────────
  const renderChips = () => {
      if (chips.length === 0 && !chipsLoading) fetchChips();

      const disponivel = chipsSummary.disponivel || 0;
      const emUso = chipsSummary.em_uso || 0;
      const manutencao = chipsSummary.manutencao || 0;
      const total = chipsSummary.total || 0;

      const statusColor: Record<string, string> = {
          disponivel:  'bg-emerald-100 text-emerald-700',
          em_uso:      'bg-blue-100 text-blue-700',
          manutencao:  'bg-amber-100 text-amber-700',
          cancelado:   'bg-zinc-100 text-zinc-400',
      };
      const statusLabel: Record<string, string> = {
          disponivel: 'Disponível',
          em_uso:     'Em uso',
          manutencao: 'Manutenção',
          cancelado:  'Cancelado',
      };

      return (
          <div className="space-y-8 animate-fade-in">
              <div className="flex items-start justify-between">
                  <div>
                      <h2 className="text-3xl font-black text-zinc-900 tracking-tighter">Chips WhatsApp</h2>
                      <p className="text-zinc-500 font-medium">Pool de números para onboarding automático de clientes.</p>
                  </div>
                  <div className="flex gap-3">
                      <button onClick={checkAllChips} disabled={chipsLoading || chips.length === 0}
                          className="flex items-center gap-2 border border-zinc-200 text-zinc-600 font-bold px-4 py-2.5 rounded-2xl text-sm hover:bg-zinc-50 transition-colors disabled:opacity-40">
                          <Activity className="w-4 h-4" /> Verificar Todos
                      </button>
                      <button onClick={fetchChips} className="flex items-center gap-2 border border-zinc-200 text-zinc-600 font-bold px-4 py-2.5 rounded-2xl text-sm hover:bg-zinc-50 transition-colors">
                          <RefreshCw className="w-4 h-4" /> Atualizar
                      </button>
                      <button onClick={() => setShowAddChip(true)} className="flex items-center gap-2 bg-black text-white font-bold px-5 py-2.5 rounded-2xl text-sm hover:bg-zinc-800 transition-colors">
                          <Plus className="w-4 h-4" /> Adicionar Chip
                      </button>
                  </div>
              </div>

              {/* Modal cadastro chip */}
              {showAddChip && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
                          <div className="flex items-center justify-between mb-6">
                              <h3 className="text-xl font-black text-zinc-900">Novo Chip</h3>
                              <button onClick={() => setShowAddChip(false)} className="text-zinc-400 hover:text-zinc-700"><X className="w-5 h-5" /></button>
                          </div>
                          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5">
                              <p className="text-xs font-bold text-amber-700">Antes de cadastrar, o chip precisa estar autenticado no Evolution API (QR Code escaneado). Só então cadastre aqui.</p>
                          </div>
                          <form onSubmit={handleAddChip} className="space-y-4">
                              <div>
                                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Número do WhatsApp</label>
                                  <input value={chipForm.phoneNumber} onChange={e => setChipForm(f => ({...f, phoneNumber: e.target.value}))}
                                      className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                                      placeholder="5511999999999 (com DDI e DDD, sem espaços)" required />
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Nome da Instância (Evolution)</label>
                                  <input value={chipForm.evolutionInstance} onChange={e => setChipForm(f => ({...f, evolutionInstance: e.target.value}))}
                                      className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                                      placeholder="ex: elevva-chip-01" required />
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Apelido (para identificação)</label>
                                  <input value={chipForm.displayName} onChange={e => setChipForm(f => ({...f, displayName: e.target.value}))}
                                      className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                                      placeholder="ex: Chip Vivo 01" />
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Observações</label>
                                  <textarea value={chipForm.notes} onChange={e => setChipForm(f => ({...f, notes: e.target.value}))}
                                      className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 resize-none"
                                      rows={2} placeholder="Observações internas (opcional)" />
                              </div>
                              {chipError && <p className="text-red-500 text-xs font-medium">{chipError}</p>}
                              <button type="submit" disabled={chipSaving}
                                  className="w-full bg-black text-white font-bold py-3 rounded-xl text-sm hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                  {chipSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cadastrar Chip'}
                              </button>
                          </form>
                      </div>
                  </div>
              )}

              {/* Alerta pool baixo */}
              {disponivel <= 2 && total > 0 && (
                  <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                      <div>
                          <p className="font-bold text-amber-800 text-sm">Pool baixo — apenas {disponivel} chip{disponivel !== 1 ? 's' : ''} disponível{disponivel !== 1 ? 'is' : ''}</p>
                          <p className="text-xs text-amber-600 mt-0.5">Adicione novos chips antes de realizar mais vendas.</p>
                      </div>
                  </div>
              )}

              {/* Cards resumo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 text-center">
                      <p className="text-4xl font-black text-emerald-700">{disponivel}</p>
                      <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mt-1">Disponíveis</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-3xl p-5 text-center">
                      <p className="text-4xl font-black text-blue-700">{emUso}</p>
                      <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mt-1">Em Uso</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 text-center">
                      <p className="text-4xl font-black text-amber-700">{manutencao}</p>
                      <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mt-1">Manutenção</p>
                  </div>
                  <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-5 text-center">
                      <p className="text-4xl font-black text-zinc-700">{total}</p>
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mt-1">Total</p>
                  </div>
              </div>

              {/* Lista de chips */}
              <div className="bg-white border border-zinc-200 rounded-[2rem] overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                      <thead className="bg-zinc-50 text-zinc-400 text-[10px] font-black uppercase tracking-widest border-b border-zinc-100">
                          <tr>
                              <th className="p-5">Chip</th>
                              <th className="p-5">Instância Evolution</th>
                              <th className="p-5 text-center">Status</th>
                              <th className="p-5 text-center">Conexão</th>
                              <th className="p-5">Atribuído a</th>
                              <th className="p-5 text-center">Ações</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50 text-sm">
                          {chipsLoading ? (
                              <tr><td colSpan={6} className="p-12 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-zinc-300" /></td></tr>
                          ) : chips.length === 0 ? (
                              <tr>
                                  <td colSpan={6} className="p-12 text-center">
                                      <Bot className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
                                      <p className="text-zinc-400 font-medium">Nenhum chip cadastrado.</p>
                                      <p className="text-zinc-300 text-xs mt-1">Adicione chips autenticados no Evolution para começar o onboarding automático.</p>
                                  </td>
                              </tr>
                          ) : chips.map((chip) => {
                              const connState = chipsChecking[chip.id] || 'idle';
                              return (
                                  <tr key={chip.id} className="hover:bg-zinc-50/50 transition-colors">
                                      <td className="p-5">
                                          <p className="font-bold text-zinc-900">{chip.display_name || `+${chip.phone_number}`}</p>
                                          <p className="text-xs text-zinc-400 font-mono">+{chip.phone_number}</p>
                                          {chip.notes && <p className="text-xs text-zinc-300 mt-0.5">{chip.notes}</p>}
                                      </td>
                                      <td className="p-5">
                                          <span className="font-mono text-xs bg-zinc-100 text-zinc-600 px-2 py-1 rounded">{chip.evolution_instance}</span>
                                      </td>
                                      <td className="p-5 text-center">
                                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${statusColor[chip.status] || 'bg-zinc-100 text-zinc-500'}`}>
                                              {statusLabel[chip.status] || chip.status}
                                          </span>
                                      </td>
                                      <td className="p-5 text-center">
                                          {connState === 'idle' && (
                                              <button onClick={() => checkChipOnline(chip)}
                                                  className="text-[10px] font-bold text-zinc-400 hover:text-zinc-700 border border-zinc-200 px-2 py-1 rounded-full transition-colors">
                                                  Verificar
                                              </button>
                                          )}
                                          {connState === 'checking' && <Loader2 className="w-4 h-4 animate-spin text-zinc-400 mx-auto" />}
                                          {connState === 'online' && (
                                              <span className="flex items-center justify-center gap-1 text-emerald-600">
                                                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                                  <span className="text-[10px] font-bold">Online</span>
                                              </span>
                                          )}
                                          {connState === 'offline' && (
                                              <span className="flex items-center justify-center gap-1 text-red-500">
                                                  <span className="w-2 h-2 bg-red-500 rounded-full" />
                                                  <span className="text-[10px] font-bold">Offline</span>
                                              </span>
                                          )}
                                      </td>
                                      <td className="p-5 text-xs text-zinc-400">
                                          {chip.assigned_at
                                              ? <span>{new Date(chip.assigned_at).toLocaleDateString('pt-BR')}</span>
                                              : <span className="text-zinc-300">—</span>}
                                      </td>
                                      <td className="p-5 text-center">
                                          <select
                                              value={chip.status}
                                              onChange={e => handleChipStatus(chip.id, e.target.value)}
                                              className="text-[11px] font-bold border border-zinc-200 rounded-lg px-2 py-1.5 bg-white text-zinc-700 focus:outline-none cursor-pointer"
                                          >
                                              <option value="disponivel">Disponível</option>
                                              <option value="em_uso">Em Uso</option>
                                              <option value="manutencao">Manutenção</option>
                                              <option value="cancelado">Cancelado</option>
                                          </select>
                                      </td>
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>
          </div>
      );
  };

  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteSale = async (id: string) => {
      setDeletingSaleId(id);
      try {
          const res = await fetch(`/api/sales/${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Erro ao cancelar');
          setConfirmDeleteId(null);
          await fetchAllSales();
      } catch (err: any) {
          alert(err.message);
      } finally {
          setDeletingSaleId(null);
      }
  };

  const PeriodSelector = () => (
      <div className="flex items-center gap-2 bg-zinc-100 rounded-xl p-1">
          <div className="flex items-center bg-zinc-100 rounded-lg gap-0.5">
              <button onClick={() => setPeriodMode('mes')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${periodMode === 'mes' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}>
                  Mês
              </button>
              <button onClick={() => setPeriodMode('ano')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${periodMode === 'ano' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}>
                  Ano
              </button>
          </div>
          {periodMode === 'mes' ? (
              <input type="month" value={periodMonth} onChange={e => setPeriodMonth(e.target.value)}
                  className="text-xs font-bold text-zinc-700 bg-white border border-zinc-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-black/10 cursor-pointer" />
          ) : (
              <select value={periodYear} onChange={e => setPeriodYear(e.target.value)}
                  className="text-xs font-bold text-zinc-700 bg-white border border-zinc-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-black/10">
                  {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(y => (
                      <option key={y} value={String(y)}>{y}</option>
                  ))}
              </select>
          )}
      </div>
  );

  const renderVendas = () => {
      const byPeriod = filterSalesByPeriod(allSales);
      const paid   = byPeriod.filter(s => s.status === 'paid');
      const total  = paid.reduce((acc, s) => acc + (s.amount || 0), 0);
      const direct = paid.filter(s => !s.salesperson_id).length;
      const withSp = paid.filter(s => !!s.salesperson_id).length;

      const statusBadge = (s: any) => {
          if (s.status === 'paid') return <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">Pago</span>;
          if (s.status === 'cancelled') return <span className="text-[10px] font-black bg-red-100 text-red-600 px-2.5 py-1 rounded-full">Cancelado</span>;
          return <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">Pendente</span>;
      };

      const onboardBadge = (s: any) => {
          if (s.onboarding_status === 'concluido') return <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">✓ Provisionado</span>;
          if (s.onboarding_status === 'erro') return <span className="text-[10px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Erro</span>;
          if (s.onboarding_status === 'em_progresso') return <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Em andamento</span>;
          return <span className="text-[10px] font-black bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">Aguardando</span>;
      };

      return (
          <div className="space-y-8 animate-fade-in">
              <div className="flex items-start justify-between">
                  <div>
                      <h2 className="text-3xl font-black text-zinc-900 tracking-tighter">Vendas</h2>
                      <p className="text-zinc-500 font-medium">Todas as vendas confirmadas pelo Asaas — fonte da verdade.</p>
                  </div>
                  <div className="flex items-center gap-3">
                      <PeriodSelector />
                      <button onClick={fetchAllSales} disabled={allSalesLoading}
                          className="flex items-center gap-2 border border-zinc-200 text-zinc-600 font-bold px-4 py-2.5 rounded-2xl text-sm hover:bg-zinc-50 transition-colors disabled:opacity-50">
                          {allSalesLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Atualizar
                      </button>
                      <button onClick={() => { setShowDirectLink(true); setDirectLinkResult(''); setDirectLinkError(''); setDirectLinkCopied(false); }}
                          className="flex items-center gap-2 bg-black text-white font-bold px-5 py-2.5 rounded-2xl text-sm hover:bg-zinc-800 transition-colors">
                          <LinkIcon className="w-4 h-4" /> Venda Direta
                      </button>
                  </div>
              </div>

              {/* Modal Venda Direta */}
              {showDirectLink && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
                          <div className="flex items-center justify-between mb-6">
                              <div>
                                  <h3 className="text-xl font-black text-zinc-900">Venda Direta</h3>
                                  <p className="text-xs text-zinc-400 mt-0.5 font-medium">Sem comissão — 100% Elevva</p>
                              </div>
                              <button onClick={() => { setShowDirectLink(false); setDirectLinkResult(''); }} className="text-zinc-400 hover:text-zinc-700"><X className="w-5 h-5" /></button>
                          </div>
                          {!directLinkResult ? (
                              <form onSubmit={handleDirectLink} className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                      <div className="col-span-2">
                                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Nome do cliente</label>
                                          <input value={directLinkForm.clientName} onChange={e => setDirectLinkForm(f => ({...f, clientName: e.target.value}))}
                                              className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" placeholder="João Silva" required />
                                      </div>
                                      <div className="col-span-2">
                                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">E-mail Google do cliente</label>
                                          <input type="email" value={directLinkForm.clientEmail} onChange={e => setDirectLinkForm(f => ({...f, clientEmail: e.target.value}))}
                                              className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" placeholder="joao@gmail.com" required />
                                      </div>
                                      <div>
                                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">WhatsApp</label>
                                          <input value={directLinkForm.clientPhone} onChange={e => setDirectLinkForm(f => ({...f, clientPhone: e.target.value}))}
                                              className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" placeholder="(11) 99999-9999" required />
                                      </div>
                                      <div>
                                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Plano</label>
                                          <select value={directLinkForm.plan} onChange={e => setDirectLinkForm(f => ({...f, plan: e.target.value}))}
                                              className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 bg-white">
                                              <option value="ESSENCIAL">Essencial</option>
                                              <option value="PRO">Pro</option>
                                              <option value="ENTERPRISE">Enterprise — personalizado</option>
                                          </select>
                                      </div>
                                      {directLinkForm.plan !== 'ENTERPRISE' && (
                                          <div>
                                              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Período</label>
                                              <div className="flex gap-2">
                                                  <button type="button" onClick={() => setDirectLinkForm(f => ({...f, billing: 'mensal'}))}
                                                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${directLinkForm.billing === 'mensal' ? 'bg-black text-white border-black' : 'border-zinc-200 text-zinc-500 hover:border-zinc-400'}`}>
                                                      Mensal
                                                  </button>
                                                  <button type="button" onClick={() => setDirectLinkForm(f => ({...f, billing: 'anual'}))}
                                                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors relative ${directLinkForm.billing === 'anual' ? 'bg-black text-white border-black' : 'border-zinc-200 text-zinc-500 hover:border-zinc-400'}`}>
                                                      Anual <span className="text-[10px] text-[#84cc16] font-black">20% OFF</span>
                                                  </button>
                                              </div>
                                          </div>
                                      )}
                                      <div className="col-span-2 bg-zinc-50 rounded-xl px-4 py-3 text-sm">
                                          {directLinkForm.plan === 'ENTERPRISE' ? (
                                              <span className="text-zinc-500 font-medium">Valor personalizado abaixo</span>
                                          ) : directLinkForm.billing === 'anual' ? (
                                              <span className="font-black text-zinc-900">
                                                  {directLinkForm.plan === 'ESSENCIAL' ? 'R$ 6.230,40/ano' : 'R$ 9.599,04/ano'}
                                                  <span className="ml-2 text-xs text-zinc-400 font-medium line-through">
                                                      {directLinkForm.plan === 'ESSENCIAL' ? 'R$ 7.798,80' : 'R$ 11.998,80'}
                                                  </span>
                                              </span>
                                          ) : (
                                              <span className="font-black text-zinc-900">
                                                  {directLinkForm.plan === 'ESSENCIAL' ? 'R$ 649,90/mês' : 'R$ 999,90/mês'}
                                              </span>
                                          )}
                                      </div>
                                      {directLinkForm.plan === 'ENTERPRISE' && (
                                          <div className="col-span-2">
                                              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Valor personalizado (R$)</label>
                                              <input type="number" step="0.01" min="1" value={directLinkForm.customAmount} onChange={e => setDirectLinkForm(f => ({...f, customAmount: e.target.value}))}
                                                  className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" placeholder="0,00" required />
                                          </div>
                                      )}
                                  </div>
                                  {directLinkError && <p className="text-red-500 text-xs font-medium">{directLinkError}</p>}
                                  <button type="submit" disabled={directLinkSaving}
                                      className="w-full bg-black text-white font-bold py-3 rounded-xl text-sm hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                      {directLinkSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><LinkIcon className="w-4 h-4" /> Gerar Link de Pagamento</>}
                                  </button>
                              </form>
                          ) : (
                              <div className="space-y-5">
                                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                                      <p className="text-emerald-700 font-bold text-sm mb-1">Link gerado com sucesso!</p>
                                      <p className="text-emerald-600 text-xs">Envie ao cliente para realizar o pagamento</p>
                                  </div>
                                  <div className="bg-zinc-50 rounded-xl p-3 flex items-center gap-3">
                                      <p className="flex-1 text-xs text-zinc-600 font-mono truncate">{directLinkResult}</p>
                                      <button onClick={() => { navigator.clipboard.writeText(directLinkResult); setDirectLinkCopied(true); setTimeout(() => setDirectLinkCopied(false), 2000); }}
                                          className="shrink-0 px-3 py-1.5 bg-black text-white text-xs font-bold rounded-lg hover:bg-zinc-800 transition-colors">
                                          {directLinkCopied ? '✓ Copiado' : 'Copiar'}
                                      </button>
                                  </div>
                                  <button onClick={() => { setShowDirectLink(false); setDirectLinkResult(''); setDirectLinkForm({ clientName: '', clientEmail: '', clientPhone: '', plan: 'ESSENCIAL', billing: 'mensal', customAmount: '' }); }}
                                      className="w-full border border-zinc-200 text-zinc-600 font-bold py-2.5 rounded-xl text-sm hover:bg-zinc-50 transition-colors">
                                      Fechar
                                  </button>
                              </div>
                          )}
                      </div>
                  </div>
              )}

              {/* Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-black text-white p-6 rounded-[2rem] shadow-xl">
                      <div className="p-3 bg-zinc-900 rounded-2xl w-fit mb-4"><Banknote className="w-6 h-6 text-[#84cc16]"/></div>
                      <h3 className="text-4xl font-black">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Total Recebido</p>
                  </div>
                  <div className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm">
                      <div className="p-3 bg-zinc-100 rounded-2xl w-fit mb-4"><Briefcase className="w-6 h-6 text-zinc-900"/></div>
                      <h3 className="text-4xl font-black text-zinc-900">{withSp}</h3>
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Via Vendedor</p>
                  </div>
                  <div className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm">
                      <div className="p-3 bg-zinc-100 rounded-2xl w-fit mb-4"><LinkIcon className="w-6 h-6 text-zinc-900"/></div>
                      <h3 className="text-4xl font-black text-zinc-900">{direct}</h3>
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Venda Direta</p>
                  </div>
              </div>

              {/* Tabela */}
              <div className="bg-white border border-zinc-200 rounded-[2rem] overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                      <thead className="bg-zinc-50 text-zinc-400 text-[10px] font-black uppercase tracking-widest border-b border-zinc-100">
                          <tr>
                              <th className="p-5">Cliente</th>
                              <th className="p-5">Plano</th>
                              <th className="p-5">Vendedor</th>
                              <th className="p-5 text-right">Valor</th>
                              <th className="p-5 text-center">Pagamento</th>
                              <th className="p-5 text-center">Onboarding</th>
                              <th className="p-5 text-center">Data</th>
                              <th className="p-5"></th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50 text-sm">
                          {allSalesLoading ? (
                              <tr><td colSpan={8} className="p-12 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-zinc-300" /></td></tr>
                          ) : byPeriod.length === 0 ? (
                              <tr><td colSpan={8} className="p-12 text-center text-zinc-400 font-medium">'Nenhuma venda encontrada para o período selecionado.'</td></tr>
                          ) : byPeriod.map((s) => (
                              <tr key={s.id} className="hover:bg-zinc-50/50 transition-colors">
                                  <td className="p-5">
                                      <p className="font-bold text-zinc-900">{s.client_name}</p>
                                      <p className="text-xs text-zinc-400">{s.client_email}</p>
                                      <p className="text-xs text-zinc-400">{s.client_phone}</p>
                                  </td>
                                  <td className="p-5">
                                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                                          s.plan === 'PRO' ? 'bg-[#65a30d] text-black' :
                                          s.plan === 'ENTERPRISE' ? 'bg-purple-600 text-white' :
                                          'bg-zinc-100 text-zinc-600'
                                      }`}>{s.plan}</span>
                                  </td>
                                  <td className="p-5 text-xs text-zinc-500 font-medium">
                                      {s.salespeople?.name || <span className="text-zinc-300 italic">Venda Direta</span>}
                                      {s.commission_amount > 0 && <p className="text-[10px] text-amber-600 font-bold">R$ {s.commission_amount.toFixed(2)}</p>}
                                  </td>
                                  <td className="p-5 text-right font-black text-zinc-900">
                                      R$ {(s.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="p-5 text-center">{statusBadge(s)}</td>
                                  <td className="p-5 text-center">{onboardBadge(s)}</td>
                                  <td className="p-5 text-center text-xs text-zinc-400 font-medium">
                                      {s.paid_at ? new Date(s.paid_at).toLocaleDateString('pt-BR') : '—'}
                                  </td>
                                  <td className="p-5 text-center">
                                      {s.status === 'pending' && (
                                          confirmDeleteId === s.id ? (
                                              <div className="flex items-center gap-1.5 justify-center">
                                                  <button onClick={() => handleDeleteSale(s.id)} disabled={deletingSaleId === s.id}
                                                      className="text-[10px] font-black bg-red-500 text-white px-2.5 py-1 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50">
                                                      {deletingSaleId === s.id ? '...' : 'Confirmar'}
                                                  </button>
                                                  <button onClick={() => setConfirmDeleteId(null)}
                                                      className="text-[10px] font-bold text-zinc-400 hover:text-zinc-600 px-2 py-1">
                                                      Não
                                                  </button>
                                              </div>
                                          ) : (
                                              <button onClick={() => setConfirmDeleteId(s.id)}
                                                  className="text-[10px] font-bold text-red-400 hover:text-red-600 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors">
                                                  Cancelar
                                              </button>
                                          )
                                      )}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      );
  };

  const renderCommissions = () => {
      // Buscar dados ao abrir a view (se ainda não carregou)
      if (spList.length === 0 && !spLoading) fetchSalespeople();

      const totalCommission = spList.reduce((acc, sp) => acc + (sp.total_commission || 0), 0);
      const totalPending = spList.reduce((acc, sp) => acc + (sp.pending_commission || 0), 0);
      const totalSales = spList.reduce((acc, sp) => acc + (sp.paid_sales || 0), 0);

      return (
          <div className="space-y-8 animate-fade-in">
              <div className="flex items-start justify-between">
                  <div>
                      <h2 className="text-3xl font-black text-zinc-900 tracking-tighter">Comissões</h2>
                      <p className="text-zinc-500 font-medium">Gestão de vendedores e pagamentos via Asaas.</p>
                  </div>
                  <button
                      onClick={() => setShowAddSp(true)}
                      className="flex items-center gap-2 bg-black text-white font-bold px-5 py-2.5 rounded-2xl text-sm hover:bg-zinc-800 transition-colors"
                  >
                      <Plus className="w-4 h-4" /> Cadastrar Vendedor
                  </button>
              </div>

              {/* Modal cadastro */}
              {showAddSp && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
                          <div className="flex items-center justify-between mb-6">
                              <h3 className="text-xl font-black text-zinc-900">Novo Vendedor</h3>
                              <button onClick={() => setShowAddSp(false)} className="text-zinc-400 hover:text-zinc-700">
                                  <X className="w-5 h-5" />
                              </button>
                          </div>
                          <form onSubmit={handleAddSalesperson} className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                  <div className="col-span-2">
                                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Nome completo</label>
                                      <input value={spForm.name} onChange={e => setSpForm(f => ({...f, name: e.target.value}))}
                                          className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                                          placeholder="João Silva" required />
                                  </div>
                                  <div className="col-span-2">
                                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">E-mail</label>
                                      <input type="email" value={spForm.email} onChange={e => setSpForm(f => ({...f, email: e.target.value}))}
                                          className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                                          placeholder="joao@email.com" required />
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Comissão (%)</label>
                                      <input type="number" min="1" max="50" step="0.5" value={spForm.commissionPct}
                                          onChange={e => setSpForm(f => ({...f, commissionPct: parseFloat(e.target.value)}))}
                                          className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                                          required />
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">WhatsApp (opcional)</label>
                                      <input value={spForm.phone} onChange={e => setSpForm(f => ({...f, phone: e.target.value}))}
                                          className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                                          placeholder="(11) 99999-9999" />
                                  </div>
                                  <div className="col-span-2">
                                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">
                                          Wallet ID Asaas <span className="text-zinc-400 normal-case font-medium">(opcional agora — obrigatório para split)</span>
                                      </label>
                                      <div className="flex gap-2">
                                          <input value={spForm.asaasWalletId} onChange={e => { setSpForm(f => ({...f, asaasWalletId: e.target.value})); setWalletInfo(null); }}
                                              className="flex-1 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                                              placeholder="ex: f0e1d2c3-a4b5-..." />
                                          <button type="button" onClick={handleValidateWallet} disabled={walletValidating || !spForm.asaasWalletId}
                                              className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-sm rounded-xl transition-colors disabled:opacity-40 whitespace-nowrap">
                                              {walletValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Validar'}
                                          </button>
                                      </div>
                                      {walletInfo && (
                                          <p className={`mt-1.5 text-xs font-medium ${walletInfo.valid ? 'text-green-600' : 'text-red-500'}`}>
                                              {walletInfo.valid ? `✓ Conta verificada: ${walletInfo.name}` : '✗ Wallet ID não encontrado no Asaas'}
                                          </p>
                                      )}
                                      <p className="mt-1 text-[11px] text-zinc-400">O vendedor encontra o Wallet ID em: Asaas → Configurações → Dados da Conta</p>
                                                                    <div className="col-span-2">
                                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Senha de acesso</label>
                                      <input type="password" value={spForm.password} onChange={e => setSpForm(f => ({...f, password: e.target.value}))}
                                          className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                                          placeholder="Mínimo 6 caracteres" required minLength={6} />
                                      <p className="mt-1 text-[11px] text-zinc-400">O vendedor poderá trocar a senha após o primeiro acesso.</p>
                                  </div>
</div>
                              </div>
                              {spError && <p className="text-red-500 text-xs font-medium">{spError}</p>}
                              <button type="submit" disabled={spSaving}
                                  className="w-full bg-black text-white font-bold py-3 rounded-xl text-sm hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                  {spSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cadastrar Vendedor'}
                              </button>
                          </form>
                      </div>
                  </div>
              )}

              {/* Cards resumo */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-black text-white p-6 rounded-[2rem] border border-zinc-900 shadow-xl">
                      <div className="p-3 bg-zinc-900 rounded-2xl w-fit mb-4"><Banknote className="w-6 h-6 text-[#84cc16]"/></div>
                      <h3 className="text-4xl font-black text-white">R$ {totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Comissões Pagas</p>
                  </div>
                  <div className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm">
                      <div className="p-3 bg-zinc-100 rounded-2xl w-fit mb-4"><TrendingUp className="w-6 h-6 text-zinc-900"/></div>
                      <h3 className="text-4xl font-black text-zinc-900">R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">A Confirmar</p>
                  </div>
                  <div className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm">
                      <div className="p-3 bg-zinc-100 rounded-2xl w-fit mb-4"><Users className="w-6 h-6 text-zinc-900"/></div>
                      <h3 className="text-4xl font-black text-zinc-900">{spList.filter(s => s.status === 'active').length}</h3>
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Vendedores Ativos · {totalSales} vendas</p>
                  </div>
              </div>

              {/* Tabela */}
              <div className="bg-white border border-zinc-200 rounded-[2rem] overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                      <thead className="bg-zinc-50 text-zinc-400 text-[10px] font-black uppercase tracking-widest border-b border-zinc-100">
                          <tr>
                              <th className="p-6">Vendedor</th>
                              <th className="p-6">Comissão</th>
                              <th className="p-6">Vendas (E/P/Ent)</th>
                              <th className="p-6 text-right">Confirmado</th>
                              <th className="p-6 text-right">Pendente</th>
                              <th className="p-6 text-center">Asaas</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50 text-sm">
                          {spLoading ? (
                              <tr><td colSpan={6} className="p-12 text-center text-zinc-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
                          ) : spList.length === 0 ? (
                              <tr><td colSpan={6} className="p-12 text-center text-zinc-400 font-medium">Nenhum vendedor cadastrado.</td></tr>
                          ) : spList.map((sp) => (
                              <tr key={sp.id} className="hover:bg-zinc-50/50 transition-colors">
                                  <td className="p-6">
                                      <p className="font-bold text-zinc-900">{sp.name}</p>
                                      <p className="text-xs text-zinc-400">{sp.email}</p>
                                  </td>
                                  <td className="p-6 font-black text-[#65a30d] text-lg">{sp.commission_pct}%</td>
                                  <td className="p-6">
                                      <div className="flex gap-2">
                                          <span className="bg-zinc-100 text-zinc-500 px-2 py-1 rounded text-[10px] font-bold">{sp.essencial_count || 0} E</span>
                                          <span className="bg-[#65a30d] text-black px-2 py-1 rounded text-[10px] font-bold">{sp.pro_count || 0} P</span>
                                          <span className="bg-purple-600 text-white px-2 py-1 rounded text-[10px] font-bold">{sp.enterprise_count || 0} Ent</span>
                                      </div>
                                  </td>
                                  <td className="p-6 text-right font-black text-emerald-600">
                                      R$ {(sp.total_commission || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="p-6 text-right font-bold text-amber-600">
                                      R$ {(sp.pending_commission || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="p-6 text-center">
                                      {sp.asaas_wallet_id
                                          ? <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Conectado</span>
                                          : <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-1 rounded-full">Pendente</span>
                                      }
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      );
  };

  const [financeTab, setFinanceTab] = useState<'geral' | 'historico'>('geral');
  const [geralYear, setGeralYear] = useState(String(now.getFullYear()));

  const renderFinance = () => {
      const stats = getFinancialData();
      const arpu  = stats.payingUsers > 0 ? stats.mrr / stats.payingUsers : 0;

      // ── Dados mês a mês para o gráfico (ano selecionado em Geral) ─────────
      const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      const monthlyData = MONTHS.map((label, idx) => {
          const salesInMonth = allSales.filter((s: any) => {
              const d = new Date(s.paid_at || s.created_at);
              return s.status === 'paid' && d.getFullYear() === parseInt(geralYear) && d.getMonth() === idx;
          });
          return {
              label,
              mrr: salesInMonth.reduce((a: number, s: any) => a + (s.amount || 0), 0),
              users: salesInMonth.length,
          };
      });
      const maxMrr   = Math.max(...monthlyData.map(d => d.mrr), 1);
      const maxUsers = Math.max(...monthlyData.map(d => d.users), 1);
      const W = 760; const H = 220; const PAD = { t: 30, r: 20, b: 40, l: 64 };
      const chartW = W - PAD.l - PAD.r;
      const chartH = H - PAD.t - PAD.b;
      const xStep  = chartW / 11;
      const ptsMrr  = monthlyData.map((d, i) => ({ x: PAD.l + i * xStep, y: PAD.t + chartH - (d.mrr  / maxMrr)  * chartH }));
      const ptsUser = monthlyData.map((d, i) => ({ x: PAD.l + i * xStep, y: PAD.t + chartH - (d.users / maxUsers) * chartH }));
      const bezier  = (pts: {x:number;y:number}[]) => pts.map((p,i) => {
          if (i === 0) return `M${p.x},${p.y}`;
          const prev = pts[i-1];
          const cx1 = prev.x + (p.x - prev.x) * 0.4; const cy1 = prev.y;
          const cx2 = prev.x + (p.x - prev.x) * 0.6; const cy2 = p.y;
          return `C${cx1},${cy1} ${cx2},${cy2} ${p.x},${p.y}`;
      }).join(' ');
      const areaPath = (pts: {x:number;y:number}[]) =>
          bezier(pts) + ` L${pts[pts.length-1].x},${PAD.t+chartH} L${pts[0].x},${PAD.t+chartH} Z`;

      // ── Dados do período selecionado (Histórico) ─────────────────────────
      const paidHist      = filterSalesByPeriod(allSales).filter((s: any) => s.status === 'paid');
      const histMrr       = paidHist.reduce((a: number, s: any) => a + (s.amount || 0), 0);
      const histEssencial = paidHist.filter((s: any) => s.plan?.includes('ESSENCIAL')).length;
      const histPro       = paidHist.filter((s: any) => s.plan?.includes('PRO')).length;
      const histEnterprise= paidHist.filter((s: any) => s.plan === 'ENTERPRISE').length;
      const histCount     = paidHist.length;
      const histArpu      = histCount > 0 ? histMrr / histCount : 0;
      const periodLabel   = periodMode === 'mes'
          ? new Date(periodMonth + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
          : periodYear;

      const PlanBreakdown = ({ essencial, pro, enterprise, paying, totalUsers, salesList }: { essencial: number; pro: number; enterprise: number; paying: number; totalUsers: number; salesList: any[] }) => (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-[2rem] border border-zinc-200 shadow-sm p-8">
                  <h3 className="text-lg font-black text-zinc-900 mb-6 flex items-center gap-2"><PieChart className="w-5 h-5"/> Distribuição de Receita</h3>
                  <div className="space-y-6">
                      {[
                          { label: 'Plano Essencial', price: 'R$ 649,90 / mês', count: essencial, color: 'bg-zinc-900' },
                          { label: 'Plano Pro',       price: 'R$ 999,90 / mês', count: pro,       color: 'bg-[#65a30d]' },
                          { label: 'Enterprise',      price: 'A consultar',      count: enterprise, color: 'bg-purple-600' },
                      ].map(p => (
                          <div key={p.label}>
                              <div className="flex justify-between items-end mb-2">
                                  <div><span className="text-sm font-bold text-zinc-900 block">{p.label}</span><span className="text-xs text-zinc-500">{p.price}</span></div>
                                  <div className="text-right"><span className="text-lg font-black text-zinc-900">{p.count}</span><span className="text-xs text-zinc-400 ml-1">usuários</span></div>
                              </div>
                              <div className="w-full bg-zinc-100 h-3 rounded-full overflow-hidden">
                                  <div className={`${p.color} h-full rounded-full transition-all duration-700`} style={{ width: `${(p.count / (paying || 1)) * 100}%` }}></div>
                              </div>
                          </div>
                      ))}
                  </div>
                  <div className="mt-8 pt-6 border-t border-zinc-100 text-xs font-bold text-zinc-500">
                      Conversão: <strong className="text-zinc-900">{((paying / (totalUsers || 1)) * 100).toFixed(1)}%</strong>
                  </div>
              </div>
              <div className="bg-white rounded-[2rem] border border-zinc-200 shadow-sm p-8 flex flex-col">
                  <h3 className="text-lg font-black text-zinc-900 mb-6 flex items-center gap-2"><Activity className="w-5 h-5"/> Vendas do Período</h3>
                  <div className="overflow-auto space-y-3 max-h-72">
                      {salesList.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 text-zinc-400"><Ban className="w-8 h-8 mb-2 opacity-50" /><p className="text-xs font-bold uppercase">Nenhuma venda</p></div>
                      ) : salesList.map((s: any) => (
                          <div key={s.id} className="flex items-center justify-between p-4 rounded-xl border border-zinc-100 bg-zinc-50/50">
                              <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-500 font-black text-sm">{s.client_name?.charAt(0)}</div>
                                  <div><p className="text-sm font-bold text-zinc-900">{s.client_name}</p><p className="text-[10px] text-zinc-400 font-bold uppercase">{s.plan}</p></div>
                              </div>
                              <div className="text-right">
                                  <p className="text-sm font-black text-emerald-600">+ R$ {(s.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                  <p className="text-[10px] text-zinc-400">{s.paid_at ? new Date(s.paid_at).toLocaleDateString('pt-BR') : new Date(s.created_at).toLocaleDateString('pt-BR')}</p>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      );

      return (
          <div className="space-y-6 animate-fade-in pb-12">
              {/* Header com sub-abas à direita */}
              <div className="flex items-center justify-between">
                  <div>
                      <h2 className="text-3xl font-black text-zinc-900 tracking-tighter">Faturamento</h2>
                      <p className="text-zinc-500 font-medium">Gestão financeira e métricas de receita.</p>
                  </div>
                  <div className="flex items-center gap-1 bg-zinc-100 rounded-2xl p-1.5">
                      <button onClick={() => setFinanceTab('geral')}
                          className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${financeTab === 'geral' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}>
                          Geral
                      </button>
                      <button onClick={() => setFinanceTab('historico')}
                          className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${financeTab === 'historico' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}>
                          Histórico
                      </button>
                  </div>
              </div>

              {/* ── GERAL ─────────────────────────────────────────────────── */}
              {financeTab === 'geral' && (
                  <div className="space-y-8">
                      {/* Seletor de ano */}
                      <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Ano:</span>
                          {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(y => (
                              <button key={y} onClick={() => setGeralYear(String(y))}
                                  className={`px-4 py-1.5 rounded-xl text-sm font-black transition-all border ${geralYear === String(y) ? 'bg-black text-white border-black' : 'border-zinc-200 text-zinc-400 hover:border-zinc-400 hover:text-zinc-700'}`}>
                                  {y}
                              </button>
                          ))}
                      </div>

                      {/* 3 KPI cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* MRR */}
                          <div className="bg-black text-white p-8 rounded-[2.5rem] border border-zinc-800 shadow-xl relative overflow-hidden">
                              <div className="relative z-10">
                                  <div className="flex justify-between items-start mb-6">
                                      <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800"><Wallet className="w-6 h-6 text-[#84cc16]"/></div>
                                      <span className="text-[#84cc16] bg-[#84cc16]/10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-[#84cc16]/20">MRR</span>
                                  </div>
                                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">Receita Recorrente Mensal</p>
                                  <h3 className="text-5xl font-black text-white tracking-tighter mb-2">R$ {stats.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                                  <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold mt-4">
                                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                                      <span className="text-emerald-500">Projeção {geralYear}:</span>
                                      R$ {(stats.mrr * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </div>
                              </div>
                              <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-800/30 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                          </div>
                          {/* Assinantes */}
                          <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm flex flex-col justify-between">
                              <div>
                                  <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100 w-fit mb-6"><CreditCard className="w-6 h-6 text-zinc-900"/></div>
                                  <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-1">Assinantes Ativos</p>
                                  <h3 className="text-5xl font-black text-zinc-900 tracking-tighter">{stats.payingUsers}</h3>
                              </div>
                              <div>
                                  <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden mt-6">
                                      <div className="bg-black h-full rounded-full" style={{ width: `${Math.min(100,(stats.payingUsers/(stats.totalUsers||1))*100)}%` }}></div>
                                  </div>
                                  <p className="text-[10px] font-bold text-zinc-400 mt-2 text-right">{((stats.payingUsers/(stats.totalUsers||1))*100).toFixed(1)}% da base</p>
                              </div>
                          </div>
                          {/* Distribuição */}
                          <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm flex flex-col justify-between">
                              <div>
                                  <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100 w-fit mb-6"><PieChart className="w-6 h-6 text-zinc-900"/></div>
                                  <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-3">Distribuição de Receita</p>
                              </div>
                              <div className="space-y-3">
                                  {[
                                      { label: 'Essencial', count: stats.ESSENCIAL.count, color: 'bg-zinc-900' },
                                      { label: 'Pro',       count: stats.PRO.count,       color: 'bg-[#65a30d]' },
                                      { label: 'Enterprise',count: stats.ENTERPRISE.count, color: 'bg-purple-600' },
                                  ].map(p => (
                                      <div key={p.label} className="flex items-center gap-3">
                                          <div className={`w-2.5 h-2.5 rounded-full ${p.color} shrink-0`}></div>
                                          <span className="text-xs font-bold text-zinc-600 flex-1">{p.label}</span>
                                          <span className="text-sm font-black text-zinc-900">{p.count}</span>
                                          <div className="w-20 bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                                              <div className={`${p.color} h-full rounded-full`} style={{ width: `${(p.count/(stats.payingUsers||1))*100}%` }}></div>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>

                      {/* Gráfico MRR + Usuários mês a mês */}
                      <div className="bg-[#0c0c0c] rounded-[2rem] p-8 shadow-2xl">
                          <div className="flex items-center justify-between mb-6">
                              <div>
                                  <h3 className="text-lg font-black text-white">Crescimento {geralYear}</h3>
                                  <p className="text-zinc-500 text-xs font-medium mt-0.5">MRR e novos usuários mês a mês</p>
                              </div>
                              <div className="flex items-center gap-5">
                                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#84cc16]"></div><span className="text-xs font-bold text-zinc-400">MRR (R$)</span></div>
                                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-sky-400"></div><span className="text-xs font-bold text-zinc-400">Usuários</span></div>
                              </div>
                          </div>
                          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 240 }}>
                              <defs>
                                  <linearGradient id="gradMrr" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#84cc16" stopOpacity="0.3"/>
                                      <stop offset="100%" stopColor="#84cc16" stopOpacity="0"/>
                                  </linearGradient>
                                  <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2"/>
                                      <stop offset="100%" stopColor="#38bdf8" stopOpacity="0"/>
                                  </linearGradient>
                                  <filter id="glowG"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                              </defs>
                              {/* Grade */}
                              {[0,1,2,3,4].map(i => {
                                  const y = PAD.t + (chartH / 4) * i;
                                  const val = maxMrr - (maxMrr / 4) * i;
                                  return (
                                      <g key={i}>
                                          <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#27272a" strokeWidth="1" strokeDasharray="4 4"/>
                                          <text x={PAD.l - 8} y={y + 4} textAnchor="end" fill="#52525b" fontSize="10" fontWeight="700">
                                              {val >= 1000 ? `R$${(val/1000).toFixed(0)}k` : `R$${val.toFixed(0)}`}
                                          </text>
                                      </g>
                                  );
                              })}
                              {/* Meses */}
                              {monthlyData.map((d, i) => (
                                  <text key={i} x={ptsMrr[i].x} y={H - 8} textAnchor="middle" fill="#52525b" fontSize="10" fontWeight="700">{d.label}</text>
                              ))}
                              {/* Área MRR */}
                              <path d={areaPath(ptsMrr)} fill="url(#gradMrr)"/>
                              {/* Linha MRR */}
                              <path d={bezier(ptsMrr)} fill="none" stroke="#84cc16" strokeWidth="2.5" strokeLinecap="round"/>
                              {/* Área Users */}
                              <path d={areaPath(ptsUser)} fill="url(#gradUsers)"/>
                              {/* Linha Users */}
                              <path d={bezier(ptsUser)} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 3"/>
                              {/* Pontos MRR */}
                              {ptsMrr.map((p, i) => monthlyData[i].mrr > 0 && (
                                  <g key={i} filter="url(#glowG)">
                                      <circle cx={p.x} cy={p.y} r="5" fill="#84cc16"/>
                                      <text x={p.x} y={p.y - 10} textAnchor="middle" fill="#84cc16" fontSize="9" fontWeight="800">
                                          {monthlyData[i].mrr >= 1000 ? `R$${(monthlyData[i].mrr/1000).toFixed(1)}k` : `R$${monthlyData[i].mrr.toFixed(0)}`}
                                      </text>
                                  </g>
                              ))}
                              {/* Pontos Users */}
                              {ptsUser.map((p, i) => monthlyData[i].users > 0 && (
                                  <circle key={i} cx={p.x} cy={p.y} r="4" fill="#38bdf8"/>
                              ))}
                          </svg>
                      </div>
                  </div>
              )}

              {/* ── HISTÓRICO ─────────────────────────────────────────────── */}
              {financeTab === 'historico' && (
                  <div className="space-y-8">
                      {/* Seletor de período */}
                      <div className="flex items-center gap-4 bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm">
                          <Calendar className="w-5 h-5 text-zinc-400" />
                          <span className="text-sm font-bold text-zinc-600">Analisar período:</span>
                          <PeriodSelector />
                          <span className="ml-auto text-sm font-bold text-zinc-900 capitalize">{periodLabel}</span>
                      </div>

                      {/* KPIs do período */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="bg-black text-white p-8 rounded-[2.5rem] border border-zinc-800 shadow-xl relative overflow-hidden">
                              <div className="relative z-10">
                                  <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 w-fit mb-6"><Wallet className="w-6 h-6 text-[#84cc16]"/></div>
                                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">Receita do Período</p>
                                  <h3 className="text-5xl font-black text-white tracking-tighter">R$ {histMrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                              </div>
                              <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-800/30 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                          </div>
                          <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm flex flex-col justify-between">
                              <div>
                                  <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100 w-fit mb-6"><CreditCard className="w-6 h-6 text-zinc-900"/></div>
                                  <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-1">Vendas no Período</p>
                                  <h3 className="text-5xl font-black text-zinc-900 tracking-tighter">{histCount}</h3>
                              </div>
                          </div>
                          <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm flex flex-col justify-between">
                              <div>
                                  <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100 w-fit mb-6"><Briefcase className="w-6 h-6 text-zinc-900"/></div>
                                  <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-1">Ticket Médio</p>
                                  <h3 className="text-5xl font-black text-zinc-900 tracking-tighter">R$ {histArpu.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</h3>
                              </div>
                          </div>
                      </div>

                      <PlanBreakdown essencial={histEssencial} pro={histPro} enterprise={histEnterprise} paying={histCount} totalUsers={stats.totalUsers} salesList={paidHist} />
                  </div>
              )}
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

            {currentView === 'OVERVIEW' && (() => { if (allSales.length === 0 && !allSalesLoading) fetchAllSales(); return renderOverview(); })()}
            {currentView === 'USERS' && renderUsersList()}
            {currentView === 'ADS' && renderAdsManager()}
            {currentView === 'FINANCE' && renderFinance()} 
            {currentView === 'COMMISSIONS' && renderCommissions()}
            {currentView === 'PROMPTS' && (
                <div className="flex flex-col h-full">
                    {/* Header + Sub-tabs */}
                    <div className="mb-6">
                        <h1 className="text-2xl font-black text-zinc-900 mb-4">Controle Agente</h1>
                        <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl w-fit">
                            {([
                                { key: 'trabalho', label: 'Prompt Trabalho', icon: <FileText className="w-4 h-4" /> },
                                { key: 'atendimento', label: 'Prompt Atendimento', icon: <MessageSquare className="w-4 h-4" /> },
                                { key: 'treinamento', label: 'Treinamento', icon: <GraduationCap className="w-4 h-4" /> },
                            ] as const).map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setAgentSubTab(tab.key)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${agentSubTab === tab.key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                                >
                                    {tab.icon} {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Tab 1: Prompt Trabalho ── */}
                    {agentSubTab === 'trabalho' && (
                        <div className="max-w-3xl">
                            <p className="text-sm text-zinc-500 mb-4">Instruções enviadas para a IA ao analisar currículos. Use <code className="bg-zinc-100 px-1 rounded text-xs">{'{jobTitle}'}</code> e <code className="bg-zinc-100 px-1 rounded text-xs">{'{criteria}'}</code> como variáveis dinâmicas.</p>
                            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
                                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-zinc-900 rounded-xl flex items-center justify-center">
                                            <Bot className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-zinc-900">Análise de Currículos</p>
                                            <p className="text-xs text-zinc-400">{promptUpdatedAt ? `Atualizado em ${new Date(promptUpdatedAt).toLocaleString('pt-BR')}` : 'Usando prompt padrão'}</p>
                                        </div>
                                    </div>
                                    {!isEditingPrompt && (
                                        <button onClick={() => { setRecruiterPromptDraft(recruiterPrompt || DEFAULT_RECRUITER_PROMPT); setIsEditingPrompt(true); }} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition-colors">
                                            <Edit3 className="w-4 h-4" /> Editar
                                        </button>
                                    )}
                                </div>
                                <div className="p-6">
                                    {promptLoading ? (
                                        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-zinc-300" /></div>
                                    ) : isEditingPrompt ? (
                                        <div className="space-y-4">
                                            <textarea value={recruiterPromptDraft} onChange={e => setRecruiterPromptDraft(e.target.value)} rows={26} className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-zinc-400 resize-none" />
                                            <div className="flex gap-3 justify-end">
                                                <button onClick={() => setIsEditingPrompt(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-500 hover:bg-zinc-50 transition-colors">Cancelar</button>
                                                <button onClick={saveRecruiterPrompt} disabled={promptSaving} className="flex items-center gap-2 px-5 py-2 bg-black text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-colors disabled:opacity-50">
                                                    {promptSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <pre className="whitespace-pre-wrap text-sm text-zinc-700 bg-zinc-50 rounded-xl px-4 py-3 min-h-[200px]">{recruiterPrompt || DEFAULT_RECRUITER_PROMPT}</pre>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Tab 2: Prompt Atendimento ── */}
                    {agentSubTab === 'atendimento' && (
                        <div className="max-w-3xl">
                            <p className="text-sm text-zinc-500 mb-4">Este é o prompt exato que guia o agente Bento nas conversas com candidatos. O chat de Treinamento usa este mesmo prompt para simular o atendimento.</p>
                            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
                                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center">
                                            <MessageSquare className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-zinc-900">Personalidade do Bento</p>
                                            <p className="text-xs text-zinc-400">{attendanceUpdatedAt ? `Atualizado em ${new Date(attendanceUpdatedAt).toLocaleString('pt-BR')}` : 'Prompt padrão do sistema'}</p>
                                        </div>
                                    </div>
                                    {!isEditingAttendance && (
                                        <button onClick={() => { setAttendancePromptDraft(attendancePrompt); setIsEditingAttendance(true); }} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition-colors">
                                            <Edit3 className="w-4 h-4" /> Editar
                                        </button>
                                    )}
                                </div>
                                <div className="p-6">
                                    {attendanceLoading ? (
                                        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-zinc-300" /></div>
                                    ) : isEditingAttendance ? (
                                        <div className="space-y-4">
                                            <textarea value={attendancePromptDraft} onChange={e => setAttendancePromptDraft(e.target.value)} rows={20} className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-zinc-400 resize-none" placeholder="Descreva como o Bento deve se comportar, que tom usar, como responder situações específicas..." />
                                            <div className="flex gap-3 justify-end">
                                                <button onClick={() => setIsEditingAttendance(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-500 hover:bg-zinc-50 transition-colors">Cancelar</button>
                                                <button onClick={saveAttendancePrompt} disabled={attendanceSaving} className="flex items-center gap-2 px-5 py-2 bg-black text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-colors disabled:opacity-50">
                                                    {attendanceSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <pre className="whitespace-pre-wrap text-sm text-zinc-700 bg-zinc-50 rounded-xl px-4 py-3 min-h-[200px]">{attendancePrompt}</pre>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Tab 3: Treinamento ── */}
                    {agentSubTab === 'treinamento' && (
                        <div className="flex flex-col h-[calc(100vh-240px)] max-w-2xl">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm text-zinc-500">Converse com o Bento para testar o Prompt Atendimento. Altere o prompt e volte aqui para ver a diferença.</p>
                                <button
                                    onClick={() => setTrainingMessages([])}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-500 hover:bg-zinc-50 transition-colors"
                                >
                                    <RefreshCw className="w-4 h-4" /> Reset
                                </button>
                            </div>

                            {/* Chat area */}
                            <div ref={trainingChatRef} className="flex-1 bg-white rounded-2xl border border-zinc-200 p-4 overflow-y-auto space-y-3 mb-3">
                                {trainingMessages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center mb-3">
                                            <GraduationCap className="w-7 h-7 text-zinc-400" />
                                        </div>
                                        <p className="text-sm font-bold text-zinc-400">Nenhuma mensagem ainda</p>
                                        <p className="text-xs text-zinc-300 mt-1">Digite uma mensagem para iniciar o treinamento</p>
                                    </div>
                                ) : trainingMessages.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-black text-white rounded-br-sm' : 'bg-zinc-100 text-zinc-900 rounded-bl-sm'}`}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}
                                {trainingSending && (
                                    <div className="flex justify-start">
                                        <div className="bg-zinc-100 px-4 py-3 rounded-2xl rounded-bl-sm">
                                            <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Input */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={trainingInput}
                                    onChange={e => setTrainingInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTrainingMessage(); } }}
                                    placeholder="Digite uma mensagem para o Bento..."
                                    className="flex-1 bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-zinc-400"
                                />
                                <button
                                    onClick={sendTrainingMessage}
                                    disabled={trainingSending || !trainingInput.trim()}
                                    className="bg-black text-white px-4 py-3 rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-40"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
            {currentView === 'DATABASE' && <SqlSetupModal onClose={() => setCurrentView('OVERVIEW')} />}
            {currentView === 'VENDAS' && renderVendas()}
            {currentView === 'VENDEDORES' && renderVendedores()}
            {currentView === 'CHIPS' && renderChips()}
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
                                <button onClick={() => { setIsEditingPlan(!isEditingPlan); if (!isEditingPlan && selectedUser) { const defPrice = selectedUser.plan_price != null ? selectedUser.plan_price : (selectedUser.plan === 'ESSENCIAL' ? 649.90 : selectedUser.plan === 'PRO' ? 999.90 : 0); setTempPlanPrice(String(defPrice)); } }} className="text-zinc-400 hover:text-black transition-colors bg-white p-1 rounded-md border border-zinc-200" title="Trocar Plano">
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
                                        R$ {(selectedUser.plan_price != null ? selectedUser.plan_price : (selectedUser.plan === 'ESSENCIAL' ? 649.90 : selectedUser.plan === 'PRO' ? 999.90 : 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / mês
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