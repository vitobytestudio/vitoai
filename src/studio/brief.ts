/**
 * Brief compiler.
 *
 * Turns a written description into the flat structure every design understands.
 * Rule-based and deterministic on purpose: no key, no network, no per-render
 * cost, and the same sentence always produces the same film. It reads like a
 * parser because that is what it is — it is not pretending to be a language
 * model, and it says so in the UI.
 */
import { Brief, DesignId, DEFAULT_BRIEF } from "./types";
import { pickDesign } from "./registry";

const ACCENTS = ["#00FF88", "#2E7CFF", "#63B3FF", "#FFB020", "#FF3D6E", "#B48CFF"];

const clean = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, "")
    .trim();

/** sentence-ish split that keeps abbreviations sane */
const sentences = (s: string) =>
  s
    .split(/(?<=[.!?])\s+|\n+/)
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * Pick the number the film should be about.
 *
 * Not the biggest number — the most *load-bearing* one. A count of cores or a
 * latency in ms carries a claim; a memory size in GB is usually a detail. When
 * several are equally load-bearing we take the earliest, because people lead
 * with the stat they care about.
 */
const UNIT_WEIGHT: Record<string, number> = {
  cores: 3, core: 3, nodes: 3, node: 3, ms: 3, "%": 3, x: 3,
  users: 2, user: 2, commits: 2, commit: 2, deploys: 2, deploy: 2, regions: 2, region: 2,
  pops: 2, pop: 2, hours: 2, hour: 2, days: 2, day: 2,
  gb: 1, tb: 1, mb: 1, k: 1, m: 1, s: 2,
};

const findMetric = (text: string): { hero: string; unit: string } | null => {
  const re = /(\d[\d,]*(?:\.\d+)?)\s*(%|ms\b|s\b|k\b|m\b|gb\b|tb\b|mb\b|x\b|cores?\b|nodes?\b|regions?\b|pops?\b|users?\b|commits?\b|deploys?\b|hours?\b|days?\b)?/gi;
  const found: { hero: string; unit: string; w: number; i: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[1];
    const num = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(num) || num === 0) continue;
    const unit = (m[2] || "").toLowerCase();
    found.push({ hero: raw, unit, w: UNIT_WEIGHT[unit] ?? (unit ? 2 : 1), i: m.index });
  }
  if (!found.length) return null;
  const top = Math.max(...found.map((f) => f.w));
  const pick = found.filter((f) => f.w === top).sort((a, b) => a.i - b.i)[0];
  return { hero: pick.hero, unit: pick.unit };
};

/** the shortest sentence with verbs and no digits usually reads best as a headline */
const pickHeadline = (parts: string[], fallback: string): string => {
  const scored = parts
    .filter((p) => p.length > 8 && p.length < 64)
    .map((p) => {
      const hasDigit = /\d/.test(p);
      const words = p.split(" ").length;
      const score = (hasDigit ? -6 : 0) + (words >= 3 && words <= 9 ? 4 : 0) - Math.abs(p.length - 30) / 12;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score);
  const chosen = scored[0]?.p || fallback;
  const t = clean(chosen).replace(/[.!?]+$/, "");
  // break after the first clause so the design has two lines to play with
  const words = t.split(" ");
  if (words.length >= 5) {
    const mid = Math.ceil(words.length / 2);
    return `${words.slice(0, mid).join(" ")}\n${words.slice(mid).join(" ")}`;
  }
  return t;
};

/** break a title after the first clause so designs get two lines to play with */
const breakLine = (t: string): string => {
  const words = t.split(" ");
  if (words.length >= 4) {
    const mid = Math.ceil(words.length / 2);
    return `${words.slice(0, mid).join(" ")}\n${words.slice(mid).join(" ")}`;
  }
  return t;
};

const pickKicker = (text: string): string => {
  const lower = text.toLowerCase();
  const map: [RegExp, string][] = [
    [/server|infra|host|metal|vm\b/, "private servers"],
    [/agent|autonom|ai\b|model/, "autonomous agents"],
    [/edge|cdn|global|latency|pop\b/, "global edge"],
    [/ci\s?\/?\s?cd|pipeline|deploy|release/, "github ci-cd"],
    [/secur|breach|threat|attack/, "security posture"],
    [/cloud|scale|platform/, "platform"],
    [/launch|ship|new\b/, "launch"],
  ];
  for (const [re, label] of map) if (re.test(lower)) return label;
  return (text.split(/[.\n]/)[0] || "brief").split(" ").slice(0, 3).join(" ").toLowerCase();
};

const pickCta = (text: string): string => {
  const m = text.match(/\b([a-z0-9-]+\.(?:studio|com|io|dev|app|ai|co))\b/i);
  return m ? m[1].toLowerCase() : "vitobyte.studio";
};

const hashString = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

export const compileBrief = (text: string, forcedDesign?: DesignId): Brief => {
  const src = text.trim();
  if (!src) return DEFAULT_BRIEF;

  const parts = sentences(src);
  const metric = findMetric(src);
  const kicker = pickKicker(src);
  const cta = pickCta(src);

  let headline: string;
  let support: string;

  if (parts.length === 1) {
    /* one sentence: split at the first comma so the title and the deck are
       different words instead of the same words twice */
    const only = clean(parts[0]);
    const comma = only.indexOf(",");
    if (comma > 12 && comma < only.length - 8) {
      headline = only.slice(0, comma);
      support = only.slice(comma + 1);
    } else {
      headline = only;
      support = "";
    }
  } else {
    headline = pickHeadline(parts, DEFAULT_BRIEF.headline.replace("\n", " "));
    const flat = headline.replace("\n", " ");
    support =
      parts.find((p) => {
        const c = clean(p);
        return c.length > 10 && !flat.includes(c.slice(0, 22)) && !c.includes(flat.slice(0, 22));
      }) || "";
  }

  headline = breakLine(clean(headline));
  const sub = clean(support).slice(0, 78) || `${metric?.hero || DEFAULT_BRIEF.hero}${metric?.unit ? " " + metric.unit : ""} · a film by vito byte studio`;

  return {
    kicker,
    headline,
    hero: metric?.hero || "100",
    unit: metric?.unit || "",
    sub: sub || DEFAULT_BRIEF.sub,
    cta,
    accent: ACCENTS[hashString(src) % ACCENTS.length],
    tier: "lite",
    design: forcedDesign || pickDesign(src),
  };
};

/** a few openings so the empty state is not an empty box */
export const EXAMPLES: { label: string; text: string }[] = [
  {
    label: "private servers",
    text: "Your own metal, not a shared slice. 192 dedicated cores, 768 GB of memory and 99.99% uptime, isolated per tenant. vitobyte.studio",
  },
  {
    label: "edge latency",
    text: "312 points of presence across six regions. Global p95 latency of 23ms on every request. Cloudflare edge architecture, measured not promised.",
  },
  {
    label: "pipeline",
    text: "From merge to production in 51 seconds. GitHub CI-CD with zero downtime deploys. Ship on Friday without thinking about it.",
  },
  {
    label: "agents",
    text: "Autonomous agents that write the code. 1,284 commits this quarter with 0 human interventions. Audited, observed, shipping.",
  },
];
