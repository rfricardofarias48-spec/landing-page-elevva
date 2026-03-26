import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, CheckCircle2, Camera, Upload, FileText, AlertTriangle, X, ChevronRight, ShieldCheck, Image as ImageIcon } from 'lucide-react';

interface RequiredDoc {
  name: string;
  required: boolean;
  frontBack: boolean;
}

interface UploadedDoc {
  name: string;
  file?: File;
  preview?: string;
  uploading?: boolean;
  uploaded?: boolean;
  error?: string;
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
  const [activeDocIndex, setActiveDocIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Fetch admission data
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/admissions/${token}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Link inválido ou expirado.');
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
          setError('Esta solicitação expirou. Os documentos foram deletados conforme a LGPD.');
          setLoading(false);
          return;
        }

        setCandidateName(data.candidate_name || '');
        setJobTitle(data.job_title || '');
        setRequiredDocs(data.required_docs || []);

        // Pre-populate uploaded docs from any previously submitted
        const existing = new Map<string, UploadedDoc>();
        if (data.submitted_docs?.length) {
          data.submitted_docs.forEach((doc: any) => {
            existing.set(doc.name, { name: doc.name, uploaded: true });
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

  // Handle file selection (camera or gallery)
  const handleFileSelect = useCallback(async (docName: string, file: File) => {
    // Create preview
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
      // Validate size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        alert('Arquivo muito grande. Máximo 10MB.');
        return;
      }
      handleFileSelect(docName, file);
    }
    // Reset input so same file can be selected again
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
  const uploadedRequiredCount = requiredDocs.filter(d => d.required && uploadedDocs.get(d.name)?.uploaded).length;
  const allRequiredUploaded = uploadedRequiredCount >= requiredCount;
  const totalUploaded = Array.from(uploadedDocs.values()).filter(d => d.uploaded).length;
  const progressPercent = requiredCount > 0 ? Math.round((uploadedRequiredCount / requiredCount) * 100) : 0;

  const handleSubmit = async () => {
    if (!allRequiredUploaded || submitting) return;
    setSubmitting(true);

    try {
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

  // Loading
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

  // Error
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-lg p-8 max-w-md w-full text-center border border-slate-200">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-black text-slate-900 mb-2">Link Indisponível</h1>
          <p className="text-slate-500 text-sm font-medium">{error}</p>
        </div>
      </div>
    );
  }

  // Already submitted
  if (alreadySubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-lg p-8 max-w-md w-full text-center border border-slate-200">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-xl font-black text-slate-900 mb-2">Documentos Já Enviados</h1>
          <p className="text-slate-500 text-sm font-medium">
            {candidateName ? `${candidateName}, seus` : 'Seus'} documentos já foram recebidos. Aguarde o contato do recrutador.
          </p>
        </div>
      </div>
    );
  }

  // Success
  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-lg p-8 max-w-md w-full text-center border border-slate-200">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-3">Documentos Enviados!</h1>
          <p className="text-slate-500 text-sm font-medium mb-6">
            {candidateName ? `Parabéns, ${candidateName.split(' ')[0]}! ` : ''}Seus documentos foram recebidos com sucesso. O recrutador entrará em contato em breve.
          </p>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-emerald-700 flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Seus dados são protegidos pela LGPD
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main upload form
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
              <h1 className="text-base font-black text-slate-900 truncate">Documentação de Admissão</h1>
              {jobTitle && <p className="text-xs text-slate-400 font-bold truncate">{jobTitle}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 pb-32">
        {/* Welcome */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5">
          <h2 className="text-lg font-black text-slate-900 mb-1">
            Olá{candidateName ? `, ${candidateName.split(' ')[0]}` : ''}! 🎉
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            Parabéns pela aprovação! Envie os documentos abaixo para finalizarmos sua admissão.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">Progresso</span>
            <span className="text-xs font-black text-[#65a30d]">{uploadedRequiredCount}/{requiredCount} obrigatórios</span>
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
          {requiredDocs.map((doc, index) => {
            const uploaded = uploadedDocs.get(doc.name);
            const isActive = activeDocIndex === index;

            return (
              <div key={doc.name} className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all">
                {/* Document Header */}
                <button
                  className="w-full flex items-center gap-3 p-4 text-left"
                  onClick={() => setActiveDocIndex(isActive ? null : index)}
                >
                  {/* Status Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                    uploaded?.uploaded
                      ? 'bg-emerald-50 border border-emerald-200'
                      : uploaded?.uploading
                        ? 'bg-amber-50 border border-amber-200'
                        : uploaded?.error
                          ? 'bg-red-50 border border-red-200'
                          : 'bg-slate-50 border border-slate-200'
                  }`}>
                    {uploaded?.uploaded ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : uploaded?.uploading ? (
                      <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                    ) : uploaded?.error ? (
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-slate-400" />
                    )}
                  </div>

                  {/* Doc Name */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${uploaded?.uploaded ? 'text-emerald-700' : 'text-slate-700'}`}>
                      {doc.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {doc.required ? 'Obrigatório' : 'Opcional'}
                      {doc.frontBack ? ' • Frente e Verso' : ''}
                    </p>
                  </div>

                  {/* Chevron */}
                  <ChevronRight className={`w-5 h-5 text-slate-300 transition-transform flex-shrink-0 ${isActive ? 'rotate-90' : ''}`} />
                </button>

                {/* Expanded: Upload Area */}
                {isActive && (
                  <div className="px-4 pb-4 animate-fade-in">
                    {/* Preview */}
                    {uploaded?.preview && (
                      <div className="relative mb-3">
                        <img
                          src={uploaded.preview}
                          alt={doc.name}
                          className="w-full h-48 object-cover rounded-xl border border-slate-200"
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); removeDoc(doc.name); }}
                          className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        {uploaded.uploaded && (
                          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500 text-white rounded-lg text-xs font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Enviado
                          </div>
                        )}
                        {uploaded.uploading && (
                          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2.5 py-1 bg-amber-500 text-white rounded-lg text-xs font-bold">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Enviando...
                          </div>
                        )}
                      </div>
                    )}

                    {/* Error */}
                    {uploaded?.error && (
                      <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600">
                        {uploaded.error} — Tente novamente.
                      </div>
                    )}

                    {/* Upload Buttons */}
                    {(!uploaded?.uploaded || uploaded?.error) && (
                      <div className="flex gap-2">
                        {/* Camera Capture */}
                        <button
                          onClick={() => cameraInputRef.current?.click()}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-black text-white rounded-xl text-sm font-bold hover:bg-slate-800 active:scale-[0.98] transition-all"
                        >
                          <Camera className="w-5 h-5" />
                          Tirar Foto
                        </button>
                        <input
                          ref={cameraInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={handleInputChange(doc.name)}
                        />

                        {/* Gallery/File Pick */}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 active:scale-[0.98] transition-all border border-slate-200"
                        >
                          <Upload className="w-5 h-5" />
                          Galeria
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={handleInputChange(doc.name)}
                        />
                      </div>
                    )}

                    {/* Replace button when already uploaded */}
                    {uploaded?.uploaded && !uploaded?.error && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => { removeDoc(doc.name); }}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all border border-slate-200"
                        >
                          Substituir documento
                        </button>
                      </div>
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
            Seus documentos são criptografados e armazenados de forma segura. Em conformidade com a LGPD, todos os dados são automaticamente deletados após o processamento.
          </p>
        </div>
      </div>

      {/* Fixed Bottom Submit Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 z-10 safe-area-bottom">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSubmit}
            disabled={!allRequiredUploaded || submitting}
            className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-base font-black transition-all ${
              allRequiredUploaded
                ? 'bg-[#65a30d] text-white hover:bg-[#4d7c0f] shadow-lg shadow-[#65a30d]/30 active:scale-[0.98]'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Finalizando...
              </>
            ) : allRequiredUploaded ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Enviar Documentos
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                {uploadedRequiredCount}/{requiredCount} obrigatórios enviados
              </>
            )}
          </button>
        </div>
      </div>

      {/* Safe area padding for iOS */}
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
