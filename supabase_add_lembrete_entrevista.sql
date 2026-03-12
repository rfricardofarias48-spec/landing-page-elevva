-- Executar no SQL Editor do Supabase para adicionar a funcionalidade de lembrete de entrevista

-- 1. Adicionar coluna lembrete_enviado
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS lembrete_enviado BOOLEAN DEFAULT false;

-- 2. Atualizar os status permitidos na tabela interviews
-- Primeiro, removemos a constraint de check existente no campo status
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

-- Adicionamos a nova constraint com os novos status ('CONFIRMADA', 'REMARCADA')
ALTER TABLE public.interviews 
ADD CONSTRAINT interviews_status_check 
CHECK (status IN ('AGUARDANDO_RESPOSTA', 'AGENDADA', 'CONFIRMADA', 'REMARCADA', 'CANCELADA', 'REALIZADA', 'COMPLETED'));

-- 3. Opcional: Criar um índice para otimizar a busca do n8n por lembretes não enviados
CREATE INDEX IF NOT EXISTS idx_interviews_lembrete ON public.interviews(lembrete_enviado) WHERE lembrete_enviado = false;
