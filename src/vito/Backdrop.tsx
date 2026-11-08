import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill } from "remotion";
import { CITIES, F, V, W, H, hash } from "./palette";
import { MAP, MAP_COLS, MAP_ROWS } from "./mapData";

/**
 * BACKGROUND LAYERS — geometry and light only, never text.
 * (canvas fillText paints 0px in this build; see PITFALLS.md)
 */

const rgba = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const [r, g, b] = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  return `rgba(${r},${g},${b},${a})`;
};

/* -------------------------------- the grid ------------------------------- */

export const Grid: React.FC<{
  frame: number;
  opacity?: number;
  /** px between cells */
  cell?: number;
  /** 0..1 vertical scan */
  scan?: number;
  accent?: string;
}> = ({ frame, opacity = 1, cell = 54, scan = 0.5, accent = V.green }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    const drift = (frame * 0.35) % cell;

    // minor grid
    ctx.strokeStyle = "rgba(120,200,255,0.045)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -drift; x < W; x += cell) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, H);
    }
    for (let y = -drift; y < H; y += cell) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(W, Math.round(y) + 0.5);
    }
    ctx.stroke();

    // major grid, every 5th
    ctx.strokeStyle = "rgba(120,200,255,0.085)";
    ctx.beginPath();
    for (let x = -drift; x < W; x += cell * 5) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, H);
    }
    for (let y = -drift; y < H; y += cell * 5) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(W, Math.round(y) + 0.5);
    }
    ctx.stroke();

    // intersections: one dot in every major crossing, very faint
    ctx.fillStyle = "rgba(120,200,255,0.14)";
    for (let x = -drift; x < W; x += cell * 5) {
      for (let y = -drift; y < H; y += cell * 5) {
        ctx.fillRect(Math.round(x), Math.round(y), 1.6, 1.6);
      }
    }

    // scan band
    if (scan > 0 && scan < 1.4) {
      const sy = scan * (H + 400) - 200;
      const g = ctx.createLinearGradient(0, sy - 150, 0, sy + 150);
      g.addColorStop(0, rgba(accent, 0));
      g.addColorStop(0.5, rgba(accent, 0.055));
      g.addColorStop(1, rgba(accent, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, sy - 150, W, 300);
      ctx.fillStyle = rgba(accent, 0.16);
      ctx.fillRect(0, sy, W, 1);
    }

    ctx.globalAlpha = 1;
  }, [frame, cell, scan, accent]);

  return (
    <AbsoluteFill style={{ opacity }}>
      <canvas ref={ref} width={W} height={H} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};

/* ------------------------------ the world map ---------------------------- */

const lonToX = (lon: number, box: { x: number; w: number }) => box.x + ((lon + 180) / 360) * box.w;
const latToY = (lat: number, box: { y: number; h: number }, lat0 = 82, lat1 = -78) =>
  box.y + ((lat0 - lat) / (lat0 - lat1)) * box.h;

export const WorldMap: React.FC<{
  frame: number;
  /** 0..1 reveal sweep left to right */
  reveal?: number;
  /** 0..1 how lit the land dots are */
  land?: number;
  /** 0..1 the edge nodes and their latency rings */
  nodes?: number;
  /** arcs appear after this frame */
  arcStart?: number;
  box?: { x: number; y: number; w: number; h: number };
  opacity?: number;
}> = ({ frame, reveal = 1, land = 1, nodes = 0, arcStart = 0, box = { x: 60, y: 700, w: 960, h: 420 }, opacity = 1 }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";

    const dx = box.w / (MAP_COLS - 1);
    const dy = box.h / (MAP_ROWS - 1);
    const dot = Math.min(dx, dy) * 0.46;
    const sweepX = reveal * (box.w + 200) - 100;

    /* land: every dot appears as the reveal passes it */
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (!MAP[row * MAP_COLS + col]) continue;
        const px = box.x + col * dx;
        const py = box.y + row * dy;
        const d = px - box.x;
        const on = Math.min(1, Math.max(0, (sweepX - d) / 120));
        if (on <= 0) continue;
        // a slow noise shimmer keeps 700 dots from looking like a texture
        const sh = 0.68 + 0.32 * Math.sin(frame * 0.05 + row * 0.7 + col * 0.35);
        ctx.fillStyle = `rgba(46,124,255,${0.30 * on * land * sh})`;
        ctx.fillRect(px, py, dot, dot);
        if ((row + col) % 11 === 0) {
          ctx.fillStyle = `rgba(0,255,136,${0.5 * on * land})`;
          ctx.fillRect(px, py, dot, dot);
        }
      }
    }

    /* cities: a node, a latency ring, a label dot */
    if (nodes > 0.01) {
      for (let i = 0; i < CITIES.length; i++) {
        const c = CITIES[i];
        const px = lonToX(c.lon, box);
        const py = latToY(c.lat, box);
        const at = arcStart + i * 5;
        const on = Math.min(1, Math.max(0, (frame - at) / 12)) * nodes;
        if (on <= 0.01) continue;

        // ring pulse, offset per city so they never fire in unison
        const ph = ((frame + i * 37) % 90) / 90;
        ctx.strokeStyle = `rgba(0,255,136,${(1 - ph) * 0.34 * on})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(px, py, 3 + ph * 22, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = `rgba(0,255,136,${0.95 * on})`;
        ctx.fillRect(px - 1.6, py - 1.6, 3.2, 3.2);
        ctx.fillStyle = `rgba(0,255,136,${0.13 * on})`;
        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* arcs: a packet travelling a quadratic between two cities */
    const pairs: [number, number][] = [
      [3, 9], [1, 5], [0, 12], [4, 7], [6, 10], [2, 14], [13, 3], [8, 11], [14, 6], [15, 0],
    ];
    for (let k = 0; k < pairs.length; k++) {
      const [ai, bi] = pairs[k];
      const A = CITIES[ai];
      const B = CITIES[bi];
      const ax = lonToX(A.lon, box);
      const ay = latToY(A.lat, box);
      const bx = lonToX(B.lon, box);
      const by = latToY(B.lat, box);
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2 - Math.abs(bx - ax) * 0.28 - 26;

      const start = arcStart + 26 + k * 9;
      const p = Math.min(1, Math.max(0, (frame - start) / 64));
      if (p <= 0) continue;

      // trail
      const STEPS = 26;
      const drawn = Math.max(2, Math.floor(STEPS * p));
      for (let s = 1; s <= drawn; s++) {
        const t0 = (s - 1) / STEPS;
        const t1 = s / STEPS;
        const q = (t: number) => {
          const u = 1 - t;
          return [u * u * ax + 2 * u * t * mx + t * t * bx, u * u * ay + 2 * u * t * my + t * t * by];
        };
        const [x0, y0] = q(t0);
        const [x1, y1] = q(t1);
        const edge = s / drawn;
        ctx.strokeStyle = `rgba(0,255,136,${Math.pow(edge, 2) * 0.6 * nodes})`;
        ctx.lineWidth = 1 + edge * 0.9;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      // packet head
      if (p < 1) {
        const u = 1 - p;
        const hx = u * u * ax + 2 * u * p * mx + p * p * bx;
        const hy = u * u * ay + 2 * u * p * my + p * p * by;
        ctx.fillStyle = `rgba(232,244,255,${0.9 * nodes})`;
        ctx.fillRect(hx - 1.6, hy - 1.6, 3.2, 3.2);
        ctx.fillStyle = `rgba(0,255,136,${0.22 * nodes})`;
        ctx.beginPath();
        ctx.arc(hx, hy, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalCompositeOperation = "source-over";
  }, [frame, reveal, land, nodes, arcStart, box, opacity]);

  return (
    <AbsoluteFill style={{ opacity }}>
      <canvas ref={ref} width={W} height={H} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};

/* ------------------------------ noise / grain ---------------------------- */

let grain: HTMLCanvasElement | null = null;
const getGrain = () => {
  if (grain) return grain;
  const c = document.createElement("canvas");
  c.width = 200;
  c.height = 200;
  const x = c.getContext("2d")!;
  const img = x.createImageData(200, 200);
  const rnd = (n: number) => hash(n);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 100 + rnd(i) * 110;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 26;
  }
  x.putImageData(img, 0, 0);
  grain = c;
  return c;
};

export const Grain: React.FC<{ frame: number; amount?: number }> = ({ frame, amount = 0.05 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    const t = getGrain();
    ctx.globalAlpha = amount;
    ctx.globalCompositeOperation = "overlay";
    const ox = (frame * 37) % 200;
    const oy = (frame * 61) % 200;
    for (let y = -200; y < H; y += 200) for (let x = -200; x < W; x += 200) ctx.drawImage(t, x + ox, y + oy);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }, [frame, amount]);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <canvas ref={ref} width={W} height={H} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};

export { F };
