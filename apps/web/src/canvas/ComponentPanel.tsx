import { useState } from 'react';
import type { CapacityEstimate, DesignComponent } from '@trestle/shared';
import { ShieldAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ComparePanel } from './ComparePanel';
import { componentKindStyles } from './component-kinds';
import { CostPanel } from './CostPanel';
import { TechnologyBadge } from './TechnologyBadge';

interface ComponentPanelProps {
  component: DesignComponent | null;
  /** Needed to look up comparisons for the selected component. */
  projectId?: string;
  /** Traffic and cost for the whole design; the Cost tab picks out this component. */
  capacity?: CapacityEstimate | null;
  /** When set, the name and technology become editable. */
  onRename?: (componentId: string, changes: { label?: string; technology?: string }) => void;
}

/** Side panel: why a component is there, how real systems do it, what it costs. */
export function ComponentPanel({
  component,
  projectId,
  capacity = null,
  onRename,
}: ComponentPanelProps) {
  // Tracked so the Compare tab only searches the library once it is opened.
  const [tab, setTab] = useState('rationale');

  if (!component) {
    return (
      <div className="flex h-full flex-col">
        <PanelTabs disabled />
        <p className="p-5 text-sm text-tertiary">Select a component to see its details.</p>
      </div>
    );
  }

  const { icon: Icon, label: kindLabel } = componentKindStyles[component.kind];

  return (
    <Tabs value={tab} onValueChange={setTab} className="flex h-full min-h-0 flex-col gap-0">
      <TabsList className="grid w-full shrink-0 grid-cols-3 rounded-none border-b border-subtle bg-transparent p-0">
        {['Rationale', 'Compare', 'Cost'].map((tab) => (
          <TabsTrigger
            key={tab}
            value={tab.toLowerCase()}
            className="rounded-none border-0 border-b-2 border-transparent py-3.5 text-xs data-[state=active]:border-brand data-[state=active]:bg-transparent"
          >
            {tab}
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <TabsContent value="rationale" className="p-5">
          <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-tertiary uppercase">
            <Icon className="size-3.5" aria-hidden="true" />
            {kindLabel}
          </div>
          {onRename ? (
            <div className="mt-1 flex flex-col gap-2">
              <Input
                aria-label="Component name"
                value={component.label}
                onChange={(event) => {
                  onRename(component.id, { label: event.target.value });
                }}
                className="h-8 text-[15px] font-semibold"
              />
              <Input
                aria-label="Technology"
                value={component.technology ?? ''}
                placeholder="Technology (optional)"
                onChange={(event) => {
                  onRename(component.id, { technology: event.target.value });
                }}
                className="h-8 font-mono text-xs"
              />
            </div>
          ) : (
            <>
              <h2 className="mt-1 text-[15px] font-semibold">{component.label}</h2>
              {component.technology && (
                <TechnologyBadge technology={component.technology} className="mt-1.5 py-1" />
              )}
            </>
          )}
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {component.responsibility}
          </p>

          <Section title="Why this component">
            <p className="text-[13px] leading-relaxed text-[#d9dae3]">{component.rationale}</p>
            {component.sources.length === 0 && (
              <p className="mt-2.5 flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-2 text-[11px] text-warning">
                <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                Ungrounded: not yet traced to a source in the reference library.
              </p>
            )}
          </Section>

          {component.alternatives.length > 0 && (
            <Section title="Alternatives considered">
              <ul className="flex flex-col gap-2.5">
                {component.alternatives.map((alternative) => (
                  <li key={alternative.option} className="rounded-md border bg-elevated p-2.5">
                    <p className="text-[12.5px] font-medium">{alternative.option}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                      {alternative.whyNot}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {component.tradeoffs.length > 0 && (
            <Section title="Tradeoffs">
              <ul className="flex flex-col gap-1.5">
                {component.tradeoffs.map((tradeoff) => (
                  <li key={tradeoff} className="flex gap-2 text-[12.5px] text-[#d9dae3]">
                    <span aria-hidden="true" className="font-mono text-brand">
                      —
                    </span>
                    {tradeoff}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </TabsContent>

        <TabsContent value="compare">
          <ComparePanel
            projectId={projectId}
            componentId={component.id}
            active={tab === 'compare'}
          />
        </TabsContent>
        <TabsContent value="cost">
          <CostPanel capacity={capacity?.byComponentId[component.id] ?? null} estimate={capacity} />
        </TabsContent>
      </div>
    </Tabs>
  );
}

function PanelTabs({ disabled }: { disabled?: boolean }) {
  return (
    <div
      aria-hidden={disabled}
      className="flex shrink-0 border-b border-subtle text-xs font-medium text-tertiary"
    >
      {['Rationale', 'Compare', 'Cost'].map((tab) => (
        <span key={tab} className="flex-1 py-3.5 text-center">
          {tab}
        </span>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 font-mono text-[10px] tracking-wide text-tertiary uppercase">{title}</h3>
      {children}
    </section>
  );
}
