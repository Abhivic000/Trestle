import { z } from 'zod';
import {
  componentKinds,
  connectionKinds,
  designComponentSchema,
  designSchema,
  type Design,
} from './design';

/*
 * A proposed change to an existing design.
 *
 * The product rule is that nothing is ever applied automatically: the AI
 * proposes operations, the user accepts or rejects them one by one, and only
 * accepted operations are merged into a new version.
 */

/** The component fields a change may alter. Rationale and sources come with it. */
export const componentChangesSchema = z.object({
  label: z.string().min(2).max(80).optional(),
  kind: z.enum(componentKinds).optional(),
  technology: z.string().max(80).optional(),
  responsibility: z.string().min(10).max(600).optional(),
  rationale: z.string().min(10).max(1200).optional(),
});

const operationBase = {
  /** Stable id within this proposal, used to accept or reject just this part. */
  id: z.string().min(1).max(40),
  /** Why this specific change is proposed, in one or two sentences. */
  explanation: z.string().min(10).max(600),
  /** Reference-library entries backing it (ids after the server resolves them). */
  sources: z.array(z.string()).max(6).default([]),
};

export const changeOperationSchema = z.discriminatedUnion('type', [
  z.object({
    ...operationBase,
    type: z.literal('add_component'),
    component: designComponentSchema,
  }),
  z.object({
    ...operationBase,
    type: z.literal('modify_component'),
    componentId: z.string().min(2).max(64),
    changes: componentChangesSchema,
  }),
  z.object({
    ...operationBase,
    type: z.literal('remove_component'),
    componentId: z.string().min(2).max(64),
  }),
  z.object({
    ...operationBase,
    type: z.literal('add_connection'),
    connection: z.object({
      id: z.string().min(2).max(130),
      from: z.string().min(2).max(64),
      to: z.string().min(2).max(64),
      kind: z.enum(connectionKinds),
      label: z.string().max(60).optional(),
    }),
  }),
  z.object({
    ...operationBase,
    type: z.literal('remove_connection'),
    connectionId: z.string().min(2).max(130),
  }),
]);

export type ChangeOperation = z.infer<typeof changeOperationSchema>;

export const changeProposalSchema = z.object({
  id: z.uuid(),
  /** What the user asked for, kept so the review bar can show it. */
  prompt: z.string().min(1).max(500),
  /** One or two sentences on the change as a whole. */
  summary: z.string().min(10).max(1000),
  /** The version this was proposed against; it must still be current to accept. */
  baseVersionId: z.uuid(),
  operations: z.array(changeOperationSchema).min(1).max(20),
});

export type ChangeProposal = z.infer<typeof changeProposalSchema>;

export const createChangeRequestSchema = z.object({
  prompt: z.string().min(3, 'Describe the change you want.').max(500),
});

export type CreateChangeRequest = z.infer<typeof createChangeRequestSchema>;

export const acceptChangeRequestSchema = z.object({
  /** Which operations to apply. Anything not listed is discarded. */
  operationIds: z.array(z.string().min(1).max(40)).min(1),
});

export type AcceptChangeRequest = z.infer<typeof acceptChangeRequestSchema>;

/** How a component or connection is affected, for styling the preview. */
export type ChangeStatus = 'unchanged' | 'added' | 'modified' | 'removed';

/**
 * Applies the chosen operations to a design.
 *
 * Operations that no longer make sense are skipped rather than failing the whole
 * merge: for example an added connection whose component was rejected. Skipped
 * operations are returned so the caller can tell the user.
 */
export function applyChangeOperations(
  design: Design,
  operations: ChangeOperation[],
): { design: Design; skipped: { id: string; reason: string }[] } {
  let components = [...design.components];
  let connections = [...design.connections];
  let dataModel = [...design.dataModel];
  const skipped: { id: string; reason: string }[] = [];

  const hasComponent = (id: string) => components.some((component) => component.id === id);

  for (const operation of operations) {
    switch (operation.type) {
      case 'add_component': {
        if (hasComponent(operation.component.id)) {
          skipped.push({ id: operation.id, reason: 'a component with that id already exists' });
          break;
        }
        components.push(operation.component);
        break;
      }
      case 'modify_component': {
        if (!hasComponent(operation.componentId)) {
          skipped.push({ id: operation.id, reason: 'the component is no longer in the design' });
          break;
        }
        components = components.map((component) =>
          component.id === operation.componentId
            ? { ...component, ...operation.changes }
            : component,
        );
        break;
      }
      case 'remove_component': {
        if (!hasComponent(operation.componentId)) {
          skipped.push({ id: operation.id, reason: 'the component is no longer in the design' });
          break;
        }
        components = components.filter((component) => component.id !== operation.componentId);
        // Anything pointing at a removed component goes with it.
        connections = connections.filter(
          (connection) =>
            connection.from !== operation.componentId && connection.to !== operation.componentId,
        );
        dataModel = dataModel.filter((entity) => entity.storedIn !== operation.componentId);
        break;
      }
      case 'add_connection': {
        const { from, to, id } = operation.connection;
        if (!hasComponent(from) || !hasComponent(to)) {
          skipped.push({
            id: operation.id,
            reason: 'it connects a component that is not in the design',
          });
          break;
        }
        if (connections.some((connection) => connection.id === id)) break;
        connections.push(operation.connection);
        break;
      }
      case 'remove_connection': {
        if (!connections.some((connection) => connection.id === operation.connectionId)) {
          skipped.push({ id: operation.id, reason: 'the connection is no longer in the design' });
          break;
        }
        connections = connections.filter((connection) => connection.id !== operation.connectionId);
        break;
      }
    }
  }

  return {
    design: { ...design, components, connections, dataModel, origin: 'edited' },
    skipped,
  };
}

/**
 * The design as it would look with every operation applied, plus a status per
 * component and connection. Removals stay in the preview (marked "removed") so
 * the user can see what would disappear.
 */
export function buildChangePreview(
  design: Design,
  operations: ChangeOperation[],
): { design: Design; statusById: Record<string, ChangeStatus> } {
  const statusById: Record<string, ChangeStatus> = {};
  const removedComponentIds = new Set<string>();
  const removedConnectionIds = new Set<string>();

  const previewOperations = operations.filter(
    (operation) => operation.type !== 'remove_component' && operation.type !== 'remove_connection',
  );

  for (const operation of operations) {
    switch (operation.type) {
      case 'add_component':
        statusById[operation.component.id] = 'added';
        break;
      case 'modify_component':
        statusById[operation.componentId] = 'modified';
        break;
      case 'remove_component':
        statusById[operation.componentId] = 'removed';
        removedComponentIds.add(operation.componentId);
        break;
      case 'add_connection':
        statusById[operation.connection.id] = 'added';
        break;
      case 'remove_connection':
        statusById[operation.connectionId] = 'removed';
        removedConnectionIds.add(operation.connectionId);
        break;
    }
  }

  // Apply everything except removals, so removed items remain visible, marked.
  const { design: preview } = applyChangeOperations(design, previewOperations);
  return { design: preview, statusById };
}

export const changeProposalResponseSchema = z.object({
  proposal: changeProposalSchema,
});

export type ChangeProposalResponse = z.infer<typeof changeProposalResponseSchema>;

/** Validates that a merged design is still a legal design before it is saved. */
export function isValidDesign(design: Design): boolean {
  return designSchema.safeParse(design).success;
}
