import { componentKinds, connectionKinds } from '@trestle/shared';
import { logger } from '../logger';
import {
  designDraftSchema,
  GenerationError,
  type DesignGenerator,
  type GenerationInput,
  type GenerationOutput,
} from './design-generator';
import { buildDesignPrompt, DESIGN_SYSTEM_PROMPT } from './design-prompt';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Models are tried in order. Free-tier capacity for the larger models comes and
 * goes ("high demand" 503s), so a busy model falls through to the next rather
 * than failing the user's request.
 */
export const DEFAULT_MODEL_CHAIN = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
];

/** Gemini's structured-output schema: the shape the model must return. */
const responseSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    components: {
      type: 'array',
      items: {
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
          sources: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'kind', 'label', 'responsibility', 'rationale', 'sources'],
      },
    },
    connections: {
      type: 'array',
      items: {
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
    dataModel: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          storedIn: { type: 'string' },
          keyFields: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string' },
        },
        required: ['name', 'storedIn'],
      },
    },
  },
  required: ['summary', 'components', 'connections'],
};

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
}

export function createGeminiDesignGenerator(
  apiKey: string,
  models: string[] = DEFAULT_MODEL_CHAIN,
): DesignGenerator {
  /** The best model is worth waiting for, so a busy one is retried before falling back. */
  const ATTEMPTS_PER_MODEL = 2;
  const BUSY_RETRY_MS = 1500;
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  async function callModelOnce(
    model: string,
    prompt: string,
    signal: AbortSignal | undefined,
  ): Promise<{ text: string } | { unavailable: true }> {
    const response = await fetch(`${API_BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: DESIGN_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.3, // low: we want defensible, repeatable designs
          // A full design with rationale, alternatives and tradeoffs per
          // component is long; too small a budget truncates the JSON.
          maxOutputTokens: 16384,
        },
      }),
    });

    // Busy, rate-limited, or retired model: try the next one in the chain.
    if (response.status === 429 || response.status === 404 || response.status >= 500) {
      logger.warn({ model, status: response.status }, 'Design model unavailable, trying next');
      return { unavailable: true };
    }
    if (!response.ok) {
      throw new GenerationError(
        `The design service rejected the request (${String(response.status)}).`,
        (await response.text()).slice(0, 300),
      );
    }

    const json = (await response.json()) as GeminiResponse;
    const candidate = json.candidates?.[0];
    const text = candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      throw new GenerationError(
        `The design was cut short (${candidate.finishReason}). Try again with fewer features.`,
      );
    }
    return { text };
  }

  async function callModel(
    model: string,
    prompt: string,
    signal: AbortSignal | undefined,
  ): Promise<{ text: string } | { unavailable: true }> {
    for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
      const result = await callModelOnce(model, prompt, signal);
      if ('text' in result) return result;
      if (attempt < ATTEMPTS_PER_MODEL) await sleep(BUSY_RETRY_MS);
    }
    return { unavailable: true };
  }

  return {
    async generate(input: GenerationInput, signal?: AbortSignal): Promise<GenerationOutput> {
      const basePrompt = buildDesignPrompt(input.requirements, input.entries);
      let lastValidationError: string | null = null;

      // Two passes: the second tells the model exactly what was wrong the first time.
      for (let attempt = 1; attempt <= 2; attempt++) {
        const prompt =
          lastValidationError === null
            ? basePrompt
            : `${basePrompt}\n\nYour previous answer was rejected: ${lastValidationError}\nReturn corrected JSON.`;

        let text: string | null = null;
        for (const model of models) {
          const result = await callModel(model, prompt, signal);
          if ('unavailable' in result) continue;
          text = result.text;

          let parsedJson: unknown;
          try {
            parsedJson = JSON.parse(text);
          } catch {
            lastValidationError = 'the response was not valid JSON';
            break;
          }

          const draft = designDraftSchema.safeParse(parsedJson);
          if (draft.success) {
            return { draft: draft.data, model };
          }
          const [issue] = draft.error.issues;
          lastValidationError = issue
            ? `${issue.path.join('.')}: ${issue.message}`
            : 'the response did not match the required shape';
          logger.warn({ model, attempt, problem: lastValidationError }, 'Design draft rejected');
          break; // retry with feedback rather than trying another model on the same bad answer
        }

        if (text === null) {
          throw new GenerationError(
            'All design models are busy right now. This happens on the free tier: please try again in a minute.',
          );
        }
      }

      throw new GenerationError(
        `The design service returned something unusable (${lastValidationError ?? 'unknown problem'}). Please try again.`,
      );
    },
  };
}
