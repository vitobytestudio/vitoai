import React from "react";
import { spring, useVideoConfig } from "remotion";
import { NX, T, r } from "./palette";
import { clamp } from "../lib/math";

/**
 * ENGLISH TYPE PRIMITIVES
 * -----------------------------------------------------------------------------
 * Latin only, so no ligature traps. Two rules that keep it looking expensive:
 *   · one tracking value per size — tight (-0.03em) for display, wide (0.32em)
 *     for micro-caps, nothing in between
 *   · every reveal is a mask, never an opacity fade alone; opacity fades read
 *     as a slideshow, masks read as motion
 */

const mask = (size: number) => ({
  // clipping a reveal mask here has burned us: the inline-block line box is
  // sized by line-height, and space-grotesk's ascent+descent (1.30em) exceeds
  // it, so overflow:hidden eats d/g/p/y. 0.46em of padding plus an inner
  // line-height of 1.3 leaves nothing to clip.
  padding: `${size * 0.12}px 0 ${size * 0.46}px`,
  margin: `${-size * 0.12}px 0 ${-size * 0.46}px`,
});

export const Cap: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  opacity?: number;
  style?: React.CSSProperties;
}> = ({ children, size = 19, color = NX.muted, opacity = 1, style }) => (
  <div
    style={{
      fontFamily: T.mono,
      fontSize: size,
      letterSpacing: "0.34em",
      textTransform: "uppercase",
      color,
      opacity,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Per-word masked rise. `start` is an absolute frame. */
export const Words: React.FC<{
  text: string;
  start: number;
  frame: number;
  size: number;
  color?: string;
  weight?: number;
  family?: string;
  stagger?: number;
  align?: "left" | "center" | "right";
  tracking?: string;
  lineHeight?: number;
  glow?: string;
  exitAt?: number;
  config?: { damping: number; stiffness: number; mass: number };
  style?: React.CSSProperties;
}> = ({
  text,
  start,
  frame,
  size,
  color = NX.white,
  weight = 600,
  family = T.display,
  stagger = 4,
  align = "left",
  tracking = "-0.03em",
  lineHeight = 1.06,
  glow,
  exitAt,
  config = { damping: 16, stiffness: 190, mass: 0.8 },
  style,
}) => {
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
        gap: `0 ${size * 0.26}px`,
        fontFamily: family,
        fontSize: size,
        fontWeight: weight,
        color,
        lineHeight,
        letterSpacing: tracking,
        textShadow: glow ? `0 0 ${size * 0.16}px ${glow}` : undefined,
        ...style,
      }}
    >
      {words.map((w, i) => {
        const t = start + i * stagger;
        const s = spring({ frame: frame - t, fps, config, durationInFrames: 38 });
        const ex = exitAt ? clamp((frame - exitAt - i * 2) / 14) : 0;
        return (
          <span key={`${w}-${i}`} style={{ display: "inline-block", overflow: "hidden", ...mask(size) }}>
            <span
              style={{
                display: "inline-block",
                lineHeight: 1.3,
                transform: `translateY(${(1 - s) * size * 0.9 - ex * size * 0.9}px)`,
                opacity: Math.min(1, s * 1.8) * (1 - ex),
                whiteSpace: "pre",
              }}
            >
              {w}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/** Letter-by-letter for the wordmark — used once, on the logo. */
export const Letters: React.FC<{
  text: string;
  start: number;
  frame: number;
  size: number;
  color?: string;
  weight?: number;
  stagger?: number;
  tracking?: string;
  glow?: string;
}> = ({ text, start, frame, size, color = NX.white, weight = 600, stagger = 2.2, tracking = "0.14em", glow }) => {
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        display: "flex",
        fontFamily: T.display,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: tracking,
        color,
        lineHeight: 1,
        textShadow: glow ? `0 0 ${size * 0.28}px ${glow}` : undefined,
      }}
    >
      {text.split("").map((c, i) => {
        const s = spring({
          frame: frame - (start + i * stagger),
          fps,
          config: { damping: 17, stiffness: 210, mass: 0.7 },
          durationInFrames: 32,
        });
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: size * 0.42, marginBottom: -size * 0.42 }}>
            <span style={{ display: "inline-block", lineHeight: 1.3, transform: `translateY(${(1 - s) * size}px)`, opacity: Math.min(1, s * 1.8) }}>
              {c}
            </span>
          </span>
        );
      })}
    </div>
  );
};

export const Num: React.FC<{
  to: number;
  start: number;
  frame: number;
  dur?: number;
  size: number;
  color?: string;
  suffix?: string;
  decimals?: number;
  weight?: number;
  family?: string;
}> = ({ to, start, frame, dur = 60, size, color = NX.white, suffix, decimals = 0, weight = 600, family = T.display }) => {
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - start, fps, config: { damping: 15, stiffness: 200, mass: 0.9 }, durationInFrames: 30 });
  const p = clamp((frame - start) / dur);
  const eased = 1 - Math.pow(1 - p, 3);
  const v = to * eased;
  const shown = decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString("en-US");
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: size * 0.05,
        fontFamily: family,
        fontWeight: weight,
        fontSize: size,
        color,
        lineHeight: 0.92,
        letterSpacing: "-0.04em",
        fontVariantNumeric: "tabular-nums",
        opacity: clamp(enter * 1.5),
        transform: `translateY(${(1 - enter) * size * 0.14}px)`,
      }}
    >
      <span>{shown}</span>
      {suffix ? <span style={{ fontSize: size * 0.4, color: NX.green, letterSpacing: "-0.01em" }}>{suffix}</span> : null}
    </div>
  );
};

export const Rule: React.FC<{ progress: number; width: number; color?: string; thickness?: number; opacity?: number }> = ({
  progress,
  width,
  color = NX.green,
  thickness = 1,
  opacity = 1,
}) => (
  <div
    style={{
      width: width * clamp(progress),
      height: thickness,
      background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
      opacity,
    }}
  />
);

/** glass panel — the card language of the whole film */
export const Panel: React.FC<{
  children: React.ReactNode;
  w?: number;
  h?: number;
  pad?: number;
  accent?: string;
  lit?: number;
  style?: React.CSSProperties;
}> = ({ children, w, h, pad = 34, accent = NX.green, lit = 1, style }) => (
  <div
    style={{
      width: w,
      height: h,
      padding: pad,
      boxSizing: "border-box",
      background: "linear-gradient(155deg, rgba(255,255,255,0.055), rgba(255,255,255,0.014))",
      border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 4,
      position: "relative",
      overflow: "hidden",
      ...style,
    }}
  >
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: 1,
        background: `linear-gradient(90deg, ${accent}, transparent)`,
        opacity: lit,
      }}
    />
    {children}
  </div>
);

/** NEXUS mark: six satellites joined through a core */
export const HexMark: React.FC<{ size: number; progress: number; frame: number }> = ({ size, progress, frame }) => {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    return [Math.cos(a), Math.sin(a)] as const;
  });
  const s = size / 2;
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="nxg" x1="-50" y1="-50" x2="50" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={NX.greenHot} />
          <stop offset="55%" stopColor={NX.green} />
          <stop offset="100%" stopColor={NX.blue} />
        </linearGradient>
      </defs>
      {pts.map(([x, y], i) => {
        const p = clamp(progress * 1.8 - i * 0.09);
        const drift = 1 + (1 - p) * 0.55;
        return (
          <g key={i}>
            <line
              x1={0}
              y1={0}
              x2={x * 30 * drift}
              y2={y * 30 * drift}
              stroke="url(#nxg)"
              strokeWidth={1.1}
              opacity={p * 0.85}
            />
            <circle cx={x * 30 * drift} cy={y * 30 * drift} r={2.6} fill="url(#nxg)" opacity={p} />
          </g>
        );
      })}
      <circle r={4.4 + Math.sin(frame * 0.06) * 0.5} fill={NX.greenHot} opacity={clamp(progress * 2)} />
      <circle r={13} fill="none" stroke={NX.green} strokeWidth={0.7} opacity={clamp(progress * 1.6) * 0.45} />
      <circle r={26} fill="none" stroke={NX.blue} strokeWidth={0.6} opacity={clamp(progress * 1.4) * 0.28} />
      <style>{`svg { --s: ${s}px }`}</style>
    </svg>
  );
};

export { r };
