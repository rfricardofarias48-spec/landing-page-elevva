-- Corrige entrevistas travadas em CONFIRMADA onde o candidato já pediu reagendamento
-- (conversas em estado AGUARDANDO_NOVOS_HORARIOS mas interview.status ainda = CONFIRMADA)

UPDATE public.interviews i
SET status = 'AGUARDANDO_NOVOS_HORARIOS'
WHERE i.status = 'CONFIRMADA'
  AND EXISTS (
    SELECT 1
    FROM public.agent_conversations ac
    WHERE (ac.context->>'interview_id') = i.id::text
      AND ac.state = 'AGUARDANDO_NOVOS_HORARIOS'
  );
