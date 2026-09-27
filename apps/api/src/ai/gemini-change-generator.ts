import { componentKinds, connectionKinds } from '@trestle/shared';
import { logger } from '../logger';
import {
  changeDraftSchema,
  type ChangeGenerationInput,
  type ChangeGenerationOutput,
  type ChangeGenerator,
} from './change-generator';
import { buildChangePrompt, CHANGE_SYSTEM_PROMPT } from './change-prompt';
import { GenerationError } from './design-generator';
import { DEFAULT_MODEL_CHAIN } from './gemini-design-generator';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Flat operation shape: structured output handles this better than a tagged union. */
const responseSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    operations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'add_component',
              'modify_component',
              'remove_component',
              'add_connection',
              'remove_connection',
            ],
          },
          explanation: { type: 'string' },
          sources: { type: 'array', items: { type: 'string' } },
          componentId: { type: 'string' },
          connectionId: { type: 'string' },
          component: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              kind: { type: 'string', enum: [...componentKinds] },
              label: { type: 'string' },
              technology: { type: 'string' },
              responsibility: { type: 'string' },
              rationale: { type: 'string' },
              alternatives: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { option: { type: 'string' }, whyNot: { type: 'string' } },
                  required: ['option', 'whyNot'],
                },
              },
              tradeoffs: { type: 'array', items: { type: 'string' } },
            },
            required: ['id', 'kind', 'label', 'responsibility', 'rationale'],
          },
          changes: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              kind: { type: 'string', enum: [...componentKinds] },
              technology: { type: 'string' },
              responsibility: { type: 'string' },
              rationale: { type: 'string' },
            },
          },
          connection: {
            type: 'object',
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
              kind: { type: 'string', enum: [...connectionKinds] },
              label: { type: 'string' },
            },
            required: ['from', 'to', 'kind'],
          },
        },
        required: ['type', 'explanation'],
      },
    },
  },
  required: ['summary', 'operations'],
};

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createGeminiChangeGenerator(
  apiKey: string,
  models: string[] = DEFAULT_MODEL_CHAIN,
): ChangeGenerator {
  async function callModel(model: string, prompt: string, signal: AbortSignal | undefined) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const response = await fetch(`${API_BASE}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: CHANGE_SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.3,
            maxOutputTokens: 8192,
          },
        }),
      });

      if (response.status === 429 || response.status === 404 || response.status >= 500) {
        logger.warn({ model, status: response.status }, 'Change model unavailable');
        if (attempt === 2) return null;
        await sleep(1500);
        continue;
      }
      if (!response.ok) {
        throw new GenerationError(
          `The change service rejected the request (${String(response.status)}).`,
        );
      }

      const json = (await response.json()) as GeminiResponse;
      const candidate = json.candidates?.[0];
      if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
        throw new GenerationError(
          `The proposal was cut short (${candidate.finishReason}). Try a narrower request.`,
        );
      }
      return candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
    }
    return null;
  }

  return {
    async propose(
      input: ChangeGenerationInput,
      signal?: AbortSignal,
    ): Promise<ChangeGenerationOutput> {
      const basePrompt = buildChangePrompt(input.prompt, input.design, input.entries);
      let lastProblem: string | null = null;

      for (let attempt = 1; attempt <= 2; attempt++) {
        const prompt =
          lastProblem === null
            ? basePrompt
            : `${basePrompt}\n\nYour previous answer was rejected: ${lastProblem}\nReturn corrected JSON.`;

        let text: string | null = null;
        for (const model of models) {
          const result = await callModel(model, prompt, signal);
          if (result === null) continue;
          text = result;

          let parsedJson: unknown;
          try {
            parsedJson = JSON.parse(text);
          } catch {
            lastProblem = 'the response was not valid JSON';
            break;
          }

          const draft = changeDraftSchema.safeParse(parsedJson);
          if (draft.success) return { draft: draft.data, model };

          const [issue] = draft.error.issues;
          lastProblem = issue
            ? `${issue.path.join('.')}: ${issue.message}`
            : 'the response did not match the required shape';
          logger.warn({ model, attempt, problem: lastProblem }, 'Change draft rejected');
          break;
        }

        if (text === null) {
          throw new GenerationError(
            'All models are busy right now. This happens on the free tier: please try again in a minute.',
          );
        }
      }

      throw new GenerationError(
        `The change service returned something unusable (${lastProblem ?? 'unknown problem'}). Please try again.`,
      );
    },
  };
}
