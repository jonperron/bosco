import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In dev, Vite serves the frontend and proxies API calls to the NestJS app.
// In production, the API serves the built frontend: VITE_API_BASE_URL stays
// empty and the calls stay same-origin.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
