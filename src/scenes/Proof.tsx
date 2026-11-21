import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Scene3D } from "../components/Scene3D";
import { CaptionBlock } from "../components/KineticCaptions";
import { Kicker } from "../components/ui";
import { CAPTIONS } from "../data/captions";
import { COLORS, FONTS, SPRINGS } from "../theme";
import { clamp, easeOutExpo, rgba } from "../lib/math";

type Metric = {
  value: number;
  decimals?: number;
  unit: string;
  label: string;
  accent: string;
  kind: "bars" | "ring" | "wave";
  enter: number;
};

const METRICS: Metric[] = [
  { value: 60, unit: "FPS", label: "معدل الإطارات", accent: COLORS.cyan, kind: "bars", enter: 704 },
  { value: 4, unit: "K UHD", label: "دقة العرض", accent: COLORS.violet, kind: "ring", enter: 752 },
  { value: 0, unit: "EDITS", label: "تعديل يدوي", accent: COLORS.coral, kind: "wave", enter: 800 },
];

const MiniChart: React.FC<{ kind: Metric["kind"]; accent: string; p: number }> = ({ kind, accent, p }) => {
  const k = clamp(p);
  if (kind === "bars") {
    return (
      <div style={{ display: "flex", alignItems: "flex-end", gap: 7, height: 54 }}>
        {[0.34, 0.58, 0.44, 0.8, 0.62, 1].map((h, i) => (
          <div
            key={i}
            style={{
              width: 12,
              height: `${h * 54 * (0.3 + k * 0.7)}px`,
              borderRadius: 3,
              background: `linear-gradient(180deg, ${accent}, ${rgba(accent, 0.22)})`,
              boxShadow: `0 0 12px ${rgba(accent, 0.65)}`,
            }}
          />
        ))}
      </div>
    );
  }
  if (kind === "ring") {
    const R = 22;
    const C = 2 * Math.PI * R;
    return (
      <svg width={56} height={56} viewBox="0 0 56 56">
        <circle cx={28} cy={28} r={R} fill="none" stroke={rgba("#FFFFFF", 0.13)} strokeWidth={6} />
        <circle
          cx={28}
          cy={28}
          r={R}
          fill="none"
          stroke={accent}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${C * 0.79 * k} ${C}`}
          transform="rotate(-90 28 28)"
          style={{ filter: `drop-shadow(0 0 8px ${rgba(accent, 0.9)})` }}
        />
      </svg>
    );
  }
  const pts = Array.from({ length: 20 }, (_, i) => {
    const x = (i / 19) * 100;
    const y = 26 + Math.sin(i * 0.72) * 15 + Math.sin(i * 0.21 + 1) * 6;
    return `${x},${26 + (y - 26) * (0.35 + k * 0.65)}`;
  }).join(" ");
  return (
    <svg width={104} height={52} viewBox="0 0 104 52">
      <polyline
        points={pts}
        fill="none"
        stroke={accent}
        strokeWidth={3.4}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 8px ${rgba(accent, 0.85)})` }}
      />
    </svg>
  );
};

/**
 * SCENE 04 — PROOF (690 → 960)
 * Live metrics over the 3D stage. Numbers are DOM (canvas text is not usable in
 * this environment) while the perspective panels behind them are real 3D.
 */
export const Proof: React.FC<{ offset?: number }> = ({ offset = 0 }) => {
  const frame = useCurrentFrame() + offset;
  const { fps } = useVideoConfig();
  const local = frame - 690;

  return (
    <AbsoluteFill>
      <Scene3D
        assemble={1}
        energy={0.75}
        danger={0}
        lattice={0.55}
        cards={0}
        zoom={0.05 + (local / 270) * 0.1}
      />

      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(3,4,10,0.95) 0%, rgba(3,4,10,0.42) 20%, rgba(3,4,10,0.18) 46%, rgba(3,4,10,0.72) 72%, rgba(3,4,10,0.97) 100%)",
        }}
      />

      {/* header */}
      <AbsoluteFill style={{ paddingTop: 236, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, opacity: clamp(local / 14) }}>
          <Kicker color={COLORS.cyanSoft}>SYSTEM OUTPUT</Kicker>
          <CaptionBlock caption={CAPTIONS[9]} accent={COLORS.violetHot} size={90} />
        </div>
      </AbsoluteFill>

      {/* metrics */}
      <AbsoluteFill style={{ paddingTop: 700, paddingLeft: 84, paddingRight: 84 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, width: "100%" }}>
          {METRICS.map((m, i) => {
            const s = spring({ frame: frame - m.enter, fps, config: SPRINGS.pop, durationInFrames: 38 });
            const cnt = easeOutExpo(clamp((frame - m.enter) / 42));
            const shown = m.value === 4 ? "4K" : String(Math.round(m.value * cnt));
            return (
              <div
                key={i}
                style={{
                  opacity: clamp(s),
                  transform: `translateY(${interpolate(s, [0, 1], [54, 0])}px) scale(${interpolate(s, [0, 1], [0.9, 1])})`,
                }}
              >
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 24,
                    padding: "30px 38px",
                    borderRadius: 30,
                    background:
                      "linear-gradient(135deg, rgba(255,255,255,0.115) 0%, rgba(255,255,255,0.035) 42%, rgba(5,6,14,0.78) 100%)",
                    border: `1.5px solid ${rgba("#FFFFFF", 0.15)}`,
                    boxShadow: `inset 0 1px 0 ${rgba("#FFFFFF", 0.3)}, 0 26px 60px -26px rgba(0,0,0,0.95), 0 0 46px -14px ${rgba(m.accent, 0.45)}`,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 2,
                      background: `linear-gradient(90deg, transparent, ${rgba(m.accent, 0.95)}, transparent)`,
                    }}
                  />
                  <div style={{ display: "flex", alignItems: "baseline", gap: 14, direction: "ltr" }}>
                    <div
                      style={{
                        fontFamily: FONTS.latin,
                        fontWeight: 700,
                        fontSize: 96,
                        lineHeight: 0.9,
                        color: "#FFFFFF",
                        letterSpacing: "-0.04em",
                        fontVariantNumeric: "tabular-nums",
                        textShadow: `0 0 44px ${rgba(m.accent, 0.55)}`,
                      }}
                    >
                      {shown}
                    </div>
                    <div
                      style={{
                        fontFamily: FONTS.mono,
                        fontWeight: 500,
                        fontSize: 27,
                        letterSpacing: "0.12em",
                        color: m.accent,
                      }}
                    >
                      {m.unit}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
                    <div
                      style={{
                        direction: "rtl",
                        fontFamily: FONTS.body,
                        fontWeight: 600,
                        fontSize: 30,
                        color: rgba("#FFFFFF", 0.72),
                        whiteSpace: "nowrap",
                      }}
                    >
                      {m.label}
                    </div>
                    <MiniChart kind={m.kind} accent={m.accent} p={(frame - m.enter) / 40} />
                  </div>

                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      bottom: 0,
                      height: 3,
                      width: `${clamp((frame - m.enter) / 48) * 100}%`,
                      background: `linear-gradient(90deg, ${rgba(m.accent, 0.1)}, ${m.accent})`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* footer */}
      <AbsoluteFill style={{ paddingTop: 1404, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, opacity: clamp((local - 132) / 22) }}>
          <CaptionBlock caption={CAPTIONS[10]} accent={COLORS.cyan} size={86} />
          <div style={{ fontFamily: FONTS.mono, fontSize: 19, letterSpacing: "0.26em", color: rgba("#FFFFFF", 0.4) }}>
            RENDERED LIVE FROM CODE
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
