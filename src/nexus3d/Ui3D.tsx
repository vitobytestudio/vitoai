import React from "react";
import { spring, useVideoConfig } from "remotion";
import { NX, T } from "../nexus/palette";
import { FOV, NEAR, P3 } from "./engine";

/**
 * DOM IN 3D SPACE
 * =============================================================================
 * Typography cannot be drawn on canvas in this build, so every word lives in
 * the DOM — but it has to sit in the same 3D space as the canvas geometry or
 * the two layers stop agreeing. `world()` runs the exact projection the canvas
 * uses and returns a CSS transform, plus a depth-of-field blur and a haze fade.
 * That single function is why text and particles feel like one camera.
 */

export type Placed = {
  left: number;
  top: number;
  scale: number;
  blur: number;
  opacity: number;
  depth: number;
  z: number;
};

export const world = (
  p: P3,
  camZ: number,
  cx: number,
  cy: number,
  opts: { focus?: number; range?: number; maxBlur?: number; fadeNear?: number; fadeFar?: number } = {},
): Placed => {
  const { focus = 1500, range = 1200, maxBlur = 7, fadeNear = 900, fadeFar = 3600 } = opts;
  const depth = Math.max(NEAR, p.z - camZ);
  const s = FOV / depth;
  const defocus = Math.min(1, Math.abs(depth - focus) / range);
  const haze = Math.min(1, Math.max(0, (depth - fadeNear) / (fadeFar - fadeNear)));
  return {
    left: cx + p.x * s,
    top: cy + p.y * s,
    scale: s,
    blur: defocus * maxBlur,
    opacity: 1 - haze * 0.92,
    depth,
    z: p.z,
  };
};

/** Absolute-position a child at a projected 3D point. */
export const At3D: React.FC<{
  place: Placed;
  children: React.ReactNode;
  /** multiply the projected scale */
  k?: number;
  style?: React.CSSProperties;
}> = ({ place, children, k = 1, style }) => (
  <div
    style={{
      position: "absolute",
      left: place.left,
      top: place.top,
      transform: `translate(-50%, -50%) scale(${place.scale * k})`,
      opacity: place.opacity,
      filter: place.blur > 0.25 ? `blur(${place.blur.toFixed(2)}px)` : undefined,
      willChange: "transform, opacity, filter",
      ...style,
    }}
  >
    {children}
  </div>
);

/* ============================== EXTRUDED TYPE ============================= */

/**
 * Real 3D extrusion: N copies stacked along Z inside a preserve-3d context.
 * The back copies darken toward the brand's deep green, which reads as a solid
 * bevel rather than as a shadow. Back layers carry a small blur — that is the
 * depth of field doing the work a camera would do.
 */
export const Extrude: React.FC<{
  text: string;
  size: number;
  frame: number;
  start: number;
  layers?: number;
  depth?: number;
  rotate?: number;
  tilt?: number;
  color?: string;
  deep?: string;
  weight?: number;
  tracking?: string;
  blurBack?: number;
}> = ({
  text,
  size,
  frame,
  start,
  layers = 16,
  depth = 4,
  rotate = 0,
  tilt = 0,
  color = NX.greenHot,
  deep = "#053D28",
  weight = 700,
  tracking = "-0.045em",
  blurBack = 2.6,
}) => {
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - start, fps, config: { damping: 18, stiffness: 120, mass: 1.2 }, durationInFrames: 46 });

  return (
    <div style={{ perspective: 1500, perspectiveOrigin: "50% 50%" }}>
      <div
        style={{
          position: "relative",
          transformStyle: "preserve-3d",
          transform: `rotateX(${tilt}deg) rotateY(${rotate}deg) scale(${0.86 + enter * 0.14})`,
          opacity: Math.min(1, enter * 2.2),
        }}
      >
        {Array.from({ length: layers }).map((_, i) => {
          const back = i === 0 ? 0 : 1;
          const t = i / Math.max(1, layers - 1);
          return (
            <div
              key={i}
              style={{
                position: i === 0 ? "relative" : "absolute",
                left: 0,
                top: 0,
                fontFamily: T.display,
                fontSize: size,
                fontWeight: weight,
                letterSpacing: tracking,
                lineHeight: 0.92,
                whiteSpace: "pre",
                color: i === 0 ? color : mixHex(color, deep, 0.35 + t * 0.65),
                transform: `translateZ(${-i * depth}px)`,
                filter: back && i > 4 ? `blur(${(blurBack * t).toFixed(2)}px)` : undefined,
                textShadow: i === 0 ? `0 0 ${size * 0.18}px rgba(92,255,184,0.55)` : undefined,
              }}
            >
              {text}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const hex2rgb = (h: string) => {
  const s = h.replace("#", "");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
};
const mixHex = (a: string, b: string, t: number) => {
  const A = hex2rgb(a);
  const B = hex2rgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

/* ================================ CARDS ================================= */

const toRgb = (hex: string) => {
  const h = hex.replace("#", "");
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`;
};

export const Card3D: React.FC<{
  w: number;
  h: number;
  title: string;
  value?: string;
  label?: string;
  accent?: string;
  lit?: number;
  align?: "left" | "right";
}> = ({ w, h, title, value, label, accent = NX.green, lit = 1, align = "left" }) => (
  <div
    style={{
      width: w,
      height: h,
      boxSizing: "border-box",
      boxShadow: "0 24px 60px -30px rgba(0,0,0,0.9)",
      ["--accentRgb" as string]: toRgb(accent),
      padding: `${h * 0.09}px ${w * 0.08}px`,
      background: "linear-gradient(150deg, rgba(9,30,36,0.93), rgba(3,11,15,0.88))",
      border: `1px solid rgba(${toRgb(accent)},${0.20 + lit * 0.34})`,
      borderRadius: 3,
      position: "relative",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      textAlign: align,
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: 1,
        background: `linear-gradient(90deg, ${accent}, transparent)`,
        opacity: 0.3 + lit * 0.7,
      }}
    />
    <div style={{ fontFamily: T.mono, fontSize: h * 0.052, letterSpacing: "0.22em", color: NX.muted, textTransform: "uppercase" }}>
      {title}
    </div>
    {value ? (
      <div
        style={{
          fontFamily: T.display,
          fontSize: h * 0.31,
          fontWeight: 600,
          letterSpacing: "-0.04em",
          lineHeight: 0.9,
          color: NX.white,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    ) : null}
    {label ? (
      <div style={{ fontFamily: T.body, fontSize: h * 0.055, color: accent, letterSpacing: "0.01em" }}>{label}</div>
    ) : null}
  </div>
);

/* ================================= HUD ================================== */

const Bracket: React.FC<{ x: number; y: number; sx: number; sy: number; len?: number; o?: number }> = ({
  x,
  y,
  sx,
  sy,
  len = 34,
  o = 0.28,
}) => (
  <>
    <div style={{ position: "absolute", left: x, top: y, width: len, height: 1, background: `rgba(255,255,255,${o})`, transformOrigin: sx > 0 ? "left" : "right" }} />
    <div style={{ position: "absolute", left: x, top: y, width: 1, height: len, background: `rgba(255,255,255,${o})` }} />
  </>
);

export const Hud: React.FC<{
  frame: number;
  opacity?: number;
  mode?: "default" | "threat" | "resolve";
  ticker?: string[];
  rightLabel?: string;
  code?: string;
}> = ({ frame, opacity = 1, mode = "default", ticker = [], rightLabel = "SECURE", code = "NX/01" }) => {
  const accent = mode === "threat" ? NX.red : NX.green;
  const tick = frame * 3;
  return (
    <div style={{ position: "absolute", inset: 0, opacity, pointerEvents: "none" }}>
      <Bracket x={44} y={44} sx={1} sy={1} />
      <Bracket x={1036} y={44} sx={-1} sy={1} />
      <Bracket x={44} y={1876} sx={1} sy={-1} />
      <Bracket x={1036} y={1876} sx={-1} sy={-1} />

      {/* left rail: vertical telemetry */}
      <div
        style={{
          position: "absolute",
          left: 62,
          top: 300,
          writingMode: "vertical-rl",
          fontFamily: T.mono,
          fontSize: 13,
          letterSpacing: "0.42em",
          color: "rgba(255,255,255,0.20)",
          textTransform: "uppercase",
        }}
      >
        nexus.core / node-01 / {code}
      </div>

      {/* right rail: status */}
      <div
        style={{
          position: "absolute",
          right: 62,
          top: 300,
          writingMode: "vertical-rl",
          fontFamily: T.mono,
          fontSize: 13,
          letterSpacing: "0.42em",
          color: mode === "threat" ? NX.red : "rgba(92,255,184,0.5)",
          textTransform: "uppercase",
          opacity: 0.85,
        }}
      >
        {rightLabel}
      </div>

      {/* bottom ticker */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 62,
          height: 26,
          overflow: "hidden",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 46,
            whiteSpace: "nowrap",
            transform: `translateX(${-(tick % 420)}px)`,
            fontFamily: T.mono,
            fontSize: 12,
            letterSpacing: "0.28em",
            color: "rgba(255,255,255,0.26)",
            textTransform: "uppercase",
            paddingTop: 8,
          }}
        >
          {[...ticker, ...ticker].map((t, i) => (
            <span key={i}>
              {t}
              <span style={{ color: accent, marginLeft: 20 }}>·</span>
            </span>
          ))}
        </div>
      </div>

      {/* centre reticle, subtle */}
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 40, height: 40, marginLeft: -20, marginTop: -20, opacity: 0.16 }}>
        <div style={{ position: "absolute", left: 0, top: 19.5, width: 12, height: 1, background: NX.greenHot }} />
        <div style={{ position: "absolute", right: 0, top: 19.5, width: 12, height: 1, background: NX.greenHot }} />
        <div style={{ position: "absolute", left: 19.5, top: 0, width: 1, height: 12, background: NX.greenHot }} />
        <div style={{ position: "absolute", left: 19.5, bottom: 0, width: 1, height: 12, background: NX.greenHot }} />
      </div>
    </div>
  );
};

/* ============================== TEXT PRIMITIVES ========================= */

export const Mono: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  tracking?: string;
  opacity?: number;
  style?: React.CSSProperties;
}> = ({ children, size = 15, color = NX.muted, tracking = "0.3em", opacity = 1, style }) => (
  <div
    style={{
      fontFamily: T.mono,
      fontSize: size,
      letterSpacing: tracking,
      textTransform: "uppercase",
      color,
      opacity,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Masked line reveal with descender-safe padding (see PITFALLS.md). */
export const Line: React.FC<{
  text: string;
  size: number;
  frame: number;
  start: number;
  color?: string;
  weight?: number;
  stagger?: number;
  align?: "left" | "center" | "right";
  glow?: string;
  tracking?: string;
  style?: React.CSSProperties;
}> = ({ text, size, frame, start, color = NX.white, weight = 600, stagger = 3, align = "left", glow, tracking = "-0.035em", style }) => {
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
        gap: `0 ${size * 0.24}px`,
        fontFamily: T.display,
        fontSize: size,
        fontWeight: weight,
        color,
        lineHeight: 1.04,
        letterSpacing: tracking,
        textShadow: glow ? `0 0 ${size * 0.16}px ${glow}` : undefined,
        ...style,
      }}
    >
      {words.map((w, i) => {
        const s = spring({ frame: frame - (start + i * stagger), fps, config: { damping: 17, stiffness: 200, mass: 0.8 }, durationInFrames: 34 });
        return (
          <span
            key={`${w}-${i}`}
            style={{ display: "inline-block", overflow: "hidden", padding: `${size * 0.12}px 0 ${size * 0.46}px`, margin: `${-size * 0.12}px 0 ${-size * 0.46}px` }}
          >
            <span style={{ display: "inline-block", lineHeight: 1.3, transform: `translateY(${(1 - s) * size * 0.95}px)`, opacity: Math.min(1, s * 1.9) }}>
              {w}
            </span>
          </span>
        );
      })}
    </div>
  );
};

export const BigNum: React.FC<{
  to: number;
  frame: number;
  start: number;
  dur?: number;
  size: number;
  suffix?: string;
  decimals?: number;
  color?: string;
}> = ({ to, frame, start, dur = 50, size, suffix, decimals = 0, color = NX.white }) => {
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - start, fps, config: { damping: 15, stiffness: 210, mass: 0.9 }, durationInFrames: 26 });
  const p = Math.min(1, Math.max(0, (frame - start) / dur));
  const v = to * (1 - Math.pow(1 - p, 3));
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: size * 0.05,
        fontFamily: T.display,
        fontSize: size,
        fontWeight: 600,
        letterSpacing: "-0.05em",
        lineHeight: 0.86,
        color,
        fontVariantNumeric: "tabular-nums",
        opacity: Math.min(1, enter * 1.6),
        transform: `translateY(${(1 - enter) * size * 0.12}px)`,
      }}
    >
      <span>{decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString("en-US")}</span>
      {suffix ? <span style={{ fontSize: size * 0.34, color: NX.green, letterSpacing: "-0.02em" }}>{suffix}</span> : null}
    </div>
  );
};
