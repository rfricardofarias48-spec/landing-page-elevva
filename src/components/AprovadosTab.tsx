import React, { useState, useMemo } from 'react';
import { UserCheck, Search, MessageSquare, ExternalLink, CheckCircle2, Loader2, Phone, X, AlertTriangle } from 'lucide-react';
import { Job, Interview } from '../types';
import { supabase } from '../services/supabaseClient';

const CHATWOOT_BASE_URL = (import.meta.env.VITE_CHATWOOT_URL || 'https://bot-chatwoot.5mljrq.easypanel.host').replace(/\/$/, '');

interface Props {
  admissions: unknown[];
  jobs: Job[];
  interviews: Interview[];
  onRefresh: () => void;
  chatwootAccountId?: number;
}

export const AprovadosTab: React.FC<Props> = ({ jobs, interviews, onRefresh, chatwootAccountId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [finalizingId, setFinalizingId] = useState<string | null>(null);
  const [confirmFinalize, setConfirmFinalize] = useState<{ id: string; name: string } | null>(null);

  const approvedCandidates = useMemo(() => {
    const approvedInterviews = interviews.filter(i => i.status === 'APROVADO');
    const approvedIdSet = new Set(approvedInterviews.map(i => i.candidate_id).filter(Boolean));

    // Map candidate_id → interview para ter data de aprovação e phone
    const interviewByCandidate = new Map(approvedInterviews.map(i => [i.candidate_id, i]));

    const result: {
      id: string;
      name: string;
      phone: string;
      jobId: string;
      jobTitle: string;
      approvedAt: string | null;
      chatwootConversationId?: string;
    }[] = [];

    jobs.forEach(job => {
      job.candidates
        .filter(c => approvedIdSet.has(c.id))
        .forEach(c => {
          const interview = interviewByCandidate.get(c.id);
          result.push({
            id: c.id,
            name: c.result?.candidateName || interview?.candidate_name || 'Candidato',
            phone: c.whatsapp || interview?.candidate_phone || '',
            jobId: job.id,
            jobTitle: job.title,
            // updated_at é quando o status virou APROVADO; fallback para created_at
            approvedAt: (interview as any)?.updated_at || interview?.created_at || null,
            chatwootConversationId: c.chatwoot_conversation_id,
          });
        });
    });

    return result;
  }, [jobs, interviews]);

  const uniqueJobs = useMemo(() => {
    const seen = new Set<string>();
    return approvedCandidates
      .filter(c => { if (seen.has(c.jobId)) return false; seen.add(c.jobId); return true; })
      .map(c => ({ id: c.jobId, title: c.jobTitle }));
  }, [approvedCandidates]);

  const filteredCandidates = useMemo(() => {
    return approvedCandidates.filter(c => {
      if (searchTerm && !c.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (jobFilter && c.jobId !== jobFilter) return false;
      if (dateFrom && c.approvedAt) {
        const d = new Date(c.approvedAt); d.setHours(0, 0, 0, 0);
        const from = new Date(dateFrom); from.setHours(0, 0, 0, 0);
        if (d < from) return false;
      }
      if (dateTo && c.approvedAt) {
        const d = new Date(c.approvedAt); d.setHours(23, 59, 59, 999);
        const to = new Date(dateTo); to.setHours(23, 59, 59, 999);
        if (d > to) return false;
      }
      return true;
    });
  }, [approvedCandidates, searchTerm, jobFilter, dateFrom, dateTo]);

  const formatApprovalDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '—';
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('55') && (clean.length === 12 || clean.length === 13)) clean = clean.slice(2);
    // 10 digits: if first digit after area code >= 6 it's a mobile missing the leading 9
    if (clean.length === 10 && parseInt(clean[2]) >= 6) clean = clean.slice(0, 2) + '9' + clean.slice(2);
    if (clean.length === 11) return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
    if (clean.length === 10) return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
    return phone;
  };

  const buildChatwootUrl = (conversationId?: string) => {
    if (!conversationId || !chatwootAccountId) return null;
    return `${CHATWOOT_BASE_URL}/app/accounts/${chatwootAccountId}/conversations/${conversationId}`;
  };

  const handleFinalize = async () => {
    if (!confirmFinalize) return;
    setFinalizingId(confirmFinalize.id);
    try {
      // Remove o candidato do processo (status COMPLETED = finalizado)
      const { error } = await supabase
        .from('candidates')
        .update({ status: 'COMPLETED' })
        .eq('id', confirmFinalize.id);
      if (error) throw error;

      // Remove a entrevista associada
      const interview = interviews.find(i => i.candidate_id === confirmFinalize.id && i.status === 'APROVADO');
      if (interview) {
        await supabase.from('interviews').delete().eq('id', interview.id);
      }

      setConfirmFinalize(null);
      onRefresh();
    } catch (err) {
      alert('Erro ao finalizar candidato. Tente novamente.');
    } finally {
      setFinalizingId(null);
    }
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
            <p className="text-slate-500 font-medium mt-1 text-sm">Candidatos aprovados no processo seletivo.</p>
          </div>
        </div>
        <span className="text-sm font-bold text-slate-400">
          {filteredCandidates.length} candidato{filteredCandidates.length !== 1 ? 's' : ''}
        </span>
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
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Aprovação:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#65a30d] focus:border-transparent shadow-sm"
          />
          <span className="text-xs text-slate-400">até</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#65a30d] focus:border-transparent shadow-sm"
          />
        </div>
        {(searchTerm || jobFilter || dateFrom || dateTo) && (
          <button onClick={() => { setSearchTerm(''); setJobFilter(''); setDateFrom(''); setDateTo(''); }} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">
            Limpar
          </button>
        )}
      </div>

      {/* Empty state */}
      {filteredCandidates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <UserCheck className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-black text-slate-900 mb-1">Nenhum candidato aprovado</h3>
          <p className="text-sm font-bold text-slate-500">Aprove candidatos nas entrevistas para vê-los aqui.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[860px] flex flex-col">

            {/* Table Header */}
            <div className="grid grid-cols-[1.8fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-4 border-b border-slate-100 mb-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Candidato</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Vaga</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Data de Aprovação</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Contato</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Abrir Conversa</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Finalizar</div>
            </div>

            {/* Rows */}
            {filteredCandidates.map(candidate => {
              const chatwootUrl = buildChatwootUrl(candidate.chatwootConversationId);
              return (
                <div
                  key={candidate.id}
                  className="grid grid-cols-[1.8fr_1fr_1fr_1fr_1fr_1fr] gap-4 items-center px-6 py-4 rounded-2xl bg-[#65a30d]/5 mb-1 hover:bg-[#65a30d]/10 transition-all"
                >
                  {/* Candidato */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#65a30d]/20 flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-black text-[#65a30d]">{candidate.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="font-bold text-sm text-slate-900 truncate">{candidate.name}</div>
                  </div>

                  {/* Vaga */}
                  <div className="text-center">
                    <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider leading-tight">{candidate.jobTitle}</div>
                  </div>

                  {/* Data de Aprovação */}
                  <div className="flex justify-center">
                    <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                      {formatApprovalDate(candidate.approvedAt)}
                    </span>
                  </div>

                  {/* Contato */}
                  <div className="flex justify-center">
                    {candidate.phone ? (
                      <a
                        href={`https://wa.me/${candidate.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-[#65a30d] transition-colors"
                        title="Abrir WhatsApp"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {formatPhone(candidate.phone)}
                      </a>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </div>

                  {/* Abrir Conversa */}
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

                  {/* Finalizar */}
                  <div className="flex justify-center">
                    <button
                      onClick={() => setConfirmFinalize({ id: candidate.id, name: candidate.name })}
                      disabled={finalizingId === candidate.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 hover:border-transparent transition-all text-xs font-bold disabled:opacity-40"
                      title="Finalizar e remover candidato"
                    >
                      {finalizingId === candidate.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <CheckCircle2 className="w-3.5 h-3.5" />
                      }
                      Finalizar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal de confirmação Finalizar */}
      {confirmFinalize && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl border border-slate-200 animate-slide-up">
            <button
              onClick={() => setConfirmFinalize(null)}
              className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-6 border border-emerald-200">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>

            <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-2">Finalizar candidato?</h3>
            <p className="text-slate-500 mb-2">
              Tem certeza que deseja finalizar <strong className="text-slate-700">{confirmFinalize.name}</strong>?
            </p>
            <p className="text-xs text-slate-400 mb-8 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
              O candidato será removido da lista de aprovados e a entrevista será encerrada.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmFinalize(null)}
                disabled={!!finalizingId}
                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleFinalize}
                disabled={!!finalizingId}
                className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {finalizingId ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Finalizando...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Sim, finalizar</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
