/**
 * «الطابق الأخير» — 4.2 s of horror sound for a 2.0 s generated plate.
 *
 * A horror cue is mostly *restraint*: a room that breathes, a filament that ticks
 * before it dies, one creak, then a gap wide enough for the audience to imagine the
 * rest, and a single violent event. Everything here is synthesised — no libraries.
 *
 *   node studio/score_horror.mjs out.wav
 */
import { writeFileSync } from "node:fs";

const SR = 48000;
const DUR = 4.2;
const N = Math.round(DUR * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);
const SEND = new Float32Array(N);
const TAU = Math.PI * 2;

// The plate occupies film-time 0.30 s .. 2.30 s; every event below is written in
// film time and offsets from that window, so picture and sound cannot drift.
const P0 = 0.3;
const pt = (t) => P0 + t * 2.0;

let seed = 0x2f1a97;
const rnd = () => {
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
const at = (t) => Math.round(t * SR);

/* ------------------------------------------------------------- the room itself */

(() => {
  // a corridor has a mode that hums; two, in fact, beating against each other
  let lp = 0;
  let lp2 = 0;
  let hp = 0;
  let prev = 0;
  // The leak has to be INSIDE the accumulator. `prev += lp2` alone is a true integrator:
  // it random-walks for 185 000 samples, and the "room tone" ends up a 10 dB-louder-than-the-
  // impact wall of sub-audible wander. Leaky + differentiate = brown noise you can actually hear.
  let hpPrev = 0;
  for (let k = 0; k < N; k++) {
    const t = k / SR;
    const n = rnd();
    lp += (n - lp) * (1 - Math.exp((-TAU * 900) / SR));
    lp2 += (lp - lp2) * (1 - Math.exp((-TAU * 120) / SR));
    prev = (prev + lp2) * 0.985;                    // bounded brown
    hp = prev - hpPrev;                             // DC block
    hpPrev = hp;
    const swell = 0.55 + 0.45 * Math.sin(t * TAU * 0.23);
    const gate = t < 0.18 ? t / 0.18 : t > 3.95 ? Math.max(0, (4.2 - t) / 0.25) : 1;
    put(k, hp * 1.05 * swell * gate, Math.sin(t / 11) * 0.5, 0.14);
  }
})();

/* ------------------------------------------------------------------ bulb hum */

function hum(t0, t1, gain = 0.05) {
  const i0 = at(t0);
  const i1 = at(t1);
  for (let k = i0; k < i1 && k < N; k++) {
    const t = (k - i0) / SR;
    const env = Math.min(1, t / 0.05) * Math.min(1, (t1 - t0 - t) / 0.06);
    const jit = 1 + 0.06 * Math.sin(t * TAU * 3.1);
    const v =
      (Math.sin(t * TAU * 100 * jit) * 0.5 + Math.sin(t * TAU * 300) * 0.22 + Math.sin(t * TAU * 1200) * 0.06) *
      env *
      gain;
    put(k, v, 0.12, 0.05);
  }
}

function tick(t0, gain = 0.5) {
  const i0 = at(t0);
  for (let k = 0; k < Math.round(0.035 * SR); k++) {
    const t = k / SR;
    const v = Math.exp(-t * 900) * (Math.sin(t * TAU * 2400) * 0.5 + rnd() * 0.6) * gain;
    put(i0 + k, v, (rnd() + 1) * 0.25 - 0.5, 0.25);
  }
}

/* ------------------------------------------------------------------ the creak */

function creak(t0, dur, gain = 0.4) {
  const i0 = at(t0);
  const n = Math.round(dur * SR);
  let y1 = 0;
  let y2 = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const x = rnd();
    // sticky-slip: a resonator swept by an accelerating sawtooth of amplitude
    const f = 260 + 340 * Math.pow(t / dur, 1.6) + 90 * Math.sin(t * TAU * 7.5);
    const a = Math.exp((-TAU * f) / SR);
    const b = 0.985;
    y1 = x * 0.35 + y1 * a * 0 + (y1 - y2) * 0.985;
    y2 = y1;
    const res = Math.sin(t * TAU * f) * (0.55 + 0.45 * Math.sin(t * TAU * 13));
    const env = Math.min(1, t / 0.06) * Math.min(1, (dur - t) / (dur * 0.35));
    const stick = Math.pow(Math.max(0, Math.sin(t * TAU * 3.3)), 6);
    put(i0 + k, (res * 0.5 + (y1 - y2) * 0.6 + rnd() * 0.02 * stick) * env * gain, -0.35, 0.5);
  }
}

/* ------------------------------------------------------------------- the death */

function powerDown(t0, gain = 0.85) {
  const dur = 0.42;
  const i0 = at(t0);
  let ph = 0;
  for (let k = 0; k < Math.round(dur * SR); k++) {
    const t = k / SR;
    const f = 240 * Math.exp(-t * 7.5) + 26;
    ph += (TAU * f) / SR;
    const env = Math.exp(-t * 4.2);
    const v = Math.sin(ph) * env * gain + (Math.sin(ph * 2) * 0.18 + rnd() * 0.05) * env;
    put(i0 + k, v, 0, 0.3);
  }
}

function flash(t0, gain = 0.95) {
  const i0 = at(t0);
  const n = Math.round(0.55 * SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const crack = Math.exp(-t * 26) * (rnd() * 0.9 + Math.sin(t * TAU * 1800) * 0.25);
    const body = Math.sin(t * TAU * (58 - 22 * Math.min(1, t * 3))) * Math.exp(-t * 6);
    const rumble = Math.exp(-t * 2.1) * (rnd() * 0.4) * Math.min(1, t * 40);
    put(i0 + k, (crack * 0.5 + body * 0.8 + rumble * 0.5) * gain, (rnd() - 0.5) * 0.3, 0.75);
  }
}

function step(t0, gain = 0.42, pan = -0.2) {
  const i0 = at(t0);
  for (let k = 0; k < Math.round(0.13 * SR); k++) {
    const t = k / SR;
    const v =
      (Math.sin(t * TAU * (72 - 30 * Math.min(1, t * 22))) * Math.exp(-t * 30) * 0.8 +
        rnd() * Math.exp(-t * 220) * 0.5) *
      gain;
    put(i0 + k, v, pan, 0.42);
  }
}

function stinger(t0, gain = 1.0) {
  const i0 = at(t0);
  const n = Math.round(1.5 * SR);
  let lp = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const scrape = (rnd() * 0.7 + Math.sin(t * TAU * (318 + 92 * Math.sin(t * 9))) * 0.5) * Math.exp(-t * 4.6);
    const sub = Math.sin(t * TAU * (41 - 12 * Math.min(1, t * 2.2))) * Math.exp(-t * 2.3);
    lp += (rnd() - lp) * 0.02;
    put(i0 + k, (scrape * 0.45 + sub * 0.95 + lp * 0.25 * Math.exp(-t * 1.5)) * gain, (rnd() - 0.5) * 0.2, 0.85);
  }
}

function droneNote(t0, f, dur, gain = 0.18) {
  const i0 = at(t0);
  const n = Math.round(dur * SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const env = Math.min(1, t / 0.5) * Math.min(1, (dur - t) / 0.8);
    const v =
      (Math.sin(t * TAU * f) * 0.6 + Math.sin(t * TAU * f * 1.005) * 0.4 + Math.sin(t * TAU * f * 2.01) * 0.14) * env *
      gain;
    put(i0 + k, v, Math.sin(t * 0.7) * 0.35, 0.5);
  }
}

/* -------------------------------------------------------------- the score bed */

// alive, flickering, dead
hum(P0, pt(0.548), 0.019);
tick(pt(0.062), 0.52);
tick(pt(0.080), 0.42);
tick(pt(0.238), 0.46);
tick(pt(0.258), 0.30);
creak(pt(0.44), 0.62, 0.44);
powerDown(pt(0.548), 0.8);
// the gap: nothing but the room, on purpose
step(pt(0.665), 0.42, -0.15);
step(pt(0.735), 0.5, 0.1);
flash(pt(0.730), 1.55);         // light first, then the bang — the 24 ms the eye needs
tick(pt(0.832), 0.85);
hum(pt(0.832), pt(0.905), 0.026);
powerDown(pt(0.905), 0.6);
tick(2.3 + 0.02, 1.25);
stinger(2.32, 1.3);
// and after it: the corridor again, with the name in it
droneNote(2.5, 41.2, 1.7, 0.145);
droneNote(2.56, 61.7, 1.6, 0.1);
tick(2.62, 0.5);

/* ------------------------------------------------------------------- reverb */

function reverb(send, wetGain) {
  const combs = [1557, 1617, 1491, 1422, 1281].map((d) => ({
    buf: new Float32Array(Math.round((d * SR) / 44100)),
    i: 0,
    store: 0,
  }));
  const aps = [556, 441, 341].map((d) => ({ buf: new Float32Array(Math.round((d * SR) / 44100)), i: 0 }));
  const out = new Float32Array(send.length);
  const hpA = Math.exp((-TAU * 300) / SR);
  let hp = 0;
  for (let n = 0; n < send.length; n++) {
    hp = hp * hpA + send[n] * (1 - hpA);
    const x = send[n] - hp;
    let acc = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.store = y * 0.74 + c.store * 0.26;
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
    out[n] = v * wetGain;
  }
  return out;
}

const wet = reverb(SEND, 0.42);
// The curve is a limiter for the TRANSIENTS, not a loudness tool: drive the mix at 0.42
// into tanh and only the hits saturate. Push it at 0.95 and the whole bed flattens into a
// wall (that is what the first master sounded like: mean -2 dB, peak -0.7 dB, no air).
let peak = 0;
const DRV = 0.42;
for (let n = 0; n < N; n++) {
  L[n] = Math.tanh((L[n] + wet[n] * 0.45) * DRV) / DRV;
  R[n] = Math.tanh((R[n] + wet[n] * 0.42) * DRV) / DRV;
  peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
}
// A master for a phone, not for a mastering house: aim the RMS at -14 dB (the level the
// NAKSAB films deliver at) and only then cap the peak. Normalising the peak alone is what
// turned the first version into a 3 dB-crest wall with no air in it.
let sq = 0;
for (let n = 0; n < N; n++) sq += L[n] * L[n] + R[n] * R[n];
const rms = Math.sqrt(sq / (2 * N));
const g = Math.min(0.92 / peak, 10 ** (-14 / 20) / Math.max(rms, 1e-6));
const fade = Math.round(0.35 * SR);
for (let k = 0; k < fade; k++) {
  const a = 1 - k / fade;
  L[N - 1 - k] *= a;
  R[N - 1 - k] *= a;
}
// a hard leading silence of 3 frames keeps the picture's fade-up honest
const lead = Math.round(0.1 * SR);
for (let k = 0; k < lead; k++) {
  const a = k / lead;
  L[k] *= a;
  R[k] *= a;
}

const out = process.argv[2] || "/tmp/horror.wav";
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
console.log(`horror score: ${DUR}s · ${(bytes / 1048576).toFixed(1)} MB → ${out}`);
