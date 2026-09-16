import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:5173', browserName: 'chromium', launchOptions: { channel: 'msedge' } },
  webServer: { command: 'pnpm.cmd dev -- --port 5173', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
});
