import { inArray } from 'drizzle-orm';
import {
  apiErrorSchema,
  corpusEntrySchema,
  healthResponseSchema,
  listProjectsResponseSchema,
  meResponseSchema,
  projectDetailSchema,
  type Requirements,
} from '@trestle/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFakeDesignGenerator } from './ai/fake-design-generator';
import { createFakeEmbedder } from './ai/fake-embedder';
import { DAILY_AI_LIMIT } from './ai/usage';
import { createApp } from './app';
import { env } from './config/env';
import { ingestCorpus } from './corpus/ingest';
import { db, sql } from './db/client';
import { aiRequests, corpusEntries } from './db/schema';
import { createTestUser, deleteTestUsers, type TestUser } from './test/test-users';

// Integration tests: the real Express app, the real trestle-test database and
// real Supabase-issued tokens. Nothing is mocked.

// Fake AI services: no network calls, no quota, deterministic output.
const embedder = createFakeEmbedder();
const app = createApp({ embedder, designGenerator: createFakeDesignGenerator() });
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

// Two library entries so retrieval has something to hand the model, which makes
// the citation test meaningful rather than trivially true.
const librarySlugs = ['app-int-cache', 'app-int-queue'];
const libraryEntries = librarySlugs.map((slug) =>
  corpusEntrySchema.parse({
    slug,
    kind: 'pattern',
    patternType: slug.endsWith('cache') ? 'caching' : 'queuing',
    title: `Test entry ${slug}`,
    summary:
      'A cache keeps frequently read data in memory so repeated reads do not reach the database, which matters when traffic concentrates on a small share of items.',
    whenToUse: 'Read-heavy traffic with repeated reads of the same items.',
    whenNotToUse: 'Write-heavy traffic, or data that must always be exactly current.',
    tradeoffs: ['Cached data can be stale until it expires.'],
    sourceNote: 'Based on: test fixture.',
  }),
);

beforeAll(async () => {
  [alice, bob] = await Promise.all([createTestUser(), createTestUser()]);
  await ingestCorpus(db, embedder, libraryEntries, { prune: false });
});

afterAll(async () => {
  await deleteTestUsers(); // deleting the users cascade-deletes their projects
  await db.delete(corpusEntries).where(inArray(corpusEntries.slug, librarySlugs));
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
  it('creates a project whose version 1 is the generated design', async () => {
    const project = await createProject(alice);

    expect(project.name).toBe('Media streaming');
    expect(project.requirements.features).toEqual(['playback', 'playlists']);
    expect(project.currentVersion.versionNumber).toBe(1);
    expect(project.currentVersion.design.origin).toBe('generated');
    expect(project.currentVersion.design.components.length).toBeGreaterThan(0);
    // The server lays the graph out; the model does not supply coordinates.
    const positions = project.currentVersion.design.components.map((c) => c.position.x);
    expect(new Set(positions).size).toBeGreaterThan(1);
  });

  it('keeps only citations that were actually supplied to the model', async () => {
    const project = await createProject(alice);
    const cited = project.currentVersion.design.components.flatMap((c) => c.sources);

    // Whatever survives must be a real library id; the invented slug never does.
    // (The detailed mapping rules are unit-tested in generate-design.test.ts.)
    expect(cited.every((source) => /^[0-9a-f-]{36}$/.test(source))).toBe(true);
    expect(cited).not.toContain('slug-that-was-never-supplied');
  });

  it('drops connections pointing at components that do not exist', async () => {
    const project = await createProject(alice);
    const ids = new Set(project.currentVersion.design.components.map((c) => c.id));

    expect(project.currentVersion.design.connections.length).toBeGreaterThan(0);
    expect(
      project.currentVersion.design.connections.every((c) => ids.has(c.from) && ids.has(c.to)),
    ).toBe(true);
  });

  it('reports a generation failure without creating a project', async () => {
    const failingApp = createApp({
      embedder,
      designGenerator: createFakeDesignGenerator({ failWith: 'The model is busy.' }),
    });
    const before = await request(failingApp).get('/projects').set(bearer(bob)).expect(200);

    const res = await request(failingApp)
      .post('/projects')
      .set(bearer(bob))
      .send({ requirements: sampleRequirements });

    expect(res.status).toBe(502);
    expect(apiErrorSchema.parse(res.body).error.code).toBe('generation_failed');

    const after = await request(failingApp).get('/projects').set(bearer(bob)).expect(200);
    expect(listProjectsResponseSchema.parse(after.body).projects).toHaveLength(
      listProjectsResponseSchema.parse(before.body).projects.length,
    );
  });

  it('stops generating once the account hits its daily AI limit', async () => {
    const limited = await createTestUser();
    await db.insert(aiRequests).values(
      Array.from({ length: DAILY_AI_LIMIT }, () => ({
        userId: limited.id,
        kind: 'generate',
        model: 'fake-model-v1',
      })),
    );

    const res = await request(app)
      .post('/projects')
      .set(bearer(limited))
      .send({ requirements: sampleRequirements });

    expect(res.status).toBe(429);
    expect(apiErrorSchema.parse(res.body).error.code).toBe('ai_limit_reached');
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

  it('answers 404 for an id that is not a uuid, rather than failing', async () => {
    const res = await request(app).get('/projects/not-a-real-id').set(bearer(alice));
    expect(res.status).toBe(404);
    expect(apiErrorSchema.parse(res.body).error.code).toBe('not_found');
  });

  it('answers 404 for a well-formed id that does not exist', async () => {
    const res = await request(app)
      .get('/projects/00000000-0000-4000-8000-000000000000')
      .set(bearer(alice));
    expect(res.status).toBe(404);
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
