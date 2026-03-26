import React, { useState } from 'react';
import { X, FileText, Plus, Trash2, Send, Loader2, ToggleLeft, ToggleRight, CheckSquare, Square, GripVertical } from 'lucide-react';
import { RequiredDoc, DEFAULT_ADMISSION_DOCS } from '../types';

interface Props {
  candidate: {
    id: string;
    name: string;
    phone: string;
    jobId: string;
    jobTitle: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export const AdmissionDocsModal: React.FC<Props> = ({ candidate, onClose, onSuccess }) => {
  const [docs, setDocs] = useState<RequiredDoc[]>(
    DEFAULT_ADMISSION_DOCS.map(d => ({ ...d }))
  );
  const [customDocName, setCustomDocName] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const selectedDocs = docs.filter(d => d.required);
  const hasAtLeastOne = selectedDocs.length > 0;

  const toggleDoc = (index: number) => {
    setDocs(prev => prev.map((d, i) => i === index ? { ...d, required: !d.required } : d));
  };

  const toggleFrontBack = (index: number) => {
    setDocs(prev => prev.map((d, i) => i === index ? { ...d, frontBack: !d.frontBack } : d));
  };

  const addCustomDoc = () => {
    const name = customDocName.trim();
    if (!name) return;
    if (docs.some(d => d.name.toLowerCase() === name.toLowerCase())) {
      setError('Documento já existe na lista.');
      return;
    }
    setDocs(prev => [...prev, { name, required: true, frontBack: false }]);
    setCustomDocName('');
    setError('');
  };

  const removeDoc = (index: number) => {
    setDocs(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!hasAtLeastOne) return;

    if (!candidate.phone) {
      setError('Candidato não possui WhatsApp cadastrado.');
      return;
    }

    setIsSending(true);
    setError('');

    try {
      const res = await fetch('/api/admissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: candidate.id,
          job_id: candidate.jobId,
          required_docs: selectedDocs,
          candidate_phone: candidate.phone,
          candidate_name: candidate.name,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao enviar solicitação');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar solicitação');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in font-sans">
      <div className="bg-white border border-slate-100 rounded-3xl w-full max-w-xl shadow-[0px_4px_20px_rgba(0,0,0,0.05)] overflow-hidden relative animate-slide-up max-h-[92vh] flex flex-col">
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors border border-slate-200 hover:border-slate-300 text-slate-400 hover:text-black z-20 group">
          <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </button>

        {/* Header */}
        <div className="p-8 pb-5 flex-shrink-0">
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mb-6 shadow-lg transform -rotate-3 border border-zinc-800">
            <FileText className="w-8 h-8 text-[#84cc16]" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter mb-1">Documentos de Admissão</h2>
          <p className="text-slate-500 font-bold text-sm">
            Selecione os documentos que <span className="text-slate-700">{candidate.name}</span> precisa enviar.
          </p>
          <p className="text-xs text-slate-400 mt-1">Vaga: {candidate.jobTitle}</p>
        </div>

        {/* Document List - Scrollable */}
        <div className="flex-1 overflow-y-auto px-8 custom-scrollbar">
          <div className="space-y-2">
            {docs.map((doc, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer group ${
                  doc.required
                    ? 'bg-[#65a30d]/5 border-[#65a30d]/30 shadow-sm'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
                onClick={() => toggleDoc(index)}
              >
                {/* Checkbox */}
                <div className="flex-shrink-0">
                  {doc.required ? (
                    <CheckSquare className="w-5 h-5 text-[#65a30d]" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-300 group-hover:text-slate-400" />
                  )}
                </div>

                {/* Name */}
                <span className={`flex-1 text-sm font-bold ${doc.required ? 'text-slate-800' : 'text-slate-500'}`}>
                  {doc.name}
                </span>

                {/* Front/Back Toggle */}
                {doc.required && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFrontBack(index); }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      doc.frontBack
                        ? 'bg-[#65a30d]/10 text-[#65a30d] border border-[#65a30d]/20'
                        : 'bg-slate-100 text-slate-400 border border-slate-200 hover:text-slate-500'
                    }`}
                    title="Exigir frente e verso"
                  >
                    {doc.frontBack ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                    F/V
                  </button>
                )}

                {/* Remove (only custom docs - after default list) */}
                {index >= DEFAULT_ADMISSION_DOCS.length && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeDoc(index); }}
                    className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add Custom Document */}
          <div className="mt-4 mb-2">
            <p className="text-xs font-bold text-slate-400 mb-2">Adicionar documento personalizado</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={customDocName}
                onChange={e => { setCustomDocName(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && addCustomDoc()}
                placeholder="Ex: Certificado NR-35"
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#65a30d]/20 focus:border-[#65a30d]"
              />
              <button
                onClick={addCustomDoc}
                disabled={!customDocName.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 pt-5 border-t border-slate-100 flex-shrink-0">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-600">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400">
              {selectedDocs.length} documento{selectedDocs.length !== 1 ? 's' : ''} selecionado{selectedDocs.length !== 1 ? 's' : ''}
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSend}
                disabled={!hasAtLeastOne || isSending}
                className="flex items-center gap-2 px-6 py-2.5 bg-black text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar via WhatsApp
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
