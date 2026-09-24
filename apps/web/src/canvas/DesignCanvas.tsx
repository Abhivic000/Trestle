import { useEffect, useMemo } from 'react';
import { layoutComponents, type Design } from '@trestle/shared';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeMouseHandler,
  type OnConnect,
  type OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { DesignEdge } from './DesignEdge';
import { DesignNode } from './DesignNode';
import { LaneHeader } from './LaneHeader';
import {
  connectComponents,
  moveComponent,
  removeComponent,
  removeConnection,
} from './design-edits';
import { designToFlow, isDesignNode, type CanvasNode, type DesignFlowEdge } from './design-to-flow';

const nodeTypes = { designComponent: DesignNode, laneHeader: LaneHeader };
const edgeTypes = { design: DesignEdge };

interface DesignCanvasProps {
  design: Design;
  selectedComponentId: string | null;
  onSelectComponent: (componentId: string | null) => void;
  /** Re-space the graph with the standard layout instead of stored positions. */
  tidyLayout?: boolean;
  /** When set, the canvas is editable and reports every change back. */
  onChange?: (design: Design) => void;
}

/**
 * The node graph of a design: pan, zoom and click to select.
 *
 * Passing `onChange` makes it editable: components can be dragged, connected
 * and deleted, and every change is reported as a whole new design (the page
 * decides when to save it as a version).
 */
export function DesignCanvas(props: DesignCanvasProps) {
  // The provider lets a child use React Flow's viewport API (see FitViewOnResize).
  return (
    <ReactFlowProvider>
      <DesignCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

/**
 * Re-frames the diagram when components are added or removed, so a newly added
 * box can't be created outside the visible area.
 */
function FitViewOnResize({ componentCount }: { componentCount: number }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    // Wait a frame so the new node is measured before framing it.
    const timer = setTimeout(() => {
      void fitView({ padding: 0.12, maxZoom: 1, minZoom: 0.6, duration: 200 });
    }, 50);
    return () => {
      clearTimeout(timer);
    };
  }, [componentCount, fitView]);

  return null;
}

function DesignCanvasInner({
  design,
  selectedComponentId,
  onSelectComponent,
  tidyLayout = false,
  onChange,
}: DesignCanvasProps) {
  const editable = onChange !== undefined;
  // Designs generated before the layout was tightened keep their old positions;
  // "Tidy layout" re-runs the very same function the server uses.
  const laidOut = useMemo(() => {
    if (!tidyLayout) return design;
    const positions = layoutComponents(design.components);
    return {
      ...design,
      components: design.components.map((component) => ({
        ...component,
        position: positions[component.id] ?? component.position,
      })),
    };
  }, [design, tidyLayout]);

  const { nodes, edges } = useMemo(() => designToFlow(laidOut), [laidOut]);

  const nodesWithSelection = useMemo<CanvasNode[]>(
    () => nodes.map((node) => ({ ...node, selected: node.id === selectedComponentId })),
    [nodes, selectedComponentId],
  );

  const handleNodeClick: NodeMouseHandler<CanvasNode> = (_event, node) => {
    // Lane captions are decoration: clicking one should not select anything.
    if (isDesignNode(node)) onSelectComponent(node.id);
  };

  /** A drag finishing is one edit; dragging in progress is not reported. */
  const handleNodeDragStop: OnNodeDrag<CanvasNode> = (_event, node) => {
    if (!onChange || !isDesignNode(node)) return;
    onChange(
      moveComponent(design, node.id, {
        x: Math.round(node.position.x),
        y: Math.round(node.position.y),
      }),
    );
  };

  const handleConnect: OnConnect = (connection) => {
    if (!onChange || !connection.source || !connection.target) return;
    onChange(connectComponents(design, connection.source, connection.target));
  };

  const handleEdgesDelete = (deleted: DesignFlowEdge[]) => {
    if (!onChange) return;
    onChange(deleted.reduce((current, edge) => removeConnection(current, edge.id), design));
  };

  const handleNodesDelete = (deleted: CanvasNode[]) => {
    if (!onChange) return;
    const ids = deleted.filter(isDesignNode).map((node) => node.id);
    onChange(ids.reduce((current, id) => removeComponent(current, id), design));
  };

  return (
    <ReactFlow<CanvasNode, DesignFlowEdge>
      nodes={nodesWithSelection}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={handleNodeClick}
      onNodeDragStop={handleNodeDragStop}
      onConnect={handleConnect}
      onEdgesDelete={handleEdgesDelete}
      onNodesDelete={handleNodesDelete}
      onPaneClick={() => {
        onSelectComponent(null);
      }}
      nodesDraggable={editable}
      nodesConnectable={editable}
      elementsSelectable
      edgesFocusable={editable}
      deleteKeyCode={editable ? ['Backspace', 'Delete'] : null}
      fitView
      // Never zoom in past 1 (boxes look clumsy) nor below 0.6 (text unreadable):
      // a large design opens scrollable rather than shrunk to nothing.
      fitViewOptions={{ padding: 0.12, maxZoom: 1, minZoom: 0.6 }}
      minZoom={0.3}
      maxZoom={1.75}
      proOptions={{ hideAttribution: false }}
      colorMode="dark"
      className="bg-canvas-grid"
      aria-label="Design diagram"
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1e212c" />
      <Controls showInteractive={false} className="bg-elevated! shadow-none!" />
      <FitViewOnResize componentCount={design.components.length} />
    </ReactFlow>
  );
}
