-- ============================================================
-- SCRIPT: Sistema de Nichos para Painel de Vagas
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1. Criar tabela de nichos
CREATE TABLE IF NOT EXISTS niches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  order_pos   INT  DEFAULT 0,
  is_pinned   BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Adicionar niche_id na tabela jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS niche_id UUID REFERENCES niches(id) ON DELETE SET NULL;

-- 3. RLS — usuário só vê/edita seus próprios nichos
ALTER TABLE niches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own niches" ON niches
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own niches" ON niches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own niches" ON niches
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own niches" ON niches
  FOR DELETE USING (auth.uid() = user_id);

-- 4. Acesso público (anônimo) para leitura — necessário para o portal de candidatos
CREATE POLICY "Public can view niches" ON niches
  FOR SELECT TO anon USING (true);

-- 5. Jobs: acesso público para leitura (portal de candidatos)
-- Verifica se já existe e cria apenas se necessário
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'jobs' AND policyname = 'Public can view jobs'
  ) THEN
    CREATE POLICY "Public can view jobs" ON jobs
      FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- 6. Candidates: inserção pública (portal de candidatos envia currículos)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'candidates' AND policyname = 'Public can insert candidates'
  ) THEN
    CREATE POLICY "Public can insert candidates" ON candidates
      FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;

-- 7. Índices para performance
CREATE INDEX IF NOT EXISTS idx_niches_user_id ON niches(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_niche_id ON jobs(niche_id);

-- ============================================================
-- VERIFICAÇÃO: rode isso para confirmar que funcionou
-- SELECT * FROM niches LIMIT 5;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'niche_id';
-- ============================================================
