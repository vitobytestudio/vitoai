/**
 * VITO FILM — the film the agent decided on.
 *
 * Every frame here is drawn from the plan: the places come from the brain's
 * allowed list, the palette from the tone it chose, the narration from the
 * brief's own language, the score from the same beat sheet.
 *
 * The composition takes its soundtrack as a prop so the browser renderer can
 * encode it beside the picture — the file a viewer downloads is the film they
 * watched, with sound.
 */
import React, { useMemo } from "react";
import { AbsoluteFill, Audio, useCurrentFrame, useVideoConfig } from "remotion";
import type { Decision, Beat } from "./brain";
import { World } from "./world";
import { MONO, DISP, DW, PAD, rgba, clamp, mix } from "./kit";

/**
 * Arabic needs its own family. Space Grotesk carries no Arabic glyphs, and a
 * large headline with no glyph available does not fall back gracefully in the
 * renderer — it stalls. Cairo ships with the project for exactly this.
 */
const AR = '"Cairo", "IBM Plex Sans Arabic", "Tajawal", sans-serif';
const fontFor = (rtl: boolean) => (rtl ? AR : DISP);
const monoFor = (rtl: boolean) => (rtl ? AR : MONO);
/** Arabic does not want kerning/ligature feature flags from the Latin table */
const typeFor = (rtl: boolean, size: number, leading = 1.05) =>
  rtl
    ? { fontSize: size, lineHeight: leading, letterSpacing: "0", fontFamily: AR }
    : { ...display(size, leading), fontFamily: DISP };
import { Grade, cutState, incoming, display, EASE } from "./craft";

export type VitoProps = { decision: Decision; score?: string };

/* -------------------------------------------------------------- primitives */

const rise = (f: number, at: number, dur = 18, dist = 22) => {
  const p = EASE.out((f - at) / dur);
  return { opacity: p, transform: `translateY(${(1 - p) * dist}px)` };
};

const Rail: React.FC<{ f: number; accent: string; index: number; total: number; label: string }> = ({ f, accent, index, total, label }) => (
  <div style={{ position: "absolute", left: PAD, right: PAD, bottom: 92, opacity: clamp((f - 8) / 16) }}>
    <div style={{ height: 1, background: "rgba(255,255,255,0.09)", marginBottom: 18 }} />
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: accent }} />
      <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.26em", color: "#5C6B7E", textTransform: "uppercase" }}>{label}</span>
      <span style={{ flex: 1 }} />
      <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.26em", color: "#5C6B7E" }}>
        {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </span>
    </div>
  </div>
);

/** the words spoken over the beat, burned in the lower third */
const Narration: React.FC<{ text: string; f: number; accent: string; rtl: boolean }> = ({ text, f, accent, rtl }) => {
  const p = EASE.out((f - 10) / 18);
  return (
    <>
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 620, background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(3,6,10,0.55) 46%, rgba(3,6,10,0.9) 100%)" }} />
    <div
      style={{
        position: "absolute",
        left: PAD,
        right: PAD,
        bottom: 210,
        opacity: p,
        transform: `translateY(${(1 - p) * 16}px)`,
        direction: rtl ? "rtl" : "ltr",
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
      }}
    >
      <span style={{ width: 3, alignSelf: "stretch", background: accent, opacity: 0.9, borderRadius: 2 }} />
      <span
        style={{
          fontFamily: fontFor(rtl),
          fontSize: 34,
          lineHeight: 1.45,
          letterSpacing: rtl ? "0" : "-0.01em",
          color: "#F2F7FF",
          textShadow: "0 2px 24px rgba(0,0,0,0.9)",
          maxWidth: 820,
        }}
      >
        {text}
      </span>
    </div>
    </>
  );
};

/* ------------------------------------------------------------------ places */

const Place: React.FC<{ beat: Beat; f: number; d: Decision; progress: number }> = ({ beat, f, d, progress }) => (
  <>
    <AbsoluteFill style={{ transform: `scale(${1.04 + 0.08 * progress})`, transformOrigin: "50% 52%" }}>
      <World
        spec={{
          kind: beat.world || "skyline",
          mood: d.tone === "clinical" ? "night" : d.tone === "warm" ? "dusk" : d.tone === "noir" ? "neon" : "interior",
          accent: d.accent,
          seed: (d.seed + (beat.world || "").length * 97) % 99991,
          p: progress,
          density: 0.5,
        }}
      />
    </AbsoluteFill>
    {beat.caption ? (
      <div
        style={{
          position: "absolute",
          left: PAD,
          top: 168,
          display: "flex",
          alignItems: "center",
          gap: 12,
          opacity: clamp((f - 6) / 14),
        }}
      >
        <span style={{ width: 28, height: 1, background: d.accent }} />
        <span style={{ fontFamily: monoFor(d.language === "ar"), fontSize: 17, letterSpacing: d.language === "ar" ? "0" : "0.3em", textTransform: "uppercase", color: "#F2F7FF", textShadow: "0 2px 18px rgba(0,0,0,0.85)" }}>
          {beat.caption}
        </span>
      </div>
    ) : null}
  </>
);

/* ------------------------------------------------------------------- beats */

const BeatBody: React.FC<{ beat: Beat; f: number; d: Decision; index: number }> = ({ beat, f, d, index }) => {
  const rtl = d.language === "ar";

  if (beat.kind === "hook") {
    return (
      <>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 700, background: `radial-gradient(ellipse 62% 100% at 50% 126%, ${rgba(d.accent, 0.2)}, rgba(0,0,0,0) 72%)` }} />
        <div style={{ position: "absolute", left: PAD, right: PAD, top: 158, display: "flex", alignItems: "center", gap: 12, ...rise(f, 0) }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: d.accent, boxShadow: `0 0 16px ${rgba(d.accent, 0.9)}` }} />
          <span style={{ fontFamily: rtl ? AR : MONO, fontSize: 16, letterSpacing: rtl ? "0" : "0.34em", textTransform: "uppercase", color: d.ink }}>{d.kicker}</span>
          <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
        </div>
        <div
          style={{
            position: "absolute",
            left: PAD,
            right: PAD,
            top: 300,
            ...typeFor(rtl, 104, 1.05),
            fontWeight: 700,
            color: d.ink,
            direction: rtl ? "rtl" : "ltr",
            whiteSpace: "pre-line",
            ...rise(f, 6, 22, 26),
          }}
        >
          {d.headline}
        </div>
        <div style={{ position: "absolute", left: PAD, right: PAD, top: 640, fontFamily: fontFor(rtl), fontSize: 32, lineHeight: 1.5, color: "#93A4B8", direction: rtl ? "rtl" : "ltr", ...rise(f, 20) }}>
          {d.sub}
        </div>
        <div style={{ position: "absolute", left: PAD, right: PAD, top: 800, height: 1, background: "rgba(255,255,255,0.1)", transform: `scaleX(${EASE.out((f - 24) / 20)})`, transformOrigin: rtl ? "100% 50%" : "0 50%" }} />
        <div style={{ position: "absolute", left: PAD, right: PAD, top: 860, display: "flex", gap: 24, opacity: clamp((f - 30) / 16) }}>
          {d.worlds.slice(0, 4).map((w) => (
            <span key={w} style={{ fontFamily: MONO, fontSize: 14, letterSpacing: "0.22em", color: "#5C6B7E", textTransform: "uppercase" }}>
              {w}
            </span>
          ))}
        </div>
        {/* the lower half is a lit field, not dead space: bars that rise with the
            score, so an empty frame still reads as designed */}
        <div style={{ position: "absolute", left: PAD, right: PAD, top: 1010, height: 460, display: "flex", gap: 3, alignItems: "flex-end", opacity: clamp((f - 14) / 24) }}>
          {Array.from({ length: 44 }).map((_, i) => {
            const h = 20 + Math.abs(Math.sin(i * 0.51)) * 380 + ((i * 23) % 70);
            const on = (i / 44) * 62 < (f - 14) * 1.9;
            const edge = Math.max(0, 1 - Math.abs(i / 44 - 0.5) * 1.5);
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: h * (0.5 + 0.5 * edge),
                  borderRadius: 2,
                  background: on ? `linear-gradient(180deg, ${rgba(d.accent, 0.38)}, ${rgba(d.accent, 0.03)})` : "rgba(255,255,255,0.045)",
                }}
              />
            );
          })}
        </div>
      </>
    );
  }

  if (beat.kind === "number") {
    const cells: Array<[string, string]> = rtl
      ? [
          ["99.9%", "استقرار"],
          ["38ms", "زمن الاستجابة"],
          ["24/7", "بلا توقف"],
        ]
      : [
          ["99.9%", "uptime"],
          ["38 ms", "response"],
          ["24/7", "no pause"],
        ];
    return (
      <>
        <div style={{ position: "absolute", left: PAD, right: PAD, top: 168, display: "flex", alignItems: "center", gap: 12, ...rise(f, 0) }}>
          <span style={{ fontFamily: monoFor(rtl), fontSize: 16, letterSpacing: rtl ? "0" : "0.32em", textTransform: "uppercase", color: d.ink }}>{rtl ? "السجل" : "the record"}</span>
          <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
        </div>
        <div style={{ position: "absolute", left: PAD, right: PAD, top: 620, display: "flex", gap: 18 }}>
          {cells.map(([v, k], i) => (
            <div
              key={k}
              style={{
                flex: 1,
                borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.025)",
                padding: "54px 30px 44px",
                ...rise(f, 6 + i * 6),
              }}
            >
              <div style={{ ...typeFor(false, 82, 1), fontWeight: 700, color: i === 0 ? d.accent : d.ink }}>{v}</div>
              <div style={{ fontFamily: monoFor(rtl), fontSize: 13, letterSpacing: rtl ? "0" : "0.16em", textTransform: "uppercase", color: "#5C6B7E", marginTop: 10 }}>{k}</div>
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", left: PAD, right: PAD, top: 980, height: 1, background: "rgba(255,255,255,0.09)", transform: `scaleX(${EASE.out((f - 22) / 22)})`, transformOrigin: rtl ? "100% 50%" : "0 50%" }} />
      </>
    );
  }

  if (beat.kind === "end") {
    const s = 0.94 + 0.06 * EASE.out(f / 26);
    return (
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: `scale(${s})`, opacity: clamp(f / 12), display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            style={{
              width: 74,
              height: 74,
              borderRadius: 20,
              border: `2px solid ${d.accent}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 80px ${rgba(d.accent, 0.4)}`,
            }}
          >
            <div style={{ width: 24, height: 24, borderRadius: 99, background: d.accent }} />
          </div>
          <div style={{ marginTop: 32, fontFamily: fontFor(rtl), fontSize: 58, fontWeight: 700, letterSpacing: "-0.03em", color: d.ink }}>VITO BYTE</div>
          <div style={{ marginTop: 14, fontFamily: MONO, fontSize: 16, letterSpacing: "0.34em", color: "#8FA0B4" }}>{rtl ? "تصميم · فيلم · كود" : "DESIGN · FILM · CODE"}</div>
          <div style={{ marginTop: 38, fontFamily: MONO, fontSize: 15, letterSpacing: "0.28em", color: d.accent }}>{rtl ? "فيتوبايت.ستوديو" : "vitobyte.studio"}</div>
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <>
      <Place beat={beat} f={f} d={d} progress={clamp(f / 120)} />
      {d.narration && beat.line ? <Narration text={beat.line} f={f} accent={d.accent} rtl={rtl} /> : null}
    </>
  );
};

/* -------------------------------------------------------------------- film */

export const VitoFilm: React.FC<VitoProps> = ({ decision, score }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  const marks = useMemo(() => {
    let acc = 0;
    return decision.beats.map((b) => {
      const start = acc;
      const len = Math.max(1, Math.round(b.seconds * fps));
      acc += len;
      return { start, len, beat: b };
    });
  }, [decision, fps]);

  const idx = Math.min(marks.length - 1, Math.max(0, marks.findIndex((m) => f >= m.start && f < m.start + m.len)));
  const m = marks[idx];
  const local = f - m.start;
  const prev = idx > 0 ? marks[idx - 1] : null;
  const out = prev ? cutState(prev.beat.transition, local, m.len) : null;
  const into = prev ? incoming(prev.beat.transition, local, m.len) : 1;

  const labels = ["the claim", "the place", "the place", "the evidence", "the record", "signature"];

  return (
    <AbsoluteFill style={{ background: "#05080C" }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 90% 50% at 50% -10%, ${rgba(decision.accent, 0.12)}, rgba(0,0,0,0) 62%)` }} />

      {out ? (
        <AbsoluteFill style={{ opacity: out.opacity, transform: out.transform, filter: out.filter }}>
          <BeatBody beat={prev!.beat} f={prev!.len} d={decision} index={idx - 1} />
        </AbsoluteFill>
      ) : null}

      <AbsoluteFill style={{ opacity: into, transform: into < 1 ? `scale(${1.03 - 0.03 * into})` : undefined }}>
        <BeatBody beat={m.beat} f={local} d={decision} index={idx} />
      </AbsoluteFill>

      <Rail f={local} accent={decision.accent} index={idx} total={marks.length} label={labels[idx] || "beat"} />
      <Grade f={f} accent={decision.accent} amount={0.55} vignette={0.44} />

      {score && score.length > 32 ? <Audio src={score} /> : null}
    </AbsoluteFill>
  );
};

export const AgentFilm = VitoFilm;

/** frames for a decision, used when registering the composition */
export const vitoFrames = (d: Decision, fps = 30) => Math.max(1, Math.round(d.seconds * fps));

export const agentFrames = vitoFrames;
