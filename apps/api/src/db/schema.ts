import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  vector,
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
    /** Which AI model produced this version, if any (null for manual edits). */
    generatorModel: text('generator_model'),
    createdAt: timestamps.createdAt,
  },
  // Version numbers are unique within a project (v1, v2, ...). Versions are never updated.
  (table) => [
    unique('design_versions_project_version_uq').on(table.projectId, table.versionNumber),
  ],
).enableRLS();

/** One row per AI action, used to enforce the per-account daily limit. */
export const aiRequests = pgTable(
  'ai_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    /** 'generate' | 'change_request' */
    kind: text('kind').notNull(),
    model: text('model').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('ai_requests_user_created_idx').on(table.userId, table.createdAt)],
).enableRLS();

/**
 * The reference library that grounds generated rationale. Rows are loaded from
 * the seed files by `pnpm --filter @trestle/api corpus:ingest`; nothing here is
 * user data, and no user writes to it.
 */
export const EMBEDDING_DIMENSIONS = 768;

export const corpusEntries = pgTable(
  'corpus_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Stable id from the seed file; entries are updated in place by slug. */
    slug: text('slug').notNull().unique(),
    kind: text('kind').notNull(),
    patternType: text('pattern_type').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    whenToUse: text('when_to_use').notNull(),
    whenNotToUse: text('when_not_to_use').notNull(),
    tradeoffs: jsonb('tradeoffs').notNull(),
    sourceNote: text('source_note').notNull(),
    sourceUrl: text('source_url'),
    /** The meaning of the entry as numbers; used for similarity search. */
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }),
    /** Hash of the embedded text: lets ingest skip unchanged entries. */
    contentHash: text('content_hash').notNull(),
    embeddingModel: text('embedding_model'),
    ...timestamps,
  },
  (table) => [
    index('corpus_entries_pattern_type_idx').on(table.patternType),
    // HNSW index for fast "closest meaning" lookups using cosine distance.
    index('corpus_entries_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  ],
).enableRLS();
