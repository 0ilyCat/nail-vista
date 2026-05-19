import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4180,
    proxy: {
      '/api': {
        target: 'http://localhost:8190',
        changeOrigin: true,
      },
      '/static': {
        target: 'http://localhost:8190',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8190',
        changeOrigin: true,
      },
      '/results': {
        target: 'http://localhost:8190',
        changeOrigin: true,
      },
    },
  },
});
