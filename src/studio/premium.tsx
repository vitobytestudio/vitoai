/**
 * PREMIUM — the enterprise layer.
 *
 * The worlds build places. This builds *products*: the kind of frame a company
 * like GitHub, Linear or Stripe puts in a launch film. Nothing here is a
 * screenshot and nothing is an image model's guess — every card, chart, heat
 * grid and diff is laid out from real numbers, which is why the type is crisp
 * at any resolution and why the numbers can move.
 *
 * The rules that make it read as premium rather than as a template:
 *   · one 8px grid, one margin (92), one radius (20)
 *   · a hairline instead of a shadow wherever a shadow would be decoration
 *   · type never centred unless it is a single line; everything else hangs left
 *   · motion enters from below by 16–24px, never from the side, never bouncing
 *   · exactly one accent per frame, used on one element
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { MONO, DISP, DW, DH, PAD, rgba, clamp, mix } from "./kit";
import { EASE, display, Grade, cutState, incoming, MotionNumber } from "./craft";
import { PALETTES, type Palette } from "./library";
export type Beat = { kind: "hook" | "repo" | "heat" | "merge" | "diff" | "stats" | "end"; seconds: number; transition?: "cut" | "dissolve" | "whip" | "match" | "dip" };
import { planProduct, planSeconds, type ProductPlan } from "./productplan";
export { planProduct, planSeconds };
export type { ProductPlan };

/* ------------------------------------------------------------------ tokens */

export const T = {
  bg: "#05080C",
  bg2: "#080D14",
  card: "rgba(255,255,255,0.035)",
  line: "rgba(255,255,255,0.10)",
  line2: "rgba(255,255,255,0.055)",
  ink: "#F4F8FD",
  muted: "#8FA0B4",
  dim: "#5C6B7E",
};

const hair = (a = 0.1) => `1px solid rgba(255,255,255,${a})`;

/** every entrance in this file goes through here: up, ease-out, no bounce */
const rise = (f: number, at: number, dur = 18, dist = 22) => {
  const p = EASE.out((f - at) / dur);
  return { opacity: p, transform: `translateY(${(1 - p) * dist}px)` };
};

/* --------------------------------------------------------------- primitives */

export const Footer: React.FC<{ f: number; accent: string; index: number; total: number; label: string }> = ({ f, accent, index, total, label }) => (
  <div style={{ position: "absolute", left: PAD, right: PAD, bottom: 96, opacity: clamp((f - 8) / 16) }}>
    <div style={{ height: 1, background: T.line2, marginBottom: 18 }} />
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: accent, opacity: 0.9 }} />
      <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.26em", color: T.dim, textTransform: "uppercase" }}>{label}</span>
      <span style={{ flex: 1 }} />
      <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.26em", color: T.dim }}>
        {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </span>
    </div>
  </div>
);

export const Kicker: React.FC<{ text: string; f: number; at?: number; accent: string; right?: string }> = ({ text, f, at = 0, accent, right }) => (
  <div style={{ position: "absolute", left: PAD, right: PAD, top: 156, display: "flex", alignItems: "center", gap: 14, ...rise(f, at) }}>
    <span style={{ width: 7, height: 7, borderRadius: 99, background: accent, boxShadow: `0 0 14px ${rgba(accent, 0.8)}` }} />
    <span style={{ fontFamily: MONO, fontSize: 17, letterSpacing: "0.34em", textTransform: "uppercase", color: T.ink }}>{text}</span>
    <span style={{ flex: 1, height: 1, background: T.line }} />
    {right ? <span style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.22em", color: T.dim }}>{right}</span> : null}
  </div>
);

export const Headline: React.FC<{ text: string; f: number; at?: number; size?: number; top?: number; color?: string; width?: number }> = ({
  text,
  f,
  at = 4,
  size = 92,
  top = 236,
  color = T.ink,
  width = DW - PAD * 2,
}) => (
  <div style={{ position: "absolute", left: PAD, top, width, ...display(size, 1.06), fontFamily: DISP, fontWeight: 700, color, ...rise(f, at, 20, 26) }}>
    {text}
  </div>
);

export const Body: React.FC<{ text: string; f: number; at?: number; top: number; width?: number }> = ({ text, f, at = 12, top, width = 720 }) => (
  <div style={{ position: "absolute", left: PAD, top, width, fontFamily: DISP, fontSize: 30, lineHeight: 1.5, letterSpacing: "-0.01em", color: T.muted, ...rise(f, at) }}>
    {text}
  </div>
);

/** the surface every product frame sits on */
export const Card: React.FC<{
  children?: React.ReactNode;
  f: number;
  at?: number;
  left?: number;
  top: number;
  width?: number;
  height?: number;
  accent?: string;
  flat?: boolean;
}> = ({ children, f, at = 6, left = PAD, top, width = DW - PAD * 2, height, accent = "#00FF88", flat }) => (
  <div
    style={{
      position: "absolute",
      left,
      top,
      width,
      height,
      borderRadius: 22,
      background: flat ? "rgba(255,255,255,0.02)" : "linear-gradient(165deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02) 46%, rgba(255,255,255,0.01))",
      border: hair(0.12),
      boxShadow: "0 40px 90px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
      overflow: "hidden",
      ...rise(f, at, 22, 26),
    }}
  >
    {/* a single accent filament along the top edge: the only colour on the card */}
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 2, background: `linear-gradient(90deg, ${rgba(accent, 0.9)}, ${rgba(accent, 0.15)} 42%, rgba(0,0,0,0))` }} />
    {children}
  </div>
);

export const DetailStrip: React.FC<{ f: number; at?: number; top: number; items: string[]; accent: string }> = ({ f, at = 26, top, items, accent }) => (
  <div style={{ position: "absolute", left: PAD, right: PAD, top, display: "flex", gap: 0, ...rise(f, at, 20, 18) }}>
    {items.map((t, i) => (
      <div key={i} style={{ flex: 1, paddingRight: 18, borderLeft: i === 0 ? "none" : `1px solid ${T.line2}`, paddingLeft: i === 0 ? 0 : 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ width: 5, height: 5, borderRadius: 99, background: i === 0 ? accent : T.dim }} />
          <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.24em", textTransform: "uppercase", color: T.dim }}>{`0${i + 1}`}</span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.06em", color: T.muted, lineHeight: 1.5 }}>{t}</div>
      </div>
    ))}
  </div>
);

export const Row: React.FC<{ label: string; value: React.ReactNode; dim?: boolean }> = ({ label, value, dim }) => (
  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "13px 0", borderBottom: `1px solid ${T.line2}` }}>
    <span style={{ fontFamily: MONO, fontSize: 16, letterSpacing: "0.16em", textTransform: "uppercase", color: T.dim }}>{label}</span>
    <span style={{ fontFamily: DISP, fontSize: 26, fontWeight: 600, color: dim ? T.muted : T.ink, fontVariantNumeric: "tabular-nums" }}>{value}</span>
  </div>
);

/* -------------------------------------------------------------- 01 repo card */

export const RepoCard: React.FC<{ f: number; accent: string; owner: string; repo: string; stars: number; forks: number; prs: number }> = ({
  f,
  accent,
  owner,
  repo,
  stars,
  forks,
  prs,
}) => {
  const p = EASE.out((f - 10) / 40);
  return (
    <Card f={f} at={6} top={616} accent={accent}>
      <div style={{ padding: "44px 46px 46px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 26 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: rgba(accent, 0.16), border: `1px solid ${rgba(accent, 0.45)}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 12, height: 12, borderRadius: 99, border: `2px solid ${accent}` }} />
          </div>
          <span style={{ fontFamily: MONO, fontSize: 22, color: T.muted }}>
            {owner} <span style={{ color: T.dim }}>/</span> <span style={{ color: T.ink, fontWeight: 700 }}>{repo}</span>
          </span>
          <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 13, letterSpacing: "0.2em", color: accent, border: `1px solid ${rgba(accent, 0.4)}`, borderRadius: 99, padding: "5px 11px" }}>
            PUBLIC
          </span>
        </div>

        <div style={{ fontFamily: DISP, fontSize: 29, lineHeight: 1.45, color: T.muted, marginBottom: 34 }}>
          The platform teams ship on. Reviews, releases and CI, in one place.
        </div>

        <div style={{ display: "flex", gap: 44 }}>
          {[
            { k: "stars", v: stars },
            { k: "forks", v: forks },
            { k: "pull requests", v: prs },
          ].map((s, i) => (
            <div key={s.k} style={{ opacity: EASE.out((f - 20 - i * 5) / 18) }}>
              <div style={{ fontFamily: DISP, fontSize: 64, fontWeight: 700, color: T.ink, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}>
                {(s.v * p).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: "0.18em", textTransform: "uppercase", color: T.dim, marginTop: 4 }}>{s.k}</div>
            </div>
          ))}
        </div>

        {/* language bar: the small honest detail that makes a card feel real */}
        <div style={{ display: "flex", height: 6, borderRadius: 99, overflow: "hidden", marginTop: 30, gap: 3 }}>
          {[
            [0.62, accent],
            [0.24, "#4D8DFF"],
            [0.14, "#FFB020"],
          ].map(([w, c], i) => (
            <div key={i} style={{ width: `${(w as number) * 100 * p}%`, background: c as string, borderRadius: 99 }} />
          ))}
        </div>
      </div>
    </Card>
  );
};

/* ------------------------------------------------------------ 02 heat grid */

export const HeatGrid: React.FC<{ f: number; accent: string; commits: number; weeks?: number }> = ({ f, accent, commits, weeks = 26 }) => {
  const cols = weeks;
  const rows = 7;
  const cell = 23;
  const gap = 7;
  const filled = clamp((f - 8) / 34);
  return (
    <Card f={f} at={6} top={616} accent={accent}>
      <div style={{ padding: "40px 46px 44px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 22 }}>
          <span style={{ fontFamily: MONO, fontSize: 16, letterSpacing: "0.2em", textTransform: "uppercase", color: T.dim }}>contributions</span>
          <span style={{ fontFamily: DISP, fontSize: 34, fontWeight: 700, color: T.ink, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
            <MotionNumber value={Math.round(commits * filled).toLocaleString()} active={filled < 0.99 ? 1 : 0} size={34} color={T.ink} font={DISP} />
          </span>
        </div>
        <div style={{ display: "flex", gap }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} style={{ display: "flex", flexDirection: "column", gap }}>
              {Array.from({ length: rows }).map((__, r) => {
                const seed = ((c * 7 + r) * 2654435761) % 1000;
                const level = seed / 1000;
                const on = c / cols < filled;
                const lit = on && level > 0.34;
                return (
                  <div
                    key={r}
                    style={{
                      width: cell,
                      height: cell,
                      borderRadius: 3,
                      background: lit ? rgba(accent, 0.25 + level * 0.72) : "rgba(255,255,255,0.05)",
                      boxShadow: lit && level > 0.9 ? `0 0 10px ${rgba(accent, 0.5)}` : undefined,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, fontFamily: MONO, fontSize: 13, letterSpacing: "0.16em", color: T.dim }}>
          <span>MAR</span>
          <span>JUN</span>
          <span>AUG</span>
        </div>
      </div>
    </Card>
  );
};

/* ------------------------------------------------------------- 03 PR merged */

export const MergeCard: React.FC<{ f: number; accent: string; number: number; title: string; author: string; checks: number }> = ({ f, accent, number, title, author, checks }) => {
  const draw = EASE.inOut((f - 14) / 26);
  const merged = f > 44;
  return (
    <Card f={f} at={6} top={616} accent={accent}>
      <div style={{ padding: "40px 46px 44px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 26 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 99,
              background: merged ? accent : "rgba(255,255,255,0.06)",
              border: `1px solid ${merged ? accent : T.line}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${merged ? 1 : 0.86})`,
              boxShadow: merged ? `0 0 40px ${rgba(accent, 0.45)}` : undefined,
            }}
          >
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={merged ? "#04070C" : T.muted} strokeWidth={3}>
              <path d="M4 12.5 L9 17.5 L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: DISP, fontSize: 30, fontWeight: 600, color: T.ink, lineHeight: 1.25, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{title}</div>
            <div style={{ fontFamily: MONO, fontSize: 15, color: T.dim, marginTop: 5 }}>
              #{number} · {author} · {merged ? "merged into main" : "waiting on checks"}
            </div>
          </div>
        </div>

        {/* the branch graph: two lines converging, drawn rather than animated in */}
        <svg width={DW - PAD * 2 - 92} height={132} style={{ display: "block" }}>
          <line x1={18} y1={26} x2={18} y2={112} stroke="rgba(255,255,255,0.16)" strokeWidth={3} />
          <path d={`M18,38 C 96,38 84,86 ${18 + (DW - PAD * 2 - 168) * draw},86`} stroke={accent} strokeWidth={3} fill="none" strokeLinecap="round" />
          {[26, 112, 86].map((y, i) => (
            <circle key={i} cx={18} cy={y} r={7} fill={i === 2 ? accent : "#0A121C"} stroke={i === 2 ? accent : "rgba(255,255,255,0.3)"} strokeWidth={3} />
          ))}
        </svg>

        <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
          {Array.from({ length: checks }).map((_, i) => {
            const on = f > 26 + i * 3;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 99, border: `1px solid ${on ? rgba(accent, 0.4) : T.line}`, background: on ? rgba(accent, 0.1) : "transparent" }}>
                <span style={{ width: 6, height: 6, borderRadius: 99, background: on ? accent : T.dim }} />
                <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.14em", color: on ? T.ink : T.dim }}>CHECK {i + 1}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};

/* ----------------------------------------------------------------- 04 diff */

export const DiffCard: React.FC<{ f: number; accent: string }> = ({ f, accent }) => {
  const lines: Array<[string, "add" | "del" | "ctx" | "meta"]> = [
    ["@@ -12,7 +12,9 @@ export const deploy", "meta"],
    ['  const target = resolve(env, region);', "ctx"],
    ['- if (target.shared) throw new Error("no");', "del"],
    ['+ const plan = await target.provision({', "add"],
    ['+   cores: 192, memory: "768GB", region,', "add"],
    ['+ });', "add"],
    ['  await plan.waitUntilReady();', "ctx"],
    ['- log("done");', "del"],
    ['+ log(`ready in ${plan.elapsed}ms`);', "add"],
    ['  return plan.id;', "ctx"],
  ];
  const shown = Math.floor(clamp((f - 8) / 26) * lines.length);
  return (
    <Card f={f} at={6} top={600} accent={accent}>
      <div style={{ padding: "32px 38px 38px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
            <span key={c} style={{ width: 11, height: 11, borderRadius: 99, background: c, opacity: 0.85 }} />
          ))}
          <span style={{ marginLeft: 10, fontFamily: MONO, fontSize: 15, color: T.dim }}>deploy.ts</span>
          <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 13, color: accent }}>+4 −2</span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 19, lineHeight: 1.8 }}>
          {lines.slice(0, shown).map(([text, kind], i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 14,
                margin: "0 -12px",
                padding: "1px 12px",
                borderRadius: 6,
                background: kind === "add" ? rgba(accent, 0.1) : kind === "del" ? "rgba(255,90,95,0.09)" : "transparent",
                color: kind === "meta" ? "#5FA8FF" : kind === "add" ? "#CFFFE4" : kind === "del" ? "#FFC7C9" : "#9FB0C4",
                whiteSpace: "pre",
                overflow: "hidden",
              }}
            >
              <span style={{ color: T.dim, width: 16, flex: "0 0 16px", textAlign: "right", opacity: 0.7 }}>{i + 1}</span>
              <span style={{ textOverflow: "ellipsis", overflow: "hidden" }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

/* ---------------------------------------------------------------- 05 stats */

export const StatsRow: React.FC<{ f: number; accent: string; items: Array<[string, string]> }> = ({ f, accent, items }) => (
  <div style={{ position: "absolute", left: PAD, right: PAD, top: 760, display: "flex", gap: 20 }}>
    {items.map(([v, k], i) => (
      <div
        key={k}
        style={{
          flex: 1,
          borderRadius: 20,
          border: hair(0.1),
          background: "rgba(255,255,255,0.025)",
          padding: "38px 30px 34px",
          ...rise(f, 8 + i * 5, 20, 24),
        }}
      >
        <div style={{ fontFamily: DISP, fontSize: 74, fontWeight: 700, letterSpacing: "-0.045em", color: i === 0 ? accent : T.ink, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{v}</div>
        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.16em", textTransform: "uppercase", color: T.dim, marginTop: 8, lineHeight: 1.5 }}>{k}</div>
      </div>
    ))}
  </div>
);

/* ---------------------------------------------------------------- 06 logo */

export const EndCard: React.FC<{ f: number; accent: string; cta: string; line: string }> = ({ f, accent, cta, line }) => {
  const s = interpolate(f, [0, 26], [0.94, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `scale(${s})`, opacity: clamp(f / 12), display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: 68, height: 68, borderRadius: 18, border: `2px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 70px ${rgba(accent, 0.35)}` }}>
          <div style={{ width: 22, height: 22, borderRadius: 99, background: accent }} />
        </div>
        <div style={{ marginTop: 30, fontFamily: DISP, fontSize: 54, fontWeight: 700, letterSpacing: "-0.03em", color: T.ink }}>VITO BYTE</div>
        <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 17, letterSpacing: "0.32em", color: T.muted }}>{line}</div>
        <div style={{ marginTop: 34, fontFamily: MONO, fontSize: 15, letterSpacing: "0.28em", color: accent }}>{cta}</div>
      </div>
    </AbsoluteFill>
  );
};

/* --------------------------------------------------------- the film itself */

/* --------------------------------------------------------------- sequencer */

const Hook: React.FC<{ p: ProductPlan; f: number }> = ({ p, f }) => (
  <AbsoluteFill>
    <Kicker text={p.kicker} f={f} at={2} accent={p.accent} right="2026" />
    <Headline text={p.headline} f={f} at={6} size={104} top={280} />
    <Body text={p.sub} f={f} at={22} top={560} />
    <div style={{ position: "absolute", left: PAD, right: PAD, top: 700, height: 1, background: T.line, transform: `scaleX(${EASE.out((f - 26) / 20)})`, transformOrigin: "0 50%" }} />
    <div style={{ position: "absolute", left: PAD, right: PAD, top: 760, display: "flex", gap: 26, opacity: clamp((f - 34) / 16) }}>
      {["REVIEWS", "RELEASES", "CI", "EDGE"].map((t) => (
        <span key={t} style={{ fontFamily: MONO, fontSize: 14, letterSpacing: "0.24em", color: T.dim }}>{t}</span>
      ))}
    </div>
    {/* a measuring rail: the quiet structure that tells the eye where the floor is */}
    <div style={{ position: "absolute", left: PAD, right: PAD, top: 980, height: 420, display: "flex", gap: 2, alignItems: "flex-end", opacity: clamp((f - 20) / 22) }}>
      {Array.from({ length: 48 }).map((_, i) => {
        const h = 30 + Math.abs(Math.sin(i * 0.42)) * 300 + ((i * 17) % 60);
        const on = (i / 48) * 70 < (f - 20) * 1.5;
        const edge = 1 - Math.abs(i / 48 - 0.5) * 1.4;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: h * (0.55 + 0.45 * Math.max(0, edge)),
              background: on ? `linear-gradient(180deg, ${rgba(p.accent, 0.34)}, ${rgba(p.accent, 0.04)})` : "rgba(255,255,255,0.04)",
              borderRadius: 2,
            }}
          />
        );
      })}
    </div>
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 460, background: `radial-gradient(ellipse 64% 100% at 50% 128%, ${rgba(p.accent, 0.16)}, rgba(0,0,0,0) 70%)` }} />
  </AbsoluteFill>
);

export const ProductFilm: React.FC<{ brief?: string; plan?: ProductPlan }> = ({ brief = "github", plan }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = plan || planProduct(brief);

  let acc = 0;
  const marks = p.beats.map((b) => {
    const start = acc;
    const len = Math.round(b.seconds * fps);
    acc += len;
    return { start, len, beat: b };
  });
  const idx = Math.min(marks.length - 1, Math.max(0, marks.findIndex((m) => f >= m.start && f < m.start + m.len)));
  const m = marks[idx];
  const local = f - m.start;
  const prev = idx > 0 ? marks[idx - 1] : null;

  const out = prev ? cutState(prev.beat.transition, local, m.len) : null;
  const into = prev ? incoming(prev.beat.transition, local, m.len) : 1;

  const labels: Record<Beat["kind"], string> = {
    hook: "the claim",
    repo: "the platform",
    heat: "the evidence",
    merge: "the review",
    diff: "the work",
    stats: "the record",
    end: "vitobyte",
  };

  const body = (k: Beat["kind"], fLocal: number) => {
    const inner = (() => {
    switch (k) {
      case "hook":
        return <Hook p={p} f={fLocal} />;
      case "repo":
        return (
          <>
            <Kicker text="the repository" f={fLocal} at={0} accent={p.accent} right="github" />
            <RepoCard f={fLocal} accent={p.accent} owner={p.owner} repo={p.repo} stars={p.stars} forks={p.forks} prs={p.prs} />
            <DetailStrip f={fLocal} top={1290} accent={p.accent} items={["TypeScript 62% · Go 24% · MDX 14%", "2,418 open issues · 91 closed today", "Last release v4.2.0 — 6 hours ago"]} />
          </>
        );
      case "heat":
        return (
          <>
            <Kicker text="the work behind it" f={fLocal} at={0} accent={p.accent} right="last 6 months" />
            <Headline text={"Every day,\nsomeone ships."} f={fLocal} at={4} size={76} top={228} />
            <HeatGrid f={fLocal} accent={p.accent} commits={p.commits} />
            <DetailStrip f={fLocal} top={1350} accent={p.accent} items={["Longest streak 214 days", "1,204 contributors this year", "Median merge 38 minutes"]} />
          </>
        );
      case "merge":
        return (
          <>
            <Kicker text="the review" f={fLocal} at={0} accent={p.accent} right="pull request" />
            <MergeCard f={fLocal} accent={p.accent} number={p.prNumber} title={p.prTitle} author={p.author} checks={p.checks} />
            <DetailStrip f={fLocal} top={1400} accent={p.accent} items={["+412 −38 across 9 files", "2 approvals · 0 unresolved", "Deployed to edge in 94 s"]} />
          </>
        );
      case "diff":
        return (
          <>
            <Kicker text="the code" f={fLocal} at={0} accent={p.accent} right="main ← feat/edge" />
            <DiffCard f={fLocal} accent={p.accent} />
            <DetailStrip f={fLocal} top={1330} accent={p.accent} items={["provision() is idempotent", "Rollback is one revert", "No downtime during cutover"]} />
          </>
        );
      case "stats":
        return (
          <>
            <Kicker text="the record" f={fLocal} at={0} accent={p.accent} />
            <Headline text={"Numbers you\ncan check."} f={fLocal} at={4} size={72} top={240} />
            <StatsRow f={fLocal} accent={p.accent} items={p.stats} />
            <DetailStrip f={fLocal} top={1120} accent={p.accent} items={["Measured across every paid plan", "Independent status page, public", "No scheduled maintenance windows"]} />
          </>
        );
      default:
        return <EndCard f={fLocal} accent={p.accent} cta={p.cta} line="DESIGN · FILM · CODE" />;
    }
    })();
    return (
      <>
        {inner}
        {k === "end" ? null : <Footer f={fLocal} accent={p.accent} index={idx} total={marks.length} label={labels[k]} />}
      </>
    );
  };

  return (
    <AbsoluteFill style={{ background: T.bg }}>
      {/* a single soft light from the top, so black is never flat black */}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 90% 50% at 50% -10%, ${rgba(p.accent, 0.1)}, rgba(0,0,0,0) 60%)` }} />

      {out ? (
        <AbsoluteFill style={{ opacity: out.opacity, transform: out.transform, filter: out.filter }}>
          {body(prev!.beat.kind, prev!.len)}
        </AbsoluteFill>
      ) : null}

      <AbsoluteFill style={{ opacity: into, transform: into < 1 ? `scale(${1.03 - 0.03 * into})` : undefined }}>
        {body(m.beat.kind, local)}
      </AbsoluteFill>

      <Grade f={f} accent={p.accent} amount={0.55} vignette={0.42} />
    </AbsoluteFill>
  );
};
