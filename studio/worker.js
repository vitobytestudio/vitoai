/**
 * NEXUS STUDIO — Cloudflare Worker.
 *
 * Serves the static bundle, and exposes the agent's four tools:
 *
 *   POST /api/plan    brief  → storyboard JSON   (llama-3.1-8b)
 *   POST /api/shot    prompt → JPEG              (flux-1-schnell)
 *   POST /api/review  image  → critique + fix    (llama-3.2-11b-vision)
 *   GET  /api/health  what is actually bound
 *
 * The agent loop lives in the browser and uses these the way a person uses
 * tools: plan, shoot, LOOK AT THE RESULT, fix, shoot again, then assemble.
 * Nothing here renders video — that is done by the visitor's browser.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });

const grabJSON = (text) => {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(text.slice(a, b + 1));
  } catch {
    return null;
  }
};

const textOf = (out) => (typeof out === "string" ? out : out?.response ?? "");

/* -------------------------------------------------------------------------- */
/*  tool 1 — plan                                                             */
/* -------------------------------------------------------------------------- */

const PLAN_SYSTEM = `You are a film director. Convert a written brief into a shootable
storyboard for a vertical (9:16) brand film of at most 30 seconds.

Return ONLY minified JSON, no prose:
{"title":"","logline":"","accent":"#RRGGBB","cta":"domain.tld","scenes":[...]}

Each scene is one of:
{"kind":"image","seconds":3.5,"shot":"<photographic prompt: place, subject, light, lens. no text, no logos>","motion":"in|out|pan-left|pan-right","caption":"<2 words>","transition":"dissolve|cut"}
{"kind":"type","seconds":3,"design":"kinetic|terminal|glass|blueprint|signal|editorial","kicker":"<3 words>","headline":"<max 6 words, may contain one \\n>"}
{"kind":"stat","seconds":3,"hero":"<number>","unit":"<word>","label":"<max 8 words>"}
{"kind":"logo","seconds":3.2}

Rules:
- 6 to 9 scenes. Always end with exactly one "logo".
- Open with an image. Use at least 3 image scenes.
- Vary "design" in type scenes; never repeat the same one twice.
- "shot" must read like a photograph brief, never mention text or words.
- Keep every headline under 6 words. Never repeat the same words in two scenes.
- Total seconds must not exceed 30.`;

const handlePlan = async (req, env) => {
  if (!env.AI) return json({ error: "no_ai_binding", detail: 'Add [ai] binding = "AI" to wrangler.toml' }, 501);

  let brief = "";
  try {
    brief = String((await req.json() || {}).brief || "").slice(0, 1500);
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (!brief) return json({ error: "empty_brief" }, 400);

  const model = env.PLAN_MODEL || "@cf/meta/llama-3.1-8b-instruct";
  try {
    const out = await env.AI.run(model, {
      messages: [
        { role: "system", content: PLAN_SYSTEM },
        { role: "user", content: brief },
      ],
      max_tokens: 1400,
      temperature: 0.4,
    });
    const plan = grabJSON(textOf(out));
    if (!plan) return json({ error: "unparseable", raw: textOf(out).slice(0, 400) }, 502);
    return json({ plan, model });
  } catch (e) {
    return json({ error: "ai_failed", detail: String(e?.message || e) }, 502);
  }
};

/* -------------------------------------------------------------------------- */
/*  tool 2 — shoot                                                            */
/* -------------------------------------------------------------------------- */

const handleShot = async (req, env) => {
  if (!env.AI) return json({ error: "no_ai_binding" }, 501);

  let prompt = "";
  let seed = 0;
  try {
    const body = await req.json();
    prompt = String(body.prompt || "").slice(0, 700);
    seed = Number(body.seed) || 0;
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (!prompt) return json({ error: "empty_prompt" }, 400);

  try {
    const out = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
      prompt,
      steps: 4,
      ...(seed ? { seed } : {}),
    });
    const b64 = out?.image;
    if (!b64) return json({ error: "no_image" }, 502);

    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return new Response(bin, {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "public, max-age=31536000, immutable",
        ...CORS,
      },
    });
  } catch (e) {
    return json({ error: "ai_failed", detail: String(e?.message || e) }, 502);
  }
};

/* -------------------------------------------------------------------------- */
/*  tool 3 — review                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The critic. This is what turns a generator into an agent.
 *
 * A still is not finished because the request returned 200 — it is finished when
 * something has looked at it and judged it against the shot that was asked for.
 * The judgement comes back as a score plus a concrete correction, which is fed
 * straight into the next prompt.
 */
const REVIEW_SYSTEM = `You are a film director reviewing a still for a vertical brand film.
Judge ONLY whether the image reads as the intended shot: subject, place, light, framing.
Be strict about: visible text or watermarks, extra limbs, distorted faces,
melted geometry, duplicated objects, empty or blank frames, cartoon or 3D-render look,
low detail, obvious compositing.

Reply with ONLY minified JSON:
{"score":0-100,"pass":true|false,"problems":["short problem"],"fix":"a photographic instruction that would fix the main problem"}

Pass at score >= 70. "fix" must be max 14 words and must describe an image, not text.`;

const handleReview = async (req, env) => {
  if (!env.AI) return json({ error: "no_ai_binding" }, 501);

  let prompt = "";
  let image = "";
  try {
    const body = await req.json();
    prompt = String(body.prompt || "").slice(0, 600);
    image = String(body.image || "");
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (!prompt || !image.startsWith("data:image/")) return json({ error: "bad_input" }, 400);

  try {
    const out = await env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct", {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `${REVIEW_SYSTEM}\n\nINTENDED SHOT: ${prompt}` },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
      max_tokens: 300,
    });

    const r = grabJSON(textOf(out));
    if (!r) return json({ error: "unparseable", raw: textOf(out).slice(0, 240) }, 502);

    const score = Math.max(0, Math.min(100, Number(r.score) || 0));
    return json({
      score,
      pass: typeof r.pass === "boolean" ? r.pass : score >= 70,
      problems: Array.isArray(r.problems) ? r.problems.slice(0, 4).map((x) => String(x).slice(0, 90)) : [],
      fix: typeof r.fix === "string" ? r.fix.slice(0, 120) : "",
    });
  } catch (e) {
    return json({ error: "ai_failed", detail: String(e?.message || e) }, 502);
  }
};

/* -------------------------------------------------------------------------- */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        ai: Boolean(env.AI),
        models: {
          plan: env.PLAN_MODEL || "@cf/meta/llama-3.1-8b-instruct",
          shot: "@cf/black-forest-labs/flux-1-schnell",
          review: "@cf/meta/llama-3.2-11b-vision-instruct",
        },
      });
    }

    if (url.pathname === "/api/plan" && request.method === "POST") return handlePlan(request, env);
    if (url.pathname === "/api/shot" && request.method === "POST") return handleShot(request, env);
    if (url.pathname === "/api/review" && request.method === "POST") return handleReview(request, env);

    const res = await env.ASSETS.fetch(request);
    const headers = new Headers(res.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },
};
