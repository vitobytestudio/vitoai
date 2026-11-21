/**
 * IGNITION — the score for the Vito Byte Studio spot.
 *
 * Not a sound bed. A song: 120 BPM, A minor, drums, sub bass, arpeggio, pads,
 * a lead motif, risers and hits — every element written to land on the same
 * bar grid the picture is cut on (2.0 s = one bar, 0.5 s = one beat).
 *
 * Synthesis only: sine, saw, noise, envelopes, one filter, one reverb. No
 * samples, no library, no licence.
 *
 *   node studio/track.mjs out.wav
 */
import { writeFileSync } from "node:fs";

const SR = 48000;
const BPM = 120;
const BEAT = 60 / BPM; // 0.5 s
const BAR = BEAT * 4; // 2.0 s
const DUR = 2.0 + 4.0 + 4.0 + 4.0 + 4.0 + 2.0 + 6.0 + 6.0 + 4.0; // 36 s
const N = Math.round((DUR + 0.9) * SR);

const L = new Float32Array(N);
const R = new Float32Array(N);
const SEND = new Float32Array(N); // reverb send, mono

let seed = 0x2f6e2b1;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 0xffffffff) * 2 - 1;
};
const panGains = (p) => {
  const a = ((p + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
};
const put = (i, v, [gl, gr], send = 0) => {
  if (i < 0 || i >= N) return;
  L[i] += v * gl;
  R[i] += v * gr;
  if (send) SEND[i] += v * send;
};
const at = (bar, beat = 0) => 0.2 + bar * BAR + beat * BEAT; // 0.2 s of pre-roll

/* ------------------------------------------------------------ instruments */

function kick(t0, g = 1) {
  const n = Math.round(0.46 * SR);
  const i0 = Math.round(t0 * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const f = 46 + 132 * Math.exp(-t * 34);
    ph += (2 * Math.PI * f) / SR;
    const body = Math.sin(ph) * Math.exp(-t * 7.2);
    const click = Math.exp(-t * 420) * noise() * 0.4;
    put(i0 + k, (body + click) * g * 0.95, [0.7, 0.7], 0.05);
  }
}

function sub(t0, f, dur, g = 1) {
  const n = Math.round(dur * SR);
  const i0 = Math.round(t0 * SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const env = Math.min(1, t * 60) * Math.exp(-t * 1.4) * Math.min(1, (dur - t) * 20);
    put(i0 + k, Math.sin(2 * Math.PI * f * t) * env * g * 0.75, [0.7, 0.7]);
  }
}

function snare(t0, g = 0.5, pan = 0) {
  const n = Math.round(0.2 * SR);
  const i0 = Math.round(t0 * SR);
  const pg = panGains(pan);
  let lp = 0;
  const a = Math.exp((-2 * Math.PI * 2200) / SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const x = noise();
    lp = lp * a + x * (1 - a);
    const band = x - lp;
    const body = Math.sin(2 * Math.PI * 186 * t) * Math.exp(-t * 26) * 0.5;
    const env = Math.exp(-t * 19);
    put(i0 + k, (band * env + body) * g, pg, 0.3);
  }
}

function clap(t0, g = 0.35, pan = 0) {
  const pg = panGains(pan);
  for (const d of [0, 0.009, 0.019, 0.031]) {
    const n = Math.round(0.16 * SR);
    const i0 = Math.round((t0 + d) * SR);
    let lp = 0;
    const a = Math.exp((-2 * Math.PI * 1500) / SR);
    for (let k = 0; k < n; k++) {
      const t = k / SR;
      const x = noise();
      lp = lp * a + x * (1 - a);
      put(i0 + k, (x - lp) * Math.exp(-t * 34) * g, pg, 0.5);
    }
  }
}

function hat(t0, g = 0.22, open = false, pan = 0.3) {
  const n = Math.round((open ? 0.26 : 0.07) * SR);
  const i0 = Math.round(t0 * SR);
  const pg = panGains(pan);
  let lp = 0;
  const a = Math.exp((-2 * Math.PI * 5200) / SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const x = noise();
    lp = lp * a + x * (1 - a);
    put(i0 + k, (x - lp) * Math.exp(-t * (open ? 15 : 62)) * g * 1.7, pg);
  }
}

function bass(t0, f, dur, g = 0.5) {
  const n = Math.round(dur * SR);
  const i0 = Math.round(t0 * SR);
  let ph = 0;
  let lp = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    ph += f / SR;
    ph -= Math.floor(ph);
    const saw = 2 * ph - 1;
    const cut = 150 + 760 * Math.exp(-t * 9);
    const a = 1 - Math.exp((-2 * Math.PI * cut) / SR);
    lp += (saw - lp) * a;
    const env = Math.min(1, t * 240) * Math.exp(-t * 2.2) * Math.min(1, (dur - t) * 90);
    put(i0 + k, (lp * 0.9 + Math.sin(2 * Math.PI * f * 0.5 * t) * 0.5) * env * g, [0.62, 0.62], 0.03);
  }
}

function pluck(t0, f, dur, g = 0.3, bright = 1, pan = 0) {
  const n = Math.round(dur * SR);
  const i0 = Math.round(t0 * SR);
  const pg = panGains(pan);
  let ph = 0;
  let lp = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    ph += f / SR;
    ph -= Math.floor(ph);
    const saw = 2 * ph - 1;
    const cut = 380 + 4200 * bright * Math.exp(-t * 26);
    const a = 1 - Math.exp((-2 * Math.PI * cut) / SR);
    lp += (saw - lp) * a;
    const env = Math.min(1, t * 400) * Math.exp(-t * 7.5) * Math.min(1, (dur - t) * 120);
    put(i0 + k, lp * env * g, pg, 0.34);
  }
}

function pad(t0, freqs, dur, g = 0.22) {
  const n = Math.round(dur * SR);
  const i0 = Math.round(t0 * SR);
  for (const f of freqs) {
    for (let d = -1; d <= 1; d++) {
      const det = f * (1 + d * 0.0045);
      let ph = (d + 1) * 0.33;
      let lp = 0;
      const pg = panGains(d * 0.65);
      for (let k = 0; k < n; k++) {
        const t = k / SR;
        ph += det / SR;
        ph -= Math.floor(ph);
        const saw = 2 * ph - 1;
        const a = 1 - Math.exp((-2 * Math.PI * 1500) / SR);
        lp += (saw - lp) * a;
        const env = Math.min(1, t / 0.9) * Math.min(1, (dur - t) / 1.1);
        put(i0 + k, lp * env * g * 0.32, pg, 0.55);
      }
    }
  }
}

function lead(t0, f, dur, g = 0.22, pan = 0) {
  const n = Math.round(dur * SR);
  const i0 = Math.round(t0 * SR);
  const pg = panGains(pan);
  let ph = 0;
  let lp = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const vib = 1 + 0.004 * Math.sin(2 * Math.PI * 5.4 * t) * Math.min(1, t * 3);
    ph += (f * vib) / SR;
    ph -= Math.floor(ph);
    const tri = 4 * Math.abs(ph - 0.5) - 1;
    const saw = 2 * ph - 1;
    const a = 1 - Math.exp((-2 * Math.PI * 2600) / SR);
    lp += (saw * 0.5 + tri * 0.5 - lp) * a;
    const env = Math.min(1, t * 90) * Math.exp(-t * 1.1) * Math.min(1, (dur - t) * 26);
    put(i0 + k, lp * env * g, pg, 0.45);
  }
}

function impact(t0, g = 1, big = false) {
  const n = Math.round((big ? 2.6 : 1.4) * SR);
  const i0 = Math.round(t0 * SR);
  let ph = 0;
  let lp = 0;
  const a = Math.exp((-2 * Math.PI * 900) / SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    ph += (2 * Math.PI * (34 + 90 * Math.exp(-t * 16))) / SR;
    const boom = Math.sin(ph) * Math.exp(-t * (big ? 1.5 : 2.6));
    const x = noise();
    lp = lp * a + x * (1 - a);
    const air = (x - lp) * Math.exp(-t * 7) * 0.5;
    put(i0 + k, (boom + air) * g, [0.68, 0.68], 0.6);
  }
}

function riser(t0, dur, g = 0.4) {
  const n = Math.round(dur * SR);
  const i0 = Math.round(t0 * SR);
  const pg = panGains(0);
  let lp = 0;
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const x = noise();
    const cut = 300 * Math.pow(24, t / dur);
    const a = 1 - Math.exp((-2 * Math.PI * cut) / SR);
    lp += (x - lp) * a;
    const env = Math.pow(t / dur, 2.2);
    ph += (220 + 900 * (t / dur) * (t / dur)) / SR;
    put(i0 + k, (lp * 1.5 + Math.sin(2 * Math.PI * ph) * 0.18) * env * g, pg, 0.4);
  }
}

function sweepDown(t0, g = 0.5) {
  const n = Math.round(1.2 * SR);
  const i0 = Math.round(t0 * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    ph += (2 * Math.PI * (620 * Math.exp(-t * 3.2) + 40)) / SR;
    put(i0 + k, Math.sin(ph) * Math.exp(-t * 3) * g, [0.7, 0.7], 0.4);
  }
}

/* ---------------------------------------------------------------- harmony */

const CH = [
  { root: 55.0, notes: [220.0, 261.63, 329.63, 493.88] }, // Am9
  { root: 43.65, notes: [174.61, 220.0, 261.63, 392.0] }, // Fmaj9
  { root: 65.41, notes: [196.0, 261.63, 329.63, 392.0] }, // C/G
  { root: 49.0, notes: [196.0, 246.94, 293.66, 392.0] }, // G
];
const chordAt = (bar) => CH[bar % 4];

/* ------------------------------------------------------------- arrangement */

const S = {
  ignition: 0,
  swarm: 1,
  system: 3,
  pipeline: 5,
  decision: 7,
  build: 9,
  product: 10,
  drop: 13,
  end: 16,
};

// 0 · ignition — one hit, one breath, a riser into the swarm
impact(at(0), 1, true);
sub(at(0), 55, 1.9, 0.9);
sweepDown(at(0), 0.35);
riser(at(0) + 0.4, 1.6, 0.3);

// 1..2 · swarm — the pulse arrives
for (let bar = 1; bar <= 2; bar++) {
  const ch = chordAt(bar);
  kick(at(bar, 0), 0.85);
  kick(at(bar, 2), 0.7);
  sub(at(bar, 0), ch.root, 0.85, 0.5);
  sub(at(bar, 2), ch.root, 0.85, 0.4);
  pad(at(bar), ch.notes, BAR * 1.05, 0.17);
  for (let s = 0; s < 8; s++) hat(at(bar, s / 2), 0.16, false, s % 2 ? 0.45 : 0.1);
  for (let s = 0; s < 16; s++) {
    const n = ch.notes[(s * 3) % ch.notes.length] * (s % 8 > 5 ? 2 : 1);
    pluck(at(bar, s / 4), n, 0.3, 0.1, 0.45, s % 2 ? 0.4 : -0.4);
  }
}

// 3..4 · system — kick locks, hats open
for (let bar = 3; bar <= 4; bar++) {
  const ch = chordAt(bar);
  for (let b = 0; b < 4; b++) kick(at(bar, b), 0.9);
  sub(at(bar, 0), ch.root, 0.9, 0.55);
  sub(at(bar, 2.5), ch.root * 1.5, 0.4, 0.35);
  pad(at(bar), ch.notes, BAR * 1.05, 0.24);
  snare(at(bar, 1), 0.28, -0.1);
  snare(at(bar, 3), 0.28, 0.1);
  for (let s = 0; s < 16; s++) hat(at(bar, s / 4), 0.1, false, s % 2 ? 0.5 : -0.2);
  hat(at(bar, 3.5), 0.2, true, 0.4);
  for (let s = 0; s < 16; s++) {
    const n = ch.notes[(s * 5) % ch.notes.length] * 2;
    pluck(at(bar, s / 4), n, 0.22, 0.11, 0.62, s % 2 ? 0.45 : -0.45);
  }
}

// 5..6 · pipeline — bassline, movement
for (let bar = 5; bar <= 6; bar++) {
  const ch = chordAt(bar);
  for (let b = 0; b < 4; b++) kick(at(bar, b), 0.95);
  for (let s = 0; s < 8; s++) bass(at(bar, s / 2), ch.root * (s % 4 === 3 ? 2 : 1), 0.22, 0.42);
  pad(at(bar), ch.notes, BAR * 1.05, 0.24);
  clap(at(bar, 1), 0.3, -0.12);
  clap(at(bar, 3), 0.3, 0.12);
  for (let s = 0; s < 16; s++) hat(at(bar, s / 4), 0.11, false, s % 2 ? 0.5 : -0.2);
  hat(at(bar, 3.5), 0.22, true, 0.4);
  for (let s = 0; s < 16; s++) {
    const n = ch.notes[(s * 3) % ch.notes.length] * (s % 8 > 3 ? 4 : 2);
    pluck(at(bar, s / 4), n, 0.19, 0.1, 0.75, s % 2 ? 0.55 : -0.55);
  }
}

// 7..8 · decision — strip to tension, then the biggest riser
{
  const ch = chordAt(7);
  pad(at(7), ch.notes, BAR * 2.0, 0.3);
  sub(at(7), ch.root, 3.8, 0.4);
  for (let s = 0; s < 32; s++) hat(at(7, s / 8), 0.07, false, s % 2 ? 0.6 : -0.6);
  for (let s = 0; s < 16; s++) {
    if (s % 2 === 0) pluck(at(7, s / 4), ch.notes[s % 4] * 2, 0.14, 0.08, 0.5, s % 4 ? 0.5 : -0.5);
  }
  kick(at(8, 0), 0.8);
  kick(at(8, 2), 0.8);
  riser(at(8, 0), 2.0, 0.5);
  for (let s = 0; s < 8; s++) snare(at(8, s / 2), 0.06 + s * 0.03, s % 2 ? 0.2 : -0.2);
}

// 9 · build montage — four beats, each one louder, cut short before the drop
{
  const ch = chordAt(9);
  for (let b = 0; b < 4; b++) {
    kick(at(9, b), 0.85 + b * 0.05);
    pluck(at(9, b), ch.notes[b % 4] * 2, 0.24, 0.16, 0.9, b % 2 ? 0.4 : -0.4);
  }
  snare(at(9, 3.75), 0.4, 0);
  riser(at(9, 2.5), 0.5, 0.35);
}

// 10..12 · product — the full groove
for (let bar = 10; bar <= 12; bar++) {
  const ch = chordAt(bar);
  for (let b = 0; b < 4; b++) kick(at(bar, b), 1);
  for (let s = 0; s < 16; s++) {
    const g = s % 4 === 0 ? 1 : s % 2 === 0 ? 0.72 : 0.5;
    bass(at(bar, s / 4), ch.root * (s % 4 === 3 ? 2 : 1), 0.14, 0.34 * g);
  }
  pad(at(bar), ch.notes, BAR * 1.05, 0.22);
  clap(at(bar, 1), 0.34, -0.12);
  clap(at(bar, 3), 0.34, 0.12);
  for (let s = 0; s < 16; s++) hat(at(bar, s / 4), s % 4 === 2 ? 0.16 : 0.09, false, s % 2 ? 0.55 : -0.25);
  hat(at(bar, 3.5), 0.24, true, 0.4);
  for (let s = 0; s < 16; s++) {
    const n = ch.notes[(s * 3) % ch.notes.length] * 2;
    pluck(at(bar, s / 4), n, 0.17, 0.11, 0.85, s % 2 ? 0.6 : -0.6);
  }
  // the motif
  const m = [0, 2, 3, 2, 1, 3, 2, 1];
  for (let s = 0; s < 8; s++) {
    lead(at(bar, s / 2), ch.notes[m[s] % 4] * (s > 5 ? 4 : 2), 0.3, 0.13, s % 2 ? 0.3 : -0.3);
  }
}

// 13..15 · drop — everything, beat-locked
for (let bar = 13; bar <= 15; bar++) {
  const ch = chordAt(bar);
  for (let b = 0; b < 4; b++) kick(at(bar, b), 1.05);
  for (let s = 0; s < 16; s++) bass(at(bar, s / 4), ch.root * (s % 4 === 3 ? 2 : 1), 0.12, 0.36);
  pad(at(bar), ch.notes, BAR * 1.05, 0.17);
  clap(at(bar, 1), 0.4, -0.2);
  clap(at(bar, 3), 0.4, 0.2);
  for (let s = 0; s < 16; s++) hat(at(bar, s / 4), s % 4 === 2 ? 0.18 : 0.1, false, s % 2 ? 0.6 : -0.3);
  hat(at(bar, 3.5), 0.26, true, 0.4);
  for (let s = 0; s < 16; s++) {
    const n = ch.notes[(s * 2) % ch.notes.length] * (s % 8 > 3 ? 4 : 2);
    pluck(at(bar, s / 4), n, 0.15, 0.13, 1, s % 2 ? 0.7 : -0.7);
  }
  for (let s = 0; s < 4; s++) lead(at(bar, s / 2), ch.notes[[0, 3, 2, 1][s]] * 2, 0.22, 0.1, s % 2 ? 0.4 : -0.4);
}
impact(at(13), 0.9);
impact(at(14), 0.7);

// 16.. · end card
impact(at(16), 1, true);
sub(at(16), 55, 2.2, 0.8);
pad(at(16), [220.0, 261.63, 329.63, 392.0, 493.88], 3.4, 0.3);
lead(at(16, 0.5), 880.0, 0.6, 0.16, -0.2);
lead(at(16, 1), 659.25, 0.7, 0.14, 0.2);
lead(at(16, 2), 880.0, 1.2, 0.18, 0);
sub(at(16, 2), 110, 1.8, 0.3);
riser(at(16, 3.2), 0.7, 0.16);

/* ----------------------------------------------------------------- reverb */

function reverb(send, wet = 0.5) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => ({
    buf: new Float32Array(Math.round((d * SR) / 44100)),
    i: 0,
    store: 0,
    fb: 0.8,
    damp: 0.28,
  }));
  const aps = [556, 441, 341].map((d) => ({ buf: new Float32Array(Math.round((d * SR) / 44100)), i: 0 }));
  const out = new Float32Array(send.length);
  let hp = 0;
  const hpA = Math.exp((-2 * Math.PI * 340) / SR);
  for (let n = 0; n < send.length; n++) {
    // high-pass the send: a reverberated kick is mud, not depth
    hp = hp * hpA + send[n] * (1 - hpA);
    const x = send[n] - hp;
    let acc = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.store = y * (1 - c.damp) + c.store * c.damp;
      c.buf[c.i] = x * 0.6 + c.store * c.fb;
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

const wet = reverb(SEND, 0.46);
for (let n = 0; n < N; n++) {
  L[n] += wet[n] * 0.5;
  R[n] += wet[n] * 0.46;
}

/* ----------------------------------------------------------------- master */

// The arrangement is deliberately quiet at the top — but a phone speaker at
// 20 % volume throws that away. Lift the first thirteen seconds so the build
// survives, and leave the drop where it already is.
for (let n = 0; n < N; n++) {
  const t = n / SR;
  const lift = 1 + 0.5 * Math.max(0, 1 - t / 13) ** 1.4;
  L[n] *= lift;
  R[n] *= lift;
}

let peak = 0;
for (let n = 0; n < N; n++) {
  // soft knee compression, then a gentle tape-style saturation
  const l = Math.tanh(L[n] * 0.62) / 0.62;
  const r = Math.tanh(R[n] * 0.62) / 0.62;
  L[n] = l;
  R[n] = r;
  peak = Math.max(peak, Math.abs(l), Math.abs(r));
}
const g = 0.92 / peak;
for (let n = 0; n < N; n++) {
  L[n] *= g;
  R[n] *= g;
}
// fade the last 0.6 s so the file cannot click out
const tail = Math.round(0.6 * SR);
for (let k = 0; k < tail; k++) {
  const a = 1 - k / tail;
  L[N - 1 - k] *= a;
  R[N - 1 - k] *= a;
}

/* ------------------------------------------------------------------- wav */

const out = process.argv[2] || "/tmp/track.wav";
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
  b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[n] * 32767))), 44 + n * 4);
  b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[n] * 32767))), 46 + n * 4);
}
writeFileSync(out, b);
console.log(`track: ${(N / SR).toFixed(2)}s · ${((bytes / 1048576) | 0)} MB · peak gain ${g.toFixed(2)} → ${out}`);
