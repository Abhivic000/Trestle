import { useMemo } from 'react';
import type { Design } from '@trestle/shared';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { DesignNode } from './DesignNode';
import { designToFlow, type DesignFlowNode } from './design-to-flow';

const nodeTypes = { designComponent: DesignNode };

interface DesignCanvasProps {
  design: Design;
  selectedComponentId: string | null;
  onSelectComponent: (componentId: string | null) => void;
}

/**
 * Read-only node graph of a design: pan, zoom and click to select.
 * Moving, adding and connecting components arrives in step 6.5.
 */
export function DesignCanvas({
  design,
  selectedComponentId,
  onSelectComponent,
}: DesignCanvasProps) {
  const { nodes, edges } = useMemo(() => designToFlow(design), [design]);

  const nodesWithSelection = useMemo(
    () => nodes.map((node) => ({ ...node, selected: node.id === selectedComponentId })),
    [nodes, selectedComponentId],
  );

  const handleNodeClick: NodeMouseHandler<DesignFlowNode> = (_event, node) => {
    onSelectComponent(node.id);
  };

  return (
    <ReactFlow
      nodes={nodesWithSelection}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={handleNodeClick}
      onPaneClick={() => {
        onSelectComponent(null);
      }}
      nodesDraggable={false}
      nodesConnectable={false}
      edgesFocusable={false}
      fitView
      fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
      proOptions={{ hideAttribution: false }}
      colorMode="dark"
      className="bg-canvas-grid"
      aria-label="Design diagram"
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1e212c" />
      <Controls showInteractive={false} className="!bg-elevated !shadow-none" />
    </ReactFlow>
  );
}
