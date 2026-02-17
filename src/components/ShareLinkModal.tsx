
import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Link as LinkIcon, Globe, AlertTriangle, PauseCircle, PlayCircle, Zap, Ban } from 'lucide-react';
import { Job } from '../types';
import { supabase } from '../services/supabaseClient';

interface Props {
  job: Job;
  onClose: () => void;
  onUpdateJob?: (updatedJob: Job) => void; // Callback para atualizar o estado no App
}

export const ShareLinkModal: React.FC<Props> = ({ job, onClose, onUpdateJob }) => {
  const [copied, setCopied] = useState(false);
  const [isBlobOrLocal, setIsBlobOrLocal] = useState(false);
  
  // Local states for toggles
  const [autoAnalyze, setAutoAnalyze] = useState(job.auto_analyze || false);
  const [isPaused, setIsPaused] = useState(job.is_paused || false);
  const [updating, setUpdating] = useState(false);

  // Gera o link curto se existir, senão usa o fallback antigo
  // Remove slash final do origin se existir para evitar //
  const origin = window.location.origin.replace(/\/$/, '');
  
  // Usando Hash (#) para evitar erro 404 em servidores sem configuração SPA
  const shareUrl = job.short_code 
      ? `${origin}/#${job.short_code}`
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

  const toggleAutoAnalyze = async () => {
      setUpdating(true);
      const newValue = !autoAnalyze;
      setAutoAnalyze(newValue); // Optimistic UI
      
      try {
          const { error } = await supabase
            .from('jobs')
            .update({ auto_analyze: newValue })
            .eq('id', job.id);
            
          if (error) throw error;
          if (onUpdateJob) onUpdateJob({ ...job, auto_analyze: newValue });
      } catch (err: any) {
          console.error("Erro ao atualizar auto_analyze:", err);
          setAutoAnalyze(!newValue); // Revert
          
          if (err.message && (err.message.includes("column") || err.message.includes("policy") || err.code === '42703' || err.code === '42501')) {
             alert("Atenção: O banco de dados precisa de manutenção.\n\n1. Vá em Configurações > Banco de Dados\n2. Execute o Script V29 (Reparo Total).");
          } else {
             alert("Erro ao salvar: " + (err.message || "Verifique sua conexão."));
          }
      } finally {
          setUpdating(false);
      }
  };

  const togglePause = async () => {
      setUpdating(true);
      const newValue = !isPaused;
      setIsPaused(newValue); // Optimistic UI
      
      try {
          const { error } = await supabase
            .from('jobs')
            .update({ is_paused: newValue })
            .eq('id', job.id);
            
          if (error) throw error;
          if (onUpdateJob) onUpdateJob({ ...job, is_paused: newValue });
      } catch (err: any) {
          console.error("Erro ao atualizar is_paused:", err);
          setIsPaused(!newValue); // Revert
          
          if (err.message && (err.message.includes("column") || err.message.includes("policy") || err.code === '42703' || err.code === '42501')) {
             alert("Atenção: O banco de dados precisa de manutenção.\n\n1. Vá em Configurações > Banco de Dados\n2. Execute o Script V29 (Reparo Total).");
          } else {
             alert("Erro ao salvar: " + (err.message || "Verifique sua conexão."));
          }
      } finally {
          setUpdating(false);
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
           <p className="text-slate-500 font-bold text-sm">Gerencie como os candidatos acessam esta vaga.</p>
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

            {/* OPÇÕES AVANÇADAS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Auto Analyze Toggle */}
                <button 
                    type="button"
                    onClick={toggleAutoAnalyze}
                    disabled={updating}
                    className={`relative p-5 rounded-[1.5rem] border-2 text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group h-36 flex flex-col justify-between ${
                        autoAnalyze 
                        ? 'bg-black border-black text-white shadow-[4px_4px_0px_0px_rgba(204,243,0,1)]' 
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 shadow-sm'
                    }`}
                >
                    <div className="flex items-start justify-between w-full">
                        <div className={`p-3 rounded-2xl transition-colors ${autoAnalyze ? 'bg-white/10 text-[#CCF300]' : 'bg-slate-100 text-slate-400'}`}>
                            <Zap className="w-6 h-6" fill={autoAnalyze ? "currentColor" : "none"} />
                        </div>
                        
                        {/* Custom Toggle */}
                        <div className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 flex items-center ${autoAnalyze ? 'bg-[#CCF300]' : 'bg-slate-200'}`}>
                            <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${autoAnalyze ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                    </div>
                    
                    <div>
                        <p className={`text-xs font-black uppercase tracking-widest mb-1.5 ${autoAnalyze ? 'text-[#CCF300]' : 'text-slate-900'}`}>
                            Análise Automática
                        </p>
                        <p className={`text-[10px] font-bold leading-relaxed ${autoAnalyze ? 'text-zinc-400' : 'text-slate-400'}`}>
                            {autoAnalyze ? 'IA analisa instantaneamente após o upload.' : 'Padrão: Você analisa manualmente.'}
                        </p>
                    </div>
                </button>

                {/* Pause Toggle */}
                <button 
                    type="button"
                    onClick={togglePause}
                    disabled={updating}
                    className={`relative p-5 rounded-[1.5rem] border-2 text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group h-36 flex flex-col justify-between ${
                        !isPaused 
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-[4px_4px_0px_0px_rgba(16,185,129,0.4)]'
                        : 'bg-red-50 border-red-200 text-red-900 shadow-sm hover:border-red-300'
                    }`}
                >
                    <div className="flex items-start justify-between w-full">
                        <div className={`p-3 rounded-2xl transition-colors ${!isPaused ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
                            {!isPaused ? <PlayCircle className="w-6 h-6 fill-current" /> : <Ban className="w-6 h-6" />}
                        </div>
                        
                        {/* Custom Toggle */}
                        <div className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 flex items-center ${!isPaused ? 'bg-emerald-500' : 'bg-red-200'}`}>
                            <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${!isPaused ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                    </div>
                    
                    <div>
                        <p className={`text-xs font-black uppercase tracking-widest mb-1.5 ${!isPaused ? 'text-emerald-700' : 'text-red-700'}`}>
                            {!isPaused ? 'Recebendo CVs' : 'Vaga Encerrada'}
                        </p>
                        <p className={`text-[10px] font-bold leading-relaxed ${!isPaused ? 'text-emerald-800/70' : 'text-red-800/60'}`}>
                            {!isPaused ? 'Candidatos podem enviar currículos.' : 'Link bloqueado. Ninguém pode enviar.'}
                        </p>
                    </div>
                </button>
            </div>

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
