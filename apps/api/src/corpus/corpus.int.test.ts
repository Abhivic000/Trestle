import { corpusEntrySchema, type CorpusEntry } from '@trestle/shared';
import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFakeEmbedder } from '../ai/fake-embedder';
import { db, sql } from '../db/client';
import { corpusEntries } from '../db/schema';
import { ingestCorpus } from './ingest';
import { searchCorpus } from './search';

// Exercises the real table and pgvector search in the trestle-test database,
// with a deterministic fake embedder instead of the Gemini API.

const embedder = createFakeEmbedder();

const entry = (overrides: Partial<CorpusEntry>): CorpusEntry =>
  corpusEntrySchema.parse({
    slug: 'test-entry',
    kind: 'pattern',
    patternType: 'caching',
    title: 'A test entry about caching',
    summary:
      'A cache keeps frequently read data in memory so repeated reads do not reach the database every time, which matters when traffic concentrates on a small share of items.',
    whenToUse: 'Read-heavy traffic with repeated reads of the same items.',
    whenNotToUse: 'Write-heavy traffic, or data that must always be exactly current.',
    tradeoffs: ['Cached data can be stale until it expires.'],
    sourceNote: 'Based on: test fixture.',
    ...overrides,
  });

const testEntries: CorpusEntry[] = [
  entry({
    slug: 'it-cache',
    patternType: 'caching',
    title: 'Cache hot reads near the application',
  }),
  entry({
    slug: 'it-shard',
    patternType: 'sharding',
    title: 'Shard the database by entity key',
    summary:
      'Sharding splits rows across several databases using a key such as the user, so each shard holds a subset. It raises write and storage capacity when a single shard cannot cope any more.',
    whenToUse: 'A single database can no longer absorb writes or hold the data.',
    whenNotToUse: 'Before replicas, caching and indexes have been tried.',
    tradeoffs: ['Queries across shards become much harder.'],
  }),
  entry({
    slug: 'it-queue',
    patternType: 'queuing',
    title: 'Move slow work to a queue and worker',
    summary:
      'A queue accepts a message and a separate worker performs slow work later, which keeps request latency stable when downstream systems are slow or bursty.',
    whenToUse: 'Slow, retryable or bursty work the user need not wait for.',
    whenNotToUse: 'Work whose result the user needs immediately in the response.',
    tradeoffs: ['Results appear after a delay, so the interface must show progress.'],
  }),
];

const testSlugs = testEntries.map((item) => item.slug);

async function clearTestEntries() {
  await db.delete(corpusEntries).where(inArray(corpusEntries.slug, testSlugs));
}

beforeAll(clearTestEntries);

afterAll(async () => {
  await clearTestEntries();
  await sql.end();
});

describe('reference library ingest', () => {
  it('inserts entries, then skips unchanged ones on a second run', async () => {
    const first = await ingestCorpus(db, embedder, testEntries, { prune: false });
    expect(first).toMatchObject({ inserted: 3, updated: 0, unchanged: 0 });

    const second = await ingestCorpus(db, embedder, testEntries, { prune: false });
    expect(second).toMatchObject({ inserted: 0, updated: 0, unchanged: 3 });
  });

  it('re-embeds an entry whose text changed', async () => {
    const edited = testEntries.map((item) =>
      item.slug === 'it-cache' ? { ...item, summary: `${item.summary} Extra detail added.` } : item,
    );

    const result = await ingestCorpus(db, embedder, edited, { prune: false });
    expect(result).toMatchObject({ inserted: 0, updated: 1, unchanged: 2 });

    // Restore the original text for the search tests below.
    await ingestCorpus(db, embedder, testEntries, { prune: false });
  });

  it('stores the embedding model alongside each entry', async () => {
    const rows = await db
      .select({ slug: corpusEntries.slug, model: corpusEntries.embeddingModel })
      .from(corpusEntries)
      .where(inArray(corpusEntries.slug, testSlugs));

    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.model === embedder.model)).toBe(true);
  });
});

// NOTE: the fake embedder scores fixed topic words, so these tests cover the
// query path, filtering, thresholds and ordering. Whether the real model
// understands a paraphrased question is checked by hand against the live API.
describe('reference library search', () => {
  it('ranks the closest entry first and orders the rest by similarity', async () => {
    const results = await searchCorpus(db, embedder, {
      query: 'we need a cache because the same items are read over and over',
      limit: 3,
      minSimilarity: 0,
    });

    expect(results[0]?.slug).toBe('it-cache');
    expect(results[0]?.similarity).toBeGreaterThan(results[1]?.similarity ?? 1);
  });

  it('can be narrowed to one pattern type', async () => {
    const results = await searchCorpus(db, embedder, {
      query: 'cache the hot items',
      patternType: 'queuing',
      limit: 5,
      minSimilarity: 0,
    });

    expect(results.every((result) => result.patternType === 'queuing')).toBe(true);
    expect(results.map((result) => result.slug)).toContain('it-queue');
  });

  it('returns nothing for a query unlike anything in the library', async () => {
    const results = await searchCorpus(db, embedder, {
      query: 'zzzz unrelated gibberish about nothing in particular',
      limit: 5,
      minSimilarity: 0.5,
    });

    expect(results).toEqual([]);
  });

  it('returns entries in the shape the API promises', async () => {
    const [result] = await searchCorpus(db, embedder, {
      query: 'sharding the database by user',
      limit: 1,
      minSimilarity: 0,
    });

    expect(result).toBeDefined();
    expect(result?.tradeoffs.length).toBeGreaterThan(0);
    expect(result?.sourceNote).toContain('Based on');
  });
});
