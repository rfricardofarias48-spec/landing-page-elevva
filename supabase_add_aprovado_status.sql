-- Executar no SQL Editor do Supabase para adicionar o status APROVADO nas entrevistas

-- 1. Remover a constraint de check existente no campo status
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

-- 2. Adicionar nova constraint incluindo APROVADO
ALTER TABLE public.interviews
ADD CONSTRAINT interviews_status_check
CHECK (status IN ('AGUARDANDO_RESPOSTA', 'AGENDADA', 'CONFIRMADA', 'REMARCADA', 'CANCELADA', 'REALIZADA', 'COMPLETED', 'APROVADO'));
