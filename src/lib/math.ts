/**
 * Deterministic math + a tiny software 3D engine (vec3 / mat4 / projection).
 * Everything is frame-deterministic so Remotion can render in parallel tabs.
 */

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const mix = lerp;

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInCubic = (t: number) => Math.pow(clamp(t), 3);
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t)));
export const easeInOutQuint = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
};

/** mulberry32 — fast deterministic PRNG */
export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** cheap deterministic value noise */
export const noise1 = (x: number) => {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n: number) => {
    const s = Math.sin(n * 127.1) * 43758.5453;
    return s - Math.floor(s);
  };
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u) * 2 - 1;
};

export const noise2 = (x: number, y: number) =>
  (noise1(x * 1.7 + y * 13.3) + noise1(y * 1.9 - x * 7.1)) * 0.5;

/* ---------------------------------- 3D ---------------------------------- */

export type V3 = [number, number, number];

export const v3 = (x = 0, y = 0, z = 0): V3 => [x, y, z];
export const vAdd = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vSub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const vMul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const vDot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const vCross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const vLen = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const vNorm = (a: V3): V3 => {
  const l = vLen(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export const rotX = (p: V3, a: number): V3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
};
export const rotY = (p: V3, a: number): V3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
};
export const rotZ = (p: V3, a: number): V3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
};

export type Camera = {
  pos: V3;
  /** yaw, pitch, roll in radians */
  rot: V3;
  fov: number;
  cx: number;
  cy: number;
};

export const makeCamera = (cx: number, cy: number, fov = 950): Camera => ({
  pos: [0, 0, 0],
  rot: [0, 0, 0],
  fov,
  cx,
  cy,
});

/** World → camera space */
export const toCamera = (p: V3, cam: Camera): V3 => {
  let q = vSub(p, cam.pos);
  q = rotY(q, -cam.rot[1]);
  q = rotX(q, -cam.rot[0]);
  q = rotZ(q, -cam.rot[2]);
  return q;
};

export type Projected = { x: number; y: number; z: number; s: number; visible: boolean };

/** Camera space → screen. `s` is the perspective scale for sprites. */
export const project = (q: V3, cam: Camera, near = 24): Projected => {
  const z = q[2];
  const visible = z > near;
  const k = cam.fov / Math.max(z, near);
  return { x: cam.cx + q[0] * k, y: cam.cy + q[1] * k, z, s: k, visible };
};

/** Convenience: world point straight to screen */
export const projectWorld = (p: V3, cam: Camera) => project(toCamera(p, cam), cam);

/** Depth fog factor: 1 = close, 0 = far */
export const fog = (z: number, near = 200, far = 2400) => clamp(1 - (z - near) / (far - near));

/** Fibonacci sphere — even 3D point distribution */
export const fibSphere = (count: number, radius = 1): V3[] => {
  const out: V3[] = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phi * i;
    out.push([Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius]);
  }
  return out;
};

/** Torus-knot path sampling */
export const torusKnot = (t: number, p = 2, q = 3, r = 1): V3 => {
  const cu = Math.cos(t * p);
  const quOverP = (q / p) * t;
  const cs = Math.cos(quOverP);
  return [
    r * (2 + cu) * 0.5 * cs,
    r * (2 + cu) * 0.5 * Math.sin(quOverP),
    r * Math.sin(t * p) * 0.5,
  ];
};

/** HSL-ish helper that returns an rgba() string */
export const rgba = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${clamp(a)})`;
};
