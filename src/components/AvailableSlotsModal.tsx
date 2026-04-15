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
}

interface DayEntry {
  date: string;
  times: string[];
}

export const AvailableSlotsModal: React.FC<Props> = ({ userId, onClose }) => {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
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
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('availability_slots')
      .select('*')
      .eq('user_id', userId)
      .gte('slot_date', today)
      .order('slot_date', { ascending: true })
      .order('slot_time', { ascending: true });
    setSlots(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchSlots(); }, [userId]);

  // Group slots by date → interviewer
  const grouped = useMemo(() => {
    const dateMap = new Map<string, Map<string, AvailabilitySlot[]>>();
    slots.forEach(s => {
      const interviewerKey = s.interviewer_name || '(sem entrevistador)';
      if (!dateMap.has(s.slot_date)) dateMap.set(s.slot_date, new Map());
      const interviewerMap = dateMap.get(s.slot_date)!;
      if (!interviewerMap.has(interviewerKey)) interviewerMap.set(interviewerKey, []);
      interviewerMap.get(interviewerKey)!.push(s);
    });
    return Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long'
    });
  };

  const formatTime = (t: string) => t.substring(0, 5);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await supabase.from('availability_slots').delete().eq('id', id);
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
        interviewer_name: interviewer.trim() || null,
        format,
        location: format === 'PRESENCIAL' ? location.trim() : null,
      }))
    );

    const { error } = await supabase.from('availability_slots').insert(toInsert);
    if (error) {
      setFormError('Erro ao salvar horários. Tente novamente.');
    } else {
      setDays([{ date: '', times: [''] }]);
      setInterviewer('');
      setLocation('');
      setShowForm(false);
      await fetchSlots();
    }
    setSaving(false);
  };

  const totalSlots = slots.length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl relative border-4 border-black flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-8 pb-5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#84cc16] rounded-xl flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Clock className="w-6 h-6 text-black" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Horários Disponíveis</h2>
              <p className="text-xs font-bold text-slate-500">
                {totalSlots === 0 ? 'Nenhum horário cadastrado' : `${totalSlots} horário${totalSlots !== 1 ? 's' : ''} disponível${totalSlots !== 1 ? 'is' : ''}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors border border-slate-200 hover:border-black text-slate-400 hover:text-black">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-6">

          {/* Slot list */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-[#84cc16] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <Calendar className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm font-black text-slate-600">Nenhum horário cadastrado</p>
              <p className="text-xs text-slate-400 font-medium mt-1">Adicione horários para que o agente possa agendar entrevistas.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map(([date, interviewerMap]) => (
                <div key={date} className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-100 border-b border-slate-200">
                    <p className="text-xs font-black text-slate-700 uppercase tracking-widest capitalize">
                      {formatDate(date)}
                    </p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {Array.from(interviewerMap.entries()).map(([interviewer, daySlots]) => (
                      <div key={interviewer} className="p-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {interviewer}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {daySlots.map(slot => (
                            <div key={slot.id} className="flex items-center gap-2 bg-white border-2 border-slate-200 rounded-xl px-3 py-2 hover:border-slate-300 transition-all">
                              <span className="text-sm font-black text-slate-800">{formatTime(slot.slot_time)}</span>
                              {slot.format === 'ONLINE'
                                ? <Video className="w-3.5 h-3.5 text-blue-500" />
                                : <MapPin className="w-3.5 h-3.5 text-orange-500" />
                              }
                              <button
                                onClick={() => handleDelete(slot.id)}
                                disabled={deletingId === slot.id}
                                className="ml-1 p-0.5 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50"
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
            <form onSubmit={handleSave} className="bg-slate-50 rounded-2xl border-2 border-slate-200 p-5 space-y-5">
              <p className="text-sm font-black text-slate-900">Adicionar novos horários</p>

              {/* Interviewer */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">Entrevistador</label>
                <input
                  type="text"
                  value={interviewer}
                  onChange={e => setInterviewer(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-black transition-colors"
                  required
                />
              </div>

              {/* Format */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">Formato</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setFormat('ONLINE')}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border-2 transition-all ${format === 'ONLINE' ? 'bg-black text-white border-black' : 'bg-white text-slate-600 border-slate-200'}`}>
                    <Video className="w-4 h-4" /> Online
                  </button>
                  <button type="button" onClick={() => setFormat('PRESENCIAL')}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border-2 transition-all ${format === 'PRESENCIAL' ? 'bg-black text-white border-black' : 'bg-white text-slate-600 border-slate-200'}`}>
                    <MapPin className="w-4 h-4" /> Presencial
                  </button>
                </div>
              </div>

              {format === 'PRESENCIAL' && (
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">Endereço</label>
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="Ex: Rua das Flores, 123 - Centro"
                    className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-black transition-colors"
                    required
                  />
                </div>
              )}

              {/* Days & times */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-3">Dias e Horários</label>
                <div className="space-y-3">
                  {days.map((day, di) => (
                    <div key={di} className="bg-white border-2 border-slate-200 rounded-xl p-4 relative">
                      {days.length > 1 && (
                        <button type="button" onClick={() => setDays(prev => prev.filter((_, i) => i !== di))}
                          className="absolute top-3 right-3 p-1 text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <div className="mb-3 pr-6">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">DATA</label>
                        <input type="date" value={day.date}
                          onChange={e => setDays(prev => prev.map((d, i) => i === di ? { ...d, date: e.target.value } : d))}
                          className="bg-slate-50 border-2 border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-black transition-colors"
                          required />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-2">HORÁRIOS</label>
                        <div className="flex flex-wrap gap-2">
                          {day.times.map((time, ti) => (
                            <div key={ti} className="flex items-center bg-slate-50 border-2 border-slate-200 rounded-lg overflow-hidden focus-within:border-black transition-colors">
                              <input type="time" value={time}
                                onChange={e => setDays(prev => prev.map((d, i) => i === di ? { ...d, times: d.times.map((t, j) => j === ti ? e.target.value : t) } : d))}
                                className="px-3 py-1.5 text-sm font-medium bg-transparent focus:outline-none" required />
                              {day.times.length > 1 && (
                                <button type="button" onClick={() => setDays(prev => prev.map((d, i) => i === di ? { ...d, times: d.times.filter((_, j) => j !== ti) } : d))}
                                  className="px-2 text-slate-300 hover:text-red-500 border-l border-slate-200">
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                          <button type="button" onClick={() => setDays(prev => prev.map((d, i) => i === di ? { ...d, times: [...d.times, ''] } : d))}
                            className="flex items-center gap-1 bg-slate-50 border-2 border-dashed border-slate-300 text-slate-500 hover:text-black hover:border-black rounded-lg px-3 py-1.5 text-xs font-bold transition-colors">
                            <Plus className="w-3 h-3" /> Horário
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setDays(prev => [...prev, { date: '', times: [''] }])}
                    className="w-full flex items-center justify-center gap-2 bg-white border-2 border-dashed border-slate-300 hover:border-black text-slate-500 hover:text-black rounded-xl px-4 py-2.5 text-sm font-bold transition-colors">
                    <Calendar className="w-4 h-4" /> Adicionar outro dia
                  </button>
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-xs font-bold text-red-600">{formError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setFormError(''); }}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 transition-colors border-2 border-transparent">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-[#84cc16] hover:bg-[#65a30d] text-black py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 transition-all">
                  {saving ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Salvar horários</>}
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 bg-[#84cc16] hover:bg-[#65a30d] text-black border-2 border-black font-black text-sm py-3 rounded-2xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all">
              <Plus className="w-4 h-4" /> Adicionar horários
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
