/**
 * SCORE — the soundtrack, synthesised in the browser.
 *
 * The film you watch is the film you download, sound included, and none of it
 * lives on a server: this runs in the page and hands Remotion a WAV it can
 * encode into the MP4 beside the picture.
 *
 * Same idea as the offline score: a sub bed, a chord per act, an impact on
 * every cut, a sweep into every whip, a riser into the turn. Sine, noise and an
 * envelope. No samples, no licence.
 */
import type { Decision } from "./brain";

const SR = 48000;
const TAU = Math.PI * 2;

const CHORDS: Record<string, number[]> = {
  hook: [110.0, 130.81, 164.81],
  place: [98.0, 123.47, 146.83],
  evidence: [130.81, 164.81, 196.0],
  number: [174.61, 220.0, 261.63],
  detail: [87.31, 110.0, 130.81],
  end: [110.0, 138.59, 164.81],
};

export type ScoreResult = { url: string; seconds: number; bytes: number };

/**
 * Build a stereo WAV for a decision and return it as a data URL, which is what
 * Remotion's <Audio> wants in a browser render.
 */
export const buildScore = (d: Decision): ScoreResult => {
  const total = d.seconds + 0.7;
  const N = Math.ceil(total * SR);
  const L = new Float32Array(N);
  const R = new Float32Array(N);

  let seed = 20261029;
  const noise = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) / 4294967296) * 2 - 1;
  };

  const put = (i: number, v: number, pan = 0) => {
    if (i < 0 || i >= N) return;
    const gl = Math.cos(((pan + 1) * Math.PI) / 4);
    const gr = Math.sin(((pan + 1) * Math.PI) / 4);
    L[i] += v * gl;
    R[i] += v * gr;
  };

  /* --- bed: a low chord that never stops, plus filtered air ------------- */
  const roots = [55, 82.41, 110, 130.81];
  let a1 = 0;
  let a2 = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const swell = 0.32 + 0.68 * (0.5 + 0.5 * Math.sin((TAU * t) / (total / 2.6)));
    let v = 0;
    for (let k = 0; k < roots.length; k++) {
      v += Math.sin(TAU * roots[k] * (1 + (k - 1.5) * 0.0018) * t + k) * (0.34 - k * 0.05);
    }
    v *= swell * 0.14;

    const cutoff = 420 + 900 * (0.5 + 0.5 * Math.sin((TAU * t) / (total / 3.2)));
    const alpha = 1 - Math.exp((-TAU * cutoff) / SR);
    a1 += alpha * (noise() - a1);
    a2 += (1 - Math.exp((-TAU * 2400) / SR)) * (a1 - a2);

    put(i, v + a2 * 0.05 * swell, Math.sin(t * 0.7) * 0.22);
  }

  /* --- harmony: one chord per act, changing on the cut ------------------ */
  let t0 = 0;
  for (const b of d.beats) {
    const freqs = CHORDS[b.kind] || CHORDS.hook;
    const start = Math.max(0, Math.floor((t0 - 0.12) * SR));
    const dur = b.seconds + 0.24;
    const n = Math.floor(dur * SR);
    const atk = Math.min(0.5, dur * 0.28);
    const rel = Math.min(0.7, dur * 0.34);
    const gain = b.kind === "end" ? 0.12 : 0.08;
    for (let k = 0; k < n; k++) {
      const t = k / SR;
      const env = Math.min(1, t / atk) * Math.min(1, Math.max(0, (dur - t) / rel));
      if (env <= 0) continue;
      let v = 0;
      for (let c = 0; c < freqs.length; c++) {
        v += Math.sin(TAU * freqs[c] * t) * 0.5 + Math.sin(TAU * freqs[c] * 1.004 * t + c) * 0.34;
      }
      put(start + k, v * env * gain * (0.82 + 0.18 * Math.sin((TAU * t) / 1.9)), Math.sin(t * 0.9) * 0.3);
    }
    t0 += b.seconds;
  }

  /* --- impacts on the cuts, bigger on the turn -------------------------- */
  t0 = 0;
  d.beats.forEach((b, i) => {
    if (i > 0) {
      const big = b.kind === "number" || b.kind === "end";
      const start = Math.floor(t0 * SR);
      const gain = big ? 0.84 : 0.52;
      const dur = big ? 1.5 : 0.9;
      let phase = 0;
      for (let k = 0; k < Math.floor(dur * SR); k++) {
        const t = k / SR;
        const f = (big ? 92 : 74) * Math.exp(-t * (big ? 5.2 : 7.4)) + 30;
        phase += (TAU * f) / SR;
        const env = Math.exp(-t * (big ? 3.1 : 4.6));
        const click = k < 900 ? noise() * Math.exp(-k / 220) * 0.26 * gain : 0;
        put(start + k, Math.sin(phase) * env * gain + click);
      }
      for (let k = 0; k < Math.floor(1.8 * SR); k++) {
        const t = k / SR;
        put(start + k, Math.sin(TAU * 34 * t) * Math.exp(-t * 1.2) * 0.2 * gain);
      }
    }

    /* whooshes belong to the edit, not to the beat */
    if (b.transition === "whip" || b.transition === "dip") {
      const wd = b.transition === "whip" ? 0.7 : 0.5;
      const wg = b.transition === "whip" ? 0.55 : 0.3;
      const s0 = Math.max(0, Math.floor((t0 - wd) * SR));
      const n = Math.floor(wd * SR);
      let st = 0;
      for (let k = 0; k < n; k++) {
        const p = k / n;
        const env = Math.pow(p, 2.4) * (1 - Math.max(0, p - 0.94) / 0.06);
        const cut = 260 + Math.pow(p, 2) * 5200;
        st += (1 - Math.exp((-TAU * cut) / SR)) * (noise() - st);
        put(s0 + k, st * env * wg, (p - 0.5) * 0.7);
      }
    }

    /* the turn gets a riser under it */
    if (b.kind === "number") {
      const rd = 1.5;
      const s0 = Math.max(0, Math.floor((t0 - rd) * SR));
      const n = Math.floor(rd * SR);
      for (let k = 0; k < n; k++) {
        const p = k / n;
        const f = 110 * Math.pow(8, p);
        put(s0 + k, Math.sin(TAU * f * (k / SR)) * Math.pow(p, 2) * 0.2);
      }
    }

    /* the signature opens on a shimmer */
    if (b.kind === "end") {
      const s0 = Math.floor(t0 * SR);
      const n = Math.floor(Math.min(3.2, b.seconds + 0.6) * SR);
      for (let k = 0; k < n; k++) {
        const t = k / SR;
        const env = Math.min(1, t * 3) * Math.exp(-t * 0.9);
        const v = Math.sin(TAU * 1318.5 * t) * 0.6 + Math.sin(TAU * 1975.5 * t) * 0.4;
        put(s0 + k, v * env * 0.11, Math.sin(t * 2) * 0.4);
      }
    }

    t0 += b.seconds;
  });

  /* --- master ---------------------------------------------------------- */
  let peak = 0;
  for (let i = 0; i < N; i++) {
    L[i] = Math.tanh(L[i] * 1.15);
    R[i] = Math.tanh(R[i] * 1.15);
    const m = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    if (m > peak) peak = m;
  }
  const norm = d.music ? 0.9 / (peak || 1) : 0.45 / (peak || 1);

  const bytes = 44 + N * 4;
  const view = new DataView(new ArrayBuffer(bytes));
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, bytes - 8, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, SR, true);
  view.setUint32(28, SR * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, N * 4, true);

  for (let i = 0; i < N; i++) {
    view.setInt16(44 + i * 4, Math.max(-32768, Math.min(32767, Math.round(L[i] * norm * 32767))), true);
    view.setInt16(46 + i * 4, Math.max(-32768, Math.min(32767, Math.round(R[i] * norm * 32767))), true);
  }

  /* base64 without spreading a 2.7 MB array into a function call */
  const u8 = new Uint8Array(view.buffer);
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) {
    bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + CH)));
  }
  const url = `data:audio/wav;base64,${btoa(bin)}`;

  return { url, seconds: +total.toFixed(2), bytes };
};
