import { desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import type { ListProjectsResponse } from '@trestle/shared';
import { currentUser } from '../auth/require-auth';
import { db } from '../db/client';
import { projects } from '../db/schema';

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
