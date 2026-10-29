/**
 * ART DIRECTION — the page architectures a film is built from.
 *
 * A generator picks a template and fills it. A director picks *a different kind
 * of page* for each beat, because each beat is making a different argument:
 * a claim wants a poster, a place wants silence, evidence wants an index, a
 * number wants one enormous figure and nothing else.
 *
 * Every architecture here is written as a pure function of the frame, so the
 * same code draws the live preview and the exported video. What you see is
 * literally what you get.
 *
 * House rules, applied everywhere:
 *   · type scale jumps 3–6× between display and metadata, never 1.3×
 *   · the grid is 12 columns, but nothing is centred except a single line
 *   · one accent per frame, on one element
 *   · hairlines, not borders; space, not boxes
 *   · every architecture leaves at least a third of the frame empty
 */
import React from "react";
import type { Beat, Decision } from "./brain";
import { World } from "./world";
import { MONO, DISP, rgba, clamp, mix } from "./pure";
import { EASE, display, Grade } from "./craft";

const AR = '"Cairo", "IBM Plex Sans Arabic", "Tajawal", sans-serif';

export type ArtProps = {
  beat: Beat;
  plan: Decision;
  /** frames into the beat */
  f: number;
  /** frames in the beat */
  total: number;
  /** output width in px — everything scales from this */
  w: number;
  h: number;
  /** output width / 1080 — every dimension multiplies by this */
  k: number;
  /** 1-based position in the film, used by architectures that number things */
  index?: number;
};

/* ------------------------------------------------------------------ tokens */

const M = 92; // margin at 1080 wide

const tokens = (p: Decision) => ({
  ink: p.ink,
  dim: "rgba(238,244,251,0.52)",
  faint: "rgba(238,244,251,0.30)",
  hair: "rgba(255,255,255,0.14)",
  hair2: "rgba(255,255,255,0.07)",
  accent: p.accent,
  bg: "#05080c",
});

const fam = (rtl: boolean) => (rtl ? AR : DISP);
const monoFam = (rtl: boolean) => (rtl ? AR : MONO);

/* ---------------------------------------------------------------- helpers */

/** a scrim heavy enough for type to sit on, light enough to keep the picture */
const Scrim: React.FC<{ from?: string; height?: number; k: number }> = ({ from = "rgba(4,7,11,0.92)", height = 640, k }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: height * k,
      background: `linear-gradient(180deg, rgba(4,7,11,0) 0%, ${from} 62%, rgba(4,7,11,0.97) 100%)`,
    }}
  />
);

/** the world, scaled to fit any output size without re-laying it out */
const Place: React.FC<{ spec: Parameters<typeof World>[0]["spec"]; k: number; children?: React.ReactNode }> = ({ spec, k, children }) => (
  <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
    <div style={{ position: "absolute", width: 1080, height: 1920, transform: `scale(${k})`, transformOrigin: "0 0" }}>
      <World spec={spec} />
    </div>
    {children}
  </div>
);

const worldSpec = (b: Beat, p: Decision, f: number, total: number) => ({
  kind: b.world || "skyline",
  mood: (p.tone === "clinical" ? "night" : p.tone === "warm" ? "dusk" : p.tone === "noir" ? "neon" : "interior") as
    | "night"
    | "dusk"
    | "neon"
    | "interior",
  accent: p.accent,
  seed: (p.seed + (b.world || "").length * 97 + (b.caption || "").length) % 99991,
  p: clamp(f / Math.max(1, total)),
  density: 0.45,
});

/** numerals in the script the film is set in */
const rl = (n: number, rtl: boolean) => (rtl ? String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]) : String(n));

/** names for beats that carry no caption of their own */
const beatLabel = (b: Beat, rtl: boolean) => {
  if (b.caption) return b.caption;
  if (rtl) return ({ hook: "المقدمة", place: "المكان", evidence: "الدليل", detail: "التفصيل", number: "الأرقام", end: "الخاتمة" } as Record<string, string>)[b.kind] || b.kind;
  return ({ hook: "the claim", place: "the place", evidence: "the proof", detail: "the detail", number: "the record", end: "the signature" } as Record<string, string>)[b.kind] || b.kind;
};

/** a metadata row: index, label, and a hairline that draws itself */
const Meta: React.FC<{ left: string; right: string; f: number; k: number; tok: ReturnType<typeof tokens>; rtl: boolean }> = ({ left, right, f, k, tok, rtl }) => (
  <div style={{ position: "absolute", left: M * k, right: M * k, top: 92 * k, opacity: clamp(f / 14) }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ fontFamily: monoFam(rtl), fontSize: 13 * k, letterSpacing: rtl ? 0 : "0.32em", textTransform: "uppercase", color: tok.dim }}>{left}</span>
      <span style={{ fontFamily: monoFam(rtl), fontSize: 13 * k, letterSpacing: rtl ? 0 : "0.24em", textTransform: "uppercase", color: tok.faint }}>{right}</span>
    </div>
    <div
      style={{
        height: 1,
        background: tok.hair,
        marginTop: 16 * k,
        transform: `scaleX(${EASE.out((f - 4) / 22)})`,
        transformOrigin: rtl ? "100% 50%" : "0 50%",
      }}
    />
  </div>
);

/* ============================================================== ARCHITECTURES */

/** 01 — POSTER. A full-bleed place, type in the lower third, one rule. */
const Poster: React.FC<ArtProps> = ({ beat, plan, f, total, k }) => {
  const tok = tokens(plan);
  const rtl = plan.language === "ar";
  const p = EASE.out((f - 8) / 26);
  return (
    <>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${1 + 0.05 * clamp(f / Math.max(1, total))})`, transformOrigin: "50% 60%" }}>
        <Place spec={worldSpec(beat, plan, f, total)} k={k} />
      </div>
      <Scrim k={k} />
      <Meta left={beat.caption || plan.kicker} right={`${Math.round((f / 30) * 10) / 10}s`} f={f} k={k} tok={tok} rtl={rtl} />
      <div
        style={{
          position: "absolute",
          left: M * k,
          right: M * k,
          bottom: 240 * k,
          opacity: p,
          transform: `translateY(${(1 - p) * 30 * k}px)`,
          direction: rtl ? "rtl" : "ltr",
        }}
      >
        <div style={{ fontFamily: fam(rtl), ...(rtl ? {} : display(104 * k, 1.02)), fontSize: 118 * k, fontWeight: 700, lineHeight: 1.02, color: tok.ink, whiteSpace: "pre-line" }}>
          {beat.kind === "hook" ? plan.headline : beatLabel(beat, rtl)}
        </div>
        <div style={{ height: 1, background: tok.accent, width: `${Math.max(0, Math.min(1, (f - 18) / 26)) * 38}%`, marginTop: 34 * k, opacity: 0.9 }} />
      </div>
    </>
  );
};

/** 02 — EDITORIAL. Full-bleed place, a giant index numeral, copy in a column. */
const Editorial: React.FC<ArtProps & { index?: number }> = ({ beat, plan, f, total, k, index = 1 }) => {
  const tok = tokens(plan);
  const rtl = plan.language === "ar";
  const ap = EASE.out((f - 6) / 22);
  return (
    <div style={{ position: "absolute", inset: 0, background: tok.bg }}>
      {/* the place, full bleed, pushed back so type sits in front of it */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.55 }}>
        <div style={{ position: "absolute", width: 1080, height: 1920, transform: `scale(${k})`, transformOrigin: "0 0" }}>
          <World spec={worldSpec({ ...beat, world: beat.world || "skyline" }, plan, f, total)} />
        </div>
      </div>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(105deg, ${tok.bg} 18%, rgba(5,8,12,0.72) 52%, rgba(5,8,12,0.2) 100%)` }} />
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(5,8,12,0.9) 0%, rgba(5,8,12,0) 30%, rgba(5,8,12,0) 62%, ${tok.bg} 100%)` }} />

      {/* the numeral: 7× the body size, cropped by the frame on purpose */}
      <div
        style={{
          position: "absolute",
          right: -28 * k,
          top: 120 * k,
          fontFamily: DISP,
          fontSize: 420 * k,
          lineHeight: 0.78,
          fontWeight: 700,
          letterSpacing: "-0.07em",
          color: rgba(plan.accent, 0.3),
          opacity: clamp((f - 2) / 20),
        }}
      >
        {String(index).padStart(2, "0")}
      </div>

      <div
        style={{
          position: "absolute",
          left: M * k,
          right: M * k,
          bottom: 300 * k,
          direction: rtl ? "rtl" : "ltr",
          opacity: ap,
          transform: `translateY(${(1 - ap) * 26 * k}px)`,
        }}
      >
        <div style={{ width: 76 * k, height: 3, background: plan.accent, marginBottom: 30 * k }} />
        <div style={{ fontFamily: fam(rtl), fontSize: 92 * k, lineHeight: 1.04, fontWeight: 700, letterSpacing: rtl ? 0 : "-0.04em", color: tok.ink }}>
          {beatLabel(beat, rtl)}
        </div>
        <div style={{ fontFamily: fam(rtl), fontSize: 28 * k, lineHeight: 1.6, color: tok.dim, marginTop: 26 * k, maxWidth: 800 * k }}>
          {beat.line || plan.sub}
        </div>
      </div>
    </div>
  );
};

/** 03 — SILENT. No copy at all. The place does the work; one mark, one hairline. */
const Silent: React.FC<ArtProps> = ({ beat, plan, f, total, k }) => {
  const tok = tokens(plan);
  const rtl = plan.language === "ar";
  const travel = clamp(f / Math.max(1, total));
  return (
    <>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${1 + 0.05 * clamp(f / Math.max(1, total))})`, transformOrigin: "50% 60%" }}>
        <Place spec={worldSpec(beat, plan, f, total)} k={k} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 380 * k, background: "linear-gradient(180deg, rgba(4,7,11,0), rgba(4,7,11,0.85))" }} />
      <div style={{ position: "absolute", left: M * k, right: M * k, bottom: 150 * k, display: "flex", alignItems: "center", gap: 14 * k, opacity: clamp((f - 12) / 26) }}>
        <span style={{ width: 7 * k, height: 7 * k, borderRadius: 99, background: plan.accent }} />
        <span style={{ fontFamily: monoFam(rtl), fontSize: 13 * k, letterSpacing: rtl ? 0 : "0.3em", color: tok.dim, textTransform: "uppercase" }}>{beatLabel(beat, rtl)}</span>
        <span style={{ flex: 1, height: 1, background: tok.hair2, position: "relative" }}>
          <span style={{ position: "absolute", left: `${travel * 100}%`, top: -2 * k, width: 26 * k, height: 2 * k, background: plan.accent }} />
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11 * k, letterSpacing: "0.22em", color: tok.faint }}>{plan.kicker}</span>
      </div>
    </>
  );
};

/** 04 — INDEX. A contents page: the film lists its own chapters, each named. */
const Index: React.FC<ArtProps> = ({ plan, f, k }) => {
  const tok = tokens(plan);
  const rtl = plan.language === "ar";
  const rows = plan.beats.slice(0, 6);
  return (
    <div style={{ position: "absolute", inset: 0, background: tok.bg }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 70% 40% at 50% 0%, ${rgba(plan.accent, 0.08)}, rgba(0,0,0,0) 60%)` }} />
      <div style={{ position: "absolute", left: M * k, right: M * k, top: 150 * k, display: "flex", justifyContent: "space-between", alignItems: "baseline", opacity: clamp(f / 14) }}>
        <span style={{ fontFamily: monoFam(rtl), fontSize: 13 * k, letterSpacing: rtl ? 0 : "0.34em", color: plan.accent, textTransform: "uppercase" }}>{rtl ? "المحتوى" : "contents"}</span>
        <span style={{ fontFamily: monoFam(rtl), fontSize: 12 * k, letterSpacing: rtl ? 0 : "0.2em", color: tok.faint }}>{rl(plan.beats.length, rtl)} {rtl ? "مشاهد" : "beats"}</span>
      </div>
      <div style={{ position: "absolute", left: M * k, right: M * k, top: 300 * k }}>
        {rows.map((b, i) => {
          const at = 8 + i * 7;
          const p = EASE.out((f - at) / 18);
          const last = i === rows.length - 1;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 20 * k,
                padding: `${24 * k}px 0`,
                borderBottom: `1px solid ${tok.hair2}`,
                opacity: p,
                transform: `translateY(${(1 - p) * 16 * k}px)`,
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 12 * k, color: tok.faint, width: 32 * k, flex: "0 0 32px" }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ fontFamily: fam(rtl), fontSize: 46 * k, lineHeight: 1.1, fontWeight: 600, color: last ? tok.dim : tok.ink, flex: 1, direction: rtl ? "rtl" : "ltr" }}>
                {beatLabel(b, rtl)}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 11 * k, letterSpacing: "0.14em", color: rgba(plan.accent, 0.65), textTransform: "uppercase", flex: "0 0 auto" }}>
                {b.world || b.kind}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 11 * k, color: tok.faint, width: 44 * k, textAlign: "right", flex: "0 0 44px" }}>{b.seconds.toFixed(1)}s</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** 05 — STACK. One word per line, enormous, each arriving late. */
const Stack: React.FC<ArtProps> = ({ plan, f, k, beat }) => {
  const tok = tokens(plan);
  const rtl = plan.language === "ar";
  const words = (beat.line || plan.headline).replace(/\n/g, " ").split(/\s+/).slice(0, 4);
  return (
    <div style={{ position: "absolute", inset: 0, background: tok.bg }}>
      <div style={{ position: "absolute", left: M * k, right: M * k, top: "50%", transform: "translateY(-50%)", direction: rtl ? "rtl" : "ltr" }}>
        {words.map((w, i) => {
          const p = EASE.out((f - 4 - i * 6) / 20);
          return (
            <div
              key={i}
              style={{
                fontFamily: fam(rtl),
                fontSize: 132 * k,
                lineHeight: 0.96,
                fontWeight: 700,
                letterSpacing: rtl ? 0 : "-0.05em",
                color: i === words.length - 1 ? plan.accent : tok.ink,
                opacity: p,
                transform: `translateY(${(1 - p) * 34 * k}px)`,
                clipPath: `inset(0 0 ${(1 - p) * 100}% 0)`,
              }}
            >
              {w}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** 06 — METRIC. A single figure, its unit, and the smallest possible label. */
const Metric: React.FC<ArtProps> = ({ plan, f, k }) => {
  const tok = tokens(plan);
  const rtl = plan.language === "ar";
  const v = rtl ? "٩٩.٩" : "99.9";
  const p = EASE.out((f - 6) / 24);
  return (
    <div style={{ position: "absolute", inset: 0, background: tok.bg }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 70% 40% at 50% 60%, ${rgba(plan.accent, 0.1)}, rgba(0,0,0,0) 70%)` }} />
      <div style={{ position: "absolute", left: M * k, right: M * k, top: 430 * k, opacity: p }}>
        <div style={{ fontFamily: fam(rtl), fontSize: 340 * k, lineHeight: 0.86, fontWeight: 700, letterSpacing: "-0.06em", color: tok.ink, transform: `translateY(${(1 - p) * 30 * k}px)` }}>
          {v}
          <span style={{ fontSize: 96 * k, color: plan.accent, marginLeft: 12 * k }}>%</span>
        </div>
        <div style={{ height: 1, background: tok.hair, marginTop: 40 * k, transform: `scaleX(${p})`, transformOrigin: "0 50%" }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22 * k }}>
          <span style={{ fontFamily: monoFam(rtl), fontSize: 15 * k, letterSpacing: rtl ? 0 : "0.28em", color: tok.dim, textTransform: "uppercase" }}>
            {rtl ? "الاستقرار · ١٢ شهراً" : "uptime · twelve months"}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 15 * k, color: tok.faint }}>2026</span>
        </div>
      </div>
      <div style={{ position: "absolute", left: M * k, bottom: 200 * k, fontFamily: fam(rtl), fontSize: 30 * k, color: tok.dim, direction: rtl ? "rtl" : "ltr", maxWidth: 700 * k, opacity: clamp((f - 20) / 20) }}>
        {plan.sub}
      </div>
    </div>
  );
};

/** 07 — GRID. Four micro-scenes with captions: density as an argument. */
const Grid4: React.FC<ArtProps> = ({ beat, plan, f, total, k }) => {
  const tok = tokens(plan);
  const rtl = plan.language === "ar";
  const cells = [0, 1, 2, 3];
  return (
    <div style={{ position: "absolute", inset: 0, background: tok.bg }}>
      {cells.map((i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const p = EASE.out((f - 6 - i * 5) / 20);
        const cw = (1080 - M * 2 - 24) / 2;
        const ch = 560;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: (M + col * (cw + 24)) * k,
              top: (250 + row * (ch + 24)) * k,
              width: cw * k,
              height: ch * k,
              overflow: "hidden",
              borderRadius: 4 * k,
              opacity: p,
              transform: `translateY(${(1 - p) * 18 * k}px)`,
            }}
          >
            <div style={{ position: "absolute", width: 1080, height: 1920, transform: `scale(${(cw * k) / 1080})`, transformOrigin: "0 0" }}>
              <World spec={worldSpec({ ...beat, world: (["haussmann", "street", "skyline", "showroom"] as const)[i] }, plan, f + i * 12, total)} />
            </div>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(4,7,11,0.88))" }} />
            <div style={{ position: "absolute", left: 18 * k, bottom: 16 * k, fontFamily: monoFam(rtl), fontSize: 12 * k, letterSpacing: rtl ? 0 : "0.24em", color: tok.dim, textTransform: "uppercase" }}>
              {String(i + 1).padStart(2, "0")} · {(["facade", "avenue", "skyline", "rail"] as const)[i]}
            </div>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: M * k, right: M * k, top: 170 * k, fontFamily: fam(rtl), fontSize: 44 * k, fontWeight: 700, color: tok.ink, direction: rtl ? "rtl" : "ltr", opacity: clamp(f / 16) }}>
        {beat.caption || plan.sub}
      </div>
    </div>
  );
};

/** 08 — DIPTYCH. The place on one side, a colour field with type on the other. */
const Diptych: React.FC<ArtProps> = ({ beat, plan, f, total, k }) => {
  const tok = tokens(plan);
  const rtl = plan.language === "ar";
  const p = EASE.out((f - 10) / 22);
  const field = mix(plan.accent, "#0A1A3A", 0.55);
  return (
    <div style={{ position: "absolute", inset: 0, background: tok.bg }}>
      {/* upper plate: the place, wide and quiet */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 1130 * k, overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 1080, height: 1920, transform: `scale(${k})`, transformOrigin: "0 0" }}>
          <World spec={worldSpec(beat, plan, f, total)} />
        </div>
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(4,7,11,0.55) 0%, rgba(4,7,11,0) 34%, rgba(4,7,11,0.9) 100%)` }} />
      </div>

      {/* lower plate: a colour, a rule, the line */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1130 * k, bottom: 0, background: `linear-gradient(180deg, ${field}, #05080C 78%)` }}>
        <div style={{ position: "absolute", left: M * k, right: M * k, top: 74 * k }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 * k, opacity: p }}>
            <span style={{ fontFamily: monoFam(rtl), fontSize: 12 * k, letterSpacing: rtl ? 0 : "0.3em", color: plan.accent, textTransform: "uppercase" }}>
              {beat.caption || beatLabel(beat, rtl)}
            </span>
            <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.16)" }} />
          </div>
          <div
            style={{
              fontFamily: fam(rtl),
              fontSize: 64 * k,
              lineHeight: 1.16,
              fontWeight: 700,
              color: tok.ink,
              marginTop: 30 * k,
              direction: rtl ? "rtl" : "ltr",
              opacity: p,
              transform: `translateY(${(1 - p) * 22 * k}px)`,
            }}
          >
            {beat.line || plan.sub}
          </div>
        </div>
      </div>
    </div>
  );
};

/** 09 — CAPTION. The place, with a broadcast lower third and a timecode. */
const Caption: React.FC<ArtProps> = ({ beat, plan, f, total, k }) => {
  const tok = tokens(plan);
  const rtl = plan.language === "ar";
  const p = EASE.out((f - 14) / 20);
  return (
    <>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${1 + 0.05 * clamp(f / Math.max(1, total))})`, transformOrigin: "50% 60%" }}>
        <Place spec={worldSpec(beat, plan, f, total)} k={k} />
      </div>
      <div
        style={{
          position: "absolute",
          left: M * k,
          right: M * k,
          bottom: 260 * k,
          opacity: p,
          transform: `translateY(${(1 - p) * 20 * k}px)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 * k, marginBottom: 16 * k }}>
          <span style={{ width: 46 * k, height: 2, background: plan.accent }} />
          <span style={{ fontFamily: monoFam(rtl), fontSize: 12 * k, letterSpacing: rtl ? 0 : "0.3em", color: tok.dim, textTransform: "uppercase" }}>
            {beat.caption}
          </span>
        </div>
        <div
          style={{
            fontFamily: fam(rtl),
            fontSize: 48 * k,
            lineHeight: 1.3,
            color: tok.ink,
            direction: rtl ? "rtl" : "ltr",
            background: "rgba(4,7,11,0.55)",
            backdropFilter: "blur(8px)",
            padding: `${20 * k}px ${24 * k}px`,
            borderLeft: `2px solid ${plan.accent}`,
          }}
        >
          {beat.line}
        </div>
        <div style={{ display: "flex", gap: 18 * k, marginTop: 14 * k }}>
          <span style={{ fontFamily: MONO, fontSize: 11 * k, color: tok.faint }}>TC 00:{String(Math.floor(f / 30)).padStart(2, "0")}:{String(Math.floor(f % 30)).padStart(2, "0")}</span>
          <span style={{ fontFamily: MONO, fontSize: 11 * k, color: tok.faint }}>4K · 30P</span>
        </div>
      </div>
    </>
  );
};

/** 10 — MARQUEE. A line of type crossing the frame, repeated, huge. */
const Marquee: React.FC<ArtProps> = ({ plan, f, k, beat }) => {
  const tok = tokens(plan);
  const rtl = plan.language === "ar";
  const line = (beat.caption || plan.sub).toUpperCase();
  const shift = (f * 2.4) % 360;
  return (
    <div style={{ position: "absolute", inset: 0, background: tok.bg, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 780 * k, left: -shift * k, whiteSpace: "nowrap", fontFamily: fam(rtl), fontSize: 120 * k, fontWeight: 700, letterSpacing: rtl ? 0 : "-0.04em", color: "rgba(238,244,251,0.1)" }}>
        {line} · {line} · {line}
      </div>
      <div style={{ position: "absolute", top: 940 * k, left: shift * k - 400 * k, whiteSpace: "nowrap", fontFamily: fam(rtl), fontSize: 120 * k, fontWeight: 700, letterSpacing: rtl ? 0 : "-0.04em", color: rgba(plan.accent, 0.85) }}>
        {line}
      </div>
      <div style={{ position: "absolute", left: M * k, bottom: 220 * k, fontFamily: fam(rtl), fontSize: 34 * k, color: tok.dim, direction: rtl ? "rtl" : "ltr", maxWidth: 620 * k }}>
        {plan.headline.replace(/\n/g, " ")}
      </div>
    </div>
  );
};

/** 11 — SIGNATURE. The end card. */
const Signature: React.FC<ArtProps> = ({ plan, f, k }) => {
  const tok = tokens(plan);
  const rtl = plan.language === "ar";
  const s = 0.94 + 0.06 * EASE.out(f / 26);
  return (
    <div style={{ position: "absolute", inset: 0, background: tok.bg }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 60% 40% at 50% 50%, ${rgba(plan.accent, 0.14)}, rgba(0,0,0,0) 68%)` }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transform: `scale(${s})`, opacity: clamp(f / 12) }}>
        <div style={{ width: 74 * k, height: 74 * k, borderRadius: 20 * k, border: `${2 * k}px solid ${plan.accent}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 24 * k, height: 24 * k, borderRadius: 99, background: plan.accent }} />
        </div>
        <div style={{ marginTop: 34 * k, fontFamily: DISP, fontSize: 60 * k, fontWeight: 700, letterSpacing: "-0.03em", color: tok.ink }}>VITO BYTE</div>
        <div style={{ marginTop: 16 * k, fontFamily: monoFam(rtl), fontSize: 14 * k, letterSpacing: rtl ? 0 : "0.34em", color: tok.dim }}>
          {rtl ? "تصميم · فيلم · كود" : "DESIGN · FILM · CODE"}
        </div>
        <div style={{ marginTop: 40 * k, fontFamily: monoFam(rtl), fontSize: 14 * k, letterSpacing: rtl ? 0 : "0.26em", color: plan.accent }}>{rtl ? "فيتوبايت.ستوديو" : "vitobyte.studio"}</div>
      </div>
    </div>
  );
};

/* ================================================================== chooser */

export const ARCH_IDS = ["poster","editorial","silent","index","stack","metric","grid","diptych","caption","marquee","signature"] as const;

export type ArchId = "poster" | "editorial" | "silent" | "index" | "stack" | "metric" | "grid" | "diptych" | "caption" | "marquee" | "signature";

const ARCH: Record<ArchId, React.FC<ArtProps & { index?: number }>> = {
  poster: Poster,
  editorial: Editorial,
  silent: Silent,
  index: Index,
  stack: Stack,
  metric: Metric,
  grid: Grid4,
  diptych: Diptych,
  caption: Caption,
  marquee: Marquee,
  signature: Signature,
};

/**
 * The cast. Each beat kind may be expressed several ways; the choice rotates so
 * two films with the same shape still cut differently, and no two consecutive
 * beats may share an architecture.
 */
const CAST: Record<Beat["kind"], ArchId[]> = {
  hook: ["stack", "poster", "editorial"],
  place: ["silent", "caption", "diptych", "poster"],
  evidence: ["grid", "index", "marquee"],
  detail: ["diptych", "caption"],
  number: ["metric", "editorial"],
  end: ["signature"],
};

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

/** pick the architecture for beat i, never repeating the previous one */
export const chooseArch = (plan: Decision, i: number): ArchId => {
  const forced = plan.beats[i]?.arch;
  if (forced && (ARCH_IDS as readonly string[]).includes(forced)) return forced as ArchId;
  const b = plan.beats[i];
  const pool = CAST[b.kind] || ["poster"];
  const prev = i > 0 ? chooseArchIdMemo(plan, i - 1) : null;
  const usable = pool.filter((a) => a !== prev);
  const list = usable.length ? usable : pool;
  return list[hash(`${plan.brief}:${i}:${b.kind}`) % list.length];
};

const memo = new Map<string, ArchId>();
const chooseArchIdMemo = (plan: Decision, i: number): ArchId => {
  const key = `${plan.seed}:${i}:${plan.beats[i]?.arch || ""}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const id = chooseArch(plan, i);
  memo.set(key, id);
  return id;
};

/** draw one beat with the architecture the director chose */
export const BeatFrame: React.FC<{ plan: Decision; index: number; f: number; w: number; h: number }> = ({ plan, index, f, w, h }) => {
  const beat = plan.beats[index];
  const C = ARCH[chooseArchIdMemo(plan, index)];
  const k = w / 1080;
  const total = Math.max(1, Math.round(beat.seconds * 30));
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#05080c" }}>
      <C beat={beat} plan={plan} f={f} total={total} w={w} h={h} k={k} index={index + 1} />
    </div>
  );
};

/** the full frame at a given absolute frame, with cuts and a grade */
export const FilmFrame: React.FC<{ plan: Decision; frame: number; w: number; h: number }> = ({ plan, frame, w, h }) => {
  let acc = 0;
  let idx = 0;
  let start = 0;
  let len = 1;
  for (let i = 0; i < plan.beats.length; i++) {
    const l = Math.max(1, Math.round(plan.beats[i].seconds * 30));
    if (frame >= acc && frame < acc + l) {
      idx = i;
      start = acc;
      len = l;
      break;
    }
    acc += l;
    idx = i;
    start = acc;
    len = l;
  }
  const local = frame - start;
  const k = w / 1080;

  // the cut: a short dissolve or a hard throw, taken from the beat's own transition
  const prevBeat = idx > 0 ? plan.beats[idx - 1] : null;
  const trans = prevBeat?.transition || "dissolve";
  const dur = trans === "whip" ? 7 : trans === "dip" ? 12 : trans === "cut" ? 1 : Math.round(len * 0.05);
  const into = Math.min(1, local / Math.max(1, dur));
  const incoming = EASE.out(into);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#04070c", width: w, height: h }}>
      {idx > 0 && into < 1 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: trans === "dip" ? Math.max(0, 1 - into * 1.6) : 1 - incoming,
            transform: trans === "whip" ? `translateX(${-incoming * 100}%)` : undefined,
            filter: trans === "whip" ? `blur(${incoming * 16}px)` : trans === "match" ? `blur(${incoming * 8}px)` : undefined,
          }}
        >
          <BeatFrame plan={plan} index={idx - 1} f={9999} w={w} h={h} />
        </div>
      ) : null}

      <div style={{ position: "absolute", inset: 0, opacity: incoming, transform: incoming < 1 ? `scale(${1.02 - 0.02 * incoming})` : undefined }}>
        <BeatFrame plan={plan} index={idx} f={local} w={w} h={h} />
      </div>

      {/* colour rhythm: consecutive beats alternate temperature, so the film breathes
          and the palette is never one note for a whole reel */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(${idx % 2 ? 200 : 160}deg, ${rgba(idx % 2 ? "#2E63FF" : plan.accent, 0.11)}, rgba(0,0,0,0) 58%)`,
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />

      <Grade f={frame} accent={plan.accent} amount={0.5} vignette={0.42} />

      {/* the rail: pagination, always on, always quiet */}
      <div style={{ position: "absolute", left: M * k, right: M * k, bottom: 44 * k, display: "flex", alignItems: "center", gap: 12 * k, opacity: 0.85 }}>
        <span style={{ width: 5 * k, height: 5 * k, borderRadius: 99, background: plan.accent }} />
        <span style={{ fontFamily: MONO, fontSize: 11 * k, letterSpacing: "0.26em", color: "rgba(238,244,251,0.4)", textTransform: "uppercase" }}>{plan.kicker}</span>
        <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
        <span style={{ fontFamily: MONO, fontSize: 11 * k, letterSpacing: "0.26em", color: "rgba(238,244,251,0.4)" }}>
          {String(idx + 1).padStart(2, "0")} / {String(plan.beats.length).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
};

export const archName = (id: ArchId) => id;
