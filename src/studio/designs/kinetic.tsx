/**
 * KINETIC — the language of After Effects kinetic typography.
 *
 * Huge words, hard alignments, masks that slice upward from the baseline, a
 * number that slams in twice (solid + outline offset), then the whole headline
 * repeats into a vertical marquee that compresses to a rule.
 */
import React from "react";
import { Brief } from "../types";
import {
  Stage, Grain, Mark, MONO, DISP, PAD, clamp, win, rgba, hash, useTimeline, useHero, linesOf, fit, DW,
} from "../kit";

export const Kinetic: React.FC<Brief> = (p) => {
  const t = useTimeline();
  const { f, F, k, outro } = t;
  const a = p.accent;
  const hero = useHero(p.hero, t, 0.18, 0.16);
  const head = linesOf(p.headline);
  const hSize = Math.min(...head.map((l) => fit(l, DW - PAD * 2, 132, 62)));
  const exit = 1 - win(f, outro - 6, outro + 12);

  /* the number slams: 1.35 → 1.0 with an outline partner trailing behind */
  const slam = win(f, F * 0.18, F * 0.22);
  const scale = 1.34 - 0.34 * slam;

  /* marquee rows repeat the headline, scrolling on the film clock */
  const rows = 9;
  const rowH = 118;

  return (
    <Stage k={k} bg="#04080F">
      {/* ------------------------------------------------ chapter word */}
      <div
        style={{
          position: "absolute",
          left: PAD,
          top: 150,
          display: "flex",
          alignItems: "center",
          gap: 16,
          opacity: win(f, 2, 16),
        }}
      >
        <div style={{ width: 8, height: 8, background: a }} />
        <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: "0.34em", color: "#E8F4FF", textTransform: "uppercase" }}>
          {p.kicker}
        </div>
      </div>

      {/* ------------------------------------------------ headline: mask slices */}
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 300, opacity: exit }}>
        {head.map((line, i) => {
          const at = 14 + i * 13;
          const on = win(f, at, at + 18);
          return (
            <div key={i} style={{ overflow: "hidden", height: 152 }}>
              <div
                style={{
                  fontFamily: DISP,
                  fontSize: hSize,
                  fontWeight: 700,
                  lineHeight: 1.08,
                  letterSpacing: "-0.045em",
                  color: i === 0 ? "#E8F4FF" : a,
                  transform: `translateY(${(1 - on) * 108}%)`,
                  whiteSpace: "nowrap",
                }}
              >
                {line}
              </div>
            </div>
          );
        })}
      </div>

      {/* ------------------------------------------------ the number */}
      <div
        style={{
          position: "absolute",
          left: PAD,
          right: PAD,
          top: 760,
          opacity: win(f, F * 0.17, F * 0.2) * exit,
        }}
      >
        <div style={{ position: "relative", height: 300 }}>
          {/* outline partner, offset — the AE trick that makes type feel printed */}
          <div
            style={{
              position: "absolute",
              left: 8,
              top: 8,
              fontFamily: DISP,
              fontSize: 268,
              fontWeight: 700,
              letterSpacing: "-0.06em",
              lineHeight: 1,
              color: "transparent",
              WebkitTextStroke: `2px ${rgba(a, 0.5)}`,
              transform: `scale(${scale})`,
              transformOrigin: `0 40%`,
            }}
          >
            {hero.value}
          </div>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              fontFamily: DISP,
              fontSize: 268,
              fontWeight: 700,
              letterSpacing: "-0.06em",
              lineHeight: 1,
              color: a,
              fontVariantNumeric: "tabular-nums",
              transform: `scale(${scale})`,
              transformOrigin: `0 40%`,
            }}
          >
            {hero.value}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 10 }}>
          {p.unit ? (
            <div style={{ fontFamily: MONO, fontSize: 40, letterSpacing: "0.16em", color: a, textTransform: "uppercase" }}>
              {p.unit}
            </div>
          ) : null}
          <div style={{ flex: 1, height: 2, background: rgba(a, 0.45) }} />
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 22,
            letterSpacing: "0.09em",
            color: "#8FA3B8",
            marginTop: 20,
            opacity: win(f, F * 0.26, F * 0.32),
          }}
        >
          {p.sub}
        </div>
      </div>

      {/* ------------------------------------------------ marquee */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1330,
          height: 470,
          overflow: "hidden",
          opacity: win(f, F * 0.42, F * 0.52) * exit * 0.9,
          maskImage: "linear-gradient(180deg, transparent, #000 22%, #000 62%, transparent)",
          WebkitMaskImage: "linear-gradient(180deg, transparent, #000 22%, #000 62%, transparent)",
        }}
      >
        {Array.from({ length: rows }).map((_, i) => {
          const off = ((f * 3.2 + i * rowH) % (rows * rowH)) - rowH;
          const solid = i % 3 === 0;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: solid ? 0 : -90,
                top: off,
                width: "130%",
                fontFamily: DISP,
                fontSize: 96,
                fontWeight: 700,
                letterSpacing: "-0.04em",
                whiteSpace: "nowrap",
                color: solid ? rgba(a, 0.85) : "transparent",
                WebkitTextStroke: solid ? "none" : `1px ${rgba("#E8F4FF", 0.22)}`,
                lineHeight: 1.22,
              }}
            >
              {(head[0] || p.headline) + "  " + (head[1] || "") + "  "}
            </div>
          );
        })}
      </div>

      {/* ------------------------------------------------ outro */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 620,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 26,
          opacity: win(f, outro, outro + 18) * (0.55 + 0.45 * hash(1)),
        }}
      >
        <Mark size={126} color={a} />
        <div style={{ fontFamily: DISP, fontSize: 78, fontWeight: 700, letterSpacing: "0.04em", color: "#E8F4FF", lineHeight: 1 }}>
          VITO BYTE
        </div>
        <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: "0.62em", color: "#33475C", textTransform: "uppercase", marginTop: -10 }}>
          studio
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 25,
            letterSpacing: "0.2em",
            color: a,
            border: `1px solid ${rgba(a, 0.5)}`,
            padding: "16px 34px",
            marginTop: 12,
          }}
        >
          {p.cta}
        </div>
      </div>

      <Grain />
    </Stage>
  );
};
