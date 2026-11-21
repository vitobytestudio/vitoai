#!/usr/bin/env python3
"""
VitoAI — procedural sound design.

Renders a 22.2s cinematic bed, an ambience layer and the full SFX palette
(impact, whoosh, click, riser, sub, shimmer, ui, glitch) as 48 kHz / 16-bit
WAV files. Everything is synthesized from scratch — no samples, no network.
"""
import math
import os
import random
import struct
import wave

SR = 48000
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "audio")
os.makedirs(OUT, exist_ok=True)

random.seed(7)


def write_wav(name, samples):
    path = os.path.join(OUT, name)
    peak = max(1e-9, max(abs(s) for s in samples))
    # soft clip + normalise to -1 dBFS
    norm = 0.89 / peak
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = bytearray()
        for s in samples:
            v = math.tanh(s * norm * 1.1)
            frames += struct.pack("<h", int(max(-1.0, min(1.0, v)) * 32767))
        w.writeframes(bytes(frames))
    print(f"  {name:16s} {len(samples)/SR:6.2f}s  {os.path.getsize(path)//1024:5d} KB")


def env_exp(n, attack=0.002, decay=0.4):
    a = int(SR * attack)
    out = []
    for i in range(n):
        if i < a:
            e = i / max(1, a)
        else:
            e = math.exp(-(i - a) / (SR * decay))
        out.append(e)
    return out


def sine_sweep(n, f0, f1, phase=0.0):
    out = []
    ph = phase
    for i in range(n):
        t = i / n
        f = f0 * (f1 / f0) ** t
        ph += 2 * math.pi * f / SR
        out.append(math.sin(ph))
    return out


# ---------------------------------------------------------------- impact
def make_impact():
    n = int(SR * 1.5)
    sub = sine_sweep(n, 120, 38)
    body = sine_sweep(n, 220, 60)
    e = env_exp(n, 0.001, 0.30)
    noise = [random.uniform(-1, 1) for _ in range(n)]
    # low-passed noise burst for the "crack"
    lp = 0.0
    crack = []
    for i, x in enumerate(noise):
        lp += 0.06 * (x - lp)
        crack.append(lp * math.exp(-i / (SR * 0.055)))
    out = []
    for i in range(n):
        s = (sub[i] * 0.95 + body[i] * 0.35) * e[i] + crack[i] * 1.5
        out.append(s)
    return out


# ---------------------------------------------------------------- whoosh
def make_whoosh(length=1.1, up=True):
    n = int(SR * length)
    noise = [random.uniform(-1, 1) for _ in range(n)]
    out = []
    lp = 0.0
    for i in range(n):
        t = i / n
        # time-varying low-pass sweep = classic doppler whoosh
        cutoff = 0.02 + 0.5 * (t if up else 1 - t) ** 2
        lp += cutoff * (noise[i] - lp)
        env = math.sin(math.pi * t) ** 1.6
        out.append(lp * env * 2.4)
    return out


# ---------------------------------------------------------------- click
def make_click():
    n = int(SR * 0.12)
    out = []
    for i in range(n):
        t = i / SR
        ping = math.sin(2 * math.pi * 2100 * t) * math.exp(-t / 0.010)
        tick = random.uniform(-1, 1) * math.exp(-t / 0.0025)
        out.append(ping * 0.6 + tick * 0.5)
    return out


# ---------------------------------------------------------------- riser
def make_riser(length=2.4):
    n = int(SR * length)
    noise = [random.uniform(-1, 1) for _ in range(n)]
    out = []
    lp = 0.0
    ph = 0.0
    for i in range(n):
        t = i / n
        cutoff = 0.01 + 0.55 * t ** 2.6
        lp += cutoff * (noise[i] - lp)
        f = 180 * (7.5 ** t)
        ph += 2 * math.pi * f / SR
        tone = math.sin(ph) * 0.22 + math.sin(ph * 2.01) * 0.1
        env = t ** 2.2
        out.append((lp * 1.7 + tone) * env)
    # hard tail cut so it lands on the impact
    tail = int(SR * 0.01)
    for i in range(tail):
        out[-1 - i] *= i / tail
    return out


# ---------------------------------------------------------------- sub
def make_sub():
    n = int(SR * 1.1)
    s = sine_sweep(n, 70, 34)
    e = env_exp(n, 0.004, 0.42)
    return [s[i] * e[i] for i in range(n)]


# ---------------------------------------------------------------- shimmer
def make_shimmer(length=1.8):
    n = int(SR * length)
    partials = [(1.0, 1.0), (2.0, 0.5), (3.01, 0.28), (4.97, 0.16), (6.1, 0.09)]
    base = 1180.0
    out = [0.0] * n
    for mult, amp in partials:
        f = base * mult
        ph = random.uniform(0, 6.28)
        det = 1 + random.uniform(-0.004, 0.004)
        for i in range(n):
            t = i / n
            ph += 2 * math.pi * f * det / SR
            out[i] += math.sin(ph) * amp * math.exp(-t * 3.2) * (1 - t)
    return [v * 0.35 for v in out]


# ---------------------------------------------------------------- ui
def make_ui():
    n = int(SR * 0.26)
    out = []
    for i in range(n):
        t = i / SR
        a = math.sin(2 * math.pi * 880 * t) * math.exp(-t / 0.045)
        b = math.sin(2 * math.pi * 1320 * t) * math.exp(-t / 0.030) * 0.6
        c = math.sin(2 * math.pi * 1760 * t) * math.exp(-t / 0.018) * 0.3
        out.append(a + b + c)
    return out


# ---------------------------------------------------------------- glitch
def make_glitch():
    n = int(SR * 0.45)
    out = []
    hold = 0.0
    for i in range(n):
        t = i / n
        if i % 480 == 0:
            hold = random.choice([0.0, 0.12, -0.18, 0.25, -0.3])
        bit = 1 if math.sin(2 * math.pi * (170 + hold * 900) * i / SR) > 0 else -1
        out.append(bit * 0.32 * (1 - t) ** 1.5)
    return out


# ---------------------------------------------------------------- music bed
def make_bed(length=22.2):
    n = int(SR * length)
    out = [0.0] * n
    # chord cycle: Am9 → Fmaj9 → Cmaj7 → G6  (4 chords, 5.55s each)
    roots = [110.0, 87.31, 130.81, 98.0]
    voicings = [
        [1, 1.5, 2.0, 2.4, 3.0],
        [1, 1.5, 2.0, 2.66, 3.0],
        [1, 1.26, 1.5, 2.0, 2.52],
        [1, 1.5, 2.0, 2.5, 3.0],
    ]
    seg = n // 4
    for k in range(4):
        root = roots[k]
        for mult in voicings[k]:
            f = root * mult
            if f > 2000:
                continue
            ph1 = random.uniform(0, 6.28)
            ph2 = random.uniform(0, 6.28)
            amp = 0.11 / (mult ** 0.5)
            for i in range(seg):
                idx = k * seg + i
                if idx >= n:
                    break
                t = i / seg
                fade = min(1.0, t * 6) * min(1.0, (1 - t) * 6)
                lfo = 0.82 + 0.18 * math.sin(2 * math.pi * 0.23 * (i / SR) + k)
                ph1 += 2 * math.pi * f / SR
                ph2 += 2 * math.pi * f * 1.003 / SR
                out[idx] += (math.sin(ph1) + math.sin(ph2)) * 0.5 * amp * fade * lfo
    # sub bass pulse every 2 beats (0.9s)
    beat = 0.9
    t = 0.0
    while t < length:
        start = int(t * SR)
        dur = int(SR * 0.55)
        f = 55.0
        for i in range(dur):
            if start + i >= n:
                break
            e = math.exp(-i / (SR * 0.16))
            out[start + i] += math.sin(2 * math.pi * f * i / SR) * 0.16 * e
        t += beat
    # gentle stereo-irrelevant top air
    lp = 0.0
    noise = [random.uniform(-1, 1) for _ in range(n)]
    for i in range(n):
        lp += 0.008 * (noise[i] - lp)
        out[i] += lp * 0.35
    return out


def make_ambience(length=22.2):
    n = int(SR * length)
    a = [random.uniform(-1, 1) for _ in range(n)]
    b = [random.uniform(-1, 1) for _ in range(n)]
    out = []
    la = lb = 0.0
    for i in range(n):
        la += 0.0025 * (a[i] - la)
        lb += 0.0009 * (b[i] - lb)
        t = i / n
        swell = 0.55 + 0.45 * math.sin(t * 6.28 * 1.5)
        out.append((la * 2.6 + lb * 4.0) * swell)
    return out


if __name__ == "__main__":
    print("synthesizing VitoAI audio...")
    write_wav("impact.wav", make_impact())
    write_wav("whoosh.wav", make_whoosh())
    write_wav("whoosh_up.wav", make_whoosh(1.4, True))
    write_wav("click.wav", make_click())
    write_wav("riser.wav", make_riser())
    write_wav("sub.wav", make_sub())
    write_wav("shimmer.wav", make_shimmer())
    write_wav("ui.wav", make_ui())
    write_wav("glitch.wav", make_glitch())
    write_wav("bed.wav", make_bed())
    write_wav("ambience.wav", make_ambience())
    print("done → public/audio/")
