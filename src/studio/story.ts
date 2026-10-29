/**
 * STORY — a film is now a sequence of scenes, not one layout.
 *
 * A rich brief ("premium campaign, Paris architecture, a blueprint, a car
 * montage, then a flagship store in a mall") cannot be served by one template.
 * It needs a plan: which shots, in what order, each with its own job.
 *
 * This module defines the plan and builds one. The planner here is the
 * deterministic fallback — it runs with no key and no network. When the Worker
 * has Workers AI available it returns a better plan in exactly this shape, and
 * nothing downstream changes.
 */
import { DesignId } from "./types";

export type SceneKind = "image" | "type" | "stat" | "logo";

export type Scene = {
  kind: SceneKind;
  seconds: number;
  /** image scenes: the shot to generate */
  shot?: string;
  motion?: "in" | "out" | "pan-left" | "pan-right";
  caption?: string;
  /** type scenes: which design system speaks */
  design?: DesignId;
  headline?: string;
  sub?: string;
  kicker?: string;
  /** stat scenes */
  hero?: string;
  unit?: string;
  label?: string;
  transition?: "cut" | "dissolve";
};

export type Storyboard = {
  title: string;
  logline: string;
  accent: string;
  cta: string;
  scenes: Scene[];
};

/* -------------------------------------------------------------------------- */

const PLACES: [RegExp, string, string][] = [
  [/paris|haussmann|france/i, "Paris", "Haussmann limestone facades, zinc rooftops, wrought-iron balconies"],
  [/london|thames/i, "London", "Victorian brick, the Thames at dusk, wet cobblestones"],
  [/dubai|emirat/i, "Dubai", "glass towers, desert haze, marble and gold light"],
  [/tokyo|shibuya|japan/i, "Tokyo", "neon signage, rain-slick streets, dense vertical layers"],
  [/new york|manhattan|nyc/i, "New York", "steel and glass canyons, steam from the street"],
  [/milan|italy/i, "Milan", "stone colonnades, quiet luxury, warm afternoon shadow"],
  [/alger|oran|dz\b|جزائر/i, "Algiers", "whitewashed arcades, the bay, Mediterranean light"],
];

const THEMES: { re: RegExp; tag: string }[] = [
  { re: /clothing|fashion|apparel|garment|collection|ملابس|أزياء/i, tag: "fashion" },
  { re: /coffee|قهوة/i, tag: "coffee" },
  { re: /car|automotive|سيار/i, tag: "car" },
  { re: /watch|ساعات/i, tag: "watch" },
  { re: /perfume|عطر/i, tag: "perfume" },
  { re: /software|saas|platform|منصة/i, tag: "software" },
];

const SUBJECT_LOOK: Record<string, string> = {
  fashion: "a single garment on an invisible form, fabric grain visible, silk and raw wool",
  coffee: "a cup on stone, steam caught in backlight, roasted beans scattered",
  car: "the body line of a dark car, paint reflecting a city, no logos",
  watch: "a watch face on black velvet, brushed metal macro",
  perfume: "a glass bottle, refraction on marble, one hard highlight",
  software: "an abstract data surface, thin light lines, no text",
};

const pick = <T,>(a: T[], h: number) => a[Math.abs(h) % a.length];

const hashOf = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

const ACCENTS = ["#00FF88", "#2E7CFF", "#FFB020", "#FF3D6E", "#B48CFF", "#63B3FF"];

const sentences = (s: string) =>
  s.split(/(?<=[.!?])\s+|\n+|،\s*/).map((x) => x.trim()).filter(Boolean);

const findMetric = (t: string) => {
  const m = t.match(/(\d[\d,]*(?:\.\d+)?)\s*(%|ms\b|s\b|k\b|m\b|gb\b|tb\b|x\b|cores?\b|nodes?\b|regions?\b|users?\b|stores?\b|pieces?\b|collections?\b|years?\b)?/i);
  return m ? { hero: m[1], unit: (m[2] || "").toLowerCase() } : null;
};

/* -------------------------------------------------------------------------- */

/**
 * The fallback planner. Turns any brief into a shootable sequence.
 *
 * Structure is fixed on purpose — a 30 s brand film has an arc: establish,
 * promise, craft, proof, motion, product, signature. What changes with the
 * brief is the place, the subject, the numbers and the words.
 */
export const planStory = (text: string, maxSeconds = 30): Storyboard => {
  const t = text.trim();
  const h = hashOf(t);

  const place = PLACES.find(([re]) => re.test(t));

  /**
   * Title and logline must be *different* sentences, or the film says the same
   * thing twice. Pick the shortest complete thought as the title and the
   * richest one as the deck.
   */
  const clauses = t
    .split(/[.،;]|\bthen\b|\bthen\b/i)
    .map((x) => x.trim())
    .filter((x) => x.length > 6);
  const ranked = [...clauses].sort((a, b) => Math.abs(a.length - 28) - Math.abs(b.length - 28));
  const titleSrc = ranked[0] || t;
  const loglineSrc = clauses.find((c) => c !== titleSrc && c.length > 14) || "";
  const placeName = place ? place[1] : "the city";
  const placeLook = place ? place[2] : "modern architecture, hard afternoon light";

  const theme = (THEMES.find((x) => x.re.test(t)) || { tag: "product" }).tag;
  const subjectLook = SUBJECT_LOOK[theme] || "the product on a clean surface, one hard light";

  const premium = /premium|luxury|world[- ]class|global|high[- ]end|بريميوم|عالمي|فاخر/i.test(t);
  const technical = /blueprint|plan|architecture|engineering|مخطط|هندسة|معمار/i.test(t);
  const motion = /car|traffic|drive|movement|montage|سيار|حركة/i.test(t);

  const metric = findMetric(t);
  const parts = sentences(t);
  const title = titleSrc || "a brand film";
  const logline = loglineSrc;

  const grade = premium ? "cinematic grade, deep shadows, restrained palette" : "natural grade, soft contrast";
  const lens = premium ? "shot on 85mm, shallow depth of field" : "shot on 35mm";

  const accent = ACCENTS[h % ACCENTS.length];

  const scenes: Scene[] = [
    {
      kind: "image",
      seconds: 3.6,
      transition: "dissolve",
      motion: "in",
      caption: placeName,
      shot: `establishing wide shot of ${placeName}, ${placeLook}, no people facing camera, ${lens}, ${grade}`,
    },
    {
      kind: "type",
      seconds: 3.0,
      design: "kinetic",
      kicker: premium ? "a campaign" : "introducing",
      headline: breakTitle(title),
      transition: "cut",
    },
    {
      kind: "image",
      seconds: 3.2,
      transition: "dissolve",
      motion: "out",
      caption: theme === "product" ? "material" : theme,
      shot: `macro detail of ${subjectLook}, texture and edge light, ${grade}`,
    },
  ];

  if (technical) {
    scenes.push({
      kind: "type",
      seconds: 3.2,
      design: "blueprint",
      kicker: "the plan",
      headline: "Every angle\nengineered.",
      hero: String(12 + (h % 40)),
      unit: "bays",
      transition: "cut",
    });
  }

  scenes.push({
    kind: "stat",
    seconds: 3.0,
    hero: metric?.hero || String(8 + (h % 90)),
    unit: metric?.unit || (theme === "fashion" ? "pieces" : ""),
    label: metric ? logline.slice(0, 52) : "made in small numbers",
    transition: "cut",
  });

  if (motion) {
    scenes.push({
      kind: "image",
      seconds: 3.4,
      transition: "dissolve",
      motion: "pan-left",
      caption: "in motion",
      shot: `night traffic on a boulevard in ${placeName}, long exposure light trails, headlights raking wet asphalt, ${grade}`,
    });
  }

  scenes.push({
    kind: "image",
    seconds: 3.8,
    transition: "dissolve",
    motion: "in",
    caption: "the flagship",
    shot: `interior of a flagship ${theme === "fashion" ? "clothing store" : "retail space"} inside a modern mall, warm downlights, polished stone floor, garments on rails, no people, ${grade}`,
  });

  scenes.push({
    kind: "logo",
    seconds: 3.2,
    transition: "dissolve",
  });

  // fit to the budget by trimming the longest shots first
  let total = scenes.reduce((a, s) => a + s.seconds, 0);
  while (total > maxSeconds) {
    const i = scenes.reduce((bi, s, k) => (s.seconds > scenes[bi].seconds ? k : bi), 0);
    scenes[i].seconds = Math.max(2.2, +(scenes[i].seconds - 0.4).toFixed(2));
    total = scenes.reduce((a, s) => a + s.seconds, 0);
  }

  return {
    title: `A film for ${placeName}`,
    logline: logline.slice(0, 120),
    accent,
    cta: (t.match(/\b([a-z0-9-]+\.(?:studio|com|io|dev|app|ai|co))\b/i)?.[1] || "vitobyte.studio").toLowerCase(),
    scenes,
  };
};

/** keep the title short enough for a 132px line to fit the frame */
const breakTitle = (s: string) => {
  const clean = s.replace(/[.!?،]+$/, "").trim();
  const w = clean.split(/\s+/).filter(Boolean);
  const kept = w.slice(0, 7);
  if (kept.length < 4) return kept.join(" ");
  const mid = Math.ceil(kept.length / 2);
  return `${kept.slice(0, mid).join(" ")}\n${kept.slice(mid).join(" ")}`;
};

/* -------------------------------------------------------------------------- */

/**
 * Repair whatever the model returns into a shootable plan.
 * Models drift: they invent scene kinds, forget durations, return a string
 * instead of a number. Everything is coerced, and anything unusable is dropped
 * rather than crashing a render halfway.
 */
export const validatePlan = (raw: unknown, fallback: Storyboard): Storyboard => {
  const o = raw as Partial<Storyboard> | null;
  if (!o || !Array.isArray(o.scenes)) return fallback;

  const scenes: Scene[] = [];
  for (const s of o.scenes as unknown[]) {
    const sc = s as Partial<Scene>;
    if (!sc || typeof sc !== "object") continue;
    const kind = sc.kind;
    if (kind !== "image" && kind !== "type" && kind !== "stat" && kind !== "logo") continue;
    const seconds = Number(sc.seconds);
    scenes.push({
      kind,
      seconds: Number.isFinite(seconds) ? Math.min(8, Math.max(1.8, seconds)) : 3,
      shot: typeof sc.shot === "string" ? sc.shot.slice(0, 400) : undefined,
      motion: ["in", "out", "pan-left", "pan-right"].includes(String(sc.motion))
        ? (sc.motion as Scene["motion"])
        : "in",
      caption: typeof sc.caption === "string" ? sc.caption.slice(0, 28) : undefined,
      design: ["kinetic", "terminal", "glass", "blueprint", "signal", "editorial"].includes(String(sc.design))
        ? (sc.design as DesignId)
        : "kinetic",
      headline: typeof sc.headline === "string" ? sc.headline.slice(0, 80) : undefined,
      sub: typeof sc.sub === "string" ? sc.sub.slice(0, 90) : undefined,
      kicker: typeof sc.kicker === "string" ? sc.kicker.slice(0, 32) : undefined,
      hero: typeof sc.hero === "string" ? sc.hero.slice(0, 12) : undefined,
      unit: typeof sc.unit === "string" ? sc.unit.slice(0, 10) : undefined,
      label: typeof sc.label === "string" ? sc.label.slice(0, 60) : undefined,
      transition: sc.transition === "cut" ? "cut" : "dissolve",
    });
  }

  if (scenes.length < 3) return fallback;
  if (!scenes.some((s) => s.kind === "logo")) scenes.push({ kind: "logo", seconds: 3, transition: "dissolve" });

  return {
    title: typeof o.title === "string" ? o.title.slice(0, 80) : fallback.title,
    logline: typeof o.logline === "string" ? o.logline.slice(0, 160) : fallback.logline,
    accent: /^#[0-9a-f]{6}$/i.test(String(o.accent)) ? String(o.accent) : fallback.accent,
    cta: typeof o.cta === "string" ? o.cta.slice(0, 32) : fallback.cta,
    scenes,
  };
};

export const totalSeconds = (s: Storyboard) => s.scenes.reduce((a, x) => a + x.seconds, 0);
