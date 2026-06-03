import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const basePath = process.env.VITE_BASE_PATH || '/itrequest/';

export default defineConfig({
  base: basePath,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/itrequest/api': {
        target: 'http://127.0.0.1:5101',
        changeOrigin: true,
      },
    },
  },
});
