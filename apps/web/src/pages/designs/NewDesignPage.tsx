import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { paths } from '@/lib/paths';

export function NewDesignPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <title>New design · Trestle</title>
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <Button asChild variant="ghost" className="-ml-2.5 text-muted-foreground">
          <Link to={paths.designs}>
            <ArrowLeft data-icon="inline-start" />
            My designs
          </Link>
        </Button>
        <h1 className="mt-4 text-[26px] font-semibold tracking-tight">Describe your project</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The more detail you give, the more accurate and grounded your generated design will be.
        </p>

        {/* Placeholder: the requirement intake form is built in the main feature phase. */}
        <div className="mt-8 rounded-2xl border border-dashed px-6 py-12 text-center text-sm text-tertiary">
          The requirement form (project type, features, scale, priorities, budget) will live here.
        </div>
      </div>
    </div>
  );
}
