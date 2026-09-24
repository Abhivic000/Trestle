import { cn } from '@/lib/utils';
import { findTechnologyIcon } from './technology-icons';

interface TechnologyBadgeProps {
  technology: string;
  className?: string;
  iconOnly?: boolean;
}

/** The technology a component uses, with its brand mark when we recognise it. */
export function TechnologyBadge({ technology, className, iconOnly }: TechnologyBadgeProps) {
  const icon = findTechnologyIcon(technology);

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-md border bg-background/60 px-1.5 py-0.5',
        className,
      )}
      title={technology}
    >
      {icon ? (
        <svg
          viewBox="0 0 24 24"
          role="img"
          aria-label={icon.title}
          className="size-3 shrink-0"
          fill={`#${icon.hex}`}
        >
          <path d={icon.path} />
        </svg>
      ) : null}
      {!iconOnly && (
        <span className="font-mono text-[10px] leading-snug break-words text-muted-foreground">
          {technology}
        </span>
      )}
    </span>
  );
}
