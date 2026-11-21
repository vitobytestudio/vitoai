/**
 * CLOUDFLARE — "ONE NETWORK" concept ad
 * =============================================================================
 * A departure from the VitoAI violet look on purpose: Cloudflare's brand is
 * built on ONE warm orange against near-black. Premium here means restraint —
 * lots of void, a single hero object, and typography doing the shouting.
 */

export const CF = {
  /** Cloudflare brand orange */
  orange: "#F6821F",
  orangeHot: "#FFA24B",
  orangeDeep: "#B9480A",
  /** warm highlight used only on the brightest elements */
  amber: "#FFD9A8",
  /** true black — the ad lives in darkness so the orange reads as light */
  ink: "#050506",
  charcoal: "#0C0C10",
  white: "#FAFAFA",
  grey: "#8C8C96",
  greyDim: "#4A4A55",
  /** attack traffic — used for exactly 4 seconds, then never again */
  threat: "#FF4233",
} as const;

export const FPS = 60;
export const WIDTH = 1080;
export const HEIGHT = 1920;

/**
 * Six movements. Every cut is frame-exact and every one has an audio cue, so
 * picture and sound hit the same millisecond.
 */
export const TL = {
  void: { from: 0, to: 200 }, // 0.00 – 3.33  a dot in the dark
  ignite: { from: 200, to: 520 }, // 3.33 – 8.67  the network assembles
  arcs: { from: 520, to: 850 }, // 8.67 – 14.17 light across the globe
  guard: { from: 850, to: 1090 }, // 14.17 – 18.17 everything gets stopped
  logo: { from: 1090, to: 1250 }, // 18.17 – 20.83 the mark
  cta: { from: 1250, to: 1380 }, // 20.83 – 23.00 the ask
} as const;

export const CF_DURATION = 1380;

/** Latin / Arabic type stacks resolved from the bundled data-URI faces */
export const TYPE = {
  ar: '"Cairo", "Tajawal", sans-serif',
  en: '"Space Grotesk", "Sora", sans-serif',
  mono: '"JetBrains Mono", monospace',
} as const;

export const SAFE_X = 96;
