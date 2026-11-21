/**
 * NAKSAB Ep.01 — 24 s of score, built the way the film is built: a few clean
 * parts, each doing one job.
 *
 *   sub       one low sine that holds the floor and swells at the logo
 *   pad       four detuned sines, D minor → F major, opening on the end card
 *   pluck     an additive bell arpeggio, one note per beat, quiet
 *   tick      the interface itself: a short filtered noise burst per arrival
 *   confirm   two-note major third at the hire and at the mutual confirmation
 *   riser     a noise sweep into the wordmark, then silence and one hit
 *   air       a very quiet room tone so nothing is digitally dead
 *
 *   node studio/score_naksab.mjs out.wav
 */
import { writeFileSync } from "node:fs";

const SR = 48000;
const DUR = 24;
const N = Math.round(DUR * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);
const SEND = new Float32Array(N);

let seed = 0x51f3a7;
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
const TAU = Math.PI * 2;
const note = (hz) => hz;

/* --------------------------------------------------------------- the floor */

function sub(t0, dur, g, f, envIn = 0.5, envOut = 0.7) {
  const i0 = Math.round(t0 * SR);
  const n = Math.round(dur * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    ph += (TAU * f) / SR;
    const env = Math.min(1, t / envIn) * Math.min(1, (dur - t) / envOut);
    put(i0 + k, Math.sin(ph) * env * g, 0, 0.12);
  }
}

/* ----------------------------------------------------------------- the pad */

const CHORD = [
  [146.83, 174.61, 220.0, 293.66], // D minor
  [174.61, 220.0, 261.63, 349.23], // F major
];

function pad(t0, dur, g, chord, open = 1.2, close = 1.4) {
  const i0 = Math.round(t0 * SR);
  const n = Math.round(dur * SR);
  const ph = chord.map(() => [0, 0, 0]);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const env = Math.min(1, t / open) * Math.min(1, (dur - t) / close);
    let v = 0;
    for (let c = 0; c < chord.length; c++) {
      for (let d = 0; d < 3; d++) {
        const det = 1 + (d - 1) * 0.0018;
        ph[c][d] += (TAU * chord[c] * det) / SR;
        v += Math.sin(ph[c][d]) * (d === 1 ? 0.5 : 0.26);
      }
    }
    v /= chord.length;
    const breathe = 0.86 + 0.14 * Math.sin(TAU * 0.11 * t + chord[0]);
    put(i0 + k, v * env * g * breathe, Math.sin(t * 0.5) * 0.35, 0.55);
  }
}

/* --------------------------------------------------------------- the pluck */

function pluck(t0, g, f, pan = 0) {
  const i0 = Math.round(t0 * SR);
  const n = Math.round(1.5 * SR);
  let ph = 0;
  let ph2 = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    ph += (TAU * f) / SR;
    ph2 += (TAU * f * 2.004) / SR;
    const env = Math.exp(-t * 4.2) * Math.min(1, t / 0.004);
    const v = (Math.sin(ph) * 0.8 + Math.sin(ph2) * 0.16) * env;
    put(i0 + k, v * g, pan, 0.75);
  }
}

/* ----------------------------------------------------------------- the tick */

function tick(t0, g, bright = 2600, len = 0.035, pan = 0) {
  const i0 = Math.round(t0 * SR);
  const n = Math.round(len * SR);
  let lp = 0;
  let hp = 0;
  const a = 1 - Math.exp((-TAU * bright) / SR);
  const ha = Math.exp((-TAU * 420) / SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const x = noise();
    lp += (x - lp) * a;
    hp = lp - (hp * ha + lp * (1 - ha));
    const env = Math.exp(-t / (len * 0.32));
    put(i0 + k, hp * env * g, pan, 0.35);
  }
}

/* -------------------------------------------------------------- the confirm */

function confirm(t0, g, root, pan = 0) {
  const i0 = Math.round(t0 * SR);
  const n = Math.round(1.4 * SR);
  let p1 = 0;
  let p2 = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const second = Math.max(0, t - 0.12);
    p1 += (TAU * root) / SR;
    p2 += (TAU * root * 1.25 * 2) / SR;
    const e1 = Math.exp(-t * 3.2) * Math.min(1, t / 0.006);
    const e2 = second > 0 ? Math.exp(-second * 3.6) * Math.min(1, second / 0.006) : 0;
    const v = Math.sin(p1) * e1 * 0.9 + Math.sin(p2) * e2 * 0.4;
    put(i0 + k, v * g, pan, 0.65);
  }
}

/* ---------------------------------------------------------------- the riser */

function riser(t0, dur, g) {
  const i0 = Math.round(t0 * SR);
  const n = Math.round(dur * SR);
  let lp = 0;
  for (let k = 0; k < n; k++) {
    const u = k / n;
    const cutoff = 300 + 7200 * Math.pow(u, 2.3);
    const a = 1 - Math.exp((-TAU * cutoff) / SR);
    lp += (noise() - lp) * a;
    const env = Math.pow(u, 1.7) * Math.min(1, (1 - u) * 26);
    put(i0 + k, lp * env * g, Math.sin(u * 9) * 0.2, 0.5);
  }
}

/* ------------------------------------------------------------- the last hit */

function hit(t0, g, f) {
  const i0 = Math.round(t0 * SR);
  const n = Math.round(2.6 * SR);
  let ph = 0;
  let ph2 = 0;
  let lp = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    ph += (TAU * f) / SR;
    ph2 += (TAU * f * 1.5) / SR;
    const env = Math.exp(-t * 1.7) * Math.min(1, t / 0.005);
    const boom = Math.sin(ph) * Math.exp(-t * 2.4) * 0.9 + Math.sin(ph2) * Math.exp(-t * 4.5) * 0.22;
    const a = 1 - Math.exp((-TAU * 900) / SR);
    lp += (noise() - lp) * a;
    const snap = lp * Math.exp(-t * 26) * 0.5;
    put(i0 + k, (boom + snap) * env * g, 0, 0.7);
  }
}

/* ------------------------------------------------------------------- air */

function air(g) {
  let lp = 0;
  let lp2 = 0;
  for (let k = 0; k < N; k++) {
    const a = 1 - Math.exp((-TAU * 1500) / SR);
    lp += (noise() - lp) * a;
    lp2 += (lp - lp2) * (1 - Math.exp((-TAU * 220) / SR));
    put(k, lp2 * g, 0, 0.2);
  }
}

/* ------------------------------------------------------------- the arrangement */

air(0.012);

// the floor: a held D that lifts into the logo
sub(0, 12.6, 0.16, 73.42, 1.4, 1.0);
sub(12.4, 11.2, 0.13, 87.31, 1.6, 0.5);
sub(19.55, 4.45, 0.2, 73.42, 0.02, 1.6);

// pad: closed through the product, opening at the end
pad(0.0, 12.8, 0.2, [CHORD[0][0], CHORD[0][1], CHORD[0][2]], 2.2, 1.4);
pad(12.2, 7.4, 0.22, CHORD[0], 1.8, 1.0);
pad(19.35, 4.65, 0.3, CHORD[1], 0.4, 1.8);

// plucks: one per beat through the offers, thinning as the room lands
const beat = 0.55;
const arp = [587.33, 698.46, 880.0, 698.46];
for (let k = 0; k < 16; k++) {
  const t = 4.35 + k * beat;
  if (t > 11.2) break;
  pluck(t, 0.055 - k * 0.0022, arp[k % 4], k % 2 ? 0.35 : -0.35);
}
for (let k = 0; k < 6; k++) {
  const t = 12.4 + k * beat;
  pluck(t, 0.048 - k * 0.004, arp[(k + 1) % 4], k % 2 ? -0.3 : 0.3);
}
[0, 1, 2, 3, 4, 5, 6, 7].forEach((k) => pluck(19.75 + k * 0.15, 0.05 * (1 - k * 0.08), [349.23, 440.0, 523.25, 698.46][k % 4], k % 2 ? 0.5 : -0.5));

// the interface: type clicks, then one tick per offer as it lands
for (let k = 0; k < 26; k++) tick(0.42 + k * 0.055, 0.05, 3100, 0.022, (k % 2 ? 1 : -1) * 0.25);
[4.73, 5.23, 5.73, 6.23, 6.73].forEach((t, i) => tick(t, 0.14, 2100 + i * 160, 0.05, i % 2 ? 0.3 : -0.3));
tick(3.2, 0.2, 1500, 0.09, 0); // the publish press
tick(8.2, 0.16, 2400, 0.05, 0.2); // hired
tick(12.3, 0.15, 2600, 0.06, -0.2); // room opens
tick(16.7, 0.15, 2800, 0.06, 0.25); // confirmations

// confirmation: the hire, the mutual confirm, the CTA
confirm(8.25, 0.13, 440.0, -0.25);
confirm(16.65, 0.1, 523.25, 0.2);
confirm(20.2, 0.12, 440.0, 0);

// into the wordmark
riser(17.55, 1.95, 0.16);
hit(19.6, 0.34, 73.42);

/* ---------------------------------------------------------------- reverb */

function reverb(send, wetGain) {
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ buf: new Float32Array(Math.round((d * SR) / 44100)), i: 0, store: 0 }));
  const aps = [556, 441].map((d) => ({ buf: new Float32Array(Math.round((d * SR) / 44100)), i: 0 }));
  const out = new Float32Array(send.length);
  let hp = 0;
  const hpA = Math.exp((-TAU * 420) / SR);
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

const wet = reverb(SEND, 0.4);
let peak = 0;
for (let n = 0; n < N; n++) {
  L[n] = Math.tanh((L[n] + wet[n] * 0.62) * 0.95) / 0.95;
  R[n] = Math.tanh((R[n] + wet[n] * 0.58) * 0.95) / 0.95;
  peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
}
const g = 0.9 / peak;
const fade = Math.round(1.1 * SR);
for (let k = 0; k < fade; k++) {
  const a = 1 - k / fade;
  L[N - 1 - k] *= a;
  R[N - 1 - k] *= a;
}

const out = process.argv[2] || "/tmp/naksab.wav";
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
console.log(`naksab score: ${DUR}s · ${(bytes / 1048576).toFixed(1)} MB → ${out}`);
