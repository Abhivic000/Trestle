import { z } from 'zod';
import { designSchema } from './design';
import { requirementsSchema } from './requirements';

/** Body of every non-2xx API response. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

/** `GET /me`: the signed-in user, as the API sees them. */
export const meResponseSchema = z.object({
  id: z.uuid(),
  email: z.email().nullable(),
});

export type MeResponse = z.infer<typeof meResponseSchema>;

export const projectSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export type ProjectSummary = z.infer<typeof projectSummarySchema>;

/** `GET /projects`: the signed-in user's projects, most recently updated first. */
export const listProjectsResponseSchema = z.object({
  projects: z.array(projectSummarySchema),
});

export type ListProjectsResponse = z.infer<typeof listProjectsResponseSchema>;

/** `POST /projects`: create a project from the intake form. */
export const createProjectRequestSchema = z.object({
  requirements: requirementsSchema,
});

export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;

export const designVersionSchema = z.object({
  id: z.uuid(),
  versionNumber: z.number().int().positive(),
  changeSummary: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  design: designSchema,
});

export type DesignVersion = z.infer<typeof designVersionSchema>;

/** `GET /projects/:id` and the body returned by `POST /projects`. */
export const projectDetailSchema = projectSummarySchema.extend({
  requirements: requirementsSchema,
  currentVersion: designVersionSchema,
});

export type ProjectDetail = z.infer<typeof projectDetailSchema>;

/** `POST /projects/:id/edits`: save manual canvas edits as a new version. */
export const saveEditsRequestSchema = z.object({
  design: designSchema,
});

export type SaveEditsRequest = z.infer<typeof saveEditsRequestSchema>;

/** A row in the version history drawer (without the full design). */
export const designVersionSummarySchema = z.object({
  id: z.uuid(),
  versionNumber: z.number().int().positive(),
  changeSummary: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  /** Which AI model produced it, or null for a manual edit. */
  generatorModel: z.string().nullable(),
  isCurrent: z.boolean(),
});

export type DesignVersionSummary = z.infer<typeof designVersionSummarySchema>;

export const listVersionsResponseSchema = z.object({
  versions: z.array(designVersionSummarySchema),
});

export type ListVersionsResponse = z.infer<typeof listVersionsResponseSchema>;
