
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Candidate } from '../types';
import { X, Printer, Phone, MapPin, Briefcase, CheckCircle2, List, LayoutTemplate, Quote, AlertCircle, Building2, Clock, XCircle } from 'lucide-react';

interface Props {
  jobTitle: string;
  candidates: Candidate[];
  onClose: () => void;
}

export const InterviewReportModal: React.FC<Props> = ({ jobTitle, candidates, onClose }) => {
  const [viewMode, setViewMode] = useState<'FULL' | 'SUMMARY'>('FULL');

  // Garante que os candidatos estejam ordenados por nota (Decrescente)
  const sortedCandidates = useMemo(() => {
    return [...candidates].sort((a, b) => (b.result?.matchScore || 0) - (a.result?.matchScore || 0));
  }, [candidates]);

  const currentDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const getScoreColor = (score: number) => {
    if (score >= 8.0) return '#CCF300'; // Lime
    if (score >= 5.0) return '#facc15'; // Yellow
    return '#ef4444'; // Red
  };

  const getScoreTextColor = (score: number) => {
      if (score >= 8.0) return '#000000';
      if (score >= 5.0) return '#ca8a04';
      return '#ef4444';
  }

  const handlePrint = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
      alert("Por favor, permita pop-ups para imprimir este relatório.");
      return;
    }

    // Ícones SVG Inline
    const Icons = {
        Quote: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/></svg>`,
        Briefcase: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
        MapPin: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
        CheckCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`,
        XCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`,
        Phone: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
        Building: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/></svg>`,
        Clock: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
    };

    let contentHtml = '';
    let customStyles = '';

    // --- MODO LISTA (TABELA COMPACTA PARA 10/PÁGINA) ---
    if (viewMode === 'SUMMARY') {
        const tableRows = sortedCandidates.map((c, index) => {
            const score = c.result?.matchScore || 0;
            const textColor = getScoreTextColor(score);
            return `
                <tr class="border-b border-slate-100">
                    <td class="py-2 px-4 align-middle">
                        <span class="font-black text-slate-900 text-lg">#${index + 1}</span>
                    </td>
                    <td class="py-2 px-4 align-middle">
                        <div class="font-black text-slate-900 text-sm tracking-tight">${c.result?.candidateName}</div>
                        <div class="text-slate-400 text-[10px] font-bold mt-0.5 flex items-center gap-1 uppercase tracking-wide">
                            ${Icons.Briefcase} ${c.result?.yearsExperience || 'N/A'}
                        </div>
                    </td>
                    <td class="py-2 px-4 align-middle">
                        <div class="text-xs font-bold text-slate-800">${c.result?.city}</div>
                        <div class="text-slate-400 text-[9px] font-black uppercase tracking-widest">${c.result?.neighborhood}</div>
                    </td>
                    <td class="py-2 px-4 align-middle">
                        <div class="text-xs font-mono font-bold text-slate-600 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded inline-block">
                            ${c.result?.phoneNumbers[0] || '--'}
                        </div>
                    </td>
                    <td class="py-2 px-4 align-middle text-right">
                        <span class="text-xl font-black tracking-tighter" style="color: ${textColor}">${score}</span>
                    </td>
                </tr>
            `;
        }).join('');

        contentHtml = `
            <div class="p-6 max-w-[297mm] mx-auto">
                <div class="flex justify-between items-center mb-2 pb-2 border-b-2 border-black">
                     <div class="flex flex-col">
                        <div class="flex items-center gap-3 mb-1">
                            <img src="https://ik.imagekit.io/xsbrdnr0y/elevva-logo.png" alt="Logo" class="h-5 w-auto" />
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-l border-slate-300 pl-3">Relatório Oficial &bull; ${currentDate}</span>
                        </div>
                        <h1 class="text-xl font-black text-slate-900 tracking-tight">Candidatos Selecionados</h1>
                     </div>
                     <div class="text-right">
                        <div class="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Vaga</div>
                        <div class="text-sm font-black text-black bg-slate-100 px-2 py-0.5 rounded">${jobTitle}</div>
                     </div>
                </div>

                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-slate-50 border-b-2 border-slate-200 text-slate-400 text-[9px] font-black uppercase tracking-widest">
                            <th class="py-2 px-4"># Rank</th>
                            <th class="py-2 px-4">Candidato</th>
                            <th class="py-2 px-4">Localização</th>
                            <th class="py-2 px-4">Contato</th>
                            <th class="py-2 px-4 text-right">Nota</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
                
                <div class="mt-4 text-center border-t border-slate-100 pt-2">
                    <p class="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Powered by Elevva AI &bull; Documento Confidencial &bull; ${sortedCandidates.length} Candidatos</p>
                </div>
            </div>
        `;
        
        customStyles = `
            @page { 
                margin: 0;
                size: A4 landscape;
            }
            body { margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; background-color: #fff; }
        `;

    } 
    // --- MODO DETALHADO (CARDS) ---
    else {
        contentHtml = sortedCandidates.map((c, index) => {
            const score = c.result?.matchScore || 0;
            const color = getScoreColor(score);
            const textColor = getScoreTextColor(score);
            
            // Configuração do Anel (SVG)
            const radius = 32;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (score / 10) * circumference;

            return `
            <div class="candidate-page">
                <!-- CONTEUDO INTERNO COM SCALING AUTOMATICO PARA CABER -->
                <div class="w-full h-full flex flex-col p-6 bg-white border border-slate-100 rounded-[1.5rem] shadow-sm box-border relative">
                    
                    <!-- HEADER DA PÁGINA (LOGO + VAGA) -->
                    <div class="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 shrink-0">
                         <div class="flex items-center gap-2">
                             <img src="https://ik.imagekit.io/xsbrdnr0y/elevva-logo.png" alt="Logo" class="h-5 w-auto" />
                             <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest border-l border-slate-300 pl-2">Relatório Técnico &bull; ${currentDate}</span>
                         </div>
                         <div class="text-[9px] font-black uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded text-slate-500">
                            ${jobTitle}
                         </div>
                    </div>

                    <!-- CARD PRINCIPAL (Estilo AnalysisResultCard) -->
                    <div class="flex-1 border-2 border-black rounded-[1.5rem] p-6 relative flex flex-col gap-4 overflow-hidden box-border bg-white">
                        
                        <!-- 1. HEADER DO CANDIDATO -->
                        <div class="flex items-center gap-4 shrink-0">
                             <!-- Score Circle -->
                             <div class="relative w-16 h-16 flex-shrink-0">
                                <svg class="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                                    <circle cx="40" cy="40" r="${radius}" fill="none" stroke="#f1f5f9" stroke-width="5" />
                                    <circle cx="40" cy="40" r="${radius}" fill="none" stroke="${color}" stroke-width="5" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round" />
                                </svg>
                                <div class="absolute inset-0 flex items-center justify-center flex-col">
                                    <span class="text-xl font-black tracking-tighter" style="color: ${textColor}">${score}</span>
                                </div>
                                <div class="absolute -top-1 -right-1 bg-black text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full border border-white">
                                    #${index + 1}
                                </div>
                             </div>

                             <!-- Nome e Detalhes -->
                             <div class="flex-1">
                                 <h1 class="text-xl font-black text-slate-900 tracking-tight uppercase leading-none mb-1.5">
                                    ${c.result?.candidateName}
                                 </h1>
                                 
                                 <div class="flex flex-wrap items-center gap-2">
                                    <span class="flex items-center bg-slate-50 px-2 py-1 rounded-md border border-slate-200 text-[10px] font-bold text-slate-700 uppercase">
                                       <span class="mr-1.5 text-slate-400">${Icons.Briefcase}</span>
                                       ${c.result?.yearsExperience || 'N/A'}
                                    </span>
                                    <span class="flex items-center bg-slate-50 px-2 py-1 rounded-md border border-slate-200 text-[10px] font-bold text-slate-700 uppercase">
                                       <span class="mr-1.5 text-slate-400">${Icons.MapPin}</span>
                                       ${c.result?.city} - ${c.result?.neighborhood}
                                    </span>
                                 </div>
                             </div>
                        </div>

                        <!-- 2. RESUMO -->
                        <div class="w-full shrink-0 mb-2">
                            <h5 class="text-[9px] font-black text-black uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                                <span class="text-[#CCF300]">${Icons.Quote}</span> Análise Profissional
                            </h5>
                            <p class="text-[11px] font-bold text-slate-700 leading-relaxed text-justify">
                                ${c.result?.summary}
                            </p>
                        </div>

                        <!-- 3. GRID (PRÓS E CONTRAS) - AJUSTES PARA IMPRESSÃO -->
                        <div class="grid grid-cols-2 gap-8 shrink-0">
                                 <!-- Pontos Fortes -->
                                 <div class="bg-emerald-50/50 border border-emerald-100 rounded-lg p-4">
                                      <h5 class="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                         ${Icons.CheckCircle} Pontos Fortes
                                      </h5>
                                      <ul class="space-y-2">
                                          ${c.result?.pros.slice(0, 4).map(pro => `
                                              <li class="flex items-start text-[11px] text-slate-800 font-bold leading-snug">
                                                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 mr-2 shrink-0"></span>
                                                  ${pro}
                                              </li>
                                          `).join('')}
                                      </ul>
                                 </div>

                                 <!-- Pontos de Atenção -->
                                 <div class="bg-red-50/50 border border-red-100 rounded-lg p-4">
                                      <h5 class="text-[10px] font-black text-red-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                         ${Icons.XCircle} Pontos de Atenção
                                      </h5>
                                      <ul class="space-y-2">
                                          ${c.result?.cons.slice(0, 4).map(con => `
                                              <li class="flex items-start text-[11px] text-slate-800 font-bold leading-snug">
                                                  <span class="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 mr-2 shrink-0"></span>
                                                  ${con}
                                              </li>
                                          `).join('')}
                                      </ul>
                                 </div>
                        </div>

                        <!-- 4. EXPERIÊNCIAS RECENTES -->
                        ${c.result?.workHistory && c.result.workHistory.length > 0 ? `
                        <div class="mt-2 pt-3 border-t border-slate-100 shrink-0">
                             <h5 class="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                ${Icons.Briefcase} Experiências Recentes
                             </h5>
                             <div class="space-y-1.5">
                                ${c.result.workHistory.slice(0, 3).map(work => `
                                   <div class="flex items-center justify-between text-[10px] bg-slate-50 p-2 rounded border border-slate-100">
                                      <div class="flex items-center gap-1.5 overflow-hidden">
                                         <span class="text-slate-400 scale-75">${Icons.Building}</span>
                                         <span class="font-bold text-slate-900 truncate max-w-[180px]">${work.company}</span>
                                         <span class="text-slate-300">&bull;</span>
                                         <span class="text-slate-500 font-bold truncate max-w-[150px]">${work.role}</span>
                                      </div>
                                      <div class="flex items-center gap-1 text-slate-500 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                                         <span class="scale-75">${Icons.Clock}</span>
                                         ${work.duration}
                                      </div>
                                   </div>
                                `).join('')}
                             </div>
                        </div>
                        ` : ''}

                        <!-- 5. CONTATOS -->
                        <div class="mt-auto pt-3 border-t border-slate-100 flex items-center gap-2 shrink-0">
                             <h5 class="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                ${Icons.Phone} Contatos:
                             </h5>
                             <div class="flex flex-wrap gap-1.5">
                                ${c.result?.phoneNumbers.map(phone => `
                                    <span class="text-[10px] font-bold bg-slate-50 text-slate-900 px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                                      ${phone}
                                    </span>
                                `).join('')}
                             </div>
                        </div>

                    </div>

                    <!-- Footer -->
                    <div class="text-center mt-2 shrink-0">
                        <p class="text-[7px] font-bold text-slate-300 uppercase tracking-widest">Powered by Elevva AI &bull; Documento Confidencial</p>
                    </div>
                </div>
            </div>`;
        }).join('');

        customStyles = `
            @page { 
                margin: 0; 
                size: A4 landscape;
            }
            body { 
              font-family: 'Plus Jakarta Sans', sans-serif;
              background-color: #fff;
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important;
              margin: 0;
            }
            .candidate-page {
                page-break-after: always;
                width: 297mm;
                height: 210mm;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 10mm; /* Padding seguro para evitar cortes na impressão */
                box-sizing: border-box;
                overflow: hidden;
            }
            @media print {
               .candidate-page { 
                   height: 210mm; /* Força altura A4 */
                   width: 297mm;
                   page-break-after: always;
                   padding: 5mm; /* Margem ligeiramente menor na impressão real se necessário */
               }
            }
        `;
    }

    const finalHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatório - ${jobTitle}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            ${customStyles}
          </style>
        </head>
        <body>
            ${contentHtml}
          <script>
            setTimeout(() => { window.print(); }, 800);
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(finalHtml);
    printWindow.document.close();
  };

  // --- RENDERIZADO NA TELA (MODAL) ---
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in font-sans">
      
      <div className="bg-[#F3F4F6] rounded-[2.5rem] w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden relative border-4 border-[#09090b]">
        
        {/* HEADER ESCURO */}
        <div className="bg-[#09090b] px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-6 shrink-0 relative z-10 shadow-lg">
          
          <div className="flex flex-col items-start gap-1">
             <div className="flex items-center gap-3 mb-1">
                <div className="bg-zinc-800 text-white border border-zinc-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                   Relatório Oficial
                </div>
                <span className="text-zinc-500 text-xs font-bold">{currentDate}</span>
             </div>
             <h2 className="text-3xl font-black text-white tracking-tight leading-none">Candidatos Selecionados</h2>
             <p className="text-zinc-400 text-sm font-medium">Vaga: <span className="text-white font-bold">{jobTitle}</span></p>
          </div>

          <div className="flex items-center gap-4">
             {/* Toggle List/Detailed */}
             <div className="bg-zinc-900 p-1.5 rounded-xl border border-zinc-800 flex items-center">
                <button 
                  onClick={() => setViewMode('FULL')}
                  className={`flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wide ${viewMode === 'FULL' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <LayoutTemplate className="w-4 h-4 mr-2" />
                  Detalhado
                </button>
                <div className="w-px h-4 bg-zinc-800 mx-1"></div>
                <button 
                  onClick={() => setViewMode('SUMMARY')}
                  className={`flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wide ${viewMode === 'SUMMARY' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <List className="w-4 h-4 mr-2" />
                  Lista
                </button>
             </div>

             <div className="h-8 w-px bg-zinc-800 mx-2 hidden md:block"></div>

             <div className="text-right hidden md:block mr-2">
                <div className="text-2xl font-black text-white leading-none">{sortedCandidates.length}</div>
                <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Aprovados</div>
             </div>

             <button 
                onClick={handlePrint}
                className="bg-[#CCF300] hover:bg-[#bce000] text-black border-2 border-black px-5 py-3 rounded-xl font-black text-sm flex items-center gap-2 transition-all shadow-lg hover:translate-y-0.5"
             >
                <Printer className="w-4 h-4" /> Imprimir
             </button>
             
             <button 
                onClick={onClose}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white p-3 rounded-xl border border-zinc-700 transition-colors"
             >
                <X className="w-5 h-5" />
             </button>
          </div>
        </div>

        {/* ÁREA DE CONTEÚDO */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#F3F4F6]">
          <div className="max-w-5xl mx-auto">
            
            {/* --- MODO LISTA --- */}
            {viewMode === 'SUMMARY' && (
              <div className="bg-white rounded-[2rem] border-2 border-black shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b-2 border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <th className="p-6"># Rank</th>
                      <th className="p-6">Candidato</th>
                      <th className="p-6">Localização</th>
                      <th className="p-6">Contato</th>
                      <th className="p-6 text-right">Nota</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sortedCandidates.map((c, index) => {
                      const score = c.result?.matchScore || 0;
                      const textColor = getScoreTextColor(score);

                      return (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-6 align-middle">
                             <span className="font-black text-slate-900 text-xl">#{index + 1}</span>
                          </td>
                          <td className="p-6 align-middle">
                             <div className="font-black text-slate-900 text-base tracking-tight">{c.result?.candidateName}</div>
                             <div className="text-slate-400 text-xs font-bold mt-1 flex items-center gap-1 uppercase tracking-wide">
                               <Briefcase className="w-3 h-3" /> {c.result?.yearsExperience || 'N/A'}
                             </div>
                          </td>
                          <td className="p-6 align-middle">
                             <div className="text-sm font-bold text-slate-800">{c.result?.city}</div>
                             <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{c.result?.neighborhood}</div>
                          </td>
                          <td className="p-6 align-middle">
                             <div className="text-sm font-mono font-bold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-1 rounded inline-block">
                                {c.result?.phoneNumbers[0] || '--'}
                             </div>
                          </td>
                          <td className="p-6 align-middle text-right">
                             <span className="text-2xl font-black tracking-tighter" style={{ color: textColor }}>{score}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* --- MODO DETALHADO (CARDS - IGUAL AO PRINT E ANALYSIS CARD) --- */}
            {viewMode === 'FULL' && (
              <div className="space-y-8">
                {sortedCandidates.map((c, index) => {
                  const score = c.result?.matchScore || 0;
                  const color = getScoreColor(score);
                  const textColor = getScoreTextColor(score);
                  
                  // Configuração do Anel (SVG)
                  const radius = 32;
                  const circumference = 2 * Math.PI * radius;
                  const offset = circumference - (score / 10) * circumference;

                  return (
                    <div key={c.id} className="bg-white border-2 border-black rounded-[2rem] p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] relative flex flex-col gap-6 overflow-hidden">
                    
                        {/* 1. HEADER DO CANDIDATO */}
                        <div className="flex items-center gap-6">
                            {/* Score Circle */}
                            <div className="relative w-24 h-24 flex-shrink-0">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                                    <circle cx="40" cy="40" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="6" />
                                    <circle cx="40" cy="40" r={radius} fill="none" stroke={color} strokeWidth="6" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center flex-col">
                                    <span className="text-3xl font-black tracking-tighter" style={{ color: textColor }}>{score}</span>
                                </div>
                                <div className="absolute -top-1 -right-1 bg-black text-white text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-white">
                                    #{index + 1}
                                </div>
                            </div>

                            {/* Nome e Detalhes */}
                            <div className="flex-1">
                                <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase leading-none mb-2">
                                    {c.result?.candidateName}
                                </h1>
                                
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="flex items-center bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 uppercase">
                                    <Briefcase className="w-3 h-3 mr-2 text-slate-400" />
                                    {c.result?.yearsExperience || 'N/A'}
                                    </span>
                                    <span className="flex items-center bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 uppercase">
                                    <MapPin className="w-3 h-3 mr-2 text-slate-400" />
                                    {c.result?.city} - {c.result?.neighborhood}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 2. RESUMO */}
                        <div className="w-full">
                            <h5 className="text-[10px] font-black text-black uppercase tracking-widest flex items-center gap-2 mb-2">
                                <Quote className="w-3 h-3 fill-current text-[#CCF300]" /> Análise Profissional
                            </h5>
                            <p className="text-sm font-bold text-slate-700 leading-relaxed text-justify">
                                {c.result?.summary}
                            </p>
                        </div>

                        {/* 3. GRID PRÓS E CONTRAS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="bg-emerald-50/50 border-2 border-emerald-100 rounded-xl p-5">
                                    <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" /> Pontos Fortes
                                    </h5>
                                    <ul className="space-y-2">
                                        {c.result?.pros.map((pro, i) => (
                                            <li key={i} className="flex items-start text-xs text-slate-800 font-bold leading-relaxed">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 mr-2 shrink-0"></span>
                                                {pro}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="bg-red-50/50 border-2 border-red-100 rounded-xl p-5">
                                    <h5 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <XCircle className="w-4 h-4" /> Pontos de Atenção
                                    </h5>
                                    <ul className="space-y-2">
                                        {c.result?.cons.map((con, i) => (
                                            <li key={i} className="flex items-start text-xs text-slate-800 font-bold leading-relaxed">
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 mr-2 shrink-0"></span>
                                                {con}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                        </div>

                        {/* 4. EXPERIÊNCIAS RECENTES */}
                        {c.result?.workHistory && c.result.workHistory.length > 0 && (
                        <div className="mt-2 pt-4 border-t-2 border-slate-100">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Briefcase className="w-3 h-3" /> Experiências Recentes
                            </h5>
                            <div className="space-y-2">
                                {c.result.workHistory.map((work, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs bg-slate-50 p-3 rounded-lg border-2 border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="font-bold text-slate-900">{work.company}</span>
                                        <span className="text-slate-300">&bull;</span>
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

                        {/* 5. CONTATOS */}
                        <div className="mt-auto pt-4 border-t-2 border-slate-100 flex items-center gap-3">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <Phone className="w-3 h-3" /> Contatos:
                            </h5>
                            <div className="flex flex-wrap gap-2">
                                {c.result?.phoneNumbers.map((phone, i) => (
                                    <span key={i} className="text-[11px] font-bold bg-slate-50 text-slate-900 px-2 py-1 rounded border border-slate-200 font-mono">
                                    {phone}
                                    </span>
                                ))}
                            </div>
                        </div>

                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer de rodapé para o modal */}
            <div className="mt-12 text-center pb-8 opacity-40 hover:opacity-100 transition-opacity">
                <div className="flex items-center justify-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                    Relatório confidencial gerado via IA pelo VeloRH &bull; {currentDate}
                </div>
            </div>

          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};
