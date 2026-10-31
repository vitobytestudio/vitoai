/**
 * VitoAI Motion Studio — Design System
 * Single source of truth for palette, typography, easing and layout rhythm.
 */

export const FPS = 60;
export const WIDTH = 1080;
export const HEIGHT = 1920;

/** Master timeline (in frames @ 60fps) */
export const SCENES = {
  hook: { from: 0, to: 200 }, // 0.00s – 3.33s
  chaos: { from: 200, to: 420 }, // 3.33s – 7.00s
  reveal: { from: 420, to: 690 }, // 7.00s – 11.50s
  proof: { from: 690, to: 960 }, // 11.50s – 16.00s
  punch: { from: 960, to: 1176 }, // 16.00s – 19.60s
  cta: { from: 1176, to: 1332 }, // 19.60s – 22.20s
} as const;

export const DURATION = 1332;

export const COLORS = {
  void: "#03040A",
  ink: "#06070F",
  deep: "#0A0C18",
  violet: "#7C5CFF",
  violetHot: "#C4B5FD",
  cyan: "#22D3EE",
  cyanSoft: "#67E8F9",
  coral: "#FF4D6D",
  amber: "#FFB020",
  white: "#F8FAFC",
  muted: "#8B93A7",
  glass: "rgba(255,255,255,0.055)",
  glassEdge: "rgba(255,255,255,0.16)",
} as const;

export type Palette = "violet" | "cyan" | "coral" | "amber";

export const GLOW: Record<Palette, string> = {
  violet: "rgba(124,92,255,",
  cyan: "rgba(34,211,238,",
  coral: "rgba(255,77,109,",
  amber: "rgba(255,176,32,",
};

/** After Effects–style spring presets (damping / stiffness / mass) */
export const SPRINGS = {
  /** hard mechanical snap — UI, chips */
  snap: { damping: 14, stiffness: 320, mass: 0.5 },
  /** the signature "AE pop" — headings, cards */
  pop: { damping: 12, stiffness: 200, mass: 0.75 },
  /** soft cinematic settle — camera, panels */
  soft: { damping: 18, stiffness: 90, mass: 1.1 },
  /** heavy impact — logo, big statements */
  heavy: { damping: 9, stiffness: 130, mass: 1.6 },
  /** rubber overshoot — accent numbers */
  rubber: { damping: 7, stiffness: 220, mass: 0.9 },
} as const;

export const FONTS = {
  display: '"Cairo", "Tajawal", sans-serif',
  body: '"IBM Plex Sans Arabic", "Cairo", sans-serif',
  mono: '"JetBrains Mono", "Cairo", monospace',
  latin: '"Space Grotesk", "Sora", sans-serif',
  latinAlt: '"Sora", "Space Grotesk", sans-serif',
} as const;

/** Safe margins for 9:16 social formats */
export const SAFE = { x: 96, top: 180, bottom: 200 } as const;

export const BRAND = {
  name: "VitoAI",
  studio: "Motion Studio",
  tagline: "استوديو الحركة البرمجي",
  cta: "ابدأ الآن",
  handle: "vitoai.studio",
} as const;
