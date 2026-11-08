import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Scene3D } from "../components/Scene3D";
import { CaptionBlock, Hairline } from "../components/KineticCaptions";
import { ChromaSplit, Flash, LightLeak } from "../components/VFXLayer";
import { Kicker } from "../components/ui";
import { CAPTIONS } from "../data/captions";
import { COLORS, FONTS, HEIGHT, SPRINGS, WIDTH } from "../theme";
import { clamp, rgba } from "../lib/math";

/**
 * SCENE 01 — HOOK (0 → 200)
 * Cold open: nothing but a hairline in the void, then the sentence
 * "من الفكرة … إلى فيديو … خارق." builds in three hits.
 */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const assemble = interpolate(frame, [0, 200], [0, 0.34], { extrapolateRight: "clamp" });

  // sentence stack entrance
  const l0 = spring({ frame: frame - 8, fps, config: SPRINGS.soft, durationInFrames: 40 });
  const l1 = spring({ frame: frame - 88, fps, config: SPRINGS.soft, durationInFrames: 40 });

  const kickerOut = clamp((frame - 118) / 14);
  const kickerIn = clamp((frame - 10) / 20);
  const slam = clamp((frame - 154) / 4);

  return (
    <AbsoluteFill>
      <Scene3D assemble={assemble} energy={1.35} danger={0} lattice={0.85} zoom={clamp(frame / 200) * 0.18} />

      {/* cinematic top/bottom grade so type always sits on darkness */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(2,3,8,0.92) 0%, rgba(2,3,8,0.35) 26%, transparent 46%, rgba(2,3,8,0.55) 78%, rgba(2,3,8,0.96) 100%)",
        }}
      />

      {/* opening hairline */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ width: 880, transform: `scaleX(${clamp((frame - 2) / 26)})`, opacity: 1 - kickerOut }}>
          <Hairline progress={1} color={COLORS.cyan} thickness={1.5} />
        </div>
      </AbsoluteFill>

      {/* kicker */}
      <AbsoluteFill style={{ paddingTop: 300, alignItems: "center", opacity: kickerIn * (1 - kickerOut) }}>
        <Kicker color={COLORS.cyanSoft}>VITOAI — MOTION ENGINE</Kicker>
      </AbsoluteFill>

      {/* the sentence */}
      <AbsoluteFill style={{ paddingTop: 900, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ opacity: clamp(l0), transform: `translateY(${(1 - l0) * 30}px)` }}>
            <CaptionBlock caption={CAPTIONS[0]} accent={COLORS.violetHot} size={112} />
          </div>
          <div style={{ opacity: clamp(l1), transform: `translateY(${(1 - l1) * 30}px)` }}>
            <CaptionBlock caption={CAPTIONS[1]} accent={COLORS.violetHot} size={112} />
          </div>
        </div>
      </AbsoluteFill>

      {/* the slam */}
      <AbsoluteFill style={{ paddingTop: 1190, alignItems: "center" }}>
        <div
          style={{
            transform: `scale(${interpolate(slam, [0, 1], [1.5, 1])})`,
            opacity: clamp((frame - 152) / 5),
            filter: `drop-shadow(0 0 90px ${rgba(COLORS.coral, 0.7)})`,
          }}
        >
          <CaptionBlock caption={CAPTIONS[2]} accent={COLORS.coral} size={186} />
        </div>
      </AbsoluteFill>

      {/* exit burn to the chaos scene */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(circle at 50% 55%, #FFFFFF 0%, rgba(255,255,255,0) 60%)",
          opacity: clamp((frame - 190) / 10) * 0.9,
          mixBlendMode: "screen",
        }}
      />
    </AbsoluteFill>
  );
};
