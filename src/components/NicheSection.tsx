import React, { useState } from 'react';
import { Niche, Job } from '../types';
import { JobCard } from './JobCard';
import {
  ChevronDown, ChevronRight, Pin, Sparkles, Trash2, ArrowUp, ArrowDown,
  Briefcase, Check, X,
} from 'lucide-react';

interface NicheSectionProps {
  niche: Niche;
  jobs: Job[];
  isCollapsed: boolean;
  onToggle: () => void;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  isFirst: boolean;
  isLast: boolean;
  onJobClick: (job: Job) => void;
  onJobDelete: (id: string) => void;
  onJobPin: (id: string) => void;
  onJobEdit: (job: Job) => void;
  deletingJobId?: string;
}

export const NicheSection: React.FC<NicheSectionProps> = ({
  niche,
  jobs,
  isCollapsed,
  onToggle,
  onPin,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  onJobClick,
  onJobDelete,
  onJobPin,
  onJobEdit,
  deletingJobId,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isPinned = niche.is_pinned;

  const totalCvs = jobs.reduce((sum, j) => sum + j.candidates.length, 0);

  return (
    <div
      className={`rounded-[2rem] border transition-all duration-200 ${
        isPinned
          ? 'border-[#65a30d]/40 bg-[#f8fef0]'
          : 'border-slate-100 bg-white'
      } shadow-[0px_2px_12px_rgba(0,0,0,0.03)]`}
    >
      {/* ── Cabeçalho do Nicho ── */}
      <div className="flex items-center gap-3 px-5 py-4">
        {/* Toggle collapse */}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all shrink-0"
          title={isCollapsed ? 'Expandir' : 'Recolher'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {/* Pin icon */}
        {isPinned && (
          <Sparkles className="w-4 h-4 text-[#65a30d] fill-current shrink-0" />
        )}

        {/* Nome + contadores */}
        <button
          onClick={onToggle}
          className="flex-1 text-left min-w-0"
        >
          <span className="font-black text-slate-900 text-base tracking-tight truncate block">
            {niche.name}
          </span>
        </button>

        {/* Chips de info */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            {jobs.length} {jobs.length === 1 ? 'vaga' : 'vagas'}
          </span>
          {totalCvs > 0 && (
            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full">
              {totalCvs} CVs
            </span>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {!confirmDelete ? (
            <>
              <button
                onClick={() => onPin(niche.id)}
                className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${
                  isPinned
                    ? 'bg-[#65a30d]/10 text-[#65a30d]'
                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                }`}
                title={isPinned ? 'Desafixar nicho' : 'Fixar nicho no topo'}
              >
                <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={() => onMoveUp(niche.id)}
                disabled={isFirst}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Mover para cima"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onMoveDown(niche.id)}
                disabled={isLast}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Mover para baixo"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"
                title="Excluir nicho"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl animate-fade-in h-8">
              <span className="text-[9px] font-black text-slate-600 px-1.5 uppercase">
                Apagar?
              </span>
              <button
                onClick={() => { onDelete(niche.id); setConfirmDelete(false); }}
                className="w-5 h-5 flex items-center justify-center rounded bg-red-600 text-white hover:bg-red-500 border border-red-500"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="w-5 h-5 flex items-center justify-center rounded bg-white text-black hover:bg-slate-100 border border-slate-300"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Conteúdo (vagas) ── */}
      {!isCollapsed && (
        <div className="px-5 pb-5">
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
              <Briefcase className="w-7 h-7 mb-2 text-slate-300" />
              <p className="text-sm font-bold text-slate-500">Nenhuma vaga neste nicho</p>
              <p className="text-xs text-slate-400 mt-0.5">Clique em "+ Nova Vaga" e selecione este nicho.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {jobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  onClick={onJobClick}
                  onDelete={onJobDelete}
                  onPin={onJobPin}
                  onEdit={onJobEdit}
                  isDeleting={deletingJobId === job.id}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
