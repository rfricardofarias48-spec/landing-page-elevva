import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente do diretório atual
  // O terceiro parâmetro '' garante que carregamos envs sem prefixo VITE_ (como API_KEY)
  const env = loadEnv(mode, (process as any).cwd(), '');

  // Tenta encontrar a chave em todas as variações possíveis (Vercel, Local, Prefixo VITE)
  const apiKey = env.VITE_API_KEY || env.API_KEY || env.GOOGLE_API_KEY || process.env.VITE_API_KEY || process.env.API_KEY || "";

  // Log para debug no terminal de build (Vercel Logs)
  if (apiKey) {
    console.log('\x1b[32m%s\x1b[0m', '✓ API Key do Gemini detectada e injetada no build.');
  } else {
    console.log('\x1b[33m%s\x1b[0m', '⚠ AVISO: Nenhuma API Key encontrada durante o build. O app pode falhar em produção.');
  }

  return {
    plugins: [react()],
    define: {
      // Define a chave globalmente para o navegador de forma segura
      // Isso permite acessar tanto via process.env.API_KEY quanto import.meta.env.VITE_API_KEY
      'process.env.API_KEY': JSON.stringify(apiKey),
      'import.meta.env.VITE_API_KEY': JSON.stringify(apiKey),
      
      // Definições do Supabase
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ""),
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
