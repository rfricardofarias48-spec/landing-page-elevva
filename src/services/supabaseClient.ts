
import { createClient } from '@supabase/supabase-js';

// Tenta pegar das variáveis de ambiente (Vercel/GitHub Secrets)
const envUrl = process.env.VITE_SUPABASE_URL;
const envKey = process.env.VITE_SUPABASE_ANON_KEY;

// Fallback hardcoded APENAS para desenvolvimento local de emergência
const localUrl = 'https://dbfttgtntntuiimbqzgu.supabase.co';
const localKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZnR0Z3RudG50dWlpbWJxemd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTUwODksImV4cCI6MjA4NTg5MTA4OX0.H36Kv-PzK8Ab8FN5HzAWO5S_y8t-z8gExl5GsDBQchs';

// Lógica de seleção: Env Var > Hardcoded > String Vazia (para evitar crash)
const supabaseUrl = envUrl && envUrl.length > 0 ? envUrl : localUrl;
const supabaseKey = envKey && envKey.length > 0 ? envKey : localKey;

export const isConfigured = supabaseUrl && supabaseKey;

if (!isConfigured) {
  console.warn("Supabase credentials missing. Check your .env file or Vercel Environment Variables.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
