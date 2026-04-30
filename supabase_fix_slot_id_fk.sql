-- Migration: fix interviews.slot_id FK to point to availability_slots
-- The original FK (from supabase_interviews_v2.sql) references the old
-- interview_slots table. All slot logic now uses availability_slots.

-- Step 1: Drop the old FK constraint
ALTER TABLE public.interviews
  DROP CONSTRAINT IF EXISTS interviews_slot_id_fkey;

-- Step 2: Null out any slot_id values that don't exist in availability_slots
-- (orphaned references from the old interview_slots table)
UPDATE public.interviews
  SET slot_id = NULL
  WHERE slot_id IS NOT NULL
    AND slot_id NOT IN (SELECT id FROM public.availability_slots);

-- Step 3: Add new FK referencing the current slots table
ALTER TABLE public.interviews
  ADD CONSTRAINT interviews_slot_id_fkey
  FOREIGN KEY (slot_id) REFERENCES public.availability_slots(id) ON DELETE SET NULL;
