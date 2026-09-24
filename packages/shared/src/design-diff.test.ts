import { describe, expect, it } from 'vitest';
import { DESIGN_SCHEMA_VERSION, designSchema, type Design } from './design';
import { diffDesigns, summariseDesignChange } from './design-diff';

const component = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  kind: 'service' as const,
  label: `Component ${id}`,
  responsibility: 'Does something useful for the product.',
  rationale: 'It exists because the requirements call for it.',
  position: { x: 0, y: 0 },
  ...overrides,
});

const design = (overrides: Record<string, unknown> = {}): Design =>
  designSchema.parse({
    schemaVersion: DESIGN_SCHEMA_VERSION,
    origin: 'generated',
    summary: 'A design used for diffing tests.',
    components: [component('api'), component('db', { kind: 'database' })],
    connections: [{ id: 'api__db', from: 'api', to: 'db', kind: 'data' }],
    dataModel: [],
    ...overrides,
  });

describe('diffDesigns', () => {
  it('reports an added component', () => {
    const next = design({
      components: [
        component('api'),
        component('db', { kind: 'database' }),
        component('cache', { kind: 'cache' }),
      ],
    });
    expect(diffDesigns(design(), next).addedComponents).toEqual(['cache']);
  });

  it('reports a removed component', () => {
    const next = design({ components: [component('api')], connections: [] });
    expect(diffDesigns(design(), next).removedComponents).toEqual(['db']);
  });

  it('separates a rename from a move', () => {
    const renamed = design({
      components: [
        component('api', { label: 'Renamed API' }),
        component('db', { kind: 'database' }),
      ],
    });
    const moved = design({
      components: [
        component('api', { position: { x: 500, y: 0 } }),
        component('db', { kind: 'database' }),
      ],
    });

    expect(diffDesigns(design(), renamed).changedComponents).toEqual(['api']);
    expect(diffDesigns(design(), renamed).movedComponents).toEqual([]);
    expect(diffDesigns(design(), moved).movedComponents).toEqual(['api']);
    expect(diffDesigns(design(), moved).changedComponents).toEqual([]);
  });

  it('reports connection changes', () => {
    const next = design({ connections: [] });
    expect(diffDesigns(design(), next).removedConnections).toEqual(['api__db']);
  });
});

describe('summariseDesignChange', () => {
  it('describes what changed in plain words', () => {
    const next = design({
      components: [
        component('api', { position: { x: 300, y: 0 } }),
        component('db', { kind: 'database' }),
        component('cache', { kind: 'cache' }),
      ],
    });
    expect(summariseDesignChange(design(), next)).toBe('Added 1 component, moved 1 component');
  });

  it('uses plurals correctly', () => {
    const next = design({
      components: [
        component('api'),
        component('db', { kind: 'database' }),
        component('cache', { kind: 'cache' }),
        component('queue', { kind: 'queue' }),
      ],
    });
    expect(summariseDesignChange(design(), next)).toBe('Added 2 components');
  });

  it('says so when nothing changed', () => {
    expect(summariseDesignChange(design(), design())).toBe('Saved with no changes');
  });
});
