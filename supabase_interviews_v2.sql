-- Execute este SQL no SQL Editor do Supabase para criar as tabelas de Entrevistas e Horários

-- Tabela de Horários Disponíveis (Slots)
CREATE TABLE IF NOT EXISTS public.interview_slots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    format TEXT NOT NULL CHECK (format IN ('ONLINE', 'PRESENCIAL')),
    location TEXT,
    slot_date DATE NOT NULL,
    slot_time TIME NOT NULL,
    is_booked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Habilitar RLS para interview_slots
ALTER TABLE public.interview_slots ENABLE ROW LEVEL SECURITY;

-- Políticas para interview_slots (assumindo que o dono da vaga tem acesso)
CREATE POLICY "Users can view slots for their jobs" 
    ON public.interview_slots FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.jobs 
            WHERE jobs.id = interview_slots.job_id 
            AND jobs.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert slots for their jobs" 
    ON public.interview_slots FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.jobs 
            WHERE jobs.id = job_id 
            AND jobs.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update slots for their jobs" 
    ON public.interview_slots FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.jobs 
            WHERE jobs.id = interview_slots.job_id 
            AND jobs.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete slots for their jobs" 
    ON public.interview_slots FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM public.jobs 
            WHERE jobs.id = interview_slots.job_id 
            AND jobs.user_id = auth.uid()
        )
    );


-- Tabela de Entrevistas (Relacionamento Candidato -> Vaga -> Slot)
-- Se a tabela interviews já existir (do passo anterior), você pode precisar fazer um DROP TABLE public.interviews CASCADE; antes.
DROP TABLE IF EXISTS public.interviews CASCADE;

CREATE TABLE public.interviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    slot_id UUID REFERENCES public.interview_slots(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'AGUARDANDO_RESPOSTA' CHECK (status IN ('AGUARDANDO_RESPOSTA', 'AGENDADA', 'CANCELADA', 'REALIZADA')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Habilitar RLS para interviews
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

-- Políticas para interviews
CREATE POLICY "Users can view interviews for their jobs" 
    ON public.interviews FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.jobs 
            WHERE jobs.id = interviews.job_id 
            AND jobs.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert interviews for their jobs" 
    ON public.interviews FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.jobs 
            WHERE jobs.id = job_id 
            AND jobs.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update interviews for their jobs" 
    ON public.interviews FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.jobs 
            WHERE jobs.id = interviews.job_id 
            AND jobs.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete interviews for their jobs" 
    ON public.interviews FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM public.jobs 
            WHERE jobs.id = interviews.job_id 
            AND jobs.user_id = auth.uid()
        )
    );

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_interview_slots_job_id ON public.interview_slots(job_id);
CREATE INDEX IF NOT EXISTS idx_interviews_job_id ON public.interviews(job_id);
CREATE INDEX IF NOT EXISTS idx_interviews_candidate_id ON public.interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interviews_slot_id ON public.interviews(slot_id);
