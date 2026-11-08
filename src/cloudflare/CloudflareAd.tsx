import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Globe, ArcCue, ImpactCue } from "./Globe";
import { Counter, Hair, Kicker, RevealWords } from "./Type";
import { CF, CF_DURATION, TYPE } from "./palette";
import { clamp, easeOutCubic } from "../lib/math";
import { AudioCF } from "./AudioCF";
import { AUTHORED_FPS } from "./timeline";

/**
 * CLOUDFLARE — "ONE NETWORK"
 * =============================================================================
 * 23 seconds, six movements, one continuous object. The globe never cuts away:
 * it ignites, assembles, lights up, "attacks" arrive, it implodes into the logo.
 * Continuity is what makes it read as premium rather than as six separate slides.
 */

const ramp = (f: number, a: number, b: number) => clamp((f - a) / (b - a));

/* ------------------------------- arc schedule ------------------------------ */
/** Great-circle routes, staggered so there is always motion on screen. */
const ARCS: ArcCue[] = [
  { start: 540, dur: 44, a: "london", b: "tokyo" },
  { start: 556, dur: 40, a: "ashburn", b: "frankfurt" },
  { start: 574, dur: 46, a: "singapore", b: "sydney" },
  { start: 592, dur: 42, a: "sanjose", b: "tokyo" },
  { start: 612, dur: 48, a: "dubai", b: "mumbai" },
  { start: 630, dur: 40, a: "saopaulo", b: "santiago" },
  { start: 650, dur: 44, a: "lagos", b: "london" },
  { start: 668, dur: 42, a: "frankfurt", b: "dubai" },
  { start: 690, dur: 46, a: "singapore", b: "mumbai" },
  { start: 710, dur: 40, a: "toronto", b: "london" },
  { start: 728, dur: 44, a: "tokyo", b: "sanjose" },
  { start: 748, dur: 46, a: "sydney", b: "singapore" },
  { start: 768, dur: 42, a: "johannesburg", b: "dubai" },
  { start: 788, dur: 40, a: "mexico", b: "ashburn" },
  { start: 806, dur: 44, a: "cairo", b: "paris" },
  { start: 824, dur: 42, a: "seoul", b: "singapore" },
];

const IMPACTS: ImpactCue[] = [
  { frame: 878, at: "dubai" },
  { frame: 904, at: "tokyo" },
  { frame: 926, at: "saopaulo" },
  { frame: 944, at: "london" },
  { frame: 962, at: "singapore" },
  { frame: 980, at: "sydney" },
  { frame: 1000, at: "frankfurt" },
  { frame: 1014, at: "mumbai" },
  { frame: 1026, at: "ashburn" },
  { frame: 1038, at: "tokyo" },
];

/* --------------------------------- logo ---------------------------------- */

/** Cloudflare-style cloud, drawn as a union of primitives so it scales clean. */
const CloudMark: React.FC<{ size: number; progress: number }> = ({ size, progress }) => {
  const w = size;
  const h = size * 0.7;
  const s = 1 - Math.pow(1 - progress, 3);
  return (
    <svg width={w} height={h} viewBox="0 0 220 150" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="cfg" gradientUnits="userSpaceOnUse" x1="26" y1="10" x2="196" y2="148">
          <stop offset="0%" stopColor="#FFB067" />
          <stop offset="46%" stopColor={CF.orange} />
          <stop offset="100%" stopColor="#C24E0A" />
        </linearGradient>
        <clipPath id="cfclip">
          <rect x="0" y={150 - 150 * s} width="220" height={150 * s} />
        </clipPath>
        <radialGradient id="cfshine" gradientUnits="userSpaceOnUse" cx="70" cy="50" r="130">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g clipPath="url(#cfclip)" fill="url(#cfg)">
        <circle cx="70" cy="88" r="42" />
        <circle cx="119" cy="69" r="54" />
        <circle cx="162" cy="96" r="38" />
        <rect x="52" y="88" width="126" height="48" rx="24" />
      </g>
      <g clipPath="url(#cfclip)">
        <circle cx="70" cy="88" r="42" fill="url(#cfshine)" />
        <circle cx="119" cy="69" r="54" fill="url(#cfshine)" opacity="0.6" />
      </g>
    </svg>
  );
};

/* ------------------------------ frame marks ------------------------------- */

const FrameMarks: React.FC<{ opacity: number }> = ({ opacity }) => {
  const L = 42;
  const inset = 46;
  const c = "rgba(255,255,255,0.22)";
  const corner = (style: React.CSSProperties, horiz: "left" | "right", vert: "top" | "bottom") => (
    <div
      style={{
        position: "absolute",
        width: L,
        height: L,
        [horiz]: inset,
        [vert]: inset,
        borderLeft: horiz === "left" ? `1px solid ${c}` : undefined,
        borderRight: horiz === "right" ? `1px solid ${c}` : undefined,
        borderTop: vert === "top" ? `1px solid ${c}` : undefined,
        borderBottom: vert === "bottom" ? `1px solid ${c}` : undefined,
        ...style,
      }}
    />
  );
  return (
    <AbsoluteFill style={{ opacity, pointerEvents: "none" }}>
      {corner({}, "left", "top")}
      {corner({}, "right", "top")}
      {corner({}, "left", "bottom")}
      {corner({}, "right", "bottom")}
    </AbsoluteFill>
  );
};

/* -------------------------------- scene ---------------------------------- */

export const CloudflareAd: React.FC = () => {
  const raw = useCurrentFrame();
  const { fps } = useVideoConfig();
  // map the real clock onto the authored 60fps timeline
  const frame = raw * (AUTHORED_FPS / fps);
  const afps = AUTHORED_FPS;

  /* --------------------------- continuous object --------------------------- */
  // ignition: dust explodes outward at 200, sphere closes by ~336
  const assemble =
    frame < 200 ? 0 : frame < 336 ? easeOutCubic(ramp(frame, 204, 336)) : 1;

  const spin = 0.55 + Math.max(0, frame - 196) * 0.0037;

  const zoom =
    frame < 300
      ? 1
      : frame < 520
        ? interpolate(frame, [300, 520], [1, 1.12], { extrapolateRight: "clamp" })
        : frame < 850
          ? interpolate(frame, [520, 850], [1.12, 1.02])
          : frame < 1090
            ? interpolate(frame, [850, 1090], [1.02, 1.2])
            : interpolate(frame, [1090, 1140], [1.2, 1.5], { extrapolateRight: "clamp" });

  const cy =
    frame < 850
      ? 880
      : frame < 1090
        ? interpolate(frame, [850, 1060], [880, 800], { extrapolateRight: "clamp" })
        : interpolate(frame, [1090, 1140], [800, 960], { extrapolateRight: "clamp" });

  const collapse = frame < 1090 ? 0 : easeOutCubic(ramp(frame, 1092, 1142));

  const globeOpacity =
    frame < 200 ? 0 : frame < 1116 ? clamp(ramp(frame, 200, 214)) : 1 - clamp(ramp(frame, 1116, 1148));

  const shieldBase =
    frame < 850
      ? 0
      : frame < 1088
        ? 0.2 + 0.8 * (((frame - 856) % 96) / 96)
        : interpolate(frame, [1088, 1100], [0.6, 0], { extrapolateRight: "clamp" });

  /* ------------------------------ transitions ----------------------------- */
  const flashAt = (f: number, power: number, decay = 2.6, color = "#FFFFFF") =>
    frame >= f ? power * Math.exp(-(frame - f) / (decay * 6)) : 0;

  const flash =
    flashAt(200, 0.95, 3.2) +
    flashAt(336, 0.22, 2.2, CF.orangeHot) +
    flashAt(520, 0.3, 2.4, CF.orange) +
    flashAt(850, 0.35, 2.6, CF.orange) +
    flashAt(1090, 0.5, 2.4, CF.orangeHot) +
    flashAt(1132, 1.0, 3.4) +
    flashAt(1250, 0.18, 2.2, CF.orange);

  /* -------------------------------- layout -------------------------------- */
  const safe: React.CSSProperties = {
    position: "absolute",
    left: 96,
    right: 96,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
  };

  const kickerIn = clamp(ramp(frame, 8, 30));
  const kickerOut = 1 - clamp(ramp(frame, 148, 168));
  const kickerA = `${frame < 200 ? "CLOUDFLARE" : frame < 520 ? "EDGE NETWORK" : frame < 850 ? "ANYCAST · 330 POPS" : frame < 1090 ? "SECURITY · ALWAYS ON" : "CLOUDFLARE"}`;

  /* -------------------------------- render -------------------------------- */
  return (
    <AbsoluteFill style={{ background: CF.ink, overflow: "hidden" }}>
      {/* warm ambient bed behind everything — keeps black from going flat */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 46% at 50% ${cy}px, rgba(246,130,31,0.075) 0%, rgba(246,130,31,0.028) 36%, rgba(0,0,0,0) 70%)`,
          opacity: frame < 210 ? 0.5 : 1,
        }}
      />

      {/* ---------------------------- 01 · VOID ---------------------------- */}
      {frame < 214 ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          {/* the hairline that becomes the ignition point */}
          <div
            style={{
              position: "absolute",
              top: cy,
              height: 2,
              width: interpolate(frame, [0, 30, 58, 74], [0, 620, 620, 9], { extrapolateRight: "clamp" }),
              background: `linear-gradient(90deg, transparent, ${CF.orange}, transparent)`,
              boxShadow: `0 0 30px ${CF.orange}, 0 0 90px rgba(246,130,31,0.55)`,
              opacity: 1 - ramp(frame, 196, 212),
            }}
          />
          {/* core dot */}
          {frame > 56 ? (
            <div
              style={{
                position: "absolute",
                top: cy - 5,
                width: 10,
                height: 10,
                borderRadius: 6,
                background: "#FFD9A8",
                boxShadow: `0 0 ${30 + Math.sin(frame / 6) * 12}px 6px rgba(246,130,31,0.85)`,
                opacity: clamp(ramp(frame, 56, 70)) * (1 - ramp(frame, 196, 208)),
              }}
            />
          ) : null}
          {/* pulse rings */}
          {[74, 108, 142, 172].map((p, i) => {
            const t = ramp(frame, p, p + 46);
            if (t <= 0 || t >= 1) return null;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  top: cy,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  border: `1.5px solid ${CF.orange}`,
                  transform: `translateY(0) scale(${1 + t * 34})`,
                  opacity: (1 - t) * 0.55,
                }}
              />
            );
          })}
        </AbsoluteFill>
      ) : null}

      {/* ---------------------------- 02+ · GLOBE --------------------------- */}
      <Globe
        frame={frame}
        assemble={assemble}
        spin={spin}
        tilt={-0.34}
        zoom={zoom}
        cy={cy}
        opacity={globeOpacity}
        arcs={frame >= 520 && frame < 1090 ? ARCS : []}
        impacts={frame >= 860 && frame < 1085 ? IMPACTS : []}
        shield={shieldBase}
        collapse={collapse}
        lights={clamp(ramp(frame, 320, 420)) * (1 - clamp(ramp(frame, 1088, 1100)))}
        sweep={clamp(ramp(frame, 260, 420))}
        intensity={1}
      />

      {/* ------------------------------ KICKER ------------------------------ */}
      {frame < 1250 ? (
        <div style={{ ...safe, top: 150, alignItems: "stretch", opacity: kickerIn * kickerOut }}>
          <Kicker left={kickerA} right={frame < 520 ? "01 / 05" : frame < 850 ? "02 / 05" : "03 / 05"} />
        </div>
      ) : null}

      {/* ---------------------------- 01 · COPY ----------------------------- */}
      {frame >= 90 && frame < 206 ? (
        <AbsoluteFill style={{ paddingTop: 1160, alignItems: "center" }}>
          <RevealWords
            text="خُمس الإنترنت"
            start={86}
            frame={frame}
            size={112}
            color={CF.white}
            exitAt={186}
            stagger={4}
            glow="rgba(255,170,90,0.16)"
          />
          <div style={{ height: 16 }} />
          <RevealWords
            text="يمرّ من هنا"
            start={120}
            frame={frame}
            size={112}
            color={CF.orange}
            exitAt={190}
            stagger={4}
            glow="rgba(246,130,31,0.5)"
          />
        </AbsoluteFill>
      ) : null}

      {/* ---------------------------- 02 · STATS ---------------------------- */}
      {frame >= 330 && frame < 520 ? (
        <div style={{ ...safe, top: 1250, gap: 4 }}>
          <div
            style={{
              width: "100%",
              height: 1,
              background: "linear-gradient(90deg, rgba(246,130,31,0.85), rgba(246,130,31,0))",
              transform: `scaleX(${clamp(ramp(frame, 336, 372))})`,
              transformOrigin: "right",
            }}
          />
          <div style={{ height: 34 }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 22 }}>
            <Counter to={330} start={352} frame={frame} dur={54} size={196} color={CF.white} suffix="+" />
            <span style={{ fontFamily: TYPE.ar, fontSize: 46, fontWeight: 700, color: "rgba(250,250,250,0.62)" }}>مدينة</span>
          </div>
          <div
            style={{
              fontFamily: TYPE.ar,
              fontSize: 40,
              fontWeight: 700,
              color: CF.orangeHot,
              opacity: clamp(ramp(frame, 392, 420)),
              transform: `translateY(${(1 - clamp(ramp(frame, 392, 420))) * 16}px)`,
              marginTop: -6,
            }}
          >
            في أكثر من ١٢٥ دولة
          </div>
          <div style={{ height: 30 }} />
          <div
            style={{
              width: "100%",
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              opacity: clamp(ramp(frame, 452, 492)),
              paddingTop: 22,
              borderTop: "1px solid rgba(255,255,255,0.09)",
            }}
          >
            <span style={{ fontFamily: TYPE.ar, fontSize: 32, fontWeight: 700, color: "rgba(250,250,250,0.42)" }}>
              شبكة متصلة مباشرة
            </span>
            <Counter to={13000} start={452} frame={frame} dur={54} size={62} color="rgba(250,250,250,0.9)" suffix="+" />
          </div>
        </div>
      ) : null}

      {/* ----------------------------- 03 · ARCS ---------------------------- */}
      {frame >= 520 && frame < 860 ? (
        <AbsoluteFill style={{ paddingTop: 1330, alignItems: "center" }}>
          <div style={{ opacity: clamp(ramp(frame, 536, 566)) }}>
            <RevealWords text="٩٥٪ من سكان العالم" start={540} frame={frame} size={82} color={CF.white} stagger={5} exitAt={690} />
          </div>
          <div style={{ height: 22 }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 18, opacity: clamp(ramp(frame, 612, 640)) }}>
            <span style={{ fontFamily: TYPE.ar, fontSize: 56, fontWeight: 700, color: "rgba(250,250,250,0.66)" }}>على بُعد</span>
            <Counter to={50} start={616} frame={frame} dur={44} size={132} color={CF.orange} suffix="ms" />
          </div>
          <div style={{ height: 18 }} />
          <div
            style={{
              fontFamily: TYPE.ar,
              fontSize: 38,
              // 900 is not a style choice here: the Cairo Arabic subset has no
              // ASCII '.', '—' or '%'. Those glyphs only exist in the 800/900
              // Latin face. Painting this at 700 kills the renderer tab.
              fontWeight: 900,
              color: "rgba(250,250,250,0.45)",
              opacity: clamp(ramp(frame, 726, 756)) * (1 - clamp(ramp(frame, 830, 852))),
            }}
          >
            كل طلب يُخدَم من أقرب مدينة، لا رحلة إلى خادم بعيد.
          </div>
        </AbsoluteFill>
      ) : null}

      {/* ----------------------------- 04 · GUARD --------------------------- */}
      {frame >= 850 && frame < 1092 ? (
        <AbsoluteFill style={{ paddingTop: 1230, alignItems: "center" }}>
          <RevealWords text="مليارات الهجمات" start={866} frame={frame} size={92} color={CF.white} stagger={4} exitAt={1010} />
          <div style={{ height: 10 }} />
          <RevealWords text="تُوقَف قبل أن تصل" start={952} frame={frame} size={92} color={CF.orange} stagger={4} glow="rgba(246,130,31,0.4)" />
          <div
            style={{
              marginTop: 34,
              display: "flex",
              alignItems: "center",
              gap: 16,
              opacity: clamp(ramp(frame, 992, 1024)),
            }}
          >
            <div style={{ width: 10, height: 10, background: CF.threat, boxShadow: `0 0 18px ${CF.threat}` }} />
            <span style={{ fontFamily: TYPE.mono, fontSize: 22, letterSpacing: "0.26em", color: "rgba(250,250,250,0.55)" }}>
              THREATS BLOCKED · LIVE
            </span>
          </div>
        </AbsoluteFill>
      ) : null}

      {/* ------------------------------ 05 · LOGO --------------------------- */}
      {frame >= 1108 ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              position: "absolute",
              top: 700,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 34,
            }}
          >
            <div
              style={{
                transform: `scale(${interpolate(spring({ frame: frame - 1124, fps: afps, config: { damping: 11, stiffness: 130, mass: 1.3 }, durationInFrames: 46 }), [0, 1], [0.55, 1])})`,
                filter: `drop-shadow(0 0 ${18 + 14 * (1 - clamp(ramp(frame, 1124, 1200)))}px rgba(246,130,31,0.55))`,
              }}
            >
              <CloudMark size={330} progress={clamp(ramp(frame, 1124, 1160))} />
            </div>
            <div
              style={{
                fontFamily: TYPE.en,
                fontSize: 96,
                fontWeight: 700,
                letterSpacing: `${interpolate(clamp(ramp(frame, 1150, 1200)), [0, 1], [0.34, -0.005])}em`,
                color: CF.white,
                opacity: clamp(ramp(frame, 1150, 1180)),
              }}
            >
              cloudflare
            </div>
          </div>
        </AbsoluteFill>
      ) : null}

      {/* ------------------------------- 06 · CTA --------------------------- */}
      {frame >= 1250 ? (
        <AbsoluteFill style={{ alignItems: "center", paddingTop: 1230 }}>
          <RevealWords text="شبكة واحدة. لكل الإنترنت." start={1256} frame={frame} size={72} color={CF.white} stagger={4} />
          <div style={{ height: 34 }} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              opacity: clamp(ramp(frame, 1296, 1322)),
              transform: `translateY(${(1 - clamp(ramp(frame, 1296, 1322))) * 14}px)`,
            }}
          >
            <div style={{ width: 54, height: 1, background: CF.orange }} />
            <span style={{ fontFamily: TYPE.mono, fontSize: 30, letterSpacing: "0.3em", color: CF.orangeHot }}>CLOUDFLARE.COM</span>
            <div style={{ width: 54, height: 1, background: CF.orange }} />
          </div>
        </AbsoluteFill>
      ) : null}

      {/* --------------------------- global finish -------------------------- */}
      {/* warm flash */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 40% at 50% ${cy}px, #FFF3E4 0%, rgba(246,130,31,0) 70%)`,
          opacity: Math.min(0.8, flash) * 0.7,
        }}
      />

      {/* vignette — pulls the eye to the centre */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse 72% 56% at 50% 46%, rgba(0,0,0,0) 34%, rgba(0,0,0,0.55) 72%, rgba(0,0,0,0.88) 100%)",
        }}
      />

      <FrameMarks opacity={clamp(ramp(frame, 20, 60)) * (1 - clamp(ramp(frame, 1104, 1140)))} />

      {/* end fade */}
      <AbsoluteFill style={{ background: "#000", opacity: clamp(ramp(frame, 1352, CF_DURATION)) }} />

      <AudioCF />
    </AbsoluteFill>
  );
};

export const CF_HUD: React.FC<{ frame: number }> = ({ frame }) => (
  <div style={{ position: "absolute", bottom: 60, width: "100%", display: "flex", justifyContent: "center" }}>
    <Hair progress={1} width={300} opacity={0.15} />
  </div>
);
