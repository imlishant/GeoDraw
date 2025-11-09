import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'GeomeDraw',
        short_name: 'GeomeDraw',
        description: 'Geometric construction tool',
        theme_color: '#3b82f6',
        icons: []
      }
    })
  ],
  build: {
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          store: ['zustand']
        }
      }
    }
  },
  server: {
    port: 3000,
    host: true
  }
});