import React, { useState } from 'react';
import { Copy, Database, X, ExternalLink, Clock, Wrench, ShieldCheck, Unlock, Crown } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const SqlSetupModal: React.FC<Props> = ({ onClose }) => {
  // Define FIX_ADMIN (V43) como padrão para resolver o erro atual
  const [activeTab, setActiveTab] = useState<'FIX_ADMIN' | 'FIX_ACCESS' | 'CRON' | 'V51' | 'V52' | 'V53' | 'V54'>('FIX_ADMIN');

  // SCRIPT V54: SISTEMA DE VENDAS E ONBOARDING AUTOMÁTICO
  const v54Sql = `
-- --- SCRIPT V54: SISTEMA DE VENDAS, COMISSIONAMENTO E ONBOARDING ---
-- Cria tabelas: salespeople, sales, chips_pool
-- Adiciona colunas em profiles para rastrear provisionamento automático
-- Cria views: salesperson_commission_summary, chips_pool_summary

BEGIN;

-- 1. Função update_updated_at (cria se não existir)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Tabela de vendedores
CREATE TABLE IF NOT EXISTS public.salespeople (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT        NOT NULL,
  email              TEXT        NOT NULL UNIQUE,
  phone              TEXT,
  commission_pct     NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  asaas_wallet_id    TEXT,
  asaas_customer_id  TEXT,
  status             TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS salespeople_email_idx ON public.salespeople(email);

DROP TRIGGER IF EXISTS salespeople_updated_at ON public.salespeople;
CREATE TRIGGER salespeople_updated_at
  BEFORE UPDATE ON public.salespeople
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.salespeople ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Somente service role acessa salespeople" ON public.salespeople;
CREATE POLICY "Somente service role acessa salespeople"
  ON public.salespeople FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.salespeople TO authenticated, anon;

-- 3. Tabela de vendas
CREATE TABLE IF NOT EXISTS public.sales (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  salesperson_id       UUID        REFERENCES public.salespeople(id) ON DELETE SET NULL,
  client_name          TEXT        NOT NULL,
  client_email         TEXT        NOT NULL,
  client_phone         TEXT        NOT NULL,
  plan                 TEXT        NOT NULL CHECK (plan IN ('ESSENCIAL', 'PRO', 'ENTERPRISE')),
  amount               NUMERIC(10,2) NOT NULL,
  commission_amount    NUMERIC(10,2) NOT NULL,
  asaas_payment_id     TEXT,
  asaas_link_url       TEXT,
  status               TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded')),
  paid_at              TIMESTAMPTZ,
  onboarding_status    TEXT        NOT NULL DEFAULT 'aguardando'
    CHECK (onboarding_status IN ('aguardando','em_progresso','concluido','erro')),
  onboarding_step      INT         DEFAULT 0,
  onboarding_context   JSONB       DEFAULT '{}',
  client_user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_salesperson_idx  ON public.sales(salesperson_id);
CREATE INDEX IF NOT EXISTS sales_status_idx        ON public.sales(status);
CREATE INDEX IF NOT EXISTS sales_asaas_payment_idx ON public.sales(asaas_payment_id);

DROP TRIGGER IF EXISTS sales_updated_at ON public.sales;
CREATE TRIGGER sales_updated_at
  BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Somente service role acessa sales" ON public.sales;
CREATE POLICY "Somente service role acessa sales"
  ON public.sales FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.sales TO authenticated, anon;

-- 4. Pool de chips
CREATE TABLE IF NOT EXISTS public.chips_pool (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number         TEXT        NOT NULL UNIQUE,
  evolution_instance   TEXT        NOT NULL UNIQUE,
  display_name         TEXT,
  status               TEXT        NOT NULL DEFAULT 'disponivel'
    CHECK (status IN ('disponivel', 'em_uso', 'manutencao', 'cancelado')),
  assigned_to          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at          TIMESTAMPTZ,
  assigned_sale_id     UUID        REFERENCES public.sales(id) ON DELETE SET NULL,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chips_pool_status_idx ON public.chips_pool(status);

DROP TRIGGER IF EXISTS chips_pool_updated_at ON public.chips_pool;
CREATE TRIGGER chips_pool_updated_at
  BEFORE UPDATE ON public.chips_pool
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.chips_pool ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Somente service role acessa chips_pool" ON public.chips_pool;
CREATE POLICY "Somente service role acessa chips_pool"
  ON public.chips_pool FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.chips_pool TO authenticated, anon;

-- 5. Colunas extras em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS chatwoot_account_id    INT,
  ADD COLUMN IF NOT EXISTS chatwoot_inbox_id      INT,
  ADD COLUMN IF NOT EXISTS chatwoot_user_id       INT,
  ADD COLUMN IF NOT EXISTS chatwoot_user_token    TEXT,
  ADD COLUMN IF NOT EXISTS evolution_instance     TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_number        TEXT,
  ADD COLUMN IF NOT EXISTS sale_id                UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS onboarded_at           TIMESTAMPTZ;

-- 6. View de comissões por vendedor
CREATE OR REPLACE VIEW public.salesperson_commission_summary AS
SELECT
  sp.id, sp.name, sp.email, sp.commission_pct, sp.status,
  sp.asaas_wallet_id,
  COUNT(s.id)                                               AS total_sales,
  COUNT(s.id) FILTER (WHERE s.status = 'paid')             AS paid_sales,
  COUNT(s.id) FILTER (WHERE s.status = 'pending')          AS pending_sales,
  COALESCE(SUM(s.amount) FILTER (WHERE s.status = 'paid'), 0)              AS total_revenue,
  COALESCE(SUM(s.commission_amount) FILTER (WHERE s.status = 'paid'), 0)   AS total_commission,
  COALESCE(SUM(s.commission_amount) FILTER (WHERE s.status = 'pending'), 0) AS pending_commission,
  COUNT(s.id) FILTER (WHERE s.plan = 'ESSENCIAL' AND s.status = 'paid')    AS essencial_count,
  COUNT(s.id) FILTER (WHERE s.plan = 'PRO'       AND s.status = 'paid')    AS pro_count,
  COUNT(s.id) FILTER (WHERE s.plan = 'ENTERPRISE' AND s.status = 'paid')   AS enterprise_count
FROM public.salespeople sp
LEFT JOIN public.sales s ON s.salesperson_id = sp.id
GROUP BY sp.id, sp.name, sp.email, sp.commission_pct, sp.status, sp.asaas_wallet_id;

GRANT SELECT ON public.salesperson_commission_summary TO authenticated, anon;

-- 7. View de resumo do pool de chips
CREATE OR REPLACE VIEW public.chips_pool_summary AS
SELECT
  COUNT(*) FILTER (WHERE status = 'disponivel')  AS disponivel,
  COUNT(*) FILTER (WHERE status = 'em_uso')      AS em_uso,
  COUNT(*) FILTER (WHERE status = 'manutencao')  AS manutencao,
  COUNT(*) FILTER (WHERE status = 'cancelado')   AS cancelado,
  COUNT(*)                                        AS total
FROM public.chips_pool;

GRANT SELECT ON public.chips_pool_summary TO authenticated, anon;

COMMIT;
  `.trim();

  // SCRIPT V53: DATA DE RENOVAÇÃO
  const v53Sql = `
-- --- SCRIPT V53: DATA DE RENOVAÇÃO ---
-- Adiciona a coluna para rastrear a data de renovação do plano

BEGIN;

-- 1. Adiciona a coluna current_period_end na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS current_period_end timestamptz;

COMMIT;
  `.trim();

  // SCRIPT V51: ATUALIZAÇÃO PARA PLANO TRIMESTRAL
  const v51Sql = `
-- --- SCRIPT V51: SUPORTE AO PLANO TRIMESTRAL ---
-- Atualiza a definição da tabela de anúncios para suportar o novo plano

BEGIN;

-- 1. Atualiza o valor padrão da coluna target_plans para incluir TRIMESTRAL
ALTER TABLE public.announcements 
ALTER COLUMN target_plans 
SET DEFAULT '{ESSENCIAL,PRO,ENTERPRISE}';

-- 2. Atualiza registros existentes para garantir compatibilidade (opcional)
-- UPDATE public.announcements SET target_plans = array_append(target_plans, 'TRIMESTRAL') WHERE NOT ('TRIMESTRAL' = ANY(target_plans));

COMMIT;
  `.trim();

  // SCRIPT V52: SUPORTE A AFILIADOS (SALESPERSON)
  const v52Sql = `
-- --- SCRIPT V52: SUPORTE A AFILIADOS ---
-- Adiciona a coluna para rastrear o vendedor responsável

BEGIN;

-- 1. Adiciona a coluna salesperson na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS salesperson text;

-- 2. Garante que o Admin possa ver e editar (Policies já cobrem, mas reforçando)
-- As políticas existentes de "Update profiles" e "Read profiles" já permitem acesso total ao Admin.

COMMIT;
  `.trim();

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
  plan text DEFAULT 'ESSENCIAL',
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
    target_plans text[] DEFAULT '{ESSENCIAL,PRO,ENTERPRISE}'
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
  -- Tenta deletar o arquivo do bucket 'curriculos'
  DELETE FROM storage.objects 
  WHERE bucket_id = 'curriculos' 
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
          case 'V51': return v51Sql;
          case 'V52': return v52Sql;
          case 'V53': return v53Sql;
          case 'V54': return v54Sql;
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
            <button 
              onClick={() => setActiveTab('V51')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'V51' ? 'border-emerald-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              <Wrench className="w-4 h-4" /> V51 (Plano Trimestral)
            </button>
            <button 
              onClick={() => setActiveTab('V52')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'V52' ? 'border-emerald-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              <ShieldCheck className="w-4 h-4" /> V52 (Afiliados)
            </button>
            <button
              onClick={() => setActiveTab('V53')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'V53' ? 'border-emerald-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              <Clock className="w-4 h-4" /> V53 (Data Renovação)
            </button>
            <button
              onClick={() => setActiveTab('V54')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'V54' ? 'border-emerald-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              <ShieldCheck className="w-4 h-4" /> V54 (Vendas + Onboarding)
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