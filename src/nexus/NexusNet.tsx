import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill } from "remotion";
import { clamp, rng, smoothstep } from "../lib/math";
import { blitTinted, tintedSprite } from "../lib/gl";
import { H, NX, W, r } from "./palette";

/**
 * THE NEXUS LATTICE
 * =============================================================================
 * One canvas primitive reused across four scenes so the brand reads as a single
 * system rather than four unrelated slides:
 *
 *   ignite   reveal grows from the centre
 *   bots     energy pulses travel the mesh
 *   cyber    a fraction of the mesh goes dark and red — `damage`
 *   heal     a front expands and restores everything it touches — `healFront`
 *
 * Geometry is a triangular hex lattice (axial coords → pixels). Each node links
 * to its three forward neighbours: 620 nodes, ~1800 edges, drawn as 4 batched
 * Path2D strokes instead of 1800 individual ones.
 */

const HEX = 58;
const S3 = Math.sqrt(3);

type Node = { x: number; y: number; d: number; seed: number; q: number; rr: number };
type Edge = { a: number; b: number; len: number };

let geo: { nodes: Node[]; edges: Edge[] } | null = null;

const build = () => {
  if (geo) return geo;
  const rnd = rng(9137);
  const nodes: Node[] = [];
  const index = new Map<string, number>();

  for (let q = -11; q <= 11; q++) {
    for (let rr = -14; rr <= 14; rr++) {
      const x = HEX * 1.5 * q;
      const y = HEX * S3 * (rr + q / 2);
      const d = Math.hypot(x, y);
      if (d > 1320) continue;
      index.set(`${q},${rr}`, nodes.length);
      nodes.push({ x, y, d: d / 1320, seed: rnd(), q, rr });
    }
  }

  const edges: Edge[] = [];
  const seen = new Set<string>();
  const link = (a: number, b: number) => {
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(k)) return;
    seen.add(k);
    edges.push({ a, b, len: Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y) });
  };
  for (let i = 0; i < nodes.length; i++) {
    const { q, rr } = nodes[i];
    for (const [dq, dr] of [
      [1, 0],
      [0, 1],
      [1, -1],
    ]) {
      const j = index.get(`${q + dq},${rr + dr}`);
      if (j !== undefined) link(i, j);
    }
  }
  geo = { nodes, edges };
  return geo;
};

export type NetProps = {
  frame: number;
  /** 0..1 — mesh appears outward from the centre */
  reveal?: number;
  /** 0..1 — travelling pulses */
  energy?: number;
  /** 0..1 — share of the mesh that is struck */
  damage?: number;
  /** 0..1 — radius of the healing front (1 = whole mesh restored) */
  healFront?: number;
  /** 0..1 — extra glow at the core */
  core?: number;
  scale?: number;
  cx?: number;
  cy?: number;
  opacity?: number;
  /** 0..1 horizontal light sweep */
  sweep?: number;
};

export const NexusNet: React.FC<NetProps> = ({
  frame,
  reveal = 1,
  energy = 0,
  damage = 0,
  healFront = 1,
  core = 0,
  scale = 1,
  cx = W / 2,
  cy = H / 2,
  opacity = 1,
  sweep = 0,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const { nodes, edges } = build();

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.globalCompositeOperation = "lighter";

    const sprG = tintedSprite("rgba(0,224,138,1)", 128);
    const sprB = tintedSprite("rgba(43,184,255,1)", 128);
    const sprR = tintedSprite("rgba(255,59,92,1)", 128);

    // damage is stationary per node — it must not flicker between renders
    const isHit = (i: number) => nodes[i].seed < damage * 0.92;

    /* --------------------------- appearance state -------------------------- */
    const state = nodes.map((n, i) => {
      const appear = smoothstep(0, 1, reveal * 1.5 - n.d * 1.05);
      const healed = n.d < healFront;
      const hit = damage > 0.01 && isHit(i) && !healed;
      // a thin ring behind the healing front shows the wound closing
      const edgeDist = Math.abs(n.d - healFront);
      const healRing = healFront < 0.999 ? Math.max(0, 1 - edgeDist / 0.05) : 0;
      return { appear, hit, healed, healRing };
    });

    /* -------------------------------- edges -------------------------------- */
    const buckets: (Path2D | null)[] = [null, null, null, null, null];
    for (const e of edges) {
      const A = nodes[e.a];
      const B = nodes[e.b];
      const sa = state[e.a];
      const sb = state[e.b];
      const ap = Math.min(sa.appear, sb.appear);
      if (ap < 0.06) continue;
      const dAvg = (A.d + B.d) / 2;
      const hit = sa.hit || sb.hit;
      // the two halves of the brand: green inside, blue at the rim
      const cool = smoothstep(0.35, 0.95, dAvg);
      const base = ap * (1 - dAvg * 0.55);
      const a = hit ? base * 0.22 : base;
      if (a < 0.05) continue;
      const idx = hit ? 0 : Math.min(4, 1 + Math.floor(a * 4));
      if (!buckets[idx]) buckets[idx] = new Path2D();
      buckets[idx]!.moveTo(A.x, A.y);
      buckets[idx]!.lineTo(B.x, B.y);
      void cool;
    }

    ctx.lineCap = "round";
    for (let b = 0; b < 5; b++) {
      const p = buckets[b];
      if (!p) continue;
      if (b === 0) {
        ctx.strokeStyle = "rgba(255,59,92,1)";
        ctx.globalAlpha = opacity * 0.5;
        ctx.lineWidth = 1;
      } else {
        const t = (b - 1) / 4;
        ctx.strokeStyle = t > 0.55 ? NX.blue : NX.green;
        ctx.globalAlpha = opacity * (0.10 + t * 0.42);
        ctx.lineWidth = 0.9 + t * 0.7;
      }
      ctx.stroke(p);
    }
    ctx.globalAlpha = 1;

    /* -------------------------------- nodes -------------------------------- */
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const st = state[i];
      if (st.appear < 0.1) continue;

      const cool = smoothstep(0.35, 1.0, n.d);
      const baseA = st.appear * (0.55 + 0.45 * Math.sin(n.seed * 20));
      const flick = st.hit ? 0.55 + 0.45 * Math.sin(frame * 0.55 + n.seed * 30) : 1;

      if (st.hit) {
        ctx.globalAlpha = opacity * 0.85;
        ctx.fillStyle = NX.red;
        const s = 2.0;
        ctx.fillRect(n.x - s / 2, n.y - s / 2, s, s);
        if (n.seed > 0.55) {
          blitTinted(ctx, sprR, n.x, n.y, 11, opacity * 0.5 * flick);
        }
        continue;
      }

      const rad = 1.15 + st.appear * 0.5;
      ctx.globalAlpha = opacity * clamp(baseA);
      ctx.fillStyle = cool > 0.5 ? NX.blueHot : NX.greenHot;
      ctx.fillRect(n.x - rad / 2, n.y - rad / 2, rad, rad);

      // bright nodes carry a halo — keeps the mesh from reading as flat dots
      if (n.seed > 0.82) {
        blitTinted(ctx, cool > 0.5 ? sprB : sprG, n.x, n.y, 9, opacity * 0.34 * baseA);
      }

      if (st.healRing > 0.02) {
        blitTinted(ctx, sprG, n.x, n.y, 34 * st.healRing, opacity * 0.5 * st.healRing);
      }
    }
    ctx.globalAlpha = 1;

    /* ------------------------------- pulses -------------------------------- */
    if (energy > 0.01) {
      const PULSES = 22;
      for (let p = 0; p < PULSES; p++) {
        const seed = p * 7919;
        const e = edges[Math.floor((Math.sin(seed) * 0.5 + 0.5) * edges.length)];
        if (!e) continue;
        const t = ((frame * 0.006 + p * 0.137) % 1);
        const A = nodes[e.a];
        const B = nodes[e.b];
        const st = state[e.a];
        if (st.appear < 0.4) continue;
        const x = A.x + (B.x - A.x) * t;
        const y = A.y + (B.y - A.y) * t;
        blitTinted(ctx, st.hit ? sprR : NX.green && A.d > 0.6 ? sprB : sprG, x, y, 16, opacity * energy * 0.75);
      }
    }

    /* -------------------------------- core --------------------------------- */
    if (core > 0.01) {
      blitTinted(ctx, sprG, 0, 0, 150 + core * 130, opacity * core * 0.75);
      blitTinted(ctx, sprB, 0, 0, 320 + core * 210, opacity * core * 0.3);
    }

    /* -------------------------------- sweep -------------------------------- */
    if (sweep > 0.001) {
      const sx = -1400 + sweep * 2800;
      const g = ctx.createLinearGradient(sx - 320, 0, sx + 320, 0);
      g.addColorStop(0, "rgba(92,255,184,0)");
      g.addColorStop(0.5, "rgba(92,255,184,0.10)");
      g.addColorStop(1, "rgba(92,255,184,0)");
      ctx.globalAlpha = opacity;
      ctx.fillStyle = g;
      ctx.fillRect(-1600, -1600, 3200, 3200);
      ctx.globalAlpha = 1;
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }, [frame, reveal, energy, damage, healFront, core, scale, cx, cy, opacity, sweep]);

  return (
    <AbsoluteFill style={{ opacity }}>
      <canvas ref={ref} width={W} height={H} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};

/** convenience: the same ramp used everywhere in this film */
export const ramp = r;
