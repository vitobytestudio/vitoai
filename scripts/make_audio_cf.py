#!/usr/bin/env python3
"""
CLOUDFLARE — procedural score + SFX.
Pure stdlib (no numpy in this image): additive synthesis, no samples, no network.

The bed is written as a 23s arc that follows the six movements of the picture:
   0.0 –  8.6  void drifting to ignition     : drone + air, no pulse
   8.6 – 14.2  network assembling            : heartbeat enters, arpeggio
  14.2 – 18.2  attacks land                  : pulse doubles, tension chord
  18.2 – 20.8  collapse + mark               : everything drops out
  20.8 – 23.0  resolve                       : one bloomed major-ish chord, tail
"""
import math
import os
import random
import struct
import wave

SR = 48000
DUR = 23.0
N = int(SR * DUR)
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "audio")
os.makedirs(OUT, exist_ok=True)
random.seed(11)

TAU = math.pi * 2


def write(name, left, right=None, peak=0.89):
    right = right if right is not None else left
    ch = 1 if right is left else 2
    m = max(1e-9, max(max(abs(v) for v in left), max(abs(v) for v in right)))
    g = peak / m
    with wave.open(os.path.join(OUT, name), "wb") as w:
        w.setnchannels(ch)
        w.setsampwidth(2)
        w.setframerate(SR)
        buf = bytearray()
        for i in range(len(left)):
            a = math.tanh(left[i] * g * 1.05)
            buf += struct.pack("<h", int(max(-1.0, min(1.0, a)) * 32767))
            if ch == 2:
                b = math.tanh(right[i] * g * 1.05)
                buf += struct.pack("<h", int(max(-1.0, min(1.0, b)) * 32767))
        w.writeframes(bytes(buf))
    print(f"  {name:18s} {len(left)/SR:5.2f}s  {os.path.getsize(os.path.join(OUT,name))//1024:5d} KB")


def fade(i, n, a=0.0, b=0.02):
    t = i / SR
    if t < a:
        return t / max(a, 1e-6)
    if t > DUR - b:
        return max(0.0, (DUR - t) / max(b, 1e-6))
    return 1.0


def section(t, a, b, ramp=0.6):
    """0 → 1 → 0 envelope across a time window"""
    if t < a or t > b:
        return 0.0
    if t < a + ramp:
        return (t - a) / ramp
    if t > b - ramp:
        return max(0.0, (b - t) / ramp)
    return 1.0


# --------------------------------------------------------------------- bed --
CHORDS = [
    (0.0, 5.75, [110.0, 261.6, 329.6, 440.0]),      # Am
    (5.75, 11.5, [87.3, 220.0, 261.6, 349.2]),      # F
    (11.5, 17.25, [130.8, 196.0, 261.6, 392.0]),    # C
    (17.25, 23.0, [98.0, 246.9, 293.7, 392.0]),     # G
]


def chord_at(t):
    for a, b, notes in CHORDS:
        if a <= t < b:
            return notes, (t - a) / (b - a)
    return CHORDS[-1][2], 0.0


def bed():
    L = [0.0] * N
    R = [0.0] * N
    # --- sub drone (always present, the floor of the mix)
    for i in range(N):
        t = i / SR
        s = math.sin(TAU * 41.2 * t) * 0.30 + math.sin(TAU * 55.0 * t) * 0.16
        s *= 0.55 + 0.45 * math.sin(TAU * 0.07 * t)
        s *= fade(i, N, 0.8, 2.5) * 0.5
        L[i] += s
        R[i] += s

    # --- pad: soft additive voices, slow attack, detuned L/R for width
    for a, b, notes in CHORDS:
        start = a * SR
        end = min(N, (b + 1.6) * SR)
        length = end - start
        att = int(2.2 * SR)
        rel = int(1.5 * SR)
        for n_i, f in enumerate(notes):
            amp = 0.115 if n_i else 0.16
            phL = random.random() * TAU
            det = 0.35 + n_i * 0.12
            w1 = TAU * f * (1 + det / 1000)
            w2 = TAU * f * (1 - det / 1000)
            for k in range(int(start), int(end)):
                i = k - int(start)
                e = min(1.0, i / att) * min(1.0, (length - i) / rel)
                e = e * e * (3 - 2 * e)
                lt = k / SR
                vib = 1 + 0.0015 * math.sin(TAU * 0.23 * lt + n_i)
                v = (
                    math.sin(w1 * lt + phL) * 0.6
                    + math.sin(w2 * lt + phL) * 0.4
                    + math.sin(w1 * 2 * lt) * 0.13
                    + math.sin(w1 * 3 * lt) * 0.05
                ) * vib
                L[k] += v * amp * e
                R[k] += v * amp * e * (0.94 + 0.06 * math.sin(n_i))

    # --- air: one-pole lowpassed noise, very quiet, opens up over time
    lpL = lpR = 0.0
    for i in range(N):
        t = i / SR
        n1 = (random.random() * 2 - 1) * 0.5
        n2 = (random.random() * 2 - 1) * 0.5
        cut = 0.010 + 0.016 * min(1.0, t / 14)
        lpL += (n1 - lpL) * cut
        lpR += (n2 - lpR) * cut
        amp = 0.55 * (0.35 + 0.65 * min(1.0, t / 18))
        L[i] += lpL * amp
        R[i] += lpR * amp

    # --- heartbeat: enters at 8.6s, doubles at 14.2s, dies at 18.2s
    def kick(at, g):
        n = int(0.42 * SR)
        p = random.random() * TAU
        for j in range(n):
            k = at + j
            if k >= N:
                return
            tt = j / SR
            f = 62 * math.exp(-tt * 16) + 27
            e = math.exp(-tt * 9.5)
            v = math.sin(TAU * f * tt + p) * e * g
            L[k] += v
            R[k] += v

    t = 8.6
    while t < 18.2:
        env = section(t, 8.6, 18.2, 1.2)
        kick(int(t * SR), 0.55 * env)
        t += 1.15 if t < 14.2 else 0.575

    # --- arpeggio: 8th notes from 8.6s, quiet, adds motion
    t = 8.6
    idx = 0
    while t < 18.0:
        notes, _ = chord_at(t)
        f = notes[idx % len(notes)] * 4
        n = int(0.18 * SR)
        at = int(t * SR)
        env = section(t, 8.6, 18.0, 0.8)
        for j in range(n):
            k = at + j
            if k >= N:
                break
            tt = j / SR
            e = math.exp(-tt * 22) * env * 0.055
            v = (math.sin(TAU * f * tt) + 0.3 * math.sin(TAU * f * 2 * tt)) * e
            L[k] += v * 0.8
            R[k] += v * 1.0
        idx += 1
        t += 0.2875

    # --- riser into the logo (14.2 → 18.2)
    r0, r1 = int(14.2 * SR), int(18.2 * SR)
    lp = 0.0
    for k in range(r0, min(r1, N)):
        p = (k - r0) / (r1 - r0)
        n1 = random.random() * 2 - 1
        lp += (n1 - lp) * (0.02 + 0.35 * p * p)
        sweep = 180 + 900 * p * p
        v = (lp * 0.55 + math.sin(TAU * sweep * (k / SR)) * 0.16) * (p ** 2.2) * 0.5
        L[k] += v
        R[k] += v * 0.92

    # --- resolve: one bloomed chord after the mark (18.9 → 23)
    for i, f in enumerate([130.8, 196.0, 261.6, 329.6, 392.0, 523.2]):
        at = int((18.95 + i * 0.05) * SR)
        n = N - at
        for j in range(n):
            k = at + j
            tt = j / SR
            e = min(1.0, tt / 0.9) * math.exp(-tt / 2.6) * 0.075
            v = (math.sin(TAU * f * tt) + 0.25 * math.sin(TAU * f * 2.01 * tt)) * e
            L[k] += v
            R[k] += v * (0.9 + 0.1 * i)

    return L, R


# --------------------------------------------------------------------- sfx --
def sweep_fx(dur, f0, f1, decay, amp, noise=0.0, attack=0.004):
    n = int(dur * SR)
    out = [0.0] * n
    ph = 0.0
    lp = 0.0
    for i in range(n):
        t = i / SR
        p = i / n
        f = f0 * (f1 / f0) ** p
        ph += TAU * f / SR
        e = min(1.0, t / attack) * math.exp(-t / decay)
        v = math.sin(ph) * (1 - noise)
        if noise:
            lp += ((random.random() * 2 - 1) - lp) * 0.25
            v += lp * noise * 1.6
        out[i] = v * e * amp
    return out


def mix_at(dst, src, at_sec):
    at = int(at_sec * SR)
    for i, v in enumerate(src):
        k = at + i
        if 0 <= k < len(dst):
            dst[k] += v
    return dst


def main():
    print("CLOUDFLARE — score")
    L, R = bed()
    write("cf_bed.wav", L, R, 0.72)

    # ignite: sub drop + metallic transient
    ig = [a + b for a, b in zip(sweep_fx(2.4, 90, 26, 0.55, 0.95, noise=0.25), sweep_fx(2.4, 1800, 300, 0.12, 0.22))]
    write("cf_ignite.wav", ig)

    # assemble: rising shimmer
    asm = sweep_fx(1.9, 420, 1600, 0.9, 0.42, noise=0.35, attack=0.35)
    write("cf_rise.wav", asm)

    # shield: airy swell
    sh = sweep_fx(1.6, 700, 2400, 0.7, 0.35, noise=0.55, attack=0.25)
    write("cf_shield.wav", sh)

    # impact: tight punch
    im = sweep_fx(0.55, 150, 40, 0.13, 0.85, noise=0.45)
    write("cf_impact.wav", im)

    # mark: deep boom with long tail
    bm = [a + b for a, b in zip(sweep_fx(3.2, 70, 28, 1.05, 0.95, noise=0.12), sweep_fx(3.2, 3400, 600, 0.18, 0.16))]
    write("cf_boom.wav", bm)

    # ui tick
    tk = sweep_fx(0.14, 2400, 1800, 0.035, 0.5)
    write("cf_tick.wav", tk)

    # whoosh for transitions
    wh = sweep_fx(1.0, 300, 5200, 0.42, 0.45, noise=0.85, attack=0.12)
    write("cf_whoosh.wav", wh)


if __name__ == "__main__":
    main()
