
import { createClient } from '@supabase/supabase-js';

// As chaves são carregadas das variáveis de ambiente definidas no vite.config.ts
// Na Vercel, o process.env.VITE_SUPABASE_URL é preenchido automaticamente se configurado nas Environment Variables
// Caso contrário, usa os valores hardcoded para desenvolvimento local.

const localUrl = 'https://dbfttgtntntuiimbqzgu.supabase.co';
const localKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZnR0Z3RudG50dWlpbWJxemd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTUwODksImV4cCI6MjA4NTg5MTA4OX0.H36Kv-PzK8Ab8FN5HzAWO5S_y8t-z8gExl5GsDBQchs';

// Prioriza Vercel/Env Vars, fallback para Local
const supabaseUrl = process.env.VITE_SUPABASE_URL || localUrl;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || localKey;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "⚠️ ATENÇÃO: Variáveis de ambiente do Supabase não detectadas.\n" +
    "1. Crie um arquivo .env na raiz do projeto localmente.\n" +
    "2. Na Vercel, adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas configurações do projeto."
  );
}

// Cria o cliente com as chaves resolvidas
export const supabase = createClient(supabaseUrl, supabaseKey);
