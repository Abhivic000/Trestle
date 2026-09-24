import {
  COLUMN_BY_KIND,
  LANE_LABELS,
  type ComponentKind,
  type Design,
  type DesignComponent,
  type DesignConnection,
} from '@trestle/shared';
import { MarkerType, type Edge, type Node } from '@xyflow/react';

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
): { nodes: CanvasNode[]; edges: DesignFlowEdge[] } {
  const componentNodes: DesignFlowNode[] = design.components.map((component) => ({
    id: component.id,
    type: 'designComponent',
    position: component.position,
    data: { component, status: statusOf(component.id) },
  }));

  const nodes = [...buildLaneHeaders(design), ...componentNodes];

  const edges: DesignFlowEdge[] = design.connections.map((connection) => {
    const status = statusOf(connection.id);
    const stroke = status === 'unchanged' ? '#3a3f55' : 'var(--trestle-warning)';
    return {
      id: connection.id,
      source: connection.from,
      target: connection.to,
      label: connection.label,
      // Our own edge: right-angled routing plus an HTML label that clips instead
      // of running under the boxes (see DesignEdge).
      type: 'design',
      // Async and proposed links are dashed; data/sync links are solid.
      animated: connection.kind === 'async',
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: stroke },
      data: { connection, status },
      style: {
        stroke,
        strokeWidth: 1.5,
        strokeDasharray: status === 'unchanged' ? undefined : '4 4',
      },
    };
  });

  return { nodes, edges };
}

export interface LaneHeaderData extends Record<string, unknown> {
  title: string;
}

export type LaneHeaderNode = Node<LaneHeaderData, 'laneHeader'>;

/** Everything the canvas renders: component boxes plus the column captions. */
export type CanvasNode = DesignFlowNode | LaneHeaderNode;

export function isDesignNode(node: CanvasNode): node is DesignFlowNode {
  return node.type === 'designComponent';
}

/**
 * Column captions ("Clients", "Services", "Data & storage"), the way an
 * architecture diagram is usually organised. Derived from where components
 * actually sit, so they stay correct for any layout.
 */
function buildLaneHeaders(design: Design): LaneHeaderNode[] {
  const byColumn = new Map<number, { x: number; kinds: Set<ComponentKind> }>();

  for (const component of design.components) {
    const x = Math.round(component.position.x);
    const lane = byColumn.get(x) ?? { x, kinds: new Set() };
    lane.kinds.add(component.kind);
    byColumn.set(x, lane);
  }

  // All captions share one baseline, above the highest component, so they read
  // as a row of column headings rather than floating labels.
  const headerY = Math.min(...design.components.map((component) => component.position.y)) - 44;

  const headers: LaneHeaderNode[] = [];
  for (const lane of byColumn.values()) {
    // A column can hold several kinds (cache + queue); name it after the first.
    const [firstKind] = [...lane.kinds].sort((a, b) => COLUMN_BY_KIND[a] - COLUMN_BY_KIND[b]);
    const title = firstKind ? LANE_LABELS[COLUMN_BY_KIND[firstKind]] : undefined;
    if (!title) continue;

    headers.push({
      id: `lane-${String(lane.x)}`,
      type: 'laneHeader',
      position: { x: lane.x, y: headerY },
      data: { title },
      draggable: false,
      selectable: false,
      focusable: false,
      deletable: false,
    });
  }
  return headers;
}
