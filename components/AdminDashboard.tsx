
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { AdminUserProfile, Announcement, PlanType } from '../types';
import { 
  Users, Shield, Calendar, CreditCard, Search, Activity, Briefcase, 
  Loader2, ArrowUpRight, Ban, CheckCircle2, X, Phone, User, Mail, 
  Zap, Star, Crown, LogOut, LayoutDashboard, DollarSign, TrendingUp, 
  FileText, PieChart, BarChart3, AlertCircle, Megaphone, Image as ImageIcon, Upload, Trash2, ExternalLink, Filter, ChevronLeft, ChevronRight, Clock, UserX, MessageCircle
} from 'lucide-react';

// Tipos auxiliares para o Dashboard
type AdminView = 'OVERVIEW' | 'USERS' | 'ADS' | 'FINANCE' | 'CANCELLATIONS';

interface AdminJob {
  id: string;
  title: string;
  created_at: string;
  candidates_count: number;
  owner_name: string;
  owner_email: string;
  status: 'ACTIVE' | 'CLOSED'; // Simulado
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
      
      // 1. Buscar Perfis
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*');
        
      if (profilesError) throw profilesError;

      // 2. Buscar Vagas (para Overview)
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('*, candidates(id)');

      if (jobsError) throw jobsError;

      // 3. Buscar Anúncios
      const { data: adsData, error: adsError } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (adsError && adsError.code !== '42P01') { // Ignora erro de tabela inexistente se script não rodou
          console.error("Erro ao buscar anúncios:", adsError);
      }

      // Processar Usuários
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
            last_active: u.updated_at || u.created_at, // Fallback para data de update como "último acesso"
            subscription_status: u.subscription_status
          };
      });

      // Processar Vagas
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

      // Processar Anúncios
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
          const { error } = await supabase
            .from('profiles')
            .update({ status: newStatus })
            .eq('id', user.id);
            
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

  // --- ADVERTISEMENT LOGIC ---

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
          // 1. Upload Image
          const fileExt = newAdImage.name.split('.').pop();
          const fileName = `${Date.now()}_ad.${fileExt}`;
          const { error: uploadError, data: uploadData } = await supabase.storage
              .from('marketing')
              .upload(fileName, newAdImage);

          if (uploadError) throw uploadError;

          // 2. Insert DB Record
          const { error: dbError } = await supabase
              .from('announcements')
              .insert([{
                  title: newAdTitle,
                  link_url: newAdLink || null,
                  image_path: uploadData.path,
                  is_active: true,
                  target_plans: newAdPlans
              }]);

          if (dbError) throw dbError;

          alert("Anúncio publicado com sucesso!");
          
          // Reset Form
          setNewAdTitle('');
          setNewAdLink('');
          setNewAdImage(null);
          setNewAdPreview(null);
          setNewAdPlans(['FREE', 'MENSAL', 'ANUAL']);
          fetchData(); // Refresh list

      } catch (err: any) {
          console.error("Erro ao postar anúncio:", err);
          alert("Erro ao postar anúncio: " + err.message + "\n\nVerifique se rodou o Script V22.");
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

  // --- LÓGICA FINANCEIRA ---
  
  const handleMonthChange = (direction: 'prev' | 'next') => {
      const newDate = new Date(financeDate);
      if (direction === 'prev') {
          newDate.setMonth(newDate.getMonth() - 1);
      } else {
          newDate.setMonth(newDate.getMonth() + 1);
      }
      setFinanceDate(newDate);
  };

  const getFinancialData = () => {
      // Filtrar usuários que existiam até o final do mês selecionado
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
          payingUsers: 0
      };

      historicalUsers.forEach(u => {
          if (u.plan in stats) {
              // @ts-ignore
              stats[u.plan].count++;
              // @ts-ignore
              stats[u.plan].revenue += stats[u.plan].price;
          }
      });

      stats.payingUsers = stats.MENSAL.count + stats.TRIMESTRAL.count + stats.ANUAL.count;
      stats.totalRevenue = stats.MENSAL.revenue + stats.TRIMESTRAL.revenue + stats.ANUAL.revenue;

      return stats;
  };

  const renderSidebar = () => (
    <div className="w-64 bg-white border-r border-zinc-200 flex flex-col fixed left-0 top-0 bottom-0 z-50">
        <div className="p-8 border-b border-zinc-100">
            <img src="https://ik.imagekit.io/xsbrdnr0y/elevva-logo.png" alt="Logo" className="h-8 w-auto mb-2" />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded">Admin Panel</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
            <button 
                onClick={() => setCurrentView('OVERVIEW')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentView === 'OVERVIEW' ? 'bg-black text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-50 hover:text-black'}`}
            >
                <LayoutDashboard className="w-5 h-5" /> Visão Geral
            </button>
            <button 
                onClick={() => setCurrentView('USERS')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentView === 'USERS' ? 'bg-black text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-50 hover:text-black'}`}
            >
                <Users className="w-5 h-5" /> Usuários
            </button>
            <button 
                onClick={() => setCurrentView('ADS')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentView === 'ADS' ? 'bg-black text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-50 hover:text-black'}`}
            >
                <Megaphone className="w-5 h-5" /> Anúncios
            </button>
            <button 
                onClick={() => setCurrentView('FINANCE')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentView === 'FINANCE' ? 'bg-black text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-50 hover:text-black'}`}
            >
                <DollarSign className="w-5 h-5" /> Faturamento
            </button>
            <button 
                onClick={() => setCurrentView('CANCELLATIONS')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentView === 'CANCELLATIONS' ? 'bg-black text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-50 hover:text-black'}`}
            >
                <UserX className="w-5 h-5" /> Cancelamentos
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
                    <span className="text-emerald-500 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1"><TrendingUp className="w-3 h-3"/> +12%</span>
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
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">MRR Atual</p>
            </div>
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
                              <h4 className="font-black text-lg leading-tight mb-2 text-zinc-900 line-clamp-2">
                                  {newAdTitle || "Título do seu anúncio aparecerá aqui"}
                              </h4>
                              {newAdLink && (
                                  <div className="text-[10px] font-bold text-blue-600 truncate flex items-center gap-1">
                                      <ExternalLink className="w-3 h-3"/> {newAdLink}
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>

                  {/* LISTA DE ATIVOS */}
                  <div className="bg-white rounded-[2rem] p-6 border border-zinc-200 flex-1 overflow-y-auto custom-scrollbar">
                      <h3 className="text-sm font-black text-zinc-900 mb-4 uppercase tracking-widest sticky top-0 bg-white pb-2 border-b border-zinc-100">Anúncios Ativos ({ads.length})</h3>
                      <div className="space-y-3">
                          {ads.map(ad => (
                              <div key={ad.id} className="flex items-center gap-4 p-3 bg-zinc-50 rounded-xl border border-zinc-100 hover:border-zinc-300 transition-colors group">
                                  <img src={ad.imageUrl} className="w-12 h-12 rounded-lg object-cover bg-zinc-200" alt="Thumb" />
                                  <div className="flex-1 min-w-0">
                                      <p className="text-xs font-bold text-zinc-900 truncate">{ad.title}</p>
                                      <div className="flex gap-1 mt-1 flex-wrap">
                                          {ad.targetPlans.map(p => (
                                              <span key={p} className="text-[8px] bg-zinc-200 text-zinc-600 px-1.5 py-0.5 rounded font-bold">{p[0]}</span>
                                          ))}
                                      </div>
                                  </div>
                                  <button onClick={() => handleDeleteAd(ad.id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                      <Trash2 className="w-4 h-4" />
                                  </button>
                              </div>
                          ))}
                          {ads.length === 0 && (
                              <p className="text-center text-zinc-400 text-xs py-4">Nenhum anúncio ativo.</p>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      </div>
  );

  const renderUsersTable = () => {
    const filteredUsers = users.filter(u => 
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const totalFree = users.filter(u => u.plan === 'FREE').length;
    const totalPaid = users.filter(u => u.plan !== 'FREE').length;

    return (
        <div className="space-y-6 animate-fade-in">
             <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Usuários</h2>
                    <p className="text-zinc-500 font-medium">Gerenciamento de base e acessos</p>
                </div>
                
                {/* Contadores no Header */}
                <div className="flex items-center gap-4">
                    <div className="px-5 py-2.5 bg-zinc-100 rounded-2xl border border-zinc-200 flex flex-col items-center min-w-[120px]">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Cadastros Free</span>
                        <p className="text-2xl font-black text-zinc-900 leading-none mt-1">{totalFree}</p>
                    </div>
                    <div className="px-5 py-2.5 bg-black text-white rounded-2xl border border-black flex flex-col items-center min-w-[120px] shadow-lg">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Cadastros Pagos</span>
                        <p className="text-2xl font-black text-[#CCF300] leading-none mt-1">{totalPaid}</p>
                    </div>
                </div>

                <div className="relative w-72">
                  <Search className="w-4 h-4 absolute left-3 top-3.5 text-zinc-400" />
                  <input 
                    type="text" 
                    placeholder="Buscar usuários..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-xl py-3 pl-10 pr-4 text-sm text-zinc-900 font-medium focus:border-black focus:ring-0 outline-none transition-all"
                  />
              </div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-[2rem] overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-zinc-50 text-zinc-400 text-[10px] font-bold uppercase tracking-widest border-b border-zinc-100">
                            <th className="p-5 pl-8">Usuário</th>
                            <th className="p-5">Plano</th>
                            <th className="p-5 whitespace-nowrap">Data Cadastro</th>
                            <th className="p-5 whitespace-nowrap">Últ. Acesso</th>
                            <th className="p-5 text-center">Currículos</th>
                            <th className="p-5 text-center">Vagas</th>
                            <th className="p-5 text-center">Status</th>
                            <th className="p-5 text-right pr-8">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {filteredUsers.map((u) => (
                            <tr key={u.id} className="hover:bg-zinc-50 transition-colors">
                                <td className="p-5 pl-8">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border shadow-sm ${u.role === 'ADMIN' ? 'bg-red-50 border-red-100 text-red-500' : 'bg-white border-zinc-200 text-zinc-400'}`}>
                                            {u.role === 'ADMIN' ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-zinc-900">{u.name || 'Sem nome'}</div>
                                            <div className="text-xs text-zinc-500 font-medium">{u.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-5">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${u.plan === 'FREE' ? 'bg-zinc-100 text-zinc-500 border-zinc-200' : 'bg-black text-[#CCF300] border-black'}`}>
                                        {u.plan}
                                    </span>
                                </td>
                                <td className="p-5 text-xs font-bold text-zinc-600">
                                    {new Date(u.created_at).toLocaleDateString('pt-BR')}
                                </td>
                                <td className="p-5 text-xs font-bold text-zinc-600">
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="w-3 h-3 text-zinc-400" />
                                        {u.last_active ? new Date(u.last_active).toLocaleDateString('pt-BR') : '-'}
                                    </div>
                                </td>
                                <td className="p-5 text-center text-sm font-bold text-zinc-700">{u.resume_usage}</td>
                                <td className="p-5 text-center text-sm font-bold text-zinc-700">{u.jobs_count}</td>
                                <td className="p-5 text-center">
                                    {u.status === 'BLOCKED' ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100"><Ban className="w-3 h-3" /> SUSPENSO</span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100"><CheckCircle2 className="w-3 h-3" /> ATIVO</span>
                                    )}
                                </td>
                                <td className="p-5 pr-8 text-right">
                                    <button onClick={() => setSelectedUser(u)} className="text-zinc-400 hover:text-black transition-colors"><ArrowUpRight className="w-5 h-5" /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
  };

  const renderCancellations = () => {
      // Filtrar usuários com status cancelado, past_due ou que não renovaram
      const cancelledUsers = users.filter(u => 
          (u.subscription_status === 'canceled' || u.subscription_status === 'past_due') &&
          (u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
           u.name?.toLowerCase().includes(searchTerm.toLowerCase()))
      );

      return (
          <div className="space-y-6 animate-fade-in">
               <div className="flex justify-between items-center">
                  <div>
                      <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Cancelamentos</h2>
                      <p className="text-zinc-500 font-medium">Usuários que não renovaram o plano.</p>
                  </div>
                  <div className="relative w-72">
                    <Search className="w-4 h-4 absolute left-3 top-3.5 text-zinc-400" />
                    <input 
                      type="text" 
                      placeholder="Buscar..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-white border border-zinc-200 rounded-xl py-3 pl-10 pr-4 text-sm text-zinc-900 font-medium focus:border-black focus:ring-0 outline-none transition-all"
                    />
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-[2rem] overflow-hidden shadow-sm">
                  {cancelledUsers.length === 0 ? (
                      <div className="p-12 text-center text-zinc-400">
                          <UserX className="w-12 h-12 mx-auto mb-4 text-zinc-300" />
                          <p className="font-bold text-sm">Nenhum cancelamento encontrado.</p>
                      </div>
                  ) : (
                      <table className="w-full text-left border-collapse">
                          <thead>
                              <tr className="bg-zinc-50 text-zinc-400 text-[10px] font-bold uppercase tracking-widest border-b border-zinc-100">
                                  <th className="p-5 pl-8">Candidato</th>
                                  <th className="p-5">Contato</th>
                                  <th className="p-5">Status Financeiro</th>
                                  <th className="p-5">Último Acesso</th>
                                  <th className="p-5 text-right pr-8">Ações</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                              {cancelledUsers.map((u) => (
                                  <tr key={u.id} className="hover:bg-zinc-50 transition-colors">
                                      <td className="p-5 pl-8">
                                          <div className="flex items-center gap-3">
                                              <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-red-500 font-bold border border-red-100">
                                                  {u.name?.charAt(0) || u.email.charAt(0).toUpperCase()}
                                              </div>
                                              <div>
                                                  <div className="text-sm font-bold text-zinc-900">{u.name || 'Sem nome'}</div>
                                                  <div className="text-xs text-zinc-500 font-medium">{u.email}</div>
                                              </div>
                                          </div>
                                      </td>
                                      <td className="p-5">
                                          {u.phone ? (
                                              <div className="flex items-center gap-2">
                                                  <span className="text-sm font-bold text-zinc-700">{u.phone}</span>
                                                  <a 
                                                      href={`https://wa.me/55${u.phone.replace(/\D/g, '')}`} 
                                                      target="_blank" 
                                                      rel="noreferrer"
                                                      className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"
                                                      title="Chamar no WhatsApp"
                                                  >
                                                      <MessageCircle className="w-3.5 h-3.5" />
                                                  </a>
                                              </div>
                                          ) : (
                                              <span className="text-xs text-zinc-400 font-medium">Não informado</span>
                                          )}
                                      </td>
                                      <td className="p-5">
                                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${u.subscription_status === 'canceled' ? 'bg-zinc-100 text-zinc-500 border-zinc-200' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                              {u.subscription_status === 'canceled' ? 'Cancelado' : 'Pagamento Pendente'}
                                          </span>
                                      </td>
                                      <td className="p-5 text-sm font-bold text-zinc-600">
                                          {u.last_active ? new Date(u.last_active).toLocaleDateString('pt-BR') : '-'}
                                      </td>
                                      <td className="p-5 pr-8 text-right">
                                          <button onClick={() => setSelectedUser(u)} className="text-zinc-400 hover:text-black transition-colors"><ArrowUpRight className="w-5 h-5" /></button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  )}
              </div>
          </div>
      );
  };

  const renderFinance = () => {
      const financeData = getFinancialData();
      
      const formatCurrency = (val: number) => 
          val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

      return (
      <div className="space-y-8 animate-fade-in">
         {/* Header com Navegação */}
         <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Faturamento</h2>
                <p className="text-zinc-500 font-medium">Relatório financeiro mensal</p>
            </div>
            
            <div className="bg-white border border-zinc-200 rounded-xl p-1 flex items-center shadow-sm">
                <button onClick={() => handleMonthChange('prev')} className="p-2 hover:bg-zinc-100 rounded-lg transition-colors">
                    <ChevronLeft className="w-5 h-5 text-zinc-600" />
                </button>
                <div className="px-6 font-black text-zinc-900 w-48 text-center uppercase tracking-wide text-sm">
                    {financeDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </div>
                <button onClick={() => handleMonthChange('next')} className="p-2 hover:bg-zinc-100 rounded-lg transition-colors">
                    <ChevronRight className="w-5 h-5 text-zinc-600" />
                </button>
            </div>
         </div>

         {/* Cards de Resumo */}
         <div className="bg-black rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
             <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-900 rounded-full blur-3xl opacity-50 -mr-20 -mt-20"></div>
             
             <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-10">
                 {/* Card 1: Faturamento Total */}
                 <div>
                     <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2">Faturamento Esperado</p>
                     <h3 className="text-6xl font-black tracking-tighter text-[#CCF300]">{formatCurrency(financeData.totalRevenue)}</h3>
                     <p className="text-zinc-400 text-sm font-bold mt-2 flex items-center gap-1">
                         Referente a {financeDate.toLocaleDateString('pt-BR', { month: 'long' })}
                     </p>
                 </div>

                 {/* Card 2: Total de Usuários */}
                 <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 flex flex-col justify-center">
                     <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                         <Users className="w-4 h-4"/> Total de Usuários
                     </p>
                     <p className="text-4xl font-black text-white">{financeData.totalUsers}</p>
                     <p className="text-zinc-500 text-xs font-medium mt-1">Cadastrados até o fim do mês</p>
                 </div>

                 {/* Card 3: Assinantes Pagos */}
                 <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 flex flex-col justify-center">
                     <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                         <Crown className="w-4 h-4 text-[#CCF300]"/> Assinantes Pagos
                     </p>
                     <p className="text-4xl font-black text-white">{financeData.payingUsers}</p>
                     <p className="text-zinc-500 text-xs font-medium mt-1">Planos Mensal e Anual</p>
                 </div>
             </div>
         </div>

         {/* Tabela de Detalhamento */}
         <div className="bg-white border border-zinc-200 rounded-[2rem] p-8 shadow-sm">
            <h4 className="font-bold text-lg mb-6 flex items-center gap-2 text-zinc-900">
                <BarChart3 className="w-5 h-5"/> Detalhamento por Plano
            </h4>
            
            <div className="overflow-hidden rounded-xl border border-zinc-100">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-zinc-50 text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                            <th className="p-4">Plano</th>
                            <th className="p-4 text-right">Preço Unit.</th>
                            <th className="p-4 text-center">Qtd. Assinantes</th>
                            <th className="p-4 text-right">Faturamento Estimado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50 font-medium text-sm">
                        {/* Linha FREE */}
                        <tr className="hover:bg-zinc-50 transition-colors">
                            <td className="p-4">
                                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-zinc-100 text-zinc-600 font-bold text-xs">
                                    FREE
                                </span>
                            </td>
                            <td className="p-4 text-right text-zinc-500">Grátis</td>
                            <td className="p-4 text-center font-bold">{financeData.FREE.count}</td>
                            <td className="p-4 text-right text-zinc-400">-</td>
                        </tr>

                        {/* Linha MENSAL */}
                        <tr className="hover:bg-zinc-50 transition-colors">
                            <td className="p-4">
                                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-black text-white font-bold text-xs">
                                    MENSAL
                                </span>
                            </td>
                            <td className="p-4 text-right">{formatCurrency(financeData.MENSAL.price)}</td>
                            <td className="p-4 text-center font-bold">{financeData.MENSAL.count}</td>
                            <td className="p-4 text-right font-bold text-emerald-600">{formatCurrency(financeData.MENSAL.revenue)}</td>
                        </tr>

                        {/* Linha ANUAL */}
                        <tr className="hover:bg-zinc-50 transition-colors">
                            <td className="p-4">
                                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#CCF300] text-black font-bold text-xs border border-black">
                                    ANUAL
                                </span>
                            </td>
                            <td className="p-4 text-right">{formatCurrency(financeData.ANUAL.price)}/mês</td>
                            <td className="p-4 text-center font-bold">{financeData.ANUAL.count}</td>
                            <td className="p-4 text-right font-bold text-emerald-600">{formatCurrency(financeData.ANUAL.revenue)}</td>
                        </tr>
                        
                        {/* Rodapé Totais */}
                        <tr className="bg-zinc-50">
                            <td className="p-4 font-black uppercase text-xs">Total Geral</td>
                            <td className="p-4"></td>
                            <td className="p-4 text-center font-black">{financeData.totalUsers}</td>
                            <td className="p-4 text-right font-black text-lg">{formatCurrency(financeData.totalRevenue)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div className="mt-4 flex items-start gap-2 bg-amber-50 p-3 rounded-xl border border-amber-100">
                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 leading-relaxed">
                    <strong>Nota sobre dados históricos:</strong> O cálculo baseia-se na data de criação dos usuários ativos. 
                    Cancelamentos passados não são deduzidos retroativamente nesta visualização simplificada.
                </p>
            </div>
         </div>
      </div>
      );
  };

  return (
    <div className="flex w-full h-screen bg-zinc-50 font-sans text-zinc-900 overflow-hidden">
      {renderSidebar()}
      
      <main className="flex-1 ml-64 overflow-y-auto custom-scrollbar p-8">
         {loading ? (
             <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-4">
                 <Loader2 className="w-10 h-10 animate-spin text-black" />
                 <span className="font-bold text-sm uppercase tracking-widest">Carregando Admin...</span>
             </div>
         ) : (
             <>
                {currentView === 'OVERVIEW' && renderOverview()}
                {currentView === 'USERS' && renderUsersTable()}
                {currentView === 'ADS' && renderAdsManager()}
                {currentView === 'FINANCE' && renderFinance()}
                {currentView === 'CANCELLATIONS' && renderCancellations()}
             </>
         )}
      </main>

      {/* Modal de Detalhes do Usuário */}
      {selectedUser && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-fade-in">
                <div className="bg-white border border-zinc-200 rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden relative">
                    <div className="p-8 border-b border-zinc-100 flex justify-between items-start bg-zinc-50">
                        <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-sm ${selectedUser.status === 'BLOCKED' ? 'bg-red-50 border-red-100' : 'bg-sky-50 border-sky-100'}`}>
                                <User className={`w-6 h-6 ${selectedUser.status === 'BLOCKED' ? 'text-red-500' : 'text-sky-500'}`} />
                            </div>
                            <div>
                                <h3 className="text-xl font-extrabold text-zinc-900 tracking-tight">{selectedUser.name || 'Nome não cadastrado'}</h3>
                                <p className="text-zinc-500 text-sm flex items-center gap-1.5 font-medium mt-0.5"><Mail className="w-3.5 h-3.5"/> {selectedUser.email}</p>
                            </div>
                        </div>
                        <button onClick={() => setSelectedUser(null)} className="text-zinc-400 hover:text-black p-2 bg-white rounded-xl border border-zinc-200 hover:border-zinc-300 transition-all"><X className="w-5 h-5"/></button>
                    </div>

                    <div className="p-8 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                                <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Telefone</label>
                                <div className="text-zinc-900 font-bold text-sm flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-zinc-400" />{selectedUser.phone || 'N/A'}</div>
                            </div>
                            <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                                <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Plano</label>
                                <div className="text-zinc-900 font-bold text-sm flex items-center gap-2"><CreditCard className="w-3.5 h-3.5 text-zinc-400" />{selectedUser.plan}</div>
                            </div>
                        </div>
                        <div className={`rounded-2xl border p-5 ${selectedUser.status === 'BLOCKED' ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-xs font-bold uppercase text-zinc-500">Status</span>
                                {selectedUser.status === 'BLOCKED' ? <span className="text-xs font-bold text-red-600 bg-white px-2 py-0.5 rounded border border-red-100">SUSPENSO</span> : <span className="text-xs font-bold text-emerald-600 bg-white px-2 py-0.5 rounded border border-emerald-100">ATIVO</span>}
                            </div>
                            <button onClick={() => handleToggleBlock(selectedUser)} disabled={actionLoading} className={`w-full py-3 rounded-xl font-bold text-sm text-white shadow-lg ${selectedUser.status === 'BLOCKED' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}`}>
                               {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto"/> : (selectedUser.status === 'BLOCKED' ? 'Reativar Acesso' : 'Bloquear Usuário')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
      )}
    </div>
  );
};
