import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { authUsers } from 'drizzle-orm/supabase';

/*
 * Database tables, defined in TypeScript. `pnpm db:generate` turns changes here
 * into a numbered SQL migration in apps/api/drizzle/; `pnpm db:migrate` applies it.
 *
 * Row-Level Security is enabled on every table with NO policies: browsers (which
 * hold the public publishable key) can't read or write anything directly. Only
 * this API, connecting as the database owner, can, and it scopes every query to
 * the signed-in user.
 */

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Owner. Deleting the Supabase user deletes their projects.
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // The intake answers this project was created from (@trestle/shared Requirements).
    requirements: jsonb('requirements').notNull(),
    // Points at the latest accepted version. Null only briefly while creating a project.
    currentVersionId: uuid('current_version_id').references((): AnyPgColumn => designVersions.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (table) => [index('projects_user_id_idx').on(table.userId)],
).enableRLS();

export const designVersions = pgTable(
  'design_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    // Full structured design state. Its exact shape is defined in @trestle/shared
    // when the generation feature is built.
    designJson: jsonb('design_json').notNull(),
    changeSummary: text('change_summary'),
    createdAt: timestamps.createdAt,
  },
  // Version numbers are unique within a project (v1, v2, ...). Versions are never updated.
  (table) => [
    unique('design_versions_project_version_uq').on(table.projectId, table.versionNumber),
  ],
).enableRLS();
