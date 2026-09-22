import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Static, decorative illustrations of the product for the landing page.
// They are hidden from screen readers; the copy beside each one explains it.

const NODE_WIDTH = 150;
const NODE_HEIGHT = 56;

export interface MiniNode {
  id: string;
  type: 'service' | 'data' | 'infra';
  label: string;
  x: number;
  y: number;
  state?: 'selected' | 'pending';
}

export interface MiniEdge {
  from: string;
  to: string;
}

interface MiniCanvasProps {
  nodes: MiniNode[];
  edges: MiniEdge[];
  width: number;
  height: number;
}

/** A tiny fixed-size node graph: boxes plus curved connectors between them. */
export function MiniCanvas({ nodes, edges, width, height }: MiniCanvasProps) {
  const byId = new Map(nodes.map((node) => [node.id, node]));

  return (
    <div className="relative shrink-0" style={{ width, height }}>
      <svg className="pointer-events-none absolute inset-0" width={width} height={height}>
        {edges.map(({ from, to }) => {
          const a = byId.get(from);
          const b = byId.get(to);
          if (!a || !b) return null;
          const x1 = a.x + NODE_WIDTH;
          const y1 = a.y + NODE_HEIGHT / 2;
          const x2 = b.x;
          const y2 = b.y + NODE_HEIGHT / 2;
          const midX = (x1 + x2) / 2;
          const pending = a.state === 'pending' || b.state === 'pending';
          return (
            <path
              key={`${from}-${to}`}
              d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
              fill="none"
              strokeWidth={1.5}
              className={pending ? 'stroke-warning' : 'stroke-[#2b2f3e]'}
              strokeDasharray={pending ? '4 4' : undefined}
            />
          );
        })}
      </svg>
      {nodes.map((node) => (
        <div
          key={node.id}
          className={cn(
            'absolute rounded-[9px] border bg-elevated px-3 py-2.5',
            node.state === 'selected' && 'border-brand ring-3 ring-brand-subtle',
            node.state === 'pending' && 'border-dashed border-warning bg-[#2a230f]',
          )}
          style={{ left: node.x, top: node.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
        >
          <div className="font-mono text-[9px] tracking-wide text-tertiary uppercase">
            {node.state === 'pending' ? `${node.type} · proposed` : node.type}
          </div>
          <div className="mt-0.5 truncate text-[12.5px] font-semibold">{node.label}</div>
        </div>
      ))}
    </div>
  );
}

interface WindowFrameProps {
  children: ReactNode;
  className?: string;
  /** Small label in the title bar, e.g. "Example". */
  label?: string;
}

/** A fake app window (traffic-light dots + title bar) around a mockup. */
export function WindowFrame({ children, className, label }: WindowFrameProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'overflow-hidden rounded-2xl border bg-elevated shadow-[0_30px_70px_-20px_rgb(0_0_0/0.5)]',
        className,
      )}
    >
      <div className="flex h-8 items-center gap-1.5 border-b border-subtle bg-[#0e1016] px-3">
        <span className="size-2.5 rounded-full bg-danger" />
        <span className="size-2.5 rounded-full bg-warning" />
        <span className="size-2.5 rounded-full bg-success" />
        {label && (
          <span className="ml-auto font-mono text-[10px] tracking-wide text-tertiary uppercase">
            {label}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

interface PanelMockProps {
  title: string;
  body: string;
  alternative: string;
  /** Always sit below the canvas instead of beside it (for narrow containers). */
  stacked?: boolean;
}

/** The canvas side panel showing a component's rationale. */
export function RationalePanelMock({ title, body, alternative, stacked }: PanelMockProps) {
  return (
    <div
      className={cn(
        'w-full shrink-0 border-t border-subtle bg-surface p-5',
        !stacked && 'md:w-64 md:border-t-0 md:border-l',
      )}
    >
      <div className="mb-4 flex gap-4 border-b border-subtle pb-2.5 text-[11px] text-tertiary">
        <span className="font-semibold text-foreground">Rationale</span>
        <span>Compare</span>
        <span>Cost</span>
      </div>
      <h4 className="mb-1.5 text-[13px] font-semibold">{title}</h4>
      <p className="text-[11.5px] leading-relaxed text-muted-foreground">{body}</p>
      <span className="mt-3 inline-block rounded-md border bg-elevated px-2 py-0.5 text-[10px] text-muted-foreground">
        Alt: {alternative}
      </span>
    </div>
  );
}

export function DiffMock() {
  return (
    <WindowFrame label="Example">
      <div className="flex flex-col gap-2.5 p-5">
        <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2.5 text-[12.5px] text-muted-foreground">
          <span className="text-brand-soft">✦</span> "add live chat between users"
        </div>
        {[
          ['Proposed:', 'Live Chat Service', 'new node, connects to API Gateway'],
          ['Also touches:', 'Notification Service', 'new event route for messages'],
        ].map(([prefix, name, detail]) => (
          <div
            key={name}
            className="flex items-center gap-2.5 rounded-lg border border-dashed border-warning bg-warning/7 p-3 text-[12.5px]"
          >
            <span className="size-2 shrink-0 rounded-full bg-warning" />
            <span>
              {prefix} <b className="font-semibold">{name}</b>: {detail}
            </span>
          </div>
        ))}
        <div className="mt-1 flex justify-end gap-2 text-xs font-semibold">
          <span className="rounded-md border bg-elevated-2 px-3.5 py-1.5 text-muted-foreground">
            Reject
          </span>
          <span className="rounded-md bg-brand px-3.5 py-1.5 text-white">Accept &amp; save</span>
        </div>
      </div>
    </WindowFrame>
  );
}

export function GroundingMock() {
  const sources = [
    ['DB', 'Sharding strategies: distributed systems reference'],
    ['◐', 'Caching hot content at scale: streaming platforms'],
    ['⇄', 'Event decoupling with message queues'],
  ];
  return (
    <WindowFrame label="Example">
      <div className="flex flex-col gap-3 p-5">
        {sources.map(([icon, text]) => (
          <div
            key={text}
            className="flex items-center gap-2.5 rounded-lg border bg-background px-3 py-2.5"
          >
            <span className="flex size-5.5 shrink-0 items-center justify-center rounded-[5px] bg-brand-subtle font-mono text-[10px] text-brand-soft">
              {icon}
            </span>
            <span className="text-xs text-[#d4d6e0]">{text}</span>
            <span className="ml-auto rounded bg-elevated-2 px-1.5 py-0.5 font-mono text-[9px] text-tertiary">
              PATTERN
            </span>
          </div>
        ))}
        <div className="mt-1 rounded-lg border bg-background p-3.5">
          <div className="mb-1 text-[12.5px] font-semibold">How a large music platform does it</div>
          <div className="text-[11.5px] leading-relaxed text-muted-foreground">
            Separates catalog metadata from playback so each can be cached and scaled on its own.
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}

export function CostMock() {
  const rows = [
    ['CDN (egress)', '$1,200/mo'],
    ['Playback Service', '$230/mo'],
    ['Postgres (sharded)', '$340/mo'],
    ['Redis Cache', '$140/mo'],
  ];
  return (
    <WindowFrame label="Example estimate">
      <div className="p-5">
        {rows.map(([name, cost]) => (
          <div
            key={name}
            className="flex justify-between border-b border-subtle py-2.5 text-[13px] last:border-b-0"
          >
            <span>{name}</span>
            <span className="font-mono text-xs text-muted-foreground">{cost}</span>
          </div>
        ))}
        <div className="mt-1.5 flex justify-between border-t pt-3.5 text-[13px] font-semibold">
          <span>Total at 500K daily users</span>
          <span className="font-mono">$1,910/mo</span>
        </div>
        <div className="mt-3.5 rounded-lg border border-danger/30 bg-danger/9 px-3 py-2.5 text-[11.5px] leading-relaxed text-[#f5a0a7]">
          ⚠ At 10x traffic, Playback Service becomes a bottleneck. Plan for regional splitting and
          auto-scaling.
        </div>
      </div>
    </WindowFrame>
  );
}
