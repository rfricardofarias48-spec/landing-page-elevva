-- Tabela de log de geração de leads via Apify
-- Execute este script no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS sdr_generation_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      TEXT,
  count       INTEGER NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sdr_gen_log_at ON sdr_generation_log (generated_at DESC);

-- Permite que o service role insira e leia (sem RLS)
ALTER TABLE sdr_generation_log DISABLE ROW LEVEL SECURITY;
