/**
 * Overlay kit — "upload a video, we produce on it".
 *
 * The uploaded clip is never re-encoded through a server. It plays in a hidden
 * <video>, each frame is drawn to a canvas with the motion graphics composited
 * on top, and MediaRecorder captures that canvas. Everything happens on the
 * visitor's machine.
 */

export type OverlayOptions = {
  kicker: string;
  headline: string;
  cta: string;
  accent: string;
  /** burned mark in the corner */
  brand: boolean;
  /** lower third vs full-frame title card */
  layout: "lower-third" | "title" | "hud";
};

const hexRgb = (hex: string) => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) || 0,
    parseInt(h.slice(2, 4), 16) || 0,
    parseInt(h.slice(4, 6), 16) || 0,
  ] as [number, number, number];
};
const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

const MONO = '"JetBrains Mono", ui-monospace, monospace';
const DISP = '"Space Grotesk", "Sora", sans-serif';

/** the V, drawn as strokes so it stays crisp at any size */
const drawMark = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.1);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + size * 0.5, y + size * 0.92);
  ctx.lineTo(x + size, y);
  ctx.stroke();
  ctx.globalAlpha = alpha * 0.5;
  ctx.lineWidth = Math.max(1.5, size * 0.08);
  ctx.beginPath();
  ctx.moveTo(x + size * 0.14, y + size * 1.04);
  ctx.lineTo(x + size * 0.86, y + size * 1.04);
  ctx.stroke();
  ctx.restore();
};

const easeOut = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

export const drawOverlay = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  progress: number,
  o: OverlayOptions,
) => {
  const s = W / 1080; // everything is authored against a 1080-wide frame
  const A = o.accent || "#00FF88";

  // ---------------------------------------------------------------- brand
  if (o.brand) {
    drawMark(ctx, 54 * s, 54 * s, 34 * s, A, 0.9);
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = "#E8F4FF";
    ctx.font = `600 ${18 * s}px ${DISP}`;
    ctx.letterSpacing = `${3 * s}px`;
    ctx.fillText("VITO BYTE", 104 * s, 78 * s);
    ctx.restore();
  }

  // ------------------------------------------------------------- hud grid
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = A;
  ctx.lineWidth = 1;
  const step = 84 * s;
  for (let y = H * 0.12; y < H * 0.9; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(24 * s, y);
    ctx.stroke();
  }
  ctx.restore();

  // --------------------------------------------------------------- corner
  const bracket = (x: number, y: number, dx: number, dy: number) => {
    const L = 40 * s;
    ctx.beginPath();
    ctx.moveTo(x, y + dy * L);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * L, y);
    ctx.stroke();
  };
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = A;
  ctx.lineWidth = 1.6 * s;
  bracket(46 * s, 160 * s, 1, 1);
  bracket(W - 46 * s, 160 * s, -1, 1);
  bracket(46 * s, H - 160 * s, 1, -1);
  bracket(W - 46 * s, H - 160 * s, -1, -1);
  ctx.restore();

  // ------------------------------------------------------------- content
  const inAt = easeOut((progress - 0.04) / 0.12);
  const outAt = 1 - easeOut((progress - 0.92) / 0.08);

  if (o.layout === "lower-third") {
    const y = H * 0.72;
    const slide = (1 - inAt) * 40 * s;
    ctx.save();
    ctx.globalAlpha = inAt * outAt;

    // plate
    ctx.fillStyle = "rgba(4,10,18,0.82)";
    const px = 54 * s;
    const pw = Math.min(W - 108 * s, 900 * s);
    const ph = 150 * s;
    ctx.fillRect(px, y + slide, pw, ph);

    // accent edge
    ctx.fillStyle = A;
    ctx.fillRect(px, y + slide, 6 * s, ph);

    ctx.fillStyle = A;
    ctx.font = `500 ${16 * s}px ${MONO}`;
    ctx.letterSpacing = `${4 * s}px`;
    ctx.fillText((o.kicker || "").toUpperCase(), px + 26 * s, y + 46 * s + slide);

    ctx.fillStyle = "#F2F8FF";
    ctx.font = `600 ${40 * s}px ${DISP}`;
    ctx.letterSpacing = "0px";
    ctx.fillText(o.headline.replace(/\n/g, " ").slice(0, 34), px + 26 * s, y + 100 * s + slide);

    ctx.fillStyle = rgba(A, 0.85);
    ctx.font = `500 ${18 * s}px ${MONO}`;
    ctx.letterSpacing = `${2 * s}px`;
    ctx.fillText(o.cta, px + 26 * s, y + 132 * s + slide);
    ctx.restore();
  }

  if (o.layout === "title") {
    const y = H * 0.42;
    ctx.save();
    ctx.globalAlpha = inAt * outAt;
    ctx.fillStyle = "rgba(4,10,18,0.66)";
    ctx.fillRect(0, y - 30 * s, W, 300 * s);
    ctx.fillStyle = A;
    ctx.fillRect(0, y - 30 * s, W, 4 * s);

    ctx.fillStyle = A;
    ctx.font = `500 ${18 * s}px ${MONO}`;
    ctx.letterSpacing = `${5 * s}px`;
    ctx.fillText((o.kicker || "").toUpperCase(), 54 * s, y + 24 * s);

    ctx.fillStyle = "#F2F8FF";
    const size = o.headline.replace(/\n/g, " ").length > 22 ? 68 * s : 88 * s;
    ctx.font = `700 ${size}px ${DISP}`;
    ctx.letterSpacing = `${-2 * s}px`;
    const lines = o.headline.split("\n");
    lines.forEach((l, i) => ctx.fillText(l, 54 * s, y + (96 + i * 78) * s));
    ctx.restore();
  }

  if (o.layout === "hud") {
    ctx.save();
    ctx.globalAlpha = inAt * outAt * 0.9;
    // right rail
    const rx = W - 64 * s;
    ctx.strokeStyle = rgba(A, 0.5);
    ctx.lineWidth = 1.4 * s;
    ctx.beginPath();
    ctx.moveTo(rx, 220 * s);
    ctx.lineTo(rx, H - 220 * s);
    ctx.stroke();

    ctx.fillStyle = A;
    for (let i = 0; i < 26; i++) {
      const t = i / 26;
      const h = 3 + Math.abs(Math.sin(i * 1.7 + progress * 12)) * 18;
      ctx.globalAlpha = inAt * outAt * (0.35 + 0.65 * (1 - t));
      ctx.fillRect(rx - h * 1.6, 240 * s + t * (H - 500) * s, h * 1.6, 2.4 * s);
    }
    ctx.globalAlpha = inAt * outAt;
    ctx.fillStyle = A;
    ctx.font = `500 ${15 * s}px ${MONO}`;
    ctx.letterSpacing = `${3 * s}px`;
    ctx.fillText((o.kicker || "").toUpperCase(), 54 * s, H - 132 * s);
    ctx.fillStyle = "#F2F8FF";
    ctx.font = `600 ${30 * s}px ${DISP}`;
    ctx.letterSpacing = "0px";
    ctx.fillText(o.headline.replace(/\n/g, " ").slice(0, 30), 54 * s, H - 92 * s);
    ctx.restore();
  }

  // ------------------------------------------------------------ progress
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(0, H - 6 * s, W, 6 * s);
  ctx.fillStyle = A;
  ctx.fillRect(0, H - 6 * s, W * progress, 6 * s);
  ctx.restore();
};

/* -------------------------------------------------------------------------- */

export type OverlayResult = { blob: Blob; mime: string; seconds: number };

const pickMime = (): string => {
  const options = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const m of options) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "video/webm";
};

export const renderOverlay = async (
  file: File,
  o: OverlayOptions,
  onProgress?: (p: number) => void,
): Promise<OverlayResult> => {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.src = url;
  v.muted = true;
  v.playsInline = true;

  await new Promise<void>((res, rej) => {
    v.onloadedmetadata = () => res();
    v.onerror = () => rej(new Error("This file could not be decoded by the browser."));
  });

  // cap the working surface — a 4K clip does not need 4K to carry a lower third
  const maxW = 1080;
  const scale = Math.min(1, maxW / (v.videoWidth || maxW));
  const W = Math.max(2, Math.round((v.videoWidth || maxW) * scale) & ~1);
  const H = Math.max(2, Math.round((v.videoHeight || 1920) * scale) & ~1);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas unavailable.");

  const stream = canvas.captureStream(30);
  const mime = pickMime();
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const done = new Promise<Blob>((res) => {
    rec.onstop = () => res(new Blob(chunks, { type: mime }));
  });

  const total = v.duration || 0;
  rec.start(250);
  await v.play();

  await new Promise<void>((res) => {
    let raf = 0;
    const tick = () => {
      const p = total > 0 ? Math.min(1, v.currentTime / total) : 0;
      ctx.drawImage(v, 0, 0, W, H);
      drawOverlay(ctx, W, H, p, o);
      onProgress?.(p);
      if (v.ended || p >= 0.999) {
        cancelAnimationFrame(raf);
        res();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });

  // let the last frame land before closing the muxer
  await new Promise((r) => setTimeout(r, 320));
  rec.stop();
  v.pause();
  URL.revokeObjectURL(url);

  const blob = await done;
  return { blob, mime, seconds: total };
};

export const download = (blob: Blob, name: string) => {
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
};
