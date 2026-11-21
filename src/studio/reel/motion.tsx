/**
 * MOTION — the studio's motion language, as code.
 *
 * Everything a film needs that a static frame does not: a beat grid, one
 * easing family, a camera with parallax, a fixed set of transitions, and one
 * text motion. The point is not more devices — it is that every device obeys
 * the same clock and the same curve, which is what separates an edit from a
 * slideshow.
 *
 * Rules encoded here, not documented elsewhere:
 *   1. ONE curve family. `out` for entrances, `in` for exits, `inOut` for
 *      camera moves. Never the default CSS ease.
 *   2. ONE grid. Bars at 2.0 s, beats at 0.5 s, at 120 BPM. Cuts land on beats.
 *   3. EVERY shot gets a camera. No static planes. Parallax is not decoration,
 *      it is how a flat comp acquires depth.
 *   4. THREE transitions. Whip, mask-match, scale-through. Nothing else.
 *   5. Text enters in 6–10 frames and leaves with the cut. It never dissolves.
 */
import React from "react";
import { Easing } from "remotion";

/* ------------------------------------------------------------------ clock */

export const BPM = 120;
export const FPS = 30;
export const BEAT = 60 / FPS; // 20 frames
export const BAR = BEAT * 4; // 80 frames? no: 4 beats at 0.5 s = 2 s = 60 frames
// (beat is 0.5 s = 15 frames at 30 fps; keep the numbers honest)
export const BEAT_F = (60 / BPM) * FPS; // 15
export const BAR_F = BEAT_F * 4; // 60

export const beatOf = (f: number) => Math.floor(f / BEAT_F);
export const barOf = (f: number) => Math.floor(f / BAR_F);
/** frames since the last beat, 0..14 */
export const onBeat = (f: number) => f % BEAT_F;
/** how loud a beat is: 1 on the downbeat, decaying across the bar */
export const pulse = (f: number) => Math.pow(1 - onBeat(f) / BEAT_F, 3);
/** true for n frames after a bar line */
export const isBarHit = (f: number, n = 1) => f % BAR_F < n && f > 0;

/* ----------------------------------------------------------------- curves */

const easeOut = Easing.bezier(0.16, 1, 0.3, 1); // arrivals: fast in, long settle
const easeIn = Easing.bezier(0.7, 0, 0.84, 0); // departures: hold, then leave
const easeInOut = Easing.bezier(0.65, 0, 0.35, 1); // camera: symmetric, no snap
export const CURVE = { out: easeOut, in: easeIn, inOut: easeInOut };

export const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (f: number, a: number, b: number, curve: (t: number) => number = easeOut) =>
  cl(curve(cl((f - a) / Math.max(1, b - a))));

/** a value that arrives and then holds, with an overshoot that is deliberate */
export const arrive = (f: number, a: number, b: number, over = 0) => {
  const t = smooth(f, a, b);
  if (!over) return t;
  const o = Math.sin(t * Math.PI) * over;
  return t + o;
};

/** seeded randomness — the same frame is never different between renders */
export const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/* ---------------------------------------------------------------- camera */

export type Cam = {
  /** 0..1 through the shot */
  t: number;
  /** push depth: 1 = resting */
  push: number;
  /** horizontal / vertical drift in px */
  x: number;
  y: number;
  /** degrees, small numbers only */
  rotY: number;
  tilt: number;
  /** layer separation: 0 = no parallax, 1 = strong */
  parallax: number;
};

/**
 * A camera move that a big house would call "a slow push with a drift".
 * Every shot gets one; they differ by amplitude, never by kind.
 */
export const camMove = (f: number, from: number, to: number, opts: { push?: number; drift?: number; tilt?: number; rot?: number } = {}): Cam => {
  const { push = 0.06, drift = 18, tilt = 2.2, rot = 3 } = opts;
  const t = smooth(f, from, to, easeInOut);
  return {
    t,
    push: 1 + push * t,
    x: (rnd(from) - 0.5) * drift * t,
    y: (rnd(from + 3) - 0.5) * drift * t,
    rotY: (rnd(from + 7) - 0.5) * rot * t,
    tilt: (rnd(from + 11) - 0.5) * tilt * t,
    parallax: 1,
  };
};

/**
 * A camera transform for a full-frame content wrapper: translate and scale
 * only. Rotation on a 1920px plane is what moved headlines off their marks in
 * the first cut of this study — small elements may tilt, whole-frame wrappers
 * may not.
 */
export const plate2d = (cam: Cam, depth: number): React.CSSProperties => ({
  transform: `translate3d(${cam.x * depth}px, ${cam.y * depth}px, 0) scale(${1 + (cam.push - 1) * (0.35 + depth * 1.1)})`,
  transformOrigin: "50% 50%",
});

/** the plate: apply a camera to a layer. depth 0 = far, 1 = near. */
export const plate = (cam: Cam, depth: number): React.CSSProperties => {
  const k = 1 + (cam.push - 1) * (0.35 + depth * 1.1);
  return {
    transform: `translate3d(${cam.x * depth}px, ${cam.y * depth}px, 0) scale(${k}) rotateX(${cam.tilt * depth}deg) rotateY(${cam.rotY * depth}deg)`,
    transformOrigin: "50% 50%",
  };
};

/** the wrapper that gives a comp real depth */
export const stage: React.CSSProperties = {
  perspective: 1600,
  perspectiveOrigin: "50% 50%",
  transformStyle: "preserve-3d",
};

/* ------------------------------------------------------------ transitions */

export type Transition = "whip" | "mask" | "scale" | "cut";

/**
 * Progress of a transition around a cut frame. Returns a 0..1 where 0.5 is the
 * cut itself, so both sides can be driven from one number.
 */
export const transProgress = (f: number, cut: number, len = 6) => {
  const half = len / 2;
  if (f < cut - half || f > cut + half) return null;
  return (f - (cut - half)) / len;
};

/** whip: the frame is dragged and smeared for 6 frames across the cut */
export const whipStyle = (f: number, cut: number, dir = 1): React.CSSProperties => {
  const p = transProgress(f, cut, 6);
  if (p === null) return {};
  const k = Math.sin(p * Math.PI); // 0 → 1 → 0
  const side = p < 0.5 ? -1 : 1;
  return {
    transform: `translateX(${side * 140 * (1 - k) * dir}px) scale(${1 + 0.04 * k})`,
    filter: k > 0.02 ? `blur(${18 * k}px)` : undefined,
  };
};

/** mask-match: a shape travels across the cut carrying the new image in */
export const maskMatch = (f: number, cut: number, len = 12, shape: "bar" | "circle" = "bar") => {
  const half = len / 2;
  if (f < cut - half || f > cut + half) return { clip: undefined as string | undefined, on: false };
  const p = clamp01((f - (cut - half)) / len);
  const on = true;
  if (shape === "circle") {
    const r = p < 0.5 ? p * 2 * 78 : (1 - (p - 0.5) * 2) * 150;
    return { clip: `circle(${r}% at 50% 50%)`, on };
  }
  const inset = p < 0.5 ? (1 - p * 2) * 50 : 0;
  const top = p < 0.5 ? 50 - (1 - p * 2) * 50 : (p - 0.5) * 2 * 50;
  return { clip: `inset(${top}% 0% ${100 - top - (p < 0.5 ? (1 - p * 2) * 100 : 100 - (p - 0.5) * 2 * 100)}% 0%)`, on };
};

/**
 * scale-through: the outgoing plate keeps moving away, the incoming one is
 * already larger than the frame and settles. A cut that carries velocity.
 */
export const scaleThrough = (f: number, cut: number, len = 10, out: boolean) => {
  const half = len / 2;
  const p = out ? smooth(f, cut - half, cut, easeIn) : smooth(f, cut, cut + half, easeOut);
  if (out) {
    if (f >= cut) return { scale: 1, opacity: 0 };
    return { scale: lerp(1, 2.6, p), opacity: lerp(1, 0, p * p) };
  }
  if (f < cut) return { scale: 1.6, opacity: 0 };
  return { scale: lerp(1.62, 1, p), opacity: lerp(0, 1, Math.min(1, p * 2.2)) };
};

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/* ------------------------------------------------------------------- text */

/**
 * The only text motion in the house: a rise out of its own line, with the
 * mask a few percent wider than the glyphs so Arabic never gets clipped, and
 * an exit that travels up and out on the cut rather than fading in place.
 */
export const TextRise: React.FC<{
  v: number;
  out?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  inner?: React.CSSProperties;
}> = ({ v, out = 0, children, style, inner }) => {
  const enc = v >= 0.999 ? undefined : `inset(-45% -14% ${(1 - v) * 100}% -14%)`;
  return (
    <span style={{ display: "block", clipPath: enc, ...style }}>
      <span
        style={{
          display: "block",
          transform: `translateY(${(1 - v) * 34 - out * 46}%)`,
          opacity: 1 - out * 0.9,
          ...inner,
        }}
      >
        {children}
      </span>
    </span>
  );
};

/** a horizontal rule that draws from its origin, the cheapest sign of intent */
export const Hair: React.FC<{ v: number; w?: number | string; c?: string; o?: number; style?: React.CSSProperties }> = ({
  v,
  w = "100%",
  c = "currentColor",
  o = 0.4,
  style,
}) => <div style={{ width: w, height: 1, background: c, opacity: o, transform: `scaleX(${v})`, transformOrigin: "0 50%", ...style }} />;
