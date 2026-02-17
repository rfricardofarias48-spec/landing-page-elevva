
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega todas as variáveis de ambiente (o terceiro parâmetro '' carrega tudo, não só VITE_)
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Define process.env como um objeto contendo EXPLICITAMENTE as chaves necessárias.
      // Isso evita conflitos onde 'process.env': {} anula as chaves específicas.
      'process.env': JSON.stringify({
        API_KEY: env.API_KEY || process.env.API_KEY || "",
        VITE_SUPABASE_URL: env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
        VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "",
        NODE_ENV: process.env.NODE_ENV || 'development',
      }),
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
