import { Network, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { paths } from '@/lib/paths';

export function DesignsPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <title>My designs · Trestle</title>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">My designs</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every design keeps its full version history.
            </p>
          </div>
          <Button asChild size="lg" className="font-semibold">
            <Link to={paths.newDesign}>
              <Plus data-icon="inline-start" />
              New design
            </Link>
          </Button>
        </div>

        {/* Empty state. The real list comes from the API in the main feature phase. */}
        <div className="bg-blueprint mt-10 flex flex-col items-center rounded-2xl border border-dashed px-6 py-16 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-brand-subtle text-brand-soft">
            <Network className="size-5" aria-hidden="true" />
          </span>
          <h2 className="mt-5 font-semibold">No designs yet</h2>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            Describe a project and Trestle will generate your first architecture.
          </p>
          <Button asChild variant="outline" size="lg" className="mt-6">
            <Link to={paths.newDesign}>Start a new design</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
