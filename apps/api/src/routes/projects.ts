import {
  createProjectRequestSchema,
  designSchema,
  projectNameFromRequirements,
  requirementsSchema,
  type ListProjectsResponse,
  type ProjectDetail,
} from '@trestle/shared';
import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { currentUser } from '../auth/require-auth';
import { db } from '../db/client';
import { designVersions, projects } from '../db/schema';
import { buildPlaceholderDesign } from '../designs/placeholder-design';
import { HttpError } from '../errors';

export const projectsRouter = Router();

// Every query here MUST be scoped to currentUser(req).id. That is what keeps
// users' data apart (the database's RLS only blocks direct browser access).

projectsRouter.get('/', async (req, res) => {
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

projectsRouter.post('/', async (req, res) => {
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
  const design = buildPlaceholderDesign(requirements);

  // One transaction: project, its first version, and the pointer to that version
  // all land together, or none of them do.
  const project = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(projects)
      .values({
        userId: user.id,
        name: projectNameFromRequirements(requirements),
        requirements,
      })
      .returning();
    if (!created) throw new Error('Insert returned no project row');

    const [version] = await tx
      .insert(designVersions)
      .values({
        projectId: created.id,
        versionNumber: 1,
        designJson: design,
        changeSummary: 'Initial design',
      })
      .returning();
    if (!version) throw new Error('Insert returned no design version row');

    const [updated] = await tx
      .update(projects)
      .set({ currentVersionId: version.id })
      .where(eq(projects.id, created.id))
      .returning();
    if (!updated) throw new Error('Update returned no project row');

    return { project: updated, version };
  });

  const body: ProjectDetail = {
    id: project.project.id,
    name: project.project.name,
    createdAt: project.project.createdAt.toISOString(),
    updatedAt: project.project.updatedAt.toISOString(),
    requirements,
    currentVersion: {
      id: project.version.id,
      versionNumber: project.version.versionNumber,
      changeSummary: project.version.changeSummary,
      createdAt: project.version.createdAt.toISOString(),
      design,
    },
  };
  res.status(201).json(body);
});

projectsRouter.get('/:projectId', async (req, res) => {
  const user = currentUser(req);
  const { projectId } = req.params;

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
