import { defineConfig } from 'tsup';

// Production build: bundles src/ into a single dist/index.js that plain Node can run.
// @trestle/shared ships TypeScript source, so it must be bundled in rather than
// left as an external import. Third-party packages stay external (loaded from node_modules).
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: [/^@trestle\//],
});
