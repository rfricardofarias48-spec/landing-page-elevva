
import React, { useState } from 'react';
import { Copy, Database, X, ExternalLink, Clock, ToggleRight, Wrench } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const SqlSetupModal: React.FC<Props> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'FIX_ALL' | 'CRON' | 'NEW_FEATURES'>('NEW_FEATURES');

  const fixAllSql = `
-- --- SCRIPT V30: ULTIMATE FIX (SEM TRANSAÇÃO) ---
-- Execute este script para corrigir tabelas, colunas e permissões de uma vez por todas.

-- 1. GARANTIR ESTRUTURA DA TABELA JOBS
CREATE TABLE IF NOT EXISTS public.jobs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users NOT NULL,
    title text NOT NULL,
    description text,
    criteria text,
    short_code text UNIQUE,
    created_at timestamptz DEFAULT now(),
    "isPinned" boolean DEFAULT false, -- Aspas para garantir case sensitivity se necessário
    auto_analyze boolean DEFAULT false,
    is_paused boolean DEFAULT false
);

-- Adiciona colunas individualmente (Ignora erros se já existirem)
DO $$ BEGIN ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS auto_analyze boolean DEFAULT false; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS is_paused boolean DEFAULT false; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS short_code text UNIQUE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS "isPinned" boolean DEFAULT false; EXCEPTION WHEN others THEN NULL; END $$;

-- 2. GARANTIR ESTRUTURA DA TABELA CANDIDATES
CREATE TABLE IF NOT EXISTS public.candidates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id uuid REFERENCES public.jobs ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users,
    filename text NOT NULL,
    file_path text NOT NULL,
    status text DEFAULT 'PENDING',
    analysis_result jsonb,
    match_score numeric,
    is_selected boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- 3. GARANTIR ESTRUTURA DA TABELA ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    link_url text,
    image_path text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    target_plans text[] DEFAULT '{FREE,MENSAL,ANUAL}'
);

-- 4. CONFIGURAÇÃO DO STORAGE
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('marketing', 'marketing', true) ON CONFLICT (id) DO NOTHING;

-- 5. PERMISSÕES E RLS (POLÍTICAS DE SEGURANÇA)
-- Habilita RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Limpa TODAS as políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Enable read access for all" ON public.jobs;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.jobs;
DROP POLICY IF EXISTS "Enable update for owners" ON public.jobs;
DROP POLICY IF EXISTS "Enable delete for owners" ON public.jobs;
DROP POLICY IF EXISTS "Enable select for all" ON public.candidates;
DROP POLICY IF EXISTS "Enable insert for all" ON public.candidates;
DROP POLICY IF EXISTS "Enable update for owners" ON public.candidates;
DROP POLICY IF EXISTS "Enable delete for owners" ON public.candidates;

-- RECRIA POLÍTICAS (JOBS)
-- Leitura pública (necessário para upload anônimo funcionar)
CREATE POLICY "Enable read access for all" ON public.jobs FOR SELECT TO anon, authenticated USING (true);
-- Insert apenas autenticado
CREATE POLICY "Enable insert for authenticated" ON public.jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
-- Update apenas dono (Permite toggle de auto_analyze e pause)
CREATE POLICY "Enable update for owners" ON public.jobs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
-- Delete apenas dono
CREATE POLICY "Enable delete for owners" ON public.jobs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RECRIA POLÍTICAS (CANDIDATES)
-- Leitura pública (para ver status)
CREATE POLICY "Enable select for all" ON public.candidates FOR SELECT TO anon, authenticated USING (true);
-- Insert público (para candidatos enviarem)
CREATE POLICY "Enable insert for all" ON public.candidates FOR INSERT TO anon, authenticated WITH CHECK (true);
-- Update/Delete para todos (simplificado para evitar bloqueios de análise, refinado via app logic)
CREATE POLICY "Enable update for all" ON public.candidates FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Enable delete for all" ON public.candidates FOR DELETE TO anon, authenticated USING (true);

-- STORAGE POLICIES
DROP POLICY IF EXISTS "Give anon insert access" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Resumes" ON storage.objects;
CREATE POLICY "Give anon insert access" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'resumes');
CREATE POLICY "Public Read Resumes" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'resumes');

-- Recarrega cache do schema
NOTIFY pgrst, 'reload config';
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

  const featuresSql = fixAllSql; 

  const getSql = () => {
      switch(activeTab) {
          case 'CRON': return cronSql;
          case 'NEW_FEATURES': return featuresSql;
          default: return fixAllSql;
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
                 <p className="text-zinc-400 text-sm">Execute para criar tabelas e corrigir erros.</p>
               </div>
             </div>
             <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-6 h-6" /></button>
          </div>
          
          <div className="flex px-6 gap-6 mt-2 overflow-x-auto">
            <button 
              onClick={() => setActiveTab('NEW_FEATURES')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'NEW_FEATURES' ? 'border-emerald-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              <Wrench className="w-4 h-4" /> Script V30 (Ultimate Fix)
            </button>
            <button 
              onClick={() => setActiveTab('FIX_ALL')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'FIX_ALL' ? 'border-emerald-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              <Database className="w-4 h-4" /> Backup V29
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
