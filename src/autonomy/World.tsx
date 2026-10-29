/**
 * The room the camera moves through.
 *
 * Canvas carries only geometry — perspective floor, the stroke glyphs, the
 * speed streaks. All type is DOM (see Overlay.tsx) because canvas text renders
 * unreliably in this pipeline. See PITFALLS.md §A2.
 */
import React, { useRef, useEffect } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { V } from "../vito/palette";
import {
  camZ,
  camSpeed,
  camY,
  GLYPHS,
  GLYPH_H,
  GLYPH_Y,
  glyphX,
  glyphY,
  LETTERS,
  FAR,
  NEAR,
  FOCAL,
  W,
  H,
  depthA,
  clamp,
  out,
  hash,
  END_Z,
  out as fadeOut,
} from "./space";

type Ctx = CanvasRenderingContext2D;

/** pinhole projection with camera height removed */
const px = (x: number, z: number, cz: number, cy: number) => {
  const d = z - cz;
  const s = FOCAL / Math.max(d, 1);
  return { x: W / 2 + x * s, y: H / 2 + (0 - cy) * s, s, d };
};

/** project an arbitrary world point */
const p3 = (x: number, y: number, z: number, cz: number, cy: number) => {
  const d = z - cz;
  const s = FOCAL / Math.max(d, 1);
  return { x: W / 2 + x * s, y: H / 2 + (y - cy) * s, s, d };
};

/** clip a 3D segment against the near plane, then draw it */
function seg(
  ctx: Ctx,
  a: [number, number, number],
  b: [number, number, number],
  cz: number,
  cy: number,
  color: string,
  width: number,
  alpha: number,
) {
  let [x1, y1, z1] = a;
  let [x2, y2, z2] = b;
  let d1 = z1 - cz;
  let d2 = z2 - cz;
  if (d1 < NEAR && d2 < NEAR) return;
  if (d1 < NEAR) {
    const t = (NEAR - d1) / (d2 - d1);
    x1 += (x2 - x1) * t;
    y1 += (y2 - y1) * t;
    z1 = cz + NEAR;
    d1 = NEAR;
  } else if (d2 < NEAR) {
    const t = (NEAR - d2) / (d1 - d2);
    x2 += (x1 - x2) * t;
    y2 += (y1 - y2) * t;
    z2 = cz + NEAR;
    d2 = NEAR;
  }
  if (d1 > FAR || d2 > FAR) return;

  const p = p3(x1, y1, z1, cz, cy);
  const q = p3(x2, y2, z2, cz, cy);
  const a1 = depthA(d1) * alpha;
  const a2 = depthA(d2) * alpha;
  const g = ctx.createLinearGradient(p.x, p.y, q.x, q.y);
  g.addColorStop(0, rgba(color, a1));
  g.addColorStop(1, rgba(color, a2));
  ctx.strokeStyle = g;
  ctx.lineWidth = clamp(width * ((p.s + q.s) / 2), 0.6, 3.4);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(q.x, q.y);
  ctx.stroke();
}

function rgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

const V_STROKES: [number, number][][] = [
  [
    [6, 0],
    [50, 94],
    [94, 0],
  ],
];

export const World: React.FC = () => {
  const f = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    const cz = camZ(f);
    const cy = camY(f);
    const sp = camSpeed(f);

    /* --- fog glow that sits behind whatever letter we are facing --------- */
    const near = LETTERS.reduce(
      (best, L) => {
        const d = L.z - cz;
        return d > NEAR && d < best.d ? { d, L } : best;
      },
      { d: 1e9, L: LETTERS[0] },
    );
    const glowA = near.d < 1e9 ? depthA(near.d) * 0.5 : 0;
    const rg = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 620);
    rg.addColorStop(0, rgba(V.green, 0.07 * glowA));
    rg.addColorStop(0.55, rgba(V.blue, 0.045 * glowA));
    rg.addColorStop(1, rgba(V.blue, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);

    /* --- floor ------------------------------------------------------------ */
    const FLOOR = 780;
    const CEIL = -980;
    const XS = [-1500, -1200, -900, -600, -300, 0, 300, 600, 900, 1200, 1500];

    // rungs (constant z, spanning x)
    for (let zr = Math.ceil((cz + 260) / 420) * 420; zr < cz + 3800; zr += 420) {
      const k = clamp(1 - (zr - cz) / 3800);
      seg(ctx, [-1500, FLOOR, zr], [1500, FLOOR, zr], cz, cy, V.blueHot, 0.9, 0.3 * k);
      seg(ctx, [-1500, CEIL, zr], [1500, CEIL, zr], cz, cy, V.blueHot, 0.7, 0.12 * k);
    }
    // rails (constant x, running away)
    for (const x of XS) {
      const w = Math.abs(x) < 1 ? 1.4 : 0.8;
      seg(ctx, [x, FLOOR, cz + 300], [x, FLOOR, cz + 3800], cz, cy, V.blueHot, w, x === 0 ? 0.3 : 0.18);
      seg(ctx, [x, CEIL, cz + 300], [x, CEIL, cz + 3800], cz, cy, V.blueHot, 0.7, 0.07);
    }

    /* --- letters, far to near -------------------------------------------- */
    const order = LETTERS.map((L, i) => ({ L, i, d: L.z - cz }))
      .filter((o) => o.d > NEAR && o.d < FAR)
      .sort((a, b) => b.d - a.d);

    for (const { L, i, d } of order) {
      const strokes = GLYPHS[L.ch];
      const k = GLYPH_H / 100;
      let a = depthA(d) * 0.95;
      // the whole word dissolves as the end card lands — one shot, one exit
      a *= fadeOut(f, 1555, 1665);
      if (a <= 0.002) continue;
      for (const st of strokes) {
        for (let s = 0; s < st.length - 1; s++) {
          const p = st[s];
          const q = st[s + 1];
          seg(
            ctx,
            [(p[0] - 50) * k + glyphX(i), (p[1] - 50) * k + glyphY(i), L.z],
            [(q[0] - 50) * k + glyphX(i), (q[1] - 50) * k + glyphY(i), L.z],
            cz,
            cy,
            V.green,
            1.9,
            a,
          );
        }
      }
    }

    /* --- the mark that the camera lands on -------------------------------- */
    const mk = fadeOut(f, 1620, 1680);
    const mz = END_Z;
    const mkA = depthA(mz - cz) * mk;
    if (mkA > 0.002) {
      const k = 300 / 100;
      const cx0 = 0;
      const rev = clamp((f - 1668) / 54);
      for (const st of V_STROKES) {
        for (let s = 0; s < st.length - 1; s++) {
          const t = clamp(rev - s * 0.35, 0, 1);
          if (t <= 0) continue;
          const p = st[s];
          const q = st[s + 1];
          const x1 = (p[0] - 50) * k + cx0;
          const y1 = (p[1] - 50) * k + GLYPH_Y + 20;
          const x2 = (q[0] - 50) * k + cx0;
          const y2 = (q[1] - 50) * k + GLYPH_Y + 20;
          seg(ctx, [x1, y1, mz], [x2, y2, mz], cz, cy, V.green, 2.6, mkA);
        }
      }
      // the base the V stands on
      seg(ctx, [-78, 122 + GLYPH_Y, mz], [78, 122 + GLYPH_Y, mz], cz, cy, V.green, 2.0, mkA * 0.8);
    }

    /* --- speed streaks, only when the camera is actually moving ---------- */
    if (sp > 3) {
      const k = clamp((sp - 3) / 22);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 46; i++) {
        const ang = hash(i * 3.3) * Math.PI * 2;
        const r0 = 300 + hash(i * 7.1) * 260;
        const len = (90 + hash(i * 1.7) * 220) * k;
        const cx0 = W / 2 + Math.cos(ang) * r0 * 1.5;
        const cy0 = H / 2 + Math.sin(ang) * r0 * 1.5;
        const g = ctx.createLinearGradient(
          cx0,
          cy0,
          cx0 + Math.cos(ang) * len,
          cy0 + Math.sin(ang) * len,
        );
        g.addColorStop(0, rgba(V.green, 0.3 * k));
        g.addColorStop(1, rgba(V.green, 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(cx0, cy0);
        ctx.lineTo(cx0 + Math.cos(ang) * len, cy0 + Math.sin(ang) * len);
        ctx.stroke();
      }
      ctx.restore();
    }
  }, [f]);

  return (
    <AbsoluteFill>
      <canvas ref={ref} width={W} height={H} style={{ width: W, height: H }} />
    </AbsoluteFill>
  );
};
