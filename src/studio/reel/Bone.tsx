/**
 * BONE — the 30 s spot, cut as a printed spread.
 *
 * The two previous cuts failed for one reason: they were the same film with
 * chrome bolted on. This one throws the dark-room language out and goes back to
 * the advertising grammar that already worked — a page, a rule, a numeral, one
 * statement at a time — and it spends exactly two colours:
 *
 *     paper  #0A0D12      bone  #F2ECE3
 *
 * Nothing else. Depth comes from tint, scale and the grid; the only "effect" is
 * that a hairline draws itself and the type arrives from below by 24 px.
 *
 * The voiceover is the film. Its five sentences are the five cuts, so nothing
 * on screen can drift from what is being said:
 *
 *   01  0.0  Most founders burn ten thousand euros before landing their first
 *            real user.                                    → metric page
 *   02  4.0  They buy into bloated architectures and enterprise subscriptions
 *            they don't even need yet.                     → ledger page
 *   03 10.0  The game has fundamentally changed. Today, you build ultra-lean,
 *            automate the heavy lifting at the edge, and scale only when
 *            demand demands it.                             → stack page
 *   04 18.0  Lean, agile teams across Europe outperform legacy agencies ten
 *            times their size.                             → diptych page
 *   05 24.0  Stop building slow. Comment "SYSTEM" and we'll send the
 *            blueprint.                                    → signature
 */
import React from "react";
import { AbsoluteFill, Audio, Easing, useCurrentFrame } from "remotion";

export const FPS = 30;
export const DURATION = 900;

const W = 1080;
const H = 1920;

/** the two colours. Everything else is one of them at a tint. */
const PAPER = "#0A0D12";
const BONE = "#F2ECE3";
const ink = (a: number) => `rgba(242,236,227,${a})`;

const DISP = '"Space Grotesk", "Sora", sans-serif';
const MONO = '"JetBrains Mono", monospace';

/** one scale, real jumps — 118 / 92 / 64 / 46 / 28 / 13 */
const S = { xl: 118, lg: 92, md: 64, sm: 46, xs: 28, mono: 13 };

const PAD = 92;
const CONTENT = W - PAD * 2;

const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const p = (f: number, a: number, b: number, fn: (t: number) => number = EASE) => cl(fn(cl((f - a) / Math.max(1, b - a))));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const A1 = 0;
const A2 = 120; //  4 s
const A3 = 300; // 10 s
const A4 = 540; // 18 s
const A5 = 720; // 24 s
const END = 900;

/* ------------------------------------------------------------- the page */

/** type arrives from below. 24 px, ease-out, never bouncing. */
const Rise: React.FC<{ v: number; d?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ v, d = 24, children, style }) => (
  <div style={{ ...style, opacity: v, transform: `translateY(${(1 - v) * d}px)` }}>{children}</div>
);

/** the page furniture: a rule, a masthead, a folio. Identical in all five
 *  cuts, so the film reads as one printed object rather than five graphics. */
const Page: React.FC<{ f: number; index: string; section: string; folio: string; children: React.ReactNode }> = ({ f, index, section, folio, children }) => {
  const rule = p(f, 2, 20, Easing.bezier(0.65, 0, 0.35, 1));
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 118, height: 1, background: ink(0.22), transform: `scaleX(${rule})`, transformOrigin: "left" }} />
      <div
        style={{
          position: "absolute",
          left: PAD,
          right: PAD,
          top: 142,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: MONO,
          fontSize: S.mono,
          letterSpacing: "0.3em",
          color: ink(0.62),
          textTransform: "uppercase",
        }}
      >
        <span>vito byte</span>
        <span>{section}</span>
        <span>{index}</span>
      </div>
      {children}
      <div style={{ position: "absolute", left: PAD, right: PAD, bottom: 168, height: 1, background: ink(0.18), transform: `scaleX(${rule})`, transformOrigin: "left" }} />
      <div
        style={{
          position: "absolute",
          left: PAD,
          right: PAD,
          bottom: 122,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: MONO,
          fontSize: S.mono,
          letterSpacing: "0.3em",
          color: ink(0.42),
          textTransform: "uppercase",
        }}
      >
        <span>{folio}</span>
        <span>30 sec</span>
      </div>
    </AbsoluteFill>
  );
};

/* --------------------------------------------------------------- 01 cost */

const Cost: React.FC<{ f: number }> = ({ f }) => {
  const num = p(f, 10, 46, Easing.bezier(0.22, 1, 0.36, 1));
  const count = Math.round(lerp(0, 10000, num));
  const comma = count.toLocaleString("en-US");
  return (
    <Page f={f} index="01 / 05" section="the cost" folio="edge · ops">
      <div style={{ position: "absolute", left: PAD, top: 596, fontFamily: MONO, fontSize: S.mono, letterSpacing: "0.3em", color: ink(0.5), textTransform: "uppercase" }}>
        <Rise v={p(f, 8, 30)}>burned before the first real user</Rise>
      </div>

      <div style={{ position: "absolute", left: PAD, top: 664, right: PAD }}>
        <div
          style={{
            fontFamily: DISP,
            fontSize: 196,
            fontWeight: 700,
            letterSpacing: "-0.055em",
            lineHeight: 0.94,
            color: BONE,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span style={{ opacity: p(f, 8, 26), marginRight: "0.035em" }}>€</span>
          {comma}
        </div>
        <div
          style={{
            marginTop: 26,
            width: lerp(0, CONTENT, p(f, 26, 60, Easing.bezier(0.65, 0, 0.35, 1))),
            height: 2,
            background: BONE,
          }}
        />
      </div>

      <div style={{ position: "absolute", left: PAD, top: 986, width: 760 }}>
        <Rise v={p(f, 40, 68)}>
          <div style={{ fontFamily: DISP, fontSize: S.sm, lineHeight: 1.32, letterSpacing: "-0.015em", color: ink(0.9) }}>
            Most founders burn this before landing their first real user.
          </div>
        </Rise>
      </div>

      <div style={{ position: "absolute", left: PAD, right: PAD, top: 1216, display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: S.mono, letterSpacing: "0.26em", color: ink(0.4), textTransform: "uppercase" }}>
        <Rise v={p(f, 54, 80)}>avg. pre-seed spend</Rise>
        <Rise v={p(f, 58, 84)}>wasted · 100%</Rise>
      </div>
    </Page>
  );
};

/* ------------------------------------------------------------- 02 ledger */

const ROWS = [
  ["01", "bloated architecture", "needed later"],
  ["02", "enterprise seats", "unused"],
  ["03", "services on standby", "idle"],
  ["04", "a three-month roadmap", "still shipping"],
];

const Ledger: React.FC<{ f: number }> = ({ f }) => {
  const strike = p(f, 156, 178, Easing.bezier(0.65, 0, 0.35, 1));
  return (
    <Page f={f} index="02 / 05" section="the invoice" folio="edge · ops">
      <div style={{ position: "absolute", left: PAD, top: 486, right: PAD }}>
        <Rise v={p(f, 4, 30)}>
          <div style={{ fontFamily: DISP, fontSize: S.lg, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.02, color: BONE }}>
            They buy <span style={{ color: ink(0.42) }}>what they</span>
          </div>
        </Rise>
        <Rise v={p(f, 12, 38)}>
          <div style={{ fontFamily: DISP, fontSize: S.lg, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.02, color: BONE }}>
            don’t need yet.
          </div>
        </Rise>
      </div>

      <div style={{ position: "absolute", left: PAD, right: PAD, top: 828 }}>
        {ROWS.map((r, i) => {
          const v = p(f, 44 + i * 12, 62 + i * 12);
          return (
            <div key={r[0]} style={{ opacity: v, transform: `translateY(${(1 - v) * 14}px)` }}>
              <div style={{ height: 1, background: ink(0.16) }} />
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "26px 0 26px" }}>
                <span style={{ fontFamily: MONO, fontSize: S.mono, letterSpacing: "0.3em", color: ink(0.45) }}>{r[0]}</span>
                <span style={{ fontFamily: DISP, fontSize: S.xs, letterSpacing: "-0.01em", color: ink(0.92), flex: 1, marginLeft: 28 }}>{r[1]}</span>
                <span style={{ fontFamily: MONO, fontSize: S.mono, letterSpacing: "0.24em", color: ink(0.42), textTransform: "uppercase" }}>{r[2]}</span>
              </div>
            </div>
          );
        })}
        <div style={{ height: 1, background: ink(0.16) }} />
      </div>

      {/* the rule that closes the invoice — drawn under the ledger, not over it */}
      <div
        style={{
          position: "absolute",
          left: PAD,
          width: CONTENT * strike,
          top: 1180,
          height: 3,
          background: BONE,
        }}
      />

      <div style={{ position: "absolute", left: PAD, top: 1290, width: 720, opacity: p(f, 150, 176) }}>
        <div style={{ fontFamily: MONO, fontSize: S.mono, letterSpacing: "0.3em", color: ink(0.55), textTransform: "uppercase" }}>the fix is not a discount</div>
      </div>
    </Page>
  );
};

/* -------------------------------------------------------------- 03 stack */

const LINES = ["ultra-lean.", "automated", "at the edge."];

const Stack3: React.FC<{ f: number }> = ({ f }) => {
  const intro = 1 - p(f, 44, 60);
  const rise = p(f, 60, 82);
  return (
    <Page f={f} index="03 / 05" section="the change" folio="edge · ops">
      {/* the sentence the voiceover opens this cut with, alone for a moment */}
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 470, opacity: intro * p(f, 4, 26) }}>
        <div style={{ fontFamily: DISP, fontSize: S.md, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.1, color: BONE }}>The game has</div>
        <div style={{ fontFamily: DISP, fontSize: S.md, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.1, color: BONE }}>fundamentally changed.</div>
      </div>

      {/* then three words, one cut each */}
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 616, transform: `translateY(${(1 - rise) * 20}px)` }}>
        {LINES.map((l, i) => {
          const v = p(f, 60 + i * 16, 78 + i * 16);
          const dead = p(f, 60 + (i + 1) * 16, 78 + (i + 1) * 16);
          return (
            <div
              key={l}
              style={{
                fontFamily: DISP,
                fontSize: S.xl,
                fontWeight: 700,
                letterSpacing: "-0.05em",
                lineHeight: 0.96,
                color: i === 2 ? BONE : ink(0.94),
                opacity: v * (i < 2 ? 1 - dead * 0.72 : 1),
                marginBottom: 10,
              }}
            >
              {l}
            </div>
          );
        })}
      </div>

      <div style={{ position: "absolute", left: PAD, right: PAD, top: 1084, width: 720 }}>
        <Rise v={p(f, 116, 142)}>
          <div style={{ fontFamily: DISP, fontSize: S.sm, lineHeight: 1.3, letterSpacing: "-0.015em", color: ink(0.88) }}>
            Build lean. Automate the heavy lifting. Scale only when demand does.
          </div>
        </Rise>
      </div>
    </Page>
  );
};

/* ----------------------------------------------------------- 04 leverage */

const Leverage: React.FC<{ f: number }> = ({ f }) => {
  const big = p(f, 8, 44, Easing.bezier(0.22, 1, 0.36, 1));
  const barA = p(f, 60, 96, Easing.bezier(0.22, 1, 0.36, 1));
  const barB = p(f, 66, 110, Easing.bezier(0.22, 1, 0.36, 1));
  return (
    <Page f={f} index="04 / 05" section="the leverage" folio="edge · ops">
      <div style={{ position: "absolute", left: PAD, top: 470 }}>
        <div style={{ fontFamily: DISP, fontSize: 300, fontWeight: 700, letterSpacing: "-0.06em", lineHeight: 0.86, color: BONE, opacity: big }}>
          10<span style={{ fontSize: 190, letterSpacing: "-0.04em" }}>×</span>
        </div>
        <div style={{ marginTop: 18, fontFamily: MONO, fontSize: S.mono, letterSpacing: "0.3em", color: ink(0.5), textTransform: "uppercase", opacity: big }}>
          faster to market
        </div>
      </div>

      {/* two bars, drawn to the same baseline: the whole argument in one measure */}
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 930 }}>
        {[
          { label: "lean team", w: 1, v: barA, n: "10×", hot: true },
          { label: "legacy agency", w: 0.1, v: barB, n: "1×", hot: false },
        ].map((b) => (
          <div key={b.label} style={{ marginBottom: 62 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontFamily: MONO,
                fontSize: S.mono,
                letterSpacing: "0.26em",
                color: b.hot ? ink(0.75) : ink(0.42),
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              <span>{b.label}</span>
              <span>{b.n}</span>
            </div>
            <div style={{ height: 10, background: ink(0.12) }}>
              <div style={{ width: `${b.w * 100 * b.v}%`, height: 10, background: b.hot ? BONE : ink(0.4) }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", left: PAD, right: PAD, top: 1146, width: 760 }}>
        <Rise v={p(f, 120, 148)}>
          <div style={{ fontFamily: DISP, fontSize: S.sm, lineHeight: 1.3, letterSpacing: "-0.015em", color: ink(0.88) }}>
            Lean teams across Europe outrun agencies ten times their size.
          </div>
        </Rise>
      </div>
    </Page>
  );
};

/* ----------------------------------------------------------- 05 signature */

const Signature: React.FC<{ f: number }> = ({ f }) => {
  const local = f - A5;
  const mark = p(local, 4, 34);
  const track = lerp(0.34, 0.24, p(local, 4, 90));
  return (
    <Page f={f} index="05 / 05" section="stop building slow" folio="edge · ops">
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 656, textAlign: "center" }}>
        <div
          style={{
            fontFamily: DISP,
            fontSize: S.lg,
            fontWeight: 700,
            letterSpacing: `${track}em`,
            color: BONE,
            opacity: mark,
            marginRight: `-${track}em`,
          }}
        >
          SYSTEM
        </div>
        <div style={{ marginTop: 18, fontFamily: MONO, fontSize: S.mono, letterSpacing: "0.42em", color: ink(0.55), textTransform: "uppercase", opacity: p(local, 24, 52) }}>
          by vito byte
        </div>
      </div>

      <div style={{ position: "absolute", left: PAD, right: PAD, top: 940, textAlign: "center" }}>
        <Rise v={p(local, 54, 86)}>
          <div style={{ fontFamily: DISP, fontSize: S.sm, letterSpacing: "-0.015em", color: ink(0.94) }}>Comment “SYSTEM”.</div>
        </Rise>
        <Rise v={p(local, 66, 98)}>
          <div style={{ marginTop: 22, fontFamily: MONO, fontSize: S.mono, letterSpacing: "0.3em", color: ink(0.5), textTransform: "uppercase" }}>
            the blueprint · sent
          </div>
        </Rise>
      </div>

      {/* the closing rule draws itself once, then stops. nothing else moves. */}
      <div
        style={{
          position: "absolute",
          left: PAD,
          width: CONTENT * p(local, 40, 90, Easing.bezier(0.65, 0, 0.35, 1)),
          top: 1148,
          height: 2,
          background: BONE,
        }}
      />
    </Page>
  );
};

/* ---------------------------------------------------------------- film */

export type BoneProps = { score?: string; voice?: string };

export const Bone: React.FC<BoneProps> = ({ score, voice }) => {
  const f = useCurrentFrame();
  const cut = f < A2 ? 0 : f < A3 ? 1 : f < A4 ? 2 : f < A5 ? 3 : 4;
  // a two-frame dip to paper between cuts keeps the hard cuts from flickering
  // when the encoder meets a full-frame change.
  const seam = [A2, A3, A4, A5].reduce((acc, b) => Math.min(acc, Math.abs(f - b)), 99);
  return (
    <AbsoluteFill style={{ background: PAPER, overflow: "hidden" }}>
      {cut === 0 ? <Cost f={f} /> : null}
      {cut === 1 ? <Ledger f={f - A2} /> : null}
      {cut === 2 ? <Stack3 f={f - A3} /> : null}
      {cut === 3 ? <Leverage f={f - A4} /> : null}
      {cut === 4 ? <Signature f={f} /> : null}
      {seam < 2 ? <AbsoluteFill style={{ background: PAPER, opacity: 0.12 }} /> : null}
      {score && score.length > 32 ? <Audio src={score} /> : null}
      {voice && voice.length > 32 ? <Audio src={voice} /> : null}
    </AbsoluteFill>
  );
};

export const NO_OF_BONE = { W, H, END };
