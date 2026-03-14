-- Ativar realtime para a tabela interviews (necessário para o SaaS atualizar a tela automaticamente quando o n8n mudar o status)
BEGIN;
  -- Verifica se a publicação existe, se não, cria
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      CREATE PUBLICATION supabase_realtime;
    END IF;
  END
  $$;

  -- Adiciona a tabela à publicação (ignora se já estiver adicionada)
  ALTER PUBLICATION supabase_realtime ADD TABLE public.interviews;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.interview_slots;
COMMIT;
