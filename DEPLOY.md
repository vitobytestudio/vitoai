# Launching NEXUS STUDIO on vitobytestudio.workers.dev

The studio is a **static bundle plus a 20-line Worker**. There is no render
service, no queue, no database. Films are encoded in the visitor's browser, so
the backend has nothing to do — which is why the beta can be free.

Deploy takes about a minute. Pick one path.

---

## Path A — from your own machine (gives exactly `vitobytestudio.workers.dev`)

Requires Node 18+.

```bash
git clone https://github.com/vitobytestudio/vitoai.git
cd vitoai
git checkout arena/c36750ba-vitoai

npm ci
node studio/build.mjs          # bundles the studio into studio/dist
npx wrangler login             # opens the browser, one click
npx wrangler deploy            # reads wrangler.toml
```

`wrangler.toml` already sets `name = "vitobytestudio"`, so the first deploy
creates **https://vitobytestudio.workers.dev** on your account.

To use a different subdomain, change `name` in `wrangler.toml` before deploying.

### Re-deploying after a change
```bash
git pull && npm ci && node studio/build.mjs && npx wrangler deploy
```

---

## Path B — no tooling at all (Cloudflare dashboard)

1. Download **`deploy/studio-dist.zip`** from the repo.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Upload assets**.
3. Project name: `vitobytestudio` → drop the zip → **Deploy**.
4. You get **https://vitobytestudio.pages.dev**.

Pages serves the same bundle. The only difference is the domain: `pages.dev`
instead of `workers.dev`. If you specifically want the `workers.dev` name, use
Path A or C — Workers custom domains do not map onto a Pages project.

---

## Path C — automatic on every push (recommended after the first deploy)

The workflow is already in the repo at `.github/workflows/deploy.yml`.

1. Cloudflare dashboard → **My Profile** → **API Tokens** → **Create Token** →
   template **Edit Cloudflare Workers**.
2. Copy the token. In GitHub: **Settings → Secrets and variables → Actions** →
   new repository secret:
   - `CLOUDFLARE_API_TOKEN` — the token from step 1
   - `CLOUDFLARE_ACCOUNT_ID` — from the Workers dashboard URL
     (`dash.cloudflare.com/<account id>/workers`)
3. Push anything under `studio/`. The Action builds and deploys.

---

## Why the sandbox could not do it for you

This environment's outbound network allows GitHub, npm and PyPI only.
`api.cloudflare.com` is blocked, so `wrangler deploy` fails here with
`fetch failed` — the bundle it would upload is correct, the request just never
leaves. Everything else is done: the config, the worker entry, the built assets,
the zip, and the CI workflow.

---

## The agent (optional, free)

`wrangler.toml` already binds Workers AI:

```toml
[ai]
binding = "AI"

[vars]
PLAN_MODEL = "@cf/meta/llama-3.1-8b-instruct"
```

On deploy you get two endpoints:

| Endpoint | Does | Model |
|---|---|---|
| `POST /api/plan` | brief → storyboard JSON | Llama 3.1 8B |
| `GET /api/health` | reports whether AI is bound | — |

Only the *plan* uses a model. Everything you see after it is built in the
browser from geometry — there is no image endpoint, because a place built from
code can be any place, at any hour, from any angle, for nothing.

### The loop

```
plan → compose → LOOK AT IT → judge → fix → look again
```

The plan may come from a model or from the built-in planner. Then the studio
composes the film from the library, reviews it in plain arithmetic
(`src/studio/critic.ts`) and repairs what is wrong: caption too long, headline
overflowing the frame, three identical beats in a row, the same cut three times,
an accent that fails contrast, a film over budget.

Two rounds, then it stops. The first round fixes what is obviously broken; the
second catches what the first fix broke — which is how the logo card was caught
being trimmed below its own minimum. Both rounds print into the "what the agent
did" panel, so nothing about the process is hidden.

## Why the video is still not rendered on the server

The agent plans and shoots *stills*. The film — cuts, camera moves, type,
transitions — is assembled and encoded in the browser. A server-side video
render at 30 s of 1080p would cost real money per export and need a queue.
The browser does it for zero. Keep it that way.

## What is actually deployed

| File | Purpose |
|---|---|
| `studio/dist/index.html` | the page |
| `studio/dist/app.js` | React + Remotion Player + WebCodecs, ~2.6 MB |
| `studio/dist/app.css` | the shell |
| `studio/dist/public/fonts/*` | JetBrains Mono, Space Grotesk, Sora |
| `studio/worker.js` | adds headers, serves assets |

Bindings: `ASSETS` only. No KV, no D1, no R2, no secrets.

## Limits of the browser renderer — state these on the pricing page

- H.264 encoding needs **Chrome/Edge 94+, Safari 17+**. Firefox lacks
  MediaRecorder's MP4 path and falls back to WebM.
- A phone will encode a 10 s 720p film in roughly 20–60 s. A laptop, 3–8 s.
- The overlay tool plays the uploaded clip in real time, so a 30 s clip takes
  30 s to record. Keep the tab in front.
- Nothing is uploaded anywhere. That is a feature for enterprise buyers, and it
  is why there is no per-export cost.


## The address

The site is `nexus.vitobytestudio.workers.dev`. That is not a custom domain: it is
the Worker named `nexus` under the account's `workers.dev` subdomain, so the name
in `wrangler.toml` is the address. Changing `name` moves the site.

Every page answers on a cold load, because the Worker serves the single-page app
for unknown paths (`not_found_handling = "single-page-application"`):

    /            home
    /studio      the tool
    /models      three engines and the comparison
    /about       what it is, what it is not
    /privacy     the privacy note (trial version)
    /terms       the terms (trial version)
    /feedback    the trial's feedback form
    /inbox       the feedback inbox, gated by FEEDBACK_KEY

The deploy smoke test now fetches every one of those pages and both endpoints, so
a broken route fails the build instead of the visitor.

## Feedback storage

`POST /api/feedback` writes to a KV namespace bound as `FEEDBACK` when one exists.
The workflow tries to find or create that namespace after installing, and appends
the binding to `wrangler.toml` for the deploy — best effort, `continue-on-error`.
Without a namespace the note still goes to the Worker log (observability is on),
and `/api/feedback` answers `{"ok":true,"stored":false}`: the visitor is told the
truth rather than a form that silently eats a complaint.

`/inbox` requires `FEEDBACK_KEY`. It is set in `[vars]` today so the owner can
open it immediately; rotate it with `npx wrangler secret put FEEDBACK_KEY`, which
takes precedence over the plain var.
