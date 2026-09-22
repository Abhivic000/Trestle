# Project Context for Claude Code

This file is auto-loaded by Claude Code at the start of every session in this repo.
It summarizes decisions made in prior planning conversations (in claude.ai) so the
codebase can be built here without re-explaining context.

## What this project is

**Trestle** — an AI-powered system design generator. A user describes a project
(scale, features, budget, non-functional priorities) and the tool generates an
editable, interactive system architecture: a node-graph diagram where every
component carries a rationale, an industry comparison to real systems, and a
cost/traffic estimate. Users can request future changes in plain language
("add live chat") and the tool proposes a diff — additions/modifications shown
as a preview overlay — which the user must explicitly accept or reject before
it's merged and versioned. Nothing auto-applies.

Full requirements docs are in `docs/`:
- `docs/PRD.md` — product requirements, goals, features, user flows
- `docs/SRS.md` — detailed functional/non-functional requirements
- `docs/TECHNICAL_ARCHITECTURE.md` — data model, API endpoints, auth flow, RAG pipeline

## Current state of this repo

Phases 1 (environment) and 2 (project structure) are done. The repo is a pnpm
monorepo: `apps/web` (React + Vite), `apps/api` (Express, built with tsup),
`packages/shared` (types + Zod schemas, shipped as TS source). ESLint (type-aware)
+ Prettier, Husky pre-commit (lint-staged) and commit-msg (commitlint,
Conventional Commits) hooks, env validation with Zod in both apps.

Phase 3 (landing page / frontend shell) is done: Tailwind v4 theme tokens in
`apps/web/src/styles/index.css` (Trestle palette mapped onto shadcn/ui token
names), shadcn/ui (Radix base, "nova" preset; generated components in
`components/ui` import `cn` from shadcn's `cn` package), React Router 8 data
router (`router.tsx`, URLs centralised in `lib/paths.ts`), landing page, auth
page shells, "My designs", intake and canvas placeholders, 404 and error pages.
Design reference: the owner's landing.html / prototype.html mockups.

Phase 4 (auth + backend skeleton) is done:
- Auth: Supabase email + password, email confirmation OFF (free built-in SMTP
  only reaches team members, 2 emails/hour). Project uses ECC (asymmetric) JWT
  signing keys, so the API verifies tokens locally via `supabase.auth.getClaims()`
  in `apps/api/src/auth/require-auth.ts` (sets `req.user`; use `currentUser(req)`).
- Data isolation: the API connects as the DB owner (Drizzle + postgres.js via the
  Supabase session pooler, `DATABASE_URL`) and MUST scope every query to
  `currentUser(req).id`. RLS is enabled on every table with no policies, so the
  browser's publishable key can't read or write tables directly (verified: 403).
- DB: Drizzle schema in `apps/api/src/db/schema.ts`, migrations in
  `apps/api/drizzle/` (`db:generate` → review SQL → `db:migrate`). Tables:
  `projects`, `design_versions`. Pending diffs and corpus tables come in Phase 6.
- API: pino/pino-http one-line request logs with request ids, auth header
  redacted. Routes: `GET /health` (public), `GET /me`, `GET /projects`.
- Web: `AuthProvider` + `useAuth`, `RequireAuth` / `RedirectIfAuthenticated`
  route guards, `apiGet()` in `lib/api.ts` attaches the token and validates
  responses with shared Zod schemas.
- Supabase project region is Tokyo (ap-northeast-1): ~280ms per warm DB query
  from the owner's machine. That's network distance, not code.
- `docs/` is intentionally git-ignored (owner keeps planning docs private).

Phase 5 (end-to-end auth tests) is done:
- Vitest 5 at the repo root (`vitest.config.ts`) with projects `shared`,
  `api:unit`, `api:integration` (`*.int.test.ts`, real DB + Supabase auth) and
  `web` (jsdom + Testing Library). Playwright (`playwright.config.ts`, `e2e/`)
  drives installed Edge locally, Chromium in CI. `pnpm test`, `pnpm test:unit`,
  `pnpm test:e2e`.
- Tests use a SEPARATE free Supabase project, `trestle-test`, configured in
  `apps/api/.env.test` and `apps/web/.env.test` (git-ignored; see the
  `.env.test.example` files). `test-support/test-env.ts` refuses to run if a
  test env file shares a Supabase project id with the dev `.env`. Test servers
  use ports 4001 (API) / 5174 (web). E2E users are prefixed `e2e-` and swept
  before and after each run. `pnpm --filter @trestle/api db:migrate:test`
  migrates the test DB.
- The API no longer loads `.env` itself: launch scripts pass `--env-file`
  (`dev`, `dev:test`, `start`). drizzle-kit auto-loads `.env`, so the drizzle
  config reads its file explicitly (`drizzle.config.shared.ts`); never rely on
  process.env there.
- Auth redirects: `RedirectIfAuthenticated` honours `location.state.from` via
  `postSignInPath()` (`auth/redirect.ts`), because it fires as soon as the
  session updates. Sign-out navigates home BEFORE clearing the session.
- `apps/web/src/test/jest-dom-vitest.d.ts` is a temporary type bridge (jest-dom
  v7 doesn't type Vitest 5's `Matchers<R, T>` yet). Delete when jest-dom updates.
- CI: `.github/workflows/ci.yml` (checks job, then integration + e2e job using
  repo secrets `TEST_DATABASE_URL`, `TEST_SUPABASE_URL`,
  `TEST_SUPABASE_SECRET_KEY`, `TEST_SUPABASE_PUBLISHABLE_KEY`).

Phase 6 (main features) runs in steps: 6.1 design contract + intake ✅ ·
6.2 canvas · 6.3 reference library + retrieval · 6.4 grounded generation ·
6.5 edits + version history · 6.6 change requests (suggest-first diffs) ·
6.7 industry comparison · 6.8 cost & traffic. Cross-cutting decisions:
- Design JSON contract lives in `packages/shared/src/design.ts`
  (`schemaVersion` 1, components/connections/dataModel, `sources[]` per
  component for grounding, node positions inside the design so versions capture
  layout). Referential integrity is enforced in the schema itself.
- Requirements (intake answers) are stored in `projects.requirements`, one
  current set per project. `RequirementsInput` = pre-validation form type.
- Reference library: hand-curated pattern summaries first (written in our own
  words with source notes), automated ingestion later. Industry comparisons are
  curated library entries, not free-form AI output.
- Frontend server state: TanStack Query (`lib/queries.ts`, keys in `queryKeys`).
  Forms: React Hook Form + the shared Zod schemas.
- AI (from 6.4): structured JSON output validated with Zod, one retry, clear
  error rather than saving a broken design; per-user daily cap on AI actions;
  rationale without `sources[]` is shown as "ungrounded".
- Step 6.1 note: `POST /projects` stores a clearly-labelled placeholder design
  as version 1 (`design.origin === 'placeholder'`, `designs/placeholder-design.ts`).
  Real generation replaces it in 6.4.
- e2e note: choice chips are labels wrapping a visually hidden radio, so
  Playwright must click the visible label text, not `getByLabel`.

TypeScript is pinned to `~6.0.x` because typescript-eslint doesn't support
TypeScript 7 yet; revisit when it does. `@types/node` tracks Node 24.

## Key decisions already made (do not re-litigate without reason)

- **Tech stack**: React + React Flow + Tailwind CSS (frontend) · Node + Express
  (backend) · PostgreSQL + pgvector (data + RAG) · Supabase Auth (managed, free
  tier, scalable) · Google Gemini API free tier for generation and embeddings
  (see build decisions below).
- **Change-request flow is suggest-first, never auto-apply.** Any AI-proposed
  change to an existing design must render as a preview diff the user explicitly
  accepts or rejects — this is a hard product requirement, not just a UI choice.
- **Design state is structured JSON** (see `TECHNICAL_ARCHITECTURE.md` for the
  shape), stored per-version in Postgres — this is what makes diffing and version
  history possible. Don't collapse this back into a single mutable blob.
- **RAG grounding is required**, not optional — rationale and industry-comparison
  content should be traceable to a retrieved source, not freeform LLM generation.
  Corpus should store extracted patterns/summaries, never verbatim copyrighted text.
- **Visual identity**: dark theme, indigo accent (`#6C5CE7`), Inter font (display/
  body), JetBrains Mono (technical labels), blueprint/schematic motifs (grid
  backgrounds, dashed lines for pending/diff states).
- Product name is **Trestle** (renamed from an earlier placeholder "ArchitectAI").

## Build decisions (made in Claude Code sessions)

- **Zero cost.** Personal project, not meant to scale commercially. Use free
  tiers and free APIs only; flag any cost or card requirement.
- **AI provider: Google Gemini API free tier** (free-tier "Flash" models for
  generation, the Gemini embedding model for RAG). The owner's Claude Pro plan
  does not include API access. All AI calls go through a single provider adapter
  so the provider can be swapped later. All corpus chunks must be embedded with
  the same embedding model; re-embed if it changes. Free-tier inputs may be used
  by Google for training, so don't send sensitive data.
- **Language: TypeScript** across frontend and backend.
- **Package manager: pnpm** (workspaces for frontend / backend / shared types).
- **Database + auth: hosted Supabase (cloud) project**, using Supabase's Postgres
  with the `vector` (pgvector) extension enabled. No local Docker Supabase.
  Use the new `sb_publishable_...` key in the browser and the `sb_secret_...` key
  on the backend only; don't use the legacy `anon`/`service_role` keys. Free
  projects pause after 1 week of inactivity (restore from the dashboard).
- **Project location stays in OneDrive** (owner's choice). If installs fail
  with EPERM/EBUSY file locks, pause OneDrive syncing and retry.
- **Git:** the owner commits and pushes to GitHub themselves. Claude says when
  it's a good point to commit (with a suggested message). A `.gitignore` must
  exist before the first commit.
- Machine: Windows 11, Node 24, pnpm 10, Git, VS Code (all already installed).

## Screens required (per PRD user flows)

1. Landing page (marketing) — blueprint/schematic visual theme
2. Sign up / Login (Supabase Auth)
3. Requirement intake form (project type, features, scale, NFRs, budget)
4. Interactive design canvas — editable node-graph, side panel with Rationale /
   Industry Comparison / Cost & Traffic tabs, bottom add-on prompt bar, suggest-
   first diff review bar, version history drawer

## Working style preferences from prior sessions

- Prefers being walked through system design reasoning at a "why", not just
  "what" level — explanations should include tradeoffs, not just conclusions.
- Wants system design learned in enough depth to defend decisions in interviews
  at product-based companies, and to actually build real projects — not just
  memorize patterns.

## How to work with me on this project

I am the lead/manager on this project, not a hands-on engineer — treat yourself
as a professional dev team and me as the decision-maker you're briefing. Follow
this process on every phase of work:

1. **Discuss before building, every time.** Never jump straight to writing code
   or running setup commands. First explain what needs to happen in this phase
   and why, in plain language.
2. **When there's more than one reasonable way to do something, present the
   real options** (not just one "best practice" default) with the actual
   tradeoffs of each — cost, complexity, industry-standard-ness, how hard it is
   to change later. I will pick one, or ask follow-up questions if I don't
   understand a tradeoff. Do not proceed until I've chosen.
3. **Work in phases, in this order, and treat each as its own discuss-then-build
   step:** environment/dependency setup → project structure → landing page /
   frontend shell → authentication + backend skeleton → test that auth works
   end-to-end → main feature implementation (frontend + backend together).
   Don't skip ahead to a later phase even if it seems faster.
4. **Explain any command before running it** — what it does and why it's needed
   right now, not just what to type.
5. **Assume average/beginner technical knowledge.** No unexplained jargon,
   acronyms, or "just trust me" steps. If you use a term like ORM, JWT,
   middleware, container, etc. for the first time, define it briefly inline.
6. **At the end of each phase, give me a short "what to learn" list** tied to
   what we just did — e.g. if we set up Docker, tell me what concepts about
   Docker are worth understanding (images vs. containers, volumes, etc.) and
   point me to a specific resource (official docs, a well-regarded free
   tutorial/course) to learn it properly. The goal is that I could build a
   similar project on my own afterward, not just that this one works.
7. **Build to industry standard, not "good enough for one person's project."**
   Proper project structure, error handling, environment variable management,
   sensible commit hygiene — the kind of codebase a real team would ship, not
   shortcuts that only work because no one else will read this code.

In short: teach as you build, give me real decisions to make instead of making
them silently, and go phase by phase rather than generating the whole thing at
once.
