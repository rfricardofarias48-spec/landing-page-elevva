
import React, { useState } from 'react';
import { Copy, Database, X, ExternalLink, PlayCircle, ShieldCheck, Globe, HardDrive, AlertTriangle, Users, FileWarning, Lock } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const SqlSetupModal: React.FC<Props> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'FIX_ALL'>('FIX_ALL');

  const fixAllSql = `
-- --- SCRIPT V22: FILTRO DE ANÚNCIOS POR PLANO ---

-- 1. Adicionar coluna de planos alvo na tabela de anúncios
-- Default: Todos os planos (FREE, MENSAL, ANUAL)
ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS target_plans text[] DEFAULT '{FREE,MENSAL,ANUAL}';

-- 2. Garantir que a tabela e storage existam (Backup do V21)
CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    image_path text NOT NULL,
    link_url text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    target_plans text[] DEFAULT '{FREE,MENSAL,ANUAL}'
);

-- Políticas de Segurança (Caso não existam)
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'announcements' AND policyname = 'Public Read Announcements'
    ) THEN
        CREATE POLICY "Public Read Announcements" ON public.announcements FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'announcements' AND policyname = 'Auth Full Access Announcements'
    ) THEN
        CREATE POLICY "Auth Full Access Announcements" ON public.announcements FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END
$$;

-- Criar bucket 'marketing' se não existir
INSERT INTO storage.buckets (id, name, public) 
VALUES ('marketing', 'marketing', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage (Simplificadas para evitar erros de duplicidade)
DROP POLICY IF EXISTS "Public Access Marketing Images" ON storage.objects;
CREATE POLICY "Public Access Marketing Images" ON storage.objects FOR SELECT TO public USING (bucket_id = 'marketing');

DROP POLICY IF EXISTS "Auth Upload Marketing Images" ON storage.objects;
CREATE POLICY "Auth Upload Marketing Images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'marketing');

DROP POLICY IF EXISTS "Auth Delete Marketing Images" ON storage.objects;
CREATE POLICY "Auth Delete Marketing Images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'marketing');

COMMIT;
  `.trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(fixAllSql);
    alert("SQL V22 Copiado! Execute no Supabase para habilitar filtros de anúncio.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-4xl flex flex-col max-h-[90vh] shadow-2xl">
        
        <div className="p-0 border-b border-zinc-800 bg-zinc-950 rounded-t-2xl flex flex-col">
          <div className="flex justify-between items-center p-6 pb-2">
             <div className="flex items-center gap-3">
               <div className="bg-indigo-500/20 p-2 rounded-lg">
                  <Database className="w-6 h-6 text-indigo-500" />
               </div>
               <div>
                 <h2 className="text-xl font-bold text-white">Atualização de Banco V22</h2>
                 <p className="text-zinc-400 text-sm">Habilita segmentação de anúncios por plano.</p>
               </div>
             </div>
             <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-6 h-6" /></button>
          </div>
          
          <div className="flex px-6 gap-6 mt-2">
            <button 
              className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap border-indigo-500 text-white`}
            >
              <Database className="w-4 h-4" /> Script V22 (Filtros)
            </button>
          </div>
        </div>

        <div className="p-0 overflow-hidden flex-1 relative group">
           <pre className="w-full h-full bg-[#1e1e1e] text-zinc-300 p-6 overflow-auto text-sm font-mono custom-scrollbar selection:bg-indigo-500/30">
             {fixAllSql}
           </pre>
           <button 
             onClick={handleCopy}
             className="absolute top-4 right-4 bg-white text-black px-4 py-2 rounded-lg font-bold text-sm shadow-lg flex items-center gap-2 hover:bg-zinc-200 transition-all opacity-0 group-hover:opacity-100"
            >
             <Copy className="w-4 h-4" /> Copiar SQL
           </button>
        </div>

        <div className="p-6 border-t border-zinc-800 bg-zinc-950 rounded-b-2xl flex justify-between items-center">
           <span className="text-zinc-400 font-bold text-xs flex items-center gap-2">
             <Database className="w-4 h-4 text-zinc-500" />
             Execute no Editor SQL do Supabase
           </span>
           <a 
             href="https://supabase.com/dashboard/project/_/sql/new" 
             target="_blank" 
             rel="noreferrer"
             className="text-indigo-400 hover:text-indigo-300 text-sm font-bold flex items-center"
            >
             Abrir Supabase <ExternalLink className="w-4 h-4 ml-2" />
           </a>
        </div>

      </div>
    </div>
  );
};
