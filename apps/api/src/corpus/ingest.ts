import { createHash } from 'node:crypto';
import { corpusEntryEmbeddingText, type CorpusEntry } from '@trestle/shared';
import { inArray, notInArray } from 'drizzle-orm';
import type { Embedder } from '../ai/embeddings';
import type { Database } from '../db/client';
import { corpusEntries } from '../db/schema';

/** Fingerprint of the text we embed, so unchanged entries are never re-embedded. */
export function entryContentHash(entry: CorpusEntry, embeddingModel: string): string {
  return createHash('sha256')
    .update(`${embeddingModel}\n${corpusEntryEmbeddingText(entry)}`)
    .digest('hex');
}

export interface IngestResult {
  inserted: number;
  updated: number;
  unchanged: number;
  removed: number;
}

/**
 * Loads the seed entries into the database:
 * new ones are embedded and inserted, changed ones are re-embedded, unchanged
 * ones are left alone (that is what keeps us inside the free embedding quota),
 * and rows whose entry no longer exists are deleted.
 */
export async function ingestCorpus(
  db: Database,
  embedder: Embedder,
  entries: CorpusEntry[],
  {
    onProgress = () => undefined,
    /** Delete rows whose entry is no longer in `entries`. Off for partial loads. */
    prune = true,
  }: { onProgress?: (message: string) => void; prune?: boolean } = {},
): Promise<IngestResult> {
  const slugs = entries.map((entry) => entry.slug);
  const existing = slugs.length
    ? await db
        .select({ slug: corpusEntries.slug, contentHash: corpusEntries.contentHash })
        .from(corpusEntries)
        .where(inArray(corpusEntries.slug, slugs))
    : [];
  const existingHashBySlug = new Map(existing.map((row) => [row.slug, row.contentHash]));

  const result: IngestResult = { inserted: 0, updated: 0, unchanged: 0, removed: 0 };

  for (const entry of entries) {
    const hash = entryContentHash(entry, embedder.model);
    const previousHash = existingHashBySlug.get(entry.slug);
    if (previousHash === hash) {
      result.unchanged++;
      continue;
    }

    onProgress(`embedding ${entry.slug}`);
    const [embedding] = await embedder.embed([corpusEntryEmbeddingText(entry)], 'document');
    if (!embedding) throw new Error(`No embedding returned for ${entry.slug}`);

    const row = {
      slug: entry.slug,
      kind: entry.kind,
      patternType: entry.patternType,
      title: entry.title,
      summary: entry.summary,
      whenToUse: entry.whenToUse,
      whenNotToUse: entry.whenNotToUse,
      tradeoffs: entry.tradeoffs,
      sourceNote: entry.sourceNote,
      sourceUrl: entry.sourceUrl ?? null,
      embedding,
      contentHash: hash,
      embeddingModel: embedder.model,
    };

    await db
      .insert(corpusEntries)
      .values(row)
      .onConflictDoUpdate({ target: corpusEntries.slug, set: { ...row, updatedAt: new Date() } });

    if (previousHash === undefined) result.inserted++;
    else result.updated++;
  }

  // Entries deleted from the seed files should not linger in the database.
  if (prune) {
    const removed = slugs.length
      ? await db
          .delete(corpusEntries)
          .where(notInArray(corpusEntries.slug, slugs))
          .returning({ slug: corpusEntries.slug })
      : await db.delete(corpusEntries).returning({ slug: corpusEntries.slug });
    result.removed = removed.length;
  }

  return result;
}
