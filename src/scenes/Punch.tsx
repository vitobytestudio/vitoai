import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Scene3D } from "../components/Scene3D";
import { CaptionBlock } from "../components/KineticCaptions";
import { CAPTIONS } from "../data/captions";
import { COLORS, FONTS, SPRINGS } from "../theme";
import { clamp, rgba, smoothstep } from "../lib/math";

/**
 * SCENE 05 — PUNCH (960 → 1176)
 * Three hard statement hits on a 60-frame grid. Each one rides a
 * directional wipe + speed-line burst so the rhythm never sags.
 */
export const Punch: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - 960;

  const beats = [
    { cap: CAPTIONS[11], at: 972, y: 700, size: 128, accent: COLORS.violet },
    { cap: CAPTIONS[12], at: 1042, y: 820, size: 120, accent: COLORS.cyan },
    { cap: CAPTIONS[13], at: 1104, y: 880, size: 200, accent: COLORS.coral },
  ];

  const beatIndex = local < 82 ? 0 : local < 144 ? 1 : 2;
  const beatLocal = local < 82 ? local : local < 144 ? local - 82 : local - 144;
  const s = spring({ frame: beatLocal, fps, config: SPRINGS.heavy, durationInFrames: 40 });

  return (
    <AbsoluteFill>
      <Scene3D
        assemble={0.72 + Math.sin(local * 0.05) * 0.1}
        energy={1.8}
        danger={beatIndex === 2 ? 0.35 : 0}
        lattice={0.9}
        zoom={0.06 + beatLocal / 200 * 0.18}
        glitch={beatIndex === 0 && beatLocal < 6 ? 0.4 : 0}
      />

      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(2,3,8,0.9) 0%, rgba(2,3,8,0.25) 30%, rgba(2,3,8,0.28) 62%, rgba(2,3,8,0.95) 100%)",
        }}
      />

      {/* speed streaks */}
      <AbsoluteFill style={{ opacity: 0.35, mixBlendMode: "screen" }}>
        {Array.from({ length: 26 }).map((_, i) => {
          const y = ((i * 137 + frame * 26) % 1920);
          const len = 200 + ((i * 97) % 460);
          const a = 0.05 + ((i * 13) % 10) / 90;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: y,
                left: -100 + ((i * 173) % 600),
                width: len,
                height: i % 4 === 0 ? 2 : 1,
                background: `linear-gradient(90deg, transparent, ${rgba(i % 3 === 0 ? COLORS.cyan : COLORS.violet, a)}, transparent)`,
              }}
            />
          );
        })}
      </AbsoluteFill>

      {/* stacked beats — only the active one is visible */}
      <AbsoluteFill style={{ alignItems: "center" }}>
        {beats.map((b, i) => {
          const vis = i === beatIndex;
          const out = i === beatIndex ? 1 : 0;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: b.y,
                opacity: vis ? out : 0,
                transform: `scale(${interpolate(s, [0, 1], [1.28, 1])})`,
              }}
            >
              <CaptionBlock caption={b.cap} accent={b.accent} size={b.size} />
            </div>
          );
        })}
      </AbsoluteFill>

      {/* beat counter */}
      <AbsoluteFill style={{ paddingTop: 1450, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 18 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: i === beatIndex ? 96 : 34,
                height: 6,
                borderRadius: 99,
                background:
                  i === beatIndex
                    ? `linear-gradient(90deg, ${COLORS.violet}, ${COLORS.cyan})`
                    : rgba("#FFFFFF", i < beatIndex ? 0.45 : 0.16),
                boxShadow: i === beatIndex ? `0 0 24px ${rgba(COLORS.cyan, 0.9)}` : undefined,
              }}
            />
          ))}
        </div>
      </AbsoluteFill>


      {/* impact frames */}
      <AbsoluteFill
        style={{
          background: "#fff",
          opacity: smoothstep(1104, 1106, frame) * (1 - smoothstep(1106, 1116, frame)) * 0.65,
          mixBlendMode: "screen",
        }}
      />
    </AbsoluteFill>
  );
};
