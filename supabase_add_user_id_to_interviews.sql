-- Migration: add user_id to interviews table
-- This stores the recruiter's user_id directly in the interview,
-- so the scheduling link never depends on job lookup to find slots.

ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill user_id from the associated job
UPDATE public.interviews i
SET user_id = j.user_id
FROM public.jobs j
WHERE i.job_id = j.id
  AND i.user_id IS NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_interviews_user_id ON public.interviews(user_id);
