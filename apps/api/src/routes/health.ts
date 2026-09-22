import { Router } from 'express';
import type { HealthResponse } from '@trestle/shared';

export const healthRouter = Router();

// Lets the web app (and later, a hosting platform) check the API is up.
healthRouter.get('/', (_req, res) => {
  const body: HealthResponse = {
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
  res.json(body);
});
