/**
 * SIGNAL — the language of a broken transmission.
 *
 * RGB channel split, sliced displacement, scanlines, interference. Used on
 * purpose and never for long: the glitch happens on the beat, then the frame
 * resolves to a perfectly clean lock-up.
 */
import React from "react";
import { Brief } from "../types";
import {
  Stage, Grain, Mark, MONO, DISP, PAD, DH, DW, fit, win, rgba, hash, useTimeline, useHero, linesOf,
} from "../kit";

/** how violently the frame tears — spiky, not smooth */
const tear = (f: number, seed: number, amount = 1) => {
  const n = hash(Math.floor(f / 2) + seed * 31);
  const spike = n > 0.86 ? (n - 0.86) / 0.14 : 0;
  return spike * amount;
};

export const Signal: React.FC<Brief> = (p) => {
  const t = useTimeline();
  const { f, F, k, outro } = t;
  const a = p.accent;
  const hero = useHero(p.hero, t, 0.2, 0.18);
  const head = linesOf(p.headline);
  const hSize = Math.min(...head.map((l) => fit(l, DW - PAD * 2 - 40, 128, 58)));
  const exit = 1 - win(f, outro - 6, outro + 12);

  const split = 5 + tear(f, 1, 22) + tear(f, 7, 14);
  const yShift = (tear(f, 3, 1) - 0.5) * 16;

  return (
    <Stage k={k} bg="#05060A">
      {/* void with a faint interference field */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `repeating-linear-gradient(0deg, rgba(255,255,255,0.028) 0px, rgba(255,255,255,0.028) 1px, transparent 1px, transparent 4px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: `${(f * 2.4) % 100}%`,
          height: 220,
          background: `linear-gradient(180deg, transparent, ${rgba(a, 0.09)}, transparent)`,
        }}
      />

      {/* corner telemetry */}
      <div style={{ position: "absolute", left: PAD, top: 100, fontFamily: MONO, fontSize: 18, letterSpacing: "0.28em", color: "rgba(200,220,240,0.5)" }}>
        CH-01 · {p.kicker.toUpperCase()}
      </div>
      <div style={{ position: "absolute", right: PAD, top: 100, fontFamily: MONO, fontSize: 18, letterSpacing: "0.2em", color: rgba(a, 0.8) }}>
        {Math.floor(f * 12) % 9999} Hz
      </div>

      {/* headline, split into RGB channels */}
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 330, opacity: exit, transform: `translateY(${yShift}px)` }}>
        {head.map((line, i) => {
          const on = win(f, 10 + i * 10, 26 + i * 10);
          return (
            <div key={i} style={{ position: "relative", height: 150, overflow: "hidden" }}>
              <div
                style={{
                  position: "absolute",
                  left: -split,
                  top: 0,
                  fontFamily: DISP,
                  fontSize: hSize,
                  fontWeight: 700,
                  letterSpacing: "-0.05em",
                  lineHeight: 1.12,
                  color: "#FF2D55",
                  opacity: 0.55,
                  mixBlendMode: "screen",
                  whiteSpace: "nowrap",
                  transform: `translateY(${(1 - on) * 100}%)`,
                }}
              >
                {line}
              </div>
              <div
                style={{
                  position: "absolute",
                  left: split,
                  top: 0,
                  fontFamily: DISP,
                  fontSize: hSize,
                  fontWeight: 700,
                  letterSpacing: "-0.05em",
                  lineHeight: 1.12,
                  color: "#2E7CFF",
                  opacity: 0.55,
                  mixBlendMode: "screen",
                  whiteSpace: "nowrap",
                  transform: `translateY(${(1 - on) * 100}%)`,
                }}
              >
                {line}
              </div>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  fontFamily: DISP,
                  fontSize: hSize,
                  fontWeight: 700,
                  letterSpacing: "-0.05em",
                  lineHeight: 1.12,
                  color: i === 0 ? "#F2F8FF" : a,
                  whiteSpace: "nowrap",
                  transform: `translateY(${(1 - on) * 100}%)`,
                }}
              >
                {line}
              </div>
            </div>
          );
        })}
      </div>

      {/* the number sits inside a frame that itself tears */}
      <div
        style={{
          position: "absolute",
          left: PAD,
          right: PAD,
          top: 800,
          opacity: win(f, F * 0.18, F * 0.24) * exit,
        }}
      >
        <div style={{ border: `1px solid ${rgba(a, 0.3)}`, padding: "30px 34px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 16, letterSpacing: "0.24em", color: "rgba(200,220,240,0.45)" }}>
            <span>capture</span>
            <span>{`${Math.round(hero.p * 100)}%`}</span>
          </div>
          <div
            style={{
              fontFamily: DISP,
              fontSize: 250,
              fontWeight: 700,
              letterSpacing: "-0.065em",
              lineHeight: 0.95,
              color: a,
              marginTop: 12,
              fontVariantNumeric: "tabular-nums",
              textShadow: `${split * 0.6}px 0 #FF2D55, ${-split * 0.6}px 0 #2E7CFF`,
            }}
          >
            {hero.value}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 }}>
            <span style={{ fontFamily: MONO, fontSize: 30, letterSpacing: "0.2em", color: rgba(a, 0.8), textTransform: "uppercase" }}>{p.unit}</span>
            <span style={{ fontFamily: MONO, fontSize: 18, letterSpacing: "0.12em", color: "rgba(200,220,240,0.5)" }}>{p.sub}</span>
          </div>
        </div>
      </div>

      {/* scan bar */}
      <div style={{ position: "absolute", left: 0, right: 0, height: 3, top: `${(f * 7) % DH}px`, background: rgba(a, 0.5) }} />

      {/* outro: the signal resolves — clean, quiet, locked */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 600,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          opacity: win(f, outro, outro + 12),
          background: "rgba(5,6,10,0.92)",
          padding: "60px 0",
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: 17, letterSpacing: "0.42em", color: rgba(a, 0.7), textTransform: "uppercase" }}>
          signal acquired
        </div>
        <Mark size={106} color={a} stroke={10} />
        <div style={{ fontFamily: DISP, fontSize: 70, fontWeight: 700, letterSpacing: "0.06em", color: "#F2F8FF" }}>
          VITO BYTE
        </div>
        <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.22em", color: a, border: `1px solid ${rgba(a, 0.45)}`, padding: "15px 32px" }}>
          {p.cta}
        </div>
      </div>

      <Grain opacity={0.055} />
    </Stage>
  );
};
