#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""«النقر» — طبقةٌ صوتية من زمن الكلمات نفسه.

الرسوم بلا صوتٍ نصفُ عمل: كلُّ كلمةٍ تطلع على الشاشة تسبقها نقرةٌ قصيرة (22 ms،
2.6 kHz مع ضجيجٍ نافذ) فتُسمَع الحركةُ قبل أن تُدرَك. والمواضعُ ليست ذوقاً —
تُقرأ من `captions.json` الذي وُلِد من أنويّات صوته المقيسة، فتقع النقرةُ على
موضع الكلمة لا على تقدير. وتحت كلِّ قطعٍ ضربةُ تحت‑طنين خفيفة (55 هرتز).

    "$AIVENV/bin/python" scripts/ticks.py --caps src/phone/captions.json \
        --tl src/phone/timeline.json --out /tmp/edit3/ticks.wav
"""
from __future__ import annotations

import argparse
import json
import sys
import wave

import numpy as np

SR = 48000


def click(k: float, rng: np.random.Generator) -> np.ndarray:
    """نقرةٌ بتردّدٍ نسبيّ k: تصعد مع ترتيب الكلمة في السطر، فلا تُملّ طَقْطَقَةٌ واحدة."""
    n = int(SR * 0.022)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * 2600 * k * t) * 0.55 + np.sin(2 * np.pi * 4150 * k * t) * 0.20
    s += rng.normal(0, 0.15, n)
    env = np.exp(-t / 0.0045) * np.minimum(1.0, t / 0.0008)
    return (s * env).astype(np.float64)


def thump() -> np.ndarray:
    n = int(SR * 0.11)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * 55 * t) * 0.9 + np.sin(2 * np.pi * 110 * t) * 0.25
    env = np.exp(-t / 0.035) * np.minimum(1.0, t / 0.004)
    return (s * env).astype(np.float64)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--caps", default="src/phone/captions.json")
    ap.add_argument("--tl", default="src/phone/timeline.json")
    ap.add_argument("--out", default="/tmp/edit3/ticks.wav")
    ap.add_argument("--gain", type=float, default=0.30, help="ذروةُ الطبقة، مُطبَّعةٌ هنا")
    a = ap.parse_args()

    tl = json.load(open(a.tl, encoding="utf-8"))
    caps = json.load(open(a.caps, encoding="utf-8"))
    fps = float(tl["fps"])
    lead = int(tl.get("lead_frames", 0))
    out = np.zeros(int(np.ceil(int(tl["total_frames"]) / fps * SR)) + SR, np.float64)
    rng = np.random.default_rng(7)

    placed = 0
    for line in caps["lines"]:
        ws = line["words"]
        for wi, wd in enumerate(ws):
            i = int((int(wd["f"]) + lead) / fps * SR)
            seg = click(1.0 + 0.055 * wi, rng)
            if 0 <= i and i + len(seg) < len(out):
                out[i:i + len(seg)] += seg * (0.85 + 0.15 * (wi / max(1, len(ws) - 1)))
                placed += 1
    th = thump()
    for cf in tl.get("cut_frames", []):
        i = int((int(cf) + lead) / fps * SR)
        if 0 <= i and i + len(th) < len(out):
            out[i:i + len(th)] += th * 0.5
            placed += 1

    peak = float(np.max(np.abs(out))) or 1.0
    pcm = (np.clip(out / peak * a.gain, -1, 1) * 32767).astype("<i2")
    with wave.open(a.out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"  ✔ {a.out} · {placed} موضعاً (كلماتٌ + قطع) · ذروةٌ {a.gain:.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
