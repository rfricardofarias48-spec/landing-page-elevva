import React, { useState } from 'react';
import { Calendar, Clock, Video, CheckCircle2, XCircle, AlertCircle, Trash2 } from 'lucide-react';
import { Interview } from '../types';
import { supabase } from '../services/supabaseClient';

interface Props {
  interviews: Interview[];
  hasCalendarIntegration?: boolean;
}

export const InterviewsTab: React.FC<Props> = ({ interviews, hasCalendarIntegration }) => {
  const [interviewToCancel, setInterviewToCancel] = useState<Interview | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);

  if (interviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
        <Calendar className="w-12 h-12 text-slate-300 mb-4" />
        <h3 className="text-lg font-black text-slate-900 mb-1">Nenhuma entrevista agendada</h3>
        <p className="text-sm font-bold text-slate-500">Selecione candidatos aprovados em uma vaga e clique em "Agendar Entrevistas".</p>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'AGUARDANDO_RESPOSTA': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case 'AGENDADA': return <Calendar className="w-4 h-4 text-blue-500" />;
      case 'COMPLETED':
      case 'REALIZADA': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'CANCELADA': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'AGUARDANDO_RESPOSTA': return 'Aguardando Candidato';
      case 'AGENDADA': return 'Agendada';
      case 'COMPLETED':
      case 'REALIZADA': return 'Concluída';
      case 'CANCELADA': return 'Cancelada';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AGUARDANDO_RESPOSTA': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'AGENDADA': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'COMPLETED':
      case 'REALIZADA': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'CANCELADA': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const handleCancelInterview = async () => {
    if (!interviewToCancel) return;
    setIsCanceling(true);

    try {
      // 1. Update interview status
      const { error: interviewError } = await supabase
        .from('interviews')
        .update({ status: 'CANCELADA' })
        .eq('id', interviewToCancel.id);

      if (interviewError) throw interviewError;

      // 2. Update slot if exists
      if (interviewToCancel.slot_id) {
        const { error: slotError } = await supabase
          .from('interview_slots')
          .update({ is_booked: false })
          .eq('id', interviewToCancel.slot_id);
          
        if (slotError) console.error("Erro ao liberar slot:", slotError);
      }

      // 3. Webhook n8n
      const webhookUrl = import.meta.env.VITE_N8N_CANCEL_WEBHOOK;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidate: {
              id: interviewToCancel.candidate_id,
              name: interviewToCancel.candidate_name,
              phone: interviewToCancel.candidate_phone
            },
            job: {
              title: interviewToCancel.job_title
            },
            slot: {
              date: interviewToCancel.scheduled_date,
              time: interviewToCancel.scheduled_time,
              format: interviewToCancel.format
            }
          })
        }).catch(err => console.error("Erro ao notificar n8n:", err));
      }

      // Optimistic update - this will be overwritten by the realtime subscription soon
      interviewToCancel.status = 'CANCELADA';
      
    } catch (error) {
      console.error("Erro ao cancelar entrevista:", error);
      alert("Ocorreu um erro ao cancelar a entrevista. Tente novamente.");
    } finally {
      setIsCanceling(false);
      setInterviewToCancel(null);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] border-2 border-slate-100 p-8 shadow-sm animate-fade-in relative overflow-hidden">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Entrevistas</h2>
          <p className="text-sm font-bold text-slate-500">Acompanhe os agendamentos feitos pelo agente</p>
        </div>
        <div className="flex items-center gap-4">
          {hasCalendarIntegration && (
            <a
              href="https://calendar.google.com/calendar/r"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:border-slate-300 hover:bg-slate-50 transition-all"
            >
              <Calendar className="w-4 h-4" />
              Abrir Google Calendar
            </a>
          )}
          <div className="w-12 h-12 bg-[#CCF300] rounded-2xl flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <Calendar className="w-6 h-6 text-black" />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-100">
              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Candidato</th>
              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vaga</th>
              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data & Hora</th>
              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Link</th>
              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {interviews.map((interview) => (
              <tr key={interview.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-4 pr-4">
                  <div className="font-black text-sm text-slate-900">{interview.candidate_name || 'Candidato'}</div>
                </td>
                <td className="py-4 pr-4">
                  <div className="text-xs font-bold text-slate-500">{interview.job_title || 'Vaga'}</div>
                </td>
                <td className="py-4 pr-4">
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${getStatusColor(interview.status)}`}>
                    {getStatusIcon(interview.status)}
                    {getStatusText(interview.status)}
                  </div>
                </td>
                <td className="py-4 pr-4">
                  {interview.scheduled_date ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(interview.scheduled_date).toLocaleDateString()}
                      {interview.scheduled_time && (
                        <>
                          <span className="text-slate-300">•</span>
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {interview.scheduled_time}
                        </>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-slate-400 italic">A definir</span>
                  )}
                </td>
                <td className="py-4">
                  {interview.meeting_link ? (
                    <a
                      href={interview.meeting_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-black hover:text-[#CCF300] transition-colors"
                      title="Entrar na Reunião"
                    >
                      <Video className="w-4 h-4" />
                    </a>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </td>
                <td className="py-4 text-right">
                  {(interview.status === 'AGENDADA' || interview.status === 'AGUARDANDO_RESPOSTA') && (
                    <button
                      onClick={() => setInterviewToCancel(interview)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                      title="Cancelar Entrevista"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL DE CANCELAMENTO */}
      {interviewToCancel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl relative animate-slide-up border border-slate-200">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-red-200">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            
            <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Cancelar Entrevista?</h3>
            <p className="text-slate-500 mb-8">
              Tem certeza que deseja cancelar esta entrevista com <strong className="text-slate-700">{interviewToCancel.candidate_name}</strong>? O candidato será notificado via WhatsApp.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setInterviewToCancel(null)}
                disabled={isCanceling}
                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                onClick={handleCancelInterview}
                disabled={isCanceling}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isCanceling ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Cancelando...
                  </>
                ) : (
                  'Sim, cancelar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
