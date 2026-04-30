-- Migration: expandir CHECK constraint de status em interviews
-- Inclui AGUARDANDO_NOVOS_HORARIOS e AGUARDANDO_ESCOLHA_SLOT que faltavam

-- 1. Remover qualquer constraint de check existente no campo status
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.interviews'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.interviews DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

-- 2. Adicionar constraint completa com todos os status usados pelo agente
ALTER TABLE public.interviews
ADD CONSTRAINT interviews_status_check
CHECK (status IN (
  'AGUARDANDO_RESPOSTA',
  'AGUARDANDO_ESCOLHA_SLOT',
  'AGUARDANDO_NOVOS_HORARIOS',
  'AGENDADA',
  'CONFIRMADA',
  'REMARCADA',
  'CANCELADA',
  'REALIZADA',
  'COMPLETED',
  'APROVADO'
));
