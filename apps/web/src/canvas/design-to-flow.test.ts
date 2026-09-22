import { DESIGN_SCHEMA_VERSION, designSchema, type Design } from '@trestle/shared';
import { describe, expect, it } from 'vitest';
import { designToFlow } from './design-to-flow';

const design: Design = designSchema.parse({
  schemaVersion: DESIGN_SCHEMA_VERSION,
  origin: 'generated',
  summary: 'Two services and a queue between them.',
  components: [
    {
      id: 'svc-orders',
      kind: 'service',
      label: 'Orders Service',
      responsibility: 'Accepts and tracks customer orders.',
      rationale: 'Orders need their own scaling and deployment cadence.',
      position: { x: 10, y: 20 },
    },
    {
      id: 'queue-events',
      kind: 'queue',
      label: 'Event queue',
      responsibility: 'Buffers order events for downstream consumers.',
      rationale: 'Decouples order handling from slow consumers.',
      position: { x: 300, y: 20 },
    },
  ],
  connections: [
    { id: 'svc-orders__queue-events', from: 'svc-orders', to: 'queue-events', kind: 'async' },
  ],
  dataModel: [],
});

describe('designToFlow', () => {
  it('maps components to positioned nodes of our custom type', () => {
    const { nodes } = designToFlow(design);

    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({
      id: 'svc-orders',
      type: 'designComponent',
      position: { x: 10, y: 20 },
    });
    expect(nodes[0]?.data.component.label).toBe('Orders Service');
    expect(nodes[0]?.data.status).toBe('unchanged');
  });

  it('maps connections to edges and animates asynchronous ones', () => {
    const { edges } = designToFlow(design);

    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      id: 'svc-orders__queue-events',
      source: 'svc-orders',
      target: 'queue-events',
      animated: true,
    });
    expect(edges[0]?.style?.strokeDasharray).toBeUndefined();
  });

  it('marks proposed changes so the diff preview can style them', () => {
    const { nodes, edges } = designToFlow(design, (id) =>
      id === 'queue-events' || id === 'svc-orders__queue-events' ? 'added' : 'unchanged',
    );

    expect(nodes.find((node) => node.id === 'queue-events')?.data.status).toBe('added');
    expect(nodes.find((node) => node.id === 'svc-orders')?.data.status).toBe('unchanged');
    // Proposed edges are dashed and amber.
    expect(edges[0]?.style?.strokeDasharray).toBe('4 4');
    expect(edges[0]?.style?.stroke).toBe('var(--trestle-warning)');
  });
});
