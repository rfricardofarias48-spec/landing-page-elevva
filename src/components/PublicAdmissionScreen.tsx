import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, CheckCircle2, Camera, Upload, FileText, AlertTriangle, X, ChevronRight, ShieldCheck, Image as ImageIcon, Type } from 'lucide-react';

interface RequiredDoc {
  name: string;
  required: boolean;
  frontBack: boolean;
  type: 'text' | 'upload';
}

interface UploadedDoc {
  name: string;
  file?: File;
  preview?: string;
  uploading?: boolean;
  uploaded?: boolean;
  error?: string;
  value?: string; // For text fields
}

interface Props {
  token: string;
}

// Compress image client-side to max 1920px and quality 0.8
async function compressImage(file: File, maxWidth = 1920, quality = 0.8): Promise<{ base64: string; blob: Blob }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Compression failed'));
            const r2 = new FileReader();
            r2.onload = () => {
              const base64 = (r2.result as string).split(',')[1];
              resolve({ base64, blob });
            };
            r2.readAsDataURL(blob);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Convert file to base64 without compression (for PDFs)
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const PublicAdmissionScreen: React.FC<Props> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [requiredDocs, setRequiredDocs] = useState<RequiredDoc[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<Map<string, UploadedDoc>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Fetch admission data
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/admissions/${token}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Link invalido ou expirado.');
          setLoading(false);
          return;
        }

        if (data.status === 'SUBMITTED' || data.status === 'DOWNLOADED') {
          setAlreadySubmitted(true);
          setCandidateName(data.candidate_name || '');
          setLoading(false);
          return;
        }

        if (data.status === 'EXPIRED') {
          setError('Esta solicitacao expirou. Os documentos foram deletados conforme a LGPD.');
          setLoading(false);
          return;
        }

        setCandidateName(data.candidate_name || '');
        setJobTitle(data.job_title || '');
        // Ensure all docs have a type (backward compat: default to 'upload' if missing)
        const docs = (data.required_docs || []).map((d: any) => ({
          ...d,
          type: d.type || 'upload',
        }));
        setRequiredDocs(docs);

        // Pre-populate from any previously submitted docs
        const existing = new Map<string, UploadedDoc>();
        if (data.submitted_docs?.length) {
          data.submitted_docs.forEach((doc: any) => {
            existing.set(doc.name, { name: doc.name, uploaded: true, value: doc.value });
          });
        }
        setUploadedDocs(existing);
        setLoading(false);
      } catch {
        setError('Erro ao carregar dados. Tente novamente.');
        setLoading(false);
      }
    };

    load();
  }, [token]);

  // Handle text field change
  const handleTextChange = useCallback((docName: string, value: string) => {
    setUploadedDocs(prev => {
      const next = new Map(prev);
      next.set(docName, { name: docName, value, uploaded: value.trim().length > 0 });
      return next;
    });
  }, []);

  // Save text field to server
  const saveTextField = useCallback(async (docName: string, value: string) => {
    if (!value.trim()) return;
    try {
      await fetch(`/api/admissions/${token}/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_name: docName, value: value.trim() }),
      });
    } catch {
      // Silent fail on auto-save, will be validated on submit
    }
  }, [token]);

  // Handle file selection (for upload-type docs)
  const handleFileSelect = useCallback(async (docName: string, file: File) => {
    const previewUrl = URL.createObjectURL(file);

    setUploadedDocs(prev => {
      const next = new Map(prev);
      next.set(docName, { name: docName, file, preview: previewUrl, uploading: true });
      return next;
    });

    try {
      let base64: string;
      let contentType: string;

      if (file.type === 'application/pdf') {
        base64 = await fileToBase64(file);
        contentType = 'application/pdf';
      } else {
        const compressed = await compressImage(file);
        base64 = compressed.base64;
        contentType = 'image/jpeg';
      }

      const res = await fetch(`/api/admissions/${token}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_name: docName,
          file_base64: base64,
          file_name: file.name,
          content_type: contentType,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro no upload');
      }

      setUploadedDocs(prev => {
        const next = new Map(prev);
        next.set(docName, { name: docName, file, preview: previewUrl, uploaded: true });
        return next;
      });
    } catch (err: any) {
      setUploadedDocs(prev => {
        const next = new Map(prev);
        next.set(docName, { name: docName, file, preview: previewUrl, error: err.message || 'Erro no upload' });
        return next;
      });
    }
  }, [token]);

  const handleInputChange = (docName: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('Arquivo muito grande. Maximo 10MB.');
        return;
      }
      handleFileSelect(docName, file);
    }
    e.target.value = '';
  };

  const removeDoc = (docName: string) => {
    setUploadedDocs(prev => {
      const next = new Map(prev);
      const doc = next.get(docName);
      if (doc?.preview) URL.revokeObjectURL(doc.preview);
      next.delete(docName);
      return next;
    });
  };

  // Calculate progress
  const requiredCount = requiredDocs.filter(d => d.required).length;
  const completedRequiredCount = requiredDocs.filter(d => d.required && uploadedDocs.get(d.name)?.uploaded).length;
  const allRequiredDone = completedRequiredCount >= requiredCount;
  const progressPercent = requiredCount > 0 ? Math.round((completedRequiredCount / requiredCount) * 100) : 0;

  const handleSubmit = async () => {
    if (!allRequiredDone || submitting) return;

    // Save all text fields before submitting
    const textSaves: Promise<void>[] = [];
    for (const doc of requiredDocs) {
      if (doc.type === 'text') {
        const entry = uploadedDocs.get(doc.name);
        if (entry?.value?.trim()) {
          textSaves.push(saveTextField(doc.name, entry.value));
        }
      }
    }

    setSubmitting(true);
    try {
      await Promise.all(textSaves);

      const res = await fetch(`/api/admissions/${token}/submit`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao finalizar envio');
      }
      setSuccess(true);
    } catch (err: any) {
      alert(err.message || 'Erro ao finalizar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // --- RENDER ---

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#65a30d] mx-auto mb-4" />
          <p className="text-slate-500 font-bold text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-lg p-8 max-w-md w-full text-center border border-slate-200">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-black text-slate-900 mb-2">Link Indisponivel</h1>
          <p className="text-slate-500 text-sm font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-lg p-8 max-w-md w-full text-center border border-slate-200">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-xl font-black text-slate-900 mb-2">Documentos Ja Enviados</h1>
          <p className="text-slate-500 text-sm font-medium">
            {candidateName ? `${candidateName}, seus` : 'Seus'} documentos ja foram recebidos. Aguarde o contato do recrutador.
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-lg p-8 max-w-md w-full text-center border border-slate-200">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-3">Documentos Enviados!</h1>
          <p className="text-slate-500 text-sm font-medium mb-6">
            {candidateName ? `Parabens, ${candidateName.split(' ')[0]}! ` : ''}Seus documentos foram recebidos com sucesso. O recrutador entrara em contato em breve.
          </p>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-emerald-700 flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Seus dados sao protegidos pela LGPD
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-md">
              <FileText className="w-5 h-5 text-[#84cc16]" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-black text-slate-900 truncate">Documentacao de Admissao</h1>
              {jobTitle && <p className="text-xs text-slate-400 font-bold truncate">{jobTitle}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 pb-32">
        {/* Welcome */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5">
          <h2 className="text-lg font-black text-slate-900 mb-1">
            Ola{candidateName ? `, ${candidateName.split(' ')[0]}` : ''}!
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            Parabens pela aprovacao! Preencha os dados abaixo para finalizarmos sua admissao.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">Progresso</span>
            <span className="text-xs font-black text-[#65a30d]">{completedRequiredCount}/{requiredCount} obrigatorios</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#65a30d] to-[#84cc16] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Documents List */}
        <div className="space-y-3">
          {requiredDocs.map((doc) => {
            const entry = uploadedDocs.get(doc.name);
            const isTextType = doc.type === 'text';

            return (
              <div key={doc.name} className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all">
                {isTextType ? (
                  /* --- TEXT FIELD --- */
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {entry?.uploaded ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <Type className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      )}
                      <label className="text-sm font-bold text-slate-700">
                        {doc.name}
                        {doc.required && <span className="text-red-400 ml-1">*</span>}
                      </label>
                    </div>
                    <input
                      type="text"
                      value={entry?.value || ''}
                      onChange={(e) => handleTextChange(doc.name, e.target.value)}
                      onBlur={(e) => saveTextField(doc.name, e.target.value)}
                      placeholder={`Digite ${doc.name.toLowerCase()}`}
                      className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#65a30d]/20 focus:border-[#65a30d] transition-colors ${
                        entry?.uploaded ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'
                      }`}
                    />
                  </div>
                ) : (
                  /* --- UPLOAD FIELD --- */
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      {entry?.uploaded ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      ) : entry?.uploading ? (
                        <Loader2 className="w-4 h-4 text-amber-500 animate-spin flex-shrink-0" />
                      ) : entry?.error ? (
                        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      ) : (
                        <Upload className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      )}
                      <label className="text-sm font-bold text-slate-700">
                        {doc.name}
                        {doc.required && <span className="text-red-400 ml-1">*</span>}
                      </label>
                      <span className="text-xs text-blue-500 font-bold bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200 ml-auto">Upload</span>
                    </div>

                    {/* Preview */}
                    {entry?.preview && (
                      <div className="relative mb-3">
                        <img
                          src={entry.preview}
                          alt={doc.name}
                          className="w-full h-40 object-cover rounded-xl border border-slate-200"
                        />
                        <button
                          onClick={() => removeDoc(doc.name)}
                          className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        {entry.uploaded && (
                          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500 text-white rounded-lg text-xs font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Enviado
                          </div>
                        )}
                        {entry.uploading && (
                          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2.5 py-1 bg-amber-500 text-white rounded-lg text-xs font-bold">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Enviando...
                          </div>
                        )}
                      </div>
                    )}

                    {/* Error */}
                    {entry?.error && (
                      <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600">
                        {entry.error} — Tente novamente.
                      </div>
                    )}

                    {/* Upload Buttons */}
                    {(!entry?.uploaded || entry?.error) && !entry?.uploading && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.capture = 'environment';
                            input.onchange = (e: any) => {
                              const file = e.target?.files?.[0];
                              if (file) {
                                if (file.size > 10 * 1024 * 1024) { alert('Arquivo muito grande. Maximo 10MB.'); return; }
                                handleFileSelect(doc.name, file);
                              }
                            };
                            input.click();
                          }}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-black text-white rounded-xl text-sm font-bold hover:bg-slate-800 active:scale-[0.98] transition-all"
                        >
                          <Camera className="w-5 h-5" />
                          Tirar Foto
                        </button>
                        <button
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*,application/pdf';
                            input.onchange = (e: any) => {
                              const file = e.target?.files?.[0];
                              if (file) {
                                if (file.size > 10 * 1024 * 1024) { alert('Arquivo muito grande. Maximo 10MB.'); return; }
                                handleFileSelect(doc.name, file);
                              }
                            };
                            input.click();
                          }}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 active:scale-[0.98] transition-all border border-slate-200"
                        >
                          <Upload className="w-5 h-5" />
                          Galeria
                        </button>
                      </div>
                    )}

                    {/* Replace */}
                    {entry?.uploaded && !entry?.error && (
                      <button
                        onClick={() => removeDoc(doc.name)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all border border-slate-200"
                      >
                        Substituir documento
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* LGPD Notice */}
        <div className="mt-6 p-4 bg-slate-100 border border-slate-200 rounded-2xl flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#65a30d] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Seus documentos sao criptografados e armazenados de forma segura. Em conformidade com a LGPD, todos os dados sao automaticamente deletados apos o processamento.
          </p>
        </div>
      </div>

      {/* Fixed Bottom Submit Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 z-10 safe-area-bottom">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSubmit}
            disabled={!allRequiredDone || submitting}
            className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-base font-black transition-all ${
              allRequiredDone
                ? 'bg-[#65a30d] text-white hover:bg-[#4d7c0f] shadow-lg shadow-[#65a30d]/30 active:scale-[0.98]'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Finalizando...
              </>
            ) : allRequiredDone ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Enviar Documentos
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                {completedRequiredCount}/{requiredCount} obrigatorios preenchidos
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        .safe-area-bottom {
          padding-bottom: max(1rem, env(safe-area-inset-bottom));
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};
