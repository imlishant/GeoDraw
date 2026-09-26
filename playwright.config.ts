import { defineConfig, devices } from '@playwright/test';

// Two servers: the production build (what users get) and the dev server
// (what you see while developing; React StrictMode mounts everything twice).
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: { channel: 'chrome' },
  webServer: [
    { command: 'npm run build && npm run preview -- --port 4173 --strictPort', port: 4173, reuseExistingServer: true, timeout: 120_000 },
    { command: 'npx vite --port 5174 --strictPort', port: 5174, reuseExistingServer: true, timeout: 60_000 },
  ],
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome', baseURL: 'http://localhost:4173' } },
    { name: 'phone', use: { ...devices['Pixel 7'], channel: 'chrome', baseURL: 'http://localhost:4173' } },
    { name: 'tablet', use: { viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true, channel: 'chrome', baseURL: 'http://localhost:4173' } },
    { name: 'dev-server', use: { ...devices['Desktop Chrome'], channel: 'chrome', baseURL: 'http://localhost:5174' } },
  ],
});
