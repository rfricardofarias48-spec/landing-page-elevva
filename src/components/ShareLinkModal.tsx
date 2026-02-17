import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Link as LinkIcon, Globe, AlertTriangle } from 'lucide-react';
import { Job } from '../types';
import { supabase } from '../services/supabaseClient';

interface Props {
  job: Job;
  onClose: () => void;
  onUpdateJob?: (updatedJob: Job) => void; 
}

export const ShareLinkModal: React.FC<Props> = ({ job, onClose, onUpdateJob }) => {
  const [copied, setCopied] = useState(false);
  const [isBlobOrLocal, setIsBlobOrLocal] = useState(false);

  // Gera o link curto se existir, senão usa o fallback antigo
  const origin = window.location.origin.replace(/\/$/, '');
  
  // Usando Query Param (?v=) para evitar problemas de hash com autenticação
  const shareUrl = job.short_code 
      ? `${origin}/?v=${job.short_code}`
      : `${origin}/?uploadJobId=${job.id}`;

  useEffect(() => {
    // Detecta se está rodando em ambiente blob ou file (comum em previews)
    if (window.location.protocol === 'blob:' || window.location.protocol === 'file:') {
        setIsBlobOrLocal(true);
    }

    // AUTO-MIGRATE: Se não tiver short_code, gera um de 4 dígitos agora
    if (!job.short_code) {
        // Gera número entre 1000 e 9999
        const newCode = Math.floor(1000 + Math.random() * 9000).toString();
        
        const migrateJob = async () => {
            const { error } = await supabase
                .from('jobs')
                .update({ short_code: newCode })
                .eq('id', job.id);
            
            if (!error && onUpdateJob) {
                onUpdateJob({ ...job, short_code: newCode });
            }
        };
        migrateJob();
    }
  }, [job]);

  const handleCopy = async () => {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = shareUrl;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            textArea.style.top = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) setCopied(true);
        }
    } catch (err) {
        console.error('Falha ao copiar:', err);
        prompt("Copie o link manualmente:", shareUrl);
    } finally {
        if (copied) setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in font-sans">
      <div className="bg-white border-2 border-black rounded-[2.5rem] w-full max-w-lg shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden relative animate-slide-up">
        
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors border border-slate-200 hover:border-black text-slate-400 hover:text-black z-20 group">
            <X className="w-5 h-5 group-hover:scale-110 transition-transform"/>
        </button>

        <div className="p-8 pb-6">
           <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mb-6 shadow-[4px_4px_0px_0px_rgba(204,243,0,1)] transform -rotate-3 border-2 border-black">
              <LinkIcon className="w-8 h-8 text-[#CCF300]" />
           </div>
           
           <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">Link de Candidatura</h2>
           <p className="text-slate-500 font-bold text-sm">Compartilhe este link para receber currículos.</p>
        </div>

        <div className="px-8 space-y-6 pb-8">
            <div className="bg-slate-50 rounded-2xl p-6 border-2 border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Vaga Selecionada</p>
                <p className="text-slate-900 font-black text-xl tracking-tight leading-tight line-clamp-2">{job.title}</p>
            </div>

            {isBlobOrLocal && (
                <div className="bg-amber-50 border-2 border-amber-100 rounded-xl p-4 flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                    <div>
                        <h4 className="text-amber-700 font-bold text-xs uppercase mb-1">Modo de Pré-visualização</h4>
                        <p className="text-amber-600 text-xs font-medium leading-relaxed">
                            Este link não funcionará externamente porque você está em ambiente local/blob. Publique o app para usar.
                        </p>
                    </div>
                </div>
            )}

            <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block ml-1">Link Público</label>
                <div className="flex gap-2">
                    <div className="flex-1 bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-mono truncate flex items-center gap-3 text-slate-600 font-bold shadow-sm">
                        <Globe className="w-4 h-4 shrink-0 text-slate-400" />
                        <span className="truncate">{shareUrl}</span>
                    </div>
                    <button 
                        onClick={handleCopy}
                        className={`px-6 rounded-xl font-black text-sm transition-all flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-none border-2 border-black ${copied ? 'bg-[#CCF300] text-black' : 'bg-black text-white hover:bg-slate-900'}`}
                    >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copiado' : 'Copiar'}
                    </button>
                </div>
                {!isBlobOrLocal && !job.short_code && (
                    <p className="text-[10px] text-slate-400 font-bold mt-2 ml-1">
                        * Link legado (longo). Novas vagas terão links curtos.
                    </p>
                )}
            </div>
        </div>
        
        {/* Footer Brand */}
        <div className="bg-slate-50 p-4 text-center border-t-2 border-slate-100">
             <div className="flex items-center justify-center gap-2 opacity-50 grayscale hover:grayscale-0 transition-all cursor-default">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Powered by</span>
                <img src="https://ik.imagekit.io/xsbrdnr0y/elevva-logo.png" alt="Logo" className="h-4 w-auto" />
             </div>
        </div>

      </div>
    </div>
  );
};