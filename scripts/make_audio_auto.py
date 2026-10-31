#!/usr/bin/env python3
"""
AUTONOMY — 32 s score for a single continuous take. stdlib only.

The picture never cuts, so the score must not either: one harmonic field whose
chord glides (never steps) as the camera reaches each letter, a sub that stays
under everything, and a data tick that never stops. Transients live in their own
stem so they can be balanced independently.
"""
import math, os, random, struct, wave

SR = 48000
DUR = 32.0
N = int(SR * DUR)
FPS = 60
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "audio")
os.makedirs(OUT, exist_ok=True)
random.seed(23)
TAU = math.pi * 2


def write(name, left, right, peak=0.9):
    m = max(1e-9, max(max(abs(v) for v in left), max(abs(v) for v in right)))
    g = peak / m
    buf = bytearray()
    with wave.open(os.path.join(OUT, name), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        for i in range(len(left)):
            a = math.tanh(left[i] * g * 1.1)
            b = math.tanh(right[i] * g * 1.1)
            buf += struct.pack("<h", int(max(-1.0, min(1.0, a)) * 32767))
            buf += struct.pack("<h", int(max(-1.0, min(1.0, b)) * 32767))
        w.writeframes(bytes(buf))
    print(f"  {name:16s} {len(left)/SR:5.2f}s  {os.path.getsize(os.path.join(OUT,name))//1024:5d} KB")


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


# --- one chord per letter, timed to the frame the camera arrives ------------
ARRIVE = [0, 195, 390, 585, 780, 975, 1170, 1365]
CHORDS = [
    [110.0, 164.8, 220.0],   # Am
    [87.3, 130.8, 174.6],    # F
    [130.8, 196.0, 261.6],   # C
    [98.0, 146.8, 196.0],    # G
    [110.0, 164.8, 220.0],   # Am
    [87.3, 130.8, 174.6],    # F
    [130.8, 196.0, 261.6],   # C
    [146.8, 220.0, 293.7],   # Dm colour for the last letter
]
KEYS = [(ARRIVE[i] / FPS, CHORDS[i]) for i in range(8)] + [(32.0, [130.8, 196.0, 261.6, 329.6])]
GLIDE = 1.4  # seconds of frequency glide before each chord lands


def chord_at(t):
    """returns three (freq, weight) — weights cross-fade, frequencies glide"""
    i = 0
    while i + 1 < len(KEYS) and t >= KEYS[i + 1][0]:
        i += 1
    f = KEYS[i][1]
    if i == 0:
        return f
    t1 = KEYS[i][0]
    w = smooth((t - (t1 - GLIDE)) / GLIDE)
    prev = KEYS[i - 1][1]
    out = []
    for j in range(3):
        a = prev[j] if j < len(prev) else f[j]
        b = f[j] if j < len(f) else a
        out.append(a + (b - a) * w)
    return out


def bed():
    L = [0.0] * N
    R = [0.0] * N
    ph = [0.0, 0.0, 0.0]          # pad oscillators
    ph2 = [0.0, 0.0, 0.0]         # detuned partner, right channel
    sub = 0.0
    subf = 41.2
    tick_ph = 0.0
    for i in range(N):
        t = i / SR
        f = chord_at(t)

        # pad: three notes, drifting amplitude, slow filter-ish envelope
        s = 0.0
        s2 = 0.0
        for j in range(3):
            ph[j] += TAU * f[j] / SR
            ph2[j] += TAU * (f[j] * 1.004) / SR
            trem = 0.55 + 0.45 * math.sin(TAU * 0.055 * t + j * 1.7)
            s += math.sin(ph[j]) * (0.30 + 0.12 * j) * trem
            s2 += math.sin(ph2[j]) * (0.30 + 0.12 * j) * trem

        # sub — the floor of the whole film
        subf = 41.2 + 1.6 * math.sin(TAU * 0.031 * t)
        sub += TAU * subf / SR
        low = math.sin(sub) * (0.55 + 0.12 * math.sin(TAU * 0.07 * t))

        # data tick, every 16th, quiet, always running
        tick_ph += TAU * 1500 / SR
        cell = (t * 4.0) % 1.0
        tick = math.sin(tick_ph) * math.exp(-cell * 22.0) * 0.05

        # the field opens up as the camera accelerates
        g = 0.30
        L[i] = (s * g + low * 0.42 + tick) * 0.9
        R[i] = (s2 * g + low * 0.42 + tick * 0.7) * 0.9

    # fade the very top and tail so the file itself has no click
    for i in range(N):
        e = min(1.0, i / (SR * 0.25), (N - i) / (SR * 0.9))
        L[i] *= e
        R[i] *= e
    write("auto_bed.wav", L, R, peak=0.82)


TRAVEL = [[130, 195], [325, 390], [520, 585], [715, 780], [910, 975], [1105, 1170], [1300, 1365]]


def hits():
    L = [0.0] * N
    R = [0.0] * N

    def put(start, data, pan=0.0):
        i0 = int(start * SR)
        for k, v in enumerate(data):
            i = i0 + k
            if 0 <= i < N:
                L[i] += v * (1.0 - max(0.0, pan) * 0.6)
                R[i] += v * (1.0 + min(0.0, pan) * 0.6)
            # spread the same energy to the other channel a touch
            if 0 <= i < N:
                if pan > 0:
                    L[i] += v * 0.0
                else:
                    R[i] += v * 0.0

    # whooshes — one per travel, panned with the camera roll direction
    for n, (a, b) in enumerate(TRAVEL):
        dur = (b - a) / FPS + 0.28
        ln = int(dur * SR)
        data = []
        lp = 0.0
        pan = 0.35 if n % 2 else -0.35
        for k in range(ln):
            u = k / ln
            e = math.sin(math.pi * u) ** 2.2
            nz = random.uniform(-1, 1)
            lp = lp * 0.82 + nz * 0.18          # low-passed noise = air, not hiss
            sweep = math.sin(TAU * (180 + 900 * u) * (k / SR)) * 0.25
            data.append((lp * 0.85 + sweep * 0.4) * e * 0.55)
        put(a / FPS + 0.1, data, pan)

    # impacts — one per arrival, low and short
    for n, fr in enumerate(ARRIVE):
        ln = int(0.9 * SR)
        data = []
        for k in range(ln):
            t = k / SR
            e = math.exp(-t * 5.5)
            f0 = 96 - 46 * min(1.0, t * 4)
            body = math.sin(TAU * f0 * t) * e
            click = math.exp(-t * 60) * 0.5 * (1 if k % 2 else -1)
            data.append((body * 0.9 + click * 0.25) * 0.72)
        put(fr / FPS, data, 0.0)

    # riser into the end card, then the room opens
    ln = int(2.4 * SR)
    data = []
    lp = 0.0
    for k in range(ln):
        u = k / ln
        nz = random.uniform(-1, 1)
        lp = lp * (0.55 + 0.4 * u) + nz * (0.45 - 0.4 * u)
        data.append(lp * (u ** 2.4) * 0.5)
    put(1490 / FPS, data, 0.0)

    ln = int(1.6 * SR)
    data = []
    for k in range(ln):
        t = k / SR
        e = math.exp(-t * 3.2)
        data.append(
            (math.sin(TAU * 261.6 * t) * 0.5 + math.sin(TAU * 392.0 * t) * 0.3
             + math.sin(TAU * 523.2 * t) * 0.18) * e * 0.5
        )
    put(1660 / FPS, data, 0.0)

    for i in range(N):
        e = min(1.0, i / (SR * 0.1), (N - i) / (SR * 0.6))
        L[i] *= e
        R[i] *= e
    write("auto_hits.wav", L, R, peak=0.86)


if __name__ == "__main__":
    print("AUTONOMY — score")
    bed()
    hits()
