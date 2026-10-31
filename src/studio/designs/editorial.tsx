/**
 * EDITORIAL — the language of a printed spread.
 *
 * Rules, columns, an index numeral, a huge headline set tight to the measure,
 * and a colour block that does the work a photograph would. Nothing moves fast;
 * the page is composed and then small things arrive.
 */
import React from "react";
import { Brief } from "../types";
import {
  Stage, Grain, Mark, MONO, DISP, PAD, DH, DW, fit, win, rgba, useTimeline, useHero, linesOf,
} from "../kit";
import { Grade, display } from "../craft";

export const Editorial: React.FC<Brief> = (p) => {
  const t = useTimeline();
  const { f, F, k, outro } = t;
  const a = p.accent;
  const hero = useHero(p.hero, t, 0.2, 0.2);
  const head = linesOf(p.headline);
  const exit = 1 - win(f, outro - 8, outro + 12);

  const paper = "#0A0D12";
  const ink = "#F4F1EA";

  return (
    <Stage k={k} bg={paper}>
      {/* top rule + masthead */}
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 120, height: 2, background: ink, opacity: win(f, 2, 14) }} />
      <div
        style={{
          position: "absolute",
          left: PAD,
          right: PAD,
          top: 140,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: MONO,
          fontSize: 16,
          letterSpacing: "0.26em",
          color: "rgba(244,241,234,0.55)",
          textTransform: "uppercase",
          opacity: win(f, 4, 18),
        }}
      >
        <span>vito byte studio</span>
        <span>{p.kicker}</span>
        <span>{`no. ${String(Math.max(1, Math.round(hero.p * 12))).padStart(2, "0")}`}</span>
      </div>

      {/* the index numeral, oversized, bleeding off the right */}
      <div
        style={{
          position: "absolute",
          right: -90,
          top: 210,
          fontFamily: DISP,
          fontSize: 420,
          fontWeight: 700,
          lineHeight: 0.8,
          letterSpacing: "-0.08em",
          color: rgba(a, 0.11),
          opacity: win(f, F * 0.1, F * 0.24) * exit,
        }}
      >
        {hero.value}
      </div>

      {/* colour block — the "photograph" */}
      <div
        style={{
          position: "absolute",
          left: PAD,
          top: 300,
          width: 430,
          height: 500,
          background: a,
          opacity: win(f, F * 0.12, F * 0.22) * exit,
          transform: `translateY(${(1 - win(f, F * 0.12, F * 0.26)) * 40}px)`,
        }}
      >
        <div style={{ position: "absolute", left: 22, bottom: 18, fontFamily: MONO, fontSize: 15, letterSpacing: "0.22em", color: "#04120A", textTransform: "uppercase" }}>
          {p.unit || "fig. 01"}
        </div>
      </div>

      {/* the hero number, set as a caption to the block */}
      <div style={{ position: "absolute", left: PAD, top: 830, opacity: exit }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
          <div
            style={{
              fontFamily: DISP,
              fontSize: 190,
              fontWeight: 700,
              letterSpacing: "-0.06em",
              lineHeight: 0.9,
              color: ink,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {hero.value}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 26, letterSpacing: "0.2em", color: a, textTransform: "uppercase" }}>{p.unit}</div>
        </div>
        <div style={{ height: 2, background: "rgba(244,241,234,0.28)", margin: "26px 0 18px", width: 620 }} />
        <div style={{ fontFamily: MONO, fontSize: 19, letterSpacing: "0.1em", color: "rgba(244,241,234,0.6)", maxWidth: 640, lineHeight: 1.6 }}>
          {p.sub}
        </div>
      </div>

      {/* the headline, pulled tight */}
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 1180, opacity: exit }}>
        {head.map((line, i) => {
          const on = win(f, F * 0.3 + i * 9, F * 0.36 + i * 9);
          return (
            <div
              key={i}
              style={{
                fontFamily: DISP,
                fontSize: Math.min(...head.map((l) => fit(l, DW - PAD * 2 - 10, 92, 44))),
                fontWeight: 600,
                lineHeight: 1.06,
                letterSpacing: "-0.045em",
                color: i === head.length - 1 ? a : ink,
                whiteSpace: "nowrap",
                opacity: on,
                transform: `translateY(${(1 - on) * 20}px)`,
              }}
            >
              {line}
            </div>
          );
        })}
        <div style={{ marginTop: 30, height: 2, background: "rgba(244,241,234,0.16)" }} />
        <div style={{ marginTop: 18, fontFamily: MONO, fontSize: 17, letterSpacing: "0.18em", color: "rgba(244,241,234,0.45)", textTransform: "uppercase" }}>
          words — vito byte · type — grotesk · edition — {new Date(0).getFullYear() + 56}
        </div>
      </div>

      {/* bottom rule */}
      <div style={{ position: "absolute", left: PAD, right: PAD, bottom: 110, height: 1, background: "rgba(244,241,234,0.2)" }} />

      {/* outro: the colophon */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 560,
          bottom: 0,
          background: paper,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 26,
          opacity: win(f, outro, outro + 16),
        }}
      >
        <Mark size={104} color={a} stroke={10} />
        <div style={{ fontFamily: DISP, fontSize: 82, fontWeight: 700, letterSpacing: "-0.02em", color: ink }}>
          VITO BYTE
        </div>
        <div style={{ fontFamily: MONO, fontSize: 17, letterSpacing: "0.58em", color: "rgba(244,241,234,0.4)", textTransform: "uppercase", marginTop: -12 }}>
          studio
        </div>
        <div style={{ width: 420, height: 2, background: rgba(a, 0.7), marginTop: 14 }} />
        <div style={{ fontFamily: MONO, fontSize: 25, letterSpacing: "0.2em", color: a }}>{p.cta}</div>
      </div>

      <Grade f={f} accent={a} amount={0.55} vignette={0.3} />
    </Stage>
  );
};
