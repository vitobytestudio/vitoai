#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""scripts/score_corp.py — موسيقى الشركة: طبقةٌ واحدةٌ طويلة، إيقاعُها من مواضعِ القطع.

لا مكتبةَ صوتٍ في هذا الصندوق ولا إنترنت — فالنغمةُ مؤلَّفةٌ هنا رياضياً، ومِزاجُها
«محايدٌ معاصر» كما طلب الوصف: لا لحنَ ينافسُ الكلام، بل وسادةٌ دافئة، ونبضةٌ ثُمنِيّة
تعطي الإحساسَ بالسرعة، وتأكيدها الوحيدُ على **إطاراتِ القطع المقيسة** من `timeline.json`
— فلا «ضربةٌ» على لا شيء.

الطبقات:
  pad      ثلاثياتٌ بطيئة (Am–F–C–G) بمُنحَني تنفّس، مقطوعةُ الذيلِ تحت الكلام
  pulse    نبضةُ ثُمنٍ بتناوبِ الأوكتاف، تعلو في الوسط وتَخْبو قبل البطاقة
  accents  impact على اللوحاتِ الكاملة، whoosh داخل الكتل، shimmer عند البطاقة،
           وriserٌ يركضُ آخرَ ثلاثِ ثوانٍ قبلها — كلها من `public/audio/` المولَّدة
           محليّاً، مُعادٍ تشكيلُ غلافِها.

    "$AIVENV/bin/python" scripts/score_corp.py --tl /tmp/corp/timeline.json --out public/audio/corp
"""
from __future__ import annotations
import argparse
import json
import os
import wave

import numpy as np

SR = 48000
TAU = 2 * np.pi
ROOT = 110.0                                   # A2 — منخفضة بما يكفي لتختفي تحت الصدر
PROG = [[1.0, 1.2, 1.5], [1.0, 1.26, 1.5], [1.0, 1.25, 1.667], [1.0, 1.26, 1.5]]  # Am F C Em-ish
BPM = 92.0


def write_wav(path: str, x: np.ndarray, peak: float = 0.9):
    m = float(np.max(np.abs(x))) or 1.0
    g = peak / m
    y = np.clip(x * g, -1.0, 1.0)
    i16 = (y * 32767.0).astype("<i2")
    ch = 2 if i16.ndim == 2 else 1
    with wave.open(path, "wb") as w:
        w.setnchannels(ch)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(i16.tobytes())
    print(f"  {os.path.basename(path):18s} {len(x) / SR:6.2f}s  {os.path.getsize(path) / 1024:7.0f} KB")


def read_wav(path: str) -> np.ndarray:
    with wave.open(path, "rb") as w:
        n, ch, sw, sr = w.getnframes(), w.getnchannels(), w.getsampwidth(), w.getframerate()
        raw = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float64) / 32768.0
    x = raw.reshape(-1, ch).mean(axis=1) if ch > 1 else raw
    if sr != SR:
        idx = np.linspace(0, len(x) - 1, int(round(len(x) * SR / sr)))
        x = np.interp(idx, np.arange(len(x)), x)
    return x


def place(dst: np.ndarray, src: np.ndarray, at: float, gain: float, taper: float = 1.0):
    i0 = int(at * SR)
    if i0 >= len(dst) or i0 < 0:
        return
    n = min(len(src), len(dst) - i0)
    seg = src[:n] * gain
    if taper < 1.0 and n > 400:                       # إعادةُ تشكيلِ الغلاف: قطعُ الذيل
        k = int(n * taper)
        seg = seg.copy()
        seg[k:] *= np.linspace(1.0, 0.0, n - k) ** 1.6
    dst[i0:i0 + n] += seg


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tl", default="/tmp/corp/timeline.json")
    ap.add_argument("--out", default="public/audio/corp")
    ap.add_argument("--sec", type=float, default=0.0, help="تجاوزُ الطولِ المحسوب (ثوانٍ)")
    ap.add_argument("--bpm", type=float, default=BPM)
    a = ap.parse_args()
    tl = json.load(open(a.tl, encoding="utf-8"))
    fps = float(tl["fps"])
    total = (tl.get("total_frames") or tl["picture_frames"]) / fps + a.sec
    N = int(SR * total)
    os.makedirs(a.out, exist_ok=True)
    t = np.arange(N) / SR
    beat = 60.0 / a.bpm

    # ── 1 · الوسادة: ثلاثياتٌ بطيئة، تنفّسٌ لكلّ مِزْجرة، ومرشّحُ تمريرٍ منخفض
    #       بالـFFT (حلقةُ بايثون على 4.7 مليون عيّنة تعني عشرَ دقائقَ بلا سبب)
    bar = 4 * beat
    pad = np.zeros(N)
    nb = int(np.ceil(total / bar))

    def lp(x: np.ndarray, fc: float) -> np.ndarray:
        n = len(x)
        Xf = np.fft.rfft(x)
        fr = np.fft.rfftfreq(n, 1.0 / SR)
        H = 1.0 / (1.0 + (fr / max(80.0, fc)) ** 4)
        return np.fft.irfft(Xf * H, n)

    for b in range(nb):
        ch = PROG[b % len(PROG)]
        t0 = b * bar
        i0b = int(t0 * SR)
        seg_len = min(int(bar * SR), N - i0b)
        if seg_len <= 0:
            break
        u = np.arange(seg_len) / SR
        env = np.clip(u / 1.4, 0, 1) * np.clip((bar - u) / (bar * 0.34), 0, 1) ** 1.2
        s = np.zeros(seg_len)
        for vi, ratio in enumerate(ch):
            f = ROOT * ratio * (1.0 + 0.0016 * vi)                # كورَسٌ بدَرَجٍ مئويّ
            s += (np.sin(TAU * f * u) + 0.42 * np.sin(TAU * 2 * f * u)
                  + 0.18 * np.sin(TAU * 3 * f * u)) * (0.55 if vi == 0 else 0.30)
        open_at = 0.35 + 0.65 * min(1.0, b / max(1.0, nb * 0.5))   # ينفتحُ مع الفيلم
        duck = 0.42 if t0 > total - 5.0 else 1.0
        pad[i0b:i0b + seg_len] += lp(s, 900.0 * open_at) * env * 0.62 * duck

    # ── 2 · النبضة الثُمنيّة: تُعطي «سرعة» بلا طبلٍ ينافسُ الحروف
    pulse = np.zeros(N)
    step = beat / 2
    tens = np.clip((t - 6.0) / 12.0, 0.0, 1.0) * np.clip((total - 6.0 - t) / 10.0, 0.0, 1.0)
    tens = 0.28 + 0.72 * tens
    npl = int(0.14 * SR)
    uu = np.arange(npl) / SR
    for k in range(int((total - 2.0) / step)):
        i0b = int(k * step * SR)
        if i0b + npl >= N:
            break
        f = ROOT * (2.0 if k % 4 == 0 else 3.0)
        g = (0.95 if k % 4 == 0 else 0.42) * float(tens[i0b // SR])
        pulse[i0b:i0b + npl] += np.sin(TAU * f * uu) * np.exp(-uu / 0.045) * g * 0.17

    # ── 3 · التأكيداتُ على القطعِ المقيسة ──────────────────────────────────────────
    fx_dir = os.path.join(os.path.dirname(__file__), "..", "public", "audio")
    fx = {}
    for nm in ("impact", "whoosh", "shimmer", "riser", "ui", "sub"):
        pth = os.path.join(fx_dir, nm + ".wav")
        fx[nm] = read_wav(pth) if os.path.exists(pth) else np.zeros(1)
    acc = np.zeros(N)
    cuts = tl.get("cut_secs") or [f / fps for f in tl.get("cut_frames", [])]
    slates = [x["cut_a"] for x in tl.get("slates", [])]
    for c in cuts:
        if c < 1.0 or c > total - 5.0:
            continue
        place(acc, fx["ui"], c - 0.10, 0.30, 0.55)
        place(acc, fx["sub"], c - 0.05, 0.26, 0.75)
    for c in slates:
        place(acc, fx["impact"], c - 0.16, 0.62, 0.9)
        place(acc, fx["whoosh"], c - 0.34, 0.40, 0.9)
    card = (tl.get("lead_frames", 0) + tl["picture_frames"]) / fps
    if card < total:
        place(acc, fx["shimmer"], card - 0.10, 0.55, 1.0)
    rl = 3.4
    if "riser" in fx and len(fx["riser"]) > SR:
        place(acc, fx["riser"], max(0.0, card - rl), 0.34, 1.0)

    # ── 4 · المزجُ النهائي للطبقة ──────────────────────────────────────────────────
    score = pad * 0.92 + pulse + acc
    # قصٌّ ناعمٌ في آخر 1.8s قبل البطاقة ثم إعادةُ فتحٍ تحتها (Punch: صوتٌ يبقى ملكَه)
    lo = np.ones(N)
    i0, i1 = int(max(0.0, card - 1.8) * SR), int(min(N, (card + 0.4) * SR))
    lo[i0:i1] = np.linspace(1.0, 0.42, i1 - i0)
    lo[i1:] = 0.42 + 0.30 * np.clip((np.arange(N - i1) / (0.6 * SR)), 0, 1) if i1 < N else 1.0
    score *= lo
    # ستيريو: الوسادةُ عريضة، النبضةُ مركزية
    wide = score * (1.0 + 0.06 * np.sin(TAU * 0.13 * t))
    st = np.stack([wide, score], axis=1)
    write_wav(os.path.join(a.out, "score.wav"), st, 0.90)
    write_wav(os.path.join(a.out, "score_solo.wav"), score, 0.90)
    marks = {"total_seconds": round(total, 2), "cuts": [round(c, 3) for c in cuts],
             "slates": [round(c, 3) for c in slates], "card_at": round(card, 3),
             "bpm": a.bpm, "beat_seconds": round(beat, 4)}
    with open(os.path.join(a.out, "marks.json"), "w", encoding="utf-8") as fh:
        json.dump(marks, fh, ensure_ascii=False, indent=1)
    print(f"  ✔ {a.out}/score.wav · {total:.2f}s · {len(cuts)} تأكيداً على القطع · {len(slates)} على اللوحات")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
