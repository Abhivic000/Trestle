import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { paths } from '@/lib/paths';
import { useAuth } from './useAuth';

/** Where to return after signing in, carried in router location state. */
export interface RedirectState {
  from?: string;
}

/** Renders child routes only for signed-in users; otherwise sends them to /login. */
export function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;
  if (!session) {
    const state: RedirectState = { from: location.pathname + location.search };
    return <Navigate to={paths.login} replace state={state} />;
  }
  return <Outlet />;
}

/** For /login and /signup: signed-in users go straight to their designs. */
export function RedirectIfAuthenticated() {
  const { session, loading } = useAuth();

  if (loading) return <FullPageSpinner />;
  if (session) return <Navigate to={paths.designs} replace />;
  return <Outlet />;
}
