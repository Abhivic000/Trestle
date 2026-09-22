import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

export interface SignUpResult {
  /** True when the project requires email confirmation before the first sign-in. */
  needsEmailConfirmation: boolean;
}

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** True until the stored session (if any) has been loaded on startup. */
  loading: boolean;
  /** Throws an Error with a user-facing message on failure. */
  signIn: (email: string, password: string) => Promise<void>;
  /** Throws an Error with a user-facing message on failure. */
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
