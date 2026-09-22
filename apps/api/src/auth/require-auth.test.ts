import { apiErrorSchema } from '@trestle/shared';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../middleware/error-handler';
import { currentUser, requireAuth } from './require-auth';

// Replace the real Supabase client with a fake whose getClaims we control.
// vi.hoisted runs before the (hoisted) vi.mock call, so the fake exists in time.
const { getClaims } = vi.hoisted(() => ({ getClaims: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { auth: { getClaims } } }));

// A tiny app: requireAuth in front of a route that echoes the user it set.
function testApp() {
  const app = express();
  app.get('/whoami', requireAuth, (req, res) => {
    res.json(currentUser(req));
  });
  app.use(errorHandler);
  return app;
}

const validClaims = (claims: Record<string, unknown>) => ({
  data: { claims, header: {}, signature: new Uint8Array() },
  error: null,
});

describe('requireAuth', () => {
  beforeEach(() => {
    getClaims.mockReset();
  });

  it('rejects requests without an Authorization header, without asking Supabase', async () => {
    const res = await request(testApp()).get('/whoami');
    expect(res.status).toBe(401);
    expect(apiErrorSchema.parse(res.body)).toEqual({
      error: { code: 'unauthorized', message: 'Sign in to continue.' },
    });
    expect(getClaims).not.toHaveBeenCalled();
  });

  it('rejects non-Bearer authorization schemes', async () => {
    const res = await request(testApp()).get('/whoami').set('Authorization', 'Basic dXNlcjpwdw==');
    expect(res.status).toBe(401);
    expect(getClaims).not.toHaveBeenCalled();
  });

  it('rejects tokens that Supabase says are invalid', async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error('invalid JWT') });

    const res = await request(testApp()).get('/whoami').set('Authorization', 'Bearer bad.token');
    expect(res.status).toBe(401);
    expect(apiErrorSchema.parse(res.body).error.message).toBe(
      'Your session is invalid or has expired.',
    );
    expect(getClaims).toHaveBeenCalledWith('bad.token');
  });

  it('sets req.user from a valid token', async () => {
    getClaims.mockResolvedValue(validClaims({ sub: 'user-123', email: 'a@example.com' }));

    const res = await request(testApp()).get('/whoami').set('Authorization', 'Bearer good.token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'user-123', email: 'a@example.com' });
  });

  it('treats a missing email claim as null', async () => {
    getClaims.mockResolvedValue(validClaims({ sub: 'user-456' }));

    const res = await request(testApp()).get('/whoami').set('Authorization', 'Bearer good.token');
    expect(res.body).toEqual({ id: 'user-456', email: null });
  });
});
