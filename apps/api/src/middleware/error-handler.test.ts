import { apiErrorSchema } from '@trestle/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../errors';
import { errorHandler, notFoundHandler } from './error-handler';

function testApp(logError = vi.fn()) {
  const app = express();
  // Stand-in for pino-http, which normally attaches req.log.
  app.use((req, _res, next) => {
    (req as unknown as { log: { error: typeof logError } }).log = { error: logError };
    next();
  });
  app.get('/teapot', () => {
    throw new HttpError(418, 'teapot', 'I am a teapot');
  });
  app.get('/boom', () => {
    throw new Error('database password is hunter2');
  });
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('error handling', () => {
  it('returns HttpErrors with their status, code and message', async () => {
    const res = await request(testApp()).get('/teapot');
    expect(res.status).toBe(418);
    expect(res.body).toEqual({ error: { code: 'teapot', message: 'I am a teapot' } });
  });

  it('returns a 404 in the standard shape for unknown routes', async () => {
    const res = await request(testApp()).get('/nope');
    expect(res.status).toBe(404);
    expect(apiErrorSchema.parse(res.body).error.code).toBe('not_found');
  });

  it('hides unexpected error details from the client but logs them', async () => {
    const logError = vi.fn();
    const res = await request(testApp(logError)).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'internal_error', message: 'Something went wrong on our side.' },
    });
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
    expect(logError).toHaveBeenCalledOnce();
  });
});
