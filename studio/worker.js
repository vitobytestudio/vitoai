/**
 * NEXUS STUDIO — Cloudflare Worker.
 *
 * Serves the static bundle, and exposes the agent's four tools:
 *
 *   POST /api/plan    brief  → storyboard JSON   (llama-3.1-8b)
 *   (no image endpoint: places are built in the browser from geometry)
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
{"kind":"image","seconds":3.5,"shot":"<photographic prompt: place, subject, light, lens. no text, no logos>","motion":"in|out|pan-left|pan-right","caption":"<2 words>","transition":"dissolve|cut|whip|match|dip"}
{"kind":"type","seconds":3,"design":"kinetic|terminal|glass|blueprint|signal|editorial","kicker":"<3 words>","headline":"<max 6 words, may contain one \\n>"}
{"kind":"stat","seconds":3,"hero":"<number>","unit":"<word>","label":"<max 8 words>"}
{"kind":"logo","seconds":3.2}

Rules:
- 6 to 9 scenes. Always end with exactly one "logo".
- Open with an image. Use at least 3 image scenes.
- Vary "design" in type scenes; never repeat the same one twice.
- "shot" must read like a photograph brief, never mention text or words.
- Keep every headline under 6 words. Never repeat the same words in two scenes.
- Total seconds must not exceed 30.
- Choose transitions deliberately: "whip" into a high-energy beat, "match" when
  two shots share geometry, "dip" for a change of act, "cut" on a hard number.
  Never use the same transition three times in a row.`;

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
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        ai: Boolean(env.AI),
        models: { plan: env.PLAN_MODEL || "@cf/meta/llama-3.1-8b-instruct" },
      });
    }

    if (url.pathname === "/api/plan" && request.method === "POST") return handlePlan(request, env);

    const res = await env.ASSETS.fetch(request);
    const headers = new Headers(res.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },
};
