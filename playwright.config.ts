import { defineConfig, devices } from '@playwright/test';
import { loadTestEnv } from './test-support/test-env.ts';

// Browser tests run the real web app + API against the separate trestle-test
// Supabase project, on their own ports (5174 / 4001) so they never touch a
// dev server you have running.
const apiEnv = loadTestEnv('apps/api');
const webEnv = loadTestEnv('apps/web');

const WEB_URL = 'http://localhost:5174';
const API_URL = webEnv.VITE_API_URL ?? '';
if (new URL(API_URL).port !== apiEnv.PORT) {
  throw new Error(
    `apps/web/.env.test VITE_API_URL (${API_URL}) must use the API test port ${apiEnv.PORT}.`,
  );
}

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI, // a stray test.only must not silently skip the rest in CI
  retries: isCI ? 2 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/support/global-setup.ts',
  globalTeardown: './e2e/support/global-teardown.ts',
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry', // step-by-step recording when a test fails and is retried
    screenshot: 'only-on-failure',
  },
  projects: [
    isCI
      ? { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
      : // Locally, drive the Microsoft Edge that's already installed (no browser download).
        { name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
  ],
  webServer: [
    {
      command: 'pnpm --filter @trestle/api dev:test',
      url: `${API_URL}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @trestle/web dev:test',
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
