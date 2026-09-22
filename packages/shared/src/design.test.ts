import { describe, expect, it } from 'vitest';
import { DESIGN_SCHEMA_VERSION, designSchema } from './design';

const component = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  kind: 'service' as const,
  label: 'Catalog Service',
  responsibility: 'Owns catalog metadata for the product.',
  rationale: 'Split out because catalog reads and playback writes scale differently.',
  position: { x: 0, y: 0 },
  ...overrides,
});

const design = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: DESIGN_SCHEMA_VERSION,
  origin: 'generated' as const,
  summary: 'A small read-heavy service architecture.',
  components: [component('svc-catalog'), component('db-main', { kind: 'database' })],
  connections: [{ id: 'edge-1', from: 'svc-catalog', to: 'db-main', kind: 'data' as const }],
  dataModel: [],
  ...overrides,
});

describe('design schema', () => {
  it('accepts a valid design and fills in optional lists', () => {
    const parsed = designSchema.parse(design());
    expect(parsed.components[0]?.alternatives).toEqual([]);
    expect(parsed.components[0]?.sources).toEqual([]);
  });

  it('rejects duplicate component ids', () => {
    const result = designSchema.safeParse(
      design({ components: [component('svc-catalog'), component('svc-catalog')] }),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('duplicate component id');
  });

  it('rejects a connection to an unknown component', () => {
    const result = designSchema.safeParse(
      design({ connections: [{ id: 'edge-1', from: 'svc-catalog', to: 'ghost', kind: 'data' }] }),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('unknown component id "ghost"');
  });

  it('rejects a component connected to itself', () => {
    const result = designSchema.safeParse(
      design({
        connections: [{ id: 'edge-1', from: 'svc-catalog', to: 'svc-catalog', kind: 'sync' }],
      }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects data stored in an unknown component', () => {
    const result = designSchema.safeParse(
      design({ dataModel: [{ name: 'User', storedIn: 'ghost', keyFields: ['id'] }] }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects component ids that are not url-safe slugs', () => {
    expect(designSchema.safeParse(design({ components: [component('Svc Catalog')] })).success).toBe(
      false,
    );
  });

  it('rejects a design from a future schema version', () => {
    expect(designSchema.safeParse(design({ schemaVersion: 99 })).success).toBe(false);
  });
});
