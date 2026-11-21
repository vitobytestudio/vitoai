/**
 * THE DIRECTOR — where the agent actually thinks.
 *
 * Two brains, deliberately:
 *
 *   the planner   brain.ts, deterministic, instant, cannot fail. It decides the
 *                 structure of the film: how many beats, how long, which places,
 *                 what the soundbed is doing.
 *
 *   the director  a language model, reached through our own edge. It decides the
 *                 part that is actually creative: the idea, every line of copy,
 *                 and which of the eleven page architectures each beat deserves.
 *
 * The director is not trusted with structure. It answers, we clamp the answer,
 * we lay it over the planner's skeleton. If it is slow, offline, rate-limited or
 * simply bad, the film is still a film — just a quieter one. That is the whole
 * point of the split: intelligence when it is available, never dependence.
 */
import { think, summarise, type Decision, type BrainOptions } from "../src/studio/brain";
import { ARCH_IDS } from "../src/studio/art";

export type Direction = {
  concept: string;
  headline: string;
  sub: string;
  kicker: string;
  palette: "green" | "blue" | "amber" | "violet" | "ice";
  refused: string[];
  voice: string[];
  beats: { i: number; label: string; line: string; visual: string; arch: string }[];
  ms: number;
  model: string;
};

const PALETTE: Record<Direction["palette"], string> = {
  green: "#00FF88",
  blue: "#3D8BFF",
  amber: "#FFB020",
  violet: "#A66BFF",
  ice: "#7FE6FF",
};

/** one line of copy at a time: the architectures need single lines, not paragraphs */
const oneLine = (s: string) => s.replace(/\s+/g, " ").replace(/[.。]$/, "").trim();

export const applyDirection = (base: Decision, d: Direction): Decision => {
  const out: Decision = { ...base, beats: base.beats.map((b) => ({ ...b })) };

  if (d.headline) {
    // the hook page wants a line it can stack; split on the natural break only
    out.headline = oneLine(d.headline).replace(/\\n/g, "\n");
  }
  if (d.sub) out.sub = oneLine(d.sub);
  if (d.kicker) out.kicker = d.kicker.toUpperCase().slice(0, 26);
  if (d.palette && PALETTE[d.palette]) {
    out.accent = PALETTE[d.palette];
    out.paletteId = d.palette;
  }
  if (d.refused?.length) out.refused = d.refused;

  const used = new Set<string>();
  d.beats.forEach((b) => {
    const i = b.i - 1;
    const beat = out.beats[i];
    if (!beat) return;
    if (b.label) beat.caption = oneLine(b.label).slice(0, 34);
    if (b.line) beat.line = oneLine(b.line).slice(0, 160);
    // a page is only honoured if it is real and not the one before it
    const prev = i > 0 ? out.beats[i - 1].arch || "" : "";
    if (b.arch && (ARCH_IDS as readonly string[]).includes(b.arch) && b.arch !== prev) {
      beat.arch = b.arch;
      used.add(b.arch);
    }
  });

  // the closing card is never negotiable, and a number beat needs its figure
  const last = out.beats.length - 1;
  if (out.beats[last]) out.beats[last].arch = "signature";

  if (d.voice?.length) {
    out.voice = out.beats.map((_, i) => oneLine(d.voice[i] || base.voice[i] || "").slice(0, 180));
  }

  out.concept = oneLine(d.concept || "");
  out.by = "director";
  out.direction = d;
  return out;
};

const withTimeout = async (ms: number, run: (signal: AbortSignal) => Promise<Response>) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await run(c.signal);
  } finally {
    clearTimeout(t);
  }
};

/**
 * Plan a film. Resolves exactly once, always with something to watch: the
 * structural plan is synchronous and instant, the direction is applied when it
 * lands, and the caller re-renders.
 */
export const direct = async (
  brief: string,
  opts: BrainOptions = {},
  onStructural?: (d: Decision) => void,
): Promise<{ decision: Decision; note: string }> => {
  const base = think(brief, opts);

  try {
    const res = await withTimeout(14_000, (signal) =>
      fetch("/api/direction", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brief,
          skeleton: base.beats.map((b, i) => ({ i: i + 1, kind: b.kind, seconds: +b.seconds.toFixed(1) })),
        }),
        signal,
      }),
    );
    if (!res.ok) throw new Error(`director ${res.status}`);
    const { direction } = (await res.json()) as { direction: Direction };
    if (!direction || !direction.beats?.length) throw new Error("empty direction");
    const merged = applyDirection(base, direction);
    onStructural?.(base);
    return { decision: merged, note: `directed in ${(direction.ms / 1000).toFixed(1)}s` };
  } catch {
    onStructural?.(base);
    return { decision: { ...base, by: "planner" }, note: "written by the planner · the director did not answer" };
  }
};

export { summarise };
