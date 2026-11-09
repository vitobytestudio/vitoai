#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""scripts/assemble.py — قصٌّ يُقرَّر بالقياس، لا بالذوق: يجمع المقاطع ويقصّ على النَّفَس.

المدخلات ملفات هاتف (نفس الكاميرا، نفس الإعدادات). ما يفعله:
  1. يقيس غلاف الطاقة من الصوت نفسه — أرضيّةُ الضجيج هي قاعُ التوزيع (المئويّة 12)،
     لا «−40 dB» من وثيقة؛ والصمتُ ما اقترب من تلك الأرضية.
  2. يستخرج جُمَل الكلام (spans) وأنويةَ المقاطع داخلها (nuclei) — وهي ما يبني
     «كلمةً كلمة» لاحقاً، بلا نموذجٍ لا نستطيع تنزيله.
  3. يختار أطول الجُمَل المتّصلة، يفرزها بترتيبها الزمني داخل كل مقطع، ويقصّ إلى مدةٍ
     مستهدفة — كلُّ حدٍّ على صمت، وكلُّ مدةٍ مضروبة في إطارٍ كامل.
  4. يكتب timeline.json: مواضع القطع، جُمَل الكلام، وأنويّته — على خطّ زمنيٍّ واحد
     هو زمن المونتاج لا زمن المصدر، فيقرأه Remotion بلا حساب.

    python3 scripts/assemble.py --out /tmp/edit2 --target 26.0 clip1.mp4 clip2.mp4 clip3.mp4
"""
from __future__ import annotations
import argparse, json, os, subprocess, sys

import numpy as np

FF = os.environ.get("FFMPEG") or "ffmpeg"
HOP, WIN = 160, 800                 # 20 ms خطوة، 100 ms نافذة @ 8 kHz


def envelope(path: str) -> tuple:
    raw = subprocess.run([FF, "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", "8000",
                          "-f", "f32le", "-"], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32)
    n = max(0, (len(x) - WIN) // HOP)
    e = np.array([np.sqrt(np.mean(x[i * HOP:i * HOP + WIN] ** 2) + 1e-12) for i in range(n)])
    return 20 * np.log10(e + 1e-9), n * HOP / 8000.0


def spans_of(db: np.ndarray, min_speech: float = 1.15, merge_gap: float = 0.16,
             floor_pct: float = 12.0, lift: float = 4.0) -> list:
    """جُمَل الكلام: ما فوق الأرضية بأربع ديسيبل، مع سدّ فجوةٍ أقصر من نَفَس.

    كتابةٌ بفهارسَ صريحة، لا بتكرارِ حلقاتٍ شرطية: أولَ مرةٍ كتبتُها بحلقتين متداخلتين
    فكانت تبتلع أول الجملة وتُكرّر آخرها — والقصاصُ على جملةٍ مبتورة يُسمع، لا يُرى.
    """
    if db.size == 0:
        return []
    floor = np.percentile(db, floor_pct)
    hot = db > floor + lift
    idx = np.flatnonzero(hot)
    if idx.size == 0:
        return []
    gap = max(1, int(merge_gap / 0.02))
    runs, start, prev = [], int(idx[0]), int(idx[0])
    for k in idx[1:]:
        if k - prev <= gap:
            prev = int(k)
            continue
        runs.append((start, prev + 1))
        start = prev = int(k)
    runs.append((start, prev + 1))
    return [[round(a * 0.02, 3), round(b * 0.02, 3)] for a, b in runs if (b - a) * 0.02 >= min_speech]


def nuclei_in(db: np.ndarray, a: float, b: float, min_sep=0.10) -> list:
    """أنوية المقاطع: قِمَمٌ فوق متوسّط الجملة بنصف انحرافٍ معياري — تُقرأ منها «الكلمة»."""
    i0, i1 = int(a / 0.02), min(len(db), int(b / 0.02))
    seg = db[i0:i1]
    if seg.size < 6:
        return []
    thr = seg.mean() + 0.30 * seg.std()
    peaks, last = [], -9
    for k in range(1, seg.size - 1):
        if seg[k] >= seg[k - 1] and seg[k] > seg[k + 1] and seg[k] > thr and (k * 0.02 - last) >= min_sep:
            peaks.append(round(a + k * 0.02, 3))
            last = k * 0.02
    return peaks


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("srcs", nargs="+")
    ap.add_argument("--out", default="/tmp/edit2")
    ap.add_argument("--total", type=int, default=900, help="طول الفيلم بالإطارات (الماستر)")
    ap.add_argument("--card", type=int, default=108, help="إطارات البطاقة في الآخر")
    ap.add_argument("--target", type=float, default=24.0, help="ثوانٍ الصورة المستهدفة (تُلاءَم)")
    ap.add_argument("--fps", type=float, default=30.0)
    ap.add_argument("--min-span", type=float, default=2.4)
    ap.add_argument("--lead", type=int, default=76, help="إطارات المقدمة قبل الصورة")
    ap.add_argument("--max-per-src", type=int, default=2)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    pool = []
    for ci, src in enumerate(a.srcs):
        db, dur = envelope(src)
        sp = spans_of(db, min_speech=a.min_span)
        for (s0, s1) in sp:
            pool.append({"src": ci, "a": round(s0, 3), "b": round(s1, 3), "len": round(s1 - s0, 3),
                         "dur": round(dur, 2)})
        print(f"  {os.path.basename(src)}: {dur:.2f}s · جُمَلٌ مؤهّلة {len(sp)} · أرضية {np.percentile(db,12):.1f} dBFS")
    if not pool:
        print("✗ لم أجد جملةً واحدة تقطع عليها", file=sys.stderr)
        return 2

    # الاختيار: أطول الجُمَل أولاً، ولا تُقبَل جملةٌ تخرج بالمونتاج عن الهدف — فالحشو
    # ليس «خطأً» في ماسترٍ مُسلَّم، بل إطارات زائدة تُدفَع من عمر البطاقة. نلاءم
    # (best-fit) ثم نُعيد الترتيب الزمنيّ داخل كل مصدر حتى يبقى الكلام متصاعداً.
    # الميزانية: الصورة = الطول الكلّي − البطاقة − المقدمة. والمقدمة تُحسب من الباقي،
    # فلا يُصفَّق حشوٌ ولا يُترك فراغ.
    card_frames = a.card
    lead_frames = a.lead
    budget = float(a.total - card_frames - lead_frames) / a.fps
    # لا «الأطول» ولا «الأقصر»: النقطة الحلوة جملةٌ بين ثلاثٍ وستّ ثوانٍ — أقصرُ منها
    # يتقطّع الكلام، وأطولُ منها يترك الصورة واقفة بلا جديد. نرتّب بالقيمة لا بالمدة.
    def value(r):
        L = r["len"]
        return min(L, 5.2) - 1.2 * max(0.0, 3.0 - L)
    pool.sort(key=lambda r: -value(r))
    # تدويرٌ على المصادر: كلُّ مصدرٍ يأخذ دوره في الاختيار، فلا تبتلع أطولُ جملةٍ
    # الميزانيةَ وتخرج اللقطاتُ من زاويتين فقط. ثلاثُ زوايا في ثلاثين ثانية أرقى
    # من زاويتين، لأنَّ التنويعَ هنا هو «الإخراج» الذي يُشاهَد.
    by = {}
    for r in pool:
        by.setdefault(int(r["src"]), []).append(r)
    for k in by:
        by[k] = by[k][: 4]
    picked, left = [], budget
    for _ in range(4):
        progressed = False
        for src in sorted(by):
            for r in by[src]:
                if r in picked:
                    continue
                if r["len"] <= left + 0.15:
                    picked.append(r)
                    left -= r["len"]
                    progressed = True
                    break
            if left <= 0.15:
                break
        if left <= 0.15 or not progressed:
            break
    # ترتيبُ اللقطات: لا تلي لقطةٌ أختَها من المصدر نفسه — على كاميرا ثابتة تبدو
    # القطرة داخل الجملة «قفزة» تُفضح، فالفرز هنا للمصادر المتعاقبة لا للزمن.
    rest, seq = list(picked), []
    while rest:
        last = int(seq[-1]["src"]) if seq else -1
        nxt = next((r for r in rest if int(r["src"]) != last), None) or rest[0]
        rest.remove(nxt)
        seq.append(nxt)
    picked, total = seq, budget - left
    print(f"  ملاءمة: {total:.2f}s من {budget:.2f}s · {len(picked)} لقطة · "
          + " ← ".join(f"م{int(r['src'])+1}" for r in picked) + f" · الفاصل {max(0,left):.2f}s")

    segs, t = [], 0.0
    for r in picked:
        n = int(round(r["len"] * a.fps))                       # مدةٌ من أطُر كاملة، لا فاصلة عشرية
        st = int(round(r["a"] * a.fps))
        segs.append({"src": int(r["src"]), "src_a": round(st / a.fps, 3), "frames": n,
                     "cut_a": round(t, 3), "cut_b": round(t + n / a.fps, 3),
                     "speech": [], "nuclei": []})
        t += n / a.fps
    # إعادة تعيين جُمَل المصدر وأنويّته إلى زمن المونتاج
    for si, seg in enumerate(segs):
        db, _ = envelope(a.srcs[seg["src"]])
        for (s0, s1) in spans_of(db, min_speech=0.45):
            if s1 <= seg["src_a"] - 0.05 or s0 >= seg["src_a"] + seg["frames"] / a.fps + 0.05:
                continue
            off = seg["cut_a"] + (max(s0, seg["src_a"]) - seg["src_a"])
            end = seg["cut_a"] + (min(s1, seg["src_a"] + seg["frames"] / a.fps) - seg["src_a"])
            seg["speech"].append([round(off, 3), round(end, 3)])
            seg["nuclei"] += [round(seg["cut_a"] + (p - seg["src_a"]), 3)
                              for p in nuclei_in(db, max(s0, seg["src_a"]), min(s1, seg["src_a"] + seg["frames"] / a.fps))
                              if seg["cut_a"] - 0.01 <= seg["cut_a"] + (p - seg["src_a"]) <= seg["cut_b"] + 0.01]
        seg["nuclei"].sort()

    listf = os.path.join(a.out, "list.txt")
    with open(listf, "w") as fh:
        for i, seg in enumerate(segs, 1):
            d = seg["frames"] / a.fps
            dst = os.path.join(a.out, f"seg{i}.mp4")
            cmd = [FF, "-v", "error", "-y", "-ss", str(seg["src_a"]), "-i", a.srcs[seg["src"]],
                   "-t", f"{d:.6f}", "-frames:v", str(seg["frames"]), "-shortest",
                   "-vf", "fps=30,scale=1080:1920:flags=lanczos,setsar=1",
                   "-c:v", "libx264", "-preset", "veryfast", "-crf", "14", "-pix_fmt", "yuv420p",
                   "-c:a", "aac", "-ar", "48000", "-ac", "1", "-b:a", "160k", dst]
            subprocess.run(cmd, check=True)
            fh.write(f"file '{dst}'\n")
            print(f"  seg{i}: مصدر{seg['src']+1} من {seg['src_a']:.2f}s · {seg['frames']} إطاراً "
                  f"({d:.2f}s) عند {seg['cut_a']:.2f}s · أنويّات {len(seg['nuclei'])}")
    cut = os.path.join(a.out, "cut.mp4")
    subprocess.run([FF, "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listf, "-c", "copy", cut],
                   check=True)
    pic_frames = sum(s["frames"] for s in segs)
    # المقدمة تبتلع الفاصل المتبقّي: الطول الكلّي = --total بالحرف، بلا إطارٍ ضائع
    lead_frames = max(a.lead, a.total - pic_frames - card_frames)
    tl = {"fps": a.fps, "picture_frames": pic_frames, "card_frames": card_frames,
          "lead_frames": lead_frames, "total_frames": pic_frames + card_frames + lead_frames,
          "seconds": round((pic_frames + card_frames + lead_frames) / a.fps, 3),
          "cut_frames": [int(round(s["cut_a"] * a.fps)) for s in segs][1:],
          "segments": segs, "sources": [os.path.basename(x) for x in a.srcs]}
    # غلافُ الطاقة من الملفّ المُجمَّع نفسه (12.5 عيّنة/ث): يرسُمه Remotion كموجةٍ
    # حقيقية من صوته، فتتحرّك الشريطُ مع كلِّ مقطع بدل زخرفةٍ ثابتة تُقلَّب.
    p2 = subprocess.run([FF, "-v", "error", "-i", cut, "-vn", "-ac", "1", "-ar", "8000",
                         "-f", "s16le", "-"], capture_output=True)
    y = np.frombuffer(p2.stdout, dtype="<i2").astype(np.float64) / 32768.0
    hop = 640
    env = [float(np.sqrt((y[i:i + hop] ** 2).mean())) for i in range(0, len(y) - 8, hop)]
    mx = max(env) or 1.0
    tl["envelope"] = [round(v / mx, 4) for v in env]
    tl["envelope_hz"] = 8000.0 / hop
    with open(os.path.join(a.out, "timeline.json"), "w", encoding="utf-8") as fh:
        json.dump(tl, fh, ensure_ascii=False, indent=1)
    os.makedirs("src/phone", exist_ok=True)
    with open("src/phone/timeline.json", "w", encoding="utf-8") as fh:
        json.dump(tl, fh, ensure_ascii=False, indent=1)
    print(f"  ✔ {cut} · {pic_frames} إطار صورة + {card_frames} بطاقة = {tl['seconds']}s")
    print(f"  ✔ src/phone/timeline.json (مواضع القطع + جُمَل الكلام + الأنويّات)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
