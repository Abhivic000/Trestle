import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { paths } from '@/lib/paths';

export function NotFoundPage() {
  return (
    <main className="bg-blueprint flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <title>Page not found · Trestle</title>
      <p className="font-mono text-sm text-brand">404: NO ROUTE</p>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">This page isn't on the blueprint.</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        The page you're looking for doesn't exist or has moved.
      </p>
      <Button asChild size="lg" className="mt-8 font-semibold">
        <Link to={paths.home}>Back to home</Link>
      </Button>
    </main>
  );
}
