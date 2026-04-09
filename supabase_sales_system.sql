-- ============================================================
-- SISTEMA DE VENDAS, COMISSIONAMENTO E ONBOARDING AUTOMÁTICO
-- Elevva — 2026
-- ============================================================
-- Executar no Supabase SQL Editor (em ordem)
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. VENDEDORES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.salespeople (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT        NOT NULL,
  email              TEXT        NOT NULL UNIQUE,
  phone              TEXT,
  commission_pct     NUMERIC(5,2) NOT NULL DEFAULT 15.00,  -- % de comissão
  asaas_wallet_id    TEXT,        -- ID da subconta/carteira no Asaas
  asaas_customer_id  TEXT,        -- ID do cliente no Asaas (para o split)
  status             TEXT        NOT NULL DEFAULT 'active'  -- active | inactive
    CHECK (status IN ('active', 'inactive')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para busca por email
CREATE INDEX IF NOT EXISTS salespeople_email_idx ON public.salespeople(email);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER salespeople_updated_at
  BEFORE UPDATE ON public.salespeople
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE public.salespeople ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Somente service role acessa salespeople"
  ON public.salespeople FOR ALL
  USING (true)
  WITH CHECK (true);


-- ────────────────────────────────────────────────────────────
-- 2. VENDAS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  salesperson_id       UUID        REFERENCES public.salespeople(id) ON DELETE SET NULL,

  -- Dados do cliente
  client_name          TEXT        NOT NULL,
  client_email         TEXT        NOT NULL,
  client_phone         TEXT        NOT NULL,

  -- Plano e valores
  plan                 TEXT        NOT NULL
    CHECK (plan IN ('ESSENCIAL', 'PRO', 'ENTERPRISE')),
  amount               NUMERIC(10,2) NOT NULL,          -- valor total cobrado
  commission_amount    NUMERIC(10,2) NOT NULL,          -- valor da comissão do vendedor

  -- Asaas
  asaas_payment_id     TEXT,                            -- ID do pagamento/link no Asaas
  asaas_link_url       TEXT,                            -- URL do link de pagamento

  -- Status do pagamento
  status               TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded')),
  paid_at              TIMESTAMPTZ,

  -- Status do onboarding (rastreia cada etapa)
  onboarding_status    TEXT        NOT NULL DEFAULT 'aguardando'
    CHECK (onboarding_status IN (
      'aguardando',      -- aguardando pagamento
      'em_progresso',    -- onboarding iniciado
      'concluido',       -- tudo provisionado
      'erro'             -- falha em alguma etapa
    )),
  onboarding_step      INT         DEFAULT 0,           -- etapa onde parou (para retry)
  onboarding_context   JSONB       DEFAULT '{}',        -- IDs criados em cada etapa

  -- Referência ao cliente provisionado
  client_user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS sales_salesperson_idx  ON public.sales(salesperson_id);
CREATE INDEX IF NOT EXISTS sales_status_idx        ON public.sales(status);
CREATE INDEX IF NOT EXISTS sales_asaas_payment_idx ON public.sales(asaas_payment_id);
CREATE INDEX IF NOT EXISTS sales_client_email_idx  ON public.sales(client_email);

CREATE TRIGGER sales_updated_at
  BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Somente service role acessa sales"
  ON public.sales FOR ALL
  USING (true)
  WITH CHECK (true);


-- ────────────────────────────────────────────────────────────
-- 3. POOL DE CHIPS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chips_pool (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number         TEXT        NOT NULL UNIQUE,     -- número no formato 5511999999999
  evolution_instance   TEXT        NOT NULL UNIQUE,     -- nome da instância no Evolution
  display_name         TEXT,                            -- apelido para identificar no admin

  status               TEXT        NOT NULL DEFAULT 'disponivel'
    CHECK (status IN ('disponivel', 'em_uso', 'manutencao', 'cancelado')),

  -- Quando em uso: a quem está atribuído
  assigned_to          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at          TIMESTAMPTZ,
  assigned_sale_id     UUID        REFERENCES public.sales(id) ON DELETE SET NULL,

  -- Observações internas
  notes                TEXT,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chips_pool_status_idx ON public.chips_pool(status);

CREATE TRIGGER chips_pool_updated_at
  BEFORE UPDATE ON public.chips_pool
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.chips_pool ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Somente service role acessa chips_pool"
  ON public.chips_pool FOR ALL
  USING (true)
  WITH CHECK (true);


-- ────────────────────────────────────────────────────────────
-- 4. COLUNAS EXTRAS EM PROFILES
--    Registra o que foi provisionado para cada cliente
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS chatwoot_account_id    INT,
  ADD COLUMN IF NOT EXISTS chatwoot_inbox_id      INT,
  ADD COLUMN IF NOT EXISTS chatwoot_user_id       INT,
  ADD COLUMN IF NOT EXISTS chatwoot_user_token    TEXT,
  ADD COLUMN IF NOT EXISTS evolution_instance     TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_number        TEXT,
  ADD COLUMN IF NOT EXISTS sale_id                UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS onboarded_at           TIMESTAMPTZ;


-- ────────────────────────────────────────────────────────────
-- 5. VIEW — RESUMO DE COMISSÕES POR VENDEDOR
--    Substitui o cálculo dinâmico do AdminDashboard
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.salesperson_commission_summary AS
SELECT
  sp.id,
  sp.name,
  sp.email,
  sp.commission_pct,
  sp.status,
  COUNT(s.id)                                             AS total_sales,
  COUNT(s.id) FILTER (WHERE s.status = 'paid')           AS paid_sales,
  COUNT(s.id) FILTER (WHERE s.status = 'pending')        AS pending_sales,
  COALESCE(SUM(s.amount) FILTER (WHERE s.status = 'paid'), 0)             AS total_revenue,
  COALESCE(SUM(s.commission_amount) FILTER (WHERE s.status = 'paid'), 0)  AS total_commission,
  COALESCE(SUM(s.commission_amount) FILTER (WHERE s.status = 'pending'), 0) AS pending_commission,
  COUNT(s.id) FILTER (WHERE s.plan = 'ESSENCIAL' AND s.status = 'paid')   AS essencial_count,
  COUNT(s.id) FILTER (WHERE s.plan = 'PRO'       AND s.status = 'paid')   AS pro_count,
  COUNT(s.id) FILTER (WHERE s.plan = 'ENTERPRISE' AND s.status = 'paid')  AS enterprise_count
FROM public.salespeople sp
LEFT JOIN public.sales s ON s.salesperson_id = sp.id
GROUP BY sp.id, sp.name, sp.email, sp.commission_pct, sp.status;


-- ────────────────────────────────────────────────────────────
-- 6. VIEW — ALERTAS DO POOL DE CHIPS
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.chips_pool_summary AS
SELECT
  COUNT(*) FILTER (WHERE status = 'disponivel')  AS disponivel,
  COUNT(*) FILTER (WHERE status = 'em_uso')      AS em_uso,
  COUNT(*) FILTER (WHERE status = 'manutencao')  AS manutencao,
  COUNT(*) FILTER (WHERE status = 'cancelado')   AS cancelado,
  COUNT(*)                                        AS total
FROM public.chips_pool;


-- ────────────────────────────────────────────────────────────
-- FIM
-- ────────────────────────────────────────────────────────────
