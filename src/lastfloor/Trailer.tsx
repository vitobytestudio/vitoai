/**
 * «الطابق الأخير» — THE LAST FLOOR. A 30 s launch trailer for a horror game on Roblox,
 * built as a toy film: blocky generated figures (studio/blender/scene_toy.py) inside a
 * screen that behaves like the game itself.
 *
 * The structure is the interface. A trailer usually cuts between "cinematic" and "logo";
 * this one never leaves the player's screen: four friends join a server, the floor posts
 * its three rules, the squad counter goes down, and the only thing that breaks the frame
 * is the jump. That is also why the 3D sits inside an inset viewport with a hairline
 * border: it *is* gameplay, and the film's argument is that the game is this good.
 *
 *   0.00  3.07   joining            four slots fill, the counter locks at 4/4
 *   3.07  4.13   the world loads    spawn: loose bricks become four figures
 *   4.13  6.13   rule 01            لا تُطفئ النور
 *   6.13  7.13   first contact      the figure in the doorway
 *   7.13  9.13   rule 02            لا تركض وحدك
 *   9.13 10.40   the sprint         run, toward us, all four
 *  10.40 12.13   the count drops    4/4 → 3/4 → 2/4 → 1/4, one beat each
 *  12.13 13.13   it walks           the same plate, further along
 *  13.13 15.13   rule 03            إن سمعت خطوات خلفك فلا تلتفت
 *  15.13 16.13   the wide           a still, pushed in hard
 *  16.13 17.13   the jump           the face, one second, then black
 *  17.13 19.13   after              the room, the counter, one step we did not earn
 *  19.13 22.13   the name
 *  22.13 25.13   the invitation
 *  25.13 30.00   the mark, and the music box running out of notes
 *
 * Type: Tajawal 800 for the Arabic voice, JetBrains Mono for everything the machine says,
 * Space Grotesk for the English lockup. Colours: near-black, bone, safety orange, ice.
 * Two primaries, the toy's own palette.
 */
import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const FPS = 30;
export const DURATION = 900; // 30.0 s

const W = 1080;
const H = 1920;
const PAD = 64;
const VIEW = 30; // the viewport inset — the "screen" the gameplay lives in

const BLACK = "#05060A";
const BONE = "#F1EDE4";
const ORANGE = "#F26419";
const ICE = "#9CC4FF";

const AR = '"Tajawal", "Space Grotesk", "Cairo", sans-serif';
const MONO = '"JetBrains Mono", "Space Grotesk", monospace';
const DISP = '"Space Grotesk", "Sora", sans-serif';

/* ----------------------------------------------------------------- the timeline */

const T = {
  join: [0, 92],
  spawn: [92, 122],
  rule1: [122, 184],
  contact: [184, 214],
  rule2: [214, 274],
  sprint: [274, 312],
  count: [312, 376],
  walk: [376, 394],
  rule3: [394, 454],
  wide: [454, 484],
  jump: [484, 514],
  after: [514, 574],
  name: [574, 664],
  invite: [664, 754],
  mark: [754, 900],
} as const;

const RULE_KEYS = ["rule1", "rule2", "rule3"] as const;

/**
 * The rules, written as lines rather than strings. The third one is long enough that at the
 * size the short ones need it ran off both edges of a 1080 frame — and clipped Arabic is the
 * one failure this studio does not ship. So a rule is a stack of lines and `arSize` keeps the
 * widest of them inside the safe width, whatever the wording becomes later.
 */
const SAFE_W = 952;          // 1080 minus 64 px of padding on both sides
const AR_EM = 0.58;           // Tajawal 800, measured: an average Arabic glyph is ~0.58 em wide
const arSize = (lines: string[], want: number) =>
  Math.min(want, Math.floor(SAFE_W / (AR_EM * Math.max(...lines.map((l) => l.length)))));

const RULES = [
  { n: "01", ar: ["لا تُطفئ النور."] },
  { n: "02", ar: ["لا تركض وحدك."] },
  { n: "03", ar: ["إن سمعتَ خطواتٍ خلفك,", "فلا تلتفت."] },
];

const SQUAD = [
  { name: "ريان", color: ORANGE },
  { name: "سارة", color: ICE },
  { name: "مهند", color: "#7BC4A3" },
  { name: "لُجين", color: "#C9C3B6" },
];

/* --------------------------------------------------------------------- building */

const ink = (a: number) => `rgba(241,237,228,${a})`;
const spring = (f: number, from: number, to = 1) =>
  interpolate(f, [from, from + 11], [0, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.9)),
  });

/** The counter is the film's clock, so it is drawn once and reused everywhere. */
const Counter: React.FC<{ alive: number; glow?: boolean }> = ({ alive, glow = false }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
    <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: 4, color: ink(0.5) }}>PLAYERS</div>
    <div style={{ display: "flex", gap: 9 }}>
      {[0, 1, 2, 3].map((i) => {
        const on = i < alive;
        return (
          <div
            key={i}
            style={{
              width: 26,
              height: 26,
              borderRadius: 5,
              background: on ? SQUAD[i].color : "rgba(241,237,228,0.07)",
              boxShadow: on && glow ? `0 0 22px ${SQUAD[i].color}55` : "none",
              transition: "none",
            }}
          />
        );
      })}
    </div>
    <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: 2, color: ink(0.86), marginLeft: 6 }}>
      {alive}/4
    </div>
  </div>
);

/** A blocky figure in SVG, on the same 5-unit grid the 3D avatars are built on. */
const Brick: React.FC<{ w: number; color: string; down?: boolean; style?: React.CSSProperties }> = ({
  w,
  color,
  down,
  style,
}) => {
  const u = w / 5;
  return (
    <svg
      width={w}
      height={w * 1.05}
      viewBox="0 0 5 5.25"
      style={{ ...style, transform: down ? "rotate(-90deg)" : style?.transform }}
    >
      <rect x="1.5" y="0.1" width="2" height="2" rx="0.28" fill={color} />
      <rect x="1" y="2.15" width="3" height="1.85" rx="0.2" fill={color} opacity="0.86" />
      <rect x="0.28" y="2.25" width="0.66" height="1.7" rx="0.16" fill={color} opacity="0.7" />
      <rect x="4.06" y="2.25" width="0.66" height="1.7" rx="0.16" fill={color} opacity="0.7" />
      <rect x="1.12" y="4.05" width="1.25" height="1.15" rx="0.14" fill={color} opacity="0.55" />
      <rect x="2.63" y="4.05" width="1.25" height="1.15" rx="0.14" fill={color} opacity="0.55" />
    </svg>
  );
};

/** The studs on top of a brick: the divider, the bullet, the progress rule. */
const Studs: React.FC<{ n: number; size?: number; color?: string; filled?: number }> = ({
  n,
  size = 13,
  color = BONE,
  filled = 1,
}) => (
  <div style={{ display: "flex", gap: size * 0.62 }}>
    {Array.from({ length: n }).map((_, i) => (
      <div
        key={i}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: i < n * filled ? color : "rgba(241,237,228,0.12)",
        }}
      />
    ))}
  </div>
);

/* ------------------------------------------------------------------------ pieces */

/**
 * Grain, and a budget. feTurbulence is computed in *user units*, so the filter raster is
 * authored a quarter the size of the frame and the browser scales it: 16x less work per
 * frame over a 900-frame film, and grain that is a little coarser — which is what a dark
 * 35 mm print actually looks like anyway.
 */
const Grain: React.FC<{ amount: number; seed: number }> = ({ amount, seed }) => (
  <svg width={W / 4} height={H / 4} viewBox={`0 0 ${W / 4} ${H / 4}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: amount, mixBlendMode: "overlay" }}>
    <filter id={`n${seed}`}>
      <feTurbulence type="fractalNoise" baseFrequency="0.24" numOctaves={2} seed={seed} stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width={W / 4} height={H / 4} filter={`url(#n${seed})`} />
  </svg>
);

const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.66 }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background: `radial-gradient(118% 76% at 50% 44%, rgba(0,0,0,0) 36%, rgba(0,0,0,${strength * 0.5}) 68%, rgba(0,0,0,${strength}) 100%)`,
    }}
  />
);

/** The game screen. Everything generated lives inside it, and it is always on. */
const Screen: React.FC<{
  children: React.ReactNode;
  label: string;
  alive: number;
  frameIn: number;
  plate?: string;
  plateFrom?: number;
  dim?: number;
}> = ({ children, label, alive, frameIn, plate, plateFrom = 0, dim = 1 }) => {
  const f = useCurrentFrame() - frameIn;
  const open = interpolate(f, [0, 14], [0.0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // the game "taking the screen": a push in and one flash of the bezel, then it is gone
  const pop = interpolate(f, [0, 16], [1.045, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const flash = interpolate(f, [0, 4, 16], [0.55, 0.35, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: BLACK, padding: PAD }}>
      {/* the screen itself */}
      <div
        style={{
          position: "absolute",
          left: VIEW,
          top: VIEW,
          right: VIEW,
          bottom: VIEW,
          borderRadius: 26,
          overflow: "hidden",
          opacity: open * dim,
          transform: `scale(${pop})`,
          boxShadow: `0 0 0 1px ${ink(0.1 + 0.5 * flash)}, 0 0 ${60 * flash}px ${ORANGE}${Math.round(flash * 90).toString().padStart(2, "0")}, 0 40px 120px rgba(0,0,0,0.7)`,
          background: "#020305",
        }}
      >
        {plate ? (
          <Sequence from={frameIn} durationInFrames={900 - frameIn}>
            <div style={{ position: "absolute", inset: 0, transform: "scale(1.02)" }}>
              <OffthreadVideo
                src={staticFile(plate)}
                startFrom={plateFrom}
                style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.9) contrast(1.05)" }}
                muted
              />
            </div>
          </Sequence>
        ) : null}
        {children}
        <Vignette strength={0.5} />
      </div>

      {/* the HUD lives outside the screen edge, on the bezel */}
      <div
        style={{
          position: "absolute",
          left: PAD,
          right: PAD,
          top: PAD - 6,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          opacity: open,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontFamily: MONO, fontSize: 20, letterSpacing: 5, color: ORANGE }}>LF-13</span>
          <span style={{ fontFamily: MONO, fontSize: 20, letterSpacing: 3, color: ink(0.42) }}>{label}</span>
        </div>
        <Counter alive={alive} glow />
      </div>
    </AbsoluteFill>
  );
};

const Join: React.FC = () => {
  const f = useCurrentFrame();
  const slots = [0, 1, 2, 3].map((i) => spring(f, 16 + i * 18));
  const lock = interpolate(f, [80, 88], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: BLACK, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
        <div style={{ fontFamily: MONO, fontSize: 23, letterSpacing: 9, color: ink(0.44) }}>JOINING SERVER</div>
        <div style={{ display: "flex", gap: 44 }}>
          {SQUAD.map((s, i) => (
            <div key={s.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div style={{ height: 128, display: "flex", alignItems: "flex-end", opacity: slots[i], transform: `translateY(${(1 - slots[i]) * -46}px)` }}>
                <Brick w={128} color={s.color} />
              </div>
              <div style={{ fontFamily: AR, fontSize: 30, fontWeight: 800, color: ink(0.62 * slots[i]), whiteSpace: "normal", textAlign: "center" }}>
                {s.name}
              </div>
            </div>
          ))}
        </div>
        <div style={{ height: 1, width: 660, background: ink(0.12), position: "relative", marginTop: 18 }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: 1, width: 660 * Math.min(1, f / 74), background: ORANGE }} />
        </div>
        <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: 4, color: ink(0.5 + 0.4 * lock), opacity: 0.35 + 0.65 * lock }}>
          {f < 74 ? "LOADING 13TH FLOOR" : "4/4  ·  CONNECTED"}
        </div>
        <div style={{ position: "absolute", bottom: 96 }}>
          <Studs n={9} size={10} filled={Math.min(1, f / 80)} color={ink(0.5)} />
        </div>
      </div>
      <Grain amount={0.022} seed={f % 3} />
    </AbsoluteFill>
  );
};

const Rule: React.FC<{ i: 0 | 1 | 2; inFrame: number }> = ({ i, inFrame }) => {
  // mounted, not sequenced: the component owns its own zero
  const f = useCurrentFrame() - inFrame;
  const len = T[RULE_KEYS[i]][1] - inFrame;
  const life = interpolate(f, [0, 13], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const out = interpolate(f, [len - 8, len], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rise = interpolate(f, [0, 20], [26, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const flick = f % 17 === 0 || f % 29 === 0 ? 0.35 : 1;
  return (
    <AbsoluteFill style={{ backgroundColor: BLACK, alignItems: "center", justifyContent: "center" }}>
      <div
        dir="rtl"
        lang="ar"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 34,
          opacity: life * out,
          transform: `translateY(${rise}px)`,
          padding: `0 ${PAD}px`,
          width: "100%",
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: 12, color: ORANGE, opacity: flick }}>
          RULE {RULES[i].n}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "100%" }}>
          {RULES[i].ar.map((line) => (
            <div
              key={line}
              style={{
                fontFamily: AR,
                fontWeight: 800,
                fontSize: arSize(RULES[i].ar, 100),
                lineHeight: 1.18,
                color: BONE,
                textAlign: "center",
                maxWidth: `${SAFE_W}px`,
                whiteSpace: "normal",
              }}
            >
              {line}
            </div>
          ))}
        </div>
        <Studs n={7} size={12} filled={i === 2 ? 1 : 0.57} color={ink(0.45)} />
      </div>
      <Grain amount={0.02} seed={f % 3} />
    </AbsoluteFill>
  );
};

/** The count going down: the only cut in the film that is allowed to be violent. */
const CountDown: React.FC = () => {
  const f = useCurrentFrame();
  const alive = 4 - Math.min(3, Math.floor(f / 17));
  const kick = 1 - ((f % 17) / 17) * 0.5;
  return (
    <AbsoluteFill style={{ backgroundColor: BLACK, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 54 }}>
        <div style={{ display: "flex", gap: 40 }}>
          {SQUAD.map((s, i) => (
            <div key={s.name} style={{ opacity: i < alive ? 1 : 0.16, transform: i < alive ? "none" : "translateY(30px)", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <Brick w={108} color={s.color} down={i >= alive} />
              <div style={{ fontFamily: AR, fontSize: 24, fontWeight: 800, color: ink(i < alive ? 0.6 : 0.22), whiteSpace: "normal" }}>{s.name}</div>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 132, letterSpacing: 8, color: ink(0.9), transform: `scale(${kick})`, textIndent: 8 }}>
          {alive}/4
        </div>
        <div style={{ fontFamily: MONO, fontSize: 21, letterSpacing: 6, color: ORANGE, opacity: alive === 1 ? 1 : 0.45 }}>
          {alive === 1 ? "ONE PLAYER LEFT" : "PLAYERS DISCONNECTED"}
        </div>
      </div>
      <Grain amount={0.024} seed={f % 3} />
    </AbsoluteFill>
  );
};

/** Gameplay overlaid with the in-world text the game itself would post. */
const InGame: React.FC<{ children: React.ReactNode; from: number; to: number; tag?: string }> = ({ children, from, to, tag }) => {
  const f = useCurrentFrame();
  const t = Math.min(1, Math.max(0, (f - from) / Math.max(1, to - from)));
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 150 }}>
      <div
        dir="rtl"
        lang="ar"
        style={{
          fontFamily: AR,
          fontWeight: 800,
          fontSize: 56,
          maxWidth: `${SAFE_W}px`,
          textAlign: "center",
          whiteSpace: "normal",
          color: ink(0.92 - 0.3 * t),
          opacity: interpolate(f - from, [0, 6, Math.max(7, to - from - 6), to - from], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          textShadow: "0 6px 34px rgba(0,0,0,0.85)",
          transform: `translateY(${interpolate(f - from, [0, 7], [14, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) })}px)`,
        }}
      >
        {children}
      </div>
      {tag ? (
        <div style={{ fontFamily: MONO, fontSize: 19, letterSpacing: 6, color: ink(0.4), marginTop: 14, textAlign: "center" }}>{tag}</div>
      ) : null}
    </AbsoluteFill>
  );
};

const Name: React.FC = () => {
  const f = useCurrentFrame();
  const life = interpolate(f, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const word = interpolate(f, [4, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const breathe = 1 + 0.008 * Math.sin((f / 90) * Math.PI * 2);
  return (
    <AbsoluteFill style={{ backgroundColor: BLACK, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30, opacity: life, transform: `scale(${breathe})` }}>
        <Studs n={5} size={14} filled={word} color={ORANGE} />
        <div
          dir="rtl"
          lang="ar"
          style={{
            fontFamily: AR,
            fontWeight: 800,
            fontSize: arSize(["الطابق الأخير"], 120),
            lineHeight: 1.05,
            color: BONE,
            textAlign: "center",
            maxWidth: `${SAFE_W}px`,
            whiteSpace: "normal",
            transform: `translateY(${(1 - word) * 30}px)`,
          }}
        >
          الطابق الأخير
        </div>
        <div style={{ fontFamily: DISP, fontSize: 27, fontWeight: 700, letterSpacing: 15, color: ink(0.5), textIndent: 15, whiteSpace: "nowrap" }}>
          THE LAST FLOOR
        </div>
      </div>
      <Grain amount={0.02} seed={f % 3} />
    </AbsoluteFill>
  );
};

const Invite: React.FC = () => {
  const f = useCurrentFrame();
  const life = interpolate(f, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pulse = 0.72 + 0.28 * Math.sin((f / 90) * Math.PI * 2 * 1.6);
  return (
    <AbsoluteFill style={{ backgroundColor: BLACK, alignItems: "center", justifyContent: "center", gap: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 44, opacity: life }}>
        <div dir="rtl" lang="ar" style={{ fontFamily: AR, fontWeight: 800, fontSize: arSize(["أربع مقاعد. طابق واحد."], 76), color: BONE, maxWidth: `${SAFE_W}px`, textAlign: "center", whiteSpace: "normal" }}>
          أربع مقاعد. طابق واحد.
        </div>
        <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: 6, color: ink(0.45), whiteSpace: "nowrap" }}>
          SURVIVE 03:00 — UNLOCK FLOOR 14
        </div>
        <div
          style={{
            marginTop: 22,
            padding: "26px 46px",
            borderRadius: 16,
            border: `1px solid ${ORANGE}`,
            boxShadow: `0 0 60px ${ORANGE}22, inset 0 0 40px ${ORANGE}12`,
            opacity: pulse,
          }}
        >
          <div dir="rtl" lang="ar" style={{ fontFamily: AR, fontWeight: 800, fontSize: 40, color: ORANGE, whiteSpace: "nowrap" }}>
            انضم الآن
          </div>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: 5, color: ink(0.34) }}>قريباً · ROBLOX</div>
      </div>
      <Grain amount={0.02} seed={f % 3} />
    </AbsoluteFill>
  );
};

/**
 * The button. A trailer should not end on a logo floating in black — it should end on the
 * promise, answered: the corridor comes back as a ghost behind the mark, the four seats are
 * shown empty, and the server closes. Everything here is bigger than a signature has any right
 * to be, because the last four seconds are the ones a phone viewer is still looking at.
 */
const Mark: React.FC<{ inFrame: number }> = ({ inFrame }) => {
  const raw = useCurrentFrame();
  const f = raw - inFrame;
  const len = DURATION - inFrame;
  const inA = interpolate(f, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const outA = interpolate(f, [len - 26, len - 4], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const die = 4 - Math.min(4, Math.floor((f - 26) / 20));
  const ghost = interpolate(f, [0, 26, len], [0.055, 0.14, 0.02], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: BLACK, alignItems: "center", justifyContent: "center" }}>
      {/* the floor, remembered */}
      <img
        src={staticFile("plates/lf-hero.jpg")}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: ghost,
          filter: "grayscale(0.45) brightness(1.1)",
          transform: `scale(${1.04 + 0.05 * (f / len)})`,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 42, opacity: inA * outA }}>
        <div style={{ fontFamily: MONO, fontSize: 46, fontWeight: 700, letterSpacing: 34, color: ink(0.9), textIndent: 34, whiteSpace: "nowrap" }}>
          VITO
        </div>
        <div style={{ height: 1, width: 460, background: `linear-gradient(90deg, ${ink(0)}, ${ink(0.26)}, ${ink(0)})` }} />
        <div dir="rtl" lang="ar" style={{ fontFamily: AR, fontSize: 34, fontWeight: 800, color: ink(0.46), whiteSpace: "normal", textAlign: "center" }}>
          صناعة إعلانات للألعاب
        </div>
        <div style={{ marginTop: 30, transform: "scale(1.7)", transformOrigin: "center" }}>
          <Counter alive={Math.max(0, die)} glow={die > 0} />
        </div>
        <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: 8, color: die === 0 ? ORANGE : ink(0.28), marginTop: 34 }}>
          {die === 0 ? "SERVER CLOSED" : "RECONNECTING\u2026"}
        </div>
      </div>
      <Grain amount={0.024} seed={raw % 3} />
      <Vignette strength={0.7} />
    </AbsoluteFill>
  );
};

/* --------------------------------------------------------------------------- film */

export const LastFloor: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  void fps;

  const at = (k: keyof typeof T) => frame >= T[k][0] && frame < T[k][1];
  const alive = frame < T.count[0] ? 4 : frame < T.count[0] + 17 ? 3 : frame < T.count[0] + 34 ? 2 : 1;
  // (the count section holds on the last figure for 30 frames — the room after the third loss)
  const shake = at("jump") ? 1 + 0.06 * Math.abs(Math.sin(frame * 1.7)) : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: BLACK, fontFamily: AR }}>
      {at("join") ? <Join /> : null}

      {at("spawn") ? (
        <Screen label="SPAWN · 13F" alive={4} frameIn={T.spawn[0]} plate="plates/lf-spawn.mp4">
          <InGame from={T.spawn[0]} to={T.spawn[1]} tag="SERVER 13 · NIGHT MODE">
            وصل الفريق
          </InGame>
        </Screen>
      ) : null}

      {at("rule1") ? <Rule i={0} inFrame={T.rule1[0]} /> : null}

      {at("contact") ? (
        <Screen label="13F · CORRIDOR" alive={4} frameIn={T.contact[0]} plate="plates/lf-stalk.mp4">
          <InGame from={T.contact[0]} to={T.contact[1]} tag="MOTION DETECTED">
            هناك شيء في الباب
          </InGame>
        </Screen>
      ) : null}

      {at("rule2") ? <Rule i={1} inFrame={T.rule2[0]} /> : null}

      {at("sprint") ? (
        <Screen label="13F · RETREAT" alive={4} frameIn={T.sprint[0]} plate="plates/lf-run.mp4">
          <InGame from={T.sprint[0]} to={T.sprint[1]} tag="STAMINA 21%">
            اركضوا. الآن.
          </InGame>
        </Screen>
      ) : null}

      {at("count") ? <CountDown /> : null}

      {at("walk") ? (
        <Screen label="13F · CORRIDOR" alive={1} frameIn={T.walk[0]} plate="plates/lf-stalk.mp4" plateFrom={12} dim={0.9}>
          <InGame from={T.walk[0]} to={T.walk[1]} tag="IT IS CLOSER">
            لا تلتفت
          </InGame>
        </Screen>
      ) : null}

      {at("rule3") ? <Rule i={2} inFrame={T.rule3[0]} /> : null}

      {at("wide") ? (
        <Screen label="13F · THE END OF THE HALL" alive={1} frameIn={T.wide[0]} dim={1}>
          <img src={staticFile("plates/lf-hero.jpg")} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1 + 0.1 * ((frame - T.wide[0]) / 30)})`, filter: "saturate(0.9) contrast(1.05)" }} />
        </Screen>
      ) : null}

      {at("jump") ? (
        <AbsoluteFill style={{ backgroundColor: BLACK, transform: `scale(${shake})` }}>
          <img
            src={staticFile("plates/lf-face.jpg")}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${1.02 + 0.34 * ((frame - T.jump[0]) / 30)})`,
              filter: `contrast(1.25) brightness(${0.9 + 0.5 * Math.abs(Math.sin(frame * 2.3))})`,
            }}
          />
          <div style={{ position: "absolute", inset: 0, background: ORANGE, opacity: frame - T.jump[0] < 3 ? 0.5 : 0 }} />
          <Grain amount={0.05} seed={frame % 2} />
        </AbsoluteFill>
      ) : null}

      {at("after") ? (
        <AbsoluteFill style={{ backgroundColor: BLACK, alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 34, opacity: 0.9 }}>
            <div dir="rtl" lang="ar" style={{ fontFamily: AR, fontWeight: 800, fontSize: 62, color: ink(0.86), maxWidth: `${SAFE_W}px`, textAlign: "center", whiteSpace: "normal" }}>
              بقيتَ وحدك.
            </div>
            <Counter alive={1} />
            <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: 7, color: ink(0.34), marginTop: 18 }}>
              03:00 — 02:41 — 02:19 …
            </div>
          </div>
          <Grain amount={0.03} seed={frame % 3} />
        </AbsoluteFill>
      ) : null}

      {at("name") ? <Name /> : null}
      {at("invite") ? <Invite /> : null}
      {at("mark") ? <Mark inFrame={T.mark[0]} /> : null}
    </AbsoluteFill>
  );
};
