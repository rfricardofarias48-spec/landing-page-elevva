import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Niche, Job } from '../types';
import {
  ChevronRight, ChevronLeft, CheckCircle2, Check, Briefcase, Upload,
  FileText, Loader2, ShieldCheck, X, Users,
} from 'lucide-react';

interface PublicPortalProps {
  userId: string; // pode ser UUID completo ou portal_code curto (6 chars)
  onBack: () => void;
}

type Step = 'niche' | 'vagas' | 'form' | 'success';

interface PortalJob extends Job {
  niche_name?: string;
}

const MAX_FILE_MB = 5;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeFileName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

export const PublicPortalScreen: React.FC<PublicPortalProps> = ({ userId: userIdOrCode, onBack }) => {
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(UUID_REGEX.test(userIdOrCode) ? userIdOrCode : null);
  const [niches, setNiches] = useState<Niche[]>([]);
  const [allJobs, setAllJobs] = useState<PortalJob[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState<Step>('niche');
  const [selectedNiche, setSelectedNiche] = useState<Niche | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());

  // Form fields
  const [candidateName, setCandidateName] = useState('');
  const [candidatePhone, setCandidatePhone] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resolvedUserId) {
      fetchPortalData(resolvedUserId);
    } else {
      // Resolve portal_code curto → UUID real
      // Se a coluna portal_code não existir ou não achar, tenta buscar o perfil
      // pelo campo short_code de vagas associadas (fallback de emergência)
      supabase
        .from('profiles')
        .select('id')
        .eq('portal_code', userIdOrCode)
        .maybeSingle()
        .then(({ data, error }) => {
          if (data?.id) {
            setResolvedUserId(data.id);
            fetchPortalData(data.id);
          } else {
            // portal_code não encontrado (coluna pode não existir ainda)
            // tenta encontrar pelo short_code de alguma vaga
            console.warn('[Portal] portal_code not found, error:', error?.message);
            supabase
              .from('jobs')
              .select('user_id')
              .eq('short_code', userIdOrCode)
              .maybeSingle()
              .then(({ data: jobData }) => {
                if (jobData?.user_id) {
                  setResolvedUserId(jobData.user_id);
                  fetchPortalData(jobData.user_id);
                } else {
                  setLoading(false);
                }
              });
          }
        });
    }
  }, []);

  const fetchPortalData = async (userId: string) => {
    setLoading(true);
    try {
      // Busca dados da empresa
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, avatar_url')
        .eq('id', userId)
        .single();

      if (profile) {
        setCompanyName(profile.name || '');
        setLogoUrl(profile.avatar_url || '');
      }

      // Busca nichos
      const { data: nichesData } = await supabase
        .from('niches')
        .select('*')
        .eq('user_id', userId)
        .order('is_pinned', { ascending: false })
        .order('order_pos', { ascending: true });

      const nichesList: Niche[] = nichesData || [];
      setNiches(nichesList);

      // Busca vagas com nicho
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('id, title, description, criteria, short_code, niche_id, auto_analyze')
        .eq('user_id', userId)
        .not('niche_id', 'is', null)
        .eq('is_paused', false);

      const jobsList: PortalJob[] = (jobsData || []).map((j: Record<string, unknown>) => ({
        id: j.id as string,
        title: j.title as string,
        description: (j.description as string) || '',
        criteria: (j.criteria as string) || '',
        short_code: j.short_code as string,
        niche_id: j.niche_id as string,
        auto_analyze: j.auto_analyze as boolean,
        createdAt: Date.now(),
        candidates: [],
      }));

      setAllJobs(jobsList);
    } finally {
      setLoading(false);
    }
  };

  const jobsInSelectedNiche = selectedNiche
    ? allJobs.filter(j => j.niche_id === selectedNiche.id)
    : [];

  const nichesWithJobs = niches.filter(n =>
    allJobs.some(j => j.niche_id === n.id)
  );

  const handleToggleJob = (id: string) => {
    setSelectedJobIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    if (v.length > 9) v = `${v.slice(0, 9)}-${v.slice(9)}`;
    setCandidatePhone(v);
  };

  const validateFile = (file: File) => {
    if (file.type !== 'application/pdf') return 'Apenas PDF é aceito.';
    if (file.size > MAX_FILE_MB * 1024 * 1024) return `Arquivo muito grande (máx ${MAX_FILE_MB}MB).`;
    return null;
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) { setFormError(err); return; }
    setFormError(null);
    setSelectedFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) { setFormError(err); return; }
    setFormError(null);
    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypotRef.current?.value) return; // bot trap

    setFormError(null);

    const nameParts = candidateName.trim().split(/\s+/);
    if (nameParts.length < 2) {
      setFormError('Insira seu nome completo (Nome e Sobrenome).');
      return;
    }
    const cleanPhone = candidatePhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setFormError('Insira um telefone válido com DDD.');
      return;
    }
    if (!selectedFile) {
      setFormError('Anexe seu currículo em PDF.');
      return;
    }
    if (selectedJobIds.size === 0) {
      setFormError('Selecione ao menos uma vaga.');
      return;
    }

    setUploading(true);
    try {
      // Upload do PDF via API do servidor (evita restrições de RLS no Storage para anônimos)
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('userId', resolvedUserId!);

      const uploadRes = await fetch('/api/portal/upload-resume', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const uploadErr = await uploadRes.json().catch(() => ({}));
        throw new Error(uploadErr.error || 'Falha no upload do currículo');
      }

      const { filePath } = await uploadRes.json();

      // Cria um registro de candidato para cada vaga selecionada
      const inserts = Array.from(selectedJobIds).map(jobId => ({
        job_id: jobId,
        user_id: resolvedUserId,
        file_name: selectedFile.name,
        file_path: filePath,
        status: 'PENDING',
        'WhatsApp com DDD': cleanPhone,
        'Nome Completo': candidateName.trim(),
      }));

      const { error: dbError } = await supabase.from('candidates').insert(inserts);
      if (dbError) throw dbError;

      setStep('success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Portal upload error:', message);
      setFormError('Erro ao enviar candidatura. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#65a30d] animate-spin" />
      </div>
    );
  }

  // ── Portal não encontrado ──────────────────────────────────────────────
  if (!resolvedUserId) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 border border-slate-100">
          <Briefcase className="w-8 h-8 text-slate-300" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tighter mb-2">Portal não encontrado</h2>
        <p className="text-slate-500 text-sm">Verifique o link e tente novamente.</p>
      </div>
    );
  }

  // ── Sem vagas ──────────────────────────────────────────────────────────
  if (nichesWithJobs.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 border border-slate-100">
          <Briefcase className="w-8 h-8 text-slate-300" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tighter mb-2">Sem vagas no momento</h2>
        <p className="text-slate-500 text-sm">Novas oportunidades serão publicadas em breve.</p>
      </div>
    );
  }

  // ── Sucesso ──────────────────────────────────────────────────────────
  if (step === 'success') {
    const count = selectedJobIds.size;
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
        <div className="w-24 h-24 bg-[#f0fdf4] rounded-full flex items-center justify-center mb-8 border border-[#bbf7d0] shadow-[0_0_40px_-10px_rgba(101,163,13,0.3)]">
          <CheckCircle2 className="w-12 h-12 text-[#65a30d]" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-3">
          Candidatura enviada!
        </h2>
        <p className="text-slate-500 font-medium mb-2">
          Você está concorrendo a <span className="font-black text-slate-900">{count} {count === 1 ? 'vaga' : 'vagas'}</span>.
        </p>
        <p className="text-slate-400 text-sm max-w-sm">
          Seu currículo foi recebido. Em até 2 dias úteis você receberá um retorno pelo WhatsApp.
        </p>
        <div className="mt-8 flex items-center gap-2 text-[10px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-[#65a30d]" />
          Dados protegidos por criptografia
        </div>
      </div>
    );
  }

  // ── Header compartilhado ──────────────────────────────────────────────
  const renderHeader = () => (
    <header className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-4">
      <div className="max-w-2xl mx-auto flex items-center gap-4">
        {step !== 'niche' && (
          <button
            onClick={() => {
              if (step === 'vagas') { setStep('niche'); setSelectedJobIds(new Set()); }
              if (step === 'form') setStep('vagas');
            }}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-3 flex-1 min-w-0">
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="h-8 w-auto object-contain shrink-0 rounded" />
          ) : (
            <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0">
              {companyName.charAt(0).toUpperCase() || 'E'}
            </div>
          )}
          <span className="font-black text-slate-900 text-sm truncate">{companyName || 'Portal de Vagas'}</span>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          {(['niche', 'vagas', 'form'] as Step[]).map((s, i) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                s === step ? 'w-6 bg-[#65a30d]' :
                ['niche', 'vagas', 'form'].indexOf(step) > i ? 'w-3 bg-[#65a30d]/40' : 'w-3 bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>
    </header>
  );

  // ── ETAPA 1: Escolher Nicho ──────────────────────────────────────────
  if (step === 'niche') {
    return (
      <div className="min-h-screen bg-white">
        {renderHeader()}
        <div className="max-w-2xl mx-auto px-4 py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">
              Vagas Abertas
            </h1>
            <p className="text-slate-500 text-sm font-medium">
              Selecione sua área de interesse para ver as oportunidades disponíveis.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {nichesWithJobs.map(niche => {
              const count = allJobs.filter(j => j.niche_id === niche.id).length;
              return (
                <button
                  key={niche.id}
                  onClick={() => { setSelectedNiche(niche); setStep('vagas'); }}
                  className="group flex items-center justify-between bg-white border border-slate-200 hover:border-[#65a30d] hover:bg-[#f8fef0] rounded-2xl p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(101,163,13,0.12)] active:translate-y-0"
                >
                  <div>
                    <p className="font-black text-slate-900 text-base tracking-tight">{niche.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {count} {count === 1 ? 'vaga aberta' : 'vagas abertas'}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-[#65a30d] flex items-center justify-center transition-all">
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── ETAPA 2: Selecionar Vagas ────────────────────────────────────────
  if (step === 'vagas') {
    return (
      <div className="min-h-screen bg-white">
        {renderHeader()}
        <div className="max-w-2xl mx-auto px-4 py-10">
          <div className="mb-8">
            <p className="text-xs font-bold text-[#65a30d] uppercase tracking-widest mb-2">{selectedNiche?.name}</p>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">
              Escolha as vagas
            </h1>
            <p className="text-slate-500 text-sm font-medium">
              Você pode se candidatar a mais de uma vaga ao mesmo tempo com o mesmo currículo.
            </p>
          </div>

          <div className="space-y-3 mb-8">
            {jobsInSelectedNiche.map(job => {
              const isSelected = selectedJobIds.has(job.id);
              return (
                <button
                  key={job.id}
                  onClick={() => handleToggleJob(job.id)}
                  className={`w-full flex items-start gap-4 rounded-2xl border p-5 text-left transition-all ${
                    isSelected
                      ? 'border-[#65a30d] bg-[#f8fef0] shadow-[0_0_0_3px_rgba(101,163,13,0.1)]'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                    isSelected ? 'border-[#65a30d] bg-[#65a30d]' : 'border-slate-300'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 tracking-tight">{job.title}</p>
                    {job.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 font-medium leading-relaxed">
                        {job.description}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              if (selectedJobIds.size === 0) return;
              setStep('form');
            }}
            disabled={selectedJobIds.size === 0}
            className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0 border-b-4 border-[#65a30d]"
          >
            Continuar com {selectedJobIds.size > 0 ? `${selectedJobIds.size} ${selectedJobIds.size === 1 ? 'vaga' : 'vagas'}` : 'vagas selecionadas'}
            <ChevronRight className="w-4 h-4 text-[#65a30d]" />
          </button>
        </div>
      </div>
    );
  }

  // ── ETAPA 3: Formulário ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white">
      {renderHeader()}
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-[#65a30d] uppercase tracking-widest">{selectedNiche?.name}</span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs font-bold text-slate-400">{selectedJobIds.size} {selectedJobIds.size === 1 ? 'vaga' : 'vagas'}</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">
            Seus dados
          </h1>
          <p className="text-slate-500 text-sm font-medium">
            Preencha as informações e anexe seu currículo em PDF.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Honeypot */}
          <input ref={honeypotRef} type="text" name="_gotcha" className="hidden" tabIndex={-1} autoComplete="off" />

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
              Nome Completo *
            </label>
            <input
              type="text"
              value={candidateName}
              onChange={e => setCandidateName(e.target.value)}
              required
              placeholder="Ex: João da Silva"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 font-medium text-sm text-slate-900 focus:outline-none focus:border-[#65a30d] focus:ring-1 focus:ring-[#65a30d] transition-all placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
              WhatsApp com DDD *
            </label>
            <input
              type="tel"
              value={candidatePhone}
              onChange={handlePhoneChange}
              required
              placeholder="(11) 99999-9999"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 font-medium text-sm text-slate-900 focus:outline-none focus:border-[#65a30d] focus:ring-1 focus:ring-[#65a30d] transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Upload área */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
              Currículo em PDF *
            </label>
            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileSelect} />

            {selectedFile ? (
              <div className="flex items-center gap-3 bg-[#f8fef0] border border-[#65a30d]/30 rounded-xl px-4 py-3.5">
                <FileText className="w-5 h-5 text-[#65a30d] shrink-0" />
                <span className="text-sm font-bold text-slate-900 truncate flex-1">{selectedFile.name}</span>
                <button
                  type="button"
                  onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl px-4 py-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-[#65a30d] bg-[#f8fef0]'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                }`}
              >
                <Upload className={`w-6 h-6 mx-auto mb-2 transition-colors ${isDragging ? 'text-[#65a30d]' : 'text-slate-400'}`} />
                <p className="text-sm font-bold text-slate-600">Clique ou arraste seu PDF aqui</p>
                <p className="text-xs text-slate-400 mt-0.5">Máximo {MAX_FILE_MB}MB</p>
              </div>
            )}
          </div>

          {/* Vagas selecionadas resumo */}
          <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Concorrendo a</p>
            <div className="space-y-1">
              {Array.from(selectedJobIds).map(id => {
                const job = allJobs.find(j => j.id === id);
                return job ? (
                  <div key={id} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#65a30d] shrink-0" />
                    <span className="text-xs font-bold text-slate-700">{job.title}</span>
                  </div>
                ) : null;
              })}
            </div>
          </div>

          {formError && (
            <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2">
              <X className="w-4 h-4 shrink-0" />
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={uploading}
            className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 active:translate-y-0 border-b-4 border-[#65a30d] disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {uploading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Enviando...</>
            ) : (
              <>Enviar Candidatura<ChevronRight className="w-4 h-4 text-[#65a30d]" /></>
            )}
          </button>

          <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 pt-2">
            <ShieldCheck className="w-3.5 h-3.5 text-[#65a30d]" />
            Seus dados são tratados com segurança e privacidade (LGPD)
          </div>
        </form>
      </div>
    </div>
  );
};

