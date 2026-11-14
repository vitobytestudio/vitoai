import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill } from "remotion";
import { NX } from "../nexus/palette";

/**
 * PHOTOGRAPHIC FINISH
 * =============================================================================
 * One canvas, one composite. The things that separate "motion graphics" from
 * "looks like a camera shot it" are almost all in this file:
 *
 *   · halation   — bright areas bleed into their surroundings
 *   · veiling glare from the light source
 *   · anamorphic streaks on the hottest points
 *   · grain that moves per frame (a static grain reads as a dirty lens)
 *   · vignette   — cached once, never rebuilt
 *   · gate flicker — ±0.6% exposure wander
 *
 * Cached surfaces are module-level: rebuilding a gradient every frame is the
 * classic way to drop this renderer to a crawl.
 */

const W = 1080;
const H = 1920;

let vig: HTMLCanvasElement | null = null;
const getVignette = () => {
  if (vig) return vig;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(W / 2, H * 0.46, H * 0.16, W / 2, H * 0.46, H * 0.78);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.52, "rgba(0,0,0,0.22)");
  g.addColorStop(0.78, "rgba(0,0,0,0.58)");
  g.addColorStop(1, "rgba(0,0,0,0.86)");
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  vig = c;
  return c;
};

let grainTiles: HTMLCanvasElement[] = [];
const getGrain = () => {
  if (grainTiles.length) return grainTiles;
  for (let n = 0; n < 4; n++) {
    const c = document.createElement("canvas");
    c.width = 220;
    c.height = 220;
    const x = c.getContext("2d")!;
    const img = x.createImageData(220, 220);
    const seed = 1234 + n * 977;
    let s = seed;
    for (let i = 0; i < img.data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const v = 90 + (s % 120);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 30;
    }
    x.putImageData(img, 0, 0);
    grainTiles.push(c);
  }
  return grainTiles;
};

export type PostProps = {
  frame: number;
  /** 0..1 white flash */
  flash?: number;
  /** "r,g,b" — colour of the flash */
  flashRGB?: string;
  /** 0..1 */
  vignette?: number;
  grain?: number;
  /** 0..1 anamorphic streak strength at the light source */
  halo?: number;
  lightX?: number;
  lightY?: number;
  haloRGB?: string;
  /** ±exposure wander amount */
  flicker?: number;
  /** vertical smear lines, as a cheap stand-in for a fast pan */
  smear?: number;
  accent?: string;
};

export const Post: React.FC<PostProps> = ({
  frame,
  flash = 0,
  flashRGB = "255,255,255",
  vignette = 0.9,
  grain = 0.1,
  halo = 0,
  lightX = W / 2,
  lightY = H * 0.42,
  haloRGB = "92,255,184",
  flicker = 0.006,
  smear = 0,
  accent = NX.green,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    /* ------------------------------ halation ------------------------------ */
    if (halo > 0.01) {
      const g = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, 700);
      g.addColorStop(0, `rgba(${haloRGB},${0.22 * halo})`);
      g.addColorStop(0.35, `rgba(${haloRGB},${0.07 * halo})`);
      g.addColorStop(1, `rgba(${haloRGB},0)`);
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // anamorphic bar — the horizontal streak a real lens throws
      const bar = ctx.createLinearGradient(0, lightY, W, lightY);
      bar.addColorStop(0, `rgba(${haloRGB},0)`);
      bar.addColorStop(0.5, `rgba(${haloRGB},${0.5 * halo})`);
      bar.addColorStop(1, `rgba(${haloRGB},0)`);
      ctx.fillStyle = bar;
      ctx.fillRect(0, lightY - 1.5, W, 3);
      ctx.globalAlpha = 0.2 * halo;
      ctx.fillRect(0, lightY - 7, W, 14);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    /* -------------------------------- smear ------------------------------- */
    if (smear > 0.01) {
      // horizontal light streaks pulled across the frame — the cheapest honest
      // way to suggest a whip pan without a full-frame blur pass
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 26; i++) {
        const y = ((i * 97 + frame * 11) % H);
        const len = 240 + ((i * 53) % 620);
        const x = (W / 2) - len / 2 + Math.sin(i * 2.3 + frame * 0.4) * 240;
        const g = ctx.createLinearGradient(x, y, x + len, y);
        g.addColorStop(0, `rgba(${haloRGB},0)`);
        g.addColorStop(0.5, `rgba(${haloRGB},${0.05 * smear})`);
        g.addColorStop(1, `rgba(${haloRGB},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x, y, len, 1.4);
      }
      ctx.globalCompositeOperation = "source-over";
    }

    /* ------------------------------- vignette ------------------------------ */
    ctx.globalAlpha = vignette;
    ctx.drawImage(getVignette(), 0, 0);
    ctx.globalAlpha = 1;

    /* -------------------------------- grain ------------------------------- */
    if (grain > 0.001) {
      const tiles = getGrain();
      const t = tiles[frame % tiles.length];
      const ox = (frame * 37) % 220;
      const oy = (frame * 61) % 220;
      ctx.globalAlpha = grain;
      ctx.globalCompositeOperation = "overlay";
      for (let y = -220; y < H; y += 220) {
        for (let x = -220; x < W; x += 220) {
          ctx.drawImage(t, x + ox, y + oy);
        }
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    /* -------------------------------- flash -------------------------------- */
    if (flash > 0.004) {
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, 1200);
      g.addColorStop(0, `rgba(${flashRGB},${Math.min(1, flash)})`);
      g.addColorStop(0.55, `rgba(${flashRGB},${Math.min(1, flash) * 0.35})`);
      g.addColorStop(1, `rgba(${flashRGB},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
    }
  }, [frame, flash, flashRGB, vignette, grain, halo, lightX, lightY, haloRGB, smear, accent]);

  /* gate flicker is a DOM opacity nudge — no canvas work at all */
  const fl = 1 + Math.sin(frame * 1.7) * Math.sin(frame * 0.41) * flicker;

  return (
    <>
      <AbsoluteFill style={{ opacity: fl, pointerEvents: "none" }}>
        <canvas ref={ref} width={W} height={H} style={{ width: "100%", height: "100%" }} />
      </AbsoluteFill>
    </>
  );
};
