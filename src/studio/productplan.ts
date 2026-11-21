/**
 * PRODUCT PLAN — the argument a product film makes, as data.
 *
 * Kept free of React and Remotion on purpose: the score generator reads the
 * same cue sheet the picture does, so sound and image can never drift apart.
 */
import { PALETTES, type Palette } from "./library";
export type Beat = { kind: "hook" | "repo" | "heat" | "merge" | "diff" | "stats" | "end"; seconds: number; transition?: "cut" | "dissolve" | "whip" | "match" | "dip" };

export type ProductPlan = {
  kicker: string;
  headline: string;
  sub: string;
  owner: string;
  repo: string;
  stars: number;
  forks: number;
  prs: number;
  commits: number;
  prNumber: number;
  prTitle: string;
  author: string;
  checks: number;
  stats: Array<[string, string]>;
  cta: string;
  accent: string;
  palette: Palette;
  beats: Beat[];
};

/* -------------------------------------------------------------- the planner */

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

/**
 * Brief → plan.
 *
 * The order is the argument the film makes: a claim, the evidence that the
 * claim is real, the work behind it, the code, the numbers, the signature.
 * Beats are given seconds, not frames, because seconds are what a viewer feels.
 */
export const planProduct = (brief: string): ProductPlan => {
  const h = hash(brief);
  const palette = PALETTES[h % PALETTES.length];
  const git = /github|repo|developer|code|open source|ڨيت/i.test(brief);
  const name = (brief.match(/([A-Za-z][A-Za-z0-9-]{2,})\s*(?:\/|$)/) || [])[1] || "nexus";

  return {
    kicker: git ? "developer platform" : "product",
    headline: git ? "Ship like the\nbest teams do." : "Built for the\nwork that matters.",
    sub: git ? "Reviews, releases and CI. One surface, no friction." : "One surface for the whole team.",
    owner: "vitobytestudio",
    repo: name.length > 4 ? name : "nexus",
    stars: 48200 + (h % 9000),
    forks: 6100 + (h % 900),
    prs: 1240 + (h % 320),
    commits: 12842 + (h % 2400),
    prNumber: 4021 + (h % 300),
    prTitle: "feat(edge): zero-downtime regional failover",
    author: "amine",
    checks: 5,
    stats: [
      ["99.99%", "uptime, 12 months"],
      ["38ms", "median review time"],
      ["4.2M", "deploys this year"],
    ],
    cta: "vitobyte.studio",
    accent: palette.accent,
    palette,
    beats: [
      { kind: "hook", seconds: 3.6, transition: "cut" },
      { kind: "repo", seconds: 3.6, transition: "dissolve" },
      { kind: "heat", seconds: 3.2, transition: "whip" },
      { kind: "merge", seconds: 3.6, transition: "dissolve" },
      { kind: "diff", seconds: 3.4, transition: "match" },
      { kind: "stats", seconds: 2.8, transition: "dip" },
      { kind: "end", seconds: 2.6, transition: "dissolve" },
    ],
  };
};

export const planSeconds = (p: ProductPlan) => p.beats.reduce((n, b) => n + b.seconds, 0);


/** every cut, in seconds — the cue sheet sound design is built from */
export const cueSheet = (p: ProductPlan) => {
  let t = 0;
  return p.beats.map((b) => {
    const start = t;
    t += b.seconds;
    return { kind: b.kind, start: +start.toFixed(3), seconds: b.seconds, transition: b.transition || "dissolve" };
  });
};
