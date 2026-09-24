import {
  createProjectRequestSchema,
  designSchema,
  projectNameFromRequirements,
  requirementsSchema,
  saveEditsRequestSchema,
  type Design,
  type ListProjectsResponse,
  type ListVersionsResponse,
  type ProjectDetail,
} from '@trestle/shared';
import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { GenerationError } from '../ai/design-generator';
import { assertWithinDailyAiLimit, recordAiRequest } from '../ai/usage';
import { currentUser } from '../auth/require-auth';
import { db, type Database } from '../db/client';
import { designVersions, projects } from '../db/schema';
import { generateDesign } from '../designs/generate-design';
import { describeManualEdit, loadVersion, saveNewVersion } from '../designs/versions';
import type { AppDependencies } from '../deps';
import { HttpError } from '../errors';

/** Generation is slow but not unbounded; give up rather than hang the browser. */
const GENERATION_TIMEOUT_MS = 90_000;

/** Anything that isn't an id can't exist: 404 rather than a database error. */
function parseProjectId(value: string | undefined, message = 'Design not found.'): string {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new HttpError(404, 'not_found', message);
  return parsed.data;
}

/** The design currently pointed at by the project, for diffing a save against. */
async function loadCurrentDesign(db: Database, projectId: string, userId: string): Promise<Design> {
  const [row] = await db
    .select({ designJson: designVersions.designJson })
    .from(projects)
    .innerJoin(designVersions, eq(designVersions.id, projects.currentVersionId))
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!row) throw new HttpError(404, 'not_found', 'Design not found.');
  return designSchema.parse(row.designJson);
}

export function createProjectsRouter({ embedder, designGenerator }: AppDependencies) {
  const router = Router();

  // Every query here MUST be scoped to currentUser(req).id. That is what keeps
  // users' data apart (the database's RLS only blocks direct browser access).

  router.get('/', async (req, res) => {
    const user = currentUser(req);

    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(eq(projects.userId, user.id))
      .orderBy(desc(projects.updatedAt));

    const body: ListProjectsResponse = {
      projects: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
    res.json(body);
  });

  router.post('/', async (req, res) => {
    const user = currentUser(req);

    // Never trust the browser: validate with the same schema the form uses.
    const parsed = createProjectRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      throw new HttpError(
        400,
        'validation_error',
        issue ? `${issue.path.join('.')}: ${issue.message}` : 'Invalid requirements.',
      );
    }
    const { requirements } = parsed.data;

    await assertWithinDailyAiLimit(db, user.id);

    // Generate BEFORE writing anything: a failed generation leaves no half-made
    // project behind, and the user can simply submit the form again.
    const timeout = AbortSignal.timeout(GENERATION_TIMEOUT_MS);
    let generated;
    try {
      generated = await generateDesign(db, embedder, designGenerator, requirements, timeout);
    } catch (error) {
      if (error instanceof GenerationError) {
        throw new HttpError(502, 'generation_failed', error.message);
      }
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new HttpError(
          504,
          'generation_timeout',
          'Generating the design took too long. Please try again.',
        );
      }
      throw error;
    }

    const { design, model } = generated;

    // One transaction: project, its first version, and the pointer to that version
    // all land together, or none of them do.
    const created = await db.transaction(async (tx) => {
      const [project] = await tx
        .insert(projects)
        .values({
          userId: user.id,
          name: projectNameFromRequirements(requirements),
          requirements,
        })
        .returning();
      if (!project) throw new Error('Insert returned no project row');

      const [version] = await tx
        .insert(designVersions)
        .values({
          projectId: project.id,
          versionNumber: 1,
          designJson: design,
          changeSummary: 'Initial generated design',
          generatorModel: model,
        })
        .returning();
      if (!version) throw new Error('Insert returned no design version row');

      const [updated] = await tx
        .update(projects)
        .set({ currentVersionId: version.id })
        .where(eq(projects.id, project.id))
        .returning();
      if (!updated) throw new Error('Update returned no project row');

      return { project: updated, version };
    });

    await recordAiRequest(db, user.id, 'generate', model);

    const body: ProjectDetail = {
      id: created.project.id,
      name: created.project.name,
      createdAt: created.project.createdAt.toISOString(),
      updatedAt: created.project.updatedAt.toISOString(),
      requirements,
      currentVersion: {
        id: created.version.id,
        versionNumber: created.version.versionNumber,
        changeSummary: created.version.changeSummary,
        createdAt: created.version.createdAt.toISOString(),
        design,
      },
    };
    res.status(201).json(body);
  });

  /** Save manual canvas edits as a new, immutable version. */
  router.post('/:projectId/edits', async (req, res) => {
    const user = currentUser(req);
    const projectId = parseProjectId(req.params.projectId);

    const parsed = saveEditsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      throw new HttpError(
        400,
        'validation_error',
        issue ? `${issue.path.join('.')}: ${issue.message}` : 'Invalid design.',
      );
    }

    const current = await loadCurrentDesign(db, projectId, user.id);
    const summary = describeManualEdit(current, parsed.data.design);

    const project = await saveNewVersion(db, {
      projectId,
      userId: user.id,
      design: parsed.data.design,
      changeSummary: summary,
    });
    res.status(201).json(project);
  });

  /** The version history drawer. */
  router.get('/:projectId/versions', async (req, res) => {
    const user = currentUser(req);
    const projectId = parseProjectId(req.params.projectId);

    const rows = await db
      .select({
        id: designVersions.id,
        versionNumber: designVersions.versionNumber,
        changeSummary: designVersions.changeSummary,
        createdAt: designVersions.createdAt,
        generatorModel: designVersions.generatorModel,
        currentVersionId: projects.currentVersionId,
      })
      .from(designVersions)
      .innerJoin(projects, eq(projects.id, designVersions.projectId))
      .where(and(eq(designVersions.projectId, projectId), eq(projects.userId, user.id)))
      .orderBy(desc(designVersions.versionNumber));

    if (rows.length === 0) {
      throw new HttpError(404, 'not_found', 'Design not found.');
    }

    const body: ListVersionsResponse = {
      versions: rows.map((row) => ({
        id: row.id,
        versionNumber: row.versionNumber,
        changeSummary: row.changeSummary,
        createdAt: row.createdAt.toISOString(),
        generatorModel: row.generatorModel,
        isCurrent: row.currentVersionId === row.id,
      })),
    };
    res.json(body);
  });

  /** Open an older version (read-only preview in the canvas). */
  router.get('/:projectId/versions/:versionId', async (req, res) => {
    const user = currentUser(req);
    const projectId = parseProjectId(req.params.projectId);
    const versionId = parseProjectId(req.params.versionId, 'Version not found.');

    const { design, versionNumber } = await loadVersion(db, projectId, user.id, versionId);
    res.json({ id: versionId, versionNumber, design });
  });

  /** Bring an old version back as a NEW version: history is never rewritten. */
  router.post('/:projectId/versions/:versionId/restore', async (req, res) => {
    const user = currentUser(req);
    const projectId = parseProjectId(req.params.projectId);
    const versionId = parseProjectId(req.params.versionId, 'Version not found.');

    const { design, versionNumber } = await loadVersion(db, projectId, user.id, versionId);
    const project = await saveNewVersion(db, {
      projectId,
      userId: user.id,
      design,
      changeSummary: `Restored version ${String(versionNumber)}`,
    });
    res.status(201).json(project);
  });

  router.get('/:projectId', async (req, res) => {
    const user = currentUser(req);

    const projectId = parseProjectId(req.params.projectId);

    const [row] = await db
      .select({ project: projects, version: designVersions })
      .from(projects)
      .innerJoin(designVersions, eq(designVersions.id, projects.currentVersionId))
      // Someone else's project is "not found": we don't reveal that it exists.
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
      .limit(1);

    if (!row) {
      throw new HttpError(404, 'not_found', 'Design not found.');
    }

    // Stored JSON is parsed on the way out: an older or hand-edited row fails
    // loudly here instead of confusing the canvas.
    const body: ProjectDetail = {
      id: row.project.id,
      name: row.project.name,
      createdAt: row.project.createdAt.toISOString(),
      updatedAt: row.project.updatedAt.toISOString(),
      requirements: requirementsSchema.parse(row.project.requirements),
      currentVersion: {
        id: row.version.id,
        versionNumber: row.version.versionNumber,
        changeSummary: row.version.changeSummary,
        createdAt: row.version.createdAt.toISOString(),
        design: designSchema.parse(row.version.designJson),
      },
    };
    res.json(body);
  });

  return router;
}
