import {
  componentKinds,
  connectionKinds,
  type CorpusSearchResult,
  type Design,
} from '@trestle/shared';
import { z } from 'zod';

/*
 * "Propose a change to this design" is a different job from "design this system",
 * so it has its own contract, prompt and fake.
 */

/** What the model returns: flat operations, because structured output dislikes unions. */
export const changeOperationDraftSchema = z.object({
  type: z.enum([
    'add_component',
    'modify_component',
    'remove_component',
    'add_connection',
    'remove_connection',
  ]),
  explanation: z.string().min(10).max(600),
  sources: z.array(z.string()).max(6).default([]),

  /** add_component */
  component: z
    .object({
      id: z.string().min(2).max(64),
      kind: z.enum(componentKinds),
      label: z.string().min(2).max(80),
      technology: z.string().max(80).optional(),
      responsibility: z.string().min(10).max(600),
      rationale: z.string().min(10).max(1200),
      alternatives: z
        .array(z.object({ option: z.string().min(2).max(120), whyNot: z.string().min(2).max(500) }))
        .max(3)
        .default([]),
      tradeoffs: z.array(z.string().min(5).max(400)).max(3).default([]),
    })
    .optional(),

  /** modify_component and remove_component */
  componentId: z.string().min(2).max(64).optional(),
  changes: z
    .object({
      label: z.string().min(2).max(80).optional(),
      kind: z.enum(componentKinds).optional(),
      technology: z.string().max(80).optional(),
      responsibility: z.string().min(10).max(600).optional(),
      rationale: z.string().min(10).max(1200).optional(),
    })
    .optional(),

  /** add_connection */
  connection: z
    .object({
      from: z.string().min(2).max(64),
      to: z.string().min(2).max(64),
      kind: z.enum(connectionKinds),
      label: z.string().max(60).optional(),
    })
    .optional(),

  /** remove_connection */
  connectionId: z.string().min(2).max(130).optional(),
});

export type ChangeOperationDraft = z.infer<typeof changeOperationDraftSchema>;

export const changeDraftSchema = z.object({
  summary: z.string().min(10).max(1000),
  operations: z.array(changeOperationDraftSchema).min(1).max(20),
});

export type ChangeDraft = z.infer<typeof changeDraftSchema>;

export interface ChangeGenerationInput {
  prompt: string;
  design: Design;
  entries: CorpusSearchResult[];
}

export interface ChangeGenerationOutput {
  draft: ChangeDraft;
  model: string;
}

export interface ChangeGenerator {
  propose(input: ChangeGenerationInput, signal?: AbortSignal): Promise<ChangeGenerationOutput>;
}
