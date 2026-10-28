/**
 * Canvas drawing toolkit: cached glow sprites, halation, grain, gradients.
 * Sprite caching is critical — creating radial gradients per particle is ~40x
 * slower than blitting a pre-rendered sprite, and we render 1332 frames on 2 cores.
 */

type SpriteKey = string;

const cache = new Map<SpriteKey, HTMLCanvasElement>();

/** Pre-rendered radial glow (white core → transparent), tinted at blit time */
export const glowSprite = (size = 128, sharpness = 2.2): HTMLCanvasElement => {
  const key = `glow:${size}:${sharpness}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const a = Math.pow(1 - t, sharpness);
    g.addColorStop(t, `rgba(255,255,255,${a.toFixed(4)})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  cache.set(key, c);
  return c;
};

/** Soft-edged disc used for bokeh / depth-of-field blobs */
export const discSprite = (size = 256): HTMLCanvasElement => {
  const key = `disc:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.72, "rgba(255,255,255,0.42)");
  g.addColorStop(0.88, "rgba(255,255,255,0.10)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  cache.set(key, c);
  return c;
};

/** Blit a tinted glow — additive blending, GPU-cheap via canvas composite ops */
export const blitGlow = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
  sprite: HTMLCanvasElement,
) => {
  if (alpha <= 0.002 || radius <= 0.2) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  // tint by drawing the white sprite through a solid fill mask
  ctx.globalCompositeOperation = "lighter";
  const d = radius * 2;
  ctx.drawImage(sprite, x - radius, y - radius, d, d);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
};

/**
 * Tinted sprite blit: builds a one-off tinted copy per (color) and scales it.
 * Keeps multi-hue particles fast.
 */
const tinted = new Map<string, HTMLCanvasElement>();
export const tintedSprite = (color: string, size = 64): HTMLCanvasElement => {
  const key = `${color}:${size}`;
  const hit = tinted.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(0.45, color.replace(/[\d.]+\)$/, "0.55)"));
  g.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tinted.set(key, c);
  return c;
};

export const blitTinted = (
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number,
  y: number,
  radius: number,
  alpha: number,
) => {
  if (alpha <= 0.004 || radius <= 0.15) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
};

/** Anamorphic horizontal streak */
export const blitStreak = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  alpha: number,
) => {
  if (alpha <= 0.004) return;
  const g = ctx.createLinearGradient(x - w / 2, y, x + w / 2, y);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.5, color.replace(/[\d.]+\)$/, `${Math.min(1, alpha)})`));
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g;
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.restore();
};

/** Restore-safe canvas frame helper */
export const frame = (ctx: CanvasRenderingContext2D, fn: () => void) => {
  ctx.save();
  fn();
  ctx.restore();
};
