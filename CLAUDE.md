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
6.2 canvas ✅ · 6.3 reference library + retrieval ✅ · 6.4 grounded generation ✅ ·
6.5 edits + version history ✅ · 6.6 change requests (suggest-first diffs) ✅ ·
6.7 industry comparison ✅ · 6.8 cost & traffic ✅. Cross-cutting decisions:
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
- Step 6.2: React Flow (`@xyflow/react`) canvas lives in `apps/web/src/canvas/`
  (`DesignCanvas`, `DesignNode`, `ComponentPanel`, `design-to-flow.ts`,
  `component-kinds.ts`). The canvas is READ-ONLY for now (pan/zoom/select);
  dragging + saving arrives in 6.5, so positions come straight from the design.
  `designToFlow(design, statusOf)` already supports a per-id ChangeStatus
  (unchanged/added/modified/removed) that renders dashed amber nodes and edges:
  that is the diff-preview styling for 6.6. The React Flow attribution stays
  visible (MIT licence terms). No auto-layout library yet; add a "Tidy layout"
  button when users can add nodes.
- Navigation rules: both logos (marketing + app chrome) go to the landing page;
  the marketing nav and the landing CTAs switch to "My designs" / "Open my
  designs" when a session exists, and render a placeholder while auth is still
  loading so "Sign in" never flashes at a signed-in user.
- NEVER call `supabase.auth.signOut()` from the API error path (e.g. on a 401).
  supabase-js serialises auth calls with a lock: signing out while a sign-in is
  in flight hangs that sign-in and then drops the fresh session (it broke every
  auth e2e test). Let the client refresh tokens and let RequireAuth redirect.
- `ClearCacheOnUserChange` in `RootLayout` wipes the TanStack Query cache when
  the signed-in user changes, so one account never sees another's cached data.
- Step 6.3: reference library. Entries are hand-written TS data files in
  `apps/api/src/corpus/entries/` (validated by `corpusEntrySchema` at load).
  `corpus:ingest` (and `corpus:ingest:test`) embeds changed entries only, keyed
  by a content hash, and prunes rows whose entry was deleted. Embeddings:
  Gemini `gemini-embedding-001` at 768 dimensions, stored in `corpus_entries`
  with an HNSW cosine index; the model name is stored per row. `searchCorpus`
  does cosine similarity with an optional `patternType` filter and a minimum
  similarity. Tests use `createFakeEmbedder` (deterministic, no network, no
  quota), so they verify plumbing/filtering/ordering, NOT real semantics: check
  semantic quality by hand against the live API. Library size: 30 entries
  (24 patterns, 6 comparisons). Last hand-check over 12 paraphrased queries:
  10 ranked the right entry first, the other two were near-ties between two
  genuinely relevant entries. Entries retrieve better when they describe the
  SYMPTOM as well as the mechanism (adding symptom wording to
  `caching-read-through` moved it from outside the top 3 to rank 1).
- Step 6.4: generation. `POST /projects` now generates the design before it
  writes anything, so a failure leaves no half-made project (no more placeholder
  design). Flow: `retrieveEntriesForRequirements` (heuristic queries from the
  requirements, deduped, best score wins) → `DesignGenerator` → `resolveCitations`
  (drops slugs that were not supplied, keeping the design honest) → server-side
  `layoutComponents` (models are bad at coordinates) → `designSchema` validation.
- Design DEPTH is a prompt property, and the prompt is easy to get wrong. An
  early version said "prefer the simplest architecture", "4 to 10 components"
  and "smaller beats larger", and every design came out as
  client→gateway→service→database. The current prompt instead walks a checklist
  (edge/CDN, services, caching, datastore + scaling plan, async workers, object
  storage, search, identity, observability), sizes the component count by daily
  users, gives the model a computed requests/second estimate, and demands an
  alternative + tradeoff on EVERY component plus a named future bottleneck.
  Same requirements went from 5 components to 11, all grounded. Re-check this
  after any prompt edit: shallow output usually means the prompt asked for it.
- Gemini models: `gemini-3.6-flash` is nearly always 503 "high demand" on the
  free tier, so `DEFAULT_MODEL_CHAIN` falls through to `gemini-3.5-flash-lite`
  and `gemini-flash-lite-latest`. `gemini-2.5-flash*` are retired for new keys.
  Structured output (`responseMimeType` + `responseSchema`) works well; drafts
  are validated with Zod and retried once with the error fed back. Real run:
  ~16s, 13 entries retrieved, 7 components, 6/7 citing a source.
- AI services are injected: `createApp(dependencies)` with `AppDependencies`
  (`embedder`, `designGenerator`). Tests pass fakes; `USE_FAKE_AI=true` in
  `apps/api/.env.test` makes the e2e server deterministic and free.
  CI builds that file from secrets in `.github/workflows/ci.yml`, so ANY new
  variable must be added in BOTH places (`.env.test.example` and the workflow's
  heredoc). Forgetting `USE_FAKE_AI` there made CI call the real Gemini API with
  a placeholder key and every design-creation e2e test timed out. `playwright.config.ts`
  now refuses to start unless `USE_FAKE_AI=true`, so that mistake fails in
  seconds with a clear message.
- Per-account limit: `AI_DAILY_LIMIT` (default 20) counted from the `ai_requests`
  table over a rolling 24h, enforced before any model call. It is configurable
  because test runs burn through several AI actions per user (100 in `.env.test`);
  a fixed 20 made the integration suite fail with 429s halfway through.
- Canvas presentation rules (learned from real generated designs): node labels
  are long, so nodes are 216px wide and wrap to two lines rather than truncating;
  `NODE_WIDTH` in `DesignNode.tsx` must match `COLUMN_WIDTH` in the server
  `layout.ts`. Layout compacts unused role columns, otherwise fit-to-view shrinks
  the text. Edges are smoothstep with arrow markers and labels on opaque pills.
  Technology names get brand icons via `simple-icons` (`technology-icons.ts`);
  there are no Amazon/AWS icons in that set, so those fall back to the role icon.
- CONNECTION LABELS: the fix is SPACE, not stacking order. React Flow puts
  `.react-flow__edgelabel-renderer` before the nodes layer and neither sets a
  z-index, so nodes paint over labels and a label wider than the gap between
  columns showed only its middle. Raising that layer (`z-index: 5` in
  `index.css`) makes such labels readable but the owner rejected the result:
  labels sitting on top of boxes, covering component names, looked cluttered.
  The z-index stays as a safety net, but labels must now FIT IN THE GAP:
  `COLUMN_WIDTH` is 420 against a 216px node, leaving ~204px of clear air, and
  `ROW_HEIGHT` is 200. A wider graph is fine because `fitViewOptions` refuses to
  zoom below 0.6, so a big design opens scrollable at a readable size instead of
  shrunk to nothing; the owner explicitly prefers scrolling over tiny text.
- A connection between columns that are NOT neighbours has its midpoint on top
  of whatever sits between them, which no amount of spacing fixes.
  `nearestColumnGapCentre` (shared layout) pins those labels to the middle of a
  gap; connections inside one column keep the path midpoint so the label stays
  on the line it belongs to.
- Label length is now a function of zoom (`maxLabelCharsForZoom`): 34 characters
  zoomed in, 12 zoomed out, hidden below 0.45. Labels scale with the viewport,
  so a long one is unreadable and crowds the diagram when zoomed out.
- Verify canvas changes with a throwaway Playwright spec that screenshots the
  canvas at default, zoomed-in and zoomed-out, and LOOK at the images. This
  class of bug is invisible to assertions and survived two earlier attempts
  that were "verified" only by tests passing.
- Existing designs keep their stored positions, so they stay at the old cramped
  spacing until "Tidy layout" is used and saved. `layoutComponents` lives in
  `@trestle/shared` so the browser's "Tidy layout" button re-spaces an old design
  with exactly the server's layout (visual only until saving lands in 6.5).
- The canvas follows normal architecture-diagram conventions: left-to-right
  lanes (Clients → Edge → Services → Caching & async → Data & storage →
  External) with aligned column captions generated in `buildLaneHeaders`, and
  component names are never truncated. `COLUMN_BY_KIND` in the shared layout is
  the single definition of that reading order.
- Models paste citation slugs into prose ("...[auth-use-managed-identity-provider]").
  `stripInlineCitations` removes them before storage, and the prompt forbids it.
  Sources belong only in `sources[]`.
- Step 6.5: editing + versions. The canvas becomes editable by passing
  `onChange` to `DesignCanvas`; every edit helper is a pure function in
  `canvas/design-edits.ts` returning a NEW design (unit tested). Edits live in a
  local draft TAGGED WITH THE VERSION they were based on, so a save or restore
  retires the draft without an effect. `POST /projects/:id/edits` validates with
  `designSchema`, diffs against the current version for an automatic summary
  (`summariseDesignChange` in shared) and writes a new row; versions are never
  updated in place. `saveNewVersion` locks the project row (`SELECT ... FOR
  UPDATE`) so concurrent saves can't reuse a version number. Restoring writes
  the old design as a NEW version ("Restored version 1"); history is immutable.
- Adding a component by hand sets an honest rationale ("Added manually...") and
  no sources: never invent reasoning the AI did not produce.
- Step 6.6: change requests, the product's headline "suggest-first" rule. The AI
  never edits a design; it returns a PROPOSAL of discrete operations
  (`packages/shared/src/change-request.ts`: add/modify/remove component,
  add/remove connection) that the user accepts or rejects one by one. The
  guarantee is enforced on the SERVER, not just in the UI: proposals are stored
  in `change_proposals` (status pending/accepted/rejected) and only
  `POST /projects/:id/change-request/:id/accept` merges the chosen operation ids
  into a new version. Never add a code path that applies a proposal on its own.
- A proposal records the version it was made against. If the design has moved on
  since (a save, a restore, another accept), accepting returns 409
  `stale_proposal` rather than merging against a design the user never saw.
  Deciding an already-decided proposal returns 409 `already_decided`.
- `applyChangeOperations` SKIPS operations that no longer make sense (a
  connection whose component was rejected, a modify of a component someone
  deleted) and reports them, instead of failing the whole merge: a user who
  ticks half a proposal should still get a valid design. The merged result is
  re-validated with `designSchema` before it is saved (422 `invalid_result`).
- `buildChangePreview` powers the canvas overlay: additions and modifications
  are applied, but REMOVALS stay drawn and marked "removed", so the user can see
  what would disappear. It reuses the `statusById` styling already built in 6.2,
  and the canvas turns read-only while a proposal is open, so an edit can't race
  the merge.
- Structured output copes badly with discriminated unions, so the model is asked
  for a FLAT draft operation shape (`ai/change-prompt.ts`) that
  `propose-change.ts` then validates and narrows itself: it drops operations
  referencing unknown component ids, self-links and empty modifies, resolves
  citations, and lays out new components with the server layout. Assume the model
  will invent ids; the validation layer is what makes the feature safe, and the
  fake generator deliberately proposes a bad connection so that path stays tested.
- Real-model hand-check (the tests all use the fake generator, so they prove the
  plumbing, not the suggestion quality): "add live chat between users" returned a
  dedicated WebSocket chat service, a Cassandra store for append-heavy message
  logs, Redis pub/sub for presence and three connections (24s, 2/5 operations
  cited a source; connection operations rarely cite, which is expected).
  "drop the cache layer" correctly returned remove_connection + remove_component
  and nothing else. Re-run a check like this after any change-prompt edit.
- Step 6.7: the Compare tab. Comparisons are looked up ON DEMAND
  (`GET /projects/:id/components/:componentId/comparisons`) when the tab is
  opened, not stored in the design. That was a deliberate choice: the comparison
  is reference material rather than part of the decision record, so growing the
  library improves designs that already exist, and components the user added by
  hand get comparisons too. The browser caches per component with
  `staleTime: Infinity`, so switching components does not re-search.
- Comparisons come only from `kind: 'comparison'` library entries, never from
  the model. An LLM asked to describe how a named company works will invent
  details, so the Compare tab must stay traceable to a checked write-up.
- SIMILARITY ALONE IS NOT ENOUGH for this. With the real embedder, an unrelated
  component and entry still score around 0.6, so a plain nearest-neighbour
  search confidently offered Dropbox's block storage as the comparison for a
  generic "Meme Core Service", and all 14 components of a real design "matched".
  `comparisonTopicsByComponentKind` (shared) narrows to plausible pattern types
  for the component's kind FIRST, then similarity ranks within that set. After
  that every top hit was right: cache→Facebook memcache, queue→Slack, search→
  GitHub code search, storage→Dropbox, database→Figma/Notion sharding, identity→
  BeyondCorp, observability→Dapper, gateway→Zuul, service→Segment. A kind with
  no listed topics (`client`) returns nothing and the UI says so, which is
  better than the closest wrong thing; the search skips the embedding call
  entirely in that case.
- Library grew to 40 entries (24 patterns, 16 comparisons). Every `sourceUrl`
  was checked with an actual request before being committed: one candidate URL
  was a 404 and one had moved (Segment's blog now redirects to twilio.com).
  Medium-hosted posts (`netflixtechblog.com`) return 403 to any automated fetch,
  so they cannot be verified and were replaced with sources that can be.
- Browser tests need the library in the test database, so `global-setup.ts`
  seeds it via `seedCorpusForTests`, embedding with the FAKE embedder because
  the test server searches with the fake embedder: vectors must come from the
  same model as the query or every lookup returns nothing. It seeds with
  `prune: false` so it never deletes fixtures another suite created. Note that
  `corpus:ingest:test` is a different thing and calls the REAL embedding API,
  which fails against the placeholder key in `.env.test`.
- Because the corpus table is shared, integration tests must not assume it holds
  only their own fixtures: the ranking test now filters to its own slugs.
- Step 6.8: cost & traffic. `packages/shared/src/capacity.ts` is a PURE
  calculator: no AI, no API call, no stored estimate. The browser recomputes it
  from the design in front of the user, so manual edits and pending proposals
  are costed instantly and nothing can go stale. Models are unreliable at
  arithmetic and will state a confident price with nothing behind it, which is
  the opposite of what this product claims to do, so this stayed ordinary code.
- `estimateTraffic` is now the single source of the daily-users-to-requests
  figures, shared by the generation prompt and the Cost tab so the model and
  the user can never be shown different numbers.
- Traffic is modelled by following a request through the system: a CDN absorbs
  half of reads, a cache answers 80% of what reaches the origin, and only the
  misses plus every write reach the database. Components of the same kind split
  their slice. All the assumptions are named constants at the top of the file
  and are displayed in the Cost tab, because these are our figures, not a
  vendor's.
- Costs are provider-neutral monthly BANDS by component kind and size tier, not
  a named vendor's SKU: prices change constantly and the useful lesson is the
  shape of the cost. `client` and `external` are deliberately not priced ("we
  will not guess") and contribute nothing to the total.
- THE BOTTLENECK IS NOT THE BUSIEST COMPONENT. The first attempt ranked by
  traffic multiplied by a "hard to scale" weight, and in a read-heavy design it
  named the CACHE, which takes 90% of reads. That is backwards: the cache is
  there precisely to absorb that load and is nowhere near its limit. The model
  now gives each kind a soft ceiling in requests/second and reports whichever
  component uses the largest FRACTION of its ceiling at ten times today's
  users. Ratios between the ceilings matter, not their absolute values.
- WEB UNIT TESTS MUST NOT DEPEND ON `apps/web/.env`. `src/env.ts` validates the
  browser configuration the moment it is imported, and anything reaching
  `lib/api` pulls it in, so a test that imports `ApiError` crashes where no
  `.env` exists. That passes locally (developers have one) and fails in CI,
  whose checks job writes no env files at all. The `web` project in
  `vitest.config.ts` now supplies its own stand-in VITE_ values. To reproduce a
  CI check locally, rename `apps/web/.env` away and run the checks sequence.
- Deleting a component must also drop its connections and data-model entries, or
  the design fails `designSchema`'s referential checks on save.
- NEVER write files containing non-ASCII (…, ·) with PowerShell `Set-Content`:
  it mangles them into mojibake. Use the Write/Edit tools or a node script.
- Any label wrapping an `sr-only` (visually hidden, absolutely positioned) input
  MUST also be `relative`. Without it the input anchors to the document instead
  of the label, which grew the page past the `h-dvh` app shell and produced a
  second scrollbar with empty background. An e2e test asserts the document does
  not scroll on /designs/new.

TypeScript is pinned to `~6.0.x` because typescript-eslint doesn't support
TypeScript 7 yet; revisit when it does. `@types/node` tracks Node 24.

Phase 7 (deployment) is configured but NOT yet live: the owner runs the Render
steps themselves. See `DEPLOYMENT.md` in the repo root (not `docs/`, which is
git-ignored, and a deploy guide has to be readable from the repository).
- Both services are described by `render.yaml` as a Render Blueprint:
  `trestle-api` (Node web service, free) and `trestle-web` (static site, free).
  Infrastructure as code, so the deployment is reviewable in a diff rather than
  clicked together in a dashboard.
- Secrets and the two service URLs are `sync: false`, meaning Render prompts for
  them and they never enter git. `WEB_ORIGIN` and `VITE_API_URL` cannot be known
  until each service has deployed once, so they are filled in afterwards.
  `VITE_*` values are baked in at BUILD time, so changing one needs a redeploy,
  not a restart.
- The free API service SLEEPS after 15 minutes idle and takes about a minute to
  wake. `WakingServerNotice` explains that on screen after 6 seconds rather than
  spinning silently. Render allows 750 instance hours a month, which is about
  one always-on service (a 31-day month is 744), so a keep-alive ping would fit
  but leave no room for a second service; the owner chose to let it sleep.
- Supabase free allows only 2 ACTIVE PROJECTS per organisation, and both are
  taken by the dev and `trestle-test` projects. Rather than lose CI, the dev
  project doubles as production: local development writes to the same database
  live visitors use. Revisit if the demo ever holds anything that matters.
- `AI_DAILY_LIMIT` is 5 in `render.yaml` against a local default of 20, because
  a public demo spends a Gemini free quota shared by everyone who signs up.
- Email confirmation stays OFF: Supabase's free built-in SMTP only delivers to
  team members, so enabling it would stop anyone from signing up. Visitors can
  therefore register with an address they do not own.
- RENDER BUILD COMMANDS: never a bare `corepack enable`. Render ships pnpm at
  `/usr/bin/pnpm` on a read-only filesystem, so corepack fails with
  `EROFS: read-only file system, unlink '/usr/bin/pnpm'` and the deploy dies
  before installing anything. Both services install corepack's shims into
  `/tmp/corepack` (the directory must be created first, or corepack fails with
  ENOENT) and prefix `PATH` per command, which also pins pnpm to the exact
  `packageManager` version instead of the build image's. `pnpm install` passes
  `--prod=false` because the API service runs with `NODE_ENV=production` and the
  build needs devDependencies (tsup, vite, typescript).
- The API bundle must run standalone (`node apps/api/dist/index.js`) with no
  `.env` present; tsup bundles `@trestle/shared` in for that reason. Verify a
  deployment change by running that command with no environment set: it should
  fail fast listing exactly the variables the host has to provide.

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

## Backlog (noticed, NOT built: confirm with the owner before building any of these)

Add to this list whenever something worth doing is noticed mid-task; never build
from it without asking. Remove an item once it ships.

1. Canvas: the design-summary overlay can cover nodes; make it collapsible.
2. Canvas: keyboard navigation between nodes (React Flow supports it).
3. Canvas: minimap for large designs.
4. Rename a project (the name is currently derived from the project type).
5. Delete a project (and its versions).
6. My designs: search/sort once a user has many designs.
7. Limit the number of projects per account (pairs with the AI rate limit in 6.4).
8. Password reset flow (blocked: needs a real email provider, see Phase 4 notes).
9. "Continue with Google" sign-in (Phase 4 decision 1, option B).
10. Toast notifications for transient errors (today everything is inline).
11. Landing page: replace the generic grounding claims with real numbers once the
    reference library exists.
12. Remove `apps/web/src/test/jest-dom-vitest.d.ts` when jest-dom types Vitest 5.
13. Move to TypeScript 7 when typescript-eslint supports it.
14. Supabase minimum password length: the owner could not find the setting; the
    form enforces 8, the server default is 6.
15. Supabase region is Tokyo (~280ms/query for the owner); moving means a new
    project. Decided to keep for now.
16. Reference library: grow past 40 entries. Comparisons now cover the common
    component kinds, but there is still nothing for realtime/websockets,
    ML-ish workloads, or payments, and only one comparison per topic for
    several topics (so the Compare tab often has a single card).
17. Retrieval: add keyword+vector hybrid search if topic-filtered similarity
    proves too blunt once generation is using it (step 6.4 will show).
18. The rationale panel still only says "Ungrounded" or nothing; it should name
    and link the library entries a component's `sources[]` actually cites, the
    way the Compare tab now does. (The Compare half of this shipped in 6.7.)
19. Designs generated before the layout change keep their old, wider spacing;
    a "Tidy layout" action would re-run `layoutComponents` on an existing design.
20. Edge label pills can still overlap a node edge on dense designs; consider
    showing labels only on hover/selection.

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
