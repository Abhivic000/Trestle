import {
  projectTypeLabels,
  trafficShapeLabels,
  type CorpusSearchResult,
  type Requirements,
} from '@trestle/shared';
import type { Embedder } from '../ai/embeddings';
import type { Database } from '../db/client';
import { searchCorpus } from '../corpus/search';

const MEDIA_WORDS = /\b(video|audio|image|photo|media|stream|upload|file|attachment)\b/i;
const SEARCH_WORDS = /\b(search|discover|browse|filter|recommend)\b/i;
const MESSAGING_WORDS = /\b(chat|message|notification|comment|feed|realtime|real-time)\b/i;

/**
 * Turns requirements into the questions we ask the reference library.
 *
 * One broad question about the project, plus targeted ones for the situations
 * the requirements imply. Each question costs one embedding call, so the list
 * is deliberately short.
 */
export function buildRetrievalQueries(requirements: Requirements): string[] {
  const projectType =
    requirements.projectType === 'other'
      ? (requirements.projectTypeOther ?? 'software product')
      : projectTypeLabels[requirements.projectType];
  const features = requirements.features.join(', ');

  const queries = [
    `${projectType} serving ${requirements.dailyActiveUsers.toLocaleString('en-US')} daily active users with features: ${features}. ${trafficShapeLabels[requirements.trafficShape]}.`,
  ];

  if (requirements.trafficShape === 'read_heavy' || requirements.latencySensitivity === 'high') {
    queries.push(
      'the same data is read repeatedly and the database is the bottleneck, latency matters',
    );
  }
  if (requirements.trafficShape === 'write_heavy' || requirements.dailyActiveUsers >= 1_000_000) {
    queries.push('one database can no longer absorb the write volume from very many users');
  }
  if (MEDIA_WORDS.test(features)) {
    queries.push('serving user uploaded images and video to people around the world');
  }
  if (SEARCH_WORDS.test(features)) {
    queries.push('letting users search and filter records');
  }
  if (MESSAGING_WORDS.test(features)) {
    queries.push('slow background work such as notifications should not block the request');
  }
  if (requirements.consistency === 'strong') {
    queries.push('reads must reflect the latest write, transactions and safe retries');
  }
  if (requirements.compliance.length > 0) {
    queries.push('keeping user data private and enforcing who may read which rows');
  }
  queries.push('what will drive the monthly infrastructure bill and where the bottlenecks appear');

  return queries;
}

/** Runs the questions and returns a de-duplicated set of entries, best matches first. */
export async function retrieveEntriesForRequirements(
  db: Database,
  embedder: Embedder,
  requirements: Requirements,
  { perQuery = 5, max = 18 }: { perQuery?: number; max?: number } = {},
): Promise<CorpusSearchResult[]> {
  const queries = buildRetrievalQueries(requirements);

  const bySlug = new Map<string, CorpusSearchResult>();
  for (const query of queries) {
    const results = await searchCorpus(db, embedder, {
      query,
      limit: perQuery,
      minSimilarity: 0.35,
    });
    for (const result of results) {
      const existing = bySlug.get(result.slug);
      // Keep the best score an entry achieved across all the questions.
      if (!existing || existing.similarity < result.similarity) bySlug.set(result.slug, result);
    }
  }

  return [...bySlug.values()].sort((a, b) => b.similarity - a.similarity).slice(0, max);
}
