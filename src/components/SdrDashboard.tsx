import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { SdrLead, SdrDemoSlot, SdrMessage } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart,
} from 'recharts';
import {
  LayoutDashboard, Users, Calendar, MessageSquare, LogOut, Loader2,
  Search, Plus, Trash2, ChevronRight, ArrowUpRight, TrendingUp, TrendingDown,
  Phone, Building2, UserCheck, Target, X, Send, Clock, Filter,
  RefreshCcw, Zap, CheckCircle2, AlertCircle, Activity, Bot, Edit3, Save,
  Download, Globe,
} from 'lucide-react';

type SdrView = 'OVERVIEW' | 'LEADS' | 'SLOTS' | 'CONVERSATIONS' | 'PROMPTS' | 'GERADOR_LEADS';
interface GeneratedLead { nome: string; categoria: string; endereco: string; telefone: string; site: string; email: string; rating: number | null; reviews: number }

// ─── Prompt SDR — tipos e constantes (fora do componente para referência estável) ───
interface SdrSection { key: string; label: string; description: string; rows: number }
interface SdrCustomSection { id: string; label: string; content: string }

const SDR_FIXED_SECTIONS: SdrSection[] = [
  { key: 'pitch_curto',           label: 'Pitch Curto',                description: 'Primeira mensagem quando o lead demonstra interesse.',              rows: 4  },
  { key: 'pitch_medio',           label: 'Pitch Médio',                description: 'Explicação detalhada de como a Elevva funciona.',                   rows: 7  },
  { key: 'planos',                label: 'Planos e Preços',            description: 'Apresentação dos planos Essencial e Pro.',                          rows: 10 },
  { key: 'objection_caro',        label: 'Objeção: Muito caro',        description: 'Resposta quando o lead diz que é caro.',                            rows: 6  },
  { key: 'objection_pequena',     label: 'Objeção: Empresa pequena',   description: 'Resposta quando o lead diz que a empresa é pequena.',               rows: 6  },
  { key: 'objection_ia',          label: 'Objeção: Não confia em IA',  description: 'Resposta quando o lead não confia em inteligência artificial.',     rows: 6  },
  { key: 'objection_concorrente', label: 'Objeção: Já usa concorrente',description: 'Resposta quando o lead já usa outra ferramenta.',                   rows: 5  },
  { key: 'qual_nome',             label: 'Qualificação: Nome',         description: 'Pergunta para capturar o nome do lead.',                            rows: 2  },
  { key: 'qual_empresa',          label: 'Qualificação: Empresa',      description: 'Pergunta sobre a empresa. Use {name} como variável.',               rows: 2  },
  { key: 'qual_cargo',            label: 'Qualificação: Cargo',        description: 'Pergunta sobre o cargo. Use {company} como variável.',              rows: 2  },
  { key: 'qual_tamanho',          label: 'Qualificação: Tamanho',      description: 'Pergunta sobre número de funcionários. Use {name} como variável.',  rows: 2  },
  { key: 'qual_dor',              label: 'Qualificação: Dor principal', description: 'Última pergunta de qualificação sobre a principal dificuldade.',    rows: 3  },
];

const SDR_DEFAULTS: Record<string, string> = {
  pitch_curto:           `A Elevva é uma IA que cuida de toda a burocracia do recrutamento — triagem, relatórios e agendamento de entrevistas. Tudo pelo WhatsApp, sem instalar nada.\n\nQuer ver funcionando?`,
  pitch_medio:           `Você cria a vaga, define os critérios e recebe um WhatsApp exclusivo para os anúncios. A partir daí:\n\n📄 A IA recebe e analisa cada currículo em segundos\n⚙️ Gera relatório com nota de compatibilidade\n📅 Agenda entrevistas no Google Calendar + Meet\n\nTudo automático. O que um analista leva horas, a Elevva faz em segundos com 50 candidatos ao mesmo tempo.`,
  planos:                `Temos dois planos:\n\n*Plano Essencial — R$ 499/mês*\n✅ Até 5 vagas simultâneas\n✅ WhatsApp autônomo + triagem com ranking\n✅ Agendamento automático (Calendar + Meet)\n\n*Plano Pro — R$ 899/mês*\n✅ Tudo do Essencial + até 10 vagas\n✅ Portal de Admissão + dossiê PDF\n✅ Exclusão automática de dados em 48h (LGPD)\n\nTambém temos opção de plano anual com desconto. Posso detalhar na demonstração.`,
  objection_caro:        `Se um analista de R$ 3.000 perde duas horas por dia abrindo e-mails e cobrando candidatos no WhatsApp, são R$ 750 jogados fora todo mês. A Elevva automatiza isso 24h por R$ 29,90 ao dia, liberando a equipe para o que dá lucro.\n\nO próximo passo é ver o sistema funcionando. Posso liberar um horário para a demonstração?`,
  objection_pequena:     `Exatamente por ser uma operação enxuta, quem lê os currículos costuma ser o dono ou um gestor-chave. O seu tempo é o ativo mais caro da empresa.\n\nSe você abre uma vaga e recebe 150 currículos, a rotina paralisa. A Elevva analisa todos em segundos e entrega o ranking pronto.\n\nQuer ver isso ao vivo? Posso liberar um horário para a demonstração.`,
  objection_ia:          `Você não precisa confiar cegamente. A Elevva é 100% transparente.\n\nAo lado de cada relatório gerado pela IA, existe o botão "Abrir PDF". O sistema faz a triagem para você ganhar tempo, mas o currículo original está a um clique de distância. A IA trabalha, o humano decide.\n\nQuer ver como funciona na prática? Posso liberar um horário para a demonstração.`,
  objection_concorrente: `Quando você clica em "Aprovar" na ferramenta atual, o que acontece depois? Quem da sua equipe chama o candidato no WhatsApp, cobra foto de CNH, confere comprovante de residência e monta o dossiê para a contabilidade?\n\nA Elevva automatiza esse processo completo — da triagem até o dossiê final. Quer ver a diferença na prática?`,
  qual_nome:             `Para eu te atender melhor, como posso te chamar?`,
  qual_empresa:          `Prazer, *{name}*! E qual o nome da sua empresa? Atuam em qual segmento?`,
  qual_cargo:            `Boa! E qual a sua função lá na *{company}*?`,
  qual_tamanho:          `Entendi, {name}. E mais ou menos quantos funcionários vocês têm hoje?`,
  qual_dor:              `E no dia a dia, qual a maior dificuldade de vocês com recrutamento? Triagem demorada, agendamento manual, volume grande de currículos...?`,
};

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

// ── Cores do funil ────────────────────────────────────────────────────────────
const FUNNEL_COLORS = ['#6366f1','#8b5cf6','#a855f7','#d946ef','#84cc16','#22c55e'];
const PIE_COLORS: Record<string, string> = {
  NOVO: '#6366f1',
  QUALIFICANDO: '#f59e0b',
  QUALIFICADO: '#8b5cf6',
  DEMO_OFERECIDA: '#3b82f6',
  DEMO_AGENDADA: '#84cc16',
  CONVERTIDO: '#22c55e',
  PERDIDO: '#ef4444',
};

export const SdrDashboard: React.FC = () => {
  const [currentView, setCurrentView] = useState<SdrView>('OVERVIEW');
  const [loading, setLoading] = useState(true);

  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [leads, setLeads] = useState<SdrLead[]>([]);
  const [slots, setSlots] = useState<SdrDemoSlot[]>([]);
  const [messages, setMessages] = useState<SdrMessage[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedLead, setSelectedLead] = useState<SdrLead | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [newSlotDate, setNewSlotDate] = useState('');
  const [newSlotTime, setNewSlotTime] = useState('');
  const [slotCreating, setSlotCreating] = useState(false);

  // ─────── Prompt SDR ──────────────────────────────────────────────────────────
  const [sdrFields, setSdrFields] = useState<Record<string, string>>(SDR_DEFAULTS);
  const [draftFields, setDraftFields] = useState<Record<string, string>>(SDR_DEFAULTS);
  const [sdrCustom, setSdrCustom] = useState<SdrCustomSection[]>([]);
  const [draftCustom, setDraftCustom] = useState<SdrCustomSection[]>([]);
  const [sdrDeletedKeys, setSdrDeletedKeys] = useState<string[]>([]);
  const [draftDeletedKeys, setDraftDeletedKeys] = useState<string[]>([]);
  const [sdrPromptUpdatedAt, setSdrPromptUpdatedAt] = useState<string | null>(null);
  const [isEditingSdrPrompt, setIsEditingSdrPrompt] = useState(false);
  const [sdrPromptLoading, setSdrPromptLoading] = useState(false);
  const [sdrPromptSaving, setSdrPromptSaving] = useState(false);

  // ─────── Gerador de Leads ────────────────────────────────────────────────────
  const [gNicho, setGNicho] = useState('');
  const [gRegiao, setGRegiao] = useState('');
  const [gQtd, setGQtd] = useState(20);
  const [gLeads, setGLeads] = useState<GeneratedLead[]>([] as GeneratedLead[]);
  const [gLoading, setGLoading] = useState(false);
  const [gError, setGError] = useState<string | null>(null);
  const [gStatus, setGStatus] = useState<string>('');

  // ─────── Data Fetching ───────────────────────────────────────────────────────

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

  const fetchSdrPrompt = useCallback(async () => {
    setSdrPromptLoading(true);
    try {
      const res = await fetch('/api/system-prompt/sdr');
      const data = await res.json() as { prompt?: string; updated_at?: string };
      const fields = { ...SDR_DEFAULTS };
      let custom: SdrCustomSection[] = [];
      let deleted: string[] = [];
      if (data.prompt) {
        try {
          const parsed = JSON.parse(data.prompt) as Record<string, unknown>;
          for (const key of Object.keys(SDR_DEFAULTS)) {
            if (typeof parsed[key] === 'string') fields[key] = parsed[key] as string;
          }
          if (Array.isArray(parsed.custom)) custom = parsed.custom as SdrCustomSection[];
          if (Array.isArray(parsed._deleted)) deleted = parsed._deleted as string[];
        } catch { /* JSON inválido — mantém defaults */ }
      }
      setSdrFields(fields);
      setDraftFields(fields);
      setSdrCustom(custom);
      setDraftCustom(custom);
      setSdrDeletedKeys(deleted);
      setDraftDeletedKeys(deleted);
      setSdrPromptUpdatedAt(data.updated_at || null);
    } catch (err) {
      console.error('Erro ao buscar prompt SDR:', err);
    } finally {
      setSdrPromptLoading(false);
    }
  }, []);

  const saveSdrPrompt = async () => {
    setSdrPromptSaving(true);
    try {
      const payload = JSON.stringify({ ...draftFields, custom: draftCustom, _deleted: draftDeletedKeys });
      const res = await fetch('/api/system-prompt/sdr', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: payload }),
      });
      if (!res.ok) throw new Error('Erro ao salvar');
      setSdrFields(draftFields);
      setSdrCustom(draftCustom);
      setSdrDeletedKeys(draftDeletedKeys);
      setSdrPromptUpdatedAt(new Date().toISOString());
      setIsEditingSdrPrompt(false);
    } catch (err) {
      alert('Erro ao salvar: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSdrPromptSaving(false);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchFunnel(), fetchLeads(), fetchSlots()]);
      setLoading(false);
    };
    loadAll();
  }, [fetchFunnel, fetchLeads, fetchSlots]);

  useEffect(() => {
    const channel = supabase
      .channel('sdr-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sdr_leads' }, () => {
        fetchLeads(); fetchFunnel();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sdr_conversations' }, () => {
        fetchFunnel();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLeads, fetchFunnel]);

  // ─────── Slot CRUD ────────────────────────────────────────────────────────────

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

  // ─────── Helpers ─────────────────────────────────────────────────────────────

  const statusColor = (status: string) => {
    const colors: Record<string, string> = {
      NOVO: 'bg-indigo-500/15 text-indigo-300',
      QUALIFICANDO: 'bg-amber-500/15 text-amber-300',
      QUALIFICADO: 'bg-purple-500/15 text-purple-300',
      DEMO_OFERECIDA: 'bg-blue-500/15 text-blue-300',
      DEMO_AGENDADA: 'bg-lime-500/15 text-lime-300',
      CONVERTIDO: 'bg-green-500/15 text-green-300',
      PERDIDO: 'bg-red-500/15 text-red-300',
    };
    return colors[status] || 'bg-slate-500/15 text-slate-400';
  };

  const avatarColor = (name: string) => {
    const code = (name || '?').charCodeAt(0) % 6;
    const colors = [
      'bg-violet-500/20 text-violet-300',
      'bg-blue-500/20 text-blue-300',
      'bg-cyan-500/20 text-cyan-300',
      'bg-amber-500/20 text-amber-300',
      'bg-rose-500/20 text-rose-300',
      'bg-lime-500/20 text-lime-300',
    ];
    return colors[code];
  };

  const statusDot = (status: string) => {
    const dots: Record<string, string> = {
      NOVO: 'bg-indigo-400', QUALIFICANDO: 'bg-amber-400', QUALIFICADO: 'bg-purple-400',
      DEMO_OFERECIDA: 'bg-blue-400', DEMO_AGENDADA: 'bg-lime-400', CONVERTIDO: 'bg-green-400', PERDIDO: 'bg-red-400',
    };
    return dots[status] || 'bg-slate-400';
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

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

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

  const slotsByDate: Record<string, SdrDemoSlot[]> = {};
  for (const slot of slots) {
    if (!slotsByDate[slot.slot_date]) slotsByDate[slot.slot_date] = [];
    slotsByDate[slot.slot_date].push(slot);
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  // ─────── Chart Data (derivado de leads) ─────────────────────────────────────

  const leadsPerDay = useMemo(() => {
    const days: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days[d.toISOString().split('T')[0]] = 0;
    }
    leads.forEach(l => {
      const day = (l.created_at || '').split('T')[0];
      if (days[day] !== undefined) days[day]++;
    });
    return Object.entries(days).map(([date, count]) => ({
      dia: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      leads: count,
    }));
  }, [leads]);

  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(l => { counts[l.status] = (counts[l.status] || 0) + 1; });
    return Object.entries(counts)
      .map(([status, value]) => ({ name: statusLabel(status), value, status }))
      .sort((a, b) => b.value - a.value);
  }, [leads]);

  const upcomingDemos = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return slots
      .filter(s => s.is_booked && s.slot_date >= today)
      .sort((a, b) => (a.slot_date + a.slot_time).localeCompare(b.slot_date + b.slot_time))
      .slice(0, 6);
  }, [slots]);

  const funnelStages = useMemo(() => {
    if (!funnel) return [];
    const stages = [
      { label: 'Novos', value: funnel.novos, color: '#6366f1' },
      { label: 'Qualificando', value: funnel.qualificando, color: '#8b5cf6' },
      { label: 'Qualificados', value: funnel.qualificados, color: '#a855f7' },
      { label: 'Demo Oferecida', value: funnel.demos, color: '#d946ef' },
      { label: 'Demo Agendada', value: funnel.demos_agendadas, color: '#84cc16' },
      { label: 'Convertidos', value: funnel.convertidos, color: '#22c55e' },
    ];
    const max = stages[0]?.value || 1;
    return stages.map((s, i) => ({
      ...s,
      pct: Math.round((s.value / max) * 100),
      dropPct: i > 0 && stages[i - 1].value > 0
        ? Math.round(((stages[i - 1].value - s.value) / stages[i - 1].value) * 100)
        : 0,
    }));
  }, [funnel]);

  const todayLeads = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return leads.filter(l => (l.created_at || '').startsWith(today)).length;
  }, [leads]);

  const weekLeads = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return leads.filter(l => new Date(l.created_at) >= cutoff).length;
  }, [leads]);

  // ─────── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-lime-500 flex items-center justify-center shadow-2xl shadow-lime-500/30">
              <Zap className="w-10 h-10 text-slate-950" />
            </div>
            <div className="absolute inset-0 rounded-3xl border-2 border-lime-400/50 animate-ping" />
          </div>
          <div className="text-center">
            <p className="text-white font-black text-xl tracking-tight">Elevva</p>
            <p className="text-slate-500 text-sm mt-1">Carregando dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // ─────── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-slate-950 flex overflow-hidden font-sans">

      {/* ══ SIDEBAR ══════════════════════════════════════════════════════════════ */}
      <aside className="w-16 lg:w-60 bg-[#0d1117] border-r border-slate-800/50 flex flex-col shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-slate-800/50 gap-3">
          <div className="w-8 h-8 bg-lime-500 rounded-xl flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-slate-950" />
          </div>
          <div className="hidden lg:block">
            <p className="text-white font-black text-sm leading-none">Elevva</p>
            <p className="text-xs font-bold mt-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-lime-500 inline-block animate-pulse" />
              <span className="text-lime-500">SDR Panel</span>
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-0.5">
          {([
            { key: 'OVERVIEW', icon: LayoutDashboard, label: 'Dashboard' },
            { key: 'LEADS', icon: Users, label: 'Leads' },
            { key: 'SLOTS', icon: Calendar, label: 'Agenda' },
            { key: 'CONVERSATIONS', icon: MessageSquare, label: 'Conversas' },
            { key: 'PROMPTS', icon: Bot, label: 'Prompt System' },
            { key: 'GERADOR_LEADS', icon: Zap, label: 'Gerador de Leads' },
          ] as const).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => { setCurrentView(key); if (key === 'PROMPTS') fetchSdrPrompt(); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all
                ${currentView === key
                  ? 'border-l-2 border-lime-500 bg-lime-500/[0.08] text-lime-400 rounded-l-none'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]'}`}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              <span className="hidden lg:block">{label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-slate-800/50">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-red-500/10 hover:text-red-400 transition-all"
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            <span className="hidden lg:block">Sair</span>
          </button>
        </div>
      </aside>

      {/* ══ MAIN ═════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 overflow-y-auto bg-slate-950" style={{ background: 'radial-gradient(ellipse at 60% 0%, rgba(132,204,22,0.04) 0%, transparent 60%), #020617' }}>
        <div className="max-w-7xl mx-auto p-6">

          {/* ══════ OVERVIEW ══════════════════════════════════════════════════════ */}
          {currentView === 'OVERVIEW' && funnel && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-white">Dashboard SDR</h1>
                  <p className="text-slate-500 text-sm mt-0.5">
                    {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                </div>
                <button
                  onClick={() => { fetchFunnel(); fetchLeads(); fetchSlots(); }}
                  className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
                >
                  <RefreshCcw className="w-4 h-4" />
                </button>
              </div>

              {/* ── KPI Row ──────────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Total Leads */}
                <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 border-t-2 border-t-indigo-500 shadow-lg shadow-indigo-900/20">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                      <Users className="w-4 h-4 text-indigo-400" />
                    </div>
                    <span className="text-indigo-300 text-xs font-semibold bg-indigo-500/10 px-2 py-0.5 rounded-full">
                      +{todayLeads} hoje
                    </span>
                  </div>
                  <p className="text-5xl font-mono font-bold text-white tabular-nums">{funnel.total}</p>
                  <p className="text-slate-500 text-xs font-semibold mt-1">Total de Leads</p>
                </div>

                {/* Demos Agendadas */}
                <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 border-t-2 border-t-lime-500 shadow-lg shadow-lime-900/20">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 bg-lime-500/20 rounded-xl flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-lime-400" />
                    </div>
                    <span className="text-lime-300 text-xs font-semibold bg-lime-500/10 px-2 py-0.5 rounded-full">
                      {upcomingDemos.length} próximas
                    </span>
                  </div>
                  <p className="text-5xl font-mono font-bold text-white tabular-nums">{funnel.demos_agendadas}</p>
                  <p className="text-slate-500 text-xs font-semibold mt-1">Demos Agendadas</p>
                </div>

                {/* Convertidos */}
                <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 border-t-2 border-t-emerald-500 shadow-lg shadow-emerald-900/20">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 bg-green-500/20 rounded-xl flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="flex items-center gap-1 text-green-400 text-xs font-semibold">
                      <TrendingUp className="w-3 h-3" />
                      {funnel.taxa_agendamento_pct || 0}%
                    </div>
                  </div>
                  <p className="text-5xl font-mono font-bold text-white tabular-nums">{funnel.convertidos}</p>
                  <p className="text-slate-500 text-xs font-semibold mt-1">Convertidos</p>
                </div>

                {/* Perdidos */}
                <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 border-t-2 border-t-red-500 shadow-lg shadow-red-900/20">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 bg-red-500/20 rounded-xl flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    </div>
                    <span className="text-slate-500 text-xs font-semibold">esta semana: {weekLeads}</span>
                  </div>
                  <p className="text-5xl font-mono font-bold text-white tabular-nums">{funnel.perdidos}</p>
                  <p className="text-slate-500 text-xs font-semibold mt-1">Perdidos</p>
                </div>
              </div>

              {/* ── Charts Row ───────────────────────────────────────────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

                {/* Leads por dia (últimos 14 dias) */}
                <div className="lg:col-span-2 bg-slate-900 rounded-2xl p-5 border border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-white font-bold text-sm">Leads por dia</p>
                      <p className="text-slate-500 text-xs">Últimos 14 dias</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-lime-500"></div>
                      <span className="text-slate-400 text-xs">Novos leads</span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={leadsPerDay} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradLead" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#84cc16" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#84cc16" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="dia" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, color: '#fff', fontSize: 12 }}
                        labelStyle={{ color: '#94a3b8' }}
                        cursor={{ stroke: '#475569', strokeWidth: 1 }}
                      />
                      <Area type="monotone" dataKey="leads" stroke="#84cc16" strokeWidth={2} fill="url(#gradLead)" dot={{ fill: '#84cc16', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: '#84cc16' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Distribuição de Status */}
                <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
                  <p className="text-white font-bold text-sm mb-1">Distribuição</p>
                  <p className="text-slate-500 text-xs mb-4">Status atual dos leads</p>
                  {statusDistribution.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={140}>
                        <PieChart>
                          <Pie
                            data={statusDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={65}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {statusDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.status] || '#64748b'} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, color: '#fff', fontSize: 12 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 mt-2">
                        {statusDistribution.slice(0, 4).map(s => (
                          <div key={s.status} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[s.status] || '#64748b' }} />
                              <span className="text-slate-400 text-xs">{s.name}</span>
                            </div>
                            <span className="text-white text-xs font-bold">{s.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-40 text-slate-600 text-sm">
                      Sem dados ainda
                    </div>
                  )}
                </div>
              </div>

              {/* ── Funil de Conversão ───────────────────────────────────────── */}
              <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 mb-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-white font-bold text-sm">Funil de Conversão</p>
                    <p className="text-slate-500 text-xs">Taxa de avanço entre etapas</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                    <Target className="w-3.5 h-3.5 text-lime-400" />
                    <span className="text-lime-400 text-xs font-bold">
                      {funnel.taxa_agendamento_pct || 0}% taxa de agendamento
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  {funnelStages.map((stage, i) => (
                    <div key={stage.label} className="flex items-center gap-4">
                      <div className="w-28 shrink-0">
                        <p className="text-slate-400 text-xs font-semibold truncate">{stage.label}</p>
                      </div>
                      <div className="flex-1 relative">
                        <div className="h-8 bg-slate-700 rounded-lg overflow-hidden">
                          <div
                            className="h-full rounded-lg flex items-center px-3 transition-all duration-700"
                            style={{ width: `${Math.max(stage.pct, 4)}%`, background: `linear-gradient(90deg, ${stage.color}, ${stage.color}cc)` }}
                          >
                            <span className="text-white text-xs font-black">{stage.value}</span>
                          </div>
                        </div>
                      </div>
                      <div className="w-20 shrink-0 text-right">
                        {i > 0 && stage.dropPct > 0 ? (
                          <span className="text-red-400 text-xs font-semibold flex items-center justify-end gap-0.5">
                            <TrendingDown className="w-3 h-3" />
                            -{stage.dropPct}%
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Bottom Row: Próximas Demos + Leads Recentes ──────────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Próximas Demos */}
                <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-lime-400" />
                    <p className="text-white font-bold text-sm">Próximas Demos</p>
                    <span className="ml-auto text-xs font-bold text-lime-500 bg-lime-500/10 px-2 py-0.5 rounded-full">
                      {upcomingDemos.length} agendadas
                    </span>
                  </div>
                  <div className="divide-y divide-slate-800/50">
                    {upcomingDemos.length === 0 ? (
                      <div className="p-6 text-center">
                        <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-700" />
                        <p className="text-slate-500 text-sm">Nenhuma demo agendada</p>
                      </div>
                    ) : upcomingDemos.map(slot => {
                      const lead = leads.find(l => l.id === slot.booked_by);
                      return (
                        <div key={slot.id} className="px-5 py-3 flex items-center gap-3">
                          <div className="w-10 h-10 bg-lime-500/10 border border-lime-500/20 rounded-xl flex flex-col items-center justify-center shrink-0">
                            <span className="text-lime-400 text-[10px] font-bold leading-none">
                              {new Date(slot.slot_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                            </span>
                            <span className="text-lime-300 text-xs font-black">{formatTime(slot.slot_time)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-semibold truncate">
                              {lead?.name || 'Lead'}
                            </p>
                            <p className="text-slate-500 text-xs truncate">
                              {lead?.company || lead?.phone || '—'}
                            </p>
                          </div>
                          {slot.meeting_link && (
                            <a
                              href={slot.meeting_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 px-2 py-1 rounded-lg shrink-0"
                            >
                              Meet
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Leads Recentes */}
                <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-400" />
                    <p className="text-white font-bold text-sm">Leads Recentes</p>
                    <button
                      onClick={() => setCurrentView('LEADS')}
                      className="ml-auto text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
                    >
                      Ver todos <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="divide-y divide-slate-800/50">
                    {leads.slice(0, 6).map(lead => (
                      <div
                        key={lead.id}
                        className="px-5 py-3 flex items-center gap-3 hover:bg-white/[0.03] cursor-pointer transition-colors"
                        onClick={() => { setSelectedLead(lead); fetchMessages(lead.id); }}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${avatarColor(lead.name || '?')}`}>
                          {(lead.name || '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{lead.name || lead.phone}</p>
                          <p className="text-slate-500 text-xs truncate">{lead.company || lead.phone}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 flex items-center gap-1 ${statusColor(lead.status)}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current inline-block shrink-0" />
                          {statusLabel(lead.status)}
                        </span>
                      </div>
                    ))}
                    {leads.length === 0 && (
                      <div className="p-6 text-center">
                        <Users className="w-8 h-8 mx-auto mb-2 text-slate-700" />
                        <p className="text-slate-500 text-sm">Nenhum lead ainda</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ══════ LEADS VIEW ════════════════════════════════════════════════════ */}
          {currentView === 'LEADS' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-white">Leads</h1>
                  <p className="text-slate-500 text-sm mt-0.5">{filteredLeads.length} leads encontrados</p>
                </div>
              </div>

              <div className="flex gap-3 mb-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Buscar por nome, telefone ou empresa..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-lime-500/30 focus:border-lime-500"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm font-semibold text-slate-300 focus:outline-none focus:ring-2 focus:ring-lime-500/30"
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

              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80">
                      <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lead</th>
                      <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden md:table-cell">Empresa</th>
                      <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden lg:table-cell">Origem</th>
                      <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                      <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden md:table-cell">Data</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredLeads.map(lead => (
                      <tr
                        key={lead.id}
                        className="hover:bg-white/[0.03] cursor-pointer transition-colors group"
                        onClick={() => { setSelectedLead(lead); fetchMessages(lead.id); }}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${avatarColor(lead.name || '?')}`}>
                              {(lead.name || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white">{lead.name || 'Sem nome'}</p>
                              <p className="text-xs text-slate-500">{lead.phone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 hidden md:table-cell">
                          <p className="text-sm text-slate-300">{lead.company || '-'}</p>
                          <p className="text-xs text-slate-500">{lead.role || ''}</p>
                        </td>
                        <td className="px-5 py-3 hidden lg:table-cell">
                          <span className="text-xs font-semibold text-slate-500">{lead.source}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${statusColor(lead.status)}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusDot(lead.status)}`} />
                            {statusLabel(lead.status)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 hidden md:table-cell">
                          <span className="text-xs font-mono text-slate-500">{formatDate(lead.created_at)}</span>
                        </td>
                        <td className="px-3">
                          <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-slate-400 transition-colors" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredLeads.length === 0 && (
                  <div className="p-10 text-center text-slate-600">
                    <Search className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-slate-500">Nenhum lead encontrado</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ══════ SLOTS VIEW ════════════════════════════════════════════════════ */}
          {currentView === 'SLOTS' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-white">Agenda de Demos</h1>
                  <p className="text-slate-500 text-sm mt-0.5">Gerencie os horários disponíveis (8h–20h)</p>
                </div>
              </div>

              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 mb-6">
                <h3 className="text-sm font-bold text-white mb-3">Adicionar Horários</h3>
                <div className="flex gap-3 items-end flex-wrap">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Data</label>
                    <input
                      type="date"
                      value={newSlotDate}
                      onChange={e => setNewSlotDate(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-lime-500/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Horário</label>
                    <input
                      type="time"
                      value={newSlotTime}
                      onChange={e => setNewSlotTime(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-lime-500/30"
                    />
                  </div>
                  <button
                    onClick={createSlot}
                    disabled={!newSlotDate || !newSlotTime || slotCreating}
                    className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {slotCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Adicionar
                  </button>
                  <button
                    onClick={createBulkSlots}
                    disabled={!newSlotDate || slotCreating}
                    className="px-4 py-2 bg-lime-500 text-slate-950 rounded-xl text-sm font-bold hover:bg-lime-400 active:bg-lime-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {slotCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                    Preencher dia inteiro (8h–20h)
                  </button>
                </div>
              </div>

              {Object.keys(slotsByDate).length === 0 ? (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-10 text-center">
                  <Calendar className="w-10 h-10 mx-auto mb-2 text-slate-700" />
                  <p className="font-semibold text-slate-400">Nenhum horário cadastrado</p>
                  <p className="text-sm text-slate-600 mt-1">Selecione uma data acima e clique em "Preencher dia inteiro".</p>
                </div>
              ) : (
                Object.entries(slotsByDate).map(([date, dateSlots]) => (
                  <div key={date} className="bg-slate-900 rounded-2xl border border-slate-800 mb-4 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/60">
                      <p className="text-sm font-bold text-slate-200">{formatDateFull(date)}</p>
                    </div>
                    <div className="p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                      {dateSlots.map(slot => (
                        <div
                          key={slot.id}
                          className={`relative group rounded-xl px-3 py-2 text-center text-sm font-bold transition-all ${
                            slot.is_booked
                              ? 'bg-lime-500/10 border border-lime-500/40 text-lime-300'
                              : 'bg-slate-800 border border-slate-700 text-slate-300 hover:border-lime-500/50 hover:text-white'
                          }`}
                        >
                          <span>{formatTime(slot.slot_time)}</span>
                          {slot.is_booked && <span className="block text-[10px] font-semibold text-lime-400 mt-0.5">Reservado</span>}
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

          {/* ══════ CONVERSATIONS VIEW ════════════════════════════════════════════ */}
          {currentView === 'CONVERSATIONS' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-white">Conversas</h1>
                  <p className="text-slate-500 text-sm mt-0.5">Histórico de todas as interações</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Lead List */}
                <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden lg:col-span-1">
                  <div className="p-3 border-b border-slate-800">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Buscar lead..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-lime-500/30"
                      />
                    </div>
                  </div>
                  <div className="divide-y divide-slate-800/50 max-h-[calc(100vh-220px)] overflow-y-auto">
                    {leads
                      .filter(l => !searchTerm || (l.name || l.phone).toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(lead => (
                        <div
                          key={lead.id}
                          onClick={() => { setSelectedLead(lead); fetchMessages(lead.id); }}
                          className={`px-4 py-3 cursor-pointer transition-colors flex items-center gap-3 ${
                            selectedLead?.id === lead.id
                              ? 'bg-lime-500/[0.08] border-l-2 border-lime-500'
                              : 'hover:bg-white/[0.04]'
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${avatarColor(lead.name || '?')}`}>
                            {(lead.name || '?')[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{lead.name || lead.phone}</p>
                            <p className="text-xs text-slate-500 truncate">{lead.company || lead.phone}</p>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ${statusColor(lead.status)}`}>
                            <span className={`w-1 h-1 rounded-full ${statusDot(lead.status)}`} />
                            {statusLabel(lead.status)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Messages Panel */}
                <div className="bg-slate-900 rounded-2xl border border-slate-800 lg:col-span-2 flex flex-col min-h-[500px]">
                  {selectedLead ? (
                    <>
                      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${avatarColor(selectedLead.name || '?')}`}>
                            {(selectedLead.name || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{selectedLead.name || selectedLead.phone}</p>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Phone className="w-3 h-3" />
                              <span className="font-mono">{selectedLead.phone}</span>
                              {selectedLead.company && (
                                <>
                                  <span className="text-slate-700">·</span>
                                  <Building2 className="w-3 h-3" />
                                  <span>{selectedLead.company}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold ${statusColor(selectedLead.status)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDot(selectedLead.status)}`} />
                          {statusLabel(selectedLead.status)}
                        </span>
                      </div>

                      <div className="flex-1 overflow-y-auto p-5 space-y-3">
                        {messagesLoading ? (
                          <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
                          </div>
                        ) : messages.length === 0 ? (
                          <div className="flex items-center justify-center h-full text-slate-600">
                            <p className="text-sm">Nenhuma mensagem registrada.</p>
                          </div>
                        ) : (
                          messages.map(msg => (
                            <div key={msg.id} className={`flex ${msg.direction === 'OUT' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[75%] px-4 py-2.5 ${
                                msg.direction === 'OUT'
                                  ? 'bg-lime-500 text-slate-950 rounded-2xl rounded-br-sm shadow-md shadow-lime-900/30'
                                  : 'bg-[#0f1e35] text-slate-200 rounded-2xl rounded-bl-sm border border-slate-700/50'
                              }`}>
                                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                <p className={`text-[10px] mt-1 font-mono ${msg.direction === 'OUT' ? 'text-lime-900/70' : 'text-slate-600'}`}>
                                  {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-600">
                      <div className="text-center">
                        <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="font-semibold text-slate-500">Selecione um lead</p>
                        <p className="text-sm text-slate-600">Clique em um lead para ver a conversa.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ══════ PROMPTS VIEW ══════════════════════════════════════════════════ */}
          {currentView === 'PROMPTS' && (
            <div className="max-w-3xl">
              <div className="mb-6">
                <h1 className="text-3xl font-black tracking-tight text-white">Prompt System</h1>
                <p className="text-slate-500 text-sm mt-1">
                  Textos usados pelo Bento nas conversas com leads. Edite cada seção diretamente em texto normal.
                </p>
              </div>

              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-lime-500/10 border border-lime-500/20 rounded-xl flex items-center justify-center">
                      <Bot className="w-5 h-5 text-lime-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Bento — Agente SDR</p>
                      <p className="text-xs text-slate-500">
                        {sdrPromptUpdatedAt
                          ? `Atualizado em ${new Date(sdrPromptUpdatedAt).toLocaleString('pt-BR')}`
                          : 'Nunca editado — usando textos padrão'}
                      </p>
                    </div>
                  </div>
                  {!isEditingSdrPrompt && (
                    <button
                      onClick={() => { setDraftFields({ ...sdrFields }); setDraftCustom([...sdrCustom]); setDraftDeletedKeys([...sdrDeletedKeys]); setIsEditingSdrPrompt(true); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" /> Editar
                    </button>
                  )}
                </div>

                {/* Corpo */}
                <div className="p-6">
                  {sdrPromptLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
                    </div>
                  ) : isEditingSdrPrompt ? (
                    <div className="space-y-8">
                      {SDR_FIXED_SECTIONS.filter(sec => !draftDeletedKeys.includes(sec.key)).map(sec => (
                        <div key={sec.key} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-lime-400 uppercase tracking-wide">{sec.label}</label>
                            <button
                              onClick={() => setDraftDeletedKeys(prev => [...prev, sec.key])}
                              className="text-slate-600 hover:text-red-400 transition-colors text-xs flex items-center gap-1"
                              title="Remover seção"
                            >
                              <X className="w-3.5 h-3.5" /> Remover
                            </button>
                          </div>
                          <p className="text-xs text-slate-500">{sec.description}</p>
                          <textarea
                            value={draftFields[sec.key] ?? ''}
                            onChange={e => setDraftFields(prev => ({ ...prev, [sec.key]: e.target.value }))}
                            rows={sec.rows}
                            className="w-full text-sm bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-lime-500/30 focus:border-lime-500/50 resize-none"
                          />
                        </div>
                      ))}

                      {/* Seções removidas — opção de restaurar */}
                      {draftDeletedKeys.length > 0 && (
                        <div className="rounded-xl border border-dashed border-slate-700 px-4 py-3 space-y-2">
                          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Seções removidas</p>
                          {draftDeletedKeys.map(key => {
                            const sec = SDR_FIXED_SECTIONS.find(s => s.key === key);
                            if (!sec) return null;
                            return (
                              <div key={key} className="flex items-center justify-between">
                                <span className="text-xs text-slate-400">{sec.label}</span>
                                <button
                                  onClick={() => setDraftDeletedKeys(prev => prev.filter(k => k !== key))}
                                  className="text-xs text-lime-400 hover:text-lime-300 transition-colors"
                                >
                                  Restaurar
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Seções personalizadas */}
                      {draftCustom.map((sec, idx) => (
                        <div key={sec.id} className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <input
                              value={sec.label}
                              onChange={e => setDraftCustom(prev => prev.map((s, i) => i === idx ? { ...s, label: e.target.value } : s))}
                              placeholder="Nome da seção"
                              className="flex-1 text-xs font-bold bg-transparent border-b border-slate-600 text-lime-400 uppercase tracking-wide focus:outline-none focus:border-lime-500 pb-0.5"
                            />
                            <button
                              onClick={() => setDraftCustom(prev => prev.filter((_, i) => i !== idx))}
                              className="text-slate-600 hover:text-red-400 transition-colors text-xs"
                            >
                              Remover
                            </button>
                          </div>
                          <textarea
                            value={sec.content}
                            onChange={e => setDraftCustom(prev => prev.map((s, i) => i === idx ? { ...s, content: e.target.value } : s))}
                            rows={4}
                            placeholder="Conteúdo desta seção..."
                            className="w-full text-sm bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-lime-500/30 focus:border-lime-500/50 resize-none"
                          />
                        </div>
                      ))}

                      <button
                        onClick={() => setDraftCustom(prev => [...prev, { id: crypto.randomUUID(), label: 'Nova Seção', content: '' }])}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-slate-600 text-sm text-slate-400 hover:border-lime-500 hover:text-lime-400 transition-colors"
                      >
                        + Nova Seção
                      </button>

                      <div className="flex gap-3 justify-end pt-2 border-t border-slate-800">
                        <button
                          onClick={() => setIsEditingSdrPrompt(false)}
                          className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={saveSdrPrompt}
                          disabled={sdrPromptSaving}
                          className="flex items-center gap-2 px-5 py-2 bg-lime-500 hover:bg-lime-400 active:bg-lime-600 text-slate-950 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                        >
                          {sdrPromptSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Salvar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {SDR_FIXED_SECTIONS.filter(sec => !sdrDeletedKeys.includes(sec.key)).map(sec => (
                        <div key={sec.key} className="border-l-2 border-lime-500/30 pl-4 space-y-1.5 hover:border-lime-500/70 transition-colors">
                          <p className="text-[10px] font-bold text-lime-400 uppercase tracking-widest">{sec.label}</p>
                          <pre className="whitespace-pre-wrap text-sm text-slate-300 bg-[#0a1525] rounded-lg px-4 py-3 leading-relaxed border border-slate-800/60 font-sans">{sdrFields[sec.key]}</pre>
                        </div>
                      ))}
                      {sdrCustom.map(sec => (
                        <div key={sec.id} className="border-l-2 border-violet-500/30 pl-4 space-y-1.5 hover:border-violet-500/70 transition-colors">
                          <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">{sec.label}</p>
                          <pre className="whitespace-pre-wrap text-sm text-slate-300 bg-[#0a1525] rounded-lg px-4 py-3 leading-relaxed border border-slate-800/60 font-sans">{sec.content}</pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══════ GERADOR DE LEADS ══════════════════════════════════════════════ */}
          {currentView === 'GERADOR_LEADS' && (
            <>
              <div className="mb-6">
                <h1 className="text-3xl font-black tracking-tight text-white">Gerador de Leads</h1>
                <p className="text-slate-500 text-sm mt-1">Busca empresas por nicho e região via Google Maps. Os dados ficam disponíveis para exportação.</p>
              </div>

              {/* Formulário */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Nicho</label>
                    <input
                      type="text"
                      placeholder="ex: consultoria de RH, recrutamento..."
                      value={gNicho}
                      onChange={e => setGNicho(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-lime-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Região</label>
                    <input
                      type="text"
                      placeholder="ex: São Paulo, Curitiba, RS..."
                      value={gRegiao}
                      onChange={e => setGRegiao(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-lime-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Quantidade (máx. 100)</label>
                    <input
                      type="number"
                      min={5}
                      max={100}
                      value={gQtd}
                      onChange={e => setGQtd(Math.min(100, Math.max(1, Number(e.target.value))))}
                      className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-lime-500 transition-colors"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    disabled={gLoading || !gNicho.trim() || !gRegiao.trim()}
                    onClick={async () => {
                      setGLoading(true);
                      setGError(null);
                      setGLeads([]);
                      setGStatus('Iniciando busca...');
                      try {
                        // Passo 1: inicia o run
                        const startRes = await fetch('/api/sdr/leads/generate', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ nicho: gNicho.trim(), regiao: gRegiao.trim(), quantidade: gQtd }),
                        });
                        const startData = await startRes.json();
                        if (!startRes.ok || !startData.runId) {
                          setGError(startData.error || 'Erro ao iniciar busca');
                          return;
                        }
                        // Passo 2: polling a cada 5s até SUCCEEDED (máx 2min)
                        const runId = startData.runId;
                        setGStatus('Buscando empresas no Google Maps...');
                        let attempts = 0;
                        const maxAttempts = 24; // 24 × 5s = 2min
                        while (attempts < maxAttempts) {
                          await new Promise(r => setTimeout(r, 5000));
                          attempts++;
                          const pollRes = await fetch(`/api/sdr/leads/result/${runId}`);
                          const pollData = await pollRes.json();
                          if (!pollRes.ok) { setGError(pollData.error || 'Erro ao buscar resultado'); return; }
                          if (pollData.status === 'SUCCEEDED') {
                            setGLeads(pollData.leads || []);
                            setGStatus('');
                            return;
                          }
                          if (pollData.status !== 'RUNNING' && pollData.status !== 'READY') {
                            setGError(`Busca falhou com status: ${pollData.status}`);
                            return;
                          }
                          setGStatus(`Buscando... (${attempts * 5}s)`);
                        }
                        setGError('Tempo limite excedido. Tente novamente com menos resultados.');
                      } catch (err: any) {
                        setGError('Falha na comunicação com o servidor.');
                      } finally {
                        setGLoading(false);
                        setGStatus('');
                      }
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 bg-lime-500 hover:bg-lime-400 active:bg-lime-600 text-slate-950 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {gLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {gLoading ? (gStatus || 'Buscando...') : 'Gerar Leads'}
                  </button>
                  {gLeads.length > 0 && (
                    <button
                      onClick={() => {
                        const rows = gLeads.map((l, i) => `
                          <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#ffffff'}">
                            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#111">${l.nome || '—'}</td>
                            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#555">${l.categoria || '—'}</td>
                            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-family:monospace;color:#111">${l.telefone || '—'}</td>
                            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#555">${l.email || '—'}</td>
                            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#2563eb">${l.site ? `<a href="${l.site}">${l.site}</a>` : '—'}</td>
                            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:center;color:#111">${l.rating ?? '—'}</td>
                            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#555">${l.endereco || '—'}</td>
                          </tr>`).join('');
                        const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
                          <title>Leads — ${gNicho} · ${gRegiao}</title>
                          <style>
                            body { font-family: Arial, sans-serif; margin: 32px; color: #111; }
                            h1 { font-size: 22px; margin-bottom: 4px; }
                            p { color: #666; font-size: 13px; margin-bottom: 24px; }
                            table { width: 100%; border-collapse: collapse; font-size: 13px; }
                            th { background: #1e293b; color: #fff; padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
                            @media print { @page { margin: 20mm; } }
                          </style>
                        </head><body>
                          <h1>Leads — ${gNicho}</h1>
                          <p>${gLeads.length} empresas encontradas · Região: ${gRegiao} · Elevva SDR</p>
                          <table>
                            <thead><tr>
                              <th>Empresa</th><th>Categoria</th><th>Telefone</th>
                              <th>Email</th><th>Site</th><th>Rating</th><th>Endereço</th>
                            </tr></thead>
                            <tbody>${rows}</tbody>
                          </table>
                        </body></html>`;
                        const w = window.open('', '_blank');
                        if (w) { w.document.write(html); w.document.close(); w.print(); }
                      }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Exportar PDF
                    </button>
                  )}
                </div>
                {gLoading && gStatus && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-lime-400 bg-lime-500/10 border border-lime-500/20 rounded-xl px-4 py-3">
                    <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                    {gStatus}
                  </div>
                )}
                {gError && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {gError}
                  </div>
                )}
              </div>

              {/* Resultados */}
              {gLeads.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{gLeads.length} leads encontrados</span>
                    <span className="text-xs text-slate-500">{gNicho} · {gRegiao}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/80 text-xs text-slate-500 uppercase tracking-wide">
                          <th className="px-4 py-3 text-left">Empresa</th>
                          <th className="px-4 py-3 text-left">Categoria</th>
                          <th className="px-4 py-3 text-left">Telefone</th>
                          <th className="px-4 py-3 text-left">Email</th>
                          <th className="px-4 py-3 text-left">Site</th>
                          <th className="px-4 py-3 text-left">Rating</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gLeads.map((lead, i) => (
                          <tr key={i} className="border-b border-slate-800/50 hover:bg-white/[0.03] transition-colors">
                            <td className="px-4 py-3 font-semibold text-white max-w-[200px] truncate">{lead.nome || '—'}</td>
                            <td className="px-4 py-3 text-slate-400 max-w-[160px] truncate">{lead.categoria || '—'}</td>
                            <td className="px-4 py-3 text-slate-300">{lead.telefone || '—'}</td>
                            <td className="px-4 py-3 text-slate-300">{lead.email || '—'}</td>
                            <td className="px-4 py-3">
                              {lead.site
                                ? <a href={lead.site} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-lime-400 hover:text-lime-300 transition-colors"><Globe className="w-3 h-3" /><span className="truncate max-w-[120px]">{lead.site.replace(/^https?:\/\//, '')}</span></a>
                                : <span className="text-slate-600">—</span>
                              }
                            </td>
                            <td className="px-4 py-3 text-slate-300">{lead.rating != null ? `${lead.rating} ★` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {gLoading && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <Loader2 className="w-10 h-10 mb-4 animate-spin text-lime-500" />
                  <p className="font-semibold">Buscando leads...</p>
                  <p className="text-sm mt-1 text-slate-600">Isso pode levar até 2 minutos...</p>
                </div>
              )}

              {!gLoading && gLeads.length === 0 && !gError && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                  <Zap className="w-12 h-12 mb-3 opacity-20" />
                  <p className="font-semibold text-slate-500">Nenhuma busca realizada</p>
                  <p className="text-sm mt-1">Preencha o nicho e a região e clique em Gerar Leads.</p>
                </div>
              )}
            </>
          )}

        </div>
      </main>

      {/* ══ LEAD DETAIL MODAL ════════════════════════════════════════════════════ */}
      {selectedLead && currentView !== 'CONVERSATIONS' && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedLead(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/50"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-800 flex items-center justify-between" style={{ borderTop: `3px solid ${PIE_COLORS[selectedLead.status] || '#64748b'}` }}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${avatarColor(selectedLead.name || '?')}`}>
                  {(selectedLead.name || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{selectedLead.name || 'Sem nome'}</p>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold ${statusColor(selectedLead.status)}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDot(selectedLead.status)}`} />{statusLabel(selectedLead.status)}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedLead(null)} className="p-2 hover:bg-slate-700 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Telefone', value: selectedLead.phone, mono: true },
                  { label: 'Empresa', value: selectedLead.company || '—', mono: false },
                  { label: 'Cargo', value: selectedLead.role || '—', mono: false },
                  { label: 'Tamanho', value: selectedLead.company_size || '—', mono: false },
                  { label: 'Origem', value: selectedLead.source, mono: false },
                  { label: 'Desde', value: formatDate(selectedLead.created_at), mono: true },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="bg-slate-900/70 rounded-lg px-3 py-2.5 border border-slate-800/60">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">{label}</p>
                    <p className={`text-sm font-semibold text-white truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
                  </div>
                ))}
              </div>

              {selectedLead.main_pain && (
                <div className="border-l-2 border-lime-500/40 pl-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-lime-400/70 mb-1.5">Principal Dor</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{selectedLead.main_pain}</p>
                </div>
              )}

              {selectedLead.lost_reason && (
                <div className="border-l-2 border-red-500/40 pl-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-red-400/70 mb-1.5">Motivo da Perda</p>
                  <p className="text-sm text-red-300 leading-relaxed">{selectedLead.lost_reason}</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <a
                  href={`https://wa.me/55${selectedLead.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#25d366] text-slate-950 rounded-xl text-sm font-bold hover:brightness-110 transition-all shadow-lg shadow-[#25d366]/20"
                >
                  <Send className="w-4 h-4" />
                  WhatsApp
                </a>
                <button
                  onClick={() => { setCurrentView('CONVERSATIONS'); fetchMessages(selectedLead.id); }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-700/60 text-slate-300 rounded-xl text-sm font-bold hover:border-slate-600 hover:text-white transition-all"
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
