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
| `POST /api/shot` | prompt → 1024px JPEG | FLUX.1 schnell |
| `POST /api/review` | image → score, problems, fix | Llama 3.2 11B Vision |
| `GET /api/health` | reports whether AI is bound | — |

### The loop

The studio does not fire one request and present the result. It runs the same
loop a person with tools runs:

```
plan → shoot → LOOK AT IT → judge against the brief → correct the prompt → shoot again
```

`/api/review` returns a score, a list of problems and a one-line photographic
correction. If the score is under 70 the client appends the correction to the
prompt and shoots once more, keeping whichever frame scored higher. Every step
is printed in the "what the agent did" panel, so the reasoning is visible
instead of hidden.

Two attempts is deliberate. It catches the common failures — a rendered-looking
frame, an empty street, a distorted facade — without turning a 30-second film
into a five-minute bill.

**Free tier: 10,000 neurons/day, no card.** That is roughly 600 plan calls, or
~250 stills, or ~120 stills with the critic enabled (it adds a vision call per
shot). The critic toggle in the UI turns it off if the day's budget is short. When the day's budget runs out the endpoints return an
error and the studio falls back to its built-in planner and generated fields —
**films still get made, they just stop using the model.**

To run with no AI at all, delete the `[ai]` block and redeploy. `/api/health`
will report `ai: false` and the UI will say "rules engine" instead of
"agent online".

### Why the video is still not rendered on the server

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
