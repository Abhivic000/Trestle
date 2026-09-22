// Runs before every integration test file (see vitest.config.ts at the repo root).
if (process.env.TEST_ENV_ERROR) {
  throw new Error(`Integration tests can't run: ${process.env.TEST_ENV_ERROR}`);
}
