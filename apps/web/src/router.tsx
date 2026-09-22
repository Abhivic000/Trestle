import { createBrowserRouter } from 'react-router';
import { RedirectIfAuthenticated, RequireAuth } from '@/auth/route-guards';
import { AppLayout } from '@/layouts/AppLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { MarketingLayout } from '@/layouts/MarketingLayout';
import { RootLayout } from '@/layouts/RootLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { SignupPage } from '@/pages/auth/SignupPage';
import { DesignCanvasPage } from '@/pages/designs/DesignCanvasPage';
import { DesignsPage } from '@/pages/designs/DesignsPage';
import { NewDesignPage } from '@/pages/designs/NewDesignPage';
import { LandingPage } from '@/pages/landing/LandingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RouteErrorPage } from '@/pages/RouteErrorPage';

// Layout routes (no `path`) wrap groups of pages in shared chrome or guards.
// Keep these patterns in sync with `lib/paths.ts`.
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <MarketingLayout />,
        children: [{ index: true, element: <LandingPage /> }],
      },
      {
        // Signed-in users skip the auth pages.
        element: <RedirectIfAuthenticated />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: 'login', element: <LoginPage /> },
              { path: 'signup', element: <SignupPage /> },
            ],
          },
        ],
      },
      {
        // Everything under /designs requires a signed-in user.
        element: <RequireAuth />,
        children: [
          {
            path: 'designs',
            element: <AppLayout />,
            children: [
              { index: true, element: <DesignsPage /> },
              { path: 'new', element: <NewDesignPage /> },
              { path: ':designId', element: <DesignCanvasPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
