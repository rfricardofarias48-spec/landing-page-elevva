
import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Link as LinkIcon, Globe, AlertTriangle } from 'lucide-react';
import { Job } from '../types';

interface Props {
  job: Job;
  onClose: () => void;
}

export const ShareLinkModal: React.FC<Props> = ({ job, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [isBlobOrLocal, setIsBlobOrLocal] = useState(false);

  // Gera o link curto se existir, senão usa o fallback antigo
  // Remove slash final do origin se existir para evitar //
  const origin = window.location.origin.replace(/\/$/, '');
  
  const shareUrl = job.short_code 
      ? `${origin}/${job.short_code}`
      : `${origin}/?uploadJobId=${job.id}`;

  useEffect(() => {
    // Detecta se está rodando em ambiente blob ou file (comum em previews)
    if (window.location.protocol === 'blob:' || window.location.protocol === 'file:') {
        setIsBlobOrLocal(true);
    }
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center border border-sky-500/30">
                 <LinkIcon className="w-5 h-5 text-sky-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Link de Candidatura</h3>
                <p className="text-zinc-400 text-xs">Compartilhe este link com os candidatos</p>
              </div>
           </div>
           <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
             <X className="w-6 h-6" />
           </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
            <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
                <p className="text-sm text-zinc-300 mb-2 font-medium">Você está gerando um link para:</p>
                <p className="text-white font-bold text-lg">{job.title}</p>
            </div>

            {isBlobOrLocal && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 animate-pulse">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                    <div>
                        <h4 className="text-amber-500 font-bold text-sm mb-1">Atenção: Link de Pré-visualização</h4>
                        <p className="text-zinc-300 text-xs leading-relaxed">
                            Você está rodando o app em um modo temporário (Blob). 
                            <strong>Este link NÃO funcionará para outras pessoas.</strong> 
                            Para compartilhar, você deve publicar o app (Vercel, Netlify) ou rodar em um servidor web real.
                        </p>
                    </div>
                </div>
            )}

            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Link Público</label>
                <div className="flex gap-2">
                    <div className={`flex-1 bg-zinc-950 border rounded-xl px-4 py-3 text-sm font-mono truncate flex items-center gap-2 ${isBlobOrLocal ? 'border-amber-500/30 text-amber-500' : 'border-zinc-800 text-zinc-300'}`}>
                        <Globe className={`w-4 h-4 shrink-0 ${isBlobOrLocal ? 'text-amber-500' : 'text-zinc-600'}`} />
                        <span className="truncate">{shareUrl}</span>
                    </div>
                    <button 
                        onClick={handleCopy}
                        className={`px-4 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg ${copied ? 'bg-emerald-500 text-white' : 'bg-white hover:bg-zinc-200 text-black'}`}
                    >
                        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                        {copied ? 'Copiado!' : 'Copiar'}
                    </button>
                </div>
                {!isBlobOrLocal && !job.short_code && (
                    <div className="mt-3 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                        <p className="text-blue-400 text-xs leading-relaxed flex gap-2">
                            <span className="font-bold">Nota:</span>
                            Links curtos estarão disponíveis para novas vagas. Esta usa o formato legado.
                        </p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
