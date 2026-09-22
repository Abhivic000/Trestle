import { defineConfig } from 'vitest/config';
import { loadTestEnv } from './test-support/test-env.ts';

// The integration tests need apps/api/.env.test. Load it here (not at import time
// in the app) and pass it in via `env`. If it's missing, the integration project's
// setup file reports why instead of the whole run crashing.
let apiTestEnv: Record<string, string> = {};
let apiTestEnvError = '';
try {
  apiTestEnv = loadTestEnv('apps/api');
} catch (err) {
  apiTestEnvError = err instanceof Error ? err.message : String(err);
}

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'shared',
          root: './packages/shared',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'api:unit',
          root: './apps/api',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.int.test.ts'],
        },
      },
      {
        test: {
          name: 'api:integration',
          root: './apps/api',
          include: ['src/**/*.int.test.ts'],
          setupFiles: ['./src/test/integration-setup.ts'],
          env: {
            ...apiTestEnv,
            NODE_ENV: 'test',
            LOG_LEVEL: 'silent',
            TEST_ENV_ERROR: apiTestEnvError,
          },
          // Real network calls to Supabase: allow time, and run files one at a time.
          testTimeout: 30_000,
          hookTimeout: 60_000,
          fileParallelism: false,
        },
      },
      {
        extends: './apps/web/vite.config.ts',
        test: {
          name: 'web',
          root: './apps/web',
          include: ['src/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
        },
      },
    ],
  },
});
