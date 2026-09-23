import { corpusEntrySchema, type CorpusEntry } from '@trestle/shared';
import { z } from 'zod';
import { comparisonEntries } from './comparisons';
import { patternEntries } from './patterns';
import { advancedPatternEntries } from './patterns-advanced';

/**
 * Every reference-library entry, validated at load time so a malformed entry is
 * caught before it can reach the database or a prompt.
 */
export const corpusSeedEntries: CorpusEntry[] = z
  .array(corpusEntrySchema)
  .superRefine((entries, ctx) => {
    const slugs = new Set<string>();
    for (const entry of entries) {
      if (slugs.has(entry.slug)) {
        ctx.addIssue({ code: 'custom', message: `duplicate entry slug "${entry.slug}"` });
      }
      slugs.add(entry.slug);
    }
  })
  .parse([...patternEntries, ...advancedPatternEntries, ...comparisonEntries]);
