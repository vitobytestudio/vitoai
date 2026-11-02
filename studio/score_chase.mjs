/**
 * CHASE — 20 s of night sound, recorded on the same phone as the picture.
 *
 *   bed        traffic a block away: brown noise, low-passed, breathing
 *   engines    two passes, each a saw whose pitch rises then falls, filtered
 *              and panned through the frame — one left-to-right, one behind
 *   crowd      band-passed noise shaped into shouts, plus the phone-mic thumps
 *              when the operator is bumped
 *   siren      two tones, quiet, far away, never resolving
 *   whip       the wind gust as the phone turns
 *
 *   node studio/score_chase.mjs out.wav
 */
import { writeFileSync } from "node:fs";

const SR = 48000;
const DUR = 20;
const N = Math.round(DUR * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);
const SEND = new Float32Array(N);

let seed = 0x2f6b91;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 0xffffffff) * 2 - 1;
};
const put = (i, v, pan = 0, send = 0) => {
  if (i < 0 || i >= N) return;
  const a = ((pan + 1) * Math.PI) / 4;
  L[i] += v * Math.cos(a);
  R[i] += v * Math.sin(a);
  if (send) SEND[i] += v * send;
};

/* ---------------------------------------------------------------- engines */

function engine(t0, dur, g, panFrom, panTo, base) {
  const n = Math.round(dur * SR);
  const i0 = Math.round(t0 * SR);
  let ph = 0;
  let lp = 0;
  let lp2 = 0;
  let ph2 = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const u = t / dur;
    // approach → pass → away: pitch and level both peak around 0.45
    const pitchEnv = Math.exp(-Math.pow((u - 0.42) / 0.3, 2));
    const f0 = base * (0.72 + 0.9 * pitchEnv);
    ph += (2 * Math.PI * f0) / SR;
    ph2 += (2 * Math.PI * f0 * 2.02) / SR;
    const saw = ((ph / (2 * Math.PI)) % 1) * 2 - 1;
    const saw2 = ((ph2 / (2 * Math.PI)) % 1) * 2 - 1;
    const x = saw * 0.6 + saw2 * 0.25 + noise() * 0.5;
    const cut = 260 + 2400 * pitchEnv;
    const a = 1 - Math.exp((-2 * Math.PI * cut) / SR);
    lp += (x - lp) * a;
    lp2 += (lp - lp2) * a;
    const env = Math.min(1, t * 10) * Math.exp(-Math.pow((u - 0.5) / 0.34, 2)) * Math.min(1, (dur - t) * 6);
    put(i0 + k, lp2 * env * g, lerp(panFrom, panTo, u), 0.18);
  }
}

const lerp = (a, b, t) => a + (b - a) * t;

/* ------------------------------------------------------------------- bed */

function bed() {
  let lp = 0;
  let lp2 = 0;
  let br = 0;
  for (let n = 0; n < N; n++) {
    const t = n / SR;
    // brown-ish
    br = (br + noise() * 0.04) * 0.997;
    const x = br + noise() * 0.06;
    const a = 1 - Math.exp((-2 * Math.PI * 240) / SR);
    lp += (x - lp) * a;
    lp2 += (lp - lp2) * a;
    const breathe = 0.75 + 0.25 * Math.sin(2 * Math.PI * 0.11 * t + 1.2);
    const env = Math.min(1, t / 1.2) * Math.min(1, (DUR - t) / 1.4);
    put(n, lp2 * 0.5 * breathe * env, Math.sin(t * 0.2) * 0.3, 0.1);
  }
}

/* ------------------------------------------------------------------ crowd */

function crowd(t0, dur, g) {
  const n = Math.round(dur * SR);
  const i0 = Math.round(t0 * SR);
  let bp = 0;
  let lp = 0;
  let shout = 0;
  let next = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const x = noise();
    // band around 900 Hz: voices, not wind
    const a1 = 1 - Math.exp((-2 * Math.PI * 1700) / SR);
    const a2 = 1 - Math.exp((-2 * Math.PI * 520) / SR);
    lp += (x - lp) * a2;
    bp += (x - lp - bp * 0.9) * a1 * 0.6;
    if (k > next) {
      shout = 0.6 + Math.abs(Math.sin(k * 0.0007)) * 0.9;
      next = k + Math.round((0.25 + (seed % 100) / 90) * SR);
    }
    const env = Math.min(1, t * 3.2) * Math.min(1, (dur - t) * 2.2);
    put(i0 + k, (bp * 1.5 + noise() * 0.02) * env * shout * g, Math.sin(t * 3.1) * 0.4, 0.25);
  }
}

/* ----------------------------------------------------------------- thumps */

function thump(t0, g, pan = 0) {
  const n = Math.round(0.34 * SR);
  const i0 = Math.round(t0 * SR);
  let lp = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const x = noise();
    const a = 1 - Math.exp((-2 * Math.PI * 700) / SR);
    lp += (x - lp) * a;
    const body = Math.sin(2 * Math.PI * 72 * t) * Math.exp(-t * 20) * 0.6;
    const th = lp * Math.exp(-t * 90) * 0.5;
    put(i0 + k, (body + th) * g, pan, 0.15);
  }
}

/* ------------------------------------------------------------------ whips */

function wind(t0, dur, g, pan) {
  const n = Math.round(dur * SR);
  const i0 = Math.round(t0 * SR);
  let lp = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const cut = 320 + 3000 * Math.sin((Math.PI * t) / dur);
    const a = 1 - Math.exp((-2 * Math.PI * cut) / SR);
    lp += (noise() - lp) * a;
    const env = Math.sin((Math.PI * t) / dur) ** 2;
    put(i0 + k, lp * env * g, pan, 0.3);
  }
}

/* ------------------------------------------------------------------ siren */

function siren(t0, dur, g, pan) {
  const n = Math.round(dur * SR);
  const i0 = Math.round(t0 * SR);
  let ph = 0;
  let lp = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const u = t / dur;
    const f0 = 660 + 200 * Math.sin(2 * Math.PI * 0.24 * t);
    ph += (2 * Math.PI * f0) / SR;
    const x = Math.sin(ph) * 0.5 + Math.sin(ph * 2) * 0.12;
    const a = 1 - Math.exp((-2 * Math.PI * 1400) / SR);
    lp += (x - lp) * a;
    const env = Math.min(1, t * 4) * Math.min(1, (dur - t) * 2) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.5 * t));
    put(i0 + k, lp * env * g, pan, 0.7);
  }
}

/* --------------------------------------------------------------- the sheet */

bed();
crowd(0, 5.2, 0.34);
crowd(12.4, 3.0, 0.30);
crowd(15.6, 3.2, 0.18);

engine(3.0, 5.0, 0.36, -0.85, 0.9, 78);
engine(3.4, 5.2, 0.30, 0.9, -0.8, 94);
engine(10.0, 4.2, 0.34, 0.8, -0.9, 82);
engine(10.4, 4.4, 0.28, -0.9, 0.85, 92);

wind(3.18, 0.6, 0.28, 0.2);
wind(8.0, 0.55, 0.26, -0.2);
wind(12.5, 0.55, 0.24, 0.2);
wind(15.0, 0.5, 0.2, -0.2);
wind(17.3, 0.6, 0.16, 0.1);

thump(3.22, 0.5, -0.3);
thump(8.2, 0.55, 0.25);
thump(12.55, 0.4, -0.2);
thump(15.25, 0.45, 0.3);

siren(6.2, 6.0, 0.05, -0.5);

/* ---------------------------------------------------------------- reverb */

function reverb(send, wet) {
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ buf: new Float32Array(Math.round((d * SR) / 44100)), i: 0, store: 0 }));
  const aps = [556, 441].map((d) => ({ buf: new Float32Array(Math.round((d * SR) / 44100)), i: 0 }));
  const out = new Float32Array(send.length);
  let hp = 0;
  const hpA = Math.exp((-2 * Math.PI * 520) / SR);
  for (let n = 0; n < send.length; n++) {
    hp = hp * hpA + send[n] * (1 - hpA);
    const x = send[n] - hp;
    let acc = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.store = y * 0.72 + c.store * 0.28;
      c.buf[c.i] = x * 0.6 + c.store * 0.84;
      c.i = (c.i + 1) % c.buf.length;
      acc += y;
    }
    let v = acc / combs.length;
    for (const a of aps) {
      const y = a.buf[a.i];
      a.buf[a.i] = v + y * 0.5;
      a.i = (a.i + 1) % a.buf.length;
      v = y - v * 0.5;
    }
    out[n] = v * wet;
  }
  return out;
}

const wet = reverb(SEND, 0.34);
let peak = 0;
for (let n = 0; n < N; n++) {
  L[n] = Math.tanh((L[n] + wet[n] * 0.6) * 0.9) / 0.9;
  R[n] = Math.tanh((R[n] + wet[n] * 0.55) * 0.9) / 0.9;
  peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
}
const g = 0.88 / peak;
const fade = Math.round(0.9 * SR);
for (let k = 0; k < fade; k++) {
  const a = 1 - k / fade;
  L[N - 1 - k] *= a;
  R[N - 1 - k] *= a;
}

const out = process.argv[2] || "/tmp/chase.wav";
const bytes = 44 + N * 4;
const b = Buffer.alloc(bytes);
b.write("RIFF", 0);
b.writeUInt32LE(bytes - 8, 4);
b.write("WAVEfmt ", 8);
b.writeUInt32LE(16, 16);
b.writeUInt16LE(1, 20);
b.writeUInt16LE(2, 22);
b.writeUInt32LE(SR, 24);
b.writeUInt32LE(SR * 4, 28);
b.writeUInt16LE(4, 32);
b.writeUInt16LE(16, 34);
b.write("data", 36);
b.writeUInt32LE(N * 4, 40);
for (let n = 0; n < N; n++) {
  b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[n] * g * 32767))), 44 + n * 4);
  b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[n] * g * 32767))), 46 + n * 4);
}
writeFileSync(out, b);
console.log(`chase sound: ${DUR}s · ${(bytes / 1048576).toFixed(1)} MB → ${out}`);
