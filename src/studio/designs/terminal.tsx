/**
 * TERMINAL — the language of a trading terminal / ops console.
 *
 * Dense monospace, a live feed that never stops, ASCII meters, a status bar.
 * Everything is on one grid and the only colour is the accent, used sparingly
 * so the eye lands on the number.
 */
import React from "react";
import { Brief } from "../types";
import {
  Stage, Grain, Mark, MONO, PAD, DH, DW, fit, clamp, win, rgba, hash, useTimeline, useHero,
} from "../kit";

const FEED = [
  "acquire  bay-07   cores 16   mem 64g   ok",
  "acquire  bay-08   cores 16   mem 64g   ok",
  "provision  nvme  2.4tb   raid10      ok",
  "isolate  tenant  a7f2  bridge off    ok",
  "warm  runtime  nexus 4.2  cold start  0s",
  "seal  network  ingress deny-by-default",
  "audit  access  0 external  keys 4    ok",
  "ready  fleet   12 bays   192 cores   up",
];

const SPARK = Array.from({ length: 40 }, (_, i) => 0.2 + Math.abs(Math.sin(i * 1.7)) * 0.8);

export const Terminal: React.FC<Brief> = (p) => {
  const t = useTimeline();
  const { f, F, k, outro } = t;
  const a = p.accent;
  const hero = useHero(p.hero, t, 0.34, 0.18);
  const exit = 1 - win(f, outro - 4, outro + 14);

  const rows = 22;
  const rowH = 44;

  return (
    <Stage k={k} bg="#03060A">
      {/* header bar */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 96, borderBottom: `1px solid ${rgba(a, 0.2)}`, background: "rgba(0,255,136,0.03)" }} />
      <div style={{ position: "absolute", left: PAD, top: 34, fontFamily: MONO, fontSize: 22, letterSpacing: "0.3em", color: "#E8F4FF" }}>
        NEXUS<span style={{ color: a }}>://</span>OPS
      </div>
      <div style={{ position: "absolute", right: PAD, top: 34, fontFamily: MONO, fontSize: 20, letterSpacing: "0.16em", color: a }}>
        ● live
      </div>

      {/* the never-ending feed */}
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 150, height: 520, overflow: "hidden", opacity: 0.85 }}>
        {Array.from({ length: rows }).map((_, i) => {
          const idx = Math.floor(f / 8) + i;
          const line = FEED[idx % FEED.length];
          const fresh = ((f / 8 + i) % 1) > 0.72;
          return (
            <div
              key={i}
              style={{
                fontFamily: MONO,
                fontSize: 21,
                lineHeight: `${rowH}px`,
                color: fresh ? a : "rgba(120,150,175,0.62)",
                whiteSpace: "nowrap",
                letterSpacing: "0.02em",
              }}
            >
              <span style={{ color: "rgba(80,105,130,0.7)" }}>{String(idx % 9999).padStart(4, "0")}</span>
              {"  "}
              {line}
            </div>
          );
        })}
      </div>

      {/* the number block */}
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 700, opacity: exit }}>
        <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: "0.3em", color: "rgba(120,150,175,0.8)", textTransform: "uppercase" }}>
          {p.kicker}
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 210,
            fontWeight: 500,
            letterSpacing: "-0.055em",
            lineHeight: 1,
            color: a,
            marginTop: 22,
            fontVariantNumeric: "tabular-nums",
            textShadow: `0 0 44px ${rgba(a, 0.34)}`,
          }}
        >
          {hero.value}
          <span style={{ fontSize: 60, marginLeft: 14, letterSpacing: "0.1em", color: rgba(a, 0.75) }}>{p.unit}</span>
        </div>

        {/* ascii meter */}
        <div style={{ display: "flex", gap: 4, marginTop: 26 }}>
          {SPARK.map((v, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 4 + v * 54 * (0.55 + 0.45 * Math.sin(f * 0.07 + i * 0.6)),
                background: i > 33 ? a : rgba(a, 0.4),
              }}
            />
          ))}
        </div>

        <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: "0.08em", color: "#8FA3B8", marginTop: 34, lineHeight: 1.6 }}>
          {p.sub}
        </div>

        {/* headline as a command */}
        <div
          style={{
            fontFamily: MONO,
            fontSize: fit(p.headline.replace("\n", " "), DW - PAD * 2 - 30, 44, 26),
            lineHeight: 1.34,
            color: "#E8F4FF",
            marginTop: 46,
            borderLeft: `3px solid ${a}`,
            paddingLeft: 24,
            whiteSpace: "pre-line",
            opacity: win(f, F * 0.46, F * 0.56),
          }}
        >
          {p.headline}
        </div>
      </div>

      {/* status bar */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 84, borderTop: `1px solid ${rgba(a, 0.2)}` }} />
      <div style={{ position: "absolute", left: PAD, bottom: 30, fontFamily: MONO, fontSize: 18, letterSpacing: "0.16em", color: "rgba(120,150,175,0.8)" }}>
        {`frame ${String(Math.floor(f)).padStart(4, "0")} / ${String(F).padStart(4, "0")}`}
      </div>
      <div style={{ position: "absolute", right: PAD, bottom: 30, fontFamily: MONO, fontSize: 18, letterSpacing: "0.16em", color: a }}>
        {hero.numeric ? "stable" : "nominal"}
      </div>

      {/* outro */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 640,
          bottom: 0,
          background: "#03060A",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 22,
          opacity: win(f, outro, outro + 14),
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: 19, letterSpacing: "0.4em", color: rgba(a, 0.8), textTransform: "uppercase" }}>
          session closed
        </div>
        <Mark size={104} color={a} stroke={9} />
        <div style={{ fontFamily: MONO, fontSize: 60, fontWeight: 500, letterSpacing: "0.1em", color: "#E8F4FF" }}>
          VITO BYTE
        </div>
        <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.24em", color: a, border: `1px solid ${rgba(a, 0.45)}`, padding: "14px 30px", marginTop: 8 }}>
          {p.cta}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 17, letterSpacing: "0.2em", color: "rgba(80,105,130,0.9)", marginTop: 10 }}>
          {`exit 0 · ${Math.floor(clamp(hash(3) * 40 + 12))} ms`}
        </div>
      </div>

      <Grain opacity={0.028} />
    </Stage>
  );
};
