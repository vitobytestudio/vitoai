#!/usr/bin/env python3
"""
VITO BYTE STUDIO — 32s score. stdlib only.

Design notes: this film is about machines working, so the score is built from
short transients (typing, blips, lock-ins) over a slow harmonic floor. Nothing
melodic competes with the terminal text.
"""
import math, os, random, struct, wave

SR = 48000
DUR = 32.0
N = int(SR * DUR)
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "audio")
os.makedirs(OUT, exist_ok=True)
random.seed(17)
TAU = math.pi * 2


def write(name, left, right=None, peak=0.88):
    right = right if right is not None else left
    ch = 1 if right is left else 2
    m = max(1e-9, max(max(abs(v) for v in left), max(abs(v) for v in right)))
    g = peak / m
    buf = bytearray()
    with wave.open(os.path.join(OUT, name), "wb") as w:
        w.setnchannels(ch); w.setsampwidth(2); w.setframerate(SR)
        for i in range(len(left)):
            a = math.tanh(left[i] * g * 1.05)
            buf += struct.pack("<h", int(max(-1.0, min(1.0, a)) * 32767))
            if ch == 2:
                b = math.tanh(right[i] * g * 1.05)
                buf += struct.pack("<h", int(max(-1.0, min(1.0, b)) * 32767))
        w.writeframes(bytes(buf))
    print(f"  {name:16s} {len(left)/SR:5.2f}s  {os.path.getsize(os.path.join(OUT,name))//1024:5d} KB")


# Am - F - C - G, one section per beat group
PROG = [
    (0.0, 3.5, [110.0, 164.8, 220.0]),      # boot: Am, narrow
    (3.5, 8.0, [87.3, 130.8, 174.6]),       # servers: F
    (8.0, 12.5, [130.8, 196.0, 261.6]),     # agents: C
    (12.5, 17.0, [98.0, 146.8, 196.0]),     # edge: G
    (17.0, 21.0, [87.3, 130.8, 174.6]),     # cicd: F
    (21.0, 25.5, [110.0, 164.8, 220.0]),    # systems: Am
    (25.5, 32.0, [130.8, 196.0, 261.6, 329.6]),  # cta: C
]


def env(t, a, b, r=0.7):
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

    for a, b, notes in PROG:
        s0, e0 = int(a * SR), min(N, int((b + 1.4) * SR))
        span = e0 - s0
        att, rel = int(1.0 * SR), int(1.2 * SR)
        for ni, f0 in enumerate(notes):
            amp = 0.10 if ni else 0.14
            ph = random.random() * TAU
            d = 0.4 + ni * 0.2
            for k in range(s0, e0):
                i = k - s0
                e = min(1.0, i / att) * min(1.0, (span - i) / rel)
                e = e * e * (3 - 2 * e)
                tt = k / SR
                v = math.sin(TAU * f0 * (1 + d / 1000) * tt + ph) * 0.62 + math.sin(TAU * f0 * (1 - d / 1000) * tt + ph) * 0.38
                v += 0.1 * math.sin(TAU * f0 * 2 * tt)
                L[k] += v * amp * e
                R[k] += v * amp * e * (0.92 + 0.08 * ni)

    # sub floor
    for i in range(N):
        t = i / SR
        s = math.sin(TAU * 38.9 * t) * 0.22
        s *= min(1.0, t / 1.2) * max(0.0, min(1.0, (DUR - t) / 3.0))
        L[i] += s; R[i] += s

    # air
    lpL = lpR = 0.0
    for i in range(N):
        t = i / SR
        cut = 0.008 + 0.018 * min(1.0, t / 18)
        lpL += ((random.random() * 2 - 1) - lpL) * cut
        lpR += ((random.random() * 2 - 1) - lpR) * cut
        amp = 0.45 * (0.25 + 0.75 * min(1.0, t / 22))
        L[i] += lpL * amp; R[i] += lpR * amp

    # slow pulse, enters after the boot
    def kick(at, g):
        n = int(0.32 * SR)
        for j in range(n):
            k = at + j
            if k >= N: return
            tt = j / SR
            f = 64 * math.exp(-tt * 18) + 32
            v = math.sin(TAU * f * tt) * math.exp(-tt * 11) * g
            L[k] += v; R[k] += v

    t = 3.5
    while t < 25.5:
        kick(int(t * SR), 0.5 * env(t, 3.5, 25.5, 0.5))
        t += 1.0

    # data ticks: quiet, high, irregular — the sound of a terminal
    t = 0.4
    while t < 31.0:
        at = int(t * SR)
        n = int(0.03 * SR)
        g = 0.10 * env(t, 0.2, 31.0, 0.5)
        f0 = 1800 + random.random() * 1600
        for j in range(n):
            k = at + j
            if k >= N: break
            tt = j / SR
            v = math.sin(TAU * f0 * tt) * math.exp(-tt * 200) * g
            L[k] += v * 0.7; R[k] += v
        t += 0.21 + random.random() * 0.26

    # resolve chord
    for i, f0 in enumerate([130.8, 196.0, 261.6, 329.6, 392.0]):
        at = int((25.5 + i * 0.07) * SR)
        for j in range(N - at):
            tt = j / SR
            e = min(1.0, tt / 1.2) * math.exp(-tt / 5.0) * 0.07
            v = math.sin(TAU * f0 * tt) * e
            L[at + j] += v
            R[at + j] += v * (0.88 + 0.12 * i)

    return L, R


def fx(dur, f0, f1, decay, amp, noise=0.0, attack=0.004):
    n = int(dur * SR)
    out = [0.0] * n
    ph = 0.0; lp = 0.0
    for i in range(n):
        t = i / SR; p = i / n
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
    print("VITO BYTE — score")
    L, R = bed()
    write("vt_bed.wav", L, R, 0.70)
    write("vt_hit.wav", fx(0.5, 180, 48, 0.11, 0.8, 0.3))
    write("vt_boom.wav", [a + b for a, b in zip(fx(2.4, 76, 30, 0.9, 0.95, 0.08), fx(2.4, 3400, 700, 0.14, 0.13))])
    write("vt_blip.wav", fx(0.10, 2200, 1600, 0.028, 0.5))
    write("vt_lock.wav", [a + b for a, b in zip(fx(0.9, 320, 640, 0.22, 0.4), fx(0.9, 1600, 2400, 0.12, 0.2))])
    write("vt_type.wav", fx(1.9, 900, 420, 1.2, 0.22, 0.85, 0.3))
    write("vt_rack.wav", fx(1.4, 240, 120, 1.0, 0.3, 0.6, 0.2))
    write("vt_scan.wav", fx(2.0, 500, 3600, 0.9, 0.32, 0.7, 0.5))
    write("vt_boot.wav", [a + b for a, b in zip(fx(1.6, 60, 34, 0.6, 0.9, 0.1), fx(1.6, 2400, 400, 0.1, 0.14))])
    write("vt_shimmer.wav", fx(2.0, 2600, 5200, 0.8, 0.24, 0.2, 0.5))


if __name__ == "__main__":
    main()
