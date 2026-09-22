import { Router } from 'express';
import type { MeResponse } from '@trestle/shared';
import { currentUser } from '../auth/require-auth';

export const meRouter = Router();

// Who the API thinks you are. Handy for debugging auth end to end.
meRouter.get('/', (req, res) => {
  const user = currentUser(req);
  const body: MeResponse = { id: user.id, email: user.email };
  res.json(body);
});
