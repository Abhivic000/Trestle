import { deleteE2eUsers } from './test-users.ts';

// After the run: remove every user the tests created.
export default async function globalTeardown() {
  await deleteE2eUsers();
}
