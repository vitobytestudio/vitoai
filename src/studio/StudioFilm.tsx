/**
 * NEXUS STUDIO — the parametric film every plan renders.
 *
 * One component driven entirely by a brief. The tier does not change the
 * *style*, it changes what the engine is allowed to do: duration cap, output
 * resolution, frame rate, and whether the mark is watermarked.
 *
 * The whole layout is authored in a fixed 1080×1920 design space and scaled by
 * one factor, so a 720p trial export and a 4K prime export are the same film.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

export type Tier = "lite" | "core" | "pro" | "prime";

export type Brief = {
  kicker: string;
  headline: string;
  hero: string;
  unit: string;
  sub: string;
  cta: string;
  accent: string;
  tier: Tier;
};

export const DEFAULT_BRIEF: Brief = {
  kicker: "private servers",
  headline: "Your own metal.\nNot a shared slice.",
  hero: "192",
  unit: "cores",
  sub: "dedicated · 768 GB · 99.99% uptime",
  cta: "vitobyte.studio",
  accent: "#00FF88",
  tier: "lite",
};

export const VOID = "#050B14";
export const DW = 1080; // design width
export const DH = 1920; // design height

const MONO = '"JetBrains Mono", ui-monospace, monospace';
const DISPLAY = '"Space Grotesk", "Sora", system-ui, sans-serif';

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ss = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
const win = (f: number, a: number, b: number) => ss((f - a) / Math.max(1, b - a));

const rgba = (hex: string, a: number) => {
  const h = (hex || "#00FF88").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${clamp(a)})`;
};

/* -------------------------------------------------------------------------- */

const PAD = 92;

const Hud: React.FC<{ accent: string; f: number; kicker: string; lite: boolean }> = ({
  accent,
  f,
  kicker,
  lite,
}) => {
  const a = win(f, 3, 22);
  return (
    <>
      <div style={{ position: "absolute", left: PAD, top: 66, opacity: a }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 19,
            letterSpacing: "0.34em",
            color: "#E8F4FF",
            textTransform: "uppercase",
          }}
        >
          vito byte
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 13,
            letterSpacing: "0.32em",
            color: "#33475C",
            marginTop: 12,
            textTransform: "uppercase",
          }}
        >
          nexus {lite ? "lite" : "studio"}
        </div>
      </div>

      <div style={{ position: "absolute", right: PAD, top: 66, textAlign: "right", opacity: a }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 13,
            letterSpacing: "0.3em",
            color: "#33475C",
            textTransform: "uppercase",
          }}
        >
          frame
        </div>
        <div style={{ fontFamily: MONO, fontSize: 19, letterSpacing: "0.1em", color: accent, marginTop: 12 }}>
          {String(Math.floor(f)).padStart(3, "0")}
        </div>
      </div>

      {/* corner brackets */}
      {[
        [PAD - 46, 158, 1],
        [DW - PAD + 46, 158, -1],
        [PAD - 46, DH - 158, 1],
        [DW - PAD + 46, DH - 158, -1],
      ].map(([x, y, d], i) => (
        <React.Fragment key={i}>
          <div
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 30,
              height: 1,
              background: rgba(accent, 0.3 * a),
            }}
          />
          <div
            style={{
              position: "absolute",
              left: d > 0 ? x : x,
              top: y,
              width: 1,
              height: 30,
              background: rgba(accent, 0.3 * a),
            }}
          />
        </React.Fragment>
      ))}

      <div
        style={{
          position: "absolute",
          left: PAD,
          top: DH - 132,
          opacity: a * 0.85,
          display: "flex",
          gap: 14,
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 7,
            height: 7,
            background: accent,
            opacity: Math.floor(f / 20) % 2 ? 0.2 : 1,
          }}
        />
        <div
          style={{
            fontFamily: MONO,
            fontSize: 14,
            letterSpacing: "0.26em",
            color: "#6E8399",
            textTransform: "uppercase",
          }}
        >
          {kicker}
        </div>
      </div>
    </>
  );
};

const Backdrop: React.FC<{ accent: string; f: number }> = ({ accent, f }) => {
  const drift = f * 0.55;
  return (
    <>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 80% 55% at 50% 40%, ${rgba(accent, 0.055)} 0%, rgba(5,11,20,0) 62%)`,
        }}
      />
      <div style={{ position: "absolute", left: -220, right: -220, top: 1210, height: 760, overflow: "hidden" }}>
        {Array.from({ length: 22 }).map((_, i) => {
          const y = (i * 48 + drift) % 760;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: y,
                height: 1,
                background: rgba(accent, 0.15 * (1 - y / 760)),
              }}
            />
          );
        })}
        {Array.from({ length: 17 }).map((_, i) => (
          <div
            key={`v${i}`}
            style={{
              position: "absolute",
              left: 540 + ((i - 8) / 8) * 980,
              top: 0,
              bottom: 0,
              width: 1,
              background: rgba(accent, 0.055),
            }}
          />
        ))}
      </div>
    </>
  );
};

/* -------------------------------------------------------------------------- */

export const StudioFilm: React.FC<Brief> = (p) => {
  const f = useCurrentFrame();
  const { durationInFrames, fps, width } = useVideoConfig();
  const accent = p.accent || "#00FF88";
  const lite = p.tier === "lite";

  /** one scale factor for the whole design space */
  const k = width / DW;

  const F = durationInFrames;
  const bootEnd = Math.max(18, F * 0.11);
  const heroIn = Math.max(14, F * 0.12);
  const headIn = Math.max(20, F * 0.19);
  const exit = F - Math.max(34, F * 0.24);
  const outro = F - Math.max(26, F * 0.18);

  const lines = [`> nexus --model ${p.tier}`, "· brief parsed · 1 composition", "· audio attached"];
  const typed = Math.floor(clamp((f - 3) / Math.max(1, bootEnd - 6)) * lines.length);

  const target = Number(String(p.hero).replace(/[^\d.]/g, ""));
  const numeric = Number.isFinite(target) && target > 0;
  const shown = numeric ? Math.round(target * win(f, heroIn, heroIn + 34)).toLocaleString("en-US") : String(p.hero);

  const headline = String(p.headline || "").split("\n");

  const mainOut = 1 - win(f, exit, exit + 16);
  const outroIn = win(f, outro, outro + 20);

  return (
    <AbsoluteFill style={{ background: VOID }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: DW,
          height: DH,
          transform: `scale(${k})`,
          transformOrigin: "0 0",
        }}
      >
        <Backdrop accent={accent} f={f} />
        <Hud accent={accent} f={f} kicker={p.kicker} lite={lite} />

        {/* ---------------------------------------------- the brief itself */}
        <div style={{ position: "absolute", left: PAD, right: PAD, top: 300, opacity: mainOut }}>
          {/* boot terminal — collapses up as the hero lands */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              opacity: win(f, 4, 18) * (1 - win(f, heroIn - 8, heroIn + 18)),
              transform: `translateY(${-46 * win(f, heroIn - 8, heroIn + 18)}px)`,
            }}
          >
            {lines.slice(0, typed).map((l, i) => (
              <div
                key={i}
                style={{
                  fontFamily: MONO,
                  fontSize: 23,
                  lineHeight: 1.8,
                  color: i === 0 ? accent : "rgba(110,131,153,0.85)",
                  letterSpacing: "0.02em",
                  whiteSpace: "nowrap",
                }}
              >
                {l}
              </div>
            ))}
          </div>

          {/* hero number */}
          <div
            style={{
              marginTop: 120,
              display: "flex",
              alignItems: "baseline",
              gap: 16,
              opacity: win(f, heroIn, heroIn + 16),
              transform: `translateY(${22 * (1 - win(f, heroIn, heroIn + 24))}px)`,
            }}
          >
            <div
              style={{
                fontFamily: DISPLAY,
                fontSize: 186,
                fontWeight: 700,
                letterSpacing: "-0.05em",
                lineHeight: 0.88,
                color: accent,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {shown}
            </div>
            {p.unit ? (
              <div style={{ fontFamily: MONO, fontSize: 48, color: accent, opacity: 0.78 }}>{p.unit}</div>
            ) : null}
          </div>

          {/* headline */}
          <div style={{ marginTop: 64 }}>
            {headline.map((h, i) => {
              const at = headIn + i * 10;
              const on = win(f, at, at + 20);
              return (
                <div key={i} style={{ overflow: "hidden", paddingBottom: 4 }}>
                  <div
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: 76,
                      fontWeight: 600,
                      lineHeight: 1.1,
                      letterSpacing: "-0.032em",
                      color: i === 0 ? "#E8F4FF" : accent,
                      transform: `translateY(${(1 - on) * 104}%)`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </div>
                </div>
              );
            })}
          </div>

          {/* sub */}
          <div
            style={{
              marginTop: 34,
              fontFamily: MONO,
              fontSize: 24,
              letterSpacing: "0.06em",
              color: "#6E8399",
              opacity: win(f, headIn + 22, headIn + 44),
            }}
          >
            {p.sub}
          </div>

          {/* the meter strip — proof this is a system, not a poster */}
          <div
            style={{
              marginTop: 74,
              display: "flex",
              gap: 4,
              alignItems: "flex-end",
              height: 108,
              opacity: win(f, headIn + 26, headIn + 50) * 0.92,
            }}
          >
            {Array.from({ length: 56 }).map((_, i) => {
              const h = 12 + Math.abs(Math.sin(i * 1.31 + f * 0.055)) * 96;
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: h,
                    background: i % 9 === 0 ? accent : rgba(accent, 0.32),
                    opacity: win(f, headIn + 26 + i * 0.6, headIn + 42 + i * 0.6),
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* ------------------------------------------------------- outro */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 560,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 30,
            opacity: outroIn,
            transform: `translateY(${(1 - outroIn) * 26}px)`,
          }}
        >
          <svg width={118} height={118} viewBox="0 0 110 110" style={{ display: "block" }}>
            <path d="M12 14 L55 92 L98 14" fill="none" stroke={accent} strokeWidth={11} strokeLinejoin="round" />
            <line x1={24} y1={102} x2={86} y2={102} stroke={accent} strokeWidth={9} opacity={0.5} />
          </svg>

          <div
            style={{
              fontFamily: DISPLAY,
              fontSize: 66,
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: "#E8F4FF",
              lineHeight: 1,
            }}
          >
            VITO BYTE
          </div>

          <div
            style={{
              fontFamily: MONO,
              fontSize: 17,
              letterSpacing: "0.6em",
              color: "#33475C",
              textTransform: "uppercase",
              marginTop: -8,
            }}
          >
            studio
          </div>

          <div
            style={{
              border: `1px solid ${rgba(accent, 0.42)}`,
              padding: "17px 34px",
              fontFamily: MONO,
              fontSize: 23,
              letterSpacing: "0.2em",
              color: accent,
              textTransform: "lowercase",
              marginTop: 10,
            }}
          >
            {p.cta}
          </div>
        </div>

        {/* LITE is watermarked into the frame, not an overlay you can strip */}
        {lite ? (
          <div
            style={{
              position: "absolute",
              right: PAD,
              top: DH - 130,
              fontFamily: MONO,
              fontSize: 15,
              letterSpacing: "0.22em",
              color: rgba(accent, 0.5),
              textTransform: "uppercase",
            }}
          >
            nexus lite · trial
          </div>
        ) : null}
      </div>

      {/* grain, one chequer of noise, keeps flat colour from banding */}
      <AbsoluteFill
        style={{
          opacity: 0.03,
          backgroundImage: "repeating-conic-gradient(#fff 0% 25%, #000 0% 50%)",
          backgroundSize: "3px 3px",
          mixBlendMode: "overlay",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------------------- */

export const modelOf = (tier: Tier) =>
  ({ lite: "NEXUS LITE", core: "NEXUS CORE", pro: "NEXUS PRO", prime: "NEXUS PRIME" }[tier]);

export const capFor = (tier: Tier) =>
  ({ lite: 10, core: 30, pro: 60, prime: 120 }[tier]);
