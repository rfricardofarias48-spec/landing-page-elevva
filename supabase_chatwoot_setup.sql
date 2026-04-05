-- Chatwoot integration columns
-- Run this once on your Supabase project

-- Per-client Chatwoot config on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chatwoot_account_id INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chatwoot_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chatwoot_inbox_id INTEGER;

-- Human takeover flag and Chatwoot conversation tracking on agent_conversations
ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS human_takeover BOOLEAN DEFAULT FALSE;
ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS chatwoot_conversation_id INTEGER;
