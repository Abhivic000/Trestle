import type { NodeProps } from '@xyflow/react';
import type { LaneHeaderNode } from './design-to-flow';

/** Column caption above a group of components ("Services", "Data & storage"). */
export function LaneHeader({ data }: NodeProps<LaneHeaderNode>) {
  return (
    <div className="pointer-events-none w-54 border-b border-subtle pb-1.5 font-mono text-[10px] tracking-widest text-tertiary uppercase">
      {data.title}
    </div>
  );
}
