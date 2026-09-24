import { and, count, eq, gte } from 'drizzle-orm';
import type { Database } from '../db/client';
import { aiRequests } from '../db/schema';
import { HttpError } from '../errors';

/** How many AI actions one account may run per rolling 24 hours (free-tier guard). */
export const DAILY_AI_LIMIT = 20;

export type AiRequestKind = 'generate' | 'change_request';

/**
 * Throws 429 when the account has used its daily allowance. Counting rows we
 * already record keeps this simple and survives restarts, unlike in-memory counters.
 */
export async function assertWithinDailyAiLimit(db: Database, userId: string): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({ used: count() })
    .from(aiRequests)
    .where(and(eq(aiRequests.userId, userId), gte(aiRequests.createdAt, since)));

  if ((row?.used ?? 0) >= DAILY_AI_LIMIT) {
    throw new HttpError(
      429,
      'ai_limit_reached',
      `You have used all ${String(DAILY_AI_LIMIT)} AI actions for today. This limit keeps Trestle inside its free quota; it resets 24 hours after each use.`,
    );
  }
}

/** Records a completed AI action against the account. */
export async function recordAiRequest(
  db: Database,
  userId: string,
  kind: AiRequestKind,
  model: string,
): Promise<void> {
  await db.insert(aiRequests).values({ userId, kind, model });
}
