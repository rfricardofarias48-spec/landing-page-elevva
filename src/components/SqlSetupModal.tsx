import React, { useState } from 'react';
import { Copy, Database, X, ExternalLink, Clock, ToggleRight, Wrench, ShieldCheck, Unlock, Crown } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const SqlSetupModal: React.FC<Props> = ({ onClose }) => {
  // Define FIX_ADMIN (V43) como padrão para resolver o erro atual
  const [activeTab, setActiveTab] = useState<'FIX_ADMIN' | 'FIX_ACCESS' | 'CRON'>('FIX_ADMIN');

  // SCRIPT V43: CORREÇÃO DEFINITIVA DE PERMISSÕES ADMIN (ANTI-RECURSÃO)
  const fixAdminSql = `
-- --- SCRIPT V43: CORREÇÃO DEFINITIVA DE DADOS DO ADMIN ---
-- Este script resolve o problema de "Painel Zerado" liberando acesso total ao Admin.

BEGIN;

-- 1. Cria a tabela profiles se não existir (segurança)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text,
  phone text,
  role text DEFAULT 'USER',
  plan text DEFAULT 'FREE',
  job_limit int DEFAULT 3,
  resume_limit int DEFAULT 25,
  resume_usage int DEFAULT 0,
  status text DEFAULT 'ACTIVE',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  subscription_status text
);

-- 2. Garante que seu usuário é ADMIN
UPDATE public.profiles 
SET role = 'ADMIN' 
WHERE email = 'rhfarilog@gmail.com';

-- 3. Função Segura para verificar Admin (Bypassa RLS para evitar recursão)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Recriar Políticas de Profiles (Acesso Total para Admin)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin Select" ON public.profiles;

-- LEITURA: O usuário vê o dele, o Admin vê TODOS
CREATE POLICY "Read profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = id 
  OR 
  public.is_admin() = true
  OR
  auth.jwt() ->> 'email' = 'rhfarilog@gmail.com' -- Trava de segurança extra
);

-- UPDATE: O usuário edita o dele, o Admin edita TODOS
CREATE POLICY "Update profiles" ON public.profiles
FOR UPDATE TO authenticated
USING (
  auth.uid() = id 
  OR 
  public.is_admin() = true
  OR
  auth.jwt() ->> 'email' = 'rhfarilog@gmail.com'
);

-- INSERT: Qualquer um logado pode criar seu perfil
CREATE POLICY "Insert profiles" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- 5. Garantir acesso a Vagas (Jobs) para o Admin
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all" ON public.jobs;

CREATE POLICY "Enable read access for all" ON public.jobs 
FOR SELECT 
TO anon, authenticated 
USING (true);

-- 6. Garantir acesso a Anúncios
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
GRANT ALL ON TABLE public.announcements TO anon, authenticated;

DROP POLICY IF EXISTS "Public View Announcements" ON public.announcements;
CREATE POLICY "Public View Announcements" ON public.announcements 
FOR SELECT TO anon, authenticated 
USING (true);

DROP POLICY IF EXISTS "Admin Manage Announcements" ON public.announcements;
CREATE POLICY "Admin Manage Announcements" ON public.announcements 
FOR ALL TO authenticated 
USING (public.is_admin() = true OR auth.jwt() ->> 'email' = 'rhfarilog@gmail.com');

NOTIFY pgrst, 'reload config';
COMMIT;
  `.trim();

  // SCRIPT V35: CORREÇÃO DE ACESSO PÚBLICO
  const fixAccessSql = `
-- --- SCRIPT V35: CORREÇÃO GERAL ---
BEGIN;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON TABLE public.jobs TO anon, authenticated;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all" ON public.jobs;
CREATE POLICY "Enable read access for all" ON public.jobs FOR SELECT TO anon, authenticated USING (true);
COMMIT;
  `.trim();

  const cronSql = `
-- --- SCRIPT V50: AUTO LIMPEZA COMPLETA (DB + STORAGE) ---

-- 1. Habilita a extensão pg_cron (se disponível no plano)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Função para deletar o arquivo do Storage quando o registro for deletado
CREATE OR REPLACE FUNCTION public.delete_old_resume_file()
RETURNS TRIGGER AS $$
BEGIN
  -- Tenta deletar o arquivo do bucket 'resumes'
  DELETE FROM storage.objects 
  WHERE bucket_id = 'resumes' 
  AND name = OLD.file_path;
  
  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  -- Evita que erro no storage impeça a deleção do registro
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Cria o Trigger (remove anterior se existir para evitar duplicidade)
DROP TRIGGER IF EXISTS on_candidate_delete ON public.candidates;
CREATE TRIGGER on_candidate_delete
BEFORE DELETE ON public.candidates
FOR EACH ROW
EXECUTE FUNCTION public.delete_old_resume_file();

-- 4. Agenda a limpeza diária às 03:00 AM
SELECT cron.unschedule('cleanup');
SELECT cron.schedule('cleanup', '0 3 * * *', $$DELETE FROM public.candidates WHERE created_at < NOW() - INTERVAL '10 days'$$);
`.trim();

  const getSql = () => {
      switch(activeTab) {
          case 'CRON': return cronSql;
          case 'FIX_ACCESS': return fixAccessSql;
          default: return fixAdminSql;
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
                 <p className="text-zinc-400 text-sm">Execute para corrigir permissões e visualizar dados.</p>
               </div>
             </div>
             <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-6 h-6" /></button>
          </div>
          
          <div className="flex px-6 gap-6 mt-2 overflow-x-auto custom-scrollbar pb-2">
            <button 
              onClick={() => setActiveTab('FIX_ADMIN')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'FIX_ADMIN' ? 'border-emerald-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              <Crown className="w-4 h-4" /> V43 (Fix Admin)
            </button>
            <button 
              onClick={() => setActiveTab('FIX_ACCESS')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'FIX_ACCESS' ? 'border-emerald-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              <Unlock className="w-4 h-4" /> V35 (Acesso Geral)
            </button>
            <button 
              onClick={() => setActiveTab('CRON')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'CRON' ? 'border-emerald-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              <Clock className="w-4 h-4" /> V50 (Auto Limpeza)
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