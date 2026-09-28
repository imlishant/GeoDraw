import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'DrawGeo',
        short_name: 'DrawGeo',
        description: 'Ruler-and-compass geometry constructions',
        theme_color: '#f4f5f7',
        background_color: '#f4f5f7',
        display: 'standalone',
        orientation: 'any',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'] },
    }),
  ],
  // iPhone 7 can't update past iOS 15, so keep the output runnable on Safari 15.
  build: { target: ['es2020', 'safari15', 'chrome100', 'firefox100'] },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
