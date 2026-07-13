import React, { useState, useEffect, useMemo } from 'react';
import { X, Clock, Plus, Trash2, Calendar, Video, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface AvailabilitySlot {
  id: string;
  slot_date: string;
  slot_time: string;
  interviewer_name: string | null;
  format: string;
  location: string | null;
}

interface Props {
  userId: string;
  onClose: () => void;
  onSlotsAdded?: () => void;
}

interface DayEntry {
  date: string;
  times: string[];
}

export const AvailableSlotsModal: React.FC<Props> = ({ userId, onClose, onSlotsAdded }) => {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  // Reactive "now" — updates every 60 s so expired slots disappear without page reload
  const [now, setNow] = useState(() => new Date());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [days, setDays] = useState<DayEntry[]>([{ date: '', times: [''] }]);
  const [interviewer, setInterviewer] = useState('');
  const [format, setFormat] = useState<'ONLINE' | 'PRESENCIAL'>('ONLINE');
  const [location, setLocation] = useState('');
  const [formError, setFormError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const fetchSlots = async () => {
    setLoading(true);
    const res = await fetch(`/api/slots?user_id=${userId}`);
    const json = await res.json();
    setSlots(json.slots || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchSlots();
    // Re-fetch every 60 s so the app stays in sync with what candidates see
    const interval = setInterval(fetchSlots, 60_000);
    return () => clearInterval(interval);
  }, [userId]);

  // Tick every 60 s so useMemo re-evaluates expiry without waiting for a re-fetch
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(tick);
  }, []);

  const isExpired = (date: string, time: string) =>
    new Date(`${date}T${time.substring(0, 5)}:00-03:00`) < now;

  // Group slots by date → interviewer — only future slots (same view as candidate)
  const grouped = useMemo(() => {
    const dateMap = new Map<string, Map<string, AvailabilitySlot[]>>();
    slots.forEach(s => {
      if (isExpired(s.slot_date, s.slot_time)) return;
      const interviewerKey = s.interviewer_name || '(sem entrevistador)';
      if (!dateMap.has(s.slot_date)) dateMap.set(s.slot_date, new Map());
      const interviewerMap = dateMap.get(s.slot_date)!;
      if (!interviewerMap.has(interviewerKey)) interviewerMap.set(interviewerKey, []);
      interviewerMap.get(interviewerKey)!.push(s);
    });
    return Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, now]);

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long'
    });
  };

  const formatTime = (t: string) => t.substring(0, 5);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await fetch(`/api/slots/${id}`, { method: 'DELETE' });
    setSlots(prev => prev.filter(s => s.id !== id));
    setDeletingId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const validDays = days.filter(d => d.date && d.times.some(t => t));
    if (validDays.length === 0) {
      setFormError('Adicione pelo menos um dia com horário.');
      return;
    }
    if (!interviewer.trim()) {
      setFormError('Informe o nome do entrevistador.');
      return;
    }
    if (format === 'PRESENCIAL' && !location.trim()) {
      setFormError('Informe o endereço para entrevista presencial.');
      return;
    }

    setSaving(true);
    const toInsert = validDays.flatMap(d =>
      d.times.filter(t => t).map(t => ({
        user_id: userId,
        slot_date: d.date,
        slot_time: t,
        interviewer_name: interviewer.trim(),
        format,
        location: format === 'PRESENCIAL' ? location.trim() : null,
      }))
    );

    const res = await fetch('/api/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, slots: toInsert.map(({ user_id: _u, ...s }) => s) }),
    });
    const json = await res.json();
    if (!json.ok) {
      setFormError('Erro ao salvar horários. Tente novamente.');
    } else {
      setDays([{ date: '', times: [''] }]);
      setInterviewer('');
      setLocation('');
      setShowForm(false);
      await fetchSlots();
      // Notifica automaticamente todos os candidatos aguardando novos horários
      fetch('/api/agent/notify-all-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      }).then(r => r.json()).then(d => {
        if (d.sent > 0) console.log(`[Slots] Notificados ${d.sent} candidato(s) em espera`);
      }).catch(() => {});
      onSlotsAdded?.();
    }
    setSaving(false);
  };

  const totalSlots = slots.filter(s => !isExpired(s.slot_date, s.slot_time)).length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 animate-fade-in">
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">

        {/* Header — mesmo padrão dos outros modais da Agenda */}
        <div className="flex items-center justify-between px-6 py-5 rounded-t-3xl shrink-0" style={{ background: 'linear-gradient(135deg, #65a30d 0%, #4d7c0f 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Horários Disponíveis</h2>
              <p className="text-[11px] font-medium text-white/70 mt-0.5">
                {totalSlots === 0 ? 'Nenhum horário cadastrado' : `${totalSlots} horário${totalSlots !== 1 ? 's' : ''} disponível${totalSlots !== 1 ? 'is' : ''}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Slot list */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#65a30d] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 bg-slate-50 rounded-2xl border border-slate-100">
              <Calendar className="w-9 h-9 text-slate-200 mb-3" />
              <p className="text-sm font-semibold text-slate-500">Nenhum horário cadastrado</p>
              <p className="text-xs text-slate-400 font-medium mt-1">Adicione horários para que o agente possa agendar entrevistas.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Horários cadastrados</p>
              {grouped.map(([date, interviewerMap]) => (
                <div key={date} className="rounded-xl border border-slate-100 overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                    <p className="text-[11px] font-bold text-slate-600 uppercase tracking-widest capitalize">
                      {formatDate(date)}
                    </p>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {Array.from(interviewerMap.entries()).map(([interviewer, daySlots]) => (
                      <div key={interviewer} className="px-4 py-3">
                        <p className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#65a30d]" /> {interviewer}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {daySlots.map(slot => (
                            <div key={slot.id} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 hover:border-slate-200 hover:bg-white transition-all">
                              <span className="text-[13px] font-bold text-slate-800">{formatTime(slot.slot_time)}</span>
                              {slot.format === 'ONLINE'
                                ? <Video className="w-3.5 h-3.5 text-blue-500" />
                                : <MapPin className="w-3.5 h-3.5 text-orange-500" />
                              }
                              <button
                                onClick={() => handleDelete(slot.id)}
                                disabled={deletingId === slot.id}
                                className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                              >
                                {deletingId === slot.id
                                  ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                                  : <X className="w-3 h-3" />
                                }
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add slots form */}
          {showForm ? (
            <form onSubmit={handleSave} className="space-y-4 pt-1">
              <div className="h-px bg-slate-100" />
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 flex items-center gap-2">
                <Plus className="w-3.5 h-3.5" /> Adicionar novos horários
              </p>

              {/* Interviewer */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  Entrevistador<span className="text-rose-400 text-[10px]">*</span>
                </label>
                <input
                  type="text"
                  value={interviewer}
                  onChange={e => setInterviewer(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#65a30d]/40 focus:border-transparent transition-all"
                  required
                />
              </div>

              {/* Format */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Formato</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setFormat('ONLINE')}
                    className={`flex-1 py-2.5 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-2 border-2 transition-all ${format === 'ONLINE' ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'}`}>
                    <Video className="w-4 h-4" /> Online
                  </button>
                  <button type="button" onClick={() => setFormat('PRESENCIAL')}
                    className={`flex-1 py-2.5 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-2 border-2 transition-all ${format === 'PRESENCIAL' ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'}`}>
                    <MapPin className="w-4 h-4" /> Presencial
                  </button>
                </div>
              </div>

              {format === 'PRESENCIAL' && (
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
                    Endereço<span className="text-rose-400 text-[10px]">*</span>
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="Ex: Rua das Flores, 123 - Centro"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#65a30d]/40 focus:border-transparent transition-all"
                    required
                  />
                </div>
              )}

              {/* Days & times */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Dias e Horários</label>
                <div className="space-y-2.5">
                  {days.map((day, di) => (
                    <div key={di} className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50 border-b border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Data</span>
                        {days.length > 1 && (
                          <button type="button" onClick={() => setDays(prev => prev.filter((_, i) => i !== di))}
                            className="p-0.5 text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="p-3.5 space-y-2.5">
                        <input type="date" value={day.date}
                          onChange={e => setDays(prev => prev.map((d, i) => i === di ? { ...d, date: e.target.value } : d))}
                          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#65a30d]/40 focus:border-transparent transition-all"
                          required />
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Horários</label>
                          <div className="flex flex-wrap gap-2">
                            {day.times.map((time, ti) => (
                              <div key={ti} className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#65a30d]/40 transition-all">
                                <input type="time" value={time}
                                  onChange={e => setDays(prev => prev.map((d, i) => i === di ? { ...d, times: d.times.map((t, j) => j === ti ? e.target.value : t) } : d))}
                                  className="px-3 py-1.5 text-sm bg-transparent focus:outline-none" required />
                                {day.times.length > 1 && (
                                  <button type="button" onClick={() => setDays(prev => prev.map((d, i) => i === di ? { ...d, times: d.times.filter((_, j) => j !== ti) } : d))}
                                    className="px-2 text-slate-400 hover:text-red-500 border-l border-slate-200 transition-colors">
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                            <button type="button" onClick={() => setDays(prev => prev.map((d, i) => i === di ? { ...d, times: [...d.times, ''] } : d))}
                              className="flex items-center gap-1 border border-dashed border-slate-300 text-slate-500 hover:text-slate-700 hover:border-slate-400 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors">
                              <Plus className="w-3 h-3" /> Horário
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setDays(prev => [...prev, { date: '', times: [''] }])}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 hover:border-slate-400 transition-all">
                    <Calendar className="w-4 h-4" /> Adicionar outro dia
                  </button>
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />{formError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowForm(false); setFormError(''); }}
                  className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-2xl text-sm font-bold text-white shadow-[0_4px_14px_rgba(101,163,13,0.28)] hover:shadow-[0_6px_20px_rgba(101,163,13,0.38)] hover:-translate-y-[1px] disabled:opacity-60 disabled:hover:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #65a30d 0%, #4d7c0f 100%)' }}>
                  {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Salvar horários</>}
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-bold text-white shadow-[0_4px_14px_rgba(101,163,13,0.30)] hover:shadow-[0_6px_20px_rgba(101,163,13,0.42)] hover:-translate-y-[1px] transition-all duration-200"
              style={{ background: 'linear-gradient(135deg, #65a30d 0%, #4d7c0f 100%)' }}>
              <Plus className="w-4 h-4" /> Adicionar horários
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
