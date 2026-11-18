/**
 * RIVIO · 0:48 proof of style — the first two movements of the launch film, built before a
 * single client frame arrives, so the craft is judged on evidence and not on adjectives.
 *
 *   timing     every entrance is driven by `src/phone/rivioVo.json`, written by
 *              `scripts/vo_beats.py`: the narration audio is measured (20 ms RMS envelope,
 *              floor = p20 of live frames, gate = floor + 12 dB) and the 14 read sentences are
 *              assigned to the measured speech blocks, so every sentence boundary lands inside a
 *              real silence of the recording. No typed-in timecodes anywhere in this file.
 *   palette    INK #05060A / SURFACE #0B0E16 / BLUE #4C8DFF = the user acted / VIOLET #8B5CF6 =
 *              it understood. Violet is a seasoning: the build prints an ink-share proof and 12 %
 *              is the ceiling.
 *   type       Space Grotesk 700 for voice, JetBrains Mono 500 for data. Nothing else. ASCII only:
 *              `scripts/fontlint.py` guards the register, and in this box a glyph outside every
 *              declared unicode-range does not fall back, it hangs the renderer.
 *   motion     one curve for the whole film: cubic-bezier(0.16, 1, 0.3, 1), 180-260 ms.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import VO from "./rivioVo.json";

export const RIVIO_FPS = 30;
export const RIVIO_TAIL = 96;
export const RIVIO_DURATION = (VO.lines[VO.lines.length - 1].end_f as number) + RIVIO_TAIL;

const W = 1080;
const H = 1920;
const INK = "#05060A";
const SURFACE = "#0B0E16";
const SURFHI = "#121826";
const HAIR = "rgba(150,168,255,0.14)";
const BLUE = "#4C8DFF";
const VIOLET = "#8B5CF6";
const WHITE = "#F4F6FF";
const STEEL = "#93A8CF";
const LAT = '"Space Grotesk", "Sora", sans-serif';
const MONO = '"JetBrains Mono", monospace';
const SOFT = Easing.bezier(0.16, 1, 0.3, 1);

const cl = (v: number) => Math.min(1, Math.max(0, v));
const p = (f: number, a: number, b: number, fn: (t: number) => number = SOFT) => cl(fn(cl((f - a) / Math.max(1, b - a))));
const out = (f: number, a: number, b: number) => 1 - p(f, a, b, Easing.in(Easing.quad));

type Line = { i: number; text: string; start_f: number; end_f: number };
const L = VO.lines as Line[];
const at = (i: number) => L[Math.min(i, L.length - 1)];
/** the sentence is on screen from its measured silence-in to its measured silence-out */
const vis = (f: number, i: number, pre = 3, post = 6) => {
  const s = at(i);
  return out(f, s.end_f - post, s.end_f + 2) * p(f, s.start_f - pre, s.start_f + 7);
};

/** the word we mark inside a sentence — a design decision, not a transcription claim */
const KEY: Record<number, string> = {
  0: "muscle", 1: "Thumb up", 2: "bill", 3: "four hundred", 4: "spending it on you",
  5: "Rivio", 6: "Black first", 7: "theme", 8: "light", 9: "one pixel",
  10: "one curve", 11: "230", 12: "acted", 13: "understood",
};

const Wordmark: React.FC<{ f: number; scale?: number; dim?: number }> = ({ f, scale = 1, dim = 1 }) => {
  const letters = ["R", "I", "V", "I", "O"];
  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: Math.round(18 * scale) }}>
      {letters.map((c, i) => (
        <div
          key={i}
          style={{
            fontFamily: LAT,
            fontWeight: 700,
            fontSize: Math.round(84 * scale),
            lineHeight: `${Math.round(96 * scale)}px`,
            letterSpacing: Math.round(6 * scale),
            color: WHITE,
            opacity: p(f, i * 3, i * 3 + 10) * dim,
            transform: `translateY(${(1 - p(f, i * 3, i * 3 + 12)) * 14 * scale}px)`,
          }}
        >
          {c}
        </div>
      ))}
    </div>
  );
};

/** kinetic subtitle: the sentence being read, with the marked word carrying the accent */
const Sub: React.FC<{ f: number; i: number; big?: boolean }> = ({ f, i, big = false }) => {
  const s = at(i);
  const a = vis(f, i);
  const key = KEY[i] ?? "";
  const parts = key ? s.text.split(new RegExp(`(${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i")) : [s.text];
  const size = big ? 46 : 38;
  return (
    <div
      style={{
        position: "absolute",
        left: 96,
        right: 96,
        bottom: 300,
        opacity: a,
        transform: `translateY(${(1 - p(f, s.start_f - 3, s.start_f + 9)) * 16}px)`,
        fontFamily: LAT,
        fontWeight: 700,
        fontSize: size,
        lineHeight: `${Math.round(size * 1.32)}px`,
        color: STEEL,
        textAlign: "center",
      }}
    >
      {parts.map((t, k) => (
        <span key={k} style={{ color: k % 2 === 1 ? WHITE : STEEL, opacity: k % 2 === 1 ? 1 : 0.86 }}>
          {t}
        </span>
      ))}
    </div>
  );
};

const HairRow: React.FC<{ y: number; f: number; w?: number; c?: string }> = ({ y, f, w = 1, c = HAIR }) => (
  <div style={{ position: "absolute", left: 0, right: 0, top: y, height: w, background: c, opacity: f }} />
);

/** Act I — the reflex: strips of feed-light travelling, no UI, no faces, nothing readable */
const Noise: React.FC<{ f: number }> = ({ f }) => {
  const n = 26;
  const speed = 6 + 22 * p(f, at(3).start_f, at(3).end_f);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      {Array.from({ length: n }).map((_, i) => {
        const x = ((i * 41) % W) + 8;
        const hgt = 90 + ((i * 61) % 320);
        const y = (((f * speed + i * 173) % (H + 400)) - 200) * (i % 2 ? 1 : -1);
        const acc = i % 7 === 0 ? VIOLET : i % 3 === 0 ? BLUE : "#1B2334";
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y < 0 ? y + H : y,
              width: 3 + (i % 4),
              height: hgt,
              borderRadius: 2,
              background: acc,
              opacity: (0.1 + 0.5 * (i % 5) / 5) * p(f, 0, 14) * out(f, at(4).end_f - 12, at(4).end_f),
            }}
          />
        );
      })}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          background: "radial-gradient(120% 80% at 50% 45%, rgba(5,6,10,0) 40%, rgba(5,6,10,0.92) 100%)",
        }}
      />
      <div style={{ position: "absolute", left: 0, right: 0, top: 196, textAlign: "center", fontFamily: MONO, fontSize: 26, lineHeight: "34px", letterSpacing: 4, color: STEEL, opacity: 0.62 * p(f, 6, 20) }}>
        THUMB UP · THUMB UP · THUMB UP
      </div>
      {at(3).start_f > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 760,
            textAlign: "center",
            fontFamily: MONO,
            fontWeight: 500,
            fontSize: 168,
            lineHeight: "180px",
            letterSpacing: -4,
            color: WHITE,
            opacity: vis(f, 3) * 0.9,
          }}
        >
          {Math.round(interpolate(f, [at(3).start_f, at(3).end_f], [0, 412], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))}
        </div>
      )}
      <Sub f={f} i={0} />
      <Sub f={f} i={1} />
      <Sub f={f} i={2} />
      <Sub f={f} i={3} big />
      <Sub f={f} i={4} big />
    </AbsoluteFill>
  );
};

/** the cut to nothing: 0.6 s of true black before the name is spoken */
const Drop: React.FC<{ f: number }> = ({ f }) => (
  <AbsoluteFill style={{ backgroundColor: INK, opacity: p(f, at(4).end_f - 14, at(4).end_f - 6) }} />
);

/** Act II — the surface is built in public: grid, card, hairline, one thing lit */
const Surface: React.FC<{ f: number }> = ({ f }) => {
  const b0 = at(5).start_f;
  const grid = p(f, b0 + 4, b0 + 26);
  const card = p(f, at(7).start_f - 4, at(7).start_f + 16);
  const decide = p(f, at(8).start_f, at(8).start_f + 18);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <HairRow key={`h${i}`} y={360 + i * 240} f={grid * 0.9} />
      ))}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={`v${i}`} style={{ position: "absolute", top: 0, bottom: 0, left: 168 + i * 248, width: 1, background: HAIR, opacity: grid * 0.7 }} />
      ))}

      <div style={{ position: "absolute", left: 0, right: 0, top: 250, textAlign: "center", opacity: p(f, b0, b0 + 12) }}>
        <Wordmark f={f - b0} scale={1} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 396,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 24,
          lineHeight: "32px",
          letterSpacing: 6,
          color: STEEL,
          opacity: 0.8 * p(f, b0 + 16, b0 + 30),
        }}
      >
        BLACK IS NOT A THEME
      </div>

      <div
        style={{
          position: "absolute",
          left: 132,
          right: 132,
          top: 640,
          height: 460,
          borderRadius: 16,
          border: `1px solid ${HAIR}`,
          background: SURFACE,
          opacity: card,
          transform: `translateY(${(1 - card) * 42}px) scale(${0.985 + 0.015 * card})`,
        }}
      >
        <div style={{ position: "absolute", left: 32, right: 32, top: 32, height: 1, background: HAIR }} />
        <div style={{ position: "absolute", left: 32, top: 0, width: 96, height: 3, borderRadius: 2, background: VIOLET, opacity: card }} />
        <div style={{ position: "absolute", left: 32, top: 74, display: "flex", flexDirection: "row", alignItems: "center", gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, background: SURFHI, border: `1px solid ${HAIR}` }} />
          <div style={{ fontFamily: LAT, fontWeight: 700, fontSize: 30, lineHeight: "36px", color: WHITE }}>
            curator
          </div>
          <div style={{ fontFamily: MONO, fontSize: 20, lineHeight: "36px", color: STEEL, opacity: 0.8 }}>60 sources · 9 cards</div>
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 32,
              right: 32 + i * 90,
              top: 178 + i * 62,
              height: 12,
              borderRadius: 6,
              background: "#1A2233",
              opacity: p(f, at(7).start_f + 18 + i * 5, at(7).start_f + 30 + i * 5) * card,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: 32,
            bottom: 34,
            width: 148,
            height: 44,
            borderRadius: 10,
            background: BLUE,
            opacity: p(f, at(8).start_f + 30, at(8).start_f + 42),
            boxShadow: "0 12px 40px rgba(76,141,255,0.28)",
          }}
        />
      </div>

      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={`d${i}`}
          style={{
            position: "absolute",
            left: 60 + (i % 2) * 520,
            top: i < 2 ? 1150 : 1358,
            width: 460,
            height: 180,
            borderRadius: 16,
            background: SURFACE,
            border: `1px solid ${HAIR}`,
            opacity: 0.18 + 0.1 * (i % 2),
            transform: `scale(${0.99 + 0.01 * decide})`,
          }}
        />
      ))}

      <Sub f={f} i={5} />
      <Sub f={f} i={6} />
      <Sub f={f} i={7} />
      <Sub f={f} i={8} big />
      {decide > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 1080, textAlign: "center", fontFamily: MONO, fontSize: 22, lineHeight: "30px", letterSpacing: 5, color: VIOLET, opacity: 0.85 * decide }}>
          WHAT DESERVES LIGHT
        </div>
      )}
    </AbsoluteFill>
  );
};

/** Act III — the craft sheet: ladder, curve, and what each colour is allowed to mean */
const Craft: React.FC<{ f: number }> = ({ f }) => {
  const b0 = at(9).start_f;
  const sizes = [12, 16, 24, 44, 84];
  const curve = p(f, at(10).start_f, at(10).start_f + 20);
  const ms = interpolate(f, [at(11).start_f, at(11).end_f], [40, 230], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dot = p(f, at(11).start_f + 6, at(11).start_f + 6 + 7);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      {sizes.map((s, i) => (
        <div
          key={s}
          style={{
            position: "absolute",
            left: 96,
            top: 420 + i * 118,
            fontFamily: LAT,
            fontWeight: 700,
            fontSize: s,
            lineHeight: `${Math.round(s * 1.25)}px`,
            color: WHITE,
            opacity: p(f, b0 + i * 4, b0 + i * 4 + 12) * out(f, at(10).end_f - 4, at(10).end_f + 10),
          }}
        >
          Rivio measures what it claims
          <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 20, lineHeight: "24px", color: STEEL, marginLeft: 18 }}>
            {s}
          </span>
        </div>
      ))}

      <div
        style={{
          position: "absolute",
          left: 96,
          right: 96,
          top: 1040,
          height: 300,
          borderRadius: 16,
          border: `1px solid ${HAIR}`,
          background: SURFACE,
          opacity: curve * out(f, at(11).end_f + 2, at(12).start_f),
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 888 300" fill="none">
          <path d="M40 260 C 182 44, 288 40, 848 40" stroke={BLUE} strokeWidth="2.5" opacity={curve} />
          <line x1="40" y1="260" x2="848" y2="260" stroke={HAIR} />
          <line x1="40" y1="40" x2="848" y2="40" stroke={HAIR} />
          <circle cx={40 + 808 * dot} cy={260 - 220 * dot} r="7" fill={VIOLET} opacity={curve} />
        </svg>
        <div style={{ position: "absolute", left: 24, top: 18, fontFamily: MONO, fontSize: 20, lineHeight: "26px", color: STEEL }}>
          cubic-bezier(0.16, 1, 0.3, 1)
        </div>
        <div style={{ position: "absolute", right: 24, top: 18, fontFamily: MONO, fontSize: 20, lineHeight: "26px", color: WHITE }}>
          {Math.round(ms)} ms
        </div>
      </div>

      {[{ c: BLUE, t: "BLUE = YOU ACTED", i: 12 }, { c: VIOLET, t: "VIOLET = IT UNDERSTOOD", i: 13 }].map((r, k) => (
        <div
          key={r.t}
          style={{
            position: "absolute",
            left: 96,
            right: 96,
            top: 1440 + k * 92,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 20,
            opacity: vis(f, r.i),
            transform: `translateX(${(1 - p(f, at(r.i).start_f, at(r.i).start_f + 10)) * -22}px)`,
          }}
        >
          <div style={{ width: 16, height: 16, borderRadius: 8, background: r.c }} />
          <div style={{ fontFamily: MONO, fontSize: 28, lineHeight: "36px", letterSpacing: 2, color: WHITE }}>{r.t}</div>
        </div>
      ))}

      <Sub f={f} i={9} />
      <Sub f={f} i={10} />
      <Sub f={f} i={11} />
    </AbsoluteFill>
  );
};

const End: React.FC<{ f: number }> = ({ f }) => {
  const b = at(13).end_f + 6;
  const a = p(f, b, b + 16);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 800, display: "flex", justifyContent: "center", opacity: a }}>
        <Wordmark f={f - b} scale={1.28} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 980, textAlign: "center", fontFamily: MONO, fontSize: 24, lineHeight: "32px", letterSpacing: 8, color: STEEL, opacity: 0.85 * p(f, b + 12, b + 26) }}>
        v0.9.4 · {Math.round(RIVIO_DURATION / RIVIO_FPS)}s · {RIVIO_DURATION} FRAMES
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1064, textAlign: "center", fontFamily: LAT, fontWeight: 700, fontSize: 40, lineHeight: "52px", color: WHITE, opacity: p(f, b + 22, b + 34) }}>
        You're early.
      </div>
      <HairRow y={1140} f={0.5 * p(f, b + 30, b + 44)} c="rgba(139,92,246,0.5)" />
    </AbsoluteFill>
  );
};

export const RivioTease: React.FC = () => {
  const f = useCurrentFrame();
  const noiseEnd = at(4).end_f;
  const surfEnd = at(9).start_f - 4;
  const endStart = at(13).end_f + 2;
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      {f <= noiseEnd + 6 && <Noise f={f} />}
      {f > noiseEnd - 16 && f < noiseEnd + 20 && <Drop f={f} />}
      {f > noiseEnd - 4 && f <= surfEnd && <Surface f={f} />}
      {f > surfEnd - 4 && f <= endStart && <Craft f={f} />}
      {f >= endStart && <End f={f} />}
    </AbsoluteFill>
  );
};
