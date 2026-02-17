
import React, { useState } from 'react';
import { Job } from '../types';
import { Briefcase, ChevronRight, Users, Trash2, Pin, Sparkles, Pencil, Share2, Check, X } from 'lucide-react';

interface JobCardProps {
  job: Job;
  onClick: (job: Job) => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  onEdit: (job: Job) => void;
  onShare: (job: Job) => void;
  isDeleting?: boolean;
}

export const JobCard: React.FC<JobCardProps> = ({ job, onClick, onDelete, onPin, onEdit, onShare, isDeleting = false }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleMouseLeave = () => {
    if (confirmDelete) setConfirmDelete(false);
  };
  
  const handlePinClick = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    onPin(job.id);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    onEdit(job);
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    onShare(job);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (isDeleting) return; 
    if (!confirmDelete) {
        setConfirmDelete(true);
        return;
    }
    onDelete(job.id);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      setConfirmDelete(false);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isDeleting) return;
    onClick(job);
  };

  const isPinned = job.isPinned;

  // Formatação de data (DD/MM)
  const dateObj = new Date(job.createdAt);
  const formattedDate = `(${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')})`;

  return (
    <div 
      className={`
        bg-slate-50 border-2 border-black rounded-[1.5rem] p-6 relative shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col h-full select-none
        ${isDeleting ? 'opacity-70 grayscale pointer-events-none' : ''}
        ${isPinned ? 'ring-4 ring-[#CCF300] ring-offset-2' : ''}
      `}
      onMouseLeave={handleMouseLeave}
    >
        <div 
           className={`absolute inset-0 z-0 ${isDeleting ? 'cursor-not-allowed' : 'cursor-pointer'}`}
           onClick={handleCardClick}
           title="Abrir detalhes da vaga"
        />

        <div className="flex justify-between items-start mb-5 relative z-10 pointer-events-none">
            <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center text-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(204,243,0,1)] shrink-0">
                {isPinned ? <Sparkles className="w-5 h-5 text-[#CCF300] fill-current" /> : <Briefcase className="w-5 h-5" />}
            </div>
            
            <div className="flex gap-2 pointer-events-auto" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                {!confirmDelete ? (
                    <>
                        <button onClick={handleShareClick} className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-slate-200 text-emerald-600 hover:border-emerald-600 hover:bg-emerald-50 transition-all bg-white" title="Compartilhar Link"><Share2 className="w-3.5 h-3.5" /></button>
                        <button onClick={handlePinClick} className={`w-8 h-8 flex items-center justify-center rounded-lg border-2 transition-all ${isPinned ? 'bg-black border-black text-[#CCF300]' : 'border-slate-200 bg-white text-slate-300 hover:border-black hover:text-black'}`} title={isPinned ? 'Desafixar' : 'Fixar'}><Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} /></button>
                        <button onClick={handleEditClick} className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-slate-200 text-slate-300 hover:border-black hover:text-black hover:bg-white transition-all bg-white" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={handleDeleteClick} className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-slate-200 text-slate-300 hover:border-red-500 hover:text-red-500 hover:bg-white transition-all group bg-white" title="Excluir"><Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" /></button>
                    </>
                ) : (
                    <div className="flex items-center gap-2 bg-black p-1 rounded-lg border-2 border-black shadow-[3px_3px_0px_0px_rgba(204,243,0,1)] animate-fade-in h-8">
                        <span className="text-[9px] font-black text-white px-2 uppercase">Apagar?</span>
                        <button onClick={handleDeleteClick} className="w-5 h-5 flex items-center justify-center rounded bg-red-600 text-white hover:bg-red-500 border border-red-500"><Check className="w-3 h-3" /></button>
                        <button onClick={handleCancelDelete} className="w-5 h-5 flex items-center justify-center rounded bg-white text-black hover:bg-slate-100 border border-slate-300"><X className="w-3 h-3" /></button>
                    </div>
                )}
            </div>
        </div>

        <div className="mb-auto pointer-events-none">
            <h3 className="text-xl font-bold text-black tracking-tight leading-none" title={job.title}>
                {job.title} <span className="text-[10px] font-bold text-slate-400 ml-1 align-middle">{formattedDate}</span>
            </h3>

            <div className="h-1.5 w-10 bg-[#CCF300] mt-3 mb-4 rounded-full border border-black/5"></div>

            <p className="text-[11px] font-bold text-slate-500 leading-relaxed line-clamp-3">
                {job.description || "Descrição não informada pelo recrutador."}
            </p>
        </div>

        <div className="pt-5 mt-2 flex items-center justify-between pointer-events-none">
            <div className="bg-white px-2.5 py-1.5 rounded-full flex items-center gap-1.5 border-2 border-slate-200">
                <Users className="w-3.5 h-3.5 text-black" />
                <span className="text-[10px] font-black text-black">{job.candidates.length} {job.candidates.length === 1 ? 'CV' : 'CVs'}</span>
            </div>

            <div className="bg-black text-white px-4 py-1.5 rounded-full flex items-center gap-1.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(204,243,0,1)] group-hover:bg-slate-900 group-hover:shadow-[3px_3px_0px_0px_rgba(204,243,0,1)] transition-all">
                <span className="text-[10px] font-black uppercase tracking-wide">Analisar</span>
                <ChevronRight className="w-3 h-3" />
            </div>
        </div>
        
    </div>
  );
};
