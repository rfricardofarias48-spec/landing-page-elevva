-- Adiciona colunas para integração com Google Calendar na tabela profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS has_calendar_integration BOOLEAN DEFAULT false;
