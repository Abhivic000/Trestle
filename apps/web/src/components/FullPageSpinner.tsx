import { LoaderCircle } from 'lucide-react';

export function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status">
      <LoaderCircle className="size-6 animate-spin text-brand" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
