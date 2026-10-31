import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { NX, T } from "../nexus/palette";
import { Breach, MarkCloud, PanelWall, Swarm, Warp } from "./Layers";
import { Post } from "./Post";
import { At3D, BigNum, Card3D, Extrude, Hud, Line, Mono, world } from "./Ui3D";
import { ramp, window01 } from "./engine";
import { AudioReel } from "./AudioReel";

/**
 * NEXUS — "SIGNAL"
 * =============================================================================
 * 36s. Nine beats. Every one is a camera move, not a slide.
 *
 * The whole film runs on three primitives that agree on one projection:
 *    Warp       — the travel layer, speed-ramped per beat
 *    PanelWall  — volumetric information, always flying past
 *    Swarm      — the intelligence, gathers / breaks / repairs
 * and one DOM projection (`world`) that puts type in the same space, so text
 * inherits real depth of field instead of sitting on top of the image.
 *
 * Cuts are whips: 4 frames of accelerate + blur, 4 frames of settle. Between
 * whips the camera is always moving — even a held title dollies.
 */

const CUTS = [66, 168, 288, 408, 528, 648, 756, 900];

const SERVICES = [
  { t: "CAPITAL", v: "3.4B", l: "deployed", c: NX.green },
  { t: "LEGAL", v: "40", l: "jurisdictions", c: NX.blue },
  { t: "TALENT", v: "12K", l: "operators", c: NX.green },
  { t: "GROWTH", v: "190", l: "markets", c: NX.blue },
  { t: "OPS", v: "24/7", l: "autonomous", c: NX.green },
  { t: "SECURITY", v: "0", l: "breaches", c: NX.blue },
];

const TICKER = [
  "nexus core online",
  "190 markets",
  "1200 agents",
  "uptime 99.99",
  "latency 40ms",
  "edge nodes 330",
];

/* --------------------------- whip (cut) helper --------------------------- */

const whipAt = (f: number) => {
  let best = 0;
  for (let i = 0; i < CUTS.length; i++) {
    const d = f - CUTS[i];
    if (d >= -5 && d <= 7) {
      const t = d <= 0 ? (d + 5) / 5 : 1 - d / 7;
      best = Math.max(best, Math.pow(t, 2.2));
    }
  }
  return best;
};

const whipDir = (f: number) => {
  let dir = 1;
  for (let i = 0; i < CUTS.length; i++) if (f >= CUTS[i]) dir = i % 2 === 0 ? 1 : -1;
  return dir;
};

/** Wraps a beat in the whip transform so the cut itself is a camera move. */
const Whip: React.FC<{ f: number; children: React.ReactNode }> = ({ f, children }) => {
  const w = whipAt(f);
  const dir = whipDir(f);
  if (w < 0.02) return <AbsoluteFill>{children}</AbsoluteFill>;
  return (
    <AbsoluteFill
      style={{
        transform: `translateX(${dir * w * 74}px) scale(${1 + w * 0.07})`,
        filter: `blur(${(w * 3.4).toFixed(2)}px)`,
        opacity: 1 - w * 0.14,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/* ================================= FILM ================================= */

export const Reel: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  const inA = f < 66;
  const inB = f >= 66 && f < 168;
  const inC = f >= 168 && f < 288;
  const inD = f >= 288 && f < 408;
  const inE = f >= 408 && f < 528;
  const inF = f >= 528 && f < 648;
  const inG = f >= 648 && f < 756;
  const inH = f >= 756 && f < 900;
  const inI = f >= 900;

  /* ------------------------------ travel speed ---------------------------- */
  const warpSpeed = inA
    ? interpolate(f, [0, 40, 66], [6, 34, 90])
    : inB
      ? interpolate(f, [66, 168], [26, 10])
      : inC
        ? interpolate(f, [168, 288], [18, 70])
        : inF
          ? interpolate(f, [528, 648], [40, 14])
          : inH
            ? interpolate(f, [756, 900], [16, 46])
            : 12;

  /* ------------------------------- flashes -------------------------------- */
  const flashAt = (at: number, p: number, d = 5) => (f >= at ? p * Math.exp(-(f - at) / d) : 0);
  const flash =
    flashAt(64, 0.75) + flashAt(168, 0.4) + flashAt(288, 0.5) + flashAt(408, 0.45) + flashAt(528, 0.85) +
    flashAt(648, 0.6) + flashAt(756, 0.35) + flashAt(900, 0.9) + flashAt(960, 0.25);

  const threat = inF ? Math.min(1, ramp(f, 528, 552)) * (1 - ramp(f, 620, 648)) : 0;

  /* -------------------------------- camera -------------------------------- */
  const camPush = interpolate(f, [0, 1080], [0, 340]);

  return (
    <AbsoluteFill style={{ background: NX.ink, overflow: "hidden" }}>
      {/* single deep-field gradient — everything sits inside this light */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 62% 42% at 50% 40%, rgba(${threat > 0.3 ? "255,40,80" : "0,224,138"},0.12) 0%, rgba(0,0,0,0) 70%)`,
        }}
      />
      {/* counter-light: a cool blue from below frames the green without noise */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse 78% 46% at 50% 96%, rgba(43,184,255,0.13) 0%, rgba(10,70,200,0.05) 46%, rgba(0,0,0,0) 76%)",
          opacity: threat > 0.3 ? 0.25 : 1,
        }}
      />

      {/* --------------------------- 01 · WARP --------------------------- */}
      <Whip f={f}>
        <Warp
          frame={f}
          speed={warpSpeed}
          tail={130 + warpSpeed * 2.4}
          threat={threat}
          opacity={inB ? 0.22 : inD ? 0.16 : inE ? 0.2 : inF ? 0.24 : inI ? 0.3 : 0.5}
        />
      </Whip>

      {/* the volumetric information layer runs under every beat */}
      {(inB || inC || inH) && (
        <Whip f={f}>
          <PanelWall frame={f} speed={inC ? 46 : inH ? 40 : 16} opacity={inC ? 0.95 : 0.7} />
        </Whip>
      )}

      {/* ---------------------------- 02 · TITLE -------------------------- */}
      {inB ? (
        <Whip f={f}>
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
            <div style={{ marginTop: -60 }}>
              <Extrude
                text="NEXUS"
                size={196}
                frame={f}
                start={70}
                rotate={interpolate(f, [66, 168], [-30, 8])}
                tilt={interpolate(f, [66, 168], [16, -4])}
                depth={5}
                layers={18}
              />
            </div>
            <div style={{ height: 40 }} />
            <Mono size={17} color={NX.greenHot} style={{ opacity: ramp(f, 92, 116) }}>
              global platform for entrepreneurs
            </Mono>
            <div
              style={{
                marginTop: 26,
                width: 460 * ramp(f, 100, 130),
                height: 1,
                background: `linear-gradient(90deg, transparent, ${NX.green}, transparent)`,
              }}
            />
          </AbsoluteFill>
        </Whip>
      ) : null}

      {/* ---------------------------- 03 · WALL --------------------------- */}
      {inC ? (
        <Whip f={f}>
          {/* cards racing past the lens at different depths: the DOF does the rest */}
          {[
            { x: -420, y: -520, z: 900, t: "MARKETS", v: "190", l: "live", c: NX.green },
            { x: 380, y: -300, z: 1500, t: "AGENTS", v: "1,200", l: "on duty", c: NX.blue },
            { x: -360, y: 180, z: 2100, t: "UPTIME", v: "99.99", l: "percent", c: NX.green },
            { x: 420, y: 560, z: 1100, t: "LATENCY", v: "40", l: "ms edge", c: NX.blue },
            { x: -120, y: 760, z: 2500, t: "CAPITAL", v: "3.4B", l: "deployed", c: NX.green },
          ].map((c, i) => {
            const z = c.z - (f - 168) * 34 + camPush;
            if (z < 260) return null;
            const pl = world({ x: c.x, y: c.y, z }, 0, 540, 900, { focus: 1700, range: 1100, maxBlur: 9 });
            return (
              <At3D key={i} place={pl} k={0.5}>
                <Card3D w={520} h={300} title={c.t} value={c.v} label={c.l} accent={c.c} lit={1 - pl.blur / 9} />
              </At3D>
            );
          })}
          <div style={{ position: "absolute", left: 96, top: 190, opacity: ramp(f, 176, 196) }}>
            <Line text="Everything," size={78} frame={f} start={178} color={NX.white} />
            <Line text="in one system." size={78} frame={f} start={196} color={NX.green} glow="rgba(0,224,138,0.3)" />
          </div>
        </Whip>
      ) : null}

      {/* ---------------------------- 04 · ORBIT -------------------------- */}
      {inD ? (
        <Whip f={f}>
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
            <Mono size={15} color={NX.dim} style={{ marginBottom: 20, opacity: ramp(f, 296, 316) }}>
              six services / one subscription
            </Mono>
            <div style={{ position: "relative", width: "100%", height: 1 }} />
          </AbsoluteFill>
          {SERVICES.map((s, i) => {
            // A fan of cards rushing at the lens: fixed screen-space lane,
            // depth recycled so a card is always arriving. This is the shot
            // that carries the information density — six services, all on
            // screen, at different depths, none of them waiting their turn.
            const LANE = [
              { x: -250, y: -430 },
              { x: 265, y: -250 },
              { x: -225, y: -20 },
              { x: 248, y: 200 },
              { x: -268, y: 420 },
              { x: 205, y: 640 },
            ][i];
            const span = 1500;
            const raw = 620 + (((i * 251 + (f - 288) * 26) % span) + span) % span;
            if (raw < 640) return null;
            const pl = world({ x: LANE.x, y: LANE.y, z: raw }, 0, 540, 900, {
              focus: 1350,
              range: 620,
              maxBlur: 7,
              fadeNear: 500,
              fadeFar: 2100,
            });
            // fade out as a card gets too close: at scale > ~1 it is wider than
            // the frame and reads as a broken crop rather than as depth
            const nearFade = 1 - Math.min(1, Math.max(0, (pl.scale - 0.78) / 0.5));
            if (pl.scale < 0.28 || nearFade <= 0.02) return null;
            return (
              <At3D key={s.t} place={{ ...pl, opacity: pl.opacity * nearFade }} k={1}>
                <Card3D w={470} h={280} title={s.t} value={s.v} label={s.l} accent={s.c} lit={1 - pl.blur / 7} />
              </At3D>
            );
          })}
          {/* the label strip that anchors the shot */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 200,
              display: "flex",
              justifyContent: "center",
              gap: 26,
              opacity: ramp(f, 300, 322) * (1 - ramp(f, 396, 408)),
            }}
          >
            {SERVICES.map((s, i) => {
              const on = i === Math.floor(((f - 288) * 0.035) % 6);
              return (
                <div
                  key={s.t}
                  style={{
                    fontFamily: T.mono,
                    fontSize: 13,
                    letterSpacing: "0.24em",
                    color: on ? NX.greenHot : "rgba(255,255,255,0.22)",
                    borderBottom: on ? `1px solid ${NX.green}` : "1px solid transparent",
                    paddingBottom: 6,
                  }}
                >
                  {s.t}
                </div>
              );
            })}
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 240, textAlign: "center", opacity: ramp(f, 320, 344) }}>
            <Mono size={16} color={NX.greenHot} tracking="0.5em">
              selected
            </Mono>
          </div>
        </Whip>
      ) : null}

      {/* ---------------------------- 05 · SWARM -------------------------- */}
      {inE ? (
        <Whip f={f}>
          <Swarm
            frame={f}
            gather={ramp(f, 420, 500)}
            spin={(f - 408) * 0.006}
            scale={interpolate(f, [408, 528], [0.95, 1.25])}
            threat={0}
            opacity={0.95}
          />
          <div style={{ position: "absolute", left: 96, top: 220 }}>
            <Line text="Your AI" size={92} frame={f} start={420} color={NX.white} />
            <Line text="workforce." size={92} frame={f} start={438} color={NX.green} glow="rgba(0,224,138,0.35)" />
            <div style={{ height: 24 }} />
            <div style={{ opacity: ramp(f, 452, 474) }}>
              <BigNum to={1200} frame={f} start={452} size={110} suffix="+" />
            </div>
            <Mono size={14} color={NX.dim} style={{ marginTop: 6 }}>
              agents on duty
            </Mono>
          </div>
          {/* live log, right aligned, appearing line by line */}
          <div style={{ position: "absolute", right: 70, bottom: 300, textAlign: "right", fontFamily: T.mono, fontSize: 17, lineHeight: 1.9 }}>
            {["spawn 24", "match 3 deals", "audit clear", "escalate human"].map((l, i) => (
              <div key={l} style={{ opacity: ramp(f, 460 + i * 14, 474 + i * 14) * 0.7, color: i === 3 ? NX.greenHot : NX.muted }}>
                {l}
              </div>
            ))}
          </div>
        </Whip>
      ) : null}

      {/* ---------------------------- 06 · BREACH ------------------------- */}
      {inF ? (
        <Whip f={f}>
          <Swarm frame={f} gather={1} spin={(f - 528) * 0.012} scale={1.2} threat={threat} opacity={0.9} />
          <Breach frame={f} power={threat * 0.35} />
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
            <Mono size={20} color={NX.red} tracking="0.5em" style={{ opacity: ramp(f, 540, 556) }}>
              intrusion detected
            </Mono>
            <div style={{ height: 30 }} />
            <Line text="BLOCKED" size={168} frame={f} start={566} color={NX.white} weight={700} glow="rgba(255,59,92,0.5)" />
            <div style={{ height: 20 }} />
            <Mono size={16} color={NX.muted} style={{ opacity: ramp(f, 590, 610) }}>
              4,821,004 events handled
            </Mono>
          </AbsoluteFill>
        </Whip>
      ) : null}

      {/* ----------------------------- 07 · HEAL -------------------------- */}
      {inG ? (
        <Whip f={f}>
          <Swarm frame={f} gather={1} spin={(f - 648) * 0.004} scale={1.15} heal={ramp(f, 656, 736)} threat={1 - ramp(f, 648, 690)} opacity={0.95} />
          <div style={{ position: "absolute", left: 96, bottom: 320 }}>
            <Line text="Self-healing." size={84} frame={f} start={664} color={NX.white} />
            <Line text="by design." size={84} frame={f} start={682} color={NX.greenHot} glow="rgba(92,255,184,0.45)" />
            <Mono size={15} color={NX.dim} style={{ marginTop: 18, opacity: ramp(f, 700, 722) }}>
              detect / isolate / recover — 1.8s
            </Mono>
          </div>
        </Whip>
      ) : null}

      {/* ----------------------------- 08 · SCALE ------------------------- */}
      {inH ? (
        <Whip f={f}>
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
            <Mono size={15} color={NX.dim} style={{ opacity: ramp(f, 762, 782) }}>
              built to scale
            </Mono>
            <div style={{ height: 40 }} />
            {[
              { v: 190, s: "+", l: "countries" },
              { v: 1200, s: "+", l: "ai agents" },
              { v: 99.99, s: "%", l: "uptime" },
            ].map((m, i) => {
              const st = 768 + i * 22;
              const on = window01(f, st, 900, 6, 10);
              return (
                <div
                  key={m.l}
                  style={{
                    opacity: on * ramp(f, st, st + 10),
                    transform: `translateY(${(1 - ramp(f, st, st + 16)) * 40}px) scale(${1 + (1 - ramp(f, st, st + 16)) * 0.12})`,
                    filter: `blur(${(1 - ramp(f, st, st + 8)) * 6}px)`,
                    marginBottom: 8,
                    textAlign: "center",
                  }}
                >
                  <BigNum to={m.v} frame={f} start={st} size={128} suffix={m.s} decimals={m.v % 1 ? 2 : 0} />
                  <Mono size={14} color={NX.muted}>
                    {m.l}
                  </Mono>
                </div>
              );
            })}
          </AbsoluteFill>
        </Whip>
      ) : null}

      {/* ---------------------------- 09 · RESOLVE ------------------------ */}
      {inI ? (
        <Whip f={f}>
          <MarkCloud frame={f} progress={ramp(f, 900, 952)} scale={interpolate(f, [900, 1080], [1.15, 0.82])} opacity={1 - ramp(f, 1000, 1050)} />
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 620 }}>
            <Extrude
              text="NEXUS"
              size={132}
              frame={f}
              start={948}
              rotate={interpolate(f, [948, 1040], [-22, 0])}
              tilt={interpolate(f, [948, 1040], [10, 0])}
              depth={3.2}
              layers={12}
            />
            <div style={{ height: 26 }} />
            <Mono size={15} color={NX.muted} style={{ opacity: ramp(f, 986, 1010), letterSpacing: "0.42em" }}>
              the network for builders
            </Mono>
          </AbsoluteFill>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 250, textAlign: "center", opacity: ramp(f, 1006, 1030) }}>
            <div
              style={{
                display: "inline-block",
                padding: "20px 44px",
                border: `1px solid rgba(92,255,184,0.35)`,
                background: "linear-gradient(160deg, rgba(0,224,138,0.14), rgba(43,184,255,0.05))",
              }}
            >
              <Mono size={18} color={NX.greenHot} tracking="0.42em">
                nexus.global
              </Mono>
            </div>
          </div>
        </Whip>
      ) : null}

      {/* ------------------------------ HUD ------------------------------- */}
      <Hud
        frame={f}
        mode={inF ? "threat" : inI ? "resolve" : "default"}
        rightLabel={inF ? "breach" : inG ? "restoring" : inI ? "online" : "secure"}
        code={inF ? "NX/06" : inI ? "NX/09" : "NX/01"}
        opacity={inA ? ramp(f, 8, 30) * 0.85 : 0.85}
      />

      {/* ---------------------------- finish ------------------------------ */}
      <Post
        frame={f}
        flash={flash}
        flashRGB={inF ? "255,80,110" : "210,255,235"}
        vignette={0.72}
        grain={0.028}
        halo={inA ? 0.16 : inI ? 0.3 : 0.10}
        haloRGB={inF ? "255,60,90" : "92,255,184"}
        lightX={540}
        lightY={inI ? 700 : 840}
        smear={0}
      />

      <AbsoluteFill style={{ background: "#000", opacity: ramp(f, 1052, 1080) }} />
      <AudioReel frame={f} fps={fps} />
    </AbsoluteFill>
  );
};
