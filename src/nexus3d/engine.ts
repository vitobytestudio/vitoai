import { rng } from "../lib/math";

/**
 * NEXUS 3D — camera + projection core
 * =============================================================================
 * Real perspective projection on a 2D canvas. The sandbox has no WebGL, so the
 * "3D" here is arithmetic: a point (x,y,z) becomes screen space via fov/z, and
 * depth becomes both scale and alpha. That is enough to build a convincing
 * camera — and, unlike WebGL, it is fast enough on 2 vCPU.
 *
 * Convention: the camera sits at (0,0,camZ) looking down +z, so a point's
 * depth in front of the lens is `z - camZ` and must stay > NEAR.
 */

export const NEAR = 26;
export const FOV = 1150;

export type P3 = { x: number; y: number; z: number };
export type Proj = { x: number; y: number; s: number; d: number };

export const project = (p: P3, camZ: number, cx: number, cy: number, fov = FOV): Proj => {
  const depth = Math.max(NEAR, p.z - camZ);
  const s = fov / depth;
  return { x: cx + p.x * s, y: cy + p.y * s, s, d: depth };
};

/** depth-of-field: 0 at the focal plane, 1 at the far end of the ramp */
export const dof = (p: P3, camZ: number, focus: number, range: number) => {
  const depth = Math.abs(p.z - camZ - focus);
  return Math.min(1, depth / range);
};

export const lerpP = (a: P3, b: P3, t: number): P3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});

/* ------------------------------ particle beds ----------------------------- */

export type Star = { x: number; y: number; z0: number; hue: number; size: number };

let stars: Star[] | null = null;

/** The warp field. Deterministic: same frame → same pixels, every run. */
export const getStars = (): Star[] => {
  if (stars) return stars;
  const r = rng(4711);
  stars = Array.from({ length: 520 }, () => {
    const a = r() * Math.PI * 2;
    const rad = Math.pow(r(), 0.55) * 2200;
    return {
      x: Math.cos(a) * rad,
      y: Math.sin(a) * rad * 0.62,
      z0: r() * 4200,
      hue: r(),
      size: 0.5 + r() * 2.4,
    };
  });
  return stars;
};

/* ------------------------------- cloud fields ----------------------------- */

export type Node3 = { x: number; y: number; z: number; seed: number };

let cloud: Node3[] | null = null;

/** A spherical cloud used by the swarm and by the self-healing mesh. */
export const getCloud = (): Node3[] => {
  if (cloud) return cloud;
  const r = rng(8823);
  const out: Node3[] = [];
  const N = 900;
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const th = ga * i;
    const shell = 0.86 + r() * 0.14;
    out.push({ x: Math.cos(th) * rad * shell, y, z: Math.sin(th) * rad * shell, seed: r() });
  }
  cloud = out;
  return out;
};

/* ---------------------------------- shapes -------------------------------- */

/** Fibonacci sphere — used for the collapsed mark */
export const fib = (n: number, radius = 1): P3[] => {
  const pts: P3[] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const th = ga * i;
    pts.push({ x: Math.cos(th) * rad * radius, y: y * radius, z: Math.sin(th) * rad * radius });
  }
  return pts;
};

/* --------------------------------- helpers -------------------------------- */

export const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
export const easeIn = (t: number) => Math.pow(Math.min(1, Math.max(0, t)), 3);
export const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
export const ramp = (f: number, a: number, b: number) => Math.min(1, Math.max(0, (f - a) / (b - a)));

/** 0 → 1 → 0 window; useful for one-shot beats */
export const window01 = (f: number, a: number, b: number, inR = 8, outR = 8) => {
  if (f < a || f > b) return 0;
  if (f < a + inR) return (f - a) / inR;
  if (f > b - outR) return (b - f) / outR;
  return 1;
};
