/**
 * TALK — a portrait film, built from the clip and from the plan.
 *
 * The plan (src/studio/reel/plans/talk.json, written by studio/brief.mjs) says:
 *   grammar    portrait        speech covers 67 % of the clip, shots hold 1.6 s
 *   ornament   2 of 3          two design devices per shot, never three
 *   frame      ambient-letterbox  blurred self as the bed, sharp picture at 16:9
 *   type       arabic 64 · latin 76 · label 13 · wide tracking
 *
 * So the film does less than the last one, on purpose. No HUD, no shot counter,
 * no scan lines, no progress rail, no browser chrome. The footage is the film;
 * the type is a quiet witness. Two devices only: a rule that draws, and the
 * ledger of the three payments that are actually on the phone.
 */
import React from "react";
import { AbsoluteFill, Audio, Easing, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import PALETTE from "./palettes/talk.json";
import PLAN from "./plans/talk.json";

export const FPS = 30;
export const DURATION = 286;

const W = 1080;
const H = 1920;

/* every colour is read from the footage, not chosen */
const INK = PALETTE.ink;
const PAPER = PALETTE.paper;
const ACCENT = PALETTE.accent;
const SECOND = PALETTE.accent2;

const AR = '"Cairo", "IBM Plex Sans Arabic", sans-serif';
const LAT = '"Space Grotesk", "Sora", sans-serif';
const MONO = '"JetBrains Mono", monospace';

/* geometry, from the plan */
const PICTURE = { h: 608, top: 596 }; // 16:9 at 1080 wide
const TYPE = PLAN.decision.type;

/* timing, from the plan */
const S = (sec: number) => Math.round(sec * FPS);
const CUT = PLAN.measured.cuts.map(S);
const VOICE = PLAN.measured.speech.map((s) => ({ a: S(s.start), b: S(s.end) }));

const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const SOFT = Easing.bezier(0.22, 1, 0.36, 1);
const p = (f: number, a: number, b: number, fn: (t: number) => number = SOFT) => cl(fn(cl((f - a) / Math.max(1, b - a))));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ---------------------------------------------------------------- texture */

const Grain: React.FC<{ f: number }> = ({ f }) => (
  <div
    style={{
      position: "absolute",
      inset: -30,
      opacity: 0.03,
      mixBlendMode: "overlay",
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='160' height='160' filter='url(%23n)' opacity='0.6'/></svg>\")",
      backgroundPosition: `${(f * 9) % 160}px ${(f * 5) % 160}px`,
    }}
  />
);

/** text rises out of its own line, never out of a box that could cut a glyph */
const Rise: React.FC<{ v: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ v, children, style }) => (
  <span style={{ display: "block", clipPath: v >= 0.999 ? undefined : `inset(-45% -14% ${(1 - v) * 100}% -14%)`, ...style }}>
    <span style={{ display: "block" }}>{children}</span>
  </span>
);

/* ------------------------------------------------------------- the picture */

/**
 * ambient-letterbox: the same clip, blurred and pushed down, becomes the bed;
 * the sharp 16:9 sits inside it. This is how a wide clip belongs in a tall
 * frame without cropping a face or inventing chrome.
 */
const Picture: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const drift = 1 + 0.03 * Math.sin(t * 0.5);
  const shot = Math.max(0, CUT.findIndex((c, i) => f >= c && f < CUT[i + 1]));
  const local = f - (CUT[shot] ?? 0);
  const push = lerp(1, 1.03, cl(local / 70));

  return (
    <>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            inset: -80,
            transform: `scale(${drift})`,
            filter: "blur(46px) saturate(1.15) brightness(0.42)",
          }}
        >
          <OffthreadVideo src={staticFile("inbox/clip.mp4")} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
        </div>
        <AbsoluteFill style={{ background: `linear-gradient(180deg, ${INK}CC 0%, ${INK}55 34%, ${INK}00 52%, ${INK}66 74%, ${INK}F2 100%)` }} />
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: PICTURE.top,
          height: PICTURE.h,
          overflow: "hidden",
          background: "#000",
        }}
      >
        <div style={{ position: "absolute", inset: 0, transform: `scale(${push})` }}>
          <OffthreadVideo src={staticFile("inbox/clip.mp4")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        {/* the only grade on the picture: a soft fall at the edges */}
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${INK}33, transparent 18%, transparent 78%, ${INK}99)` }} />
      </div>
    </>
  );
};

/* ---------------------------------------------------------- device one: rule */

const Rule: React.FC<{ f: number; from: number; w?: number; color?: string }> = ({ f, from, w = 132, color = ACCENT }) => (
  <div style={{ width: w, height: 1, background: color, opacity: 0.55, transform: `scaleX(${p(f, from, from + 22)})`, transformOrigin: "right 50%" }} />
);

/* -------------------------------------------------------- device two: ledger */

// the three payments legible on the phone in shot 2
const LEDGER = [
  { amt: "29.00", ar: "اشتراك شهري", at: VOICE[1]?.a ?? S(2.08) },
  { amt: "15.50", ar: "عمولة", at: VOICE[2]?.a ?? S(3.64) },
  { amt: "15.50", ar: "عمولة", at: VOICE[4]?.a ?? S(5.12) },
];
const TOTAL = 29 + 15.5 + 15.5;

const Ledger: React.FC<{ f: number }> = ({ f }) => {
  const settle = p(f, S(6.52), S(6.52) + 26);
  const lift = lerp(0, -34, settle);
  const dim = lerp(1, 0.55, settle);

  return (
    <div
      style={{
        position: "absolute",
        left: 84,
        right: 84,
        top: PICTURE.top + PICTURE.h + 92,
        direction: "rtl",
        transform: `translateY(${lift}px)`,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 26, opacity: dim }}>
        {LEDGER.map((row, i) => {
          const v = p(f, row.at, row.at + 20);
          return (
            <div key={i} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", opacity: v }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                <span style={{ fontFamily: LAT, fontSize: TYPE.latin * 0.62, fontWeight: 500, color: PAPER, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>
                  ${row.amt}
                </span>
                <span style={{ fontFamily: AR, fontSize: TYPE.arabic * 0.52, fontWeight: 700, color: `${PAPER}B3` }}>{row.ar}</span>
              </div>
              <div style={{ width: 40, height: 1, background: `${PAPER}33` }} />
            </div>
          );
        })}
      </div>

      {/* the sum, arriving once the third line has landed */}
      <div style={{ marginTop: 34, opacity: settle, transform: `translateY(${(1 - settle) * 18}px)` }}>
        <Rule f={f} from={S(6.52)} w={560} />
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 22 }}>
          <span style={{ fontFamily: LAT, fontSize: TYPE.latin * 1.5, fontWeight: 700, color: PAPER, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>
            ${TOTAL.toFixed(2)}
          </span>
          <span style={{ fontFamily: AR, fontSize: TYPE.arabic * 0.66, fontWeight: 800, color: ACCENT, paddingBottom: 10 }}>في ثلاث إشعارات</span>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------ the quiet top */

const TopLine: React.FC<{ f: number }> = ({ f }) => {
  const inShot = Math.max(1, CUT.findIndex((c, i) => f >= c && f < CUT[i + 1]) + 1);
  return (
    <div style={{ position: "absolute", left: 84, right: 84, top: 116 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", opacity: p(f, 6, 30) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 6, height: 6, borderRadius: 6, background: ACCENT }} />
          <span style={{ fontFamily: MONO, fontSize: TYPE.label, letterSpacing: "0.34em", color: `${PAPER}77` }}>VITO BYTE</span>
        </div>
        <span style={{ fontFamily: MONO, fontSize: TYPE.label, letterSpacing: "0.34em", color: `${PAPER}44` }}>
          {String(inShot).padStart(2, "0")} · {String(CUT.length - 1).padStart(2, "0")}
        </span>
      </div>
      <div style={{ marginTop: 18, height: 1, background: `${PAPER}1F` }} />
    </div>
  );
};

/* ------------------------------------------------------------- the end card */

const EndCard: React.FC<{ f: number }> = ({ f }) => {
  const a = CUT[CUT.length - 1] - 2;
  const local = f - a;
  if (local < 0) return null;
  return (
    <AbsoluteFill style={{ background: INK }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "38%",
          width: "130vmax",
          height: "130vmax",
          transform: "translate(-50%,-50%)",
          background: `radial-gradient(circle, ${ACCENT}1F 0%, transparent 58%)`,
        }}
      />
      <div style={{ position: "absolute", left: 0, right: 0, top: "44%", textAlign: "center", direction: "rtl" }}>
        <Rise v={p(local, 2, 26)}>
          <div style={{ fontFamily: AR, fontSize: 56, fontWeight: 700, color: `${PAPER}AA`, lineHeight: 1.3 }}>إجمالي ما وصل</div>
        </Rise>
        <div style={{ fontFamily: LAT, fontSize: 196, fontWeight: 700, color: PAPER, letterSpacing: "-0.055em", lineHeight: 1, marginTop: 10, fontVariantNumeric: "tabular-nums" }}>
          ${lerp(0, TOTAL, p(local, 6, 34)).toFixed(2)}
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 26 }}>
          <div style={{ width: lerp(0, 300, p(local, 14, 40)), height: 1, background: `${ACCENT}88` }} />
        </div>
        <Rise v={p(local, 20, 44)}>
          <div style={{ fontFamily: AR, fontSize: 44, fontWeight: 800, color: ACCENT, marginTop: 26 }}>من ثلاثة إشعارات.</div>
        </Rise>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 120, textAlign: "center", opacity: p(local, 40, 66) }}>
        <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.42em", color: `${PAPER}55` }}>MOTION · VITO BYTE</span>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------ opening lift */

const Boot: React.FC<{ f: number }> = ({ f }) => {
  const lift = p(f, 6, 22, Easing.bezier(0.4, 0, 0.2, 1));
  if (lift >= 1) return null;
  return (
    <AbsoluteFill style={{ background: INK, transform: `translateY(${-100 * lift}%)` }}>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center" }}>
        <div style={{ width: lerp(10, 120, p(f, 2, 14)), height: 1, background: ACCENT, opacity: 0.8 }} />
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------- film */

export type TalkProps = { score?: string };

export const Talk: React.FC<TalkProps> = ({ score }) => {
  const f = useCurrentFrame();
  const endAt = CUT[CUT.length - 1];
  // a single frame of soft light on a cut, nothing more
  const last = [...CUT].reverse().find((c) => f >= c && c > 0) ?? -99;
  const d = f - last;
  const bloom = d === 0 && f > 10 ? 0.05 : 0;

  return (
    <AbsoluteFill style={{ background: INK, overflow: "hidden" }}>
      <Picture f={f} />
      {f < endAt ? (
        <>
          <TopLine f={f} />
          <Ledger f={f} />
        </>
      ) : null}
      {bloom ? <AbsoluteFill style={{ background: `rgba(244,246,250,${bloom})` }} /> : null}
      <Boot f={f} />
      <EndCard f={f} />
      <Grain f={f} />
      {score && score.length > 32 ? <Audio src={score} /> : null}
      <Audio src={staticFile("inbox/clip.mp4")} volume={1} />
    </AbsoluteFill>
  );
};
