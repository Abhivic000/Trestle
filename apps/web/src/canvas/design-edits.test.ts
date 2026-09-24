import { DESIGN_SCHEMA_VERSION, designSchema, type Design } from '@trestle/shared';
import { describe, expect, it } from 'vitest';
import {
  addComponent,
  componentIdFromLabel,
  connectComponents,
  moveComponent,
  removeComponent,
  removeConnection,
  updateComponent,
} from './design-edits';

const design: Design = designSchema.parse({
  schemaVersion: DESIGN_SCHEMA_VERSION,
  origin: 'generated',
  summary: 'A design used for editing tests.',
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

describe('componentIdFromLabel', () => {
  it('makes a url-safe id from a name', () => {
    expect(componentIdFromLabel('Recommendation Service', [])).toBe('recommendation-service');
  });

  it('avoids clashing with an existing id', () => {
    expect(componentIdFromLabel('API service', ['api-service'])).toBe('api-service-2');
  });

  it('falls back when a name has no usable characters', () => {
    expect(componentIdFromLabel('!!!', [])).toBe('component');
  });
});

describe('addComponent', () => {
  it('adds a component to the right of the others', () => {
    const next = addComponent(design, { label: 'Redis cache', kind: 'cache', technology: 'Redis' });
    const added = next.components.at(-1);

    expect(next.components).toHaveLength(3);
    expect(added?.id).toBe('redis-cache');
    expect(added?.technology).toBe('Redis');
    expect(added?.position.x).toBeGreaterThan(296);
  });

  it('says plainly that a person added it, inventing no reasoning or sources', () => {
    const added = addComponent(design, { label: 'Worker', kind: 'worker' }).components.at(-1);

    expect(added?.rationale).toContain('Added manually');
    expect(added?.sources).toEqual([]);
    expect(added?.alternatives).toEqual([]);
  });

  it('keeps the result valid against the design contract', () => {
    const next = addComponent(design, { label: 'Search', kind: 'search' });
    expect(designSchema.safeParse(next).success).toBe(true);
  });
});

describe('removeComponent', () => {
  it('removes the component and anything that referenced it', () => {
    const next = removeComponent(design, 'db');

    expect(next.components.map((c) => c.id)).toEqual(['api']);
    expect(next.connections).toEqual([]);
    expect(next.dataModel).toEqual([]);
    expect(designSchema.safeParse(next).success).toBe(true);
  });
});

describe('moveComponent and updateComponent', () => {
  it('moves one component only', () => {
    const next = moveComponent(design, 'api', { x: 40, y: 80 });
    expect(next.components[0]?.position).toEqual({ x: 40, y: 80 });
    expect(next.components[1]?.position).toEqual({ x: 296, y: 0 });
  });

  it('renames a component and clears an emptied technology', () => {
    const renamed = updateComponent(design, 'db', { label: 'Postgres', technology: 'PostgreSQL' });
    expect(renamed.components[1]?.label).toBe('Postgres');
    expect(renamed.components[1]?.technology).toBe('PostgreSQL');

    const cleared = updateComponent(renamed, 'db', { technology: '  ' });
    expect(cleared.components[1]?.technology).toBeUndefined();
  });
});

describe('connections', () => {
  it('connects two components', () => {
    const next = connectComponents(design, 'db', 'api');
    expect(next.connections.map((c) => c.id)).toContain('db__api');
    expect(designSchema.safeParse(next).success).toBe(true);
  });

  it('ignores a duplicate or self connection', () => {
    expect(connectComponents(design, 'api', 'db').connections).toHaveLength(1);
    expect(connectComponents(design, 'api', 'api').connections).toHaveLength(1);
  });

  it('removes a connection', () => {
    expect(removeConnection(design, 'api__db').connections).toEqual([]);
  });
});
