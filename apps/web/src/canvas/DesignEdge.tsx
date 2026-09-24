import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useStore,
  type EdgeProps,
} from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { DesignFlowEdge } from './design-to-flow';
import { LABEL_MIN_ZOOM, shortenEdgeLabel } from './edge-label';

/**
 * A connection between two components.
 *
 * The label is rendered as HTML rather than SVG text so it can be clipped to a
 * fixed width (long labels used to run underneath the boxes), expand on hover,
 * and disappear when the canvas is zoomed out.
 */
export function DesignEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  label,
  data,
}: EdgeProps<DesignFlowEdge>) {
  const zoom = useStore((state) => state.transform[2]);
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

  const proposed = data?.status !== undefined && data.status !== 'unchanged';
  const text = typeof label === 'string' ? label : null;

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {text && zoom >= LABEL_MIN_ZOOM && (
        <EdgeLabelRenderer>
          <div
            // `nodrag nopan` keeps the canvas from panning when the label is clicked.
            // The native title shows the full text on hover, above everything else.
            className={cn(
              'nodrag nopan pointer-events-auto absolute rounded-md border bg-surface px-1.5 py-0.5 font-mono text-[9px] whitespace-nowrap text-muted-foreground hover:bg-elevated hover:text-foreground',
              // no max-width needed: the text itself is shortened to fit the column gap
              proposed && 'border-warning/50 text-warning',
            )}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            title={text}
          >
            {shortenEdgeLabel(text)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
