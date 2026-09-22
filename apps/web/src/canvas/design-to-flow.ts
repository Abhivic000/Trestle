import type { Design, DesignComponent, DesignConnection } from '@trestle/shared';
import type { Edge, Node } from '@xyflow/react';

/**
 * Whether a node/edge is part of the saved design or part of a proposed change.
 * Only 'unchanged' is used today; the diff preview (step 6.6) uses the rest.
 */
export type ChangeStatus = 'unchanged' | 'added' | 'modified' | 'removed';

export interface DesignNodeData extends Record<string, unknown> {
  component: DesignComponent;
  status: ChangeStatus;
}

export type DesignFlowNode = Node<DesignNodeData, 'designComponent'>;

export interface DesignEdgeData extends Record<string, unknown> {
  connection: DesignConnection;
  status: ChangeStatus;
}

export type DesignFlowEdge = Edge<DesignEdgeData>;

/** Converts a stored design into what React Flow renders. */
export function designToFlow(
  design: Design,
  statusOf: (id: string) => ChangeStatus = () => 'unchanged',
): { nodes: DesignFlowNode[]; edges: DesignFlowEdge[] } {
  const nodes: DesignFlowNode[] = design.components.map((component) => ({
    id: component.id,
    type: 'designComponent',
    position: component.position,
    data: { component, status: statusOf(component.id) },
  }));

  const edges: DesignFlowEdge[] = design.connections.map((connection) => {
    const status = statusOf(connection.id);
    return {
      id: connection.id,
      source: connection.from,
      target: connection.to,
      label: connection.label,
      // Async and proposed links are dashed; data/sync links are solid.
      animated: connection.kind === 'async',
      data: { connection, status },
      style: {
        stroke: status === 'unchanged' ? '#2b2f3e' : 'var(--trestle-warning)',
        strokeWidth: 1.5,
        strokeDasharray: status === 'unchanged' ? undefined : '4 4',
      },
    };
  });

  return { nodes, edges };
}
