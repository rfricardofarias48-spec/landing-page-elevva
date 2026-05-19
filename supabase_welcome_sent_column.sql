-- Coluna para controlar envio único da mensagem de boas-vindas
-- Execute uma vez no Supabase SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_sent BOOLEAN DEFAULT FALSE;
