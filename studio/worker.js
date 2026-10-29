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
/*  tool 2 — direction                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The deterministic planner in the browser already knows how to build a film.
 * What it cannot do is write. This asks a model to think like a creative
 * director about one specific brief — the idea, the words, which page each beat
 * deserves — and returns only that. Everything structural stays deterministic,
 * so a bad completion can degrade the copy but never break the film.
 */

const ARCHS = ["poster","editorial","silent","index","stack","metric","grid","diptych","caption","marquee","signature"];

const DIRECTION_SYSTEM = `You are the creative director of a studio that makes short vertical brand films.

You are given a brief and a skeleton of beats. Your job is the thinking, not the layout.

Return ONLY minified JSON:
{"concept":"","headline":"","sub":"","kicker":"","palette":"green|blue|amber|violet|ice","refused":["",""],
 "beats":[{"i":1,"label":"","line":"","arch":"","visual":""}],"voice":[""]}

Rules, in order of importance:
1. Write in the brief's own language. Arabic brief means Arabic copy.
2. "concept" is the film's idea in one sentence — an argument, not a description.
   Bad: "A film about a fashion collection." Good: "Clothes are only finished once a street decides to wear them."
3. "headline" is 3-6 words, concrete, no adjective stacking, no "discover/unleash/elevate".
   It must be impossible to paste onto a different brand.
4. Every "line" is a NEW thought — never a rewording of the headline, and never
   the same sentence as another beat. One line, max 14 words, no full stop at the end
   for Arabic.
5. "label" is 2-3 words, like a chapter name in a book, not a category ("The first cut",
   not "Fashion"). Never repeat a label.
6. Each beat gets an "arch" from this list — choose by what the beat must DO:
   poster     a place, stated plainly, type in the lower third
   editorial  a place plus a large index numeral; the argument of the film
   silent     no words at all; let one place hold the frame
   index      a contents page; used for proof/evidence beats
   stack      one word per line, huge; a declaration
   metric     one figure, one hairline; used for number beats
   grid       four micro-scenes at once; evidence by abundance
   diptych    place above, colour field below with the line
   caption    broadcast lower third with a timecode; reportage
   marquee    type crossing the frame; momentum
   signature  the closing card
   Never use the same arch twice in a row. Prefer silent once in the film.
7. "visual" is 2-6 words naming what the place must show (a lit facade, a rail of coats,
   a tower at dusk). Concrete, physical, no camera jargon, no brands.
8. "refused" lists 2-3 things you deliberately did NOT put in this film and why it is
   better without them. Be specific to this brief.
9. "voice" is one spoken line per beat, 8-16 words, natural when spoken aloud.
10. "palette" picks the film's key: green (growth, sport, money), blue (technology,
   finance, distance), amber (warmth, food, heritage), violet (luxury, night, culture),
   ice (clinical, medical, precision).
11. No exclamation marks. No emoji. No marketing filler. If the brief is in Arabic,
   the Arabic must be fuṣḥā that a newsreader could read.`;

const handleDirection = async (req, env) => {
  if (!env.AI) return json({ error: "no_ai_binding" }, 501);

  let body = {};
  try {
    body = (await req.json()) || {};
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const brief = String(body.brief || "").slice(0, 1200);
  if (!brief) return json({ error: "empty_brief" }, 400);

  const skeleton = Array.isArray(body.skeleton) ? body.skeleton.slice(0, 8) : [];
  const model = env.PLAN_MODEL || "@cf/meta/llama-3.1-8b-instruct";

  const ask = [
    `BRIEF:\n${brief}`,
    skeleton.length
      ? `SKELETON (fixed by the system, do not add or remove beats):\n` +
        skeleton.map((b) => `${b.i}. kind=${b.kind} seconds=${b.seconds}`).join("\n") +
        `\nReturn exactly ${skeleton.length} items in "beats", with the same "i" values.`
      : `Return 6 items in "beats".`,
    `"arch" must be one of: ${ARCHS.join(", ")}.`,
  ].join("\n\n");

  const started = Date.now();
  try {
    const out = await env.AI.run(model, {
      messages: [
        { role: "system", content: DIRECTION_SYSTEM },
        { role: "user", content: ask },
      ],
      max_tokens: 1200,
      temperature: 0.75,
    });

    const d = grabJSON(textOf(out));
    if (!d || !Array.isArray(d.beats)) return json({ error: "unparseable" }, 502);

    // the model is an author, not an authority: clamp everything structural
    const clean = {
      concept: String(d.concept || "").slice(0, 240),
      headline: String(d.headline || "").slice(0, 90),
      sub: String(d.sub || "").slice(0, 200),
      kicker: String(d.kicker || "").slice(0, 40),
      palette: ["green", "blue", "amber", "violet", "ice"].includes(d.palette) ? d.palette : "green",
      refused: (Array.isArray(d.refused) ? d.refused : []).slice(0, 3).map((x) => String(x).slice(0, 140)),
      voice: (Array.isArray(d.voice) ? d.voice : []).slice(0, 8).map((x) => String(x).slice(0, 200)),
      beats: d.beats.slice(0, 8).map((b, n) => ({
        i: Number(b.i) || n + 1,
        label: String(b.label || "").slice(0, 40),
        line: String(b.line || "").slice(0, 200),
        visual: String(b.visual || "").slice(0, 60),
        arch: ARCHS.includes(b.arch) ? b.arch : "",
      })),
      ms: Date.now() - started,
      model,
    };
    return json({ direction: clean });
  } catch (e) {
    return json({ error: "ai_failed", detail: String(e?.message || e).slice(0, 200) }, 502);
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
        tools: ["/api/direction", "/api/plan"],
      });
    }

    if (url.pathname === "/api/plan" && request.method === "POST") return handlePlan(request, env);
    if (url.pathname === "/api/direction" && request.method === "POST") return handleDirection(request, env);

    const res = await env.ASSETS.fetch(request);
    const headers = new Headers(res.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },
};
