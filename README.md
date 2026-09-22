# Trestle

AI-powered system design generator. Describe a project and Trestle generates an
editable architecture diagram where every component carries a rationale, an
industry comparison and a cost estimate. Change requests are proposed as a
preview diff you accept or reject, and every accepted change is versioned.

Requirements and design docs live in [`docs/`](docs/).

## Repository layout

```
apps/
  web/        React + Vite frontend (browser)
  api/        Express REST API (Node.js)
packages/
  shared/     Types and validation schemas used by both apps
docs/         PRD, SRS, technical architecture
```

This is a [pnpm workspace](https://pnpm.io/workspaces) (monorepo): one repo,
several packages, one lockfile.

## Prerequisites

- Node.js 24 (see `.nvmrc`)
- pnpm 10 (`npm install -g pnpm@10`)
- A Supabase project with the `vector` extension enabled
- A Google Gemini API key (free tier; keep billing off)

## Setup

```sh
pnpm install
```

Create the environment files from the templates and fill in real values:

```sh
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

- `apps/api/.env`: Supabase URL + **secret** key, Gemini key (server only).
- `apps/web/.env`: Supabase URL + **publishable** key, API URL (public).

`.env` files are git-ignored. Never commit real keys. Both apps validate their
configuration on startup and report exactly what is missing.

## Development

```sh
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:4000 (health check at `/health`)

## Scripts (run from the repo root)

| Command             | What it does                             |
| ------------------- | ---------------------------------------- |
| `pnpm dev`          | Run web and API with live reload         |
| `pnpm build`        | Production build of every package        |
| `pnpm typecheck`    | TypeScript type check of every package   |
| `pnpm lint`         | ESLint (`pnpm lint:fix` to auto-fix)     |
| `pnpm format`       | Format all files with Prettier           |
| `pnpm format:check` | Verify formatting without changing files |

## Commit conventions

Commits follow [Conventional Commits](https://www.conventionalcommits.org),
e.g. `feat(web): add intake form` or `fix(api): handle empty body`. A git hook
(Husky) lints and formats staged files and checks the message on every commit.
