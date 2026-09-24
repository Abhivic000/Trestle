import {
  DESIGN_SCHEMA_VERSION,
  designSchema,
  layoutComponents,
  type CorpusSearchResult,
  type Design,
  type Requirements,
} from '@trestle/shared';
import type { DesignGenerator } from '../ai/design-generator';
import { GenerationError } from '../ai/design-generator';
import type { Embedder } from '../ai/embeddings';
import type { Database } from '../db/client';
import { logger } from '../logger';
import { resolveCitations, stripInlineCitations } from './citations';
import { retrieveEntriesForRequirements } from './retrieval';

export interface GeneratedDesign {
  design: Design;
  model: string;
  /** Entries given to the model, for logging and later display. */
  entries: CorpusSearchResult[];
}

/**
 * Requirements in, grounded design out:
 * retrieve relevant entries, ask the model, verify what it cites, lay it out,
 * and validate the result against the design contract before anyone stores it.
 */
export async function generateDesign(
  db: Database,
  embedder: Embedder,
  generator: DesignGenerator,
  requirements: Requirements,
  signal?: AbortSignal,
): Promise<GeneratedDesign> {
  const entries = await retrieveEntriesForRequirements(db, embedder, requirements);
  const { draft, model } = await generator.generate({ requirements, entries }, signal);

  const componentIds = new Set(draft.components.map((component) => component.id));
  const { components: cited, invented } = resolveCitations(draft.components, entries);

  // Models paste slugs into sentences; sources belong in the sources list only.
  const components = cited.map((component) => ({
    ...component,
    responsibility: stripInlineCitations(component.responsibility),
    rationale: stripInlineCitations(component.rationale),
    tradeoffs: component.tradeoffs.map(stripInlineCitations),
    alternatives: component.alternatives.map((alternative) => ({
      option: stripInlineCitations(alternative.option),
      whyNot: stripInlineCitations(alternative.whyNot),
    })),
  }));

  if (invented.length > 0) {
    logger.warn({ invented, model }, 'Model cited sources that were not supplied; dropped');
  }

  const positions = layoutComponents(components);

  const design: Design = {
    schemaVersion: DESIGN_SCHEMA_VERSION,
    origin: 'generated',
    summary: stripInlineCitations(draft.summary),
    components: components.map((component) => ({
      ...component,
      position: positions[component.id] ?? { x: 0, y: 0 },
    })),
    // Drop edges that point at components the model did not define, rather than
    // failing the whole design for one bad reference.
    connections: draft.connections
      .filter(
        (connection) =>
          componentIds.has(connection.from) &&
          componentIds.has(connection.to) &&
          connection.from !== connection.to,
      )
      .map((connection) => ({ ...connection, id: `${connection.from}__${connection.to}` })),
    dataModel: draft.dataModel.filter((entity) => componentIds.has(entity.storedIn)),
  };

  const validated = designSchema.safeParse(design);
  if (!validated.success) {
    const [issue] = validated.error.issues;
    throw new GenerationError(
      `The generated design did not match the expected format (${issue ? `${issue.path.join('.')}: ${issue.message}` : 'unknown problem'}). Please try again.`,
    );
  }

  return { design: validated.data, model, entries };
}
