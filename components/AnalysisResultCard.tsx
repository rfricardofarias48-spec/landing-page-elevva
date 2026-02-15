
import React, { useState, useEffect } from 'react';
import { Candidate, CandidateStatus } from '../types';
import { CheckCircle2, XCircle, FileText, Loader2, MapPin, ThumbsUp, Trash2, Check, X, ChevronDown, ChevronUp, Briefcase, Phone, Quote, Building2, Clock, Eye, Download, CloudUpload } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface Props {
  candidate: Candidate;
  onToggleSelection?: (id: string) => void;
  onDelete?: (id: string) => void;
  index?: number; 
}

export const AnalysisResultCard: React.FC<Props> = ({ candidate, onToggleSelection, onDelete, index = 0 }) => {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Estado para animação do anel de progresso
  const [progress, setProgress] = useState(0);

  const animationDelay = { animationDelay: `${index * 100}ms` };

  useEffect(() => {
    // Pequeno delay para iniciar a animação do anel após renderizar
    if (candidate.result?.matchScore) {
        const timer = setTimeout(() => {
            setProgress(candidate.result!.matchScore * 10); // Converte nota 0-10 para 0-100%
        }, 300 + (index * 100));
        return () => clearTimeout(timer);
    }
  }, [candidate.result, index]);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirmDelete) {
        setConfirmDelete(true);
        return;
    }
    
    if (onDelete) onDelete(candidate.id);
  };

  const handleConfirmReject = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (onDelete) onDelete(candidate.id);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(false);
  };

  const handleReject = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(true);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onToggleSelection) {
      onToggleSelection(candidate.id);
    }
  };
  
  const handleExpandToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    setExpanded(!expanded);
  };

  const handleMouseLeave = () => {
    if (confirmDelete) setConfirmDelete(false);
  };

  const handleOpenPdf = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!candidate.filePath) {
          alert("Arquivo ainda sendo processado ou indisponível.");
          return;
      }

      const { data } = supabase.storage
        .from('resumes')
        .getPublicUrl(candidate.filePath);
      
      if (data?.publicUrl) {
          window.open(data.publicUrl, '_blank');
      } else {
          alert("Não foi possível gerar o link do arquivo.");
      }
  };

  // High Contrast Colors: Lime for High Score, Gray/Black for others
  const getScoreColor = (score: number) => {
    if (score >= 8.0) return '#CCF300'; // Lime
    if (score >= 5.0) return '#facc15'; // Yellow-400
    return '#ef4444'; // Red-500
  };

  // --- CARDS SIMPLES (LOADING/UPLOADING/PENDING/ERROR) ---

  if (candidate.status === CandidateStatus.UPLOADING) {
    return (
      <div className="bg-white border-2 border-black rounded-xl p-4 flex items-center justify-between mb-3 animate-fade-in shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] relative overflow-hidden">
        <div className="absolute bottom-0 left-0 h-1 bg-slate-50 w-full">
            <div className="h-full bg-black animate-pulse w-full origin-left transform scale-x-50"></div>
        </div>
        
        <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-slate-50 rounded-md border border-slate-200">
               <CloudUpload className="w-4 h-4 text-black animate-bounce" />
            </div>
            <div className="flex flex-col">
                <span className="text-slate-900 font-black text-sm truncate max-w-[300px]">{candidate.file.name}</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Enviando...</span>
            </div>
        </div>
      </div>
    );
  }

  if (candidate.status === CandidateStatus.ANALYZING) {
    return (
      <div className="bg-white border-2 border-black rounded-xl p-4 animate-pulse mb-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
        <div className="flex items-center space-x-4">
          <Loader2 className="w-5 h-5 text-black animate-spin" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-slate-100 rounded w-1/3"></div>
            <div className="h-2 bg-slate-50 rounded w-1/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (candidate.status === CandidateStatus.PENDING) {
    return (
      <div 
        className="bg-white border-2 border-slate-200 rounded-xl p-4 flex items-center justify-between mb-3 animate-slide-up hover:border-black transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,0.05)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group relative"
        style={animationDelay}  
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-slate-50 rounded-md border border-slate-200">
               <FileText className="w-4 h-4 text-slate-400 group-hover:text-black transition-colors" />
            </div>
            <span className="text-slate-700 font-bold text-sm truncate max-w-[300px] group-hover:text-black transition-colors">{candidate.file.name}</span>
        </div>
        <div 
            className="flex items-center gap-3 relative z-20"
            onMouseDown={(e) => e.stopPropagation()} 
        >
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider group-hover:text-slate-600">Aguardando</span>
            {onDelete && (
                !confirmDelete ? (
                    <button 
                        type="button"
                        onClick={handleDeleteClick}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-all cursor-pointer z-30 relative pointer-events-auto"
                        title="Remover arquivo"
                    >
                        <Trash2 className="w-4 h-4 pointer-events-none" />
                    </button>
                ) : (
                    <div className="flex items-center gap-1 bg-red-50 rounded-md border border-red-100 p-1 animate-fade-in shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]">
                        <button onClick={handleDeleteClick} className="p-1 text-red-600 hover:text-red-700"><Check className="w-3 h-3"/></button>
                        <button onClick={handleCancelDelete} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-3 h-3"/></button>
                    </div>
                )
            )}
        </div>
      </div>
    );
  }

  if (candidate.status === CandidateStatus.ERROR || !candidate.result) {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-center justify-between text-red-600 mb-3 animate-slide-up relative shadow-[4px_4px_0px_0px_rgba(239,68,68,0.2)]" onMouseLeave={handleMouseLeave}>
        <div className="flex items-center">
            <XCircle className="w-4 h-4 mr-3" />
            <span className="font-bold text-sm">Falha ao analisar {candidate.file.name}</span>
        </div>
        {onDelete && (
             !confirmDelete ? (
                <button 
                    type="button"
                    onClick={handleDeleteClick}
                    className="p-1.5 hover:bg-red-100 rounded-md transition-colors cursor-pointer relative z-20 pointer-events-auto"
                >
                    <Trash2 className="w-4 h-4 pointer-events-none" />
                </button>
             ) : (
                <div className="flex items-center gap-1 z-20 pointer-events-auto animate-fade-in">
                    <button onClick={handleDeleteClick} className="p-1 text-red-600 font-bold text-xs hover:underline">Confirmar</button>
                    <button onClick={handleCancelDelete} className="p-1 text-slate-400"><X className="w-3 h-3"/></button>
                </div>
             )
        )}
      </div>
    );
  }

  // --- CARD PRINCIPAL ---
  const { result } = candidate;
  const scoreColor = getScoreColor(result.matchScore);
  const isHighMatch = result.matchScore >= 8.0;
  
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div 
      className={`
        bg-white border rounded-xl overflow-hidden transition-all duration-300 mb-3 animate-slide-up relative group
        ${candidate.isSelected 
          ? 'border-[#CCF300] ring-1 ring-[#CCF300] shadow-md bg-[#CCF300]/5' 
          : 'border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5'}
      `}
      style={animationDelay}
      onMouseLeave={handleMouseLeave}
    >
      <div 
        className="absolute inset-0 z-0 cursor-pointer"
        onClick={handleCardClick}
        title="Clique para ver detalhes"
      />

      <div className="p-4 relative">
        <div className="flex items-center justify-between relative z-10 pointer-events-none">
          <div className="flex items-center gap-5 flex-1 min-w-0">
              <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                  <svg className="absolute top-0 left-0 w-full h-full transform -rotate-90" viewBox="0 0 52 52">
                      <circle cx="26" cy="26" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="4" />
                      <circle
                          cx="26"
                          cy="26"
                          r={radius}
                          fill="none"
                          stroke={scoreColor}
                          strokeWidth="4"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                      />
                  </svg>
                  <span className={`text-xl font-black tracking-tighter z-10 ${isHighMatch ? 'text-black' : ''}`} style={!isHighMatch ? { color: scoreColor } : {}}>
                    {result.matchScore}
                  </span>
                  <div className="absolute -top-1 -right-1 bg-black text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm border border-white">
                      #{index + 1}
                  </div>
              </div>

              <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h4 className="font-black text-slate-900 text-base tracking-tight truncate">
                        {result.candidateName}
                    </h4>
                    {candidate.isSelected && (
                      <span className="bg-[#CCF300] text-black text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded shadow-sm shrink-0 border border-black/10">
                        Selecionado
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center text-[11px] text-slate-500 font-bold mt-1 gap-3 uppercase tracking-wide">
                    <span className="flex items-center bg-slate-50 px-2 py-1 rounded border border-slate-200 text-slate-700">
                       <Briefcase className="w-3 h-3 mr-1.5 text-slate-400" />
                       {candidate.result?.yearsExperience ? candidate.result.yearsExperience : 'Exp. N/A'}
                    </span>
                    <span className="flex items-center text-slate-400">
                      <MapPin className="w-3 h-3 mr-1 text-slate-300" />
                      {result.city}
                    </span>
                  </div>
              </div>
          </div>
          
          <div 
             className="flex items-center gap-2 pl-4 border-l-2 border-slate-100 ml-4 shrink-0 relative z-50 pointer-events-auto"
             onMouseDown={(e) => e.stopPropagation()}
             onClick={(e) => e.stopPropagation()}
          >
              {onToggleSelection && (
                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleOpenPdf}
                        className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 border-2 border-slate-200 hover:bg-black hover:text-[#CCF300] hover:border-black transition-all cursor-pointer bg-white"
                        title="Abrir PDF Original"
                    >
                        <Eye className="w-4 h-4 pointer-events-none" />
                    </button>

                    {!confirmDelete ? (
                      <button
                          type="button"
                          onClick={handleReject}
                          className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 border-2 border-slate-200 hover:bg-slate-100 hover:text-slate-600 hover:border-slate-300 transition-all active:scale-95 cursor-pointer shadow-sm bg-white"
                          title="Reprovar e Excluir"
                      >
                          <Trash2 className="w-4 h-4 pointer-events-none" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 bg-red-50 rounded-lg border border-red-100 p-1 animate-fade-in shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]">
                          <button 
                            onClick={handleConfirmReject} 
                            className="w-7 h-7 flex items-center justify-center bg-red-600 text-white rounded-md transition-colors shadow-sm hover:bg-red-700"
                            title="Confirmar exclusão"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={handleCancelDelete} 
                            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                            title="Cancelar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                      </div>
                    )}

                    <button
                        type="button"
                        onClick={handleToggle}
                        className={`
                            flex items-center px-4 h-9 rounded-lg text-xs font-black transition-all transform active:scale-95 border cursor-pointer shadow-sm hover:translate-y-0.5 hover:shadow-none
                            ${candidate.isSelected 
                            ? 'bg-[#CCF300] text-black border-[#CCF300] hover:bg-[#bce000]' 
                            : 'bg-black text-white border-black hover:bg-slate-800'}
                        `}
                    >
                        <ThumbsUp className={`w-3.5 h-3.5 mr-2 pointer-events-none ${candidate.isSelected ? 'fill-current' : ''}`} />
                        {candidate.isSelected ? 'Aprovado' : 'Aprovar'}
                    </button>
                </div>
              )}
              
              <button 
                type="button"
                onClick={handleExpandToggle}
                className={`p-2 hover:bg-slate-100 rounded-lg transition-all duration-300 cursor-pointer ${expanded ? 'bg-slate-100 text-slate-900 rotate-180' : 'text-slate-400 hover:text-slate-900'}`}
              >
                 <ChevronDown className="w-4 h-4 pointer-events-none" />
              </button>
          </div>
        </div>

        {expanded && (
          <div 
             className="pt-6 mt-4 border-t-2 border-slate-100 animate-fade-in relative z-50 pointer-events-auto cursor-text"
             onClick={(e) => e.stopPropagation()} 
          >
              <div className="mb-6">
                 <h5 className="text-[10px] font-black text-black uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Quote className="w-3 h-3 fill-current text-[#CCF300]" /> Análise Profissional
                </h5>
                <p className="text-slate-700 text-sm leading-relaxed text-justify font-bold">
                    {result.summary}
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-emerald-50/50 border-2 border-emerald-100 rounded-xl p-4">
                      <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center">
                         <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Pontos Fortes
                      </h5>
                      <ul className="space-y-2">
                          {result.pros.map((pro, i) => (
                              <li key={i} className="flex items-start text-xs text-slate-800 font-bold leading-relaxed">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 mr-2 shrink-0"></span>
                                  {pro}
                              </li>
                          ))}
                      </ul>
                  </div>

                  <div className="bg-red-50/50 border-2 border-red-100 rounded-xl p-4">
                      <h5 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-3 flex items-center">
                         <XCircle className="w-3.5 h-3.5 mr-2" /> Pontos de Atenção
                      </h5>
                       <ul className="space-y-2">
                          {result.cons.map((con, i) => (
                              <li key={i} className="flex items-start text-xs text-slate-800 font-bold leading-relaxed">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 mr-2 shrink-0"></span>
                                  {con}
                              </li>
                          ))}
                      </ul>
                  </div>
              </div>

               {result.workHistory && result.workHistory.length > 0 && (
                  <div className="mt-6 pt-6 border-t-2 border-slate-100">
                     <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Briefcase className="w-3 h-3" /> Experiências Recentes
                     </h5>
                     <div className="space-y-2">
                        {result.workHistory.map((work, idx) => (
                           <div key={idx} className="flex items-center justify-between text-xs bg-slate-50 p-3 rounded-lg border-2 border-slate-100">
                              <div className="flex items-center gap-2">
                                 <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                 <span className="font-bold text-slate-900">{work.company}</span>
                                 <span className="text-slate-300">•</span>
                                 <span className="text-slate-500 font-bold">{work.role}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-500 font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                                 <Clock className="w-3 h-3" />
                                 {work.duration}
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               )}

              {result.phoneNumbers && result.phoneNumbers.length > 0 && (
                <div className="mt-6 pt-4 border-t-2 border-slate-100 flex items-center gap-3">
                   <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Contatos:
                   </h5>
                   <div className="flex flex-wrap gap-2">
                      {result.phoneNumbers.map((phone, idx) => (
                        <span key={idx} className="text-[11px] font-bold bg-slate-50 text-slate-900 px-2 py-1 rounded border border-slate-200">
                          {phone}
                        </span>
                      ))}
                   </div>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};
