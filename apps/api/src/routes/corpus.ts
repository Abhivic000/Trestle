import { patternTypes, type SearchCorpusResponse } from '@trestle/shared';
import { Router } from 'express';
import { z } from 'zod';
import { searchCorpus } from '../corpus/search';
import { db } from '../db/client';
import type { AppDependencies } from '../deps';
import { HttpError } from '../errors';

const searchQuerySchema = z.object({
  q: z.string().min(3).max(500),
  patternType: z.enum(patternTypes).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(6),
});

export function createCorpusRouter({ embedder }: AppDependencies) {
  const router = Router();

  /** Search the reference library by meaning. */
  router.get('/search', async (req, res) => {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      throw new HttpError(
        400,
        'validation_error',
        issue ? `${issue.path.join('.')}: ${issue.message}` : 'Invalid search.',
      );
    }

    const results = await searchCorpus(db, embedder, {
      query: parsed.data.q,
      patternType: parsed.data.patternType,
      limit: parsed.data.limit,
    });

    const body: SearchCorpusResponse = { results };
    res.json(body);
  });

  return router;
}
