import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill } from "remotion";
import { NX } from "../nexus/palette";
import { getCloud, getStars, fib, project, ramp } from "./engine";

/**
 * CANVAS 3D LAYERS
 * =============================================================================
 * Everything volumetric lives here. Rules learned the expensive way:
 *
 *  · NO canvas text — fillText paints 0px in this Chromium build. Numerals and
 *    labels are DOM; these canvases only draw geometry, light and streaks.
 *  · Motion blur is drawn, not filtered. For a moving point, drawing a line
 *    from where it was to where it is costs one stroke; a CSS blur on the same
 *    element costs a full-frame read-modify-write. This is how the warp reads
 *    as speed instead of dots.
 *  · Batch by colour+alpha into Path2D. 900 individual stroke() calls was the
 *    single biggest cost in an earlier build.
 */

const W = 1080;
const H = 1920;
const TAU = Math.PI * 2;

const rgba = (r: number, g: number, b: number, a: number) => `rgba(${r},${g},${b},${a})`;
const ryNorm = (n: { y: number }) => (n.y + 1) / 2;
const GREEN = [0, 224, 138];
const GREEN_HOT = [92, 255, 184];
const BLUE = [43, 184, 255];
const RED = [255, 59, 92];

/* ================================ WARP ================================== */

export type WarpProps = {
  frame: number;
  /** world units per frame */
  speed?: number;
  /** length of the streak behind each star, in world units */
  tail?: number;
  opacity?: number;
  /** 0..1 pulls the vanishing point off-centre for a dutch-angle feel */
  skew?: number;
  /** 0..1 red tint for the breach beat */
  threat?: number;
  cx?: number;
  cy?: number;
};

export const Warp: React.FC<WarpProps> = ({
  frame,
  speed = 26,
  tail = 210,
  opacity = 1,
  skew = 0,
  threat = 0,
  cx = W / 2,
  cy = H / 2,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const stars = getStars();
    const ox = cx + skew * 190;
    const oy = cy;

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";

    // two passes: a soft wide glow, then a hard core — that is what makes a
    // streak read as light rather than as a line
    for (const pass of [0, 1]) {
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const z = ((s.z0 - frame * speed) % 4200 + 4200) % 4200;
        const zA = Math.max(40, z);
        const zB = zA + tail;
        const a = project({ x: s.x, y: s.y, z: zA }, 0, ox, oy);
        const b = project({ x: s.x, y: s.y, z: zB }, 0, ox, oy);
        // fade in from the far plane so nothing pops into existence
        const fade = Math.min(1, (4200 - zA) / 900) * Math.min(1, (zA - 40) / 200);
        if (fade <= 0.01) continue;

        const near = Math.min(1, 2200 / zA);
        const alpha = fade * near * (pass === 0 ? 0.055 : 0.42) * opacity;
        if (alpha < 0.05) continue;

        const hot = s.hue > 0.72;
        const col = threat > 0.4 ? RED : hot ? GREEN_HOT : s.hue > 0.34 ? GREEN : BLUE;
        ctx.strokeStyle = rgba(col[0], col[1], col[2], alpha);
        ctx.lineWidth = pass === 0 ? s.size * near * 2.6 : Math.max(0.6, s.size * near * 0.8);
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(a.x, a.y);
        ctx.stroke();
      }
    }

    /* ------------------------------- tunnel -------------------------------- */
    // concentric polygon rings give the field a floor and a ceiling — without
    // them a starfield reads as dust, not as travel
    const RINGS = 16;
    for (let i = 0; i < RINGS; i++) {
      const z = ((i * 170 - (frame * speed) % (RINGS * 170)) % (RINGS * 170) + RINGS * 170) % (RINGS * 170);
      if (z < 60) continue;
      const r = 620;
      const a = project({ x: 0, y: 0, z }, 0, ox, oy);
      const rad = r * a.s;
      if (rad < 30 || rad > 3600) continue;
      const alpha = Math.min(0.5, 2600 / z) * 0.13 * opacity;
      ctx.strokeStyle = rgba(threat > 0.4 ? RED[0] : GREEN[0], threat > 0.4 ? RED[1] : GREEN[1], threat > 0.4 ? RED[2] : GREEN[2], alpha);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) {
        const ang = (k / 6) * TAU - Math.PI / 6 + i * 0.06;
        const x = a.x + Math.cos(ang) * rad;
        const y = a.y + Math.sin(ang) * rad * 0.98;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    ctx.globalCompositeOperation = "source-over";
  }, [frame, speed, tail, opacity, skew, threat, cx, cy]);

  return (
    <AbsoluteFill>
      <canvas ref={ref} width={W} height={H} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};

/* ============================== PANEL WALL ============================== */

type Panel = { x: number; y: number; z0: number; w: number; h: number; seed: number };

let panels: Panel[] | null = null;
const getPanels = (): Panel[] => {
  if (panels) return panels;
  const out: Panel[] = [];
  let n = 0;
  for (let ring = 0; ring < 7; ring++) {
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * TAU + ring * 0.35;
      const rad = 780 + (n % 3) * 190;
      out.push({
        x: Math.cos(a) * rad * 1.55,
        y: Math.sin(a) * rad * 0.95,
        z0: ring * 620 + (k % 3) * 120,
        w: 190 + (n % 4) * 46,
        h: 120 + (n % 3) * 40,
        seed: ((n * 37) % 100) / 100,
      });
      n++;
    }
  }
  panels = out;
  return out;
};

export type WallProps = {
  frame: number;
  speed?: number;
  opacity?: number;
  /** 0..1 tint shift to blue on the far half */
  cool?: number;
};

export const PanelWall: React.FC<WallProps> = ({ frame, speed = 34, opacity = 1 }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const list = getPanels();
    const cx = W / 2;
    const cy = H / 2;
    ctx.clearRect(0, 0, W, H);

    // back to front so nearer panels overpaint — the whole point of the depth
    const sorted = list
      .map((p) => ({ p, z: ((p.z0 - frame * speed) % 4340 + 4340) % 4340 }))
      .sort((a, b) => b.z - a.z);

    for (const { p, z } of sorted) {
      if (z < 120) continue;
      const corners = [
        { x: p.x - p.w / 2, y: p.y - p.h / 2 },
        { x: p.x + p.w / 2, y: p.y - p.h / 2 },
        { x: p.x + p.w / 2, y: p.y + p.h / 2 },
        { x: p.x - p.w / 2, y: p.y + p.h / 2 },
      ].map((c) => project({ x: c.x, y: c.y, z }, 0, cx, cy));

      if (corners[0].s > 4) continue; // too close, would smear the frame
      const depthFade = Math.min(1, 3400 / z);
      const a = depthFade * 0.9 * opacity;
      if (a < 0.03) continue;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
      ctx.closePath();
      ctx.fillStyle = rgba(6, 20, 26, 0.34 * depthFade);
      ctx.fill();
      ctx.strokeStyle = rgba(GREEN[0], GREEN[1], GREEN[2], 0.34 * a);
      ctx.lineWidth = 1;
      ctx.stroke();

      // abstract content marks — no text, just the silhouette of data
      ctx.clip();
      const spanX = corners[1].x - corners[0].x;
      const spanY = corners[3].y - corners[0].y;
      if (Math.abs(spanX) > 24) {
        // header bar
        ctx.fillStyle = rgba(GREEN_HOT[0], GREEN_HOT[1], GREEN_HOT[2], 0.5 * a);
        ctx.fillRect(corners[0].x + spanX * 0.08, corners[0].y + spanY * 0.12, spanX * 0.34, Math.max(1, spanY * 0.045));
        // sparkline
        ctx.beginPath();
        const steps = 9;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const v = 0.62 + 0.3 * Math.sin(t * 7 + p.seed * 12 + frame * 0.02);
          const x = corners[0].x + spanX * (0.08 + t * 0.84);
          const y = corners[0].y + spanY * (0.78 - v * 0.36);
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = rgba(GREEN_HOT[0], GREEN_HOT[1], GREEN_HOT[2], 0.65 * a);
        ctx.lineWidth = Math.max(0.6, Math.abs(spanY) * 0.012);
        ctx.stroke();
        // ticks
        for (let s = 0; s < 4; s++) {
          ctx.fillStyle = rgba(255, 255, 255, 0.16 * a);
          ctx.fillRect(
            corners[0].x + spanX * 0.08,
            corners[0].y + spanY * (0.24 + s * 0.1),
            spanX * (0.16 + ((p.seed * 10 + s * 3) % 5) * 0.06),
            Math.max(0.6, Math.abs(spanY) * 0.022),
          );
        }
      }
      ctx.restore();
    }
  }, [frame, speed, opacity]);

  return (
    <AbsoluteFill>
      <canvas ref={ref} width={W} height={H} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};

/* ================================ SWARM ================================= */

export type SwarmProps = {
  frame: number;
  /** 0 = free cloud, 1 = collapsed into the mark */
  gather?: number;
  opacity?: number;
  /** 0..1 red contamination */
  threat?: number;
  spin?: number;
  scale?: number;
  /** 0..1 the repair wave sweeping through the cloud */
  heal?: number;
  cx?: number;
  cy?: number;
};

export const Swarm: React.FC<SwarmProps> = ({
  frame,
  gather = 0,
  opacity = 1,
  threat = 0,
  spin = 0,
  scale = 1,
  heal = 0,
  cx = W / 2,
  cy = H / 2,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const cloud = getCloud();
    const camZ = 1080;
    const R = 660 * scale;

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";

    const cosS = Math.cos(spin);
    const sinS = Math.sin(spin);

    type P = { x: number; y: number; s: number; d: number; on: number; tint: number };
    const pts: P[] = [];

    for (let i = 0; i < cloud.length; i++) {
      const n = cloud[i];
      // free state: drift on a slow sine, wide
      const driftX = Math.sin(frame * 0.012 + n.seed * 20) * 0.16;
      const driftY = Math.cos(frame * 0.009 + n.seed * 31) * 0.16;
      const fx = (n.x * (1.55 + n.seed * 0.5) + driftX) * R;
      const fy = (n.y * (1.55 + n.seed * 0.5) + driftY) * R;
      const fz = n.z * R * 1.4;
      // gathered state: exact position on the sphere
      const gx = n.x * R;
      const gy = n.y * R;
      const gz = n.z * R;

      const g = gather;
      let x = fx + (gx - fx) * g;
      let y = fy + (gy - fy) * g;
      let z = fz + (gz - fz) * g;

      // rotate around Y
      const rx = x * cosS + z * sinS;
      const rz = -x * sinS + z * cosS;

      const worldZ = rz + 1900;
      const depth = worldZ - camZ;
      if (depth < 260) continue; // behind or inside the lens — never draw these
      const pr = project({ x: rx, y, z: worldZ }, camZ, cx, cy);
      // the repair wave: nodes behind the front are restored (bright, green)
      const wave = heal > 0 ? (ryNorm(n) < heal ? 1 : 0) : 0;
      const t = threat * (1 - wave);
      pts.push({ x: pr.x, y: pr.y, s: pr.s, d: pr.d, on: n.seed, tint: t });
    }

    // edges between near neighbours in projection — gives the swarm structure
    const maxS = 300;
    const buckets: (Path2D | null)[] = [null, null, null];
    for (let i = 0; i < pts.length; i += 1) {
      for (let j = i + 1; j < Math.min(pts.length, i + 26); j += 1) {
        const a = pts[i];
        const b = pts[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dd = dx * dx + dy * dy;
        if (dd > maxS * maxS) continue;
        const prox = 1 - Math.sqrt(dd) / maxS;
        if (prox < 0.45) continue;
        const lvl = prox > 0.82 ? 2 : prox > 0.62 ? 1 : 0;
        if (!buckets[lvl]) buckets[lvl] = new Path2D();
        buckets[lvl]!.moveTo(a.x, a.y);
        buckets[lvl]!.lineTo(b.x, b.y);
      }
    }
    for (let l = 0; l < 3; l++) {
      if (!buckets[l]) continue;
      ctx.strokeStyle = rgba(GREEN[0], GREEN[1], GREEN[2], (0.07 + l * 0.08) * opacity);
      ctx.lineWidth = 1;
      ctx.stroke(buckets[l]!);
    }

    for (const p of pts) {
      if (p.s <= 0) continue;
      const depth = Math.min(1, p.d / 3400);
      const size = Math.max(1.1, p.s * (1.5 + p.on * 2.4));
      const a = (1 - depth * 0.55) * opacity;
      const t = p.tint;
      const col = t > 0.5 ? RED : p.on > 0.8 ? GREEN_HOT : p.on > 0.4 ? GREEN : BLUE;
      ctx.fillStyle = rgba(col[0], col[1], col[2], Math.min(1, a));
      ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
      if (p.on > 0.86 && size > 2) {
        ctx.fillStyle = rgba(col[0], col[1], col[2], 0.22 * a);
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 3.6, 0, TAU);
        ctx.fill();
      }
    }

    ctx.globalCompositeOperation = "source-over";
  }, [frame, gather, opacity, threat, spin, scale, heal, cx, cy]);

  return (
    <AbsoluteFill>
      <canvas ref={ref} width={W} height={H} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};


/* ================================ BREACH ================================ */

export type BreachProps = {
  frame: number;
  /** 0..1 intensity */
  power: number;
  opacity?: number;
};

/** RGB-split + scan slice glitch. Deterministic per frame, no randomness. */
export const Breach: React.FC<BreachProps> = ({ frame, power, opacity = 1 }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    if (power <= 0.01) return;

    const seed = Math.sin(frame * 12.9898) * 43758.5453;
    const rnd = (k: number) => {
      const v = Math.sin((frame * 7.13 + k * 91.7) * 12.9898) * 43758.5453;
      return v - Math.floor(v);
    };

    // horizontal tear bands
    const bands = 20;
    for (let i = 0; i < bands; i++) {
      const y = rnd(i) * H;
      const h = 1 + rnd(i + 41) * 7;
      const x = (rnd(i + 7) - 0.5) * 90 * power;
      const a = (0.05 + rnd(i + 13) * 0.13) * power * opacity;
      const col = i % 3 === 0 ? RED : i % 3 === 1 ? BLUE : GREEN;
      ctx.fillStyle = rgba(col[0], col[1], col[2], a);
      ctx.fillRect(x, y, W, h);
    }

    // red interference edge
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, rgba(RED[0], RED[1], RED[2], 0.07 * power * opacity));
    g.addColorStop(0.5, rgba(0, 0, 0, 0));
    g.addColorStop(1, rgba(RED[0], RED[1], RED[2], 0.05 * power * opacity));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    void seed;
  }, [frame, power, opacity]);

  return (
    <AbsoluteFill style={{ mixBlendMode: "screen" }}>
      <canvas ref={ref} width={W} height={H} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};

/* ============================== MARK CLOUD ============================== */

/** The 3D version of the NEXUS mark: six satellites around a pulsing core. */
export const MarkCloud: React.FC<{ frame: number; progress: number; scale?: number; opacity?: number }> = ({
  frame,
  progress,
  scale = 1,
  opacity = 1,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const cx = W / 2;
    const cy = H / 2;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";

    const R = 300 * scale;
    const rot = frame * 0.008;
    const sat = Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * TAU + rot;
      return { x: Math.cos(a) * R, y: Math.sin(a) * R * 0.62, z: Math.sin(a) * R * 0.4 };
    });

    const core = project({ x: 0, y: 0, z: 0 }, 0, cx, cy);
    const k = ramp(frame, 0, 1);

    for (const s of sat) {
      const p = project(s, 0, cx, cy);
      const near = Math.min(1, 900 / Math.max(200, p.d));
      const a = progress * near * opacity;
      ctx.strokeStyle = rgba(GREEN[0], GREEN[1], GREEN[2], 0.35 * a);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(core.x, core.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.fillStyle = rgba(GREEN_HOT[0], GREEN_HOT[1], GREEN_HOT[2], a);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.4 * near * progress, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgba(GREEN_HOT[0], GREEN_HOT[1], GREEN_HOT[2], 0.14 * a);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 14 * near * progress, 0, TAU);
      ctx.fill();
    }

    // orbiting particles
    const cloud = fib(260, 1);
    for (let i = 0; i < cloud.length; i++) {
      const n = cloud[i];
      const a2 = frame * 0.006 + i * 0.02;
      const x = (n.x * Math.cos(a2) - n.z * Math.sin(a2)) * R * 1.7;
      const z = (n.x * Math.sin(a2) + n.z * Math.cos(a2)) * R * 1.7;
      const y = n.y * R * 0.9;
      const p = project({ x, y, z }, 0, cx, cy);
      const near = Math.min(1, 1400 / Math.max(300, p.d));
      const a = progress * near * 0.55 * opacity * (0.4 + 0.6 * Math.abs(Math.sin(i + frame * 0.05)));
      if (a < 0.02) continue;
      ctx.fillStyle = rgba(i % 3 === 0 ? BLUE[0] : GREEN[0], i % 3 === 0 ? BLUE[1] : GREEN[1], i % 3 === 0 ? BLUE[2] : GREEN[2], a);
      ctx.fillRect(p.x, p.y, 1.8 * near, 1.8 * near);
    }

    const pulse = 22 + Math.sin(frame * 0.08) * 3;
    const g = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, pulse * 5);
    g.addColorStop(0, rgba(GREEN_HOT[0], GREEN_HOT[1], GREEN_HOT[2], 0.9 * k * opacity));
    g.addColorStop(0.4, rgba(GREEN[0], GREEN[1], GREEN[2], 0.35 * k * opacity));
    g.addColorStop(1, rgba(GREEN[0], GREEN[1], GREEN[2], 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(core.x, core.y, pulse * 5, 0, TAU);
    ctx.fill();

    ctx.globalCompositeOperation = "source-over";
  }, [frame, progress, scale, opacity]);

  return (
    <AbsoluteFill>
      <canvas ref={ref} width={W} height={H} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
