import { seedCorpusForTests } from '../../apps/api/src/corpus/seed-for-tests.ts';
import { loadTestEnv } from '../../test-support/test-env.ts';

/**
 * Puts the reference library in the test database before the browser tests, so
 * the Compare tab has something real to find. The database work lives in the
 * API package, which owns the database dependencies.
 */
export async function seedTestCorpus(): Promise<void> {
  const databaseUrl = loadTestEnv('apps/api').DATABASE_URL;
  if (!databaseUrl) throw new Error('apps/api/.env.test must set DATABASE_URL');
  await seedCorpusForTests(databaseUrl);
}
