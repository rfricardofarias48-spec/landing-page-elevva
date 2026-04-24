import React, { useState, useMemo } from 'react';
import { UserCheck, FileText, Clock, CheckCircle2, Download, AlertTriangle, Search, Briefcase, Send, Eye, Loader2, Trash2, ShieldCheck, MessageSquare, ExternalLink } from 'lucide-react';
import { Admission, Job, Candidate, CandidateStatus, Interview } from '../types';
import { supabase } from '../services/supabaseClient';
import { AdmissionDocsModal } from './AdmissionDocsModal';

const CHATWOOT_BASE_URL = (import.meta.env.VITE_CHATWOOT_URL || 'https://bot-chatwoot.5mljrq.easypanel.host').replace(/\/$/, '');

interface Props {
  admissions: Admission[];
  jobs: Job[];
  interviews: Interview[];
  onRefresh: () => void;
  chatwootAccountId?: number;
}

export const AprovadosTab: React.FC<Props> = ({ admissions, jobs, interviews, onRefresh, chatwootAccountId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<{ id: string; name: string; phone: string; jobId: string; jobTitle: string } | null>(null);
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const approvedCandidates = useMemo(() => {
    const approvedInterviewCandidateIds = new Set(
      interviews.filter(i => i.status === 'APROVADO').map(i => i.candidate_id).filter(Boolean)
    );

    const candidates: {
      id: string; name: string; phone: string; jobId: string; jobTitle: string;
      score: number; status: string; chatwootConversationId?: string;
    }[] = [];

    jobs.forEach(job => {
      job.candidates
        .filter(c => approvedInterviewCandidateIds.has(c.id))
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
            chatwootConversationId: c.chatwoot_conversation_id,
          });
        });
    });

    return candidates;
  }, [jobs, admissions, interviews]);

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

  const uniqueJobs = useMemo(() => {
    const seen = new Set<string>();
    return approvedCandidates
      .filter(c => { if (seen.has(c.jobId)) return false; seen.add(c.jobId); return true; })
      .map(c => ({ id: c.jobId, title: c.jobTitle }));
  }, [approvedCandidates]);

  const getAdmissionForCandidate = (candidateId: string) => admissions.find(a => a.candidate_id === candidateId);

  const getStatusBadge = (candidateId: string) => {
    const admission = getAdmissionForCandidate(candidateId);
    if (!admission) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200">
          <Clock className="w-3 h-3" />
          Aguardando envio
        </span>
      );
    }
    switch (admission.status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-200">
            <Send className="w-3 h-3" />
            Link enviado
          </span>
        );
      case 'SUBMITTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Docs recebidos
          </span>
        );
      case 'DOWNLOADED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-200">
            <Download className="w-3 h-3" />
            PDF baixado
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-red-50 text-red-500 border border-red-200">
            <AlertTriangle className="w-3 h-3" />
            Expirado
          </span>
        );
      default:
        return null;
    }
  };

  const handleRequestDocs = (candidate: typeof approvedCandidates[0]) => {
    setSelectedCandidate({ id: candidate.id, name: candidate.name, phone: candidate.phone, jobId: candidate.jobId, jobTitle: candidate.jobTitle });
    setShowDocsModal(true);
  };

  const handleViewDocs = (candidateId: string) => {
    const admission = getAdmissionForCandidate(candidateId);
    if (admission) setSelectedAdmission(admission);
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
      alert('Erro ao gerar o dossiê PDF. Tente novamente.');
    }
  };

  const handleDeleteCandidate = async (candidateId: string, candidateName: string) => {
    if (!confirm(`Tem certeza que deseja remover "${candidateName}" da lista de aprovados?`)) return;
    setDeletingId(candidateId);
    try {
      const { error } = await supabase.from('candidates').update({ status: 'COMPLETED' }).eq('id', candidateId);
      if (error) throw error;
      const admission = getAdmissionForCandidate(candidateId);
      if (admission) await supabase.from('admissions').delete().eq('id', admission.id);
      onRefresh();
    } catch (err) {
      alert('Erro ao remover candidato. Tente novamente.');
    } finally {
      setDeletingId(null);
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
    return { hoursLeft, isUrgent: hoursLeft <= 12, text: hoursLeft <= 1 ? 'Expira em < 1h' : `Expira em ${hoursLeft}h` };
  };

  const buildChatwootUrl = (conversationId?: string) => {
    if (!conversationId || !chatwootAccountId) return null;
    return `${CHATWOOT_BASE_URL}/app/accounts/${chatwootAccountId}/conversations/${conversationId}`;
  };

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 p-6 md:p-8 shadow-[0px_4px_20px_rgba(0,0,0,0.02)] animate-fade-in relative">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shrink-0">
            <UserCheck className="w-6 h-6 text-[#65a30d]" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">Aprovados</h1>
            <p className="text-slate-500 font-medium mt-1 text-sm">Gerencie a admissão dos candidatos aprovados.</p>
          </div>
        </div>
        <span className="text-sm font-bold text-slate-400">
          {filteredCandidates.length} candidato{filteredCandidates.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* LGPD Notice */}
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 flex items-center gap-3">
        <ShieldCheck className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <p className="text-xs text-slate-500 font-medium">
          Documentos deletados automaticamente <span className="font-bold text-slate-700">5 dias</span> após o envio. Baixe o PDF antes do prazo.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 mb-8 p-5 bg-slate-50/50 rounded-2xl border border-slate-100">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#65a30d] focus:border-transparent shadow-sm"
          />
        </div>
        <select
          value={jobFilter}
          onChange={e => setJobFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#65a30d] focus:border-transparent appearance-none shadow-sm min-w-[160px]"
        >
          <option value="">Todas as vagas</option>
          {uniqueJobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#65a30d] focus:border-transparent appearance-none shadow-sm min-w-[160px]"
        >
          <option value="">Todos os status</option>
          <option value="NO_ADMISSION">Aguardando envio</option>
          <option value="PENDING">Link enviado</option>
          <option value="SUBMITTED">Docs recebidos</option>
          <option value="DOWNLOADED">PDF baixado</option>
          <option value="EXPIRED">Expirado</option>
        </select>
        {(searchTerm || jobFilter || statusFilter) && (
          <button onClick={() => { setSearchTerm(''); setJobFilter(''); setStatusFilter(''); }} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">
            Limpar
          </button>
        )}
      </div>

      {/* Empty state */}
      {filteredCandidates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <UserCheck className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-black text-slate-900 mb-1">Nenhum candidato aprovado</h3>
          <p className="text-sm font-bold text-slate-500">Aprove candidatos nas entrevistas para iniciar o processo de admissão.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[800px] flex flex-col">
            {/* Table Header */}
            <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 border-b border-slate-100 mb-2 items-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Candidato</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Vaga</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Abrir conversa</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Ações</div>
            </div>

            {/* Table Rows */}
            {filteredCandidates.map(candidate => {
              const admission = getAdmissionForCandidate(candidate.id);
              const expiryInfo = admission ? getExpiryInfo(admission) : null;
              const chatwootUrl = buildChatwootUrl(candidate.chatwootConversationId);

              return (
                <div
                  key={candidate.id}
                  className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-4 items-center px-6 py-4 rounded-2xl bg-[#65a30d]/5 border-transparent mb-1 hover:bg-[#65a30d]/10 transition-all"
                >
                  {/* Candidato */}
                  <div>
                    <div className="font-bold text-sm text-slate-900">{candidate.name}</div>
                    {expiryInfo && (
                      <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-bold ${expiryInfo.isUrgent ? 'text-red-500' : 'text-slate-400'}`}>
                        <Clock className="w-3 h-3" />
                        {expiryInfo.text}
                      </span>
                    )}
                  </div>

                  {/* Vaga */}
                  <div className="text-center">
                    <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{candidate.jobTitle}</div>
                  </div>

                  {/* Status */}
                  <div className="flex justify-center">
                    {getStatusBadge(candidate.id)}
                  </div>

                  {/* Abrir conversa */}
                  <div className="flex justify-center">
                    {chatwootUrl ? (
                      <a
                        href={chatwootUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-[#65a30d] hover:text-white transition-all text-xs font-bold"
                        title="Abrir conversa no Chatwoot"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Conversa
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </a>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1.5">
                    {(!admission || admission.status === 'EXPIRED') && (
                      <button
                        onClick={() => handleRequestDocs(candidate)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-black text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all"
                        title="Enviar documentos de admissão"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Admissão
                      </button>
                    )}
                    {admission?.status === 'PENDING' && (
                      <button
                        onClick={() => handleRequestDocs(candidate)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-xl text-amber-500 hover:bg-amber-50 transition-all"
                        title="Reenviar link de documentos"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                    {admission?.status === 'SUBMITTED' && (
                      <>
                        <button
                          onClick={() => handleViewDocs(candidate.id)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-xl text-slate-500 hover:bg-slate-100 transition-all"
                          title="Ver documentos"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadDossier(candidate.id)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-xl text-[#65a30d] hover:bg-[#65a30d]/10 transition-all"
                          title="Baixar dossiê"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {admission?.status === 'DOWNLOADED' && (
                      <button
                        onClick={() => handleDownloadDossier(candidate.id)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-xl text-blue-500 hover:bg-blue-50 transition-all"
                        title="Baixar novamente"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteCandidate(candidate.id, candidate.name)}
                      disabled={deletingId === candidate.id}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40"
                      title="Remover da lista de aprovados"
                    >
                      {deletingId === candidate.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Docs Detail Modal */}
      {selectedAdmission && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white border border-slate-100 rounded-3xl w-full max-w-lg shadow-[0px_4px_20px_rgba(0,0,0,0.05)] overflow-hidden relative animate-slide-up max-h-[90vh] overflow-y-auto">
            <button onClick={() => setSelectedAdmission(null)} className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors border border-slate-200 z-20">
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
                      {doc.value ? <p className="text-xs text-slate-600 font-medium">{doc.value}</p> : <p className="text-xs text-slate-400">{doc.file_name || 'Arquivo enviado'}</p>}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">{formatDate(doc.uploaded_at)}</span>
                </div>
              ))}
              {selectedAdmission.submitted_at && (
                <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-xs font-bold text-amber-700">Enviado em: {formatDate(selectedAdmission.submitted_at)}</p>
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
