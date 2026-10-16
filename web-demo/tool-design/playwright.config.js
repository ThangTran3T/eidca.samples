import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5180/',
    viewport: { width: 1600, height: 960 },
    acceptDownloads: true,
    trace: 'retain-on-failure',
    locale: 'vi-VN',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 960 } } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5180/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
