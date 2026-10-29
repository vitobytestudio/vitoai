/**
 * WORLD — the studio builds its places out of code.
 *
 * There is no image model in this path and there never needed to be. A city is
 * not a photo: it is a skyline function, a parallax constant, a window grid and
 * a warm light. Built this way a place can be *any* place, at any hour, from any
 * angle, and it costs nothing to render a second version.
 *
 * Everything here is deterministic: same seed → same city, forever. Change the
 * seed and the whole street is rebuilt — different massing, different lit
 * windows, different traffic.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { MONO, DISP, rgba, clamp, mix } from "./kit";

/* ------------------------------------------------------------------ random */

/** mulberry32 — small, fast, deterministic. The studio's whole variety rests on it. */
export const rng = (seed: number) => {
  let a = (seed | 0) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pick = <T,>(r: () => number, xs: T[]): T => xs[Math.floor(r() * xs.length) % xs.length];

/* ----------------------------------------------------------------- worlds */

export type WorldKind = "skyline" | "haussmann" | "street" | "mall" | "showroom" | "plan";

export type Mood = {
  sky: [string, string];
  far: string;
  mid: string;
  near: string;
  warm: string;
  ground: string;
  haze: string;
};

/**
 * Six moods. Each is a complete lighting setup, not a filter: the far buildings
 * are lighter than the near ones because of atmospheric perspective, and the
 * windows are warm because interior light always is.
 */
export const MOODS: Record<string, Mood> = {
  night: { sky: ["#0A1220", "#16283F"], far: "#2A3D5C", mid: "#1A2A40", near: "#0E1725", warm: "#FFD08A", ground: "#0A111A", haze: "#33507A" },
  dusk: { sky: ["#3B2657", "#8E4F63"], far: "#6A4A78", mid: "#432E50", near: "#261A32", warm: "#FFC48F", ground: "#1B1224", haze: "#B0737F" },
  neon: { sky: ["#080E22", "#1D2A5C"], far: "#2C4384", mid: "#1A2350", near: "#0B0F26", warm: "#7CF6FF", ground: "#080B18", haze: "#3E68C8" },
  dawn: { sky: ["#2A4166", "#E0A07A"], far: "#5A6A86", mid: "#35465F", near: "#1E2A3C", warm: "#FFE3B8", ground: "#141C28", haze: "#D2A189" },
  overcast: { sky: ["#3A4450", "#6E7C8B"], far: "#5E6A76", mid: "#424C57", near: "#272E36", warm: "#F6E9D2", ground: "#1C2229", haze: "#8A96A4" },
  interior: { sky: ["#111823", "#1D2836"], far: "#33455C", mid: "#22303F", near: "#131C27", warm: "#FFE7C4", ground: "#0C121A", haze: "#3A4E68" },
};

export type World = {
  kind: WorldKind;
  mood: keyof typeof MOODS;
  accent: string;
  seed: number;
  /** 0..1 camera travel across the shot */
  p: number;
  /** 0..1, how busy the place is */
  density: number;
};

/* ------------------------------------------------------------------ shared */

const Sky: React.FC<{ mood: Mood; p: number }> = ({ mood, p }) => (
  <>
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${mood.sky[0]} 0%, ${mood.sky[1]} 58%, ${mood.ground} 100%)` }} />
    {/* atmospheric haze hugs the horizon, which is what makes distance read */}
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, rgba(0,0,0,0) 42%, ${rgba(mood.haze, 0.3)} 74%, ${rgba(mood.haze, 0.1)} 92%, rgba(0,0,0,0) 100%)`,
        transform: `translateY(${(p - 0.5) * 8}px)`,
      }}
    />
  </>
);

/* --------------------------------------------------------------- 01 skyline */

const Skyline: React.FC<{ w: World }> = ({ w }) => {
  const m = MOODS[w.mood];
  const r = rng(w.seed);

  /* three ranks, each further back and lighter: atmospheric perspective */
  const ranks = [
    { base: 1560, tall: 760, fill: m.far, lit: 0.3, wmin: 70, wmax: 130, drift: 4, step: 0.66 },
    { base: 1720, tall: 1000, fill: m.mid, lit: 0.42, wmin: 96, wmax: 170, drift: 12, step: 0.7 },
    { base: 1900, tall: 1180, fill: m.near, lit: 0.5, wmin: 130, wmax: 220, drift: 24, step: 0.74 },
  ];

  /* a skyline is a wall of buildings, not a scatter: march them across the frame
     and let the widths overlap, so there is never a gap of empty sky at the base */
  const buildings = ranks.map((R) => {
    const out: Array<{ width: number; height: number; left: number; lit: number; crown: boolean; cool: boolean }> = [];
    let x = -90;
    while (x < 1180) {
      const width = R.wmin + r() * (R.wmax - R.wmin);
      out.push({
        width,
        height: R.tall * (0.42 + r() * 0.58),
        left: x,
        lit: r() < R.lit ? 0.8 : 0.22,
        crown: r() > 0.76,
        cool: r() > 0.6,
      });
      x += width * R.step;
    }
    return out;
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Sky mood={m} p={w.p} />

      {/* moon: one soft disc, never a graphic */}
      <div
        style={{
          position: "absolute",
          left: 740 - w.p * 24,
          top: 268,
          width: 104,
          height: 104,
          borderRadius: 999,
          background: rgba(m.warm, 0.92),
          filter: "blur(2px)",
          boxShadow: `0 0 160px 58px ${rgba(m.warm, 0.18)}`,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1040,
          height: 620,
          background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, ${rgba(m.haze, 0.42)} 46%, ${rgba(m.warm, 0.12)} 74%, rgba(0,0,0,0) 100%)`,
          filter: "blur(22px)",
        }}
      />

      {ranks.map((R, li) => (
        <div
          key={li}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            transform: `translateX(${-R.drift * w.p}px)`,
          }}
        >
          {buildings[li].map((b, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: b.left,
                top: R.base - b.height,
                width: b.width,
                height: b.height,
                background: `linear-gradient(180deg, ${mix(R.fill, "#FFFFFF", 0.06)}, ${R.fill} 40%, ${mix(R.fill, "#000000", 0.35)})`,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              {/* windows as a texture, plus a few bright ones that read at thumbnail size */}
              <div
                style={{
                  position: "absolute",
                  inset: 8,
                  backgroundImage: `radial-gradient(circle at 2px 2px, ${rgba(b.cool ? "#BCE0FF" : m.warm, Math.min(0.8, b.lit * 0.7))} 2px, rgba(0,0,0,0) 2px)`,
                  backgroundSize: "15px 17px",
                  opacity: 0.72,
                }}
              />
              {Array.from({ length: Math.min(6, Math.floor(b.height / 60)) }).map((_, k) => (
                <div
                  key={k}
                  style={{
                    position: "absolute",
                    left: 6 + r() * (b.width - 24),
                    top: 10 + r() * (b.height - 26),
                    width: 8,
                    height: 10,
                    background: rgba(m.warm, 0.85),
                    boxShadow: `0 0 12px ${rgba(m.warm, 0.7)}`,
                  }}
                />
              ))}
              {b.crown ? (
                <>
                  <div style={{ position: "absolute", left: b.width * 0.42, top: -34, width: 3, height: 34, background: R.fill }} />
                  <div style={{ position: "absolute", left: b.width * 0.42 - 3, top: -40, width: 9, height: 9, borderRadius: 99, background: "#FF3B30", boxShadow: "0 0 16px rgba(255,59,48,0.9)", opacity: 0.5 + 0.5 * Math.abs(Math.sin(w.p * 9)) }} />
                </>
              ) : null}
            </div>
          ))}
        </div>
      ))}

      {/* foreground: a roof edge close to the lens, so the frame has depth */}
      <div style={{ position: "absolute", left: -60, right: -140, bottom: 0, height: 210, background: mix(m.near, "#000000", 0.55), transform: `translateY(${30 - w.p * 24}px)` }} />
      <div style={{ position: "absolute", left: -60, right: -140, bottom: 210, height: 8, background: rgba(m.warm, 0.22), filter: "blur(5px)", transform: `translateY(${30 - w.p * 24}px)` }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------- 02 haussmann */

const Haussmann: React.FC<{ w: World }> = ({ w }) => {
  const m = MOODS[w.mood];
  const r = rng(w.seed);
  const stone = mix("#6B5D4C", "#9A8A73", w.mood === "dawn" ? 0.72 : 0.42);
  const floors = 4;
  const perFloor = 4;
  const floorH = 300;
  const top = 560 - (w.p - 0.5) * 46;
  const winW = 168;
  const gap = 96;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Sky mood={m} p={w.p} />

      {/* facade block, seen from across the street: it must fill the frame */}
      <div
        style={{
          position: "absolute",
          left: -60,
          right: -60,
          top,
          bottom: -80,
          background: `linear-gradient(180deg, ${mix(stone, "#000", 0.1)}, ${stone} 26%, ${mix(stone, "#000", 0.42)} 100%)`,
          transform: `scale(${1 + w.p * 0.03})`,
        }}
      />

      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, transform: `translateY(${(w.p - 0.5) * -18}px)` }}>
        {/* mansard roof: the single silhouette that says Paris */}
        <polygon points={`-60,${top + 30} 1140,${top + 30} 1140,${top - 110} 820,${top - 110} 748,${top - 232} 292,${top - 232} 220,${top - 110} -60,${top - 110}`} fill={mix(stone, "#0A0D12", 0.62)} />
        <polyline points={`-60,${top - 108} 1140,${top - 108}`} stroke="rgba(255,240,215,0.28)" strokeWidth={3} fill="none" />
        {/* zinc roof texture */}
        {Array.from({ length: 34 }).map((_, i) => (
          <line key={i} x1={-60 + i * 36} y1={top - 104} x2={-60 + i * 36} y2={top + 26} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
        ))}
        {/* dormers */}
        {Array.from({ length: 5 }).map((_, i) => (
          <g key={i}>
            <rect x={120 + i * 200} y={top - 82} width={92} height={82} rx={18} fill="#0E141C" stroke={rgba(m.warm, 0.25)} strokeWidth={2} />
            <rect x={128 + i * 200} y={top - 74} width={76} height={66} rx={12} fill={r() > 0.42 ? rgba(m.warm, 0.66) : "#16222E"} />
          </g>
        ))}

        {Array.from({ length: floors }).map((_, row) =>
          Array.from({ length: perFloor }).map((__, col) => {
            const x = 96 + col * (winW + gap) + row * 12;
            const y = top + 86 + row * floorH;
            const lit = r() > 0.44;
            return (
              <g key={`${row}-${col}`}>
                {/* stone surround, two tones so the reveal reads as depth */}
                <rect x={x - 12} y={y - 12} width={winW + 24} height={260} fill={mix(stone, "#FFF", 0.05)} />
                <rect x={x} y={y} width={winW} height={236} fill={lit ? rgba(m.warm, 0.9) : "#101B26"} />
                <rect x={x} y={y} width={winW} height={236} fill={`url(#glass)`} />
                {/* curtains: a lit window is never flat */}
                {lit ? (
                  <>
                    <rect x={x} y={y} width={winW * 0.24} height={236} fill={rgba(m.warm, 0.2)} />
                    <rect x={x + winW * 0.76} y={y} width={winW * 0.24} height={236} fill={rgba(m.warm, 0.2)} />
                  </>
                ) : null}
                {/* glazing bars */}
                <line x1={x + winW / 2} y1={y} x2={x + winW / 2} y2={y + 236} stroke="rgba(0,0,0,0.45)" strokeWidth={4} />
                <line x1={x} y1={y + 120} x2={x + winW} y2={y + 120} stroke="rgba(0,0,0,0.45)" strokeWidth={4} />
                {/* iron balcony */}
                <rect x={x - 26} y={y + 190} width={winW + 52} height={6} fill="#0A0D10" />
                {Array.from({ length: 14 }).map((___, b) => (
                  <line key={b} x1={x - 22 + b * 15} y1={y + 196} x2={x - 22 + b * 15} y2={y + 244} stroke="#0A0D10" strokeWidth={3} />
                ))}
                <rect x={x - 26} y={y + 240} width={winW + 52} height={5} fill="#0A0D10" />
              </g>
            );
          }),
        )}

        <defs>
          <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.16)" />
            <stop offset="46%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
          </linearGradient>
        </defs>
        {/* string course between floors */}
        {Array.from({ length: floors }).map((_, row) => (
          <rect key={row} x={-60} y={top + 62 + row * floorH} width={1200} height={10} fill={mix(stone, "#FFF", 0.08)} opacity={0.5} />
        ))}
      </svg>

      {/* street lamp: the warm anchor in the lower third */}
      <div
        style={{
          position: "absolute",
          left: 120,
          bottom: 150,
          width: 14,
          height: 420,
          background: "#080B0F",
          borderRadius: 6,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 74,
          bottom: 546,
          width: 108,
          height: 54,
          borderRadius: 8,
          background: m.warm,
          filter: "blur(1px)",
          boxShadow: `0 0 140px 60px ${rgba(m.warm, 0.26)}`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 30% at 12% 74%, ${rgba(m.warm, 0.24)}, rgba(0,0,0,0) 70%)`,
          mixBlendMode: "screen",
        }}
      />
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------------- 03 street */

const Street: React.FC<{ w: World }> = ({ w }) => {
  const m = MOODS[w.mood];
  const r = rng(w.seed);
  const vx = 512 + (w.seed % 5) * 18;
  const vy = 830;
  const lamps = [0.1, 0.34, 0.62, 0.86];

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Sky mood={m} p={w.p} />

      {/* the horizon glow is what sells a city at night: light bouncing off haze */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: vy - 240,
          height: 480,
          background: `radial-gradient(ellipse 52% 50% at 50% 66%, ${rgba(m.warm, 0.34)}, ${rgba(m.haze, 0.16)} 46%, rgba(0,0,0,0) 72%)`,
          filter: "blur(18px)",
        }}
      />

      {/* buildings on both sides, closer to the camera the darker they get */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {[-1, 1].map((side) => (
          <g key={side}>
            {[0, 1, 2].map((depth) => {
              const near = depth === 0;
              const inner = vx + side * (near ? 300 : depth === 1 ? 430 : 560);
              const outer = side < 0 ? -80 : 1160;
              const topEdge = vy - (near ? 1000 : depth === 1 ? 780 : 560) - 40;
              const fill = near ? m.near : depth === 1 ? m.mid : m.far;
              return (
                <polygon
                  key={depth}
                  points={`${outer},${-60} ${inner},${topEdge} ${inner},${vy + 40} ${outer},${1920}`}
                  fill={fill}
                  opacity={near ? 1 : 0.92}
                />
              );
            })}
            {/* window grid, projected so rows converge on the vanishing point */}
            {Array.from({ length: 9 }).map((_, row) =>
              Array.from({ length: 5 }).map((__, col) => {
                const t = (row + 1) / 10;
                const y = vy - 880 * t + 90;
                const x = vx + side * (300 + col * 96 * (1 - t * 0.5));
                const sz = 16 + t * 26;
                const lit = r() > 0.42 + t * 0.1;
                return (
                  <rect
                    key={`${row}-${col}`}
                    x={x - (side < 0 ? sz : 0)}
                    y={y}
                    width={sz * 0.8}
                    height={sz}
                    fill={lit ? rgba(m.warm, 0.55 + t * 0.3) : "rgba(120,170,225,0.1)"}
                  />
                );
              }),
            )}
            {/* street lamps: a line of warm beads receding */}
            {lamps.map((t, i) => (
              <g key={i}>
                <rect x={vx + side * (250 + t * 120) - 2} y={vy - 400 * (1 - t) + 40} width={3} height={400 * (1 - t) * 0.9} fill="#080C12" opacity={0.8} />
                <circle cx={vx + side * (250 + t * 120)} cy={vy - 400 * (1 - t) + 40} r={7 + t * 9} fill={m.warm} opacity={0.85} />
              </g>
            ))}
          </g>
        ))}

        {/* road */}
        <polygon points={`${vx - 46},${vy} ${vx + 46},${vy} 1420,1920 -340,1920`} fill={mix(m.ground, "#000", 0.05)} />
        <polygon points={`${vx - 46},${vy} ${vx + 46},${vy} 1420,1920 -340,1920`} fill="url(#wet2)" opacity={0.72} />
        <defs>
          <linearGradient id="wet2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={rgba(m.warm, 0.42)} />
            <stop offset="30%" stopColor={rgba(m.haze, 0.14)} />
            <stop offset="100%" stopColor="rgba(0,0,0,0.1)" />
          </linearGradient>
        </defs>

        {/* centre line: position by perspective, not by even steps */}
        {Array.from({ length: 14 }).map((_, i) => {
          const t = (i / 14 + ((w.p * 1.4) % (1 / 14))) % 1;
          const y = vy + t * t * 1090;
          const hh = 5 + t * t * 150;
          const ww = 2 + t * 26;
          return <rect key={i} x={vx - ww / 2} y={y} width={ww} height={hh} rx={ww / 2} fill="rgba(240,246,255,0.5)" />;
        })}
      </svg>

      {/* long-exposure trails: white coming at us, red going away */}
      {Array.from({ length: Math.round(7 + w.density * 9) }).map((_, i) => {
        const tt = r();
        const y = vy + tt * tt * 940;
        const len = 90 + tt * 620;
        const towards = r() > 0.45;
        const col = towards ? "#FFF3DC" : "#FF3B2F";
        const drift = (w.p * (towards ? 420 : -420) + r() * 1400) % 1400;
        const x = vx + (towards ? -1 : 1) * (40 + tt * 420) + (towards ? -drift + 300 : drift - 700);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: len,
              height: 2 + tt * 12,
              borderRadius: 99,
              background: `linear-gradient(90deg, rgba(0,0,0,0) 0%, ${col} 42%, ${col} 62%, rgba(0,0,0,0) 100%)`,
              filter: `blur(${1 + tt * 4}px)`,
              opacity: 0.3 + tt * 0.62,
              boxShadow: `0 0 ${14 + tt * 46}px ${rgba(col, 0.55)}`,
            }}
          />
        );
      })}

      {/* one car, near, throwing red onto wet asphalt */}
      <div
        style={{
          position: "absolute",
          left: 470 - w.p * 30,
          top: 1350,
          width: 250,
          height: 120,
          borderRadius: "64px 64px 12px 12px",
          background: "linear-gradient(180deg, #2A3646, #070B12)",
          boxShadow: "0 30px 70px rgba(0,0,0,0.8)",
        }}
      >
        <div style={{ position: "absolute", left: 28, top: 14, width: 194, height: 56, borderRadius: "36px 36px 5px 5px", background: `linear-gradient(180deg, ${rgba(m.haze, 0.5)}, rgba(8,14,22,0.95))` }} />
        <div style={{ position: "absolute", left: 14, top: 78, width: 70, height: 20, borderRadius: 7, background: "#FF3B30", boxShadow: "0 0 46px 14px rgba(255,59,48,0.6)" }} />
        <div style={{ position: "absolute", right: 14, top: 78, width: 70, height: 20, borderRadius: 7, background: "#FF3B30", boxShadow: "0 0 46px 14px rgba(255,59,48,0.6)" }} />
      </div>
      <div style={{ position: "absolute", left: 430, top: 1466, width: 330, height: 190, background: "linear-gradient(180deg, rgba(255,59,48,0.26), rgba(0,0,0,0))", filter: "blur(12px)" }} />
    </AbsoluteFill>
  );
};


/* ------------------------------------------------------------ 03 city above */

/**
 * A street shot is a hard sell in perspective maths; a city seen from above is
 * not. Blocks, roads, roofs and traffic are all rectangles on a grid, so the
 * place can be rebuilt at any density and still read as a real city — and the
 * traffic moving along the avenues is the whole reason the shot breathes.
 */
const Aerial: React.FC<{ w: World }> = ({ w }) => {
  const m = MOODS[w.mood];
  const r = rng(w.seed);
  const COLS = 7;
  const ROWS = 11;
  const CW = 1080 / COLS;
  const RH = 1920 / ROWS;
  const gapX = 26;
  const gapY = 30;
  const zoom = 1 + w.p * 0.09;

  const blocks = Array.from({ length: ROWS }).map((_, row) =>
    Array.from({ length: COLS }).map((__, col) => {
      const q = r();
      return {
        row,
        col,
        park: q > 0.86,
        plaza: q > 0.8 && q <= 0.86,
        towers: 1 + Math.floor(r() * 3),
        hue: r(),
      };
    }),
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: mix(m.ground, "#000", 0.35) }}>
      <AbsoluteFill
        style={{
          transform: `scale(${zoom}) translate(${(w.p - 0.5) * -22}px, ${(w.p - 0.5) * -34}px)`,
          transformOrigin: "50% 50%",
        }}
      >
        {/* asphalt field */}
        <AbsoluteFill style={{ background: `linear-gradient(160deg, ${mix(m.near, "#000", 0.2)}, ${mix(m.ground, "#000", 0.45)})` }} />

        {blocks.map((line) =>
          line.map((b) => {
            const x = b.col * CW + gapX / 2;
            const y = b.row * RH + gapY / 2;
            const w = CW - gapX;
            const h = RH - gapY;

            if (b.park) {
              return (
                <div key={`${b.row}-${b.col}`} style={{ position: "absolute", left: x, top: y, width: w, height: h, background: `linear-gradient(160deg, ${rgba("#2F6B4F", 0.55)}, ${rgba("#16342A", 0.8)})`, borderRadius: 4 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} style={{ position: "absolute", left: 6 + r() * (w - 18), top: 6 + r() * (h - 18), width: 10 + r() * 8, height: 10 + r() * 8, borderRadius: 99, background: rgba("#5FA57A", 0.5) }} />
                  ))}
                </div>
              );
            }
            if (b.plaza) {
              return <div key={`${b.row}-${b.col}`} style={{ position: "absolute", left: x, top: y, width: w, height: h, background: rgba(m.warm, 0.1), borderRadius: 4, boxShadow: `inset 0 0 30px ${rgba(m.warm, 0.14)}` }} />;
            }
            return (
              <div key={`${b.row}-${b.col}`} style={{ position: "absolute", left: x, top: y, width: w, height: h }}>
                {Array.from({ length: b.towers }).map((_, k) => {
                  const tw = (w / b.towers) * (0.7 + r() * 0.28);
                  const th = h * (0.55 + r() * 0.42);
                  const tx = k * (w / b.towers) + r() * 8;
                  const ty = h - th;
                  return (
                    <div
                      key={k}
                      style={{
                        position: "absolute",
                        left: tx,
                        top: ty,
                        width: tw,
                        height: th,
                        background: `linear-gradient(155deg, ${mix(m.mid, "#000", 0.1 + b.hue * 0.25)}, ${mix(m.near, "#000", 0.35)})`,
                        borderRadius: 3,
                        boxShadow: `0 6px 18px rgba(0,0,0,0.6), inset 0 1px 0 ${rgba(m.warm, 0.14)}`,
                      }}
                    >
                      {/* roof detail: plant, parapet, a lit stair head */}
                      <div style={{ position: "absolute", left: 3, top: 3, right: 3, height: 1, background: "rgba(255,255,255,0.07)" }} />
                      {r() > 0.55 ? <div style={{ position: "absolute", left: 4 + r() * (tw - 12), top: 4 + r() * 8, width: 6, height: 6, background: rgba(m.warm, 0.62) }} /> : null}
                      {/* a setback: the roof of a lower volume, which is what a real block looks like from above */}
                      {th > h * 0.72 ? (
                        <div style={{ position: "absolute", left: tw * 0.3, top: th * 0.34, width: tw * 0.5, height: th * 0.3, background: mix(m.mid, "#FFFFFF", 0.06), borderRadius: 2, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.35)" }} />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          }),
        )}

        {/* avenues: lit from above, so they are brighter than the roofs around them */}
        {Array.from({ length: COLS + 1 }).map((_, i) => (
          <div key={`v${i}`} style={{ position: "absolute", left: i * CW - gapX / 2, top: 0, width: gapX, height: 1920, background: `linear-gradient(90deg, rgba(0,0,0,0.25), ${rgba(m.haze, 0.3)}, ${rgba(m.warm, 0.16)}, ${rgba(m.haze, 0.3)}, rgba(0,0,0,0.25))` }}>
            <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 2, marginLeft: -1, background: `repeating-linear-gradient(180deg, ${rgba(m.warm, 0.5)} 0 18px, rgba(0,0,0,0) 18px 46px)`, opacity: 0.5 }} />
          </div>
        ))}
        {Array.from({ length: ROWS + 1 }).map((_, i) => (
          <div key={`h${i}`} style={{ position: "absolute", left: 0, top: i * RH - gapY / 2, width: 1080, height: gapY, background: `linear-gradient(180deg, rgba(0,0,0,0.25), ${rgba(m.haze, 0.3)}, ${rgba(m.warm, 0.16)}, ${rgba(m.haze, 0.3)}, rgba(0,0,0,0.25))` }}>
            <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 2, marginTop: -1, background: `repeating-linear-gradient(90deg, ${rgba(m.warm, 0.5)} 0 18px, rgba(0,0,0,0) 18px 46px)`, opacity: 0.45 }} />
          </div>
        ))}

        {/* street lamps: a bead of warm light every junction, which is what makes an aerial read as inhabited */}
        {blocks.map((line) =>
          line.map((b) => (
            <div
              key={`l${b.row}-${b.col}`}
              style={{
                position: "absolute",
                left: b.col * CW - gapX / 2 - 10,
                top: b.row * RH - gapY / 2 - 10,
                width: 20,
                height: 20,
                borderRadius: 99,
                background: rgba(m.warm, 0.5),
                boxShadow: `0 0 34px 10px ${rgba(m.warm, 0.22)}`,
              }}
            />
          )),
        )}

        {/* traffic: light moving down the avenues is the whole point of this shot */}
        {Array.from({ length: Math.round(26 + w.density * 26) }).map((_, i) => {
          const vertical = r() > 0.45;
          const lane = Math.floor(r() * (vertical ? COLS + 1 : ROWS + 1));
          const speed = 0.5 + r() * 1.6;
          const travel = ((r() + w.p * speed) % 1);
          const pos = travel * 1920;
          const head = r() > 0.4;
          const len = 26 + r() * 54;
          const col = head ? "#FFF1D6" : "#FF4433";
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: vertical ? lane * CW - 4 : pos,
                top: vertical ? pos : lane * RH - 3,
                width: vertical ? 3 : len,
                height: vertical ? len : 3,
                borderRadius: 99,
                background: `linear-gradient(${vertical ? "180deg" : "90deg"}, rgba(0,0,0,0), ${col}, rgba(0,0,0,0))`,
                filter: "blur(1.4px)",
                opacity: 0.75 + r() * 0.25,
                boxShadow: `0 0 12px ${rgba(col, 0.6)}`,
              }}
            />
          );
        })}

        {/* intersections bloom */}
        {Array.from({ length: 10 }).map((_, i) => {
          const cx = Math.floor(r() * (COLS + 1)) * CW;
          const cy = Math.floor(r() * (ROWS + 1)) * RH;
          return <div key={i} style={{ position: "absolute", left: cx - 60, top: cy - 60, width: 120, height: 120, background: `radial-gradient(circle, ${rgba(m.warm, 0.18)}, rgba(0,0,0,0) 70%)`, pointerEvents: "none" }} />;
        })}
      </AbsoluteFill>

      {/* a single warm wash from one side, so the frame is lit and not flat */}
      <AbsoluteFill style={{ background: `linear-gradient(120deg, ${rgba(m.warm, 0.08)}, rgba(0,0,0,0) 46%, ${rgba(m.haze, 0.1)})`, mixBlendMode: "screen" }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 04 mall */

const Mall: React.FC<{ w: World }> = ({ w }) => {
  const m = MOODS.interior;
  const r = rng(w.seed);
  const shops = 4;

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: `linear-gradient(180deg, #121A25, #080D14)` }}>
      {/* glass barrel roof, backlit: the ceiling is the light source */}
      <div
        style={{
          position: "absolute",
          left: -80,
          right: -80,
          top: -160,
          height: 620,
          background: `radial-gradient(ellipse 80% 100% at 50% 0%, ${rgba(m.warm, 0.4)}, ${rgba(m.haze, 0.2)} 46%, rgba(0,0,0,0) 76%)`,
        }}
      />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {/* ribs of the roof, converging so the ceiling has curvature */}
        {Array.from({ length: 13 }).map((_, i) => {
          const x = 540 + (i - 6) * 92;
          const bend = 540 + (i - 6) * 108;
          return <path key={i} d={`M${x},-40 Q${bend},200 ${x + (i - 6) * 10},500`} stroke="rgba(255,232,198,0.28)" strokeWidth={2} fill="none" />;
        })}
        {Array.from({ length: 5 }).map((_, i) => (
          <path key={`r${i}`} d={`M-60,${i * 96} Q540,${i * 96 + 54} 1140,${i * 96}`} stroke="rgba(255,232,198,0.18)" strokeWidth={2} fill="none" />
        ))}
        {/* the beam across the atrium */}
        <rect x={0} y={500} width={1080} height={18} fill="#0C1420" />
        <rect x={0} y={500} width={1080} height={2} fill={rgba(m.warm, 0.55)} />
      </svg>

      {/* the opposite wall: balconies of the upper level */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ position: "absolute", left: 0, right: 0, top: 520 + i * 148, height: 12, background: "rgba(255,255,255,0.07)", borderTop: "2px solid rgba(255,232,198,0.18)" }} />
      ))}

      {/* storefronts, floor level: glass, light inside, an awning over each */}
      {Array.from({ length: shops }).map((_, i) => {
        const x = 26 + i * 262;
        const accent = pick(r, [w.accent, "#FFC876", "#7FD1FF", "#FF6B8A", "#B9FF6B"]);
        const h = 520;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: 1240 - h, width: 250, height: h }}>
            <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: 7, background: rgba(accent, 0.85), boxShadow: `0 0 40px 8px ${rgba(accent, 0.3)}` }} />
            <div style={{ position: "absolute", left: 0, top: 7, width: "100%", height: h - 7, background: `linear-gradient(180deg, ${rgba(accent, 0.2)}, rgba(8,12,18,0.86) 42%, rgba(6,9,14,0.96))`, boxShadow: "inset 0 0 60px rgba(0,0,0,0.6)" }} />
            <div style={{ position: "absolute", left: 20, top: 34, width: 96, height: 10, background: rgba(accent, 0.95) }} />
            <div style={{ position: "absolute", left: 20, top: 54, width: 138, height: 5, background: "rgba(255,255,255,0.22)" }} />
            {/* mannequins behind the glass */}
            {Array.from({ length: 3 }).map((__, k) => (
              <div key={k} style={{ position: "absolute", left: 34 + k * 66, bottom: 26, width: 34, height: 190 + r() * 40 }}>
                <div style={{ width: 22, height: 22, borderRadius: 99, background: rgba(accent, 0.5), margin: "0 auto" }} />
                <div style={{ width: 34, height: 150, borderRadius: "12px 12px 3px 3px", background: `linear-gradient(180deg, ${rgba(accent, 0.42)}, ${rgba(accent, 0.12)})` }} />
              </div>
            ))}
          </div>
        );
      })}

      {/* escalator, the diagonal that proves it is architecture */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: 0.9 }}>
        <polygon points="620,1240 1010,1240 1080,600 910,600" fill="rgba(255,255,255,0.05)" stroke="rgba(255,232,198,0.3)" strokeWidth={3} />
        {Array.from({ length: 18 }).map((_, i) => {
          const t = i / 18;
          const y = 1240 - t * 632;
          const x1 = 620 + t * 300;
          const x2 = 1010 + t * 70;
          return <line key={i} x1={x1} y1={y} x2={x2} y2={y - 2} stroke="rgba(255,232,198,0.2)" strokeWidth={2} />;
        })}
      </svg>

      {/* polished floor */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1240, bottom: 0, background: "linear-gradient(180deg, rgba(30,42,58,0.95), #06090E)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 1240, height: 3, background: rgba(m.warm, 0.55), boxShadow: `0 0 70px 16px ${rgba(m.warm, 0.22)}` }} />
      {Array.from({ length: shops }).map((_, i) => (
        <div key={i} style={{ position: "absolute", left: 18 + i * 268, top: 1250, width: 240, height: 170, background: `linear-gradient(180deg, ${rgba(w.accent, 0.12)}, rgba(0,0,0,0))`, filter: "blur(10px)" }} />
      ))}

      {/* people, crossing */}
      {Array.from({ length: Math.round(5 + w.density * 9) }).map((_, i) => {
        const t = r();
        const scale = 0.45 + t * 0.85;
        const drift = ((w.p * 140 + r() * 1200) % 1260) - 90;
        return (
          <div key={i} style={{ position: "absolute", left: drift, top: 1240 - 190 * scale, width: 44 * scale, height: 176 * scale }}>
            <div style={{ width: 32 * scale, height: 32 * scale, borderRadius: 99, background: "#05080D", margin: "0 auto" }} />
            <div style={{ width: 44 * scale, height: 140 * scale, borderRadius: `${16 * scale}px ${16 * scale}px 4px 4px`, background: "#05080D" }} />
          </div>
        );
      })}

      <AbsoluteFill style={{ background: `radial-gradient(ellipse 72% 44% at 50% 22%, ${rgba(m.warm, 0.14)}, rgba(0,0,0,0) 68%)`, mixBlendMode: "screen" }} />
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------- 05 showroom */

const Showroom: React.FC<{ w: World }> = ({ w }) => {
  const r = rng(w.seed);
  const racks = 3;
  const hues = [w.accent, mix(w.accent, "#FFFFFF", 0.35), mix(w.accent, "#000000", 0.4), "#E8E2D6", "#2A3340"];

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "linear-gradient(180deg, #0A0F16, #05080D 62%, #03060A)" }}>
      {/* back wall with a light pool */}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 52% 40% at 50% 30%, ${rgba(w.accent, 0.2)}, rgba(0,0,0,0) 68%)` }} />

      {/* spotlights: cones, not circles */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <polygon key={i} points={`${180 + i * 240},0 ${80 + i * 240},1290 ${380 + i * 240},1290`} fill={`url(#cone${i})`} />
        ))}
        <defs>
          {Array.from({ length: 4 }).map((_, i) => (
            <linearGradient key={i} id={`cone${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,240,215,0.18)" />
              <stop offset="100%" stopColor="rgba(255,240,215,0)" />
            </linearGradient>
          ))}
        </defs>
      </svg>

      {/* garment rail: the silhouette of a clothing store */}
      {Array.from({ length: racks }).map((_, k) => {
        const y = 520 + k * 300;
        return (
          <g key={k}>
            <div style={{ position: "absolute", left: 90, right: 90, top: y, height: 4, background: "rgba(200,215,235,0.35)", borderRadius: 2 }} />
            {Array.from({ length: 16 }).map((_, i) => {
              const hh = 150 + r() * 130;
              const c = pick(r, hues);
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: 104 + i * 54,
                    top: y + 4,
                    width: 34 + r() * 12,
                    height: hh,
                    borderRadius: `${16 + r() * 8}px ${16 + r() * 8}px 6px 6px`,
                    background: `linear-gradient(180deg, ${rgba(c, 0.95)}, ${rgba(c, 0.66)} 62%, ${rgba(c, 0.42)})`,
                    boxShadow: "0 14px 26px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)",
                  }}
                />
              );
            })}
          </g>
        );
      })}

      {/* floor reflection */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1290, bottom: 0, background: "linear-gradient(180deg, rgba(18,25,35,0.95), #04070B)" }} />
      <div style={{ position: "absolute", left: 90, right: 90, top: 1290, height: 240, background: `linear-gradient(180deg, ${rgba(w.accent, 0.16)}, rgba(0,0,0,0))`, filter: "blur(14px)", transform: `scaleY(${1 + w.p * 0.1})` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 1290, height: 1, background: "rgba(200,220,255,0.22)" }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 06 plan */

const Plan: React.FC<{ w: World }> = ({ w }) => {
  const r = rng(w.seed);
  const paper = "#0A1B30";
  const line = rgba("#A8D4FF", 0.82);

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: paper }}>
      {/* drafting grid */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${rgba("#8FC4FF", 0.14)} 1px, transparent 1px), linear-gradient(90deg, ${rgba("#8FC4FF", 0.14)} 1px, transparent 1px)`,
          backgroundSize: "36px 36px",
          transform: `translate(${(w.p - 0.5) * -30}px, ${(w.p - 0.5) * -18}px)`,
        }}
      />

      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {/* the building footprint: two wings and a court */}
        <g transform={`translate(0 ${(w.p - 0.5) * -40})`} stroke={line} fill="none">
          <rect x={120} y={420} width={840} height={300} strokeWidth={3} />
          <rect x={120} y={780} width={300} height={420} strokeWidth={3} />
          <rect x={660} y={780} width={300} height={420} strokeWidth={3} />
          <rect x={480} y={780} width={120} height={420} strokeWidth={1.5} strokeDasharray="8 8" />
          <rect x={168} y={468} width={744} height={204} strokeWidth={1} opacity={0.5} />
          {/* core */}
          <rect x={470} y={510} width={140} height={120} fill={rgba(w.accent, 0.16)} stroke={rgba(w.accent, 0.8)} strokeWidth={2} />
          {/* column field */}
          {Array.from({ length: 7 }).map((_, i) =>
            Array.from({ length: 4 }).map((__, j) => (
              <circle key={`${i}-${j}`} cx={150 + i * 128} cy={830 + j * 92} r={4} fill={rgba("#8FC4FF", 0.55)} stroke="none" />
            )),
          )}
          {/* dimension lines */}
          <line x1={120} y1={380} x2={960} y2={380} strokeWidth={1} />
          <line x1={120} y1={368} x2={120} y2={392} strokeWidth={1} />
          <line x1={960} y1={368} x2={960} y2={392} strokeWidth={1} />
          <line x1={60} y1={420} x2={60} y2={1200} strokeWidth={1} />
          <line x1={48} y1={420} x2={72} y2={420} strokeWidth={1} />
          <line x1={48} y1={1200} x2={72} y2={1200} strokeWidth={1} />
          {/* diagonal hatch on one wing */}
          {Array.from({ length: 22 }).map((_, i) => (
            <line key={i} x1={122 + i * 14} y1={1198} x2={122 + i * 14 + 120} y2={1078} stroke={rgba("#8FC4FF", 0.16)} strokeWidth={2} />
          ))}
        </g>

        {/* north arrow */}
        <g transform="translate(950 1620)" stroke={line} fill="none">
          <circle r={44} strokeWidth={1.5} />
          <path d="M0,-34 L12,10 L0,2 L-12,10 Z" fill={rgba("#8FC4FF", 0.8)} stroke="none" />
        </g>

        {/* scale bar */}
        <g transform="translate(120 1700)" stroke={line} fill="none">
          <line x1={0} y1={0} x2={300} y2={0} strokeWidth={2} />
          {Array.from({ length: 7 }).map((_, i) => (
            <line key={i} x1={i * 50} y1={-8} x2={i * 50} y2={8} strokeWidth={1.5} />
          ))}
        </g>

        {Array.from({ length: 3 }).map((_, i) => (
          <text key={i} x={120} y={1780 + i * 34} fontFamily={MONO} fontSize={20} letterSpacing={3} fill={rgba("#8FC4FF", 0.5)}>
            {["SECTION A-A  1:200", "GRID 8.4 x 8.4 M", "REV 03 — ISSUED FOR BUILD"][i]}
          </text>
        ))}
      </svg>

      {/* the accent marks the site, and a sweep of the scanner passes over it once */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 200 + w.p * 1300,
          height: 3,
          background: `linear-gradient(90deg, rgba(0,0,0,0), ${rgba(w.accent, 0.7)}, rgba(0,0,0,0))`,
          boxShadow: `0 0 40px 10px ${rgba(w.accent, 0.16)}`,
        }}
      />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ position: "absolute", left: 120 + r() * 800, top: 420 + r() * 900, width: 5, height: 5, background: rgba(w.accent, 0.8), borderRadius: 99 }} />
      ))}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ render */

const RENDER: Record<WorldKind, React.FC<{ w: World }>> = {
  skyline: Skyline,
  haussmann: Haussmann,
  street: Aerial,
  mall: Mall,
  showroom: Showroom,
  plan: Plan,
};

export const World: React.FC<{ spec: World }> = ({ spec }) => {
  const C = RENDER[spec.kind] || Skyline;
  return (
    <AbsoluteFill>
      <C w={spec} />
    </AbsoluteFill>
  );
};

/* --------------------------------------------------------------- choosing */

/**
 * Reading the brief to pick a place. This is the part that makes "a premium
 * design for a global client with Paris architecture" become a Haussmann
 * facade and not a skyline: the words decide the world, the seed decides which
 * version of it.
 */
const KEYWORDS: Array<[WorldKind, RegExp]> = [
  ["plan", /blueprint|floor ?plan|draft|section drawing|elevation|مخطط|مخططات/i],
  ["street", /traffic|headlight|road|motorway|highway|cars?\b|driving|سيارات|طريق|شارع/i],
  ["mall", /mall|shopping|retail|storefronts?|boutiques?|مول|متجر|محل/i],
  ["showroom", /garment|clothing|fashion|runway|closet|rack|أزياء|ملابس|مجموعة/i],
  ["haussmann", /paris|haussmann|balcon|mansard|limestone facade|باريس|عمارة/i],
  ["skyline", /skyline|towers?|downtown|urban|city|مدينة|أبراج/i],
];

export const worldFor = (text: string, seed: number, accent: string, p: number, density = 0.5): World => {
  const found = KEYWORDS.find(([, re]) => re.test(text));
  const r = rng(seed * 31 + 7);
  const kind: WorldKind = found ? found[0] : pick(r, ["skyline", "street", "showroom", "haussmann"] as WorldKind[]);
  const mood = ((): World["mood"] => {
    if (kind === "mall" || kind === "showroom") return "interior";
    if (/day|morning|sun|صباح|نهار/i.test(text)) return "dawn";
    if (/neon|cyber|tech|synth/i.test(text)) return "neon";
    if (/dusk|sunset|evening|غروب/i.test(text)) return "dusk";
    if (/overcast|rain|grey|مطر/i.test(text)) return "overcast";
    return "night";
  })();
  return { kind, mood, accent, seed: Math.floor(r() * 1e6), p, density };
};

/** a palette the design layer can share, so type and place agree */
export const paletteFor = (mood: World["mood"], accent: string) => {
  const m = MOODS[mood];
  return { ink: m.sky[0], line: rgba(accent, 0.7), warm: m.warm, haze: m.haze };
};

export const WORLDS: WorldKind[] = ["skyline", "haussmann", "street", "mall", "showroom", "plan"];
