import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega todas as variáveis de ambiente do diretório atual.
  // O terceiro parâmetro '' garante que carregamos envs sem prefixo VITE_ (como API_KEY)
  const env = loadEnv(mode, (process as any).cwd(), '');

  // Tenta encontrar a chave em várias variações de nome comuns para facilitar a configuração
  const apiKey = env.API_KEY || env.VITE_API_KEY || env.GOOGLE_API_KEY || env.VITE_GOOGLE_API_KEY || process.env.API_KEY || "";

  return {
    plugins: [react()],
    define: {
      // Definição Granular: Substitui ocorrências explícitas no código.
      'process.env.API_KEY': JSON.stringify(apiKey),
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