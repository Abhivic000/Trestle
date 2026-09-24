import type { CorpusSearchResult, Requirements } from '@trestle/shared';
import { z } from 'zod';
import { componentKinds, connectionKinds } from '@trestle/shared';

/*
 * The contract between "ask an AI for a design" and the rest of the app.
 * Tests swap in a fake implementation; production uses Gemini.
 */

/** What the model is asked to produce: the design minus anything it is bad at. */
export const designDraftSchema = z.object({
  summary: z.string().min(10).max(1500),
  components: z
    .array(
      z.object({
        id: z.string().min(2).max(64),
        kind: z.enum(componentKinds),
        label: z.string().min(2).max(80),
        technology: z.string().max(80).optional(),
        responsibility: z.string().min(10).max(600),
        rationale: z.string().min(10).max(1200),
        alternatives: z
          .array(
            z.object({ option: z.string().min(2).max(120), whyNot: z.string().min(2).max(500) }),
          )
          .max(4)
          .default([]),
        tradeoffs: z.array(z.string().min(5).max(400)).max(4).default([]),
        /** Reference-library slugs this reasoning came from. Verified server-side. */
        sources: z.array(z.string()).max(6).default([]),
      }),
    )
    .min(3)
    .max(18),
  connections: z
    .array(
      z.object({
        from: z.string().min(2).max(64),
        to: z.string().min(2).max(64),
        kind: z.enum(connectionKinds),
        label: z.string().max(60).optional(),
      }),
    )
    .max(40)
    .default([]),
  dataModel: z
    .array(
      z.object({
        name: z.string().min(2).max(60),
        storedIn: z.string().min(2).max(64),
        keyFields: z.array(z.string().min(1).max(60)).max(10).default([]),
        notes: z.string().max(400).optional(),
      }),
    )
    .max(12)
    .default([]),
});

export type DesignDraft = z.infer<typeof designDraftSchema>;

export interface GenerationInput {
  requirements: Requirements;
  /** Entries retrieved for this project; the model may only cite these. */
  entries: CorpusSearchResult[];
}

export interface GenerationOutput {
  draft: DesignDraft;
  /** Which model actually answered (the chain falls back when one is busy). */
  model: string;
}

export interface DesignGenerator {
  generate(input: GenerationInput, signal?: AbortSignal): Promise<GenerationOutput>;
}

/** Thrown when the AI could not produce a usable design. Shown to the user as-is. */
export class GenerationError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'GenerationError';
  }
}
