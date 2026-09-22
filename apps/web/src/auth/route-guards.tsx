import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { paths } from '@/lib/paths';
import { postSignInPath, type RedirectState } from './redirect';
import { useAuth } from './useAuth';

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

/**
 * For /login and /signup: signed-in users go straight on. This also fires the
 * instant a sign-in succeeds (the session updates before the form's own
 * navigation runs), so it must honour "where you came from" too.
 */
export function RedirectIfAuthenticated() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;
  if (session) return <Navigate to={postSignInPath(location.state)} replace />;
  return <Outlet />;
}
