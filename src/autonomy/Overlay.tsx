/**
 * Everything with type in it. Each card is pinned to a point in the same 3D
 * space as the geometry, so it scales and fades with depth and slides past the
 * camera instead of being pasted onto the frame.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { V, F } from "../vito/palette";
import {
  camZ,
  camY,
  camRoll,
  camSpeed,
  proj,
  depthA,
  clamp,
  win,
  out,
  lerp,
  LETTERS,
  Letter,
  END_Z,
  W,
  H,
} from "./space";

/* -------------------------------------------------------------------------- */

const At: React.FC<{
  x: number;
  y: number;
  z: number;
  cz: number;
  cy: number;
  opacity: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ x, y, z, cz, cy, opacity, children, style }) => {
  if (opacity <= 0.002) return null;
  const p = proj(x, y, z, cz, cy);
  if (p.d <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: p.x,
        top: p.y,
        transform: `translate(-50%,-50%) scale(${p.s.toFixed(4)})`,
        transformOrigin: "50% 50%",
        opacity,
        willChange: "transform, opacity",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const Mono: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  tracking?: string;
  style?: React.CSSProperties;
}> = ({ children, size = 15, color = V.muted, tracking = "0.22em", style }) => (
  <div
    style={{
      fontFamily: F.mono,
      fontSize: size,
      color,
      letterSpacing: tracking,
      textTransform: "uppercase",
      lineHeight: 1,
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {children}
  </div>
);

/** counts up to a number, or simply resolves if the value is not numeric */
const Hero: React.FC<{
  value: string;
  unit: string;
  f: number;
  at: number;
}> = ({ value, unit, f, at }) => {
  const target = Number(value.replace(/,/g, ""));
  const numeric = Number.isFinite(target) && /^[\d,]+$/.test(value);
  const p = win(f, at + 16, at + 46);
  const shown = numeric ? Math.round(target * p) : 0;
  const txt = numeric ? shown.toLocaleString("en-US") : value;
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <div
        style={{
          fontFamily: F.display,
          fontSize: 128,
          fontWeight: 700,
          letterSpacing: "-0.045em",
          lineHeight: 0.92,
          color: V.green,
          fontVariantNumeric: "tabular-nums",
          opacity: numeric ? 1 : win(f, at + 16, at + 40),
        }}
      >
        {txt}
      </div>
      {unit ? (
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 40,
            fontWeight: 500,
            color: V.green,
            letterSpacing: "0.04em",
            opacity: 0.85,
          }}
        >
          {unit}
        </div>
      ) : null}
    </div>
  );
};

/* -------------------------------------------------------------------------- */

const Card: React.FC<{ L: Letter; f: number; cz: number; cy: number }> = ({
  L,
  f,
  cz,
  cy,
}) => {
  const d = L.z + 210 - cz;
  const a =
    depthA(d) *
    clamp((2450 - d) / 700) *
    clamp((d - 420) / 300) *
    win(f, L.at - 12, L.at + 16) *
    out(f, 1545, 1650);

  const opposite = L.side * -1;
  return (
    <At x={opposite * 200} y={470} z={L.z + 210} cz={cz} cy={cy} opacity={a}>
      <div
        style={{
          width: 470,
          padding: "44px 38px 42px",
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(5,11,20,0.94) 0%, rgba(5,11,20,0.86) 48%, rgba(5,11,20,0) 78%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 7, height: 7, background: V.green }} />
          <Mono size={15} color={V.green} tracking="0.3em">
            {L.kicker}
          </Mono>
        </div>

        <div style={{ height: 1, background: "rgba(120,200,255,0.22)", margin: "22px 0 26px" }} />

        <div
          style={{
            fontFamily: F.display,
            fontSize: 52,
            fontWeight: 600,
            lineHeight: 1.08,
            letterSpacing: "-0.025em",
            color: V.white,
            whiteSpace: "pre-line",
          }}
        >
          {L.title}
        </div>

        <div style={{ marginTop: 30 }}>
          <Hero value={L.hero} unit={L.unit} f={f} at={L.at} />
        </div>

        <Mono size={15} color={V.muted} tracking="0.1em" style={{ marginTop: 20, whiteSpace: "normal", lineHeight: 1.45 }}>
          {L.sub}
        </Mono>
      </div>
    </At>
  );
};

/* -------------------------------------------------------------------------- */

const Hud: React.FC<{ f: number; cz: number }> = ({ f, cz }) => {
  const boot = out(f, 96, 132);
  const line = "> open ./autonomy";
  const typed = Math.floor(clamp((f - 6) / 46) * line.length);

  return (
    <>
      {/* ruler: the clearest proof that this is one continuous take */}
      <div style={{ position: "absolute", left: 34, top: 300, width: 40, height: 1320, overflow: "hidden" }}>
        {Array.from({ length: 30 }).map((_, i) => {
          const y = ((i * 46 - (cz % 46) - (cz * 0.35) % 1) + 1320) % 1320;
          const big = i % 5 === 0;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 0,
                top: y,
                width: big ? 22 : 11,
                height: 1,
                background: big ? "rgba(120,200,255,0.34)" : "rgba(120,200,255,0.16)",
              }}
            />
          );
        })}
      </div>

      <div style={{ position: "absolute", left: 46, top: 74 }}>
        <Mono size={16} color={V.white} tracking="0.34em">
          vito byte
        </Mono>
        <Mono size={12} color={V.dim} tracking="0.3em" style={{ marginTop: 9 }}>
          one shot / no cuts
        </Mono>
      </div>

      <div style={{ position: "absolute", right: 46, top: 74, textAlign: "right" }}>
        <Mono size={12} color={V.dim} tracking="0.3em">
          depth
        </Mono>
        <Mono size={19} color={V.green} tracking="0.08em" style={{ marginTop: 8 }}>
          {`z ${String(Math.round(cz)).padStart(4, "0")}`}
        </Mono>
      </div>

      {/* boot line — it hands over to the depth readout, it is not a cutaway */}
      <div
        style={{
          position: "absolute",
          left: 46,
          bottom: 128,
          opacity: boot,
          display: "flex",
          alignItems: "center",
          gap: 3,
        }}
      >
        <Mono size={17} color={V.green} tracking="0.04em">
          {line.slice(0, typed)}
        </Mono>
        <div
          style={{
            width: 10,
            height: 18,
            background: V.green,
            opacity: Math.floor(f / 16) % 2 ? 0.15 : 1,
          }}
        />
      </div>

      {/* word progress */}
      <div style={{ position: "absolute", right: 46, bottom: 118, display: "flex", gap: 15 }}>
        {LETTERS.map((L, i) => {
          const live = cz >= L.z - 1150 && cz < L.z - 300;
          const done = cz >= L.z - 300;
          return (
            <Mono
              key={i}
              size={17}
              tracking="0"
              color={live ? V.green : done ? "rgba(0,255,136,0.34)" : V.dim}
              style={{ opacity: live ? 1 : 0.8 }}
            >
              {L.ch}
            </Mono>
          );
        })}
      </div>

      {/* speed cue, bottom left, only while travelling */}
      <div style={{ position: "absolute", left: 46, bottom: 92 }}>
        <Mono size={11} color={V.dim} tracking="0.3em">
          {`${Math.round(camSpeed(f) * 60)} u/s`}
        </Mono>
      </div>
    </>
  );
};

/* -------------------------------------------------------------------------- */

const EndCard: React.FC<{ f: number; cz: number; cy: number }> = ({ f, cz, cy }) => {
  const d = END_Z - cz;
  const a = depthA(d);
  const t0 = 1660;

  const block = (enter: number, children: React.ReactNode, y: number) => (
    <At x={0} y={y} z={END_Z} cz={cz} cy={cy} opacity={a * win(f, t0 + enter, t0 + enter + 28)}>
      <div style={{ display: "flex", justifyContent: "center" }}>{children}</div>
    </At>
  );

  return (
    <>
      {block(
        0,
        <Mono size={17} color={V.green} tracking="0.42em">
          autonomy / shipped
        </Mono>,
        -470,
      )}

      {block(
        14,
        <div
          style={{
            fontFamily: F.display,
            fontSize: 118,
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: V.white,
            lineHeight: 1,
            textAlign: "center",
            whiteSpace: "nowrap",
            padding: "0 40px",
          }}
        >
          VITO BYTE
        </div>,
        34,
      )}

      {block(
        26,
        <Mono size={22} color={V.dim} tracking="0.66em">
          studio
        </Mono>,
        140,
      )}

      {block(
        40,
        <div
          style={{
            fontFamily: F.display,
            fontSize: 31,
            fontWeight: 500,
            letterSpacing: "0.01em",
            color: "rgba(232,244,255,0.9)",
            textAlign: "center",
            whiteSpace: "nowrap",
          }}
        >
          Where Engineering Meets Autonomy
        </div>,
        248,
      )}

      {block(
        54,
        <div
          style={{
            border: `1px solid rgba(0,255,136,0.42)`,
            padding: "18px 40px",
            fontFamily: F.mono,
            fontSize: 26,
            letterSpacing: "0.22em",
            color: V.green,
            textTransform: "lowercase",
          }}
        >
          vitobyte.studio
        </div>,
        368,
      )}

      {block(
        68,
        <Mono size={13} color={V.dim} tracking="0.3em">
          312 pops · 23 ms · 99.99% · one operator
        </Mono>,
        470,
      )}
    </>
  );
};

/* -------------------------------------------------------------------------- */

export const Overlay: React.FC = () => {
  const f = useCurrentFrame();
  const cz = camZ(f);
  const cy = camY(f);

  return (
    <AbsoluteFill style={{ transform: `rotate(${camRoll(f)}deg) scale(1.03)` }}>
      {LETTERS.map((L, i) => (
        <Card key={i} L={L} f={f} cz={cz} cy={cy} />
      ))}
      <EndCard f={f} cz={cz} cy={cy} />
      <Hud f={f} cz={cz} />
    </AbsoluteFill>
  );
};
