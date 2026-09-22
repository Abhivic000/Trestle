import { paths } from '@/lib/paths';

/** Where to return after signing in, carried in router location state. */
export interface RedirectState {
  from?: string;
}

/** Where a user should land right after signing in. */
export function postSignInPath(state: unknown): string {
  return (state as RedirectState | null)?.from ?? paths.designs;
}
