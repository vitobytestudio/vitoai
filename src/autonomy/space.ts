/**
 * AUTONOMY — one continuous shot.
 * =============================================================================
 * There are no cuts in this film. A single camera travels down a corridor and
 * flies through the eight letters of the word AUTONOMY; each letter carries one
 * piece of information. Everything below is the geometry of that space:
 * a pinhole camera, the letter strokes, and one keyframed path.
 *
 * World units: at a depth of 1000 units, 1 unit == 1 screen pixel (FOCAL=1000).
 */

export const W = 1080;
export const H = 1920;
export const FPS = 60;
export const DURATION = 1920; // 32.0 s

export const FOCAL = 1000;
export const NEAR = 240; // closer than this, geometry is culled
export const FAR = 4300; // further than this, it is fully fogged out

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** smooth step, used everywhere so nothing ever starts or stops abruptly */
export const ss = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
/** 0 → 1 over [a,b] */
export const win = (f: number, a: number, b: number) => ss((f - a) / Math.max(1, b - a));
/** 1 → 0 over [a,b] */
export const out = (f: number, a: number, b: number) => 1 - win(f, a, b);
/** 0 → 1 → 0 */
export const pulse = (f: number, a: number, b: number) =>
  Math.min(win(f, a, (a + b) / 2), out(f, (a + b) / 2, b));

/** deterministic hash — identical on every machine and every render */
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
};

/* -------------------------------------------------------------------------- */
/*  the camera                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The whole film is this table. Flat stretches are dwells (the camera reads a
 * letter), steep stretches are the travel between letters. Smoothstep between
 * keys means velocity is continuous everywhere — the camera never cuts, never
 * stops dead, never jumps.
 */
const KEYS: [number, number][] = [
  [0, 50],
  [130, 90], //     dwell — A
  [195, 750], //    travel
  [325, 790], //    dwell — U
  [390, 1450],
  [520, 1490], //   dwell — T
  [585, 2150],
  [715, 2190], //   dwell — O
  [780, 2850],
  [910, 2890], //   dwell — N
  [975, 3550],
  [1105, 3590], //  dwell — O
  [1170, 4250],
  [1300, 4290], //  dwell — M
  [1365, 4950],
  [1560, 5010], //  dwell — Y
  [1920, 5190], //  the slow push that lands the end card
];

export function camZ(f: number): number {
  if (f <= KEYS[0][0]) return KEYS[0][1];
  for (let i = 1; i < KEYS.length; i++) {
    const [f1, z1] = KEYS[i];
    if (f <= f1) {
      const [f0, z0] = KEYS[i - 1];
      return lerp(z0, z1, ss((f - f0) / Math.max(1, f1 - f0)));
    }
  }
  return KEYS[KEYS.length - 1][1];
}

/** units per frame — drives the speed streaks and the whoosh envelope */
export function camSpeed(f: number): number {
  return Math.abs(camZ(f + 1) - camZ(f - 1)) / 2;
}

/** a very small, very slow drift so the frame is never mathematically still */
export const camY = (f: number) => Math.sin(f * 0.0031) * 14;
export const camRoll = (f: number) => Math.sin(f * 0.0037 + 1.1) * 0.62;

/* -------------------------------------------------------------------------- */
/*  projection                                                                 */
/* -------------------------------------------------------------------------- */

export type P = { x: number; y: number; s: number; d: number };

export function proj(x: number, y: number, z: number, cz: number, cy = 0): P {
  const d = z - cz;
  const s = FOCAL / Math.max(d, 1);
  return { x: W / 2 + x * s, y: H / 2 + (y - cy) * s, s, d };
}

/** how visible something at depth d is: fades in from the fog, out as it passes */
export function depthA(d: number): number {
  if (d < NEAR || d > FAR) return 0;
  return clamp((FAR - d) / (FAR - 1400)) * clamp((d - NEAR) / 300);
}

/* -------------------------------------------------------------------------- */
/*  the word                                                                   */
/* -------------------------------------------------------------------------- */

/** every letter lives in a 100×100 box, y pointing down, stroked not filled */
export const GLYPH_H = 520;
/** letters ride above the centre so the card below never fights them */
export const GLYPH_Y = -120;

/**
 * The corridor zig-zags: odd letters sit left, even letters sit right, so the
 * camera threads between them instead of flying through a stack. Without this
 * two letters land on the same screen point and read as a mistake.
 */
export const glyphX = (i: number) => (i % 2 === 0 ? -250 : 250);
export const glyphY = (i: number) => GLYPH_Y + (i % 2 === 0 ? -40 : 40);

const CIRCLE: [number, number][] = Array.from({ length: 41 }, (_, i) => {
  const a = (i / 40) * Math.PI * 2 - Math.PI / 2;
  return [50 + Math.cos(a) * 44, 50 + Math.sin(a) * 44] as [number, number];
});

export const GLYPHS: Record<string, [number, number][][]> = {
  A: [
    [
      [0, 100],
      [50, 0],
      [100, 100],
    ],
    [
      [24, 64],
      [76, 64],
    ],
  ],
  U: [
    [
      [0, 0],
      [0, 68],
      [11, 90],
      [31, 100],
      [69, 100],
      [89, 90],
      [100, 68],
      [100, 0],
    ],
  ],
  T: [
    [
      [0, 0],
      [100, 0],
    ],
    [
      [50, 0],
      [50, 100],
    ],
  ],
  O: [CIRCLE],
  N: [
    [
      [0, 100],
      [0, 0],
      [100, 100],
      [100, 0],
    ],
  ],
  M: [
    [
      [0, 100],
      [0, 0],
      [50, 58],
      [100, 0],
      [100, 100],
    ],
  ],
  Y: [
    [
      [0, 0],
      [50, 52],
      [100, 0],
    ],
    [
      [50, 52],
      [50, 100],
    ],
  ],
};

export type Letter = {
  ch: string;
  z: number;
  /** where the card sits: -1 left, +1 right */
  side: number;
  kicker: string;
  title: string;
  hero: string;
  unit: string;
  sub: string;
  /** frame the camera arrives at this letter */
  at: number;
};

const LZ = (i: number) => 1000 + i * 700;
const ARRIVE = [0, 195, 390, 585, 780, 975, 1170, 1365];

export const LETTERS: Letter[] = [
  {
    ch: "A",
    z: LZ(0),
    side: -1,
    kicker: "01 / agents",
    title: "Machines that\nwrite the code.",
    hero: "1,284",
    unit: "",
    sub: "commits this quarter · 0 human interventions",
    at: ARRIVE[0],
  },
  {
    ch: "U",
    z: LZ(1),
    side: 1,
    kicker: "02 / private servers",
    title: "Your own metal.\nNot a shared slice.",
    hero: "192",
    unit: "",
    sub: "dedicated cores · 768 GB · 99.99% uptime",
    at: ARRIVE[1],
  },
  {
    ch: "T",
    z: LZ(2),
    side: -1,
    kicker: "03 / cloudflare edge",
    title: "312 points\nof presence.",
    hero: "23",
    unit: "ms",
    sub: "p95 global · every request, every region",
    at: ARRIVE[2],
  },
  {
    ch: "O",
    z: LZ(3),
    side: 1,
    kicker: "04 / github ci-cd",
    title: "Commit to\nproduction.",
    hero: "51",
    unit: "s",
    sub: "merge to live · 0 s downtime",
    at: ARRIVE[3],
  },
  {
    ch: "N",
    z: LZ(4),
    side: -1,
    kicker: "05 / nexus engine",
    title: "The runtime\nunderneath.",
    hero: "41",
    unit: "ms",
    sub: "median response · production traffic",
    at: ARRIVE[4],
  },
  {
    ch: "O",
    z: LZ(5),
    side: 1,
    kicker: "06 / vitocloud",
    title: "One fleet,\nsix regions.",
    hero: "184",
    unit: "",
    sub: "nodes orchestrated · rolling, never down",
    at: ARRIVE[5],
  },
  {
    ch: "M",
    z: LZ(6),
    side: -1,
    kicker: "07 / b2b platforms",
    title: "Live tenants,\nzero incidents.",
    hero: "27",
    unit: "",
    sub: "production platforms · audited, monitored",
    at: ARRIVE[6],
  },
  {
    ch: "Y",
    z: LZ(7),
    side: 1,
    kicker: "08 / autonomy",
    title: "No operator\nin the loop.",
    hero: "24/7",
    unit: "",
    sub: "shipping · autonomous · observed",
    at: ARRIVE[7],
  },
];

/** world position of a stroke vertex */
export function glyphPoint(
  i: number,
  gx: number,
  gy: number,
  scale = 1,
): [number, number, number] {
  const k = (GLYPH_H / 100) * scale;
  return [(gx - 50) * k + glyphX(i), (gy - 50) * k + glyphY(i), LZ(i)];
}

/* -------------------------------------------------------------------------- */
/*  the end card, also anchored in the same space so it arrives with the camera */
/* -------------------------------------------------------------------------- */

export const END_Z = 6060;
export const END_AT = 1560;
