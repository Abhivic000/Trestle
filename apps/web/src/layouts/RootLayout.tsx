import { Outlet, ScrollRestoration } from 'react-router';
import { AuthProvider } from '@/auth/AuthProvider';

/**
 * Wraps every page: provides auth state, restores scroll position on
 * back/forward and starts new pages at the top.
 */
export function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
      <ScrollRestoration />
    </AuthProvider>
  );
}
