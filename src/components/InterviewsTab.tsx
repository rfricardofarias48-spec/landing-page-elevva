import React, { useState, useMemo } from 'react';
import { Calendar, Clock, Video, CheckCircle2, XCircle, AlertCircle, Trash2, Filter, Phone, Briefcase, User, Link as LinkIcon, Download, Eye, FileText, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { Interview } from '../types';
import { supabase } from '../services/supabaseClient';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
  interviews: Interview[];
  initialSelectedInterview?: Interview | null;
  onClearInitialSelectedInterview?: () => void;
  onOpenChat?: (interviewId: string, candidateName: string) => void;
  onRefresh?: () => void;
  approvedCandidateIds?: Set<string>;
}

export const InterviewsTab: React.FC<Props> = ({ interviews, initialSelectedInterview, onClearInitialSelectedInterview, onOpenChat, onRefresh, approvedCandidateIds = new Set() }) => {
  const [interviewToCancel, setInterviewToCancel] = useState<Interview | null>(null);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(initialSelectedInterview || null);
  const [isCanceling, setIsCanceling] = useState(false);

  React.useEffect(() => {
    if (initialSelectedInterview) {
      setSelectedInterview(initialSelectedInterview);
      onClearInitialSelectedInterview?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelectedInterview]);

  // Approve/Reject state
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState<Interview | null>(null);

  const isCandidateApproved = (interview: Interview) => {
    if (interview.status === 'APROVADO') return true;
    return interview.candidate_id ? approvedCandidateIds.has(interview.candidate_id) : false;
  };

  const handleApprove = async (interview: Interview) => {
    if (!interview.candidate_id) return;
    setActionLoadingId(interview.id + '_approve');
    try {
      const { error } = await supabase
        .from('candidates')
        .update({ status: 'APROVADO' })
        .eq('id', interview.candidate_id);
      if (error) throw error;

      // Atualiza status da entrevista para APROVADO
      const { error: interviewError } = await supabase
        .from('interviews')
        .update({ status: 'APROVADO' })
        .eq('id', interview.id);
      if (interviewError) throw interviewError;

      onRefresh?.();
    } catch (err) {
      console.error('Erro ao aprovar:', err);
      alert('Erro ao aprovar candidato. Tente novamente.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUnapprove = async (interview: Interview) => {
    if (!interview.candidate_id) return;
    setActionLoadingId(interview.id + '_unapprove');
    try {
      const { error } = await supabase
        .from('candidates')
        .update({ status: 'COMPLETED' })
        .eq('id', interview.candidate_id);
      if (error) throw error;

      // Reverte status da entrevista para CONFIRMADA
      const { error: interviewError } = await supabase
        .from('interviews')
        .update({ status: 'CONFIRMADA' })
        .eq('id', interview.id);
      if (interviewError) throw interviewError;

      onRefresh?.();
    } catch (err) {
      console.error('Erro ao cancelar aprovação:', err);
      alert('Erro ao cancelar aprovação. Tente novamente.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (interview: Interview) => {
    if (!interview.candidate_id) return;
    setActionLoadingId(interview.id + '_reject');
    try {
      const { error } = await supabase
        .from('candidates')
        .delete()
        .eq('id', interview.candidate_id);
      if (error) throw error;

      // Also delete the interview record
      await supabase
        .from('interviews')
        .delete()
        .eq('id', interview.id);

      setConfirmReject(null);
      onRefresh?.();
    } catch (err) {
      console.error('Erro ao reprovar:', err);
      alert('Erro ao reprovar candidato. Tente novamente.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter states
  const [dateStart, setDateStart] = useState<string>('');
  const [dateEnd, setDateEnd] = useState<string>('');
  const [jobFilter, setJobFilter] = useState<string>('');
  const [interviewerFilter, setInterviewerFilter] = useState<string>('');

  // Unique values for dropdowns
  const uniqueJobs = useMemo(() => Array.from(new Set(interviews.map(i => i.job_title).filter(Boolean))), [interviews]);
  const uniqueInterviewers = useMemo(() => Array.from(new Set(interviews.map(i => i.interviewer_name).filter(Boolean))), [interviews]);

  // Filtered interviews
  const filteredInterviews = useMemo(() => {
    return interviews.filter(interview => {
      let match = true;
      if (jobFilter && interview.job_title !== jobFilter) match = false;
      if (interviewerFilter && interview.interviewer_name !== interviewerFilter) match = false;
      
      if (dateStart && interview.scheduled_date) {
        if (interview.scheduled_date < dateStart) match = false;
      }
      if (dateEnd && interview.scheduled_date) {
        if (interview.scheduled_date > dateEnd) match = false;
      }
      return match;
    });
  }, [interviews, jobFilter, interviewerFilter, dateStart, dateEnd]);

  const formatName = (fullName: string) => {
    if (!fullName) return 'Candidato';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1]}`;
  };

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
      case 'AGUARDANDO_RESPOSTA': return <AlertCircle className="w-3.5 h-3.5" />;
      case 'AGENDADA': return <Calendar className="w-3.5 h-3.5" />;
      case 'CONFIRMADA': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'APROVADO': return <ThumbsUp className="w-3.5 h-3.5" />;
      case 'REMARCADA': return <Clock className="w-3.5 h-3.5" />;
      case 'COMPLETED':
      case 'REALIZADA': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'CANCELADA': return <XCircle className="w-3.5 h-3.5" />;
      default: return <Clock className="w-3.5 h-3.5" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'AGUARDANDO_RESPOSTA': return 'Aguardando Candidato';
      case 'AGENDADA': return 'Agendada';
      case 'CONFIRMADA': return 'Confirmada';
      case 'APROVADO': return 'Aprovado';
      case 'REMARCADA': return 'Remarcada';
      case 'COMPLETED':
      case 'REALIZADA': return 'Concluída';
      case 'CANCELADA': return 'Cancelada';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AGUARDANDO_RESPOSTA': return 'bg-amber-500 text-white shadow-[0_4px_14px_0_rgba(245,158,11,0.4)] border-transparent';
      case 'AGENDADA': return 'bg-blue-500 text-white shadow-[0_4px_14px_0_rgba(59,130,246,0.4)] border-transparent';
      case 'CONFIRMADA': return 'bg-emerald-500 text-white shadow-[0_4px_14px_0_rgba(16,185,129,0.4)] border-transparent';
      case 'APROVADO': return 'bg-[#65a30d] text-white shadow-[0_4px_14px_0_rgba(101,163,13,0.4)] border-transparent';
      case 'REMARCADA': return 'bg-purple-500 text-white shadow-[0_4px_14px_0_rgba(168,85,247,0.4)] border-transparent';
      case 'COMPLETED':
      case 'REALIZADA': return 'bg-[#65a30d] text-white shadow-[0_4px_14px_0_rgba(101,163,13,0.4)] border-transparent';
      case 'CANCELADA': return 'bg-red-500 text-white shadow-[0_4px_14px_0_rgba(239,68,68,0.4)] border-transparent';
      default: return 'bg-slate-800 text-white shadow-[0_4px_14px_0_rgba(30,41,59,0.4)] border-transparent';
    }
  };

  const handleCancelInterview = async () => {
    if (!interviewToCancel) return;
    setIsCanceling(true);

    try {
      // Call backend endpoint — handles Google Calendar deletion, WhatsApp notification, slot cleanup
      const res = await fetch(`/api/interviews/${interviewToCancel.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Erro ao cancelar');

    } catch (error) {
      console.error("Erro ao cancelar entrevista:", error);
      alert("Ocorreu um erro ao cancelar a entrevista. Tente novamente.");
    } finally {
      setIsCanceling(false);
      setInterviewToCancel(null);
      if (selectedInterview?.id === interviewToCancel.id) {
        setSelectedInterview(null);
      }
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Relatório de Entrevistas', 14, 22);
    
    const tableColumn = ["Candidato", "Vaga", "Entrevistador", "Status", "Data", "Hora"];
    const tableRows: (string | undefined)[][] = [];
    
    filteredInterviews.forEach(interview => {
      const date = interview.scheduled_date ? new Date(interview.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR') : 'A definir';
      const time = interview.scheduled_time || '-';
      const interviewData = [
        formatName(interview.candidate_name),
        interview.job_title || 'Vaga',
        interview.interviewer_name || 'Não definido',
        getStatusText(interview.status),
        date,
        time
      ];
      tableRows.push(interviewData);
    });
    
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
    });
    
    doc.save('entrevistas.pdf');
  };

  const handleOpenPdf = (e: React.MouseEvent, filePath?: string) => {
    e.preventDefault(); 
    e.stopPropagation();
    if (!filePath) {
      alert("Arquivo indisponível.");
      return;
    }
    
    // Se já for um link completo (ex: http://...), abre direto
    if (filePath.startsWith('http')) {
        window.open(filePath, '_blank');
        return;
    }

    const cleanPath = filePath.replace(/^curriculos\//, '');
    const { data } = supabase.storage.from('curriculos').getPublicUrl(cleanPath);
    if (data?.publicUrl) window.open(data.publicUrl, '_blank');
  };

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 p-6 md:p-8 shadow-[0px_4px_20px_rgba(0,0,0,0.02)] animate-fade-in relative overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shrink-0">
            <Calendar className="w-6 h-6 text-[#65a30d]" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">Entrevistas</h1>
            <p className="text-slate-500 font-medium mt-1 text-sm">Acompanhe os agendamentos feitos pelo agente.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <a
            href="https://calendar.google.com/calendar/r"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm"
          >
            <img src="https://img.icons8.com/color/480/google-calendar--v2.png" alt="Google Calendar" className="w-4 h-4" />
            Abrir Agenda
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 mb-8 p-5 bg-slate-50/50 rounded-2xl border border-slate-100">
        <div className="flex items-center gap-2 w-full mb-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-bold text-slate-700">Filtros</span>
        </div>
        
        <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
          <label className="text-xs font-bold text-slate-500">Data Inicial</label>
          <input
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#65a30d] focus:border-transparent shadow-sm"
          />
        </div>
        
        <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
          <label className="text-xs font-bold text-slate-500">Data Final</label>
          <input
            type="date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#65a30d] focus:border-transparent shadow-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
          <label className="text-xs font-bold text-slate-500">Cargo</label>
          <select
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#65a30d] focus:border-transparent appearance-none shadow-sm"
          >
            <option value="">Todos os cargos</option>
            {uniqueJobs.map(job => (
              <option key={job} value={job}>{job}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
          <label className="text-xs font-bold text-slate-500">Entrevistador</label>
          <select
            value={interviewerFilter}
            onChange={(e) => setInterviewerFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#65a30d] focus:border-transparent appearance-none shadow-sm"
          >
            <option value="">Todos os entrevistadores</option>
            {uniqueInterviewers.map(interviewer => (
              <option key={interviewer} value={interviewer}>{interviewer}</option>
            ))}
          </select>
        </div>
        
        {(dateStart || dateEnd || jobFilter || interviewerFilter) && (
          <button
            onClick={() => {
              setDateStart('');
              setDateEnd('');
              setJobFilter('');
              setInterviewerFilter('');
            }}
            className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors"
          >
            Limpar
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[900px] flex flex-col">
          {/* Header */}
          <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_0.5fr_0.5fr] gap-4 px-6 py-4 border-b border-slate-100 mb-2 items-center">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Candidato</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Vaga</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Entrevistador</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Data & Hora</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Link</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Ações</div>
          </div>

          {/* Rows */}
          {filteredInterviews.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-medium">Nenhuma entrevista encontrada com os filtros atuais.</div>
          ) : (
            filteredInterviews.map((interview) => {
              const isActive = interview.status === 'AGENDADA' || interview.status === 'CONFIRMADA' || interview.status === 'REMARCADA' || interview.status === 'COMPLETED' || interview.status === 'REALIZADA' || interview.status === 'APROVADO';
              const rowClasses = isActive
                ? 'bg-[#65a30d]/5 border-transparent'
                : 'bg-white border-b border-slate-50 hover:bg-slate-50/50';

              return (
                <div 
                  key={interview.id} 
                  onClick={() => setSelectedInterview(interview)}
                  className={`grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_0.5fr_0.5fr] gap-4 items-center px-6 py-4 rounded-2xl transition-all cursor-pointer ${rowClasses}`}
                >
                  
                  {/* Candidato */}
                  <div className="text-center">
                    <div className="font-bold text-sm text-slate-900">{formatName(interview.candidate_name)}</div>
                  </div>

                  {/* Vaga */}
                  <div className="text-center">
                    <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      {interview.job_title || 'Vaga'}
                    </div>
                  </div>

                  {/* Entrevistador */}
                  <div className="flex items-center justify-center gap-2">
                    {interview.interviewer_name ? (
                      <span className="text-xs font-medium text-slate-700">{interview.interviewer_name}</span>
                    ) : (
                      <span className="text-xs font-medium text-slate-400 italic">Não definido</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="flex justify-center">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all ${getStatusColor(interview.status)}`}>
                      {getStatusIcon(interview.status)}
                      {getStatusText(interview.status)}
                    </div>
                  </div>

                  {/* Data & Hora */}
                  <div className="flex justify-center">
                    {interview.scheduled_date ? (
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(interview.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                        </div>
                        {interview.scheduled_time && (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {interview.scheduled_time}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        A definir
                      </span>
                    )}
                  </div>

                  {/* Link */}
                  <div className="flex justify-center">
                    {interview.meeting_link ? (
                      <a
                        href={interview.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 text-slate-600 hover:bg-[#65a30d] hover:text-white transition-all"
                        title="Entrar na Reunião"
                      >
                        <Video className="w-4 h-4" />
                      </a>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex justify-center gap-1.5">
                    {/* Aprovar/Reprovar - para CONFIRMADA, REALIZADA e APROVADO */}
                    {['CONFIRMADA', 'REALIZADA', 'APROVADO'].includes(interview.status) && (
                      <>
                        {isCandidateApproved(interview) ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnapprove(interview);
                            }}
                            disabled={actionLoadingId === interview.id + '_unapprove'}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-all disabled:opacity-50"
                            title="Clique para cancelar aprovação"
                          >
                            {actionLoadingId === interview.id + '_unapprove' ? <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApprove(interview);
                              }}
                              disabled={actionLoadingId === interview.id + '_approve'}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-xl text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600 transition-all disabled:opacity-50"
                              title="Aprovar Candidato"
                            >
                              {actionLoadingId === interview.id + '_approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmReject(interview);
                              }}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-xl text-red-400 hover:bg-red-50 hover:text-red-500 transition-all"
                              title="Reprovar Candidato"
                            >
                              <ThumbsDown className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </>
                    )}
                    <button
                      onClick={(e) => handleOpenPdf(e, interview.candidate_file_path)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all"
                      title="Abrir PDF"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {['AGENDADA', 'AGUARDANDO_RESPOSTA', 'CONFIRMADA', 'REMARCADA'].includes(interview.status) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setInterviewToCancel(interview);
                        }}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"
                        title="Cancelar Entrevista"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL DE DETALHES DA ENTREVISTA */}
      {selectedInterview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setSelectedInterview(null)}>
          <div 
            className="bg-white rounded-[2rem] w-full max-w-lg p-8 shadow-2xl relative animate-slide-up border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setSelectedInterview(null)}
              className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-[#84cc16]/20 rounded-2xl flex items-center justify-center border border-[#84cc16]/30">
                <User className="w-8 h-8 text-[#a3c200]" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{selectedInterview.candidate_name}</h3>
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[10px] font-bold uppercase tracking-widest mt-2 border transition-all ${getStatusColor(selectedInterview.status)}`}>
                  {getStatusIcon(selectedInterview.status)}
                  {getStatusText(selectedInterview.status)}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-200">
                  <Phone className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Telefone</div>
                  <div className="text-sm font-black text-slate-700">{selectedInterview.candidate_phone || 'Não informado'}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-200">
                  <Briefcase className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vaga</div>
                  <div className="text-sm font-black text-slate-700">{selectedInterview.job_title || 'Não informada'}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-200">
                  <User className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Entrevistador</div>
                  <div className="text-sm font-black text-slate-700">{selectedInterview.interviewer_name || 'Não definido'}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-200">
                  <Calendar className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Data e Hora</div>
                  <div className="text-sm font-black text-slate-700">
                    {selectedInterview.scheduled_date ? (
                      `${new Date(selectedInterview.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR')} ${selectedInterview.scheduled_time ? `às ${selectedInterview.scheduled_time}` : ''}`
                    ) : (
                      'A definir'
                    )}
                  </div>
                </div>
              </div>

              {selectedInterview.meeting_link && (
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-200">
                    <LinkIcon className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Link da Reunião</div>
                    <a 
                      href={selectedInterview.meeting_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm font-black text-blue-500 hover:text-blue-600 truncate block"
                    >
                      {selectedInterview.meeting_link}
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={(e) => handleOpenPdf(e, selectedInterview.candidate_file_path)}
                className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm transition-all"
              >
                <FileText className="w-4 h-4" />
                Ver Currículo
              </button>
              <button
                onClick={() => setSelectedInterview(null)}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CANCELAMENTO */}
      {interviewToCancel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl relative animate-slide-up border border-slate-200">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-red-200">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            
            <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-2">Cancelar Entrevista?</h3>
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
      {/* MODAL DE REPROVAÇÃO */}
      {confirmReject && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl relative animate-slide-up border border-slate-200">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-red-200">
              <ThumbsDown className="w-8 h-8 text-red-500" />
            </div>

            <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-2">Reprovar Candidato?</h3>
            <p className="text-slate-500 mb-8">
              Tem certeza que deseja reprovar <strong className="text-slate-700">{confirmReject.candidate_name}</strong>? O candidato e a entrevista serão removidos permanentemente.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmReject(null)}
                disabled={!!actionLoadingId}
                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                onClick={() => handleReject(confirmReject)}
                disabled={!!actionLoadingId}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoadingId === confirmReject.id + '_reject' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Removendo...
                  </>
                ) : (
                  'Sim, reprovar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
