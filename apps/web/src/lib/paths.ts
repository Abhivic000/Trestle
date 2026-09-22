// Every URL in the app, defined once. Link to `paths.x` instead of typing
// strings so a renamed route can't leave broken links behind.
export const paths = {
  home: '/',
  login: '/login',
  signup: '/signup',
  designs: '/designs',
  newDesign: '/designs/new',
  design: (designId: string) => `/designs/${encodeURIComponent(designId)}`,
} as const;
