import {
  designSchema,
  summariseDesignChange,
  type Design,
  type ProjectDetail,
} from '@trestle/shared';
import { and, eq, sql as raw } from 'drizzle-orm';
import type { Database } from '../db/client';
import { designVersions, projects } from '../db/schema';
import { HttpError } from '../errors';

/**
 * Adds a new version to a project and points the project at it.
 *
 * Versions are immutable: nothing ever edits an existing row, which is what
 * makes history trustworthy. The insert, the version number and the pointer all
 * move together in one transaction.
 */
export async function saveNewVersion(
  db: Database,
  {
    projectId,
    userId,
    design,
    changeSummary,
    generatorModel = null,
  }: {
    projectId: string;
    userId: string;
    design: Design;
    changeSummary: string;
    generatorModel?: string | null;
  },
): Promise<ProjectDetail> {
  return db.transaction(async (tx) => {
    // Lock the project row so two saves can't claim the same version number.
    const [project] = await tx
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .for('update')
      .limit(1);

    if (!project) throw new HttpError(404, 'not_found', 'Design not found.');

    const [{ maxVersion } = { maxVersion: 0 }] = await tx
      .select({ maxVersion: raw<number>`coalesce(max(${designVersions.versionNumber}), 0)` })
      .from(designVersions)
      .where(eq(designVersions.projectId, projectId));

    const [version] = await tx
      .insert(designVersions)
      .values({
        projectId,
        versionNumber: Number(maxVersion) + 1,
        designJson: design,
        changeSummary,
        generatorModel,
      })
      .returning();
    if (!version) throw new Error('Insert returned no design version row');

    const [updated] = await tx
      .update(projects)
      .set({ currentVersionId: version.id, updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning();
    if (!updated) throw new Error('Update returned no project row');

    return {
      id: updated.id,
      name: updated.name,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      requirements: updated.requirements as ProjectDetail['requirements'],
      currentVersion: {
        id: version.id,
        versionNumber: version.versionNumber,
        changeSummary: version.changeSummary,
        createdAt: version.createdAt.toISOString(),
        design,
      },
    };
  });
}

/** Loads one version of a project the user owns. */
export async function loadVersion(
  db: Database,
  projectId: string,
  userId: string,
  versionId: string,
): Promise<{ design: Design; versionNumber: number }> {
  const [row] = await db
    .select({ version: designVersions })
    .from(designVersions)
    .innerJoin(projects, eq(projects.id, designVersions.projectId))
    .where(
      and(
        eq(designVersions.id, versionId),
        eq(designVersions.projectId, projectId),
        eq(projects.userId, userId),
      ),
    )
    .limit(1);

  if (!row) throw new HttpError(404, 'not_found', 'Version not found.');

  return {
    design: designSchema.parse(row.version.designJson),
    versionNumber: row.version.versionNumber,
  };
}

/** Change summary for a manual save, e.g. "Added 1 component, moved 3 components". */
export function describeManualEdit(previous: Design, next: Design): string {
  return summariseDesignChange(previous, next);
}
