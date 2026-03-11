-- Execute este SQL no SQL Editor do Supabase para criar a tabela de Entrevistas

CREATE TABLE IF NOT EXISTS public.interviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'PENDING', -- PENDING, SCHEDULED, COMPLETED, CANCELED
    available_slots TEXT[], -- Array de strings com os dias e horários enviados ao candidato
    scheduled_date DATE,
    scheduled_time TIME,
    meeting_link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

-- Criar políticas de segurança para garantir que cada usuário só veja/edite suas próprias entrevistas
CREATE POLICY "Users can view their own interviews" 
    ON public.interviews FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own interviews" 
    ON public.interviews FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own interviews" 
    ON public.interviews FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own interviews" 
    ON public.interviews FOR DELETE 
    USING (auth.uid() = user_id);

-- Opcional: Criar índices para melhorar a performance das consultas
CREATE INDEX IF NOT EXISTS idx_interviews_user_id ON public.interviews(user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_job_id ON public.interviews(job_id);
CREATE INDEX IF NOT EXISTS idx_interviews_candidate_id ON public.interviews(candidate_id);
