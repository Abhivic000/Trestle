// TEMPORARY type bridge: @testing-library/jest-dom v7 augments Vitest's old
// one-parameter `Assertion<T>`, but Vitest 5's is `Assertion<R, T>` and its
// extension point is `Matchers<R, T>`. The mismatch makes TypeScript ignore
// jest-dom's matchers (toBeInTheDocument, ...) even though they work at runtime.
// This re-attaches them. Delete this file once jest-dom supports Vitest 5.
//
// The relative path is deliberate: jest-dom doesn't export this types file
// through its package "exports".
import type { TestingLibraryMatchers } from '../../node_modules/@testing-library/jest-dom/types/matchers';

// The type parameters must mirror Vitest's declaration exactly (names included)
// for TypeScript to merge the two, even though `T` isn't used here.
/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars */
declare module 'vitest' {
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
    T = unknown,
  > extends TestingLibraryMatchers<unknown, R> {}
}
/* eslint-enable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars */
