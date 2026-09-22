import { useId } from 'react';
import { cn } from '@/lib/utils';

interface LogoMarkProps {
  className?: string;
}

/** The Trestle mark: a trestle/peak glyph on an indigo tile. */
export function LogoMark({ className }: LogoMarkProps) {
  // Unique gradient id so several logos on one page don't clash.
  const gradientId = useId();
  return (
    <svg viewBox="0 0 26 26" fill="none" aria-hidden="true" className={cn('size-6.5', className)}>
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="0"
          x2="26"
          y2="26"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#6C5CE7" />
          <stop offset="1" stopColor="#4C3FD1" />
        </linearGradient>
      </defs>
      <rect width="26" height="26" rx="7" fill={`url(#${gradientId})`} />
      <path
        d="M6 18 L13 8 L20 18"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  markClassName?: string;
}

export function Logo({ className, markClassName }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 font-bold tracking-tight', className)}>
      <LogoMark className={markClassName} />
      Trestle
    </span>
  );
}
