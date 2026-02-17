import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega todas as variáveis de ambiente do diretório atual.
  // O terceiro parâmetro '' garante que carregamos envs sem prefixo VITE_ (como API_KEY)
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Definição Granular: Substitui ocorrências explícitas no código.
      // Isso é mais seguro que substituir o objeto process.env inteiro.
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY || ""),
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ""),
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    build: {
      chunkSizeWarningLimit: 3000, 
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            utils: ['@supabase/supabase-js', 'lucide-react'],
            ai: ['@google/genai']
          }
        }
      }
    },
    server: {
      port: 5173,
    },
  };
});