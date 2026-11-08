/**
 * SCORE — sound design, synthesised.
 *
 * A film without sound is a slideshow. This generates the whole soundtrack from
 * the cue sheet the picture is cut from, so a cut and its impact are the same
 * number of seconds: they cannot drift.
 *
 * Everything is sine, noise and an envelope. No samples, no library, no licence.
 *
 * The mix is built the way a trailer is built:
 *   · a sub bed that carries the weight (55 Hz and its fifth)
 *   · an air layer so silence never sounds like a broken file
 *   · an impact on every cut, bigger on the act breaks
 *   · a whoosh approaching every whip, rising into the cut, not after it
 *   · a riser into the biggest beat
 *   · a shimmer on the end card
 *
 * Then: soft clip, normalise, and hand off to loudnorm at -14 LUFS.
 */
import { writeFileSync, readFileSync } from "node:fs";

const SR = 48000;

/* ------------------------------------------------------------------ sheet */

const args = process.argv.slice(2);
const cuePath = args[0] || "/tmp/cues.json";
const outPath = args[1] || "/tmp/score.wav";
const sheet = JSON.parse(readFileSync(cuePath, "utf8"));
const total = sheet.beats.reduce((n, b) => n + b.seconds, 0) + 0.6;
const N = Math.ceil(total * SR);

const L = new Float32Array(N);
const R = new Float32Array(N);

/* --------------------------------------------------------------- helpers */

let seed = 20261029;
const noise = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return ((seed >>> 0) / 4294967296) * 2 - 1;
};

const TAU = Math.PI * 2;

/** one-pole low pass, state carried by the caller */
const lp = (state, x, hz) => {
  const a = 1 - Math.exp((-TAU * hz) / SR);
  state.y += a * (x - state.y);
  return state.y;
};
const hp = (state, x, hz) => {
  const a = 1 - Math.exp((-TAU * hz) / SR);
  state.y += a * (x - state.y);
  return x - state.y;
};

const write = (i, v, pan = 0) => {
  if (i < 0 || i >= N) return;
  const gl = Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = Math.sin(((pan + 1) * Math.PI) / 4);
  L[i] += v * gl;
  R[i] += v * gr;
};

/* --------------------------------------------------------------- voices */

/** the kick that gives a cut weight: a pitch drop, not a click */
const impact = (t0, gain = 0.8, big = false) => {
  const start = Math.floor(t0 * SR);
  const dur = big ? 1.5 : 0.9;
  const n = Math.floor(dur * SR);
  let phase = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const f = (big ? 92 : 74) * Math.exp(-t * (big ? 5.2 : 7.4)) + 30;
    phase += (TAU * f) / SR;
    const env = Math.exp(-t * (big ? 3.1 : 4.6));
    const body = Math.sin(phase) * env * gain;
    // a short noise transient makes it read as an object hitting something
    const click = k < 900 ? noise() * Math.exp(-k / 220) * 0.28 * gain : 0;
    write(start + k, body + click);
  }
  // sub tail
  const tail = Math.floor(2.4 * SR);
  for (let k = 0; k < tail; k++) {
    const t = k / SR;
    const env = Math.exp(-t * 1.1) * 0.22 * gain;
    write(start + k, Math.sin(TAU * 34 * t) * env);
  }
};

/** noise sweeping up into a cut: the sound of a whip between two shots */
const whoosh = (tEnd, dur = 0.62, gain = 0.5) => {
  const start = Math.floor((tEnd - dur) * SR);
  const n = Math.floor(dur * SR);
  const st = { y: 0 };
  for (let k = 0; k < n; k++) {
    const p = k / n;
    const env = Math.pow(p, 2.4) * (1 - Math.max(0, p - 0.94) / 0.06);
    const cutoff = 260 + Math.pow(p, 2) * 5200;
    const s = lp(st, noise(), cutoff);
    write(start + k, s * env * gain, (p - 0.5) * 0.7);
  }
};

/** a rising tone under the last two seconds before the biggest beat */
const riser = (tEnd, dur = 1.5, gain = 0.22) => {
  const start = Math.floor((tEnd - dur) * SR);
  const n = Math.floor(dur * SR);
  for (let k = 0; k < n; k++) {
    const p = k / n;
    const f = 110 * Math.pow(8, p);
    const env = Math.pow(p, 2);
    write(start + k, Math.sin(TAU * f * (k / SR)) * env * gain);
  }
};

/** a soft tick on the grid, used to build momentum through the evidence beat */
const tick = (t0, gain = 0.09) => {
  const start = Math.floor(t0 * SR);
  const st = { y: 0 };
  for (let k = 0; k < 1400; k++) {
    const env = Math.exp(-k / 240);
    write(start + k, hp(st, noise(), 4200) * env * gain, 0.25);
  }
};

/** high shimmer: one long note that opens the end card */
const shimmer = (t0, dur = 3.4, gain = 0.1) => {
  const start = Math.floor(t0 * SR);
  const n = Math.floor(dur * SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const env = Math.min(1, t * 3) * Math.exp(-t * 0.9);
    const v = Math.sin(TAU * 1318.5 * t) * 0.6 + Math.sin(TAU * 1975.5 * t) * 0.4;
    write(start + k, v * env * gain, Math.sin(t * 2) * 0.4);
  }
};

/* ------------------------------------------------------------------- bed */

/**
 * The bed is what makes the film feel expensive: a low chord that never stops,
 * a noise layer that fills the silence, and a slow filter sweep so it breathes.
 */
const bed = () => {
  const roots = [55, 82.41, 110, 130.81];
  const st1 = { y: 0 };
  const st2 = { y: 0 };
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    // slow swell keyed to the film's own length
    const swell = 0.32 + 0.68 * (0.5 + 0.5 * Math.sin((TAU * t) / (total / 2.6)));
    let v = 0;
    for (let k = 0; k < roots.length; k++) {
      const detune = 1 + (k - 1.5) * 0.0018;
      v += Math.sin(TAU * roots[k] * detune * t + k) * (0.34 - k * 0.05);
    }
    v *= swell * 0.16;

    // air: filtered noise, slowly opening
    const cutoff = 420 + 900 * (0.5 + 0.5 * Math.sin((TAU * t) / (total / 3.2)));
    const airRaw = lp(st1, noise(), cutoff);
    const air = lp(st2, airRaw, 2400) * 0.05 * swell;

    write(i, v + air, Math.sin(t * 0.7) * 0.22);
  }
};

/* ---------------------------------------------------------------- harmony */

/**
 * A chord per act. This is the difference between a sound bed and a score: the
 * harmony moves with the argument, and every change lands on a cut, so the ear
 * hears the edit before the eye does.
 */
const CHORDS = {
  hook: [110.0, 130.81, 164.81],
  repo: [87.31, 110.0, 130.81],
  heat: [130.81, 164.81, 196.0],
  merge: [98.0, 123.47, 146.83],
  diff: [73.42, 87.31, 110.0],
  stats: [174.61, 220.0, 261.63],
  end: [110.0, 138.59, 164.81],
};

const pad = (t0, dur, freqs, gain = 0.1) => {
  const start = Math.floor(t0 * SR);
  const n = Math.floor(dur * SR);
  const atk = Math.min(0.5, dur * 0.28);
  const rel = Math.min(0.7, dur * 0.34);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const env =
      Math.min(1, t / atk) * Math.min(1, Math.max(0, (dur - t) / rel));
    if (env <= 0) continue;
    let v = 0;
    for (let c = 0; c < freqs.length; c++) {
      const f = freqs[c];
      // two detuned voices per note: a single sine sounds synthetic
      v += Math.sin(TAU * f * t) * 0.5 + Math.sin(TAU * f * 1.004 * t + c) * 0.34;
    }
    const breathe = 0.82 + 0.18 * Math.sin((TAU * t) / 1.9);
    write(start + k, v * env * gain * breathe, Math.sin(t * 0.9) * 0.3);
  }
};

/** the pulse: a soft 8th note that only runs while the argument is moving */
const pulse = (t0, dur, gain = 0.16) => {
  const step = 0.24;
  for (let t = t0 + step; t < t0 + dur - 0.05; t += step) {
    const start = Math.floor(t * SR);
    const n = Math.floor(0.19 * SR);
    const acc = Math.round((t - t0) / step) % 4 === 0 ? 1 : 0.62;
    for (let k = 0; k < n; k++) {
      const tt = k / SR;
      const env = Math.exp(-tt * 22);
      const f = 58 + 34 * Math.exp(-tt * 26);
      write(start + k, Math.sin(TAU * f * tt) * env * gain * acc);
    }
  }
};

/* ------------------------------------------------------------- assemble */

bed();

const beats = sheet.beats;
beats.forEach((b, i) => {
  // harmony for the act, starting a hair before the cut so it swells into it
  const chord = CHORDS[b.kind] || CHORDS.hook;
  pad(Math.max(0, b.start - 0.12), b.seconds + 0.24, chord, b.kind === "end" ? 0.12 : 0.085);
  if (["hook", "heat", "merge", "diff"].includes(b.kind)) pulse(b.start, b.seconds, 0.14);

  const isLast = i === beats.length - 1;
  const isFirst = i === 0;

  if (!isFirst) {
    const big = b.kind === "stats" || b.kind === "merge";
    impact(b.start, big ? 0.82 : 0.5, big);
  }

  // every transition has a sound that belongs to it
  if (b.transition === "whip") whoosh(b.start, 0.7, 0.55);
  if (b.transition === "dip") whoosh(b.start, 0.5, 0.3);

  // momentum through the evidence beat
  if (b.kind === "heat") {
    for (let t = b.start + 0.3; t < b.start + b.seconds - 0.1; t += 0.2) tick(t, 0.085);
  }

  if (isLast) shimmer(b.start, b.seconds + 1.2, 0.12);
});

// a riser into the biggest beat
const bigIdx = beats.findIndex((b) => b.kind === "stats");
if (bigIdx > 0) riser(beats[bigIdx].start, 1.6, 0.24);

/* ---------------------------------------------------------------- master */

let peak = 0;
for (let i = 0; i < N; i++) {
  // soft clip: musical, and it guarantees nothing ever clips the encoder
  L[i] = Math.tanh(L[i] * 1.15);
  R[i] = Math.tanh(R[i] * 1.15);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.89 / (peak || 1);

const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write("WAVE", 8);
buf.write("fmt ", 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(N * 4, 40);

for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * norm * 32767))), 44 + i * 4);
  buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[i] * norm * 32767))), 46 + i * 4);
}

writeFileSync(outPath, buf);
console.log(`score: ${total.toFixed(2)}s · ${beats.length} cues · ${(buf.length / 1048576).toFixed(1)} MB → ${outPath}`);
