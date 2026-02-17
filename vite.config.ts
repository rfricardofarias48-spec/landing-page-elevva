
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente do diretório atual
  // O terceiro parâmetro '' garante que carregamos envs sem prefixo VITE_ (como API_KEY)
  // Cast process to any to avoid TypeScript error regarding missing 'cwd' property in some environments
  const env = loadEnv(mode, (process as any).cwd(), '');

  // Tenta encontrar a chave em várias variações comuns
  const apiKey = env.API_KEY || env.VITE_API_KEY || env.GOOGLE_API_KEY || env.VITE_GOOGLE_API_KEY || process.env.API_KEY || "";

  // Log para debug no terminal (não aparece no navegador)
  if (apiKey) {
    console.log('\x1b[32m%s\x1b[0m', '✓ API Key do Gemini detectada com sucesso.');
  } else {
    console.log('\x1b[33m%s\x1b[0m', '⚠ Nenhuma API Key encontrada. Configure API_KEY no seu arquivo .env');
  }

  return {
    plugins: [react()],
    define: {
      // Define process.env.API_KEY globalmente para o código do navegador
      'process.env.API_KEY': JSON.stringify(apiKey),
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ""),
      // Fallback para evitar erro 'process is not defined'
      'process.env': JSON.stringify({ 
         NODE_ENV: mode,
         API_KEY: apiKey
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
