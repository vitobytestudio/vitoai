/**
 * THE AGENT — plan, build, look, correct, build again.
 *
 * There is no image model in this path. The studio does not ask something else
 * to imagine Paris; it builds Paris. So the loop is not about reshooting a
 * photograph, it is about looking at the film you just assembled and finding
 * the beats that do not work — copy that overflows, two shots that look the
 * same, a cut repeated three times, a run that goes over budget.
 *
 * That review is written in arithmetic (studio/critic.ts) and composed from a
 * library of independent axes (src/studio/library.ts), which means it is
 * instant, free, and available offline. A plan can still come from a model
 * when the deployment has one; everything after the plan is the studio's own
 * work.
 */
import { planStory, validatePlan, Storyboard, totalSeconds } from "../src/studio/story";
import { reviewLoop } from "../src/studio/critic";
import { describeLibrary, composeFilm } from "../src/studio/library";

/* ------------------------------------------------------------------ trace */

export type TraceKind = "plan" | "compose" | "review" | "fix" | "note" | "done";

export type Trace = {
  kind: TraceKind;
  label: string;
  detail?: string;
  ok?: boolean;
  ms?: number;
};

/* ------------------------------------------------------------------- plan */

export const aiHealth = async (): Promise<{ ai: boolean; models?: Record<string, string> }> => {
  try {
    const r = await fetch("/api/health");
    if (!r.ok) return { ai: false };
    return await r.json();
  } catch {
    return { ai: false };
  }
};

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
    log({
      kind: "plan",
      label: `planned ${story.scenes.length} scenes`,
      detail: `${totalSeconds(story).toFixed(1)}s · ${data.model || "model"}`,
      ok: true,
      ms: Math.round(performance.now() - t0),
    });
    return { story, via: "ai", model: data.model };
  } catch {
    log({
      kind: "plan",
      label: "planned from the brief",
      detail: `${fallback.scenes.length} scenes · ${totalSeconds(fallback).toFixed(1)}s · built-in planner`,
      ok: true,
      ms: Math.round(performance.now() - t0),
    });
    return { story: fallback, via: "rules" };
  }
};

/* ------------------------------------------------------------------ build */

export type Build = {
  story: Storyboard;
  score: number;
  pass: boolean;
  edits: string[];
  library: ReturnType<typeof describeLibrary>;
  variety: { worlds: number; cameras: number; decors: number; palettes: number };
};

/**
 * Build the film and review it twice.
 *
 * Round one fixes what is plainly wrong. Round two checks that the fix did not
 * break something else, which is the failure mode nobody avoids by luck. Then
 * it stops — an agent that keeps iterating without a stopping rule is not
 * careful, it is just slow and expensive.
 */
export const buildFilm = async (
  story: Storyboard,
  log: (t: Trace) => void,
  budget = 32,
): Promise<Build> => {
  const t0 = performance.now();
  const lib = describeLibrary();
  const comp = composeFilm(story, `${story.title}|${story.logline}`);
  log({
    kind: "compose",
    label: `composed ${story.scenes.length} beats`,
    detail: `${comp.variety.worlds} places · ${comp.variety.cameras} lenses · ${comp.variety.decors} motifs · palette ${comp.palette.id}`,
    ok: true,
    ms: Math.round(performance.now() - t0),
  });

  const t1 = performance.now();
  const out = reviewLoop(story, budget, 2);

  for (const round of out.rounds) {
    const v = round.verdict;
    log({
      kind: "review",
      label: `review ${round.round} · ${v.score}/100`,
      detail: v.problems.length
        ? v.problems.map((p) => p.say).join(" · ")
        : "holds: copy fits, no repeated beats, cuts vary, on budget",
      ok: v.pass,
      ms: Math.round(performance.now() - t1),
    });
    if (v.edits.length) {
      for (const e of v.edits) log({ kind: "fix", label: e, ok: true });
    }
    if (v.pass) break;
  }

  log({
    kind: "done",
    label: out.pass ? "shipped" : "shipped with notes",
    detail: `${totalSeconds(out.story).toFixed(1)}s · ${out.story.scenes.length} beats · ${lib.combinations.toLocaleString()} combinations available`,
    ok: out.pass,
  });

  return {
    story: out.story,
    score: out.score,
    pass: out.pass,
    edits: out.rounds.flatMap((r) => r.verdict.edits),
    library: lib,
    variety: comp.variety,
  };
};

export const preview = (s: Storyboard) =>
  `${s.scenes.length} scenes · ${totalSeconds(s).toFixed(1)}s · ${s.scenes.filter((x) => x.kind === "image").length} places`;
