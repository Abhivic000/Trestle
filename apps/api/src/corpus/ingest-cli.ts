import { createGeminiEmbedder } from '../ai/embeddings';
import { env } from '../config/env';
import { db, sql } from '../db/client';
import { logger } from '../logger';
import { corpusSeedEntries } from './entries';
import { ingestCorpus } from './ingest';

/**
 * `pnpm --filter @trestle/api corpus:ingest`
 *
 * Loads the reference library into the database this .env points at. Safe to
 * re-run: only entries whose text changed are embedded again.
 */
async function main() {
  logger.info(`Ingesting ${String(corpusSeedEntries.length)} reference entries`);
  const embedder = createGeminiEmbedder(env.GEMINI_API_KEY);

  const result = await ingestCorpus(db, embedder, corpusSeedEntries, {
    onProgress: (message) => {
      logger.info(message);
    },
  });

  logger.info(result, 'Reference library up to date');
  await sql.end();
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'Corpus ingest failed');
  process.exitCode = 1;
  void sql.end();
});
