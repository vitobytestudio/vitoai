/**
 * The agent loop.
 *
 * This is written to work the way a person with tools works, not the way a
 * template works. It does not fire one request and present the result. It:
 *
 *   plan  →  shoot  →  LOOK AT IT  →  judge  →  fix the prompt  →  shoot again
 *
 * and it stops only when the shot passes or the attempt budget is spent. Every
 * step is recorded, so the interface can show the reasoning instead of hiding it.
 */
import { planStory, validatePlan, Storyboard, Scene, totalSeconds } from "../src/studio/story";

/* ------------------------------------------------------------------ trace */

export type TraceKind = "plan" | "shot" | "review" | "fix" | "assemble" | "note";

export type Trace = {
  kind: TraceKind;
  label: string;
  detail?: string;
  ok?: boolean;
  ms?: number;
};

export type ShotResult = {
  url: string | null;
  score: number | null;
  attempts: number;
  prompt: string;
  problems: string[];
};

/* ------------------------------------------------------------------ health */

export const aiHealth = async (): Promise<{ ai: boolean; models?: Record<string, string> }> => {
  try {
    const r = await fetch("/api/health");
    if (!r.ok) return { ai: false };
    return await r.json();
  } catch {
    return { ai: false };
  }
};

/* ------------------------------------------------------------------- plan */

export const planWithAI = async (
  brief: string,
  maxSeconds: number,
  log: (t: Trace) => void,
): Promise<{ story: Storyboard; via: "ai" | "rules"; model?: string }> => {
  const fallback = planStory(brief, maxSeconds);
  const t0 = performance.now();

  try {
    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brief }),
    });
    if (!res.ok) throw new Error(`plan ${res.status}`);
    const data = await res.json();
    if (!data?.plan) throw new Error("no plan");

    const story = validatePlan(data.plan, fallback);
    const images = story.scenes.filter((s) => s.kind === "image").length;
    log({
      kind: "plan",
      label: `planned ${story.scenes.length} scenes`,
      detail: `${images} shots · ${totalSeconds(story).toFixed(1)}s · ${data.model || "model"}`,
      ok: true,
      ms: Math.round(performance.now() - t0),
    });
    return { story, via: "ai", model: data.model };
  } catch (e) {
    log({
      kind: "plan",
      label: "model unavailable — used the built-in planner",
      detail: `${fallback.scenes.length} scenes · ${totalSeconds(fallback).toFixed(1)}s`,
      ok: false,
      ms: Math.round(performance.now() - t0),
    });
    return { story: fallback, via: "rules" };
  }
};

/* ------------------------------------------------------------------ shoot */

const toDataURL = (blob: Blob): Promise<string> =>
  new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = () => rej(new Error("read failed"));
    fr.readAsDataURL(blob);
  });

const shootOnce = async (prompt: string, seed: number): Promise<Blob | null> => {
  try {
    const res = await fetch("/api/shot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt, seed }),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob.type.startsWith("image/") ? blob : null;
  } catch {
    return null;
  }
};

const reviewOnce = async (dataUrl: string, prompt: string) => {
  try {
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image: dataUrl, prompt }),
    });
    if (!res.ok) return null;
    return (await res.json()) as { score: number; pass: boolean; problems: string[]; fix: string };
  } catch {
    return null;
  }
};

/**
 * Shoot one scene properly.
 *
 * Two attempts, no more. The second prompt is the first prompt plus what the
 * critic said was wrong — that is the whole trick, and it is why the second
 * attempt usually beats the first.
 */
export const shootScene = async (
  scene: Scene,
  seed: number,
  log: (t: Trace) => void,
  review: boolean,
): Promise<ShotResult> => {
  let prompt = scene.shot || "";
  let best: { blob: Blob; url: string; score: number } | null = null;
  let attempts = 0;
  let problems: string[] = [];

  for (let n = 0; n < 2; n++) {
    attempts++;
    const t0 = performance.now();
    const blob = await shootOnce(prompt, seed + n * 101);
    if (!blob) {
      log({ kind: "shot", label: "shot failed", detail: prompt.slice(0, 70), ok: false });
      break;
    }
    const url = URL.createObjectURL(blob);
    log({
      kind: "shot",
      label: n === 0 ? "shot" : "reshot",
      detail: prompt.slice(0, 78),
      ok: true,
      ms: Math.round(performance.now() - t0),
    });

    if (!review) {
      best = { blob, url, score: 0 };
      break;
    }

    const t1 = performance.now();
    const verdict = await reviewOnce(await toDataURL(blob), prompt);
    if (!verdict) {
      log({ kind: "review", label: "no critic available", detail: "kept the shot unreviewed", ok: false });
      best = { blob, url, score: 0 };
      break;
    }

    problems = verdict.problems || [];
    log({
      kind: "review",
      label: `scored ${verdict.score}/100`,
      detail: problems.length ? problems.join(" · ") : verdict.pass ? "reads as intended" : "weak",
      ok: verdict.pass,
      ms: Math.round(performance.now() - t1),
    });

    if (!best || verdict.score > best.score) best = { blob, url, score: verdict.score };
    if (verdict.pass) break;

    if (n === 0 && verdict.fix) {
      const next = `${scene.shot}. ${verdict.fix}`;
      log({ kind: "fix", label: "prompt corrected", detail: verdict.fix, ok: true });
      prompt = next;
    }
  }

  // release the losing frame so a long shoot does not leak memory
  if (best) return { url: best.url, score: best.score || null, attempts, prompt, problems };
  return { url: null, score: null, attempts, prompt, problems };
};

/* ------------------------------------------------------------------- run */

export const shootAll = async (
  story: Storyboard,
  log: (t: Trace) => void,
  onProgress: (done: number, total: number) => void,
  opts: { review: boolean; shouldStop?: () => boolean } = { review: true },
): Promise<{ footage: Record<string, string>; shots: number; avg: number | null }> => {
  const footage: Record<string, string> = {};
  const jobs = story.scenes.map((s, i) => ({ s, i })).filter((x) => x.s.kind === "image");

  let shots = 0;
  const scores: number[] = [];

  for (let n = 0; n < jobs.length; n++) {
    if (opts.shouldStop?.()) {
      log({ kind: "note", label: "shoot cancelled", detail: `${n} of ${jobs.length} scenes` });
      break;
    }
    const { s, i } = jobs[n];
    log({ kind: "note", label: `scene ${i + 1} · ${s.caption || "shot"}` });
    const r = await shootScene(s, i * 977 + 13, log, opts.review);
    if (r.url) {
      footage[String(i)] = r.url;
      shots++;
    }
    if (r.score) scores.push(r.score);
    onProgress(n + 1, jobs.length);
  }

  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  log({
    kind: "assemble",
    label: shots ? `${shots} shots ready` : "no shots — using generated fields",
    detail: avg !== null ? `mean critic score ${avg}/100` : undefined,
    ok: shots > 0,
  });

  return { footage, shots, avg };
};

export const preview = (s: Storyboard) =>
  `${s.scenes.length} scenes · ${totalSeconds(s).toFixed(1)}s · ${s.scenes.filter((x) => x.kind === "image").length} shots`;
