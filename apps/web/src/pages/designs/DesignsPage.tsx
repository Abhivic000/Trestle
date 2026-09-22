import { type ProjectSummary } from '@trestle/shared';
import { LoaderCircle, Network, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { paths } from '@/lib/paths';
import { useProjects } from '@/lib/queries';

export function DesignsPage() {
  const { data, isPending, error } = useProjects();

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

        <div className="mt-10">
          {isPending && (
            <div className="flex justify-center py-16" role="status">
              <LoaderCircle className="size-6 animate-spin text-brand" aria-hidden="true" />
              <span className="sr-only">Loading your designs…</span>
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
            >
              Couldn't load your designs: {error.message}
            </p>
          )}
          {data &&
            (data.projects.length === 0 ? (
              <EmptyState />
            ) : (
              <ProjectList projects={data.projects} />
            ))}
        </div>
      </div>
    </div>
  );
}

function ProjectList({ projects }: { projects: ProjectSummary[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <li key={project.id}>
          <Link
            to={paths.design(project.id)}
            className="block rounded-2xl border bg-elevated p-5 transition-colors hover:border-[#3a3f55]"
          >
            <h2 className="truncate font-semibold">{project.name}</h2>
            <p className="mt-1 text-xs text-tertiary">
              Updated {new Date(project.updatedAt).toLocaleDateString()}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="bg-blueprint flex flex-col items-center rounded-2xl border border-dashed px-6 py-16 text-center">
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
  );
}
