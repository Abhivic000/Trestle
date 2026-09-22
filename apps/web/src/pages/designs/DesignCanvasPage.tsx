import { type DesignComponent } from '@trestle/shared';
import { History, Info, LoaderCircle, Monitor } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { paths } from '@/lib/paths';
import { useProject } from '@/lib/queries';

/**
 * Layout of the design canvas screen. The interactive React Flow diagram, the
 * panel tabs, the diff review bar and the version drawer arrive in later steps;
 * for now the design's components are listed so the data is visible end to end.
 */
export function DesignCanvasPage() {
  const { designId } = useParams();
  const { data: project, isPending, error } = useProject(designId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <title>{project ? `${project.name} · Trestle` : 'Design · Trestle'}</title>

      <div className="flex items-center gap-2 border-b border-warning/20 bg-warning/10 px-4 py-2 text-xs text-warning md:hidden">
        <Monitor className="size-3.5" aria-hidden="true" />
        The design canvas works best on a larger screen.
      </div>

      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-subtle px-4 sm:px-6">
        <p className="truncate text-[13px] font-medium">
          {project?.name ?? 'Design'}
          {project && (
            <span className="ml-2 font-mono text-xs text-tertiary">
              v{project.currentVersion.versionNumber}
            </span>
          )}
        </p>
        <Button variant="ghost" size="sm" disabled>
          <History data-icon="inline-start" />
          Version history
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        <section aria-label="Design canvas" className="bg-canvas-grid flex-1 overflow-y-auto p-6">
          {isPending && (
            <div className="flex h-full items-center justify-center" role="status">
              <LoaderCircle className="size-6 animate-spin text-brand" aria-hidden="true" />
              <span className="sr-only">Loading design…</span>
            </div>
          )}

          {error && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <p role="alert" className="text-sm text-danger">
                {error.message}
              </p>
              <Button asChild variant="outline">
                <Link to={paths.designs}>Back to my designs</Link>
              </Button>
            </div>
          )}

          {project && (
            <div className="mx-auto max-w-3xl">
              {project.currentVersion.design.origin === 'placeholder' && (
                <p className="mb-5 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs text-warning">
                  <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  This is a generic placeholder design, not generated from your requirements yet.
                </p>
              )}
              <p className="text-sm leading-relaxed text-muted-foreground">
                {project.currentVersion.design.summary}
              </p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {project.currentVersion.design.components.map((component) => (
                  <ComponentCard key={component.id} component={component} />
                ))}
              </ul>
            </div>
          )}
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
        <span className="hidden shrink-0 rounded-full bg-brand-subtle px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-brand-soft sm:inline">
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

function ComponentCard({ component }: { component: DesignComponent }) {
  return (
    <li className="rounded-xl border bg-elevated p-4">
      <p className="font-mono text-[10px] tracking-wide text-tertiary uppercase">
        {component.kind}
        {component.technology ? ` · ${component.technology}` : ''}
      </p>
      <h2 className="mt-1 text-sm font-semibold">{component.label}</h2>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        {component.responsibility}
      </p>
    </li>
  );
}
