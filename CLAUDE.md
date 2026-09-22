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
Conventional Commits) hooks, env validation with Zod in both apps. Next phase:
landing page / frontend shell (Tailwind, theme, routing).

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
