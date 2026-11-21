import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, HEIGHT, WIDTH } from "../theme";
import { clamp, noise1, rgba, smoothstep } from "../lib/math";

/* ------------------------------------------------------------------ *
 *  FLASH — additive exposure hit. Driven by explicit frame cues so it
 *  lands exactly on the SFX transient.
 * ------------------------------------------------------------------ */
export const Flash: React.FC<{
  cues: { frame: number; color?: string; power?: number; decay?: number }[];
}> = ({ cues }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {cues.map((c, i) => {
        const t = frame - c.frame;
        if (t < 0 || t > 24) return null;
        const a = Math.pow(1 - t / 24, c.decay ?? 2.6) * (c.power ?? 0.5);
        return (
          <AbsoluteFill
            key={i}
            style={{
              background: `radial-gradient(120% 80% at 50% 45%, ${rgba(c.color ?? "#FFFFFF", a)} 0%, ${rgba(c.color ?? "#FFFFFF", a * 0.25)} 45%, transparent 78%)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ *
 *  ZOOM PUNCH — the "micro dolly" that makes cuts feel expensive.
 * ------------------------------------------------------------------ */
export const ZoomPunch: React.FC<{
  cues: { frame: number; amount?: number; hold?: number }[];
  children: React.ReactNode;
}> = ({ cues, children }) => {
  const frame = useCurrentFrame();
  let scale = 1;
  let push = 0;
  for (const c of cues) {
    const t = frame - c.frame;
    if (t < 0) continue;
    const amt = c.amount ?? 0.045;
    const k = Math.exp(-t / (c.hold ?? 10)) * amt;
    scale += k;
    push += k * 300;
  }
  // constant slow drift so nothing ever feels static
  scale += Math.sin(frame * 0.0032) * 0.006;
  return (
    <AbsoluteFill style={{ transform: `scale(${scale}) translateZ(0)`, willChange: "transform" }}>
      {children}
      <AbsoluteFill style={{ pointerEvents: "none", opacity: clamp(push / 140) * 0.22, background: "radial-gradient(70% 50% at 50% 50%, transparent 40%, #000 100%)" }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ *
 *  SHAKE — decoupled X/Y noise, stronger than typical because vertical
 *  video is viewed at arm's length.
 * ------------------------------------------------------------------ */
export const Shake: React.FC<{ amount: number; decayCues?: number[]; children: React.ReactNode }> = ({
  amount,
  decayCues = [],
  children,
}) => {
  const frame = useCurrentFrame();
  let extra = 0;
  for (const c of decayCues) {
    const t = frame - c;
    if (t >= 0) extra += Math.exp(-t / 7) * 1.0;
  }
  const a = amount + extra * amount * 5;
  const x = noise1(frame * 0.9) * a;
  const y = noise1(frame * 0.9 + 55) * a;
  const r = noise1(frame * 0.7 + 21) * a * 0.018;
  return (
    <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px) rotate(${r}deg)` }}>{children}</AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ *
 *  VIGNETTE + FILM GRADE overlay
 * ------------------------------------------------------------------ */
export const Vignette: React.FC<{ strength?: number; warm?: number }> = ({ strength = 0.72, warm = 0 }) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: `radial-gradient(78% 56% at 50% 46%, transparent 38%, rgba(0,0,0,${strength * 0.55}) 74%, rgba(0,0,0,${strength}) 100%)`,
    }}
  />
);

/* ------------------------------------------------------------------ *
 *  GRAIN — pre-rendered tile, offset per frame (cheap, no filters)
 * ------------------------------------------------------------------ */
let grainCanvas: HTMLCanvasElement | null = null;
const getGrain = () => {
  if (grainCanvas) return grainCanvas;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.random() * 90;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  grainCanvas = c;
  return c;
};

export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.03 }) => {
  const frame = useCurrentFrame();
  const src = useMemo(() => getGrain().toDataURL("image/png"), []);
  const x = (frame * 37) % 256;
  const y = (frame * 61) % 256;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        opacity,
        backgroundImage: `url(${src})`,
        backgroundRepeat: "repeat",
        backgroundPosition: `${-x}px ${-y}px`,
        backgroundSize: "256px 256px",
      }}
    />
  );
};

/* ------------------------------------------------------------------ *
 *  SCANLINES — subtle CRT structure for the "digital" scene
 * ------------------------------------------------------------------ */
export const Scanlines: React.FC<{ opacity?: number; speed?: number }> = ({ opacity = 0.16, speed = 1 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        opacity,
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 1px, transparent 1px, transparent 4px)",
        transform: `translateY(${(frame * speed) % 4}px)`,
      }}
    />
  );
};

/* ------------------------------------------------------------------ *
 *  RGB SPLIT — chromatic aberration for impact frames
 * ------------------------------------------------------------------ */
export const ChromaSplit: React.FC<{ amount: number }> = ({ amount }) => {
  if (amount <= 0.01) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: clamp(amount * 0.5) }}>
      <AbsoluteFill
        style={{
          background: "linear-gradient(90deg, rgba(255,0,64,0.22), transparent 32%)",
          transform: `translateX(${-amount * 7}px)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: "linear-gradient(270deg, rgba(0,225,255,0.20), transparent 32%)",
          transform: `translateX(${amount * 7}px)`,
        }}
      />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ *
 *  LIGHT LEAK — anamorphic streak that sweeps on cuts
 * ------------------------------------------------------------------ */
export const LightLeak: React.FC<{ frame: number; color?: string; power?: number; angle?: number }> = ({
  frame,
  color = COLORS.cyan,
  power = 1,
  angle = 18,
}) => {
  const f = useCurrentFrame();
  const t = (f - frame) / 26;
  if (t < 0 || t > 1) return null;
  const env = Math.sin(t * Math.PI) * power;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        opacity: env * 0.55,
        background: `linear-gradient(${angle}deg, transparent 18%, ${rgba(color, 0.28)} 38%, rgba(255,255,255,0.42) 50%, ${rgba(color, 0.28)} 62%, transparent 82%)`,
        transform: `translateX(${(t - 0.5) * 40}%)`,
      }}
    />
  );
};

/* ------------------------------------------------------------------ *
 *  DIRECTIONAL WIPE — hard-edged multi-band transition
 * ------------------------------------------------------------------ */
export const Wipe: React.FC<{ from: number; duration?: number; color?: string; bands?: number }> = ({
  from,
  duration = 18,
  color = "#04050C",
  bands = 6,
}) => {
  const frame = useCurrentFrame();
  const t = (frame - from) / duration;
  if (t < 0 || t > 1) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: bands }).map((_, i) => {
        const stagger = i * 0.06;
        const local = clamp((t - stagger) / (1 - stagger * (bands - 1)));
        const p = smoothstep(0, 1, local);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: (HEIGHT / bands) * i,
              left: 0,
              width: WIDTH,
              height: HEIGHT / bands + 2,
              background: i % 2 === 0 ? color : rgba(COLORS.violet, 0.9),
              transform: `translateX(${(1 - p) * 100 * (i % 2 === 0 ? 1 : -1)}%) skewX(-6deg)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ *
 *  HUD DECOR — corner meta, timecode, safe-frame marks
 * ------------------------------------------------------------------ */
export const HudFrame: React.FC<{ opacity?: number; accent?: string; label?: string }> = ({
  opacity = 1,
  accent = COLORS.cyan,
  label = "VitoAI // MOTION SYSTEM",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const tc = (f: number) => {
    const total = Math.floor(f / fps);
    const ff = f % fps;
    return `00:${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:${String(ff).padStart(2, "0")}`;
  };
  const prog = frame / durationInFrames;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      <div
        style={{
          position: "absolute",
          top: 64,
          left: 64,
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 20,
          letterSpacing: "0.28em",
          color: rgba(accent, 0.8),
        }}
      >
        {label}
      </div>
      <div
        style={{
          position: "absolute",
          top: 64,
          right: 64,
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 20,
          letterSpacing: "0.18em",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        {tc(frame)}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          height: 3,
          width: `${prog * 100}%`,
          background: `linear-gradient(90deg, ${rgba(COLORS.violet, 0.2)}, ${rgba(accent, 0.85)})`,
        }}
      />
    </AbsoluteFill>
  );
};
