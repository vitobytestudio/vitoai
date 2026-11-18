#!/usr/bin/env python3
"""
Rivio Tease Score — 48.87s dark-tech electronic bed synchronized to rivioVo.json.
Pure Python stdlib (no numpy required) -> /tmp/rivio/score.wav (48kHz stereo).
"""
import argparse, array, json, math, os, wave

SR = 48000

def add_note(L, R, start_s, dur_s, freq, amp=0.15, wave_type="sine", pan=0.0):
    i0 = int(start_s * SR)
    n = int(dur_s * SR)
    total = len(L)
    if i0 >= total or n <= 0:
        return
    i1 = min(total, i0 + n)
    m = i1 - i0
    ia = max(1, int(0.015 * SR))
    ir = max(1, int(min(0.25, dur_s * 0.4) * SR))
    l_gain = amp * math.sqrt(0.5 * (1.0 - pan))
    r_gain = amp * math.sqrt(0.5 * (1.0 + pan))
    two_pi_f = 2.0 * math.pi * freq / SR
    for k in range(m):
        e = 1.0
        if k < ia:
            e = k / ia
        elif k > m - ir:
            e = (m - k) / ir
        if wave_type == "sine":
            s = math.sin(two_pi_f * k)
        elif wave_type == "warm":
            p = two_pi_f * k
            s = 0.7 * math.sin(p) + 0.25 * math.sin(2.0 * p) + 0.08 * math.sin(3.0 * p)
        elif wave_type == "pluck":
            p = two_pi_f * k
            t = k / SR
            s = (math.sin(p) + 0.4 * math.sin(2.0 * p)) * math.exp(-t * 9.0)
        else:
            s = math.sin(two_pi_f * k)
        v = s * e
        L[i0 + k] += v * l_gain
        R[i0 + k] += v * r_gain

def add_tick(buf, start_s, amp=0.10, freq=1600.0):
    i0 = int(start_s * SR)
    n = int(0.04 * SR)
    if i0 >= len(buf):
        return
    i1 = min(len(buf), i0 + n)
    w = 2.0 * math.pi * freq / SR
    for k in range(i1 - i0):
        t = k / SR
        buf[i0 + k] += math.sin(w * k) * math.exp(-t * 85.0) * amp

def add_boom(L, R, start_s, amp=0.32):
    i0 = int(start_s * SR)
    n = int(1.3 * SR)
    if i0 >= len(L):
        return
    i1 = min(len(L), i0 + n)
    phase = 0.0
    for k in range(i1 - i0):
        t = k / SR
        f = 95.0 * math.exp(-t * 3.2) + 34.0
        phase += 2.0 * math.pi * f / SR
        v = math.sin(phase) * math.exp(-t * 2.4) * amp
        L[i0 + k] += v
        R[i0 + k] += v

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--vo", default="src/phone/rivioVo.json")
    ap.add_argument("--dur", type=float, default=48.87)
    ap.add_argument("--out", default="/tmp/rivio/score.wav")
    args = ap.parse_args()

    vo = json.load(open(args.vo, encoding="utf-8"))
    phrases = vo.get("sentences", vo.get("phrases", []))
    t_surf = phrases[5]["start_s"] if len(phrases) > 5 else 15.0
    t_craft = phrases[9]["start_s"] if len(phrases) > 9 else 29.0
    t_end = phrases[-1]["end_s"] if phrases else 42.0

    n_samples = int(args.dur * SR)
    L = [0.0] * n_samples
    R = [0.0] * n_samples

    # Act I: Tense sub-pulse + restless ticks
    t = 0.0
    while t < t_surf - 0.5:
        add_note(L, R, t, 0.35, 55.0, amp=0.18, wave_type="warm", pan=-0.1)
        add_note(L, R, t, 0.35, 55.2, amp=0.18, wave_type="warm", pan=0.1)
        add_tick(L, t + 0.18, amp=0.06, freq=1800.0)
        add_tick(R, t + 0.36, amp=0.05, freq=2200.0)
        t += 0.5

    # Blackout drop at Surface reveal
    add_boom(L, R, max(0.0, t_surf - 0.15), amp=0.35)

    # Act II & III: Clean modern dark-tech progression
    chords = [
        (t_surf, 4.0, [110.0, 164.81, 220.0, 261.63]),
        (t_surf + 4.0, 4.0, [87.31, 130.81, 174.61, 220.0]),
        (t_surf + 8.0, 4.0, [130.81, 196.0, 261.63, 329.63]),
        (t_surf + 12.0, 4.0, [98.0, 146.83, 196.0, 246.94]),
        (t_craft, 4.0, [110.0, 164.81, 220.0, 329.63]),
        (t_craft + 4.0, 4.0, [87.31, 130.81, 174.61, 261.63]),
        (t_craft + 8.0, 5.0, [98.0, 146.83, 196.0, 293.66]),
        (t_end, max(0.5, args.dur - t_end), [110.0, 164.81, 220.0, 261.63]),
    ]
    for st, d, freqs in chords:
        add_note(L, R, st, d, freqs[0], amp=0.16, wave_type="warm", pan=0.0)
        for idx, f in enumerate(freqs[1:]):
            add_note(L, R, st + 0.05 * idx, d, f, amp=0.065, wave_type="sine", pan=-0.35 if idx % 2 == 0 else 0.35)

    # Pluck arpeggio
    arp_notes = [220.0, 261.63, 329.63, 392.0, 329.63, 261.63]
    t = t_surf + 0.25
    k = 0
    while t < args.dur - 1.5:
        f = arp_notes[k % len(arp_notes)]
        add_note(L, R, t, 0.32, f, amp=0.06, wave_type="pluck", pan=-0.3 if k % 2 == 0 else 0.3)
        t += 0.375
        k += 1

    # Soft fade out
    fade_n = int(1.8 * SR)
    if fade_n < n_samples:
        for k in range(fade_n):
            g = 1.0 - (k / fade_n)
            idx = n_samples - fade_n + k
            L[idx] *= g
            R[idx] *= g

    peak = max(max(abs(x) for x in L), max(abs(x) for x in R), 1e-6)
    scale = min(1.0, 0.85 / peak)
    pcm = array.array("h")
    for i in range(n_samples):
        lv = max(-1.0, min(1.0, L[i] * scale))
        rv = max(-1.0, min(1.0, R[i] * scale))
        pcm.append(int(lv * 32767))
        pcm.append(int(rv * 32767))

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with wave.open(args.out, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())
    print(f"✔ {args.out} ({args.dur:.2f}s, stereo 48kHz)")

if __name__ == "__main__":
    main()
