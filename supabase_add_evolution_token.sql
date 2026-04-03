-- Adiciona coluna evolution_token na tabela profiles
-- Execute este SQL no Supabase SQL Editor

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS evolution_token text;

COMMENT ON COLUMN profiles.evolution_token IS
'Token da instância Evolution GO. Usado para autenticação ao enviar mensagens. Configurado no Admin.';
