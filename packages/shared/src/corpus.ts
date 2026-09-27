import { z } from 'zod';
import type { ComponentKind } from './design';

/*
 * The reference library: curated, hand-written pattern summaries that ground the
 * AI's reasoning. Entries are written in our own words as extracted patterns,
 * never copied source text.
 */

export const patternTypes = [
  'caching',
  'sharding',
  'replication',
  'queuing',
  'cdn',
  'storage',
  'search',
  'consistency',
  'rate-limiting',
  'auth',
  'observability',
  'cost',
] as const;
export type PatternType = (typeof patternTypes)[number];

export const patternTypeLabels: Record<PatternType, string> = {
  caching: 'Caching',
  sharding: 'Sharding & partitioning',
  replication: 'Replication',
  queuing: 'Queues & async work',
  cdn: 'CDN & edge delivery',
  storage: 'Storage choices',
  search: 'Search',
  consistency: 'Consistency & transactions',
  'rate-limiting': 'Rate limiting & backpressure',
  auth: 'Authentication & access',
  observability: 'Observability',
  cost: 'Cost & capacity',
};

/** `pattern` = a general technique. `comparison` = how a named real system does it. */
export const corpusKinds = ['pattern', 'comparison'] as const;
export type CorpusKind = (typeof corpusKinds)[number];

/** One library entry, as written in the seed files and stored in the database. */
export const corpusEntrySchema = z.object({
  /** Stable identifier, e.g. "caching-read-through". Used to update entries in place. */
  slug: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'use lowercase letters, numbers and hyphens'),
  kind: z.enum(corpusKinds),
  patternType: z.enum(patternTypes),
  title: z.string().min(5).max(120),
  summary: z.string().min(80).max(1800),
  whenToUse: z.string().min(20).max(800),
  whenNotToUse: z.string().min(20).max(800),
  tradeoffs: z.array(z.string().min(10).max(300)).min(1).max(6),
  /**
   * Attribution for the idea, e.g. "Based on: Designing Data-Intensive
   * Applications (Kleppmann), ch. 5". Deliberately "based on" rather than a
   * precise citation: we summarise, we don't quote.
   */
  sourceNote: z.string().min(5).max(300),
  sourceUrl: z.url().optional(),
});

export type CorpusEntry = z.infer<typeof corpusEntrySchema>;

/** One search hit, with how closely it matched (1 = identical meaning). */
export const corpusSearchResultSchema = corpusEntrySchema.extend({
  id: z.uuid(),
  similarity: z.number().min(-1).max(1),
});

export type CorpusSearchResult = z.infer<typeof corpusSearchResultSchema>;

export const searchCorpusResponseSchema = z.object({
  results: z.array(corpusSearchResultSchema),
});

export type SearchCorpusResponse = z.infer<typeof searchCorpusResponseSchema>;

/**
 * Real systems that solved the same problem as one component, looked up when
 * the Compare tab is opened rather than stored in the design. Keeping it out of
 * the design means an improved library improves old designs too, and that
 * components added by hand get comparisons as well.
 */
export const componentComparisonsResponseSchema = z.object({
  componentId: z.string(),
  comparisons: z.array(corpusSearchResultSchema),
});

export type ComponentComparisonsResponse = z.infer<typeof componentComparisonsResponseSchema>;

/**
 * Which library topics can sensibly be compared against a component of each
 * kind.
 *
 * Similarity alone is not enough here. Embedding scores between a component and
 * an unrelated entry still land around 0.6, so a plain nearest-neighbour search
 * will confidently offer a block-storage case study for a generic service.
 * Narrowing to plausible topics first, then ranking by similarity inside that
 * set, uses the structure we already know instead of guessing from prose.
 *
 * An empty list means "we have nothing worth comparing", which is a better
 * answer than the closest wrong thing.
 */
export const comparisonTopicsByComponentKind: Record<ComponentKind, PatternType[]> = {
  client: [],
  cdn: ['cdn'],
  gateway: ['cdn', 'rate-limiting'],
  service: ['cost', 'consistency'],
  worker: ['queuing'],
  cache: ['caching'],
  queue: ['queuing'],
  database: ['sharding', 'replication', 'consistency'],
  storage: ['storage'],
  search: ['search'],
  external: ['auth', 'observability'],
};

/**
 * The text we search the library with for a component: its name, what it does
 * and the technology chosen. Shared so the API and its tests agree, and so the
 * query is easy to reason about when a match looks wrong.
 */
export function componentComparisonQuery(component: {
  label: string;
  kind: string;
  responsibility: string;
  technology?: string;
}): string {
  return [
    component.label,
    component.technology ?? '',
    `Role: ${component.kind}`,
    component.responsibility,
  ]
    .filter((part) => part !== '')
    .join('\n');
}

/**
 * The text that gets embedded for an entry. Kept in one place so the API, the
 * ingest script and the tests all hash and embed exactly the same string.
 */
export function corpusEntryEmbeddingText(entry: CorpusEntry): string {
  return [
    entry.title,
    `Pattern type: ${entry.patternType}`,
    entry.summary,
    `When to use: ${entry.whenToUse}`,
    `When not to use: ${entry.whenNotToUse}`,
    `Tradeoffs: ${entry.tradeoffs.join(' ')}`,
  ].join('\n');
}
