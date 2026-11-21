import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill } from "remotion";
import { V3, clamp, fibSphere, lerp, rng, smoothstep, vLen, vNorm } from "../lib/math";
import { blitTinted, tintedSprite } from "../lib/gl";
import { CF, HEIGHT, WIDTH } from "./palette";

/**
 * THE NETWORK GLOBE
 * =============================================================================
 * Software-rendered (no WebGL in this sandbox).
 *
 * v1 read as a fuzzy orange ball. What fixed it, in order of impact:
 *   1. a real graticule — 12 meridians + parallels is what makes a point cloud
 *      read as *a planet* instead of dust
 *   2. a solid body disc with an off-centre radial fill, so the sphere occludes
 *      the background and gets thickness
 *   3. crisp thin edges + small nodes; glow only on the ~5% brightest
 *   4. the rim light driven by the angle to the view vector (backlit glass)
 *
 * Everything is a pure function of props — parallel render tabs stay identical.
 */

const NODES = 400;
const NEIGHBOURS = 3;
const MAX_EDGE = 0.165;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

type Geo = { nodes: V3[]; edges: [number, number][] };

let geo: Geo | null = null;
const buildGeo = (): Geo => {
  if (geo) return geo;
  const nodes = fibSphere(NODES, 1);
  const edges: [number, number][] = [];
  const seen = new Set<string>();
  for (let i = 0; i < nodes.length; i++) {
    const cand: { j: number; d: number }[] = [];
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const d = vLen([nodes[i][0] - nodes[j][0], nodes[i][1] - nodes[j][1], nodes[i][2] - nodes[j][2]]);
      if (d < MAX_EDGE) cand.push({ j, d });
    }
    cand.sort((a, b) => a.d - b.d);
    for (const c of cand.slice(0, NEIGHBOURS)) {
      const key = i < c.j ? `${i}-${c.j}` : `${c.j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([i, c.j]);
    }
  }
  geo = { nodes, edges };
  return geo;
};

let scatter: V3[] | null = null;
const buildScatter = (): V3[] => {
  if (scatter) return scatter;
  const r = rng(20240517);
  scatter = Array.from({ length: NODES }, () => {
    const u = r() * 2 - 1;
    const th = r() * TAU;
    const s = Math.sqrt(1 - u * u);
    const rad = 1.9 + r() * 2.6;
    return [Math.cos(th) * s * rad, u * rad, Math.sin(th) * s * rad] as V3;
  });
  return scatter;
};

/* ------------------------------- city data -------------------------------- */

export const CITIES: Record<string, [number, number]> = {
  ashburn: [39.04, -77.49],
  sanjose: [37.34, -121.89],
  saopaulo: [-23.55, -46.63],
  london: [51.51, -0.13],
  frankfurt: [50.11, 8.68],
  paris: [48.86, 2.35],
  dubai: [25.2, 55.27],
  mumbai: [19.08, 72.88],
  singapore: [1.35, 103.82],
  tokyo: [35.68, 139.69],
  seoul: [37.57, 126.98],
  sydney: [-33.87, 151.21],
  johannesburg: [-26.2, 28.05],
  lagos: [6.52, 3.38],
  cairo: [30.04, 31.24],
  toronto: [43.65, -79.38],
  mexico: [19.43, -99.13],
  jakarta: [-6.2, 106.85],
  moscow: [55.75, 37.62],
  santiago: [-33.45, -70.67],
};

export const ll = ([lat, lon]: [number, number]): V3 => {
  const a = lat * DEG;
  const b = lon * DEG;
  return [Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b)];
};

const rotY = (p: V3, t: number): V3 => [p[0] * Math.cos(t) + p[2] * Math.sin(t), p[1], -p[0] * Math.sin(t) + p[2] * Math.cos(t)];
const rotX = (p: V3, t: number): V3 => [p[0], p[1] * Math.cos(t) - p[2] * Math.sin(t), p[1] * Math.sin(t) + p[2] * Math.cos(t)];

/* --------------------------------- props ---------------------------------- */

export type ArcCue = { start: number; dur: number; a: string; b: string; width?: number };
export type ImpactCue = { frame: number; at: string };

export type GlobeProps = {
  frame: number;
  assemble?: number;
  spin?: number;
  tilt?: number;
  zoom?: number;
  cy?: number;
  opacity?: number;
  arcs?: ArcCue[];
  impacts?: ImpactCue[];
  shield?: number;
  collapse?: number;
  lights?: number;
  sweep?: number;
  intensity?: number;
  /** brand colours — defaults keep the Cloudflare render byte-identical */
  accent?: string;
  accentHot?: string;
  accentDeep?: string;
  gridColor?: string;
  haloRGB?: string;
  /** "r,g,b" of the lit hemisphere — the sphere's body fill */
  bodyRGB?: string;
  /** "r,g,b" for the dark side */
  shadeRGB?: string;
};

/**
 * Downscaling this canvas measured as ZERO time saved (the bottleneck is frame
 * capture, not fill rate) and it erased the 1px graticule at delivery bitrate —
 * the exact detail that makes the sphere read as a planet. Kept at 1:1.
 */
const CANVAS_SCALE = 1;

const FX = 1180;
const CAM = 1680;
const R3 = 470;

export const Globe: React.FC<GlobeProps> = ({
  frame,
  assemble = 1,
  spin = 0,
  tilt = -0.32,
  zoom = 1,
  cy = 940,
  opacity = 1,
  arcs = [],
  impacts = [],
  shield = 0,
  collapse = 0,
  lights = 0,
  sweep = 1,
  intensity = 1,
  accent = "#F6821F",
  accentHot = "#FFA24B",
  accentDeep = "#B4571A",
  gridColor = "#C4703A",
  haloRGB = "246,130,31",
  bodyRGB = "96,42,12",
  shadeRGB = "12,6,3",
}) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!ctx) return;

    const { nodes, edges } = buildGeo();
    const sc = buildScatter();
    const hexToRgb = (h: string) => {
      const m = h.replace("#", "");
      return `${parseInt(m.slice(0, 2), 16)},${parseInt(m.slice(2, 4), 16)},${parseInt(m.slice(4, 6), 16)}`;
    };
    const accentRgba = `rgba(${hexToRgb(accent)},1)`;
    const accentHotRgba = `rgba(${hexToRgb(accentHot)},1)`;
    ctx.setTransform(CANVAS_SCALE, 0, 0, CANVAS_SCALE, 0, 0);
    const cx = WIDTH / 2;
    const focal = FX * zoom;
    const dec = Math.pow(collapse, 2.4);
    const rWorld = R3 * (1 - dec * 0.94);
    const rScreen = (rWorld * focal) / (CAM + dec * 620);

    const P = (p: V3) => {
      const z = p[2] * R3 + CAM + dec * 620;
      const s = focal / Math.max(1, z);
      return { x: cx + p[0] * R3 * s, y: cy + p[1] * R3 * s, z: p[2], s, visible: z > 40 };
    };

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const fadeAll = clamp(assemble * 1.35) * opacity * intensity;

    /* ------------------------------ atmosphere ----------------------------- */
    const halo = ctx.createRadialGradient(cx, cy, rScreen * 0.86, cx, cy, rScreen * 1.55);
    halo.addColorStop(0, `rgba(${haloRGB},0.20)`);
    halo.addColorStop(0.42, `rgba(${haloRGB},0.085)`);
    halo.addColorStop(1, `rgba(${haloRGB},0)`);
    ctx.globalAlpha = fadeAll;
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, rScreen * 1.56, 0, TAU);
    ctx.fill();

    /* -------------------------------- body --------------------------------- */
    // off-centre light source (upper left) makes the sphere read as a volume
    const body = ctx.createRadialGradient(cx - rScreen * 0.42, cy - rScreen * 0.46, rScreen * 0.05, cx, cy, rScreen * 1.02);
    body.addColorStop(0, `rgba(${bodyRGB},0.58)`);
    body.addColorStop(0.46, `rgba(${shadeRGB},0.72)`);
    body.addColorStop(0.88, `rgba(${shadeRGB},0.82)`);
    body.addColorStop(1, `rgba(${shadeRGB},0.86)`);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, rScreen, 0, TAU);
    ctx.fill();

    /* ------------------------------ graticule ------------------------------ */
    // the single biggest thing that turns a point cloud into a planet
    const glines: V3[][] = [];
    for (let lon = 0; lon < 360; lon += 30) {
      const line: V3[] = [];
      for (let lat = -90; lat <= 90; lat += 4) line.push(ll([lat, lon]));
      glines.push(line);
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const line: V3[] = [];
      for (let lon = 0; lon <= 360; lon += 4) line.push(ll([lat, lon]));
      glines.push(line);
    }
    ctx.globalCompositeOperation = "lighter";
    // 855 individual stroke() calls were the single hottest thing in the frame.
    // Batch into 3 depth buckets -> 3 draw calls, same picture.
    const gbat: (Path2D | null)[] = [null, null, null];
    for (const line of glines) {
      let prev: { x: number; y: number; z: number } | null = null;
      for (const u of line) {
        const p = rotX(rotY(u, spin), tilt);
        const q = P(p);
        if (prev) {
          const zAvg = (prev.z + p[2]) / 2;
          const rim = Math.pow(1 - Math.abs(zAvg), 2);
          const lvl = zAvg < -0.1 ? 0 : rim > 0.45 ? 2 : 1;
          if (!gbat[lvl]) gbat[lvl] = new Path2D();
          gbat[lvl]!.moveTo(prev.x, prev.y);
          gbat[lvl]!.lineTo(q.x, q.y);
        }
        prev = q;
      }
    }
    const GALPHA = [0.05, 0.11, 0.20];
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1.15;
    for (let l = 0; l < 3; l++) {
      if (!gbat[l]) continue;
      ctx.globalAlpha = fadeAll * GALPHA[l];
      ctx.stroke(gbat[l]!);
    }

    /* -------------------------------- edges -------------------------------- */
    const pts: { x: number; y: number; z: number; s: number; visible: boolean }[] = new Array(nodes.length);
    for (let i = 0; i < nodes.length; i++) {
      const a = assemble;
      const base = sc[i];
      const target = nodes[i];
      let p: V3 = [lerp(base[0], target[0], a), lerp(base[1], target[1], a), lerp(base[2], target[2], a)];
      p = rotX(rotY(p, spin), tilt);
      const nrm = vNorm(p);
      const rim = Math.pow(1 - Math.abs(nrm[2]), 3.2);
      let sweepBoost = 0;
      if (sweep > 0) {
        const ang = Math.atan2(nrm[2], nrm[0]);
        const d = Math.abs(((ang - spin * 0.9 + Math.PI) % TAU) - Math.PI);
        sweepBoost = Math.exp(-Math.pow(d / 0.30, 2)) * 0.7 * sweep;
      }
      const depth = (nrm[2] + 1) / 2;
      const lum = (0.16 + rim * 1.15 + sweepBoost) * (0.28 + depth * 0.72);
      pts[i] = { ...P(p), s: lum };
    }

    const buckets: (Path2D | null)[] = [null, null, null, null, null];
    for (const [i, j] of edges) {
      const A = pts[i];
      const B = pts[j];
      if (!A.visible || !B.visible) continue;
      const zAvg = (A.z + B.z) / 2;
      const back = zAvg < -0.12 ? 0.26 : 1;
      const a = clamp(((A.s + B.s) / 2) * 0.72 * back);
      if (a < 0.03) continue;
      const idx = Math.min(4, Math.floor(a * 5));
      if (!buckets[idx]) buckets[idx] = new Path2D();
      buckets[idx]!.moveTo(A.x, A.y);
      buckets[idx]!.lineTo(B.x, B.y);
    }

    ctx.lineCap = "round";
    for (let b = 0; b < 5; b++) {
      const path = buckets[b];
      if (!path) continue;
      ctx.globalAlpha = fadeAll * (0.14 + b * 0.20);
      ctx.strokeStyle = b >= 4 ? accentHot : b >= 3 ? accent : accentDeep;
      ctx.lineWidth = b >= 4 ? 1.5 : b >= 3 ? 1.15 : 0.9;
      ctx.stroke(path);
    }

    /* -------------------------------- nodes -------------------------------- */
    const spr = tintedSprite(accentRgba, 128);
    const sprHot = tintedSprite(accentHotRgba, 128);
    const sprRed = tintedSprite("rgba(255,66,51,1)", 128);

    for (let i = 0; i < nodes.length; i++) {
      const q = pts[i];
      if (!q.visible || q.s < 0.10) continue;
      const r = 0.9 + Math.min(1.5, q.s * 1.3);
      ctx.globalAlpha = fadeAll * clamp(q.s * 1.25);
      ctx.fillStyle = q.z > 0.2 ? accentHot : accent;
      ctx.fillRect(q.x - r / 2, q.y - r / 2, r, r);
      // glow only on the brightest sliver — this is what keeps it crisp
      if (q.s > 1.05) blitTinted(ctx, spr, q.x, q.y, r * 6, fadeAll * (q.s - 1.0) * 0.5);
    }
    ctx.globalAlpha = 1;

    /* ------------------------------ city lights ---------------------------- */
    if (lights > 0.01 && assemble > 0.55) {
      const names = Object.keys(CITIES);
      for (let k = 0; k < names.length; k++) {
        const t = k / names.length;
        const on = smoothstep(0.55, 0.95, assemble) * lights;
        const flick = 0.78 + 0.22 * Math.sin(frame * 0.13 + k * 2.1);
        const v = rotX(rotY(ll(CITIES[names[k]]), spin), tilt);
        const q = P(v);
        if (!q.visible || v[2] < -0.35) continue;
        const front = smoothstep(-0.35, 0.3, v[2]);
        const a = on * flick * front;
        if (a < 0.02) continue;
        blitTinted(ctx, sprHot, q.x, q.y, 22, a * 0.7);
        ctx.globalAlpha = Math.min(1, a);
        ctx.fillStyle = "#FFF6EC";
        ctx.fillRect(q.x - 1.9, q.y - 1.9, 3.8, 3.8);
        ctx.globalAlpha = 1;
        if ((t * 3) % 1 < 0.3) {
          const ph = (frame * 0.011 + t * 3) % 1;
          ctx.globalAlpha = (1 - ph) * a * 0.45;
          ctx.strokeStyle = CF.orangeHot;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(q.x, q.y, 8 + ph * 46, 0, TAU);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }

    /* --------------------------------- arcs -------------------------------- */
    for (const arc of arcs) {
      const raw = (frame - arc.start) / arc.dur;
      if (raw < 0 || raw > 1.6) continue;
      const p = clamp(raw);
      const A = rotX(rotY(ll(CITIES[arc.a]), spin), tilt);
      const B = rotX(rotY(ll(CITIES[arc.b]), spin), tilt);
      const mid = vNorm([A[0] + B[0], A[1] + B[1], A[2] + B[2]]);
      const d = vLen([A[0] - B[0], A[1] - B[1], A[2] - B[2]]);
      const lift = 1.14 + d * 0.4;
      const C: V3 = [mid[0] * lift, mid[1] * lift, mid[2] * lift];

      const STEPS = 40;
      const drawn = Math.max(2, Math.floor(STEPS * p));
      const headFade = raw > 1 ? clamp(1 - (raw - 1) / 0.5) : 1;
      const tail = 14;
      let prev: { x: number; y: number } | null = null;

      for (let s = 0; s <= drawn; s++) {
        const t = (s / STEPS) * p;
        const u = 1 - t;
        const pt: V3 = [
          u * u * A[0] + 2 * u * t * C[0] + t * t * B[0],
          u * u * A[1] + 2 * u * t * C[1] + t * t * B[1],
          u * u * A[2] + 2 * u * t * C[2] + t * t * B[2],
        ];
        const q = P(pt);
        if (prev && s > drawn - tail) {
          const edge = (s - (drawn - tail)) / tail;
          ctx.globalAlpha = Math.min(1, Math.pow(edge, 1.6) * headFade * opacity);
          ctx.strokeStyle = accentHot;
          ctx.lineWidth = (arc.width ?? 2.4) * (0.4 + edge * 0.85);
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
        if (s === drawn) {
          blitTinted(ctx, sprHot, q.x, q.y, 40, headFade * 0.8 * opacity);
          ctx.globalAlpha = Math.min(1, headFade * opacity);
          ctx.fillStyle = "#FFF8F0";
          ctx.fillRect(q.x - 2.2, q.y - 2.2, 4.4, 4.4);
          ctx.globalAlpha = 1;
        }
        prev = q;
      }
    }

    /* -------------------------------- shield ------------------------------- */
    if (shield > 0.001) {
      for (let k = 0; k < 3; k++) {
        const ph = clamp(shield * 1.6 - k * 0.22);
        if (ph <= 0) continue;
        const grow = 1 + ph * 0.28;
        const a = (1 - ph) * 0.5 * opacity;
        if (a < 0.012) continue;
        ctx.strokeStyle = k === 0 ? accentHot : accent;
        ctx.lineWidth = 1.4;
        ctx.globalAlpha = a;
        for (let la = -60; la <= 60; la += 30) {
          const rr = Math.cos(la * DEG) * grow;
          const yy = Math.sin(la * DEG) * grow;
          ctx.beginPath();
          let first = true;
          for (let lo = 0; lo <= 360; lo += 6) {
            const v = rotX(rotY([rr * Math.cos(lo * DEG), yy, rr * Math.sin(lo * DEG)], spin), tilt);
            const q = P(v);
            if (first) {
              ctx.moveTo(q.x, q.y);
              first = false;
            } else ctx.lineTo(q.x, q.y);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }

    /* ------------------------------- impacts ------------------------------- */
    for (const im of impacts) {
      const age = frame - im.frame;
      if (age < 0 || age > 32) continue;
      const t = age / 32;
      const v = rotX(rotY(ll(CITIES[im.at]), spin), tilt);
      const q = P(v);
      const flash = Math.max(0, 1 - t * 3.2);
      blitTinted(ctx, sprRed, q.x, q.y, 50 * (1 - t * 0.4), flash * 0.85);
      ctx.globalAlpha = (1 - t) * 0.7;
      ctx.strokeStyle = CF.threat;
      ctx.lineWidth = 2 * (1 - t);
      ctx.beginPath();
      ctx.arc(q.x, q.y, 10 + t * 120, 0, TAU);
      ctx.stroke();
      for (let s = 0; s < 10; s++) {
        const ang = (s / 10) * TAU + age * 0.02;
        const r0 = 12 + t * 84;
        const r1 = r0 + 20 * (1 - t);
        ctx.globalAlpha = (1 - t) * 0.45;
        ctx.strokeStyle = "#FF8A6B";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(q.x + Math.cos(ang) * r0, q.y + Math.sin(ang) * r0);
        ctx.lineTo(q.x + Math.cos(ang) * r1, q.y + Math.sin(ang) * r1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    /* ------------------------------ rim light ------------------------------ */
    if (collapse < 0.55) {
      ctx.globalAlpha = 0.5 * fadeAll * (1 - collapse);
      ctx.strokeStyle = accentHot;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, rScreen - 1), 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.10 * fadeAll;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, rScreen), 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (collapse > 0.02) {
      blitTinted(ctx, sprHot, cx, cy, 40 + collapse * 200, collapse * 0.85 * opacity);
    }

    ctx.globalCompositeOperation = "source-over";
  }, [frame, assemble, spin, tilt, zoom, cy, opacity, arcs, impacts, shield, collapse, lights, sweep, intensity, accent, accentHot, accentDeep, gridColor, haloRGB, bodyRGB, shadeRGB]);

  return (
    <AbsoluteFill style={{ opacity }}>
      <canvas ref={ref} width={Math.round(WIDTH * CANVAS_SCALE)} height={Math.round(HEIGHT * CANVAS_SCALE)} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
