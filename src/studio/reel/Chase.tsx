/**
 * CHASE — 20 s, filmed on a phone by somebody standing on the roof.
 *
 * The previous attempt drew the city from geometry and it read as a diagram.
 * This one starts from photographs of real light — a rooftop over an avenue,
 * a crowd with their phones up, a top-down of two cars racing — and then does
 * the only thing a phone operator actually does: stand still, pan too fast,
 * lose focus, get bumped, and keep filming.
 *
 *   · no cuts. Every change of view is a whip: both plates smear, one leaves,
 *     the other arrives, and the operator's shoulder dips into the frame.
 *   · focus is not constant: it racks at each whip and hunts when the cars
 *     come close.
 *   · exposure breathes with the headlights, and the sensor pumps its gain.
 *   · the phone's own overlay (time, battery, f-stop) is the only type.
 */
import React from "react";
import { AbsoluteFill, Audio, Easing, Img, staticFile, useCurrentFrame } from "remotion";

export const FPS = 30;
export const DURATION = 600; // 20 s
const W = 1080;
const H = 1920;

const MONO = '"JetBrains Mono", monospace';

const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const EASEIO = Easing.bezier(0.65, 0, 0.35, 1);
const p = (f: number, a: number, b: number, fn: (t: number) => number = EASE) => cl(fn(cl((f - a) / Math.max(1, b - a))));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* --------------------------------------------------------------- coverage */

type Shot = {
  plate: string;
  from: number;
  to: number;
  z0: number;
  z1: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

const A = "plates/chase-a-rooftop.jpg";
const B = "plates/chase-b-crowd.jpg";
const C = "plates/chase-c-pass.jpg";

const SHOTS: Shot[] = [
  // 1 · behind the crowd, on the roof
  { plate: B, from: 0, to: 106, z0: 1.02, z1: 1.12, x0: 0, y0: 18, x1: 0, y1: -14 },
  // 2 · the operator turns and looks over the parapet, down the avenue
  { plate: A, from: 106, to: 250, z0: 1.16, z1: 1.03, x0: -54, y0: -44, x1: 34, y1: 34 },
  // 3 · straight down: the two cars cross under the phone
  { plate: C, from: 250, to: 385, z0: 1.08, z1: 1.26, x0: 24, y0: 96, x1: -20, y1: -84 },
  // 4 · back up to the crowd, close, they are shouting
  { plate: B, from: 385, to: 462, z0: 1.46, z1: 1.34, x0: -26, y0: 96, x1: 20, y1: 62 },
  // 5 · and back down to the road as they come round again
  { plate: C, from: 462, to: 530, z0: 1.22, z1: 1.06, x0: -34, y0: 108, x1: 10, y1: -80 },
  // 6 · the phone is lowered; the avenue, gone quiet
  { plate: A, from: 530, to: 600, z0: 1.18, z1: 1.02, x0: 30, y0: 40, x1: -10, y1: -20 },
];

const WHIPS = [
  { at: 96, dur: 10, dir: 1 },
  { at: 240, dur: 10, dir: -1 },
  { at: 375, dur: 10, dir: 1 },
  { at: 452, dur: 10, dir: -1 },
  { at: 520, dur: 10, dir: 1 },
];

/* ---------------------------------------------------------------- helpers */

const Plate: React.FC<{ src: string; z: number; x: number; y: number; blur?: number; dim?: number; op?: number }> = ({ src, z, x, y, blur = 0, dim = 0, op = 1 }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      opacity: op,
      transform: `translate3d(${x}px, ${y}px, 0) scale(${z})`,
      filter: blur > 0.02 ? `blur(${blur}px)` : undefined,
    }}
  >
    <Img
      src={staticFile(src)}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        filter: `brightness(${1 - dim}) saturate(0.94) contrast(1.06)`,
      }}
    />
  </div>
);

/** the light that crosses the lens during a whip: a wide, fast smear plus the
 *  pinch at the frame edge, which is what makes a pan read as speed */
const Whip: React.FC<{ v: number; dir: number }> = ({ v, dir }) => {
  if (v <= 0.001) return null;
  return (
    <div style={{ position: "absolute", inset: -220, pointerEvents: "none", opacity: v }}>
      <div
        style={{
          position: "absolute",
          left: dir > 0 ? "-40%" : "20%",
          right: dir > 0 ? "20%" : "-40%",
          top: "30%",
          height: 700,
          transform: `translateX(${dir * (1 - v) * 320}px)`,
          background: `linear-gradient(90deg, transparent, rgba(255,208,160,0.22) 30%, rgba(206,226,255,0.20) 52%, transparent 82%)`,
          filter: "blur(70px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(${dir > 0 ? 100 : 260}deg, transparent 34%, rgba(255,255,255,0.10) 50%, transparent 66%)`,
          filter: "blur(26px)",
        }}
      />
    </div>
  );
};

/** the cars themselves, as a streak that travels across the avenue plate:
 *  the photograph has the light, this puts the movement into it */
const PassStreak: React.FC<{ t: number; y: number; w: number; hue: "head" | "tail"; dx: number }> = ({ t, y, w, hue, dx }) => {
  if (t <= 0 || t >= 1) return null;
  const x = lerp(-260, W + 260, t) + dx;
  const c = hue === "head" ? "255,252,240" : "255,64,44";
  const c2 = hue === "head" ? "255,214,150" : "255,120,80";
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: 26, transform: "translateY(-50%)" }}>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, transparent, rgba(${c2},0.55) 22%, rgba(${c},0.95) 78%, #fff)`, filter: "blur(7px)", borderRadius: 40 }} />
      <div style={{ position: "absolute", left: "40%", top: -30, width: w * 0.9, height: 90, background: `radial-gradient(ellipse at 60% 50%, rgba(${c2},0.45), transparent 66%)`, filter: "blur(26px)", mixBlendMode: "screen" }} />
      <div style={{ position: "absolute", left: "60%", top: -8, width: 220, height: 46, background: `linear-gradient(90deg, transparent, rgba(${c},0.9), transparent)`, filter: "blur(3px)" }} />
    </div>
  );
};

/* ------------------------------------------------------------- the finish */

const Optics: React.FC<{ f: number; flare: number }> = ({ f, flare }) => (
  <>
    <div
      style={{
        position: "absolute",
        inset: 0,
        mixBlendMode: "screen",
        opacity: 0.34 + flare * 0.3,
        background:
          "radial-gradient(ellipse 52% 24% at 48% 58%, rgba(255,206,158,0.24), transparent 64%)," +
          "radial-gradient(ellipse 30% 16% at 20% 74%, rgba(255,196,150,0.16), transparent 66%)",
        filter: "blur(34px)",
      }}
    />
    <div
      style={{
        position: "absolute",
        inset: 0,
        mixBlendMode: "screen",
        opacity: 0.16 + flare * 0.3,
        background: "radial-gradient(ellipse 26% 11% at 52% 62%, rgba(255,92,56,0.34), transparent 70%)",
        filter: "blur(38px)",
      }}
    />
    <div style={{ position: "absolute", inset: 0, mixBlendMode: "screen", opacity: 0.13, background: "linear-gradient(90deg, rgba(255,40,40,0.5), transparent 16%, transparent 84%, rgba(60,140,255,0.5))", filter: "blur(4px)" }} />
    {/* lens water: static to the glass, so it never moves with the world */}
    {[
      { x: 176, y: 236, r: 34 },
      { x: 902, y: 176, r: 22 },
      { x: 828, y: 1584, r: 46 },
      { x: 236, y: 1418, r: 20 },
      { x: 1002, y: 902, r: 28 },
      { x: 66, y: 792, r: 16 },
      { x: 470, y: 120, r: 14 },
    ].map((d, i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          left: d.x - d.r,
          top: d.y - d.r,
          width: d.r * 2,
          height: d.r * 2,
          borderRadius: "50%",
          background: "radial-gradient(circle at 36% 30%, rgba(205,228,255,0.16), rgba(14,20,30,0.10) 58%, transparent 72%)",
          boxShadow: "inset 0 0 7px rgba(210,232,255,0.10)",
          filter: "blur(1.4px)",
        }}
      />
    ))}
    <div
      style={{
        position: "absolute",
        inset: -80,
        opacity: 0.14,
        mixBlendMode: "overlay",
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='190' height='190'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/></filter><rect width='190' height='190' filter='url(%23n)' opacity='0.85'/></svg>\")",
        backgroundPosition: `${(f * 21) % 190}px ${(f * 39) % 190}px`,
      }}
    />
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 82% 66% at 50% 48%, transparent 44%, rgba(0,0,0,0.58) 100%)" }} />
  </>
);

const Hud: React.FC<{ f: number }> = ({ f }) => {
  const secs = Math.floor(f / FPS);
  const rec = Math.floor(f / 16) % 2 === 0;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", fontFamily: MONO, color: "#E9F1FA" }}>
      <div style={{ position: "absolute", left: 40, top: 48, display: "flex", alignItems: "center", gap: 10, opacity: 0.78 }}>
        <div style={{ width: 8, height: 8, borderRadius: 8, background: rec ? "#FF3B30" : "#7a1f18", boxShadow: rec ? "0 0 10px rgba(255,59,48,0.9)" : undefined }} />
        <span style={{ fontSize: 19, letterSpacing: "0.06em" }}>{`00:${String(secs).padStart(2, "0")}`}</span>
      </div>
      <div style={{ position: "absolute", right: 40, top: 50, display: "flex", alignItems: "center", gap: 9, opacity: 0.5 }}>
        <span style={{ fontSize: 15, letterSpacing: "0.08em" }}>4K · 30</span>
        <div style={{ width: 31, height: 15, border: "1px solid rgba(233,241,250,0.5)", borderRadius: 3, position: "relative" }}>
          <div style={{ position: "absolute", left: 2, top: 2, bottom: 2, width: 19, background: "rgba(233,241,250,0.7)", borderRadius: 1 }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 40, bottom: 46, fontSize: 14, letterSpacing: "0.13em", opacity: 0.36 }}>ƒ1.8 · ISO 3200 · 1/60</div>
    </div>
  );
};

/* -------------------------------------------------------------------- film */

export type ChaseProps = { score?: string };

export const Chase: React.FC<ChaseProps> = ({ score }) => {
  const f = useCurrentFrame();

  /* handheld: three incommensurate sines plus a bump every time the operator
     shifts their weight or gets knocked */
  const bump = (at: number, amp: number) => (f < at ? 0 : amp * Math.exp(-(f - at) * 0.14) * Math.cos((f - at) * 0.8));
  const sx = Math.sin(f * 0.37) * 2.6 + Math.sin(f * 1.11 + 1.2) * 1.1 + Math.sin(f * 0.16 + 2.3) * 3.8 + bump(100, 9) + bump(246, 12) + bump(378, 7) + bump(456, 8);
  const sy = Math.sin(f * 0.29 + 0.5) * 2.2 + Math.sin(f * 0.93 + 2.1) * 1.0 + Math.sin(f * 0.12 + 1.1) * 3.2 + bump(102, 7) + bump(248, 9) + bump(380, 6);
  const roll = Math.sin(f * 0.11 + 0.4) * 0.55 + Math.sin(f * 0.033) * 0.75 + (p(f, 240, 252) - p(f, 252, 286, EASEIO)) * 1.4;

  /* which shot is on screen, and its slow virtual camera move */
  const idx = SHOTS.findIndex((s) => f >= s.from && f < s.to);
  const shot = idx >= 0 ? SHOTS[idx] : null;
  const sLocal = shot ? cl((f - shot.from) / (shot.to - shot.from)) : 0;
  const sEased = EASEIO(sLocal);

  /* focus: a phone racks hard at every whip, then hunts once */
  const rack = WHIPS.reduce((acc, w) => {
    const d = Math.abs(f - (w.at + w.dur / 2));
    return acc + Math.max(0, 1 - d / (w.dur * 2.2)) * 3.4;
  }, 0);
  const hunt = Math.max(0, 1 - Math.abs(f - 300) / 16) * 2.6 + Math.max(0, 1 - Math.abs(f - 480) / 20) * 1.8;
  /* how fast the operator is swinging, in px per frame: that becomes blur */
  const panV = shot ? Math.hypot((shot.x1 - shot.x0) / Math.max(1, shot.to - shot.from), (shot.y1 - shot.y0) / Math.max(1, shot.to - shot.from)) : 0;
  const panBlur = Math.min(2.4, panV * 0.42);
  const focus = 0.16 + rack + hunt + panBlur;

  /* exposure: the headlights blow the frame, then the gain settles back */
  const flare = Math.max(
    0.5 * Math.exp(-Math.pow((f - 306) / 12, 2)),
    0.42 * Math.exp(-Math.pow((f - 330) / 16, 2)),
    0.4 * Math.exp(-Math.pow((f - 492) / 14, 2)),
    0.2 * Math.exp(-Math.pow((f - 60) / 30, 2)),
  );
  const gain = 1 + flare * 0.16;

  /* the whip overlays: outgoing slide, incoming slide */
  let whipV = 0;
  let whipDir = 1;
  for (const w of WHIPS) {
    const d = Math.abs(f - (w.at + w.dur / 2));
    const v = Math.max(0, 1 - d / (w.dur * 0.92));
    if (v > whipV) {
      whipV = v;
      whipDir = w.dir;
    }
  }

  /* the cars as streaks laid over the avenue plate, twice, then gone */
  const blackout = Math.max(p(f, 570, 600, EASEIO), 1 - p(f, 0, 10));

  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transform: `rotate(${roll * 0.4}deg) skewX(${Math.max(-1.4, Math.min(1.4, Math.sin(f * 0.08) * 0.5 + whipV * whipDir * 1.6))}deg) scale(1.06) translate(${sx * 0.3}px, ${sy * 0.3}px)`,
          filter: `blur(${focus}px) brightness(${gain})`,
        }}
      >
        {shot ? (
          <Plate
            src={shot.plate}
            z={Math.max(lerp(shot.z0, shot.z1, sEased) + whipV * 0.06, 1.03 + Math.abs(lerp(shot.y0, shot.y1, sEased)) / 940, 1.03 + Math.abs(lerp(shot.x0, shot.x1, sEased)) / 520)}
            x={lerp(shot.x0, shot.x1, sEased) + sx * 0.5 + whipV * whipDir * -70}
            y={lerp(shot.y0, shot.y1, sEased) + sy * 0.5}
            blur={whipV * 10.5}
            dim={0.05 + whipV * 0.05}
          />
        ) : null}

        {/* the two cars bring their own light up at the phone as they pass */}
        {(f > 250 && f < 380) || (f > 460 && f < 520) ? (
          <>
            <div style={{ position: "absolute", left: 250, top: 900, width: 520, height: 700, background: "radial-gradient(ellipse at 50% 60%, rgba(255,244,220,0.30), rgba(255,214,160,0.08) 44%, transparent 72%)", filter: "blur(50px)", mixBlendMode: "screen", opacity: Math.max(p(f, 258, 300) * (1 - p(f, 320, 372)), p(f, 466, 486) * (1 - p(f, 500, 518))) }} />
            <div style={{ position: "absolute", left: 470, top: 960, width: 470, height: 620, background: "radial-gradient(ellipse at 50% 60%, rgba(255,96,54,0.26), transparent 66%)", filter: "blur(54px)", mixBlendMode: "screen", opacity: Math.max(p(f, 264, 306) * (1 - p(f, 326, 376)), p(f, 472, 490) * (1 - p(f, 502, 520))) }} />
          </>
        ) : null}
        <Whip v={whipV} dir={whipDir} />
        <Optics f={f} flare={flare} />

      {/* the operator's own thumb slips past the corner of the lens */}
      <div
        style={{
          position: "absolute",
          left: lerp(1180, 860, p(f, 484, 494, EASEIO)),
          top: 1560,
          width: 260,
          height: 420,
          borderRadius: "46% 54% 50% 50%",
          background: "linear-gradient(140deg, #070a10, #0d1219 50%, #04060a)",
          filter: "blur(18px)",
          opacity: Math.min(p(f, 482, 488), 1 - p(f, 496, 506)) * 0.85,
          transform: "rotate(-22deg)",
        }}
      />
        {/* the operator's own shoulder enters the frame during the last whip */}
        <div
          style={{
            position: "absolute",
            left: -220,
            bottom: -240,
            width: 620,
            height: 640,
            borderRadius: "50% 50% 0 0",
            background: "#020305",
            filter: "blur(28px)",
            opacity: p(f, 520, 545) * 0.9,
          }}
        />
      </AbsoluteFill>

      <Hud f={f} />
      <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${blackout})` }} />
      {score && score.length > 32 ? <Audio src={score} /> : null}
    </AbsoluteFill>
  );
};
