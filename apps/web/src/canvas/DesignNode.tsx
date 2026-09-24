import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { componentKindStyles } from './component-kinds';
import type { DesignFlowNode } from './design-to-flow';
import { TechnologyBadge } from './TechnologyBadge';

/** Width must match NODE_WIDTH in the server-side layout so columns line up. */
export const NODE_WIDTH = 216;

/** One box on the canvas. Dashed amber styling marks a proposed change (step 6.6). */
export function DesignNode({ data, selected }: NodeProps<DesignFlowNode>) {
  const { component, status } = data;
  const { icon: Icon, label: kindLabel, accent } = componentKindStyles[component.kind];
  const proposed = status !== 'unchanged';

  return (
    <div
      style={{ width: NODE_WIDTH }}
      title={`${component.label}${component.technology ? ` Â· ${component.technology}` : ''}`}
      className={cn(
        'rounded-[10px] border bg-elevated px-3 py-2.5 text-left transition-colors',
        selected && 'border-brand ring-3 ring-brand-subtle',
        proposed && 'border-dashed border-warning bg-[#2a230f]',
        status === 'removed' && 'opacity-60',
      )}
      data-status={status}
    >
      {/* Connection points. Dragging and connecting arrive in step 6.5. */}
      <Handle
        type="target"
        position={Position.Left}
        className="size-1.5! border-0! bg-[#3a3f55]!"
      />

      <div className="flex items-center gap-1.5">
        <Icon className={cn('size-3.5 shrink-0', accent)} aria-hidden="true" />
        <span className="truncate font-mono text-[9px] tracking-wide text-tertiary uppercase">
          {status === 'added' ? `${kindLabel} Â· proposed` : kindLabel}
        </span>
      </div>

      {/* Two lines of label rather than one truncated line: component names are long. */}
      <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug font-semibold break-words">
        {component.label}
      </p>

      {component.technology && (
        <TechnologyBadge technology={component.technology} className="mt-1.5" />
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="size-1.5! border-0! bg-[#3a3f55]!"
      />
    </div>
  );
}
