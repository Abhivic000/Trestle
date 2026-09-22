import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { componentKindStyles } from './component-kinds';
import type { DesignFlowNode } from './design-to-flow';

/** One box on the canvas. Dashed amber styling marks a proposed change (step 6.6). */
export function DesignNode({ data, selected }: NodeProps<DesignFlowNode>) {
  const { component, status } = data;
  const { icon: Icon, label: kindLabel, accent } = componentKindStyles[component.kind];
  const proposed = status !== 'unchanged';

  return (
    <div
      className={cn(
        'w-45 rounded-[10px] border bg-elevated px-3.5 py-3 text-left transition-colors',
        selected && 'border-brand ring-3 ring-brand-subtle',
        proposed && 'border-dashed border-warning bg-[#2a230f]',
        status === 'removed' && 'opacity-60',
      )}
      data-status={status}
    >
      {/* Connection points. Not draggable yet: editing arrives in step 6.5. */}
      <Handle
        type="target"
        position={Position.Left}
        className="!size-1.5 !border-0 !bg-[#3a3f55]"
      />
      <div className="flex items-center gap-1.5">
        <Icon className={cn('size-3.5 shrink-0', accent)} aria-hidden="true" />
        <span className="font-mono text-[9px] tracking-wide text-tertiary uppercase">
          {status === 'added' ? `${kindLabel} · proposed` : kindLabel}
          {component.technology ? ` · ${component.technology}` : ''}
        </span>
      </div>
      <p className="mt-1 truncate text-[12.5px] font-semibold">{component.label}</p>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-1.5 !border-0 !bg-[#3a3f55]"
      />
    </div>
  );
}
