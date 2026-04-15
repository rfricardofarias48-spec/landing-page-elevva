import React, { useState, useEffect } from 'react';
import { X, Calendar, Send, MapPin, Video, Clock, AlertCircle } from 'lucide-react';
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
      setSlots(data || []);
      setLoadingSlots(false);
    };
    fetchSlots();
  }, []);

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
      weekday: 'short', day: '2-digit', month: 'short'
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (slots.length === 0) {
      setError('Nenhum horário disponível cadastrado. Adicione horários em "Horários Disponíveis" antes de agendar.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Copy availability_slots → interview_slots for this job
      const slotsToInsert = slots.map(s => ({
        job_id: job.id,
        format: s.format,
        location: s.location,
        interviewer_name: s.interviewer_name,
        slot_date: s.slot_date,
        slot_time: s.slot_time,
        is_booked: false,
      }));

      const { error: slotsError } = await supabase
        .from('interview_slots')
        .insert(slotsToInsert);

      if (slotsError) throw slotsError;

      // 2. Filter candidates that already have an active interview for this job
      const ACTIVE_STATUSES = ['AGUARDANDO_RESPOSTA', 'AGUARDANDO_ESCOLHA_SLOT', 'CONFIRMADA', 'AGENDADA', 'ENTREVISTA_CONFIRMADA', 'AGUARDANDO_NOVOS_HORARIOS', 'REMARCADA'];
      const selectedIds = selectedCandidates.map(c => c.id);

      const { data: existingInterviews } = await supabase
        .from('interviews')
        .select('candidate_id')
        .eq('job_id', job.id)
        .in('status', ACTIVE_STATUSES)
        .in('candidate_id', selectedIds);

      const alreadyScheduledIds = new Set((existingInterviews || []).map(i => i.candidate_id));
      const candidatesToSchedule = selectedCandidates.filter(c => !alreadyScheduledIds.has(c.id));

      if (candidatesToSchedule.length === 0) {
        setError('Todos os candidatos selecionados já possuem entrevista ativa. Nenhum convite foi enviado.');
        setIsSubmitting(false);
        return;
      }

      // 3. Insert interviews (only candidates without active interview)
      const interviewerName = slots[0]?.interviewer_name || null;
      const interviewsToInsert = candidatesToSchedule.map(candidate => ({
        job_id: job.id,
        candidate_id: candidate.id,
        status: 'AGUARDANDO_RESPOSTA',
        interviewer_name: interviewerName,
      }));

      const { data: insertedInterviews, error: insertError } = await supabase
        .from('interviews')
        .insert(interviewsToInsert)
        .select();

      if (insertError) throw insertError;

      // 4. Trigger agent to send WhatsApp messages
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const userId = authUser?.id;
        if (!userId) throw new Error('Usuário não autenticado.');

        const interviewIds = insertedInterviews?.map(i => i.id) || [];

        const agentRes = await fetch('/api/agent/start-scheduling', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            job_id: job.id,
            interview_ids: interviewIds,
          }),
        });

        if (!agentRes.ok) {
          const body = await agentRes.json().catch(() => ({})) as { error?: string };
          console.warn('Aviso do agente:', body.error);
        }

        await fetch('/api/agent/notify-pending-reschedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, job_id: job.id }),
        }).catch(() => {});
      } catch (agentError) {
        console.error('Erro ao disparar agente:', agentError);
      }

      onSuccess();
    } catch (err: unknown) {
      console.error('Erro ao agendar entrevistas:', err);
      const message = err instanceof Error ? err.message : 'Erro ao agendar entrevistas. Tente novamente.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group slots by date for preview
  const grouped = slots.reduce<Record<string, AvailabilitySlot[]>>((acc, s) => {
    if (!acc[s.slot_date]) acc[s.slot_date] = [];
    acc[s.slot_date].push(s);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-[2rem] w-full max-w-lg p-8 shadow-2xl relative animate-slide-up border-4 border-black max-h-[90vh] flex flex-col">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors border border-slate-200 hover:border-black text-slate-400 hover:text-black z-10">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6 flex-shrink-0">
          <div className="w-12 h-12 bg-[#84cc16] rounded-xl flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <Calendar className="w-6 h-6 text-black" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Agendar Entrevistas</h2>
            <p className="text-sm font-bold text-slate-500">Para {selectedCandidates.length} candidato(s) selecionado(s)</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {/* Slots preview */}
          <div className="bg-slate-50 rounded-2xl border-2 border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-[#65a30d]" />
              <p className="text-xs font-black text-slate-700 uppercase tracking-widest">Horários que serão enviados</p>
            </div>

            {loadingSlots ? (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-[#84cc16] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : slots.length === 0 ? (
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-black text-amber-700">Nenhum horário disponível</p>
                  <p className="text-xs text-amber-600 mt-0.5">Cadastre horários em "Horários Disponíveis" antes de agendar entrevistas.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(grouped).map(([date, daySlots]) => (
                  <div key={date} className="flex items-start gap-3">
                    <span className="text-xs font-black text-slate-600 w-24 shrink-0 pt-0.5 capitalize">{formatDate(date)}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {daySlots.map(s => (
                        <div key={s.id} className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
                          <span className="text-xs font-black text-slate-700">{s.slot_time.substring(0, 5)}</span>
                          {s.format === 'ONLINE'
                            ? <Video className="w-3 h-3 text-blue-500" />
                            : <MapPin className="w-3 h-3 text-orange-500" />
                          }
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-slate-400 font-bold mt-2">
                  {slots.length} horário{slots.length !== 1 ? 's' : ''} • O agente enviará essas opções via WhatsApp
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs font-bold text-red-600">{error}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-5 border-t border-slate-100 mt-5 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || loadingSlots || slots.length === 0}
            className="bg-[#84cc16] hover:bg-[#65a30d] text-black px-6 py-3 rounded-xl font-black text-sm flex items-center gap-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed border-2 border-black"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Confirmar e Notificar <Send className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
