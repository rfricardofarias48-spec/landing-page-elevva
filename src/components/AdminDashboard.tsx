import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { AdminUserProfile, Announcement, PlanType } from '../types';
import { SqlSetupModal } from './SqlSetupModal';
import { 
  Users, Calendar, CreditCard, Search, Activity, Briefcase, 
  Loader2, ArrowUpRight, Ban, CheckCircle2, X, Megaphone, Image as ImageIcon, Upload, Trash2, ExternalLink, Filter, Clock, UserX, Wallet, Lock, Database, Copy, ToggleRight, TrendingUp, FileText, PieChart, DollarSign, LayoutDashboard, LogOut, Edit3, Save, Crown
} from 'lucide-react';

// Tipos auxiliares para o Dashboard
type AdminView = 'OVERVIEW' | 'USERS' | 'ADS' | 'FINANCE' | 'CANCELLATIONS' | 'DATABASE';

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

  // States para Criação de Anúncio
  const [newAdTitle, setNewAdTitle] = useState('');
  const [newAdLink, setNewAdLink] = useState('');
  const [newAdImage, setNewAdImage] = useState<File | null>(null);
  const [newAdPreview, setNewAdPreview] = useState<string | null>(null);
  const [newAdPlans, setNewAdPlans] = useState<PlanType[]>(['FREE', 'MENSAL', 'ANUAL']);
  const [isPostingAd, setIsPostingAd] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State Financeiro
  const [financeDate, setFinanceDate] = useState(new Date());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: profilesData, error: profilesError } = await supabase.from('profiles').select('*');
      if (profilesError) throw profilesError;

      const { data: jobsData, error: jobsError } = await supabase.from('jobs').select('*, candidates(id)');
      if (jobsError) throw jobsError;

      const { data: adsData, error: adsError } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
      if (adsError && adsError.code !== '42P01') console.error("Erro ao buscar anúncios:", adsError);

      const mappedUsers: AdminUserProfile[] = profilesData.map((u: any) => {
          const userJobs = jobsData?.filter((j: any) => j.user_id === u.id) || [];
          return {
            id: u.id,
            email: u.email,
            name: u.name,
            phone: u.phone,
            role: u.role,
            plan: u.plan,
            status: u.status || 'ACTIVE',
            created_at: u.created_at,
            jobs_count: userJobs.length,
            resume_usage: u.resume_usage || 0,
            last_active: u.updated_at || u.created_at, 
            subscription_status: u.subscription_status
          };
      });

      const mappedJobs: AdminJob[] = jobsData?.map((j: any) => {
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

      const mappedAds: Announcement[] = adsData?.map((a: any) => {
          const { data } = supabase.storage.from('marketing').getPublicUrl(a.image_path);
          return {
              id: a.id,
              title: a.title,
              imageUrl: data.publicUrl,
              linkUrl: a.link_url,
              isActive: a.is_active,
              createdAt: a.created_at,
              targetPlans: a.target_plans || ['FREE', 'MENSAL', 'ANUAL']
          };
      }) || [];

      setUsers(mappedUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setAllJobs(mappedJobs);
      setAds(mappedAds);

    } catch (error) {
      console.error("Erro ao carregar dados do admin:", error);
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
      } catch (err: any) {
          alert("Erro ao atualizar status: " + err.message);
      } finally {
          setActionLoading(false);
      }
  };

  const handleUpdatePlan = async (newPlan: string) => {
      if (!selectedUser) return;
      setActionLoading(true);

      let newJobLimit = 3;
      let newResumeLimit = 25;

      if (newPlan === 'MENSAL') {
          newJobLimit = 5;
          newResumeLimit = 150;
      } else if (newPlan === 'ANUAL') {
          newJobLimit = 9999;
          newResumeLimit = 9999;
      }

      try {
          const { error } = await supabase
            .from('profiles')
            .update({ 
                plan: newPlan,
                job_limit: newJobLimit,
                resume_limit: newResumeLimit,
                subscription_status: 'active'
            })
            .eq('id', selectedUser.id);

          if (error) {
              if (error.message.includes('policy')) {
                  alert("ERRO DE PERMISSÃO: Você precisa rodar o SCRIPT V40 (Admin Power) em 'Configurações > Banco de Dados' para liberar essa função.");
              } else {
                  throw error;
              }
              return;
          }

          const updatedUser = { ...selectedUser, plan: newPlan };
          setSelectedUser(updatedUser);
          setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, plan: newPlan } : u));
          setIsEditingPlan(false);
          alert(`✅ Sucesso! Plano alterado para ${newPlan}.\nLimites atualizados: ${newJobLimit >= 9999 ? 'Ilimitado' : newJobLimit} Vagas, ${newResumeLimit >= 9999 ? 'Ilimitado' : newResumeLimit} Currículos.`);

      } catch (err: any) {
          console.error("Erro ao atualizar plano:", err);
          alert("Erro ao atualizar plano: " + err.message);
      } finally {
          setActionLoading(false);
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
              link_url: newAdLink || null,
              image_path: uploadData.path,
              is_active: true,
              target_plans: newAdPlans
          }]);
          if (dbError) throw dbError;

          alert("Anúncio publicado com sucesso!");
          setNewAdTitle('');
          setNewAdLink('');
          setNewAdImage(null);
          setNewAdPreview(null);
          setNewAdPlans(['FREE', 'MENSAL', 'ANUAL']);
          fetchData();
      } catch (err: any) {
          alert("Erro ao postar anúncio: " + err.message);
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
      } catch (err: any) {
          alert("Erro ao apagar: " + err.message);
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
          FREE: { count: 0, price: 0, revenue: 0 },
          MENSAL: { count: 0, price: 329.90, revenue: 0 },
          TRIMESTRAL: { count: 0, price: 329.90, revenue: 0 },
          ANUAL: { count: 0, price: 289.90, revenue: 0 },
          totalUsers: historicalUsers.length,
          totalRevenue: 0,
          payingUsers: 0,
          totalResumeUsage: 0 
      };

      historicalUsers.forEach(u => {
          if (u.plan in stats) {
              // @ts-ignore
              stats[u.plan].count++;
              // @ts-ignore
              stats[u.plan].revenue += stats[u.plan].price;
          }
          stats.totalResumeUsage += (u.resume_usage || 0);
      });

      stats.payingUsers = stats.MENSAL.count + stats.TRIMESTRAL.count + stats.ANUAL.count;
      stats.totalRevenue = stats.MENSAL.revenue + stats.TRIMESTRAL.revenue + stats.ANUAL.revenue;

      return stats;
  };

  // --- RENDERS ---

  const renderSidebar = () => (
    <div className="w-64 bg-white border-r border-zinc-200 flex flex-col fixed left-0 top-0 bottom-0 z-50">
        <div className="p-8 border-b border-zinc-100">
            <img src="https://ik.imagekit.io/xsbrdnr0y/elevva-logo.png" alt="Logo" className="h-8 w-auto mb-2" />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded">Admin Panel</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
            <button onClick={() => setCurrentView('OVERVIEW')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentView === 'OVERVIEW' ? 'bg-black text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-50 hover:text-black'}`}>
                <LayoutDashboard className="w-5 h-5" /> Visão Geral
            </button>
            <button onClick={() => setCurrentView('USERS')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentView === 'USERS' ? 'bg-black text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-50 hover:text-black'}`}>
                <Users className="w-5 h-5" /> Usuários
            </button>
            <button onClick={() => setCurrentView('ADS')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentView === 'ADS' ? 'bg-black text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-50 hover:text-black'}`}>
                <Megaphone className="w-5 h-5" /> Anúncios
            </button>
            <button onClick={() => setCurrentView('FINANCE')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentView === 'FINANCE' ? 'bg-black text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-50 hover:text-black'}`}>
                <DollarSign className="w-5 h-5" /> Faturamento
            </button>
            <button onClick={() => setCurrentView('DATABASE')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentView === 'DATABASE' ? 'bg-black text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-50 hover:text-black'}`}>
                <Database className="w-5 h-5" /> Banco de Dados
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
            <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Visão Geral</h2>
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
                    <div className="p-3 bg-zinc-900 rounded-2xl"><DollarSign className="w-6 h-6 text-[#CCF300]"/></div>
                </div>
                <h3 className="text-4xl font-black text-white">R$ {currentFinancials.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
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
      const totalFree = users.filter(u => u.plan === 'FREE').length;
      const totalPaid = users.filter(u => u.plan !== 'FREE').length;

      return (
          <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center">
                  <div>
                      <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Usuários</h2>
                      <p className="text-zinc-500 font-medium">Gerencie o acesso à plataforma.</p>
                  </div>
                  <div className="flex gap-4">
                      <div className="bg-white border border-zinc-200 px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm">
                          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total Free</span>
                          <span className="text-lg font-black text-zinc-900">{totalFree}</span>
                      </div>
                      <div className="bg-black text-white px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm">
                          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total Pagos</span>
                          <span className="text-lg font-black text-[#CCF300]">{totalPaid}</span>
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
                                  <td className="p-6"><span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${user.plan === 'ANUAL' ? 'bg-[#CCF300] text-black' : user.plan === 'FREE' ? 'bg-zinc-100 text-zinc-500' : 'bg-black text-white'}`}>{user.plan}</span></td>
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
              <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Gerenciador de Anúncios</h2>
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
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Link de Destino (Opcional)</label>
                          <input 
                              type="text" 
                              value={newAdLink}
                              onChange={(e) => setNewAdLink(e.target.value)}
                              placeholder="https://..."
                              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 font-bold text-sm focus:border-black focus:ring-0 outline-none transition-all"
                          />
                      </div>

                      <div>
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 block flex items-center gap-2">
                              <Filter className="w-3 h-3"/> Visibilidade por Plano
                          </label>
                          <div className="flex gap-2">
                              {(['FREE', 'MENSAL', 'ANUAL'] as PlanType[]).map(plan => (
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
                      <div className="w-full max-w-sm bg-white rounded-[1.5rem] border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden relative group cursor-default transform hover:-translate-y-1 transition-transform duration-300">
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
                              <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 uppercase tracking-wide">
                                  Saiba mais <ExternalLink className="w-3 h-3" />
                              </div>
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
                                      <p className="text-xs text-zinc-500 truncate">{ad.linkUrl || 'Sem link'}</p>
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

  const renderFinance = () => {
      const stats = getFinancialData();
      const arpu = stats.payingUsers > 0 ? stats.totalRevenue / stats.payingUsers : 0;
      
      const recentTransactions = users
          .filter(u => u.plan !== 'FREE')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5);

      return (
          <div className="space-y-8 animate-fade-in pb-12">
              <div className="flex justify-between items-end">
                  <div>
                      <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Faturamento</h2>
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
                                  <Wallet className="w-6 h-6 text-[#CCF300]"/>
                              </div>
                              <span className="text-[#CCF300] bg-[#CCF300]/10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-[#CCF300]/20">
                                  Mensal
                              </span>
                          </div>
                          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">MRR (Receita Recorrente)</p>
                          <h3 className="text-5xl font-black text-white tracking-tighter mb-2">
                              R$ {stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </h3>
                          <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold mt-4">
                              <TrendingUp className="w-4 h-4 text-emerald-500" />
                              <span className="text-emerald-500">Projeção Anual:</span> 
                              R$ {(stats.totalRevenue * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                          {/* Mensal */}
                          <div>
                              <div className="flex justify-between items-end mb-2">
                                  <div>
                                      <span className="text-sm font-bold text-zinc-900 block">Plano Mensal</span>
                                      <span className="text-xs text-zinc-500 font-medium">R$ 329,90 / mês</span>
                                  </div>
                                  <div className="text-right">
                                      <span className="text-lg font-black text-zinc-900">{stats.MENSAL.count}</span>
                                      <span className="text-xs text-zinc-400 font-bold ml-1">usuários</span>
                                  </div>
                              </div>
                              <div className="w-full bg-zinc-100 h-3 rounded-full overflow-hidden">
                                  <div className="bg-zinc-900 h-full rounded-full" style={{ width: `${(stats.MENSAL.count / (stats.payingUsers || 1)) * 100}%` }}></div>
                              </div>
                          </div>

                          {/* Anual */}
                          <div>
                              <div className="flex justify-between items-end mb-2">
                                  <div>
                                      <span className="text-sm font-bold text-zinc-900 block">Plano Anual</span>
                                      <span className="text-xs text-zinc-500 font-medium">R$ 289,90 / mês (Cobrado anualmente)</span>
                                  </div>
                                  <div className="text-right">
                                      <span className="text-lg font-black text-zinc-900">{stats.ANUAL.count}</span>
                                      <span className="text-xs text-zinc-400 font-bold ml-1">usuários</span>
                                  </div>
                              </div>
                              <div className="w-full bg-zinc-100 h-3 rounded-full overflow-hidden">
                                  <div className="bg-[#CCF300] h-full rounded-full" style={{ width: `${(stats.ANUAL.count / (stats.payingUsers || 1)) * 100}%` }}></div>
                              </div>
                          </div>
                      </div>

                      <div className="mt-8 pt-6 border-t border-zinc-100 flex justify-between items-center text-xs font-bold text-zinc-500">
                          <span>Total Free: <strong className="text-zinc-900">{stats.FREE.count}</strong></span>
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
                                                  + R$ {user.plan === 'ANUAL' ? '289,90' : '329,90'}
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
            {currentView === 'OVERVIEW' && renderOverview()}
            {currentView === 'USERS' && renderUsersList()}
            {currentView === 'ADS' && renderAdsManager()}
            {currentView === 'FINANCE' && renderFinance()} 
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
                <div className="bg-white rounded-[2rem] w-full max-w-lg p-8 shadow-2xl relative">
                    <button onClick={() => { setSelectedUser(null); setIsEditingPlan(false); }} className="absolute top-6 right-6 p-2 bg-zinc-50 hover:bg-zinc-100 rounded-full transition-colors"><X className="w-5 h-5"/></button>
                    
                    <div className="flex items-center gap-4 mb-8">
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
                                <button onClick={() => setIsEditingPlan(!isEditingPlan)} className="text-zinc-400 hover:text-black transition-colors bg-white p-1 rounded-md border border-zinc-200" title="Trocar Plano">
                                    {isEditingPlan ? <X className="w-4 h-4"/> : <Edit3 className="w-4 h-4" />}
                                </button>
                            </div>
                            
                            {isEditingPlan ? (
                                <div className="space-y-2 animate-fade-in">
                                    <p className="text-xs text-zinc-500 font-medium mb-2">Selecione o novo plano. Os limites serão atualizados automaticamente.</p>
                                    <div className="grid grid-cols-1 gap-2">
                                        <button onClick={() => handleUpdatePlan('FREE')} className="text-xs font-bold py-3 px-3 rounded-xl border flex justify-between items-center transition-colors bg-white text-zinc-600 border-zinc-200 hover:border-black hover:text-black">
                                            <span>FREE</span> <span className="text-[10px] text-zinc-400 font-normal">3 Vagas / 25 CVs</span>
                                        </button>
                                        <button onClick={() => handleUpdatePlan('MENSAL')} className="text-xs font-bold py-3 px-3 rounded-xl border flex justify-between items-center transition-colors bg-black text-white border-black hover:bg-zinc-800">
                                            <span>MENSAL</span> <span className="text-[10px] text-zinc-400 font-normal">5 Vagas / 150 CVs</span>
                                        </button>
                                        <button onClick={() => handleUpdatePlan('ANUAL')} className="text-xs font-bold py-3 px-3 rounded-xl border flex justify-between items-center transition-colors bg-[#CCF300] text-black border-[#CCF300] hover:bg-[#bce000]">
                                            <span>ANUAL</span> <span className="text-[10px] text-black/60 font-normal">Ilimitado</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-3xl font-black text-zinc-900">{selectedUser.plan}</p>
                                    <p className="text-xs text-zinc-400 font-bold mt-1">
                                        {selectedUser.plan === 'FREE' ? 'Limites: 3 Vagas / 25 CVs' : selectedUser.plan === 'MENSAL' ? 'Limites: 5 Vagas / 150 CVs' : 'Limites: ILIMITADO'}
                                    </p>
                                </div>
                            )}
                        </div>

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
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};