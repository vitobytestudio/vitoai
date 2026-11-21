/**
 * CRAFT — the difference between a layout and a film.
 *
 * Everything here exists because of one observation: the gap between a clean
 * template and a studio is not features, it is a few dozen small decisions that
 * a viewer cannot name but always feels.
 *
 *   1. Easing with anticipation and settle, never a linear ramp.
 *   2. Optical tracking — display type is set tight, small type is set loose.
 *   3. Motion blur on anything that moves fast, including numbers.
 *   4. Grain that crawls, halation on highlights, a grade, a vignette.
 *   5. Cuts that mean something: whip, match, L-cut on audio.
 */
import React from "react";

import { clamp, hash, rgba } from "./pure";

/** the one thing all three of these files needed from remotion: a full-bleed box */
const Fill: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode }> = ({ style, children }) => (
  <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", ...style }}>{children}</div>
);


/* ------------------------------------------------------------------ easing */

/** the only three curves a film needs */
export const EASE = {
  /** fast out, long settle — the default for anything arriving */
  out: (t: number) => {
    const x = clamp(t);
    return 1 - Math.pow(1 - x, 4);
  },
  /** slow start, decisive finish — for anything leaving */
  in: (t: number) => Math.pow(clamp(t), 4),
  inOut: (t: number) => {
    const x = clamp(t);
    return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;
  },
  /** pulls back before it goes — reads as weight */
  anticipate: (t: number) => {
    const x = clamp(t);
    const c = 1.7;
    return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
  },
  /** overshoots and settles — reads as spring, use sparingly */
  back: (t: number) => {
    const x = clamp(t);
    const c = 1.25;
    return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
  },
} as const;

/** progress of an element that starts at `at` and takes `dur` frames */
export const at = (f: number, start: number, dur = 22, ease: keyof typeof EASE = "out") =>
  EASE[ease]((f - start) / Math.max(1, dur));

/** a stagger of n elements, same curve, offset by `step` frames */
export const stagger = (f: number, n: number, start: number, step = 3, dur = 20) =>
  Array.from({ length: n }, (_, i) => at(f, start + i * step, dur));

/* ------------------------------------------------------------------- type */

/**
 * Optical tracking. Real type is not set at one tracking value: display sizes
 * are set tight so counters close up, body sizes are set loose so words stay
 * legible in a thumbnail. This table is the whole trick.
 */
export const tracking = (size: number) => {
  if (size >= 200) return "-0.065em";
  if (size >= 140) return "-0.05em";
  if (size >= 96) return "-0.038em";
  if (size >= 64) return "-0.026em";
  if (size >= 40) return "-0.014em";
  if (size >= 24) return "0.004em";
  if (size >= 16) return "0.03em";
  return "0.09em";
};

/** display type: one call gives size, leading and tracking that agree */
export const display = (size: number, leading = 1.05) => ({
  fontSize: size,
  lineHeight: leading,
  letterSpacing: tracking(size),
  fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1',
});

/** numbers that change must not jitter — force tabular figures */
export const numerals = { fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum" 1' };

/**
 * MOTION BLUR. When a number counts fast, the digits are not sharp — they smear.
 * Two blurred ghosts behind the crisp value cost nothing and read as speed.
 */
export const MotionNumber: React.FC<{
  value: string;
  active: number; // 1 while moving, 0 when settled
  size: number;
  color: string;
  font: string;
  weight?: number;
  style?: React.CSSProperties;
}> = ({ value, active, size, color, font, weight = 700, style }) => {
  const b = clamp(active) * (size * 0.018);
  return (
    <div style={{ position: "relative", ...style }}>
      {b > 0.4 ? (
        <>
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              ...display(size, 0.9),
              ...numerals,
              fontFamily: font,
              fontWeight: weight,
              color,
              opacity: 0.34,
              filter: `blur(${b}px)`,
              transform: `translateY(${-b * 0.4}px)`,
            }}
          >
            {value}
          </div>
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              ...display(size, 0.9),
              ...numerals,
              fontFamily: font,
              fontWeight: weight,
              color,
              opacity: 0.2,
              filter: `blur(${b * 2.4}px)`,
              transform: `translateY(${b * 0.5}px)`,
            }}
          >
            {value}
          </div>
        </>
      ) : null}
      <div
        style={{
          position: "relative",
          ...display(size, 0.9),
          ...numerals,
          fontFamily: font,
          fontWeight: weight,
          color,
        }}
      >
        {value}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------- grade */

/**
 * The grade. Every shot in a film passes through the same one, which is what
 * makes six different designs feel like they belong to one picture.
 *
 * Cheap by construction: gradients and one transformed noise tile. No SVG
 * filters, no blur over the whole frame.
 */
export const Grade: React.FC<{
  f: number;
  accent: string;
  /** 0..1, how much of the film look to apply */
  amount?: number;
  /** crawl the grain — a still grain reads as a texture, a crawling one reads as film */
  moving?: boolean;
  vignette?: number;
}> = ({ f, accent, amount = 1, moving = true, vignette = 0.55 }) => {
  const step = moving ? Math.floor(f / 2) % 6 : 0;
  const dx = (hash(step * 1.7) - 0.5) * 6;
  const dy = (hash(step * 3.1 + 4) - 0.5) * 6;

  return (
    <>
      {/* halation: light bleeding out of the brightest part of the frame */}
      <Fill
        style={{
          background: `radial-gradient(ellipse 62% 42% at 50% 34%, ${rgba(accent, 0.1 * amount)}, rgba(0,0,0,0) 68%)`,
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />

      {/* vignette, two stops so the falloff is filmic, not a circle */}
      <Fill
        style={{
          background: `radial-gradient(ellipse 78% 58% at 50% 46%, rgba(0,0,0,0) 42%, rgba(0,0,0,${0.34 * vignette}) 76%, rgba(0,0,0,${0.72 * vignette}) 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* chromatic fringe at the edges — where a real lens is weakest */}
      <Fill
        style={{
          boxShadow: `inset 0 0 120px ${rgba("#FF2D55", 0.1 * amount)}, inset 0 0 160px ${rgba("#2E7CFF", 0.08 * amount)}`,
          pointerEvents: "none",
        }}
      />

      {/* grain, crawling */}
      <Fill
        style={{
          opacity: 0.038 * amount,
          backgroundImage: "repeating-conic-gradient(#fff 0% 25%, #000 0% 50%)",
          backgroundSize: "3px 3px",
          transform: `translate(${dx}px, ${dy}px) scale(1.06)`,
          mixBlendMode: "overlay",
          pointerEvents: "none",
        }}
      />
    </>
  );
};

/* -------------------------------------------------------------------- cuts */

/**
 * The transitions. A dissolve is the default because it is safe; these are the
 * ones that make an edit feel authored.
 */
export type Cut = "dissolve" | "cut" | "whip" | "match" | "dip";

/**
 * How much of the *outgoing* scene is still visible, and the transform to put it
 * under. Returns null when there is no transition running.
 */
export const cutState = (
  kind: Cut | undefined,
  framesIntoScene: number,
  frames: number,
) => {
  const k = kind || "dissolve";
  if (k === "cut") return null;
  const d = k === "whip" ? 7 : k === "dip" ? 12 : Math.round(frames * 0.04);
  const t = clamp(framesIntoScene / d);
  if (t >= 1) return null;

  if (k === "whip") {
    // the outgoing frame is thrown sideways and smeared
    const e = EASE.in(t);
    return { opacity: 1 - t * 0.9, transform: `translateX(${-e * 100}%)`, filter: `blur(${e * 18}px)` };
  }
  if (k === "dip") {
    // through black, the oldest cut in the book and still the most reliable
    const e = Math.abs(t - 0.5) * 2;
    return { opacity: 1 - (1 - e) * 0.98, transform: "scale(1.02)", filter: `brightness(${1 - (1 - e) * 0.8})` };
  }
  if (k === "match") {
    // geometry carries across the cut: the frame pushes through
    const e = EASE.out(t);
    return { opacity: 1 - t, transform: `scale(${1 + e * 0.14})`, filter: `blur(${e * 6}px)` };
  }
  return { opacity: 1 - EASE.inOut(t), transform: "none", filter: "none" };
};

/** how far into the *incoming* scene the transition is */
export const incoming = (kind: Cut | undefined, framesIntoScene: number, frames: number) => {
  const k = kind || "dissolve";
  if (k === "cut") return 1;
  const d = k === "whip" ? 7 : k === "dip" ? 12 : Math.round(frames * 0.04);
  return EASE.out(clamp(framesIntoScene / d));
};

/* ------------------------------------------------------------------ layout */

/**
 * A baseline grid. Every element snaps to it, which is the invisible reason
 * professional frames look calm and amateur ones look busy.
 */
export const GRID = 8;
export const snap = (n: number) => Math.round(n / GRID) * GRID;

/** the safe area for a 9:16 deliverable, after platform chrome */
export const SAFE = { top: 220, bottom: 300, side: 92 };
