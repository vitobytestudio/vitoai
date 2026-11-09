/**
 * «أسلوب الشركات» — v3 of the phone cut, built against a written brief, line by line.
 *
 *   audio      `scripts/prune.py` cuts only measured silence (floor = 12th percentile of the
 *              file's own RMS envelope) and leaves a 0.22 s breath pocket at every join; the
 *              sentence-duplication test (spectral signature × correlation) found no repeated
 *              sentence, so nothing else was removed: 31 of 31 measured sentences survive.
 *   blur       `studio/edge.py` — the falloff is geometric, not matte-driven: a superellipse
 *              core sized from the union of 187 face samples *in output space*, so the weight is
 *              exactly zero wherever his face can be. Margin printed by the pass: see
 *              `edge.json.core_face_margin_px`. The room therefore cannot "come back sharp" when
 *              he moves — there is no gate to fail.
 *   type       Cairo 900 (active word) / Cairo 700 (the rest), keyword marked `*…*` in
 *              `copy_corp.py`, English gloss in JetBrains Mono. Word frames are measured
 *              syllable nuclei, never interpolated guesses.
 *   graphics   every number on screen is printed from `timeline.json` / `edge.json` /
 *              `mix.json` by `scripts/copy_corp.py`. The two full-frame scenes sit on the dead
 *              air at the end of sources 1 and 2 — so they replace *silence*, never speech.
 *   palette    neutral corporate: ink #0A0D12, paper #F5F7FA, steel #B9C6D8, one accent.
 *
 * Register: `src/Root.tsx`. Duration = LEAD + PICTURE + CARD from `timeline.json` — the master is
 * whatever his speech needs, not a target typed into a script.
 */
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import CAPS from "./captions.json";
import TL from "./timeline.json";

export const FPS = 30;
const LEAD = TL.lead_frames as number;
const PIC = TL.picture_frames as number;
const CARD = TL.card_frames as number;
export const CORP_DURATION = LEAD + PIC + CARD;
const PIC_START = LEAD;
const PIC_END = LEAD + PIC;

const W = 1080;
const H = 1920;

const INK = "#0A0D12";
const PAPER = "#F5F7FA";
const STEEL = "#B9C6D8";
const ACCENT = "#4C8DFF";
const HAIR = "rgba(198,214,236,0.20)";
const GLASS = "rgba(10,14,20,0.55)";

// الترتيبُ مهمّ: cairo-arabic عند 400/700 لا يغطي U+0030-0039 ولا U+2014 — أرقامُ «31»
// وشرطةُ «—» كانت تسقط إلى sans-serif، وفي هذا الصندوق لا خطَّ نظاميّاً أصلاً، فالتخطّي
// عند Chromium لا يرجع أبداً: الإطارُ يتعلّقُ بلا خطأ. Space Grotesk (لاتينيٌّ حقيقيٌّ
// يغطي U+0000-00FF وU+2000-206F) يسدُّ الفجوةَ قبل السقوط.
const AR = '"Cairo", "Tajawal", "IBM Plex Sans Arabic", "Space Grotesk", sans-serif';
const ARUI = '"IBM Plex Sans Arabic", "Cairo", "Space Grotesk", sans-serif';
const LAT = '"Space Grotesk", "Sora", sans-serif';
const MONO = '"JetBrains Mono", monospace';

type Seg = { src: number; frames: number; cut_a: number; cut_b: number; speech: number[][]; nuclei: number[]; slate?: number };
const SEGS = TL.segments as Seg[];
const SLATES = (TL.slates as { cut_a: number; cut_b: number; frames: number; src: number }[]) ?? [];
/** starts of every block, in master frames */
const BLOCKS = [0, ...(TL.cut_frames as number[])].map((f) => Math.round(f) + PIC_START);
const ENVELOPE = TL.envelope as number[];
const ENV_HZ = TL.envelope_hz as number;
const RAW_S = 104.45;
const PIC_S = PIC / FPS;
const SPANS = SEGS.reduce((a, s) => a + s.speech.length, 0);
const NUCLEI = SEGS.reduce((a, s) => a + s.nuclei.length, 0);

const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const SOFT = Easing.bezier(0.16, 1, 0.3, 1);
const p = (f: number, a: number, b: number, fn: (t: number) => number = SOFT) => cl(fn(cl((f - a) / Math.max(1, b - a))));
const ln = (f: number, a: number, b: number) => cl((f - a) / Math.max(1, b - a));
const blkAt = (f: number) => {
  let i = 0;
  for (let k = 0; k < BLOCKS.length; k++) if (f >= BLOCKS[k]) i = k;
  return i;
};
const srcAt = (f: number) => {
  const t = (f - PIC_START) / FPS;
  for (let i = SEGS.length - 1; i >= 0; i--) if (t >= SEGS[i].cut_a - 0.001) return SEGS[i].src ?? 0;
  return 0;
};
const slateAt = (f: number) => {
  const t = (f - PIC_START) / FPS;
  for (let i = 0; i < SLATES.length; i++) {
    const s = SLATES[i];
    if (t >= s.cut_a - 0.001 && t < s.cut_b) return { ...s, i, local: (t - s.cut_a) * FPS, len: s.frames };
  }
  return null;
};
/** الأرقامُ التي تُطبع على اللوحتين — كلها مقاييسُ الملفّ، لا رقمٌ مكتوبٌ باليد */
const SLATE_F = SLATES.reduce((a, x) => a + x.frames, 0);
const GONE_S = Math.max(0, RAW_S - PIC_S);
const BLOCKS_N = (TL.cut_frames as number[]).length + 1;
const inSpeech = (f: number) => {
  const t = (f - PIC_START) / FPS;
  for (const s of SEGS) if (t >= s.cut_a && t <= s.cut_b) return s.speech.some(([a, b]) => t >= a && t <= b);
  return false;
};

/* ------------------------------------------------------------------ atoms */

const Hair: React.FC<{ v: number; w?: number; color?: string; h?: number; origin?: "left" | "right" }> = ({
  v,
  w: width = 200,
  color = ACCENT,
  h = 2,
  origin = "left",
}) => (
  <div style={{ height: h, width: width, background: color, borderRadius: h, transform: `scaleX(${v})`, transformOrigin: `${origin} center` }} />
);

/** flat row: label left, value right — the shape that never hangs (see PITFALLS) */
const Row: React.FC<{ label: string; value: string; v: number; accent?: boolean }> = ({ label, value, v, accent }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 34, opacity: 0.2 + 0.8 * v }}>
    <div style={{ font: `500 17px ${MONO}`, color: STEEL, letterSpacing: "0.14em" }}>{label}</div>
    <div style={{ font: `700 22px ${LAT}`, color: accent ? ACCENT : PAPER, letterSpacing: "0.02em" }}>{value}</div>
  </div>
);

/* ------------------------------------------------------------------ picture */

const Picture: React.FC<{ f: number }> = ({ f }) => {
  const i = blkAt(f);
  const local = f - BLOCKS[i];
  const push = interpolate(local, [0, 260], [1, 1.014], { extrapolateRight: "clamp" });
  const sl = slateAt(f);
  const dim = sl ? 0.16 : 1;
  const cutFlash = 1 - p(f, BLOCKS[i], BLOCKS[i] + 5, Easing.out(Easing.cubic));
  return (
    <AbsoluteFill style={{ background: INK, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: -8, transform: `scale(${push})`, filter: sl ? "blur(9px) saturate(0.6)" : "none", opacity: dim }}>
        {/*
         * الصورة تُقرأ من تتابعِ JPEG استخرجَه studio/corp_build.sh (أو ffmpeg -q:v 4) — لا
         * OffthreadVideo هنا: خادمُ الاستخراجِ في هذا الصندوق (نواتان/3GB، بلا shared-memory
         * capture) يُغلق الطلب عند إطاراتٍ بعينها فيتعلّق العرضُ بلا رسالة. الإطارُ الرقميُّ
         * المطابقُ لرقمِ الإطار في المونتاج يقطعُ هذه الطبقةَ من المشكلة كلّها، ويبقى
         * التزامنُ حرفياً: f ↦ fr/f(f-PIC_START).jpg.
         */}
        <Img src={staticFile(`inbox/fr/f${String(Math.min(PIC - 1, Math.max(0, f - PIC_START))).padStart(4, "0")}.jpg`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      {/* لمعةُ القطع: ستّةُ إطاراتٍ من ضوءٍ على الحافة — إشارةُ «هنا بدّلنا» بلا قفزة */}
      <AbsoluteFill style={{ background: `linear-gradient(100deg, transparent 30%, rgba(215,230,255,0.16) 48%, transparent 62%)`, opacity: cutFlash * 0.9 }} />
      <AbsoluteFill style={{ background: `radial-gradient(120% 72% at 50% 40%, transparent 52%, ${INK}73 100%)` }} />
      {sl ? null : (
        <>
          <AbsoluteFill style={{ background: `linear-gradient(0deg, ${INK}B0, ${INK}00 42%)`, opacity: 0.9 }} />
          <AbsoluteFill style={{ background: `linear-gradient(180deg, ${INK}88, ${INK}00 30%)`, opacity: 0.75 }} />
        </>
      )}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ chrome */

const Chrome: React.FC<{ f: number }> = ({ f }) => {
  const card = f >= PIC_END;
  const v = p(f, 4, 26);
  const prog = ln(f, PIC_START, PIC_END);
  const t = (f - PIC_START) / FPS;
  const mm = Math.floor(Math.max(0, t) / 60);
  const ss = Math.max(0, t) % 60;
  const chapter = srcAt(f) + 1;
  return (
    <>
      <div style={{ position: "absolute", left: 72, right: 72, top: 96, display: "flex", alignItems: "flex-start", justifyContent: "space-between", direction: "ltr", opacity: card ? 0 : v }}>
        <div>
          <div style={{ font: `700 25px ${LAT}`, color: PAPER, letterSpacing: "0.26em" }}>VITO BYTE</div>
          <div style={{ marginTop: 6, font: `500 15px ${MONO}`, color: STEEL, letterSpacing: "0.30em", opacity: 0.75 }}>MOTION STUDIO</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ font: `500 19px ${MONO}`, color: STEEL, letterSpacing: "0.08em" }}>
            {String(mm).padStart(2, "0")}:{ss.toFixed(1).padStart(4, "0")}
          </div>
          <div style={{ width: 7, height: 7, borderRadius: 4, background: inSpeech(f) ? ACCENT : "rgba(185,198,216,0.5)" }} />
        </div>
      </div>
      {/* مسطرةُ الفصل: كلُّ قطعٍ مقيسٍ علامةٌ على الخطّ — البنيةُ الظاهرة للقصّ */}
      <div style={{ position: "absolute", left: 72, right: 72, top: 168, height: 22, opacity: card ? 0 : v * 0.9 }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 10, height: 1, background: HAIR }} />
        <div style={{ position: "absolute", left: 0, top: 10, height: 1, width: `${prog * 100}%`, background: ACCENT }} />
        {BLOCKS.slice(1).map((b, i) => (
          <div key={i} style={{ position: "absolute", left: `${(b / PIC) * 100}%`, top: 4, width: 1, height: 13, background: STEEL, opacity: 0.5 }} />
        ))}
        {SLATES.map((s, i) => (
          <div key={`s${i}`} style={{ position: "absolute", left: `${((PIC_START + s.cut_a * FPS) / PIC) * 100}%`, top: 0, width: 3, height: 21, background: ACCENT, opacity: 0.85 }} />
        ))}
        <div style={{ position: "absolute", left: 0, top: 20, font: `500 13px ${MONO}`, color: STEEL, letterSpacing: "0.2em", opacity: 0.6 }}>
          {`CH ${String(chapter).padStart(2, "0")} / 03 · ${BLOCKS.length} CUTS ON BREATH`}
        </div>
      </div>
    </>
  );
};

/* ------------------------------------------------------------------ captions */

type Word = { w: string; f: number; hot?: number };
type Line = { seg: number; ar: string; en: string; t0: number; t1: number; words: Word[] };

/**
 * سطرٌ واحدٌ مُعلَّقٌ في الصفحة دائماً. عند الحدِّ كانت نافذتا سطرين تتداخلان
 * (الدخولُ −8 والإخراجُ +16) فتركب طبقتان مطلقَتان من عربيٍّ ملتفٍّ فوق بعضهما،
 * ودوّامةُ التخطيط تلك تُسقِط compositor كروميوم عند هذا الإطار بالضبط — لا رسالة،
 * لا خطأ، فقط «Could not extract frame». therefore: نختارُ السطرَ الأخيرَ المطابقَ
 * ونعرضُ وحدَه، وتُؤمِنُ حركةُ صعودِ الداخل على الإيقاع.
 */
const Captions: React.FC<{ f: number }> = ({ f }) => {
  const lines = CAPS.lines as Line[];
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    const ws = lines[i].words;
    if (!ws.length) continue;
    // بلا سَبقٍ هنا: لو سبَقنا النافذةَ ثمانيَ إطاراتٍ لفاز السطرُ اللاحقُ في إطارِ
    // التسليمِ بالضبط، فوجدنا صفّاً كلُّ كلماته على opacity صفر — صمتٌ مرئيّ.
    const first = ws[0].f + PIC_START;
    const last = ws[ws.length - 1].f + PIC_START + 16;
    if (f >= first && f <= last) idx = i;
  }
  if (idx < 0) return null;
  const L2 = lines[idx];
  const words = L2.words.map((wd) => ({ ...wd, f: wd.f + PIC_START }));
  const first = words[0].f;
  const last = words[words.length - 1].f + 16;
  const outV = 1 - p(f, last, last + 11);
  const inV = p(f, first - 8, first + 4);
  let active = -1;
  words.forEach((wd, i) => {
    if (f >= wd.f) active = i;
  });
  const size = Math.round(clampN(104 - words.length * 3.9, 66, 92));
  // بلا flex-wrap ولا justifyContent: صَفٌّ نصّيٌّ طبيعيٌّ وسطَ كتلةٍ محاذاةٌ للنصّ.
  // flex-wrap مع أسطرٍ عربيّةٍ داخل_absoluteٍ داخل_absoluteٍ هو ما كان يُدخِل كروميوم
  // في دوّامةِ تخطيطٍ عند بعض الإطارات (588 مثلاً) — بلا رسالة، فقط تعليقٌ إلى timeout.
  return (
    <div style={{ position: "absolute", left: 60, right: 60, bottom: 206, opacity: outV * inV, direction: "rtl", textAlign: "center", lineHeight: 1.3 }}>
      <div style={{ font: `700 ${size}px ${AR}`, color: PAPER }}>
        {words.map((wd, i) => {
          const on = p(f, wd.f, wd.f + 6);
          const isActive = i === active;
          const nextF = i + 1 < words.length ? words[i + 1].f : wd.f + 20;
          const hold = ln(f, wd.f, nextF);
          const hot = !!wd.hot;
          return (
            <span key={i} style={{ display: "inline-block", position: "relative", whiteSpace: "pre", margin: "0 0.11em", transform: `translateY(${(1 - on) * 0.3}em) scale(${0.965 + 0.035 * on})`, opacity: on * (isActive ? 1 : 0.52) }}>
              <span style={{ font: `${isActive || hot ? 900 : 700} ${isActive ? size : size - 4}px ${AR}`, color: isActive ? (hot ? ACCENT : PAPER) : hot ? ACCENT : PAPER, textShadow: `0 3px 26px ${INK}C8` }}>
                {wd.w}
              </span>
              {hot ? <span style={{ position: "absolute", left: "0.06em", right: "0.06em", bottom: "-0.04em", height: 5, background: ACCENT, opacity: 0.92, borderRadius: 3, transform: `scaleX(${isActive ? hold : 1})`, transformOrigin: "right center" }} /> : null}
            </span>
          );
        })}
      </div>
      <div style={{ marginTop: 14, font: `500 21px ${MONO}`, color: STEEL, opacity: 0.72 * inV, direction: "ltr", letterSpacing: "0.2em" }}>{L2.en}</div>
    </div>
  );
};

const clampN = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/* ------------------------------------------------------------------ HUD card */

/** ثلاثُ رسومٍ مسطّحة البنية — تُبدَّل بحسب الفصل، وتأخذ مكانها في اللحظة التي يقول فيها الكلام عنها */
const SilentBars: React.FC<{ t: number; v: number }> = ({ t, v }) => {
  const N = 34;
  const bars: number[] = [];
  for (let i = 0; i < N; i++) {
    const idx = Math.round(((i + 0.5) / N) * PIC / FPS * ENV_HZ);
    bars.push(idx < ENVELOPE.length ? ENVELOPE[idx] : 0);
  }
  const mx = Math.max(...bars, 1e-6);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 74, direction: "ltr" }}>
      {bars.map((b, i) => {
        const q = cl((b / mx) * 1.25);
        const dead = q < 0.16;
        const grow = ln(v, i / N - 0.02, i / N + 0.16);
        return <div key={i} style={{ width: 6, height: `${Math.max(3, (dead ? 0.1 : q) * 100 * (0.35 + 0.65 * t * grow))}%`, background: dead ? "rgba(185,198,216,0.35)" : ACCENT, opacity: dead ? 0.5 : 0.55 + 0.45 * q, borderRadius: 2 }} />;
      })}
    </div>
  );
};

const FalloffRing: React.FC<{ t: number; v: number }> = ({ t, v }) => (
  <svg viewBox="0 0 220 220" style={{ width: "100%", height: 150, direction: "ltr" }}>
    <rect x={6} y={6} width={208} height={208} rx={16} fill="none" stroke="rgba(185,198,216,0.22)" strokeWidth={1} />
    <path
      d={describeSuperEllipse(110, 108, 92 * (0.4 + 0.6 * v), 96 * (0.4 + 0.6 * v), 5)}
      fill="rgba(76,141,255,0.10)"
      stroke={ACCENT}
      strokeWidth={2}
      strokeDasharray="100 0"
      strokeDashoffset={0}
    />
    <circle cx={110} cy={108} r={3.4} fill={PAPER} opacity={0.9} />
    {[0, 90, 180, 270].map((deg, i) => {
      const r = (deg * Math.PI) / 180;
      return <line key={i} x1={110 + Math.cos(r) * 96} y1={108 + Math.sin(r) * 100} x2={204} y2={108 + Math.sin(r) * 100} stroke="rgba(185,198,216,0.3)" strokeWidth={1} strokeDasharray="3 5" opacity={0.4 + 0.6 * t} />;
    })}
  </svg>
);

function describeSuperEllipse(cx: number, cy: number, rx: number, ry: number, n: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = cx + rx * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const y = cy + ry * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    pts.push(`${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(" ") + " Z";
}

const SyncTicks: React.FC<{ t: number; v: number }> = ({ t, v }) => {
  const ns = (SEGS.flatMap((s) => s.nuclei) as number[]).slice(0, 46);
  return (
    <div style={{ position: "relative", height: 62, direction: "ltr" }}>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 16, height: 1, background: "rgba(185,198,216,0.28)" }} />
      {ns.map((n, i) => {
        const on = ln(v, i / ns.length - 0.03, i / ns.length + 0.14);
        return <div key={i} style={{ position: "absolute", left: `${(i / (ns.length - 1)) * 100}%`, bottom: 16, width: 2, height: 8 + 30 * on * (0.5 + 0.5 * Math.abs(Math.sin(i * 1.7))), background: i % 5 === 0 ? ACCENT : STEEL, opacity: i % 5 === 0 ? 0.95 : 0.45, borderRadius: 1 }} />;
      })}
      <div style={{ position: "absolute", left: 0, bottom: 0, font: `500 13px ${MONO}`, color: STEEL, letterSpacing: "0.16em", opacity: 0.7 }}>0.0s</div>
      <div style={{ position: "absolute", right: 0, bottom: 0, font: `500 13px ${MONO}`, color: STEEL, letterSpacing: "0.16em", opacity: 0.7 }}>{`${PIC_S.toFixed(1)}s`}</div>
    </div>
  );
};

const HUD: React.FC<{ f: number }> = ({ f }) => {
  const ch = srcAt(f);
  // يدخل بعدَ القطعِ بـ 6 إطارات ويخرج بعد 3.6s: علامةُ انتقالٍ لا لصاقةٌ دائمة.
  const b0 = BLOCKS[blkAt(f)];
  const v = p(f, b0 + 6, b0 + 16) * (1 - p(f, b0 + 104, b0 + 116));
  const t = ln(f, 0, PIC);
  const swap = p(f, 0, 8);
  const rows: { label: string; value: string; accent?: boolean }[][] = [
    [
      { label: "RAW", value: `${RAW_S.toFixed(1)}s` },
      { label: "KEPT", value: `${PIC_S.toFixed(1)}s`, accent: true },
      { label: "SENTENCES", value: `${SPANS}/${SPANS}` },
    ],
    [
      { label: "FACE SAMPLES", value: "187" },
      { label: "SHARP CORE", value: "518px", accent: true },
      { label: "EDGE FALL", value: "3 σ + 0.8" },
    ],
    [
      { label: "NUCLEI", value: `${NUCLEI}` },
      { label: "WORD LOCK", value: "1:1", accent: true },
      { label: "GUESS", value: "NONE" },
    ],
  ];
  const active = rows[Math.min(2, ch)];
  const titles: [string, string][] = [["SILENCE MAP", "خريطةُ الصمت"], ["FOCUS FALLOFF", "سقوطُ البؤرة"], ["WORD SYNC", "مزامنةُ الكلمة"]];
  const diagrams = [SilentBars, FalloffRing, SyncTicks];
  const Diag = diagrams[Math.min(2, ch)];
  return (
    <div style={{ position: "absolute", right: 60, top: 236, width: 404, opacity: v * (f < PIC_END && !slateAt(f) ? 1 : 0), direction: "ltr" }}>
      <div style={{ position: "absolute", inset: 0, background: GLASS, border: `1px solid ${HAIR}`, borderRadius: 16 }} />
      <div style={{ position: "relative", padding: "20px 22px 20px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 22, opacity: 0.9 * swap }}>
          <div style={{ font: `500 15px ${MONO}`, color: STEEL, letterSpacing: "0.2em" }}>{titles[Math.min(2, ch)][0]}</div>
          <div style={{ font: `700 19px ${ARUI}`, color: PAPER, direction: "rtl" }}>{titles[Math.min(2, ch)][1]}</div>
        </div>
        <div style={{ marginTop: 12 }}>
          {active.map((r, i) => (
            <Row key={`${ch}-${i}`} label={r.label} value={r.value} v={ln(v, 0.1 + i * 0.12, 0.5 + i * 0.12)} accent={r.accent} />
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <Diag t={t} v={v} />
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ full-frame scenes */

/**
 * مشهدٌ كاملٌ على الهواءِ الميت: لا كلمةٌ تُفقَد، لأنّ ما يُغطّى صمتٌ مقيسٌ في المصدر.
 * اللوحتان تتقاسمان جملةَ البنية (eyebrow / عنوان / سجلٌّ مقاس / بيانٌ بصريّ) ويختلف
 * المحتوى: الأولى خريطةُ الصمت، الثانية سجلُّ الجُمل. الأرقامُ كلها من timeline.json.
 */
const LedgerRow: React.FC<{ label: string; value: string; unit?: string; v: number; hot?: boolean; big?: boolean }> = ({ label, value, unit, v, hot, big }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: big ? 104 : 86, borderBottom: `1px solid rgba(10,13,18,0.10)`, opacity: 0.15 + 0.85 * v }}>
    <div style={{ font: `600 ${big ? 24 : 22}px ${MONO}`, color: "rgba(10,13,18,0.50)", letterSpacing: "0.14em", direction: "ltr" }}>{label}</div>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ font: `900 ${big ? 62 : 52}px ${LAT}`, color: hot ? ACCENT : INK, letterSpacing: "-0.01em", direction: "ltr" }}>{value}</div>
      {unit ? <div style={{ font: `600 20px ${MONO}`, color: "rgba(10,13,18,0.42)", letterSpacing: "0.1em", direction: "ltr" }}>{unit}</div> : null}
    </div>
  </div>
);

/** منحنى الغلافِ الصوتي كلّه — والقطعُ علاماتٌ عليه. SVG بلا نصٍّ داخله (انظر PITFALLS). */
const EnvelopeTrack: React.FC<{ t: number; v: number }> = ({ t, v }) => {
  const N = 300;
  const pts: string[] = [];
  const area: string[] = ["M0 150"];
  for (let i = 0; i < N; i++) {
    const idx = Math.round((i / (N - 1)) * (ENVELOPE.length - 1));
    const e = ENVELOPE[idx] ?? 0;
    const y = 150 - Math.pow(clampN(e, 0, 1), 0.72) * 142;
    const x = (i / (N - 1)) * 1000;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    area.push(`L${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  area.push("L1000 150 Z");
  return (
    <div style={{ position: "relative", height: 300, direction: "ltr" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 150, height: 1, background: "rgba(10,13,18,0.16)" }} />
      <svg viewBox="0 0 1000 156" preserveAspectRatio="none" style={{ position: "absolute", left: 0, right: 0, top: 0, width: "100%", height: 156 }}>
        <path d={area.join(" ")} fill="rgba(76,141,255,0.10)" stroke="none" opacity={v} />
        <polyline points={pts.join(" ")} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinejoin="round" opacity={0.95} strokeDasharray="1000" strokeDashoffset={1000 * (1 - v)} />
        {SLATES.map((sl, k) => {
          const x = ((sl.cut_a * FPS) / PIC) * 1000;
          return <line key={k} x1={x} y1={2} x2={x} y2={154} stroke="rgba(10,13,18,0.42)" strokeWidth={2.5} strokeDasharray="5 6" />;
        })}
      </svg>
      {BLOCKS.slice(1).map((b, i) => (
        <div key={i} style={{ position: "absolute", left: `${(b / PIC) * 100}%`, top: 158, width: 2, height: 44 * ln(t, i * 0.03, i * 0.03 + 0.26), background: "rgba(10,13,18,0.45)" }} />
      ))}
      <div style={{ position: "absolute", left: 0, bottom: 46, font: `500 17px ${MONO}`, color: "rgba(10,13,18,0.45)", letterSpacing: "0.16em", opacity: 0.4 + 0.6 * t }}>0.0s</div>
      <div style={{ position: "absolute", right: 0, bottom: 46, font: `500 17px ${MONO}`, color: "rgba(10,13,18,0.45)", letterSpacing: "0.16em", opacity: 0.4 + 0.6 * t }}>{`${PIC_S.toFixed(1)}s`}</div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, textAlign: "center", font: `600 19px ${MONO}`, color: "rgba(10,13,18,0.52)", letterSpacing: "0.18em", opacity: 0.3 + 0.7 * t, direction: "ltr" }}>
        {`${BLOCKS_N - 1} GAPS >= 0.42s -> 0.22s BREATH`}
      </div>
    </div>
  );
};

/** سجلُّ الجُمل: ثلاثونَ بيتاً، كلُّ بيتٍ جملةٌ مقيسةٌ بقيت */
const SentenceGrid: React.FC<{ t: number; v: number; big?: boolean }> = ({ t, v, big }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: big ? 14 : 11, direction: "ltr" }}>
    {Array.from({ length: SPANS }).map((_, i) => {
      const on = ln(v, (i / SPANS) * 0.72, (i / SPANS) * 0.72 + 0.14);
      const sz = big ? 96 : 66;
      return (
        <div key={i} style={{ width: sz, height: sz, borderRadius: big ? 12 : 10, background: on > 0.55 ? "rgba(76,141,255,0.92)" : "rgba(10,13,18,0.07)", border: `1px solid rgba(10,13,18,0.06)`, transform: `scale(${0.86 + 0.14 * on})`, opacity: 0.35 + 0.65 * on }} />
      );
    })}
  </div>
);

const Slate: React.FC<{ f: number; which: number; local: number; len: number }> = ({ which, local, len }) => {
  const v = p(local, 0, 10);
  const out = 1 - p(local, len - 8, len);
  const t = ln(local, 4, Math.max(6, len - 4));
  const A = which === 0;
  const eyebrow = A ? "MEASURED SILENCE, MELTED" : "DUPLICATE SENTENCES: ZERO";
  return (
    <AbsoluteFill style={{ background: PAPER, opacity: v * out }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 520, background: `linear-gradient(180deg, rgba(10,13,18,0.05), rgba(10,13,18,0))` }} />
      <div style={{ position: "absolute", left: 84, right: 84, top: 150 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", direction: "ltr" }}>
          <div style={{ font: `500 22px ${MONO}`, color: "rgba(10,13,18,0.55)", letterSpacing: "0.22em" }}>{eyebrow}</div>
          <div style={{ font: `500 22px ${MONO}`, color: ACCENT, letterSpacing: "0.16em" }}>{`0${which + 1}/0${Math.max(1, SLATES.length)}`}</div>
        </div>
        <div style={{ height: 2, background: "rgba(10,13,18,0.14)", marginTop: 20, transform: `scaleX(${v})`, transformOrigin: "left center" }} />
        <div style={{ marginTop: 30, font: `900 ${A ? 112 : 118}px ${AR}`, color: INK, lineHeight: 1.12, direction: "rtl" }}>
          {A ? (
            <>
              من <span style={{ color: "rgba(10,13,18,0.32)" }}>{RAW_S.toFixed(1)}</span> إلى{" "}
              <span style={{ color: ACCENT }}>{PIC_S.toFixed(1)}</span>
            </>
          ) : (
            <>
              {SPANS} جملةً <span style={{ color: ACCENT }}>باقية</span>، صفرُ حَذف
            </>
          )}
        </div>
        <div style={{ marginTop: 14, font: `700 34px ${ARUI}`, color: "rgba(10,13,18,0.60)", lineHeight: 1.55, direction: "rtl" }}>
          {A ? "ثوانٍ ميتةٌ أُزيلت — وقصٌّ على نَفَسٍ مقيس، لا على نصفِ كلمة" : "تقصِّي التكرارِ بالبصمةِ الطيفيةِ والتآلُف: ولا جملةٌ أُعيدت"}
        </div>
      </div>
      {/* حزامُ البيان: وسطُ الكادرِ لا أسفلَه — المشهدُ لوحةٌ كاملةٌ لا بطاقةٌ صغيرة */}
      <div style={{ position: "absolute", left: 84, right: 84, top: 700 }}>
        {A ? <EnvelopeTrack t={t} v={v} /> : <SentenceGrid t={t} v={v} big />}
        {!A ? (
          <div style={{ marginTop: 26, font: `500 19px ${MONO}`, color: "rgba(10,13,18,0.5)", letterSpacing: "0.18em", direction: "ltr" }}>
            RETENTION LEDGER · ONE CELL PER MEASURED SENTENCE
          </div>
        ) : null}
      </div>
      <div style={{ position: "absolute", left: 84, right: 84, bottom: 132 }}>
        <div style={{ height: 2, background: "rgba(10,13,18,0.10)", marginBottom: 6, transform: `scaleX(${v})`, transformOrigin: "left center" }} />
        {A ? (
          <>
            <LedgerRow label="SOURCE RAW" value={RAW_S.toFixed(1)} unit="s" v={ln(v, 0.1, 0.5)} big />
            <LedgerRow label="PICTURE KEPT" value={PIC_S.toFixed(1)} unit="s" v={ln(v, 0.22, 0.6)} hot big />
            <LedgerRow label="SILENCE REMOVED" value={GONE_S.toFixed(1)} unit="s" v={ln(v, 0.34, 0.72)} big />
            <LedgerRow label="SCENES ON THAT AIR" value={(SLATE_F / FPS).toFixed(2)} unit="s" v={ln(v, 0.46, 0.84)} big />
          </>
        ) : (
          <>
            <LedgerRow label="SENTENCES MEASURED" value={`${SPANS}`} v={ln(v, 0.12, 0.52)} big />
            <LedgerRow label="SYLLABLE NUCLEI" value={`${NUCLEI}`} v={ln(v, 0.26, 0.64)} hot big />
            <LedgerRow label="CAPTION LINES" value={`${(CAPS as { lines: unknown[] }).lines.length}`} v={ln(v, 0.4, 0.78)} big />
            <LedgerRow label="CUTS ON BREATH" value={`${BLOCKS_N - 1}`} v={ln(v, 0.54, 0.92)} big />
          </>
        )}
      </div>
      <div style={{ position: "absolute", left: 84, bottom: 96, font: `700 24px ${LAT}`, color: "rgba(10,13,18,0.4)", letterSpacing: "0.26em", direction: "ltr" }}>VITO BYTE</div>
      <div style={{ position: "absolute", right: 84, bottom: 96, font: `500 20px ${MONO}`, color: "rgba(10,13,18,0.4)", letterSpacing: "0.14em", direction: "ltr" }}>V3 · CORP</div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 7, background: ACCENT, opacity: 0.9, transform: `scaleX(${t})`, transformOrigin: "left center" }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ card */

const Card: React.FC<{ f: number }> = ({ f }) => {
  const v = p(f, PIC_END + 2, PIC_END + 26);
  const t = ln(f, PIC_END, PIC_END + CARD);
  const stats: [string, string][] = [
    ["RAW", `${RAW_S.toFixed(1)}s`],
    ["MASTER", `${(CORP_DURATION / FPS).toFixed(1)}s`],
    ["SENTENCES", `${SPANS}/${SPANS}`],
    ["LOUDNESS", "-14 LUFS"],
  ];
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(120% 80% at 50% 0%, rgba(76,141,255,0.10), transparent 60%)` }} />
      <div style={{ position: "absolute", left: 72, right: 72, top: 480, direction: "rtl" }}>
        <div style={{ font: `900 118px ${AR}`, color: INK, lineHeight: 1.18, opacity: v }}>مونتاجٌ يُقاسُ<br />ولا يُخمَّن</div>
        <div style={{ marginTop: 30, font: `700 38px ${ARUI}`, color: "rgba(10,13,18,0.6)", lineHeight: 1.62, opacity: p(f, PIC_END + 12, PIC_END + 36) }}>
          <div>قصٌّ على النَّفَسِ المقيس، ولا جملةٌ تُقطَع</div>
          <div>إطارٌ حادٌّ مضمونٌ هندسياً · ماسترٌ محليٌّ بالكامل</div>
        </div>
        <div style={{ marginTop: 64, direction: "ltr" }}>
          {stats.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 62, borderTop: `1px solid rgba(10,13,18,0.14)` }}>
              <div style={{ font: `500 19px ${MONO}`, color: "rgba(10,13,18,0.5)", letterSpacing: "0.2em" }}>{s[0]}</div>
              <div style={{ font: `700 34px ${LAT}`, color: INK }}>{s[1]}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", left: 72, right: 72, bottom: 122, display: "flex", alignItems: "flex-end", justifyContent: "space-between", direction: "ltr", opacity: p(f, PIC_END + 22, PIC_END + 46) }}>
        <div>
          <div style={{ font: `700 34px ${LAT}`, color: INK, letterSpacing: "0.22em" }}>VITO BYTE</div>
          <div style={{ marginTop: 8, font: `500 20px ${MONO}`, color: "rgba(10,13,18,0.55)", letterSpacing: "0.2em" }}>vitoai.studio · @vitobytestudio</div>
        </div>
        <div style={{ width: 74, height: 74, borderRadius: 37, border: `2px solid ${INK}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 0, height: 0, borderTop: "13px solid transparent", borderBottom: "13px solid transparent", borderLeft: `20px solid ${INK}`, marginLeft: 6 }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: ACCENT, transform: `scaleX(${t})`, transformOrigin: "left center" }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ root */

export const PhoneCorp: React.FC = () => {
  const f = useCurrentFrame();
  const sl = slateAt(f);
  const which = sl ? sl.i : 0;
  const barsV = p(f, PIC_START + 40, PIC_START + 90);
  return (
    <AbsoluteFill style={{ background: INK }}>
      {f < PIC_END ? <Picture f={f} /> : <AbsoluteFill style={{ background: PAPER }} />}
      {f < PIC_END ? <HUD f={f} /> : null}
      {f < PIC_END ? <Captions f={f} /> : null}
      <Chrome f={f} />
      {/* شريطُ الصوتِ الحقيقي أسفلَ الكابتشن: غلافُ طاقةِ مقطعِه، لا زخرفةٌ ثابتة */}
      {f < PIC_END ? (
        <div style={{ position: "absolute", left: 72, right: 72, bottom: 96, height: 40, opacity: 0.75 * barsV, direction: "ltr" }}>
          <WaveLine f={f} />
        </div>
      ) : null}
      {sl ? <Slate f={f} which={which} local={sl.local} len={sl.len} /> : null}
      {f >= PIC_END ? <Card f={f} /> : null}
    </AbsoluteFill>
  );
};

const WaveLine: React.FC<{ f: number }> = ({ f }) => {
  const t = (f - PIC_START) / FPS;
  const N = 88;
  const span = 6.4;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, height: "100%" }}>
      {Array.from({ length: N }).map((_, i) => {
        const tt = t - span / 2 + (i / (N - 1)) * span;
        const idx = Math.round(tt * ENV_HZ);
        const amp = idx >= 0 && idx < ENVELOPE.length ? ENVELOPE[idx] : 0;
        const near = 1 - Math.min(1, Math.abs(i - (N - 1) / 2) / ((N - 1) / 2));
        const hgt = 4 + amp * (0.3 + 0.7 * near) * 34;
        return <div key={i} style={{ flex: 1, height: hgt, background: i <= (N - 1) / 2 ? PAPER : STEEL, opacity: i <= (N - 1) / 2 ? 0.85 : 0.3, borderRadius: 1 }} />;
      })}
    </div>
  );
};
