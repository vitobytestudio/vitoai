/**
 * «الطابق الأخير» — THE LAST FLOOR · 30.00 s cue, written against the film's own beat table.
 *
 *   node studio/score_lastfloor.mjs /tmp/lastfloor.wav
 *
 * The idea: the game's loading screen plays a music box — a cheap cheerful toy melody inside
 * a horror level, the kind of thing a Roblox author buys for 25 robux. Every few notes the
 * box loses one: more detuned, shorter decay, quieter. When the squad is lost the melody
 * stops being a melody and the last notes are one note, repeated, until the end card.
 * Underneath it: a stairwell, a floor that carries footsteps that are not ours, and one
 * impact — the jump — where all the headroom in this file gets spent.
 *
 *   00.00  four friends join — one click each, no music yet
 *   03.07  the screen opens; the box starts; a bass note is already under the floor
 *   04.13  rule 01 lands on a thud          06.13  a door that is not ours creaks
 *   09.13  eight rows of feet, accelerating  10.40  three players lost, one hit each
 *   12.13  and it walks, calmly, four steps  15.13  a swell under the wide shot
 *   16.15  the jump                          17.10  one note, left alone, repeating
 *   19.13  the name                          25.40  the box runs out of notes
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const OUT = process.argv[2] ?? "/tmp/lastfloor.wav";
const SECS = 30.0;
/* The sandbox hands us ffmpeg through an env file; the repo keeps its own .toolenv, and
   the platform also has one. Either is fine — the point is the script does not assume a
   ffmpeg on PATH, because on this machine there isn't one. */
const envs = [join(process.cwd(), ".toolenv"), join(homedir(), ".arena", "tools", "ffmpeg-env.sh")].filter(existsSync);
if (envs.length === 0) throw new Error("no ffmpeg env file (.toolenv or ~/.arena/tools/ffmpeg-env.sh) — run ./setup.sh");
const ENV_SRC = envs.map((e) => `set -a; . ${e}; set +a`).join("; ");

/* ------------------------------------------------------------ the timing contract */
/* These are the film's frames divided by 30. If the edit moves, the music moves with it. */
const BEAT = {
  ui: [0.53, 1.13, 1.73, 2.33],
  open: 3.07,
  rule1: 4.13,
  contact: 6.13,
  rule2: 7.13,
  sprint: 9.13,
  lost: [10.4, 10.97, 11.53],
  walk: 12.5,
  rule3: 13.13,
  wide: 15.13,
  jump: 16.15,
  after: [17.1, 18.0, 18.9],
  name: 19.13,
  invite: 22.13,
  mark: 25.4,
};

const SR = 48000;
const N = Math.round(SR * SECS);
const L = new Float64Array(N);
const R = new Float64Array(N);
const t = (sec) => Math.round(sec * SR);
const hash = (n, salt = 0) => {
  let x = (n * 374761393 + salt * 668265263) >>> 0;
  x = ((x ^ (x >>> 13)) * 1274126177) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
};
/* ------------------------------------------------------------------------- the room */
/* Four damped combs into one allpass — a stairwell, 2.6 s. Every source is fed through it
   by hand so the toy and the impact live in the same space. */
const combMs = [37, 41, 47, 53];
const combs = combMs.map((ms) => {
  const len = Math.round((ms / 1000) * SR);
  return { len, buf: new Float64Array(len), i: 0, damp: 0.44 };
});
const apLen = Math.round((SR * 5) / 1000);
const ap = { buf: new Float64Array(apLen), i: 0, g: 0.5 };
const pdLen = Math.round((SR * 28) / 1000);
const pd = { buf: new Float64Array(pdLen), i: 0 };
const RV = new Float64Array(N);
const reverbSend = new Float64Array(N);

function runReverb() {
  for (let i = 0; i < N; i++) {
    const x = reverbSend[i];
    const d = pd.buf[pd.i];
    pd.buf[pd.i] = x;
    pd.i = (pd.i + 1) % pdLen;
    let acc = 0;
    for (const c of combs) {
      c.buf[c.i] = d + c.buf[(c.i - 1 + c.len) % c.len] * c.damp;
      acc += c.buf[c.i];
      c.i = (c.i + 1) % c.len;
    }
    acc *= 0.22;
    const idx = ap.i;
    const outv = -ap.g * acc + ap.buf[idx];
    ap.buf[idx] = acc + ap.g * outv;
    ap.i = (idx + 1) % apLen;
    RV[i] = outv;
  }
}

/** Lay a rendered fragment into the mix at `at`; verbAmt is how much of it the stairwell gets. */
function put(w, at, gain, pan = 0, verbAmt = 0) {
  const gl = Math.sqrt((1 - pan) / 2) * gain;
  const gr = Math.sqrt((1 + pan) / 2) * gain;
  const s0 = Math.max(0, Math.floor(at));
  const e = Math.min(N, s0 + w.length);
  for (let i = s0; i < e; i++) {
    const v = w[i - s0];
    L[i] += v * gl;
    R[i] += v * gr;
    if (verbAmt > 0) reverbSend[i] += v * gain * verbAmt;
  }
}

/* ---------------------------------------------------------------------------- voices */
/** A music-box tooth: a plucked sine plus its 4th, a 2 ms strike, a fast decay. */
function boxNote(f, dur, detuneCents = 0) {
  const n = Math.round(dur * SR);
  const w = new Float64Array(n);
  const f2 = f * Math.pow(2, detuneCents / 1200);
  const tau = 1 / (2.4 + 5 * Math.min(1, dur / 2));
  for (let i = 0; i < n; i++) {
    const x = i / SR;
    const env = Math.exp(-x * tau) * (1 - Math.exp(-x * 900));
    w[i] =
      env *
      (0.62 * Math.sin(2 * Math.PI * f2 * x) +
        0.24 * Math.sin(2 * Math.PI * f2 * 4.01 * x + 0.4) +
        0.09 * Math.sin(2 * Math.PI * f2 * 9.9 * x) +
        0.05 * (hash(i, Math.round(f)) - 0.5) * Math.exp(-x * 2600));
  }
  return w;
}
/** UI tick — a 70 ms pin with the box's attitude. */
function pin(f = 2400, dur = 0.07) {
  const n = Math.round(dur * SR);
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / SR;
    w[i] = Math.exp(-x * 55) * (Math.sin(2 * Math.PI * f * x) + 0.4 * Math.sin(2 * Math.PI * f * 2.7 * x));
  }
  return w;
}
/** Sub thud — the UI's punctuation and the game's "you lost one". */
function thud(f = 62, dur = 0.5, drop = 1) {
  const n = Math.round(dur * SR);
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / SR;
    const fx = f * (drop + (1 - drop) * Math.exp(-x * 14));
    w[i] = Math.exp(-x * 7) * (Math.sin(2 * Math.PI * fx * x) + 0.3 * Math.sin(2 * Math.PI * fx * 2.02 * x));
  }
  return w;
}
function noiseHit(dur = 0.35, cut = 2400, q = 0.9) {
  const n = Math.round(dur * SR);
  const w = new Float64Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const x = i / SR;
    lp += ((hash(i, 71) - 0.5) * 2 - lp) * Math.min(1, (cut / SR) * 6);
    w[i] = lp * Math.exp(-x * (1000 / (dur * 1000)) * q);
  }
  return w;
}
/** The thing in the doorway: a bowed 26 Hz swell, three seconds. */
function swell(dur = 2.6) {
  const n = Math.round(dur * SR);
  const w = new Float64Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const x = i / SR;
    const env = Math.min(1, x / (dur * 0.55)) * Math.pow(1 - x / dur, 1.6);
    lp += (Math.sin(2 * Math.PI * 26.2 * x * (1 + 0.02 * Math.sin(2 * Math.PI * 0.4 * x))) - lp) * 0.35;
    w[i] = env * (0.72 * lp + 0.3 * Math.sin(2 * Math.PI * 52.6 * x) * Math.exp(-x * 1.2));
  }
  return w;
}
/** Wood underfoot, at a distance — the creak and the steps share this body. */
function creak(dur = 1.5, f0 = 170) {
  const n = Math.round(dur * SR);
  const w = new Float64Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const x = i / SR;
    const f = f0 * (1 + 0.16 * Math.sin(2 * Math.PI * 2.4 * x) * (1 - x / dur));
    lp += (Math.sin(2 * Math.PI * f * x) + 0.5 * Math.sin(2 * Math.PI * f * 2.9 * x) - lp) * 0.35;
    w[i] = lp * Math.exp(-x * 2.6) * (1 - Math.exp(-x * 60));
  }
  return w;
}
function step(dur = 0.16) {
  const n = Math.round(dur * SR);
  const w = new Float64Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const x = i / SR;
    lp += ((hash(i, 13) - 0.5) * 2 - lp) * 0.4;
    w[i] = (lp * 0.7 + Math.sin(2 * Math.PI * 88 * x) * Math.exp(-x * 60)) * Math.exp(-x * 42);
  }
  return w;
}
/** The big one: a 2 kHz crack, a 40 Hz boom, and the stairwell doing the rest. */
function impact(dur = 2.2) {
  const n = Math.round(dur * SR);
  const w = new Float64Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const x = i / SR;
    lp += ((hash(i, 991) - 0.5) * 2 - lp) * 0.5;
    const crack = Math.exp(-x * 26) * lp;
    const boom = Math.exp(-x * 4.2) * Math.sin(2 * Math.PI * 42 * x * (1 + 0.5 * Math.exp(-x * 6)));
    w[i] = crack * 0.55 + boom * 0.85 + 0.18 * Math.exp(-x * 9) * Math.sin(2 * Math.PI * 170 * x);
  }
  return w;
}

/* ------------------------------------------------------------------------ the tune */
/* F major, played an octave or two up, on a box that was never tuned for this building. */
const MELODY = [0, 4, 7, 4, 2, 5, 9, 5, 0, 4, 12, 9, 7, 4, 2, 7, 0, 4, 7, 11, 9, 7, 5, 4, 2, 0, 4, 7, 9, 12];
const F0 = 440 * Math.pow(2, -9 / 12); // the A above middle C is 440; this box sits lower and toy-ish

for (let [k, when] of [
  ...Array.from({ length: 26 }, (_, k) => BEAT.open + 0.16 + k * 0.5),
  ...BEAT.after,
  19.5, 20.6, 21.7,
  25.4, 26.4, 27.4, 28.35,
].entries()) {
  const loss = Math.min(1, k / 26);
  const deg = MELODY[k % MELODY.length];
  const f = F0 * Math.pow(2, (deg + 24) / 12);
  const amp = 0.19 * Math.pow(0.968, k) * (k > 28 ? 0.9 : 1);
  put(boxNote(f, 1.0 + 1.2 * loss, 4 + 34 * loss), t(when), amp, -0.22 + 0.4 * hash(k, 3), 0.62);
  if (k % 4 === 2) {
    put(boxNote(f * Math.pow(2, 7 / 12), 0.8, 12 + 20 * loss), t(when + 0.25), amp * 0.45, 0.3, 0.7);
  }
  if (k % 8 === 7) put(thud(52, 0.8, 1.02), t(when), 0.15, 0, 0.2); // the box's own drum
}
/* the drone the floor has been making since the doors opened */
for (let i = 0; i < N; i++) {
  const x = i / SR;
  const gate =
    (x > 3.0 && x < 16.1 ? Math.min(1, (x - 3.0) / 3) * 0.085 : 0) +
    (x >= 16.1 && x < 17.6 ? 0.02 : 0) +
    (x > 19.0 && x < 25.2 ? Math.min(1, (x - 19.0) / 2.4) * 0.075 : 0) +
    (x >= 25.2 ? 0.075 * Math.exp(-(x - 25.2) / 3.4) : 0);
  L[i] += gate * Math.sin(2 * Math.PI * 26.2 * x);
  R[i] += gate * Math.sin(2 * Math.PI * 26.2 * x + 1.1);
}

/* -------------------------------------------------------------------- the cut points */
for (const [i, when] of BEAT.ui.entries()) {
  put(pin(2100 + i * 180), t(when), 0.085, -0.3 + 0.2 * i, 0.3);
  put(thud(120, 0.16, 1.4), t(when), 0.07, 0, 0.15);
}
put(thud(70, 0.7, 1.3), t(BEAT.open - 0.06), 0.24, 0, 0.35); // four slots locked
put(swell(1.6), t(BEAT.open - 0.7), 0.12, 0, 0.5);

for (const when of [BEAT.rule1, BEAT.rule2, BEAT.rule3]) {
  put(thud(62, 0.6, 1.5), t(when), 0.22, 0, 0.3);
  put(noiseHit(0.24, 1700, 1.2), t(when), 0.11, 0, 0.4);
}
put(creak(1.8, 150), t(BEAT.contact), 0.11, -0.35, 0.75);
put(pin(1200, 0.05), t(BEAT.contact + 0.9), 0.05, 0.4, 0.5);

/* the sprint: eight rows of feet, and the pitch of the room climbing with them */
for (let k = 0; k < 8; k++) {
  const when = BEAT.sprint + 0.08 + k * 0.235;
  for (let v = 0; v < 3; v++) {
    put(step(0.14), t(when + v * 0.055 + 0.014 * hash(k, v)), 0.115 - 0.006 * v, -0.5 + 0.5 * v, 0.4);
  }
}
put(swell(1.4), t(BEAT.sprint + 0.4), 0.075, 0, 0.6);

/* three players lost */
for (const [j, when] of BEAT.lost.entries()) {
  put(impact(1.1), t(when), j === 2 ? 0.42 : 0.24, 0, 0.55);
  put(noiseHit(0.4, 900, 1.4), t(when), 0.14, j % 2 ? 0.35 : -0.35, 0.5);
  put(pin(700 - j * 120, 0.12), t(when + 0.02), 0.07, 0, 0.6);
}
/* and it walks */
for (let k = 0; k < 4; k++) {
  put(step(0.2), t(BEAT.walk + 0.2 + k * 0.66), 0.13, -0.4 + 0.25 * (k % 2), 0.85);
}
put(swell(1.6), t(BEAT.wide), 0.17, 0, 0.7);

/* the jump — the one place this file is allowed to be loud */
put(impact(2.4), t(BEAT.jump), 0.9, 0, 0.9);
put(noiseHit(0.55, 2600, 2.0), t(BEAT.jump), 0.5, 0, 0.5);
put(thud(46, 1.3, 1.0), t(BEAT.jump), 0.5, 0, 0.2);
/* one hard cut, then the room finishing the sentence */
for (let i = 0; i < N; i++) {
  const x = i / SR;
  if (x > BEAT.jump + 0.42 && x < BEAT.jump + 0.5) {
    const p = 1 - (x - (BEAT.jump + 0.42)) / 0.08;
    L[i] *= 1 - 0.85 * p;
    R[i] *= 1 - 0.85 * p;
  }
}
put(swell(3.0), t(BEAT.after[0]), 0.06, 0, 0.8);
put(creak(2.2, 96), t(BEAT.invite + 0.4), 0.075, 0.4, 0.9);
put(swell(2.2), t(BEAT.mark + 1.2), 0.05, 0, 0.85);

/* ------------------------------------------------------------------------ finishing */
runReverb();
for (let i = 0; i < N; i++) {
  L[i] += RV[i];
  R[i] += RV[i] * 0.88;
}
const DRV = 0.44;
for (let i = 0; i < N; i++) {
  L[i] = Math.tanh(L[i] * (1 + DRV * 6)) / (1 + DRV);
  R[i] = Math.tanh(R[i] * (1 + DRV * 6)) / (1 + DRV);
}
/* Peak ≈ −2 dB and RMS ≈ −14 dB at the end of this loop, measured by eye over a few passes
   and confirmed with astats — and the rule that actually bites is that only one moment in
   the film gets to be huge. */
let peak = 0;
let sq = 0;
for (let i = 0; i < N; i++) {
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  sq += (L[i] * L[i] + R[i] * R[i]) / 2;
}
const rms = Math.sqrt(sq / N);
const g = Math.min(0.9 / peak, Math.pow(10, -14.5 / 20) / rms);
for (let i = 0; i < N; i++) {
  const fade = Math.min(1, i / t(0.01)) * Math.min(1, (N - i) / t(1.4));
  L[i] = Math.tanh(L[i] * g * fade * 1.06) / 1.06;
  R[i] = Math.tanh(R[i] * g * fade * 1.06) / 1.06;
}
const tmp = join(tmpdir(), `lastfloor-${process.pid}.raw`);
const raw = Buffer.allocUnsafe(N * 8);
for (let i = 0; i < N; i++) {
  raw.writeFloatLE(L[i], i * 8);
  raw.writeFloatLE(R[i], i * 8 + 4);
}
mkdirSync(join(tmpdir(), "vito"), { recursive: true });
const { writeFileSync } = await import("node:fs");
writeFileSync(tmp, raw);
try {
  execSync(
    `${ENV_SRC}; "$FFMPEG" -v error -y -f f32le -ar ${SR} -ac 2 -i ${tmp} -c:a pcm_s16le ${OUT}`,
    { stdio: "inherit", shell: "/bin/bash", env: { ...process.env, FFMPEG: process.env.FFMPEG ?? "node_modules/@ffmpeg-installer/linux-x64/ffmpeg" } },
  );
  console.log(`last-floor score: ${SECS}s · g=${g.toFixed(2)} peak=${(20 * Math.log10(peak * g)).toFixed(1)}dB → ${OUT}`);
} finally {
  const { rmSync } = await import("node:fs");
  rmSync(tmp, { force: true });
}
