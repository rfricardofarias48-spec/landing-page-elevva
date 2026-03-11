import React from 'react';
import { Calendar, Clock, Video, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Interview } from '../types';

interface Props {
  interviews: Interview[];
  hasCalendarIntegration?: boolean;
}

export const InterviewsTab: React.FC<Props> = ({ interviews, hasCalendarIntegration }) => {
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
      case 'PENDING': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case 'SCHEDULED': return <Calendar className="w-4 h-4 text-blue-500" />;
      case 'COMPLETED': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'CANCELED': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING': return 'Aguardando Candidato';
      case 'SCHEDULED': return 'Agendada';
      case 'COMPLETED': return 'Concluída';
      case 'CANCELED': return 'Cancelada';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'SCHEDULED': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'COMPLETED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'CANCELED': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
