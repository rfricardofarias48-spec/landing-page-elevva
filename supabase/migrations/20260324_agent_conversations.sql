-- ============================================================
-- Agent Conversations Table
-- Execute este script no Supabase → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text NOT NULL,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id      uuid REFERENCES jobs(id) ON DELETE SET NULL,
  state       text NOT NULL DEFAULT 'NOVO',
  context     jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- One conversation per candidate per recruiter
  UNIQUE (phone, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_conv_phone   ON agent_conversations (phone);
CREATE INDEX IF NOT EXISTS idx_agent_conv_user_id ON agent_conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conv_state   ON agent_conversations (state);

-- RLS: the table is accessed exclusively via the service-role key on the backend,
-- but we still enable RLS so anon/authed tokens can't read it directly.
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;

-- Allow the authenticated user to read only their own conversations (optional / for future use)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_conversations' AND policyname = 'owner_select'
  ) THEN
    CREATE POLICY owner_select ON agent_conversations
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
