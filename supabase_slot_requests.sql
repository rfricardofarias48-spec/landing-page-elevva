-- ============================================================
-- Migration: criar tabela slot_requests
-- Notificações para recrutador quando candidato não encontra horários
-- Executar no Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.slot_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ DEFAULT now(),
  interview_id UUID NOT NULL UNIQUE,
  job_id       UUID NOT NULL,
  candidate_name TEXT,
  job_title      TEXT,
  profile_id   UUID NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'handled'))
);

-- RLS
ALTER TABLE public.slot_requests ENABLE ROW LEVEL SECURITY;

-- Recrutador vê e atualiza apenas as suas
CREATE POLICY "slot_requests_select_own"
  ON public.slot_requests FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "slot_requests_update_own"
  ON public.slot_requests FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid());

-- Service role (backend) acesso total
CREATE POLICY "slot_requests_service_all"
  ON public.slot_requests FOR ALL
  TO service_role
  USING (true);
