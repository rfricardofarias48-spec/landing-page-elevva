
import React, { useState } from 'react';
import { Job } from '../types';
import { Briefcase, ChevronRight, Users, Trash2, Pin, Sparkles, Pencil, Check, X } from 'lucide-react';

interface JobCardProps {
  job: Job;
  onClick: (job: Job) => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  onEdit: (job: Job) => void;
  isDeleting?: boolean;
}

export const JobCard: React.FC<JobCardProps> = ({ job, onClick, onDelete, onPin, onEdit, isDeleting = false }) => {
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

  const handleCardClick = () => {
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
        bg-white border border-slate-100 rounded-[2rem] p-6 relative shadow-[0px_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0px_4px_25px_rgba(0,0,0,0.05)] hover:-translate-y-1 transition-all duration-300 flex flex-col h-full select-none
        ${isDeleting ? 'opacity-70 grayscale pointer-events-none' : ''}
        ${isPinned ? 'ring-2 ring-[#65a30d] ring-offset-2' : ''}
      `}
      onMouseLeave={handleMouseLeave}
    >
        <div 
           className={`absolute inset-0 z-0 ${isDeleting ? 'cursor-not-allowed' : 'cursor-pointer'}`}
           onClick={handleCardClick}
           title="Abrir detalhes da vaga"
        />

        <div className="flex justify-between items-start mb-5 relative z-10 pointer-events-none">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-600 shrink-0 border border-slate-100">
                {isPinned ? <Sparkles className="w-5 h-5 text-[#65a30d] fill-current" /> : <Briefcase className="w-5 h-5" />}
            </div>
            
            <div className="flex gap-2 pointer-events-auto" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                {!confirmDelete ? (
                    <>
                        <button onClick={handlePinClick} className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${isPinned ? 'bg-slate-100 text-[#65a30d]' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`} title={isPinned ? 'Desafixar' : 'Fixar'}><Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} /></button>
                        <button onClick={handleEditClick} className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all bg-slate-50" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={handleDeleteClick} className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all group bg-slate-50" title="Excluir"><Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" /></button>
                    </>
                ) : (
                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl animate-fade-in h-8">
                        <span className="text-[9px] font-black text-slate-600 px-2 uppercase">Apagar?</span>
                        <button onClick={handleDeleteClick} className="w-5 h-5 flex items-center justify-center rounded bg-red-600 text-white hover:bg-red-500 border border-red-500"><Check className="w-3 h-3" /></button>
                        <button onClick={handleCancelDelete} className="w-5 h-5 flex items-center justify-center rounded bg-white text-black hover:bg-slate-100 border border-slate-300"><X className="w-3 h-3" /></button>
                    </div>
                )}
            </div>
        </div>

        <div className="mb-auto pointer-events-none">
            <h3 className="text-xl font-black text-slate-900 tracking-tighter leading-none" title={job.title}>
                {job.title} <span className="text-[10px] font-bold text-slate-400 ml-1 align-middle">{formattedDate}</span>
            </h3>

            <div className="h-1 w-10 bg-slate-200 mt-3 mb-4 rounded-full"></div>

            <p className="text-[11px] font-medium text-slate-500 leading-relaxed line-clamp-3">
                {job.description || "Descrição não informada pelo recrutador."}
            </p>
        </div>

        <div className="pt-5 mt-2 flex items-center justify-between pointer-events-none">
            <div className="bg-slate-50 px-2.5 py-1.5 rounded-full flex items-center gap-1.5 border border-slate-100">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-black text-slate-600">{job.candidates.length} {job.candidates.length === 1 ? 'CV' : 'CVs'}</span>
            </div>

            <div className="bg-slate-900 text-white px-4 py-1.5 rounded-full flex items-center gap-1.5 group-hover:bg-black transition-all">
                <span className="text-[10px] font-black uppercase tracking-wide">Analisar</span>
                <ChevronRight className="w-3 h-3 text-[#65a30d]" />
            </div>
        </div>
        
    </div>
  );
};
