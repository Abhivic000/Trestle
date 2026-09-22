import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { Button } from '@/components/ui/button';
import { paths } from '@/lib/paths';

/** Shown when a page crashes while rendering, instead of a blank screen. */
export function RouteErrorPage() {
  const error = useRouteError();
  console.error(error);

  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'An unexpected error occurred.';

  return (
    <main className="bg-blueprint flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <title>Something went wrong · Trestle</title>
      <p className="font-mono text-sm text-danger">ERROR</p>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Something went wrong.</h1>
      <p className="mt-3 max-w-md text-muted-foreground">{detail}</p>
      <Button asChild size="lg" className="mt-8 font-semibold">
        <Link to={paths.home}>Back to home</Link>
      </Button>
    </main>
  );
}
