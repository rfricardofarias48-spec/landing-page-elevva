-- Adiciona a coluna interviewer_name na tabela interview_slots
ALTER TABLE public.interview_slots ADD COLUMN IF NOT EXISTS interviewer_name TEXT;

-- Opcional: Adicionar também na tabela interviews se preferir por entrevista, 
-- mas como o agendamento é por slot, faz mais sentido no slot.
-- ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS interviewer_name TEXT;
