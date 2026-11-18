#!/usr/bin/env python3
"""ink_share — قياسُ نِسَبِ الحبرِ اللونيّ على الملفِّ المُرمَّز، لا على لوحةِ التصميم.

القاعدةُ التي فُرِضَت في فيلمِ Rivio: البنفسجيُّ ≤ 12% من الحبرِ اللونيّ، والأزرقُ ≤ 22%.
الرقمُ لا يُعرَّبُ في ملفٍّ، بل يُقاسُ بعدَ الترميز، لأنَّ الترميزَ نفسَه يحرِّفُ التشبُّع.
يُصنَّفُ كلُّ بكسلٍ فوقَ عتبةِ الإضاءةِ إلى أزرقَ أو بنفسجيٍّ أو محايدٍ بحسب زاويةِ اللون،
ثم تُخرَجُ النِّسَبُ لكلِّ إطارٍ مقيسٍ وللحدِّ الأقصى.

  "$AIVENV/bin/python" studio/ink_share.py deliverables/rivio-tease-1080x1920.mp4 [--frames 24]
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import tempfile

import numpy as np

V_CAP = 12.0   # % ceiling for violet ink
B_CAP = 22.0   # % ceiling for blue ink


def classify(rgb: np.ndarray) -> tuple[float, float, float]:
    r, g, b = (rgb[..., i].astype(np.float32) for i in range(3))
    luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    mx = rgb.max(axis=2).astype(np.float32)
    mn = rgb.min(axis=2).astype(np.float32)
    sat = (mx - mn) / np.maximum(mx, 1e-6)
    ink = (luma > 42) & (sat > 0.16)                      # «الحبرُ اللونيُّ» لا الخلفيةَ السوداء
    hue = np.zeros_like(luma)
    denom = np.maximum(mx - mn, 1e-6)
    # قطاعاتُ اللونِ بقراراتٍ ثابتةٍ لا بدوالِ matplotlib: أزرقُ ~200-250°، بنفسجيٌّ ~255-300°
    with np.errstate(invalid="ignore", divide="ignore"):
        hb = 60.0 * (((g - b) / denom) + 4.0)
        hg = 60.0 * (((r - g) / denom) + 2.0)
        hr = 60.0 * (((g - b) / denom) % 6.0)
    hue = np.where(mx == r, hr, np.where(mx == g, hg, hb))
    hue = np.where(hue < 0, hue + 360.0, hue)
    blue = ink & (hue >= 195) & (hue < 252)
    viol = ink & (hue >= 252) & (hue < 310)
    tot = max(1, int(ink.sum()))
    return (100.0 * int(blue.sum()) / max(1, int(luma.size)), 100.0 * int(viol.sum()) / max(1, int(luma.size)),
            100.0 * (int(blue.sum()) + int(viol.sum())) / tot)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--frames", type=int, default=24)
    ap.add_argument("--json", default="")
    a = ap.parse_args()
    ff = os.environ.get("FFMPEG")
    if not ff or not os.path.exists(ff):
        print("✗ حدِّدْ FFMPEG (source .toolenv)", file=sys.stderr)
        return 2
    # لا اعتمادَ على ffprobe: مدّةُ الملفِّ تُقرَأُ من ffmpeg نفسِه (البابُ موصودٌ على باقاتٍ أخرى)
    dur = subprocess.run([ff, "-hide_banner", "-i", a.video], capture_output=True)
    m = re.search(r"Duration:\s*(\d+):(\d+):([\d.]+)", dur.stderr.decode("utf-8", "ignore"))
    if not m:
        print("✗ تعذّر قراءةُ المدّة", file=sys.stderr)
        return 2
    T = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    last = max(0.0, T - 0.25)                      # لا عيّنةَ بعدَ آخرِ إطارٍ: ffmpeg يُخرِجُ صمتاً
    ts = [round(i * last / max(1, a.frames - 1), 3) for i in range(a.frames)]
    rows = []
    with tempfile.TemporaryDirectory() as td:
        for n, t in enumerate(ts):
            subprocess.run([ff, "-v", "error", "-ss", f"{t:.3f}", "-i", a.video, "-frames:v", "1",
                            "-vf", "scale=360:-2", os.path.join(td, f"f{n}.png")], check=True)
            if not os.path.exists(os.path.join(td, f"f{n}.png")):
                raise RuntimeError("لا إطارٌ عند %.3fs" % t)
            from PIL import Image

            im = np.asarray(Image.open(os.path.join(td, f"f{n}.png")).convert("RGB"))
            rows.append((t, *classify(im)))
    b = max(r[1] for r in rows)
    v = max(r[2] for r in rows)
    share_v = max(r[3] for r in rows)
    print("  عيّناتٌ %d من %s · أقصى حبرٍ أزرقَ %.2f%% · أقصى بنفسجَ %.2f%% · أعلى نصيبٍ لونيٍّ %.1f%%"
          % (len(rows), os.path.basename(a.video), b, v, share_v))
    ok = v <= V_CAP and b <= B_CAP
    print("  " + ("✔ تحتَ السقفين (12%% بنفسجيّ / 22%% أزرق)" if ok else "✗ تجاوزَ السقفَ — راجعِ اللقطةَ المعنيّة"))
    if a.json:
        import json

        json.dump({"video": os.path.basename(a.video), "samples": len(rows), "max_blue_pct": round(b, 3),
                   "max_violet_pct": round(v, 3), "max_tinted_share_pct": round(share_v, 2),
                   "caps": {"violet": V_CAP, "blue": B_CAP}, "pass": bool(ok),
                   "frames": [{"t": round(r[0], 3), "blue": round(r[1], 3), "violet": round(r[2], 3)} for r in rows]},
                  open(a.json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("  ✔ " + a.json)
    return 0 if ok else 4


if __name__ == "__main__":
    raise SystemExit(main())
