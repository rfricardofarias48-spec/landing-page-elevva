-- ============================================================
-- Migration: adicionar coluna billing na tabela sales
-- e atualizar constraint de plan para aceitar variantes anuais
-- Executar no Supabase SQL Editor
-- ============================================================

-- 1. Adicionar coluna billing (mensal | anual)
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS billing TEXT NOT NULL DEFAULT 'mensal'
    CHECK (billing IN ('mensal', 'anual'));

-- 2. Remover constraint antiga de plan e criar nova que aceita variantes anuais + agências
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_plan_check;

ALTER TABLE public.sales
  ADD CONSTRAINT sales_plan_check
    CHECK (plan IN ('ESSENCIAL', 'ESSENCIAL_ANUAL', 'PRO', 'PRO_ANUAL', 'MAX', 'MAX_ANUAL', 'ULTRA', 'ULTRA_ANUAL', 'ENTERPRISE'));

-- ============================================================
-- Migration: adicionar coluna password_hash na tabela salespeople
-- ============================================================
ALTER TABLE public.salespeople
  ADD COLUMN IF NOT EXISTS password_hash TEXT;
