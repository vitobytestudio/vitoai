#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""«المحاذاة» — word timings for the caption band, from the voice itself.

لا يستطيع هذا الصندوق أن ينسخ كلامه حرفياً: لا وزنَ لـ Whisper ولا Vosk فيه، و
`huggingface.co` و `objects.githubusercontent.com` مغلقان (000). فالكلماتُ إذن من
عندي أو منه، والتوقيتُ من صوته دائماً.

ما يفعله الملف: يأخذ «نواة المقطع» (local maxima في غلاف الطاقة، قياسٌ لا تخمين)
ويوزّع كلماتِ كلَّ جملةٍ عليها بوزنِ طولِ الكلمة، فيخرج JSON يقول لكلِّ كلمةٍ:
«اظهري في الإطار كذا». متى أرسل المستخدم نصَّه حرفيّاً، تُعاد هذه الخطوة وحدها
فتُصبِح الكابتشنات كلامَه هو، بنفس المحرك.

    "$AIVENV/bin/python" scripts/align.py --tl src/phone/timeline.json \
        --phrases /tmp/phrases.txt --out src/phone/captions.json
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

# وزنُ الكلمة محليٌّ لا معجميّ: عددُ الحروف بعد تجريد التشكيل، لأنَّ النطقَ هو
# ما يقيسُه الغلافُ الصوتيّ، والإملاءُ لا يُقرأ على اللسان.
def weight(word: str) -> float:
    """وزنٌ تقريبيٌّ للكلمة: عددُ الحروف + نَفَسٌ للواحق. النطقُ يُقاس بالحروف لا بالمسافات."""
    w = re.sub(r"[ً-ْٰ]", "", word)
    base = max(2.0, float(len(w)))
    if w.startswith(("ال", "وال", "فال")):
        base += 1.2
    if len(w) >= 7:
        base += 1.0
    return base


def snap(nuclei, targets):
    """كلُّ هدفٍ يجد أقربَ نواةٍ لا تسبقه (ولا تُعاد النواةُ مرتين) — وإلا زُحزح."""
    used, out, j = set(), [], 0
    for t in targets:
        best = None
        for k, n in enumerate(nuclei):
            if k in used:
                continue
            if best is None or abs(n - t) < abs(nuclei[best] - t):
                best = k
        if best is None:
            best = min(range(len(nuclei)), key=lambda k: abs(nuclei[k] - t))
        used.add(best)
        out.append(nuclei[best])
    out.sort()
    for i in range(1, len(out)):                      # رتابةٌ صارمة: كلمةٌ لا تسبق سابقتها
        if out[i] <= out[i - 1]:
            out[i] = out[i - 1] + 0.12
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tl", default="src/phone/timeline.json")
    ap.add_argument("--phrases", required=True, help="سطرٌ لكلِّ لقطة: عربي|إنجليزي")
    ap.add_argument("--out", default="src/phone/captions.json")
    ap.add_argument("--pad", type=float, default=0.10, help="أمانٌ بالثانية قبل أوّل نواة")
    a = ap.parse_args()

    tl = json.load(open(a.tl, encoding="utf-8"))
    fps = float(tl["fps"])
    lines = [ln.strip() for ln in open(a.phrases, encoding="utf-8") if ln.strip() and not ln.startswith("#")]

    caps, out_lines = [], []
    for si, seg in enumerate(tl["segments"]):
        if si >= len(lines):
            break
        ar, _, en = lines[si].partition("|")
        words = [w for w in re.split(r"\s+", ar.strip()) if w]
        if not words:
            continue
        nus = [x for x in seg["nuclei"] if seg["cut_a"] - 0.01 <= x <= seg["cut_b"] + 0.01]
        t0, t1 = seg["cut_a"] + a.pad, seg["cut_b"] - a.pad
        if len(nus) < len(words):                      # نوىً أقلّ من الكلمات: نملأ بالمسافة المتساوية
            step = (t1 - t0) / max(1, len(words))
            beats = [t0 + i * step for i in range(len(words))]
        else:
            ws = [weight(w) for w in words]
            cum, s = [], 0.0
            for x in ws:
                s += x
                cum.append(s)
            targets = [t0 + (c / s) * (t1 - t0) for c in cum]
            beats = snap(nus, targets)
        rec = {"seg": si, "ar": ar.strip(), "en": en.strip(), "t0": round(t0, 3), "t1": round(t1, 3),
               "words": [{"w": w, "f": int(round(t * fps))} for w, t in zip(words, beats)]}
        out_lines.append(rec)
        print(f"  لقطة {si+1}: {len(words)} كلمة على {len(nus)} نواة · "
              + " ".join(f"{w['w']}@{w['f']}" for w in rec["words"]))
    caps = {"fps": fps, "lead_frames": tl.get("lead_frames", 0), "picture_frames": tl["picture_frames"],
            "card_frames": tl["card_frames"], "lines": out_lines, "source": "measured syllable nuclei"}
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as fh:
        json.dump(caps, fh, ensure_ascii=False, indent=1)
    print(f"  ✔ {a.out} · {len(out_lines)} سطرًا")
    return 0


if __name__ == "__main__":
    sys.exit(main())
