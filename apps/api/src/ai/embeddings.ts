import { EMBEDDING_DIMENSIONS } from '../db/schema';
import { logger } from '../logger';

/**
 * Turns text into a list of numbers that represents its meaning, so similar
 * meanings can be found by distance. Tests pass a fake implementation of this
 * interface instead of calling Google.
 */
export interface Embedder {
  readonly model: string;
  readonly dimensions: number;
  /**
   * `document` embeds library entries, `query` embeds a search phrase. Google's
   * models embed the two slightly differently, which improves matching.
   */
  embed(texts: string[], purpose: 'document' | 'query'): Promise<number[][]>;
}

const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_ATTEMPTS = 4;

interface EmbedContentResponse {
  embedding?: { values?: number[] };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Google Gemini embeddings (free tier). Requests are sent one at a time, slowly. */
export function createGeminiEmbedder(apiKey: string): Embedder {
  async function embedOne(text: string, purpose: 'document' | 'query'): Promise<number[]> {
    const body = JSON.stringify({
      model: `models/${GEMINI_EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      taskType: purpose === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
      outputDimensionality: EMBEDDING_DIMENSIONS,
    });

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const response = await fetch(`${API_BASE}/${GEMINI_EMBEDDING_MODEL}:embedContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body,
      });

      if (response.ok) {
        const json = (await response.json()) as EmbedContentResponse;
        const values = json.embedding?.values;
        if (values?.length !== EMBEDDING_DIMENSIONS) {
          throw new Error(
            `Embedding API returned ${String(values?.length)} numbers, expected ${String(EMBEDDING_DIMENSIONS)}`,
          );
        }
        return values;
      }

      // 429 = over the free-tier rate limit, 5xx = their side: wait and retry.
      const retryable = response.status === 429 || response.status >= 500;
      const detail = (await response.text()).slice(0, 200);
      if (!retryable || attempt === MAX_ATTEMPTS) {
        throw new Error(`Embedding API failed (${String(response.status)}): ${detail}`);
      }
      const waitMs = 2000 * 2 ** (attempt - 1); // 2s, 4s, 8s
      logger.warn(
        { status: response.status, attempt, waitMs },
        'Embedding API rate-limited; retrying',
      );
      await sleep(waitMs);
    }
    throw new Error('Embedding API: exhausted retries');
  }

  return {
    model: GEMINI_EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    async embed(texts, purpose) {
      const vectors: number[][] = [];
      for (const text of texts) {
        vectors.push(await embedOne(text, purpose));
        await sleep(200); // stay comfortably inside the free per-minute limit
      }
      return vectors;
    },
  };
}
