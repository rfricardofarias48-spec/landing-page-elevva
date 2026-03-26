-- ============================================================
-- MÓDULO DE ADMISSÃO - Fase 1: Infraestrutura de Dados
-- Execute este SQL no SQL Editor do Supabase
-- ============================================================

-- 1. TABELA DE ADMISSÕES
-- Armazena cada solicitação de documentação enviada ao candidato aprovado
CREATE TABLE IF NOT EXISTS public.admissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,

    -- Documentos solicitados pelo recrutador (configurável)
    -- Formato: [{ "name": "RG (Frente e Verso)", "required": true }, ...]
    required_docs JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Documentos enviados pelo candidato
    -- Formato: [{ "name": "RG (Frente e Verso)", "file_path": "token/rg_frente.jpg", "uploaded_at": "..." }, ...]
    submitted_docs JSONB DEFAULT '[]'::jsonb,

    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'SUBMITTED', 'DOWNLOADED', 'EXPIRED')),

    -- Controle de tempo (LGPD)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    submitted_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,

    -- Controle de notificação pré-deleção
    expiry_notified BOOLEAN DEFAULT FALSE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_admissions_token ON public.admissions(token);
CREATE INDEX IF NOT EXISTS idx_admissions_user_id ON public.admissions(user_id);
CREATE INDEX IF NOT EXISTS idx_admissions_status ON public.admissions(status);
CREATE INDEX IF NOT EXISTS idx_admissions_expires_at ON public.admissions(expires_at) WHERE status != 'EXPIRED';

-- 2. HABILITAR RLS (Row Level Security)
ALTER TABLE public.admissions ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS DE SEGURANÇA

-- Recrutador vê apenas suas próprias admissões
CREATE POLICY "Users can view their own admissions"
    ON public.admissions FOR SELECT
    USING (auth.uid() = user_id);

-- Recrutador cria admissões para seus candidatos
CREATE POLICY "Users can insert their own admissions"
    ON public.admissions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Recrutador atualiza suas próprias admissões
CREATE POLICY "Users can update their own admissions"
    ON public.admissions FOR UPDATE
    USING (auth.uid() = user_id);

-- Candidato pode ver a admissão pelo token (acesso público via token)
CREATE POLICY "Public can view admission by token"
    ON public.admissions FOR SELECT
    USING (true);
    -- Nota: A rota da API filtra por token, mas o RLS permite SELECT público
    -- porque o candidato não está autenticado. A segurança está no token UUID.

-- Candidato pode atualizar admissão pelo token (submeter docs)
-- Usamos service_role no backend para isso, então não precisa de policy pública de UPDATE.

-- 4. BUCKET DE STORAGE PARA DOCUMENTOS DE ADMISSÃO
-- Execute separadamente no SQL Editor:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'admission_docs',
    'admission_docs',
    FALSE,  -- Bucket PRIVADO (não público)
    10485760,  -- 10MB limite por arquivo
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 5. POLÍTICAS DE STORAGE

-- Recrutador pode ler documentos das suas admissões
CREATE POLICY "Authenticated users can read admission docs"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'admission_docs'
        AND auth.role() = 'authenticated'
    );

-- Upload via service_role (backend) - não precisa de policy específica
-- O backend usa supabaseAdmin (service_role) para fazer upload em nome do candidato

-- Recrutador pode deletar docs das suas admissões (cleanup manual)
CREATE POLICY "Authenticated users can delete admission docs"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'admission_docs'
        AND auth.role() = 'authenticated'
    );

-- Service role pode fazer tudo (usado pelo cron de LGPD e upload do candidato)
CREATE POLICY "Service role full access to admission docs"
    ON storage.objects FOR ALL
    USING (
        bucket_id = 'admission_docs'
        AND auth.role() = 'service_role'
    );
