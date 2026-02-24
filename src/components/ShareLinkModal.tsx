import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Link as LinkIcon, Globe, AlertTriangle, Zap } from 'lucide-react';
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
  // Remove slash final do origin se existir para evitar //
  const origin = window.location.origin.replace(/\/$/, '');
  
  // ATUALIZAÇÃO: Usando Hash (#) para evitar erro 404 em servidores sem configuração SPA
  const shareUrl = job.short_code 
      ? `${origin}/#${job.short_code}`
      : `${origin}/?uploadJobId=${job.id}`;

  useEffect(() => {
    // Detecta se está rodando em ambiente blob ou file (comum em previews)
    if (window.location.protocol === 'blob:' || window.location.protocol === 'file:') {
        setIsBlobOrLocal(true);
    }

    // AUTO-MIGRATE: Se não tiver short_code, gera um de 6 dígitos agora
    if (!job.short_code) {
        const newCode = Math.floor(100000 + Math.random() * 900000).toString();
        
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

  const handleToggleAutoAnalyze = async () => {
    const newValue = !job.auto_analyze;
    if (onUpdateJob) onUpdateJob({ ...job, auto_analyze: newValue });
    
    const { error } = await supabase
        .from('jobs')
        .update({ auto_analyze: newValue })
        .eq('id', job.id);
        
    if (error) {
        console.error('Error updating auto_analyze:', error);
        if (onUpdateJob) onUpdateJob({ ...job, auto_analyze: !newValue });
    }
  };

  const handleTogglePause = async () => {
    const newValue = !job.is_paused; 
    if (onUpdateJob) onUpdateJob({ ...job, is_paused: newValue });

    const { error } = await supabase
        .from('jobs')
        .update({ is_paused: newValue })
        .eq('id', job.id);

    if (error) {
        console.error('Error updating is_paused:', error);
        if (onUpdateJob) onUpdateJob({ ...job, is_paused: !newValue });
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

            {/* TOGGLES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Auto Analyze Card */}
                <div className={`p-5 rounded-3xl border-2 transition-all relative overflow-hidden group ${job.auto_analyze ? 'bg-black border-black text-white' : 'bg-white border-slate-200 text-slate-400'}`}>
                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className={`p-2 rounded-xl ${job.auto_analyze ? 'bg-zinc-800 text-[#CCF300]' : 'bg-slate-100 text-slate-400'}`}>
                            <Zap className="w-6 h-6 fill-current" />
                        </div>
                        <button 
                            onClick={handleToggleAutoAnalyze}
                            className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 flex items-center ${job.auto_analyze ? 'bg-[#CCF300] justify-end' : 'bg-slate-200 justify-start'}`}
                        >
                            <div className={`w-5 h-5 rounded-full shadow-sm transform transition-transform ${job.auto_analyze ? 'bg-black' : 'bg-white'}`} />
                        </button>
                    </div>
                    <h3 className={`font-black uppercase text-xs tracking-widest mb-1 ${job.auto_analyze ? 'text-[#CCF300]' : 'text-slate-500'}`}>Análise Automática</h3>
                    <p className="text-[10px] font-bold leading-tight opacity-80">IA processa e ranqueia cada currículo recebido.</p>
                </div>

                {/* Link Active Card */}
                <div className={`p-5 rounded-3xl border-2 transition-all relative overflow-hidden group ${!job.is_paused ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-white border-slate-200 text-slate-400'}`}>
                    <div className="flex justify-between items-start mb-4 relative z-10">
                         <div className={`p-2 rounded-xl ${!job.is_paused ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                            <div className={`w-3 h-3 rounded-full ${!job.is_paused ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        </div>
                        <button 
                            onClick={handleTogglePause}
                            className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 flex items-center ${!job.is_paused ? 'bg-emerald-500 justify-end' : 'bg-slate-200 justify-start'}`}
                        >
                            <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
                        </button>
                    </div>
                    <h3 className={`font-black uppercase text-xs tracking-widest mb-1 ${!job.is_paused ? 'text-emerald-700' : 'text-slate-500'}`}>Link Ativo</h3>
                    <p className="text-[10px] font-bold leading-tight opacity-80">
                        {!job.is_paused ? 'Candidatos podem enviar currículos.' : 'Envio de currículos pausado.'}
                    </p>
                </div>
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
                <span className="text-[8px] font-mono text-slate-300 ml-2">v1.0.5</span>
             </div>
        </div>

      </div>
    </div>
  );
};