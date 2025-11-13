import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',
  build: {
    outDir: '../backend/public',
    emptyOutDir: true,
  },
  server: {
    port: 4000,
    strictPort: true, // enforce port 4000 so docs & scripts stay consistent
    proxy: {
      '/api': {
        target: 'http://localhost:3334',
        changeOrigin: true,
        secure: false,
        // ensure cookies from backend pass through proxy
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // Helpful for debugging Set-Cookie issues
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
              console.log('[vite-proxy] Set-Cookie from backend:', setCookie);
            }
          });
        },
      },
    },
  },
  plugins: [react()],
});
