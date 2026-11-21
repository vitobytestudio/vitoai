/**
 * NEXUS — thirty seconds, eight movements, no template.
 *
 * This is the studio's own advertisement, so it has to do what the studio sells:
 * decide, then cut. Each movement uses a different motion technique on purpose —
 * counters, staggered masks, a kinetic grid, a real 3D card, a six-cut type
 * montage, a drawn timeline, a breathing statement, a signature.
 *
 * Frame budget: 900 frames at 30 fps. Every section boundary is in CUES, and the
 * score is written from the same table, so an impact lands on a cut and not near
 * one.
 */
import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, useCurrentFrame } from "remotion";

const W = 1080;
const H = 1920;
const INK = "#05070A";
const PAPER = "#F3F5F8";
const MINT = "#4FE3B0";
const BLUE = "#7EA2FF";
const AR = '"Cairo", "IBM Plex Sans Arabic", sans-serif';
const LAT = '"Space Grotesk", "Sora", sans-serif';
const MONO = '"JetBrains Mono", monospace';

export const FPS = 30;
export const DURATION = 900;

export const CUES = [
  { at: 0, name: "open" },
  { at: 54, name: "problem" },
  { at: 180, name: "grid" },
  { at: 330, name: "depth" },
  { at: 450, name: "type" },
  { at: 570, name: "data" },
  { at: 690, name: "statement" },
  { at: 810, name: "signature" },
];

/* ------------------------------------------------------------------ tools */

const c = (v: number) => Math.min(1, Math.max(0, v));
const e = Easing.bezier(0.16, 1, 0.3, 1);
const eIn = Easing.bezier(0.64, 0, 0.86, 0);
const lerp = (a: number, b: number, t: number) => a + (b - a) * c(t);
const p = (f: number, a: number, b: number, fn = e) => c(fn(c((f - a) / Math.max(1, b - a))));
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** reveal by mask, never by a box: Arabic hangs below its line box */
const Reveal: React.FC<{ v: number; dir?: "up" | "down" | "left"; children: React.ReactNode; style?: React.CSSProperties }> = ({
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

const Grain: React.FC<{ f: number; o?: number }> = ({ f, o = 0.055 }) => (
  <div
    style={{
      position: "absolute",
      inset: -50,
      opacity: o,
      mixBlendMode: "overlay",
      pointerEvents: "none",
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/></filter><rect width='160' height='160' filter='url(%23n)' opacity='0.5'/></svg>\")",
      backgroundPosition: `${(f * 9) % 160}px ${(f * 13) % 160}px`,
    }}
  />
);

const Vignette: React.FC<{ s?: number }> = ({ s = 0.58 }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background: `radial-gradient(ellipse 76% 60% at 50% 46%, rgba(0,0,0,0) 36%, rgba(0,0,0,${s}) 100%)`,
    }}
  />
);

/** three offset copies — an aberration that only costs one frame's read */
const Aberrate: React.FC<{ v: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ v, children, style }) =>
  v <= 0.001 ? <>{children}</> : (
    <div style={{ position: "relative", ...style }}>
      <div style={{ position: "absolute", inset: 0, color: "rgba(255,86,86,0.55)", mixBlendMode: "screen", transform: `translateX(${-5 * v}px)` }}>
        {children}
      </div>
      <div style={{ position: "absolute", inset: 0, color: "rgba(126,162,255,0.55)", mixBlendMode: "screen", transform: `translateX(${5 * v}px)` }}>
        {children}
      </div>
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );

/* ------------------------------------------------------------- movements */

const Open: React.FC<{ f: number }> = ({ f }) => {
  const n = Math.round(lerp(30, 0, p(f, 0, 44, e)));
  const slash = p(f, 30, 50, Easing.bezier(0.2, 0.9, 0.2, 1));
  return (
    <AbsoluteFill style={{ background: INK, justifyContent: "center", alignItems: "center" }}>
      <div style={{ fontFamily: MONO, fontSize: 190, color: PAPER, letterSpacing: "-0.05em", opacity: 1 - p(f, 40, 54) }}>
        {String(n).padStart(2, "0")}
        <span style={{ color: MINT }}>″</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 1,
          height: 900 * slash,
          background: `linear-gradient(180deg, transparent, ${MINT}, transparent)`,
          transform: `translate(-50%, -50%) rotate(18deg)`,
        }}
      />
      <div style={{ position: "absolute", left: 74, bottom: 92, fontFamily: MONO, fontSize: 14, letterSpacing: "0.4em", color: "rgba(243,245,248,0.4)", opacity: p(f, 8, 30) }}>
        NEXUS · SHOWREEL 2026
      </div>
      <Grain f={f} o={0.07} />
      <Vignette s={0.66} />
    </AbsoluteFill>
  );
};

const Problem: React.FC<{ f: number }> = ({ f }) => {
  const rel = f - 54;
  const words = ["كل", "فيلم", "يبدأ", "بقالب."];
  const collapse = p(rel, 62, 96, Easing.bezier(0.7, 0, 0.84, 0));
  const z = interpolate(collapse, [0, 1], [0, -620]);

  return (
    <AbsoluteFill style={{ background: INK, perspective: 1400 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          direction: "rtl",
          transform: `translateZ(${z}px) rotateX(${collapse * 22}deg)`,
          opacity: 1 - collapse,
        }}
      >
        {words.map((w, i) => {
          const v = p(rel, 4 + i * 7, 26 + i * 7);
          const drift = interpolate(v, [0, 1], [70, 0]);
          return (
            <Reveal key={w} v={v} style={{ transform: `translateY(${drift}px)` }}>
              <span
                style={{
                  fontFamily: AR,
                  fontSize: i === 3 ? 138 : 116,
                  fontWeight: 800,
                  lineHeight: 1.22,
                  color: i === 3 ? MINT : PAPER,
                  letterSpacing: "-0.01em",
                }}
              >
                {w}
              </span>
            </Reveal>
          );
        })}
      </div>

      {/* the strike: one rule crosses the sentence, then the frame folds away */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          height: 3,
          background: PAPER,
          transform: `scaleX(${p(rel, 90, 112)}) rotate(-14deg)`,
          transformOrigin: "0 50%",
          opacity: 0.9,
        }}
      />

      <div style={{ position: "absolute", right: 74, top: 96, fontFamily: MONO, fontSize: 13, letterSpacing: "0.36em", color: "rgba(243,245,248,0.42)", opacity: p(rel, 0, 20) }}>
        THE PROBLEM
      </div>
      <Grain f={f} o={0.06} />
      <Vignette s={0.6} />
    </AbsoluteFill>
  );
};

const ARCH = ["poster", "editorial", "silent", "index", "stack", "metric", "grid", "diptych", "caption", "marquee", "signature"];

const Grid: React.FC<{ f: number }> = ({ f }) => {
  const rel = f - 180;
  const push = p(rel, 0, 150, Easing.bezier(0.4, 0, 0.3, 1));
  const cols = 4;
  const rows = 6;
  const cw = W / cols;
  const ch = H / rows;

  return (
    <AbsoluteFill style={{ background: INK, perspective: 1500 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translateZ(${lerp(0, 140, push)}px) rotateX(${lerp(16, 0, push)}deg) scale(${lerp(1.18, 1, push)})`,
          transformOrigin: "50% 50%",
        }}
      >
        {[...Array(cols * rows)].map((_, i) => {
          const cx = i % cols;
          const cy = Math.floor(i / cols);
          const v = p(rel, 6 + (cx + cy) * 5, 30 + (cx + cy) * 5);
          const lit = hash(i * 3.7) > 0.62;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: cx * cw,
                top: cy * ch,
                width: cw - 2,
                height: ch - 2,
                background: lit ? `rgba(79,227,176,${0.10 + 0.09 * hash(i)})` : "rgba(243,245,248,0.05)",
                border: "1px solid rgba(243,245,248,0.12)",
                transform: `scale(${0.3 + 0.7 * v})`,
                opacity: v,
              }}
            />
          );
        })}

        {/* the names, flickering through the grid like a contact sheet index */}
        {ARCH.map((a, i) => {
          const cx = i % cols;
          const cy = 1 + Math.floor(i / cols);
          const on = p(rel, 20 + i * 5, 34 + i * 5) * (1 - p(rel, 104 + i * 3, 118 + i * 3));
          if (cy >= rows) return null;
          return (
            <span
              key={a}
              style={{
                position: "absolute",
                left: cx * cw + 14,
                top: cy * ch + 18,
                fontFamily: MONO,
                fontSize: 19,
                letterSpacing: "0.12em",
                color: MINT,
                opacity: on,
              }}
            >
              {a}
            </span>
          );
        })}
      </div>

      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ direction: "rtl", textAlign: "center", background: "rgba(5,7,10,0.82)", padding: "38px 44px", backdropFilter: "blur(2px)" }}>
          <Reveal v={p(rel, 58, 84)}>
            <div style={{ fontFamily: AR, fontSize: 96, fontWeight: 800, color: PAPER, lineHeight: 1.2 }}>إحدى عشرة صفحة.</div>
          </Reveal>
          <Reveal v={p(rel, 74, 100)}>
            <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.3em", color: MINT, marginTop: 20 }}>NOT ONE LAYOUT</div>
          </Reveal>
        </div>
      </div>

      <Grain f={f} o={0.055} />
      <Vignette s={0.55} />
    </AbsoluteFill>
  );
};

const Depth: React.FC<{ f: number }> = ({ f }) => {
  const rel = f - 330;
  const rot = lerp(-26, 8, p(rel, 0, 118, Easing.bezier(0.33, 1, 0.68, 1)));
  const sweep = lerp(-40, 140, p(rel, 30, 110, Easing.bezier(0.3, 0.9, 0.3, 1)));

  return (
    <AbsoluteFill style={{ background: INK, perspective: 900, perspectiveOrigin: "50% 50%" }}>
      <div
        style={{
          position: "absolute",
          left: W / 2 - 430,
          top: H / 2 - 250,
          width: 860,
          height: 500,
          transformStyle: "preserve-3d",
          transform: `rotateY(${rot}deg) rotateX(${-rot * 0.35}deg)`,
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              border: "1px solid rgba(243,245,248,0.13)",
              background: `linear-gradient(135deg, rgba(79,227,176,${0.05 + i * 0.012}), rgba(5,7,10,0.2))`,
              transform: `translateZ(${(i - 2) * 70}px)`,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeContent: "center",
            transform: "translateZ(220px)",
            background: `linear-gradient(110deg, transparent ${sweep - 30}%, rgba(243,245,248,0.16) ${sweep}%, transparent ${sweep + 30}%)`,
          }}
        >
          <span style={{ fontFamily: LAT, fontSize: 96, fontWeight: 700, letterSpacing: "0.26em", color: PAPER }}>NEXUS</span>
        </div>
      </div>

      <div style={{ position: "absolute", left: 74, right: 74, bottom: 190, direction: "rtl" }}>
        <Reveal v={p(rel, 60, 88)}>
          <div style={{ fontFamily: AR, fontSize: 76, fontWeight: 700, color: PAPER, lineHeight: 1.2 }}>
            العمق ليس زخرفة.
            <span style={{ color: MINT }}> بل مسافة.</span>
          </div>
        </Reveal>
      </div>
      <Grain f={f} o={0.05} />
      <Vignette s={0.62} />
    </AbsoluteFill>
  );
};

/** six cuts in four seconds — the type montage */
const TypeBeat: React.FC<{ f: number }> = ({ f }) => {
  const rel = f - 450;
  const n = 6;
  const cut = 120 / n; // 20 frames
  const i = Math.min(n - 1, Math.floor(rel / cut));
  const local = rel - i * cut;
  const t = p(local, 0, cut * 0.8, e);

  const frame = (children: React.ReactNode, bg: string, fg: string) => (
    <AbsoluteFill style={{ background: bg, color: fg, display: "grid", placeContent: "center" }}>
      {children}
    </AbsoluteFill>
  );

  let body: React.ReactNode;
  if (i === 0) {
    // tracking that tightens while the word scales down
    body = frame(
      <span style={{ fontFamily: LAT, fontSize: 130, fontWeight: 700, letterSpacing: `${lerp(0.5, -0.02, t)}em`, transform: `scale(${lerp(1.16, 1, t)})` }}>
        DECIDE
      </span>,
      INK,
      PAPER,
    );
  } else if (i === 1) {
    // a word pouring in from the top, line by line
    body = frame(
      <div style={{ direction: "rtl", textAlign: "center" }}>
        {["لا", "قالب."].map((w, k) => (
          <div key={w} style={{ fontFamily: AR, fontSize: k ? 150 : 110, fontWeight: 800, lineHeight: 1.06, clipPath: `inset(-45% -14% ${(1 - p(local, k * 3, 14 + k * 3)) * 100}% -14%)` }}>
            {w}
          </div>
        ))}
      </div>,
      INK,
      MINT,
    );
  } else if (i === 2) {
    // inverted: paper on ink becomes ink on paper
    body = (
      <AbsoluteFill style={{ background: PAPER, color: INK }}>
        {/* the inverted beat is the loudest thing in the reel, so it is composed:
            a black bar, a rule that draws, and one word that fills the width */}
        <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.34, height: 300, background: INK, transform: `scaleY(${p(local, 0, 8)})`, transformOrigin: "50% 50%" }} />
        <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: LAT, fontSize: 128, fontWeight: 700, letterSpacing: "0.16em", color: PAPER, transform: `scale(${lerp(1.12, 1, t)})` }}>LIGHT</div>
            <div style={{ fontFamily: LAT, fontSize: 128, fontWeight: 700, letterSpacing: "0.16em", color: MINT, marginTop: 2, opacity: t }}>BUILDS</div>
          </div>
        </div>
        <div style={{ position: "absolute", left: 74, bottom: 120, fontFamily: MONO, fontSize: 14, letterSpacing: "0.34em", color: "rgba(11,18,28,0.55)", opacity: t }}>
          SHAPE IS A CONSEQUENCE
        </div>
        <div style={{ position: "absolute", right: 74, top: 120, fontFamily: MONO, fontSize: 14, letterSpacing: "0.34em", color: "rgba(11,18,28,0.55)", opacity: t }}>
          02 / 06
        </div>
      </AbsoluteFill>
    );
  } else if (i === 3) {
    // split screen, opposing directions
    body = (
      <AbsoluteFill style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, background: INK, display: "grid", placeContent: "center", overflow: "hidden" }}>
          <span style={{ fontFamily: LAT, fontSize: 92, fontWeight: 700, color: PAPER, letterSpacing: "0.2em", transform: `translateX(${lerp(-120, 0, t)}px)` }}>MOTION</span>
        </div>
        <div style={{ flex: 1, background: MINT, display: "grid", placeContent: "center", overflow: "hidden" }}>
          <span style={{ fontFamily: LAT, fontSize: 92, fontWeight: 700, color: INK, letterSpacing: "0.2em", transform: `translateX(${lerp(120, 0, t)}px)` }}>MEANING</span>
        </div>
      </AbsoluteFill>
    );
  } else if (i === 4) {
    // radial wipe of a single letterform
    body = (
      <AbsoluteFill style={{ background: BLUE, display: "grid", placeContent: "center" }}>
        <div style={{ width: 560, height: 560, borderRadius: "50%", background: INK, clipPath: `circle(${lerp(0, 120, t)}% at 50% 50%)`, display: "grid", placeContent: "center" }}>
          <span style={{ fontFamily: LAT, fontSize: 210, fontWeight: 700, color: PAPER }}>N</span>
        </div>
      </AbsoluteFill>
    );
  } else {
    // the counter lands on the last word
    body = frame(
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: MONO, fontSize: 240, color: PAPER, letterSpacing: "-0.05em", lineHeight: 1 }}>
          {String(Math.round(lerp(999, 30, t))).padStart(3, "0")}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: "0.44em", color: MINT, marginTop: 10 }}>SECONDS</div>
      </div>,
      INK,
      PAPER,
    );
  }

  const whip = i > 0 && local < 3 ? 1 - p(local, 0, 3) : 0;

  return (
    <AbsoluteFill style={{ transform: `translateX(${whip * 90}px)`, filter: whip > 0 ? `blur(${whip * 14}px)` : undefined }}>
      {body}
      <Grain f={f} o={0.06} />
      <Vignette s={0.35} />
      <div style={{ position: "absolute", left: 74, bottom: 92, fontFamily: MONO, fontSize: 14, letterSpacing: "0.34em", color: "rgba(243,245,248,0.5)" }}>
        {String(i + 1).padStart(2, "0")} / 06
      </div>
    </AbsoluteFill>
  );
};

const Data: React.FC<{ f: number }> = ({ f }) => {
  const rel = f - 570;
  const grow = p(rel, 10, 96, e);
  const blocks = [
    { k: "hook", w: 0.16, c: MINT },
    { k: "place", w: 0.2, c: PAPER },
    { k: "place", w: 0.18, c: PAPER },
    { k: "evidence", w: 0.16, c: BLUE },
    { k: "number", w: 0.14, c: PAPER },
    { k: "end", w: 0.16, c: MINT },
  ];
  const total = blocks.reduce((n, b) => n + b.w, 0);

  return (
    <AbsoluteFill style={{ background: INK }}>
      <div style={{ position: "absolute", left: 74, right: 74, top: H * 0.22 }}>
        <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: "0.36em", color: "rgba(243,245,248,0.45)" }}>THE BEAT SHEET · 28s</div>
        <div style={{ marginTop: 34, display: "flex", height: 168, gap: 6 }}>
          {blocks.map((b, i) => {
            const on = p(rel, 14 + i * 8, 44 + i * 8);
            return (
              <div
                key={i}
                style={{
                  flex: `${b.w} 1 0`,
                  background: b.c === MINT ? `rgba(79,227,176,${0.16 + 0.2 * on})` : b.c === BLUE ? `rgba(126,162,255,${0.16 + 0.2 * on})` : `rgba(243,245,248,${0.07 + 0.1 * on})`,
                  borderTop: `2px solid ${b.c}`,
                  transform: `scaleY(${0.2 + 0.8 * on})`,
                  transformOrigin: "50% 0%",
                  opacity: on,
                }}
              />
            );
          })}
        </div>
        {/* the ruler under the blocks draws itself */}
        <div style={{ position: "relative", height: 1, background: "rgba(243,245,248,0.2)", marginTop: 2, transform: `scaleX(${grow})`, transformOrigin: "0 50%" }}>
          {[...Array(29)].map((_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${(i / 28) * 100}%`,
                top: 0,
                width: 1,
                height: i % 7 === 0 ? 16 : 7,
                background: "rgba(243,245,248,0.28)",
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontFamily: MONO, fontSize: 12, letterSpacing: "0.2em", color: "rgba(243,245,248,0.35)" }}>
          <span>00</span>
          <span>14</span>
          <span>28s</span>
        </div>
      </div>

      {/* three numbers, counted, each on its own beat */}
      <div style={{ position: "absolute", left: 74, right: 74, bottom: 260, display: "flex", justifyContent: "space-between", gap: 18 }}>
        {[
          { v: 11, l: "PAGES", at: 40 },
          { v: 4, l: "LANGUAGES", at: 58 },
          { v: 0, l: "UPLOADS", at: 76 },
        ].map((s) => {
          const on = p(rel, s.at, s.at + 26);
          return (
            <div key={s.l} style={{ flex: 1, opacity: on, transform: `translateY(${(1 - on) * 20}px)` }}>
              <div style={{ fontFamily: LAT, fontSize: 118, fontWeight: 700, color: PAPER, letterSpacing: "-0.04em", lineHeight: 1 }}>
                {Math.round(s.v * p(rel, s.at, s.at + 30))}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.3em", color: MINT, marginTop: 8 }}>
                {s.l}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 74, right: 74, top: H * 0.14, direction: "rtl", opacity: p(rel, 4, 26) }}>
        <div style={{ fontFamily: AR, fontSize: 62, fontWeight: 700, color: PAPER, lineHeight: 1.2 }}>كل ثانية مقصودة.</div>
      </div>
      <Grain f={f} o={0.05} />
      <Vignette s={0.55} />
    </AbsoluteFill>
  );
};

const Statement: React.FC<{ f: number }> = ({ f }) => {
  const rel = f - 690;
  const breathe = 1 + 0.018 * Math.sin(rel * 0.06);
  const ab = Math.max(0, 0.9 - rel * 0.02);
  return (
    <AbsoluteFill style={{ background: INK, justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `scale(${breathe})`, direction: "rtl", textAlign: "center", padding: "0 88px" }}>
        <Aberrate v={ab}>
          <div style={{ fontFamily: AR, fontSize: 112, fontWeight: 800, lineHeight: 1.26, color: PAPER }}>
            الفيلم قرار،
            <br />
            <span style={{ color: MINT }}>لا قالب.</span>
          </div>
        </Aberrate>
        <div style={{ marginTop: 40, fontFamily: LAT, fontSize: 20, letterSpacing: "0.46em", color: "rgba(243,245,248,0.44)", opacity: p(rel, 30, 62) }}>
          A FILM IS A DECISION
        </div>
      </div>
      <Grain f={f} o={0.075} />
      <Vignette s={0.7} />
    </AbsoluteFill>
  );
};

const Signature: React.FC<{ f: number }> = ({ f }) => {
  const rel = f - 810;
  const track = lerp(0.6, 0.28, p(rel, 4, 48));
  const dot = p(rel, 20, 34);
  return (
    <AbsoluteFill style={{ background: INK, justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 12 * dot, height: 12 * dot, borderRadius: 99, background: MINT, marginTop: 4 }} />
        <span style={{ fontFamily: LAT, fontSize: 92, fontWeight: 700, letterSpacing: `${track}em`, color: PAPER, opacity: p(rel, 0, 22) }}>NEXUS</span>
      </div>
      <Reveal v={p(rel, 30, 56)} style={{ marginTop: 26 }}>
        <div style={{ fontFamily: AR, fontSize: 40, color: "rgba(243,245,248,0.68)", direction: "rtl" }}>قُلها مرة واحدة.</div>
      </Reveal>
      <div style={{ width: 300, height: 1, background: "rgba(79,227,176,0.5)", marginTop: 34, transform: `scaleX(${p(rel, 44, 72)})` }} />
      <div style={{ marginTop: 22, fontFamily: MONO, fontSize: 13, letterSpacing: "0.42em", color: "rgba(243,245,248,0.4)", opacity: p(rel, 56, 78) }}>
        NEXUS.VITOBYTESTUDIO
      </div>
      <Grain f={f} o={0.05} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------- film */

export type ShowreelProps = { score?: string };

export const Showreel: React.FC<ShowreelProps> = ({ score }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: INK }}>
      {f < 54 ? <Open f={f} /> : null}
      {f >= 54 && f < 180 ? <Problem f={f} /> : null}
      {f >= 180 && f < 330 ? <Grid f={f} /> : null}
      {f >= 330 && f < 450 ? <Depth f={f} /> : null}
      {f >= 450 && f < 570 ? <TypeBeat f={f} /> : null}
      {f >= 570 && f < 690 ? <Data f={f} /> : null}
      {f >= 690 && f < 810 ? <Statement f={f} /> : null}
      {f >= 810 ? <Signature f={f} /> : null}
      {score && score.length > 32 ? <Audio src={score} /> : null}
    </AbsoluteFill>
  );
};
