#!/usr/bin/env python3
"""
NEXUS "SIGNAL" — 36s score. stdlib only.

Structure follows the nine beats of Reel.tsx, so every cut lands on a musical
event rather than near one:

    0–2.2   warp in        sub drop + rising noise
    2.2–5.6 title          half-time: kick on 1 and 3, wide pad
    5.6–9.6 wall           driving 8ths, arp doubles
    9.6–13.6 orbit         four-on-the-floor, brighter voicing
   13.6–17.6 swarm         16ths, tension lift
   17.6–21.6 breach        tritone stab, noise burst, filter slam
   21.6–25.2 heal          release, shimmer, major lift
   25.2–30.0 scale         big toms + countdown
   30.0–36.0 resolve       final chord, long tail
"""
import math
import os
import random
import struct
import wave

SR = 48000
DUR = 36.0
N = int(SR * DUR)
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "audio")
os.makedirs(OUT, exist_ok=True)
random.seed(31)
TAU = math.pi * 2


def write(name, left, right=None, peak=0.9):
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
            a = math.tanh(left[i] * g * 1.05)
            buf += struct.pack("<h", int(max(-1.0, min(1.0, a)) * 32767))
            if ch == 2:
                b = math.tanh(right[i] * g * 1.05)
                buf += struct.pack("<h", int(max(-1.0, min(1.0, b)) * 32767))
        w.writeframes(bytes(buf))
    print(f"  {name:16s} {len(left)/SR:5.2f}s  {os.path.getsize(os.path.join(OUT,name))//1024:5d} KB")


# Dm - Bb - F - C  (same key as the brand film, faster)
PROG = [
    (0.0, 4.0, [146.8, 220.0, 293.7]),
    (4.0, 9.6, [116.5, 174.6, 233.1]),
    (9.6, 13.6, [87.3, 174.6, 261.6]),
    (13.6, 17.6, [98.0, 196.0, 293.7]),
    (17.6, 21.6, [73.4, 155.6, 233.1]),
    (21.6, 25.2, [87.3, 174.6, 261.6, 349.2]),
    (25.2, 30.0, [116.5, 174.6, 233.1]),
    (30.0, 36.0, [116.5, 174.6, 233.1, 293.7, 349.2]),
]


def env(t, a, b, r=0.8):
    if t < a or t > b:
        return 0.0
    if t < a + r:
        return (t - a) / r
    if t > b - r:
        return max(0.0, (b - t) / r)
    return 1.0


def bed():
    L = [0.0] * N
    R = [0.0] * N

    # ---- pad
    for a, b, notes in PROG:
        s0, e0 = int(a * SR), min(N, int((b + 1.8) * SR))
        span = e0 - s0
        att, rel = int(1.4 * SR), int(1.4 * SR)
        for ni, f0 in enumerate(notes):
            amp = 0.11 if ni else 0.15
            ph = random.random() * TAU
            d = 0.5 + ni * 0.2
            for k in range(s0, e0):
                i = k - s0
                e = min(1.0, i / att) * min(1.0, (span - i) / rel)
                e = e * e * (3 - 2 * e)
                tt = k / SR
                v = math.sin(TAU * f0 * (1 + d / 1000) * tt + ph) * 0.6 + math.sin(TAU * f0 * (1 - d / 1000) * tt + ph) * 0.4
                v += 0.12 * math.sin(TAU * f0 * 2 * tt)
                L[k] += v * amp * e
                R[k] += v * amp * e * (0.92 + 0.08 * ni)

    # ---- sub
    for i in range(N):
        t = i / SR
        s = math.sin(TAU * 41.2 * t) * 0.26
        s *= min(1.0, t / 1.5) * max(0.0, min(1.0, (DUR - t) / 3.0))
        L[i] += s
        R[i] += s

    # ---- air
    lpL = lpR = 0.0
    for i in range(N):
        t = i / SR
        cut = 0.01 + 0.02 * min(1.0, t / 20)
        lpL += ((random.random() * 2 - 1) - lpL) * cut
        lpR += ((random.random() * 2 - 1) - lpR) * cut
        amp = 0.5 * (0.28 + 0.72 * min(1.0, t / 26))
        L[i] += lpL * amp
        R[i] += lpR * amp

    # ---- drums
    def kick(at, g=0.6):
        n = int(0.36 * SR)
        for j in range(n):
            k = at + j
            if k >= N:
                return
            tt = j / SR
            f = 62 * math.exp(-tt * 17) + 30
            v = math.sin(TAU * f * tt) * math.exp(-tt * 10.0) * g
            L[k] += v
            R[k] += v

    def hat(at, g=0.12, dec=0.014):
        n = int(0.09 * SR)
        for j in range(n):
            k = at + j
            if k >= N:
                return
            tt = j / SR
            v = (random.random() * 2 - 1) * math.exp(-tt / dec) * g
            L[k] += v * 0.8
            R[k] += v

    def tom(at, f0=140.0, g=0.4):
        n = int(0.5 * SR)
        for j in range(n):
            k = at + j
            if k >= N:
                return
            tt = j / SR
            f = f0 * math.exp(-tt * 6) + 60
            v = math.sin(TAU * f * tt) * math.exp(-tt * 7) * g
            L[k] += v
            R[k] += v

    # half-time pulse, then 4otf, then 16ths
    beat = 0.6
    t = 2.2
    while t < 36.0:
        g = 0.55 * env(t, 2.2, 36.0, 0.6)
        if t < 5.6:
            if (round((t - 2.2) / beat) % 2) == 0:
                kick(int(t * SR), g)
        elif t < 13.6:
            kick(int(t * SR), g * 0.9)
        elif t < 30.0:
            kick(int(t * SR), g)
        t += beat

    t = 5.6
    while t < 30.0:
        hat(int(t * SR), 0.1 if t < 17.6 else 0.14)
        hat(int((t + beat / 2) * SR), 0.07)
        t += beat

    # 16th hats + toms in the scale section
    t = 25.2
    while t < 30.0:
        hat(int(t * SR), 0.16, 0.009)
        t += beat / 4
    for i, tt in enumerate([26.0, 27.2, 28.4, 29.4]):
        tom(int(tt * SR), 150 - i * 14, 0.42)

    # ---- arp
    t = 5.6
    idx = 0
    while t < 30.0:
        cur = PROG[-1][2]
        for a, b, notes in PROG:
            if a <= t < b:
                cur = notes
                break
        f0 = cur[idx % len(cur)] * 4
        at = int(t * SR)
        n = int(0.18 * SR)
        e0 = env(t, 5.6, 30.0, 0.6) * (0.045 if t < 17.6 else 0.06)
        for j in range(n):
            k = at + j
            if k >= N:
                break
            tt = j / SR
            e = math.exp(-tt * 24) * e0
            v = (math.sin(TAU * f0 * tt) + 0.25 * math.sin(TAU * f0 * 2 * tt)) * e
            L[k] += v * 0.85
            R[k] += v
        idx += 1
        t += beat / 2 if t < 13.6 else beat / 4

    # ---- riser into the breach
    r0, r1 = int(15.0 * SR), int(17.6 * SR)
    lp = 0.0
    for k in range(r0, min(r1, N)):
        p = (k - r0) / (r1 - r0)
        lp += ((random.random() * 2 - 1) - lp) * (0.02 + 0.3 * p * p)
        v = lp * (p ** 2.2) * 0.55
        L[k] += v
        R[k] += v * 0.9

    # ---- resolve chord
    for i, f0 in enumerate([116.5, 174.6, 233.1, 293.7, 349.2, 466.2]):
        at = int((30.0 + i * 0.05) * SR)
        for j in range(N - at):
            tt = j / SR
            e = min(1.0, tt / 1.0) * math.exp(-tt / 4.5) * 0.075
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
    print("NEXUS SIGNAL — score")
    L, R = bed()
    write("rl_bed.wav", L, R, 0.72)

    write("rl_whoosh.wav", fx(0.7, 400, 6400, 0.26, 0.45, 0.9, 0.06))
    write("rl_impact.wav", fx(0.45, 170, 45, 0.1, 0.85, 0.35))
    write("rl_boom.wav", [a + b for a, b in zip(fx(2.6, 74, 30, 0.9, 0.95, 0.08), fx(2.6, 3800, 800, 0.14, 0.14))])
    write("rl_tick.wav", fx(0.09, 2800, 2100, 0.022, 0.4))
    write("rl_riser.wav", fx(2.2, 240, 3200, 1.1, 0.4, 0.5, 0.6))
    write("rl_glitch.wav", fx(0.32, 1200, 220, 0.07, 0.55, 0.75))
    write("rl_shimmer.wav", fx(2.0, 2400, 5200, 0.8, 0.28, 0.2, 0.5))


if __name__ == "__main__":
    main()
