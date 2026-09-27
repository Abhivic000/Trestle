import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { createFakeEmbedder } from '../ai/fake-embedder';
import * as schema from '../db/schema';
import { corpusSeedEntries } from './entries';
import { ingestCorpus } from './ingest';

/**
 * Loads the reference library into a test database, embedded with the FAKE
 * embedder.
 *
 * The test API server runs with USE_FAKE_AI=true, so it searches with the fake
 * embedder as well, and a similarity search only means anything when the stored
 * vectors came from the same model as the query. Seeding real embeddings here
 * would make every library lookup silently return nothing.
 *
 * It takes its own connection string and opens its own connection, so it can be
 * called from the Playwright setup, which runs outside the API's own config.
 */
export async function seedCorpusForTests(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const db = drizzle(sql, { schema });
    // Never prune: other test suites seed their own fixtures into this table
    // and must not have them deleted out from under them.
    await ingestCorpus(db, createFakeEmbedder(), corpusSeedEntries, { prune: false });
  } finally {
    await sql.end();
  }
}
