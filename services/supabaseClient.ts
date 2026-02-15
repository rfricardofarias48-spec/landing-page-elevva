
import { createClient } from '@supabase/supabase-js';

// --- INSTRUÇÕES DE CORREÇÃO (ERRO DE CARREGAMENTO INFINITO) ---
// Se o app não sai da tela de carregamento, suas chaves do Supabase
// provavelmente expiraram ou o projeto foi pausado por inatividade.
// 1. Vá ao painel do Supabase (Project Settings -> API).
// 2. Copie a nova "Project URL" e "anon public" key.
// 3. Substitua abaixo.

const supabaseUrl = 'https://dbfttgtntntuiimbqzgu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZnR0Z3RudG50dWlpbWJxemd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTUwODksImV4cCI6MjA4NTg5MTA4OX0.H36Kv-PzK8Ab8FN5HzAWO5S_y8t-z8gExl5GsDBQchs';

export const supabase = createClient(supabaseUrl, supabaseKey);
