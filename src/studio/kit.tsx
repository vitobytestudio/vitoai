/**
 * The kit every design system shares.
 *
 * What is shared is only the plumbing: the design space, the scale trick, the
 * easing, the grain. What each design does with type, layout and motion is its
 * own entirely — that is the point of having more than one.
 */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { DW, DH, PAD, MONO, DISP, ALT, clamp, ss, win, pulse, hash, rgba, mix } from "./pure";
export { DW, DH, PAD, MONO, DISP, ALT, clamp, ss, win, pulse, hash, rgba, mix };

/** the one thing all three of these files needed from remotion: a full-bleed box */
const Fill: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode }> = ({ style, children }) => (
  <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", ...style }}>{children}</div>
);

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
  <Fill style={{ background: bg, opacity: fade }}>
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
  </Fill>
);

/** a single chequer of noise — keeps flat colour from banding, costs nothing */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.032 }) => (
  <Fill
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
