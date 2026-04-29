-- Migration: unify availability_slots as the single slot table
-- Run this in the Supabase SQL Editor

ALTER TABLE public.availability_slots
  ADD COLUMN IF NOT EXISTS is_booked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS booked_interview_id UUID REFERENCES public.interviews(id) ON DELETE SET NULL;

-- Index to speed up queries by user + status
CREATE INDEX IF NOT EXISTS idx_availability_slots_user_booked
  ON public.availability_slots (user_id, is_booked, slot_date, slot_time);
