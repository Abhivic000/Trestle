import type { CorpusSearchResult } from '@trestle/shared';
import { ExternalLink, LoaderCircle, Library } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { useComponentComparisons } from '@/lib/queries';

interface ComparePanelProps {
  projectId: string | undefined;
  componentId: string;
  /** Only fetch once the tab is actually open. */
  active: boolean;
}

/**
 * "How do real systems solve this?" for one component.
 *
 * Everything here comes from the curated reference library, never from the
 * model: claims about named companies have to be traceable to a write-up.
 */
export function ComparePanel({ projectId, componentId, active }: ComparePanelProps) {
  const { data, isPending, isFetching, error } = useComponentComparisons(
    projectId,
    componentId,
    active,
  );

  // A component that only exists in an unsaved edit or a pending proposal is
  // not on the server yet, so there is nothing to look it up against.
  if (error instanceof ApiError && error.status === 404) {
    return (
      <Note>
        Save this component first, then Trestle can compare it with real systems in the reference
        library.
      </Note>
    );
  }

  if (error) return <Note>Could not load comparisons: {error.message}</Note>;

  if (isPending || isFetching) {
    return (
      <div className="flex items-center gap-2 p-5 text-sm text-tertiary" role="status">
        <LoaderCircle className="size-4 animate-spin text-brand" aria-hidden="true" />
        Searching the reference library…
      </div>
    );
  }

  if (data.comparisons.length === 0) {
    return (
      <Note>
        No close match in the reference library yet. Comparisons are hand-written summaries of
        public engineering write-ups, so this stays empty rather than guessing.
      </Note>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-tertiary">
        <Library className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        How comparable systems solved this, summarised from public engineering write-ups.
      </p>
      {data.comparisons.map((entry) => (
        <ComparisonCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

function ComparisonCard({ entry }: { entry: CorpusSearchResult }) {
  return (
    <article className="rounded-lg border bg-elevated p-3.5">
      <h3 className="text-[13px] leading-snug font-semibold">{entry.title}</h3>
      <p className="mt-2 text-[12.5px] leading-relaxed text-[#d9dae3]">{entry.summary}</p>

      <dl className="mt-3 flex flex-col gap-2">
        <Fit label="Fits when" value={entry.whenToUse} />
        <Fit label="Not when" value={entry.whenNotToUse} />
      </dl>

      <h4 className="mt-3 mb-1.5 font-mono text-[10px] tracking-wide text-tertiary uppercase">
        Tradeoffs
      </h4>
      <ul className="flex flex-col gap-1.5">
        {entry.tradeoffs.map((tradeoff) => (
          <li key={tradeoff} className="flex gap-2 text-[12px] leading-relaxed text-[#d9dae3]">
            <span aria-hidden="true" className="font-mono text-brand">
              —
            </span>
            {tradeoff}
          </li>
        ))}
      </ul>

      <footer className="mt-3 border-t border-subtle pt-2.5">
        <p className="text-[11px] leading-relaxed text-tertiary">{entry.sourceNote}</p>
        {entry.sourceUrl && (
          <a
            href={entry.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-brand-soft hover:underline"
          >
            Read the original
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        )}
      </footer>
    </article>
  );
}

function Fit({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-16 shrink-0 font-mono text-[10px] tracking-wide text-tertiary uppercase">
        {label}
      </dt>
      <dd className="flex-1 text-[12px] leading-relaxed text-muted-foreground">{value}</dd>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="p-5 text-sm leading-relaxed text-tertiary">{children}</p>;
}
