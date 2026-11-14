import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, WIDTH } from "../theme";
import { clamp, rgba } from "../lib/math";

/**
 * Broadcast-style HUD, rendered as DOM.
 * (Canvas text is unusable here — see the note in Scene3D.)
 */
export const HudFrame: React.FC<{ label?: string }> = ({ label = "VITOAI // MOTION SYSTEM" }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const fadeIn = clamp((frame - 16) / 26);
  const fadeOut = 1 - clamp((frame - (durationInFrames - 44)) / 30);
  const a = fadeIn * fadeOut;
  if (a <= 0.01) return null;

  const sec = Math.floor(frame / fps);
  const tc = `00:00:${String(sec).padStart(2, "0")}:${String(frame % fps).padStart(2, "0")}`;
  const barW = (frame / durationInFrames) * (WIDTH - 128);

  const Corner: React.FC<{ top?: number; bottom?: number; left?: number; right?: number; sx: number; sy: number }> = ({
    top,
    bottom,
    left,
    right,
    sx,
    sy,
  }) => (
    <div
      style={{
        position: "absolute",
        top,
        bottom,
        left,
        right,
        width: 34,
        height: 34,
        borderTop: sy > 0 ? `2px solid ${rgba(COLORS.cyan, 0.5 * a)}` : undefined,
        borderBottom: sy < 0 ? `2px solid ${rgba(COLORS.cyan, 0.5 * a)}` : undefined,
        borderLeft: sx > 0 ? `2px solid ${rgba(COLORS.cyan, 0.5 * a)}` : undefined,
        borderRight: sx < 0 ? `2px solid ${rgba(COLORS.cyan, 0.5 * a)}` : undefined,
      }}
    />
  );

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: a }}>
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 64,
          fontFamily: '"JetBrains Mono", "Cairo", monospace',
          fontSize: 21,
          letterSpacing: "0.24em",
          color: rgba(COLORS.cyanSoft, 0.85),
        }}
      >
        {label}
      </div>
      <div
        style={{
          position: "absolute",
          top: 60,
          right: 64,
          fontFamily: '"JetBrains Mono", "Cairo", monospace',
          fontSize: 21,
          letterSpacing: "0.16em",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        {tc}
      </div>
      <div style={{ position: "absolute", top: 104, left: 64, right: 64, height: 1, background: "rgba(255,255,255,0.09)" }} />
      <div style={{ position: "absolute", bottom: 104, left: 64, right: 64, height: 1, background: "rgba(255,255,255,0.09)" }} />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          height: 4,
          width: barW,
          background: `linear-gradient(90deg, ${rgba(COLORS.violet, 0.35)}, ${rgba(COLORS.cyan, 0.95)})`,
        }}
      />
      <Corner top={40} left={40} sx={1} sy={1} />
      <Corner top={40} right={40} sx={-1} sy={1} />
      <Corner bottom={40} left={40} sx={1} sy={-1} />
      <Corner bottom={40} right={40} sx={-1} sy={-1} />
    </AbsoluteFill>
  );
};
