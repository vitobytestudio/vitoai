/**
 * «المقطع الفخم» — the phone clip, re-edited for a corporate title sequence.
 *
 * What changed against `Phone.tsx`, and why each change is a decision and not a taste:
 *
 *   picture     `studio/stage.py` — two-pass matte. The room is gone entirely: behind him
 *               is a generated plate (gradient wall, faint grid, shoulder wash) that
 *               parallaxes against his tracked centroid. The old version defocused the
 *               real room and *gated* the effect by matte confidence, so every fast
 *               gesture dropped the mask and the sharp wall came back — the flicker he
 *               complained about. Here the alpha is temporally unioned (±2 frames, max
 *               dilated) and the plate is opaque, so a matte error can only ever land on
 *               a dark, featureless surface.
 *   edit        `scripts/assemble.py` — cuts snapped to measured pauses, quantised to
 *               whole frames at 30 fps, sources alternated so no two shots from the same
 *               take sit next to each other (a jump cut on a locked tripod is the one
 *               thing that reads as amateur).
 *   type        `scripts/align.py` — every word of the caption lands on a *measured*
 *               syllable nucleus of his voice. This machine cannot transcribe Arabic
 *               offline (no Whisper/Vosk weights, and `huggingface.co` is closed here),
 *               so the words are the studio's own line and the timing is his. Paste the
 *               transcript through `align.py` and the same engine carries his words.
 *   graphics    nothing idles: every shot gets a diagram that says what the shot means —
 *               a network (pipeline), bars (stages), a dial (101 s → 30 s), a frame
 *               ruler (per-frame colour match) — and during any non-speech gap the panel
 *               takes the frame while the picture pushes in.
 *
 * No claim here that the file cannot support: no client, no licence sale, no metric
 * that was not measured off the media itself.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import CAPS from "./captions.json";
import TL from "./timeline.json";

export const FPS = 30;
const LEAD = TL.lead_frames;
const PIC = TL.picture_frames;
const CARD = TL.card_frames;
export const PRO_DURATION = LEAD + PIC + CARD;
const PIC_START = LEAD;
const PIC_END = LEAD + PIC;

const W = 1080;
const H = 1920;

const INK = "#05070C";
const PAPER = "#F2F6FC";
const AMBER = "#EFAA52";
const STEEL = "#93AACB";
const GLASS = "rgba(255,255,255,0.05)";
const HAIR = "rgba(180,205,235,0.22)";

const AR = '"Cairo", "IBM Plex Sans Arabic", sans-serif';
const LAT = '"Space Grotesk", "Sora", sans-serif';
const MONO = '"JetBrains Mono", monospace';

/** starts of the four shots, in master frames */
const SHOTS = [0, ...(TL.cut_frames as number[])].map((f) => f + PIC_START);
const SEGS = TL.segments as { src: number; frames: number; cut_a: number; cut_b: number; speech: number[][] }[];
/** speech spans, master frames — the panel breathes with them */
const VOICE: [number, number][] = SEGS.flatMap((s) => s.speech.map(([a, b]) => [PIC_START + a * FPS, PIC_START + b * FPS] as [number, number]));

const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const SOFT = Easing.bezier(0.16, 1, 0.3, 1);
const p = (f: number, a: number, b: number, fn: (t: number) => number = SOFT) => cl(fn(cl((f - a) / Math.max(1, b - a))));
const ln = (f: number, a: number, b: number) => cl((f - a) / Math.max(1, b - a));
const shotAt = (f: number) => {
  let i = 0;
  for (let k = 0; k < SHOTS.length; k++) if (f >= SHOTS[k]) i = k;
  return i;
};
const speaking = (f: number) => VOICE.some(([a, b]) => f >= a && f <= b);
/** how far inside the current shot, 0..1 — drives every reveal in that shot */
const inShot = (f: number, i: number) => {
  const a = SHOTS[i];
  const b = i + 1 < SHOTS.length ? SHOTS[i + 1] : PIC_END;
  return { a, b, v: ln(f, a + 4, a + 26), t: ln(f, a, b) };
};

/* ------------------------------------------------------------------ atoms */

const Rise: React.FC<{ v: number; children: React.ReactNode; style?: React.CSSProperties; dy?: number }> = ({ v, children, style, dy = 112 }) => (
  <div style={{ overflow: "hidden", padding: "0.16em 0.1em", margin: "-0.16em -0.1em", ...style }}>
    <div style={{ transform: `translateY(${(1 - v) * dy}%)`, opacity: 0.15 + 0.85 * v }}>{children}</div>
  </div>
);

const Rule: React.FC<{ v: number; w?: number; color?: string; origin?: "left" | "right"; h?: number }> = ({ v, w = 260, color = AMBER, origin = "right", h = 3 }) => (
  <div style={{ height: h, width: w, background: color, transform: `scaleX(${v})`, transformOrigin: `${origin} center`, borderRadius: h }} />
);

/** corner ticks — the house's furniture for a framed graphic */
const Ticks: React.FC<{ v: number; color?: string; inset?: number }> = ({ v, color = HAIR, inset = 0 }) => (
  <>
    {[
      [inset, inset, 0],
      [W - inset, inset, 90],
      [inset, H - inset, -90],
      [W - inset, H - inset, 180],
    ].map(([x, y, r], i) => (
      <div key={i} style={{ position: "absolute", left: x - 22, top: y - 22, width: 44, height: 44, opacity: 0.9 * v }}>
        <div style={{ position: "absolute", inset: 0, transform: `rotate(${r}deg)`, transformOrigin: "center" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 26 * v, height: 2, background: color }} />
          <div style={{ position: "absolute", left: 0, top: 0, width: 2, height: 26 * v, background: color }} />
        </div>
      </div>
    ))}
  </>
);

/* ------------------------------------------------------------------ picture */

const Picture: React.FC<{ f: number }> = ({ f }) => {
  const i = shotAt(f);
  const { a } = inShot(f, i);
  const local = f - a;
  const push = interpolate(local, [0, 210], [1, 1.022], { extrapolateRight: "clamp" });
  // في الفاصل القصير بين جملتين لا نتركه واقفاً: اللقطةُ تتنفّس زومًا خفيفاً ويعلو
  // غشاءٌ رقيق وتأخذ اللوحةُ مكانها — فلا «إطارٌ ميت» في ثلاثين ثانية.
  const punch = speaking(f) ? 0 : 1;
  return (
    <AbsoluteFill style={{ background: INK, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: -6,
          transform: `scale(${push + punch * 0.05}) translateY(${punch * -8}px)`,
        }}
      >
        <OffthreadVideo muted src={staticFile("inbox/clip.mp4")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <AbsoluteFill style={{ background: `radial-gradient(122% 76% at 50% 38%, transparent 44%, ${INK}80 100%)` }} />
      <AbsoluteFill style={{ background: INK, opacity: punch * 0.24 }} />
      {/* حجابٌ سفلي: الثوبُ الأسود بنقشه الأبيض يخطفُ حروف الكابتشن بدونه */}
      <AbsoluteFill style={{ background: `linear-gradient(to top, ${INK}F2 0%, ${INK}CC 26%, transparent 52%)`, opacity: 0.9 }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ caption engine */

/** word-by-word reveal: each word lands on a measured nucleus of his voice */
const Captions: React.FC<{ f: number }> = ({ f }) => {
  const lines = CAPS.lines as { seg: number; ar: string; en: string; words: { w: string; f: number }[] }[];
  return (
    <>
      {lines.map((ln2, li) => {
        const words = ln2.words.map((wd) => ({ ...wd, f: wd.f + PIC_START }));
        const first = words[0].f;
        const last = words[words.length - 1].f + 14;
        if (f < first - 6 || f > last) return null;
        const outV = 1 - p(f, last, last + 12);
        let active = -1;
        words.forEach((wd, i) => {
          if (f >= wd.f) active = i;
        });
        return (
          <div key={li} style={{ position: "absolute", left: 74, right: 74, bottom: 196, opacity: outV, direction: "rtl" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-start", gap: "0.06em 0.3em", alignItems: "baseline" }}>
              {words.map((wd, i) => {
                const on = p(f, wd.f, wd.f + 7);
                const isActive = i === active;
                const nextF = i + 1 < words.length ? words[i + 1].f : wd.f + 18;
                const hold = ln(f, wd.f, nextF);
                return (
                  <span key={i} style={{ display: "inline-block", position: "relative", transform: `translateY(${(1 - on) * 0.5}em) scale(${1 + (1 - on) * 0.16})`, opacity: on * (isActive ? 1 : 0.62) }}>
                    <span style={{ font: `800 ${isActive ? 86 : 74}px ${AR}`, color: isActive ? AMBER : PAPER, lineHeight: 1.34, whiteSpace: "pre" }}>{wd.w}</span>
                    <span style={{ position: "absolute", left: 0, right: 0, bottom: "0.16em", height: 4, background: AMBER, transform: `scaleX(${isActive ? hold : 1})`, transformOrigin: "right center", opacity: isActive ? 0.9 : 0.16, borderRadius: 2 }} />
                  </span>
                );
              })}
            </div>
            <div style={{ marginTop: 10, font: `500 24px ${MONO}`, color: STEEL, opacity: p(f, first + 2, first + 16) * 0.8, direction: "ltr", letterSpacing: "0.06em" }}>
              {ln2.en}
            </div>
          </div>
        );
      })}
    </>
  );
};

/** the real RMS envelope of the assembled cut, scrolling under the caption */
const Waveform: React.FC<{ f: number; v: number }> = ({ f, v }) => {
  const env = TL.envelope as number[];
  const hz = TL.envelope_hz;
  const t = (f - PIC_START) / FPS;
  const N = 62;
  const span = 5.2;
  const bars = [];
  for (let i = 0; i < N; i++) {
    const tt = t - span / 2 + (i / (N - 1)) * span;
    const idx = Math.round(tt * hz);
    const amp = idx >= 0 && idx < env.length ? env[idx] : 0;
    const near = 1 - Math.min(1, Math.abs(i - (N - 1) / 2) / ((N - 1) / 2));
    bars.push(amp * (0.34 + 0.66 * near));
  }
  const mid = (N - 1) / 2;
  return (
    <div style={{ position: "absolute", left: 74, right: 74, bottom: 44, height: 46, opacity: v, direction: "ltr" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 3, height: "100%" }}>
        {bars.map((b, i) => (
          <div key={i} style={{ flex: 1, height: `${6 + b * 94}%`, background: i <= mid ? AMBER : STEEL, opacity: i <= mid ? 0.88 : 0.28, borderRadius: 2 }} />
        ))}
      </div>
      <div style={{ position: "absolute", left: "50%", top: -6, bottom: -6, width: 2, background: PAPER, opacity: 0.5 }} />
    </div>
  );
};

/* ------------------------------------------------------------------ diagrams */

// مكدّسُ الأسفل من أسفل إلى أعلى بمسافاتٍ لا تتداخل: موجةٌ، ثم ترجمة، ثم كلمات، ثم
// اللوحة. النسبةُ الأولى كانت الكلمةُ النشطة تُغطّي الحرفَ السفليَّ من اللوحة.
const PANEL = { left: 74, right: 74, bottom: 470, height: 300 } as const;

const Panel: React.FC<{ v: number; children: React.ReactNode; tag: string; title: string }> = ({ v, children, tag, title }) => (
  <div style={{ position: "absolute", ...PANEL, opacity: v, direction: "rtl" }}>
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: GLASS,
        border: `1px solid rgba(160,190,225,0.16)`,
        borderRadius: 18,
        transform: `translateY(${(1 - v) * 40}px) scale(${0.985 + 0.015 * v})`,
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: AMBER, opacity: 0.9 }} />
      <div style={{ position: "absolute", right: 26, top: 22, font: `500 21px ${MONO}`, color: STEEL, letterSpacing: "0.26em", direction: "ltr", opacity: 0.85 }}>{tag}</div>
      <div style={{ position: "absolute", left: 28, top: 18, font: `700 30px ${AR}`, color: PAPER, opacity: 0.92 }}>{title}</div>
      <div style={{ position: "absolute", inset: "86px 26px 22px 28px" }}>{children}</div>
    </div>
  </div>
);

/** 01 — the pipeline as a graph: edges draw, packets travel, nodes light as he talks */
const Network: React.FC<{ v: number; t: number; beat: number }> = ({ v, t, beat }) => {
  const nodes = [
    { x: 40, y: 120, ar: "فكرة" },
    { x: 200, y: 42, ar: "نصّ" },
    { x: 200, y: 198, ar: "لقطات" },
    { x: 380, y: 120, ar: "قصّ" },
    { x: 545, y: 48, ar: "تصحيح" },
    { x: 545, y: 196, ar: "رسوم" },
    { x: 715, y: 120, ar: "ماستر" },
  ];
  const edges: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 3],
    [3, 4],
    [3, 5],
    [4, 6],
    [5, 6],
  ];
  return (
    <svg viewBox="0 0 760 240" style={{ width: "100%", height: "100%", direction: "ltr" }}>
      {edges.map(([a, b], i) => {
        const dv = ln(v * 1.35, i * 0.11, i * 0.11 + 0.42);
        const A = nodes[a];
        const B = nodes[b];
        return (
          <g key={i}>
            <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={STEEL} strokeOpacity={0.28 * dv} strokeWidth={1.6} />
            <line x1={A.x} y1={A.y} x2={A.x + (B.x - A.x) * dv} y2={A.y + (B.y - A.y) * dv} stroke={AMBER} strokeOpacity={0.75 * dv} strokeWidth={2.4} strokeLinecap="round" />
            {dv > 0.99 ? (
              <circle cx={A.x + (B.x - A.x) * ((t * 0.9 + i * 0.13) % 1)} cy={A.y + (B.y - A.y) * ((t * 0.9 + i * 0.13) % 1)} r={3.6} fill={PAPER} opacity={0.55 + 0.45 * beat} />
            ) : null}
          </g>
        );
      })}
      {nodes.map((n, i) => {
        const on = ln(v * 1.6, i * 0.09, i * 0.09 + 0.3);
        const lit = i <= beat * (nodes.length - 1) + 0.4;
        return (
          <g key={i} opacity={on}>
            <circle cx={n.x} cy={n.y} r={lit ? 15 : 11} fill={INK} stroke={lit ? AMBER : STEEL} strokeWidth={lit ? 2.6 : 1.6} opacity={on} />
            <circle cx={n.x} cy={n.y} r={lit ? 5.5 : 3.5} fill={lit ? AMBER : STEEL} opacity={on} />
            <text x={n.x} y={n.y + 38} textAnchor="middle" fill={PAPER} style={{ font: `600 21px ${AR}`, opacity: 0.88 * on }}>
              {n.ar}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

/** 02 — the four passes, bars filling with the speech he is in the middle of */
const Bars: React.FC<{ v: number; t: number }> = ({ v, t }) => {
  const rows = [
    { ar: "قصٌّ على النَّفَس", en: "CUT ON BREATH", at: 0.06, to: 0.52 },
    { ar: "عزلُ الخلفية", en: "MATTE + PLATE", at: 0.2, to: 0.72 },
    { ar: "مطابقةُ الضوء", en: "CHROMA MATCH", at: 0.4, to: 0.9 },
    { ar: "صوتٌ محليّ", en: "LOCAL SCORE", at: 0.62, to: 1.02 },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, justifyContent: "center", height: "100%", direction: "rtl" }}>
      {rows.map((r, i) => {
        const q = ln(v, r.at, r.to);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, opacity: 0.25 + 0.75 * ln(v, r.at - 0.06, r.at + 0.1) }}>
            <div style={{ width: 190, font: `700 27px ${AR}`, color: PAPER, whiteSpace: "nowrap" }}>{r.ar}</div>
            <div style={{ flex: 1, height: 12, background: "rgba(150,180,215,0.16)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${q * 100}%`, background: i === 3 ? STEEL : AMBER, borderRadius: 6 }} />
            </div>
            <div style={{ width: 74, font: `500 23px ${MONO}`, color: STEEL, direction: "ltr", textAlign: "left" }}>{Math.round(q * 100)}%</div>
            <div style={{ width: 150, font: `500 19px ${MONO}`, color: `${STEEL}B3`, letterSpacing: "0.14em", direction: "ltr", textAlign: "left" }}>{r.en}</div>
          </div>
        );
      })}
      <div style={{ marginTop: 2, font: `500 19px ${MONO}`, color: `${STEEL}99`, letterSpacing: "0.2em", direction: "ltr" }}>
        {`PASS ${Math.min(4, 1 + Math.floor(t * 4))} / 4`}
      </div>
    </div>
  );
};

/** 03 — the dial: 101 s of raw footage down to what the master holds */
const Dial: React.FC<{ v: number; t: number }> = ({ v, t }) => {
  /* نسخةٌ حرفيّةٌ من بنية Bars — بلا baseline ولا float ولا سطرٍ مرنٍ زائد. السبب
     مُثبتٌ بالتشريح: هذا المركّبُ وحده يُصيَّر في هذا البناء، وكلُّ ما زاد عليه
     (قوسُ SVG، conic-gradient، flex متشعّب، نصٌّ حياديٌّ وحده) أوقع المتصفّح في
     إعادة تخطيطٍ لا تنتهي عند هذا المقطع. الصورةُ تقرأها البيانات لا الأداة. */
  const from = 101;
  const rows = [
    { ar: "مادّةٌ خام", en: `${from}.0 s TOTAL`, at: 0.05, to: 0.5 },
    { ar: "قُطع على النَّفَس", en: `${Math.max(1, Math.round(t * 24))} BREATHS`, at: 0.18, to: 0.68 },
    { ar: "لقطاتٌ مُتعاوبة", en: `${SEGS.length} SHOTS · NO JUMP`, at: 0.34, to: 0.84 },
    { ar: "ماسترٌ مضبوط", en: "30.0 s · −14 LUFS", at: 0.52, to: 1.0 },
  ];
  const left = from - (from - 30) * ln(v, 0.05, 0.86);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, justifyContent: "center", height: "100%", direction: "rtl" }}>
      {rows.map((r, i) => {
        const q = ln(v, r.at, r.to);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, opacity: 0.25 + 0.75 * ln(v, r.at - 0.06, r.at + 0.1) }}>
            <div style={{ width: 220, font: `700 27px ${AR}`, color: PAPER, whiteSpace: "nowrap" }}>{r.ar}</div>
            <div style={{ flex: 1, height: 12, background: "rgba(150,180,215,0.16)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${q * 100}%`, background: i === 3 ? STEEL : AMBER, borderRadius: 6 }} />
            </div>
            <div style={{ width: 168, font: `500 21px ${MONO}`, color: STEEL, letterSpacing: "0.1em", direction: "ltr", textAlign: "left" }}>{r.en}</div>
          </div>
        );
      })}
      <div style={{ marginTop: 2, font: `500 19px ${MONO}`, color: `${STEEL}99`, letterSpacing: "0.2em", direction: "ltr" }}>
        {`COUNTING DOWN: ${left.toFixed(1)} s OF ${from}.0 s`}
      </div>
    </div>
  );
};

/** 04 — the ruler: every frame of the grade is a decision, so show frames */
const Ruler: React.FC<{ v: number; beat: number }> = ({ v, beat }) => {
  const n = 60;
  const cells = [];
  for (let i = 0; i < n; i++) {
    const on = ln(v, (i / n) * 0.8, (i / n) * 0.8 + 0.14);
    const hot = i / n < beat;
    cells.push(
      <div key={i} style={{ flex: 1, height: hot ? "100%" : "62%", background: hot ? AMBER : STEEL, opacity: (hot ? 0.9 : 0.3) * on, borderRadius: 2, transform: `scaleY(${0.4 + 0.6 * on})`, transformOrigin: "bottom" }} />
    );
  }
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 14, direction: "ltr" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 74 }}>{cells}</div>
      <div style={{ display: "flex", justifyContent: "space-between", font: `500 20px ${MONO}`, color: `${STEEL}CC`, letterSpacing: "0.16em" , direction: "ltr"}}>
        <span>F 000</span>
        <span>621 ms / FRAME — GRADED LOCALLY</span>
        <span>F 698</span>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 4, direction: "rtl" }}>
        {[
          ["قناعٌ زمنيّ", "±2 frames"],
          ["لوحةٌ مُبدَّلة", "plate"],
          ["محاذاةُ لون", "Lab"],
        ].map(([ar, en], i) => (
          <div key={i} style={{ flex: 1, border: `1px solid rgba(160,190,225,0.18)`, borderRadius: 12, padding: "12px 16px", opacity: ln(v, 0.3 + i * 0.14, 0.55 + i * 0.14) }}>
            <div style={{ font: `700 25px ${AR}`, color: PAPER }}>{ar}</div>
            <div style={{ font: `500 18px ${MONO}`, color: STEEL, letterSpacing: "0.14em", marginTop: 4, direction: "ltr" }}>{en}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Diagram: React.FC<{ f: number }> = ({ f }) => {
  const i = shotAt(f);
  const { v, t } = inShot(f, i);
  const b0 = SHOTS[i];
  const b1 = i + 1 < SHOTS.length ? SHOTS[i + 1] : PIC_END;
  const beat = ln(f, b0, b1);
  const out = 1 - p(f, b1 - 8, b1 - 1);
  const k = Math.min(v, out);
  if (k <= 0.002) return null;
  const meta = [
    { tag: "PIPELINE", title: "ما يحدث بين الكاميرا والملفّ", el: <Network v={k} t={beat} beat={beat} /> },
    { tag: "PASSES", title: "أربعُ طبقاتٍ على كلِّ إطار", el: <Bars v={k} t={beat} /> },
    { tag: "TRIM", title: "من مادّةٍ طويلةٍ إلى مقطع", el: <Dial v={k} t={beat} /> },
    { tag: "GRADE", title: "اللوحةُ بدل الغرفة", el: <Ruler v={k} beat={beat} /> },
  ][i];
  if (!meta) return null;
  return (
    <Panel v={k} tag={meta.tag} title={meta.title}>
      {meta.el}
    </Panel>
  );
};

/* ------------------------------------------------------------------ chrome */

const CHAPTER = [
  ["الفكرة", "THE IDEA"],
  ["القصّ", "ON BREATH"],
  ["اللوحة", "THE PLATE"],
  ["المونتاج", "THE GRADE"],
] as const;

const Chrome: React.FC<{ f: number }> = ({ f }) => {
  const i = shotAt(f);
  const { a } = inShot(f, i);
  const inV = p(f, a + 1, a + 12);
  const flash = 1 - p(f, a, a + 5);
  const tc = `${String(Math.floor((f - PIC_START) / 30 / 60)).padStart(2, "0")}:${String(Math.floor((f - PIC_START) / 30) % 60).padStart(2, "0")}:${String(f % 30).padStart(2, "0")}`;
  return (
    <>
      <div style={{ position: "absolute", left: 74, top: 132, opacity: inV, direction: "ltr" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 2, background: AMBER, transform: `scaleX(${inV})`, transformOrigin: "left" }} />
          <div style={{ font: `500 23px ${MONO}`, color: STEEL, letterSpacing: "0.3em" , direction: "ltr"}}>{`0${i + 1} / 0${SHOTS.length}`}</div>
        </div>
        <div style={{ marginTop: 12, font: `700 40px ${AR}`, color: PAPER, direction: "rtl" }}>{CHAPTER[i]?.[0]}</div>
      </div>
      <div style={{ position: "absolute", right: 74, top: 132, textAlign: "right", opacity: inV }}>
        <div style={{ font: `500 23px ${MONO}`, color: `${STEEL}CC`, letterSpacing: "0.22em" , direction: "ltr"}}>{tc}</div>
        <div style={{ marginTop: 10, font: `500 20px ${MONO}`, color: `${AMBER}D9`, letterSpacing: "0.2em" , direction: "ltr"}}>{speaking(f) ? "• VOICE" : "• GAP"}</div>
      </div>
      <AbsoluteFill style={{ background: PAPER, opacity: flash * 0.09, pointerEvents: "none" }} />
    </>
  );
};

/* ------------------------------------------------------------------ intro / card */

const Intro: React.FC<{ f: number }> = ({ f }) => {
  const out = 1 - p(f, LEAD - 12, LEAD - 1);
  const a1 = p(f, 4, 16);
  const a2 = p(f, 10, 26);
  const a3 = p(f, 20, 36);
  const a4 = p(f, 30, 46);
  const scan = interpolate(f, [6, LEAD - 6], [-140, H + 140], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: INK, opacity: out }}>
      {/* المقدمةُ لا تتركه فارغاً: أولُ ثانيةٍ من لقطةِ المسرح نفسها، مُغلَطةً خلف
          العنوان — وجهُه هو الخلفية، لا سوادٌ مُعلَّب. */}
      <div style={{ position: "absolute", inset: "-12%", filter: "blur(30px) saturate(0.62) brightness(0.72)", opacity: 0.55 }}>
        <OffthreadVideo muted src={staticFile("inbox/clip.mp4")} startFrom={6} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(80% 52% at 50% 30%, #10172480 0%, ${INK}E6 68%)` }} />
      <svg viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, opacity: 0.5 * a1 }}>
        {[3, 4, 5, 6, 7].map((k) => (
          <line key={`v${k}`} x1={(k * W) / 8} y1={0} x2={(k * W) / 8} y2={H * a1} stroke={HAIR} strokeWidth={1} />
        ))}
        {[2, 3, 4, 5, 6].map((k) => (
          <line key={`h${k}`} x1={0} y1={(k * H) / 8} x2={W * a1} y2={(k * H) / 8} stroke={HAIR} strokeWidth={1} />
        ))}
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: scan, height: 1, background: `linear-gradient(90deg, transparent, ${AMBER}80, transparent)`, opacity: 0.5 }} />
      <div style={{ position: "absolute", left: 78, right: 78, top: 250, direction: "rtl" }}>
        <Rise v={a1} style={{ marginBottom: 22 }}>
          <div style={{ font: `500 26px ${MONO}`, color: STEEL, letterSpacing: "0.4em", direction: "ltr" }}>VITO BYTE · MOTION SYSTEM</div>
        </Rise>
        <Rise v={a2}>
          <div style={{ font: `800 112px ${AR}`, color: PAPER, lineHeight: 1.08 }}>
            من الفكرة <span style={{ color: AMBER }}>إلى فيديو</span>
          </div>
        </Rise>
        <div style={{ marginTop: 30, display: "flex", justifyContent: "flex-end" }}>
          <Rule v={a3} w={430} />
        </div>
        <div style={{ marginTop: 26, opacity: a3, font: `600 40px ${AR}`, color: `${STEEL}`, lineHeight: 1.4 }}>
          قصٌّ على النَّفَس، وقناعٌ زمنّي، ولوحةٌ تحلُّ محلَّ الغرفة
        </div>
      </div>
      <div style={{ position: "absolute", left: 78, right: 78, bottom: 240, display: "flex", gap: 18, direction: "ltr", opacity: a4 }}>
        {[
          { k: "MASTER", v: "1080×1920" },
          { k: "RATE", v: "30 fps" },
          { k: "PICTURE", v: `${PIC} FR` },
          { k: "GRADE", v: "621 ms/FR" },
        ].map((c, i) => (
          <div key={i} style={{ flex: 1, border: `1px solid rgba(160,190,225,0.18)`, borderRadius: 14, padding: "16px 12px", opacity: ln(a4, i * 0.14, i * 0.14 + 0.5), transform: `translateY(${(1 - ln(a4, i * 0.14, i * 0.14 + 0.5)) * 22}px)`, background: GLASS }}>
            <div style={{ font: `500 18px ${MONO}`, color: AMBER, letterSpacing: "0.2em" , direction: "ltr"}}>{c.k}</div>
            <div style={{ marginTop: 8, font: `600 26px ${MONO}`, color: PAPER, whiteSpace: "nowrap" , direction: "ltr"}}>{c.v}</div>
          </div>
        ))}
      </div>
      <Ticks v={a1} />
    </AbsoluteFill>
  );
};

const Card: React.FC<{ f: number }> = ({ f }) => {
  const fade = p(f, PIC_END - 14, PIC_END + 10);
  if (fade <= 0.001) return null;
  const l1 = p(f, PIC_END + 2, PIC_END + 16);
  const l2 = p(f, PIC_END + 10, PIC_END + 26);
  const l3 = p(f, PIC_END + 22, PIC_END + 40);
  const l4 = p(f, PIC_END + 40, PIC_END + 62);
  const word = "VITO BYTE";
  return (
    <AbsoluteFill style={{ opacity: fade, background: INK }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(74% 44% at 50% 34%, #111a29 0%, ${INK} 70%)` }} />
      <div style={{ position: "absolute", left: 78, right: 78, top: 470, textAlign: "center" }}>
        <div style={{ display: "flex", gap: 6, direction: "ltr", justifyContent: "center" }}>
          {word.split("").map((ch, i) => {
            const on = p(f, PIC_END + 2 + i * 1.7, PIC_END + 11 + i * 1.7);
            return (
              <span key={i} style={{ font: `700 104px ${LAT}`, color: PAPER, opacity: on, transform: `translateY(${(1 - on) * 40}px) scale(${0.94 + 0.06 * on})`, display: "inline-block", whiteSpace: "pre" }}>
                {ch}
              </span>
            );
          })}
        </div>
        <div style={{ marginTop: 28, display: "flex", justifyContent: "center" }}>
          <Rule v={l1} w={520} origin="left" />
        </div>
        <div style={{ marginTop: 36, font: `800 60px ${AR}`, color: AMBER, opacity: l2, direction: "rtl" }}>مونتاجٌ يُقطع بالمعنى</div>
        <div style={{ marginTop: 16, font: `600 30px ${AR}`, color: `${STEEL}`, opacity: l2, direction: "rtl" }}>قناعٌ زمنيّ · لوحةٌ محلَّ الغرفة · صوتٌ مقيس</div>
      </div>
      <div style={{ position: "absolute", left: 78, right: 78, bottom: 330, display: "flex", gap: 16, direction: "ltr", opacity: l3 }}>
        {[
          { k: "CUT", v: `${SEGS.length} SHOTS · 0 JUMP` },
          { k: "MATTES", v: "700 FRAMES" },
          { k: "AUDIO", v: "−14 LUFS" },
        ].map((c, i) => (
          <div key={i} style={{ flex: 1, border: `1px solid rgba(160,190,225,0.16)`, borderRadius: 12, padding: "14px 16px", background: GLASS }}>
            <div style={{ font: `500 18px ${MONO}`, color: AMBER, letterSpacing: "0.24em" , direction: "ltr"}}>{c.k}</div>
            <div style={{ marginTop: 6, font: `600 24px ${MONO}`, color: PAPER , direction: "ltr"}}>{c.v}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 190, textAlign: "center", opacity: l4 }}>
        <div style={{ font: `600 34px ${MONO}`, color: PAPER, letterSpacing: "0.12em", direction: "ltr" }}>vitoai.studio</div>
        <div style={{ marginTop: 10, font: `500 24px ${MONO}`, color: `${STEEL}CC`, letterSpacing: "0.2em", direction: "ltr" }}>@vitobytestudio</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 96, textAlign: "center", font: `500 20px ${MONO}`, color: `${STEEL}80`, letterSpacing: "0.22em", direction: "ltr", opacity: l4 }}>
        CUT ON MEASURED SILENCE · MATTES + PLATE + SCORE RUN LOCALLY
      </div>
      <Ticks v={l1} />
    </AbsoluteFill>
  );
};

const Rail: React.FC<{ f: number }> = ({ f }) => (
  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: `${PAPER}1A` }}>
    <div style={{ height: "100%", width: `${(f / PRO_DURATION) * 100}%`, background: AMBER, opacity: 0.9 }} />
    {SHOTS.map((c, i) => (
      <div key={i} style={{ position: "absolute", left: `${(c / PRO_DURATION) * 100}%`, top: 0, width: 2, height: 10, background: PAPER, opacity: 0.55 }} />
    ))}
  </div>
);

/* ------------------------------------------------------------------ the film */

export const PhonePro: React.FC = () => {
  const f = useCurrentFrame();
  const live = f >= PIC_START && f < PIC_END;
  const pre = f < PIC_START;
  const wf = live ? p(f, PIC_START + 2, PIC_START + 16) * (1 - p(f, PIC_END - 10, PIC_END)) : 0;
  return (
    <AbsoluteFill style={{ width: W, height: H, background: INK }}>
      {live || f >= PIC_END ? <Picture f={f} /> : null}
      {live ? (
        <>
          <Chrome f={f} />
          <Diagram f={f} />
          <Captions f={f} />
          <Waveform f={f} v={wf} />
        </>
      ) : null}
      {pre ? <Intro f={f} /> : null}
      <Card f={f} />
      <Rail f={f} />
    </AbsoluteFill>
  );
};
