import { useEffect, useState } from 'react';
import type { Design } from '@trestle/shared';
import { History, Info, LayoutGrid, LoaderCircle, Monitor, Plus, Undo2 } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { ComponentPanel } from '@/canvas/ComponentPanel';
import { DesignCanvas } from '@/canvas/DesignCanvas';
import { addComponent, updateComponent, type NewComponentInput } from '@/canvas/design-edits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { paths } from '@/lib/paths';
import { useProject, useSaveEdits } from '@/lib/queries';
import { AddComponentDialog } from './AddComponentDialog';
import { VersionHistoryDrawer } from './VersionHistoryDrawer';

/**
 * The design canvas screen: diagram, details panel, editing toolbar and the
 * add-on prompt (wired up in step 6.6).
 *
 * Edits are kept locally until Save, which writes a new immutable version.
 */
export function DesignCanvasPage() {
  const { designId } = useParams();
  const { data: project, isPending, error } = useProject(designId);
  const saveEdits = useSaveEdits(designId);

  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [tidyLayout, setTidyLayout] = useState(false);
  // The draft carries the version it was based on, so a save or a restore
  // (which changes the current version) automatically retires it. No effect needed.
  const [draft, setDraft] = useState<{ versionId: string; design: Design } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const currentVersionId = project?.currentVersion.id;
  const saved = project?.currentVersion.design ?? null;
  const liveDraft = draft && draft.versionId === currentVersionId ? draft : null;
  const design = liveDraft?.design ?? saved;
  const hasUnsavedChanges = liveDraft !== null;

  function editDesign(next: Design) {
    if (!currentVersionId) return;
    setDraft({ versionId: currentVersionId, design: next });
  }

  // Leaving with unsaved edits should not be silent.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
    };
  }, [hasUnsavedChanges]);

  const selectedComponent =
    design?.components.find((component) => component.id === selectedComponentId) ?? null;

  function handleAdd(input: NewComponentInput) {
    if (!design) return;
    const next = addComponent(design, input);
    editDesign(next);
    setSelectedComponentId(next.components.at(-1)?.id ?? null);
  }

  function handleRename(componentId: string, changes: { label?: string; technology?: string }) {
    if (!design) return;
    editDesign(updateComponent(design, componentId, changes));
  }

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
          {hasUnsavedChanges && (
            <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] text-warning">
              <Info className="size-3" aria-hidden="true" />
              Unsaved changes
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {design && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAddOpen(true);
                }}
              >
                <Plus data-icon="inline-start" />
                Add
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTidyLayout((value) => !value);
                }}
                aria-pressed={tidyLayout}
                title="Re-space the diagram using the standard layout"
              >
                <LayoutGrid data-icon="inline-start" />
                {tidyLayout ? 'Original layout' : 'Tidy layout'}
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setHistoryOpen(true);
            }}
            disabled={!project}
          >
            <History data-icon="inline-start" />
            Version history
          </Button>

          {hasUnsavedChanges && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(null);
                }}
                disabled={saveEdits.isPending}
              >
                <Undo2 data-icon="inline-start" />
                Discard
              </Button>
              <Button
                size="sm"
                className="font-semibold"
                disabled={saveEdits.isPending}
                onClick={() => {
                  if (liveDraft) void saveEdits.mutateAsync(liveDraft.design);
                }}
              >
                {saveEdits.isPending ? 'Saving…' : 'Save version'}
              </Button>
            </>
          )}
        </div>
      </div>

      {saveEdits.isError && (
        <p role="alert" className="bg-danger/10 px-4 py-2 text-xs text-danger sm:px-6">
          Could not save: {saveEdits.error.message}
        </p>
      )}

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
                tidyLayout={tidyLayout}
                onChange={editDesign}
              />
              <p className="pointer-events-none absolute top-3 left-3 z-10 max-w-md rounded-lg border bg-background/85 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground backdrop-blur-sm">
                {design.summary}
              </p>
              <p className="pointer-events-none absolute right-3 bottom-3 z-10 rounded-md border bg-background/85 px-2 py-1 font-mono text-[10px] text-tertiary backdrop-blur-sm">
                drag to move · drag a dot to connect · Delete to remove
              </p>
            </>
          )}
        </section>

        <aside
          aria-label="Component details"
          className="flex max-h-90 shrink-0 flex-col overflow-hidden border-t border-subtle bg-surface lg:max-h-none lg:w-85 lg:border-t-0 lg:border-l"
        >
          <ComponentPanel
            component={selectedComponent}
            onRename={selectedComponent ? handleRename : undefined}
          />
        </aside>
      </div>

      <div className="flex shrink-0 items-center gap-2.5 border-t border-subtle px-4 py-3.5 sm:px-6">
        <span className="hidden shrink-0 rounded-full bg-brand-subtle px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-brand-soft sm:inline">
          âœ¦ Add-on
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

      <AddComponentDialog open={addOpen} onOpenChange={setAddOpen} onAdd={handleAdd} />
      {designId && (
        <VersionHistoryDrawer
          projectId={designId}
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          hasUnsavedChanges={hasUnsavedChanges}
        />
      )}
    </div>
  );
}
