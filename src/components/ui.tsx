import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, HEIGHT, SPRINGS, WIDTH } from "../theme";
import { clamp, easeOutExpo, rgba, smoothstep } from "../lib/math";

/* -------------------------------- GlassCard ------------------------------ */

export const GlassCard: React.FC<{
  children: React.ReactNode;
  accent?: string;
  enter: number;
  exit?: number;
  rotate?: number;
  tiltX?: number;
  style?: React.CSSProperties;
  glow?: number;
}> = ({ children, accent = COLORS.violet, enter, exit, rotate = 0, tiltX = 0, style, glow = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - enter, fps, config: SPRINGS.pop, durationInFrames: 40 });
  const out = exit ? clamp((exit - frame) / 14) : 1;
  if (s <= 0.001 && frame < enter) return null;
  const p = clamp(s);
  return (
    <div
      style={{
        position: "absolute",
        opacity: p * out,
        transform: `perspective(1200px) translateY(${interpolate(s, [0, 1], [70, 0])}px) rotateZ(${rotate}deg) rotateX(${tiltX}deg) scale(${interpolate(s, [0, 1], [0.86, 1])})`,
        transformStyle: "preserve-3d",
        ...style,
      }}
    >
      <div
        style={{
          position: "relative",
          borderRadius: 34,
          padding: "34px 38px",
          background:
            "linear-gradient(150deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.045) 38%, rgba(6,7,16,0.72) 100%)",
          border: `1.5px solid ${rgba("#FFFFFF", 0.16)}`,
          boxShadow: [
            `inset 0 1px 0 ${rgba("#FFFFFF", 0.28)}`,
            `0 30px 70px -20px rgba(0,0,0,0.85)`,
            `0 0 60px -10px ${rgba(accent, 0.32 * glow)}`,
          ].join(", "),
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(115deg, transparent 20%, ${rgba("#FFFFFF", 0.11)} 42%, transparent 58%)`,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${rgba(accent, 0.9)}, transparent)`,
          }}
        />
        {children}
      </div>
    </div>
  );
};

/* -------------------------------- Kicker -------------------------------- */

export const Kicker: React.FC<{ children: React.ReactNode; color?: string; align?: "start" | "center" | "end" }> = ({
  children,
  color = COLORS.cyan,
  align = "center",
}) => (
  <div
    style={{
      fontFamily: FONTS.mono,
      fontSize: 26,
      letterSpacing: "0.32em",
      textTransform: "uppercase",
      color: rgba(color, 0.95),
      textAlign: align,
      display: "flex",
      alignItems: "center",
      gap: 18,
      justifyContent: align === "center" ? "center" : align === "end" ? "flex-end" : "flex-start",
    }}
  >
    <span style={{ display: "inline-block", width: 46, height: 2, background: rgba(color, 0.9) }} />
    {children}
    <span style={{ display: "inline-block", width: 46, height: 2, background: rgba(color, 0.9) }} />
  </div>
);

/* ------------------------------- StatCounter ----------------------------- */

export const StatCounter: React.FC<{
  value: number;
  suffix?: string;
  prefix?: string;
  start: number;
  duration?: number;
  size?: number;
  color?: string;
  decimals?: number;
}> = ({ value, suffix = "", prefix = "", start, duration = 45, size = 108, color = "#FFFFFF", decimals = 0 }) => {
  const frame = useCurrentFrame();
  const p = clamp((frame - start) / duration);
  const eased = easeOutExpo(p);
  const shown = value * eased;
  return (
    <div
      style={{
        fontFamily: FONTS.display,
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1,
        color,
        letterSpacing: "-0.03em",
        direction: "ltr",
        display: "flex",
        alignItems: "baseline",
        gap: 8,
        fontVariantNumeric: "tabular-nums",
        textShadow: `0 0 ${size * 0.4}px ${rgba(color, 0.35)}`,
      }}
    >
      <span>{prefix}</span>
      <span>{shown.toFixed(decimals)}</span>
      {suffix ? <span style={{ fontSize: size * 0.4, opacity: 0.75, fontWeight: 700 }}>{suffix}</span> : null}
    </div>
  );
};

/* --------------------------------- Pill --------------------------------- */

export const Pill: React.FC<{
  children: React.ReactNode;
  accent?: string;
  enter: number;
  pulse?: number;
  width?: number;
}> = ({ children, accent = COLORS.violet, enter, pulse = 0, width }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - enter, fps, config: SPRINGS.snap, durationInFrames: 32 });
  const glowPulse = 0.55 + Math.sin(frame * 0.09) * 0.25;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        width,
        padding: "28px 58px",
        borderRadius: 999,
        background: `linear-gradient(135deg, ${accent} 0%, ${rgba(accent, 0.75)} 45%, ${COLORS.cyan} 130%)`,
        color: "#08090F",
        fontFamily: FONTS.display,
        fontWeight: 900,
        fontSize: 46,
        opacity: clamp(s),
        transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px) scale(${interpolate(s, [0, 1], [0.8, 1]) + pulse})`,
        boxShadow: `0 0 ${60 * glowPulse}px ${rgba(accent, 0.55)}, 0 24px 60px -18px rgba(0,0,0,0.9), inset 0 2px 0 rgba(255,255,255,0.5)`,
      }}
    >
      {children}
    </div>
  );
};

/* ------------------------------ PhoneMockup ------------------------------ */

export const PhoneMockup: React.FC<{ enter: number; rotate?: number; accent?: string; progress: number }> = ({
  enter,
  rotate = -8,
  accent = COLORS.violet,
  progress,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - enter, fps, config: SPRINGS.soft, durationInFrames: 50 });
  const p = clamp(progress);
  const W = 380;
  const H = 780;
  return (
    <div
      style={{
        width: W,
        height: H,
        borderRadius: 52,
        padding: 12,
        background: "linear-gradient(160deg, #2A2E3D 0%, #0B0D14 40%, #1A1D27 100%)",
        boxShadow: `0 50px 100px -30px rgba(0,0,0,0.95), 0 0 90px -20px ${rgba(accent, 0.5)}, inset 0 1px 0 rgba(255,255,255,0.25)`,
        transform: `perspective(1600px) rotateY(${interpolate(s, [0, 1], [40, rotate])}deg) rotateX(${interpolate(s, [0, 1], [12, 2])}deg) translateY(${interpolate(s, [0, 1], [80, 0])}px)`,
        opacity: clamp(s),
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 42,
          overflow: "hidden",
          position: "relative",
          background: "linear-gradient(170deg, #0B1020 0%, #05060D 100%)",
        }}
      >
        {/* notch */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: "50%",
            transform: "translateX(-50%)",
            width: 110,
            height: 26,
            borderRadius: 999,
            background: "#000",
            zIndex: 5,
          }}
        />
        {/* app UI */}
        <div style={{ padding: "62px 22px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: FONTS.display, fontWeight: 900, fontSize: 26, color: "#fff" }}>VitoAI</div>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                background: `linear-gradient(135deg, ${accent}, ${COLORS.cyan})`,
              }}
            />
          </div>
          <div
            style={{
              height: 168,
              borderRadius: 22,
              background: `linear-gradient(150deg, ${rgba(accent, 0.42)}, ${rgba(COLORS.cyan, 0.16)})`,
              border: `1px solid ${rgba("#FFFFFF", 0.14)}`,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                bottom: 0,
                width: `${p * 100}%`,
                height: 4,
                background: `linear-gradient(90deg, ${accent}, ${COLORS.cyan})`,
              }}
            />
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.92)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderLeft: "16px solid #0B1020",
                    borderTop: "10px solid transparent",
                    borderBottom: "10px solid transparent",
                    marginLeft: 5,
                  }}
                />
              </div>
            </div>
          </div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 74,
                borderRadius: 18,
                background: "rgba(255,255,255,0.055)",
                border: `1px solid ${rgba("#FFFFFF", 0.09)}`,
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "0 16px",
                opacity: clamp((p - i * 0.16) * 4),
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: rgba(i === 1 ? COLORS.cyan : accent, 0.4),
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <div style={{ width: 130, height: 9, borderRadius: 99, background: "rgba(255,255,255,0.55)" }} />
                <div style={{ width: 84, height: 7, borderRadius: 99, background: "rgba(255,255,255,0.22)" }} />
              </div>
            </div>
          ))}
          <div
            style={{
              marginTop: 6,
              height: 62,
              borderRadius: 999,
              background: `linear-gradient(135deg, ${accent}, ${COLORS.cyan})`,
              display: "grid",
              placeItems: "center",
              fontFamily: FONTS.display,
              fontWeight: 900,
              fontSize: 22,
              color: "#07080E",
              boxShadow: `0 12px 40px -8px ${rgba(accent, 0.8)}`,
            }}
          >
            RENDER
          </div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------- Wordmark -------------------------------- */

export const Wordmark: React.FC<{ size?: number; enter: number; accent?: string; showStudio?: boolean }> = ({
  size = 210,
  enter,
  accent = COLORS.violet,
  showStudio = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - enter, fps, config: SPRINGS.heavy, durationInFrames: 55 });
  const p = clamp(s);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <div
        style={{
          position: "relative",
          fontFamily: FONTS.latin,
          fontWeight: 700,
          fontSize: size,
          letterSpacing: "-0.045em",
          lineHeight: 1,
          opacity: p,
          transform: `scale(${interpolate(s, [0, 1], [1.3, 1])})`,
          color: "#FFFFFF",
          textShadow: `0 0 ${size * 0.35}px ${rgba(accent, 0.55)}, 0 6px 24px rgba(0,0,0,0.7)`,
        }}
      >
        Vito
        <span style={{ color: COLORS.cyanSoft, textShadow: `0 0 ${size * 0.3}px ${rgba(COLORS.cyan, 0.85)}` }}>AI</span>
      </div>
      {showStudio ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            opacity: clamp((frame - enter - 18) / 16),
          }}
        >
          <div style={{ width: 60, height: 1.5, background: rgba(COLORS.cyan, 0.8) }} />
          <div style={{ fontFamily: FONTS.mono, fontSize: 26, letterSpacing: "0.42em", color: rgba(COLORS.cyanSoft, 0.95) }}>
            MOTION STUDIO
          </div>
          <div style={{ width: 60, height: 1.5, background: rgba(COLORS.cyan, 0.8) }} />
        </div>
      ) : null}
    </div>
  );
};

/* ------------------------------ ProgressCard ----------------------------- */

export const RenderFailCard: React.FC<{ enter: number; frame0?: number }> = ({ enter, frame0 = 0 }) => {
  const frame = useCurrentFrame();
  const progress = Math.min(0.97, smoothstep(0, 120, frame - enter) * 0.99);
  const stuck = progress >= 0.965;
  const elapsed = Math.floor((frame - enter) / 60);
  return (
    <div style={{ width: 720 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontFamily: FONTS.mono, fontSize: 24, letterSpacing: "0.2em", color: rgba("#FFFFFF", 0.8) }}>
          RENDERING…
        </div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 24, color: stuck ? COLORS.coral : rgba("#FFFFFF", 0.55) }}>
          {String(Math.floor(elapsed / 3600)).padStart(2, "0")}:
          {String(Math.floor(elapsed / 60) % 60).padStart(2, "0")}:
          {String(elapsed % 60).padStart(2, "0")}
        </div>
      </div>
      <div
        style={{
          height: 14,
          borderRadius: 99,
          background: "rgba(255,255,255,0.09)",
          overflow: "hidden",
          border: `1px solid ${rgba("#FFFFFF", 0.1)}`,
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: "100%",
            background: stuck
              ? `linear-gradient(90deg, ${COLORS.coral}, ${COLORS.amber})`
              : `linear-gradient(90deg, ${COLORS.violet}, ${COLORS.cyan})`,
            boxShadow: `0 0 24px ${rgba(stuck ? COLORS.coral : COLORS.cyan, 0.9)}`,
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
        <div style={{ fontFamily: FONTS.mono, fontSize: 30, color: stuck ? COLORS.coral : "#fff" }}>
          {Math.round(progress * 100)}%
        </div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 22, color: "rgba(255,255,255,0.35)" }}>
          FRAME {Math.floor(progress * 1332)} / 1332
        </div>
      </div>
    </div>
  );
};
