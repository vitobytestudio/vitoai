import React from "react";
import { interpolate, spring, useVideoConfig } from "remotion";
import { TYPE } from "./palette";
import { AUTHORED_FPS } from "./timeline";
import { clamp } from "../lib/math";

/**
 * TYPE SYSTEM
 * -----------------------------------------------------------------------------
 * The ad is text-led, so the text primitives are the product. Two rules learned
 * the hard way in this sandbox:
 *   1. `letter-spacing` must stay 0 on Arabic — anything else breaks the
 *      lam-alef ligature and the word falls apart.
 *   2. Masked reveals clip descenders (ب ي ج tails), so every mask carries a
 *      padding/negative-margin pair sized from the font size.
 */

const maskPad = (size: number) => ({
  paddingBottom: size * 0.34,
  marginBottom: -size * 0.34,
});

/* --------------------------------- kicker --------------------------------- */

export const Kicker: React.FC<{
  left?: string;
  right?: string;
  color?: string;
  opacity?: number;
  size?: number;
  style?: React.CSSProperties;
}> = ({ left, right, color = "rgba(250,250,250,0.62)", opacity = 1, size = 21, style }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 18,
      opacity,
      fontFamily: TYPE.mono,
      fontSize: size,
      letterSpacing: "0.34em",
      textTransform: "uppercase",
      color,
      ...style,
    }}
  >
    <span
      style={{
        width: 9,
        height: 9,
        background: "#F6821F",
        boxShadow: "0 0 22px rgba(246,130,31,0.9)",
        flexShrink: 0,
      }}
    />
    {left ? <span>{left}</span> : null}
    <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.18)" }} />
    {right ? <span style={{ color: "rgba(250,250,250,0.4)" }}>{right}</span> : null}
  </div>
);

/* ---------------------------------- line ---------------------------------- */

/** Per-word mask reveal. `start` is an ABSOLUTE frame. */
export const RevealWords: React.FC<{
  text: string;
  start: number;
  frame: number;
  stagger?: number;
  size: number;
  color?: string;
  family?: string;
  weight?: number;
  dir?: "rtl" | "ltr";
  align?: "center" | "flex-start" | "flex-end";
  lineHeight?: number;
  glow?: string;
  exitAt?: number;
  riseFrom?: number;
  config?: { damping: number; stiffness: number; mass: number };
  style?: React.CSSProperties;
}> = ({
  text,
  start,
  frame,
  stagger = 5,
  size,
  color = "#FAFAFA",
  family = TYPE.ar,
  weight = 900,
  dir = "rtl",
  align = "center",
  lineHeight = 1.18,
  glow,
  exitAt,
  riseFrom = 1.05,
  config = { damping: 15, stiffness: 190, mass: 0.7 },
  style,
}) => {
  const fps = AUTHORED_FPS;
  const words = text.split(" ");

  return (
    <div
      dir={dir}
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align,
        gap: `0 ${size * 0.22}px`,
        fontFamily: family,
        fontSize: size,
        fontWeight: weight,
        color,
        lineHeight,
        letterSpacing: 0, // never touch this for Arabic
        textShadow: glow ? `0 0 ${size * 0.18}px ${glow}` : undefined,
        ...style,
      }}
    >
      {words.map((w, i) => {
        const t = start + i * stagger;
        const s = spring({ frame: frame - t, fps, config, durationInFrames: 36 });
        const exit = exitAt ? clamp((frame - exitAt - i * 2) / 14) : 0;
        return (
          <span key={`${w}-${i}`} style={{ display: "inline-block", overflow: "hidden", ...maskPad(size) }}>
            <span
              style={{
                display: "inline-block",
                transform: `translateY(${(1 - s) * size * 0.92 + exit * -size * 0.92}px)`,
                opacity: Math.min(1, s * 1.6) * (1 - exit),
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

/* --------------------------------- counter -------------------------------- */

/** Mechanical number roll. Latin numerals on purpose — they read as "global". */
export const Counter: React.FC<{
  to: number;
  start: number;
  frame: number;
  dur?: number;
  size: number;
  color?: string;
  suffix?: string;
  prefix?: string;
  family?: string;
  weight?: number;
  decimals?: number;
}> = ({ to, start, frame, dur = 48, size, color = "#FAFAFA", suffix, prefix, family = TYPE.en, weight = 700, decimals = 0 }) => {
  const fps = AUTHORED_FPS;
  const enter = spring({ frame: frame - start, fps, config: { damping: 14, stiffness: 200, mass: 0.8 }, durationInFrames: 30 });
  const p = clamp((frame - start) / dur);
  const eased = 1 - Math.pow(1 - p, 3.2);
  const value = to * eased;
  const shown = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString("en-US");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: size * 0.08,
        fontFamily: family,
        fontWeight: weight,
        fontSize: size,
        color,
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
        opacity: clamp(enter * 1.4),
        transform: `translateY(${(1 - enter) * size * 0.18}px)`,
      }}
    >
      {prefix ? <span style={{ fontSize: size * 0.42, color: "#8C8C96" }}>{prefix}</span> : null}
      <span>{shown}</span>
      {suffix ? <span style={{ fontSize: size * 0.42, color: "#F6821F", fontWeight: 500 }}>{suffix}</span> : null}
    </div>
  );
};

/* --------------------------------- hairline ------------------------------- */

export const Hair: React.FC<{
  progress: number;
  width?: number;
  color?: string;
  thickness?: number;
  opacity?: number;
}> = ({ progress, width = 760, color = "#F6821F", thickness = 2, opacity = 1 }) => (
  <div
    style={{
      width: width * clamp(progress),
      height: thickness,
      background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
      boxShadow: `0 0 26px ${color}`,
      opacity,
    }}
  />
);

/* ---------------------------------- chip ---------------------------------- */

export const Chip: React.FC<{
  label: string;
  value: string;
  enter: number;
  start: number;
  accent?: string;
}> = ({ label, value, enter, start, accent = "#F6821F" }) => {
  const fps = AUTHORED_FPS;
  const s = spring({ frame: start - 0, fps, config: { damping: 16, stiffness: 170, mass: 0.8 }, durationInFrames: 30 });
  void s;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "20px 30px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.035)",
        backdropFilter: "blur(2px)",
        opacity: clamp(enter),
        transform: `translateY(${(1 - clamp(enter)) * 26}px)`,
      }}
    >
      <span style={{ width: 6, height: 6, background: accent, boxShadow: `0 0 16px ${accent}` }} />
      <span style={{ fontFamily: TYPE.en, fontWeight: 700, fontSize: 34, color: "#FAFAFA", fontVariantNumeric: "tabular-nums" }}>{value}</span>
      <span style={{ fontFamily: TYPE.mono, fontSize: 18, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(250,250,250,0.46)" }}>
        {label}
      </span>
    </div>
  );
};

export const fade = (frame: number, from: number, to: number, f: number) => interpolate(f, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
