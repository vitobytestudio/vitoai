import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Hook } from "./scenes/Hook";
import { Chaos } from "./scenes/Chaos";
import { Reveal } from "./scenes/Reveal";
import { Proof } from "./scenes/Proof";
import { Punch } from "./scenes/Punch";
import { Cta } from "./scenes/Cta";
import { AudioEngine } from "./components/AudioEngine";
import { Shake, ZoomPunch } from "./components/VFXLayer";
import { OverlayLayer } from "./components/OverlayLayer";
import { HudFrame } from "./components/HudFrame";
import { COLORS, DURATION, SCENES } from "./theme";
import { clamp } from "./lib/math";

/**
 * Renders a scene only inside its absolute frame window — no <Sequence>, so every
 * scene reads the ABSOLUTE frame and authored timings stay 1:1 with the SFX map.
 */
const Gated: React.FC<{ from: number; to: number; frame: number; children: React.ReactNode }> = ({
  from,
  to,
  frame,
  children,
}) => (frame >= from && frame < to ? <AbsoluteFill>{children}</AbsoluteFill> : null);

/**
 * MAIN COMPOSITION — 1080x1920 @ 60fps, 22.2s
 * Scene stack + the global VFX pass that binds the cuts together.
 * Every visual event below has a matching SFX cue in data/captions.ts.
 */
export const MainComposition: React.FC = () => {
  const frame = useCurrentFrame();

  const inScene = (key: keyof typeof SCENES) => frame >= SCENES[key].from && frame < SCENES[key].to;

  const shakeAmount = inScene("chaos") ? 3.4 : inScene("punch") ? 2.2 : inScene("hook") ? 2.4 : inScene("reveal") ? 2.6 : 0.9;

  const flashCues = [
    { frame: 8, color: "#FFFFFF", power: 0.35, decay: 3 },
    { frame: 154, color: "#FF4D6D", power: 0.55, decay: 2.2 },
    { frame: 200, color: "#FF4D6D", power: 0.42, decay: 3 },
    { frame: 306, color: "#FFB020", power: 0.34, decay: 3 },
    { frame: 330, color: "#FF4D6D", power: 0.4, decay: 2.6 },
    { frame: 420, color: "#FFFFFF", power: 0.86, decay: 2.1 },
    { frame: 566, color: "#22D3EE", power: 0.22, decay: 3 },
    { frame: 690, color: "#7C5CFF", power: 0.4, decay: 2.6 },
    { frame: 960, color: "#22D3EE", power: 0.34, decay: 2.8 },
    { frame: 1042, color: "#7C5CFF", power: 0.3, decay: 2.8 },
    { frame: 1104, color: "#FFFFFF", power: 0.62, decay: 2.2 },
    { frame: 1176, color: "#FFFFFF", power: 0.5, decay: 2.4 },
    { frame: DURATION - 6, color: "#7C5CFF", power: 0.2, decay: 3 },
  ];

  const zoomCues = [
    { frame: 8, amount: 0.03, hold: 9 },
    { frame: 88, amount: 0.028, hold: 9 },
    { frame: 154, amount: 0.09, hold: 7 },
    { frame: 200, amount: 0.045, hold: 8 },
    { frame: 330, amount: 0.05, hold: 8 },
    { frame: 420, amount: 0.12, hold: 6 },
    { frame: 690, amount: 0.05, hold: 8 },
    { frame: 960, amount: 0.07, hold: 7 },
    { frame: 1042, amount: 0.06, hold: 7 },
    { frame: 1104, amount: 0.11, hold: 6 },
    { frame: 1176, amount: 0.07, hold: 8 },
  ];

  // chromatic aberration envelope on the three hardest cuts (drawn by Scene3D)
  const chroma =
    (frame >= 154 && frame < 168 ? 1 - (frame - 154) / 14 : 0) * 0.9 +
    (frame >= 420 && frame < 434 ? 1 - (frame - 420) / 14 : 0) * 0.7 +
    (frame >= 1104 && frame < 1116 ? 1 - (frame - 1104) / 12 : 0) * 0.8;


  return (
    <AbsoluteFill style={{ background: "#03040A", overflow: "hidden" }}>
      <ZoomPunch cues={zoomCues}>
        <Shake amount={shakeAmount} decayCues={[154, 420, 1104]}>
          <Gated from={SCENES.hook.from} to={SCENES.hook.to} frame={frame}>
            <Hook />
          </Gated>
          <Gated from={SCENES.chaos.from} to={SCENES.chaos.to} frame={frame}>
            <Chaos />
          </Gated>
          <Gated from={SCENES.reveal.from} to={SCENES.reveal.to} frame={frame}>
            <Reveal />
          </Gated>
          <Gated from={SCENES.proof.from} to={SCENES.proof.to} frame={frame}>
            <Proof />
          </Gated>
          <Gated from={SCENES.punch.from} to={SCENES.punch.to} frame={frame}>
            <Punch />
          </Gated>
          <Gated from={SCENES.cta.from} to={SCENES.cta.to} frame={frame}>
            <Cta />
          </Gated>
        </Shake>
      </ZoomPunch>

      {/* ---- global compositing pass: ONE canvas, every finish baked in ---- */}
      <OverlayLayer
        flashes={flashCues}
        leaks={[
          { frame: 420, color: COLORS.cyan, power: 1.15, angle: 14 },
          { frame: 690, color: COLORS.violet, power: 0.5, angle: 8 },
          { frame: 1176, color: COLORS.violet, power: 0.85, angle: -12 },
        ]}
        wipes={[]}
        shutters={[
          { frame: 688, duration: 12, color: COLORS.cyan },
          { frame: 958, duration: 11, color: COLORS.violet },
          { frame: 1174, duration: 12, color: COLORS.cyan },
        ]}
        shakeCues={[154, 200, 420, 960, 1104, 1176]}
        chroma={chroma}
        vignette={0.8}
        grain={0.032}
      />

      <HudFrame />

      <AudioEngine />
    </AbsoluteFill>
  );
};
