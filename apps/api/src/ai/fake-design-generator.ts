import type { DesignGenerator, GenerationInput, GenerationOutput } from './design-generator';
import { GenerationError } from './design-generator';

export interface FakeGeneratorOptions {
  /** Make the next call fail, to test how the API reports a generation failure. */
  failWith?: string;
  model?: string;
}

/**
 * Deterministic stand-in for the real model, used by tests.
 *
 * It cites the first supplied entry plus a slug that was never supplied, so
 * tests can prove invented citations are dropped.
 */
export function createFakeDesignGenerator(options: FakeGeneratorOptions = {}): DesignGenerator {
  return {
    generate({ requirements, entries }: GenerationInput): Promise<GenerationOutput> {
      if (options.failWith) {
        return Promise.reject(new GenerationError(options.failWith));
      }

      const citedSlug = entries[0]?.slug;
      const sources = citedSlug ? [citedSlug, 'slug-that-was-never-supplied'] : [];

      return Promise.resolve({
        model: options.model ?? 'fake-model-v1',
        draft: {
          summary: `A test design for ${requirements.features.join(', ')} at ${String(requirements.dailyActiveUsers)} daily users.`,
          // Deliberately realistic: long labels, real technology names and edge
          // labels, so the canvas is tested against the cases that break layouts.
          components: [
            {
              id: 'client-app',
              kind: 'client',
              label: 'Web & Mobile Clients',
              responsibility: 'What people use to reach the product.',
              rationale: 'Every design starts with the client that sends the traffic.',
              alternatives: [],
              tradeoffs: [],
              sources: [],
            },
            {
              id: 'api-service',
              kind: 'service',
              label: 'API service',
              technology: 'Node.js',
              responsibility: 'Handles requests and runs the product logic.',
              rationale: 'A single service is the simplest thing that meets these requirements.',
              alternatives: [{ option: 'Microservices', whyNot: 'More moving parts than needed.' }],
              tradeoffs: ['Everything scales together.'],
              sources,
            },
            {
              id: 'identity-provider',
              kind: 'external',
              label: 'Managed Identity Provider',
              technology: 'Auth0',
              responsibility: 'Handles sign-up, sign-in and issues signed tokens.',
              rationale: 'Authentication has sharp edges that a small team should not build.',
              alternatives: [
                { option: 'Own password storage', whyNot: 'Security risk for little benefit.' },
              ],
              tradeoffs: ['A third party sits on the sign-in path.'],
              sources: [],
            },
            {
              id: 'primary-db',
              kind: 'database',
              label: 'Primary database',
              technology: 'PostgreSQL',
              responsibility: 'Stores the product data.',
              rationale: 'Relational storage fits the stated consistency needs.',
              alternatives: [],
              tradeoffs: ['A single primary eventually limits writes.'],
              sources: [],
            },
            {
              id: 'object-storage',
              kind: 'storage',
              label: 'Object Storage for Media Files',
              technology: 'Cloudflare R2',
              responsibility: 'Holds uploads outside the database.',
              rationale: 'Large files inflate backups and waste database memory.',
              alternatives: [],
              tradeoffs: ['Two stores must be kept consistent.'],
              sources: [],
            },
          ],
          connections: [
            {
              from: 'client-app',
              to: 'api-service',
              kind: 'sync',
              // Deliberately long: proves labels clip instead of running under boxes.
              label: 'Authenticated API requests (posts, feeds)',
            },
            { from: 'api-service', to: 'identity-provider', kind: 'sync', label: 'verify tokens' },
            { from: 'api-service', to: 'primary-db', kind: 'data', label: 'reads/writes' },
            { from: 'api-service', to: 'object-storage', kind: 'data', label: 'signed URLs' },
            // Points at a component that does not exist: must be dropped, not stored.
            { from: 'api-service', to: 'ghost-component', kind: 'sync' },
          ],
          dataModel: [{ name: 'User', storedIn: 'primary-db', keyFields: ['id', 'email'] }],
        },
      });
    },
  };
}
