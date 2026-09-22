import { useState } from 'react';
import { History, Info, LoaderCircle, Monitor } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { ComponentPanel } from '@/canvas/ComponentPanel';
import { DesignCanvas } from '@/canvas/DesignCanvas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { paths } from '@/lib/paths';
import { useProject } from '@/lib/queries';

/**
 * The design canvas screen: diagram on the left, details on the right, add-on
 * prompt along the bottom. Editing (6.5) and change requests (6.6) come later.
 */
export function DesignCanvasPage() {
  const { designId } = useParams();
  const { data: project, isPending, error } = useProject(designId);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);

  const design = project?.currentVersion.design;
  const selectedComponent =
    design?.components.find((component) => component.id === selectedComponentId) ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <title>{project ? `${project.name} · Trestle` : 'Design · Trestle'}</title>

      <div className="flex items-center gap-2 border-b border-warning/20 bg-warning/10 px-4 py-2 text-xs text-warning md:hidden">
        <Monitor className="size-3.5" aria-hidden="true" />
        The design canvas works best on a larger screen.
      </div>

      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-subtle px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-[13px] font-medium">{project?.name ?? 'Design'}</p>
          {project && (
            <span className="font-mono text-xs text-tertiary">
              v{project.currentVersion.versionNumber}
            </span>
          )}
          {design?.origin === 'placeholder' && (
            <span className="hidden items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] text-warning sm:inline-flex">
              <Info className="size-3" aria-hidden="true" />
              Placeholder design
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" disabled title="Coming soon">
          <History data-icon="inline-start" />
          Version history
        </Button>
      </div>

      {/* Below lg the panel stacks under the canvas, so selecting a box still
          shows its details instead of appearing to do nothing. */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section aria-label="Design canvas" className="relative min-h-75 min-w-0 flex-1 lg:min-h-0">
          {isPending && (
            <div className="bg-canvas-grid flex h-full items-center justify-center" role="status">
              <LoaderCircle className="size-6 animate-spin text-brand" aria-hidden="true" />
              <span className="sr-only">Loading design…</span>
            </div>
          )}

          {error && (
            <div className="bg-canvas-grid flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <p role="alert" className="text-sm text-danger">
                {error.message}
              </p>
              <Button asChild variant="outline">
                <Link to={paths.designs}>Back to my designs</Link>
              </Button>
            </div>
          )}

          {design && (
            <>
              <DesignCanvas
                design={design}
                selectedComponentId={selectedComponentId}
                onSelectComponent={setSelectedComponentId}
              />
              <p className="pointer-events-none absolute top-3 left-3 z-10 max-w-md rounded-lg border bg-background/85 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground backdrop-blur-sm">
                {design.summary}
              </p>
            </>
          )}
        </section>

        <aside
          aria-label="Component details"
          className="flex max-h-90 shrink-0 flex-col overflow-hidden border-t border-subtle bg-surface lg:max-h-none lg:w-85 lg:border-t-0 lg:border-l"
        >
          <ComponentPanel component={selectedComponent} />
        </aside>
      </div>

      <div className="flex shrink-0 items-center gap-2.5 border-t border-subtle px-4 py-3.5 sm:px-6">
        <span className="hidden shrink-0 rounded-full bg-brand-subtle px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-brand-soft sm:inline">
          ✦ Add-on
        </span>
        <Input
          aria-label="Describe a change"
          placeholder='Ask for a change, e.g. "add live chat between users"'
          disabled
          title="Coming soon"
          className="h-10"
        />
        <Button size="lg" disabled className="h-10" title="Coming soon">
          Suggest
        </Button>
      </div>
    </div>
  );
}
