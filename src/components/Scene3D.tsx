import React, { useEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS, HEIGHT, WIDTH } from "../theme";
import {
  Camera,
  V3,
  clamp,
  fibSphere,
  fog,
  lerp,
  makeCamera,
  noise1,
  project,
  projectWorld,
  rgba,
  rng,
  rotX,
  rotY,
  rotZ,
  smoothstep,
  toCamera,
  torusKnot,
  vAdd,
  vLen,
  vSub,
} from "../lib/math";
import { blitStreak, blitTinted, discSprite, tintedSprite } from "../lib/gl";

export type Scene3DProps = {
  /** 0 = scattered chaos, 1 = assembled core */
  assemble?: number;
  /** overall energy multiplier */
  energy?: number;
  /** extra dolly-in (world units) */
  zoom?: number;
  /** rgb-slice glitch amount 0..1 */
  glitch?: number;
  /** 0 = violet/cyan premium, 1 = coral/amber alarm */
  danger?: number;
  /** screen-space vertical offset of the core */
  coreY?: number;
  /** 0..1 reveal of the holographic metric cards */
  cards?: number;
  /** 0..1 reveal of the wireframe lattice */
  lattice?: number;
  /** live metric cards drawn inside the 3D scene (text rendered on canvas) */
  cardData?: CardDatum[];
};

const CAM_Z = 1520;

/* ----------------------------- lattice assets ---------------------------- */

let latticePts: V3[] | null = null;
let latticeEdges: [number, number][] | null = null;

const getLattice = () => {
  if (latticePts) return { pts: latticePts, edges: latticeEdges! };
  const pts = fibSphere(230, 1);
  const edges: [number, number][] = [];
  const seen = new Set<string>();
  const threshold = 0.34; // ~ chords between neighbours on a unit sphere
  for (let i = 0; i < pts.length; i++) {
    const cand: { j: number; d: number }[] = [];
    for (let j = 0; j < pts.length; j++) {
      if (i === j) continue;
      const d = vLen(vSub(pts[i], pts[j]));
      if (d < threshold) cand.push({ j, d });
    }
    cand.sort((a, b) => a.d - b.d);
    for (const c of cand.slice(0, 3)) {
      const key = i < c.j ? `${i}-${c.j}` : `${c.j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([i, c.j]);
    }
  }
  latticePts = pts;
  latticeEdges = edges;
  return { pts, edges };
};

/* ------------------------------- glass card ------------------------------ */

export type CardDatum = {
  value: string;
  unit: string;
  label: string;
  tint: string;
  kind: "bars" | "ring" | "wave";
  bars: number[];
  progress: number;
};

type CardOpts = {
  center: V3;
  rot: V3;
  w: number;
  h: number;
  tint: string;
  alpha: number;
  bars: number[];
  kind: "bars" | "ring" | "wave";
};

const quadPath = (pts: { x: number; y: number }[]) => {
  const p = new Path2D();
  p.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i].x, pts[i].y);
  p.closePath();
  return p;
};

const drawGlassCard = (ctx: CanvasRenderingContext2D, cam: Camera, o: CardOpts) => {
  const hw = o.w / 2;
  const hh = o.h / 2;
  const corners: V3[] = [
    [-hw, -hh, 0],
    [hw, -hh, 0],
    [hw, hh, 0],
    [-hw, hh, 0],
  ];
  const world = corners.map((p) => {
    let q: V3 = rotX(p, o.rot[0]);
    q = rotY(q, o.rot[1]);
    q = rotZ(q, o.rot[2]);
    return vAdd(q, o.center);
  });
  const proj = world.map((w) => projectWorld(w, cam));
  if (proj.some((p) => !p.visible)) return;
  const [a, b, c, d] = proj;
  const cz = (a.z + b.z + c.z + d.z) / 4;
  const f = fog(cz, 400, 3200);
  if (f <= 0.02) return;

  const path = quadPath(proj);

  // glass body
  const g = ctx.createLinearGradient(d.x, d.y, b.x, b.y);
  g.addColorStop(0, rgba("#FFFFFF", 0.13 * o.alpha * f));
  g.addColorStop(0.5, rgba(o.tint, 0.07 * o.alpha * f));
  g.addColorStop(1, rgba("#05060C", 0.42 * o.alpha * f));
  ctx.fillStyle = g;
  ctx.fill(path);

  // rim
  const rim = ctx.createLinearGradient(a.x, a.y, c.x, c.y);
  rim.addColorStop(0, rgba("#FFFFFF", 0.62 * o.alpha * f));
  rim.addColorStop(0.45, rgba(o.tint, 0.40 * o.alpha * f));
  rim.addColorStop(1, rgba("#FFFFFF", 0.05 * o.alpha * f));
  ctx.strokeStyle = rim;
  ctx.lineWidth = 1.6;
  ctx.stroke(path);

  // NOTE: canvas fillText is unstable in this sandbox (fontconfig has zero
  // system fonts and text shaping on a 2D context can take the renderer down),
  // so all type lives in the DOM layer. The card stays pure geometry.

  ctx.save();
  ctx.clip(path);

  const at = (u: number, v: number) => ({
    x: lerp(lerp(a.x, b.x, u), lerp(d.x, c.x, u), v),
    y: lerp(lerp(a.y, b.y, u), lerp(d.y, c.y, u), v),
  });

  const baseV = 0.84;
  if (o.kind === "bars") {
    const n = o.bars.length;
    for (let i = 0; i < n; i++) {
      const u0 = 0.1 + (i / n) * 0.8;
      const u1 = u0 + (0.8 / n) * 0.5;
      const hgt = clamp(o.bars[i]) * 0.46;
      const pb = at(u0, baseV);
      const pt = at(u0, baseV - hgt);
      const pb2 = at(u1, baseV);
      const pt2 = at(u1, baseV - hgt);
      const cast = ctx.createLinearGradient(pb.x, pb.y, pt.x, pt.y);
      cast.addColorStop(0, rgba(o.tint, 0.18 * o.alpha * f));
      cast.addColorStop(1, rgba(o.tint, 0.95 * o.alpha * f));
      ctx.beginPath();
      ctx.moveTo(pb.x, pb.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.lineTo(pt2.x, pt2.y);
      ctx.lineTo(pb2.x, pb2.y);
      ctx.closePath();
      ctx.fillStyle = cast;
      ctx.fill();
    }
  }

  if (o.kind === "ring") {
    const ctr = at(0.42, 0.5);
    const edge = at(0.86, 0.5);
    const rad = Math.hypot(edge.x - ctr.x, edge.y - ctr.y) * 0.95;
    ctx.beginPath();
    ctx.arc(ctr.x, ctr.y, rad, 0, Math.PI * 2);
    ctx.strokeStyle = rgba("#FFFFFF", 0.10 * o.alpha * f);
    ctx.lineWidth = rad * 0.22;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ctr.x, ctr.y, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.42);
    ctx.strokeStyle = rgba(o.tint, 0.95 * o.alpha * f);
    ctx.lineWidth = rad * 0.22;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  if (o.kind === "wave") {
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const u = 0.08 + (i / 40) * 0.84;
      const v = 0.62 + Math.sin(i * 0.5) * 0.1 + Math.sin(i * 0.19 + 2) * 0.05;
      const p = at(u, v);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = rgba(o.tint, 0.95 * o.alpha * f);
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  // baseline
  const l0 = at(0.1, baseV);
  const l1 = at(0.9, baseV);
  ctx.beginPath();
  ctx.moveTo(l0.x, l0.y);
  ctx.lineTo(l1.x, l1.y);
  ctx.strokeStyle = rgba("#FFFFFF", 0.18 * o.alpha * f);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // header ticks (fake UI lines)
  const h0 = at(0.1, 0.16);
  const h1 = at(0.44, 0.16);
  ctx.beginPath();
  ctx.moveTo(h0.x, h0.y);
  ctx.lineTo(h1.x, h1.y);
  ctx.strokeStyle = rgba("#FFFFFF", 0.55 * o.alpha * f);
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.stroke();
  const h2 = at(0.52, 0.16);
  const h3 = at(0.7, 0.16);
  ctx.beginPath();
  ctx.moveTo(h2.x, h2.y);
  ctx.lineTo(h3.x, h3.y);
  ctx.strokeStyle = rgba(o.tint, 0.85 * o.alpha * f);
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();
};

/* -------------------------------- renderer ------------------------------- */

type ResolvedProps = Required<Omit<Scene3DProps, "cardData">> & { cardData?: CardDatum[] };

const drawScene = (ctx: CanvasRenderingContext2D, t: number, o: ResolvedProps) => {
  const danger = clamp(o.danger);
  const accentA = danger > 0.5 ? COLORS.coral : COLORS.violet;
  const accentB = danger > 0.5 ? COLORS.amber : COLORS.cyan;

  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  /* ---- backdrop ---- */
  const bg = ctx.createLinearGradient(WIDTH * 0.1, 0, WIDTH * 0.7, HEIGHT);
  bg.addColorStop(0, "#010206");
  bg.addColorStop(0.42, "#04050E");
  bg.addColorStop(0.78, danger > 0.5 ? "#0B0306" : "#06040F");
  bg.addColorStop(1, "#010206");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // restrained nebula (max ~10% additive)
  const neb = [
    { x: 300 + Math.sin(t * 0.004) * 70, y: 620, r: 520, c: rgba(accentA, 0.07) },
    { x: 800 + Math.cos(t * 0.003) * 80, y: 1240, r: 560, c: rgba(accentB, 0.055) },
  ];
  ctx.globalCompositeOperation = "lighter";
  for (const b of neb) blitTinted(ctx, tintedSprite(b.c, 256), b.x, b.y, b.r, 1);
  ctx.globalCompositeOperation = "source-over";

  /* ---- camera rig ---- */
  const shake = (0.35 + o.energy * 1.5) * (1 - o.assemble * 0.30);
  const cam: Camera = makeCamera(WIDTH / 2, HEIGHT / 2, 1180);
  cam.pos = [
    noise1(t * 0.019) * 9 * shake,
    -o.coreY + noise1(t * 0.015 + 30) * 10 * shake,
    -CAM_Z - o.zoom * 260,
  ];
  cam.rot = [
    -0.015 + noise1(t * 0.011 + 7) * 0.004 * shake + Math.sin(t * 0.004) * 0.018,
    Math.sin(t * 0.0031) * 0.085 * (1 - o.assemble * 0.55) + noise1(t * 0.02 + 11) * 0.003 * shake,
    Math.sin(t * 0.0037) * 0.010,
  ];

  /* ---- perspective floor grid ---- */
  const floorY = 640;
  const gridFade = 0.35 + smoothstep(0, 0.4, o.assemble) * 0.65;
  ctx.beginPath();
  for (let i = 0; i < 22; i++) {
    const z = 300 + i * 150;
    const a = projectWorld([-2400, floorY, z], cam);
    const b = projectWorld([2400, floorY, z], cam);
    if (a.visible && b.visible) {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
  }
  for (let i = 0; i < 18; i++) {
    const x = -2400 + i * 300;
    const a = projectWorld([x, floorY, 240], cam);
    const b = projectWorld([x, floorY, 3600], cam);
    if (a.visible && b.visible) {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
  }
  ctx.strokeStyle = rgba(accentA, 0.13 * gridFade);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  /* ---- wireframe lattice sphere ---- */
  if (o.lattice > 0.01) {
    const { pts, edges } = getLattice();
    const rad = 300;
    const rotYBase = t * 0.0042 * (0.6 + o.energy * 0.4);
    const rotXBase = Math.sin(t * 0.0055) * 0.16 - 0.06;
    const chaos = 1 - o.assemble;

    const proj: ({ x: number; y: number; z: number; vis: boolean } | null)[] = [];
    const world: V3[] = [];
    for (let i = 0; i < pts.length; i++) {
      const s = i * 12.9898;
      const jitter: V3 = [
        noise1(s) * 950 * chaos,
        noise1(s + 3.1) * 1150 * chaos,
        noise1(s + 7.7) * 950 * chaos,
      ];
      const target: V3 = [pts[i][0] * rad, pts[i][1] * rad, pts[i][2] * rad];
      let p: V3 = vAdd(target, jitter);
      p = rotY(p, rotYBase);
      p = rotX(p, rotXBase);
      world.push(p);
      const pr = project(toCamera(p, cam), cam);
      proj.push({ x: pr.x, y: pr.y, z: pr.z, vis: pr.visible && pr.z > 40 });
    }

    // edges first
    ctx.lineWidth = 1;
    for (const [i, j] of edges) {
      const a = proj[i];
      const b = proj[j];
      if (!a || !b || !a.vis || !b.vis) continue;
      const d = (a.z + b.z) / 2;
      const fade = fog(d, 600, 3400);
      if (fade < 0.05) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = rgba(i % 3 === 0 ? accentB : accentA, 0.34 * fade * o.lattice);
      ctx.stroke();
    }

    // nodes
    for (let i = 0; i < pts.length; i++) {
      const p = proj[i]!;
      if (!p.vis) continue;
      const depth = clamp(1 - (p.z - 900) / 2400);
      const size = 1.1 + depth * 3.0;
      const a = (0.2 + depth * 0.7) * o.lattice;
      const col = i % 11 === 0 ? rgba("#FFFFFF", 0.95) : rgba(i % 4 === 0 ? accentB : accentA, 0.8);
      blitTinted(ctx, tintedSprite(col, 32), p.x, p.y, size, a);
      if (i % 23 === 0) {
        blitTinted(ctx, tintedSprite(rgba(col.slice(0, -1).split(",")[0] + ",0)", 1), 32), p.x, p.y, size * 5, a * 0.25);
        blitStreak(ctx, p.x, p.y, 54, 2, rgba(accentB, 0.35), a * 0.3);
      }
    }
  }

  /* ---- orbital HUD rings ---- */
  const rings = [
    { rx: 1.25, ry: 0.0, rz: 0.0, rad: 430, spin: 0.30, col: accentA, dash: [24, 14], w: 2.0 },
    { rx: 1.42, ry: -0.62, rz: 0.3, rad: 520, spin: -0.22, col: accentB, dash: [6, 18], w: 1.5 },
    { rx: 0.55, ry: 0.95, rz: -0.35, rad: 372, spin: 0.42, col: "#FFFFFF", dash: [2, 22], w: 1.1 },
  ];
  rings.forEach((rs, idx) => {
    const spin = rs.spin * (t / 60) * (0.6 + o.energy * 0.5);
    const segs = 150;
    const pts: { x: number; y: number; vis: boolean }[] = [];
    const chaos = (1 - o.assemble) * 1.0;
    for (let i = 0; i <= segs; i++) {
      const ang = (i / segs) * Math.PI * 2;
      let p: V3 = [Math.cos(ang) * rs.rad, 0, Math.sin(ang) * rs.rad];
      p = rotY(p, rs.ry + spin);
      p = rotX(p, rs.rx + Math.sin(t * 0.005 + idx) * 0.05);
      p = rotZ(p, rs.rz);
      p = rotY(p, 0.3);
      p = vAdd(p, [
        noise1(i * 0.55 + t * 0.04 + idx * 7) * 220 * chaos,
        noise1(i * 0.72 + t * 0.05 + idx * 3) * 260 * chaos,
        noise1(i * 0.31 + idx) * 220 * chaos,
      ]);
      const pr = project(toCamera(p, cam), cam);
      pts.push({ x: pr.x, y: pr.y, vis: pr.visible && pr.z > 60 });
    }
    ctx.beginPath();
    let started = false;
    for (const p of pts) {
      if (!p.vis) {
        started = false;
        continue;
      }
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else ctx.lineTo(p.x, p.y);
    }
    ctx.setLineDash(rs.dash);
    ctx.lineDashOffset = -t * (0.9 + idx * 0.5);
    ctx.strokeStyle = rgba(rs.col, (idx === 2 ? 0.24 : 0.5) * (0.35 + o.assemble * 0.65));
    ctx.lineWidth = rs.w;
    ctx.stroke();
    ctx.setLineDash([]);

    const head = pts[Math.floor(((t * (0.55 + idx * 0.3)) % 1) * segs)];
    if (head && head.vis) {
      blitTinted(ctx, tintedSprite(rgba(rs.col, 0.9), 64), head.x, head.y, 15, 0.85);
      blitStreak(ctx, head.x, head.y, 120, 3, rgba(rs.col, 0.55), 0.4);
    }
  });

  /* ---- torus-knot energy ribbon ---- */
  const streamN = 170;
  for (let i = 0; i < streamN; i++) {
    const u = i / streamN;
    const ang = u * Math.PI * 4 + t * 0.022 * (0.6 + o.energy);
    let p = torusKnot(ang, 2, 3, 300);
    p = rotX(p, 0.42 + Math.sin(t * 0.004) * 0.1);
    p = rotY(p, t * 0.005);
    const q = toCamera(p, cam);
    const pr = project(q, cam);
    if (!pr.visible) continue;
    const fade = Math.pow(Math.sin(u * Math.PI), 0.55);
    const a = fade * 0.55 * fog(q[2], 900, 3200) * (0.3 + o.assemble * 0.7);
    blitTinted(ctx, tintedSprite(rgba(i % 6 === 0 ? "#FFFFFF" : accentA, 0.85), 32), pr.x, pr.y, 1.6 + fade * 3.0, a);
  }

  /* ---- holographic metric cards ---- */
  if (o.cards > 0.01) {
    const defs = o.cardData?.length
      ? o.cardData.map((c, i) => ({
          x: [-330, 360, -300][i % 3],
          y: [-360, -30, 380][i % 3],
          z: [180, 210, 200][i % 3],
          w: [560, 520, 500][i % 3],
          h: [320, 300, 286][i % 3],
          tint: c.tint,
          kind: c.kind,
          bars: c.bars,
          rotY: [0.28, -0.32, 0.34][i % 3],
        }))
      : [
          { x: -430, y: -330, z: 520, w: 360, h: 214, tint: accentB, kind: "bars" as const, bars: [0.35, 0.6, 0.45, 0.85, 0.62, 1.0], rotY: 0.34 },
          { x: 470, y: -60, z: 480, w: 330, h: 200, tint: accentA, kind: "ring" as const, bars: [], rotY: -0.38 },
          { x: -360, y: 430, z: 430, w: 320, h: 190, tint: COLORS.coral, kind: "wave" as const, bars: [], rotY: 0.42 },
        ];
    defs.forEach((c, i) => {
      const k = clamp(o.cards * 1.6 - i * 0.22);
      if (k <= 0.01) return;
      const drift = Math.sin(t * 0.011 + i * 1.9) * 20;
      drawGlassCard(ctx, cam, {
        center: [c.x * (1.15 - k * 0.15), c.y + drift, c.z],
        rot: [Math.sin(t * 0.008 + i) * 0.07 - 0.03, c.rotY, Math.sin(t * 0.01 + i * 2) * 0.04],
        w: c.w,
        h: c.h,
        tint: c.tint,
        alpha: k,
        bars: c.bars,
        kind: c.kind,
      });
    });
  }

  /* ---- core heart glow ---- */
  const pulse = 0.7 + Math.sin(t * 0.045) * 0.3;
  const coreA = 0.5 * o.assemble * pulse;
  if (coreA > 0.01) {
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2 - o.coreY * 0.65;
    blitTinted(ctx, tintedSprite(rgba(accentA, 0.72), 128), cx, cy, 250 + pulse * 30, coreA * 0.55);
    blitTinted(ctx, tintedSprite(rgba("#FFFFFF", 0.9), 128), cx, cy, 70, coreA * 0.6);
    blitStreak(ctx, cx, cy, 900, 4, rgba(accentB, 0.4), coreA * 0.35);
  }

  /* ---- foreground bokeh ---- */
  const disc = discSprite(128);
  const r = rng(90210);
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 14; i++) {
    const bx = r() * WIDTH;
    const br = 26 + r() * 64;
    const sp = 0.2 + r() * 0.6;
    const by = ((r() * HEIGHT + t * sp * 1.4) % (HEIGHT + 240)) - 120;
    ctx.globalAlpha = 0.055 + r() * 0.055;
    ctx.fillStyle = rgba(i % 3 === 0 ? accentB : accentA, 0.6);
    ctx.drawImage(disc, bx - br, by - br, br * 2, br * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  /* ---- glitch slices ---- */
  if (o.glitch > 0.01) {
    const slices = Math.floor(3 + o.glitch * 8);
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < slices; i++) {
      const sy = (noise1(t * 0.31 + i * 3.7) * 0.5 + 0.5) * HEIGHT;
      const sh = 3 + Math.abs(noise1(t * 0.21 + i * 9.1)) * 24 * o.glitch;
      const dx = noise1(t * 0.5 + i * 5.3) * 60 * o.glitch;
      const grad = ctx.createLinearGradient(0, sy, WIDTH, sy + sh);
      grad.addColorStop(0, rgba(COLORS.coral, 0.22 * o.glitch));
      grad.addColorStop(0.5, rgba(COLORS.cyan, 0.16 * o.glitch));
      grad.addColorStop(1, rgba(COLORS.violet, 0.2 * o.glitch));
      ctx.fillStyle = grad;
      ctx.fillRect(dx, sy, WIDTH, sh);
    }
    ctx.globalCompositeOperation = "source-over";
  }
};

export const Scene3D: React.FC<Scene3DProps> = ({
  assemble = 1,
  energy = 1,
  zoom = 0,
  glitch = 0,
  danger = 0,
  coreY = 0,
  cards = 0,
  lattice = 1,
  cardData,
}) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    drawScene(ctx, frame, { assemble, energy, zoom, glitch, danger, coreY, cards, lattice, cardData });
  }, [frame, assemble, energy, zoom, glitch, danger, coreY, cards, lattice, cardData]);

  return (
    <AbsoluteFill>
      <canvas ref={ref} width={WIDTH} height={HEIGHT} style={{ width: WIDTH, height: HEIGHT }} />
    </AbsoluteFill>
  );
};
