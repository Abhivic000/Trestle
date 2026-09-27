import type {
  ChangeGenerationInput,
  ChangeGenerationOutput,
  ChangeGenerator,
} from './change-generator';
import { GenerationError } from './design-generator';

export interface FakeChangeOptions {
  failWith?: string;
  model?: string;
}

/**
 * Deterministic stand-in for the change model, used by tests.
 *
 * It proposes one of each kind of operation against whatever design it is given,
 * including a citation that was never supplied (to prove invented sources are
 * dropped) and a reference to a missing component (to prove bad operations are
 * rejected rather than stored).
 */
export function createFakeChangeGenerator(options: FakeChangeOptions = {}): ChangeGenerator {
  return {
    propose({ prompt, design, entries }: ChangeGenerationInput): Promise<ChangeGenerationOutput> {
      if (options.failWith) return Promise.reject(new GenerationError(options.failWith));

      const first = design.components[0];
      if (!first) throw new Error('fake change generator needs a design with components');
      const citedSlug = entries[0]?.slug;

      return Promise.resolve({
        model: options.model ?? 'fake-change-model-v1',
        draft: {
          summary: `Proposed changes for "${prompt}".`,
          operations: [
            {
              type: 'add_component',
              explanation: 'A dedicated service keeps this feature isolated from the rest.',
              sources: citedSlug ? [citedSlug, 'never-supplied-slug'] : ['never-supplied-slug'],
              component: {
                id: 'live-chat-service',
                kind: 'service',
                label: 'Live Chat Service',
                technology: 'Node.js',
                responsibility: 'Handles real-time messages between users.',
                rationale: 'Chat has different scaling and uptime needs from the rest.',
                alternatives: [
                  {
                    option: 'Add chat to the main service',
                    whyNot: 'A chat outage would take everything down.',
                  },
                ],
                tradeoffs: ['One more service to operate.'],
              },
            },
            {
              type: 'add_connection',
              explanation: 'Clients reach chat through the same entry point as everything else.',
              sources: [],
              connection: {
                from: first.id,
                to: 'live-chat-service',
                kind: 'sync',
                label: 'chat API',
              },
            },
            {
              type: 'modify_component',
              explanation: 'The entry point now also routes chat traffic.',
              sources: [],
              componentId: first.id,
              changes: { responsibility: `${first.responsibility} Also routes chat traffic.` },
            },
            {
              type: 'add_connection',
              explanation: 'This one points at a component that does not exist.',
              sources: [],
              connection: { from: 'ghost-component', to: 'live-chat-service', kind: 'sync' },
            },
          ],
        },
      });
    },
  };
}
