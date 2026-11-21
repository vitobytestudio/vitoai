import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Scene3D } from "../components/Scene3D";
import { CaptionBlock } from "../components/KineticCaptions";
import { RenderFailCard } from "../components/ui";
import { CAPTIONS } from "../data/captions";
import { COLORS, FONTS } from "../theme";
import { clamp, noise1, rgba, smoothstep } from "../lib/math";

/**
 * SCENE 02 — CHAOS (200 → 420)
 * The "before" state: everything scatters, colours flip to alarm,
 * a render bar jams at 97% and the copy lands like error messages.
 */
export const Chaos: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - 200;

  // violent assemble drop then partial recovery
  const assemble = interpolate(local, [0, 20, 190, 220], [0.34, 0.1, 0.16, 0.4], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const glitch = 0.35 + Math.sin(local * 0.21) * 0.18 + (local < 8 ? 0.5 : 0);

  const jitterX = noise1(local * 1.4) * 10 * (1 - local / 220);

  return (
    <AbsoluteFill>
      <Scene3D
        assemble={assemble}
        energy={2.1}
        danger={1}
        glitch={clamp(glitch)}
        lattice={0.55}
        zoom={0.1 + local / 220 * 0.2}
      />

      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(6,2,5,0.94) 0%, rgba(6,2,5,0.4) 24%, rgba(6,2,5,0.15) 48%, rgba(6,2,5,0.72) 82%, rgba(6,2,5,0.97) 100%)",
        }}
      />

      {/* alarm band sweeping the frame */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, transparent ${30 + Math.sin(local * 0.06) * 12}%, ${rgba(COLORS.coral, 0.11)} ${34 + Math.sin(local * 0.06) * 12}%, transparent ${40 + Math.sin(local * 0.06) * 12}%)`,
          mixBlendMode: "screen",
        }}
      />

      {/* sticky header */}
      <AbsoluteFill style={{ paddingTop: 300, alignItems: "center", opacity: clamp(local / 10) }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 24,
              letterSpacing: "0.4em",
              color: rgba(COLORS.coral, 0.95),
              padding: "12px 30px",
              border: `1.5px solid ${rgba(COLORS.coral, 0.5)}`,
              borderRadius: 999,
              background: rgba(COLORS.coral, 0.08),
              boxShadow: `0 0 40px ${rgba(COLORS.coral, 0.25)}`,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <svg width="30" height="28" viewBox="0 0 30 28" style={{ flex: "0 0 auto" }}>
              <path d="M15 2 L28 26 L2 26 Z" fill="none" stroke={COLORS.coral} strokeWidth="2.4" strokeLinejoin="round" />
              <rect x="13.8" y="10" width="2.4" height="8" rx="1.2" fill={COLORS.coral} />
              <rect x="13.8" y="20" width="2.4" height="2.4" rx="1.2" fill={COLORS.coral} />
            </svg>
            <span>SYSTEM OVERLOAD</span>
          </div>
          <div
            style={{
              fontFamily: FONTS.display,
              fontWeight: 900,
              fontSize: 62,
              color: rgba("#FFFFFF", 0.9),
              direction: "rtl",
              letterSpacing: "-0.02em",
            }}
          >
            طريقة العمل القديمة
          </div>
        </div>
      </AbsoluteFill>

      {/* the jammed render bar */}
      <AbsoluteFill style={{ paddingTop: 560, alignItems: "center", transform: `translateX(${jitterX}px)` }}>
        <div style={{ opacity: clamp((local - 18) / 16) }}>
          <RenderFailCard enter={218} />
        </div>
      </AbsoluteFill>

      {/* the three complaints — one per beat */}
      <AbsoluteFill style={{ paddingTop: 1010, alignItems: "center" }}>
        {[3, 4, 5].map((i, k) => {
          const cap = CAPTIONS[i];
          // hard-cut beat: visible from its start until the next line begins
          const nextFrom = CAPTIONS[i + 1] ? CAPTIONS[i + 1].from : Infinity;
          const shown = frame >= cap.from && frame < nextFrom;
          if (!shown) return null;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                transform: `translateX(${jitterX * 0.6}px)`,
              }}
            >
              <CaptionBlock caption={cap} accent={COLORS.coral} size={82} />
            </div>
          );
        })}
      </AbsoluteFill>

      {/* error stamp */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          alignItems: "center",
          paddingTop: 1180,
          opacity: smoothstep(330, 342, frame) * 0.9,
          transform: `scale(${interpolate(smoothstep(330, 360, frame), [0, 1], [1.6, 1])}) rotate(-8deg)`,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 62,
            letterSpacing: "0.1em",
            whiteSpace: "nowrap",
            color: COLORS.coral,
            border: `6px solid ${rgba(COLORS.coral, 0.85)}`,
            padding: "18px 34px",
            textShadow: `0 0 50px ${rgba(COLORS.coral, 0.9)}`,
            boxShadow: `0 0 90px ${rgba(COLORS.coral, 0.55)}, inset 0 0 60px ${rgba(COLORS.coral, 0.25)}`,
            background: rgba(COLORS.coral, 0.06),
          }}
        >
          RENDER FAILED
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
