import { History, Monitor } from 'lucide-react';
import { useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Layout skeleton of the design canvas: canvas area, side panel, add-on prompt bar.
 * The React Flow canvas, panel tabs, diff review bar and version drawer are built
 * in the main feature phase.
 */
export function DesignCanvasPage() {
  const { designId } = useParams();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <title>Design · Trestle</title>

      <div className="flex items-center gap-2 border-b border-warning/20 bg-warning/10 px-4 py-2 text-xs text-warning md:hidden">
        <Monitor className="size-3.5" aria-hidden="true" />
        The design canvas works best on a larger screen.
      </div>

      <div className="flex h-12 shrink-0 items-center justify-between border-b border-subtle px-4 sm:px-6">
        <p className="text-[13px] font-medium text-muted-foreground">
          Design <span className="font-mono text-tertiary">{designId}</span>
        </p>
        <Button variant="ghost" size="sm" disabled>
          <History data-icon="inline-start" />
          Version history
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        <section
          aria-label="Design canvas"
          className="bg-canvas-grid flex flex-1 items-center justify-center p-6"
        >
          <p className="rounded-lg border border-dashed bg-background/80 px-4 py-3 text-sm text-tertiary">
            The interactive diagram will render here.
          </p>
        </section>
        <aside
          aria-label="Component details"
          className="hidden w-85 shrink-0 flex-col border-l border-subtle bg-surface lg:flex"
        >
          <div className="flex border-b border-subtle text-xs font-medium text-tertiary">
            {['Rationale', 'Compare', 'Cost'].map((tab) => (
              <span key={tab} className="flex-1 py-3.5 text-center">
                {tab}
              </span>
            ))}
          </div>
          <p className="p-5 text-sm text-tertiary">Select a component to see its details.</p>
        </aside>
      </div>

      <div className="flex shrink-0 items-center gap-2.5 border-t border-subtle px-4 py-3.5 sm:px-6">
        <span className="hidden shrink-0 rounded-full bg-brand-subtle whitespace-nowrap px-2.5 py-1 text-[11px] font-medium text-brand-soft sm:inline">
          ✦ Add-on
        </span>
        <Input
          aria-label="Describe a change"
          placeholder='Ask for a change, e.g. "add live chat between users"'
          disabled
          className="h-10"
        />
        <Button size="lg" disabled className="h-10">
          Suggest
        </Button>
      </div>
    </div>
  );
}
