import { seedTestCorpus } from './seed-corpus.ts';
import { deleteE2eUsers } from './test-users.ts';

// Before the run: remove users left behind by a previous run that crashed, and
// make sure the reference library is present so Compare has something to find.
export default async function globalSetup() {
  await deleteE2eUsers();
  await seedTestCorpus();
}
