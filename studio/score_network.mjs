/**
 * NAKSAB Ep.02 — 29 s of score for a diagram film.
 *
 *   pulse     a four-to-the-bar low pulse, filtered, felt more than heard
 *   air       a wide room tone that keeps the black from being silent
 *   blips     one soft tone per node as the network assembles
 *   sweep     a filtered sweep under each beat change, never a riser cliché
 *   keys      a sparse two-note motif (A, C) on a felt piano-ish envelope
 *   impact    one deep hit as the name lands, then a long tail
 *
 *   node studio/score_network.mjs out.wav
 */
import { writeFileSync } from "node:fs";

const SR = 48000;
const DUR = 29;
const N = Math.round(DUR * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);
const SEND = new Float32Array(N);
const TAU = Math.PI * 2;

let seed = 0x7a31c5;
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

/* --------------------------------------------------------------------- air */

(() => {
  let lp = 0;
  let lp2 = 0;
  for (let k = 0; k < N; k++) {
    const a = 1 - Math.exp((-TAU * 1700) / SR);
    lp += (noise() - lp) * a;
    lp2 += (lp - lp2) * (1 - Math.exp((-TAU * 260) / SR));
    put(k, lp2 * 0.05, Math.sin(k / SR / 7) * 0.4, 0.25);
  }
})();

/* ------------------------------------------------------------------- pulse */

const BPM = 96;
const beat = 60 / BPM;

function kick(t0, g, f = 54, len = 0.5) {
  const i0 = Math.round(t0 * SR);
  const n = Math.round(len * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const fr = f * (1 + 1.6 * Math.exp(-t * 26));
    ph += (TAU * fr) / SR;
    const env = Math.exp(-t * 5.2) * Math.min(1, t / 0.004);
    put(i0 + k, Math.sin(ph) * env * g, 0, 0.22);
  }
}

function hat(t0, g, pan = 0) {
  const i0 = Math.round(t0 * SR);
  const n = Math.round(0.09 * SR);
  let hp = 0;
  let last = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const x = noise();
    hp = 0.86 * (hp + x - last);
    last = x;
    put(i0 + k, hp * Math.exp(-t * 52) * g, pan, 0.3);
  }
}

/* ------------------------------------------------------------------- blips */

const MINOR = [220.0, 261.63, 293.66, 349.23, 392.0, 440.0];

function blip(t0, g, f, pan = 0, len = 0.34) {
  const i0 = Math.round(t0 * SR);
  const n = Math.round(len * SR);
  let p1 = 0;
  let p2 = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    p1 += (TAU * f) / SR;
    p2 += (TAU * f * 2.01) / SR;
    const env = Math.exp(-t * 11) * Math.min(1, t / 0.003);
    put(i0 + k, (Math.sin(p1) * 0.7 + Math.sin(p2) * 0.18) * env * g, pan, 0.6);
  }
}

/* ------------------------------------------------------------------- sweep */

function sweep(t0, dur, g) {
  const i0 = Math.round(t0 * SR);
  const n = Math.round(dur * SR);
  let lp = 0;
  for (let k = 0; k < n; k++) {
    const u = k / n;
    const cutoff = 260 + 6000 * Math.pow(u, 2.6);
    const a = 1 - Math.exp((-TAU * cutoff) / SR);
    lp += (noise() - lp) * a;
    const env = Math.pow(u, 1.9) * Math.min(1, (1 - u) * 18);
    put(i0 + k, lp * env * g, Math.sin(u * 4) * 0.3, 0.45);
  }
}

/* -------------------------------------------------------------------- keys */

function key(t0, g, f, pan = 0) {
  const i0 = Math.round(t0 * SR);
  const n = Math.round(2.4 * SR);
  const parts = [1, 2, 3.01, 4.02];
  const amps = [1, 0.34, 0.15, 0.07];
  const ph = parts.map(() => 0);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    let v = 0;
    for (let q = 0; q < parts.length; q++) {
      ph[q] += (TAU * f * parts[q]) / SR;
      v += Math.sin(ph[q]) * amps[q] * Math.exp(-t * (1.4 + q * 0.7));
    }
    const env = Math.min(1, t / 0.01);
    put(i0 + k, v * env * g, pan, 0.7);
  }
}

/* ------------------------------------------------------------------ impact */

function impact(t0, g, f = 44) {
  const i0 = Math.round(t0 * SR);
  const n = Math.round(4.4 * SR);
  let ph = 0;
  let lp = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const fr = f * (1 + 0.9 * Math.exp(-t * 5));
    ph += (TAU * fr) / SR;
    const a = 1 - Math.exp((-TAU * 700) / SR);
    lp += (noise() - lp) * a;
    const body = Math.sin(ph) * Math.exp(-t * 1.5) * 0.95;
    const snap = lp * Math.exp(-t * 18) * 0.4;
    put(i0 + k, (body + snap) * g * Math.min(1, t / 0.004), 0, 0.5);
  }
}

/* ------------------------------------------------------------- arrangement */

// a pulse that starts halfway through the first beat and stays under everything
const KICKS = [];
for (let t = 1.6; t < 23.6; t += beat) {
  const local = (t - 1.6) / beat;
  const g = t < 4.4 ? 0.1 : t < 8.6 ? 0.2 : t < 18.5 ? 0.26 : t < 23.6 ? 0.22 : 0.12;
  KICKS.push([t, g]);
  if (Math.round(local) % 2 === 1) hat(t + beat / 2, 0.024 + (t > 8.6 ? 0.012 : 0), local % 2 ? 0.3 : -0.3);
}
KICKS.forEach(([t, g]) => kick(t, g));

// the network assembles: one blip per node cluster, thinning out
for (let i = 0; i < 18; i++) {
  const t = 0.55 + i * 0.19;
  blip(t, 0.05 * (1 - i * 0.03), MINOR[i % MINOR.length] * (i % 3 === 0 ? 2 : 1), i % 2 ? 0.45 : -0.45);
}

// the matching: four candidates, four notes climbing
[186, 200, 214, 228].forEach((fr, i) => blip(fr / 30, 0.09, MINOR[i] * 2, i % 2 ? 0.5 : -0.5, 0.5));

// sweeps under each beat change
[4.4, 11.2, 18.7, 23.4].forEach((t, i) => sweep(t - 0.55, 0.62, i === 3 ? 0.13 : 0.075));

// the motif: A, then C, then both, then just A again
const motif = [
  [5.0, 220.0, 0.1],
  [7.6, 261.63, 0.085],
  [12.0, 220.0, 0.1],
  [14.4, 329.63, 0.07],
  [19.6, 261.63, 0.095],
  [21.9, 220.0, 0.085],
  [24.4, 220.0, 0.11],
  [25.7, 329.63, 0.08],
  [26.9, 440.0, 0.06],
];
motif.forEach(([t, f, g], i) => key(t, g, f, i % 2 ? 0.3 : -0.3));

// the name
impact(23.35, 0.42);
key(23.35, 0.13, 110.0);
key(24.0, 0.1, 164.81);
key(24.9, 0.085, 220.0);

/* ------------------------------------------------------------------ reverb */

function reverb(send, wetGain) {
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ buf: new Float32Array(Math.round((d * SR) / 44100)), i: 0, store: 0 }));
  const aps = [556, 441].map((d) => ({ buf: new Float32Array(Math.round((d * SR) / 44100)), i: 0 }));
  const out = new Float32Array(send.length);
  let hp = 0;
  const hpA = Math.exp((-TAU * 380) / SR);
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
    out[n] = v * wetGain;
  }
  return out;
}

const wet = reverb(SEND, 0.5);
let peak = 0;
for (let n = 0; n < N; n++) {
  L[n] = Math.tanh((L[n] + wet[n] * 0.62) * 0.95) / 0.95;
  R[n] = Math.tanh((R[n] + wet[n] * 0.58) * 0.95) / 0.95;
  peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
}
const g = 0.9 / peak;
const fade = Math.round(1.4 * SR);
for (let k = 0; k < fade; k++) {
  const a = 1 - k / fade;
  L[N - 1 - k] *= a;
  R[N - 1 - k] *= a;
}

const out = process.argv[2] || "/tmp/network.wav";
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
  b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[n] * g * 32767))), 44 + 2 + n * 4);
}
writeFileSync(out, b);
console.log(`network score: ${DUR}s · ${(bytes / 1048576).toFixed(1)} MB → ${out}`);
