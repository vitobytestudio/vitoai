/**
 * BRIEF — read a clip, decide what film it is.
 *
 * The rule this enforces: no house grammar. A clip is measured, and the
 * measurement picks the treatment — including how *little* to put on screen.
 *
 * What is measured, from the file itself:
 *   cuts          scene changes (ffmpeg scene detection), with per-shot length
 *   speech        voiced segments from the waveform envelope
 *   motion        frame-to-frame difference, per shot, on a downscaled proxy
 *   light         mean luminance and contrast per shot
 *   palette       delegated to studio/palette.mjs, which samples the whole clip
 *
 * What is decided, by rule rather than taste:
 *   grammar       portrait · dispatch · montage · essay
 *   ornament     0–3. How many design devices a shot may carry.
 *   type          a scale that suits the grammar, in px at 1080×1920
 *   frame         how the footage sits in a 9:16 canvas
 *   beats         where the picture and the type are allowed to change
 *
 *   node studio/brief.mjs inbox/clip.mp4 src/studio/reel/plans/talk.json
 */
import { execFileSync, spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

const src = process.argv[2];
const out = process.argv[3] || "/tmp/plan.json";
if (!src) {
  console.error("usage: node studio/brief.mjs <video> [out.json]");
  process.exit(1);
}
const FFMPEG = process.env.FFMPEG || "ffmpeg";

const ff = (args, opts = {}) =>
  execFileSync(FFMPEG, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1e8, ...opts });

/* --------------------------------------------------------------- the file */

let info = "";
try {
  info = ff(["-hide_banner", "-i", src]);
} catch (e) {
  info = String(e.stderr || "");
}
const dur = Number(
  (info.match(/Duration: (\d+):(\d+):([\d.]+)/) || [0, 0, 0, 8])
    .slice(1)
    .reduce((a, x, i) => (i === 0 ? +x * 3600 : i === 1 ? a + +x * 60 : a + +x), 0),
);
const fps = Number((info.match(/([\d.]+) fps/) || [0, 24])[1]) || 24;
const dims = (info.match(/, (\d{2,5})x(\d{2,5})/) || [0, 1280, 720]).slice(1).map(Number);
const AR = dims[0] / dims[1];

/* ------------------------------------------------------------------ cuts */

const cuts = [0];
// showinfo writes to stderr, so this has to read stderr on success too — the
// naive execFileSync path silently returns an empty string and finds no cuts.
{
  const r = spawnSync(FFMPEG, ["-hide_banner", "-i", src, "-vf", "select='gt(scene,0.22)',showinfo", "-f", "null", "-"], {
    encoding: "utf8",
    maxBuffer: 1e8,
  });
  const log = `${r.stdout || ""}${r.stderr || ""}`;
  for (const m of log.matchAll(/pts_time:([\d.]+)/g)) {
    const t = Number(m[1]);
    if (t > 0.15 && t < dur - 0.1 && t - cuts[cuts.length - 1] > 0.4) cuts.push(Number(t.toFixed(3)));
  }
}
cuts.push(Number(dur.toFixed(3)));
const shots = cuts.slice(0, -1).map((t, i) => ({ index: i, start: t, end: cuts[i + 1], len: Number((cuts[i + 1] - t).toFixed(3)) }));
const lens = shots.map((s) => s.len);
const avgShot = lens.reduce((a, b) => a + b, 0) / Math.max(1, lens.length);

/* ---------------------------------------------------------------- speech */

let speech = [];
try {
  const wav = "/tmp/_brief.wav";
  ff(["-y", "-i", src, "-vn", "-ac", "1", "-ar", "16000", wav]);
  const raw = execFileSync("python3", [
    "-",
    wav,
  ], {
    input: `
import wave, struct, math, sys
w = wave.open("${wav}", "rb")
sr, n = w.getframerate(), w.getnframes()
s = struct.unpack("<%dh" % n, w.readframes(n))
win = int(sr * 0.04)
env = []
for i in range(0, n - win, win):
    seg = s[i:i + win]
    rms = (sum(v * v for v in seg) / len(seg)) ** 0.5
    env.append((i / sr, 20 * math.log10(max(rms, 1) / 32768)))
segs, cur, last = [], None, 0
for t, db in env:
    if db > -38:
        if cur is None: cur = t
        last = t
    elif cur is not None and t - cur > 0.05:
        segs.append((cur, last + 0.04)); cur = None
if cur is not None: segs.append((cur, last + 0.04))
segs = [(round(a, 2), round(b, 2)) for a, b in segs if b - a >= 0.12]
print(" ".join(f"{a}-{b}" for a, b in segs))
`,
    encoding: "utf8",
  }).trim();
  speech = raw
    ? raw.split(" ").map((p) => {
        const [a, b] = p.split("-").map(Number);
        return { start: a, end: b };
      })
    : [];
} catch {}

/* --------------------------------------------------- motion and light */

const GW = 40;
const GH = 24;
const shotsData = [];
try {
  const buf = execFileSync(
    FFMPEG,
    ["-v", "error", "-i", src, "-vf", `fps=6,scale=${GW}:${GH},format=gray`, "-f", "rawvideo", "-pix_fmt", "gray", "-"],
    { maxBuffer: 4e8 },
  );
  const fs = GW * GH;
  const n = Math.floor(buf.length / fs);
  for (const s of shots) {
    const from = Math.floor(s.start * 6);
    const to = Math.min(n, Math.floor(s.end * 6));
    let diff = 0;
    let cnt = 0;
    let lum = 0;
    const vals = [];
    for (let k = from; k < to; k++) {
      let m = 0;
      for (let i = 0; i < fs; i++) m += buf[k * fs + i];
      lum += m / fs;
      vals.push(m / fs);
      if (k > from) {
        let d = 0;
        for (let i = 0; i < fs; i++) d += Math.abs(buf[k * fs + i] - buf[(k - 1) * fs + i]);
        diff += d / fs;
        cnt++;
      }
    }
    const mean = lum / Math.max(1, to - from);
    vals.sort((a, b) => a - b);
    shotsData.push({
      ...s,
      motion: Number((cnt ? diff / cnt / 255 : 0).toFixed(3)),
      lum: Number((mean / 255).toFixed(3)),
      contrast: Number((((vals[Math.floor(vals.length * 0.9)] || 0) - (vals[Math.floor(vals.length * 0.1)] || 0)) / 255).toFixed(3)),
    });
  }
} catch {
  for (const s of shots) shotsData.push({ ...s, motion: 0, lum: 0.5, contrast: 0.4 });
}

/* --------------------------------------------------------------- palette */

let palette = null;
try {
  const palOut = "/tmp/_brief-palette.json";
  execFileSync("node", ["studio/palette.mjs", src, palOut], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  palette = JSON.parse(execFileSync("cat", [palOut], { encoding: "utf8" }));
} catch {}

/* ------------------------------------------------------------ the decision */

const speechTotal = speech.reduce((a, x) => a + (x.end - x.start), 0);
const talkDensity = speechTotal / Math.max(0.5, dur); // 0..1 of the timeline voiced
const motionAvg = shotsData.reduce((a, s) => a + s.motion, 0) / Math.max(1, shotsData.length);
const bright = shotsData.reduce((a, s) => a + s.lum, 0) / Math.max(1, shotsData.length);

let grammar;
const why = [];
if (talkDensity > 0.55 && avgShot >= 1.2) {
  grammar = "portrait";
  why.push(`speech covers ${(talkDensity * 100) | 0}% of the clip and the average shot is ${avgShot.toFixed(1)}s — let the person carry it`);
} else if (talkDensity > 0.3 && avgShot < 1.4) {
  grammar = "dispatch";
  why.push(`talk over fast cutting (${avgShot.toFixed(1)}s per shot) — type punctuates, footage leads`);
} else if (talkDensity <= 0.3 && motionAvg > 0.05) {
  grammar = "montage";
  why.push(`little speech and steady motion (${motionAvg.toFixed(3)}) — cut on movement, one idea per shot`);
} else {
  grammar = "essay";
  why.push(`sparse speech, calm picture — build the argument in the margins`);
}

// ornament budget: how many devices one shot may carry. Restraint is a number.
let ornament = 2;
if (grammar === "portrait") ornament = talkDensity > 0.7 ? 1 : 2;
if (grammar === "dispatch") ornament = 2;
if (grammar === "montage") ornament = 3;
if (grammar === "essay") ornament = 2;
if (bright > 0.62) {
  ornament = Math.max(1, ornament - 1);
  why.push(`the footage is bright (${bright.toFixed(2)}), so heavy chrome would fight it — one device fewer`);
}

const frame =
  AR > 1.2
    ? { mode: "ambient-letterbox", note: "wide source in a tall canvas: blurred self as the bed, sharp picture at native ratio" }
    : AR < 0.85
      ? { mode: "full-bleed-tall", note: "already vertical: do not crop it" }
      : { mode: "full-bleed", note: "close to the canvas ratio: let it fill" };

const type =
  grammar === "montage"
    ? { arabic: 128, latin: 172, label: 15, tracking: "tight" }
    : grammar === "portrait"
      ? { arabic: 64, latin: 76, label: 13, tracking: "wide" }
      : { arabic: 84, latin: 96, label: 14, tracking: "normal" };

const beats = shotsData.map((s, i) => ({
  index: i,
  start: s.start,
  seconds: s.len,
  motion: s.motion,
  lum: s.lum,
  ornaments: ornament,
  note:
    s.motion > 0.09
      ? "busy frame: one line of type, no more"
      : s.len > 1.6
        ? "long hold: give the type room to arrive slowly"
        : "short beat: a single word",
}));

const plan = {
  source: src.split("/").pop(),
  measured: {
    durationSec: Number(dur.toFixed(2)),
    fps,
    size: dims,
    aspect: Number(AR.toFixed(3)),
    cuts,
    avgShotSec: Number(avgShot.toFixed(2)),
    motionAvg: Number(motionAvg.toFixed(3)),
    talkDensity: Number(talkDensity.toFixed(2)),
    speech,
  },
  palette,
  decision: { grammar, ornament, frame, type, why, beats },
};

if (!existsSync(dirname(out))) mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(plan, null, 2));

console.log(`grammar: ${grammar}  · ornament ${ornament}/3  · frame ${frame.mode}`);
for (const w of why) console.log(`  · ${w}`);
console.log(`  cuts: ${cuts.map((c) => c.toFixed(2)).join("  ")}`);
console.log(`  speech: ${speech.map((s) => `${s.start}-${s.end}`).join("  ")}`);
console.log(`plan → ${out}`);
