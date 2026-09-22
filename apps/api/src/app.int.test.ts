import {
  apiErrorSchema,
  healthResponseSchema,
  listProjectsResponseSchema,
  meResponseSchema,
  projectDetailSchema,
  type Requirements,
} from '@trestle/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { env } from './config/env';
import { sql } from './db/client';
import { createTestUser, deleteTestUsers, type TestUser } from './test/test-users';

// Integration tests: the real Express app, the real trestle-test database and
// real Supabase-issued tokens. Nothing is mocked.

const app = createApp();
const bearer = (user: TestUser) => ({ Authorization: `Bearer ${user.accessToken}` });

const sampleRequirements: Requirements = {
  projectType: 'streaming',
  features: ['playback', 'playlists'],
  dailyActiveUsers: 500_000,
  trafficShape: 'read_heavy',
  latencySensitivity: 'high',
  consistency: 'eventual',
  availability: '99.9',
  budget: 'funded',
  compliance: [],
  constraints: '',
  notes: '',
};

async function createProject(user: TestUser, requirements: Requirements = sampleRequirements) {
  const res = await request(app)
    .post('/projects')
    .set(bearer(user))
    .send({ requirements })
    .expect(201);
  return projectDetailSchema.parse(res.body);
}

let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  [alice, bob] = await Promise.all([createTestUser(), createTestUser()]);
});

afterAll(async () => {
  await deleteTestUsers(); // deleting the users cascade-deletes their projects
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

  it.each([
    ['GET', '/projects'],
    ['POST', '/projects'],
    ['GET', '/projects/00000000-0000-4000-8000-000000000000'],
  ])('requires a signed-in user for %s %s', async (method, path) => {
    const res = await (method === 'POST'
      ? request(app).post(path).send({})
      : request(app).get(path));
    expect(res.status).toBe(401);
  });
});

describe('POST /projects', () => {
  it('creates a project with version 1 and a name from the requirements', async () => {
    const project = await createProject(alice);

    expect(project.name).toBe('Media streaming');
    expect(project.requirements.features).toEqual(['playback', 'playlists']);
    expect(project.currentVersion.versionNumber).toBe(1);
    expect(project.currentVersion.design.components.length).toBeGreaterThan(0);
    // Until AI generation lands, version 1 is an honest placeholder.
    expect(project.currentVersion.design.origin).toBe('placeholder');
  });

  it('rejects invalid requirements without creating anything', async () => {
    const before = await request(app).get('/projects').set(bearer(bob)).expect(200);

    const res = await request(app)
      .post('/projects')
      .set(bearer(bob))
      .send({ requirements: { ...sampleRequirements, features: [], dailyActiveUsers: -5 } });

    expect(res.status).toBe(400);
    expect(apiErrorSchema.parse(res.body).error.code).toBe('validation_error');

    const after = await request(app).get('/projects').set(bearer(bob)).expect(200);
    expect(listProjectsResponseSchema.parse(after.body).projects).toHaveLength(
      listProjectsResponseSchema.parse(before.body).projects.length,
    );
  });
});

describe('GET /projects/:id', () => {
  it('returns the full design for its owner', async () => {
    const created = await createProject(alice);

    const res = await request(app).get(`/projects/${created.id}`).set(bearer(alice));
    expect(res.status).toBe(200);
    const fetched = projectDetailSchema.parse(res.body);
    expect(fetched.id).toBe(created.id);
    expect(fetched.currentVersion.design.summary).toBe(created.currentVersion.design.summary);
  });

  it("hides another user's design behind a 404", async () => {
    const aliceProject = await createProject(alice);

    const res = await request(app).get(`/projects/${aliceProject.id}`).set(bearer(bob));
    expect(res.status).toBe(404);
    expect(apiErrorSchema.parse(res.body).error.code).toBe('not_found');
  });
});

describe('GET /projects', () => {
  it("returns a user's own projects and never anyone else's", async () => {
    const aliceProject = await createProject(alice);
    const bobProject = await createProject(bob, {
      ...sampleRequirements,
      projectType: 'marketplace',
    });

    const aliceRes = await request(app).get('/projects').set(bearer(alice)).expect(200);
    const bobRes = await request(app).get('/projects').set(bearer(bob)).expect(200);

    const aliceIds = listProjectsResponseSchema.parse(aliceRes.body).projects.map((p) => p.id);
    const bobIds = listProjectsResponseSchema.parse(bobRes.body).projects.map((p) => p.id);

    expect(aliceIds).toContain(aliceProject.id);
    expect(aliceIds).not.toContain(bobProject.id);
    expect(bobIds).toContain(bobProject.id);
    expect(bobIds).not.toContain(aliceProject.id);
  });
});

describe('row-level security', () => {
  it('blocks reading tables directly with the public browser key', async () => {
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!publishableKey) throw new Error('Set SUPABASE_PUBLISHABLE_KEY in apps/api/.env.test');
    await createProject(alice); // there is data to leak if RLS were off

    // Bypass our API and ask Supabase's Data API for the table directly, as a
    // malicious browser script could.
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/projects?select=*`, {
      headers: { apikey: publishableKey, ...bearer(alice) },
    });
    const body: unknown = await res.json();

    const blocked =
      res.status === 401 || res.status === 403 || (Array.isArray(body) && body.length === 0);
    expect(blocked, `status ${res.status}, body ${JSON.stringify(body)}`).toBe(true);
  });
});
