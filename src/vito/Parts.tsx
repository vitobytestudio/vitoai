import React from "react";
import { spring, useVideoConfig } from "remotion";
import { F, PAD, V, W, r } from "./palette";

/**
 * THE FLAT KIT
 * =============================================================================
 * Everything in this film is built from seven primitives. Keeping the count low
 * is what makes 32 seconds feel designed rather than assembled: the same
 * hairline, the same corner bracket, the same monospace grid, repeated.
 */

/* ------------------------------- typography ------------------------------ */

export const Mono: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  tracking?: string;
  opacity?: number;
  weight?: number;
  align?: "left" | "right" | "center";
  style?: React.CSSProperties;
}> = ({ children, size = 15, color = V.muted, tracking = "0.22em", opacity = 1, weight = 400, align = "left", style }) => (
  <div
    style={{
      fontFamily: F.mono,
      fontSize: size,
      letterSpacing: tracking,
      textTransform: "uppercase",
      color,
      opacity,
      fontWeight: weight,
      textAlign: align,
      lineHeight: 1.5,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Masked line reveal. Padding is generous: space-grotesk descenders clip. */
export const Line: React.FC<{
  text: string;
  size: number;
  frame: number;
  start: number;
  color?: string;
  weight?: number;
  family?: string;
  stagger?: number;
  align?: "left" | "center" | "right";
  tracking?: string;
  glow?: string;
  style?: React.CSSProperties;
}> = ({ text, size, frame, start, color = V.white, weight = 600, family = F.display, stagger = 3, align = "left", tracking = "-0.035em", glow, style }) => {
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
        lineHeight: 1.02,
        letterSpacing: tracking,
        textShadow: glow ? `0 0 ${size * 0.16}px ${glow}` : undefined,
        ...style,
      }}
    >
      {words.map((w, i) => {
        const s = spring({ frame: frame - (start + i * stagger), fps, config: { damping: 17, stiffness: 210, mass: 0.8 }, durationInFrames: 30 });
        return (
          <span
            key={`${w}-${i}`}
            style={{
              display: "inline-block",
              overflow: "hidden",
              padding: `${size * 0.12}px 0 ${size * 0.46}px`,
              margin: `${-size * 0.12}px 0 ${-size * 0.46}px`,
            }}
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

/* --------------------------------- counters ------------------------------- */

export const Num: React.FC<{
  to: number;
  frame: number;
  start?: number;
  dur?: number;
  size: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  color?: string;
  family?: string;
  weight?: number;
  time?: boolean;
}> = ({ to, frame, start = 0, dur = 60, size, suffix, prefix, decimals = 0, color = V.white, family = F.display, weight = 600, time = false }) => {
  const p = Math.min(1, Math.max(0, (frame - start) / dur));
  const v = to * (1 - Math.pow(1 - p, 3));
  const shown = decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString("en-US");
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: size * 0.06,
        fontFamily: family,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: time ? "0.02em" : "-0.045em",
        lineHeight: 0.9,
        color,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {prefix ? <span style={{ fontSize: Math.max(13, size * 0.34), color: V.dim, fontWeight: 500 }}>{prefix}</span> : null}
      <span>{shown}</span>
      {suffix ? (
        <span style={{ fontSize: Math.max(13, size * 0.34), color: V.green, letterSpacing: "0.04em", fontWeight: 500 }}>{suffix}</span>
      ) : null}
    </div>
  );
};

/* -------------------------------- structure ------------------------------- */

export const Rule: React.FC<{ progress?: number; width?: number | string; color?: string; opacity?: number; vertical?: boolean; height?: number }> = ({
  progress = 1,
  width = "100%",
  color = V.green,
  opacity = 1,
  vertical = false,
  height = 1,
}) => (
  <div
    style={
      vertical
        ? { width: 1, height: (height as number) * progress, background: color, opacity }
        : { width: typeof width === "number" ? width * progress : width, height, background: color, opacity }
    }
  />
);

/** Glass panel with a lit top edge — the only container in the film. */
export const Panel: React.FC<{
  children: React.ReactNode;
  w?: number | string;
  h?: number;
  pad?: number;
  accent?: string;
  lit?: number;
  style?: React.CSSProperties;
}> = ({ children, w = "100%", h, pad = 26, accent = V.green, lit = 1, style }) => (
  <div
    style={{
      width: w,
      height: h,
      padding: pad,
      boxSizing: "border-box",
      background: V.panel,
      border: `1px solid ${V.edge}`,
      position: "relative",
      display: "flex",
      flexDirection: "column",
      ...style,
    }}
  >
    <div style={{ position: "absolute", top: 0, left: 0, width: `${lit * 100}%`, height: 1, background: accent, opacity: 0.9 }} />
    {children}
  </div>
);

/* ---------------------------------- HUD ---------------------------------- */

const Bracket: React.FC<{ x: number; y: number; sx: number; sy: number; len?: number; o?: number }> = ({ x, y, sx, sy, len = 30, o = 0.3 }) => (
  <>
    <div style={{ position: "absolute", left: x, top: y, width: len, height: 1, background: `rgba(120,200,255,${o})`, transform: `scaleX(${sx})` }} />
    <div style={{ position: "absolute", left: x, top: y, width: 1, height: len, background: `rgba(120,200,255,${o})`, transform: `scaleY(${sy})` }} />
  </>
);

/** Corner brackets + edge ticks. Never animated internally: it is a frame. */
export const Frame: React.FC<{ opacity?: number; ticks?: number }> = ({ opacity = 1, ticks = 0 }) => (
  <div style={{ position: "absolute", inset: 0, opacity, pointerEvents: "none" }}>
    <Bracket x={34} y={34} sx={1} sy={1} />
    <Bracket x={1046} y={34} sx={-1} sy={1} />
    <Bracket x={34} y={1886} sx={1} sy={-1} />
    <Bracket x={1046} y={1886} sx={-1} sy={-1} />
    {ticks > 0
      ? Array.from({ length: ticks }).map((_, i) => {
          const y = 120 + (i * (H_TICK - 240)) / (ticks - 1);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 34,
                top: y,
                width: i % 4 === 0 ? 12 : 6,
                height: 1,
                background: "rgba(120,200,255,0.20)",
              }}
            />
          );
        })
      : null}
    {ticks > 0
      ? Array.from({ length: ticks }).map((_, i) => {
          const y = 120 + (i * (H_TICK - 240)) / (ticks - 1);
          return (
            <div
              key={`r${i}`}
              style={{
                position: "absolute",
                right: 34,
                top: y,
                width: i % 4 === 0 ? 12 : 6,
                height: 1,
                background: "rgba(120,200,255,0.20)",
              }}
            />
          );
        })
      : null}
  </div>
);

const H_TICK = 1920;

/** Chapter stamp, top of frame. The film's only repeating text element. */
export const Stamp: React.FC<{ idx: string; label: string; frame: number; opacity?: number; alert?: boolean }> = ({
  idx,
  label,
  frame,
  opacity = 1,
  alert = false,
}) => (
  <div style={{ position: "absolute", left: PAD, right: PAD, top: 96, display: "flex", alignItems: "center", gap: 16, opacity }}>
    <div
      style={{
        width: 6,
        height: 6,
        background: alert ? V.alert : V.green,
        boxShadow: `0 0 12px ${alert ? V.alert : V.green}`,
      }}
    />
    <Mono size={14} color={V.muted} tracking="0.34em">
      {label}
    </Mono>
    <div style={{ flex: 1, height: 1, background: V.edge }} />
    <Mono size={14} color={V.dim} tracking="0.34em">
      {idx} / 07
    </Mono>
    <div style={{ width: 54, height: 1, background: V.edge }} />
    <Mono size={14} color={V.green} tracking="0.2em">
      {String(Math.floor(frame / 60)).padStart(2, "0")}s
    </Mono>
  </div>
);

/* -------------------------------- terminal ------------------------------- */

export const Cursor: React.FC<{ frame: number; size?: number; color?: string }> = ({ frame, size = 16, color = V.green }) => (
  <span
    style={{
      display: "inline-block",
      width: size * 0.55,
      height: size * 1.05,
      background: color,
      opacity: Math.floor(frame / 15) % 2 === 0 ? 1 : 0.05,
      verticalAlign: "middle",
      marginLeft: 3,
    }}
  />
);

export type TermLine = { t: string; tone?: "ok" | "warn" | "dim" | "hot" };

/** A scrolling log. Lines arrive on their own frames and then hold. */
export const Terminal: React.FC<{
  lines: TermLine[];
  frame: number;
  start: number;
  perLine?: number;
  size?: number;
  visible?: number;
  color?: string;
}> = ({ lines, frame, start, perLine = 6, size = 17, visible = 12, color = V.muted }) => {
  // scroll so the newest line is always the last visible one
  const shown = Math.min(lines.length, Math.floor((frame - start) / perLine) + 1);
  const first = Math.max(0, shown - visible);
  const slice = lines.slice(first, shown);

  return (
    <div style={{ fontFamily: F.mono, fontSize: size, lineHeight: 1.72, letterSpacing: "0.01em" }}>
      {slice.map((l, i) => {
        const at = start + (first + i) * perLine;
        const on = r(frame, at, at + 3);
        const tone = l.tone ?? "dim";
        const col = tone === "ok" ? V.green : tone === "warn" ? V.alert : tone === "hot" ? V.white : color;
        return (
          <div
            key={l.t}
            style={{
              color: col,
              opacity: on * (i === slice.length - 1 ? 1 : 0.55 + (i / Math.max(1, slice.length)) * 0.45),
              whiteSpace: "pre",
              transform: `translateX(${(1 - on) * 8}px)`,
            }}
          >
            <span style={{ color: V.dim }}>{String((first + i).toString()).padStart(2, "0")}</span>
            <span style={{ color: V.dim }}> | </span>
            {l.t}
          </div>
        );
      })}
      <div style={{ color: V.green, opacity: shown >= lines.length ? 0.9 : 0.6 }}>
        <span style={{ color: V.dim }}>{"\u00A0\u00A0"}</span>
        <span>{"> "}</span>
        <Cursor frame={frame} size={size} />
      </div>
    </div>
  );
};

/* --------------------------------- bars ---------------------------------- */

/** Segmented meter — reads as instrumentation, not as a chart. */
export const SegBar: React.FC<{ v: number; segments?: number; w?: number; color?: string; dim?: string; height?: number }> = ({
  v,
  segments = 28,
  w = 320,
  color = V.green,
  dim = "rgba(255,255,255,0.08)",
  height = 8,
}) => {
  const step = w / segments;
  return (
    <div style={{ display: "flex", gap: step * 0.28, width: w }}>
      {Array.from({ length: segments }).map((_, i) => {
        const on = i / segments < v;
        return (
          <div
            key={i}
            style={{
              width: step * 0.72,
              height,
              background: on ? color : dim,
              boxShadow: on ? `0 0 8px ${color}55` : undefined,
            }}
          />
        );
      })}
    </div>
  );
};

/** Thin sparkline, drawn with divs — no canvas, no text, no cost. */
export const Spark: React.FC<{ frame: number; w?: number; h?: number; color?: string; seed?: number; speed?: number }> = ({
  frame,
  w = 240,
  h = 42,
  color = V.green,
  seed = 1,
  speed = 0.16,
}) => {
  const N = 26;
  const pts = Array.from({ length: N }, (_, i) => {
    const x = (i / (N - 1)) * w;
    const n = Math.sin(i * 0.7 + seed + frame * speed * 0.1) * 0.5 + Math.sin(i * 1.9 + seed * 2.3 - frame * speed * 0.06) * 0.3;
    const y = h / 2 - n * (h / 2 - 4);
    return [x, y] as const;
  });
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      <polyline
        points={pts.map((p) => `${p[0]},${p[1]}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.2} fill={color} />
    </svg>
  );
};

/* --------------------------------- bits ---------------------------------- */

export const Dot: React.FC<{ color?: string; size?: number; glow?: boolean }> = ({ color = V.green, size = 7, glow = true }) => (
  <div
    style={{
      width: size,
      height: size,
      background: color,
      boxShadow: glow ? `0 0 ${size * 2.4}px ${color}` : undefined,
    }}
  />
);

export const KeyVal: React.FC<{ k: string; v: string; color?: string; size?: number }> = ({ k, v, color = V.white, size = 19 }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 20 }}>
    <Mono size={12} color={V.dim} tracking="0.24em">
      {k}
    </Mono>
    <div style={{ fontFamily: F.mono, fontSize: size, color, letterSpacing: "0.02em" }}>{v}</div>
  </div>
);

export { W };
