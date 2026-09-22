import {
  apiErrorSchema,
  healthResponseSchema,
  listProjectsResponseSchema,
  meResponseSchema,
} from '@trestle/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { env } from './config/env';
import { db, sql } from './db/client';
import { projects } from './db/schema';
import { createTestUser, deleteTestUsers, type TestUser } from './test/test-users';

// Integration tests: the real Express app, the real trestle-test database and
// real Supabase-issued tokens. Nothing is mocked.

const app = createApp();
const bearer = (user: TestUser) => ({ Authorization: `Bearer ${user.accessToken}` });

let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  [alice, bob] = await Promise.all([createTestUser(), createTestUser()]);
});

afterAll(async () => {
  await deleteTestUsers();
  await sql.end();
});

describe('GET /health', () => {
  it('is public and reports ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(healthResponseSchema.parse(res.body).status).toBe('ok');
  });
});

describe('authentication', () => {
  it.each([
    ['no Authorization header', {}],
    ['a non-Bearer scheme', { Authorization: 'Basic abc123' }],
    ['a garbage token', { Authorization: 'Bearer not-a-real-token' }],
  ])('rejects a request with %s', async (_label, headers) => {
    const res = await request(app).get('/me').set(headers);
    expect(res.status).toBe(401);
    expect(apiErrorSchema.parse(res.body).error.code).toBe('unauthorized');
  });

  it('identifies the signed-in user from their token', async () => {
    const res = await request(app).get('/me').set(bearer(alice));
    expect(res.status).toBe(200);
    expect(meResponseSchema.parse(res.body)).toEqual({ id: alice.id, email: alice.email });
  });
});

describe('GET /projects', () => {
  it('requires a signed-in user', async () => {
    const res = await request(app).get('/projects');
    expect(res.status).toBe(401);
  });

  it("returns a user's own projects and never anyone else's", async () => {
    await db.insert(projects).values([
      { userId: alice.id, name: 'Alice: music streaming' },
      { userId: bob.id, name: 'Bob: ride sharing' },
    ]);

    const aliceRes = await request(app).get('/projects').set(bearer(alice));
    const bobRes = await request(app).get('/projects').set(bearer(bob));

    const aliceNames = listProjectsResponseSchema.parse(aliceRes.body).projects.map((p) => p.name);
    const bobNames = listProjectsResponseSchema.parse(bobRes.body).projects.map((p) => p.name);
    expect(aliceNames).toEqual(['Alice: music streaming']);
    expect(bobNames).toEqual(['Bob: ride sharing']);
  });
});

describe('row-level security', () => {
  it('blocks reading tables directly with the public browser key', async () => {
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!publishableKey) throw new Error('Set SUPABASE_PUBLISHABLE_KEY in apps/api/.env.test');

    // Bypass our API and ask Supabase's Data API for the table directly, as a
    // malicious browser script could. Alice has a project row at this point.
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/projects?select=*`, {
      headers: { apikey: publishableKey, ...bearer(alice) },
    });
    const body: unknown = await res.json();

    const blocked =
      res.status === 401 || res.status === 403 || (Array.isArray(body) && body.length === 0);
    expect(blocked, `status ${res.status}, body ${JSON.stringify(body)}`).toBe(true);
  });
});
