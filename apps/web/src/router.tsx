import { createBrowserRouter } from 'react-router';
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

// Layout routes (no `path`) wrap groups of pages in shared chrome.
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
        element: <AuthLayout />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'signup', element: <SignupPage /> },
        ],
      },
      {
        // Will require a signed-in user once auth lands in Phase 4.
        path: 'designs',
        element: <AppLayout />,
        children: [
          { index: true, element: <DesignsPage /> },
          { path: 'new', element: <NewDesignPage /> },
          { path: ':designId', element: <DesignCanvasPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
