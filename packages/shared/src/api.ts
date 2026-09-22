import { z } from 'zod';

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
