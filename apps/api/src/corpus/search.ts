import {
  corpusSearchResultSchema,
  type CorpusSearchResult,
  type PatternType,
} from '@trestle/shared';
import { cosineDistance, desc, eq, gt, isNotNull, sql, and } from 'drizzle-orm';
import type { Embedder } from '../ai/embeddings';
import type { Database } from '../db/client';
import { corpusEntries } from '../db/schema';

export interface SearchCorpusOptions {
  query: string;
  /** Narrow to one topic, e.g. only caching entries. */
  patternType?: PatternType;
  limit?: number;
  /** Drop weak matches; 0 keeps everything. */
  minSimilarity?: number;
}

/**
 * Finds library entries closest in meaning to `query`.
 *
 * Similarity is 1 minus cosine distance: 1 means "same meaning", 0 means
 * "unrelated". Filtering by pattern type keeps a caching question from
 * returning queueing advice.
 */
export async function searchCorpus(
  db: Database,
  embedder: Embedder,
  { query, patternType, limit = 6, minSimilarity = 0.3 }: SearchCorpusOptions,
): Promise<CorpusSearchResult[]> {
  const [queryEmbedding] = await embedder.embed([query], 'query');
  if (!queryEmbedding) throw new Error('No embedding returned for the search query');

  const similarity = sql<number>`1 - (${cosineDistance(corpusEntries.embedding, queryEmbedding)})`;

  const rows = await db
    .select({
      id: corpusEntries.id,
      slug: corpusEntries.slug,
      kind: corpusEntries.kind,
      patternType: corpusEntries.patternType,
      title: corpusEntries.title,
      summary: corpusEntries.summary,
      whenToUse: corpusEntries.whenToUse,
      whenNotToUse: corpusEntries.whenNotToUse,
      tradeoffs: corpusEntries.tradeoffs,
      sourceNote: corpusEntries.sourceNote,
      sourceUrl: corpusEntries.sourceUrl,
      similarity,
    })
    .from(corpusEntries)
    .where(
      and(
        isNotNull(corpusEntries.embedding),
        patternType ? eq(corpusEntries.patternType, patternType) : undefined,
        minSimilarity > 0 ? gt(similarity, minSimilarity) : undefined,
      ),
    )
    .orderBy(desc(similarity))
    .limit(limit);

  // Parse on the way out: a hand-edited or stale row fails here, not in a prompt.
  return rows.map((row) =>
    corpusSearchResultSchema.parse({ ...row, sourceUrl: row.sourceUrl ?? undefined }),
  );
}
