# Deploying Trestle

Everything below is described by `render.yaml` in the repository root, so the
services are created for you rather than clicked together by hand. You only
need to supply the secrets, which never belong in git.

## What gets deployed

| Service       | What it is                        | Plan | Notes                                    |
| ------------- | --------------------------------- | ---- | ---------------------------------------- |
| `trestle-api` | The Express server on Node        | Free | Sleeps after 15 min idle, ~1 min to wake |
| `trestle-web` | The built React app, static files | Free | Served from a CDN, never sleeps          |

The database and authentication stay on the existing Supabase project. Nothing
new is created there.

### The one thing to know before you share the link

The free API plan stops the server after fifteen minutes without traffic, and
starting it again takes about a minute. The first person to visit a cold demo
waits, then waits again for the design to generate. The app says so on screen
rather than spinning silently, but it is worth expecting.

The Supabase free plan also pauses a project after a week with no activity. If
the demo has been quiet for longer than that, restore it from the Supabase
dashboard before sharing the link.

## Before you start

- The repository must be pushed to GitHub; Render deploys from a branch.
- A Render account, signed in with that GitHub account.
- The values from `apps/api/.env` and `apps/web/.env` to hand.

## 1. Create the services

In Render, choose **New → Blueprint**, pick this repository, and let it read
`render.yaml`. It will offer to create `trestle-api` and `trestle-web`, and ask
for every value marked `sync: false`. Fill in what you can now; two of them are
not known yet and are covered in step 2.

For `trestle-api`:

| Variable              | Where it comes from                                           |
| --------------------- | ------------------------------------------------------------- |
| `DATABASE_URL`        | Same as `apps/api/.env` — the Supabase **session pooler** URI |
| `SUPABASE_URL`        | Same as `apps/api/.env`                                       |
| `SUPABASE_SECRET_KEY` | The `sb_secret_...` key. Server only — never in the browser   |
| `GEMINI_API_KEY`      | Same as `apps/api/.env`                                       |
| `WEB_ORIGIN`          | Not known yet — see step 2                                    |

For `trestle-web`:

| Variable                        | Where it comes from                              |
| ------------------------------- | ------------------------------------------------ |
| `VITE_SUPABASE_URL`             | Same as `apps/web/.env`                          |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The `sb_publishable_...` key (safe in a browser) |
| `VITE_API_URL`                  | Not known yet — see step 2                       |

The API also gets `AI_DAILY_LIMIT=5` from `render.yaml`: lower than the local
default of 20, because a public demo spends a free Gemini quota shared by
everyone who signs up.

## 2. Tell the two services about each other

Render assigns each service a URL on the first deploy, so this cannot be filled
in ahead of time. Once both have deployed once, copy each URL into the other:

1. Open `trestle-api` → **Environment** → set `WEB_ORIGIN` to the `trestle-web`
   URL, for example `https://trestle-web.onrender.com`. **No trailing slash.**
   This is what the API's CORS check compares against: if it does not match
   exactly, every request from the browser is refused.
2. Open `trestle-web` → **Environment** → set `VITE_API_URL` to the
   `trestle-api` URL.
3. Redeploy `trestle-web`. Vite reads `VITE_*` variables when it **builds** and
   writes the value into the bundle, so a restart is not enough — it needs a
   fresh build.

## 3. Let Supabase accept the deployed site

In the Supabase dashboard, under **Authentication → URL Configuration**, set
the **Site URL** to the `trestle-web` URL and add it to **Redirect URLs**.
Supabase refuses to send an authenticated user back to an address it has not
been told about.

## 4. Check it works

1. Open the web URL. The landing page should appear immediately (static files).
2. Sign up. The first request wakes the API, so expect the "waking the demo
   server" message.
3. Create a design. This calls Gemini and takes roughly 20 seconds.
4. Open a component, then its Compare and Cost tabs.
5. Ask for a change, then reject it, then ask again and accept part of it.

If sign-in works but nothing loads, it is almost always `WEB_ORIGIN`: check the
browser console for a CORS error, and check for a trailing slash.

## Deploying again

Pushing to the default branch redeploys both services. `render.yaml` is read on
each deploy, so changing a non-secret value there (the AI limit, say) ships with
an ordinary commit. Secrets are only ever edited in the dashboard.

To roll back, use **Deploys → Rollback** on the service; it redeploys the
previous build without touching the database.

## Costs

Everything here is on a free plan and no card is required. The limits that
actually bite:

- Render gives 750 free instance hours a month across the workspace, which is
  roughly one always-on service. Sleeping keeps this well under the cap.
- Supabase free allows 2 active projects, 500 MB of database and 5 GB of
  egress. This project uses one of those slots; the CI test project uses the
  other.
- The Gemini free tier is per API key, shared by every visitor. That is what
  `AI_DAILY_LIMIT` protects.
