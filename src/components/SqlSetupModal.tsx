import React, { useState } from 'react';
import { Copy, Database, X, ExternalLink, Clock, ToggleRight, Crown, Unlock } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const SqlSetupModal: React.FC<Props> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'FIX_ALL' | 'CRON' | 'ADMIN_POWER'>('FIX_ALL');

  const fixAllSql = `
-- --- SCRIPT V26: CORREÇÃO DE UPLOAD PÚBLICO E POLÍTICAS ---

-- 1. CORREÇÃO CRÍTICA: PERMITIR CANDIDATOS ANÔNIMOS (SEM USER_ID)
ALTER TABLE public.candidates ALTER COLUMN user_id DROP NOT NULL;

-- 2. PERMISSÕES EXPLÍCITAS (GRANT)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE public.candidates TO anon, authenticated;
GRANT SELECT ON TABLE public.jobs TO anon, authenticated;
GRANT ALL ON TABLE public.announcements TO anon, authenticated;

-- 3. POLÍTICAS DE CANDIDATOS (RLS) - RESET TOTAL
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Insert Candidates" ON public.candidates;
DROP POLICY IF EXISTS "Enable insert for anon" ON public.candidates;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.candidates;
DROP POLICY IF EXISTS "Enable insert for all" ON public.candidates;
DROP POLICY IF EXISTS "Enable select for all" ON public.candidates;

CREATE POLICY "Enable insert for all" ON public.candidates 
FOR INSERT TO anon, authenticated 
WITH CHECK (true);

CREATE POLICY "Enable select for all" ON public.candidates 
FOR SELECT TO anon, authenticated 
USING (true);

-- 4. POLÍTICAS DE VAGAS (JOBS)
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all" ON public.jobs;
CREATE POLICY "Enable read access for all" ON public.jobs 
FOR SELECT TO anon, authenticated 
USING (true);

DROP POLICY IF EXISTS "Enable update for owners" ON public.jobs;
CREATE POLICY "Enable update for owners" ON public.jobs 
FOR UPDATE TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. STORAGE (Bucket 'resumes')
INSERT INTO storage.buckets (id, name, public) 
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO NOTHING;

GRANT ALL ON SCHEMA storage TO anon, authenticated;
GRANT ALL ON TABLE storage.objects TO anon, authenticated;

DROP POLICY IF EXISTS "Public Upload Resumes" ON storage.objects;
DROP POLICY IF EXISTS "Give anon insert access" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Resumes" ON storage.objects;

CREATE POLICY "Give anon insert access" ON storage.objects 
FOR INSERT TO anon, authenticated 
WITH CHECK (bucket_id = 'resumes');

CREATE POLICY "Public Read Resumes" ON storage.objects 
FOR SELECT TO anon, authenticated 
USING (bucket_id = 'resumes');

-- 6. ANÚNCIOS
CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    link_url text,
    image_path text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    target_plans text[] DEFAULT '{FREE,MENSAL,ANUAL}'
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public View Announcements" ON public.announcements;
CREATE POLICY "Public View Announcements" ON public.announcements 
FOR SELECT TO anon, authenticated 
USING (true);

GRANT ALL ON TABLE public.announcements TO anon, authenticated;

-- 7. LINKS CURTOS E FEATURES
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS short_code text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS is_paused boolean DEFAULT false;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS auto_analyze boolean DEFAULT false;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_short_code_key') THEN
        ALTER TABLE public.jobs ADD CONSTRAINT jobs_short_code_key UNIQUE (short_code);
    END IF;
END $$;

COMMIT;
  `.trim();

  // SCRIPT V40: PODERES DE ADMIN (Permite alterar planos)
  const adminPowerSql = `
-- --- SCRIPT V40: PERMISSÕES DE SUPER ADMIN ---
-- Execute isso para conseguir alterar planos de outros usuários pelo painel.

BEGIN;

-- 1. Garante que RLS está ativo em profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Política de LEITURA (Admin vê tudo, User vê o seu)
DROP POLICY IF EXISTS "Read profiles" ON public.profiles;
CREATE POLICY "Read profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = id 
  OR 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
);

-- 3. Política de EDIÇÃO (Admin edita tudo, User edita o seu)
DROP POLICY IF EXISTS "Update profiles" ON public.profiles;
CREATE POLICY "Update profiles" ON public.profiles
FOR UPDATE TO authenticated
USING (
  auth.uid() = id 
  OR 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
)
WITH CHECK (
  auth.uid() = id 
  OR 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
);

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

  const getSql = () => {
      switch(activeTab) {
          case 'CRON': return cronSql;
          case 'ADMIN_POWER': return adminPowerSql;
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
                 <p className="text-zinc-400 text-sm">Correções de permissão e manutenção.</p>
               </div>
             </div>
             <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-6 h-6" /></button>
          </div>
          
          <div className="flex px-6 gap-6 mt-2 overflow-x-auto">
            <button 
              onClick={() => setActiveTab('FIX_ALL')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'FIX_ALL' ? 'border-emerald-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              <Unlock className="w-4 h-4" /> Script V26 (Geral)
            </button>
            <button 
              onClick={() => setActiveTab('ADMIN_POWER')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'ADMIN_POWER' ? 'border-emerald-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              <Crown className="w-4 h-4" /> V40 (Admin Power)
            </button>
            <button 
              onClick={() => setActiveTab('CRON')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'CRON' ? 'border-emerald-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              <Clock className="w-4 h-4" /> V27 (Auto Limpeza)
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