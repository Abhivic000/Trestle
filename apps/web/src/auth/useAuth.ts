import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from './auth-context';

/** Current auth state and actions. Must be used inside <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return value;
}
