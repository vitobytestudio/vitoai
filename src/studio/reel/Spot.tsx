/**
 * VITO BYTE STUDIO — the spot.
 *
 * 36 seconds, nine movements, 120 BPM. Picture and score are written against
 * the same grid (bar = 2.0 s, beat = 0.5 s), so every cut lands on a beat.
 *
 * Each act runs on a different engine, because a spot that repeats one trick is
 * a slideshow:
 *   I   shockwave + camera push through a light blade
 *   II  a rotating 3D lattice of agents, links computed per frame
 *   III a tile field driven by a travelling wave
 *   IV  a vanishing-point tunnel with radial motion trails
 *   V   a decision graph that draws itself and then zooms into the leaf it chose
 *   VI  beat-cut type, five cards in two seconds
 *   VII a glass interface that assembles from shards and orbits in 3D
 *   VIII twelve beats of full-bleed montage
 *   IX  the wordmark built letter by letter in perspective
 */
import React from "react";
import { AbsoluteFill, Audio, Easing, useCurrentFrame } from "remotion";

const W = 1080;
const H = 1920;
const FPS = 30;
export const DURATION = 1080; // 36 s

/* ---------------------------------------------------------------- palette */

const INK = "#04060B";
const INK2 = "#0A1020";
const PAPER = "#F4F6FA";
const MINT = "#4FE3B0";
const BLUE = "#7EA2FF";
const VIOLET = "#A78BFA";
const AR = '"Cairo", "IBM Plex Sans Arabic", sans-serif';
const LAT = '"Space Grotesk", "Sora", sans-serif';
const MONO = '"JetBrains Mono", monospace';

/* ------------------------------------------------------------------ maths */

const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const EZ = Easing.bezier(0.16, 1, 0.3, 1);
const EO = Easing.bezier(0.22, 0.9, 0.24, 1);
const EX = Easing.bezier(0.7, 0, 0.84, 0);
const prog = (f: number, a: number, b: number, fn: (t: number) => number = EZ) => cl(fn(cl((f - a) / Math.max(1, b - a))));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const hexA = (c: string, a: number) => c + Math.round(cl(a) * 255).toString(16).padStart(2, "0");

/* --------------------------------------------------------------- elements */

/** Mask reveal. Negative insets mean the mask can never clip a glyph. */
const Rise: React.FC<{ v: number; dir?: "up" | "down" | "left"; children: React.ReactNode; style?: React.CSSProperties }> = ({
  v,
  dir = "up",
  children,
  style,
}) => {
  const done = v >= 0.999;
  const mask =
    dir === "up"
      ? `inset(-45% -14% ${(1 - v) * 100}% -14%)`
      : dir === "down"
        ? `inset(${(1 - v) * 100}% -14% -45% -14%)`
        : `inset(-45% ${(1 - v) * 100}% -45% -14%)`;
  return <span style={{ display: "block", clipPath: done ? undefined : mask, ...style }}>{children}</span>;
};

/** A living background: three drifting light fields, a rule grid, and air. */
const Aurora: React.FC<{ f: number; o?: number; warmth?: number }> = ({ f, o = 1, warmth = 0 }) => {
  const t = f / FPS;
  const blobs = [
    { x: 28 + Math.sin(t * 0.42) * 17, y: 24 + Math.cos(t * 0.33) * 13, r: 78, c: MINT, a: 0.3 },
    { x: 74 + Math.cos(t * 0.28) * 15, y: 60 + Math.sin(t * 0.37) * 15, r: 72, c: warmth > 0.5 ? VIOLET : BLUE, a: 0.34 },
    { x: 46 + Math.sin(t * 0.19 + 2) * 24, y: 90 + Math.cos(t * 0.25) * 9, r: 92, c: VIOLET, a: 0.2 },
  ];
  return (
    <AbsoluteFill style={{ background: `linear-gradient(178deg, ${INK2} 0%, ${INK} 44%, #02040A 100%)`, opacity: o }}>
      {blobs.map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${b.x}%`,
            top: `${b.y}%`,
            width: `${b.r * 2}vmax`,
            height: `${b.r * 2}vmax`,
            transform: "translate(-50%,-50%)",
            background: `radial-gradient(circle, ${hexA(b.c, b.a)} 0%, transparent 62%)`,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          inset: -40,
          opacity: 0.55,
          backgroundImage:
            "linear-gradient(to right, rgba(244,246,250,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(244,246,250,0.05) 1px, transparent 1px)",
          backgroundSize: "90px 90px",
          transform: `translateY(${(f * 0.4) % 90}px)`,
        }}
      />
    </AbsoluteFill>
  );
};

const Grain: React.FC<{ f: number; o?: number }> = ({ f, o = 0.05 }) => (
  <div
    style={{
      position: "absolute",
      inset: -40,
      opacity: o,
      mixBlendMode: "overlay",
      pointerEvents: "none",
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/></filter><rect width='140' height='140' filter='url(%23n)' opacity='0.55'/></svg>\")",
      backgroundPosition: `${(f * 11) % 140}px ${(f * 7) % 140}px`,
    }}
  />
);

const Vignette: React.FC<{ s?: number }> = ({ s = 0.6 }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background: `radial-gradient(ellipse 74% 58% at 50% 48%, transparent 30%, rgba(0,0,0,${s}) 100%)`,
    }}
  />
);

const Chroma: React.FC<{ v: number; children: React.ReactNode }> = ({ v, children }) =>
  v <= 0.004 ? (
    <>{children}</>
  ) : (
    <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${-8 * v}px)`, color: "rgba(255,90,120,0.65)", mixBlendMode: "screen" }}>{children}</div>
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${8 * v}px)`, color: "rgba(120,160,255,0.65)", mixBlendMode: "screen" }}>{children}</div>
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );

const Tag: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 15, letterSpacing: "0.4em", color: "rgba(244,246,250,0.5)", ...style }}>{children}</div>
);

/** Four frames of light after a hard cut: the eye reads a whip, not a gap. */
const CUTS = [60, 180, 300, 420, 540, 600, 780, 960];

const Whip: React.FC<{ f: number }> = ({ f }) => {
  const cut = CUTS.find((c) => f >= c && f < c + 4);
  if (cut === undefined) return null;
  const k = 1 - (f - cut) / 4;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, background: `rgba(244,246,250,${0.085 * k * k})` }} />
      {[...Array(11)].map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 120 + i * 250 + rnd(i + cut) * 80,
            height: 2 + rnd(i) * 4,
            background: `linear-gradient(90deg, transparent, ${i % 3 === 0 ? MINT : PAPER}, transparent)`,
            opacity: 0.45 * k * k,
            transform: `scaleX(${0.3 + rnd(i + 2) * 0.9})`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------- I · IGNITION 0–2.0s */

const SPARKS = [...Array(54)].map((_, i) => ({
  a: rnd(i * 3.1) * Math.PI * 2,
  v: 0.4 + rnd(i * 7.7) * 1.6,
  s: 2 + rnd(i * 5.3) * 5,
  d: rnd(i * 11.9),
}));

const Ignition: React.FC<{ f: number }> = ({ f }) => {
  const flash = f < 3 ? 0 : Math.exp(-(f - 3) * 0.1) * (1 - prog(f, 42, 60));
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Aurora f={f} o={prog(f, 3, 30) * 1.1} />

      {/* the shockwave: four rings, still travelling when the act cuts */}
      {[3, 9, 15, 21].map((r, i) => {
        const p = prog(f, r, r + 40, EX);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 820,
              height: 820,
              marginLeft: -410,
              marginTop: -410,
              borderRadius: "50%",
              border: `${i === 0 ? 5 : i === 1 ? 2 : 1}px solid ${i % 2 ? BLUE : MINT}`,
              opacity: (1 - p) * (i === 0 ? 1 : 0.6),
              transform: `scale(${lerp(0.02, 3.6, p)})`,
              boxShadow: i === 0 ? `0 0 60px ${hexA(MINT, 1 - p)}` : undefined,
            }}
          />
        );
      })}

      {/* sparks thrown from the core */}
      {SPARKS.map((s, i) => {
        const p = prog(f, 3 + s.d * 6, 64, EX);
        const r = p * 900 * s.v;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: W / 2 + Math.cos(s.a) * r,
              top: H / 2 + Math.sin(s.a) * r,
              width: s.s,
              height: s.s,
              marginLeft: -s.s / 2,
              marginTop: -s.s / 2,
              borderRadius: "50%",
              background: i % 4 === 0 ? PAPER : i % 2 ? MINT : BLUE,
              opacity: (1 - p) * 0.9,
            }}
          />
        );
      })}

      {/* the blade: a hard core inside a soft one */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: lerp(2, 1080, prog(f, 3, 24, EO)),
          height: 46,
          transform: "translate(-50%,-50%)",
          background: `linear-gradient(90deg, transparent, ${hexA(MINT, 0.5)}, ${hexA(PAPER, 0.85)}, ${hexA(MINT, 0.5)}, transparent)`,
          opacity: prog(f, 2, 5) * (1 - prog(f, 34, 56)),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: lerp(4, 1080, prog(f, 3, 24, EO)),
          height: 3,
          transform: "translate(-50%,-50%)",
          background: `linear-gradient(90deg, transparent, ${PAPER}, transparent)`,
          opacity: prog(f, 2, 5) * (1 - prog(f, 34, 56)),
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,${flash}) 0%, ${hexA(MINT, flash * 0.5)} 34%, transparent 66%)`,
        }}
      />

      <div style={{ position: "absolute", left: 64, top: 128, opacity: prog(f, 10, 30) }}>
        <Tag>FILM · ONE</Tag>
      </div>
      <Tag style={{ position: "absolute", left: 64, bottom: 88, opacity: prog(f, 24, 46) }}>VITO BYTE STUDIO</Tag>
      <Tag style={{ position: "absolute", right: 64, bottom: 88, opacity: prog(f, 24, 46) }}>MMXXVI</Tag>
      <Grain f={f} o={0.07} />
      <Vignette s={0.68} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------- II · SWARM 2–6s */

const NX = 7;
const NY = 7;
const NZ = 3;
const SWARM = (() => {
  const pts: { x: number; y: number; z: number; s: number }[] = [];
  for (let k = 0; k < NZ; k++)
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        const n = i + j * NX + k * NX * NY;
        pts.push({
          x: (i - (NX - 1) / 2) * 232 + (rnd(n) - 0.5) * 44,
          y: (j - (NY - 1) / 2) * 232 + (rnd(n + 91) - 0.5) * 44,
          z: (k - (NZ - 1) / 2) * 320 + (rnd(n + 17) - 0.5) * 40,
          s: rnd(n + 41),
        });
      }
  const links: [number, number][] = [];
  for (let k = 0; k < NZ; k++)
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        const a = i + j * NX + k * NX * NY;
        if (i + 1 < NX) links.push([a, a + 1]);
        if (j + 1 < NY) links.push([a, a + NX]);
        if (k + 1 < NZ) links.push([a, a + NX * NY]);
      }
  return { pts, links };
})();

const Swarm: React.FC<{ f: number }> = ({ f }) => {
  const rel = f - 60;
  const t = rel / FPS;
  const ry = t * 0.42 + 0.35;
  const rx = -0.24 + Math.sin(t * 0.5) * 0.12;
  const camZ = 1080 - prog(rel, 0, 120, Easing.bezier(0.4, 0, 0.6, 1)) * 300;
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const proj = SWARM.pts.map((p, n) => {
    const wob = Math.sin(t * 1.7 + p.s * 12) * 30;
    const x0 = p.x + wob;
    const y0 = p.y + Math.cos(t * 1.4 + p.s * 9) * 24;
    const z0 = p.z + Math.sin(t * 1.2 + p.s * 7) * 40;
    const x1 = x0 * cosY - z0 * sinY;
    const z1 = x0 * sinY + z0 * cosY;
    const y1 = y0 * cosX - z1 * sinX;
    const z2 = y0 * sinX + z1 * cosX;
    const d = camZ + z2;
    const k = 1000 / Math.max(200, d);
    return { x: W / 2 + x1 * k * 1.35, y: H / 2 + y1 * k * 1.35, k, d, s: p.s, n };
  });
  const intro = cl(0.45 + 0.55 * prog(rel, 0, 16));

  return (
    <AbsoluteFill style={{ background: INK }}>
      <Aurora f={f} o={0.7} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {SWARM.links.map(([a, b], i) => {
          const A = proj[a];
          const B = proj[b];
          const len = Math.hypot(A.x - B.x, A.y - B.y);
          if (len > 480 || A.d < 120 || B.d < 120) return null;
          const near = (1 - len / 480) * cl((1750 - A.d) / 850);
          if (near <= 0.03) return null;
          const pulse = 0.4 + 0.6 * Math.max(0, Math.sin(t * 2.4 - (A.n + B.n) * 0.14));
          return (
            <line
              key={i}
              x1={A.x}
              y1={A.y}
              x2={B.x}
              y2={B.y}
              stroke={pulse > 0.88 ? PAPER : MINT}
              strokeWidth={0.8 + near * 2.8}
              opacity={cl(near) * (0.3 + pulse * 0.7) * intro}
            />
          );
        })}
      </svg>
      {proj.map((p) => {
        const near = cl((1600 - p.d) / 1200);
        const size = 5 + near * 11 + p.s * 4;
        const hot = p.s > 0.84;
        return (
          <div
            key={p.n}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2,
              borderRadius: "50%",
              background: hot ? PAPER : near > 0.5 ? MINT : BLUE,
              opacity: (0.35 + near * 0.65) * intro,
              boxShadow: hot ? `0 0 ${18 + 22 * p.s}px ${MINT}` : near > 0.7 ? `0 0 8px ${hexA(MINT, 0.8)}` : undefined,
            }}
          />
        );
      })}

      <div style={{ position: "absolute", left: 64, right: 64, bottom: 210, direction: "rtl" }}>
        <Rise v={prog(rel, 16, 40)}>
          <div style={{ fontFamily: AR, fontSize: 108, fontWeight: 800, color: PAPER, lineHeight: 1.18 }}>مئة وكيل.</div>
        </Rise>
        <Rise v={prog(rel, 28, 52)}>
          <div style={{ fontFamily: AR, fontSize: 108, fontWeight: 800, color: MINT, lineHeight: 1.18 }}>نيّة واحدة.</div>
        </Rise>
      </div>
      <Tag style={{ position: "absolute", left: 64, top: 132, opacity: prog(rel, 6, 26) }}>01 / PARALLEL AGENTS</Tag>
      <div style={{ position: "absolute", right: 64, top: 128, fontFamily: MONO, fontSize: 16, letterSpacing: "0.24em", color: MINT, opacity: prog(rel, 34, 54) }}>
        {Math.round(lerp(0, 147, prog(rel, 34, 90)))} ONLINE
      </div>
      <Grain f={f} o={0.055} />
      <Vignette s={0.62} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------ III · SYSTEM 6–10s */

const COLS = 10;
const ROWS = 22;
const System: React.FC<{ f: number }> = ({ f }) => {
  const rel = f - 180;
  const t = rel / FPS;
  const tw = W / COLS;
  const th = (H * 1.3) / ROWS;
  return (
    <AbsoluteFill style={{ background: "#02040A" }}>
      <Aurora f={f} o={0.34} />
      <div style={{ position: "absolute", inset: 0, perspective: 2000, perspectiveOrigin: "50% 34%" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: -H * 0.16,
            height: H * 1.3,
            transform: "rotateX(24deg) scale(1.14)",
            transformStyle: "preserve-3d",
          }}
        >
          {[...Array(COLS * ROWS)].map((_, n) => {
            const i = n % COLS;
            const j = Math.floor(n / COLS);
            const delay = (i + j) * 0.8 + rnd(n) * 5;
            const inn = cl(0.3 + 0.7 * prog(rel, delay * 0.45, delay * 0.45 + 18));
            const wave = Math.sin(j * 0.5 + i * 0.28 - t * 4.4);
            const heat = Math.max(0, wave) ** 3 * 0.62 + rnd(n + 3) * 0.14;
            return (
              <div
                key={n}
                style={{
                  position: "absolute",
                  left: i * tw + 2,
                  top: j * th + 2,
                  width: tw - 4,
                  height: th - 4,
                  borderRadius: 3,
                  border: `1px solid rgba(244,246,250,${0.06 + heat * 0.12})`,
                  background:
                    heat > 0.28 ? `rgba(79,227,176,${0.12 + heat * 0.55})` : `rgba(244,246,250,${0.018 + rnd(n + 8) * 0.025})`,
                  transform: `rotateX(${(1 - inn) * -88}deg)`,
                  transformOrigin: "50% 0%",
                  opacity: inn,
                }}
              />
            );
          })}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: H * 0.34,
          height: H * 0.34,
          background: `linear-gradient(180deg, transparent, rgba(2,4,10,0.86) 18%, rgba(2,4,10,0.86) 82%, transparent)`,
        }}
      />
      <div style={{ position: "absolute", left: 64, right: 64, top: H * 0.4 }}>
        <Rise v={prog(rel, 34, 60)}>
          <div style={{ fontFamily: LAT, fontSize: 152, fontWeight: 700, color: PAPER, letterSpacing: "-0.035em", lineHeight: 0.96 }}>ONE SYSTEM.</div>
        </Rise>
        <div style={{ width: lerp(0, 180, prog(rel, 52, 78)), height: 3, background: MINT, margin: "26px 0 20px" }} />
        <Rise v={prog(rel, 52, 78)}>
          <div style={{ fontFamily: AR, fontSize: 64, fontWeight: 700, color: MINT, direction: "rtl" }}>نظام واحد. لا أدوات.</div>
        </Rise>
      </div>
      <Tag style={{ position: "absolute", left: 64, bottom: 132, opacity: prog(rel, 18, 40) }}>02 / THE PLATFORM</Tag>
      <div style={{ position: "absolute", right: 64, bottom: 132, fontFamily: MONO, fontSize: 15, letterSpacing: "0.24em", color: "rgba(244,246,250,0.45)", opacity: prog(rel, 26, 48) }}>
        11 SURFACES · 4 LANGUAGES
      </div>
      <Grain f={f} o={0.05} />
      <Vignette s={0.66} />
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------- IV · PIPELINE 10–14s */

const RAYS = 26;
const Pipeline: React.FC<{ f: number }> = ({ f }) => {
  const rel = f - 300;
  const t = rel / FPS;
  const roll = lerp(-3.6, 3.6, prog(rel, 0, 120, Easing.bezier(0.4, 0, 0.6, 1)));
  const speed = lerp(0.4, 1.25, prog(rel, 0, 100));
  return (
    <AbsoluteFill style={{ background: "#03050C", transform: `rotate(${roll}deg) scale(1.1)` }}>
      <Aurora f={f} o={0.5} />
      <div style={{ position: "absolute", left: W / 2, top: H / 2, width: 620, height: 620, marginLeft: -310, marginTop: -310, borderRadius: "50%", background: `radial-gradient(circle, ${hexA(BLUE, 0.35)}, transparent 66%)` }} />
      {[...Array(RAYS)].map((_, i) => {
        const a = (i / RAYS) * Math.PI * 2 + t * 0.18;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: W / 2,
              top: H / 2,
              width: 1400,
              height: 2,
              transformOrigin: "0 50%",
              transform: `rotate(${a}rad)`,
              background: `linear-gradient(90deg, ${hexA(i % 3 ? BLUE : MINT, 0.7)}, ${hexA(BLUE, 0.03)})`,
              opacity: 0.75,
            }}
          />
        );
      })}
      {[...Array(44)].map((_, i) => {
        const z = ((t * speed + i * 0.047) % 1) ** 1.5;
        const a = (i / 44) * Math.PI * 2 * 3.1 + i;
        const r = 30 + z * 1300;
        const size = 6 + z * 34;
        const x = W / 2 + Math.cos(a) * r;
        const y = H / 2 + Math.sin(a) * r * 1.55;
        const fired = Math.max(0, Math.sin(t * 9.5 - i * 0.74));
        return (
          <div key={i}>
            <div
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: size,
                height: size,
                marginLeft: -size / 2,
                marginTop: -size / 2,
                borderRadius: "50%",
                background: fired > 0.84 ? PAPER : i % 3 === 0 ? MINT : BLUE,
                opacity: Math.min(1, z * 3) * (0.5 + fired * 0.5),
                boxShadow: fired > 0.84 ? `0 0 30px ${MINT}` : `0 0 10px ${hexA(BLUE, 0.6)}`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: W / 2 + (x - W / 2) * 0.82,
                top: H / 2 + (y - H / 2) * 0.82,
                width: size * 0.55,
                height: size * 0.55,
                marginLeft: -size * 0.27,
                marginTop: -size * 0.27,
                borderRadius: "50%",
                background: BLUE,
                opacity: Math.min(1, z * 3) * 0.22,
              }}
            />
          </div>
        );
      })}
      {[...Array(9)].map((_, i) => {
        const z = ((t * 1.7 + i * 0.11) % 1) ** 1.3;
        const a = i * 2.3;
        const r = z * 1150;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: W / 2 + Math.cos(a) * r,
              top: H / 2 + Math.sin(a) * r,
              width: 110 + z * 460,
              height: 4,
              transform: `rotate(${a}rad)`,
              background: `linear-gradient(90deg, transparent, ${hexA(PAPER, 0.85)}, transparent)`,
              opacity: 1 - z,
            }}
          />
        );
      })}
      <div style={{ position: "absolute", left: 64, right: 64, bottom: 220, direction: "rtl", textAlign: "center" }}>
        <Rise v={prog(rel, 20, 46)}>
          <div style={{ fontFamily: AR, fontSize: 100, fontWeight: 800, color: PAPER, lineHeight: 1.2 }}>من الفكرة</div>
        </Rise>
        <Rise v={prog(rel, 32, 58)}>
          <div style={{ fontFamily: AR, fontSize: 100, fontWeight: 800, color: MINT, lineHeight: 1.2 }}>إلى الفيلم.</div>
        </Rise>
      </div>
      <Tag style={{ position: "absolute", left: 64, top: 132, opacity: prog(rel, 8, 30) }}>03 / THE PIPELINE</Tag>
      <div style={{ position: "absolute", right: 64, top: 126, fontFamily: MONO, fontSize: 15, letterSpacing: "0.22em", color: MINT }}>
        {(0.4 + Math.sin(t * 3) * 0.05).toFixed(2)}s / AGENT
      </div>
      <Grain f={f} o={0.06} />
      <Vignette s={0.5} />
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------- V · DECISION 14–18s */

const TN = [
  { x: 96, y: 960, on: true, l: 0 },
  { x: 380, y: 590, on: false, l: 1 },
  { x: 380, y: 900, on: true, l: 1 },
  { x: 380, y: 1240, on: false, l: 1 },
  { x: 640, y: 470, on: false, l: 2 },
  { x: 640, y: 700, on: false, l: 2 },
  { x: 640, y: 830, on: true, l: 2 },
  { x: 640, y: 985, on: false, l: 2 },
  { x: 640, y: 1150, on: false, l: 2 },
  { x: 640, y: 1340, on: false, l: 2 },
  { x: 930, y: 770, on: true, l: 3 },
  { x: 930, y: 900, on: false, l: 3 },
  { x: 560, y: 400, on: false, l: 3 },
  { x: 560, y: 560, on: false, l: 3 },
  { x: 700, y: 1250, on: false, l: 3 },
  { x: 800, y: 1400, on: false, l: 3 },
];
const TE: [number, number, boolean][] = [
  [0, 1, false], [0, 2, true], [0, 3, false],
  [1, 4, false], [1, 5, false],
  [2, 6, true], [2, 7, false],
  [3, 8, false], [3, 9, false],
  [6, 10, true], [6, 11, false],
  [4, 12, false], [5, 13, false], [7, 14, false], [8, 15, false], [9, 14, false],
];

const Decision: React.FC<{ f: number }> = ({ f }) => {
  const rel = f - 420;
  const push = prog(rel, 76, 120, Easing.bezier(0.5, 0, 0.4, 1));
  const zoom = lerp(1, 1.75, push);
  const origin = { x: 930, y: 770 };
  const path = [0, 2, 6, 10];
  const seg = (a: number, b: number) => {
    const A = TN[a];
    const B = TN[b];
    const mx = (A.x + B.x) / 2;
    return `M ${A.x} ${A.y} C ${mx} ${A.y}, ${mx} ${B.y}, ${B.x} ${B.y}`;
  };
  return (
    <AbsoluteFill style={{ background: "#03060E" }}>
      <Aurora f={f} o={0.42} warmth={1} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${zoom})`,
          transformOrigin: `${origin.x}px ${origin.y}px`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.5,
            backgroundImage: "radial-gradient(rgba(244,246,250,0.16) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          {TE.map(([a, b, on], i) => {
            const draw = prog(rel, 4 + i * 3.4, 30 + i * 3.4);
            return (
              <path
                key={i}
                d={seg(a, b)}
                fill="none"
                stroke={on ? MINT : "rgba(244,246,250,0.42)"}
                strokeWidth={on ? 4 : 1.7}
                strokeDasharray={1400}
                strokeDashoffset={1400 * (1 - draw)}
                opacity={on ? 1 : 0.4}
                style={{ filter: on ? `drop-shadow(0 0 12px ${MINT})` : undefined }}
              />
            );
          })}
          {(() => {
            const t = prog(rel, 44, 82, Easing.bezier(0.4, 0, 0.5, 1));
            const idx = Math.min(path.length - 2, Math.floor(t * (path.length - 1)));
            const local = t * (path.length - 1) - idx;
            const A = TN[path[idx]];
            const B = TN[path[idx + 1]];
            const mx = (A.x + B.x) / 2;
            const q = 1 - local;
            const x = q * q * q * A.x + 3 * q * q * local * mx + 3 * q * local * local * mx + local ** 3 * B.x;
            const y = q * q * q * A.y + 3 * q * q * local * A.y + 3 * q * local * local * B.y + local ** 3 * B.y;
            return (
              <>
                <circle cx={x} cy={y} r={13} fill={PAPER} />
                <circle cx={x} cy={y} r={40} fill="none" stroke={MINT} strokeWidth={2.5} opacity={0.6} />
                <circle cx={x} cy={y} r={76} fill="none" stroke={MINT} strokeWidth={1} opacity={0.25} />
              </>
            );
          })()}
        </svg>
        {TN.map((n, i) => {
          const on = prog(rel, 8 + i * 2.4, 24 + i * 2.4);
          const chosen = path.includes(i);
          const size = chosen ? 20 : 11;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: n.x,
                top: n.y,
                width: size,
                height: size,
                marginLeft: -size / 2,
                marginTop: -size / 2,
                borderRadius: "50%",
                background: chosen ? MINT : PAPER,
                opacity: on * (chosen ? 1 : 0.28),
                boxShadow: chosen ? `0 0 34px ${MINT}` : undefined,
              }}
            />
          );
        })}
      </div>

      <div style={{ position: "absolute", left: 64, right: 64, bottom: 180, direction: "rtl" }}>
        <Rise v={prog(rel, 26, 52)}>
          <div style={{ fontFamily: AR, fontSize: 92, fontWeight: 800, color: PAPER, lineHeight: 1.24 }}>قرار، لا وصف.</div>
        </Rise>
        <Rise v={prog(rel, 40, 66)}>
          <div style={{ fontFamily: AR, fontSize: 92, fontWeight: 800, color: MINT, lineHeight: 1.24 }}>لا قالب.</div>
        </Rise>
      </div>
      <Tag style={{ position: "absolute", left: 64, top: 132, opacity: prog(rel, 6, 28) }}>04 / THE DECISION</Tag>
      <div style={{ position: "absolute", right: 64, top: 126, fontFamily: MONO, fontSize: 14, letterSpacing: "0.22em", color: "rgba(244,246,250,0.45)" }}>
        {Math.round(lerp(96, 3, prog(rel, 44, 90)))} BRANCHES PRUNED
      </div>
      <Grain f={f} o={0.055} />
      <Vignette s={0.66} />
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------- VI · BUILD 18–20s */

const BUILDS: { w: string; fg: string; bg: string; from: number; to: number; kind: "wipe" | "punch" | "split" }[] = [
  { w: "THINK", fg: INK, bg: MINT, from: 540, to: 555, kind: "wipe" },
  { w: "PLAN", fg: PAPER, bg: INK, from: 555, to: 570, kind: "punch" },
  { w: "CUT", fg: INK, bg: PAPER, from: 570, to: 585, kind: "split" },
  { w: "SCORE", fg: MINT, bg: "#0A1024", from: 585, to: 592, kind: "wipe" },
  { w: "SHIP", fg: INK, bg: BLUE, from: 592, to: 600, kind: "punch" },
];

const Build: React.FC<{ f: number }> = ({ f }) => {
  const hit = BUILDS.find((b) => f >= b.from && f < b.to) ?? BUILDS[BUILDS.length - 1];
  const local = f - hit.from;
  const span = hit.to - hit.from;
  const t = prog(local, 0, Math.max(3, span * 0.5), EO);
  const mask =
    hit.kind === "wipe"
      ? `inset(-20% ${(1 - t) * 100}% -20% -10%)`
      : hit.kind === "split"
        ? `inset(-20% ${(1 - t) * 50}% -20% ${(1 - t) * 50}%)`
        : undefined;
  return (
    <AbsoluteFill style={{ background: hit.bg }}>
      {hit.kind === "split" ? (
        <AbsoluteFill>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, background: INK }} />
            <div style={{ flex: 1, background: PAPER }} />
          </div>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center" }}>
            <span
              style={{
                fontFamily: LAT,
                fontSize: 240,
                fontWeight: 700,
                letterSpacing: "-0.05em",
                color: PAPER,
                mixBlendMode: "difference",
                transform: `scale(${lerp(1.14, 1, t)})`,
                padding: "0 0 0.06em",
              }}
            >
              {hit.w}
            </span>
          </div>
        </AbsoluteFill>
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center" }}>
          <Chroma v={1 - t}>
            <span
              style={{
                fontFamily: LAT,
                fontSize: hit.w.length > 4 ? 176 : 226,
                fontWeight: 700,
                letterSpacing: "-0.05em",
                color: hit.fg,
                clipPath: mask,
                transform: `scale(${lerp(hit.kind === "punch" ? 1.26 : 1.05, 1, t)})`,
                display: "block",
                padding: "0 0 0.1em",
              }}
            >
              {hit.w}
            </span>
          </Chroma>
        </div>
      )}
      <div style={{ position: "absolute", left: 64, bottom: 96, fontFamily: MONO, fontSize: 14, letterSpacing: "0.4em", color: hit.fg, opacity: 0.5 }}>
        05 / {String(BUILDS.indexOf(hit) + 1).padStart(2, "0")}
      </div>
      <Grain f={f} o={0.07} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------- VII · PRODUCT 20–26 */

const AGENTS = [
  { n: "RESEARCH", p: 0.42, c: MINT },
  { n: "DIRECTION", p: 0.71, c: BLUE },
  { n: "MONTAGE", p: 0.93, c: VIOLET },
];

const PanelBody: React.FC<{ f: number }> = ({ f }) => {
  const rel = f - 600;
  const t = rel / FPS;
  const typed = "writing the cut...".slice(0, Math.floor(prog(rel, 46, 96) * 17));
  return (
    <div style={{ position: "absolute", inset: 0, padding: 42, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 9, height: 9, borderRadius: 9, background: MINT, boxShadow: `0 0 16px ${MINT}` }} />
          <span style={{ fontFamily: MONO, fontSize: 17, letterSpacing: "0.28em", color: PAPER }}>VITO BYTE</span>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 14, letterSpacing: "0.2em", color: "rgba(244,246,250,0.45)" }}>RUN 0412</span>
      </div>

      <div style={{ marginTop: 30, display: "flex", alignItems: "flex-end", gap: 14 }}>
        <span style={{ fontFamily: LAT, fontSize: 118, fontWeight: 700, color: PAPER, letterSpacing: "-0.05em", lineHeight: 0.88 }}>
          {Math.round(lerp(96, 147, prog(rel, 18, 74)))}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 14, letterSpacing: "0.22em", color: MINT, paddingBottom: 12 }}>AGENTS</span>
      </div>

      <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 18 }}>
        {AGENTS.map((a, i) => {
          const p = prog(rel, 24 + i * 9, 74 + i * 9, Easing.bezier(0.35, 0.9, 0.3, 1));
          return (
            <div key={a.n}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.2em", color: "rgba(244,246,250,0.78)" }}>{a.n}</span>
                <span style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.16em", color: a.c }}>{Math.round(a.p * p * 100)}%</span>
              </div>
              <div style={{ height: 3, background: "rgba(244,246,250,0.1)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${a.p * p * 100}%`, background: a.c }} />
              </div>
            </div>
          );
        })}
      </div>

      <svg width="100%" height="122" viewBox="0 0 760 122" style={{ marginTop: 22 }}>
        {[0, 1, 2].map((i) => (
          <line key={i} x1={0} x2={760} y1={14 + i * 38} y2={14 + i * 38} stroke="rgba(244,246,250,0.07)" strokeWidth={1} />
        ))}
        <path
          d="M8 96 C 90 94, 120 44, 190 52 S 300 104, 372 74 S 470 12, 540 30 S 660 72, 748 16"
          fill="none"
          stroke={MINT}
          strokeWidth={3}
          strokeDasharray={1000}
          strokeDashoffset={1000 * (1 - prog(rel, 32, 92, Easing.bezier(0.3, 0.9, 0.2, 1)))}
        />
        <path
          d="M8 110 C 110 108, 150 78, 230 82 S 340 118, 420 96 S 540 48, 620 62 S 700 96, 748 56"
          fill="none"
          stroke={BLUE}
          strokeWidth={2}
          opacity={0.55}
          strokeDasharray={1000}
          strokeDashoffset={1000 * (1 - prog(rel, 42, 102, Easing.bezier(0.3, 0.9, 0.2, 1)))}
        />
      </svg>

      {/* the storyboard strip: six frames appearing under the curve */}
      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        {[...Array(6)].map((_, i) => {
          const on = prog(rel, 62 + i * 5, 84 + i * 5);
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: 62,
                borderRadius: 4,
                border: "1px solid rgba(244,246,250,0.14)",
                background: `linear-gradient(150deg, ${hexA(i % 2 ? BLUE : MINT, 0.28)}, rgba(244,246,250,0.04))`,
                opacity: on,
                transform: `translateY(${(1 - on) * 18}px)`,
                display: "flex",
                alignItems: "flex-end",
                padding: 6,
              }}
            >
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: "rgba(244,246,250,0.6)" }}>{String(i + 1).padStart(2, "0")}</div>
            </div>
          );
        })}
      </div>

      {/* the cut, as a timeline: this is what the agents actually produced */}
      <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 11, letterSpacing: "0.24em", color: "rgba(244,246,250,0.4)" }}>
        <span>TIMELINE</span>
        <span>36.0s</span>
      </div>
      <div style={{ marginTop: 8, position: "relative", height: 52, borderRadius: 6, border: "1px solid rgba(244,246,250,0.12)", background: "rgba(244,246,250,0.03)", display: "flex", gap: 3, padding: 6 }}>
        {[
          [0.16, MINT],
          [0.2, PAPER],
          [0.14, PAPER],
          [0.16, BLUE],
          [0.14, PAPER],
          [0.2, BLUE],
        ].map(([w, col], i) => {
          const on = prog(rel, 66 + i * 4, 82 + i * 4);
          return <div key={i} style={{ flex: `${w} 1 0`, background: hexA(col as string, 0.35), opacity: on, transform: `scaleX(${on})`, transformOrigin: "0 50%" }} />;
        })}
        <div style={{ position: "absolute", top: -5, bottom: -5, left: `${18 + prog(rel, 60, 118) * 78}%`, width: 2, background: PAPER, boxShadow: `0 0 10px ${PAPER}` }} />
      </div>

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 9 }}>
        {[
          ["read the brief", 70],
          ["chose a structure", 82],
          ["wrote the score", 94],
        ].map(([line, at], i) => {
          const on = prog(rel, at as number, (at as number) + 16);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, opacity: on, transform: `translateX(${(1 - on) * -12}px)` }}>
              <div style={{ width: 5, height: 5, background: MINT }} />
              <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.14em", color: "rgba(244,246,250,0.62)" }}>{line}</span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 18, borderTop: "1px solid rgba(244,246,250,0.1)" }}>
        <span style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.14em", color: MINT }}>
          {typed}
          <span style={{ opacity: Math.sin(t * 12) > 0 ? 1 : 0 }}>|</span>
        </span>
        <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.2em", color: "rgba(244,246,250,0.4)" }}>00:36</span>
      </div>
    </div>
  );
};

const Product: React.FC<{ f: number }> = ({ f }) => {
  const rel = f - 600;
  const t = rel / FPS;
  const orbit = Math.sin(t * 0.7) * 8 - 4;
  const tilt = 6 + Math.cos(t * 0.6) * 2;
  const assemble = prog(rel, 0, 30, EO);
  const shards = [
    "polygon(0% 0%, 100% 0%, 100% 26%, 0% 26%)",
    "polygon(0% 26%, 100% 26%, 100% 52%, 0% 52%)",
    "polygon(0% 52%, 100% 52%, 100% 74%, 0% 74%)",
    "polygon(0% 74%, 100% 74%, 100% 90%, 0% 90%)",
    "polygon(0% 90%, 100% 90%, 100% 100%, 0% 100%)",
  ];
  return (
    <AbsoluteFill style={{ background: "#03060E", perspective: 1900, perspectiveOrigin: "50% 44%" }}>
      <Aurora f={f} o={0.85} />
      <div
        style={{
          position: "absolute",
          left: W / 2 - 396,
          top: H / 2 - 566,
          width: 792,
          height: 916,
          transformStyle: "preserve-3d",
          transform: `rotateY(${orbit}deg) rotateX(${tilt}deg) scale(${lerp(1.06, 1, prog(rel, 0, 54))})`,
        }}
      >
        {shards.map((clip, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              clipPath: clip,
              transform: `translateZ(${(1 - assemble) * (i % 2 ? 280 : -220)}px) translateY(${(1 - assemble) * (i % 2 ? 130 : -100)}px)`,
              opacity: assemble,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 26,
                background: "linear-gradient(155deg, rgba(244,246,250,0.15), rgba(244,246,250,0.035) 42%, rgba(79,227,176,0.08))",
                border: "1px solid rgba(244,246,250,0.22)",
                boxShadow: "0 40px 120px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.4)",
                overflow: "hidden",
              }}
            >
              <PanelBody f={f} />
            </div>
          </div>
        ))}
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: "translateY(946px) scaleY(-1)",
            opacity: 0.16 * assemble,
            maskImage: "linear-gradient(180deg, rgba(0,0,0,0.8), transparent 48%)",
            WebkitMaskImage: "linear-gradient(180deg, rgba(0,0,0,0.8), transparent 48%)",
          }}
        >
          <div style={{ position: "absolute", inset: 0, borderRadius: 26, background: "rgba(244,246,250,0.1)", border: "1px solid rgba(244,246,250,0.14)" }} />
        </div>
      </div>

      <div style={{ position: "absolute", left: 64, top: 132 }}>
        <Tag>06 / THE ENGINE</Tag>
      </div>
      <div style={{ position: "absolute", right: 64, top: 126, fontFamily: MONO, fontSize: 14, letterSpacing: "0.22em", color: "rgba(244,246,250,0.45)" }}>
        LIVE
      </div>
      <div style={{ position: "absolute", left: 64, right: 64, bottom: 110, direction: "rtl" }}>
        <Rise v={prog(rel, 24, 52)}>
          <div style={{ fontFamily: AR, fontSize: 86, fontWeight: 800, color: PAPER, lineHeight: 1.2 }}>فكرة واحدة.</div>
        </Rise>
        <Rise v={prog(rel, 38, 66)}>
          <div style={{ fontFamily: AR, fontSize: 86, fontWeight: 800, color: MINT, lineHeight: 1.2 }}>فيلم كامل.</div>
        </Rise>
      </div>
      <Grain f={f} o={0.05} />
      <Vignette s={0.58} />
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------- VIII · DROP 26–32s */

type Card = { w: string; sub?: string; fg: string; bg: string; ar?: boolean; kind?: "big" | "wave" | "grid" | "mark" | "count" };
const CARDS: Card[] = [
  { w: "THINK", sub: "147 MINDS", fg: PAPER, bg: INK, kind: "big" },
  { w: "147", sub: "AGENTS", fg: MINT, bg: "#0A1024", kind: "count" },
  { w: "PLAN", sub: "ONE INTENT", fg: INK, bg: MINT, kind: "big" },
  { w: "BUILD", sub: "NO TEMPLATE", fg: INK, bg: PAPER, kind: "big" },
  { w: "CUT", sub: "ON THE BEAT", fg: PAPER, bg: INK, kind: "wave" },
  { w: "SCORE", sub: "SYNTHESISED", fg: MINT, bg: "#0A1024", kind: "grid" },
  { w: "SHIP", sub: "36 SECONDS", fg: INK, bg: BLUE, kind: "big" },
  { w: "قرار", sub: "DECISION", fg: PAPER, bg: INK, ar: true, kind: "big" },
  { w: "ONE", sub: "SYSTEM", fg: INK, bg: PAPER, kind: "big" },
  { w: "VITO", sub: "BYTE STUDIO", fg: PAPER, bg: INK, kind: "mark" },
  { w: "STUDIO", sub: "EST 2026", fg: INK, bg: MINT, kind: "mark" },
  { w: "36″", sub: "ONE TAKE", fg: PAPER, bg: INK, kind: "count" },
];

const Drop: React.FC<{ f: number }> = ({ f }) => {
  const rel = f - 780;
  const idx = Math.min(CARDS.length - 1, Math.floor(rel / 15));
  const card = CARDS[idx];
  const local = rel - idx * 15;
  const t = prog(local, 0, 10, EO);

  const body = () => {
    if (card.kind === "wave")
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 7, height: 300 }}>
          {[...Array(26)].map((_, i) => {
            const h = 50 + Math.abs(Math.sin(i * 0.7 + local * 0.6)) * 260 * (0.4 + rnd(i) * 0.6);
            return <div key={i} style={{ width: 16, height: h * t, background: i % 3 === 0 ? MINT : PAPER, opacity: 0.9 }} />;
          })}
        </div>
      );
    if (card.kind === "grid")
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(11, 1fr)", gap: 7, width: 720 }}>
          {[...Array(44)].map((_, i) => (
            <div
              key={i}
              style={{
                height: 20,
                background: rnd(i + idx) > 0.5 ? MINT : "rgba(244,246,250,0.24)",
                opacity: cl(t * 1.6 - rnd(i) * 0.6),
                transform: `scaleX(${cl(t * 1.4 - rnd(i) * 0.4)})`,
              }}
            />
          ))}
        </div>
      );
    if (card.kind === "mark")
      return (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: LAT, fontSize: 196, fontWeight: 700, letterSpacing: "-0.055em", color: card.fg, lineHeight: 1, paddingBottom: "0.06em" }}>{card.w}</div>
          <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.62em", color: card.fg, opacity: 0.65, marginTop: 10, marginRight: "-0.62em" }}>{card.sub}</div>
        </div>
      );
    if (card.kind === "count")
      return (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: LAT, fontSize: card.w.length > 3 ? 190 : 300, fontWeight: 700, letterSpacing: "-0.06em", color: card.fg, lineHeight: 0.9 }}>
            {card.w.length > 3 ? Math.round(lerp(90, 147, t)) : card.w}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: "0.5em", color: card.fg, opacity: 0.7, marginTop: 16, marginRight: "-0.5em" }}>{card.sub}</div>
        </div>
      );
    return (
      <div style={{ textAlign: "center", direction: card.ar ? "rtl" : "ltr" }}>
        <div
          style={{
            fontFamily: card.ar ? AR : LAT,
            fontSize: card.w.length > 4 ? 176 : 214,
            fontWeight: 700,
            letterSpacing: card.ar ? "0" : "-0.055em",
            color: card.fg,
            lineHeight: 1.04,
            paddingBottom: "0.08em",
            clipPath: `inset(-25% ${(1 - t) * 100}% -25% -25%)`,
          }}
        >
          {card.w}
        </div>
        {card.sub ? (
          <div style={{ fontFamily: MONO, fontSize: 19, letterSpacing: "0.46em", color: card.fg, opacity: 0.66 * t, marginTop: 14, marginRight: "-0.46em" }}>
            {card.sub}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ background: card.bg }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeContent: "center",
          fontFamily: card.ar ? AR : LAT,
          fontSize: 300,
          fontWeight: 700,
          letterSpacing: "-0.06em",
          color: card.fg,
          opacity: 0.07,
          transform: `scale(${lerp(1.5, 1.24, t)}) translateX(${(idx % 2 ? -1 : 1) * (1 - t) * 70}px) rotate(${idx % 2 ? -7 : 5}deg)`,
          whiteSpace: "nowrap",
        }}
      >
        {card.w}
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.5,
          backgroundImage:
            idx % 3 === 0
              ? "radial-gradient(circle at 50% 50%, transparent 34%, rgba(0,0,0,0.13) 34.2%, transparent 34.6%)"
              : idx % 3 === 1
                ? "repeating-linear-gradient(45deg, rgba(0,0,0,0.05) 0 2px, transparent 2px 16px)"
                : "radial-gradient(rgba(0,0,0,0.1) 1px, transparent 1px)",
          backgroundSize: idx % 3 === 2 ? "30px 30px" : undefined,
        }}
      />
      <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center", transform: `scale(${lerp(1.08, 1, t)})` }}>{body()}</div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 26, background: card.fg, opacity: 0.9, transform: `scaleX(${t})`, transformOrigin: "0 50%" }} />
      <div style={{ position: "absolute", right: 64, top: 120, fontFamily: MONO, fontSize: 14, letterSpacing: "0.3em", color: card.fg, opacity: 0.45 }}>
        {String(idx + 1).padStart(2, "0")}/12
      </div>
      <Grain f={f} o={0.06} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------- IX · SIGNATURE 32–36s */

const WORD = "VITO BYTE".split("");

const Signature: React.FC<{ f: number }> = ({ f }) => {
  const rel = f - 960;
  const bloom = Math.exp(-rel * 0.055);
  const track = lerp(0.16, -0.025, prog(rel, 0, 60));
  const studioTrack = lerp(0.3, 0.8, prog(rel, 26, 68));
  return (
    <AbsoluteFill style={{ background: INK, justifyContent: "center", alignItems: "center" }}>
      <Aurora f={f} o={0.7} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 46%, ${hexA(MINT, bloom * 0.55)} 0%, transparent 54%)` }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ perspective: 1200, display: "flex", transformStyle: "preserve-3d" }}>
          {WORD.map((ch, i) => {
            const p = prog(rel, 1 + i * 2.4, 20 + i * 2.4, EO);
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  fontFamily: LAT,
                  fontSize: 138,
                  fontWeight: 700,
                  letterSpacing: `${track}em`,
                  color: PAPER,
                  transform: `rotateX(${(1 - p) * -94}deg) translateY(${(1 - p) * 50}px)`,
                  transformOrigin: "50% 100%",
                  opacity: p,
                  whiteSpace: "pre",
                  paddingBottom: "0.06em",
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 24,
            letterSpacing: `${studioTrack}em`,
            color: MINT,
            marginTop: 16,
            marginRight: `-${studioTrack}em`,
            opacity: prog(rel, 26, 52),
          }}
        >
          STUDIO
        </div>
        <div style={{ width: lerp(0, 460, prog(rel, 42, 74)), height: 1, background: "rgba(79,227,176,0.6)", marginTop: 42 }} />
        <Rise v={prog(rel, 50, 80)} style={{ marginTop: 30 }}>
          <div style={{ fontFamily: AR, fontSize: 48, fontWeight: 700, color: "rgba(244,246,250,0.82)", direction: "rtl", textAlign: "center" }}>
            استوديو وكلاء الذكاء الاصطناعي
          </div>
        </Rise>
        <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: "0.44em", color: "rgba(244,246,250,0.38)", marginTop: 26, opacity: prog(rel, 68, 96) }}>
          AGENTS THAT MAKE FILMS
        </div>
      </div>
      <Grain f={f} o={0.045} />
      <Vignette s={0.56} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ film */

export type SpotProps = { score?: string };

export const Spot: React.FC<SpotProps> = ({ score }) => {
  const f = useCurrentFrame();
  // a camera shake on every cut, decaying in six frames: an impact you feel
  // in the body before you can name it
  const last = [...CUTS].reverse().find((c) => f >= c) ?? -99;
  const d = f - last;
  const amp = d < 6 ? 9 * (1 - d / 6) ** 2 : 0;
  const shake = `translate(${Math.sin(d * 2.7) * amp}px, ${Math.cos(d * 3.9) * amp * 0.8}px) scale(${1 + amp * 0.004})`;
  return (
    <AbsoluteFill style={{ background: INK, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: shake }}>
      {f < 60 ? <Ignition f={f} /> : null}
      {f >= 60 && f < 180 ? <Swarm f={f} /> : null}
      {f >= 180 && f < 300 ? <System f={f} /> : null}
      {f >= 300 && f < 420 ? <Pipeline f={f} /> : null}
      {f >= 420 && f < 540 ? <Decision f={f} /> : null}
      {f >= 540 && f < 600 ? <Build f={f} /> : null}
      {f >= 600 && f < 780 ? <Product f={f} /> : null}
      {f >= 780 && f < 960 ? <Drop f={f} /> : null}
      {f >= 960 ? <Signature f={f} /> : null}
      </AbsoluteFill>

      <Whip f={f} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: "linear-gradient(180deg, rgba(0,0,0,0.34) 0%, transparent 13%, transparent 87%, rgba(0,0,0,0.4) 100%)",
        }}
      />
      {score && score.length > 32 ? <Audio src={score} /> : null}
    </AbsoluteFill>
  );
};
