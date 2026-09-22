import { deleteE2eUsers } from './test-users.ts';

// Before the run: remove users left behind by a previous run that crashed.
export default async function globalSetup() {
  await deleteE2eUsers();
}
