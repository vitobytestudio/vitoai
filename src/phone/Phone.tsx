/**
 * «المقطع الهاتفي» — the phone clip, cut and finished.
 *
 * This one is different from every other film in the repo: the picture is not
 * generated. It is a real 1080×1920 phone recording (101.5 s at ~20 Mb/s) that came
 * through the Google Drive connector, and every number in this file was measured,
 * not decided:
 *
 *   cuts          five segments, each boundary snapped to a measured silence in the
 *                 voice itself (the noise floor is −66 dBFS, so a pause is a pause),
 *                 then quantised to whole frames: 209 / 165 / 161 / 218 / 70
 *   look          studio/comp.py --video: neural matte, background dimmed and cooled,
 *                 defocused only where the matte is confident, subject graded by S-curve
 *
 * So the type does less than it would in a synthetic film. The footage is the product;
 * the type signs it. Four accents on the cuts, one opener, one card — that is all.
 *
 * Nothing here claims a licence, a client, or a result the file does not contain.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";

export const FPS = 30;
/** 823 frames of picture + 77 frames of card = 30.00 s exactly */
export const PICTURE_END = 823;
export const DURATION = 900;

const W = 1080;
const H = 1920;

/* read off the treated frame, not off a mood board: cool bed, warm skin */
const INK = "#080A10";
const PAPER = "#F3F6FB";
const AMBER = "#E9A24B";
const STEEL = "#9FB4D0";

const AR = '"Cairo", "IBM Plex Sans Arabic", sans-serif';
const LAT = '"Space Grotesk", "Sora", sans-serif';
const MONO = '"JetBrains Mono", monospace';

/** frame starts of shots 2..5 — the measured cuts */
const CUTS = [0, 209, 374, 535, 753];
const ACCENT_LINES = ["قصٌّ على النَّفَس", "خلفيةٌ معزولة", "ضوءٌ مُطابَق", "صوتٌ بلا ترخيص"];

const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const SOFT = Easing.bezier(0.16, 1, 0.3, 1);
const p = (f: number, a: number, b: number, fn: (t: number) => number = SOFT) => cl(fn(cl((f - a) / Math.max(1, b - a))));
/* ------------------------------------------------------------------ type bits */

/** a line rises out of its own box; never a box that could clip a descender */
const Rise: React.FC<{ v: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ v, children, style }) => (
  <div style={{ overflow: "hidden", padding: "0.16em 0.1em", margin: "-0.16em -0.1em", ...style }}>
    <div style={{ transform: `translateY(${(1 - v) * 116}%)`, opacity: 0.2 + 0.8 * v }}>{children}</div>
  </div>
);

/** the rule that draws itself under a line — the house's one ornament here */
const Rule: React.FC<{ v: number; w?: number; color?: string; right?: boolean }> = ({ v, w = 260, color = AMBER, right }) => (
  <div
    style={{
      height: 3,
      width: w,
      background: color,
      transform: `scaleX(${v})`,
      transformOrigin: right ? "right center" : "left center",
      borderRadius: 2,
    }}
  />
);

/* ------------------------------------------------------------------ the picture */

const Picture: React.FC<{ f: number }> = ({ f }) => {
  const shot = Math.max(0, CUTS.findIndex((c, i) => f >= c && (i === CUTS.length - 1 || f < CUTS[i + 1])));
  const local = f - CUTS[shot];
  /* one imperceptible push per shot: 1.000 -> 1.018 over the shot, so a static
     tripod frame still has breath in it. Set on the picture, never on the face. */
  const push = interpolate(local, [0, 200], [1, 1.018], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: -4, transform: `scale(${push})` }}>
        <OffthreadVideo
          muted
          src={staticFile("inbox/clip.mp4")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      /* the only grade in the comp: the picture is already graded by comp.py */
      <AbsoluteFill style={{ background: `radial-gradient(120% 78% at 50% 40%, transparent 46%, ${INK}66 100%)` }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ movements */

const Opener: React.FC<{ f: number }> = ({ f }) => {
  const inA = p(f, 3, 17);
  const inB = p(f, 9, 24);
  const out = 1 - p(f, 44, 56);
  const k = Math.min(inA, inB) * out;
  if (k <= 0.001) return null;
  return (
    <div style={{ position: "absolute", left: 78, right: 78, top: 126, opacity: k, direction: "rtl" }}>
      <Rise v={inA} style={{ marginBottom: 18 }}>
        <div style={{ font: `500 27px ${MONO}`, color: STEEL, letterSpacing: "0.3em", direction: "ltr", textAlign: "right" }}>
          VITO BYTE STUDIO
        </div>
      </Rise>
      <Rise v={inB}>
        <div style={{ font: `800 96px ${AR}`, color: PAPER, lineHeight: 1.06 }}>
          من ١٠١ ثانية <span style={{ color: AMBER }}>إلى ٣٠</span>
        </div>
      </Rise>
      <div style={{ marginTop: 26, display: "flex", justifyContent: "flex-end" }}>
        <Rule v={inB} w={340} right />
      </div>
    </div>
  );
};

/** one line per cut, held ~26 frames, in the same bottom band — a rhythm, not a caption */
const Accents: React.FC<{ f: number }> = ({ f }) => {
  const shots = [CUTS[1], CUTS[2], CUTS[3], CUTS[4]];
  return (
    <>
      {shots.map((c, i) => {
        const inV = p(f, c + 4, c + 18);
        const outV = 1 - p(f, c + 30, c + 40);
        const k = Math.min(inV, outV);
        if (k <= 0.001) return null;
        return (
          <div key={i} style={{ position: "absolute", left: 78, right: 78, bottom: 214, opacity: k, direction: "rtl" }}>
            <Rise v={inV}>
              <div style={{ font: `800 68px ${AR}`, color: PAPER, lineHeight: 1.1 }}>{ACCENT_LINES[i]}</div>
            </Rise>
            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <Rule v={inV} w={200} right color={i === shots.length - 1 ? STEEL : AMBER} />
            </div>
          </div>
        );
      })}
    </>
  );
};

const Card: React.FC<{ f: number }> = ({ f }) => {
  const fade = p(f, PICTURE_END - 14, PICTURE_END + 8);
  if (fade <= 0.001) return null;
  const l1 = p(f, PICTURE_END + 4, PICTURE_END + 18);
  const l2 = p(f, PICTURE_END + 10, PICTURE_END + 24);
  const l3 = p(f, PICTURE_END + 16, PICTURE_END + 30);
  const word = "VITO BYTE";
  return (
    <AbsoluteFill style={{ opacity: fade, background: INK, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", gap: 6, direction: "ltr" }}>
        {word.split("").map((ch, i) => (
          <span
            key={i}
            style={{
              font: `700 108px ${LAT}`,
              color: PAPER,
              opacity: p(f, PICTURE_END + 2 + i * 1.6, PICTURE_END + 10 + i * 1.6),
              transform: `translateY(${(1 - p(f, PICTURE_END + 2 + i * 1.6, PICTURE_END + 10 + i * 1.6)) * 34}px)`,
              display: "inline-block",
              whiteSpace: "pre",
            }}
          >
            {ch}
          </span>
        ))}
      </div>
      <div style={{ marginTop: 30, opacity: l1 }}>
        <Rule v={l1} w={420} />
      </div>
      <div style={{ marginTop: 34, font: `800 62px ${AR}`, color: AMBER, opacity: l2, direction: "rtl" }}>
        مونتاجٌ يُقطع بالمعنى
      </div>
      <div style={{ marginTop: 54, display: "flex", gap: 26, opacity: l3, font: `500 30px ${MONO}`, color: STEEL, direction: "ltr" }}>
        <span>vitoai.studio</span>
        <span style={{ opacity: 0.45 }}>/</span>
        <span>@vitobytestudio</span>
      </div>
      <div style={{ position: "absolute", bottom: 96, font: `500 22px ${MONO}`, color: `${STEEL}99`, direction: "ltr", opacity: l3 }}>
        CUT ON MEASURED SILENCE · MATTE + DEFOCUS RUN LOCALLY
      </div>
    </AbsoluteFill>
  );
};

/** a rail the length of the film: honest furniture, one pixel, never a HUD */
const Rail: React.FC<{ f: number }> = ({ f }) => (
  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: `${PAPER}1F` }}>
    <div style={{ height: "100%", width: `${(f / DURATION) * 100}%`, background: AMBER, opacity: 0.85 }} />
  </div>
);

/* ------------------------------------------------------------------ the film */

export const Phone: React.FC = () => {
  const f = useCurrentFrame();
  const live = f < PICTURE_END;
  return (
    <AbsoluteFill style={{ width: W, height: H, background: "#000" }}>
      {live ? (
        <>
          <Picture f={f} />
          <Opener f={f} />
          <Accents f={f} />
        </>
      ) : null}
      <Card f={f} />
      <Rail f={f} />
    </AbsoluteFill>
  );
};
