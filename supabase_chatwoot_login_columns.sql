-- Colunas para login do cliente no Chatwoot (conta própria por cliente)
-- Execute uma vez no Supabase SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS chatwoot_login_email    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS chatwoot_login_password TEXT DEFAULT NULL;
