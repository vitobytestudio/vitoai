#!/usr/bin/env python3
"""vo_beats — محاذاةُ النصِّ المكتوبِ إلى إيقاعِ التعليقِ المقيس.

المشكلةُ التي تُحلُّها: لا يُعرَفُ توقيتُ كلِّ جملةٍ في ملفِّ صوتٍ إلّا بواحدٍ من اثنين —
إمّا نموذجُ تمييزِ كلامٍ (مستحيلٌ هنا: لا أوزانَ تدخلُ من البابِ المسدود)، أو قياسُ أين
يتكلّمُ الملفُّ فعلاً وتوزيعُ الجُملِ المقروءةِ على ذلك القياس. الثانيةُ هي هذه، وهي
صادقةٌ مع نفسها: لا تدّعي حدودَ كلماتٍ بل تُخرِجُ حدودَ **جُملٍ** موضوعةً على أقربِ
صمتٍ مقيسٍ إلى موضعِها النسبيِّ من عددِ الكلمات. لذا كلُّ حدٍّ هنا يقعون داخل صمتٍ
حقيقيٍّ في الصوت، لا داخلَ كلام.

  "$AIVENV/bin/python" scripts/vo_beats.py --in /tmp/rivio/vo.wav \
      --phrases /tmp/rivio/phrases.txt --out src/phone/rivioVo.json

يكتبُ JSON فيه: fps, duration_frames, floor_db, blocks, lines[{i,text,start_f,end_f}]
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import wave

import numpy as np

WORD_RE = re.compile(r"[A-Za-z0-9\u00c0-\u017f'\u2019-]+")


def envelope(path: str, sr_want: int = 48000, win_s: float = 0.02):
    w = wave.open(path)
    sr = w.getframerate()
    n = w.getnframes()
    ch = w.getnchannels()
    x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    win = max(1, int(sr * win_s))
    m = len(x) // win
    env = np.sqrt((x[: m * win].reshape(m, win) ** 2).mean(axis=1))
    db = 20 * np.log10(env + 1e-9)
    return db, sr, win_s, len(x) / sr


def blocks_of(db: np.ndarray, win_s: float, pad_s: float = 0.10):
    """كتلُ كلامٍ فوقَ الأرضيةِ بزائدِ 12 dB، مع دمجِ ما كان الفجوةُ أقصرَ من pad_s."""
    live = db[db > -80]
    if len(live) < 8:
        return [], 0.0
    floor = float(np.percentile(live, 20))
    th = floor + 12.0
    on = db > th
    out = []
    i = 0
    while i < len(on):
        if on[i]:
            j = i
            while j < len(on) and on[j]:
                j += 1
            if (j - i) * win_s >= 0.05:
                out.append([i * win_s, j * win_s])
            i = j
        else:
            i += 1
    merged = []
    for a, b in out:
        if merged and a - merged[-1][1] < pad_s:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    return merged, floor


def assign(bl: list[list[float]], texts: list[str], fps: float) -> list[tuple[int, int]]:
    """تقسيمُ الكتلِ على الجُمل: كلُّ حدٍّ يقعُ في صمتٍ مقيسٍ أقربَ ما يكونُ إلى موضعِها النسبيِّ من الكلمات.

    لا تدّعي هذه الدالّةُ توقيتَ كلماتٍ \u2014 بل تختارُ من الفجواتِ الصامتةِ التي قياسُها موجودٌ
    في الملفّ نفسِه، فتقعُ حدودُ الجُملِ على صمتٍ دائماً. رتيبٌ إجباريّاً، ولا جملةٌ بلا كتلةٍ صوتيّة.
    """
    words = [max(1, len(WORD_RE.findall(t))) for t in texts]
    n = len(texts)
    t0, t1 = bl[0][0], bl[-1][1]
    span = max(0.01, t1 - t0)
    cands = [(bl[i][1] + bl[i + 1][0]) / 2 for i in range(len(bl) - 1)]
    m = len(cands)
    cuts: list[int] = []
    done = 0.0
    for k in range(n - 1):
        done += words[k] / float(sum(words))
        want = t0 + done * span
        left = (cuts[-1] + 1) if cuts else 0
        right = m - (n - 1 - k) + 1                 # اتركْ فواصلَ كافيةً للجُملِ الباقية
        pick = left
        for c in range(left, max(right, left + 1)):
            if c >= m:
                break
            if abs(cands[c] - want) < abs(cands[pick] - want):
                pick = c
        cuts.append(pick)
    edges = [0] + [c + 1 for c in cuts] + [len(bl)]
    out: list[tuple[int, int]] = []
    for k in range(n):
        a, b = edges[k], edges[k + 1]
        if a >= len(bl):
            out.append((int(round(t0 * fps)), int(round(t1 * fps))))
            continue
        out.append((int(round(bl[a][0] * fps)), int(round(bl[min(b, len(bl)) - 1][1] * fps))))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="wav", required=True)
    ap.add_argument("--phrases", required=True, help="سطرٌ لكلِّ جملةٍ بنفسِ ترتيبِ القراءة")
    ap.add_argument("--out", default="src/phone/vo.json")
    ap.add_argument("--fps", type=float, default=30.0)
    a = ap.parse_args()
    if not os.path.exists(a.wav):
        print(f"✗ لا ملفَّ صوتٍ: {a.wav}", file=sys.stderr)
        return 2
    texts = [l.strip() for l in open(a.phrases, encoding="utf-8") if l.strip() and not l.startswith("#")]
    db, sr, win_s, total = envelope(a.wav)
    bl, floor = blocks_of(db, win_s)
    if not bl:
        print("✗ لا كلامَ مقيساً في الملفّ", file=sys.stderr)
        return 3
    spans = assign(bl, texts, a.fps)
    lines = [{"i": k, "text": t, "start_f": spans[k][0], "end_f": spans[k][1]} for k, t in enumerate(texts)]
    for k in range(1, len(lines)):
        if lines[k]["start_f"] < lines[k - 1]["start_f"]:
            lines[k]["start_f"] = lines[k - 1]["start_f"] + 1
    d = {"fps": a.fps, "duration_frames": round(total * a.fps), "floor_db": round(floor, 2),
         "speech_blocks": len(bl), "audio": os.path.basename(a.wav), "lines": lines}
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    json.dump(d, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"  ✔ {a.out} · {len(lines)} جملةٌ على {len(bl)} كتلةٍ مقيسة · أرضيةٌ {floor:.1f} dBFS")
    for L in lines:
        print("    f%4d–f%4d  %5.2fs–%5.2fs  %s" % (L["start_f"], L["end_f"], L["start_f"] / a.fps, L["end_f"] / a.fps, L["text"][:58]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
