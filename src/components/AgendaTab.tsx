import React, { type ReactNode, useEffect, useState, useMemo, useRef } from 'react';
import { Search, Plus, X, ChevronLeft, ChevronRight, Calendar, List, User, Briefcase, Phone, Trash2, ChevronDown, Lock, AlertTriangle, Video, MapPin } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────
export interface AgendaInterview {
  id: string;
  candidate_name?: string;
  candidate_phone?: string;
  job_title?: string;
  scheduled_date?: string; // 'YYYY-MM-DD'
  scheduled_time?: string; // 'HH:MM'
  status: string;
  format?: string; // 'ONLINE' | 'PRESENCIAL'
  meeting_link?: string;
  interviewer_name?: string;
}

interface BlockForm {
  date: string;
  date_end: string;
  interviewer_name: string;
}

interface Props {
  interviews: AgendaInterview[];
  userId?: string;
  onOpenAvailableSlots: () => void;
  onRefresh?: () => void;
}

// ── Calendar constants (idênticos ao app de atendimento) ────────
const HOUR_HEIGHT = 64;
const DEFAULT_START = 8;
const END_HOUR = 20;
const TIME_COL_W = 60;
const DAY_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const STATUS_PALETTES: Record<string, { bg: string; bar: string; text: string; sub: string }> = {
  AGUARDANDO_RESPOSTA:       { bg: 'bg-amber-50',   bar: 'bg-amber-400',   text: 'text-amber-900',   sub: 'text-amber-600'   },
  AGENDADA:                  { bg: 'bg-blue-50',    bar: 'bg-blue-400',    text: 'text-blue-900',    sub: 'text-blue-600'    },
  CONFIRMADA:                { bg: 'bg-emerald-50', bar: 'bg-emerald-500', text: 'text-emerald-900', sub: 'text-emerald-600' },
  REALIZADA:                 { bg: 'bg-slate-100',  bar: 'bg-slate-400',   text: 'text-slate-700',   sub: 'text-slate-500'   },
  CANCELADA:                 { bg: 'bg-red-50',     bar: 'bg-red-400',     text: 'text-red-900',     sub: 'text-red-600'     },
  REMARCADA:                 { bg: 'bg-purple-50',  bar: 'bg-purple-400',  text: 'text-purple-900',  sub: 'text-purple-600'  },
  AGUARDANDO_NOVOS_HORARIOS: { bg: 'bg-orange-50',  bar: 'bg-orange-400',  text: 'text-orange-900',  sub: 'text-orange-600'  },
};
const STATUS_LABEL: Record<string, string> = {
  AGUARDANDO_RESPOSTA: 'Aguardando resposta',
  AGENDADA: 'Agendada',
  CONFIRMADA: 'Confirmada',
  REALIZADA: 'Realizada',
  CANCELADA: 'Cancelada',
  REMARCADA: 'Remarcada',
  AGUARDANDO_NOVOS_HORARIOS: 'Aguard. novos horários',
};
function apptPalette(status: string) { return STATUS_PALETTES[status] ?? STATUS_PALETTES.AGENDADA; }
function statusLabel(status: string) { return STATUS_LABEL[status] ?? status; }

function apptTop(date: string | undefined, time: string | undefined, startHour: number): number | null {
  if (!date || !time) return null;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || h < startHour || h >= END_HOUR) return null;
  return ((h - startHour) * 60 + m) / 60 * HOUR_HEIGHT;
}

function dayKeyFromDate(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function weekStart(d: Date) { const r = new Date(d); r.setDate(r.getDate() - r.getDay()); r.setHours(0, 0, 0, 0); return r; }

function useNowLine(startHour: number) {
  const [pct, setPct] = useState<number | null>(null);
  useEffect(() => {
    function calc() {
      const now = new Date();
      const h = now.getHours(), m = now.getMinutes();
      if (h < startHour || h >= END_HOUR) { setPct(null); return; }
      setPct(((h - startHour) * 60 + m) / 60 * HOUR_HEIGHT);
    }
    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, [startHour]);
  return pct;
}

function fmtBlockDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
}
function fmtDatePt(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('pt-BR');
}

// ── RangeCalendar (idêntico ao app de atendimento) ───────────────
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function RangeCalendar({ start, end, onChange }: { start: string; end: string; onChange: (s: string, e: string) => void }) {
  const todayStr = dayKeyFromDate(new Date());
  const initDate = start ? new Date(start + 'T12:00:00') : new Date();
  const [year, setYear] = useState(initDate.getFullYear());
  const [month, setMonth] = useState(initDate.getMonth());
  const [phase, setPhase] = useState<'start' | 'end'>(start ? 'end' : 'start');
  const [hover, setHover] = useState('');

  function toStr(y: number, m: number, d: number) { return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); }

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  function handleClick(day: number) {
    const ds = toStr(year, month, day);
    if (phase === 'start') { onChange(ds, ''); setPhase('end'); }
    else {
      if (ds < start) { onChange(ds, ''); setPhase('end'); }
      else { onChange(start, ds); setPhase('start'); }
    }
  }

  function effEnd() {
    if (end) return end;
    if (phase === 'end' && hover && start && hover >= start) return hover;
    return '';
  }

  const ee = effEnd();
  const hasRange = !!start && !!ee && start !== ee;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden select-none">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
        <button type="button" onClick={prevMonth} className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-[12px] font-bold text-slate-700">{MONTH_NAMES[month]} {year}</span>
        <button type="button" onClick={nextMonth} className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-7 px-1 pt-1">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[9px] font-bold text-slate-400 py-0.5">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 px-1 pb-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="h-8" />;
          const ds = toStr(year, month, day);
          const isStart = !!start && ds === start;
          const isEnd = !!ee && ds === ee;
          const inRange = !!start && !!ee && ds > start && ds < ee;
          return (
            <div key={i} className="relative h-8 flex items-center justify-center">
              {hasRange && (isStart || isEnd || inRange) && (
                <div className="absolute inset-y-[2px] bg-emerald-100 pointer-events-none" style={{ left: isStart ? '50%' : 0, right: isEnd ? '50%' : 0 }} />
              )}
              <button
                type="button"
                onClick={() => handleClick(day)}
                onMouseEnter={() => { if (phase === 'end') setHover(ds); }}
                onMouseLeave={() => setHover('')}
                className={[
                  'relative z-10 w-7 h-7 flex items-center justify-center text-[11px] font-medium rounded-full transition-colors',
                  isStart || isEnd ? 'bg-emerald-600 text-white font-bold shadow-sm'
                    : inRange ? 'text-emerald-700 hover:bg-emerald-100'
                    : ds === todayStr ? 'text-emerald-600 font-bold ring-1 ring-emerald-300 hover:bg-emerald-50'
                    : 'text-slate-600 hover:bg-slate-100',
                ].join(' ')}
              >
                {day}
              </button>
            </div>
          );
        })}
      </div>

      <div className="px-3 py-2 text-[10px] text-center border-t border-slate-100 text-slate-400">
        {!start ? 'Clique para selecionar o início'
          : phase === 'end' ? 'Selecione o dia final do período'
          : (end && end !== start) ? `${fmtBlockDate(start)} → ${fmtBlockDate(end)}`
          : fmtBlockDate(start)}
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────
// Clone fiel da Agenda do app de atendimento (mesmo layout, tamanhos,
// fontes e botões) adaptado ao modelo de entrevistas de recrutamento.
// Diferença pedida: os cards/modais têm espaço pro link da sala do
// Google Meet, já que o agente cria a sala automaticamente.
export const AgendaTab: React.FC<Props> = ({ interviews, userId, onOpenAvailableSlots, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [startDate, setStartDate] = useState<Date>(() => weekStart(new Date()));

  const [detailInterview, setDetailInterview] = useState<AgendaInterview | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Block modal ("Bloquear Agenda" → remove horários disponíveis no período)
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockForm, setBlockForm] = useState<BlockForm>({ date: '', date_end: '', interviewer_name: '' });
  const [savingBlock, setSavingBlock] = useState(false);
  const [blockError, setBlockError] = useState('');
  const [blockSuccess, setBlockSuccess] = useState('');

  // Dropdown "Novo"
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startDate, i)), [startDate]);

  const apptsByDay = useMemo(() => {
    const map: Record<string, AgendaInterview[]> = {};
    days.forEach(d => { map[dayKeyFromDate(d)] = []; });
    interviews.forEach(iv => {
      if (!iv.scheduled_date || iv.status === 'CANCELADA') return;
      if (map[iv.scheduled_date]) map[iv.scheduled_date].push(iv);
    });
    return map;
  }, [interviews, days]);

  const startHour = useMemo(() => {
    const visible = days.flatMap(d => apptsByDay[dayKeyFromDate(d)] ?? []);
    const earliest = visible.reduce((min, iv) => {
      if (!iv.scheduled_time) return min;
      const h = Number(iv.scheduled_time.split(':')[0]);
      return h < min ? h : min;
    }, DEFAULT_START);
    return Math.min(earliest, DEFAULT_START);
  }, [apptsByDay, days]);

  const totalHeight = (END_HOUR - startHour) * HOUR_HEIGHT;
  const hours = Array.from({ length: END_HOUR - startHour }, (_, i) => startHour + i);
  const nowLine = useNowLine(startHour);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return interviews.filter(iv =>
      (iv.candidate_name ?? '').toLowerCase().includes(q) ||
      (iv.job_title ?? '').toLowerCase().includes(q) ||
      (iv.interviewer_name ?? '').toLowerCase().includes(q)
    ).sort((a, b) => `${a.scheduled_date || ''}${a.scheduled_time || ''}`.localeCompare(`${b.scheduled_date || ''}${b.scheduled_time || ''}`));
  }, [search, interviews]);

  function prev() { setStartDate(d => addDays(d, -7)); }
  function next() { setStartDate(d => addDays(d, 7)); }
  function goToday() { setStartDate(weekStart(new Date())); }

  function openBlockModal() {
    setBlockForm({ date: '', date_end: '', interviewer_name: '' });
    setBlockError(''); setBlockSuccess('');
    setShowBlockModal(true); setShowMenu(false);
  }

  async function handleSaveBlock() {
    if (!userId) return;
    if (!blockForm.date) { setBlockError('Selecione uma data.'); return; }
    setSavingBlock(true); setBlockError(''); setBlockSuccess('');
    try {
      const res = await fetch('/api/slots/range', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          start_date: blockForm.date,
          end_date: blockForm.date_end || blockForm.date,
          interviewer_name: blockForm.interviewer_name.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) { setBlockError(json.error || 'Erro ao bloquear a agenda.'); return; }
      setBlockSuccess(json.removed > 0
        ? `${json.removed} horário${json.removed !== 1 ? 's' : ''} removido${json.removed !== 1 ? 's' : ''} do período.`
        : 'Nenhum horário disponível encontrado nesse período.');
      onRefresh?.();
    } catch {
      setBlockError('Erro ao bloquear a agenda.');
    } finally {
      setSavingBlock(false);
    }
  }

  async function handleCancelInterview() {
    if (!detailInterview) return;
    if (!confirm('Cancelar esta entrevista? O candidato será avisado.')) return;
    setCancelling(true);
    try {
      await fetch(`/api/interviews/${detailInterview.id}/cancel`, { method: 'POST' });
      setDetailInterview(null);
      onRefresh?.();
    } finally {
      setCancelling(false);
    }
  }

  async function handleDeleteInterview() {
    if (!detailInterview) return;
    if (!confirm('Excluir esta entrevista permanentemente?')) return;
    setCancelling(true);
    try {
      await fetch(`/api/interviews/${detailInterview.id}`, { method: 'DELETE' });
      setDetailInterview(null);
      onRefresh?.();
    } finally {
      setCancelling(false);
    }
  }

  const todayKey = dayKeyFromDate(new Date());
  const rangeLabel = (() => {
    const end = addDays(startDate, 6);
    const f = (d: Date) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
    return `${f(startDate)} – ${f(end)}`;
  })();

  return (
    <div className="flex flex-col gap-3 h-full">

      {/* ── Top bar ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          {(['calendar', 'list'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={[
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[13px] font-semibold transition-all duration-200',
                view === v ? 'text-white shadow-[0_2px_8px_rgba(101,163,13,0.28)]' : 'text-slate-400 hover:text-slate-600',
              ].join(' ')}
              style={view === v ? { background: 'linear-gradient(135deg, #65a30d, #4d7c0f)' } : {}}
            >
              {v === 'calendar' ? <Calendar className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
              {v === 'calendar' ? 'Calendário' : 'Lista'}
            </button>
          ))}
        </div>

        {view === 'calendar' && (
          <>
            <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <button onClick={prev} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors">
                <ChevronLeft className="w-4 h-4 text-slate-500" />
              </button>
              <span className="text-[13px] font-semibold text-slate-700 px-2 min-w-[148px] text-center tabular-nums">{rangeLabel}</span>
              <button onClick={next} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors">
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <button onClick={goToday} className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              Hoje
            </button>
          </>
        )}

        {view === 'list' && (
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input placeholder="Buscar candidato, vaga..."
              className="w-full pl-10 h-9 rounded-2xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#65a30d]/40 focus:border-transparent transition-all"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        )}

        {/* Novo dropdown */}
        <div className="ml-auto relative" ref={menuRef}>
          <button onClick={() => setShowMenu(v => !v)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold text-white shadow-[0_4px_14px_rgba(101,163,13,0.30)] hover:shadow-[0_6px_20px_rgba(101,163,13,0.42)] hover:-translate-y-[1px] transition-all duration-200"
            style={{ background: 'linear-gradient(135deg, #65a30d 0%, #4d7c0f 100%)' }}
          >
            <Plus className="w-4 h-4" />
            Novo
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${showMenu ? 'rotate-180' : ''}`} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-2xl border border-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden min-w-[220px]">
              <button onClick={() => { onOpenAvailableSlots(); setShowMenu(false); }} className="flex items-center gap-3 w-full px-4 py-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-left">
                <div className="w-7 h-7 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                Adicionar Horários
              </button>
              <div className="mx-4 h-px bg-slate-100" />
              <button onClick={openBlockModal} className="flex items-center gap-3 w-full px-4 py-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-left">
                <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                </div>
                Bloquear Agenda
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Calendar ─────────────────────────────────────────────── */}
      {view === 'calendar' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
            <div className="w-full">
              <div className="sticky top-0 z-30 flex bg-white border-b border-slate-100 w-full">
                <div style={{ width: TIME_COL_W, minWidth: TIME_COL_W }} className="shrink-0 border-r border-slate-100" />
                {days.map((day, i) => {
                  const isToday = dayKeyFromDate(day) === todayKey;
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  return (
                    <div key={i} className={`flex-1 border-l border-slate-100 py-3 text-center min-w-0 ${isWeekend && !isToday ? 'bg-slate-50/60' : ''}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-[0.12em] ${isToday ? 'text-[#65a30d]' : 'text-slate-400'}`}>
                        {DAY_PT[day.getDay()]}
                      </p>
                      <div className="mt-1.5 mx-auto w-8 h-8 flex items-center justify-center rounded-full text-[13px] font-bold transition-all duration-200"
                        style={isToday ? { background: 'linear-gradient(135deg, #65a30d, #4d7c0f)', color: 'white', boxShadow: '0 4px 10px rgba(101,163,13,0.35)' } : { color: '#475569' }}>
                        {day.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex w-full relative" style={{ height: totalHeight + 32 }}>
                <div className="relative shrink-0 bg-white border-r border-slate-100" style={{ width: TIME_COL_W, minWidth: TIME_COL_W }}>
                  {hours.map(h => (
                    <div key={h} className="absolute right-3 flex items-center justify-end" style={{ top: (h - startHour) * HOUR_HEIGHT, height: HOUR_HEIGHT }}>
                      <span className="text-[11px] text-slate-400 font-medium tabular-nums">{String(h).padStart(2, '0')}:00</span>
                    </div>
                  ))}
                </div>

                {days.map((day, i) => {
                  const isToday = dayKeyFromDate(day) === todayKey;
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const dayAppts = apptsByDay[dayKeyFromDate(day)] ?? [];
                  return (
                    <div key={i} className={`relative flex-1 min-w-0 border-l border-slate-100 ${isToday ? 'bg-[#65a30d]/[0.03]' : isWeekend ? 'bg-slate-50/40' : ''}`} style={{ height: totalHeight }}>
                      {hours.map(h => (
                        <div key={h}>
                          <div className="absolute left-0 right-0 border-t border-slate-100" style={{ top: (h - startHour) * HOUR_HEIGHT }} />
                          <div className="absolute left-0 right-0 border-t border-dashed border-slate-50" style={{ top: (h - startHour) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
                        </div>
                      ))}

                      {isToday && nowLine !== null && (
                        <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: nowLine }}>
                          <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#65a30d]" />
                          <div className="h-[1.5px] ml-1" style={{ background: 'linear-gradient(90deg, #65a30d, rgba(101,163,13,0.15))' }} />
                        </div>
                      )}

                      {dayAppts.map(iv => {
                        const top = apptTop(iv.scheduled_date, iv.scheduled_time, startHour);
                        if (top === null) return null;
                        const pal = apptPalette(iv.status);
                        return (
                          <div key={iv.id} onClick={() => setDetailInterview(iv)}
                            className={`absolute left-1 right-1 rounded-xl overflow-hidden cursor-pointer z-10 shadow-[0_1px_4px_rgba(0,0,0,0.07)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.12)] hover:-translate-y-px transition-all duration-150 ${pal.bg}`}
                            style={{ top: top + 2, minHeight: HOUR_HEIGHT / 2 - 4 }}
                          >
                            <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl ${pal.bar}`} />
                            <div className="pl-3 pr-2 py-1.5">
                              <p className={`text-[11px] font-bold truncate leading-tight ${pal.text}`}>{iv.candidate_name || 'Candidato'}</p>
                              <p className={`text-[10px] truncate leading-tight mt-0.5 font-medium ${pal.sub}`}>{iv.scheduled_time} · {iv.job_title}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── List view ─────────────────────────────────────────────── */}
      {view === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr] px-6 py-2.5 border-b border-slate-50 gap-4">
            {['Candidato', 'Vaga', 'Data', 'Status'].map((h, i) => (
              <p key={h} className={`text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 ${i === 3 ? 'text-right' : ''}`}>{h}</p>
            ))}
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14">
              <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center mb-3 border border-slate-100"><Calendar className="w-5 h-5 text-slate-300" /></div>
              <p className="text-[13px] font-semibold text-slate-400">Nenhuma entrevista encontrada.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50/80">
              {filtered.map((iv, i) => (
                <div key={iv.id} onClick={() => setDetailInterview(iv)}
                  className={`grid grid-cols-[2fr_1.5fr_1fr_1fr] items-center px-6 py-3.5 gap-4 cursor-pointer transition-colors hover:bg-slate-50/70 group ${i % 2 !== 0 ? 'bg-slate-50/30' : ''}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${apptPalette(iv.status).bar}`} />
                    <p className="text-[13px] font-semibold text-gray-900 truncate leading-none">{iv.candidate_name || 'Candidato'}</p>
                  </div>
                  <p className="text-[12px] text-slate-500 truncate">{iv.job_title ?? '—'}</p>
                  <p className="text-[12px] font-medium text-slate-500 tabular-nums">{fmtDatePt(iv.scheduled_date)} {iv.scheduled_time ? `· ${iv.scheduled_time}` : ''}</p>
                  <div className="flex justify-end">
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${apptPalette(iv.status).bg} ${apptPalette(iv.status).text}`}>{statusLabel(iv.status)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Bloquear Agenda Modal ────────────────────────────────── */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setShowBlockModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg">

            <div className="flex items-center justify-between px-6 py-5 rounded-t-3xl" style={{ background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
                  <Lock className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-base font-bold text-white">Bloquear Agenda</h2>
              </div>
              <button onClick={() => setShowBlockModal(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-[12px] text-slate-500 -mt-1">
                Remove os horários disponíveis (ainda não reservados) do período selecionado — os candidatos deixam de poder marcar entrevista nesses dias.
              </p>

              <RangeCalendar start={blockForm.date} end={blockForm.date_end} onChange={(s, e) => setBlockForm(f => ({ ...f, date: s, date_end: e }))} />

              <FormField label="Entrevistador (opcional)">
                <input placeholder="Deixe em branco pra bloquear todos"
                  value={blockForm.interviewer_name}
                  onChange={e => setBlockForm(f => ({ ...f, interviewer_name: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent" />
              </FormField>

              {blockError && (
                <div className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 shrink-0" />{blockError}
                </div>
              )}
              {blockSuccess && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                  {blockSuccess}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowBlockModal(false)}
                  className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                  Fechar
                </button>
                <button type="button" onClick={handleSaveBlock} disabled={savingBlock || !blockForm.date}
                  className="flex-1 py-2.5 rounded-2xl text-sm font-bold text-white disabled:opacity-40 transition-all hover:-translate-y-[1px]"
                  style={{ background: 'linear-gradient(135deg, #334155, #1e293b)' }}>
                  {savingBlock ? 'Bloqueando...' : 'Bloquear período'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail modal ─────────────────────────────────────────── */}
      {detailInterview && (() => {
        const iv = detailInterview;
        const pal = apptPalette(iv.status);
        const dateStr = iv.scheduled_date
          ? new Date(`${iv.scheduled_date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          : '—';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setDetailInterview(null)} />
            <div className="relative bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] w-full max-w-sm overflow-hidden">
              <div className="flex items-center justify-end gap-1 px-4 pt-3 pb-1">
                {iv.status !== 'CANCELADA' && (
                  <button onClick={handleCancelInterview} disabled={cancelling}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50">
                    Cancelar Entrevista
                  </button>
                )}
                <button onClick={handleDeleteInterview} disabled={cancelling} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-rose-500 disabled:opacity-50">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={() => setDetailInterview(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-start gap-3 px-5 pb-3">
                <div className={`w-3 h-3 rounded-sm mt-1.5 shrink-0 ${pal.bar}`} />
                <div>
                  <p className="text-[17px] font-semibold text-gray-900 leading-snug">{iv.candidate_name || 'Candidato'}</p>
                  <p className="text-[13px] text-slate-500 mt-0.5 capitalize">{dateStr}{iv.scheduled_time ? ` · ${iv.scheduled_time}` : ''}</p>
                  <div className="mt-2">
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${pal.bg} ${pal.text}`}>{statusLabel(iv.status)}</span>
                  </div>
                </div>
              </div>

              <div className="mx-5 h-px bg-slate-100" />

              <div className="px-5 py-4 space-y-3">
                {iv.job_title && <GCalRow icon={<Briefcase className="w-4 h-4" />}>{iv.job_title}</GCalRow>}
                {iv.interviewer_name && <GCalRow icon={<User className="w-4 h-4" />}>{iv.interviewer_name}</GCalRow>}
                {iv.candidate_phone && <GCalRow icon={<Phone className="w-4 h-4" />}>{iv.candidate_phone}</GCalRow>}

                {/* Link da reunião — o agente cria a sala do Google Meet automaticamente */}
                {iv.meeting_link && (
                  iv.format === 'ONLINE' ? (
                    <GCalRow icon={<Video className="w-4 h-4" />}>
                      <a href={iv.meeting_link} target="_blank" rel="noreferrer" className="text-blue-600 font-semibold hover:underline break-all">
                        {iv.meeting_link}
                      </a>
                    </GCalRow>
                  ) : (
                    <GCalRow icon={<MapPin className="w-4 h-4" />}>{iv.meeting_link}</GCalRow>
                  )
                )}
                {!iv.meeting_link && iv.format === 'ONLINE' && (
                  <GCalRow icon={<Video className="w-4 h-4" />}>
                    <span className="text-slate-400 italic">Sala ainda não foi criada pelo agente.</span>
                  </GCalRow>
                )}
              </div>

              <div className="px-5 pb-5 pt-1">
                <button onClick={() => setDetailInterview(null)} className="w-full py-2 rounded-xl text-[13px] font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ── Helpers ────────────────────────────────────────────────────

function GCalRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-slate-400 shrink-0 mt-0.5">{icon}</div>
      <p className="text-[13px] text-slate-700 leading-snug min-w-0">{children}</p>
    </div>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
        {label}{required && <span className="text-rose-400 text-[10px]">*</span>}
      </label>
      {children}
    </div>
  );
}
