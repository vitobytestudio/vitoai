/**
 * PALETTE — read a video, return the colours the graphics should use.
 *
 * The mistake this fixes: every film got the studio's mint-green skin no matter
 * what was in front of the lens. A blue-lit interview and a warm kitchen shot
 * cannot share one palette.
 *
 * Method, with no image library:
 *   1. ffmpeg samples frames across the whole clip at 48×27.
 *   2. In Node: convert to HSL, build a weighted hue histogram (weight =
 *      saturation × a mid-luminance bias, so white walls and black shirts do not
 *      vote), and find the dominant hue.
 *   3. Derive the rest by rules, not by taste:
 *        accent     dominant hue, saturation and lightness pulled into a usable
 *                   range for type on dark
 *        accent2    a second hue at +34°, kept only if it also occurs
 *        ink/ink2   near-black tinted with the dominant hue
 *        paper      near-white, tinted 3 % the same way
 *        mood       cool/warm · dark/bright · contrast
 *
 *   node studio/palette.mjs inbox/clip.mp4 src/studio/reel/palettes/talk.json
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const src = process.argv[2];
const out = process.argv[3] || "/tmp/palette.json";
if (!src) {
  console.error("usage: node studio/palette.mjs <video> [out.json]");
  process.exit(1);
}

const FFMPEG = process.env.FFMPEG || "ffmpeg";
const SAMPLES = 14;
const GW = 48;
const GH = 27;

const rgb2hsl = (r, g, b) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s, l];
};

const hsl2hex = (h, s, l) => {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const seg = Math.floor(h / 60) % 6;
  const t = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][seg];
  const to = (v) =>
    Math.round(Math.min(255, Math.max(0, (v + m) * 255)))
      .toString(16)
      .padStart(2, "0");
  return `#${to(t[0])}${to(t[1])}${to(t[2])}`.toUpperCase();
};

const meta = execFileSync(FFMPEG, ["-hide_banner", "-i", src, "-f", "null", "-"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1e7 }).toString();
let dur = 0;
let fps = 0;
try {
  const m = execFileSync(FFMPEG, ["-hide_banner", "-i", src], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  dur = Number((m.match(/Duration: (\d+):(\d+):([\d.]+)/) || []).slice(1).reduce((a, x, i) => (i === 0 ? +x * 3600 : i === 1 ? a + +x * 60 : a + +x), 0));
  fps = Number((m.match(/([\d.]+) fps/) || [0, 24])[1]);
} catch (e) {
  const m = String(e.stderr || "");
  dur = Number((m.match(/Duration: (\d+):(\d+):([\d.]+)/) || []).slice(1).reduce((a, x, i) => (i === 0 ? +x * 3600 : i === 1 ? a + +x * 60 : a + +x), 0));
  fps = Number((m.match(/([\d.]+) fps/) || [0, 24])[1]);
}
if (!dur) dur = 8;

// one raw frame, evenly spaced, per sample
const frames = [];
const step = dur / SAMPLES;
for (let i = 0; i < SAMPLES; i++) {
  const t = Math.min(dur - 0.05, i * step + step * 0.5);
  try {
    const buf = execFileSync(
      FFMPEG,
      ["-v", "error", "-ss", String(t), "-i", src, "-frames:v", "1", "-vf", `scale=${GW}:${GH}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
      { maxBuffer: 1e7, stdio: ["ignore", "pipe", "pipe"] },
    );
    if (buf.length >= GW * GH * 3) frames.push({ t, buf });
  } catch {}
}
if (!frames.length) {
  console.error("no frames decoded");
  process.exit(1);
}

const HUE_BINS = 36;
const bins = new Array(HUE_BINS).fill(0);
let satSum = 0;
let lumSum = 0;
let weightSum = 0;
let warmVotes = 0;
let coolVotes = 0;
const lums = [];

for (const { buf } of frames) {
  for (let k = 0; k < GW * GH; k++) {
    const r = buf[k * 3];
    const g = buf[k * 3 + 1];
    const b = buf[k * 3 + 2];
    const [h, s, l] = rgb2hsl(r, g, b);
    satSum += s;
    lumSum += l;
    lums.push(l);
    // mid-luminance, saturated pixels are what reads as "colour"
    const w = s * s * (1 - Math.abs(l - 0.5) * 1.1);
    if (w > 0) {
      bins[Math.floor((h / 360) * HUE_BINS) % HUE_BINS] += w;
      weightSum += w;
      if (h < 70 || h > 300) warmVotes += w;
      else if (h > 170 && h < 280) coolVotes += w;
    }
  }
}

const N = GW * GH * frames.length;
const sat = satSum / N;
const lum = lumSum / N;
lums.sort((a, b) => a - b);
const p10 = lums[Math.floor(lums.length * 0.1)];
const p90 = lums[Math.floor(lums.length * 0.9)];
const contrast = p90 - p10;

// smooth the histogram so a single dominant object cannot own the palette
const smooth = bins.map((v, i) => (bins[(i + HUE_BINS - 1) % HUE_BINS] + v * 2 + bins[(i + 1) % HUE_BINS]) / 4);
const top = [...smooth.keys()].sort((a, b) => smooth[b] - smooth[a]);
const hue1 = ((top[0] + 0.5) * 360) / HUE_BINS;
// second colour: a different family, at least 45° away, and it must actually exist
const alt = top.find((i) => {
  const h = ((i + 0.5) * 360) / HUE_BINS;
  const d = Math.min(Math.abs(h - hue1), 360 - Math.abs(h - hue1));
  return d > 45 && smooth[i] > smooth[top[0]] * 0.28;
});
const hue2 = alt === undefined ? (hue1 + 34) % 360 : ((alt + 0.5) * 360) / HUE_BINS;

const warm = warmVotes > coolVotes * 1.25 ? "warm" : coolVotes > warmVotes * 1.25 ? "cool" : "neutral";
const bright = lum > 0.52 ? "bright" : "dark";

const accent = hsl2hex(hue1, 0.62, 0.62);
const accent2 = hsl2hex(hue2, 0.55, 0.68);
const ink = hsl2hex(hue1, 0.35, 0.035);
const ink2 = hsl2hex(hue1, 0.3, 0.075);
const paper = hsl2hex(hue1, 0.06, 0.965);

const palette = {
  source: src.split("/").pop(),
  durationSec: Number(dur.toFixed(2)),
  fps,
  mood: { temperature: warm, exposure: bright, contrast: Number(contrast.toFixed(3)), saturation: Number(sat.toFixed(3)) },
  ink,
  ink2,
  paper,
  accent,
  accent2,
  // a three-stop ramp for fills, derived from the accent so charts agree with it
  ramp: [0.18, 0.34, 0.52, 0.72, 0.92].map((l) => hsl2hex(hue1, 0.5, l)),
  // what the design system needs to know
  rules: {
    surface: bright === "bright" && contrast > 0.35 ? "ink-on-paper" : "paper-on-ink",
    accentUse: warm === "cool" ? "accent reads cold: keep it small and rare" : "accent reads warm: safe as a large field",
  },
};

writeFileSync(out, JSON.stringify(palette, null, 2));
console.log(JSON.stringify(palette.mood), palette.ink, palette.accent, palette.accent2, palette.paper);
console.log(`palette → ${out}`);
