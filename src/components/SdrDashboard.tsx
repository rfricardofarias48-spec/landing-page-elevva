import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { SdrLead, SdrDemoSlot, SdrMessage } from '../types';
import {
  LayoutDashboard, Users, Calendar, MessageSquare, LogOut, Loader2,
  Search, Plus, Trash2, ChevronRight, ArrowUpRight, TrendingUp,
  Phone, Building2, UserCheck, Target, X, Send, Clock, Filter,
  RefreshCcw
} from 'lucide-react';

type SdrView = 'FUNNEL' | 'LEADS' | 'SLOTS' | 'CONVERSATIONS';

interface FunnelData {
  novos: number;
  qualificando: number;
  qualificados: number;
  demos: number;
  demos_agendadas: number;
  convertidos: number;
  perdidos: number;
  total: number;
  taxa_agendamento_pct: number;
}

export const SdrDashboard: React.FC = () => {
  const [currentView, setCurrentView] = useState<SdrView>('FUNNEL');
  const [loading, setLoading] = useState(true);

  // Data
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [leads, setLeads] = useState<SdrLead[]>([]);
  const [slots, setSlots] = useState<SdrDemoSlot[]>([]);
  const [messages, setMessages] = useState<SdrMessage[]>([]);

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedLead, setSelectedLead] = useState<SdrLead | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Slot creation
  const [newSlotDate, setNewSlotDate] = useState('');
  const [newSlotTime, setNewSlotTime] = useState('');
  const [slotCreating, setSlotCreating] = useState(false);

  // ─────── Data Fetching ───────

  const fetchFunnel = useCallback(async () => {
    try {
      const res = await fetch('/api/sdr/funnel');
      const data = await res.json();
      setFunnel(data);
    } catch (err) {
      console.error('Error fetching funnel:', err);
    }
  }, []);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/sdr/leads?limit=200');
      const data = await res.json();
      if (Array.isArray(data)) setLeads(data);
    } catch (err) {
      console.error('Error fetching leads:', err);
    }
  }, []);

  const fetchSlots = useCallback(async () => {
    try {
      const res = await fetch('/api/sdr/slots');
      const data = await res.json();
      if (Array.isArray(data)) setSlots(data);
    } catch (err) {
      console.error('Error fetching slots:', err);
    }
  }, []);

  const fetchMessages = useCallback(async (leadId: string) => {
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/sdr/leads/${leadId}/messages`);
      const data = await res.json();
      if (Array.isArray(data)) setMessages(data);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchFunnel(), fetchLeads(), fetchSlots()]);
      setLoading(false);
    };
    loadAll();
  }, [fetchFunnel, fetchLeads, fetchSlots]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('sdr-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sdr_leads' }, () => {
        fetchLeads();
        fetchFunnel();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sdr_conversations' }, () => {
        fetchFunnel();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchLeads, fetchFunnel]);

  // ─────── Slot CRUD ───────

  const createSlot = async () => {
    if (!newSlotDate || !newSlotTime) return;
    setSlotCreating(true);
    try {
      await fetch('/api/sdr/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots: [{ slot_date: newSlotDate, slot_time: newSlotTime }] }),
      });
      await fetchSlots();
      setNewSlotTime('');
    } catch (err) {
      console.error('Error creating slot:', err);
    } finally {
      setSlotCreating(false);
    }
  };

  const createBulkSlots = async () => {
    if (!newSlotDate) return;
    setSlotCreating(true);
    try {
      // Create slots every 30min from 08:00 to 19:30
      const bulkSlots = [];
      for (let h = 8; h < 20; h++) {
        bulkSlots.push({ slot_date: newSlotDate, slot_time: `${String(h).padStart(2, '0')}:00` });
        bulkSlots.push({ slot_date: newSlotDate, slot_time: `${String(h).padStart(2, '0')}:30` });
      }
      await fetch('/api/sdr/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots: bulkSlots }),
      });
      await fetchSlots();
    } catch (err) {
      console.error('Error creating bulk slots:', err);
    } finally {
      setSlotCreating(false);
    }
  };

  const deleteSlot = async (id: string) => {
    try {
      await fetch(`/api/sdr/slots/${id}`, { method: 'DELETE' });
      await fetchSlots();
    } catch (err) {
      console.error('Error deleting slot:', err);
    }
  };

  // ─────── Helpers ───────

  const statusColor = (status: string) => {
    const colors: Record<string, string> = {
      NOVO: 'bg-blue-100 text-blue-700',
      QUALIFICANDO: 'bg-amber-100 text-amber-700',
      QUALIFICADO: 'bg-purple-100 text-purple-700',
      DEMO_OFERECIDA: 'bg-indigo-100 text-indigo-700',
      DEMO_AGENDADA: 'bg-lime-100 text-lime-700',
      CONVERTIDO: 'bg-green-100 text-green-700',
      PERDIDO: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      NOVO: 'Novo',
      QUALIFICANDO: 'Qualificando',
      QUALIFICADO: 'Qualificado',
      DEMO_OFERECIDA: 'Demo Oferecida',
      DEMO_AGENDADA: 'Demo Agendada',
      CONVERTIDO: 'Convertido',
      PERDIDO: 'Perdido',
    };
    return labels[status] || status;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const formatTime = (timeStr: string) => timeStr?.substring(0, 5) || '';

  const formatDateFull = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  };

  const filteredLeads = leads.filter(l => {
    const matchesSearch = !searchTerm ||
      (l.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.phone || '').includes(searchTerm) ||
      (l.company || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Group slots by date
  const slotsByDate: Record<string, SdrDemoSlot[]> = {};
  for (const slot of slots) {
    if (!slotsByDate[slot.slot_date]) slotsByDate[slot.slot_date] = [];
    slotsByDate[slot.slot_date].push(slot);
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  // ─────── Render ───────

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-lime-500" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden font-sans text-slate-900">
      {/* SIDEBAR */}
      <aside className="w-20 lg:w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="h-20 flex flex-col items-center justify-center border-b border-slate-100 shrink-0">
          <p className="text-lg font-black text-slate-900 hidden lg:block">Elevva <span className="text-lime-500">SDR</span></p>
          <div className="w-8 h-8 bg-lime-500 rounded-xl lg:hidden flex items-center justify-center text-white font-black text-lg">S</div>
        </div>

        <nav className="flex-1 pt-2 pb-6 px-3 space-y-1">
          {([
            { key: 'FUNNEL', icon: TrendingUp, label: 'Funil' },
            { key: 'LEADS', icon: Users, label: 'Leads' },
            { key: 'SLOTS', icon: Calendar, label: 'Agenda' },
            { key: 'CONVERSATIONS', icon: MessageSquare, label: 'Conversas' },
          ] as const).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setCurrentView(key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all
                ${currentView === key
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="hidden lg:block">{label}</span>
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all">
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="hidden lg:block">Sair</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6">

          {/* ═══ FUNNEL VIEW ═══ */}
          {currentView === 'FUNNEL' && funnel && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-black text-slate-900">Funil SDR</h1>
                  <p className="text-sm text-slate-500 mt-1">Visão geral do pipeline comercial</p>
                </div>
                <button onClick={() => { fetchFunnel(); fetchLeads(); }} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400">
                  <RefreshCcw className="w-5 h-5" />
                </button>
              </div>

              {/* Funnel Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Novos', value: funnel.novos, color: 'bg-blue-500', icon: Users },
                  { label: 'Qualificados', value: funnel.qualificados, color: 'bg-purple-500', icon: UserCheck },
                  { label: 'Demos Agendadas', value: funnel.demos_agendadas, color: 'bg-lime-500', icon: Calendar },
                  { label: 'Convertidos', value: funnel.convertidos, color: 'bg-green-500', icon: Target },
                ].map(({ label, value, color, icon: Icon }) => (
                  <div key={label} className="bg-white rounded-2xl border border-slate-200 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <p className="text-sm font-semibold text-slate-500">{label}</p>
                    </div>
                    <p className="text-3xl font-black text-slate-900">{value}</p>
                  </div>
                ))}
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <p className="text-sm font-semibold text-slate-500 mb-1">Total de Leads</p>
                  <p className="text-2xl font-black text-slate-900">{funnel.total}</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <p className="text-sm font-semibold text-slate-500 mb-1">Taxa de Agendamento</p>
                  <p className="text-2xl font-black text-slate-900">{funnel.taxa_agendamento_pct || 0}%</p>
                  <p className="text-xs text-slate-400 mt-1">Meta: 30%</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <p className="text-sm font-semibold text-slate-500 mb-1">Perdidos</p>
                  <p className="text-2xl font-black text-red-500">{funnel.perdidos}</p>
                </div>
              </div>

              {/* Recent Leads */}
              <div className="bg-white rounded-2xl border border-slate-200">
                <div className="p-5 border-b border-slate-100">
                  <h2 className="text-lg font-bold text-slate-900">Leads Recentes</h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {leads.slice(0, 10).map(lead => (
                    <div
                      key={lead.id}
                      className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => { setSelectedLead(lead); fetchMessages(lead.id); }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-sm">
                          {(lead.name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{lead.name || lead.phone}</p>
                          <p className="text-xs text-slate-400">{lead.company || lead.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusColor(lead.status)}`}>
                          {statusLabel(lead.status)}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </div>
                    </div>
                  ))}
                  {leads.length === 0 && (
                    <div className="p-10 text-center text-slate-400">
                      <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="font-semibold">Nenhum lead ainda</p>
                      <p className="text-sm">Leads CTWA aparecerão aqui automaticamente.</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ═══ LEADS VIEW ═══ */}
          {currentView === 'LEADS' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-black text-slate-900">Leads</h1>
                  <p className="text-sm text-slate-500 mt-1">{filteredLeads.length} leads encontrados</p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex gap-3 mb-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nome, telefone ou empresa..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500/30 focus:border-lime-500"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-lime-500/30"
                >
                  <option value="ALL">Todos os status</option>
                  <option value="NOVO">Novo</option>
                  <option value="QUALIFICANDO">Qualificando</option>
                  <option value="QUALIFICADO">Qualificado</option>
                  <option value="DEMO_OFERECIDA">Demo Oferecida</option>
                  <option value="DEMO_AGENDADA">Demo Agendada</option>
                  <option value="CONVERTIDO">Convertido</option>
                  <option value="PERDIDO">Perdido</option>
                </select>
              </div>

              {/* Leads Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Lead</th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Empresa</th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Origem</th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Data</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredLeads.map(lead => (
                      <tr
                        key={lead.id}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => { setSelectedLead(lead); fetchMessages(lead.id); }}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-xs shrink-0">
                              {(lead.name || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{lead.name || 'Sem nome'}</p>
                              <p className="text-xs text-slate-400">{lead.phone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 hidden md:table-cell">
                          <p className="text-sm text-slate-600">{lead.company || '-'}</p>
                          <p className="text-xs text-slate-400">{lead.role || ''}</p>
                        </td>
                        <td className="px-5 py-3 hidden lg:table-cell">
                          <span className="text-xs font-semibold text-slate-500">{lead.source}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusColor(lead.status)}`}>
                            {statusLabel(lead.status)}
                          </span>
                        </td>
                        <td className="px-5 py-3 hidden md:table-cell">
                          <span className="text-xs text-slate-400">{formatDate(lead.created_at)}</span>
                        </td>
                        <td className="px-3">
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredLeads.length === 0 && (
                  <div className="p-10 text-center text-slate-400">
                    <Search className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold">Nenhum lead encontrado</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ═══ SLOTS VIEW ═══ */}
          {currentView === 'SLOTS' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-black text-slate-900">Agenda de Demos</h1>
                  <p className="text-sm text-slate-500 mt-1">Gerencie os horários disponíveis (8h-20h)</p>
                </div>
              </div>

              {/* Create Slots */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
                <h3 className="text-sm font-bold text-slate-900 mb-3">Adicionar Horários</h3>
                <div className="flex gap-3 items-end flex-wrap">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Data</label>
                    <input
                      type="date"
                      value={newSlotDate}
                      onChange={e => setNewSlotDate(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Horário</label>
                    <input
                      type="time"
                      value={newSlotTime}
                      onChange={e => setNewSlotTime(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500/30"
                    />
                  </div>
                  <button
                    onClick={createSlot}
                    disabled={!newSlotDate || !newSlotTime || slotCreating}
                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {slotCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Adicionar
                  </button>
                  <button
                    onClick={createBulkSlots}
                    disabled={!newSlotDate || slotCreating}
                    className="px-4 py-2 bg-lime-500 text-white rounded-xl text-sm font-bold hover:bg-lime-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {slotCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                    Preencher dia inteiro (8h-20h)
                  </button>
                </div>
              </div>

              {/* Slots by Date */}
              {Object.keys(slotsByDate).length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
                  <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="font-semibold">Nenhum horário cadastrado</p>
                  <p className="text-sm">Selecione uma data acima e clique em "Preencher dia inteiro".</p>
                </div>
              ) : (
                Object.entries(slotsByDate).map(([date, dateSlots]) => (
                  <div key={date} className="bg-white rounded-2xl border border-slate-200 mb-4 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                      <p className="text-sm font-bold text-slate-700">{formatDateFull(date)}</p>
                    </div>
                    <div className="p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                      {dateSlots.map(slot => (
                        <div
                          key={slot.id}
                          className={`relative group rounded-xl px-3 py-2 text-center text-sm font-bold transition-all ${
                            slot.is_booked
                              ? 'bg-lime-100 text-lime-700 border-2 border-lime-300'
                              : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <span>{formatTime(slot.slot_time)}</span>
                          {slot.is_booked && <span className="block text-[10px] font-semibold text-lime-600 mt-0.5">Reservado</span>}
                          {!slot.is_booked && (
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteSlot(slot.id); }}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {/* ═══ CONVERSATIONS VIEW ═══ */}
          {currentView === 'CONVERSATIONS' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-black text-slate-900">Conversas</h1>
                  <p className="text-sm text-slate-500 mt-1">Histórico de todas as interações</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Lead List */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden lg:col-span-1">
                  <div className="p-3 border-b border-slate-100">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar lead..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500/30"
                      />
                    </div>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-[calc(100vh-220px)] overflow-y-auto">
                    {leads
                      .filter(l => !searchTerm || (l.name || l.phone).toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(lead => (
                        <div
                          key={lead.id}
                          onClick={() => { setSelectedLead(lead); fetchMessages(lead.id); }}
                          className={`px-4 py-3 cursor-pointer transition-colors flex items-center gap-3 ${
                            selectedLead?.id === lead.id ? 'bg-lime-50 border-l-4 border-lime-500' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-sm shrink-0">
                            {(lead.name || '?')[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{lead.name || lead.phone}</p>
                            <p className="text-xs text-slate-400 truncate">{lead.company || lead.phone}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${statusColor(lead.status)}`}>
                            {statusLabel(lead.status)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Messages Panel */}
                <div className="bg-white rounded-2xl border border-slate-200 lg:col-span-2 flex flex-col min-h-[500px]">
                  {selectedLead ? (
                    <>
                      {/* Header */}
                      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold">
                            {(selectedLead.name || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{selectedLead.name || selectedLead.phone}</p>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <Phone className="w-3 h-3" />
                              <span>{selectedLead.phone}</span>
                              {selectedLead.company && (
                                <>
                                  <Building2 className="w-3 h-3 ml-2" />
                                  <span>{selectedLead.company}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColor(selectedLead.status)}`}>
                          {statusLabel(selectedLead.status)}
                        </span>
                      </div>

                      {/* Messages */}
                      <div className="flex-1 overflow-y-auto p-5 space-y-3">
                        {messagesLoading ? (
                          <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                          </div>
                        ) : messages.length === 0 ? (
                          <div className="flex items-center justify-center h-full text-slate-400">
                            <p className="text-sm">Nenhuma mensagem registrada.</p>
                          </div>
                        ) : (
                          messages.map(msg => (
                            <div
                              key={msg.id}
                              className={`flex ${msg.direction === 'OUT' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                                msg.direction === 'OUT'
                                  ? 'bg-slate-900 text-white rounded-br-md'
                                  : 'bg-slate-100 text-slate-900 rounded-bl-md'
                              }`}>
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                <p className={`text-[10px] mt-1 ${msg.direction === 'OUT' ? 'text-slate-400' : 'text-slate-400'}`}>
                                  {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400">
                      <div className="text-center">
                        <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="font-semibold">Selecione um lead</p>
                        <p className="text-sm">Clique em um lead para ver a conversa.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

        </div>
      </main>

      {/* ═══ LEAD DETAIL MODAL ═══ */}
      {selectedLead && currentView !== 'CONVERSATIONS' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedLead(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-lg">
                  {(selectedLead.name || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900">{selectedLead.name || 'Sem nome'}</p>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${statusColor(selectedLead.status)}`}>
                    {statusLabel(selectedLead.status)}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedLead(null)} className="p-2 hover:bg-slate-100 rounded-xl">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Info Grid */}
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-1">Telefone</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedLead.phone}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-1">Empresa</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedLead.company || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-1">Cargo</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedLead.role || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-1">Tamanho</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedLead.company_size || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-1">Origem</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedLead.source}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-1">Desde</p>
                  <p className="text-sm font-semibold text-slate-900">{formatDate(selectedLead.created_at)}</p>
                </div>
              </div>

              {selectedLead.main_pain && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-1">Principal Dor</p>
                  <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl">{selectedLead.main_pain}</p>
                </div>
              )}

              {selectedLead.lost_reason && (
                <div>
                  <p className="text-xs font-semibold text-red-400 mb-1">Motivo da Perda</p>
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{selectedLead.lost_reason}</p>
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex gap-2 pt-2">
                <a
                  href={`https://wa.me/55${selectedLead.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-xl text-sm font-bold hover:bg-green-600 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  WhatsApp
                </a>
                <button
                  onClick={() => { setCurrentView('CONVERSATIONS'); fetchMessages(selectedLead.id); }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Ver Conversa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
