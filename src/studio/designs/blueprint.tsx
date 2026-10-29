/**
 * BLUEPRINT — the language of a technical drawing.
 *
 * Fine grid, dimension lines with arrowheads, crosshair registration marks,
 * leader lines from annotations, a dial that measures the number. Monochrome
 * except the accent, which only appears on measured values.
 */
import React from "react";
import { Brief } from "../types";
import {
  Stage, Grain, Mark, MONO, DISP, PAD, DW, DH, fit, win, rgba, useTimeline, useHero,
} from "../kit";

const Dim: React.FC<{ x1: number; y1: number; x2: number; y2: number; color: string; label?: string; on: number }> = ({
  x1,
  y1,
  x2,
  y2,
  color,
  label,
  on,
}) => {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return (
    <div style={{ position: "absolute", left: x1, top: y1, opacity: on, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: len * on,
          height: 1,
          background: color,
          transform: `rotate(${ang}deg)`,
          transformOrigin: "0 0",
        }}
      />
      <div style={{ position: "absolute", left: -4, top: -4, width: 9, height: 9, border: `1px solid ${color}` }} />
      <div style={{ position: "absolute", left: x2 - x1 - 4, top: y2 - y1 - 4, width: 9, height: 9, border: `1px solid ${color}` }} />
      {label ? (
        <div
          style={{
            position: "absolute",
            left: (x2 - x1) / 2 - 40,
            top: (y2 - y1) / 2 - 26,
            width: 80,
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 17,
            letterSpacing: "0.14em",
            color,
            background: "#061020",
            padding: "2px 0",
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};

export const Blueprint: React.FC<Brief> = (p) => {
  const t = useTimeline();
  const { f, F, k, outro } = t;
  const a = p.accent;
  const hero = useHero(p.hero, t, 0.24, 0.2);
  const draw = win(f, F * 0.1, F * 0.28);
  const exit = 1 - win(f, outro - 6, outro + 14);

  const ink = "rgba(140,190,235,0.5)";
  const dial = 0.5 + 0.5 * Math.sin(f * 0.02);

  return (
    <Stage k={k} bg="#04101E">
      {/* the sheet */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(rgba(120,180,230,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(120,180,230,0.07) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(rgba(120,180,230,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(120,180,230,0.12) 1px, transparent 1px)`,
          backgroundSize: "300px 300px",
        }}
      />

      {/* sheet border + title block */}
      <div style={{ position: "absolute", left: 46, top: 46, right: 46, bottom: 46, border: `1px solid ${rgba(a, 0.22)}` }} />
      <div style={{ position: "absolute", left: 46, right: 46, bottom: 46, height: 92, borderTop: `1px solid ${rgba(a, 0.22)}`, display: "flex", alignItems: "center", padding: "0 26px", justifyContent: "space-between" }}>
        <div style={{ fontFamily: MONO, fontSize: 17, letterSpacing: "0.24em", color: ink, textTransform: "uppercase" }}>
          vito byte studio · {p.kicker}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 17, letterSpacing: "0.24em", color: rgba(a, 0.85) }}>
          {`sheet 01 / scale 1:1`}
        </div>
      </div>

      {/* registration crosses */}
      {[
        [120, 160],
        [DW - 120, 160],
        [120, DH - 250],
        [DW - 120, DH - 250],
      ].map(([x, y], i) => (
        <React.Fragment key={i}>
          <div style={{ position: "absolute", left: x - 16, top: y, width: 32, height: 1, background: rgba(a, 0.4) }} />
          <div style={{ position: "absolute", left: x, top: y - 16, width: 1, height: 32, background: rgba(a, 0.4) }} />
        </React.Fragment>
      ))}

      {/* main measured object */}
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 260, opacity: exit }}>
        {/* the number, annotated */}
        <div style={{ position: "relative", marginTop: 40 }}>
          <div
            style={{
              fontFamily: DISP,
              fontSize: 230,
              fontWeight: 700,
              letterSpacing: "-0.07em",
              lineHeight: 0.9,
              color: "transparent",
              WebkitTextStroke: `2px ${rgba(a, 0.9)}`,
              fontVariantNumeric: "tabular-nums",
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
              fontSize: 230,
              fontWeight: 700,
              letterSpacing: "-0.07em",
              lineHeight: 0.9,
              color: rgba(a, 0.1),
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {hero.value}
          </div>
          {/* leader line to the label */}
          <div style={{ position: "absolute", right: 10, top: 96, display: "flex", alignItems: "center", gap: 12, opacity: draw }}>
            <div style={{ width: 120, height: 1, background: rgba(a, 0.7) }} />
            <div style={{ fontFamily: MONO, fontSize: 19, letterSpacing: "0.18em", color: a, textTransform: "uppercase" }}>
              {p.unit || "value"}
            </div>
          </div>
        </div>

        <Dim x1={0} y1={-24} x2={430} y2={-24} color={rgba(a, 0.6)} label="a" on={draw} />
        <Dim x1={-40} y1={0} x2={-40} y2={220} color={rgba(a, 0.6)} label="b" on={draw} />

        {/* headline under the object */}
        <div
          style={{
            marginTop: 64,
            fontFamily: DISP,
            fontSize: Math.min(...p.headline.split("\n").map((l) => fit(l, DW - PAD * 2 - 60, 62, 38))),
            fontWeight: 600,
            lineHeight: 1.16,
            letterSpacing: "-0.028em",
            color: "#DCEBFA",
            whiteSpace: "pre-line",
            opacity: win(f, F * 0.44, F * 0.54),
          }}
        >
          {p.headline}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: "0.12em", color: ink, marginTop: 22, opacity: win(f, F * 0.52, F * 0.6) }}>
          {p.sub}
        </div>
      </div>

      {/* the dial */}
      <div style={{ position: "absolute", right: 84, top: 210, opacity: exit * 0.85 }}>
        <svg width={150} height={150} viewBox="0 0 160 160">
          <circle cx={80} cy={80} r={68} fill="none" stroke={rgba(a, 0.24)} strokeWidth={1} />
          <circle cx={80} cy={80} r={48} fill="none" stroke={rgba(a, 0.16)} strokeWidth={1} />
          {Array.from({ length: 36 }).map((_, i) => {
            const ang = (i / 36) * Math.PI * 2;
            const big = i % 9 === 0;
            const r1 = big ? 58 : 63;
            return (
              <line
                key={i}
                x1={80 + Math.cos(ang) * r1}
                y1={80 + Math.sin(ang) * r1}
                x2={80 + Math.cos(ang) * 68}
                y2={80 + Math.sin(ang) * 68}
                stroke={rgba(a, big ? 0.7 : 0.3)}
                strokeWidth={big ? 2 : 1}
              />
            );
          })}
          <line
            x1={80}
            y1={80}
            x2={80 + Math.cos(dial * Math.PI * 2 - Math.PI / 2) * 54}
            y2={80 + Math.sin(dial * Math.PI * 2 - Math.PI / 2) * 54}
            stroke={a}
            strokeWidth={2}
          />
          <circle cx={80} cy={80} r={3} fill={a} />
        </svg>
      </div>

      {/* outro: a plate that slides over the drawing, like a revision stamp */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 620,
          bottom: 138,
          opacity: win(f, outro, outro + 16),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 22,
          background: "linear-gradient(180deg, rgba(4,16,30,0), rgba(4,16,30,0.96) 22%)",
        }}
      >
        <div style={{ border: `1px solid ${rgba(a, 0.4)}`, padding: 34, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <Mark size={96} color={a} stroke={8} />
          <div style={{ fontFamily: DISP, fontSize: 62, fontWeight: 700, letterSpacing: "0.1em", color: "#DCEBFA" }}>
            VITO BYTE
          </div>
          <div style={{ width: 220, height: 1, background: rgba(a, 0.5) }} />
          <div style={{ fontFamily: MONO, fontSize: 19, letterSpacing: "0.2em", color: a }}>
            {p.cta}
          </div>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.3em", color: rgba(a, 0.55), textTransform: "uppercase" }}>
          rev 01 · approved
        </div>
      </div>

      <Grain opacity={0.03} />
    </Stage>
  );
};
