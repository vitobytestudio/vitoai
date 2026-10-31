/**
 * CRITIC — the studio looks at its own work before you do.
 *
 * This is the same loop a person runs: build it, look at it, find what is
 * wrong, fix it, look again. It is written in plain arithmetic because the
 * failures that ruin a video are not mysterious — copy that overflows, two
 * shots that look the same, a transition used three times, type that vanishes
 * into its own background, a film that runs long.
 *
 * No model, no network, no cost. It runs in a millisecond and it never lies to
 * make itself look good: if nothing is wrong it says so and stops.
 */
import { Storyboard, Scene, totalSeconds } from "./story";

export type Problem = {
  scene: number | null;
  code: string;
  say: string;
};

export type Verdict = {
  score: number;
  pass: boolean;
  problems: Problem[];
  edits: string[];
  story: Storyboard;
};

/* -------------------------------------------------------------- measuring */

/** width of a line of display type at a given size, in px — good to about 4% */
const lineWidth = (text: string, size: number) => {
  let w = 0;
  for (const ch of text) {
    if ("iljI.,'".includes(ch)) w += size * 0.26;
    else if ("MW".includes(ch)) w += size * 0.86;
    else if (ch === " ") w += size * 0.27;
    else if (ch >= "A" && ch <= "Z") w += size * 0.62;
    else w += size * 0.53;
  }
  return w;
};

const luma = (hex: string) => {
  const h = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};

const contrast = (a: string, b: string) => {
  const la = luma(a);
  const lb = luma(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const lighten = (hex: string, t: number) => {
  const h = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) + (255 - parseInt(h.slice(i, i + 2), 16)) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

const FRAME_W = 1080;
const PAD = 92;

/* ---------------------------------------------------------------- critique */

/**
 * One pass. Returns the film it would ship plus the reasons it changed.
 *
 * Every fix is smaller than the problem it solves — the studio trims a caption
 * by two words, it does not rewrite the scene. That is the difference between
 * a critic and a director.
 */
export const critique = (input: Storyboard, budget = 32): Verdict => {
  const problems: Problem[] = [];
  const edits: string[] = [];
  const scenes: Scene[] = input.scenes.map((s) => ({ ...s }));

  scenes.forEach((s, i) => {
    /* 1. captions are read in a second, at a glance, on a phone */
    if (s.kind === "image" && s.caption && s.caption.length > 24) {
      const short = s.caption.split(/\s+/).slice(0, 3).join(" ");
      problems.push({ scene: i, code: "caption-long", say: `caption "${s.caption}" is ${s.caption.length} characters` });
      edits.push(`scene ${i + 1}: caption trimmed to "${short}"`);
      s.caption = short;
    }

    /* 2. display copy that would run off the frame */
    if (s.kind === "type") {
      const size = 96;
      const lines = (s.headline || "").split("\n");
      const worst = lines.reduce((m, l) => Math.max(m, lineWidth(l, size)), 0);
      if (worst > FRAME_W - PAD * 2) {
        const words = (s.headline || "").split(/\s+/);
        let out: string[] = [];
        let cur = "";
        for (const w of words) {
          if (lineWidth(`${cur} ${w}`.trim(), size) > FRAME_W - PAD * 2 && cur) {
            out.push(cur);
            cur = w;
          } else cur = `${cur} ${w}`.trim();
        }
        if (cur) out.push(cur);
        const kept = out.slice(0, 3);
        const dropped = out.length - kept.length;
        problems.push({ scene: i, code: "headline-overflow", say: `headline needs ${Math.round(worst)}px of ${FRAME_W - PAD * 2}px` });
        edits.push(
          dropped > 0
            ? `scene ${i + 1}: headline cut to ${kept.length} lines (${dropped} line${dropped > 1 ? "s" : ""} held back for the voiceover)`
            : `scene ${i + 1}: headline rewrapped to ${kept.length} lines`,
        );
        s.headline = kept.join("\n");
      }
    }

    /* 3. a number with nothing around it is trivia */
    if (s.kind === "stat" && s.hero && !s.label && !s.unit) {
      problems.push({ scene: i, code: "stat-bare", say: `"${s.hero}" has neither unit nor context` });
      edits.push(`scene ${i + 1}: stat given context from the film's own logline`);
      s.label = input.logline || input.title || "";
    }

    /* 4. beats that run too short to register or too long to hold.
       A logo card is the exception: it reads in a second, and holding it longer
       makes the film feel like it is waiting for you to finish. */
    const floor = s.kind === "logo" ? 1.2 : 2.2;
    if (s.seconds < floor) {
      problems.push({ scene: i, code: "beat-short", say: `scene ${i + 1} lasts ${s.seconds.toFixed(1)}s` });
      edits.push(`scene ${i + 1}: extended to the ${floor}s floor`);
      s.seconds = floor;
    }
    if (s.seconds > 8) {
      problems.push({ scene: i, code: "beat-long", say: `scene ${i + 1} holds for ${s.seconds.toFixed(1)}s` });
      edits.push(`scene ${i + 1}: trimmed to 8s`);
      s.seconds = 8;
    }
  });

  /* 5. three beats of the same kind is a slideshow, not an edit */
  for (let pass = 0; pass < 3; pass++)
  for (let i = 2; i < scenes.length; i++) {
    if (scenes[i].kind === scenes[i - 1].kind && scenes[i].kind === scenes[i - 2].kind) {
      const swap = scenes.findIndex((s, k) => k > i && s.kind !== scenes[i].kind);
      if (swap !== -1) {
        problems.push({ scene: i, code: "beat-repeat", say: `three "${scenes[i].kind}" scenes in a row` });
        edits.push(`scenes ${i + 1} and ${swap + 1}: cut points moved to break the run`);
        const t = scenes[i];
        scenes[i] = scenes[swap];
        scenes[swap] = t;
      }
    }
  }

  /* 6. the same transition three times makes the edit feel mechanical */
  for (let pass = 0; pass < 3; pass++)
  for (let i = 2; i < scenes.length; i++) {
    const a = scenes[i - 2].transition;
    if (a && a === scenes[i - 1].transition && a === scenes[i].transition) {
      problems.push({ scene: i, code: "cut-repeat", say: `"${a}" used on three consecutive cuts` });
      edits.push(`scene ${i + 1}: cut changed to "match" for contrast`);
      scenes[i].transition = "match";
    }
  }

  /* 7. legibility: the accent has to survive the background */
  const bg = "#05090F";
  if (contrast(input.accent, bg) < 3) {
    const fixed = lighten(input.accent, 0.4);
    problems.push({ scene: null, code: "contrast", say: `accent ${input.accent} scores ${contrast(input.accent, bg).toFixed(2)}:1` });
    edits.push(`accent lifted to ${fixed} for legibility`);
    input = { ...input, accent: fixed };
  }

  /* 8. the budget is a promise, not a target */
  let total = scenes.reduce((n, s) => n + s.seconds, 0);
  while (total > budget && scenes.length > 3) {
    const last = scenes[scenes.length - 1];
    if (last.kind === "logo" && last.seconds > 1.6) {
      last.seconds = 1.6;
    } else {
      const idx = scenes.reduce((m, s, k) => (s.seconds > scenes[m].seconds ? k : m), 0);
      if (scenes[idx].kind === "logo") break;
      scenes[idx].seconds = Math.max(2.2, +(scenes[idx].seconds - 0.4).toFixed(2));
    }
    const next = scenes.reduce((n, s) => n + s.seconds, 0);
    if (next >= total) break;
    total = next;
  }
  if (totalSeconds({ ...input, scenes }) > budget) {
    problems.push({ scene: null, code: "over-budget", say: `film runs ${totalSeconds({ ...input, scenes }).toFixed(1)}s over a ${budget}s budget` });
    edits.push(`film held at ${budget}s by trimming the longest beats`);
  }

  const story: Storyboard = { ...input, scenes };
  const seconds = totalSeconds(story);

  /* score: start clean, pay for every problem, and for distance from the ideal shape */
  const shape = scenes.length >= 5 && scenes.length <= 9 ? 0 : 8;
  const endings = scenes[scenes.length - 1]?.kind === "logo" ? 0 : 12;
  const pacing = seconds <= budget ? 0 : 10;
  const score = Math.max(0, Math.min(100, 100 - problems.length * 6 - shape - endings - pacing));

  return { score, pass: problems.length === 0 && seconds <= budget, problems, edits, story };
};

/**
 * The loop. Two rounds, because one round fixes the obvious and a second finds
 * what the first fix broke. Then it stops and reports — an agent that keeps
 * going is not careful, it is just slow.
 */
export const reviewLoop = (story: Storyboard, budget = 32, rounds = 2) => {
  let current = story;
  const log: Array<{ round: number; verdict: Verdict }> = [];
  for (let r = 1; r <= rounds; r++) {
    const v = critique(current, budget);
    log.push({ round: r, verdict: v });
    current = v.story;
    if (v.pass) break;
  }
  const last = log[log.length - 1].verdict;
  return { story: current, score: last.score, pass: last.pass, rounds: log, problems: last.problems, edits: last.edits };
};
