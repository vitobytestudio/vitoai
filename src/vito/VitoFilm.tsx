import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BEAT, CITIES, DURATION, F, PAD, V, W, r, win } from "./palette";
import { Dot, Frame, KeyVal, Line, Mono, Num, Panel, Rule, SegBar, Spark, Stamp, Terminal, TermLine } from "./Parts";
import { Grid, Grain, WorldMap } from "./Backdrop";
import { AudioVito } from "./AudioVito";

/**
 * VITO BYTE STUDIO — "AUTONOMY"
 * =============================================================================
 * 32s · 1080x1920 · 60fps.
 *
 * FLAT BY DESIGN. Not one beat uses a 3D subject: this brief is terminals,
 * grids, metrics and pipelines, and each of those is sharper without a camera.
 * The variety comes from *layout* — a new grid, a new density, a new speed on
 * every cut — not from moving geometry around.
 *
 * The whole film is 7 primitives repeated: a hairline, a corner bracket, a
 * monospace column, a segmented meter, a sparkline, a glass panel, a counter.
 */

const inBeat = (f: number, b: readonly [number, number]) => f >= b[0] && f < b[1];

/* ------------------------------- boot copy -------------------------------- */

const BOOT: TermLine[] = [
  { t: "vito-byte-studio v4.2.1  ·  kernel 6.9.2-edge", tone: "dim" },
  { t: "mount  /dev/nexus-engine .............. ok", tone: "ok" },
  { t: "mount  /dev/vitocloud ................. ok", tone: "ok" },
  { t: "auth   operator@vitobyte.studio ....... ok", tone: "ok" },
  { t: "load   autonomy.stack (12 modules) .... ok", tone: "ok" },
  { t: "sync   github:ci-bridge ............... ok", tone: "ok" },
  { t: "probe  edge network ................... 312 pops", tone: "dim" },
  { t: "warn   no manual deploy in 41 days", tone: "warn" },
  { t: "ready  standing by", tone: "hot" },
];

const AGENT_LOG: TermLine[] = [
  { t: "agent[orion]   claim  issue #4821", tone: "dim" },
  { t: "agent[orion]   plan   6 steps", tone: "dim" },
  { t: "agent[orion]   write  src/edge/router.ts", tone: "hot" },
  { t: "agent[vega]    test   coverage 98.4%", tone: "ok" },
  { t: "agent[lyra]    review  0 findings", tone: "ok" },
  { t: "agent[orion]   commit  feat: anycast-route", tone: "hot" },
  { t: "agent[atlas]   deploy  prod/us-east", tone: "dim" },
  { t: "agent[vega]    verify  312/312 healthy", tone: "ok" },
  { t: "orchestrator   cycle complete  41.2s", tone: "ok" },
];

const BUILD: TermLine[] = [
  { t: "git push origin main", tone: "dim" },
  { t: "checkout   1.8s", tone: "dim" },
  { t: "install    9.4s", tone: "dim" },
  { t: "test      22.1s  · 1,284 passed", tone: "ok" },
  { t: "build     14.6s  · 42 bundles", tone: "dim" },
  { t: "deploy     3.2s  · canary 5%", tone: "hot" },
  { t: "promote  100%   · zero downtime", tone: "ok" },
];

/* ------------------------------ the services ----------------------------- */

const SYSTEMS = [
  { name: "NEXUS ENGINE", role: "orchestration core", value: "41", unit: "ms cycle", load: 0.86, accent: V.green },
  { name: "VITOCLOUD", role: "private infrastructure", value: "312", unit: "nodes", load: 0.72, accent: V.blue },
  { name: "B2B PLATFORMS", role: "client products", value: "27", unit: "live", load: 0.64, accent: V.green },
];

/* --------------------------------- mark ---------------------------------- */

/** Flat geometry: a V built from two strokes and a rule. No extrusion. */
const Mark: React.FC<{ size: number; progress: number; color?: string }> = ({ size, progress, color = V.green }) => {
  const p = Math.min(1, Math.max(0, progress));
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: "visible" }}>
      <rect x={0.5} y={0.5} width={99} height={99} fill="none" stroke="rgba(120,200,255,0.16)" strokeWidth={1} />
      <path
        d="M 22 26 L 50 74 L 78 26"
        fill="none"
        stroke={color}
        strokeWidth={7}
        strokeLinecap="square"
        strokeLinejoin="miter"
        strokeDasharray={110}
        strokeDashoffset={110 * (1 - p)}
      />
      <line x1={50} y1={74} x2={50} y2={92} stroke={color} strokeWidth={3} opacity={Math.max(0, p * 2 - 1)} />
      <line x1={50} y1={14} x2={50} y2={20} stroke="rgba(120,200,255,0.5)" strokeWidth={2} opacity={Math.max(0, p * 2 - 1)} />
    </svg>
  );
};

/* ================================= FILM ================================== */

export const VitoFilm: React.FC = () => {
  const f = useCurrentFrame();

  const B = BEAT;
  const inBoot = inBeat(f, B.boot);
  const inServers = inBeat(f, B.servers);
  const inAgents = inBeat(f, B.agents);
  const inEdge = inBeat(f, B.edge);
  const inCicd = inBeat(f, B.cicd);
  const inSystems = inBeat(f, B.systems);
  const inCta = inBeat(f, B.cta);

  /* cuts: 2-frame light pop, nothing more. The edit does the work. */
  const pop = (at: number) => (f >= at && f < at + 5 ? 1 - (f - at) / 5 : 0);
  const flash = pop(210) * 0.5 + pop(480) * 0.55 + pop(750) * 0.5 + pop(1020) * 0.6 + pop(1260) * 0.45 + pop(1530) * 0.75;

  const stampIdx = inBoot ? "01" : inServers ? "02" : inAgents ? "03" : inEdge ? "04" : inCicd ? "05" : inSystems ? "06" : "07";
  const stampLabel = inBoot
    ? "boot sequence"
    : inServers
      ? "private servers"
      : inAgents
        ? "autonomous agents"
        : inEdge
          ? "cloudflare edge"
          : inCicd
            ? "github ci/cd"
            : inSystems
              ? "production systems"
              : "vito byte studio";

  return (
    <AbsoluteFill style={{ background: V.void, overflow: "hidden" }}>
      {/* base light: one cool gradient, well off centre */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 74% 40% at 62% -6%, rgba(46,124,255,0.14) 0%, rgba(5,11,20,0) 62%),
                       radial-gradient(ellipse 60% 34% at 20% 104%, rgba(0,255,136,0.10) 0%, rgba(5,11,20,0) 66%)`,
        }}
      />

      <Grid frame={f} cell={54} opacity={inEdge ? 0.5 : 0.9} scan={((f % 260) / 260) * 1.3} accent={inCicd ? V.blue : V.green} />

      {/* ============================ 01 · BOOT =========================== */}
      {inBoot ? (
        <AbsoluteFill>
          <Stamp idx="01" label="boot sequence" frame={f} opacity={r(f, 6, 26)} />
          <div style={{ position: "absolute", left: PAD, right: PAD, top: 220 }}>
            <Panel pad={30} style={{ minHeight: 620 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <Mono size={13} color={V.dim} tracking="0.3em">
                  oper@vitobyte ~ %
                </Mono>
                <div style={{ display: "flex", gap: 6 }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ width: 5, height: 5, background: i === 0 ? V.green : "rgba(120,200,255,0.22)" }} />
                  ))}
                </div>
              </div>
              <Rule progress={r(f, 20, 60)} width="100%" color={V.edge} />
              <div style={{ height: 22 }} />
              <Terminal lines={BOOT} frame={f} start={26} perLine={13} size={18} visible={9} />
            </Panel>
          </div>

          {/* command deck: the four things the studio runs, stated once, flat */}
          <div style={{ position: "absolute", left: PAD, right: PAD, top: 900, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { k: "servers", v: "12", u: "dedicated bays" },
              { k: "agents", v: "1284", u: "commits / quarter" },
              { k: "edge", v: "312", u: "points of presence" },
              { k: "pipeline", v: "51s", u: "merge to live" },
            ].map((c, i) => {
              const at = 150 + i * 8;
              const on = r(f, at, at + 12);
              return (
                <div
                  key={c.k}
                  style={{
                    opacity: on,
                    transform: `translateY(${(1 - on) * 14}px)`,
                    borderTop: `1px solid ${V.edge}`,
                    paddingTop: 12,
                  }}
                >
                  <Mono size={10} color={V.dim} tracking="0.28em">
                    {c.k}
                  </Mono>
                  <div style={{ fontFamily: F.display, fontSize: 38, fontWeight: 600, color: i === 3 ? V.green : V.white, letterSpacing: "-0.03em", marginTop: 4 }}>
                    {c.v}
                  </div>
                  <Mono size={9} color={V.dim} tracking="0.16em" style={{ marginTop: 2 }}>
                    {c.u}
                  </Mono>
                </div>
              );
            })}
          </div>

          {/* the wordmark resolves out of the prompt */}
          <div style={{ position: "absolute", left: PAD, right: PAD, bottom: 320, opacity: r(f, 128, 156) }}>
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <Mark size={74} progress={r(f, 126, 168)} />
              <div>
                <div style={{ fontFamily: F.display, fontSize: 54, fontWeight: 700, letterSpacing: "-0.03em", color: V.white, lineHeight: 1 }}>
                  VITO BYTE
                </div>
                <Mono size={15} color={V.green} tracking="0.52em" style={{ marginTop: 8 }}>
                  studio
                </Mono>
              </div>
            </div>
          </div>
        </AbsoluteFill>
      ) : null}

      {/* =========================== 02 · SERVERS ========================= */}
      {inServers ? (
        <AbsoluteFill>
          <Stamp idx="02" label="dedicated private servers" frame={f} opacity={1} />
          <div style={{ position: "absolute", left: PAD, right: PAD, top: 200 }}>
            <Line text="Your own metal." size={78} frame={f} start={220} color={V.white} />
            <Line text="Not a shared slice." size={78} frame={f} start={236} color={V.green} glow="rgba(0,255,136,0.28)" />
          </div>

          {/* rack: 12 bays, each booting in sequence */}
          <div style={{ position: "absolute", left: PAD, right: PAD, top: 470, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {Array.from({ length: 12 }).map((_, i) => {
              const at = 258 + i * 5;
              const on = r(f, at, at + 10);
              const hot = i === 4 || i === 9;
              return (
                <div
                  key={i}
                  style={{
                    height: 118,
                    border: `1px solid rgba(120,200,255,${0.06 + on * 0.16})`,
                    background: on > 0.5 ? (hot ? "rgba(0,255,136,0.05)" : "rgba(10,26,40,0.7)") : "rgba(10,26,40,0.35)",
                    padding: 10,
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Mono size={10} color={V.dim} tracking="0.18em">
                      bay {String(i + 1).padStart(2, "0")}
                    </Mono>
                    <Dot color={on > 0.5 ? (hot ? V.green : V.blueHot) : V.dim} size={5} glow={on > 0.5} />
                  </div>
                  <div style={{ height: 34 }}>
                    <Spark frame={f} w={182} h={34} color={on > 0.5 ? (hot ? V.green : V.blueHot) : V.dim} seed={i} />
                  </div>
                  <Mono size={9} color={on > 0.5 ? V.muted : V.dim} tracking="0.14em">
                    {on > 0.9 ? "active" : on > 0.4 ? "init" : "offline"}
                  </Mono>
                </div>
              );
            })}
          </div>

          {/* isolation band: the thing a buyer actually cares about */}
          <div style={{ position: "absolute", left: PAD, right: PAD, top: 1090, opacity: r(f, 300, 330) }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <Mono size={11} color={V.dim} tracking="0.26em">
                cpu / memory pressure per bay
              </Mono>
              <Mono size={11} color={V.green} tracking="0.18em">
                isolated
              </Mono>
            </div>
            <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 74 }}>
              {Array.from({ length: 44 }).map((_, i) => {
                const h = 12 + Math.abs(Math.sin(i * 1.7 + f * 0.03)) * 62;
                const hot = i % 11 === 0;
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: h,
                      background: hot ? V.green : "rgba(46,124,255,0.55)",
                      opacity: r(f, 300 + i * 1.5, 312 + i * 1.5),
                    }}
                  />
                );
              })}
            </div>
            <div style={{ height: 1, background: V.edge, marginTop: 2 }} />
          </div>

          {/* spec strip */}
          <div style={{ position: "absolute", left: PAD, right: PAD, bottom: 236 }}>
            <Panel pad={28} lit={r(f, 318, 360)}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
                <div>
                  <Mono size={11} color={V.dim} tracking="0.24em">
                    cores
                  </Mono>
                  <Num to={192} frame={f} start={318} dur={34} size={44} color={V.white} />
                </div>
                <div>
                  <Mono size={11} color={V.dim} tracking="0.24em">
                    memory
                  </Mono>
                  <Num to={768} frame={f} start={322} dur={34} size={44} suffix="GB" color={V.white} />
                </div>
                <div>
                  <Mono size={11} color={V.dim} tracking="0.24em">
                    uptime
                  </Mono>
                  <Num to={99.99} frame={f} start={326} dur={36} size={44} suffix="%" decimals={2} color={V.green} />
                </div>
              </div>
              <div style={{ height: 18 }} />
              <Rule progress={r(f, 350, 400)} width="100%" color={V.edge} />
              <div style={{ height: 14 }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Mono size={11} color={V.dim} tracking="0.22em">
                  isolation: dedicated
                </Mono>
                <Mono size={11} color={V.green} tracking="0.22em">
                  no noisy neighbours
                </Mono>
              </div>
            </Panel>
          </div>
        </AbsoluteFill>
      ) : null}

      {/* ============================ 03 · AGENTS ========================= */}
      {inAgents ? (
        <AbsoluteFill>
          <Stamp idx="03" label="autonomous ai developers" frame={f} opacity={1} />
          <div style={{ position: "absolute", left: PAD, right: PAD, top: 196 }}>
            <Line text="Agents that ship." size={80} frame={f} start={490} color={V.white} />
            <Line text="Not demos." size={80} frame={f} start={506} color={V.green} glow="rgba(0,255,136,0.3)" />
          </div>

          {/* three lanes: agent cards on the left, live log on the right */}
          <div style={{ position: "absolute", left: PAD, top: 420, width: 300, display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { n: "ORION", role: "architecture", load: 0.92, c: V.green },
              { n: "VEGA", role: "testing", load: 0.78, c: V.blueHot },
              { n: "LYRA", role: "review", load: 0.61, c: V.green },
              { n: "ATLAS", role: "deploy", load: 0.44, c: V.blueHot },
            ].map((a, i) => {
              const at = 520 + i * 14;
              const on = r(f, at, at + 14);
              return (
                <div
                  key={a.n}
                  style={{
                    opacity: on,
                    transform: `translateX(${(1 - on) * -22}px)`,
                    border: `1px solid rgba(120,200,255,${0.06 + on * 0.14})`,
                    borderLeft: `2px solid ${a.c}`,
                    background: "rgba(10,26,40,0.6)",
                    padding: "12px 14px",
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div style={{ fontFamily: F.mono, fontSize: 17, color: V.white, letterSpacing: "0.06em" }}>{a.n}</div>
                    <Mono size={9} color={V.dim} tracking="0.16em">
                      {a.role}
                    </Mono>
                  </div>
                  <div style={{ height: 10 }} />
                  <SegBar v={a.load * on} segments={16} w={244} color={a.c} height={5} />
                </div>
              );
            })}
          </div>

          <div style={{ position: "absolute", left: 416, right: PAD, top: 420 }}>
            <Panel pad={22} style={{ height: 452 }}>
              <Mono size={11} color={V.dim} tracking="0.28em" style={{ marginBottom: 14 }}>
                orchestrator · live
              </Mono>
              <Terminal lines={AGENT_LOG} frame={f} start={528} perLine={19} size={14} visible={11} />
            </Panel>
          </div>

          <div style={{ position: "absolute", left: PAD, right: PAD, bottom: 260, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div>
              <Num to={1284} frame={f} start={596} dur={56} size={104} suffix="" color={V.white} />
              <Mono size={12} color={V.dim} tracking="0.26em" style={{ marginTop: 8 }}>
                autonomous commits this quarter
              </Mono>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: F.display, fontSize: 40, color: V.green, letterSpacing: "-0.02em" }}>0</div>
              <Mono size={12} color={V.dim} tracking="0.26em">
                human interventions
              </Mono>
            </div>
          </div>
        </AbsoluteFill>
      ) : null}

      {/* ============================= 04 · EDGE ========================== */}
      {inEdge ? (
        <AbsoluteFill>
          <Stamp idx="04" label="cloudflare edge network" frame={f} opacity={1} />
          <div style={{ position: "absolute", left: PAD, right: PAD, top: 196 }}>
            <Line text="312 points of presence." size={62} frame={f} start={760} color={V.white} />
          </div>

          <WorldMap
            frame={f}
            reveal={r(f, 762, 900)}
            land={r(f, 762, 820)}
            nodes={r(f, 800, 840)}
            arcStart={806}
            box={{ x: 60, y: 690, w: 960, h: 440 }}
          />

          {/* latency board */}
          <div style={{ position: "absolute", left: PAD, right: PAD, top: 330 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 20 }}>
              <Num to={23} frame={f} start={852} dur={40} size={168} suffix="ms" color={V.green} />
              <div style={{ paddingBottom: 26 }}>
                <Mono size={14} color={V.muted} tracking="0.28em">
                  p95 global
                </Mono>
                <Mono size={14} color={V.dim} tracking="0.22em" style={{ marginTop: 6 }}>
                  target &lt; 25ms
                </Mono>
              </div>
            </div>
            <div style={{ height: 22 }} />
            <div style={{ width: 620 }}>
              <SegBar v={0.92 * r(f, 856, 920)} segments={32} w={620} color={V.green} height={10} />
            </div>
          </div>

          {/* regional spread, filling the middle band */}
          <div style={{ position: "absolute", left: PAD, right: PAD, top: 1180, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, opacity: r(f, 890, 916) }}>
            {[
              { k: "regions", v: "6" },
              { k: "pops", v: "312" },
              { k: "tls 1.3", v: "100%" },
            ].map((m) => (
              <div key={m.k} style={{ borderTop: `1px solid ${V.edge}`, paddingTop: 10 }}>
                <Mono size={9} color={V.dim} tracking="0.22em">
                  {m.k}
                </Mono>
                <div style={{ fontFamily: F.display, fontSize: 30, color: V.white, letterSpacing: "-0.03em", marginTop: 2 }}>{m.v}</div>
              </div>
            ))}
          </div>

          {/* pop table */}
          <div style={{ position: "absolute", left: PAD, right: PAD, bottom: 210 }}>
            <Panel pad={26}>
              {[
                ["FRA", "7ms"],
                ["LHR", "8ms"],
                ["IAD", "9ms"],
                ["SIN", "13ms"],
                ["NRT", "15ms"],
              ].map(([c, ms], i) => {
                const on = r(f, 880 + i * 9, 892 + i * 9);
                return (
                  <div key={c} style={{ opacity: on, marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <Mono size={13} color={V.white} tracking="0.2em">
                        {c}
                      </Mono>
                      <div style={{ flex: 1, height: 1, background: "rgba(120,200,255,0.12)" }} />
                      <div style={{ fontFamily: F.mono, fontSize: 15, color: V.green }}>{ms}</div>
                    </div>
                  </div>
                );
              })}
            </Panel>
          </div>
        </AbsoluteFill>
      ) : null}

      {/* ============================= 05 · CI/CD ========================= */}
      {inCicd ? (
        <AbsoluteFill>
          <Stamp idx="05" label="github ci/cd" frame={f} opacity={1} />
          <div style={{ position: "absolute", left: PAD, right: PAD, top: 196 }}>
            <Line text="Commit to production" size={62} frame={f} start={1030} color={V.white} />
            <Line text="in 51 seconds." size={62} frame={f} start={1046} color={V.green} glow="rgba(0,255,136,0.3)" />
          </div>

          {/* the pipeline: six stages on one rail */}
          <div style={{ position: "absolute", left: PAD, right: PAD, top: 430 }}>
            <div style={{ position: "relative", height: 96 }}>
              <div style={{ position: "absolute", left: 0, top: 46, height: 1, width: `${r(f, 1060, 1200) * 100}%`, background: V.edge }} />
              {["push", "install", "test", "build", "deploy", "live"].map((s, i) => {
                const at = 1066 + i * 26;
                const done = f > at + 14;
                const active = f >= at && f <= at + 14;
                const x = (i / 5) * 100;
                return (
                  <div key={s} style={{ position: "absolute", left: `${x}%`, top: 0, transform: "translateX(-50%)", textAlign: "center", width: 140 }}>
                    <div
                      style={{
                        margin: "0 auto",
                        width: 14,
                        height: 14,
                        marginTop: 40,
                        background: done ? V.green : active ? V.blueHot : "rgba(120,200,255,0.14)",
                        boxShadow: done ? `0 0 16px ${V.green}` : active ? `0 0 16px ${V.blueHot}` : undefined,
                        transform: `scale(${active ? 1.25 : 1})`,
                      }}
                    />
                    <Mono size={11} color={done ? V.green : active ? V.white : V.dim} tracking="0.2em" style={{ marginTop: 14 }}>
                      {s}
                    </Mono>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ position: "absolute", left: PAD, right: PAD, top: 600 }}>
            <Panel pad={24} style={{ height: 400 }}>
              <Terminal lines={BUILD} frame={f} start={1072} perLine={16} size={16} visible={10} />
            </Panel>
          </div>

          <div style={{ position: "absolute", left: PAD, right: PAD, bottom: 260, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {[
              { k: "merge to live", v: "51s" },
              { k: "rollback", v: "4s" },
              { k: "downtime", v: "0s" },
            ].map((m, i) => {
              const on = r(f, 1180 + i * 12, 1196 + i * 12);
              return (
                <div key={m.k} style={{ opacity: on, borderTop: `1px solid ${V.edge}`, paddingTop: 12 }}>
                  <div style={{ fontFamily: F.display, fontSize: 34, color: i === 2 ? V.green : V.white, letterSpacing: "-0.03em" }}>{m.v}</div>
                  <Mono size={10} color={V.dim} tracking="0.2em" style={{ marginTop: 6 }}>
                    {m.k}
                  </Mono>
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      ) : null}

      {/* =========================== 06 · SYSTEMS ========================= */}
      {inSystems ? (
        <AbsoluteFill>
          <Stamp idx="06" label="production systems" frame={f} opacity={1} />
          <div style={{ position: "absolute", left: PAD, right: PAD, top: 196 }}>
            <Line text="Running in production." size={62} frame={f} start={1270} color={V.white} />
            <Mono size={14} color={V.dim} tracking="0.3em" style={{ marginTop: 22, opacity: r(f, 1290, 1310) }}>
              three systems · one studio
            </Mono>
          </div>

          <div style={{ position: "absolute", left: PAD, right: PAD, top: 470, display: "flex", flexDirection: "column", gap: 20 }}>
            {SYSTEMS.map((s, i) => {
              const at = 1300 + i * 16;
              const on = r(f, at, at + 16);
              return (
                <div key={s.name} style={{ opacity: on, transform: `translateY(${(1 - on) * 18}px)` }}>
                  <Panel pad={32} accent={s.accent} lit={on} style={{ minHeight: 230 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontFamily: F.display, fontSize: 40, fontWeight: 600, color: V.white, letterSpacing: "-0.02em", lineHeight: 1 }}>
                          {s.name}
                        </div>
                        <Mono size={11} color={V.dim} tracking="0.24em" style={{ marginTop: 10 }}>
                          {s.role}
                        </Mono>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: F.display, fontSize: 46, fontWeight: 600, color: s.accent, letterSpacing: "-0.04em", lineHeight: 1 }}>
                          {s.value}
                        </div>
                        <Mono size={10} color={V.dim} tracking="0.18em" style={{ marginTop: 8 }}>
                          {s.unit}
                        </Mono>
                      </div>
                    </div>
                    <div style={{ height: 20 }} />
                    <SegBar v={s.load * on} segments={36} w={860} color={s.accent} height={6} />
                  </Panel>
                </div>
              );
            })}
          </div>

          <div style={{ position: "absolute", left: PAD, right: PAD, bottom: 250, display: "flex", justifyContent: "space-between", opacity: r(f, 1440, 1470) }}>
            <KeyVal k="incidents · 90d" v="0" color={V.green} />
            <KeyVal k="deploys · 30d" v="412" />
            <KeyVal k="clients" v="27" />
          </div>
        </AbsoluteFill>
      ) : null}

      {/* ============================== 07 · CTA ========================== */}
      {inCta ? (
        <AbsoluteFill>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBottom: 120 }}>
            <div style={{ transform: `scale(${0.94 + 0.06 * r(f, 1540, 1620)})` }}>
              <Mark size={172} progress={r(f, 1536, 1596)} />
            </div>

            <div style={{ height: 54 }} />
            <div style={{ fontFamily: F.display, fontSize: 108, fontWeight: 700, letterSpacing: "0.05em", color: V.white, lineHeight: 1, opacity: r(f, 1566, 1592) }}>
              VITO BYTE
            </div>
            <Mono size={19} color={V.green} tracking="0.72em" style={{ marginTop: 18, opacity: r(f, 1584, 1610) }}>
              studio
            </Mono>

            <div style={{ height: 40 }} />
            <div style={{ width: 300 * r(f, 1596, 1640), height: 1, background: V.green, boxShadow: `0 0 14px ${V.green}` }} />
            <div style={{ height: 34 }} />

            <div style={{ opacity: r(f, 1610, 1640), textAlign: "center", maxWidth: 820 }}>
              <div style={{ fontFamily: F.display, fontSize: 40, fontWeight: 500, letterSpacing: "-0.015em", color: V.white, lineHeight: 1.24 }}>
                Where Engineering Meets Autonomy
              </div>
            </div>

            <div style={{ height: 62 }} />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "20px 42px",
                border: `1px solid ${V.edgeHot}`,
                background: "rgba(0,255,136,0.06)",
                opacity: r(f, 1650, 1682),
                transform: `translateY(${(1 - r(f, 1650, 1682)) * 12}px)`,
              }}
            >
              <Mono size={17} color={V.green} tracking="0.4em">
                vitobyte.studio
              </Mono>
            </div>
          </div>

          {/* closing telemetry, so the last frame is a system sign-off not a blank */}
          <div style={{ position: "absolute", left: PAD, right: PAD, top: 300, display: "flex", justifyContent: "space-between", opacity: r(f, 1556, 1584) }}>
            <Mono size={10} color={V.dim} tracking="0.3em">
              all systems nominal
            </Mono>
            <Mono size={10} color={V.green} tracking="0.3em">
              312 / 312 healthy
            </Mono>
          </div>
          <div style={{ position: "absolute", left: PAD, right: PAD, top: 330, height: 1, background: V.edge, opacity: r(f, 1556, 1584) }} />

          {/* the same corner language as the rest of the film, closing it out */}
          <div style={{ position: "absolute", left: PAD, right: PAD, bottom: 96, display: "flex", justifyContent: "space-between", opacity: r(f, 1660, 1690) }}>
            <Mono size={11} color={V.dim} tracking="0.3em">
              autonomous systems · est. 2021
            </Mono>
            <Mono size={11} color={V.dim} tracking="0.3em">
              end of transmission
            </Mono>
          </div>
        </AbsoluteFill>
      ) : null}

      {/* ---------------------------- global finish ------------------------ */}
      <Frame opacity={r(f, 4, 30)} ticks={14} />

      {/* cut flash: a 5-frame exposure lift, not a strobe */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(0,255,136,0.5), rgba(46,124,255,0.35))`,
          opacity: flash * 0.16,
          mixBlendMode: "screen",
        }}
      />

      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse 76% 54% at 50% 46%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 78%, rgba(0,0,0,0.82) 100%)",
        }}
      />

      <Grain frame={f} amount={0.035} />

      <AbsoluteFill style={{ background: "#000", opacity: r(f, DURATION - 30, DURATION) }} />

      <AudioVito frame={f} />
    </AbsoluteFill>
  );
};

export { W, CITIES, F, V, interpolate, win, win as win01 };
