/**
 * VITO BYTE STUDIO — "AUTONOMY"
 * =============================================================================
 * A deliberately FLAT film. No 3D subject anywhere: this brief is about
 * terminals, grids, metrics and pipelines, and every one of those reads better
 * with hard typography than with a camera. See DESIGN.md — 0/7 beats use 3D.
 */

export const V = {
  void: "#050B14",
  void2: "#071120",
  panel: "rgba(10, 26, 40, 0.62)",
  panelSolid: "#08192A",
  edge: "rgba(120, 200, 255, 0.12)",
  edgeHot: "rgba(0, 255, 136, 0.34)",

  green: "#00FF88",
  greenDim: "#0A9E5C",
  greenGlow: "rgba(0, 255, 136, 0.42)",
  blue: "#2E7CFF",
  blueHot: "#63B3FF",
  blueDim: "#12306B",

  white: "#E8F4FF",
  muted: "#6E8399",
  dim: "#33475C",
  alert: "#FF3D6E",
} as const;

export const W = 1080;
export const H = 1920;
export const FPS = 60;
export const DURATION = 1920; // 32.0s

/** One table. Picture cues, audio cues and the audit all read from it. */
export const BEAT = {
  boot: [0, 210], //  0.00 –  3.50
  servers: [210, 480], //  3.50 –  8.00
  agents: [480, 750], //  8.00 – 12.50
  edge: [750, 1020], // 12.50 – 17.00
  cicd: [1020, 1260], // 17.00 – 21.00
  systems: [1260, 1530], // 21.00 – 25.50
  cta: [1530, 1920], // 25.50 – 32.00
} as const;

export const F = {
  /** the full mono stack — every glyph here is covered by JetBrains Mono */
  mono: '"JetBrains Mono", monospace',
  /** display face for the few large statements */
  display: '"Space Grotesk", "Sora", sans-serif',
  body: '"Sora", "Space Grotesk", sans-serif',
} as const;

export const PAD = 76;

/** clamped linear ramp */
export const r = (f: number, a: number, b: number) => Math.min(1, Math.max(0, (f - a) / (b - a)));

/** 0 → 1 → 0, for one-shot beats */
export const win = (f: number, a: number, b: number, i = 10, o = 12) => {
  if (f < a || f > b) return 0;
  if (f < a + i) return (f - a) / i;
  if (f > b - o) return (b - f) / o;
  return 1;
};

/** deterministic pseudo-random in [0,1) — no Math.random, renders must match */
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/* -------------------------------- content -------------------------------- */

export const CITIES: { name: string; lon: number; lat: number; ms: number }[] = [
  { name: "SFO", lon: -122.4, lat: 37.8, ms: 11 },
  { name: "IAD", lon: -77.5, lat: 39.0, ms: 9 },
  { name: "GRU", lon: -46.6, lat: -23.5, ms: 18 },
  { name: "LHR", lon: -0.1, lat: 51.5, ms: 8 },
  { name: "FRA", lon: 8.7, lat: 50.1, ms: 7 },
  { name: "CDG", lon: 2.4, lat: 48.9, ms: 9 },
  { name: "DXB", lon: 55.3, lat: 25.2, ms: 14 },
  { name: "BOM", lon: 72.9, lat: 19.1, ms: 16 },
  { name: "SIN", lon: 103.8, lat: 1.4, ms: 13 },
  { name: "NRT", lon: 139.7, lat: 35.7, ms: 15 },
  { name: "SYD", lon: 151.2, lat: -33.9, ms: 19 },
  { name: "JNB", lon: 28.0, lat: -26.2, ms: 21 },
  { name: "CAI", lon: 31.2, lat: 30.0, ms: 12 },
  { name: "ORD", lon: -87.6, lat: 41.9, ms: 10 },
  { name: "AMS", lon: 4.9, lat: 52.4, ms: 8 },
  { name: "ICN", lon: 127.0, lat: 37.6, ms: 14 },
];
