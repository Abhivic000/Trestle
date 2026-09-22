import { z } from 'zod';

/**
 * Response body of `GET /health`. Defined once here so the API and the web app
 * agree on its shape: the API builds it, the web app validates it on arrival.
 */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  uptimeSeconds: z.number().nonnegative(),
  timestamp: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
