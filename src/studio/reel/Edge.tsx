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
                    fontWeight: 600,
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

const ComplexGraph: React.FC<{ f: number }> = ({ f }) => {
  const nodes = [...Array(11)].map((_, i) => ({
    x: 90 + rnd(i) * 320,
    y: 220 + rnd(i + 40) * 900,
  }));
  const edges: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [1, 3], [0, 4], [4, 5], [5, 6], [3, 6], [6, 7], [7, 8], [8, 9], [9, 10], [4, 10], [2, 9],
  ];
  return (
    <svg width={540} height={1400} style={{ position: "absolute", left: 0, top: 200 }}>
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].x}
          y1={nodes[a].y}
          x2={nodes[b].x}
          y2={nodes[b].y}
          stroke={`${GREY}66`}
          strokeWidth={1.2}
          strokeDasharray={4}
          strokeDashoffset={-f * 0.4}
        />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={i % 3 === 0 ? 7 : 4} fill={`${GREY}${i % 3 === 0 ? "AA" : "66"}`} />
      ))}
      {/* the tangle the brief calls "traditional overhead" */}
      {[...Array(9)].map((_, i) => (
        <path
          key={i}
          d={`M ${60 + i * 40} ${1500} C ${40 + i * 30} ${1100}, ${180 + i * 10} ${700}, ${60 + i * 20} 260`}
          fill="none"
          stroke={`${MIST}`}
          strokeWidth={1}
        />
      ))}
    </svg>
  );
};

const LinearFlow: React.FC<{ f: number; n?: number }> = ({ f }) => {
  const y = 1160;
  return (
    <svg width={540} height={1400} style={{ position: "absolute", right: 0, top: 200 }}>
      <line x1={60} y1={y} x2={480} y2={y} stroke={`${PAPER}22`} strokeWidth={1} />
      <line
        x1={60}
        y1={y}
        x2={60 + 420 * p(f, 0, 60, ION)}
        y2={y}
        stroke={EMERALD}
        strokeWidth={3}
        style={{ filter: `drop-shadow(0 0 8px ${EMERALD})` }}
      />
      {[60, 200, 340, 480].map((x, i) => {
        const on = p(f, 6 + i * 12, 22 + i * 12);
        return <circle key={i} cx={x} cy={y} r={6 * on} fill={i === 3 ? EMERALD : PAPER} opacity={on} />;
      })}
      {/* a single packet travelling the line */}
      <circle cx={60 + ((420 * ((f * 0.9) % 100)) / 100)} cy={y} r={4} fill={PAPER} />
    </svg>
  );
};

const Scene2: React.FC<{ f: number; mode: Mode }> = ({ f, mode }) => {
  const whipIn = mode === "technical" ? 1 - p(f, S2, S2 + 8) : 1;
  const split = p(f, S2 + 6, S2 + 30, ION);
  return (
    <AbsoluteFill style={{ background: INK, transform: `translateX(${whipIn * 260}px)`, filter: whipIn > 0.02 ? `blur(${whipIn * 22}px)` : undefined }}>
      <Light x={18} y={30} r={60} a={0.07} />
      <Light x={82} y={70} r={55} a={0.1} />

      {/* the divider draws itself */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 220,
          bottom: 220,
          width: 1,
          background: `linear-gradient(180deg, transparent, ${PAPER}22, transparent)`,
          transform: `scaleY(${split})`,
        }}
      />

      <div style={{ position: "absolute", inset: 0, opacity: p(f, S2 + 14, S2 + 40) }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: W / 2, height: H }}>
          <ComplexGraph f={f} />
          <div style={{ position: "absolute", left: 54, bottom: 300, fontFamily: MONO, fontSize: 13, letterSpacing: "0.24em", color: `${GREY}AA` }}>
            TRADITIONAL
            <br />
            OVERHEAD
          </div>
        </div>
        <div style={{ position: "absolute", right: 0, top: 0, width: W / 2, height: H }}>
          <LinearFlow f={f} />
          <div style={{ position: "absolute", right: 54, bottom: 300, textAlign: "right", fontFamily: MONO, fontSize: 13, letterSpacing: "0.24em", color: `${EMERALD}CC` }}>
            SINGLE
            <br />
            LINEAR FLOW
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 700, padding: "0 84px", textAlign: "center" }}>
        <Rise v={p(f, S2 + 30, S2 + 60)}>
          <div style={{ fontFamily: LAT, fontSize: 78, fontWeight: 600, letterSpacing: "-0.03em", color: PAPER, lineHeight: 1.16 }}>
            Complexity is not
          </div>
        </Rise>
        <Rise v={p(f, S2 + 40, S2 + 70)}>
          <div style={{ fontFamily: LAT, fontSize: 78, fontWeight: 600, letterSpacing: "-0.03em", color: EMERALD, lineHeight: 1.16 }}>a feature.</div>
        </Rise>
      </div>

      <Vignette s={0.66} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ scene 3 */

const TERM = [
  ["$ edge deploy --region fra1 --env prod", PAPER],
  ["✓ build          1.9s", GREY],
  ["✓ upload         0.4s", GREY],
  ["✓ propa",
    EMERALD],
];

const Terminal: React.FC<{ f: number }> = ({ f }) => {
  const typed = (s: string, at: number, len: number) => s.slice(0, Math.floor(p(f, at, at + len) * s.length));
  return (
    <div style={{ position: "absolute", left: 64, right: 64, top: 520 }}>
      <div
        style={{
          border: `1px solid ${PAPER}1A`,
          background: `linear-gradient(180deg, ${INK2}, #050607)`,
          padding: 34,
          borderRadius: 3,
          boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", gap: 7, marginBottom: 24 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 9, height: 9, borderRadius: 9, background: `${PAPER}22` }} />
          ))}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 25, lineHeight: 1.9, color: PAPER }}>
          <div>{typed(TERM[0][0] as string, 0, 26)}</div>
          <div style={{ color: GREY }}>{typed(TERM[1][0] as string, 26, 10)}</div>
          <div style={{ color: GREY }}>{typed(TERM[2][0] as string, 34, 10)}</div>
          <div style={{ color: EMERALD }}>{typed(TERM[3][0] as string, 42, 8)}</div>
        </div>
        <div
          style={{
            marginTop: 26,
            paddingTop: 22,
            borderTop: `1px solid ${PAPER}14`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.2em", color: `${GREY}` }}>DEPLOYED TO THE EDGE</span>
          <span style={{ fontFamily: LAT, fontSize: 54, fontWeight: 600, color: EMERALD, letterSpacing: "-0.03em" }}>12ms</span>
        </div>
      </div>
    </div>
  );
};

const Keyboard: React.FC<{ f: number }> = ({ f }) => {
  const press = p(f, 10, 18);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 760, perspective: 1400 }}>
      <div
        style={{
          margin: "0 auto",
          width: 760,
          transform: `rotateX(52deg) rotateZ(-8deg)`,
          display: "grid",
          gridTemplateColumns: "repeat(8, 1fr)",
          gap: 10,
        }}
      >
        {[...Array(32)].map((_, i) => {
          const hot = i === 13;
          return (
            <div
              key={i}
              style={{
                height: 62,
                borderRadius: 6,
                background: hot ? `linear-gradient(180deg, ${EMERALD}33, ${EMERALD}11)` : `linear-gradient(180deg, #1B1E22, #101214)`,
                border: `1px solid ${hot ? EMERALD + "88" : PAPER + "12"}`,
                transform: `translateY(${hot ? press * 4 : 0}px)`,
                boxShadow: hot ? `0 0 ${24 * press}px ${EMERALD}66` : "0 4px 0 #050607",
              }}
            />
          );
        })}
      </div>
      {/* the ripple out of the pressed key */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 130,
          width: 420 * p(f, 12, 40),
          height: 160 * p(f, 12, 40),
          transform: "translate(-50%,-50%)",
          borderRadius: "50%",
          border: `1px solid ${EMERALD}`,
          opacity: 0.5 * (1 - p(f, 12, 40)),
        }}
      />
    </div>
  );
};

const Flow: React.FC<{ f: number }> = ({ f }) => (
  <div style={{ position: "absolute", inset: 0 }}>
    {[...Array(9)].map((_, i) => {
      const y = 560 + i * 70;
      const t = ((f * 0.8 + i * 37) % 100) / 100;
      return (
        <React.Fragment key={i}>
          <div style={{ position: "absolute", left: 120, top: y, right: 120, height: 1, background: `${PAPER}14` }} />
          <div
            style={{
              position: "absolute",
              left: lerp(120, 960, t),
              top: y - 2,
              width: 70,
              height: 5,
              background: `linear-gradient(90deg, transparent, ${i % 3 === 0 ? EMERALD : PAPER}, transparent)`,
              opacity: 0.85,
            }}
          />
        </React.Fragment>
      );
    })}
    <div style={{ position: "absolute", left: "50%", top: 1180, transform: "translateX(-50%)", fontFamily: MONO, fontSize: 13, letterSpacing: "0.34em", color: `${EMERALD}BB` }}>
      AUTOPILOT · 1,284 EVENTS/MIN
    </div>
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
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 330, textAlign: "center" }}>
        {mode === "technical" ? (
          <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.36em", color: `${EMERALD}` }}>
            {labels[Math.min(2, Math.floor(i / 2))].num} · {labels[Math.min(2, Math.floor(i / 2))].en.toUpperCase()}
          </div>
        ) : (
          <Rise v={p(local, 0, 10)}>
            <div style={{ fontFamily: LAT, fontSize: 92, fontWeight: 600, letterSpacing: "-0.035em", color: PAPER, lineHeight: 1.1 }}>
              {labels[Math.min(2, Math.floor(i / 2))].en}
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
  const grow = p(f, S4 + 10, S4 + 120, ION);
  return (
    <AbsoluteFill style={{ background: "#050607", transform: `translate(${shake(1)}px, ${shake(2)}px)` }}>
      {/* the room: two rim lights and a horizon of desk */}
      <Light x={20} y={26} r={52} c="#2A6E5A" a={0.16} />
      <Light x={84} y={34} r={48} c="#3A4A66" a={0.12} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 1180, height: 1, background: `linear-gradient(90deg, transparent, ${PAPER}20, transparent)` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 1180, bottom: 0, background: "linear-gradient(180deg, #0A0C0E, #030405)" }} />

      {/* the ultrawide monitor */}
      <div
        style={{
          position: "absolute",
          left: 90,
          right: 90,
          top: 470,
          height: 620,
          borderRadius: 10,
          border: `1px solid ${PAPER}22`,
          background: `linear-gradient(160deg, #0B0E11, #070809)`,
          boxShadow: `0 0 120px ${EMERALD}18, 0 60px 140px rgba(0,0,0,0.8)`,
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", left: 40, top: 34, fontFamily: MONO, fontSize: 12, letterSpacing: "0.3em", color: `${PAPER}55` }}>GROWTH · EU</div>
        <svg width="100%" height="100%" viewBox="0 0 860 620" preserveAspectRatio="none">
          {[0, 1, 2, 3].map((i) => (
            <line key={i} x1={40} x2={820} y1={160 + i * 110} y2={160 + i * 110} stroke={`${PAPER}0E`} strokeWidth={1} />
          ))}
          <path
            d={`M 40 560 C 180 552, 240 470, 340 430 S 520 320, 620 200 S 760 90, 820 60`}
            fill="none"
            stroke={EMERALD}
            strokeWidth={3}
            strokeDasharray={1600}
            strokeDashoffset={1600 * (1 - grow)}
            style={{ filter: `drop-shadow(0 0 10px ${EMERALD})` }}
          />
          <circle cx={lerp(40, 820, grow)} cy={lerp(560, 60, grow)} r={5} fill={PAPER} />
        </svg>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 1230, textAlign: "center", padding: "0 70px" }}>
        <Rise v={p(f, S4 + 26, S4 + 56)}>
          <div style={{ fontFamily: LAT, fontSize: 80, fontWeight: 600, letterSpacing: "-0.035em", color: PAPER, lineHeight: 1.14 }}>
            Speed is your
          </div>
        </Rise>
        <Rise v={p(f, S4 + 36, S4 + 66)}>
          <div style={{ fontFamily: LAT, fontSize: 80, fontWeight: 600, letterSpacing: "-0.035em", color: EMERALD, lineHeight: 1.14 }}>only moat.</div>
        </Rise>
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
            <span style={{ fontFamily: LAT, fontSize: 92, fontWeight: 600, letterSpacing: `${lerp(0.22, 0.3, p(local, 30, 80))}em`, color: PAPER, marginRight: `-${lerp(0.22, 0.3, p(local, 30, 80))}em` }}>
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
