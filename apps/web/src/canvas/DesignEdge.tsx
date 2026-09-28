import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useStore,
  type EdgeProps,
} from '@xyflow/react';
import { nearestColumnGapCentre, NODE_WIDTH } from '@trestle/shared';
import { cn } from '@/lib/utils';
import type { DesignFlowEdge } from './design-to-flow';
import { LABEL_MIN_ZOOM, maxLabelCharsForZoom, shortenEdgeLabel } from './edge-label';

/**
 * A connection between two components.
 *
 * The label is HTML rather than SVG text so it can carry a hover tooltip with
 * the full wording and disappear when the canvas is zoomed out. Its layer is
 * lifted above the nodes in `index.css`, otherwise a long label is drawn
 * underneath the boxes and only its middle shows.
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

  // The midpoint of a connection that skips a column lands on whatever sits in
  // between, so pin those labels to the middle of the nearest gap instead.
  // Connections between neighbours already end up in a gap, and ones inside a
  // single column are left alone so their label stays on the line it belongs to.
  const spansColumns = Math.abs(targetX - sourceX) > NODE_WIDTH * 1.5;
  const x = spansColumns ? nearestColumnGapCentre(labelX) : labelX;

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
              // Opaque on purpose: it may sit over a box, and must stay legible.
              proposed && 'border-warning/50 text-warning',
            )}
            style={{ transform: `translate(-50%, -50%) translate(${x}px, ${labelY}px)` }}
            title={text}
          >
            {shortenEdgeLabel(text, maxLabelCharsForZoom(zoom))}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
