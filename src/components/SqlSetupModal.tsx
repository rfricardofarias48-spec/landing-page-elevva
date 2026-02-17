
import React, { useState } from 'react';
import { Copy, Database, X, ExternalLink, PlayCircle, ShieldCheck, Globe, HardDrive, AlertTriangle, Users, FileWarning, Lock, Clock, ToggleRight } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const SqlSetupModal: React.FC<Props> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'FIX_ALL' | 'CRON' | 'NEW_FEATURES'>('FIX_ALL');

  const fixAllSql = `
-- --- SCRIPT V26: CORREÇÃO DE UPLOAD PÚBLICO E POLÍTICAS ---

-- 1. CORREÇÃO CRÍTICA: PERMITIR CANDIDATOS ANÔNIMOS (SEM USER_ID)
-- Isso resolve o erro: null value in column "user_id" violates not-null constraint
ALTER TABLE public.candidates ALTER COLUMN user_id DROP NOT NULL;

-- 2. PERMISSÕES EXPLÍCITAS (GRANT)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE public.candidates TO anon, authenticated;
GRANT SELECT ON TABLE public.jobs TO anon, authenticated;
GRANT ALL ON TABLE public.announcements TO anon, authenticated;

-- 3. POLÍTICAS DE CANDIDATOS (RLS) - RESET TOTAL
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas para evitar erro "policy already exists"
DROP POLICY IF EXISTS "Public Insert Candidates" ON public.candidates;
DROP POLICY IF EXISTS "Enable insert for anon" ON public.candidates;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.candidates;
DROP POLICY IF EXISTS "Enable insert for all" ON public.candidates;
DROP POLICY IF EXISTS "Enable select for all" ON public.candidates;

-- Cria política unificada para permitir INSERT de qualquer um
CREATE POLICY "Enable insert for all" ON public.candidates 
FOR INSERT TO anon, authenticated 
WITH CHECK (true);

-- Permite leitura para mostrar status/confirmação
CREATE POLICY "Enable select for all" ON public.candidates 
FOR SELECT TO anon, authenticated 
USING (true);

-- 4. POLÍTICAS DE VAGAS (JOBS)
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all" ON public.jobs;
CREATE POLICY "Enable read access for all" ON public.jobs 
FOR SELECT TO anon, authenticated 
USING (true);

-- PERMITIR UPDATE PARA O DONO DA VAGA (ESSENCIAL PARA PAUSAR/AUTO-ANÁLISE)
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

-- 6. ANÚNCIOS (Correção do erro 42710)
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

-- 7. LINKS CURTOS
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS short_code text;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_short_code_key') THEN
        ALTER TABLE public.jobs ADD CONSTRAINT jobs_short_code_key UNIQUE (short_code);
    END IF;
END $$;

COMMIT;
  `.trim();

  const cronSql = `
-- --- SCRIPT V27: AUTOMAÇÃO DE LIMPEZA (10 DIAS) ---
-- Requer extensão pg_cron ativada no dashboard do Supabase (Database -> Extensions)

-- 1. Ativa a extensão (se permitido)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Cria a função de limpeza
CREATE OR REPLACE FUNCTION delete_expired_candidates() RETURNS void AS $$
BEGIN
  -- Deleta candidatos criados há mais de 10 dias
  -- Nota: O trigger de storage deve limpar o arquivo se configurado, 
  -- caso contrário, a limpeza é apenas lógica no banco.
  DELETE FROM public.candidates 
  WHERE created_at < NOW() - INTERVAL '10 days';
END;
$$ LANGUAGE plpgsql;

-- 3. Agenda a execução para todo dia às 03:00 AM
SELECT cron.schedule(
  'cleanup_resumes', -- nome do job
  '0 3 * * *',       -- cron expression (03:00 am daily)
  $$SELECT delete_expired_candidates()$$
);

-- Para verificar se agendou: SELECT * FROM cron.job;
`.trim();

  const featuresSql = `
-- --- SCRIPT V28: CORREÇÃO DE PERMISSÕES PARA NOVAS FUNÇÕES ---

-- 1. Adiciona as colunas necessárias se não existirem
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS auto_analyze boolean DEFAULT false;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS is_paused boolean DEFAULT false;

-- 2. CORREÇÃO DE PERMISSÃO: Permite que o usuário ATUALIZE suas próprias vagas
-- Sem isso, ao tentar ativar "Auto Análise" ou "Pausar", o Supabase retorna erro.
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable update for owners" ON public.jobs;

CREATE POLICY "Enable update for owners" ON public.jobs 
FOR UPDATE TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Garante que o Supabase recarregue o schema
NOTIFY pgrst, 'reload config';
  `.trim();

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-4xl flex flex-col max-h-[90vh] shadow-2xl">
        
        <div className="p-0 border-b border-zinc-800 bg-zinc-950 rounded-t-2xl flex flex-col">
          <div className="flex justify-between items-center p-6 pb-2">
             <div className="flex items-center gap-3">
               <div className="bg-emerald-500/20 p-2 rounded-lg">
                  <Database className="w-6 h-6 text-emerald-500" />
               </div>
               <div>
                 <h2 className="text-xl font-bold text-white">Scripts de Manutenção</h2>
                 <p className="text-zinc-400 text-sm">Atualizações de banco de dados.</p>
               </div>
             </div>
             <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-6 h-6" /></button>
          </div>
          
          <div className="flex px-6 gap-6 mt-2 overflow-x-auto">
            <button 
              onClick={() => setActiveTab('FIX_ALL')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'FIX_ALL' ? 'border-emerald-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              <Database className="w-4 h-4" /> Script V26 (Geral)
            </button>
            <button 
              onClick={() => setActiveTab('NEW_FEATURES')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'NEW_FEATURES' ? 'border-emerald-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              <ToggleRight className="w-4 h-4" /> Script V28 (Correção)
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
