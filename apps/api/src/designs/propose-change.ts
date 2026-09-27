import {
  changeOperationSchema,
  layoutComponents,
  type ChangeOperation,
  type CorpusSearchResult,
  type Design,
} from '@trestle/shared';
import type { ChangeGenerator, ChangeOperationDraft } from '../ai/change-generator';
import { GenerationError } from '../ai/design-generator';
import type { Embedder } from '../ai/embeddings';
import { searchCorpus } from '../corpus/search';
import type { Database } from '../db/client';
import { logger } from '../logger';
import { resolveCitations, stripInlineCitations } from './citations';

export interface ProposedChange {
  summary: string;
  operations: ChangeOperation[];
  model: string;
  entries: CorpusSearchResult[];
}

/**
 * Turns a plain-language request into a reviewed set of operations.
 *
 * Everything the model returns is checked against the CURRENT design: operations
 * referencing components that don't exist are dropped, invented citations are
 * removed, and new components are positioned by the server.
 */
export async function proposeChange(
  db: Database,
  embedder: Embedder,
  generator: ChangeGenerator,
  design: Design,
  prompt: string,
  signal?: AbortSignal,
): Promise<ProposedChange> {
  const entries = await searchCorpus(db, embedder, {
    query: prompt,
    limit: 8,
    minSimilarity: 0.3,
  });

  const { draft, model } = await generator.propose({ prompt, design, entries }, signal);

  const existingComponentIds = new Set(design.components.map((component) => component.id));
  const existingConnectionIds = new Set(design.connections.map((connection) => connection.id));
  const addedComponentIds = new Set<string>();
  const operations: ChangeOperation[] = [];
  const dropped: { type: string; reason: string }[] = [];

  draft.operations.forEach((operation, index) => {
    const built = buildOperation(operation, `op-${String(index + 1)}`, {
      existingComponentIds,
      existingConnectionIds,
      addedComponentIds,
    });
    if ('reason' in built) {
      dropped.push({ type: operation.type, reason: built.reason });
      return;
    }
    operations.push(built.operation);
  });

  if (dropped.length > 0) {
    logger.warn({ dropped, model }, 'Dropped change operations that did not fit the design');
  }
  if (operations.length === 0) {
    throw new GenerationError(
      'The proposal did not contain any change that fits this design. Try rephrasing the request.',
    );
  }

  // Citations: keep only entries that were actually supplied to the model.
  const { components: withSources, invented } = resolveCitations(operations, entries);
  if (invented.length > 0) {
    logger.warn({ invented, model }, 'Model cited sources that were not supplied; dropped');
  }

  // New components need positions, which the server decides (models are poor at it).
  const newComponents = withSources
    .filter((operation) => operation.type === 'add_component')
    .map((operation) => operation.component);
  const positions = layoutComponents([...design.components, ...newComponents]);

  const positioned = withSources.map((operation) =>
    operation.type === 'add_component'
      ? {
          ...operation,
          component: {
            ...operation.component,
            position: positions[operation.component.id] ?? operation.component.position,
          },
        }
      : operation,
  );

  return {
    summary: stripInlineCitations(draft.summary),
    operations: positioned,
    model,
    entries,
  };
}

interface BuildContext {
  existingComponentIds: Set<string>;
  existingConnectionIds: Set<string>;
  addedComponentIds: Set<string>;
}

/** Converts one flat draft operation into a strict operation, or explains why not. */
function buildOperation(
  draft: ChangeOperationDraft,
  id: string,
  context: BuildContext,
): { operation: ChangeOperation } | { reason: string } {
  const explanation = stripInlineCitations(draft.explanation);
  const base = { id, explanation, sources: draft.sources };
  const known = (componentId: string) =>
    context.existingComponentIds.has(componentId) || context.addedComponentIds.has(componentId);

  switch (draft.type) {
    case 'add_component': {
      if (!draft.component) return { reason: 'add_component without a component' };
      if (known(draft.component.id)) return { reason: 'component id already exists' };
      context.addedComponentIds.add(draft.component.id);
      return parse({
        ...base,
        type: 'add_component',
        component: {
          ...draft.component,
          responsibility: stripInlineCitations(draft.component.responsibility),
          rationale: stripInlineCitations(draft.component.rationale),
          sources: [],
          // Replaced by the server's layout once every addition is known.
          position: { x: 0, y: 0 },
        },
      });
    }
    case 'modify_component': {
      if (!draft.componentId || !draft.changes) return { reason: 'modify without id or changes' };
      if (!known(draft.componentId)) return { reason: 'component does not exist' };
      const changes = {
        ...draft.changes,
        ...(draft.changes.responsibility
          ? { responsibility: stripInlineCitations(draft.changes.responsibility) }
          : {}),
        ...(draft.changes.rationale
          ? { rationale: stripInlineCitations(draft.changes.rationale) }
          : {}),
      };
      if (Object.keys(changes).length === 0) return { reason: 'modify with no actual change' };
      return parse({ ...base, type: 'modify_component', componentId: draft.componentId, changes });
    }
    case 'remove_component': {
      if (!draft.componentId) return { reason: 'remove without an id' };
      if (!context.existingComponentIds.has(draft.componentId)) {
        return { reason: 'component does not exist' };
      }
      return parse({ ...base, type: 'remove_component', componentId: draft.componentId });
    }
    case 'add_connection': {
      if (!draft.connection) return { reason: 'add_connection without a connection' };
      const { from, to } = draft.connection;
      if (!known(from) || !known(to))
        return { reason: 'connection references an unknown component' };
      if (from === to) return { reason: 'a component cannot connect to itself' };
      return parse({
        ...base,
        type: 'add_connection',
        connection: { ...draft.connection, id: `${from}__${to}` },
      });
    }
    case 'remove_connection': {
      if (!draft.connectionId) return { reason: 'remove_connection without an id' };
      if (!context.existingConnectionIds.has(draft.connectionId)) {
        return { reason: 'connection does not exist' };
      }
      return parse({ ...base, type: 'remove_connection', connectionId: draft.connectionId });
    }
  }
}

function parse(candidate: unknown): { operation: ChangeOperation } | { reason: string } {
  const result = changeOperationSchema.safeParse(candidate);
  if (!result.success) {
    const [issue] = result.error.issues;
    return { reason: issue ? `${issue.path.join('.')}: ${issue.message}` : 'invalid operation' };
  }
  return { operation: result.data };
}
