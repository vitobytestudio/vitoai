import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { NexusNet } from "./NexusNet";
import { Cap, HexMark, Letters, Num, Panel, Rule, Words } from "./Type";
import { DURATION, H, MOVE, NX, PAD, T, W, r } from "./palette";
import { Globe, ArcCue, CITIES } from "../cloudflare/Globe";
import { clamp, easeOutCubic, smoothstep } from "../lib/math";
import { AudioNX } from "./AudioNX";

/**
 * NEXUS — "THE NETWORK"
 * =============================================================================
 * 60 seconds, nine movements, one continuous lattice. The hex mesh is present
 * from the first frame to the last: it ignites, carries the brand, gets struck,
 * heals itself, and finally becomes the logo. That continuity is the difference
 * between a motion piece and nine slides.
 */

const inWin = (f: number, w: readonly [number, number]) => f >= w[0] && f < w[1];

/* ------------------------------ city routing ------------------------------ */

const NX_ARCS: ArcCue[] = [
  { start: 200, dur: 40, a: "london", b: "singapore" },
  { start: 214, dur: 38, a: "ashburn", b: "frankfurt" },
  { start: 230, dur: 42, a: "dubai", b: "mumbai" },
  { start: 244, dur: 40, a: "sanjose", b: "tokyo" },
  { start: 258, dur: 38, a: "saopaulo", b: "lagos" },
  { start: 272, dur: 42, a: "sydney", b: "singapore" },
  { start: 288, dur: 38, a: "toronto", b: "london" },
  { start: 302, dur: 40, a: "seoul", b: "sanjose" },
  { start: 316, dur: 38, a: "cairo", b: "paris" },
  { start: 330, dur: 40, a: "johannesburg", b: "dubai" },
];

/* --------------------------------- content -------------------------------- */

const SERVICES = [
  { n: "01", t: "CAPITAL", d: "Raise, structure, close" },
  { n: "02", t: "LEGAL", d: "Entities in 40 jurisdictions" },
  { n: "03", t: "TALENT", d: "Vetted operators, on demand" },
  { n: "04", t: "GROWTH", d: "Paid, organic, lifecycle" },
  { n: "05", t: "OPERATIONS", d: "Finance, payroll, tooling" },
  { n: "06", t: "COMPLIANCE", d: "Audit-ready by default" },
];

// NOTE: no arrows here. U+2192 is absent from every bundled face, and an
// uncovered glyph kills the renderer tab with "Target closed". Middle dot only.
const TERMINAL = [
  "agent.spawn       · 24 online",
  "market.scan()     · 190 markets",
  "legal.incorporate · DE SG US",
  "capital.match()   · 3 term sheets",
  "support.escalate  · human joined",
];

/* ------------------------------- the film -------------------------------- */

export const NexusAd: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* ------------------------- the continuous lattice ------------------------ */
  const reveal = r(f, 0, 72);
  const inBots = inWin(f, MOVE.bots);
  const inCyber = inWin(f, MOVE.cyber);
  const inHeal = f >= MOVE.heal[0];

  const damage = inCyber
    ? smoothstep(0, 1, r(f, MOVE.cyber[0], MOVE.cyber[0] + 40)) * 0.8
    : inHeal
      ? interpolate(f, [MOVE.heal[0], MOVE.heal[0] + 150], [0.62, 0.04], { extrapolateRight: "clamp" })
      : 0;

  const healFront = inHeal ? interpolate(f, [MOVE.heal[0] + 14, MOVE.heal[0] + 130], [-0.05, 1.25], { extrapolateRight: "clamp" }) : 1;

  const energy = inBots ? 1 : inHeal ? 0.6 : inWin(f, MOVE.ignite) ? r(f, 30, 90) : 0.28;
  const core = inWin(f, MOVE.ignite) ? r(f, 10, 60) * (1 - r(f, 90, 118)) : inBots ? 0.35 + 0.25 * Math.sin(f * 0.06) : 0;

  const netScale = interpolate(f, [0, DURATION], [1.0, 1.14]);
  const netOpacity =
    inWin(f, MOVE.globe)
      ? 0.4
      : inWin(f, MOVE.services)
        ? 0.42
        : inWin(f, MOVE.cta)
          ? 0.6
          : inWin(f, MOVE.cyber)
            ? 1
            : 0.8;

  /* ------------------------------ transitions ----------------------------- */
  const flashAt = (at: number, p: number, d = 7, c = "255,255,255") => (f >= at ? p * Math.exp(-(f - at) / d) : 0);
  const flash =
    flashAt(MOVE.globe[0], 0.5, 9) +
    flashAt(MOVE.services[0], 0.42, 8) +
    flashAt(MOVE.bots[0], 0.5, 9) +
    flashAt(MOVE.support[0], 0.34, 8) +
    flashAt(MOVE.cyber[0], 0.6, 7, "255,59,92") +
    flashAt(MOVE.heal[0] + 10, 0.55, 9, "92,255,184") +
    flashAt(MOVE.proof[0], 0.3, 8) +
    flashAt(MOVE.cta[0], 0.6, 10, "92,255,184");

  /* -------------------------------- layout -------------------------------- */
  const box: React.CSSProperties = { position: "absolute", left: PAD, right: PAD };

  const kicker = (label: string, idx: string, show: boolean, at: number) =>
    show ? (
      <div style={{ ...box, top: 128, display: "flex", alignItems: "center", gap: 16, opacity: clamp(r(f, at, at + 18)) }}>
        <div style={{ width: 7, height: 7, background: NX.green, boxShadow: `0 0 16px ${NX.green}` }} />
        <Cap size={17} color={NX.muted}>
          {label}
        </Cap>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.10)" }} />
        <Cap size={17} color={NX.dim}>
          {idx}
        </Cap>
      </div>
    ) : null;

  return (
    <AbsoluteFill style={{ background: NX.ink, overflow: "hidden" }}>
      {/* deep field: keeps black from going flat, gives the green somewhere to live */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 72% 48% at 50% 46%, rgba(0,224,138,0.10) 0%, rgba(43,184,255,0.055) 38%, rgba(0,0,0,0) 72%)`,
        }}
      />

      {/* ---------------------- 00 · THE LATTICE (always) --------------------- */}
      <NexusNet
        frame={f}
        reveal={reveal}
        energy={energy}
        damage={damage}
        healFront={healFront}
        core={core}
        scale={netScale}
        opacity={netOpacity}
        sweep={inWin(f, MOVE.services) ? r(f, MOVE.services[0], MOVE.services[1]) : 0}
      />

      {/* ---------------------------- 01 · IGNITE ---------------------------- */}
      {inWin(f, MOVE.ignite) ? (
        <>
          {kicker("THE NETWORK", "01", f > 18, 18)}
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 60 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
              <Letters text="NEXUS" start={24} frame={f} size={186} tracking="0.16em" glow="rgba(92,255,184,0.35)" weight={600} />
              <div style={{ opacity: clamp(r(f, 62, 92)), transform: `translateY(${(1 - clamp(r(f, 62, 92))) * 12}px)` }}>
                <Cap size={21} color={NX.greenHot}>
                  GLOBAL PLATFORM FOR ENTREPRENEURS
                </Cap>
              </div>
              <Rule progress={r(f, 74, 108)} width={520} opacity={0.85} />
            </div>
          </AbsoluteFill>
          {/* ignition halo */}
          <AbsoluteFill
            style={{
              background: `radial-gradient(circle at 50% 47%, rgba(92,255,184,0.30) 0%, rgba(0,0,0,0) 46%)`,
              opacity: clamp(r(f, 6, 34)) * (1 - clamp(r(f, 54, 104))) * 0.9,
            }}
          />
        </>
      ) : null}

      {/* ----------------------------- 02 · GLOBE ---------------------------- */}
      {inWin(f, MOVE.globe) ? (
        <>
          {kicker("REACH", "02", true, MOVE.globe[0] + 4)}
          <Globe
            frame={f}
            assemble={easeOutCubic(r(f, MOVE.globe[0], MOVE.globe[0] + 96))}
            spin={f * 0.0042}
            tilt={-0.28}
            zoom={interpolate(f, [MOVE.globe[0], MOVE.globe[1]], [1.0, 1.1], { extrapolateRight: "clamp" })}
            cy={780}
            opacity={clamp(r(f, MOVE.globe[0], MOVE.globe[0] + 14)) * (1 - clamp(r(f, MOVE.globe[1] - 22, MOVE.globe[1])))}
            arcs={NX_ARCS}
            lights={r(f, 150, 230)}
            sweep={r(f, 130, 250)}
            accent={NX.green}
            accentHot={NX.greenHot}
            accentDeep={NX.greenDeep}
            gridColor="#1E6B52"
            haloRGB="0,224,138"
            bodyRGB="10,58,40"
            shadeRGB="3,16,12"
          />
          <div style={{ ...box, bottom: 300, display: "flex", flexDirection: "column", gap: 6 }}>
            <Words text="One platform." start={150} frame={f} size={86} color={NX.white} stagger={4} />
            <Words text="Every market." start={192} frame={f} size={86} color={NX.green} stagger={4} glow="rgba(0,224,138,0.35)" />
            <div style={{ height: 22 }} />
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, opacity: clamp(r(f, 236, 268)) }}>
              <Num to={190} start={236} frame={f} size={92} suffix="+" />
              <Cap size={20} color={NX.muted}>
                COUNTRIES · ONE NETWORK
              </Cap>
            </div>
          </div>
        </>
      ) : null}

      {/* --------------------------- 03 · SERVICES --------------------------- */}
      {inWin(f, MOVE.services) ? (
        <>
          {kicker("SERVICES", "03", true, MOVE.services[0] + 4)}
          <div style={{ ...box, top: 214 }}>
            <Words text="Everything you need." start={MOVE.services[0] + 10} frame={f} size={74} color={NX.white} stagger={3} />
            <div style={{ height: 16 }} />
            <Cap size={18} color={NX.dim} style={{ opacity: clamp(r(f, MOVE.services[0] + 34, MOVE.services[0] + 54)) }}>
              SIX SERVICES · ONE SUBSCRIPTION
            </Cap>
          </div>
          <div
            style={{
              ...box,
              top: 452,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 18,
            }}
          >
            {SERVICES.map((s, i) => {
              const at = MOVE.services[0] + 56 + i * 11;
              const sp = spring({ frame: f - at, fps, config: { damping: 15, stiffness: 200, mass: 0.8 }, durationInFrames: 34 });
              const lit = clamp(r(f, at + 26, at + 52));
              return (
                <div key={s.n} style={{ opacity: clamp(sp * 1.5), transform: `translateY(${(1 - sp) * 34}px)` }}>
                  <Panel h={262} accent={i % 3 === 1 ? NX.blue : NX.green} lit={lit}>
                    <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                      <Cap size={15} color={NX.dim}>
                        {s.n}
                      </Cap>
                      <div>
                        <div
                          style={{
                            fontFamily: T.display,
                            fontSize: 43,
                            fontWeight: 600,
                            letterSpacing: "-0.02em",
                            color: NX.white,
                            lineHeight: 1,
                          }}
                        >
                          {s.t}
                        </div>
                        <div style={{ height: 10 }} />
                        <div style={{ fontFamily: T.body, fontSize: 19, color: NX.muted, lineHeight: 1.25 }}>{s.d}</div>
                      </div>
                    </div>
                  </Panel>
                </div>
              );
            })}
          </div>
          <div
            style={{
              ...box,
              bottom: 250,
              display: "flex",
              alignItems: "baseline",
              gap: 20,
              opacity: clamp(r(f, MOVE.services[0] + 128, MOVE.services[0] + 158)),
            }}
          >
            <Cap size={23} color={NX.white}>
              ONE SUBSCRIPTION
            </Cap>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
            <Cap size={23} color={NX.green}>
              EVERY FUNCTION
            </Cap>
          </div>
        </>
      ) : null}

      {/* ------------------------------ 04 · BOTS ---------------------------- */}
      {inWin(f, MOVE.bots) ? (
        <>
          {kicker("AI WORKFORCE", "04", true, MOVE.bots[0] + 4)}
          <div style={{ ...box, top: 224 }}>
            <Words text="Your AI" start={MOVE.bots[0] + 10} frame={f} size={96} color={NX.white} stagger={3} />
            <Words text="workforce." start={MOVE.bots[0] + 34} frame={f} size={96} color={NX.green} stagger={3} glow="rgba(0,224,138,0.3)" />
            <div style={{ height: 26 }} />
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, opacity: clamp(r(f, MOVE.bots[0] + 60, MOVE.bots[0] + 90)) }}>
              <Num to={1200} start={MOVE.bots[0] + 60} frame={f} size={78} suffix="+" />
              <Cap size={19} color={NX.muted}>
                AGENTS ON DUTY
              </Cap>
            </div>
          </div>

          {/* live feed — the panel that makes it feel like working software */}
          <div style={{ ...box, top: 880, opacity: clamp(r(f, MOVE.bots[0] + 54, MOVE.bots[0] + 74)) }}>
            <Panel pad={34} accent={NX.green} h={492}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
                <div style={{ width: 8, height: 8, borderRadius: 8, background: NX.green, boxShadow: `0 0 14px ${NX.green}` }} />
                <Cap size={15} color={NX.muted}>
                  NEXUS · LIVE
                </Cap>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                {TERMINAL.map((line, i) => {
                  const at = MOVE.bots[0] + 66 + i * 15;
                  const on = clamp(r(f, at, at + 8));
                  return (
                    <div
                      key={line}
                      style={{
                        fontFamily: T.mono,
                        fontSize: 21,
                        color: i === 3 ? NX.greenHot : "rgba(242,251,255,0.62)",
                        letterSpacing: "0.01em",
                        opacity: on,
                        transform: `translateX(${(1 - on) * 10}px)`,
                        whiteSpace: "pre",
                      }}
                    >
                      {line}
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>
        </>
      ) : null}

      {/* ----------------------------- 05 · SUPPORT -------------------------- */}
      {inWin(f, MOVE.support) ? (
        <>
          {kicker("SUPPORT", "05", true, MOVE.support[0] + 4)}
          <div style={{ ...box, top: 224 }}>
            <Words text="A full army" start={MOVE.support[0] + 8} frame={f} size={88} color={NX.white} stagger={3} />
            <Words text="behind you." start={MOVE.support[0] + 34} frame={f} size={88} color={NX.blueHot} stagger={3} glow="rgba(43,184,255,0.3)" />
          </div>

          {/* the wall: operators clocking in */}
          <div style={{ ...box, top: 560, display: "flex", flexWrap: "wrap", gap: 12 }}>
            {Array.from({ length: 32 }).map((_, i) => {
              const at = MOVE.support[0] + 50 + i * 1.6;
              const on = clamp(r(f, at, at + 10));
              const hue = i % 5 === 0 ? NX.blue : NX.green;
              return (
                <div
                  key={i}
                  style={{
                    width: 92,
                    height: 92,
                    borderRadius: 4,
                    border: `1px solid rgba(255,255,255,${0.04 + on * 0.16})`,
                    background: `rgba(255,255,255,${on * 0.05})`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: 0.25 + on * 0.75,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        background: hue,
                        boxShadow: `0 0 ${on * 14}px ${hue}`,
                      }}
                    />
                    <div
                      style={{
                        fontFamily: T.mono,
                        fontSize: 9,
                        letterSpacing: "0.1em",
                        color: NX.dim,
                        opacity: on,
                      }}
                    >
                      {["OPS", "SEC", "AI", "DEV", "FIN", "LEG"][i % 6]}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ ...box, bottom: 280, display: "flex", alignItems: "baseline", gap: 18, opacity: clamp(r(f, MOVE.support[0] + 118, MOVE.support[0] + 148)) }}>
            <Cap size={24} color={NX.white}>
              24 / 7 · HUMAN + AI
            </Cap>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
          </div>
        </>
      ) : null}

      {/* ------------------------------ 06 · CYBER --------------------------- */}
      {inWin(f, MOVE.cyber) ? (
        <>
          {kicker("SECURITY", "06", true, MOVE.cyber[0] + 4)}
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 40 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <Words text="Attacks never sleep." start={MOVE.cyber[0] + 10} frame={f} size={70} color={NX.white} stagger={2} exitAt={MOVE.cyber[1] - 30} />
              <Words
                text="Neither do we."
                start={MOVE.cyber[0] + 52}
                frame={f}
                size={104}
                color={NX.red}
                stagger={3}
                glow="rgba(255,59,92,0.42)"
                weight={700}
              />
            </div>
          </AbsoluteFill>
          {/* live threat counter — makes the beat feel like a running system */}
          <div
            style={{
              ...box,
              bottom: 300,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              opacity: clamp(r(f, MOVE.cyber[0] + 40, MOVE.cyber[0] + 70)),
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 10, height: 10, background: NX.red, boxShadow: `0 0 20px ${NX.red}` }} />
              <Cap size={18} color={NX.red}>
                BLOCKED THIS YEAR
              </Cap>
            </div>
            <Num to={4820000} start={MOVE.cyber[0] + 44} frame={f} size={84} dur={90} color={NX.white} />
            <div style={{ width: 200, height: 1, background: "rgba(255,59,92,0.45)" }} />
          </div>

          {/* threat scanline */}
          <AbsoluteFill
            style={{
              background: "linear-gradient(180deg, rgba(255,59,92,0) 0%, rgba(255,59,92,0.10) 50%, rgba(255,59,92,0) 100%)",
              height: 260,
              top: `${((f - MOVE.cyber[0]) * 5.2) % (H + 260)}px`,
              bottom: "auto",
              opacity: 0.8,
            }}
          />
        </>
      ) : null}

      {/* ------------------------------- 07 · HEAL --------------------------- */}
      {inWin(f, MOVE.heal) ? (
        <>
          {kicker("RESILIENCE", "07", true, MOVE.heal[0] + 4)}
          {/* the expanding repair front */}
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
            {[0, 26, 52].map((d) => {
              const p = r(f, MOVE.heal[0] + 14 + d, MOVE.heal[0] + 140 + d);
              if (p <= 0 || p >= 1) return null;
              return (
                <div
                  key={d}
                  style={{
                    position: "absolute",
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    border: `1.5px solid ${NX.greenHot}`,
                    transform: `scale(${1 + p * 13})`,
                    opacity: (1 - p) * 0.42,
                  }}
                />
              );
            })}
          </AbsoluteFill>
          <div style={{ ...box, bottom: 330 }}>
            <Words text="Self-healing" start={MOVE.heal[0] + 20} frame={f} size={92} color={NX.white} stagger={3} />
            <Words text="by design." start={MOVE.heal[0] + 52} frame={f} size={92} color={NX.greenHot} stagger={3} glow="rgba(92,255,184,0.45)" />
            <div style={{ height: 26 }} />
            <div
              style={{
                fontFamily: T.body,
                fontSize: 26,
                color: NX.muted,
                opacity: clamp(r(f, MOVE.heal[0] + 96, MOVE.heal[0] + 126)),
              }}
            >
              Detects. Isolates. Recovers — in seconds, not days.
            </div>
          </div>
        </>
      ) : null}

      {/* ------------------------------ 08 · PROOF --------------------------- */}
      {inWin(f, MOVE.proof) ? (
        <>
          {kicker("BY THE NUMBERS", "08", true, MOVE.proof[0] + 4)}
          <div style={{ ...box, top: 236 }}>
            <Words text="Built to scale." start={MOVE.proof[0] + 8} frame={f} size={76} color={NX.white} stagger={3} />
          </div>
          <div style={{ ...box, top: 420, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {[
              { v: 190, s: "+", l: "COUNTRIES", d: 0 },
              { v: 1200, s: "+", l: "AI AGENTS", d: 0 },
              { v: 99.99, s: "%", l: "UPTIME", d: 2 },
              { v: 40, s: "ms", l: "EDGE LATENCY", d: 0 },
            ].map((m, i) => {
              const at = MOVE.proof[0] + 26 + i * 12;
              const sp = spring({ frame: f - at, fps, config: { damping: 16, stiffness: 190, mass: 0.85 }, durationInFrames: 32 });
              return (
                <div
                  key={m.l}
                  style={{
                    padding: "30px 28px",
                    border: "1px solid rgba(255,255,255,0.09)",
                    background: "linear-gradient(160deg, rgba(255,255,255,0.045), rgba(255,255,255,0.01))",
                    opacity: clamp(sp * 1.4),
                    transform: `translateY(${(1 - sp) * 26}px)`,
                  }}
                >
                  <Num to={m.v} start={at} frame={f} size={78} suffix={m.s} decimals={m.d} dur={44} />
                  <div style={{ height: 12 }} />
                  <Cap size={15} color={NX.muted}>
                    {m.l}
                  </Cap>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {/* -------------------------------- 09 · CTA --------------------------- */}
      {inWin(f, MOVE.cta) ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
            <div style={{ transform: `scale(${0.9 + 0.1 * clamp(r(f, MOVE.cta[0] + 6, MOVE.cta[0] + 60))})` }}>
              <HexMark size={190} progress={r(f, MOVE.cta[0] + 4, MOVE.cta[0] + 54)} frame={f} />
            </div>
            <Letters text="NEXUS" start={MOVE.cta[0] + 26} frame={f} size={120} tracking="0.2em" glow="rgba(92,255,184,0.3)" />
            <div style={{ opacity: clamp(r(f, MOVE.cta[0] + 62, MOVE.cta[0] + 92)) }}>
              <Words text="Join the network." start={MOVE.cta[0] + 60} frame={f} size={46} color={NX.muted} align="center" stagger={3} />
            </div>
            <div
              style={{
                marginTop: 14,
                padding: "22px 46px",
                border: `1px solid ${NX.edgeHot}`,
                background: "linear-gradient(160deg, rgba(0,224,138,0.16), rgba(43,184,255,0.06))",
                opacity: clamp(r(f, MOVE.cta[0] + 96, MOVE.cta[0] + 122)),
                transform: `translateY(${(1 - clamp(r(f, MOVE.cta[0] + 96, MOVE.cta[0] + 122))) * 14}px)`,
              }}
            >
              <Cap size={21} color={NX.greenHot}>
                NEXUS.GLOBAL
              </Cap>
            </div>
          </div>
        </AbsoluteFill>
      ) : null}

      {/* --------------------------- global finish -------------------------- */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 48%, rgba(var(--fc),0.9) 0%, rgba(var(--fc),0) 62%)`,
          ["--fc" as string]: "255,255,255",
          opacity: Math.min(0.55, flash),
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 52% at 50% 46%, rgba(0,0,0,0) 34%, rgba(0,0,0,0.58) 74%, rgba(0,0,0,0.9) 100%)`,
        }}
      />
      <AbsoluteFill style={{ background: "#000", opacity: clamp(r(f, DURATION - 40, DURATION)) }} />

      <AudioNX frame={f} />
    </AbsoluteFill>
  );
};

export const NEXUS_W = W;
export const NEXUS_H = H;
export const NEXUS_MOVE = MOVE;
export type { CITIES };
export const NEXUS_CITIES = CITIES;
export const NEXUS_FADE = easeOutCubic;
