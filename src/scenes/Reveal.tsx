import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Scene3D } from "../components/Scene3D";
import { CaptionBlock, Hairline } from "../components/KineticCaptions";
import { Wordmark, Kicker } from "../components/ui";
import { LightLeak, Scanlines } from "../components/VFXLayer";
import { CAPTIONS } from "../data/captions";
import { COLORS, FONTS, SPRINGS } from "../theme";
import { clamp, rgba } from "../lib/math";

/**
 * SCENE 03 — REVEAL (420 → 690)
 * The product moment. A hard impact, then the whole 3D lattice snaps
 * into a perfect sphere while the wordmark resolves out of blur.
 */
export const Reveal: React.FC<{ vfx?: boolean; text?: boolean; three?: boolean }> = ({ vfx = true, text = true, three = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - 420;

  // the money shot: overshoot spring from chaos to order
  const s = spring({ frame: local, fps, config: SPRINGS.heavy, durationInFrames: 70 });
  const assemble = interpolate(s, [0, 1], [0.16, 1]);

  const cards = clamp((local - 150) / 40);

  const sub = spring({ frame: local - 146, fps, config: SPRINGS.pop, durationInFrames: 40 });
  const code = clamp((local - 232) / 18);

  return (
    <AbsoluteFill>
      {three ? <Scene3D
        assemble={assemble}
        energy={1.1 + (1 - assemble) * 1.4}
        danger={0}
        lattice={1}
        cards={cards}
        zoom={0.22 - local / 270 * 0.26}
        glitch={local < 6 ? 0.9 * (1 - local / 6) : 0}
      /> : null}

      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(3,4,10,0.9) 0%, rgba(3,4,10,0.28) 26%, rgba(3,4,10,0.12) 46%, rgba(3,4,10,0.62) 76%, rgba(3,4,10,0.97) 100%)",
        }}
      />

      {vfx ? (<><LightLeak frame={424} color={COLORS.cyan} power={1.1} angle={12} /><Scanlines opacity={0.07} speed={0.6} /></>) : null}

      {text ? (<>
      {/* wordmark lockup */}
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 700 }}>
        <Wordmark enter={452} size={232} accent={COLORS.violet} />
      </AbsoluteFill>

      {/* arabic subtitle */}
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 1010 }}>
        <div
          style={{
            opacity: clamp(sub),
            transform: `translateY(${(1 - sub) * 26}px)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 26,
          }}
        >
          <div style={{ direction: "rtl", fontFamily: FONTS.display, fontWeight: 800, fontSize: 66, color: "#FFFFFF", letterSpacing: "-0.01em", textShadow: `0 0 60px ${rgba(COLORS.violet, 0.6)}` }}>
            استوديو الحركة البرمجي
          </div>
          <div style={{ width: 420 }}>
            <Hairline progress={clamp(sub)} color={COLORS.cyan} thickness={1.5} />
          </div>
        </div>
      </AbsoluteFill>

      {/* the promise line */}
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 1330 }}>
        <div
          style={{
            opacity: clamp(code),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 22,
          }}
        >
          <CaptionBlock caption={CAPTIONS[8]} accent={COLORS.cyan} size={44} />
          <div style={{ display: "flex", gap: 14 }}>
            {["THREE.JS", "CANVAS 2D", "REMOTION", "FFMPEG"].map((t, i) => (
              <div
                key={t}
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 19,
                  letterSpacing: "0.18em",
                  color: rgba("#FFFFFF", 0.72),
                  border: `1px solid ${rgba("#FFFFFF", 0.18)}`,
                  background: "rgba(255,255,255,0.05)",
                  padding: "10px 18px",
                  borderRadius: 999,
                  opacity: clamp((code - i * 0.18) / 0.4),
                }}
              >
                {t}
              </div>
            ))}
          </div>
        </div>
      </AbsoluteFill>
      </>) : null}
    </AbsoluteFill>
  );
};
