-- Criar tabela mensagens_bento
CREATE TABLE IF NOT EXISTS public.mensagens_bento (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entrevista_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE,
    remetente TEXT CHECK (remetente IN ('Bento', 'Recrutador')) NOT NULL,
    mensagem TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Habilitar RLS
ALTER TABLE public.mensagens_bento ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
-- Permite que usuários autenticados vejam mensagens de entrevistas que pertencem às suas vagas
CREATE POLICY "Users can view messages for their interviews" 
    ON public.mensagens_bento FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.interviews i
            JOIN public.jobs j ON i.job_id = j.id
            WHERE i.id = mensagens_bento.entrevista_id 
            AND j.user_id = auth.uid()
        )
    );

-- Permite que usuários autenticados insiram mensagens em entrevistas que pertencem às suas vagas
CREATE POLICY "Users can insert messages for their interviews" 
    ON public.mensagens_bento FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.interviews i
            JOIN public.jobs j ON i.job_id = j.id
            WHERE i.id = entrevista_id 
            AND j.user_id = auth.uid()
        )
    );

-- Habilitar Realtime para a tabela mensagens_bento
-- O Supabase precisa que a tabela esteja na publication "supabase_realtime" para disparar eventos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'mensagens_bento'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens_bento;
  END IF;
END
$$;
