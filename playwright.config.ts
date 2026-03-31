import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/*.smoke.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3201',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node ./node_modules/next/dist/bin/next dev -p 3201 --hostname 127.0.0.1',
    url: 'http://127.0.0.1:3201',
    env: {
      ...process.env,
      NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3201',
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
