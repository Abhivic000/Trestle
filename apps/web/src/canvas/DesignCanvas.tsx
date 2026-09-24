import { useMemo } from 'react';
import { layoutComponents, type Design } from '@trestle/shared';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { DesignEdge } from './DesignEdge';
import { DesignNode } from './DesignNode';
import { LaneHeader } from './LaneHeader';
import { designToFlow, isDesignNode, type CanvasNode, type DesignFlowEdge } from './design-to-flow';

const nodeTypes = { designComponent: DesignNode, laneHeader: LaneHeader };
const edgeTypes = { design: DesignEdge };

interface DesignCanvasProps {
  design: Design;
  selectedComponentId: string | null;
  onSelectComponent: (componentId: string | null) => void;
  /** Re-space the graph with the standard layout instead of stored positions. */
  tidyLayout?: boolean;
}

/**
 * Read-only node graph of a design: pan, zoom and click to select.
 * Moving, adding and connecting components arrives in step 6.5.
 */
export function DesignCanvas({
  design,
  selectedComponentId,
  onSelectComponent,
  tidyLayout = false,
}: DesignCanvasProps) {
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

  return (
    <ReactFlow<CanvasNode, DesignFlowEdge>
      nodes={nodesWithSelection}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={handleNodeClick}
      onPaneClick={() => {
        onSelectComponent(null);
      }}
      nodesDraggable={false}
      nodesConnectable={false}
      edgesFocusable={false}
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
    </ReactFlow>
  );
}
