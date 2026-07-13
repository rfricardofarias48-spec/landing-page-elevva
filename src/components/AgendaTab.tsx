import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, Plus, Clock, Video, MapPin, User as UserIcon, X, Search } from 'lucide-react';

export interface AgendaInterview {
  id: string;
  candidate_name?: string;
  job_title?: string;
  scheduled_date?: string; // 'YYYY-MM-DD'
  scheduled_time?: string; // 'HH:MM'
  status: string;
  format?: string;
  meeting_link?: string;
  interviewer_name?: string;
}

interface Props {
  interviews: AgendaInterview[];
  onOpenAvailableSlots: () => void;
}

const HOUR_HEIGHT = 64;
const START_HOUR = 7;
const END_HOUR = 21;
const DAY_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const STATUS_META: Record<string, { bg: string; bar: string; text: string; dot: string; label: string }> = {
  AGUARDANDO_RESPOSTA: { bg: 'bg-amber-50',   bar: 'border-amber-400',   text: 'text-amber-900',   dot: 'bg-amber-400',   label: 'Aguardando' },
  AGENDADA:             { bg: 'bg-blue-50',    bar: 'border-blue-400',    text: 'text-blue-900',    dot: 'bg-blue-400',    label: 'Agendada' },
  CONFIRMADA:           { bg: 'bg-emerald-50', bar: 'border-emerald-500', text: 'text-emerald-900', dot: 'bg-emerald-500', label: 'Confirmada' },
  REALIZADA:            { bg: 'bg-slate-100',  bar: 'border-slate-400',   text: 'text-slate-600',   dot: 'bg-slate-400',   label: 'Realizada' },
  CANCELADA:            { bg: 'bg-red-50',     bar: 'border-red-400',     text: 'text-red-900',     dot: 'bg-red-400',     label: 'Cancelada' },
  REMARCADA:            { bg: 'bg-purple-50',  bar: 'border-purple-400',  text: 'text-purple-900',  dot: 'bg-purple-400',  label: 'Remarcada' },
  AGUARDANDO_NOVOS_HORARIOS: { bg: 'bg-orange-50', bar: 'border-orange-400', text: 'text-orange-900', dot: 'bg-orange-400', label: 'Aguard. novos horários' },
};

function statusMeta(status: string) {
  return STATUS_META[status] || STATUS_META.AGENDADA;
}

function dayKey(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function weekStart(d: Date) { const r = new Date(d); r.setDate(r.getDate() - r.getDay()); r.setHours(0, 0, 0, 0); return r; }
function fmtDatePt(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('pt-BR');
}

// Aba Agenda — visão semanal/lista das entrevistas, no mesmo formato usado
// no app de atendimento (Agentes-de-Atendimento): grade por horário,
// navegação Hoje/semana, alternância lista, clique pra ver detalhes.
// A criação de sala do Google Meet continua automática (googleCalendarService);
// esta tela só deixa de depender do Google Agenda externo como interface.
export const AgendaTab: React.FC<Props> = ({ interviews, onOpenAvailableSlots }) => {
  const [viewMode, setViewMode] = useState<'week' | 'list'>('week');
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [selected, setSelected] = useState<AgendaInterview | null>(null);
  const [search, setSearch] = useState('');

  const days = useMemo(() => {
    const start = weekStart(anchorDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchorDate]);

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaInterview[]>();
    interviews.forEach(iv => {
      if (!iv.scheduled_date || iv.status === 'CANCELADA') return;
      const key = iv.scheduled_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(iv);
    });
    return map;
  }, [interviews]);

  function topFor(time?: string): number | null {
    if (!time) return null;
    const [h, m] = time.split(':').map(Number);
    if (Number.isNaN(h) || h < START_HOUR || h >= END_HOUR) return null;
    return ((h - START_HOUR) * 60 + m) / 60 * HOUR_HEIGHT;
  }

  const todayKey = dayKey(new Date());
  const gridHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return interviews
      .filter(iv => !q || iv.candidate_name?.toLowerCase().includes(q) || iv.job_title?.toLowerCase().includes(q))
      .sort((a, b) => `${a.scheduled_date || ''}${a.scheduled_time || ''}`.localeCompare(`${b.scheduled_date || ''}${b.scheduled_time || ''}`));
  }, [interviews, search]);

  return (
    <div className="space-y-4 animate-fade-in h-full flex flex-col">
      {/* Header/toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">Agenda</h2>
          <p className="text-slate-500 font-medium text-sm">Suas entrevistas, num só lugar.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <button onClick={() => setViewMode('week')} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === 'week' ? 'bg-black text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              <CalendarIcon className="w-3.5 h-3.5" /> Semana
            </button>
            <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === 'list' ? 'bg-black text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              <List className="w-3.5 h-3.5" /> Lista
            </button>
          </div>
          <button onClick={onOpenAvailableSlots} className="flex items-center gap-2 bg-[#65a30d] hover:bg-[#4d7c0f] text-white font-black px-4 py-2 rounded-xl text-sm transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Horários
          </button>
        </div>
      </div>

      {viewMode === 'week' ? (
        <>
          {/* Week nav */}
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-3 shrink-0">
            <button onClick={() => setAnchorDate(d => addDays(d, -7))} className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <button onClick={() => setAnchorDate(new Date())} className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-widest transition-colors">
                Hoje
              </button>
              <span className="text-sm font-black text-slate-700 capitalize">
                {days[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — {days[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </span>
            </div>
            <button onClick={() => setAnchorDate(d => addDays(d, 7))} className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-2xl custom-scrollbar">
            <div className="grid" style={{ gridTemplateColumns: '52px repeat(7, minmax(120px, 1fr))' }}>
              {/* Header row */}
              <div className="sticky top-0 z-20 bg-white border-b border-slate-100" />
              {days.map(d => {
                const key = dayKey(d);
                const isToday = key === todayKey;
                return (
                  <div key={key} className={`sticky top-0 z-20 border-b border-l border-slate-100 py-2.5 text-center ${isToday ? 'bg-emerald-50/70' : 'bg-white'}`}>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{DAY_PT[d.getDay()]}</p>
                    <p className={`text-lg font-black leading-none mt-0.5 ${isToday ? 'text-emerald-600' : 'text-slate-800'}`}>{d.getDate()}</p>
                  </div>
                );
              })}

              {/* Time column */}
              <div className="relative" style={{ height: gridHeight }}>
                {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                  <div key={i} className="absolute left-0 right-0 border-t border-slate-50 text-[10px] text-slate-300 font-bold pl-1" style={{ top: i * HOUR_HEIGHT }}>
                    {String(START_HOUR + i).padStart(2, '0')}h
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {days.map(d => {
                const key = dayKey(d);
                const dayInterviews = byDay.get(key) || [];
                return (
                  <div key={key} className="relative border-l border-slate-100" style={{ height: gridHeight }}>
                    {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                      <div key={i} className="absolute left-0 right-0 border-t border-slate-50" style={{ top: i * HOUR_HEIGHT }} />
                    ))}
                    {dayInterviews.map(iv => {
                      const top = topFor(iv.scheduled_time);
                      if (top === null) return null;
                      const meta = statusMeta(iv.status);
                      return (
                        <button
                          key={iv.id}
                          onClick={() => setSelected(iv)}
                          className={`absolute left-1 right-1 rounded-lg px-2 py-1 text-left border-l-4 ${meta.bg} ${meta.bar} hover:shadow-md hover:-translate-y-px transition-all overflow-hidden`}
                          style={{ top }}
                        >
                          <p className={`text-[11px] font-bold truncate leading-tight ${meta.text}`}>{iv.scheduled_time} · {iv.candidate_name || 'Candidato'}</p>
                          <p className="text-[10px] text-slate-500 truncate leading-tight">{iv.job_title}</p>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* List view */}
          <div className="relative shrink-0">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar candidato ou vaga..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium focus:outline-none focus:border-slate-400 transition-colors"
            />
          </div>
          <div className="flex-1 overflow-y-auto bg-white border border-slate-200 rounded-2xl divide-y divide-slate-50 custom-scrollbar">
            {filteredList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <CalendarIcon className="w-9 h-9 text-slate-200 mb-3" />
                <p className="text-sm font-black text-slate-400">Nenhuma entrevista encontrada.</p>
              </div>
            ) : filteredList.map(iv => {
              const meta = statusMeta(iv.status);
              return (
                <button key={iv.id} onClick={() => setSelected(iv)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{iv.candidate_name || 'Candidato'}</p>
                      <p className="text-xs text-slate-500 truncate">{iv.job_title}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-sm font-bold text-slate-800">{fmtDatePt(iv.scheduled_date)}</p>
                    <p className="text-xs text-slate-400">{iv.scheduled_time || '—'}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${statusMeta(selected.status).dot}`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{statusMeta(selected.status).label}</span>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tighter mb-4">{selected.candidate_name || 'Candidato'}</h3>
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2.5 text-slate-600 font-medium">
                <UserIcon className="w-4 h-4 text-slate-300 shrink-0" /> {selected.job_title}
              </p>
              <p className="flex items-center gap-2.5 text-slate-600 font-medium">
                <Clock className="w-4 h-4 text-slate-300 shrink-0" /> {fmtDatePt(selected.scheduled_date)} às {selected.scheduled_time || '—'}
              </p>
              {selected.interviewer_name && (
                <p className="flex items-center gap-2.5 text-slate-600 font-medium">
                  <UserIcon className="w-4 h-4 text-slate-300 shrink-0" /> Entrevistador: {selected.interviewer_name}
                </p>
              )}
              {selected.meeting_link && (
                selected.format === 'ONLINE' ? (
                  <a href={selected.meeting_link} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 text-blue-600 font-bold hover:underline">
                    <Video className="w-4 h-4 shrink-0" /> Entrar na chamada
                  </a>
                ) : (
                  <p className="flex items-center gap-2.5 text-slate-600 font-medium">
                    <MapPin className="w-4 h-4 text-slate-300 shrink-0" /> {selected.meeting_link}
                  </p>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
