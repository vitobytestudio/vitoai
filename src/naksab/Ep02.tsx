/**
 * NAKSAB — Ep.02 · "الشبكة" (The Network)
 *
 * A different film for the same platform: not the product running, but the
 * idea underneath it, drawn as a diagram. Enterprise-brand grammar: one black
 * field, one blue, one white, technical rulers, fine edges, no chrome.
 *
 *   01  0.0   the network       a talent graph assembles, field by field
 *   02  4.3   matching          one request, four weighted edges, one path
 *   03 11.0   delivery          the milestone chain, the file, two-sided confirm
 *   04 18.7   trust             two circles, one intersection, a proof
 *   05 23.3   the name          the line, the CTA, the address
 *
 * Everything is inside one editorial system: a statement block up top, one
 * diagram on the same stage below it, a hairline ruler at each edge, and one
 * blue wipe at every beat change.
 *
 * Type: Tajawal 800 carries the Arabic voice (not the IBM Plex of Ep.01),
 * Space Grotesk the numerals and English, JetBrains Mono the machine labels.
 *
 * TRAPS honoured (PITFALLS.md): numerals only inside <Num>, ticks drawn as SVG,
 * no ✓ glyph anywhere, no async font in a helper, no backdrop-filter.
 */
import React from "react";
import { AbsoluteFill, Audio, Easing, useCurrentFrame } from "remotion";

export const FPS = 30;
export const DURATION = 870; // 29 s

const W = 1080;
const H = 1920;
const PAD = 76;

const BLACK = "#04060B";
const BLUE = "#2F5BFF";
const WHITE = "#FFFFFF";

const AR_DISP = '"Tajawal", "Space Grotesk", "Cairo", sans-serif';
const AR = '"IBM Plex Sans Arabic", "Space Grotesk", "Cairo", sans-serif';
const DISP = '"Space Grotesk", "Sora", sans-serif';
const MONO = '"JetBrains Mono", monospace';

const ink = (v: number) => `rgba(255,255,255,${v})`;
const blue = (v: number) => `rgba(47,91,255,${v})`;

/* ---------------------------------------------------------------- mechanics */

const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const EASEIO = Easing.bezier(0.7, 0, 0.3, 1);
const EASEOUT = Easing.bezier(0.22, 1, 0.36, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const p = (f: number, a: number, b: number, fn: (t: number) => number = EASE) => cl(fn(cl((f - a) / Math.max(1, b - a))));

/** a check mark, drawn — the U+2713 glyph stalls this font-less renderer */
const Tick: React.FC<{ size?: number; color?: string; width?: number; opacity?: number }> = ({
  size = 16,
  color = BLACK,
  width = 2.2,
  opacity = 1,
}) => (
  <svg width={size} height={size} viewBox="0 0 16 16" style={{ display: "block", opacity }}>
    <path d="M3 8.6 L6.4 12 L13 4.6" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** every numeral: Latin face, LTR, isolated from any Arabic run beside it */
const Num: React.FC<{ children: React.ReactNode; weight?: number; size?: number; style?: React.CSSProperties }> = ({
  children,
  weight = 500,
  size,
  style,
}) => (
  <span
    style={{
      fontFamily: DISP,
      fontWeight: weight,
      direction: "ltr",
      unicodeBidi: "isolate",
      display: "inline-block",
      fontVariantNumeric: "tabular-nums",
      fontSize: size,
      ...style,
    }}
  >
    {children}
  </span>
);

/* ------------------------------------------------------------------- field */
/* a designed lattice, not noise: a 9 × 11 hex-ish grid with seeded jitter */

const mul = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const R = mul(20261103);

type Pt = { x: number; y: number; r: number; z: number; at: number };

const FIELD: Pt[] = (() => {
  const pts: Pt[] = [];
  const cols = 9;
  const rows = 11;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = 132 + i * 102 + (R() - 0.5) * 44;
      const y = 596 + j * 82 + (R() - 0.5) * 38 + (i % 2 ? 20 : 0);
      pts.push({ x, y, r: 2.2 + R() * 2.4, z: R(), at: 8 + i * 3.4 + j * 2.1 });
    }
  }
  return pts;
})();

const LINKS: { a: number; b: number; d: number; at: number }[] = (() => {
  const out: { a: number; b: number; d: number; at: number }[] = [];
  FIELD.forEach((pt, i) => {
    const near = FIELD.map((q, j) => ({ j, d: Math.hypot(q.x - pt.x, q.y - pt.y) }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    near.forEach((o) => {
      if (o.d > 168) return;
      const dup = out.some((e) => (e.a === o.j && e.b === i) || (e.a === i && e.b === o.j));
      if (!dup) out.push({ a: i, b: o.j, d: o.d, at: 16 + Math.min(i, o.j) * 3.2 });
    });
  });
  return out;
})();

const Field: React.FC<{ f: number; op: number; shift: number }> = ({ f, op, shift }) => (
  <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: op }} viewBox={`0 0 ${W} ${H}`}>
    {LINKS.map((e, i) => {
      const a = FIELD[e.a];
      const b = FIELD[e.b];
      const g = p(f, e.at, e.at + 26, EASEIO);
      if (g <= 0) return null;
      return (
        <line
          key={`l${i}`}
          x1={a.x}
          y1={a.y + shift}
          x2={b.x}
          y2={b.y + shift}
          stroke={ink(0.16)}
          strokeWidth={1}
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - g}
        />
      );
    })}
    {FIELD.map((n, i) => {
      const g = p(f, n.at, n.at + 16, EASEOUT);
      if (g <= 0) return null;
      const hot = n.z > 0.9;
      return (
        <g key={`n${i}`}>
          {hot ? <circle cx={n.x} cy={n.y + shift} r={n.r * 5.4} fill={blue(0.1 * g)} /> : null}
          <circle cx={n.x} cy={n.y + shift} r={n.r * g} fill={hot ? BLUE : ink(0.55)} opacity={hot ? 1 : 0.5 + n.z * 0.4} />
        </g>
      );
    })}
  </svg>
);

/* -------------------------------------------------------------------- chrome */

const Ruler: React.FC<{ f: number; side: "l" | "r"; from: number }> = ({ f, side, from }) => {
  const o = p(f, from, from + 24, EASEOUT);
  const x = side === "l" ? 44 : W - 44;
  return (
    <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, opacity: o, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: x, top: 120, bottom: 120, width: 1, background: ink(0.12) }} />
      {Array.from({ length: 26 }).map((_, i) => {
        const y = 120 + i * 66;
        const long = i % 5 === 0;
        const g = p(f, from + i * 1.6, from + i * 1.6 + 12, EASEOUT);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: side === "l" ? x : x - (long ? 16 : 8),
              top: y,
              width: long ? 16 : 8,
              height: 1,
              background: ink(0.22),
              opacity: g,
            }}
          />
        );
      })}
    </div>
  );
};

const Wipe: React.FC<{ f: number; at: number }> = ({ f, at }) => {
  const g = p(f, at, at + 22, EASEIO);
  if (g <= 0 || g >= 1) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: 2,
        background: `linear-gradient(90deg, ${blue(0)}, ${BLUE}, ${blue(0)})`,
        transform: `translateY(${lerp(-40, H + 40, g)}px)`,
        opacity: 0.9,
        boxShadow: `0 0 26px ${blue(0.7)}`,
      }}
    />
  );
};

/* ------------------------------------------------------------------ statement */

type Beat = {
  at: number;
  out: number;
  eyebrow: string;
  l1: string;
  l2: string;
  sub: string;
  size: number;
};

const BEATS: Beat[] = [
  { at: 12, out: 122, eyebrow: "01 · the network", l1: "موهبة في كل مكان،", l2: "بلا خريطة.", sub: "ثمانية مجالات، ومحترفون في كل ولاية. المنصة تربطهم في مكان واحد.", size: 78 },
  { at: 138, out: 322, eyebrow: "02 · matching", l1: "طلبك لا يذهب", l2: "إلى الجميع.", sub: "يُوجَّه إلى من يستطيع تنفيذه، مرتّباً بحسب المهارة والسعر والموعد.", size: 84 },
  { at: 336, out: 548, eyebrow: "03 · delivery", l1: "كل خطوة", l2: "موثقة.", sub: "مراحل واضحة، ملفات مسلّمة، واعتماد لا يكتمل إلا من الطرفين.", size: 92 },
  { at: 562, out: 690, eyebrow: "04 · trust", l1: "الثقة تثبت،", l2: "لا تُكتب.", sub: "التقييم لا يُكتب، بل يُثبت بتسليم معتمد من صاحب المشروع ومنفّذه.", size: 92 },
];

const Statement: React.FC<{ f: number; b: Beat }> = ({ f, b }) => {
  const inA = p(f, b.at, b.at + 20, EASEOUT);
  const outA = p(f, b.out - 22, b.out, EASEIO);
  const o = inA * (1 - outA);
  if (o <= 0) return null;
  const lines = [b.l1, b.l2];
  return (
    <div style={{ position: "absolute", top: 170, left: PAD, right: PAD, opacity: o }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, direction: "ltr" }}>
        <div style={{ width: 34, height: 1, background: BLUE, opacity: 0.9 }} />
        <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: "0.26em", textTransform: "uppercase", color: blue(0.92) }}>{b.eyebrow}</div>
      </div>

      <div style={{ marginTop: 30, direction: "rtl", textAlign: "right" }}>
        {lines.map((t, i) => {
          const g = p(f, b.at + i * 7, b.at + i * 7 + 22, EASEOUT);
          return (
            <div
              key={t}
              style={{
                fontFamily: AR_DISP,
                fontWeight: 800,
                fontSize: b.size,
                lineHeight: 1.34,
                letterSpacing: "-0.015em",
                color: i === 0 ? WHITE : "rgba(255,255,255,0.62)",
                transform: `translateY(${(1 - g) * 26}px)`,
                opacity: g,
                whiteSpace: "nowrap",
              }}
            >
              {t}
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 26,
          direction: "rtl",
          textAlign: "right",
          fontFamily: AR,
          fontSize: 25,
          lineHeight: 1.62,
          color: ink(0.44),
          maxWidth: 800,
          marginRight: "auto",
          opacity: p(f, b.at + 16, b.at + 40, EASEOUT),
          transform: `translateY(${(1 - p(f, b.at + 16, b.at + 40, EASEOUT)) * 12}px)`,
        }}
      >
        {b.sub}
      </div>
    </div>
  );
};

/* --------------------------------------------------------- 02 · the matching */

const CAND = [
  { x: 250, y: 1010, w: 98, name: "أمين", role: "تطوير", at: 186 },
  { x: 486, y: 812, w: 91, name: "سارة", role: "تصميم", at: 200 },
  { x: 742, y: 848, w: 84, name: "ياسين", role: "تجربة", at: 214 },
  { x: 906, y: 1074, w: 71, name: "مهدي", role: "دفع", at: 228 },
];
const REQ = { x: 540, y: 1330 };

const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2 - 70;
  return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
};

const Matching: React.FC<{ f: number }> = ({ f }) => {
  const o = p(f, 150, 176, EASEOUT) * (1 - p(f, 322, 348, EASEIO));
  if (o <= 0) return null;
  const best = CAND[0];
  const pulse = ((f - 210) % 46) / 46;
  const pb = { x: lerp(REQ.x, best.x, pulse), y: lerp(REQ.y, best.y, pulse) - Math.sin(pulse * Math.PI) * 70 };

  return (
    <div style={{ position: "absolute", inset: 0, opacity: o }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }} viewBox={`0 0 ${W} ${H}`}>
        {CAND.map((c, i) => {
          const g = p(f, c.at, c.at + 24, EASEIO);
          if (g <= 0) return null;
          const isBest = i === 0;
          return (
            <path
              key={c.name}
              d={curve(REQ, c)}
              fill="none"
              stroke={isBest ? BLUE : ink(0.18)}
              strokeWidth={isBest ? 2.4 : 1}
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - g}
              style={isBest ? { filter: `drop-shadow(0 0 10px ${blue(0.7)})` } : undefined}
            />
          );
        })}

        {/* the request itself */}
        <g>
          <circle cx={REQ.x} cy={REQ.y} r={58} fill={blue(0.1)} stroke={blue(0.5)} strokeWidth={1} />
          <circle cx={REQ.x} cy={REQ.y} r={10} fill={BLUE} />
          <circle cx={REQ.x} cy={REQ.y} r={8 + pulse * 26} fill="none" stroke={blue(0.35)} strokeWidth={1} opacity={1 - pulse} />
        </g>

        {CAND.map((c, i) => {
          const g = p(f, c.at, c.at + 20, EASEOUT);
          if (g <= 0) return null;
          const isBest = i === 0;
          return (
            <g key={`c${c.name}`}>
              <circle cx={c.x} cy={c.y} r={34 * g} fill={isBest ? BLUE : ink(0.07)} stroke={isBest ? BLUE : ink(0.3)} strokeWidth={1} />
              <circle cx={c.x} cy={c.y} r={7 * g} fill={isBest ? WHITE : ink(0.7)} />
            </g>
          );
        })}

        {/* the pulse travelling the winning edge */}
        {f > 214 ? <circle cx={pb.x} cy={pb.y} r={5} fill={WHITE} opacity={0.9} /> : null}
      </svg>

      {/* the weights, printed at each edge, and the names under the nodes */}
      <div style={{ position: "absolute", inset: 0 }}>
        {CAND.map((c, i) => {
          const g = p(f, c.at + 6, c.at + 26, EASEOUT);
          if (g <= 0) return null;
          const isBest = i === 0;
          return (
            <div key={`lab${c.name}`}>
              <div
                style={{
                  position: "absolute",
                  left: c.x + 40,
                  top: c.y - 16,
                  opacity: g,
                  display: "flex",
                  alignItems: "baseline",
                  gap: 4,
                  direction: "ltr",
                }}
              >
                <Num weight={700} size={isBest ? 30 : 24} style={{ color: isBest ? BLUE : ink(0.5) }}>
                  {c.w}
                </Num>
                <span style={{ fontFamily: MONO, fontSize: 12, color: ink(0.3), letterSpacing: "0.12em" }}>MATCH</span>
              </div>
              <div
                style={{
                  position: "absolute",
                  right: W - c.x + 34,
                  top: c.y + 34,
                  opacity: g,
                  direction: "rtl",
                  fontFamily: AR,
                  fontSize: 21,
                  color: isBest ? ink(0.9) : ink(0.42),
                  whiteSpace: "nowrap",
                }}
              >
                {c.name} · {c.role}
              </div>
            </div>
          );
        })}

        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: REQ.y + 54,
            textAlign: "center",
            opacity: p(f, 168, 190, EASEOUT),
            fontFamily: MONO,
            fontSize: 15,
            letterSpacing: "0.3em",
            color: ink(0.34),
            direction: "ltr",
          }}
        >
          PROJECT REQUEST
        </div>
      </div>
    </div>
  );
};

/* --------------------------------------------------------- 03 · the delivery */

const MILES = [
  { x: 226, n: "01", t: "التصميم", amt: "9,000", at: 372 },
  { x: 540, n: "02", t: "البناء", amt: "17,000", at: 396 },
  { x: 854, n: "03", t: "التسليم", amt: "6,000", at: 420 },
];

const Delivery: React.FC<{ f: number }> = ({ f }) => {
  const o = p(f, 356, 382, EASEOUT) * (1 - p(f, 548, 572, EASEIO));
  if (o <= 0) return null;
  const y = 800;
  const done = p(f, 452, 486, EASE);
  const link1 = p(f, 384, 408, EASEIO);
  const link2 = p(f, 408, 432, EASEIO);
  const fileIn = p(f, 462, 486, EASEOUT);
  const confirm = p(f, 508, 540, EASE);

  return (
    <div style={{ position: "absolute", inset: 0, opacity: o }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }} viewBox={`0 0 ${W} ${H}`}>
        {/* the chain */}
        <line x1={MILES[0].x + 56} y1={y} x2={MILES[1].x - 56} y2={y} stroke={ink(0.16)} strokeWidth={1} />
        <line x1={MILES[0].x + 56} y1={y} x2={lerp(MILES[0].x + 56, MILES[1].x - 56, link1)} y2={y} stroke={BLUE} strokeWidth={2} />
        <line x1={MILES[1].x + 56} y1={y} x2={MILES[2].x - 56} y2={y} stroke={ink(0.16)} strokeWidth={1} />
        <line x1={MILES[1].x + 56} y1={y} x2={lerp(MILES[1].x + 56, MILES[2].x - 56, link2)} y2={y} stroke={ink(0.42)} strokeWidth={2} />

        {MILES.map((m, i) => {
          const g = p(f, m.at, m.at + 18, EASEOUT);
          if (g <= 0) return null;
          const active = i === 0 && done > 0.4;
          return (
            <g key={m.n}>
              <circle cx={m.x} cy={y} r={56} fill={active ? blue(0.12) : "rgba(255,255,255,0.02)"} stroke={active ? BLUE : ink(0.22)} strokeWidth={1.5} opacity={g} />
              <circle cx={m.x} cy={y} r={56 + (active ? 8 + 4 * Math.sin(f * 0.16) : 0)} fill="none" stroke={active ? blue(0.35) : "none"} strokeWidth={1} />
              {active ? (
                <g transform={`translate(${m.x - 11} ${y - 11})`}>
                  <Tick size={22} color={WHITE} width={2.4} />
                </g>
              ) : (
                <text x={m.x} y={y + 6} textAnchor="middle" fontFamily={DISP} fontSize={19} fontWeight={500} fill={ink(0.6)}>
                  {m.n}
                </text>
              )}
            </g>
          );
        })}

        {/* the two-sided confirmation */}
        <g opacity={confirm}>
          <circle cx={452} cy={1348} r={62} fill="none" stroke={ink(0.26)} strokeWidth={1.2} />
          <circle cx={628} cy={1348} r={62} fill="none" stroke={ink(0.26)} strokeWidth={1.2} />
          <circle cx={540} cy={1348} r={62 * confirm} fill={blue(0.16)} stroke={BLUE} strokeWidth={1.4} />
          <line x1={452} y1={1422} x2={452} y2={1458} stroke={ink(0.18)} strokeWidth={1} />
          <line x1={628} y1={1422} x2={628} y2={1458} stroke={ink(0.18)} strokeWidth={1} />
        </g>
      </svg>

      {/* milestone labels, under the chain */}
      {MILES.map((m, i) => {
        const g = p(f, m.at + 8, m.at + 28, EASEOUT);
        if (g <= 0) return null;
        return (
          <div key={`t${m.n}`} style={{ position: "absolute", left: m.x - 106, top: y + 78, width: 212, textAlign: "center", opacity: g }}>
            <div style={{ fontFamily: AR, fontSize: 25, color: i === 0 && done > 0.4 ? WHITE : ink(0.6) }}>{m.t}</div>
            <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", justifyContent: "center", gap: 5, direction: "ltr" }}>
              <Num weight={700} size={22} style={{ color: i === 0 && done > 0.4 ? BLUE : ink(0.4) }}>
                {m.amt}
              </Num>
              <span style={{ fontFamily: AR, fontSize: 16, color: ink(0.32) }}>دج</span>
            </div>
          </div>
        );
      })}

      {/* the delivered file */}
      <div
        style={{
          position: "absolute",
          left: PAD,
          right: PAD,
          top: 1094,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          direction: "rtl",
          opacity: fileIn,
          transform: `translateY(${(1 - fileIn) * 16}px)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 46, height: 58, borderRadius: 4, border: `1px solid ${ink(0.3)}`, position: "relative", background: "rgba(255,255,255,0.03)" }}>
            <div style={{ position: "absolute", left: 8, right: 8, top: 14, height: 1, background: blue(0.8) }} />
            <div style={{ position: "absolute", left: 8, right: 16, top: 24, height: 1, background: ink(0.28) }} />
            <div style={{ position: "absolute", left: 8, right: 12, top: 34, height: 1, background: ink(0.28) }} />
          </div>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 18, color: ink(0.86), direction: "ltr", letterSpacing: "0.02em" }}>store-home.fig</div>
            <div style={{ fontFamily: AR, fontSize: 18, color: ink(0.36), marginTop: 5, direction: "rtl" }}>
              تسليم معتمد، <Num weight={500} size={18}>4.2</Num> ميغابايت
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, opacity: confirm }}>
          <div style={{ width: 26, height: 26, borderRadius: 26, background: BLUE, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Tick size={15} color={WHITE} width={2.4} />
          </div>
          <div style={{ fontFamily: AR, fontSize: 20, color: ink(0.62) }}>اعتماد مزدوج</div>
        </div>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 1470, display: "flex", justifyContent: "center", gap: 118, opacity: confirm, direction: "rtl" }}>
        <div style={{ fontFamily: AR, fontSize: 20, color: ink(0.5) }}>صاحب المشروع</div>
        <div style={{ fontFamily: AR, fontSize: 20, color: ink(0.5) }}>المنفّذ</div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------- 04 · the trust */

const Trust: React.FC<{ f: number }> = ({ f }) => {
  const o = p(f, 576, 602, EASEOUT) * (1 - p(f, 686, 710, EASEIO));
  if (o <= 0) return null;
  const a = p(f, 592, 620, EASEIO);
  const b = p(f, 606, 634, EASEIO);
  const core = p(f, 634, 664, EASE);
  const cy = 1060;
  const r = 232;
  const dx = lerp(150, 92, core);

  return (
    <div style={{ position: "absolute", inset: 0, opacity: o }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }} viewBox={`0 0 ${W} ${H}`}>
        <circle
          cx={540 - dx}
          cy={cy}
          r={r}
          fill={blue(0.06)}
          stroke={ink(0.32)}
          strokeWidth={1.2}
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - a}
        />
        <circle
          cx={540 + dx}
          cy={cy}
          r={r}
          fill={blue(0.06)}
          stroke={ink(0.32)}
          strokeWidth={1.2}
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - b}
        />
        <circle cx={540} cy={cy} r={62 * core} fill={BLUE} opacity={0.92 * core} />
        {/* proof lines: one per confirmed delivery, ticking outward */}
        {Array.from({ length: 9 }).map((_, i) => {
          const g = p(f, 650 + i * 5, 668 + i * 5, EASEOUT);
          if (g <= 0) return null;
          const ang = -Math.PI * 0.86 + (i * Math.PI * 0.72) / 8;
          const x1 = 540 + Math.cos(ang) * 74;
          const y1 = cy + Math.sin(ang) * 74;
          const x2 = 540 + Math.cos(ang) * (74 + 28 * g);
          const y2 = cy + Math.sin(ang) * (74 + 28 * g);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={ink(0.4 * g)} strokeWidth={1} />;
        })}
      </svg>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: cy - 15,
          textAlign: "center",
          opacity: core,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Tick size={34} color={BLACK} width={2.6} />
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: cy + r - 26, display: "flex", justifyContent: "space-between", padding: `0 ${PAD}px`, direction: "rtl", opacity: p(f, 620, 646, EASEOUT) }}>
        <div style={{ fontFamily: AR, fontSize: 24, color: ink(0.72) }}>صاحب المشروع</div>
        <div style={{ fontFamily: AR, fontSize: 24, color: ink(0.72) }}>المنفّذ</div>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: cy + r + 44, textAlign: "center", opacity: p(f, 660, 686, EASEOUT) }}>
        <div style={{ fontFamily: MONO, fontSize: 16, letterSpacing: "0.28em", color: blue(0.85), direction: "ltr" }}>DOUBLE-SIDED CONFIRMATION</div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------- 05 · the name */

const EndCard: React.FC<{ f: number }> = ({ f }) => {
  const o = p(f, 700, 726, EASEOUT);
  if (o <= 0) return null;
  const mark = p(f, 712, 744, EASIOSafe);
  const rule = p(f, 726, 762, EASEIO);
  const tag = p(f, 742, 772, EASEOUT);
  const cta = p(f, 762, 792, EASEOUT);
  const foot = p(f, 786, 814, EASEOUT);
  const pulse = 0.5 + 0.5 * Math.sin((f - 760) * 0.075);

  return (
    <div style={{ position: "absolute", inset: 0, opacity: o }}>
      {/* a fragment of the network stays behind the name, as the callback */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.5 * p(f, 730, 780, EASEIO) }} viewBox={`0 0 ${W} ${H}`}>
        {[
          [70, 1500],
          [190, 1400],
          [150, 1660],
          [330, 1520],
          [280, 1740],
          [430, 1670],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 2 ? 3 : 4.5} fill={i % 3 === 0 ? BLUE : ink(0.4)} />
        ))}
        {[
          [0, 1],
          [0, 2],
          [1, 3],
          [2, 3],
          [2, 4],
          [3, 5],
        ].map(([i, j], k) => {
          const a = [[70, 1500], [190, 1400], [150, 1660], [330, 1520], [280, 1740], [430, 1670]][i];
          const b = [[70, 1500], [190, 1400], [150, 1660], [330, 1520], [280, 1740], [430, 1670]][j];
          return <line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={ink(0.1)} strokeWidth={1} />;
        })}
      </svg>

      {/* the network converges on the name: every node feeds the mark */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <radialGradient id="nameGlow" cx="50%" cy="50%">
            <stop offset="0%" stopColor={blue(0.36)} />
            <stop offset="100%" stopColor={blue(0)} />
          </radialGradient>
        </defs>
        <ellipse cx={540} cy={862} rx={430} ry={230} fill="url(#nameGlow)" opacity={p(f, 740, 800, EASEIO)} />
        {[
          [96, 300], [250, 208], [430, 262], [640, 196], [820, 268], [966, 370],
          [112, 560], [946, 612], [70, 860], [1000, 890], [150, 1120], [930, 1150],
          [300, 1280], [760, 1300],
        ].map(([x, y], i) => {
          const g = p(f, 716 + i * 4, 760 + i * 4, EASEIO);
          if (g <= 0) return null;
          const cx = 540;
          const cy = 862;
          const tx = lerp(x, cx, g);
          const ty = lerp(y, cy, g);
          const fadeLines = 1 - p(f, 800, 850, EASEIO);
          return (
            <g key={i}>
              <line x1={x} y1={y} x2={tx} y2={ty} stroke={i % 4 === 0 ? blue(0.24) : ink(0.08)} strokeWidth={1} opacity={fadeLines} />
              <circle cx={x} cy={y} r={i % 4 === 0 ? 3.6 : 2.4} fill={i % 4 === 0 ? BLUE : ink(0.36)} opacity={g} />
            </g>
          );
        })}
      </svg>

      <div style={{ position: "absolute", left: PAD + 20, right: PAD, top: 742, direction: "rtl", textAlign: "right" }}>
        <div style={{ fontFamily: AR, fontSize: 38, color: ink(0.5), lineHeight: 1.6, opacity: tag }}>سوق العمل، كما ينبغي أن يكون.</div>

        <div
          style={{
            fontFamily: DISP,
            fontSize: 112,
            fontWeight: 700,
            letterSpacing: "0.14em",
            color: WHITE,
            direction: "ltr",
            textAlign: "right",
            marginTop: 40,
            opacity: mark,
            transform: `translateY(${(1 - mark) * 22}px)`,
          }}
        >
          NAKSAB
        </div>

        <div
          style={{
            height: 2,
            width: "100%",
            background: `linear-gradient(270deg, ${blue(1)}, ${blue(0.22)})`,
            transform: `scaleX(${rule})`,
            transformOrigin: "100% 50%",
            marginTop: 26,
          }}
        />

        <div style={{ fontFamily: DISP, fontSize: 23, fontWeight: 500, letterSpacing: "0.05em", color: ink(0.44), marginTop: 26, direction: "ltr", textAlign: "right", opacity: tag }}>
          Hire the right talent, with confidence.
        </div>

        <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 56 }}>
          <div
            style={{
              fontFamily: AR,
              fontSize: 27,
              fontWeight: 500,
              color: WHITE,
              background: BLUE,
              borderRadius: 6,
              padding: "21px 46px",
              opacity: cta,
              transform: `translateY(${(1 - cta) * 14}px)`,
              boxShadow: `0 18px 60px ${blue(0.34 + pulse * 0.12)}`,
            }}
          >
            ابدأ الآن مجاناً
          </div>
        </div>

        <div style={{ height: 1, background: ink(0.1), marginTop: 62, opacity: foot }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, marginTop: 28, opacity: foot, direction: "ltr" }}>
          <div style={{ width: 6, height: 6, borderRadius: 6, background: BLUE, opacity: 0.6 + pulse * 0.4 }} />
          <div style={{ fontFamily: MONO, fontSize: 20, color: ink(0.56), letterSpacing: "0.02em" }}>naksab.vitobytestudio.workers.dev</div>
        </div>

        <div style={{ fontFamily: AR, fontSize: 19, color: ink(0.26), marginTop: 18, direction: "rtl", opacity: foot }}>
          الأسعار بالدينار الجزائري · مجاني خلال الإطلاق
        </div>
      </div>
    </div>
  );
};

/** one slow ease for the wordmark, so the name lands rather than fades */
function EASIOSafe(t: number) {
  return Easing.bezier(0.16, 1, 0.3, 1)(t);
}


const Footer: React.FC<{ f: number }> = ({ f }) => {
  const o = p(f, 26, 52, EASEOUT) * (1 - p(f, 700, 720, EASEIO));
  const marks = [0, 122, 322, 548, 690];
  const seg = Math.max(0, marks.filter((m) => f >= m).length - 1);
  const local = marks[seg + 1] ? cl((f - marks[seg]) / (marks[seg + 1] - marks[seg])) : 1;
  return (
    <div style={{ position: "absolute", left: PAD, right: PAD, bottom: 96, opacity: o }}>
      <div style={{ height: 1, background: ink(0.1), position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: 1,
            width: `${((seg + local) / 4) * 100}%`,
            background: BLUE,
            opacity: 0.9,
          }}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, direction: "ltr" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontFamily: DISP, fontSize: 17, fontWeight: 700, letterSpacing: "0.24em", color: ink(0.62) }}>NAKSAB</div>
          <div style={{ width: 1, height: 14, background: ink(0.16) }} />
          <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.2em", color: ink(0.3) }}>FREELANCE NETWORK · DZ</div>
        </div>
        <div style={{ display: "flex", gap: 7 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ width: i === seg ? 26 : 12, height: 3, borderRadius: 3, background: i <= seg ? BLUE : ink(0.16), opacity: i === seg ? 1 : 0.9 }} />
          ))}
        </div>
      </div>
    </div>
  );
};

/* --------------------------------------------------------------------- film */

const Grid: React.FC<{ f: number }> = ({ f }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      backgroundImage:
        "linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)",
      backgroundSize: "72px 72px",
      maskImage: "radial-gradient(ellipse 84% 70% at 50% 46%, #000 30%, transparent 86%)",
      WebkitMaskImage: "radial-gradient(ellipse 84% 70% at 50% 46%, #000 30%, transparent 86%)",
      opacity: 0.9,
    }}
  />
);

const Glow: React.FC<{ f: number }> = ({ f }) => (
  <div
    style={{
      position: "absolute",
      left: 720 + Math.sin(f * 0.006) * 70,
      top: -300 + Math.cos(f * 0.005) * 60,
      width: 900,
      height: 900,
      borderRadius: "50%",
      background: `radial-gradient(circle, ${blue(0.2)}, ${blue(0.05)} 46%, transparent 70%)`,
    }}
  />
);

const Grain: React.FC<{ f: number }> = ({ f }) => (
  <div
    style={{
      position: "absolute",
      inset: -60,
      opacity: 0.02,
      mixBlendMode: "overlay",
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/></filter><rect width='180' height='180' filter='url(%23n)' opacity='0.9'/></svg>\")",
      backgroundPosition: `${(f * 13) % 180}px ${(f * 29) % 180}px`,
    }}
  />
);

export type Naksab2Props = { score?: string };

export const Naksab02: React.FC<Naksab2Props> = ({ score }) => {
  const f = useCurrentFrame();

  /* the field recedes as the diagrams take the stage, and comes back for the name */
  const fieldOp = lerp(1, 0.2, p(f, 150, 340, EASEIO)) * lerp(1, 0, p(f, 560, 700, EASEIO)) + 0.18 * p(f, 700, 760, EASEIO);
  const shift = lerp(0, -40, p(f, 336, 560, EASEIO));

  return (
    <AbsoluteFill style={{ background: BLACK, overflow: "hidden" }}>
      <Grid f={f} />
      <Glow f={f} />
      <Field f={f} op={fieldOp} shift={shift} />

      {BEATS.map((b) => (
        <Statement key={b.eyebrow} f={f} b={b} />
      ))}

      <Matching f={f} />
      <Delivery f={f} />
      <Trust f={f} />
      <EndCard f={f} />

      <Footer f={f} />
      <Ruler f={f} side="l" from={24} />
      <Ruler f={f} side="r" from={30} />

      <Wipe f={f} at={130} />
      <Wipe f={f} at={332} />
      <Wipe f={f} at={558} />
      <Wipe f={f} at={694} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 96% 78% at 50% 42%, transparent 52%, rgba(0,0,0,0.62) 100%)",
          pointerEvents: "none",
        }}
      />
      <Grain f={f} />
      {score && score.length > 32 ? <Audio src={score} /> : null}
    </AbsoluteFill>
  );
};
