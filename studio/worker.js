/**
 * NEXUS STUDIO — Cloudflare Worker.
 *
 * Serves the static bundle, and exposes two optional AI endpoints:
 *
 *   POST /api/plan   brief  → storyboard JSON   (Workers AI, llama)
 *   POST /api/shot   prompt → JPEG bytes        (Workers AI, flux-1-schnell)
 *
 * Both are optional. The studio works with no AI at all: it falls back to the
 * deterministic planner compiled into the bundle. If the bindings are missing
 * these endpoints say so plainly instead of failing a render.
 *
 * Nothing here renders video. Video is encoded in the visitor's browser.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });

/* -------------------------------------------------------------------------- */

const SYSTEM = `You are a film director. Convert a written brief into a shootable
storyboard for a vertical (9:16) brand film of at most 30 seconds.

Return ONLY minified JSON, no prose, matching:
{"title":"","logline":"","accent":"#RRGGBB","cta":"domain.tld","scenes":[ ... ]}

Each scene is one of:
{"kind":"image","seconds":3.5,"shot":"<a photographic prompt, no text, no logos>","motion":"in|out|pan-left|pan-right","caption":"<2 words>","transition":"dissolve|cut"}
{"kind":"type","seconds":3,"design":"kinetic|terminal|glass|blueprint|signal|editorial","kicker":"<3 words>","headline":"<max 6 words, may contain one \\n>"}
{"kind":"stat","seconds":3,"hero":"<number>","unit":"<word>","label":"<max 8 words>"}
{"kind":"logo","seconds":3.2}

Rules:
- 6 to 9 scenes. Always end with exactly one "logo".
- Open with an image. Use 3 or more image scenes.
- Vary the design in type scenes; do not repeat the same design twice.
- "shot" must describe a photograph: place, subject, light, lens. Never mention text.
- Keep every headline under 6 words. Never repeat the same words in two scenes.
- Total seconds must not exceed ${30}.`;

const planPrompt = (brief) =>
  `${SYSTEM}\n\nBRIEF:\n${brief}\n\nJSON:`;

/* -------------------------------------------------------------------------- */

const handlePlan = async (req, env) => {
  if (!env.AI) return json({ error: "no_ai_binding", detail: "Add [ai] binding = \"AI\" to wrangler.toml" }, 501);

  let brief = "";
  try {
    brief = String(((await req.json()) || {}).brief || "").slice(0, 1500);
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (!brief) return json({ error: "empty_brief" }, 400);

  const model = env.PLAN_MODEL || "@cf/meta/llama-3.1-8b-instruct";

  try {
    const out = await env.AI.run(model, {
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: brief },
      ],
      max_tokens: 1400,
      temperature: 0.4,
    });

    const text = typeof out === "string" ? out : out?.response ?? "";
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return json({ error: "unparseable", raw: text.slice(0, 400) }, 502);

    const plan = JSON.parse(text.slice(start, end + 1));
    return json({ plan, model });
  } catch (e) {
    return json({ error: "ai_failed", detail: String(e && e.message ? e.message : e) }, 502);
  }
};

/* -------------------------------------------------------------------------- */

const handleShot = async (req, env) => {
  if (!env.AI) return json({ error: "no_ai_binding" }, 501);

  let prompt = "";
  let seed = 0;
  try {
    const body = await req.json();
    prompt = String(body.prompt || "").slice(0, 600);
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

    // the binding returns { image: base64 } for this model
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
    return json({ error: "ai_failed", detail: String(e && e.message ? e.message : e) }, 502);
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
        models: { plan: env.PLAN_MODEL || "@cf/meta/llama-3.1-8b-instruct", shot: "@cf/black-forest-labs/flux-1-schnell" },
      });
    }

    if (url.pathname === "/api/plan" && request.method === "POST") return handlePlan(request, env);
    if (url.pathname === "/api/shot" && request.method === "POST") return handleShot(request, env);

    const res = await env.ASSETS.fetch(request);
    const headers = new Headers(res.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },
};
