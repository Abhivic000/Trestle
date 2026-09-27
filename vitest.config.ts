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
          // `src/env.ts` validates the browser configuration when it is
          // imported, and any component that reaches lib/api pulls it in. Give
          // the unit tests their own stand-in values so they never depend on a
          // developer's apps/web/.env: without this they pass locally and fail
          // in CI, which has no .env file at all. These are not real endpoints
          // and nothing in a unit test should call them.
          env: {
            VITE_API_URL: 'http://localhost:4001',
            VITE_SUPABASE_URL: 'http://localhost:54321',
            VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_unit-tests',
          },
        },
      },
    ],
  },
});
