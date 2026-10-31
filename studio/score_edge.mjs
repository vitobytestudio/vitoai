/**
 * EDGE — sound design for the 30 s spot.
 *
 * The brief asks for restraint: a heavy sub drone, real-sounding foley
 * (mechanical keys, moving air, digital ticks), and nothing that shouts.
 * So this is not a track. It is a bed plus events, and the events sit exactly
 * on the picture's cues:
 *
 *   0.50  sub drop + white flash  (scene 1 opens)
 *   4.00  whip pan — air, not a whoosh sample
 *  10.00  whip pan, harder; the beat grid starts here
 *  10.2–12.0  mechanical key clicks, one per typed character
 *  16.4–18.0  riser, cut dead on the scene change
 *  18.00  sub impact, the widest point of the film
 *  21.0   glass ticks as the chart grows
 *  24.00  everything drops to the drone; the room goes quiet
 *  26.55  one deep Enter, long reverb tail
 *
 *   node studio/score_edge.mjs out.wav
 */
import { writeFileSync } from "node:fs";

const SR = 48000;
const DUR = 30;
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

/* --------------------------------------------------------------- elements */

function subDrop(t0, g = 1) {
  const n = Math.round(2.6 * SR);
  const i0 = Math.round(t0 * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    ph += (2 * Math.PI * (28 + 52 * Math.exp(-t * 9))) / SR;
    const env = Math.min(1, t * 90) * Math.exp(-t * 1.1);
    put(i0 + k, Math.sin(ph) * env * g * 0.55, 0, 0.12);
  }
}

function drone(t0, dur, g = 0.3) {
  const n = Math.round(dur * SR);
  const i0 = Math.round(t0 * SR);
  let a1 = 0;
  let a2 = 0;
  let a3 = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const env = Math.min(1, t / 1.4) * Math.min(1, (dur - t) / 1.6);
    const wob = 1 + 0.004 * Math.sin(2 * Math.PI * 0.12 * t);
    a1 += (2 * Math.PI * 40 * wob) / SR;
    a2 += (2 * Math.PI * 55 * wob) / SR;
    a3 += (2 * Math.PI * 80.5) / SR;
    const v = Math.sin(a1) * 0.6 + Math.sin(a2) * 0.3 + Math.sin(a3) * 0.09;
    put(i0 + k, v * env * g, Math.sin(t * 0.2) * 0.2, 0.08);
  }
}

function air(t0, dur, g = 0.3, pan = 0) {
  // moving air: filtered noise with a rising then falling band
  const n = Math.round(dur * SR);
  const i0 = Math.round(t0 * SR);
  let lp = 0;
  let hp = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const x = noise();
    const cut = 400 + 3600 * Math.sin((Math.PI * t) / dur);
    const a = 1 - Math.exp((-2 * Math.PI * cut) / SR);
    lp += (x - lp) * a;
    hp += (x - hp) * 0.002;
    const env = Math.sin((Math.PI * t) / dur) ** 2;
    put(i0 + k, (lp - hp) * env * g, pan, 0.3);
  }
}

function keyClick(t0, g = 0.22, pan = 0) {
  // a mechanical key: a very short noise transient plus a low thock
  const n = Math.round(0.055 * SR);
  const i0 = Math.round(t0 * SR);
  let lp = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const x = noise();
    const a = 1 - Math.exp((-2 * Math.PI * 3800) / SR);
    lp += (x - lp) * a;
    const click = (x - lp) * Math.exp(-t * 320) * 0.6;
    const thock = Math.sin(2 * Math.PI * 165 * t) * Math.exp(-t * 46);
    put(i0 + k, (click + thock) * g, pan, 0.08);
  }
}

function glassTick(t0, g = 0.16, pan = 0) {
  const n = Math.round(0.3 * SR);
  const i0 = Math.round(t0 * SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const env = Math.exp(-t * 42);
    const v = Math.sin(2 * Math.PI * 2860 * t) * 0.5 + Math.sin(2 * Math.PI * 4310 * t) * 0.3;
    put(i0 + k, v * env * g, pan, 0.5);
  }
}

function riser(t0, dur, g = 0.24) {
  const n = Math.round(dur * SR);
  const i0 = Math.round(t0 * SR);
  let lp = 0;
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const x = noise();
    const cut = 300 * Math.pow(30, t / dur);
    const a = 1 - Math.exp((-2 * Math.PI * cut) / SR);
    lp += (x - lp) * a;
    ph += (60 + 500 * (t / dur) ** 2) / SR;
    const env = (t / dur) ** 2.2;
    put(i0 + k, (lp * 1.1 + Math.sin(2 * Math.PI * ph) * 0.22) * env * g, 0, 0.35);
  }
}

function enter(t0, g = 0.5) {
  const n = Math.round(0.5 * SR);
  const i0 = Math.round(t0 * SR);
  let lp = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const x = noise();
    const a = 1 - Math.exp((-2 * Math.PI * 1600) / SR);
    lp += (x - lp) * a;
    const clack = (x - lp) * Math.exp(-t * 160) * 0.8;
    const body = Math.sin(2 * Math.PI * 96 * t) * Math.exp(-t * 22) * 0.7;
    put(i0 + k, (clack + body) * g, 0, 0.7);
  }
}

/* --------------------------------------------------------------- the sheet */

drone(0, 30, 0.22); // the room tone for the whole film
drone(24, 6, 0.2); // the outro keeps only this

subDrop(0.5, 1.0); // scene 1
air(3.55, 0.9, 0.34, -0.2); // the whip into split screen
air(9.6, 0.7, 0.42, 0.3); // the harder whip into the edge
subDrop(10.0, 0.55);

// typing, one click per character of "edge deploy" and the checkmarks
for (let i = 0; i < 26; i++) keyClick(10.15 + i * 0.055, 0.15 + rnd([i]) * 0.06, (i % 2 ? 0.25 : -0.25));
for (let i = 0; i < 4; i++) keyClick(11.7 + i * 0.34, 0.2, 0);

// the beat grid under the montage: a quiet pulse, not a drum kit
for (let b = 0; b < 10; b++) {
  const t = 10.4 + b * 0.8;
  keyClick(t, 0.1, 0);
}

riser(16.4, 1.6, 0.26);
subDrop(18.0, 1.15); // the widest point

for (let i = 0; i < 6; i++) glassTick(19.2 + i * 0.9, 0.11, i % 2 ? 0.2 : -0.2);
riser(22.6, 1.4, 0.16);
enter(26.55, 0.55);

function rnd(arr) {
  const n = arr[0];
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/* ---------------------------------------------------------------- reverb */

function reverb(send, wet) {
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ buf: new Float32Array(Math.round((d * SR) / 44100)), i: 0, store: 0 }));
  const aps = [556, 441].map((d) => ({ buf: new Float32Array(Math.round((d * SR) / 44100)), i: 0 }));
  const out = new Float32Array(send.length);
  let hp = 0;
  const hpA = Math.exp((-2 * Math.PI * 420) / SR);
  for (let n = 0; n < send.length; n++) {
    hp = hp * hpA + send[n] * (1 - hpA);
    const x = send[n] - hp;
    let acc = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.store = y * 0.72 + c.store * 0.28;
      c.buf[c.i] = x * 0.6 + c.store * 0.86;
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

const wet = reverb(SEND, 0.4);
let peak = 0;
for (let n = 0; n < N; n++) {
  L[n] = Math.tanh((L[n] + wet[n] * 0.5) * 0.8) / 0.8;
  R[n] = Math.tanh((R[n] + wet[n] * 0.45) * 0.8) / 0.8;
  peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
}
const g = 0.86 / peak;
const tail = Math.round(1.2 * SR);
for (let k = 0; k < tail; k++) {
  const a = 1 - k / tail;
  L[N - 1 - k] *= a;
  R[N - 1 - k] *= a;
}

const out = process.argv[2] || "/tmp/edge.wav";
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
console.log(`sound design: ${DUR}s · 2 ch · ${(bytes / 1048576).toFixed(1)} MB → ${out}`);
