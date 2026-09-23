import { createHash } from 'node:crypto';
import { EMBEDDING_DIMENSIONS } from '../db/schema';
import type { Embedder } from './embeddings';

/**
 * Deterministic stand-in for the real embedding API, used by tests.
 *
 * It scores text against a few fixed topic words, so texts about the same topic
 * land close together, and adds a tiny hash-based jitter to keep vectors
 * distinct. Good enough to test storage, filtering and ranking without network
 * calls, quota or flakiness.
 */
const TOPIC_WORDS = [
  'cache',
  'shard',
  'replica',
  'queue',
  'cdn',
  'storage',
  'search',
  'consistency',
  'rate limit',
  'auth',
  'observability',
  'cost',
];

export function createFakeEmbedder(model = 'fake-embedder-v1'): Embedder {
  return {
    model,
    dimensions: EMBEDDING_DIMENSIONS,
    embed(texts) {
      return Promise.resolve(
        texts.map((text) => {
          const lower = text.toLowerCase();
          const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);

          TOPIC_WORDS.forEach((word, index) => {
            const occurrences = lower.split(word).length - 1;
            vector[index] = occurrences > 0 ? 1 + Math.min(occurrences, 5) * 0.1 : 0;
          });

          // Small deterministic jitter so two texts are never byte-identical.
          const hash = createHash('sha256').update(text).digest();
          for (let i = 0; i < 16; i++) {
            vector[TOPIC_WORDS.length + i] = ((hash[i] ?? 0) / 255) * 0.05;
          }

          const magnitude = Math.hypot(...vector) || 1;
          return vector.map((value) => value / magnitude);
        }),
      );
    },
  };
}
