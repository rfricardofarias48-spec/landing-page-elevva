-- ============================================================
-- ELEVVA SDR — Modelo de Dados
-- Rode este script no Supabase SQL Editor
-- ============================================================

-- 1. TABELA: sdr_leads
-- Armazena os leads capturados via CTWA e outros canais
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sdr_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  name TEXT,
  email TEXT,
  company TEXT,
  role TEXT,                -- cargo do lead
  company_size TEXT,        -- faixa: 1-10, 11-50, 51-200, 200+
  monthly_hires TEXT,       -- volume de contratações/mês
  main_pain TEXT,           -- dor principal relatada
  source TEXT NOT NULL DEFAULT 'CTWA',  -- CTWA, organic, referral, site
  utm_campaign TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  ad_id TEXT,               -- ID do anúncio Meta
  referral_data JSONB,      -- dados brutos do referral CTWA
  status TEXT NOT NULL DEFAULT 'NOVO'
    CHECK (status IN ('NOVO','QUALIFICANDO','QUALIFICADO','DEMO_OFERECIDA','DEMO_AGENDADA','CONVERTIDO','PERDIDO')),
  lost_reason TEXT,         -- motivo da perda (quando status = PERDIDO)
  chatwoot_contact_id TEXT,
  chatwoot_conversation_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices
CREATE INDEX idx_sdr_leads_phone ON public.sdr_leads (phone);
CREATE INDEX idx_sdr_leads_status ON public.sdr_leads (status);
CREATE INDEX idx_sdr_leads_source ON public.sdr_leads (source);
CREATE INDEX idx_sdr_leads_created ON public.sdr_leads (created_at DESC);

-- RLS
ALTER TABLE public.sdr_leads ENABLE ROW LEVEL SECURITY;

-- Backend (service_role) tem acesso total
CREATE POLICY "service_role_full_access" ON public.sdr_leads
  FOR ALL USING (true) WITH CHECK (true);

-- Usuários autenticados podem ler leads
CREATE POLICY "authenticated_read_sdr_leads" ON public.sdr_leads
  FOR SELECT TO authenticated USING (true);


-- ============================================================
-- 2. TABELA: sdr_conversations
-- Máquina de estados do agente SDR (similar a agent_conversations)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sdr_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  lead_id UUID REFERENCES public.sdr_leads(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL,   -- instância Evolution do chip SDR
  state TEXT NOT NULL DEFAULT 'NOVO'
    CHECK (state IN (
      'NOVO',
      'SAUDACAO_ENVIADA',
      'QUALIFICANDO',
      'TIRANDO_DUVIDAS',
      'OFERECENDO_DEMO',
      'AGUARDANDO_ESCOLHA_SLOT',
      'DEMO_AGENDADA',
      'FOLLOW_UP_1',
      'FOLLOW_UP_2',
      'CONVERTIDO',
      'PERDIDO',
      'ESCALADO_HUMANO'
    )),
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- context armazena: { name, company, role, company_size, pain,
  --                     scheduling_token, demo_slot_id, google_event_id,
  --                     meeting_link, follow_up_count, last_follow_up_at }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE (phone, instance_name)  -- Uma conversa por lead por instância
);

-- Índices
CREATE INDEX idx_sdr_conv_phone ON public.sdr_conversations (phone);
CREATE INDEX idx_sdr_conv_lead ON public.sdr_conversations (lead_id);
CREATE INDEX idx_sdr_conv_state ON public.sdr_conversations (state);
CREATE INDEX idx_sdr_conv_instance ON public.sdr_conversations (instance_name);

-- RLS
ALTER TABLE public.sdr_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON public.sdr_conversations
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_sdr_conversations" ON public.sdr_conversations
  FOR SELECT TO authenticated USING (true);


-- ============================================================
-- 3. TABELA: sdr_demo_slots
-- Horários disponíveis para demonstrações (8h-20h)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sdr_demo_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_date DATE NOT NULL,
  slot_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  is_booked BOOLEAN NOT NULL DEFAULT false,
  booked_by UUID REFERENCES public.sdr_leads(id) ON DELETE SET NULL,
  google_event_id TEXT,
  meeting_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE (slot_date, slot_time)  -- Sem slots duplicados
);

-- Índices
CREATE INDEX idx_sdr_slots_date ON public.sdr_demo_slots (slot_date);
CREATE INDEX idx_sdr_slots_available ON public.sdr_demo_slots (slot_date, slot_time)
  WHERE is_booked = false;

-- RLS
ALTER TABLE public.sdr_demo_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON public.sdr_demo_slots
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_sdr_slots" ON public.sdr_demo_slots
  FOR SELECT TO authenticated USING (true);

-- Público pode ler slots disponíveis (para página de agendamento)
CREATE POLICY "public_read_available_slots" ON public.sdr_demo_slots
  FOR SELECT TO anon USING (is_booked = false);


-- ============================================================
-- 4. TABELA: sdr_messages
-- Histórico de mensagens para auditoria e Chatwoot sync
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sdr_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.sdr_leads(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.sdr_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('IN', 'OUT')),
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'list', 'button', 'image', 'document', 'audio')),
  chatwoot_message_id TEXT,  -- ID espelhado no Chatwoot
  metadata JSONB DEFAULT '{}'::jsonb,  -- dados extras (wa_message_id, etc)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices
CREATE INDEX idx_sdr_msg_lead ON public.sdr_messages (lead_id);
CREATE INDEX idx_sdr_msg_conv ON public.sdr_messages (conversation_id);
CREATE INDEX idx_sdr_msg_created ON public.sdr_messages (created_at DESC);

-- RLS
ALTER TABLE public.sdr_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON public.sdr_messages
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_sdr_messages" ON public.sdr_messages
  FOR SELECT TO authenticated USING (true);


-- ============================================================
-- 5. TABELA: sdr_config
-- Configurações do agente SDR (knowledge base, horários, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sdr_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- RLS
ALTER TABLE public.sdr_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON public.sdr_config
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_sdr_config" ON public.sdr_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_update_sdr_config" ON public.sdr_config
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Inserir configurações iniciais
INSERT INTO public.sdr_config (key, value) VALUES
  ('instance_name', '"elevva-sdr"'::jsonb),
  ('scheduling_hours', '{"start": "08:00", "end": "20:00"}'::jsonb),
  ('demo_duration_minutes', '30'::jsonb),
  ('follow_up_interval_hours', '48'::jsonb),
  ('max_follow_ups', '2'::jsonb),
  ('agent_active', 'true'::jsonb);


-- ============================================================
-- 6. FUNÇÃO: updated_at automático
-- Atualiza o campo updated_at em sdr_leads e sdr_conversations
-- ============================================================
CREATE OR REPLACE FUNCTION public.sdr_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sdr_leads_updated_at
  BEFORE UPDATE ON public.sdr_leads
  FOR EACH ROW EXECUTE FUNCTION public.sdr_update_updated_at();

CREATE TRIGGER sdr_conversations_updated_at
  BEFORE UPDATE ON public.sdr_conversations
  FOR EACH ROW EXECUTE FUNCTION public.sdr_update_updated_at();


-- ============================================================
-- 7. REALTIME — Habilitar para tabelas que precisam de updates em tempo real
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.sdr_leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sdr_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sdr_messages;


-- ============================================================
-- 8. VIEW: Funil SDR (métricas rápidas)
-- ============================================================
CREATE OR REPLACE VIEW public.sdr_funnel AS
SELECT
  COUNT(*) FILTER (WHERE status = 'NOVO') AS novos,
  COUNT(*) FILTER (WHERE status = 'QUALIFICANDO') AS qualificando,
  COUNT(*) FILTER (WHERE status = 'QUALIFICADO') AS qualificados,
  COUNT(*) FILTER (WHERE status IN ('DEMO_OFERECIDA', 'DEMO_AGENDADA')) AS demos,
  COUNT(*) FILTER (WHERE status = 'DEMO_AGENDADA') AS demos_agendadas,
  COUNT(*) FILTER (WHERE status = 'CONVERTIDO') AS convertidos,
  COUNT(*) FILTER (WHERE status = 'PERDIDO') AS perdidos,
  COUNT(*) AS total,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'DEMO_AGENDADA')::NUMERIC /
    NULLIF(COUNT(*), 0) * 100, 1
  ) AS taxa_agendamento_pct
FROM public.sdr_leads;
