/**
 * EDGE — a 30 s cinematic tech spot, built to a written brief.
 *
 * The brief, in its own terms:
 *   faith      black #080808, metallic greys, emerald or pure-white pinpoint
 *   reference  Linear · Stripe · Apple — restraint, not decoration
 *   sound      sub drone, real foley (keys, air, ticks), no bombast
 *   picture    macro lens on glass · whip to a split screen · 0.8 s match cuts
 *              · a wide dark office with rim light · a zoom-out to the mark
 *
 * Two cuts of the same film come out of this file:
 *   cinema      the brief, obeyed. type settles, camera moves slowly, one
 *               device per shot, nothing competes with the voiceover.
 *   technical   the same picture, cut the way a motion-graphics house would:
 *               HUD, timecode, shot counter, parallax, whip, scanlines.
 *
 * Scene boundaries are the VO sentence boundaries, so the voice and the
 * picture cannot drift apart.
 */
import React from "react";
import { AbsoluteFill, Audio, Easing, useCurrentFrame } from "remotion";

export const FPS = 30;
export const DURATION = 900; // 30 s

const W = 1080;
const H = 1920;

const INK = "#080808";
const INK2 = "#0E0F10";
const PAPER = "#F5F6F7";
const GREY = "#8B9096";
const MIST = "#22262A";
const EMERALD = "#17C98A";

const LAT = '"Space Grotesk", "Sora", sans-serif';
const MONO = '"JetBrains Mono", monospace';

export type Mode = "cinema" | "technical";
export type EdgeProps = { mode?: Mode; score?: string; voice?: string };

/* ----------------------------------------------------------------- clock */

const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const OUT = Easing.bezier(0.16, 1, 0.3, 1);
const IN = Easing.bezier(0.7, 0, 0.84, 0);
const ION = Easing.bezier(0.65, 0, 0.35, 1);
const p = (f: number, a: number, b: number, fn: (t: number) => number = OUT) => cl(fn(cl((f - a) / Math.max(1, b - a))));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** scene boundaries, in frames, from the brief */
const S1 = 0;
const S2 = 120; //  4 s
const S3 = 300; // 10 s
const S4 = 540; // 18 s
const S5 = 720; // 24 s
const END = 900;

/* --------------------------------------------------------------- textures */

const Grain: React.FC<{ f: number; o?: number }> = ({ f, o = 0.035 }) => (
  <div
    style={{
      position: "absolute",
      inset: -30,
      opacity: o,
      mixBlendMode: "overlay",
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='150' height='150' filter='url(%23n)' opacity='0.6'/></svg>\")",
      backgroundPosition: `${(f * 7) % 150}px ${(f * 11) % 150}px`,
    }}
  />
);

const Vignette: React.FC<{ s?: number }> = ({ s = 0.62 }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background: `radial-gradient(ellipse 72% 56% at 50% 48%, transparent 32%, rgba(0,0,0,${s}) 100%)`,
    }}
  />
);

/** a flat field with one soft light — the whole brief is lit this way */
const Light: React.FC<{ x?: number; y?: number; r?: number; c?: string; a?: number }> = ({ x = 50, y = 40, r = 70, c = EMERALD, a = 0.12 }) => (
  <div
    style={{
      position: "absolute",
      left: `${x}%`,
      top: `${y}%`,
      width: `${r * 2}vmax`,
      height: `${r * 2}vmax`,
      transform: "translate(-50%,-50%)",
      background: `radial-gradient(circle, ${c}${Math.round(a * 255)
        .toString(16)
        .padStart(2, "0")} 0%, transparent 62%)`,
    }}
  />
);

/** text entered on its own line, never out of a box that could cut a glyph */
const Rise: React.FC<{ v: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ v, children, style }) => (
  <span style={{ display: "block", clipPath: v >= 0.999 ? undefined : `inset(-45% -14% ${(1 - v) * 100}% -14%)`, ...style }}>
    <span style={{ display: "block", transform: `translateY(${(1 - v) * 22}%)` }}>{children}</span>
  </span>
);

/* ------------------------------------------------------- technical chrome */

const Chrome: React.FC<{ f: number; scene: number; label: string }> = ({ f, scene, label }) => {
  const tc = (n: number) => String(n).padStart(2, "0");
  const frames = f % FPS;
  const secs = Math.floor(f / FPS);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* scanlines, very faint — a broadcast artefact, not a filter */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.16,
          backgroundImage: "repeating-linear-gradient(180deg, rgba(245,246,247,0.055) 0 1px, transparent 1px 3px)",
        }}
      />
      {/* corner marks */}
      {[
        { l: 44, t: 44, r: 0 },
        { r: 44, t: 44, l: 0 },
        { l: 44, b: 44, r: 0 },
        { r: 44, b: 44, l: 0 },
      ].map((c, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: c.l,
            right: c.r,
            top: c.t,
            bottom: c.b,
            width: 26,
            height: 26,
            borderTop: i < 2 ? `1px solid ${PAPER}55` : undefined,
            borderBottom: i >= 2 ? `1px solid ${PAPER}55` : undefined,
            borderLeft: i % 2 === 0 ? `1px solid ${PAPER}55` : undefined,
            borderRight: i % 2 === 1 ? `1px solid ${PAPER}55` : undefined,
          }}
        />
      ))}
      <div style={{ position: "absolute", left: 92, top: 86, fontFamily: MONO, fontSize: 13, letterSpacing: "0.28em", color: `${PAPER}66` }}>
        SYS · {label}
      </div>
      <div style={{ position: "absolute", right: 92, top: 86, fontFamily: MONO, fontSize: 13, letterSpacing: "0.22em", color: `${EMERALD}CC` }}>
        00:{tc(secs)}:{tc(frames)}
      </div>
      <div style={{ position: "absolute", left: 92, right: 92, bottom: 88 }}>
        <div style={{ height: 1, background: `${PAPER}1F` }}>
          <div style={{ height: 1, width: `${(f / DURATION) * 100}%`, background: EMERALD }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontFamily: MONO, fontSize: 11, letterSpacing: "0.3em", color: `${PAPER}44` }}>
          <span>REC {String(scene).padStart(2, "0")}/05</span>
          <span>ISO 800 · 1/48 · T1.4</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ scene 1 */

const CODE = [
  "const edge = await deploy({ region: 'fra1' })",
  "if (requests < threshold) return sleep(0)",
  "billing.on('invoice.due', autopilot)",
  "queue.drain({ concurrency: 12 })",
  "auth.verify(token, { ttl: 900 })",
  "cache.warm(routes.map(r => r.path))",
  "metrics.flush({ every: '10s' })",
  "return edge.serve({ cold: false })",
];

const Scene1: React.FC<{ f: number; mode: Mode }> = ({ f, mode }) => {
  const flash = f < 15 ? 0 : Math.exp(-(f - 15) * 0.35);
  const zoom = mode === "technical" ? lerp(1.06, 1, p(f, 15, 120, ION)) : lerp(1.03, 1, p(f, 15, 120, ION));
  const words = ["€10,000", "WASTED."];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* the macro lens: a glass plane at a slight angle, code breathing behind it */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          perspective: 1200,
          opacity: p(f, 12, 26),
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -120,
            transform: `rotateX(${mode === "technical" ? 12 : 8}deg) rotateZ(-2deg) scale(${zoom})`,
            filter: "blur(0.4px)",
          }}
        >
          {CODE.map((line, i) => {
            const y = 300 + i * 92;
            const breathe = 0.22 + 0.12 * Math.sin(f * 0.06 + i);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: 60,
                  top: y,
                  fontFamily: MONO,
                  fontSize: 26,
                  letterSpacing: "0.02em",
                  color: `${PAPER}`,
                  opacity: breathe * (i === 3 ? 1 : 0.75),
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ color: `${EMERALD}AA` }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ color: `${GREY}` }}>  </span>
                {line}
              </div>
            );
          })}
          {/* a specular streak travelling across the glass */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: lerp(200, 1500, p(f, 15, 120, ION)),
              height: 180,
              background: `linear-gradient(180deg, transparent, ${PAPER}12, transparent)`,
            }}
          />
        </div>
      </div>

      <AbsoluteFill style={{ background: `linear-gradient(180deg, #000000F2 0%, #00000055 26%, ${INK}CC 56%, ${INK} 78%, #000000 100%)` }} />

      {/* the hook */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          {words.map((w2, i) => {
            const v = p(f, 34 + i * 9, 52 + i * 9, OUT);
            return (
              <div key={i} style={{ overflow: "visible" }}>
                <span
                  style={{
                    display: "block",
                    fontFamily: LAT,
                    fontSize: i === 0 ? 128 : 132,
                    fontWeight: 700,
                    letterSpacing: "-0.045em",
                    lineHeight: 1.04,
                    color: i === 1 ? EMERALD : PAPER,
                    clipPath: v >= 0.999 ? undefined : `inset(-30% -10% ${(1 - v) * 100}% -10%)`,
                    transform: `translateY(${(1 - v) * 18}%)`,
                    paddingBottom: "0.06em",
                  }}
                >
                  {w2}
                </span>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* the white pinpoint that opens the film */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: lerp(4, 900, p(f, 15, 60, ION)),
          height: lerp(2, 2, p(f, 15, 60, ION)),
          transform: "translate(-50%,-50%)",
          background: `linear-gradient(90deg, transparent, ${PAPER}, transparent)`,
          opacity: p(f, 15, 20) * (1 - p(f, 46, 70)),
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, #FFFFFF${Math.round(flash * 200).toString(16).padStart(2, "0")} 0%, transparent 55%)` }} />
      <Light x={50} y={46} r={62} a={0.1} />
      <Vignette s={0.7} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ scene 2 */

const PANEL_T = 430;
const PANEL_H = 1300;

/** the tangle: what "traditional overhead" actually looks like */
const ComplexGraph: React.FC<{ f: number }> = ({ f }) => {
  const nodes = [...Array(13)].map((_, i) => ({
    x: 40 + rnd(i) * 420,
    y: 60 + rnd(i + 40) * (PANEL_H - 320),
  }));
  const edges: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [1, 3], [0, 4], [4, 5], [5, 6], [3, 6], [6, 7],
    [7, 8], [8, 9], [9, 10], [4, 10], [2, 9], [10, 11], [11, 12], [12, 7], [5, 12],
  ];
  return (
    <svg width={540} height={PANEL_H} style={{ position: "absolute", left: 0, top: 0 }}>
      {[...Array(7)].map((_, i) => (
        <path
          key={i}
          d={`M ${20 + i * 24} ${PANEL_H} C ${10 + i * 20} ${PANEL_H * 0.7}, ${220 + i * 8} ${PANEL_H * 0.35}, ${60 + i * 16} 40`}
          fill="none"
          stroke={MIST}
          strokeWidth={1}
        />
      ))}
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].x}
          y1={nodes[a].y}
          x2={nodes[b].x}
          y2={nodes[b].y}
          stroke={`${GREY}55`}
          strokeWidth={1}
          strokeDasharray={4}
          strokeDashoffset={-f * 0.3}
        />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={i % 4 === 0 ? 6 : 3.5} fill={`${GREY}${i % 4 === 0 ? "AA" : "55"}`} />
      ))}
    </svg>
  );
};

/** one line, top to bottom, four stops, nothing else */
const LinearFlow: React.FC<{ f: number; n?: number }> = ({ f }) => {
  const x = 270;
  const d = p(f, S2 + 4, S2 + 46, ION);
  const top = 90;
  const bot = PANEL_H - 230;
  const stops = [0, 0.34, 0.68, 1];
  return (
    <svg width={540} height={PANEL_H} style={{ position: "absolute", left: 0, top: 0 }}>
      <line x1={x} y1={top} x2={x} y2={bot} stroke={`${PAPER}18`} strokeWidth={1} />
      <line
        x1={x}
        y1={top}
        x2={x}
        y2={top + (bot - top) * d}
        stroke={EMERALD}
        strokeWidth={3}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 7px ${EMERALD})` }}
      />
      {stops.map((t, i) => {
        const on = p(f, S2 + 12 + i * 9, S2 + 26 + i * 9);
        return (
          <circle key={i} cx={x} cy={top + (bot - top) * t} r={7 * on} fill={i === 3 ? EMERALD : PAPER} opacity={on} />
        );
      })}
      <circle cx={x} cy={top + ((bot - top) * ((f * 2.4) % 100)) / 100} r={4} fill={PAPER} opacity={0.9} />
      <circle cx={x} cy={top + ((bot - top) * ((f * 2.4 + 50) % 100)) / 100} r={3} fill={PAPER} opacity={0.45} />
    </svg>
  );
};

const Scene2: React.FC<{ f: number; mode: Mode }> = ({ f, mode }) => {
  // the brief asks for a whip pan into this shot, in both cuts. It lasts
  // 7 frames in the cinema cut, 10 in the technical one — but it always
  // resolves to zero, which the first version of this file forgot to do.
  const whipIn = 1 - p(f, S2, S2 + (mode === "technical" ? 10 : 7), IN);
  const split = p(f, S2 + 4, S2 + 26, ION);
  const panelIn = p(f, S2 + 8, S2 + 34, ION);
  return (
    <AbsoluteFill
      style={{
        background: INK,
        transform: `translateX(${whipIn * (mode === "technical" ? 300 : 190)}px)`,
        filter: whipIn > 0.01 ? `blur(${whipIn * (mode === "technical" ? 26 : 16)}px)` : undefined,
      }}
    >
      <Light x={22} y={44} r={58} a={0.06} />
      <Light x={80} y={56} r={54} a={0.08} />

      {/* the statement, above the two panels — it must not sit on the proof */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 168, padding: "0 84px", textAlign: "center" }}>
        <Rise v={p(f, S2 + 20, S2 + 48)}>
          <div style={{ fontFamily: LAT, fontSize: 76, fontWeight: 700, letterSpacing: "-0.03em", color: PAPER, lineHeight: 1.14 }}>
            Complexity is not
          </div>
        </Rise>
        <Rise v={p(f, S2 + 30, S2 + 58)}>
          <div style={{ fontFamily: LAT, fontSize: 76, fontWeight: 700, letterSpacing: "-0.03em", color: EMERALD, lineHeight: 1.14 }}>
            a feature.
          </div>
        </Rise>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: PANEL_T, height: PANEL_H, opacity: panelIn }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: W / 2, height: PANEL_H }}>
          <ComplexGraph f={f} />
        </div>
        <div style={{ position: "absolute", right: 0, top: 0, width: W / 2, height: PANEL_H }}>
          <LinearFlow f={f} />
        </div>
      </div>

      {/* the divider draws itself between the two proofs */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: PANEL_T,
          height: PANEL_H,
          width: 1,
          background: `linear-gradient(180deg, transparent, ${PAPER}33, transparent)`,
          transform: `scaleY(${split})`,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 62,
          right: 62,
          top: PANEL_T + PANEL_H - 88,
          display: "flex",
          justifyContent: "space-between",
          opacity: panelIn,
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.26em", color: `${GREY}CC`, lineHeight: 1.9 }}>
          TRADITIONAL
          <br />
          OVERHEAD
        </div>
        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.26em", color: `${EMERALD}DD`, lineHeight: 1.9, textAlign: "right" }}>
          SINGLE
          <br />
          LINEAR FLOW
        </div>
      </div>

      <Vignette s={0.66} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ scene 3 */

/** the check mark, drawn — U+2713 is not in the embedded JetBrains subset and
 *  rendered as a tofu box, so the tick ships as geometry instead. */
const Check: React.FC<{ c?: string; s?: number }> = ({ c = EMERALD, s = 20 }) => (
  <svg width={s} height={s} viewBox="0 0 20 20" style={{ flex: "0 0 auto" }}>
    <path d="M3.5 10.5 L8 15 L16.5 5.5" fill="none" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const STAGE_T = 470;
const STAGE_H = 840;

const Terminal: React.FC<{ f: number }> = ({ f }) => {
  const typed = (s: string, at: number, len: number) => s.slice(0, Math.floor(p(f, at, at + len) * s.length));
  const cmd = "$ edge deploy --fra1 --env prod";
  const rows = [
    { k: "build", v: "1.9s", at: 22 },
    { k: "upload", v: "0.4s", at: 30 },
    { k: "propagate", v: "fra1 · ams1 · iad1", at: 38 },
  ];
  return (
    <div style={{ position: "absolute", left: 44, right: 44, top: STAGE_T, height: STAGE_H, display: "flex", alignItems: "center" }}>
      <div style={{ width: "100%" }}>
        <div
          style={{
            border: `1px solid ${PAPER}1A`,
            background: `linear-gradient(180deg, ${INK2}, #050607)`,
            padding: 52,
            borderRadius: 4,
            boxShadow: "0 50px 140px rgba(0,0,0,0.7)",
          }}
        >
          <div style={{ display: "flex", gap: 8, marginBottom: 30 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: 10, background: `${PAPER}22` }} />
            ))}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 33, letterSpacing: "-0.01em", color: PAPER, lineHeight: 1.5, whiteSpace: "nowrap" }}>
            {typed(cmd, 2, 26)}
            <span style={{ opacity: 0.5 }}>{(f - S3) % 16 < 8 ? "▌" : " "}</span>
          </div>
          <div style={{ marginTop: 22 }}>
            {rows.map((r, i) => {
              const on = p(f, r.at, r.at + 8);
              return (
                <div
                  key={r.k}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    height: 64,
                    opacity: on,
                    transform: `translateX(${(1 - on) * -8}px)`,
                    fontFamily: MONO,
                    fontSize: 28,
                    color: i === 2 ? EMERALD : GREY,
                  }}
                >
                  <Check c={i === 2 ? EMERALD : `${GREY}CC`} s={18} />
                  <span style={{ minWidth: 250 }}>{r.k}</span>
                  <span style={{ letterSpacing: "0.04em" }}>{r.v}</span>
                </div>
              );
            })}
          </div>
          <div
            style={{
              marginTop: 30,
              paddingTop: 26,
              borderTop: `1px solid ${PAPER}14`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.22em", color: GREY }}>DEPLOYED TO THE EDGE</span>
            <span style={{ fontFamily: LAT, fontSize: 122, fontWeight: 700, color: EMERALD, letterSpacing: "-0.045em", lineHeight: 0.9 }}>
              12<span style={{ fontSize: 54, letterSpacing: "-0.02em" }}>ms</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Keyboard: React.FC<{ f: number }> = ({ f }) => {
  const press = p(f, 8, 16);
  const ripple = p(f, 10, 40);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: STAGE_T, height: STAGE_H, display: "flex", alignItems: "center", justifyContent: "center", perspective: 1500 }}>
      <div style={{ position: "relative", width: 980, transform: "rotateX(50deg) rotateZ(-6deg)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 12 }}>
          {[...Array(36)].map((_, i) => {
            const hot = i === 12;
            return (
              <div
                key={i}
                style={{
                  height: 86,
                  borderRadius: 7,
                  background: hot
                    ? `linear-gradient(180deg, ${EMERALD}40, ${EMERALD}14)`
                    : `linear-gradient(180deg, #1C1F23, #0F1113)`,
                  border: `1px solid ${hot ? `${EMERALD}AA` : `${PAPER}12`}`,
                  transform: `translateY(${hot ? press * 5 : 0}px)`,
                  boxShadow: hot ? `0 0 ${40 * press}px ${EMERALD}77, inset 0 0 20px ${EMERALD}22` : "0 5px 0 #040506",
                }}
              />
            );
          })}
        </div>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "45%",
            width: 560 * ripple,
            height: 240 * ripple,
            transform: "translate(-50%,-50%)",
            borderRadius: "50%",
            border: `1px solid ${EMERALD}`,
            opacity: 0.55 * (1 - ripple),
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "45%",
            width: 300 * p(f, 14, 44),
            height: 120 * p(f, 14, 44),
            transform: "translate(-50%,-50%)",
            borderRadius: "50%",
            background: `radial-gradient(ellipse at center, ${EMERALD}22, transparent 70%)`,
          }}
        />
      </div>
    </div>
  );
};

const Flow: React.FC<{ f: number }> = ({ f }) => (
  <div style={{ position: "absolute", left: 0, right: 0, top: STAGE_T, height: STAGE_H, display: "flex", flexDirection: "column", justifyContent: "center" }}>
    {[...Array(9)].map((_, i) => {
      const t = ((f * 0.8 + i * 37) % 100) / 100;
      return (
        <React.Fragment key={i}>
          <div style={{ position: "relative", height: 74, margin: "0 70px" }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: 37, height: 1, background: `${PAPER}14` }} />
            <div
              style={{
                position: "absolute",
                left: `calc(${t * 100}% - 45px)`,
                top: 34,
                width: 90,
                height: 6,
                background: `linear-gradient(90deg, transparent, ${i % 3 === 0 ? EMERALD : PAPER}, transparent)`,
                opacity: 0.9,
              }}
            />
          </div>
        </React.Fragment>
      );
    })}
  </div>
);

const Scene3: React.FC<{ f: number; mode: Mode }> = ({ f, mode }) => {
  const beat = 24; // 0.8 s
  const i = Math.min(5, Math.floor((f - S3) / beat));
  const local = (f - S3) - i * beat;
  const whip = mode === "technical" && local < 3 ? 1 - local / 3 : 0;
  const labels = [
    { en: "Lean Architecture", num: "01" },
    { en: "Zero Overhead", num: "02" },
    { en: "Pure Autopilot", num: "03" },
  ];

  return (
    <AbsoluteFill style={{ background: INK, transform: `translateX(${whip * 100}px)`, filter: whip > 0.02 ? `blur(${whip * 16}px)` : undefined }}>
      <Light x={50} y={36} r={66} a={0.09} />
      {i === 0 || i === 1 ? <Terminal f={f} /> : null}
      {i === 2 ? <Keyboard f={f} /> : null}
      {i >= 3 ? <Flow f={f} /> : null}

      {/* the three words, one per beat pair */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1300, textAlign: "center" }}>
        {mode === "technical" ? (
          <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.36em", color: `${EMERALD}` }}>
            {labels[Math.min(2, Math.floor(i / 2))].num} · {labels[Math.min(2, Math.floor(i / 2))].en.toUpperCase()}
          </div>
        ) : (
          <Rise v={p(local, 0, 10)}>
            <div style={{ fontFamily: LAT, fontSize: 92, fontWeight: 700, letterSpacing: "-0.035em", color: PAPER, lineHeight: 1.1 }}>
              {labels[Math.min(2, Math.floor(i / 2))].en}
            </div>
            <div style={{ marginTop: 30, fontFamily: MONO, fontSize: 15, letterSpacing: "0.3em", color: `${EMERALD}CC` }}>
              {["DEPLOY IN SECONDS", "AUTOMATE THE HEAVY LIFTING", "SCALE ON DEMAND"][Math.min(2, Math.floor(i / 2))]}
            </div>
          </Rise>
        )}
      </div>
      <Vignette s={0.6} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ scene 4 */

const Scene4: React.FC<{ f: number; mode: Mode }> = ({ f }) => {
  const shake = (n: number) => Math.sin(f * 0.9 + n) * 1.6 + Math.sin(f * 2.1 + n * 2) * 0.8;
  const grow = p(f, S4 + 10, S4 + 110, ION);
  const HORIZON = 1504;
  return (
    <AbsoluteFill style={{ background: "#050607", transform: `translate(${shake(1)}px, ${shake(2)}px)` }}>
      {/* the room: two rim lights, a desk edge, and the screen's own spill */}
      <Light x={18} y={24} r={54} c="#2A6E5A" a={0.16} />
      <Light x={86} y={32} r={50} c="#3A4A66" a={0.12} />
      <div style={{ position: "absolute", left: 0, right: 0, top: HORIZON, bottom: 0, background: "linear-gradient(180deg, #0B0D10, #030405 60%)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: HORIZON, height: 1, background: `linear-gradient(90deg, transparent, ${PAPER}22, transparent)` }} />
      <div
        style={{
          position: "absolute",
          left: "10%",
          right: "10%",
          top: HORIZON - 150,
          height: 470,
          background: `radial-gradient(ellipse at 50% 0%, ${EMERALD}1F, transparent 62%)`,
          opacity: 0.6 + 0.4 * grow,
        }}
      />

      {/* the ultrawide monitor */}
      <div
        style={{
          position: "absolute",
          left: 74,
          right: 74,
          top: 372,
          height: 700,
          borderRadius: 10,
          border: `1px solid ${PAPER}22`,
          background: `linear-gradient(160deg, #0B0E11, #070809)`,
          boxShadow: `0 0 140px ${EMERALD}1C, 0 70px 150px rgba(0,0,0,0.85)`,
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", left: 44, top: 38, fontFamily: MONO, fontSize: 13, letterSpacing: "0.3em", color: `${PAPER}66` }}>GROWTH · EU</div>
        <div style={{ position: "absolute", right: 44, top: 38, fontFamily: MONO, fontSize: 13, letterSpacing: "0.3em", color: `${EMERALD}CC` }}>+340%</div>
        <svg width="100%" height="100%" viewBox="0 0 932 700" preserveAspectRatio="none">
          {[0, 1, 2, 3].map((i) => (
            <line key={i} x1={44} x2={888} y1={220 + i * 130} y2={220 + i * 130} stroke={`${PAPER}0E`} strokeWidth={1} />
          ))}
          <path
            d="M 44 640 C 200 630, 270 545, 380 500 S 570 380, 680 250 S 830 110, 888 74"
            fill="none"
            stroke={EMERALD}
            strokeWidth={3.4}
            strokeDasharray={1700}
            strokeDashoffset={1700 * (1 - grow)}
            style={{ filter: `drop-shadow(0 0 8px ${EMERALD}77)` }}
          />
          <circle cx={lerp(44, 888, grow)} cy={lerp(640, 74, grow)} r={6} fill={PAPER} />
        </svg>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 1176, textAlign: "center", padding: "0 70px" }}>
        <Rise v={p(f, S4 + 22, S4 + 52)}>
          <div style={{ fontFamily: LAT, fontSize: 84, fontWeight: 700, letterSpacing: "-0.035em", color: PAPER, lineHeight: 1.12 }}>
            Speed is your
          </div>
        </Rise>
        <Rise v={p(f, S4 + 32, S4 + 62)}>
          <div style={{ fontFamily: LAT, fontSize: 84, fontWeight: 700, letterSpacing: "-0.035em", color: EMERALD, lineHeight: 1.12 }}>only moat.</div>
        </Rise>
      </div>

      {/* one line of proof, on the desk, where the light falls */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: HORIZON + 92,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 15,
          letterSpacing: "0.34em",
          color: `${GREY}CC`,
          opacity: p(f, S4 + 60, S4 + 90),
        }}
      >
        SHIP · MEASURE · SCALE
      </div>

      <Vignette s={0.72} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ scene 5 */

const Scene5: React.FC<{ f: number; mode: Mode }> = ({ f }) => {
  const local = f - S5;
  const out = p(local, 0, 26, ION);
  const scale = lerp(1.18, 1, out);
  const typed = "SYSTEM".slice(0, Math.floor(p(local, 40, 70) * 6));
  const cursor = Math.floor(f / 12) % 2 === 0;
  return (
    <AbsoluteFill style={{ background: "#040505" }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${scale})` }}>
        <Light x={50} y={42} r={56} a={0.13} />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 10, height: 10, borderRadius: 10, background: EMERALD, boxShadow: `0 0 18px ${EMERALD}`, transform: `scale(${p(local, 30, 50)})` }} />
            <span style={{ fontFamily: LAT, fontSize: 92, fontWeight: 700, letterSpacing: `${lerp(0.22, 0.3, p(local, 30, 80))}em`, color: PAPER, marginRight: `-${lerp(0.22, 0.3, p(local, 30, 80))}em` }}>
              SYSTEM
            </span>
          </div>
          <div style={{ marginTop: 22, fontFamily: MONO, fontSize: 13, letterSpacing: "0.44em", color: `${GREY}`, opacity: p(local, 46, 70) }}>
            BY VITO BYTE
          </div>

          {/* the prompt box */}
          <div
            style={{
              marginTop: 92,
              width: 760,
              padding: "22px 28px",
              border: `1px solid ${PAPER}22`,
              background: `${PAPER}06`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              opacity: p(local, 60, 86),
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 26, color: PAPER, letterSpacing: "0.04em" }}>
              {typed}
              <span style={{ opacity: cursor ? 1 : 0, color: EMERALD }}>|</span>
            </span>
            <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.24em", color: `${EMERALD}CC` }}>SEND ↑</span>
          </div>

          <div style={{ marginTop: 40, padding: "0 60px", textAlign: "center", opacity: p(local, 78, 104) }}>
            <div style={{ fontFamily: LAT, fontSize: 38, color: `${PAPER}CC`, letterSpacing: "-0.01em" }}>
              Comment “SYSTEM” to get the full
            </div>
            <div style={{ fontFamily: LAT, fontSize: 38, color: `${PAPER}CC`, letterSpacing: "-0.01em" }}>infrastructure breakdown.</div>
          </div>
        </div>
      </div>
      <Vignette s={0.66} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------- film */

export const Edge: React.FC<EdgeProps> = ({ mode = "cinema", score, voice }) => {
  const f = useCurrentFrame();
  // the only transition that survives in both cuts: a whip on the downbeat
  const scene = f < S2 ? 1 : f < S3 ? 2 : f < S4 ? 3 : f < S5 ? 4 : 5;
  const label = ["HOOK", "FRICTION", "EDGE", "LEVERAGE", "SYSTEM"][scene - 1];

  return (
    <AbsoluteFill style={{ background: INK, overflow: "hidden" }}>
      {f < S2 ? <Scene1 f={f} mode={mode} /> : null}
      {f >= S2 && f < S3 ? <Scene2 f={f} mode={mode} /> : null}
      {f >= S3 && f < S4 ? <Scene3 f={f} mode={mode} /> : null}
      {f >= S4 && f < S5 ? <Scene4 f={f} mode={mode} /> : null}
      {f >= S5 ? <Scene5 f={f} mode={mode} /> : null}

      {mode === "technical" ? <Chrome f={f} scene={scene} label={label} /> : null}
      <Grain f={f} o={mode === "technical" ? 0.045 : 0.03} />
      {score && score.length > 32 ? <Audio src={score} /> : null}
      {voice && voice.length > 32 ? <Audio src={voice} /> : null}
    </AbsoluteFill>
  );
};
