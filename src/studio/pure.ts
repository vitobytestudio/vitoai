/**
 * PURE — the maths and colour, with no renderer attached.
 *
 * These helpers are used by the worlds, the architectures and the preview. They
 * must not import Remotion, or the page pays for the video engine before the
 * visitor has typed a word.
 */
export const DW = 1080;
export const DH = 1920;
export const PAD = 92;

export const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace';
export const DISP = '"Space Grotesk", "Sora", system-ui, sans-serif';
export const ALT = '"Sora", "Space Grotesk", system-ui, sans-serif';

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const ss = (x: number) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};
/** 0 → 1 over [a,b] */
export const win = (f: number, a: number, b: number) => ss((f - a) / Math.max(1, b - a));
/** 0 → 1 → 0 */
export const pulse = (f: number, a: number, b: number) =>
  Math.min(win(f, a, (a + b) / 2), 1 - win(f, (a + b) / 2, b));

/** deterministic pseudo-random, identical on every machine */
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const rgba = (hex: string, a: number) => {
  const h = (hex || "#00FF88").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${clamp(a)})`;
};

/** blend two hex colours */
/**
 * Parse any colour this file emits. It has to accept its own output: mix()
 * returns rgb(), and mix(mix(a,b,.2), "#000", .4) is the most natural thing to
 * write. Parsing only hex silently produced NaN colours, which the browser
 * drops, which made nested blends render as transparent.
 */
const parseColor = (h: string): [number, number, number] => {
  const str = (h || "").trim();
  if (str.startsWith("rgb")) {
    const n = str.slice(str.indexOf("(") + 1, -1).split(",").map((x) => parseFloat(x));
    return [n[0] || 0, n[1] || 0, n[2] || 0];
  }
  const s = str.replace("#", "");
  if (s.length === 3) {
    return [parseInt(s[0] + s[0], 16), parseInt(s[1] + s[1], 16), parseInt(s[2] + s[2], 16)];
  }
  return [parseInt(s.slice(0, 2), 16) || 0, parseInt(s.slice(2, 4), 16) || 0, parseInt(s.slice(4, 6), 16) || 0];
};

export const mix = (a: string, b: string, t: number) => {
  const p = parseColor;
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  const q = (x: number, y: number) => Math.round(x + (y - x) * clamp(t));
  return `rgb(${q(r1, r2)},${q(g1, g2)},${q(b1, b2)})`;
};
