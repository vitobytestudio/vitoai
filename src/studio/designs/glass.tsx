/**
 * GLASS — the language of a premium hardware film.
 *
 * Soft light, layered translucent surfaces at different depths, a very slow
 * camera drift so nothing ever sits still, and one hard number on the top
 * card. Restraint everywhere except the number.
 */
import React from "react";
import { Brief } from "../types";
import {
  Stage, Grain, Mark, MONO, DISP, PAD, DW, fit, win, rgba, useTimeline, useHero,
} from "../kit";

const Chip: React.FC<{ label: string; value: string; accent: string; on: number }> = ({
  label,
  value,
  accent,
  on,
}) => (
  <div
    style={{
      flex: 1,
      border: "1px solid rgba(255,255,255,0.1)",
      background: "rgba(255,255,255,0.045)",
      backdropFilter: "blur(18px)",
      padding: "18px 16px",
      opacity: on,
      transform: `translateY(${(1 - on) * 16}px)`,
    }}
  >
    <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.24em", color: "rgba(232,244,255,0.5)", textTransform: "uppercase" }}>
      {label}
    </div>
    <div style={{ fontFamily: DISP, fontSize: 34, fontWeight: 600, color: accent, marginTop: 8, letterSpacing: "-0.02em" }}>
      {value}
    </div>
  </div>
);

export const Glass: React.FC<Brief> = (p) => {
  const t = useTimeline();
  const { f, F, k, outro } = t;
  const a = p.accent;
  const hero = useHero(p.hero, t, 0.22, 0.2);

  /* the whole frame drifts, slowly — the only thing moving most of the time */
  const drift = Math.sin(f * 0.012) * 16;
  const push = 1 + 0.022 * (f / Math.max(1, F));

  const stats = p.sub.split(/[·|]/).map((s) => s.trim()).filter(Boolean).slice(0, 3);

  return (
    <Stage k={k} bg="#070B12">
      {/* light that the glass will catch */}
      <div
        style={{
          position: "absolute",
          left: -300,
          top: -260,
          width: 1600,
          height: 1600,
          background: `radial-gradient(circle, ${rgba(a, 0.2)} 0%, rgba(7,11,18,0) 62%)`,
          filter: "blur(10px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -500,
          top: 900,
          width: 1500,
          height: 1500,
          background: "radial-gradient(circle, rgba(46,124,255,0.16) 0%, rgba(7,11,18,0) 60%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${push}) translateY(${drift}px)`,
          transformOrigin: "50% 46%",
        }}
      >
        {/* eyebrow */}
        <div
          style={{
            position: "absolute",
            left: PAD,
            right: PAD,
            top: 190,
            display: "flex",
            alignItems: "center",
            gap: 14,
            opacity: win(f, 4, 22),
          }}
        >
          <div style={{ width: 26, height: 1, background: rgba(a, 0.7) }} />
          <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: "0.34em", color: "rgba(232,244,255,0.62)", textTransform: "uppercase" }}>
            {p.kicker}
          </div>
        </div>

        {/* the hero card */}
        <div
          style={{
            position: "absolute",
            left: PAD,
            right: PAD,
            top: 320,
            padding: "52px 46px 46px",
            borderRadius: 34,
            border: "1px solid rgba(255,255,255,0.14)",
            background: `linear-gradient(155deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02) 46%, ${rgba(a, 0.05)})`,
            backdropFilter: "blur(26px)",
            boxShadow: `0 40px 120px -40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.14)`,
            opacity: win(f, F * 0.16, F * 0.24),
            transform: `translateY(${(1 - win(f, F * 0.16, F * 0.26)) * 40}px)`,
          }}
        >
          <div style={{ fontFamily: MONO, fontSize: 17, letterSpacing: "0.3em", color: "rgba(232,244,255,0.45)", textTransform: "uppercase" }}>
            {p.unit || "value"}
          </div>
          <div
            style={{
              fontFamily: DISP,
              fontSize: 230,
              fontWeight: 700,
              letterSpacing: "-0.06em",
              lineHeight: 0.92,
              color: "#FFFFFF",
              marginTop: 14,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {hero.value}
          </div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.14)", margin: "30px 0 26px" }} />
          <div style={{ display: "flex", gap: 12 }}>
            {stats.map((s, i) => (
              <Chip
                key={i}
                label={["fleet", "memory", "uptime", "notes"][i] || "spec"}
                value={s}
                accent={i === 0 ? a : "#E8F4FF"}
                on={win(f, F * 0.3 + i * 8, F * 0.34 + i * 8)}
              />
            ))}
          </div>
        </div>

        {/* the statement, floating above the card */}
        <div
          style={{
            position: "absolute",
            left: PAD,
            right: PAD,
            top: 1130,
            opacity: win(f, F * 0.42, F * 0.5),
            transform: `translateY(${(1 - win(f, F * 0.42, F * 0.52)) * 26}px)`,
          }}
        >
          <div
            style={{
              fontFamily: DISP,
              fontSize: fit(p.headline.replace("\n", " "), DW - PAD * 2, 88, 46),
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: "-0.038em",
              color: "#FFFFFF",
              whiteSpace: "pre-line",
            }}
          >
            {p.headline}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 21, letterSpacing: "0.1em", color: "rgba(232,244,255,0.45)", marginTop: 28 }}>
            {p.sub}
          </div>
        </div>
      </div>

      {/* outro */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 560,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
          opacity: win(f, outro, outro + 18),
          transform: `translateY(${(1 - win(f, outro, outro + 22)) * 30}px)`,
        }}
      >
        <AssetWordmark accent={a} />
        <div style={{ fontFamily: DISP, fontSize: 76, fontWeight: 700, letterSpacing: "0.055em", color: "#FFFFFF" }}>
          VITO BYTE
        </div>
        <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: "0.6em", color: "rgba(232,244,255,0.34)", textTransform: "uppercase", marginTop: -12 }}>
          studio
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 24,
            letterSpacing: "0.2em",
            color: "#04120A",
            background: a,
            padding: "17px 36px",
            borderRadius: 100,
            marginTop: 16,
          }}
        >
          {p.cta}
        </div>
      </div>

      <Grain opacity={0.026} />
    </Stage>
  );
};

const AssetWordmark: React.FC<{ accent: string }> = ({ accent }) => (
  <div
    style={{
      width: 128,
      height: 128,
      borderRadius: 34,
      border: "1px solid rgba(255,255,255,0.16)",
      background: "linear-gradient(155deg, rgba(255,255,255,0.14), rgba(255,255,255,0.02))",
      backdropFilter: "blur(20px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 30px 80px -30px rgba(0,0,0,0.9)",
    }}
  >
    <Mark size={72} color={accent} stroke={11} rule={false} />
  </div>
);
