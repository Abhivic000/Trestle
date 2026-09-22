// Runs before every web test file (see vitest.config.ts at the repo root).
import '@testing-library/jest-dom/vitest'; // adds matchers like toBeInTheDocument()
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Unmount whatever the previous test rendered.
afterEach(() => {
  cleanup();
});
