import { Outlet, ScrollRestoration } from 'react-router';

/** Wraps every page. Restores scroll position on back/forward, starts at top on new pages. */
export function RootLayout() {
  return (
    <>
      <Outlet />
      <ScrollRestoration />
    </>
  );
}
