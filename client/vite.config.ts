import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import type { UserConfig } from 'vite';

// Vite requires a default export here; application code uses named exports only.
export default defineConfig(({ mode }): UserConfig => {
  const env: Record<string, string> = loadEnv(mode, process.cwd(), '');
  // Proxying /api keeps the browser same-origin, so the backend needs no CORS headers.
  const apiOrigin: string = env.CAMPUSHUB_API_ORIGIN ?? 'http://localhost:3000';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': { target: apiOrigin, changeOrigin: true },
      },
    },
  };
});
