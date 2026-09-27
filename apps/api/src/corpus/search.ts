import {
  corpusSearchResultSchema,
  type CorpusKind,
  type CorpusSearchResult,
  type PatternType,
} from '@trestle/shared';
import { cosineDistance, desc, eq, gt, inArray, isNotNull, sql, and } from 'drizzle-orm';
import type { Embedder } from '../ai/embeddings';
import type { Database } from '../db/client';
import { corpusEntries } from '../db/schema';

export interface SearchCorpusOptions {
  query: string;
  /** Narrow to one topic, e.g. only caching entries. */
  patternType?: PatternType;
  /** Narrow to several topics at once. An empty list matches nothing. */
  patternTypes?: PatternType[];
  /** Narrow to general patterns or to named real-world systems. */
  kind?: CorpusKind;
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
  { query, patternType, patternTypes, kind, limit = 6, minSimilarity = 0.3 }: SearchCorpusOptions,
): Promise<CorpusSearchResult[]> {
  // Nothing can match, so don't spend an embedding call finding that out.
  if (patternTypes?.length === 0) return [];

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
        patternTypes ? inArray(corpusEntries.patternType, patternTypes) : undefined,
        kind ? eq(corpusEntries.kind, kind) : undefined,
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
