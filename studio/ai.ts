/**
 * The client side of the agent.
 *
 * Every call degrades honestly: if /api/plan is unreachable (local dev, no
 * binding, quota exhausted) the studio uses the deterministic planner and says
 * which one it used. A film always gets made.
 */
import { planStory, validatePlan, Storyboard, Scene, totalSeconds } from "../src/studio/story";

export type Stage =
  | { s: "idle" }
  | { s: "planning" }
  | { s: "planned"; via: "ai" | "rules"; model?: string }
  | { s: "shooting"; done: number; total: number; via: "ai" | "field" }
  | { s: "ready" }
  | { s: "failed"; why: string };

export const aiHealth = async (): Promise<{ ai: boolean; models?: Record<string, string> }> => {
  try {
    const r = await fetch("/api/health");
    if (!r.ok) return { ai: false };
    return await r.json();
  } catch {
    return { ai: false };
  }
};

/** ask the model for a plan; fall back to the rules planner without ceremony */
export const planWithAI = async (
  brief: string,
  maxSeconds: number,
): Promise<{ story: Storyboard; via: "ai" | "rules"; model?: string }> => {
  const fallback = planStory(brief, maxSeconds);
  try {
    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brief }),
    });
    if (!res.ok) return { story: fallback, via: "rules" };
    const data = await res.json();
    if (!data?.plan) return { story: fallback, via: "rules" };
    return { story: validatePlan(data.plan, fallback), via: "ai", model: data.model };
  } catch {
    return { story: fallback, via: "rules" };
  }
};

/** one generated still; resolves to an object URL, or null if AI is unavailable */
export const shootScene = async (
  scene: Scene,
  seed: number,
): Promise<string | null> => {
  if (!scene.shot) return null;
  try {
    const res = await fetch("/api/shot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: scene.shot, seed }),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
};

/** shoot every image scene in sequence, reporting progress as it goes */
export const shootAll = async (
  story: Storyboard,
  onProgress: (done: number, total: number) => void,
  shouldStop: () => boolean = () => false,
): Promise<{ footage: Record<string, string>; via: "ai" | "field" }> => {
  const footage: Record<string, string> = {};
  const jobs = story.scenes
    .map((s, i) => ({ s, i }))
    .filter((x) => x.s.kind === "image");

  let shot = 0;
  for (let n = 0; n < jobs.length; n++) {
    const { s, i } = jobs[n];
    if (shouldStop()) break;
    const url = await shootScene(s, i * 977 + 13);
    if (url) {
      footage[String(i)] = url;
      shot++;
    }
    onProgress(n + 1, jobs.length);
  }

  return { footage, via: shot > 0 ? "ai" : "field" };
};

export const preview = (s: Storyboard) =>
  `${s.scenes.length} scenes · ${totalSeconds(s).toFixed(1)}s · ${s.scenes.filter((x) => x.kind === "image").length} shots`;
