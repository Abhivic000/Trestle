import type { DesignVersionSummary } from '@trestle/shared';
import { LoaderCircle, RotateCcw, Sparkles, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SideDrawer } from '@/components/ui/side-drawer';
import { useRestoreVersion, useVersions } from '@/lib/queries';

interface VersionHistoryDrawerProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Warn before restoring over unsaved edits. */
  hasUnsavedChanges: boolean;
}

export function VersionHistoryDrawer({
  projectId,
  open,
  onOpenChange,
  hasUnsavedChanges,
}: VersionHistoryDrawerProps) {
  const { data, isPending, error } = useVersions(projectId, open);
  const restore = useRestoreVersion(projectId);

  async function handleRestore(version: DesignVersionSummary) {
    await restore.mutateAsync(version.id);
    onOpenChange(false);
  }

  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Version history"
      description="Every save is kept. Restoring brings a version back as a new one."
    >
      {isPending && (
        <div className="flex justify-center py-10" role="status">
          <LoaderCircle className="size-5 animate-spin text-brand" aria-hidden="true" />
          <span className="sr-only">Loading history…</span>
        </div>
      )}
      {error && (
        <p role="alert" className="p-5 text-sm text-danger">
          {error.message}
        </p>
      )}

      {hasUnsavedChanges && (
        <p className="border-b border-subtle bg-warning/10 px-5 py-3 text-xs text-warning">
          You have unsaved changes. Restoring a version will discard them.
        </p>
      )}

      <ul>
        {data?.versions.map((version) => (
          <li key={version.id} className="border-b border-subtle px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">
                v{version.versionNumber}
                {version.isCurrent && (
                  <span className="ml-2 rounded-full bg-brand-subtle px-2 py-0.5 text-[10px] text-brand-soft">
                    current
                  </span>
                )}
              </p>
              {!version.isCurrent && (
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={restore.isPending}
                  onClick={() => void handleRestore(version)}
                >
                  <RotateCcw data-icon="inline-start" />
                  Restore
                </Button>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {version.changeSummary ?? 'No description'}
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px] text-tertiary">
              {version.generatorModel ? (
                <>
                  <Sparkles className="size-3" aria-hidden="true" />
                  {version.generatorModel}
                </>
              ) : (
                <>
                  <User className="size-3" aria-hidden="true" />
                  edited by you
                </>
              )}
              {' · '}
              {new Date(version.createdAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>

      {restore.isError && (
        <p role="alert" className="p-5 text-sm text-danger">
          Could not restore: {restore.error.message}
        </p>
      )}
    </SideDrawer>
  );
}
