/**
 * RIVIO · 0:48 Tease — Agency-grade motion graphics + Instagram-grade UI + Architectural Schematics.
 * Every entrance is driven by `src/phone/rivioVo.json` (measured speech blocks, zero hardcoded timecodes).
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import {
  Bell,
  Bookmark,
  CheckCircle2,
  Cpu,
  Heart,
  Home,
  Layers,
  MessageCircle,
  Radio,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import VO from "./rivioVo.json";

export const RIVIO_FPS = 30;
export const RIVIO_TAIL = 96;
export const RIVIO_DURATION = (VO.lines[VO.lines.length - 1].end_f as number) + RIVIO_TAIL;

const INK = "#05060A";
const SURFACE = "#0B0E16";
const SURFHI = "#121826";
const HAIR = "rgba(150,168,255,0.16)";
const BLUE = "#4C8DFF";
const VIOLET = "#8B5CF6";
const WHITE = "#F4F6FF";
const STEEL = "#93A8CF";
const RED = "#FF4D6D";
const LAT = '"Space Grotesk", "Sora", sans-serif';
const MONO = '"JetBrains Mono", monospace';
const SOFT = Easing.bezier(0.16, 1, 0.3, 1);

const cl = (v: number) => Math.min(1, Math.max(0, v));
const p = (f: number, a: number, b: number) =>
  b <= a ? (f >= b ? 1 : 0) : interpolate(f, [a, b], [0, 1], { easing: SOFT, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
const out = (f: number, a: number, b: number) => 1 - p(f, a, b);

const at = (i: number) => VO.lines[i] as { start_f: number; end_f: number; text: string };

// ── Subtitle Bar ────────────────────────────────────────────────────────────
const Sub: React.FC<{ f: number; i: number; big?: boolean }> = ({ f, i, big }) => {
  const L = at(i);
  const op = p(f, L.start_f - 2, L.start_f + 6) * out(f, L.end_f - 2, L.end_f + 8);
  if (op <= 0.01) return null;
  const dy = (1 - p(f, L.start_f - 2, L.start_f + 8)) * 18;
  return (
    <div
      style={{
        position: "absolute",
        left: 64,
        right: 64,
        bottom: 130,
        opacity: op,
        transform: `translateY(${dy}px)`,
        textAlign: "center",
        fontFamily: LAT,
        fontWeight: 700,
        fontSize: big ? 40 : 34,
        lineHeight: 1.28,
        color: WHITE,
        letterSpacing: "-0.015em",
        textShadow: "0 8px 32px rgba(5,6,10,0.95)",
      }}
    >
      {L.text}
    </div>
  );
};

// ── Act I: THE NOISE (Chaotic Instagram-style infinite feed) ────────────────
const NoiseAct: React.FC<{ f: number; endF: number }> = ({ f, endF }) => {
  const fade = out(f, endF - 8, endF);
  if (fade <= 0.01) return null;

  const scrollY = -f * 14;
  const counter = Math.min(400, Math.floor(interpolate(f, [at(3).start_f, at(3).end_f], [12, 400], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  const showCounter = f >= at(3).start_f - 4 && f <= at(3).end_f + 12;

  const feedItems = [
    { user: "@algo_feed_99", tag: "SPONSORED", likes: "42.1K", desc: "You didn't ask for this, but you'll watch it anyway." },
    { user: "@dopamine_loop", tag: "TRENDING", likes: "128K", desc: "Keep scrolling. The next one might be better." },
    { user: "@ad_network_04", tag: "PROMOTED", likes: "9.4K", desc: "Your attention was auctioned in 14 milliseconds." },
    { user: "@viral_clips", tag: "REEL", likes: "310K", desc: "Infinite scroll. Zero memory. Repeat." },
    { user: "@noise_engine", tag: "SUGGESTED", likes: "18.7K", desc: "Trained by people who bill for your time." },
  ];

  return (
    <AbsoluteFill style={{ background: INK, opacity: fade, overflow: "hidden" }}>
      {/* Scrolling chaotic feed */}
      <div style={{ position: "absolute", left: 72, right: 72, top: 140, transform: `translateY(${scrollY % 1100}px)`, opacity: showCounter ? 0.25 : 0.72 }}>
        {[...feedItems, ...feedItems, ...feedItems].map((item, idx) => (
          <div
            key={idx}
            style={{
              background: SURFACE,
              border: `1px solid ${HAIR}`,
              borderRadius: 24,
              padding: 28,
              marginBottom: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, background: SURFHI, border: `1px solid ${HAIR}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <User size={20} color={STEEL} />
                </div>
                <div>
                  <div style={{ fontFamily: LAT, fontSize: 22, fontWeight: 700, color: WHITE }}>{item.user}</div>
                  <div style={{ fontFamily: MONO, fontSize: 15, color: RED, letterSpacing: "0.08em" }}>{item.tag}</div>
                </div>
              </div>
              <div style={{ background: "rgba(255,77,109,0.14)", border: `1px solid rgba(255,77,109,0.35)`, borderRadius: 99, padding: "6px 14px", fontFamily: MONO, fontSize: 15, color: RED }}>
                +99
              </div>
            </div>
            <div style={{ height: 150, borderRadius: 16, background: `linear-gradient(135deg, ${SURFHI} 0%, #07090F 100%)`, border: `1px solid ${HAIR}`, marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={36} color="rgba(147,168,207,0.28)" />
            </div>
            <div style={{ fontFamily: LAT, fontSize: 22, color: STEEL, marginBottom: 16 }}>{item.desc}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: STEEL }}>
              <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 18 }}>
                  <Heart size={20} color={RED} fill={RED} /> {item.likes}
                </div>
                <MessageCircle size={20} color={STEEL} />
                <Share2 size={20} color={STEEL} />
              </div>
              <Bookmark size={20} color={STEEL} />
            </div>
          </div>
        ))}
      </div>

      {/* Top HUD */}
      <div style={{ position: "absolute", top: 56, left: 64, right: 64, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: MONO, fontSize: 18, color: RED, letterSpacing: "0.14em" }}>● ATTENTION_DRAIN</div>
        <div style={{ fontFamily: MONO, fontSize: 18, color: STEEL }}>THUMB_UP · LOOP</div>
      </div>

      {/* 400 Scrolls Counter */}
      {showCounter && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: 168, fontWeight: 700, color: WHITE, letterSpacing: "-0.04em", lineHeight: 1 }}>
            {counter}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 22, color: STEEL, letterSpacing: "0.18em", marginTop: 12 }}>
            SCROLLS_LOST
          </div>
        </div>
      )}

      <Sub f={f} i={0} />
      <Sub f={f} i={1} />
      <Sub f={f} i={2} />
      <Sub f={f} i={3} big />
      <Sub f={f} i={4} big />
    </AbsoluteFill>
  );
};

// ── Act II: THE SURFACE (Instagram-grade Rivio UI) ──────────────────────────
const SurfaceAct: React.FC<{ f: number; startF: number; endF: number }> = ({ f, startF, endF }) => {
  const enter = p(f, startF, startF + 14);
  const fade = out(f, endF - 8, endF);
  const op = enter * fade;
  if (op <= 0.01) return null;

  const stories = [
    { name: "Curator", role: "AI", color: VIOLET },
    { name: "Design", role: "YOU", color: BLUE },
    { name: "Draft", role: "AI", color: VIOLET },
    { name: "Finder", role: "AI", color: VIOLET },
    { name: "Guard", role: "SEC", color: BLUE },
  ];

  return (
    <AbsoluteFill style={{ background: INK, opacity: op }}>
      {/* Phone Surface Container */}
      <div
        style={{
          position: "absolute",
          left: 56,
          right: 56,
          top: 90,
          bottom: 260,
          background: SURFACE,
          borderRadius: 40,
          border: `1px solid ${HAIR}`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          transform: `scale(${0.95 + 0.05 * enter})`,
        }}
      >
        {/* Top App Bar */}
        <div style={{ padding: "28px 32px 20px", borderBottom: `1px solid ${HAIR}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 14, height: 14, borderRadius: 7, background: BLUE }} />
            <div style={{ fontFamily: LAT, fontSize: 32, fontWeight: 700, color: WHITE, letterSpacing: "0.06em" }}>RIVIO</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ background: "rgba(139,92,246,0.16)", border: `1px solid rgba(139,92,246,0.45)`, borderRadius: 99, padding: "6px 16px", display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={16} color={VIOLET} />
              <span style={{ fontFamily: MONO, fontSize: 15, color: WHITE }}>BLACK FIRST</span>
            </div>
            <Bell size={24} color={STEEL} />
          </div>
        </div>

        {/* Stories / Agents Rail */}
        <div style={{ padding: "24px 32px", borderBottom: `1px solid ${HAIR}`, display: "flex", justifyContent: "space-between" }}>
          {stories.map((st, idx) => (
            <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 82,
                  height: 82,
                  borderRadius: 41,
                  padding: 4,
                  border: `2.5px solid ${st.color}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ width: "100%", height: "100%", borderRadius: 36, background: SURFHI, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {st.role === "AI" ? <Cpu size={28} color={VIOLET} /> : <ShieldCheck size={28} color={BLUE} />}
                </div>
              </div>
              <div style={{ fontFamily: LAT, fontSize: 18, fontWeight: 600, color: WHITE }}>{st.name}</div>
            </div>
          ))}
        </div>

        {/* Featured Clean Feed Card */}
        <div style={{ padding: 32, flex: 1, display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ background: SURFHI, borderRadius: 28, border: `1px solid ${HAIR}`, padding: 28, flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 24, background: "rgba(139,92,246,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Layers size={24} color={VIOLET} />
                </div>
                <div>
                  <div style={{ fontFamily: LAT, fontSize: 24, fontWeight: 700, color: WHITE }}>Curator Brief</div>
                  <div style={{ fontFamily: MONO, fontSize: 16, color: STEEL }}>60 SOURCES -&gt; 9 CARDS</div>
                </div>
              </div>
              <div style={{ background: "rgba(76,141,255,0.16)", border: `1px solid rgba(76,141,255,0.45)`, borderRadius: 99, padding: "6px 14px", fontFamily: MONO, fontSize: 14, color: BLUE }}>
                NEW
              </div>
            </div>

            <div style={{ margin: "20px 0", padding: 24, borderRadius: 20, background: SURFACE, border: `1px solid ${HAIR}` }}>
              <div style={{ fontFamily: LAT, fontSize: 26, fontWeight: 700, color: WHITE, lineHeight: 1.35, marginBottom: 12 }}>
                What deserves light, and what is just noise.
              </div>
              <div style={{ fontFamily: MONO, fontSize: 17, color: STEEL }}>
                ZERO ADS · ZERO ALGO BAIT · 100% SIGNAL
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                <Heart size={24} color={BLUE} />
                <MessageCircle size={24} color={STEEL} />
                <Share2 size={24} color={STEEL} />
              </div>
              <div style={{ background: BLUE, borderRadius: 14, padding: "10px 22px", fontFamily: LAT, fontSize: 18, fontWeight: 700, color: WHITE }}>
                Open Brief
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Navigation Bar */}
        <div style={{ padding: "20px 44px", borderTop: `1px solid ${HAIR}`, background: SURFACE, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Home size={28} color={BLUE} />
          <Search size={28} color={STEEL} />
          <div style={{ width: 52, height: 52, borderRadius: 26, background: VIOLET, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={24} color={WHITE} />
          </div>
          <Radio size={28} color={STEEL} />
          <User size={28} color={STEEL} />
        </div>
      </div>

      <Sub f={f} i={5} big />
      <Sub f={f} i={6} big />
      <Sub f={f} i={7} />
      <Sub f={f} i={8} />
    </AbsoluteFill>
  );
};

// ── Act III: THE SCHEMATIC & MOTION (Architecture + Bezier Curve) ───────────
const CraftAct: React.FC<{ f: number; startF: number; endF: number }> = ({ f, startF, endF }) => {
  const enter = p(f, startF, startF + 14);
  const fade = out(f, endF - 8, endF);
  const op = enter * fade;
  if (op <= 0.01) return null;

  const curveP = p(f, at(11).start_f, at(11).end_f);
  const dotX = 60 + curveP * 760;
  const dotY = 230 - Math.pow(curveP, 0.35) * 190;

  return (
    <AbsoluteFill style={{ background: INK, opacity: op }}>
      <div style={{ position: "absolute", left: 64, right: 64, top: 88 }}>
        <div style={{ fontFamily: MONO, fontSize: 18, color: BLUE, letterSpacing: "0.16em", marginBottom: 12 }}>
          SYSTEM_ARCHITECTURE // SCHEMATIC
        </div>
        <div style={{ fontFamily: LAT, fontSize: 44, fontWeight: 700, color: WHITE, lineHeight: 1.15 }}>
          Engineered for Signal.
        </div>
      </div>

      {/* Architectural Schematic: 60 Sources -> Curator AI -> 9 Cards */}
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          top: 260,
          background: SURFACE,
          borderRadius: 32,
          border: `1px solid ${HAIR}`,
          padding: 36,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          {/* Node 1 */}
          <div style={{ width: 220, background: SURFHI, borderRadius: 20, border: `1px solid ${HAIR}`, padding: 20, textAlign: "center" }}>
            <Layers size={28} color={STEEL} style={{ margin: "0 auto 10px" }} />
            <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700, color: WHITE }}>60</div>
            <div style={{ fontFamily: MONO, fontSize: 14, color: STEEL }}>RAW SOURCES</div>
          </div>

          {/* Arrow 1 */}
          <div style={{ flex: 1, height: 2, background: VIOLET, margin: "0 12px", position: "relative" }} />

          {/* Node 2: AI */}
          <div style={{ width: 240, background: "rgba(139,92,246,0.14)", borderRadius: 20, border: `1px solid ${VIOLET}`, padding: 20, textAlign: "center" }}>
            <Cpu size={28} color={VIOLET} style={{ margin: "0 auto 10px" }} />
            <div style={{ fontFamily: LAT, fontSize: 24, fontWeight: 700, color: WHITE }}>CURATOR</div>
            <div style={{ fontFamily: MONO, fontSize: 14, color: VIOLET }}>IT UNDERSTOOD</div>
          </div>

          {/* Arrow 2 */}
          <div style={{ flex: 1, height: 2, background: BLUE, margin: "0 12px" }} />

          {/* Node 3 */}
          <div style={{ width: 220, background: "rgba(76,141,255,0.14)", borderRadius: 20, border: `1px solid ${BLUE}`, padding: 20, textAlign: "center" }}>
            <CheckCircle2 size={28} color={BLUE} style={{ margin: "0 auto 10px" }} />
            <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700, color: WHITE }}>9</div>
            <div style={{ fontFamily: MONO, fontSize: 14, color: BLUE }}>YOU ACTED</div>
          </div>
        </div>

        {/* Motion Curve Schematic */}
        <div style={{ borderTop: `1px solid ${HAIR}`, paddingTop: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontFamily: MONO, fontSize: 17, color: STEEL }}>cubic-bezier(0.16, 1, 0.3, 1)</div>
            <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: BLUE }}>230 ms</div>
          </div>
          <svg width="880" height="250" viewBox="0 0 880 250" style={{ width: "100%", height: "auto" }}>
            <line x1="60" y1="230" x2="820" y2="230" stroke={HAIR} strokeWidth="2" />
            <line x1="60" y1="40" x2="60" y2="230" stroke={HAIR} strokeWidth="2" />
            <path d="M 60 230 C 180 40, 320 40, 820 40" fill="none" stroke={BLUE} strokeWidth="4" />
            <circle cx={dotX} cy={dotY} r="10" fill={VIOLET} />
          </svg>
        </div>
      </div>

      {/* Color Legend Pills */}
      <div style={{ position: "absolute", left: 64, right: 64, top: 980, display: "flex", gap: 24 }}>
        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BLUE}`, borderRadius: 24, padding: 28, display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 20, height: 20, borderRadius: 10, background: BLUE }} />
          <div>
            <div style={{ fontFamily: LAT, fontSize: 24, fontWeight: 700, color: WHITE }}>BLUE</div>
            <div style={{ fontFamily: MONO, fontSize: 16, color: STEEL }}>YOU ACTED</div>
          </div>
        </div>
        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${VIOLET}`, borderRadius: 24, padding: 28, display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 20, height: 20, borderRadius: 10, background: VIOLET }} />
          <div>
            <div style={{ fontFamily: LAT, fontSize: 24, fontWeight: 700, color: WHITE }}>VIOLET</div>
            <div style={{ fontFamily: MONO, fontSize: 16, color: STEEL }}>IT UNDERSTOOD</div>
          </div>
        </div>
      </div>

      <Sub f={f} i={9} />
      <Sub f={f} i={10} />
      <Sub f={f} i={11} />
      <Sub f={f} i={12} big />
      <Sub f={f} i={13} big />
    </AbsoluteFill>
  );
};

// ── End Card ────────────────────────────────────────────────────────────────
const EndCard: React.FC<{ f: number; startF: number }> = ({ f, startF }) => {
  const op = p(f, startF, startF + 16);
  if (op <= 0.01) return null;
  return (
    <AbsoluteFill style={{ background: INK, opacity: op, alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: LAT, fontSize: 96, fontWeight: 700, color: WHITE, letterSpacing: "0.08em", marginBottom: 20 }}>
          RIVIO
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            background: SURFACE,
            border: `1px solid ${VIOLET}`,
            borderRadius: 99,
            padding: "12px 28px",
            fontFamily: MONO,
            fontSize: 20,
            color: WHITE,
            letterSpacing: "0.14em",
          }}
        >
          <Sparkles size={20} color={VIOLET} />
          BLACK FIRST · YOU'RE EARLY
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const RivioTease: React.FC = () => {
  const f = useCurrentFrame();
  const surfStart = at(5).start_f - 4;
  const craftStart = at(9).start_f - 4;
  const endStart = at(13).end_f + 4;

  return (
    <AbsoluteFill style={{ background: INK }}>
      <NoiseAct f={f} endF={surfStart + 4} />
      <SurfaceAct f={f} startF={surfStart} endF={craftStart + 4} />
      <CraftAct f={f} startF={craftStart} endF={endStart + 4} />
      <EndCard f={f} startF={endStart} />
    </AbsoluteFill>
  );
};
