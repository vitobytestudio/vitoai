/**
 * The kit every design system shares.
 *
 * What is shared is only the plumbing: the design space, the scale trick, the
 * easing, the grain. What each design does with type, layout and motion is its
 * own entirely — that is the point of having more than one.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

export const DW = 1080;
export const DH = 1920;
export const PAD = 92;

export const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace';
export const DISP = '"Space Grotesk", "Sora", system-ui, sans-serif';
export const ALT = '"Sora", "Space Grotesk", system-ui, sans-serif';

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const ss = (x: number) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};
/** 0 → 1 over [a,b] */
export const win = (f: number, a: number, b: number) => ss((f - a) / Math.max(1, b - a));
/** 0 → 1 → 0 */
export const pulse = (f: number, a: number, b: number) =>
  Math.min(win(f, a, (a + b) / 2), 1 - win(f, (a + b) / 2, b));

/** deterministic pseudo-random, identical on every machine */
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const rgba = (hex: string, a: number) => {
  const h = (hex || "#00FF88").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${clamp(a)})`;
};

/** blend two hex colours */
/**
 * Parse any colour this file emits. It has to accept its own output: mix()
 * returns rgb(), and mix(mix(a,b,.2), "#000", .4) is the most natural thing to
 * write. Parsing only hex silently produced NaN colours, which the browser
 * drops, which made nested blends render as transparent.
 */
const parseColor = (h: string): [number, number, number] => {
  const str = (h || "").trim();
  if (str.startsWith("rgb")) {
    const n = str.slice(str.indexOf("(") + 1, -1).split(",").map((x) => parseFloat(x));
    return [n[0] || 0, n[1] || 0, n[2] || 0];
  }
  const s = str.replace("#", "");
  if (s.length === 3) {
    return [parseInt(s[0] + s[0], 16), parseInt(s[1] + s[1], 16), parseInt(s[2] + s[2], 16)];
  }
  return [parseInt(s.slice(0, 2), 16) || 0, parseInt(s.slice(2, 4), 16) || 0, parseInt(s.slice(4, 6), 16) || 0];
};

export const mix = (a: string, b: string, t: number) => {
  const p = parseColor;
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  const q = (x: number, y: number) => Math.round(x + (y - x) * clamp(t));
  return `rgb(${q(r1, r2)},${q(g1, g2)},${q(b1, b2)})`;
};

export type Timeline = {
  f: number;
  F: number;
  fps: number;
  t: number; // 0..1 through the film
  k: number; // design-space scale
  head: number; // frames before the outro
  outro: number; // frames the outro starts at
};

export const useTimeline = (): Timeline => {
  const f = useCurrentFrame();
  const { durationInFrames, fps, width } = useVideoConfig();
  const outro = Math.round(durationInFrames * 0.76);
  return {
    f,
    F: durationInFrames,
    fps,
    t: durationInFrames ? f / durationInFrames : 0,
    k: width / DW,
    head: outro,
    outro,
  };
};

/** the fixed 1080×1920 design space, scaled to whatever the export is */
export const Stage: React.FC<{
  k: number;
  bg?: string;
  children: React.ReactNode;
  fade?: number;
}> = ({ k, bg = "#050B14", children, fade = 1 }) => (
  <AbsoluteFill style={{ background: bg, opacity: fade }}>
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: DW,
        height: DH,
        transform: `scale(${k})`,
        transformOrigin: "0 0",
      }}
    >
      {children}
    </div>
  </AbsoluteFill>
);

/** a single chequer of noise — keeps flat colour from banding, costs nothing */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.032 }) => (
  <AbsoluteFill
    style={{
      opacity,
      backgroundImage: "repeating-conic-gradient(#fff 0% 25%, #000 0% 50%)",
      backgroundSize: "3px 3px",
      mixBlendMode: "overlay",
      pointerEvents: "none",
    }}
  />
);

/** the mark, drawn flat, used at the end of every design */
export const Mark: React.FC<{ size?: number; color: string; stroke?: number; rule?: boolean }> = ({
  size = 112,
  color,
  stroke = 10,
  rule = true,
}) => (
  <svg width={size} height={size} viewBox="0 0 110 110" style={{ display: "block" }}>
    <path d="M12 14 L55 92 L98 14" fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round" />
    {rule ? <line x1={24} y1={102} x2={86} y2={102} stroke={color} strokeWidth={stroke * 0.8} opacity={0.45} /> : null}
  </svg>
);

/** counts the hero value; falls back to showing the literal if it is not a number */
export const useHero = (hero: string, t: Timeline, at = 0.16, span = 0.18) => {
  const target = Number(String(hero).replace(/[^\d.]/g, ""));
  const numeric = Number.isFinite(target) && target > 0 && /^[\d.,]+$/.test(String(hero));
  const p = win(t.f, t.F * at, t.F * (at + span));
  return {
    numeric,
    value: numeric ? Math.round(target * p).toLocaleString("en-US") : String(hero),
    p,
  };
};

/**
 * Pick a font size that fits a fixed measure.
 * Space Grotesk Bold advances at roughly 0.56em, which is close enough that a
 * single pass keeps long business copy inside the frame on every design.
 */
export const fit = (text: string, maxWidth: number, base: number, min = 34) => {
  const est = String(text).length * base * 0.56;
  if (est <= maxWidth) return base;
  return Math.max(min, Math.floor(maxWidth / (String(text).length * 0.56)));
};

/** headline split into lines, safely */
export const linesOf = (s: string) => String(s || "").split("\n").filter((x) => x.length > 0);
