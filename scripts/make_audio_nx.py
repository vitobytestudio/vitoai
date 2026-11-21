#!/usr/bin/env python3
"""
NEXUS — 60s procedural score + SFX. stdlib only (no numpy in this image).

Six harmonic sections follow the nine picture movements:
    0– 4   ignite        drone only, a single tone blooming
    4–12   reach         Dm pad, air, first pulse
   12–20   services      half-time heartbeat, arpeggio enters
   20–28   workforce     pulse doubles, brighter voicing
   28–35   support       build, filtered noise swell
   35–40   threat        dissonant tritone stab + red noise
   40–46   heal          tension releases into a rising major bloom
   46–52   proof        wide sustained chord, no rhythm
   52–60   resolve      final chord, long tail, fade
"""
import math
import os
import random
import struct
import wave

SR = 48000
DUR = 60.0
N = int(SR * DUR)
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "audio")
os.makedirs(OUT, exist_ok=True)
random.seed(23)
TAU = math.pi * 2


def write(name, left, right=None, peak=0.88):
    right = right if right is not None else left
    ch = 1 if right is left else 2
    m = max(1e-9, max(max(abs(v) for v in left), max(abs(v) for v in right)))
    g = peak / m
    buf = bytearray()
    with wave.open(os.path.join(OUT, name), "wb") as w:
        w.setnchannels(ch)
        w.setsampwidth(2)
        w.setframerate(SR)
        for i in range(len(left)):
            a = math.tanh(left[i] * g * 1.04)
            buf += struct.pack("<h", int(max(-1.0, min(1.0, a)) * 32767))
            if ch == 2:
                b = math.tanh(right[i] * g * 1.04)
                buf += struct.pack("<h", int(max(-1.0, min(1.0, b)) * 32767))
        w.writeframes(bytes(buf))
    print(f"  {name:16s} {len(left)/SR:5.2f}s  {os.path.getsize(os.path.join(OUT,name))//1024:5d} KB")


# Dm - Bb - F - C, two bars each section
CHORDS = [
    (0.0, 8.0, [73.4, 174.6, 220.0, 293.7]),
    (8.0, 20.0, [58.3, 146.8, 174.6, 233.1]),
    (20.0, 35.0, [87.3, 174.6, 220.0, 261.6]),
    (35.0, 40.0, [73.4, 155.6, 233.1, 311.1]),   # tritone: the threat
    (40.0, 46.0, [87.3, 174.6, 261.6, 349.2]),   # lift
    (46.0, 60.0, [58.3, 146.8, 220.0, 293.7]),   # resolve on Bb
]


def env_at(t, a, b, ramp):
    if t < a or t > b:
        return 0.0
    if t < a + ramp:
        return (t - a) / ramp
    if t > b - ramp:
        return max(0.0, (b - t) / ramp)
    return 1.0


def bed():
    L = [0.0] * N
    R = [0.0] * N

    # sub drone
    for i in range(N):
        t = i / SR
        s = (math.sin(TAU * 36.7 * t) * 0.30 + math.sin(TAU * 55.0 * t) * 0.13)
        s *= 0.58 + 0.42 * math.sin(TAU * 0.045 * t)
        s *= min(1.0, t / 3.0) * max(0.0, min(1.0, (DUR - t) / 4.0)) * 0.55
        L[i] += s
        R[i] += s

    # pad — 2 detuned oscillators per note, envelope per section
    for a, b, notes in CHORDS:
        s0 = int(a * SR)
        e0 = min(N, int((b + 2.2) * SR))
        att = int(2.4 * SR)
        rel = int(2.0 * SR)
        span = e0 - s0
        for ni, f0 in enumerate(notes):
            amp = 0.135 if ni == 0 else 0.10
            ph = random.random() * TAU
            d = 0.4 + ni * 0.15
            for k in range(s0, e0):
                i = k - s0
                e = min(1.0, i / att) * min(1.0, (span - i) / rel)
                e *= e * (3 - 2 * e)
                tt = k / SR
                v = math.sin(TAU * f0 * (1 + d / 1000) * tt + ph) * 0.62 + math.sin(TAU * f0 * (1 - d / 1000) * tt + ph) * 0.38
                v += math.sin(TAU * f0 * 2 * tt) * 0.10
                L[k] += v * amp * e
                R[k] += v * amp * e * (0.93 + 0.07 * math.sin(ni))

    # air
    lpL = lpR = 0.0
    for i in range(N):
        t = i / SR
        n1 = random.random() * 2 - 1
        n2 = random.random() * 2 - 1
        cut = 0.008 + 0.02 * min(1.0, t / 30)
        lpL += (n1 - lpL) * cut
        lpR += (n2 - lpR) * cut
        amp = 0.5 * (0.3 + 0.7 * min(1.0, t / 40))
        L[i] += lpL * amp
        R[i] += lpR * amp

    # heartbeat: half-time in services, driving in workforce/support, gone after 40
    def kick(at, g):
        n = int(0.4 * SR)
        for j in range(n):
            k = at + j
            if k >= N:
                return
            tt = j / SR
            f = 58 * math.exp(-tt * 15) + 26
            v = math.sin(TAU * f * tt) * math.exp(-tt * 9.0) * g
            L[k] += v
            R[k] += v

    t = 12.0
    while t < 40.0:
        g = 0.5 * env_at(t, 12.0, 40.0, 1.4)
        kick(int(t * SR), g)
        step = 2.0 if t < 20 else (1.0 if t < 28 else 0.5)
        t += step

    # arpeggio
    t = 12.0
    idx = 0
    while t < 40.0:
        for a, b, notes in CHORDS:
            if a <= t < b:
                cur = notes
                break
        else:
            cur = CHORDS[-1][2]
        f = cur[idx % len(cur)] * 4
        at = int(t * SR)
        n = int(0.2 * SR)
        e0 = env_at(t, 12.0, 40.0, 1.2) * 0.05
        for j in range(n):
            k = at + j
            if k >= N:
                break
            tt = j / SR
            e = math.exp(-tt * 20) * e0
            v = (math.sin(TAU * f * tt) + 0.28 * math.sin(TAU * f * 2 * tt)) * e
            L[k] += v * 0.8
            R[k] += v * 1.0
        idx += 1
        t += 0.26

    # riser 30–40
    r0, r1 = int(30.0 * SR), int(40.0 * SR)
    lp = 0.0
    for k in range(r0, min(r1, N)):
        p = (k - r0) / (r1 - r0)
        lp += ((random.random() * 2 - 1) - lp) * (0.015 + 0.30 * p * p)
        sweep = 150 + 1100 * p * p
        v = (lp * 0.6 + math.sin(TAU * sweep * (k / SR)) * 0.15) * (p ** 2.4) * 0.55
        L[k] += v
        R[k] += v * 0.9

    # heal bloom 40–46
    for i, f0 in enumerate([174.6, 261.6, 349.2, 523.2]):
        at = int((40.0 + i * 0.09) * SR)
        for j in range(N - at):
            tt = j / SR
            e = min(1.0, tt / 0.7) * math.exp(-tt / 3.2) * 0.085
            v = (math.sin(TAU * f0 * tt) + 0.22 * math.sin(TAU * f0 * 2.01 * tt)) * e
            L[at + j] += v
            R[at + j] += v * (0.9 + 0.1 * i)

    # final resolve 52
    for i, f0 in enumerate([146.8, 220.0, 293.7, 440.0, 587.3]):
        at = int((52.0 + i * 0.06) * SR)
        for j in range(N - at):
            tt = j / SR
            e = min(1.0, tt / 1.1) * math.exp(-tt / 4.0) * 0.07
            v = math.sin(TAU * f0 * tt) * e
            L[at + j] += v
            R[at + j] += v * (0.88 + 0.12 * i)

    return L, R


def fx(dur, f0, f1, decay, amp, noise=0.0, attack=0.004):
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


def main():
    print("NEXUS — score")
    L, R = bed()
    write("nx_bed.wav", L, R, 0.70)

    write("nx_ignite.wav", [a + b for a, b in zip(fx(2.2, 110, 30, 0.5, 0.95, 0.2), fx(2.2, 2200, 400, 0.1, 0.18))])
    write("nx_rise.wav", fx(2.0, 380, 1800, 0.95, 0.38, 0.32, 0.35))
    write("nx_impact.wav", fx(0.5, 160, 42, 0.12, 0.8, 0.4))
    write("nx_boom.wav", [a + b for a, b in zip(fx(3.0, 72, 28, 1.0, 0.95, 0.1), fx(3.0, 3600, 700, 0.16, 0.15))])
    write("nx_tick.wav", fx(0.12, 2600, 1900, 0.03, 0.45))
    write("nx_whoosh.wav", fx(0.9, 320, 5600, 0.38, 0.42, 0.85, 0.1))
    write("nx_heal.wav", fx(2.6, 240, 1400, 1.1, 0.5, 0.45, 0.5))
    write("nx_threat.wav", fx(0.85, 900, 120, 0.2, 0.7, 0.55))


if __name__ == "__main__":
    main()
