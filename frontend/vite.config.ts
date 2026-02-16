import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',
  build: {
    outDir: '../backend/public',
    emptyOutDir: true,
    // Drop console.log in production builds
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Split heavy vendor libs into separate cached chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-mui': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          'vendor-monaco': ['@monaco-editor/react'],
        },
      },
    },
  },
  server: {
    port: 4000,
    strictPort: true, // enforce port 4000 so docs & scripts stay consistent
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
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
