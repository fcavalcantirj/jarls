import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/setup.ts',
  globalTeardown: './e2e/teardown.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm dev:server',
      url: 'http://localhost:3000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        NODE_ENV: 'test',
        PORT: '3000',
        DATABASE_URL: 'postgresql://jarls:jarls@localhost:5432/jarls',
        REDIS_URL: 'redis://localhost:6379',
      },
    },
    {
      command: 'pnpm dev:client',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
