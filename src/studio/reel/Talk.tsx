/**
 * TALK — motion graphics over a real talking-head clip.
 *
 * Source: 1280×720 · 24 fps · 8.04 s · five shots.
 * Cuts, read off the file itself: 1.958 / 3.500 / 5.042 / 6.417.
 * Speech bursts found in the waveform: 0.76–1.80, 2.08–3.24, 3.64–4.36,
 * 4.56–4.84, 5.12–6.24, 6.52–7.72.
 *
 * Content rule: nothing is invented. The three callouts are the three
 * notifications actually legible on the phone in shot 2 — $29.00 / $15.50 /
 * $15.50 — and the total is their sum.
 *
 * Layout rule: the face is never covered. Everything that is not the
 * full-bleed takeover lives in a designed band above or below the picture
 * window, so type can be large without landing on a face.
 */
import React from "react";
import { AbsoluteFill, Audio, Easing, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";

export const FPS = 30;
export const DURATION = 284; // 8.04 s of picture + a 1.4 s end card

const W = 1080;
const H = 1920;
const INK = "#04060B";
const INK2 = "#0A1020";
const PAPER = "#F4F6FA";
const MINT = "#4FE3B0";
const BLUE = "#7EA2FF";
const AR = '"Cairo", "IBM Plex Sans Arabic", sans-serif';
const LAT = '"Space Grotesk", "Sora", sans-serif';
const MONO = '"JetBrains Mono", monospace';

/** the picture window: 16:9, centred — 656 px of designed band above and below */
const WIN = { x: 0, y: 656, w: 1080, h: 608 };

const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const EX = Easing.bezier(0.16, 1, 0.3, 1);
const EI = Easing.bezier(0.7, 0, 0.84, 0);
const EO = Easing.bezier(0.22, 0.9, 0.24, 1);
const p = (f: number, a: number, b: number, fn: (t: number) => number = EX) => cl(fn(cl((f - a) / Math.max(1, b - a))));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** source seconds → composition frames (the clip is retimed 24 → 30 fps) */
const S = (sec: number) => Math.round(sec * FPS);

const CUTS = [0, S(1.958), S(3.5), S(5.042), S(6.417), S(8.04)];

const Grain: React.FC<{ f: number; o?: number }> = ({ f, o = 0.05 }) => (
  <div
    style={{
      position: "absolute",
      inset: -40,
      opacity: o,
      mixBlendMode: "overlay",
      pointerEvents: "none",
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/></filter><rect width='140' height='140' filter='url(%23n)' opacity='0.55'/></svg>\")",
      backgroundPosition: `${(f * 11) % 140}px ${(f * 7) % 140}px`,
    }}
  />
);

const Rise: React.FC<{ v: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ v, children, style }) => {
  const done = v >= 0.999;
  return (
    <span style={{ display: "block", clipPath: done ? undefined : `inset(-45% -14% ${(1 - v) * 100}% -14%)`, ...style }}>
      <span style={{ display: "block" }}>{children}</span>
    </span>
  );
};

const Tag: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.36em", color: "rgba(244,246,250,0.42)", ...style }}>{children}</div>
);

const Field: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${INK2} 0%, ${INK} 42%, #02040A 100%)` }}>
      <div
        style={{
          position: "absolute",
          left: "20%",
          top: "14%",
          width: "120vmax",
          height: "120vmax",
          transform: "translate(-50%,-50%)",
          background: `radial-gradient(circle, ${MINT}22 0%, transparent 60%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `${70 + Math.sin(t * 0.5) * 8}%`,
          top: `${78 + Math.cos(t * 0.4) * 6}%`,
          width: "110vmax",
          height: "110vmax",
          transform: "translate(-50%,-50%)",
          background: `radial-gradient(circle, ${BLUE}26 0%, transparent 62%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: -40,
          opacity: 0.6,
          backgroundImage:
            "linear-gradient(to right, rgba(244,246,250,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(244,246,250,0.045) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          transform: `translateY(${(f * 0.5) % 80}px)`,
        }}
      />
    </AbsoluteFill>
  );
};

const Picture: React.FC<{ f: number }> = ({ f }) => {
  const takeover = p(f, CUTS[2] - 2, CUTS[2] + 14) * (1 - p(f, CUTS[3] - 16, CUTS[3] - 2));
  const win = {
    x: lerp(WIN.x, 0, takeover),
    y: lerp(WIN.y, 0, takeover),
    w: lerp(WIN.w, W, takeover),
    h: lerp(WIN.h, H, takeover),
    r: lerp(22, 0, takeover),
  };
  const shot = Math.max(0, CUTS.findIndex((c, i) => f >= c && f < CUTS[i + 1]));
  const localShot = f - (CUTS[shot] ?? 0);
  const push = lerp(1, 1.045, cl(localShot / 60));

  return (
    <div
      style={{
        position: "absolute",
        left: win.x,
        top: win.y,
        width: win.w,
        height: win.h,
        borderRadius: win.r,
        overflow: "hidden",
        background: "#000",
        boxShadow: takeover < 0.5 ? "0 40px 120px rgba(0,0,0,0.7)" : undefined,
      }}
    >
      <div style={{ position: "absolute", inset: 0, transform: `scale(${push})` }}>
        <OffthreadVideo src={staticFile("inbox/clip.mp4")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(4,6,11,0.18), transparent 30%, transparent 66%, rgba(4,6,11,0.55))" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 60% at 50% 50%, transparent 40%, rgba(2,4,10,0.55) 100%)" }} />
    </div>
  );
};

const NOTES = [
  { amt: 29, label: "اشتراك شهري", at: S(2.12), tag: "NEW MONTHLY SUBSCRIPTION" },
  { amt: 15.5, label: "عمولة", at: S(2.62), tag: "COMMISSION RECEIVED" },
  { amt: 15.5, label: "عمولة", at: S(3.12), tag: "COMMISSION RECEIVED" },
];

const BandTop: React.FC<{ f: number; o: number }> = ({ f, o }) => {
  const sum = NOTES.reduce((n, x) => n + x.amt * p(f, x.at, x.at + 18, EO), 0);
  const inShot2 = p(f, CUTS[1] - 6, CUTS[1] + 10);
  const shotN = Math.max(1, CUTS.findIndex((c, i) => f >= c && f < CUTS[i + 1]) + 1);

  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: WIN.y, padding: "96px 72px 0", opacity: o }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", opacity: p(f, 6, 24) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 9, height: 9, borderRadius: 9, background: MINT, boxShadow: `0 0 16px ${MINT}`, transform: `scale(${p(f, 8, 22)})` }} />
          <Tag style={{ color: "rgba(244,246,250,0.55)" }}>TAKE 01</Tag>
        </div>
        <Tag>{String(shotN).padStart(2, "0")} / 05</Tag>
      </div>

      <div style={{ marginTop: 54 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
          <span style={{ fontFamily: LAT, fontSize: 150, fontWeight: 700, color: PAPER, letterSpacing: "-0.055em", lineHeight: 0.86 }}>
            ${sum.toFixed(2)}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.3em", color: MINT, paddingBottom: 20 }}>USD</span>
        </div>
        <div style={{ marginTop: 18, height: 1, background: "rgba(244,246,250,0.14)", transform: `scaleX(${p(f, 16, 60)})`, transformOrigin: "0 50%" }} />
      </div>

      <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 20 }}>
        {NOTES.map((n, i) => {
          const on = p(f, n.at, n.at + 14, EO);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 18, opacity: on, transform: `translateX(${(1 - on) * 34}px)` }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: `rgba(79,227,176,${0.16 + 0.1 * on})`,
                  border: `1px solid ${MINT}66`,
                  display: "grid",
                  placeContent: "center",
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: 6, background: MINT, opacity: on }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.28em", color: "rgba(244,246,250,0.5)" }}>{n.tag}</div>
                <div style={{ fontFamily: AR, fontSize: 30, fontWeight: 700, color: PAPER, marginTop: 4, direction: "rtl" }}>{n.label}</div>
              </div>
              <div style={{ fontFamily: LAT, fontSize: 44, fontWeight: 700, color: MINT, letterSpacing: "-0.02em" }}>+${n.amt.toFixed(2)}</div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          right: 96,
          bottom: 8,
          width: 220,
          height: 220,
          borderRadius: "50%",
          border: `2px solid ${MINT}`,
          opacity: inShot2 * 0.5 * (1 - p(f, CUTS[2], CUTS[2] + 20)),
          transform: `scale(${lerp(0.7, 1.6, p(f, CUTS[1], CUTS[2], EI))})`,
        }}
      />
    </div>
  );
};

const BandBottom: React.FC<{ f: number; o: number }> = ({ f, o }) => {
  const beats = [
    { at: CUTS[0], label: "الفكرة" },
    { at: CUTS[1], label: "الإشعارات" },
    { at: CUTS[2], label: "التوزيع" },
    { at: CUTS[3], label: "النتيجة" },
    { at: CUTS[4], label: "الخلاصة" },
  ];
  const i = Math.max(0, CUTS.findIndex((c, k) => f >= c && f < CUTS[k + 1]));
  const beat = beats[i] ?? beats[0];
  const local = f - beat.at;
  const progress = cl(f / S(8.04));

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: WIN.y + WIN.h,
        height: H - (WIN.y + WIN.h),
        padding: "58px 72px 0",
        direction: "rtl",
        opacity: o,
      }}
    >
      <Rise v={p(local, 2, 18)}>
        <div style={{ fontFamily: AR, fontSize: 82, fontWeight: 800, color: PAPER, lineHeight: 1.2 }}>{beat.label}</div>
      </Rise>
      <div style={{ marginTop: 28, display: "flex", gap: 10 }}>
        {beats.map((b, k) => (
          <div key={k} style={{ flex: 1, height: 5, background: "rgba(244,246,250,0.14)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${cl((f - b.at) / ((beats[k + 1]?.at ?? S(8.04)) - b.at)) * 100}%`,
                background: k === i ? MINT : k < i ? "rgba(79,227,176,0.5)" : "transparent",
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between", direction: "ltr" }}>
        <Tag>VITO BYTE · MOTION</Tag>
        <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.18em", color: "rgba(244,246,250,0.5)" }}>{progress.toFixed(2)} / 8.04</div>
      </div>
    </div>
  );
};

const Takeover: React.FC<{ f: number }> = ({ f }) => {
  const a = CUTS[2];
  const b = CUTS[3];
  const local = f - a;
  const v = p(f, a + 2, a + 24, EO);
  const out = p(f, b - 18, b - 4, EI);
  if (v <= 0.001 || out >= 1) return null;
  return (
    <AbsoluteFill style={{ opacity: v * (1 - out), pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(2,4,10,0.82) 0%, rgba(2,4,10,0.24) 26%, transparent 42%, rgba(2,4,10,0.2) 62%, rgba(2,4,10,0.9) 88%, rgba(2,4,10,0.96) 100%)",
        }}
      />
      <div style={{ position: "absolute", left: 0, right: 0, top: 92, textAlign: "center" }}>
        <div style={{ fontFamily: LAT, fontSize: 190, fontWeight: 700, color: PAPER, letterSpacing: "-0.06em", lineHeight: 0.92 }}>$60</div>
        <div style={{ fontFamily: MONO, fontSize: 16, letterSpacing: "0.46em", color: MINT, marginTop: 12, marginRight: "-0.46em" }}>
          IN 3 NOTIFICATIONS
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 96, textAlign: "center", direction: "rtl", padding: "0 56px" }}>
        <Rise v={p(local, 6, 24)}>
          <div style={{ fontFamily: AR, fontSize: 112, fontWeight: 900, color: PAPER, lineHeight: 1.18 }}>توزيع تلقائي</div>
        </Rise>
        <Rise v={p(local, 14, 32)}>
          <div style={{ fontFamily: AR, fontSize: 112, fontWeight: 900, color: MINT, lineHeight: 1.18 }}>على كل اشتراك</div>
        </Rise>
      </div>
      {[0, 1, 2].map((k) => (
        <div
          key={k}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${20 + k * 30}%`,
            width: 1,
            background: `linear-gradient(180deg, transparent, ${k === 1 ? MINT : "rgba(244,246,250,0.3)"}, transparent)`,
            opacity: 0.45,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

const Boot: React.FC<{ f: number }> = ({ f }) => {
  const lift = p(f, 8, 22, EO);
  if (lift >= 1) return null;
  return (
    <AbsoluteFill style={{ background: INK, transform: `translateY(${-100 * lift}%)` }}>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {[0, 1, 2].map((k) => (
            <div
              key={k}
              style={{
                width: 10,
                height: lerp(10, 54, p(f, 2 + k * 2, 10 + k * 2, EO)),
                background: k === 1 ? MINT : PAPER,
                opacity: 0.8,
              }}
            />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const EndCard: React.FC<{ f: number }> = ({ f }) => {
  const a = S(8.04) - 2;
  const local = f - a;
  if (local < 0) return null;
  const v = p(local, 0, 16, EO);
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Field f={f} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: LAT, fontSize: 34, letterSpacing: "0.4em", color: "rgba(244,246,250,0.5)", opacity: v }}>TOTAL</div>
        <div style={{ fontFamily: LAT, fontSize: 240, fontWeight: 700, color: PAPER, letterSpacing: "-0.06em", lineHeight: 0.98, marginTop: 6 }}>
          ${lerp(0, 60, p(local, 2, 26, EO)).toFixed(2)}
        </div>
        <div style={{ width: lerp(0, 420, p(local, 8, 34)), height: 1, background: `${MINT}88`, margin: "30px 0" }} />
        <Rise v={p(local, 14, 34)}>
          <div style={{ fontFamily: AR, fontSize: 54, fontWeight: 800, color: MINT, direction: "rtl" }}>في ثلاث إشعارات.</div>
        </Rise>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 14,
            letterSpacing: "0.42em",
            color: "rgba(244,246,250,0.36)",
            marginTop: 44,
            opacity: p(local, 26, 46),
          }}
        >
          MOTION BY VITO BYTE
        </div>
      </div>
    </AbsoluteFill>
  );
};

export type TalkProps = { score?: string };

export const Talk: React.FC<TalkProps> = ({ score }) => {
  const f = useCurrentFrame();
  const last = [...CUTS].reverse().find((c) => f >= c && c > 0) ?? -99;
  const d = f - last;
  const amp = d < 6 ? 7 * (1 - d / 6) ** 2 : 0;
  const shake = `translate(${Math.sin(d * 2.7) * amp}px, ${Math.cos(d * 3.9) * amp * 0.8}px)`;
  const bloom = d === 0 ? 0.1 : 0;
  const vBands = 1 - p(f, CUTS[2] - 2, CUTS[2] + 10, EO) * (1 - p(f, CUTS[3] - 16, CUTS[3] - 2, EI));

  return (
    <AbsoluteFill style={{ background: INK, overflow: "hidden" }}>
      <Field f={f} />
      <AbsoluteFill style={{ transform: shake }}>
        <Picture f={f} />
        {f < S(8.04) ? (
          <>
            <BandTop f={f} o={vBands} />
            <BandBottom f={f} o={vBands} />
          </>
        ) : null}
        <Takeover f={f} />
      </AbsoluteFill>
      {bloom ? <AbsoluteFill style={{ background: `rgba(244,246,250,${bloom})` }} /> : null}
      <Boot f={f} />
      <EndCard f={f} />
      <Grain f={f} o={0.055} />
      {score && score.length > 32 ? <Audio src={score} /> : null}
      <Audio src={staticFile("inbox/clip.mp4")} volume={1} />
    </AbsoluteFill>
  );
};
