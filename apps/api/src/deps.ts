import { createGeminiDesignGenerator } from './ai/gemini-design-generator';
import { createGeminiEmbedder } from './ai/embeddings';
import { createFakeDesignGenerator } from './ai/fake-design-generator';
import { createFakeEmbedder } from './ai/fake-embedder';
import type { DesignGenerator } from './ai/design-generator';
import type { Embedder } from './ai/embeddings';
import { env } from './config/env';
import { logger } from './logger';

/**
 * The outside-world services the routes use. Collected here so tests can pass
 * fakes to `createApp()` and never call Google or spend quota.
 */
export interface AppDependencies {
  embedder: Embedder;
  designGenerator: DesignGenerator;
}

export function createDefaultDependencies(): AppDependencies {
  if (env.USE_FAKE_AI) {
    logger.warn('USE_FAKE_AI is set: AI responses are fake. Never enable this in production.');
    return {
      embedder: createFakeEmbedder(),
      designGenerator: createFakeDesignGenerator(),
    };
  }

  return {
    embedder: createGeminiEmbedder(env.GEMINI_API_KEY),
    designGenerator: createGeminiDesignGenerator(env.GEMINI_API_KEY),
  };
}
