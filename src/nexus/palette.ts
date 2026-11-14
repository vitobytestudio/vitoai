/**
 * NEXUS — global entrepreneur platform
 * =============================================================================
 * Palette: emerald × electric blue on near-black. Every element is either
 * structure (a hairline) or light (a glow) — nothing in between.
 */

export const NX = {
  ink: "#03070A",
  ink2: "#050C12",
  panel: "rgba(255,255,255,0.035)",
  edge: "rgba(255,255,255,0.10)",
  edgeHot: "rgba(92,255,184,0.42)",

  /** primary emerald */
  green: "#00E08A",
  greenHot: "#5CFFB8",
  greenDeep: "#008A56",

  /** primary electric blue */
  blue: "#2BB8FF",
  blueHot: "#7AD4FF",
  blueDeep: "#0A46C8",

  white: "#F2FBFF",
  muted: "#7C93A3",
  dim: "#3C4E5C",

  /** only ever used for threat beats */
  red: "#FF3B5C",
} as const;

export const W = 1080;
export const H = 1920;

/** authored at 30fps — 60.0 seconds exactly. One timeline, no clock scaling. */
export const FPS_AUTH = 30;
export const DURATION = 1800;

/**
 * Nine movements. Picture and score share these numbers, so a cue can never
 * drift: the audio engine derives every hit from this table.
 */
export const MOVE = {
  ignite: [0, 120], //  0.0 –  4.0
  globe: [120, 360], //  4.0 – 12.0
  services: [360, 600], // 12.0 – 20.0
  bots: [600, 840], // 20.0 – 28.0
  support: [840, 1050], // 28.0 – 35.0
  cyber: [1050, 1200], // 35.0 – 40.0
  heal: [1200, 1380], // 40.0 – 46.0
  proof: [1380, 1560], // 46.0 – 52.0
  cta: [1560, 1800], // 52.0 – 60.0
} as const;

export const T = {
  display: '"Space Grotesk", "Sora", sans-serif',
  body: '"Sora", "Space Grotesk", sans-serif',
  mono: '"JetBrains Mono", monospace',
} as const;

export const PAD = 96;

/** linear ramp helper, clamped */
export const r = (f: number, a: number, b: number) => Math.max(0, Math.min(1, (f - a) / (b - a)));
