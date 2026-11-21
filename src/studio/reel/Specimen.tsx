/**
 * SPECIMEN — eighteen seconds that prove the motion language works.
 *
 * No footage: this is the house grammar on its own, so the grammar can be
 * judged before it is applied to someone's clip.
 *
 *   bar 1  0.0 – 2.0   cold open · a hairline draws · camera push · dot field
 *   bar 2  2.0 – 4.0   "المونتاج" arrives by scale-through, not by fade
 *   bar 3  4.0 – 6.0   whip on the downbeat → "لغة."
 *   bar 4  6.0 – 8.0   mask-match carries "بصرية" in from the same shape
 *   bars 5–6 8.0 – 12  plates in 3D, parallax at three depths
 *   bars 7–9 12 – 18   the mark, built, with the camera still moving
 *
 * Every element is driven by camMove(), TextRise(), whipStyle(), maskMatch()
 * or scaleThrough(). If a device is not in that list, it is not in this film.
 */
import React from "react";
import { AbsoluteFill, Audio, useCurrentFrame } from "remotion";
import {
  BAR_F,
  BEAT_F,
  Cam,
  Hair,
  TextRise,
  camMove,
  cl,
  lerp,
  plate,
  plate2d,
  pulse,
  rnd,
  scaleThrough,
  smooth,
  stage,
  whipStyle,
  maskMatch,
} from "./motion";

export const FPS = 30;
export const DURATION = 540; // 18 s

const W = 1080;
const H = 1920;

// A deliberate grade for a no-footage study: warm paper, terracotta signal,
// steel for support. Nothing neon, nothing borrowed from a dev tool.
const INK = "#0A0C10";
const INK2 = "#141821";
const PAPER = "#F6F4EF";
const ACCENT = "#EE6A4E";
const STEEL = "#8FA6C4";

const AR = '"Cairo", "IBM Plex Sans Arabic", sans-serif';
const LAT = '"Space Grotesk", "Sora", sans-serif';
const MONO = '"JetBrains Mono", monospace';

/* ------------------------------------------------------------------ plates */

const DotField: React.FC<{ f: number; cam: Cam; depth: number; n?: number }> = ({ f, cam, depth, n = 46 }) => (
  <div style={{ position: "absolute", inset: 0, ...plate(cam, depth) }}>
    {[...Array(n)].map((_, i) => {
      const x = rnd(i) * W;
      const y = (rnd(i + 50) * H + f * (0.2 + rnd(i + 9) * 0.5) * depth) % H;
      const s = 2.4 + rnd(i + 3) * 4.4 * depth;
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: s,
            height: s,
            borderRadius: s,
            background: i % 9 === 0 ? ACCENT : PAPER,
            opacity: 0.14 + depth * 0.55,
          }}
        />
      );
    })}
  </div>
);

const Grid: React.FC<{ cam: Cam; depth: number; gap?: number; o?: number }> = ({ cam, depth, gap = 96, o = 0.05 }) => (
  <div
    style={{
      position: "absolute",
      inset: -gap,
      ...plate(cam, depth),
      opacity: o * 1.7,
      backgroundImage:
        "linear-gradient(to right, rgba(243,241,236,1) 1px, transparent 1px), linear-gradient(to bottom, rgba(243,241,236,1) 1px, transparent 1px)",
      backgroundSize: `${gap}px ${gap}px`,
    }}
  />
);

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

/* ------------------------------------------------------------------ scenes */

/** bar 1 — the cold open: almost nothing, and all of it moving */
const Cold: React.FC<{ f: number }> = ({ f }) => {
  const cam = camMove(f, 0, BAR_F, { push: 0.05, drift: 14 });
  const draw = smooth(f, 8, 40);
  return (
    <AbsoluteFill>
      <DotField f={f} cam={cam} depth={0.25} n={26} />
      <AbsoluteFill style={{ ...stage }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 420 }}>
          <Hair v={draw} c={PAPER} o={0.5} style={{ transformOrigin: "50% 50%" }} />
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 132, textAlign: "center" }}>
        <TextRise v={smooth(f, 14, 34)}>
          <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.5em", color: `${PAPER}88` }}>MOTION STUDY</span>
        </TextRise>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 120, textAlign: "center" }}>
        <TextRise v={smooth(f, 4, 22)}>
          <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.5em", color: `${ACCENT}CC` }}>01 / 05</span>
        </TextRise>
      </div>
    </AbsoluteFill>
  );
};

/** bars 2–3 — the word arrives from inside the lens, not from the edge */
const Word: React.FC<{ f: number }> = ({ f }) => {
  const a = BAR_F;
  const cam = camMove(f, a, a + BAR_F * 2, { push: 0.09, drift: 22, tilt: 0, rot: 0 });
  const enter = smooth(f, a + 2, a + 12);
  const leave = smooth(f, a + BEAT_F * 7, a + BAR_F * 2, (t) => t * t);

  return (
    <AbsoluteFill style={stage}>
      <Grid cam={cam} depth={0.15} gap={110} o={0.045} />
      <DotField f={f} cam={cam} depth={0.55} n={34} />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 760,
          textAlign: "center",
          direction: "rtl",
          ...plate2d(cam, 0.4),
        }}
      >
        <div
          style={{
            transform: `scale(${lerp(1.42, 1, enter)})`,
            opacity: 1 - leave,
            filter: enter < 0.92 ? `blur(${(1 - enter) * 8}px)` : undefined,
          }}
        >
          <div style={{ fontFamily: AR, fontSize: 168, fontWeight: 900, color: PAPER, lineHeight: 1.06, paddingBottom: "0.08em" }}>المونتاج</div>
          <div style={{ width: `${smooth(f, a + 10, a + 34) * 46}%`, maxWidth: 520, height: 2, background: ACCENT, margin: "20px auto 0" }} />
        </div>
      </div>

      <div style={{ position: "absolute", left: 84, right: 84, bottom: 150, display: "flex", justifyContent: "space-between" }}>
        <TextRise v={smooth(f, a + 16, a + 40)}>
          <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.4em", color: `${PAPER}66` }}>THE CUT</span>
        </TextRise>
        <TextRise v={smooth(f, a + 22, a + 46)}>
          <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.4em", color: `${PAPER}66` }}>02 / 05</span>
        </TextRise>
      </div>
    </AbsoluteFill>
  );
};

/** bar 4 — whip in, mask-match out: two transitions inside one second and a half */
const Language: React.FC<{ f: number }> = ({ f }) => {
  const a = BAR_F * 3;
  const cam = camMove(f, a, a + BAR_F * 2, { push: 0.07, drift: 26, rot: 4 });
  const mm = maskMatch(f, a + BEAT_F * 5, 16, "bar");

  return (
    <AbsoluteFill style={stage}>
      <Grid cam={cam} depth={0.2} gap={64} o={0.04} />
      <DotField f={f} cam={cam} depth={0.8} n={22} />

      <div style={{ position: "absolute", left: 0, right: 0, top: 700, textAlign: "center", direction: "rtl", ...plate2d(cam, 0.5) }}>
        <TextRise v={smooth(f, a + 1, a + 10)}>
          <div style={{ fontFamily: AR, fontSize: 184, fontWeight: 900, color: PAPER, lineHeight: 1.08, paddingBottom: "0.08em" }}>لغة.</div>
        </TextRise>
        <div style={{ marginTop: 14, clipPath: mm.on ? mm.clip : undefined }}>
          <TextRise v={smooth(f, a + BEAT_F * 5, a + BEAT_F * 5 + 10)}>
            <div style={{ fontFamily: AR, fontSize: 92, fontWeight: 700, color: ACCENT, lineHeight: 1.24 }}>بصرية</div>
          </TextRise>
        </div>
      </div>

      <div style={{ position: "absolute", left: 84, bottom: 150 }}>
        <TextRise v={smooth(f, a + 8, a + 30)}>
          <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.4em", color: `${PAPER}66` }}>03 / 05</span>
        </TextRise>
      </div>
    </AbsoluteFill>
  );
};

/** bars 5–6 — three plates at three depths; the camera never stops */
const Plates: React.FC<{ f: number }> = ({ f }) => {
  const a = BAR_F * 5;
  const cam = camMove(f, a, a + BAR_F * 2, { push: 0.13, drift: 30, tilt: 4, rot: 6 });
  const cards = [
    { depth: 0.3, cy: 470, w: 600, h: 250, c: "#171D27", label: "PICTURE" },
    { depth: 0.6, cy: 790, w: 750, h: 290, c: "#1D2534", label: "SOUND" },
    { depth: 0.9, cy: 1130, w: 640, h: 260, c: "#232C3D", label: "TYPE" },
  ];
  return (
    <AbsoluteFill style={stage}>
      <Grid cam={cam} depth={0.12} gap={120} o={0.05} />
      <AbsoluteFill style={plate2d(cam, 0.4)}>
        {cards.map((c, i) => {
          const v = smooth(f, a + 4 + i * 5, a + 20 + i * 5);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                margin: "0 auto",
                top: c.cy,
                width: c.w,
                height: c.h,
                transform: `translateY(${(1 - v) * 70}px) scale(${lerp(0.94, 1, v)})`,
                background: `linear-gradient(150deg, ${c.c}, ${INK})`,
                border: `1px solid ${PAPER}1F`,
                borderRadius: 8,
                opacity: v,
                boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
                display: "grid",
                placeContent: "center",
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.44em", color: `${PAPER}88` }}>{c.label}</span>
            </div>
          );
        })}
      </AbsoluteFill>

      <div style={{ position: "absolute", left: 0, right: 0, top: 196, textAlign: "center", direction: "rtl" }}>
        <TextRise v={smooth(f, a + 14, a + 30)}>
          <div style={{ fontFamily: AR, fontSize: 68, fontWeight: 800, color: PAPER }}>ثلاث طبقات</div>
        </TextRise>
        <TextRise v={smooth(f, a + 22, a + 38)}>
          <div style={{ fontFamily: AR, fontSize: 68, fontWeight: 800, color: ACCENT, marginTop: 2 }}>عمق واحد</div>
        </TextRise>
      </div>
      <div style={{ position: "absolute", right: 84, bottom: 150 }}>
        <TextRise v={smooth(f, a + 10, a + 32)}>
          <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.4em", color: `${PAPER}66` }}>04 / 05</span>
        </TextRise>
      </div>
    </AbsoluteFill>
  );
};

/** bars 7–9 — the mark, built while the camera is still settling */
const Mark: React.FC<{ f: number }> = ({ f }) => {
  const a = BAR_F * 7;
  const cam = camMove(f, a, DURATION, { push: 0.045, drift: 12 });
  const words = "VITO BYTE".split("");
  const beat = pulse(f);
  return (
    <AbsoluteFill style={stage}>
      <DotField f={f} cam={cam} depth={0.3} n={18} />
      <AbsoluteFill style={plate2d(cam, 0.4)}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 800, display: "flex", justifyContent: "center", transform: `scale(${1 + beat * 0.008})` }}>
          {words.map((ch, i) => (
            <span key={i} style={{ display: "inline-block", clipPath: smooth(f, a + 2 + i * 2, a + 16 + i * 2) < 1 ? `inset(-45% -20% ${(1 - smooth(f, a + 2 + i * 2, a + 16 + i * 2)) * 100}% -20%)` : undefined }}>
              <span
                style={{
                  display: "inline-block",
                  fontFamily: LAT,
                  fontSize: 132,
                  fontWeight: 700,
                  color: PAPER,
                  letterSpacing: "-0.03em",
                  whiteSpace: "pre",
                  paddingBottom: "0.08em",
                  transform: `translateY(${(1 - smooth(f, a + 2 + i * 2, a + 16 + i * 2)) * 40}%)`,
                }}
              >
                {ch}
              </span>
            </span>
          ))}
        </div>
        <div style={{ position: "absolute", left: "50%", top: 966, transform: "translateX(-50%)", width: `${smooth(f, a + 24, a + 54) * 44}%`, maxWidth: 560, height: 1, background: `${ACCENT}AA` }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 1006 }}>
          <TextRise v={smooth(f, a + 30, a + 52)}>
            <div style={{ fontFamily: AR, fontSize: 38, fontWeight: 700, color: `${PAPER}A6`, direction: "rtl", textAlign: "center" }}>استوديو وكلاء الذكاء الاصطناعي</div>
          </TextRise>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 1090, textAlign: "center", fontFamily: MONO, fontSize: 12, letterSpacing: "0.44em", color: `${PAPER}44`, opacity: smooth(f, a + 44, a + 64) }}>
          MONTAGE · MOTION · SOUND
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------------- film */

export type SpecimenProps = { score?: string };

export const Specimen: React.FC<SpecimenProps> = ({ score }) => {
  const f = useCurrentFrame();

  // transitions, all four of them on bar lines
  const whipA = whipStyle(f, BAR_F * 3, 1);
  const whipB = whipStyle(f, BAR_F * 5, 1);
  const sOut = scaleThrough(f, BAR_F * 7, 12, true);
  const sIn = scaleThrough(f, BAR_F * 7, 12, false);

  const inA = f < BAR_F * 3;
  const inB = f >= BAR_F * 3 && f < BAR_F * 5;
  const inC = f >= BAR_F * 5 && f < BAR_F * 7;
  const inD = f >= BAR_F * 7;

  return (
    <AbsoluteFill style={{ background: INK, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${INK2} 0%, ${INK} 52%, #05060A 100%)` }} />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "46%",
          width: "120vmax",
          height: "120vmax",
          transform: "translate(-50%,-50%)",
          background: `radial-gradient(circle, ${ACCENT}1A 0%, transparent 46%), radial-gradient(circle at 50% 60%, #8FA6C418 0%, transparent 52%)`,
        }}
      />

      {inA ? (
        <AbsoluteFill style={whipA}>
          {f < BAR_F ? <Cold f={f} /> : <Word f={f} />}
        </AbsoluteFill>
      ) : null}

      {inB ? (
        <AbsoluteFill style={whipB}>
          <Language f={f} />
        </AbsoluteFill>
      ) : null}

      {inC ? (
        <AbsoluteFill style={whipB}>
          <Plates f={f} />
        </AbsoluteFill>
      ) : null}

      {inD ? (
        <AbsoluteFill style={{ transform: `scale(${sIn.scale})`, opacity: sIn.opacity }}>
          <Mark f={f} />
        </AbsoluteFill>
      ) : null}

      {/* the outgoing plate keeps travelling, so the cut has velocity */}
      {f >= BAR_F * 7 - 6 && f < BAR_F * 7 ? (
        <AbsoluteFill style={{ transform: `scale(${sOut.scale})`, opacity: sOut.opacity }}>
          <Plates f={f} />
        </AbsoluteFill>
      ) : null}

      <Grain f={f} />
      {score && score.length > 32 ? <Audio src={score} /> : null}
    </AbsoluteFill>
  );
};
