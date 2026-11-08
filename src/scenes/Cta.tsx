import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Scene3D } from "../components/Scene3D";
import { Wordmark, Pill, Kicker } from "../components/ui";
import { Hairline } from "../components/KineticCaptions";
import { COLORS, FONTS } from "../theme";
import { clamp, rgba } from "../lib/math";

/**
 * SCENE 06 — CTA (1176 → 1332)
 * Calm resolution: everything collapses into the mark, then the CTA pill
 * lands with a single bright ping and the frame breathes out to black.
 */
export const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - 1176;

  const collapse = clamp(local / 90);
  const fadeOut = 1 - clamp((local - 132) / 24);

  return (
    <AbsoluteFill>
      <Scene3D
        assemble={1 - collapse * 0.55}
        energy={1.3 - collapse * 0.9}
        danger={0}
        lattice={1 - collapse * 0.35}
        cards={0}
        zoom={0.1 + collapse * 0.16}
        coreY={86}
      />

      <AbsoluteFill
        style={{
          background: `radial-gradient(90% 62% at 50% 44%, rgba(2,3,8,0.25) 0%, rgba(2,3,8,0.86) 62%, rgba(2,3,8,0.99) 100%)`,
        }}
      />

      <AbsoluteFill style={{ alignItems: "center", paddingTop: 640 }}>
        <Wordmark enter={1186} size={214} accent={COLORS.violet} showStudio={false} />
      </AbsoluteFill>

      <AbsoluteFill style={{ alignItems: "center", paddingTop: 940 }}>
        <div
          style={{
            direction: "rtl",
            fontFamily: FONTS.display,
            fontWeight: 800,
            fontSize: 58,
            color: rgba("#FFFFFF", 0.9),
            textAlign: "center",
            opacity: clamp((local - 24) / 18),
            transform: `translateY(${(1 - clamp((local - 24) / 18)) * 22}px)`,
          }}
        >
          حرّك فكرتك. بالكود.
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ alignItems: "center", paddingTop: 1110 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 42 }}>
          <Pill accent={COLORS.violet} enter={1224} width={520}>
            ابدأ الآن
          </Pill>
          <div style={{ opacity: clamp((local - 66) / 16) }}>
            <Hairline width={360} progress={clamp((local - 66) / 20)} color={COLORS.cyan} />
          </div>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 30,
              letterSpacing: "0.32em",
              color: rgba(COLORS.cyanSoft, 0.9),
              opacity: clamp((local - 76) / 16),
            }}
          >
            VITOAI.STUDIO
          </div>
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ paddingTop: 240, alignItems: "center", opacity: clamp((local - 10) / 20) }}>
        <Kicker color={COLORS.violet}>2026 — MOTION SYSTEM</Kicker>
      </AbsoluteFill>

      {/* final dip to black */}
      <AbsoluteFill style={{ background: "#03040A", opacity: 1 - fadeOut }} />
    </AbsoluteFill>
  );
};
