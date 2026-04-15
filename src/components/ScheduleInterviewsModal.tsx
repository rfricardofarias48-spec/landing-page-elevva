import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Send, MapPin, Video, Clock, AlertCircle, User } from 'lucide-react';
import { Job } from '../types';
import { supabase } from '../services/supabaseClient';

interface Props {
  job: Job;
  onClose: () => void;
  onSuccess: () => void;
}

interface AvailabilitySlot {
  id: string;
  slot_date: string;
  slot_time: string;
  interviewer_name: string | null;
  format: string;
  location: string | null;
}

export const ScheduleInterviewsModal: React.FC<Props> = ({ job, onClose, onSuccess }) => {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [selectedInterviewers, setSelectedInterviewers] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedCandidates = job.candidates.filter(c => c.isSelected);

  useEffect(() => {
    const fetchSlots = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('availability_slots')
        .select('*')
        .eq('user_id', authUser.id)
        .gte('slot_date', today)
        .order('slot_date', { ascending: true })
        .order('slot_time', { ascending: true });
      const fetched = data || [];
      setSlots(fetched);
      const names = new Set(fetched.map((s: AvailabilitySlot) => s.interviewer_name || '(sem entrevistador)'));
      setSelectedInterviewers(names);
      setLoadingSlots(false);
    };
    fetchSlots();
  }, []);

  const interviewers = useMemo(() => {
    const set = new Set<string>();
    slots.forEach(s => set.add(s.interviewer_name || '(sem entrevistador)'));
    return Array.from(set);
  }, [slots]);

  const filteredSlots = useMemo(() =>
    slots.filter(s => selectedInterviewers.has(s.interviewer_name || '(sem entrevistador)')),
    [slots, selectedInterviewers]
  );

  const toggleInterviewer = (name: string) => {
    setSelectedInterviewers(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
      weekday: 'short', day: '2-digit', month: 'short'
    });
  };

  const handleSubmit = async () => {
    setError('');
    if (filteredSlots.length === 0) {
      setError('Selecione pelo menos um entrevistador com horários disponíveis.');
      return;
    }
    setIsSubmitting(true);
    try {
      const slotsToInsert = filteredSlots.map(s => ({
        job_id: job.id,
        format: s.format,
        location: s.location,
        interviewer_name: s.interviewer_name,
        slot_date: s.slot_date,
        slot_time: s.slot_time,
        is_booked: false,
      }));

      const { error: slotsError } = await supabase.from('interview_slots').insert(slotsToInsert);
      if (slotsError) throw slotsError;

      const ACTIVE_STATUSES = ['AGUARDANDO_RESPOSTA', 'AGUARDANDO_ESCOLHA_SLOT', 'CONFIRMADA', 'AGENDADA', 'ENTREVISTA_CONFIRMADA', 'AGUARDANDO_NOVOS_HORARIOS', 'REMARCADA'];
      const selectedIds = selectedCandidates.map(c => c.id);

      const { data: existingInterviews } = await supabase
        .from('interviews').select('candidate_id')
        .eq('job_id', job.id).in('status', ACTIVE_STATUSES).in('candidate_id', selectedIds);

      const alreadyScheduledIds = new Set((existingInterviews || []).map(i => i.candidate_id));
      const candidatesToSchedule = selectedCandidates.filter(c => !alreadyScheduledIds.has(c.id));

      if (candidatesToSchedule.length === 0) {
        setError('Todos os candidatos selecionados já possuem entrevista ativa.');
        setIsSubmitting(false);
        return;
      }

      const interviewerName = filteredSlots[0]?.interviewer_name || null;
      const { data: insertedInterviews, error: insertError } = await supabase
        .from('interviews')
        .insert(candidatesToSchedule.map(c => ({ job_id: job.id, candidate_id: c.id, status: 'AGUARDANDO_RESPOSTA', interviewer_name: interviewerName })))
        .select();
      if (insertError) throw insertError;

      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const userId = authUser?.id;
        if (!userId) throw new Error('Usuário não autenticado.');
        const interviewIds = insertedInterviews?.map(i => i.id) || [];
        const agentRes = await fetch('/api/agent/start-scheduling', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, job_id: job.id, interview_ids: interviewIds }),
        });
        if (!agentRes.ok) console.warn('Aviso agente:', await agentRes.json().catch(() => ({})));
        await fetch('/api/agent/notify-pending-reschedules', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, job_id: job.id }),
        }).catch(() => {});
      } catch (agentError) { console.error('Erro ao disparar agente:', agentError); }

      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao agendar entrevistas.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const groupedPreview = filteredSlots.reduce<Record<string, AvailabilitySlot[]>>((acc, s) => {
    if (!acc[s.slot_date]) acc[s.slot_date] = [];
    acc[s.slot_date].push(s);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-[0px_8px_40px_rgba(0,0,0,0.14)] relative border border-slate-200 max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-6 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-[#f0fdf4] rounded-2xl flex items-center justify-center border border-[#bbf7d0]">
              <Calendar className="w-5 h-5 text-[#16a34a]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tighter">Agendar Entrevistas</h2>
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-0.5">
                Para {selectedCandidates.length} candidato{selectedCandidates.length !== 1 ? 's' : ''} selecionado{selectedCandidates.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4 bg-slate-50/60 rounded-b-[2rem]">
          {loadingSlots ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#84cc16] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : slots.length === 0 ? (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-amber-700">Nenhum horário disponível</p>
                <p className="text-xs text-amber-500 mt-0.5">Cadastre horários em "Horários Disponíveis" antes de agendar entrevistas.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Interviewer selection */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-[0px_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
                <div className="px-5 py-3 bg-slate-100 border-b border-slate-200">
                  <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                    <User className="w-3.5 h-3.5" /> Selecionar entrevistadores
                  </p>
                </div>
                <div className="p-4 space-y-2">
                  {interviewers.map(name => {
                    const checked = selectedInterviewers.has(name);
                    const count = slots.filter(s => (s.interviewer_name || '(sem entrevistador)') === name).length;
                    return (
                      <label key={name} onClick={() => toggleInterviewer(name)}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${checked ? 'bg-slate-50 border-slate-300 shadow-sm' : 'bg-white border-slate-200 opacity-50'}`}>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${checked ? 'bg-slate-900 border-slate-900' : 'border-slate-300'}`}>
                          {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-slate-800 truncate">{name}</p>
                          <p className="text-[11px] font-bold text-slate-500">{count} horário{count !== 1 ? 's' : ''}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Preview */}
              {filteredSlots.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-[0px_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
                  <div className="px-5 py-3 bg-slate-100 border-b border-slate-200">
                    <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" /> Horários que serão enviados
                    </p>
                  </div>
                  <div className="p-4 space-y-2.5">
                    {Object.entries<AvailabilitySlot[]>(groupedPreview).map(([date, daySlots]) => (
                      <div key={date} className="flex items-start gap-3">
                        <span className="text-xs font-black text-slate-600 w-24 shrink-0 pt-0.5 capitalize">{formatDate(date)}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {daySlots.map(s => (
                            <div key={s.id} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm">
                              <span className="text-xs font-black text-slate-800">{s.slot_time.substring(0, 5)}</span>
                              {s.format === 'ONLINE'
                                ? <Video className="w-3 h-3 text-blue-500" />
                                : <MapPin className="w-3 h-3 text-orange-500" />
                              }
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <p className="text-[11px] text-slate-500 font-bold mt-1">
                      {filteredSlots.length} horário{filteredSlots.length !== 1 ? 's' : ''} • O agente enviará essas opções via WhatsApp
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-xs font-bold text-red-500">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-8 py-6 border-t border-slate-100 flex-shrink-0">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || loadingSlots || filteredSlots.length === 0}
            className="bg-[#84cc16] hover:bg-[#65a30d] text-black px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 shadow-[0px_4px_12px_rgba(132,204,22,0.3)] hover:shadow-[0px_4px_16px_rgba(132,204,22,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-[#65a30d]"
          >
            {isSubmitting
              ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              : <><Send className="w-4 h-4" /> Confirmar e Notificar</>
            }
          </button>
        </div>
      </div>
    </div>
  );
};
