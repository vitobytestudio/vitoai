import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, SPRINGS } from "../theme";
import { clamp, easeOutExpo, rgba } from "../lib/math";
import type { Caption, Word } from "../data/captions";

type SpringPreset = keyof typeof SPRINGS;

/** Arabic ranges — used to keep cursive text on an Arabic-capable family, never on a Latin-only face. */
const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const hasArabic = (t: string) => ARABIC_RE.test(t);

/* --------------------------------------------------------------------------
 * <KineticWord>
 * Arabic is cursive — we animate WORD units (never glyphs) so shaping,
 * ligatures and harakat stay intact. Latin runs may opt into char splits.
 * ------------------------------------------------------------------------ */

export const KineticWord: React.FC<{
  word: Word;
  index: number;
  active: boolean;
  from: number;
  size: number;
  style?: "hero" | "impact" | "line" | "micro";
  accent?: string;
  preset?: SpringPreset;
  glow?: number;
  color?: string;
  weight?: number;
}> = ({
  word,
  index,
  active,
  from: _from,
  size,
  style = "line",
  accent = COLORS.violet,
  preset = "pop",
  glow = 1,
  color = "#FFFFFF",
  weight = 900,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // `frame` is ABSOLUTE (scenes are gated, not sequenced), and so is word.from.
  const local = frame - word.from;
  if (local < -2) return null;
  void _from;

  const cfg = SPRINGS[preset];
  const s = spring({ frame: local, fps, config: cfg, durationInFrames: 42 });
  const p = clamp(local / 10);

  const isImpact = style === "impact";
  const isHero = style === "hero";
  const isMicro = style === "micro";

  const y = interpolate(s, [0, 1], [isImpact ? 74 : 40, 0]);
  const scale = isImpact
    ? interpolate(s, [0, 1], [1.12, 1])
    : isHero
      ? interpolate(s, [0, 1], [0.82, 1])
      : interpolate(s, [0, 1], [0.94, 1]);
  const blur = interpolate(p, [0, 1], [isImpact ? 26 : 14, 0]);
  const rot = isImpact ? interpolate(s, [0, 1], [-4, 0]) : 0;

  const emph = word.emph;
  const activeBoost = active ? 1.02 : 1;
  const glowAmt = (emph ? 1.15 : 0.6) * glow * (active ? 1.35 : 1) * clamp(p);

  const fontSize = size;

  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        transform: `translateY(${y}px) rotate(${rot}deg) scale(${scale * activeBoost})`,
        filter: blur > 0.4 ? `blur(${blur}px)` : undefined,
        opacity: clamp(p * 1.6),
        fontFamily: isMicro && !hasArabic(word.text) ? FONTS.mono : FONTS.display,
        fontWeight: weight,
        fontSize,
        lineHeight: 1.06,
        letterSpacing: hasArabic(word.text) ? "0" : isMicro ? "0.16em" : "-0.02em",
        whiteSpace: "pre",
        textShadow: [
          `0 ${Math.round(fontSize * 0.03)}px ${Math.round(fontSize * 0.06)}px rgba(0,0,0,0.5)`,
          `0 0 ${Math.round(fontSize * 0.5)}px ${rgba(accent, 0.28 * glowAmt)}`,
        ].join(", "),
      }}
    >
      <span
        style={{
          color: emph ? accent : color,
          display: "inline-block",
          filter: emph ? `drop-shadow(0 0 ${Math.round(fontSize * 0.16)}px ${rgba(accent, 0.9 * glowAmt)})` : undefined,
        }}
      >
        {word.text}
      </span>
    </span>
  );
};

/* --------------------------------------------------------------------------
 * <CaptionBlock> — one authored line group, laid out RTL-aware
 * ------------------------------------------------------------------------ */

export const CaptionBlock: React.FC<{
  caption: Caption;
  accent?: string;
  size?: number;
  align?: "center" | "start";
  style?: React.CSSProperties;
  activeIndex?: number;
}> = ({ caption, accent = COLORS.violet, size, align = "center", style, activeIndex }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rel = frame - caption.from;
  const base =
    size ??
    (caption.style === "impact"
      ? 170
      : caption.style === "hero"
        ? 128
        : caption.style === "micro"
          ? 42
          : 92);

  // exit animation
  const out = interpolate(frame, [caption.to - 12, caption.to], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // whole-block entrance
  const enter = spring({ frame: rel, fps, config: SPRINGS.soft, durationInFrames: 30 });

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "nowrap",
        gap: caption.style === "micro" ? "0.42em" : caption.style === "impact" ? "0.3em" : "0.26em",
        direction: caption.dir,
        justifyContent: align === "center" ? "center" : "flex-start",
        alignItems: "baseline",
        width: "100%",
        opacity: out,
        transform: `translateY(${interpolate(enter, [0, 1], [-18, 0])}px)`,
        ...style,
      }}
    >
      {caption.words.map((w, i) => (
        <KineticWord
          key={`${caption.text}-${i}`}
          word={w}
          index={i}
          from={caption.from}
          active={activeIndex === i}
          size={base}
          style={caption.style}
          accent={accent}
          preset={caption.style === "impact" ? "heavy" : caption.style === "hero" ? "heavy" : "pop"}
          glow={caption.style === "micro" ? 0.4 : 1}
        />
      ))}
    </div>
  );
};

/* --------------------------------------------------------------------------
 * <MaskedLine> — clip-path line reveal, the AE "text wipe" staple
 * ------------------------------------------------------------------------ */

export const MaskedLine: React.FC<{
  children: React.ReactNode;
  progress: number;
  dir?: "up" | "down" | "left" | "right";
}> = ({ children, progress, dir = "up" }) => {
  const p = clamp(progress);
  const inset =
    dir === "up"
      ? `${(1 - p) * 100}% 0% 0% 0%`
      : dir === "down"
        ? `0% 0% ${(1 - p) * 100}% 0%`
        : dir === "left"
          ? `0% 0% 0% ${(1 - p) * 100}%`
          : `0% ${(1 - p) * 100}% 0% 0%`;
  return (
    <div style={{ clipPath: `inset(${inset})`, width: "100%" }}>
      <div
        style={{
          transform: `translateY(${(1 - p) * 26}px)`,
          opacity: 0.35 + p * 0.65,
        }}
      >
        {children}
      </div>
    </div>
  );
};

/* --------------------------------------------------------------------------
 * <Hairline> — precise 1px rules with gradient falloff (edge details sell the
 * "AE comp" feel far more than more glow does).
 * ------------------------------------------------------------------------ */

export const Hairline: React.FC<{
  width?: number | string;
  progress?: number;
  color?: string;
  thickness?: number;
  style?: React.CSSProperties;
}> = ({ width = "100%", progress = 1, color = COLORS.cyan, thickness = 1, style }) => {
  const p = clamp(progress);
  return (
    <div
      style={{
        width,
        height: thickness,
        background: `linear-gradient(90deg, transparent, ${rgba(color, 0.85)} 22%, #FFFFFF 50%, ${rgba(color, 0.85)} 78%, transparent)`,
        transform: `scaleX(${p})`,
        transformOrigin: "center",
        opacity: p,
        ...style,
      }}
    />
  );
};

/* --------------------------------------------------------------------------
 * <CornerBrackets> — HUD framing marks
 * ------------------------------------------------------------------------ */

export const CornerBrackets: React.FC<{
  progress?: number;
  color?: string;
  size?: number;
  inset?: number;
  thickness?: number;
}> = ({ progress = 1, color = COLORS.cyan, size = 44, inset = 64, thickness = 2 }) => {
  const p = clamp(progress);
  const mk = (t: string, l: string, bt: boolean, bl: boolean): React.CSSProperties => ({
    position: "absolute",
    top: t,
    left: l,
    width: size,
    height: size,
    borderTop: bt ? `${thickness}px solid ${rgba(color, 0.7 * p)}` : undefined,
    borderLeft: bl ? `${thickness}px solid ${rgba(color, 0.7 * p)}` : undefined,
    borderRight: !bl ? `${thickness}px solid ${rgba(color, 0.7 * p)}` : undefined,
    borderBottom: !bt ? `${thickness}px solid ${rgba(color, 0.7 * p)}` : undefined,
    opacity: p,
  });
  return (
    <>
      <div style={mk(`${inset}px`, `${inset}px`, true, true)} />
      <div style={mk(`${inset}px`, `${inset}px`, true, false)} />
      <div style={mk(`${inset}px`, `${inset}px`, false, true)} />
    </>
  );
};
