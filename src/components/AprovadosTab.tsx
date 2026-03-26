import React, { useState, useMemo } from 'react';
import { UserCheck, FileText, Clock, CheckCircle2, Download, AlertTriangle, Search, Briefcase, Send, Eye, Loader2, Trash2 } from 'lucide-react';
import { Admission, Job, Candidate, CandidateStatus } from '../types';
import { supabase } from '../services/supabaseClient';
import { AdmissionDocsModal } from './AdmissionDocsModal';

interface Props {
  admissions: Admission[];
  jobs: Job[];
  onRefresh: () => void;
}

export const AprovadosTab: React.FC<Props> = ({ admissions, jobs, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<{ id: string; name: string; phone: string; jobId: string; jobTitle: string } | null>(null);
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null);

  // Get all approved candidates from jobs
  const approvedCandidates = useMemo(() => {
    const candidates: { id: string; name: string; phone: string; jobId: string; jobTitle: string; score: number; status: string }[] = [];

    jobs.forEach(job => {
      job.candidates
        .filter(c => c.status === CandidateStatus.APROVADO)
        .forEach(c => {
          const admission = admissions.find(a => a.candidate_id === c.id);
          candidates.push({
            id: c.id,
            name: c.result?.candidateName || 'Candidato',
            phone: c.whatsapp || '',
            jobId: job.id,
            jobTitle: job.title,
            score: c.result?.matchScore || 0,
            status: admission?.status || 'NO_ADMISSION',
          });
        });
    });

    return candidates;
  }, [jobs, admissions]);

  // Filter
  const filteredCandidates = useMemo(() => {
    return approvedCandidates.filter(c => {
      if (searchTerm && !c.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (jobFilter && c.jobId !== jobFilter) return false;
      if (statusFilter) {
        const admission = admissions.find(a => a.candidate_id === c.id);
        if (statusFilter === 'NO_ADMISSION' && admission) return false;
        if (statusFilter !== 'NO_ADMISSION' && admission?.status !== statusFilter) return false;
      }
      return true;
    });
  }, [approvedCandidates, searchTerm, jobFilter, statusFilter, admissions]);

  // Unique jobs for filter
  const uniqueJobs = useMemo(() => {
    const seen = new Set<string>();
    return approvedCandidates
      .filter(c => { if (seen.has(c.jobId)) return false; seen.add(c.jobId); return true; })
      .map(c => ({ id: c.jobId, title: c.jobTitle }));
  }, [approvedCandidates]);

  const getAdmissionForCandidate = (candidateId: string) => {
    return admissions.find(a => a.candidate_id === candidateId);
  };

  const getStatusBadge = (candidateId: string) => {
    const admission = getAdmissionForCandidate(candidateId);
    if (!admission) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
          <Clock className="w-3.5 h-3.5" />
          Aguardando envio
        </span>
      );
    }
    switch (admission.status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200">
            <Send className="w-3.5 h-3.5" />
            Link enviado
          </span>
        );
      case 'SUBMITTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Docs recebidos
          </span>
        );
      case 'DOWNLOADED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200">
            <Download className="w-3.5 h-3.5" />
            PDF baixado
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-50 text-red-500 border border-red-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Expirado (LGPD)
          </span>
        );
      default:
        return null;
    }
  };

  const handleRequestDocs = (candidate: typeof approvedCandidates[0]) => {
    setSelectedCandidate({
      id: candidate.id,
      name: candidate.name,
      phone: candidate.phone,
      jobId: candidate.jobId,
      jobTitle: candidate.jobTitle,
    });
    setShowDocsModal(true);
  };

  const handleViewDocs = (candidateId: string) => {
    const admission = getAdmissionForCandidate(candidateId);
    if (admission) {
      setSelectedAdmission(admission);
    }
  };

  const handleDownloadDossier = async (candidateId: string) => {
    const admission = getAdmissionForCandidate(candidateId);
    if (!admission) return;

    try {
      const res = await fetch(`/api/admissions/${admission.id}/dossier`);
      if (!res.ok) throw new Error('Erro ao gerar dossiê');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dossie_${admission.candidate_name?.replace(/\s+/g, '_') || 'candidato'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      onRefresh();
    } catch (err) {
      console.error('Erro ao baixar dossiê:', err);
      alert('Erro ao gerar o dossiê PDF. Tente novamente.');
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getExpiryInfo = (admission: Admission) => {
    if (!admission.submitted_at || admission.status === 'EXPIRED') return null;
    const expiresAt = new Date(admission.submitted_at);
    expiresAt.setHours(expiresAt.getHours() + 48);
    const now = new Date();
    const hoursLeft = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)));

    if (hoursLeft <= 0) return null;

    return {
      hoursLeft,
      isUrgent: hoursLeft <= 12,
      text: hoursLeft <= 1 ? 'Expira em menos de 1h' : `Expira em ${hoursLeft}h`,
    };
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">
            Candidatos Aprovados<span className="text-[#65a30d]">.</span>
          </h1>
          <p className="text-slate-500 font-bold mt-1 text-sm">
            Gerencie a documentação de admissão dos candidatos aprovados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-400">
            {filteredCandidates.length} candidato{filteredCandidates.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* LGPD Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-800">Aviso LGPD</p>
          <p className="text-xs text-amber-600 mt-1">
            Os documentos dos candidatos são automaticamente deletados <strong>48 horas</strong> após o envio. Baixe o dossiê PDF antes do prazo.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#65a30d]/20 focus:border-[#65a30d]"
          />
        </div>
        <select
          value={jobFilter}
          onChange={e => setJobFilter(e.target.value)}
          className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#65a30d]/20 focus:border-[#65a30d]"
        >
          <option value="">Todas as vagas</option>
          {uniqueJobs.map(j => (
            <option key={j.id} value={j.id}>{j.title}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#65a30d]/20 focus:border-[#65a30d]"
        >
          <option value="">Todos os status</option>
          <option value="NO_ADMISSION">Aguardando envio</option>
          <option value="PENDING">Link enviado</option>
          <option value="SUBMITTED">Docs recebidos</option>
          <option value="DOWNLOADED">PDF baixado</option>
          <option value="EXPIRED">Expirado</option>
        </select>
      </div>

      {/* Candidates List */}
      {filteredCandidates.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <UserCheck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-black text-slate-400">Nenhum candidato aprovado</h3>
          <p className="text-sm text-slate-400 mt-2">Aprove candidatos nas suas vagas para iniciar o processo de admissão.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCandidates.map(candidate => {
            const admission = getAdmissionForCandidate(candidate.id);
            const expiryInfo = admission ? getExpiryInfo(admission) : null;

            return (
              <div
                key={candidate.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-[0_4px_14px_0_rgba(0,0,0,0.05)] transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Info */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-black text-slate-900 truncate">{candidate.name}</h3>
                      <span className="text-xs font-bold text-slate-400 flex items-center gap-1 mt-1">
                        <Briefcase className="w-3.5 h-3.5" />
                        {candidate.jobTitle}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {getStatusBadge(candidate.id)}

                    {/* Expiry Warning */}
                    {expiryInfo && (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${expiryInfo.isUrgent ? 'bg-red-50 text-red-500 border border-red-200 animate-pulse' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                        <Clock className="w-3 h-3" />
                        {expiryInfo.text}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(!admission || admission.status === 'EXPIRED') && (
                      <button
                        onClick={() => handleRequestDocs(candidate)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                      >
                        <FileText className="w-4 h-4" />
                        Documentos de Admissão
                      </button>
                    )}

                    {admission?.status === 'PENDING' && (
                      <button
                        onClick={() => handleRequestDocs(candidate)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all border border-slate-200"
                      >
                        <Send className="w-4 h-4" />
                        Reenviar
                      </button>
                    )}

                    {admission?.status === 'SUBMITTED' && (
                      <>
                        <button
                          onClick={() => handleViewDocs(candidate.id)}
                          className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all border border-slate-200"
                        >
                          <Eye className="w-4 h-4" />
                          Ver Docs
                        </button>
                        <button
                          onClick={() => handleDownloadDossier(candidate.id)}
                          className="flex items-center gap-2 px-4 py-2.5 bg-[#65a30d] text-white rounded-xl text-sm font-bold hover:bg-[#4d7c0f] transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                        >
                          <Download className="w-4 h-4" />
                          Baixar Dossiê
                        </button>
                      </>
                    )}

                    {admission?.status === 'DOWNLOADED' && (
                      <button
                        onClick={() => handleDownloadDossier(candidate.id)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all border border-slate-200"
                      >
                        <Download className="w-4 h-4" />
                        Baixar Novamente
                      </button>
                    )}
                  </div>
                </div>

                {/* Submitted docs preview */}
                {admission?.status === 'SUBMITTED' && admission.submitted_docs.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-400 mb-2">Documentos recebidos:</p>
                    <div className="flex flex-wrap gap-2">
                      {admission.submitted_docs.map((doc, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          {doc.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Docs Detail Modal */}
      {selectedAdmission && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white border border-slate-100 rounded-3xl w-full max-w-lg shadow-[0px_4px_20px_rgba(0,0,0,0.05)] overflow-hidden relative animate-slide-up max-h-[90vh] overflow-y-auto">
            <button onClick={() => setSelectedAdmission(null)} className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors border border-slate-200 z-20">
              <span className="sr-only">Fechar</span>
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <div className="p-8 pb-6">
              <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mb-6 shadow-lg transform -rotate-3 border border-zinc-800">
                <Eye className="w-8 h-8 text-[#84cc16]" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter mb-1">Documentos Recebidos</h2>
              <p className="text-slate-500 font-bold text-sm">{selectedAdmission.candidate_name}</p>
            </div>

            <div className="px-8 pb-8 space-y-3">
              {selectedAdmission.submitted_docs.map((doc, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-700">{doc.name}</p>
                      <p className="text-xs text-slate-400">{doc.file_name}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">{formatDate(doc.uploaded_at)}</span>
                </div>
              ))}

              {selectedAdmission.submitted_at && (
                <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-xs font-bold text-amber-700">
                    Enviado em: {formatDate(selectedAdmission.submitted_at)}
                  </p>
                  {getExpiryInfo(selectedAdmission) && (
                    <p className={`text-xs font-bold mt-1 ${getExpiryInfo(selectedAdmission)!.isUrgent ? 'text-red-500' : 'text-amber-600'}`}>
                      {getExpiryInfo(selectedAdmission)!.text} para download
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admission Docs Modal */}
      {showDocsModal && selectedCandidate && (
        <AdmissionDocsModal
          candidate={selectedCandidate}
          onClose={() => { setShowDocsModal(false); setSelectedCandidate(null); }}
          onSuccess={() => { setShowDocsModal(false); setSelectedCandidate(null); onRefresh(); }}
        />
      )}
    </div>
  );
};
