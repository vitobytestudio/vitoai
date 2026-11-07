/**
 * «الطابق الأخير» — a horror beat, generated end to end.
 *
 * The picture is a Cycles render (studio/blender/scene_horror.py): a bare bulb on a
 * cord, a corridor, one doorway leaking cold light, dust in the beam, a door that gives
 * way, and something that only exists while the light is off. This file is the *film*
 * around that plate: the fade up, the push that keeps creeping so no frame is dead, the
 * grain and vignette that make a clean render look photographed, and the hard cut to name.
 *
 *   0.00 … 0.30   black, the room breathing
 *   0.30 … 2.30   the plate (2.0 s, shot at 24 fps, conformed to 30)
 *   2.30          the cut — no dissolve; horror earns its hard edits
 *   2.50 … 4.20   the name, held once, then gone
 *
 * Sound is synthesised in studio/score_horror.mjs and keyed to the same 0.30 offset, so
 * the flicker ticks land on the flicker and the flash lands on the flash.
 *
 * TRAPS honoured (PITFALLS.md): the plate lives inside a <Sequence> so its frame 0 is the
 * sequence's frame 0; every Arabic string is nowrap and un-clipped; grain is high here on
 * purpose (a clean digital frame in a dark scene reads as video, not film).
 */
import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";

export const FPS = 30;
export const DURATION = 126; // 4.2 s
export const PLATE_IN = 9;
export const PLATE_LEN = 60; // exactly the 2.0 s plate
export const PLATE_OUT = PLATE_IN + PLATE_LEN; // 69
export const CARD_IN = PLATE_OUT + 6;

const W = 1080;
const H = 1920;

const AR_DISP = '"Tajawal", "Space Grotesk", "Cairo", sans-serif';
const MONO = '"JetBrains Mono", "Space Grotesk", monospace';

/** Fine, uneven, and different on every third frame — a still texture is a screensaver. */
const Grain: React.FC<{ amount?: number; seed: number }> = ({ amount = 0.055, seed }) => (
  <svg
    width={W}
    height={H}
    viewBox={`0 0 ${W} ${H}`}
    style={{ position: "absolute", inset: 0, opacity: amount, mixBlendMode: "overlay" }}
  >
    <filter id={`gr${seed}`}>
      <feTurbulence type="fractalNoise" baseFrequency="0.92" numOctaves={2} seed={seed} stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width={W} height={H} filter={`url(#gr${seed})`} />
  </svg>
);

const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.7 }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background: `radial-gradient(122% 74% at 50% 44%, rgba(0,0,0,0) 34%, rgba(0,0,0,${
        strength * 0.5
      }) 66%, rgba(0,0,0,${strength}) 100%)`,
    }}
  />
);

const Plate: React.FC = () => {
  const f = useCurrentFrame(); // 0..59, relative to the Sequence
  const t = f / (PLATE_LEN - 1);
  const creep = 1.015 + 0.05 * t; // a push under the render's own dolly
  const fadeIn = interpolate(f, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(f, [PLATE_LEN - 4, PLATE_LEN - 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.quad),
  });
  return (
    <AbsoluteFill
      style={{ opacity: fadeIn * fadeOut, transform: `scale(${creep})`, filter: "saturate(0.82) contrast(1.07)" }}
    >
      <OffthreadVideo src={staticFile("plates/horror-plate.mp4")} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
    </AbsoluteFill>
  );
};

const Card: React.FC = () => {
  const f = useCurrentFrame();
  const life = interpolate(f, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const die = interpolate(f, [44, 52], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dip = f === 24 ? 0.22 : f === 25 ? 0.62 : 1; // the name flickers once, like the bulb
  const rise = interpolate(f, [0, 40], [14, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  return (
    <AbsoluteFill>
      <div
        dir="rtl"
        lang="ar"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 30,
          opacity: life * die * dip,
          transform: `translateY(${rise}px)`,
        }}
      >
        <div
          style={{
            color: "rgba(255,255,255,0.95)",
            fontFamily: AR_DISP,
            fontSize: 92,
            fontWeight: 800,
            lineHeight: 1.1,
            textAlign: "center",
            whiteSpace: "nowrap",
            width: "100%",
          }}
        >
          الطابق الأخير
        </div>
        <div
          style={{
            width: 600,
            height: 1,
            background:
              "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.28) 50%, rgba(255,255,255,0) 100%)",
          }}
        />
        <div
          style={{
            fontFamily: MONO,
            fontSize: 20,
            letterSpacing: 12,
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.40)",
            whiteSpace: "nowrap",
            textIndent: 12,
          }}
        >
          VITO
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Horror01: React.FC = () => {
  const frame = useCurrentFrame();
  // the room breathes before the picture arrives: a slow swell out of black
  const pre = interpolate(frame, [0, PLATE_IN], [0.55, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <Sequence from={PLATE_IN} durationInFrames={PLATE_LEN}>
        <Plate />
      </Sequence>
      <Sequence from={CARD_IN} durationInFrames={DURATION - CARD_IN}>
        <Card />
      </Sequence>
      <Vignette strength={0.74} />
      <Grain amount={0.055 * pre} seed={frame % 3} />
    </AbsoluteFill>
  );
};
