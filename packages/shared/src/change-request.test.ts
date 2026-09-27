import { describe, expect, it } from 'vitest';
import { applyChangeOperations, buildChangePreview, type ChangeOperation } from './change-request';
import { DESIGN_SCHEMA_VERSION, designSchema, type Design } from './design';

const design: Design = designSchema.parse({
  schemaVersion: DESIGN_SCHEMA_VERSION,
  origin: 'generated',
  summary: 'A design used for change-request tests.',
  components: [
    {
      id: 'api',
      kind: 'service',
      label: 'API service',
      responsibility: 'Runs the product logic for the whole system.',
      rationale: 'One service is enough at this scale.',
      position: { x: 0, y: 0 },
    },
    {
      id: 'db',
      kind: 'database',
      label: 'Primary database',
      responsibility: 'Stores the product data as the source of truth.',
      rationale: 'Relational storage fits the consistency needs.',
      position: { x: 296, y: 0 },
    },
  ],
  connections: [{ id: 'api__db', from: 'api', to: 'db', kind: 'data' }],
  dataModel: [{ name: 'User', storedIn: 'db', keyFields: ['id'] }],
});

const addChat: ChangeOperation = {
  id: 'op-1',
  type: 'add_component',
  explanation: 'Chat needs its own service so an outage cannot take the API down.',
  sources: [],
  component: {
    id: 'chat',
    kind: 'service',
    label: 'Live Chat Service',
    responsibility: 'Handles real-time messages between users of the product.',
    rationale: 'Chat has different scaling and uptime needs from the rest.',
    alternatives: [],
    tradeoffs: [],
    sources: [],
    position: { x: 600, y: 0 },
  },
};

const connectChat: ChangeOperation = {
  id: 'op-2',
  type: 'add_connection',
  explanation: 'Clients reach chat through the existing service.',
  sources: [],
  connection: { id: 'api__chat', from: 'api', to: 'chat', kind: 'sync', label: 'chat API' },
};

describe('applyChangeOperations', () => {
  it('applies only the operations it is given', () => {
    const { design: merged } = applyChangeOperations(design, [addChat]);

    expect(merged.components.map((component) => component.id)).toEqual(['api', 'db', 'chat']);
    // The connection operation was not passed in, so it was not applied.
    expect(merged.connections).toHaveLength(1);
    expect(designSchema.safeParse(merged).success).toBe(true);
  });

  it('skips a connection whose component was not accepted, instead of failing', () => {
    const { design: merged, skipped } = applyChangeOperations(design, [connectChat]);

    expect(merged.connections).toHaveLength(1);
    expect(skipped).toEqual([
      { id: 'op-2', reason: 'it connects a component that is not in the design' },
    ]);
    expect(designSchema.safeParse(merged).success).toBe(true);
  });

  it('applies an add and its connection together', () => {
    const { design: merged, skipped } = applyChangeOperations(design, [addChat, connectChat]);

    expect(skipped).toEqual([]);
    expect(merged.connections.map((connection) => connection.id)).toContain('api__chat');
    expect(designSchema.safeParse(merged).success).toBe(true);
  });

  it('removing a component also removes what referenced it', () => {
    const remove: ChangeOperation = {
      id: 'op-3',
      type: 'remove_component',
      explanation: 'The database is replaced by a managed service elsewhere.',
      sources: [],
      componentId: 'db',
    };
    const { design: merged } = applyChangeOperations(design, [remove]);

    expect(merged.components.map((component) => component.id)).toEqual(['api']);
    expect(merged.connections).toEqual([]);
    expect(merged.dataModel).toEqual([]);
    expect(designSchema.safeParse(merged).success).toBe(true);
  });

  it('marks the result as edited, not generated', () => {
    const { design: merged } = applyChangeOperations(design, [addChat]);
    expect(merged.origin).toBe('edited');
  });

  it('does not change the original design', () => {
    applyChangeOperations(design, [addChat]);
    expect(design.components).toHaveLength(2);
  });
});

describe('buildChangePreview', () => {
  it('marks additions and keeps removals visible', () => {
    const remove: ChangeOperation = {
      id: 'op-3',
      type: 'remove_component',
      explanation: 'No longer needed once chat exists.',
      sources: [],
      componentId: 'db',
    };

    const { design: preview, statusById } = buildChangePreview(design, [addChat, remove]);

    // The removed component is still drawn, so the user can see what would go.
    expect(preview.components.map((component) => component.id)).toEqual(['api', 'db', 'chat']);
    expect(statusById.chat).toBe('added');
    expect(statusById.db).toBe('removed');
    expect(statusById.api).toBeUndefined();
  });

  it('marks a modified component', () => {
    const modify: ChangeOperation = {
      id: 'op-4',
      type: 'modify_component',
      explanation: 'The service now also routes chat traffic.',
      sources: [],
      componentId: 'api',
      changes: { label: 'API & chat gateway' },
    };

    const { design: preview, statusById } = buildChangePreview(design, [modify]);

    expect(statusById.api).toBe('modified');
    expect(preview.components[0]?.label).toBe('API & chat gateway');
  });
});
