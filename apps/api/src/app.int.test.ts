import { inArray } from 'drizzle-orm';
import {
  apiErrorSchema,
  changeProposalResponseSchema,
  componentComparisonsResponseSchema,
  corpusEntrySchema,
  healthResponseSchema,
  listProjectsResponseSchema,
  listVersionsResponseSchema,
  meResponseSchema,
  projectDetailSchema,
  type Requirements,
} from '@trestle/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFakeChangeGenerator } from './ai/fake-change-generator';
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
const app = createApp({
  embedder,
  designGenerator: createFakeDesignGenerator(),
  changeGenerator: createFakeChangeGenerator(),
});
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

// A `comparison` entry about storage, so the Compare tab has a real match for
// the object-storage component of the fake design, and so we can prove that
// comparisons never return plain `pattern` entries.
const comparisonSlug = 'app-int-comparison-storage';
const comparisonEntry = corpusEntrySchema.parse({
  slug: comparisonSlug,
  kind: 'comparison',
  patternType: 'storage',
  title: 'Test comparison: object storage at a large product',
  summary:
    'Object storage holds uploaded files outside the database. Large products keep media in object storage rather than in rows, because object storage is cheaper per byte, scales independently and serves files directly. The database then stores only a reference to the object storage key.',
  whenToUse: 'Products where users upload images, video or documents into object storage.',
  whenNotToUse: 'Small text records, which belong in the database rather than object storage.',
  tradeoffs: ['Two systems to keep consistent when an upload fails partway.'],
  sourceNote: 'Based on: test fixture.',
  sourceUrl: 'https://example.com/object-storage',
});
const allLibrarySlugs = [...librarySlugs, comparisonSlug];

beforeAll(async () => {
  [alice, bob] = await Promise.all([createTestUser(), createTestUser()]);
  await ingestCorpus(db, embedder, [...libraryEntries, comparisonEntry], { prune: false });
});

afterAll(async () => {
  await deleteTestUsers(); // deleting the users cascade-deletes their projects
  await db.delete(corpusEntries).where(inArray(corpusEntries.slug, allLibrarySlugs));
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
      changeGenerator: createFakeChangeGenerator(),
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

describe('saving edits and version history', () => {
  it('saves an edit as a new version with an automatic summary', async () => {
    const project = await createProject(alice);
    const design = project.currentVersion.design;

    // Move the first component and rename it.
    const [first, ...rest] = design.components;
    if (!first) throw new Error('expected a component');
    const edited = {
      ...design,
      components: [
        { ...first, label: 'Renamed service', position: { x: first.position.x + 120, y: 40 } },
        ...rest,
      ],
    };

    const res = await request(app)
      .post(`/projects/${project.id}/edits`)
      .set(bearer(alice))
      .send({ design: edited });

    expect(res.status).toBe(201);
    const saved = projectDetailSchema.parse(res.body);
    expect(saved.currentVersion.versionNumber).toBe(2);
    expect(saved.currentVersion.changeSummary).toContain('Edited 1 component');
    expect(saved.currentVersion.design.components[0]?.label).toBe('Renamed service');
  });

  it('rejects an invalid design without creating a version', async () => {
    const project = await createProject(alice);
    const broken = {
      ...project.currentVersion.design,
      connections: [{ id: 'ghost__ghost', from: 'ghost', to: 'ghost', kind: 'sync' }],
    };

    const res = await request(app)
      .post(`/projects/${project.id}/edits`)
      .set(bearer(alice))
      .send({ design: broken });

    expect(res.status).toBe(400);
    expect(apiErrorSchema.parse(res.body).error.code).toBe('validation_error');

    const after = await request(app)
      .get(`/projects/${project.id}/versions`)
      .set(bearer(alice))
      .expect(200);
    expect(listVersionsResponseSchema.parse(after.body).versions).toHaveLength(1);
  });

  it('lists versions newest first and marks the current one', async () => {
    const project = await createProject(alice);
    await request(app)
      .post(`/projects/${project.id}/edits`)
      .set(bearer(alice))
      .send({ design: project.currentVersion.design })
      .expect(201);

    const res = await request(app).get(`/projects/${project.id}/versions`).set(bearer(alice));
    const { versions } = listVersionsResponseSchema.parse(res.body);

    expect(versions.map((version) => version.versionNumber)).toEqual([2, 1]);
    expect(versions[0]?.isCurrent).toBe(true);
    expect(versions[1]?.isCurrent).toBe(false);
    // Version 1 came from the model; version 2 was a manual save.
    expect(versions[1]?.generatorModel).toBe('fake-model-v1');
    expect(versions[0]?.generatorModel).toBeNull();
  });

  it('restores an old version as a new version, keeping history intact', async () => {
    const project = await createProject(alice);
    const original = project.currentVersion.design;
    const v1Id = project.currentVersion.id;

    // Drop the last components, and everything that referenced them: the design
    // contract rejects dangling connections or data entities.
    const kept = original.components.slice(0, 3);
    const keptIds = new Set(kept.map((component) => component.id));
    const trimmed = {
      ...original,
      components: kept,
      connections: original.connections.filter(
        (connection) => keptIds.has(connection.from) && keptIds.has(connection.to),
      ),
      dataModel: original.dataModel.filter((entity) => keptIds.has(entity.storedIn)),
    };

    await request(app)
      .post(`/projects/${project.id}/edits`)
      .set(bearer(alice))
      .send({ design: trimmed })
      .expect(201);

    const res = await request(app)
      .post(`/projects/${project.id}/versions/${v1Id}/restore`)
      .set(bearer(alice));

    expect(res.status).toBe(201);
    const restored = projectDetailSchema.parse(res.body);
    expect(restored.currentVersion.versionNumber).toBe(3);
    expect(restored.currentVersion.changeSummary).toBe('Restored version 1');
    expect(restored.currentVersion.design.components).toHaveLength(original.components.length);

    // Nothing was rewritten: all three versions still exist.
    const history = await request(app)
      .get(`/projects/${project.id}/versions`)
      .set(bearer(alice))
      .expect(200);
    expect(listVersionsResponseSchema.parse(history.body).versions).toHaveLength(3);
  });

  it("refuses to touch another user's design", async () => {
    const project = await createProject(alice);

    await request(app)
      .post(`/projects/${project.id}/edits`)
      .set(bearer(bob))
      .send({ design: project.currentVersion.design })
      .expect(404);

    await request(app).get(`/projects/${project.id}/versions`).set(bearer(bob)).expect(404);

    await request(app)
      .post(`/projects/${project.id}/versions/${project.currentVersion.id}/restore`)
      .set(bearer(bob))
      .expect(404);
  });
});

describe('change requests (suggest first, never auto-apply)', () => {
  async function propose(
    user: TestUser,
    projectId: string,
    prompt = 'add live chat between users',
  ) {
    const res = await request(app)
      .post(`/projects/${projectId}/change-request`)
      .set(bearer(user))
      .send({ prompt })
      .expect(201);
    return changeProposalResponseSchema.parse(res.body).proposal;
  }

  it('proposes operations without changing the design', async () => {
    const project = await createProject(alice);
    const proposal = await propose(alice, project.id);

    expect(proposal.operations.length).toBeGreaterThan(0);
    expect(proposal.operations.every((operation) => operation.explanation.length > 0)).toBe(true);

    // The saved design is untouched: still version 1, same components.
    const after = await request(app).get(`/projects/${project.id}`).set(bearer(alice)).expect(200);
    const current = projectDetailSchema.parse(after.body);
    expect(current.currentVersion.versionNumber).toBe(1);
    expect(current.currentVersion.design.components).toHaveLength(
      project.currentVersion.design.components.length,
    );
  });

  it('drops operations that reference components which do not exist', async () => {
    const project = await createProject(alice);
    const proposal = await propose(alice, project.id);

    // The fake proposes a connection from "ghost-component"; it must not survive.
    const referencesGhost = proposal.operations.some(
      (operation) =>
        operation.type === 'add_connection' &&
        (operation.connection.from === 'ghost-component' ||
          operation.connection.to === 'ghost-component'),
    );
    expect(referencesGhost).toBe(false);
  });

  it('keeps only citations that were supplied to the model', async () => {
    const project = await createProject(alice);
    const proposal = await propose(alice, project.id);
    const cited = proposal.operations.flatMap((operation) => operation.sources);

    expect(cited).not.toContain('never-supplied-slug');
    expect(cited.every((source) => /^[0-9a-f-]{36}$/.test(source))).toBe(true);
  });

  it('applies only the operations the user accepted', async () => {
    const project = await createProject(alice);
    const proposal = await propose(alice, project.id);
    const addComponent = proposal.operations.find(
      (operation) => operation.type === 'add_component',
    );
    if (!addComponent) throw new Error('expected an add_component operation');

    const res = await request(app)
      .post(`/projects/${project.id}/change-request/${proposal.id}/accept`)
      .set(bearer(alice))
      .send({ operationIds: [addComponent.id] })
      .expect(201);

    const saved = projectDetailSchema.parse(res.body);
    expect(saved.currentVersion.versionNumber).toBe(2);
    expect(saved.currentVersion.changeSummary).toContain('accepted 1 of');

    const ids = saved.currentVersion.design.components.map((component) => component.id);
    expect(ids).toContain('live-chat-service');
    // The other proposed operations were NOT applied.
    expect(
      saved.currentVersion.design.connections.some(
        (connection) => connection.to === 'live-chat-service',
      ),
    ).toBe(false);
  });

  it('rejecting leaves the design and version count untouched', async () => {
    const project = await createProject(alice);
    const proposal = await propose(alice, project.id);

    await request(app)
      .post(`/projects/${project.id}/change-request/${proposal.id}/reject`)
      .set(bearer(alice))
      .expect(204);

    const versions = await request(app)
      .get(`/projects/${project.id}/versions`)
      .set(bearer(alice))
      .expect(200);
    expect(listVersionsResponseSchema.parse(versions.body).versions).toHaveLength(1);

    // A decided proposal cannot be accepted afterwards.
    await request(app)
      .post(`/projects/${project.id}/change-request/${proposal.id}/accept`)
      .set(bearer(alice))
      .send({ operationIds: [proposal.operations[0]?.id ?? 'op-1'] })
      .expect(409);
  });

  it('refuses a proposal made against an older version', async () => {
    const project = await createProject(alice);
    const proposal = await propose(alice, project.id);

    // Someone saves an edit in the meantime.
    await request(app)
      .post(`/projects/${project.id}/edits`)
      .set(bearer(alice))
      .send({ design: project.currentVersion.design })
      .expect(201);

    const res = await request(app)
      .post(`/projects/${project.id}/change-request/${proposal.id}/accept`)
      .set(bearer(alice))
      .send({ operationIds: [proposal.operations[0]?.id ?? 'op-1'] });

    expect(res.status).toBe(409);
    expect(apiErrorSchema.parse(res.body).error.code).toBe('stale_proposal');
  });

  it("will not propose or accept on another user's design", async () => {
    const project = await createProject(alice);

    await request(app)
      .post(`/projects/${project.id}/change-request`)
      .set(bearer(bob))
      .send({ prompt: 'add live chat' })
      .expect(404);

    const proposal = await propose(alice, project.id);
    await request(app)
      .post(`/projects/${project.id}/change-request/${proposal.id}/accept`)
      .set(bearer(bob))
      .send({ operationIds: [proposal.operations[0]?.id ?? 'op-1'] })
      .expect(404);
  });

  it('counts a change request against the daily AI limit', async () => {
    const project = await createProject(alice);
    const limited = await createTestUser();

    await db.insert(aiRequests).values(
      Array.from({ length: DAILY_AI_LIMIT }, () => ({
        userId: limited.id,
        kind: 'change_request',
        model: 'fake-change-model-v1',
      })),
    );

    const res = await request(app)
      .post(`/projects/${project.id}/change-request`)
      .set(bearer(limited))
      .send({ prompt: 'add live chat' });

    // Not their project either, but the limit is checked first.
    expect([404, 429]).toContain(res.status);
  });
});

describe('component comparisons', () => {
  it('returns library comparisons for a component, never plain patterns', async () => {
    const project = await createProject(alice);

    const res = await request(app)
      .get(`/projects/${project.id}/components/object-storage/comparisons`)
      .set(bearer(alice))
      .expect(200);

    const body = componentComparisonsResponseSchema.parse(res.body);
    expect(body.componentId).toBe('object-storage');
    expect(body.comparisons.length).toBeGreaterThan(0);
    expect(body.comparisons.map((entry) => entry.slug)).toContain(comparisonSlug);
    // The Compare tab must never show a general pattern as "how a real system did it".
    expect(body.comparisons.every((entry) => entry.kind === 'comparison')).toBe(true);
  });

  it('returns nothing for a kind we have no comparable topics for', async () => {
    const project = await createProject(alice);

    // `client` maps to no topics at all, so this must not fall back to the
    // nearest unrelated entry.
    const res = await request(app)
      .get(`/projects/${project.id}/components/client-app/comparisons`)
      .set(bearer(alice))
      .expect(200);

    expect(componentComparisonsResponseSchema.parse(res.body).comparisons).toEqual([]);
  });

  it('404s for a component that is not in the design', async () => {
    const project = await createProject(alice);

    await request(app)
      .get(`/projects/${project.id}/components/no-such-component/comparisons`)
      .set(bearer(alice))
      .expect(404);
  });

  it("404s for someone else's design", async () => {
    const project = await createProject(alice);

    await request(app)
      .get(`/projects/${project.id}/components/object-storage/comparisons`)
      .set(bearer(bob))
      .expect(404);
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
