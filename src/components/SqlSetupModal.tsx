import React, { useState } from 'react';
import { Copy, Database, X, ExternalLink, Clock, ToggleRight, Wrench, ShieldCheck } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const SqlSetupModal: React.FC<Props> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'FIX_LINKS' | 'CRON' | 'PERMISSIONS'>('FIX_LINKS');

  // SCRIPT V34: CORREÇÃO COMPLETA DE LINKS PÚBLICOS
  const fixLinksSql = `
-- --- SCRIPT V34: CORREÇÃO DE LINKS E PERMISSÕES ---
-- Execute este script para garantir que os links públicos funcionem.

BEGIN;

-- 1. Garante que RLS está ativo
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- 2. Remove políticas antigas de leitura para evitar conflito
DROP POLICY IF EXISTS "Enable read access for all" ON public.jobs;
DROP POLICY IF EXISTS "Public Read Jobs" ON public.jobs;

-- 3. CRIA A POLÍTICA CORRETA DE LEITURA PÚBLICA
CREATE POLICY "Enable read access for all" ON public.jobs 
FOR SELECT 
TO anon, authenticated 
USING (true);

-- 4. Garante permissão de atualização para o dono (para pausar/editar)
DROP POLICY IF EXISTS "Enable update for owners" ON public.jobs;
CREATE POLICY "Enable update for owners" ON public.jobs 
FOR UPDATE TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- 5. Garante colunas essenciais e gera códigos para vagas antigas
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS is_paused boolean DEFAULT false;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS short_code text;

-- Gera código de 6 dígitos para quem não tem (evita link quebrado)
UPDATE public.jobs 
SET short_code = floor(random() * (999999 - 100000 + 1) + 100000)::text 
WHERE short_code IS NULL;

-- 6. Recarrega permissões
GRANT SELECT ON TABLE public.jobs TO anon, authenticated;
NOTIFY pgrst, 'reload config';

COMMIT;
  `.trim();

  const cronSql = `
-- --- SCRIPT V27: AUTOMAÇÃO DE LIMPEZA (10 DIAS) ---
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION delete_expired_candidates() RETURNS void AS $$
BEGIN
  DELETE FROM public.candidates 
  WHERE created_at < NOW() - INTERVAL '10 days';
END;
$$ LANGUAGE plpgsql;

SELECT cron.schedule(
  'cleanup_resumes',
  '0 3 * * *',
  $$SELECT delete_expired_candidates()$$
);
`.trim();

  const permissionsSql = `
-- --- SCRIPT V28: RESET DE PERMISSÕES GERAIS ---
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

-- Permite insert público de currículos
DROP POLICY IF EXISTS "Enable insert for all" ON public.candidates;
CREATE POLICY "Enable insert for all" ON public.candidates 
FOR INSERT TO anon, authenticated 
WITH CHECK (true);

-- Permite leitura de currículos para quem tem acesso (autenticado)
DROP POLICY IF EXISTS "Enable select for authenticated" ON public.candidates;
CREATE POLICY "Enable select for authenticated" ON public.candidates 
FOR SELECT TO authenticated 
USING (true);
  `.trim();

  const getSql = () => {
      switch(activeTab) {
          case 'CRON': return cronSql;
          case 'PERMISSIONS': return permissionsSql;
          default: return fixLinksSql;
      }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Script copiado! Execute no SQL Editor do Supabase.");
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-4xl flex flex-col max-h-[90vh] shadow-2xl">
        
        <div className="p-0 border-b border-zinc-800 bg-zinc-950 rounded-t-2xl flex flex-col">
          <div className="flex justify-between items-center p-6 pb-2">
             <div className="flex items-center gap-3">
               <div className="bg-emerald-500/20 p-2 rounded-lg">
                  <Database className="w-6 h-6 text-emerald-500" />
               </div>
               <div>
                 <h2 className="text-xl font-bold text-white">Scripts de Banco de Dados</h2>
                 <p className="text-zinc-400 text-sm">Execute para corrigir erros de permissão e dados.</p>
               </div>
             </div>
             <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-6 h-6" /></button>
          </div>
          
          <div className="flex px-6 gap-6 mt-2 overflow-x-auto">
            <button 
              onClick={() => setActiveTab('FIX_LINKS')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'FIX_LINKS' ? 'border-emerald-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              <Wrench className="w-4 h-4" /> Script V34 (Corrigir Links)
            </button>
            <button 
              onClick={() => setActiveTab('PERMISSIONS')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'PERMISSIONS' ? 'border-emerald-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              <ShieldCheck className="w-4 h-4" /> Reset Permissões
            </button>
            <button 
              onClick={() => setActiveTab('CRON')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'CRON' ? 'border-emerald-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              <Clock className="w-4 h-4" /> Script V27 (Auto Limpeza)
            </button>
          </div>
        </div>

        <div className="p-0 overflow-hidden flex-1 relative group">
           <pre className="w-full h-full bg-[#1e1e1e] text-zinc-300 p-6 overflow-auto text-sm font-mono custom-scrollbar selection:bg-emerald-500/30">
             {getSql()}
           </pre>
           <button 
             onClick={() => handleCopy(getSql())}
             className="absolute top-4 right-4 bg-white text-black px-4 py-2 rounded-lg font-bold text-sm shadow-lg flex items-center gap-2 hover:bg-zinc-200 transition-all opacity-0 group-hover:opacity-100"
            >
             <Copy className="w-4 h-4" /> Copiar SQL
           </button>
        </div>

        <div className="p-6 border-t border-zinc-800 bg-zinc-950 rounded-b-2xl flex justify-between items-center">
           <span className="text-zinc-400 font-bold text-xs flex items-center gap-2">
             <Database className="w-4 h-4 text-zinc-500" />
             Cole no Editor SQL do Supabase e clique em RUN
           </span>
           <a 
             href="https://supabase.com/dashboard/project/_/sql/new" 
             target="_blank" 
             rel="noreferrer"
             className="text-emerald-400 hover:text-emerald-300 text-sm font-bold flex items-center"
            >
             Abrir Supabase <ExternalLink className="w-4 h-4 ml-2" />
           </a>
        </div>

      </div>
    </div>
  );
};