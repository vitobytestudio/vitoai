/**
 * «إطار» — a hand-authored 24-second film. No template, no planner.
 *
 * Every number in this file was chosen by hand for one reason: rhythm. The
 * sections are LATENT → FRAME → DEPTH → MONTAGE → HOLD → SIGNATURE, and the
 * cuts in MONTAGE land on the score's eighths by construction: both are cut
 * from the same cue table (CUES below) so they cannot drift.
 *
 * Typography: one Arabic family (Cairo) and one Latin (Space Grotesk), plus
 * monospace for the machinery. Nothing else. Scale jumps are real — 16, 22, 34,
 * 120, 200, 320 — because intermediate sizes are what make a layout look made
 * by a machine.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing, Audio } from "remotion";

const W = 1080;
const H = 1920;

const INK = "#05070A";
const PAPER = "#F2F4F7";
const ACCENT = "#4FE3B0";
const BLUE = "#7EA2FF";

const AR = '"Cairo", "IBM Plex Sans Arabic", sans-serif';
const LAT = '"Space Grotesk", "Sora", sans-serif';
const MONO = '"JetBrains Mono", monospace';

/* ------------------------------------------------------------------ tools */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const easeIn = Easing.bezier(0.7, 0, 0.84, 0);
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

/** f → 0..1 over [a,b], eased */
const t = (f: number, a: number, b: number, e = ease) => clamp01(e(clamp01((f - a) / Math.max(1, b - a))));

/** deterministic hash, so every render is the same film */
const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** clip-reveal: the child is unmasked from `p` of its own height */
const Clip: React.FC<{ p: number; dir?: "up" | "down" | "left"; children: React.ReactNode; style?: React.CSSProperties }> = ({
  p,
  dir = "up",
  children,
  style,
}) => {
  const inner =
    dir === "up"
      ? { transform: `translateY(${(1 - p) * 102}%)` }
      : dir === "down"
        ? { transform: `translateY(${-(1 - p) * 102}%)` }
        : { transform: `translateX(${-(1 - p) * 102}%)` };
  return (
    <span style={{ display: "block", overflow: "hidden", ...style }}>
      <span style={{ display: "block", ...inner }}>{children}</span>
    </span>
  );
};

/** a hairline that draws itself from one side */
const Rule: React.FC<{ p: number; w?: number; c?: string; thick?: number; from?: "left" | "right" | "center"; v?: boolean }> = ({
  p,
  w = 900,
  c = "rgba(242,244,247,0.18)",
  thick = 1,
  from = "left",
  v = false,
}) => (
  <div
    style={{
      width: v ? thick : w,
      height: v ? 1920 : thick,
      background: c,
      transform: v ? `scaleY(${p})` : `scaleX(${p})`,
      transformOrigin: from === "right" ? "100% 50%" : from === "center" ? "50% 50%" : "0% 50%",
    }}
  />
);

/** film grain, tiled and drifting — cheap, and it holds the blacks together */
const Grain: React.FC<{ o?: number; f: number }> = ({ o = 0.05, f }) => (
  <div
    style={{
      position: "absolute",
      inset: -40,
      opacity: o,
      mixBlendMode: "overlay",
      pointerEvents: "none",
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/></filter><rect width='140' height='140' filter='url(%23n)' opacity='0.55'/></svg>\")",
      backgroundPosition: `${(f * 7) % 140}px ${(f * 11) % 140}px`,
    }}
  />
);

const Vignette: React.FC<{ s?: number }> = ({ s = 0.55 }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background: `radial-gradient(ellipse 74% 58% at 50% 46%, rgba(0,0,0,0) 38%, rgba(0,0,0,${s}) 100%)`,
    }}
  />
);

/* ------------------------------------------------------------------ cues */

/** the same table the score is written from */
export const CUES = [
  { at: 0, name: "latent" },
  { at: 78, name: "frame" },
  { at: 204, name: "depth" },
  { at: 330, name: "montage" },
  { at: 470, name: "hold" },
  { at: 606, name: "signature" },
];
const MONTAGE = 8;
const MONTAGE_FROM = 330;
const MONTAGE_TO = 470;
const CUT = (MONTAGE_TO - MONTAGE_FROM) / MONTAGE; // 17.5 frames per cut

/* --------------------------------------------------------------- sections */

const Latent: React.FC<{ f: number; end: number }> = ({ f, end }) => {
  const grow = t(f, 6, 44);
  const flick = f > 6 && f < 44 ? 0.55 + 0.45 * Math.abs(Math.sin(f * 1.9)) : 1;
  const split = t(f, end - 26, end);
  const dots = t(f, 26, end);

  return (
    <AbsoluteFill style={{ background: INK }}>
      {/* radial dot fields, in the four corners — the space before anything */}
      {[
        [18, 16],
        [82, 16],
        [18, 84],
        [82, 84],
      ].map(([x, y], i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${x}%`,
            top: `${y}%`,
            width: 520,
            height: 520,
            marginLeft: -260,
            marginTop: -260,
            backgroundImage: "radial-gradient(rgba(242,244,247,0.30) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(circle at center, black 0%, transparent 68%)",
            WebkitMaskImage: "radial-gradient(circle at center, black 0%, transparent 68%)",
            opacity: dots * (0.35 + 0.25 * i),
            transform: `scale(${0.9 + 0.1 * dots})`,
          }}
        />
      ))}

      {/* a core that breathes — the only light in the frame */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 620,
          height: 620,
          marginLeft: -310,
          marginTop: -310,
          borderRadius: "50%",
          background: `radial-gradient(circle at 50% 50%, rgba(79,227,176,${0.34 * (0.55 + 0.45 * Math.sin(f * 0.16))}) 0%, rgba(79,227,176,0) 62%)`,
          filter: "blur(6px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 260,
          height: 260,
          marginLeft: -130,
          marginTop: -130,
          borderRadius: "50%",
          border: `1px solid rgba(242,244,247,${0.10 + 0.10 * Math.sin(f * 0.16)})`,
          transform: `scale(${0.86 + 0.14 * grow})`,
        }}
      />

      {/* the line that becomes the film */}
      {[...Array(9)].map((_, i) => {
        const spread = (i - 4) * (W / 9) * split;
        const local = t(f, 6 + Math.abs(i - 4) * 3, 40 + Math.abs(i - 4) * 3);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: W / 2 + spread - 0.5,
              top: H / 2 - (H / 2) * local,
              width: 1,
              height: H * local,
              background: `linear-gradient(180deg, rgba(79,227,176,0) 0%, rgba(79,227,176,${0.85 * flick}) 46%, rgba(242,244,247,0.9) 50%, rgba(79,227,176,${0.85 * flick}) 54%, rgba(79,227,176,0) 100%)`,
            }}
          />
        );
      })}

      <div
        style={{
          position: "absolute",
          left: 74,
          bottom: 88,
          fontFamily: MONO,
          fontSize: 15,
          letterSpacing: "0.34em",
          color: "rgba(242,244,247,0.42)",
          opacity: t(f, 34, 62),
        }}
      >
        NEXUS · 001
      </div>
      <div
        style={{
          position: "absolute",
          right: 74,
          bottom: 88,
          fontFamily: MONO,
          fontSize: 15,
          letterSpacing: "0.34em",
          color: "rgba(242,244,247,0.42)",
          opacity: t(f, 40, 68),
        }}
      >
        24s / 30p
      </div>
      <Vignette s={0.7} />
      <Grain f={f} o={0.07} />
    </AbsoluteFill>
  );
};

const FrameSection: React.FC<{ f: number }> = ({ f }) => {
  const word = t(f, 96, 150, Easing.bezier(0.22, 1, 0.36, 1));
  const sub = t(f, 140, 180);
  const cols = t(f, 78, 118);
  const ca = f < 132 ? 1 - t(f, 112, 140) : 0; // chromatic aberration on the reveal only

  return (
    <AbsoluteFill style={{ background: INK }}>
      {/* nine columns rise together: the frame assembling itself */}
      {[...Array(9)].map((_, i) => {
        const p = t(f, 74 + i * 2, 112 + i * 3);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: (W / 9) * i,
              top: 0,
              width: W / 9 - 1,
              height: H,
              background: i % 2 ? "rgba(242,244,247,0.026)" : "rgba(242,244,247,0.014)",
              transform: `translateY(${(1 - p) * H}px)`,
            }}
          />
        );
      })}

      <div style={{ position: "absolute", left: 74, right: 74, top: 0, bottom: 0, opacity: cols }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.5 - 210 }}>
          {ca > 0
            ? [
                { c: "rgba(255,86,86,0.55)", dx: -4 * ca },
                { c: "rgba(79,227,176,0.55)", dx: 0 },
                { c: "rgba(126,162,255,0.55)", dx: 4 * ca },
              ].map((l, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    inset: 0,
                    fontFamily: AR,
                    fontSize: 320,
                    fontWeight: 800,
                    lineHeight: 1,
                    color: l.c,
                    mixBlendMode: "screen",
                    transform: `translateX(${l.dx}px)`,
                    direction: "rtl",
                    textAlign: "center",
                  }}
                >
                  إطار
                </div>
              ))
            : null}
          <div
            style={{
              position: "relative",
              fontFamily: AR,
              fontSize: 320,
              fontWeight: 800,
              lineHeight: 1,
              color: PAPER,
              direction: "rtl",
              textAlign: "center",
              clipPath: `inset(${(1 - word) * 100}% 0 0 0)`,
              transform: `translateY(${(1 - word) * 26}px)`,
            }}
          >
            إطار
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: H * 0.5 + 150,
            display: "flex",
            alignItems: "center",
            gap: 22,
            opacity: sub,
          }}
        >
          <div style={{ flex: 1, height: 1, background: "rgba(242,244,247,0.22)", transformOrigin: "0 50%", transform: `scaleX(${sub})` }} />
          <span style={{ fontFamily: LAT, fontSize: 24, letterSpacing: "0.34em", color: "rgba(242,244,247,0.62)", textTransform: "uppercase" }}>
            the frame is a decision
          </span>
        </div>
      </div>

      <Vignette s={0.6} />
      <Grain f={f} o={0.06} />
    </AbsoluteFill>
  );
};

const Depth: React.FC<{ f: number }> = ({ f }) => {
  const push = t(f, 204, 330, Easing.bezier(0.4, 0, 0.2, 1));
  const head = f - 204;

  // three planes, three speeds: parallax without a 3D engine
  const plane = (depth: number) => 1 + push * depth;
  const n = Math.round(interpolate(head, [10, 90], [0, 100], { extrapolateRight: "clamp" }));
  const sweep = interpolate(head, [0, 126], [0, 120], { extrapolateRight: "clamp" });

  const lines = ["الضوء يبني", "المكان", "والقطع يبني", "المعنى"];
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, #060A10 0%, #04070A 100%)` }}>
      {/* far plane: a field of rules */}
      <div style={{ position: "absolute", inset: 0, transform: `scale(${plane(0.05)})`, opacity: 0.5 }}>
        {[...Array(26)].map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: (H / 26) * i,
              left: 0,
              right: 0,
              height: 1,
              background: "rgba(242,244,247,0.05)",
            }}
          />
        ))}
      </div>

      {/* the light sweep */}
      <div
        style={{
          position: "absolute",
          inset: -200,
          background: `conic-gradient(from ${sweep}deg at 50% 42%, rgba(79,227,176,0) 0deg, rgba(79,227,176,0.16) 26deg, rgba(242,244,247,0.06) 40deg, rgba(79,227,176,0) 70deg)`,
          mixBlendMode: "screen",
          transform: `scale(${plane(0.02)})`,
        }}
      />

      {/* mid plane: the counter, set vertically like a slate */}
      <div
        style={{
          position: "absolute",
          right: 74,
          top: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          transform: `scale(${plane(0.16)})`,
          transformOrigin: "100% 50%",
          opacity: 0.9,
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 116,
            color: "rgba(242,244,247,0.14)",
            writingMode: "vertical-rl",
            letterSpacing: "0.08em",
          }}
        >
          {String(n).padStart(3, "0")}
        </span>
      </div>

      {/* near plane: the copy */}
      <div
        style={{
          position: "absolute",
          left: 74,
          right: 160,
          top: H * 0.5 - 300,
          transform: `scale(${plane(0.24)})`,
          transformOrigin: "0% 50%",
          direction: "rtl",
        }}
      >
        {lines.map((l, i) => {
          const p = t(f, 216 + i * 14, 250 + i * 14);
          return (
            <div key={i} style={{ overflow: "hidden", marginBottom: 6 }}>
              <div
                style={{
                  fontFamily: AR,
                  fontSize: i === 1 ? 132 : 96,
                  fontWeight: i === 1 ? 800 : 700,
                  lineHeight: 1.12,
                  color: i === 1 ? ACCENT : PAPER,
                  transform: `translateY(${(1 - p) * 108}%)`,
                }}
              >
                {l}
              </div>
            </div>
          );
        })}
        <div
          style={{
            marginTop: 44,
            display: "flex",
            alignItems: "center",
            gap: 18,
            opacity: t(f, 286, 318),
            direction: "rtl",
          }}
        >
          <div style={{ width: 120, height: 2, background: ACCENT }} />
          <span style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.3em", color: "rgba(242,244,247,0.72)" }}>PLANE 03 · DEPTH</span>
        </div>
      </div>

      <Vignette s={0.52} />
      <Grain f={f} o={0.06} />
    </AbsoluteFill>
  );
};

const MicroScene: React.FC<{ i: number; f: number; local: number }> = ({ i, f, local }) => {
  switch (i % 8) {
    case 0:
      return (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center", direction: "rtl" }}>
          {["صمت", "يُسمع"].map((w, k) => (
            <div key={k} style={{ overflow: "hidden" }}>
              <div
                style={{
                  fontFamily: AR,
                  fontSize: k ? 200 : 150,
                  fontWeight: 800,
                  lineHeight: 1.02,
                  color: k ? ACCENT : PAPER,
                  transform: `translateY(${(1 - t(local, k * 3, 12 + k * 3)) * 104}%)`,
                }}
              >
                {w}
              </div>
            </div>
          ))}
        </div>
      );
    case 1:
      return (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 84px)", gap: 20 }}>
            {[...Array(18)].map((_, k) => {
              const ph = rnd(k * 7.3);
              const s = 0.5 + 0.5 * Math.sin(local * 0.5 + ph * 6.28);
              return (
                <div
                  key={k}
                  style={{
                    width: 84,
                    height: 84,
                    background: ph > 0.72 ? ACCENT : "rgba(242,244,247,0.14)",
                    opacity: 0.35 + s * 0.65,
                    transform: `scale(${0.72 + s * 0.28})`,
                  }}
                />
              );
            })}
          </div>
        </div>
      );
    case 2:
      return (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: H / 2, height: 3, background: BLUE, transform: `scaleX(${t(local, 0, 12)})` }} />
          <div
            style={{
              fontFamily: LAT,
              fontSize: 150,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              color: PAPER,
              transform: `translateX(${(1 - t(local, 0, 14)) * 220}px)`,
            }}
          >
            MOTION
          </div>
        </div>
      );
    case 3:
      return (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center", direction: "rtl" }}>
          <div style={{ fontFamily: MONO, fontSize: 300, color: PAPER, letterSpacing: "-0.04em", lineHeight: 1 }}>
            {String(Math.round(24 - (i % 8) * 3 - local * 0.5)).padStart(2, "0")}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 16, letterSpacing: "0.4em", color: ACCENT, textAlign: "center", marginTop: 12 }}>FRAMES</div>
        </div>
      );
    case 4:
      return (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          {[...Array(5)].map((_, k) => (
            <div
              key={k}
              style={{
                position: "absolute",
                width: 300,
                height: 300,
                borderRadius: "50%",
                border: `1px solid ${k === 2 ? ACCENT : "rgba(242,244,247,0.24)"}`,
                transform: `scale(${0.4 + ((local * 0.12 + k * 0.22) % 1) * 2.2})`,
                opacity: 1 - ((local * 0.12 + k * 0.22) % 1),
              }}
            />
          ))}
        </div>
      );
    case 5:
      return (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center", direction: "rtl" }}>
          <div style={{ fontFamily: AR, fontSize: 118, fontWeight: 700, color: PAPER, lineHeight: 1.16, textAlign: "right", padding: "0 84px" }}>
            {["القطع", "هو", "المعنى"][Math.min(2, Math.floor(local / 6))]}
          </div>
        </div>
      );
    case 6:
      return (
        <div style={{ position: "absolute", inset: 0, background: PAPER, display: "grid", placeContent: "center" }}>
          <div style={{ fontFamily: LAT, fontSize: 120, fontWeight: 700, color: INK, letterSpacing: "-0.03em" }}>CUT</div>
        </div>
      );
    default:
      return (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <div
            style={{
              width: 640,
              height: 640,
              border: `2px solid ${ACCENT}`,
              transform: `rotate(${local * 3}deg) scale(${0.85 + 0.15 * t(local, 0, 10)})`,
              borderRadius: 6,
            }}
          />
        </div>
      );
  }
};

const Montage: React.FC<{ f: number }> = ({ f }) => {
  const rel = f - MONTAGE_FROM;
  const i = Math.min(MONTAGE - 1, Math.floor(rel / CUT));
  const local = rel - i * CUT;
  const scan = (rel * 26) % H;
  const flash = local < 1;
  const sl = (i * 37) % 7;

  return (
    <AbsoluteFill style={{ background: sl > 4 ? "#07090C" : INK }}>
      <div key={i} style={{ position: "absolute", inset: 0 }}>
        <div style={{ position: "absolute", inset: 0, transform: `scale(${1.02 - 0.02 * t(local, 0, CUT)})` }}>
          <MicroScene i={i} f={f} local={local} />
        </div>
      </div>

      {/* a scan line that keeps the montage moving even between cuts */}
      <div style={{ position: "absolute", left: 0, right: 0, top: scan, height: 2, background: "rgba(242,244,247,0.10)" }} />

      {/* the cut itself: a single frame of paper carrying the beat number.
          A design choice, not a flash — it reads as a slate, twice per second. */}
      {flash ? (
        <div style={{ position: "absolute", inset: 0, background: PAPER, isolation: "isolate" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeContent: "center",
              fontFamily: MONO,
              fontSize: 220,
              color: INK,
              letterSpacing: "-0.04em",
            }}
          >
            {String(i + 1).padStart(2, "0")}
          </div>
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          left: 74,
          bottom: 88,
          fontFamily: MONO,
          fontSize: 15,
          letterSpacing: "0.3em",
          color: "rgba(242,244,247,0.5)",
        }}
      >
        {String(i + 1).padStart(2, "0")} / 08
      </div>
      {!flash ? <Vignette s={0.4} /> : null}
      <Grain f={f} o={flash ? 0 : 0.07} />
    </AbsoluteFill>
  );
};

const Hold: React.FC<{ f: number }> = ({ f }) => {
  const rel = f - 470;
  const line = t(rel, 6, 46, easeOut);
  const rule = t(rel, 40, 92, easeOut);
  const drift = 1 + rel * 0.00028;

  return (
    <AbsoluteFill style={{ background: INK }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          direction: "rtl",
          transform: `scale(${drift})`,
        }}
      >
        <div style={{ fontFamily: AR, fontSize: 104, fontWeight: 700, lineHeight: 1.34, color: PAPER, textAlign: "center", padding: "0 92px" }}>
          <Clip p={line}>
            <span>الفيلم قرارٌ،</span>
          </Clip>
          <Clip p={t(rel, 18, 58, easeOut)}>
            <span style={{ color: ACCENT }}>لا قالب.</span>
          </Clip>
        </div>
        <div style={{ width: 420, marginTop: 56 }}>
          <Rule p={rule} w={420} c="rgba(242,244,247,0.28)" from="center" />
        </div>
        <div
          style={{
            marginTop: 34,
            fontFamily: LAT,
            fontSize: 19,
            letterSpacing: "0.42em",
            color: "rgba(242,244,247,0.44)",
            opacity: t(rel, 70, 104),
            textTransform: "uppercase",
          }}
        >
          a film is a decision
        </div>
      </div>
      <Vignette s={0.62} />
      <Grain f={f} o={0.05} />
    </AbsoluteFill>
  );
};

const Signature: React.FC<{ f: number }> = ({ f }) => {
  const rel = f - 606;
  const out = t(rel, 96, 114, easeIn);
  const track = interpolate(t(rel, 10, 54), [0, 1], [0.62, 0.26]);
  const dot = t(rel, 26, 40);

  return (
    <AbsoluteFill style={{ background: INK }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          opacity: 1 - out,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 12 * dot, height: 12 * dot, borderRadius: 99, background: ACCENT, marginTop: 6 }} />
          <span
            style={{
              fontFamily: LAT,
              fontSize: 84,
              fontWeight: 700,
              letterSpacing: `${track}em`,
              color: PAPER,
              opacity: t(rel, 6, 30),
              transform: `translateY(${(1 - t(rel, 6, 34)) * 18}px)`,
            }}
          >
            NEXUS
          </span>
        </div>
        <div
          style={{
            marginTop: 26,
            fontFamily: AR,
            fontSize: 34,
            color: "rgba(242,244,247,0.62)",
            opacity: t(rel, 34, 62),
            direction: "rtl",
          }}
        >
          من ڤيتو بايت
        </div>
        <div style={{ width: 260, marginTop: 44 }}>
          <Rule p={t(rel, 44, 80)} w={260} c="rgba(79,227,176,0.55)" from="center" />
        </div>
      </div>
      <Grain f={f} o={0.05} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ piece */

export type ReelProps = { score?: string };

export const Amaze: React.FC<ReelProps> = ({ score }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  void fps;

  return (
    <AbsoluteFill style={{ background: INK }}>
      {f < 78 ? <Latent f={f} end={78} /> : null}
      {f >= 78 && f < 204 ? <FrameSection f={f} /> : null}
      {f >= 204 && f < 330 ? <Depth f={f} /> : null}
      {f >= 330 && f < 470 ? <Montage f={f} /> : null}
      {f >= 470 && f < 606 ? <Hold f={f} /> : null}
      {f >= 606 ? <Signature f={f} /> : null}
      {score && score.length > 32 ? <Audio src={score} /> : null}
    </AbsoluteFill>
  );
};


/**
 * The film's own cue sheet, exported so the score is written from the same
 * numbers the picture is cut with. Six sections, eight cuts inside the montage.
 */
export const AMAZE_CUES = {
  fps: 30,
  seconds: 24,
  sections: CUES,
  montage: Array.from({ length: 8 }, (_, i) => ({
    at: MONTAGE_FROM + i * CUT,
    seconds: CUT,
  })),
};
