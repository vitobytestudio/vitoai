import React, { useEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, HEIGHT, WIDTH } from "../theme";
import { clamp, noise1, rgba, smoothstep } from "../lib/math";

/**
 * SINGLE-PASS COMPOSITOR
 * ------------------------------------------------------------------------
 * Every full-frame finish (flash, light leak, vignette, grain, scanlines, HUD,
 * wipe bands) is painted into ONE canvas instead of a dozen blended DOM layers.
 *
 * Why: with software rasterisation each extra blended layer costs a full-frame
 * read-modify-write; stacking ~10 of them was slow and could take the renderer
 * down. One canvas = one composite, deterministic output, ~6x fewer pixels
 * touched per frame.
 */

export type FlashCue = { frame: number; color: string; power: number; decay: number };
export type LeakCue = { frame: number; color: string; power: number; angle: number };
export type WipeCue = { frame: number; duration: number; bands: number };

export type OverlayProps = {
  flashes?: FlashCue[];
  leaks?: LeakCue[];
  wipes?: WipeCue[];
  shakeCues?: number[];
  vignette?: number;
  grain?: number;
  scanlines?: number;

  durationInFrames?: number;
  /** 0..1 — RGB fringe strength on impact frames */
  chroma?: number;
  /** soft light sweeps that mask a cut */
  shutters?: { frame: number; duration: number; color: string }[];
};

/* ---------------------------- cached surfaces ---------------------------- */

let grainTile: HTMLCanvasElement | null = null;
const getGrain = () => {
  if (grainTile) return grainTile;
  const c = document.createElement("canvas");
  c.width = 160;
  c.height = 160;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 96 + Math.random() * 128;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 26;
  }
  ctx.putImageData(img, 0, 0);
  grainTile = c;
  return c;
};

let vignetteCache: HTMLCanvasElement | null = null;
const getVignette = (strength: number) => {
  if (vignetteCache) return vignetteCache;
  const c = document.createElement("canvas");
  c.width = WIDTH;
  c.height = HEIGHT;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(WIDTH / 2, HEIGHT * 0.46, HEIGHT * 0.18, WIDTH / 2, HEIGHT * 0.46, HEIGHT * 0.72);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.62, `rgba(0,0,0,${strength * 0.42})`);
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  vignetteCache = c;
  return c;
};

/* -------------------------------- renderer ------------------------------- */

const draw = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  fps: number,
  total: number,
  o: Required<OverlayProps>,
) => {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  /* ---- flash / exposure hits ---- */
  for (const c of o.flashes) {
    const t = frame - c.frame;
    if (t < 0 || t > 22) continue;
    const a = Math.pow(1 - t / 22, c.decay) * c.power;
    const g = ctx.createRadialGradient(WIDTH / 2, HEIGHT * 0.45, 0, WIDTH / 2, HEIGHT * 0.45, HEIGHT * 0.62);
    g.addColorStop(0, rgba(c.color, a));
    g.addColorStop(0.45, rgba(c.color, a * 0.32));
    g.addColorStop(1, rgba(c.color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  /* ---- anamorphic light leaks ---- */
  for (const l of o.leaks) {
    const t = (frame - l.frame) / 26;
    if (t < 0 || t > 1) continue;
    const env = Math.sin(t * Math.PI) * l.power;
    ctx.save();
    ctx.translate(WIDTH / 2, HEIGHT / 2);
    ctx.rotate((l.angle * Math.PI) / 180);
    const sway = (t - 0.5) * 220;
    const g = ctx.createLinearGradient(-WIDTH, sway, WIDTH, sway);
    g.addColorStop(0, rgba(l.color, 0));
    g.addColorStop(0.34, rgba(l.color, 0.16 * env));
    g.addColorStop(0.5, rgba("#FFFFFF", 0.4 * env));
    g.addColorStop(0.66, rgba(l.color, 0.16 * env));
    g.addColorStop(1, rgba(l.color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-HEIGHT, -HEIGHT, HEIGHT * 2, HEIGHT * 2);
    ctx.restore();
  }

  /* ---- chromatic aberration (three offset channel plates) ---- */
  if (o.chroma > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = clamp(o.chroma * 0.5);
    const dx = o.chroma * 9;
    const g1 = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    g1.addColorStop(0, "rgba(255,0,70,0.25)");
    g1.addColorStop(0.5, "rgba(255,0,70,0)");
    ctx.fillStyle = g1;
    ctx.translate(-dx, 0);
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g2 = ctx.createLinearGradient(WIDTH, 0, 0, HEIGHT);
    g2.addColorStop(0, "rgba(0,225,255,0.22)");
    g2.addColorStop(0.5, "rgba(0,225,255,0)");
    ctx.fillStyle = g2;
    ctx.translate(dx, 0);
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.restore();
  }

  /* ---- scanlines ---- */
  if (o.scanlines > 0) {
    ctx.fillStyle = `rgba(255,255,255,${o.scanlines * 0.1})`;
    const off = frame % 4;
    for (let y = -off; y < HEIGHT; y += 4) ctx.fillRect(0, y, WIDTH, 1);
  }

  /* ---- vignette ---- */
  if (o.vignette > 0) {
    ctx.drawImage(getVignette(o.vignette), 0, 0);
  }

  /* ---- wipes ---- */
  for (const w of o.wipes) {
    const t = (frame - w.frame) / w.duration;
    if (t < 0 || t > 1) continue;
    for (let i = 0; i < w.bands; i++) {
      const stagger = i * 0.075;
      const local = clamp((t - stagger) / (1 - stagger * (w.bands - 1)));
      const p = smoothstep(0, 1, local);
      const h = HEIGHT / w.bands + 2;
      const dir = i % 2 === 0 ? 1 : -1;
      const x = (1 - p) * WIDTH * dir;
      ctx.globalAlpha = 1 - smoothstep(0.72, 1, local);
      ctx.fillStyle = i % 2 === 0 ? "#04050C" : rgba(COLORS.violet, 0.28);
      ctx.save();
      ctx.translate(x + WIDTH / 2, h * i + h / 2);
      ctx.transform(1, 0, -0.06, 1, 0, 0);
      ctx.fillRect(-WIDTH / 2, -h / 2, WIDTH, h);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  /* ---- shutter: a single soft luminance sweep across the cut ---- */
  for (const sh of o.shutters) {
    const t = (frame - sh.frame) / sh.duration;
    if (t < 0 || t > 1) continue;
    const env = Math.sin(t * Math.PI);
    const cx = -0.25 * WIDTH + t * 1.5 * WIDTH;
    const g = ctx.createLinearGradient(cx - 380, 0, cx + 380, HEIGHT);
    g.addColorStop(0, rgba(sh.color, 0));
    g.addColorStop(0.46, rgba("#FFFFFF", 0.16 * env));
    g.addColorStop(0.5, rgba(sh.color, 0.34 * env));
    g.addColorStop(0.54, rgba("#FFFFFF", 0.16 * env));
    g.addColorStop(1, rgba(sh.color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  /* ---- film grain ---- */
  if (o.grain > 0) {
    const tile = getGrain();
    ctx.globalAlpha = o.grain * 6;
    const ox = (frame * 47) % 160;
    const oy = (frame * 71) % 160;
    for (let y = -oy; y < HEIGHT; y += 160) {
      for (let x = -ox; x < WIDTH; x += 160) {
        ctx.drawImage(tile, x, y);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---- shutter jitter on impacts (adds affordable motion blur feel) ---- */
  if (o.shakeCues.length) {
    let extra = 0;
    for (const c of o.shakeCues) {
      const t = frame - c;
      if (t >= 0 && t < 12) extra += Math.exp(-t / 3.4);
    }
    if (extra > 0.02) {
      ctx.save();
      ctx.globalAlpha = clamp(extra * 0.22);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      const y = (noise1(frame * 0.7) * 0.5 + 0.5) * HEIGHT;
      ctx.fillRect(0, y, WIDTH, 2);
      ctx.restore();
    }
  }
};

export const OverlayLayer: React.FC<OverlayProps> = ({
  flashes = [],
  leaks = [],
  wipes = [],
  shutters = [],
  shakeCues = [],
  vignette = 0.78,
  grain = 0.03,
  scanlines = 0,

  durationInFrames,
  chroma = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: total } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const totalFrames = durationInFrames ?? total;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    draw(ctx, frame, fps, totalFrames, {
      flashes,
      leaks,
      wipes,
      shutters,
      shakeCues,
      vignette,
      grain,
      scanlines,

      durationInFrames: totalFrames,
      chroma,
    });
  }, [frame, fps, totalFrames, flashes, leaks, wipes, shutters, shakeCues, vignette, grain, scanlines, chroma]);

  return (
    <AbsoluteFill>
      <canvas ref={ref} width={WIDTH} height={HEIGHT} style={{ width: WIDTH, height: HEIGHT }} />
    </AbsoluteFill>
  );
};
