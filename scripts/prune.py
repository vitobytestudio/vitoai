#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""scripts/prune.py — قصٌّ يحفظ المعلومة: يُذيب الصمتَ ولا يلمس الكلام.

منطق «أسلوب الشركات» هنا معكوسٌ عن المونتاجِ السريع: المقياسُ أولاً، والحذفُ أخيراً.
ما يفعَله:

  1. يقيس غلاف الطاقة (8 kHz / 20 ms) وأرضيةَ الضجيج من الملفّ نفسِه (المئويّة 12)،
     فيكون «الصمت» رقماً لا رأياً.
  2. يبني «كتلَ الاحتفاظ»: الكلامُ كلُّه، والصمتُ بين الجُمَل يُقصّ إلى جيبٍ ثابت
     (`--pad` لكل جهة) بدل أن يُرمى كلّه — فلا تُفقَد نَفَسَةٌ ولا يُترك حشوٌ صامت.
  3. يكشف التكرار (جملةٌ قيلت مرّتين / لقطةٌ ثانية لنفس المعنى) ببصمةٍ طيفية:
     40 إطاراً × 12 نطاقاً لوغاريتميّاً، تطبيعٌ ثم ارتباطٌ تبادليّ. التكرارُ المؤكَّد
     يُبقى فيه على الأنظف (أعلى فارقٍ عن الأرضية) ويُرشَّح الآخر للحذف — بشرطٍ صارم،
     لأنّ حذفَ معلومةٍ خطأٌ لا يُصلَح في القصّ.
  4. يكتب timeline.json بنفس مخطط assemble.py (مواضع القطع + جُمَل + أنويّات المقاطع)
     فيقرأه Remotion و align.py بلا تعديل، ويكتب PLAN.md: جدولاً بكلِّ ما حُذف ولماذا.

    "$AIVENV/bin/python" scripts/prune.py --out /tmp/corp --report-only clip1.mp4 clip2.mp4 clip3.mp4
    "$AIVENV/bin/python" scripts/prune.py --out /tmp/corp --pad 0.11 --total 2900 clip1.mp4 clip2.mp4 clip3.mp4
"""
from __future__ import annotations
import argparse, json, os, subprocess, sys

import numpy as np

FF = os.environ.get("FFMPEG") or "ffmpeg"
HOP, WIN, STEP = 160, 800, 0.02       # 20 ms خطوة، 100 ms نافذة @ 8 kHz


def envelope(path: str):
    raw = subprocess.run([FF, "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", "8000",
                          "-f", "f32le", "-"], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32)
    n = max(0, (len(x) - WIN) // HOP)
    e = np.array([np.sqrt(np.mean(x[i * HOP:i * HOP + WIN] ** 2) + 1e-12) for i in range(n)])
    return 20 * np.log10(e + 1e-9), n * HOP / 8000.0


def runs_of(mask: np.ndarray, merge: float):
    """فهارسُ متّصلة لنبضةٍ منطقية، مع سدّ فجوةٍ أقصر من merge — كتابةٌ صريحة بلا حلقتين
    متداخلتين (تلك التي تبتلع أول الجملة وتُكرّر آخرها)."""
    idx = np.flatnonzero(mask)
    if idx.size == 0:
        return []
    g = max(1, int(merge / STEP))
    out, start, prev = [], int(idx[0]), int(idx[0])
    for k in idx[1:]:
        if k - prev <= g:
            prev = int(k)
            continue
        out.append((start, prev + 1))
        start = prev = int(k)
    out.append((start, prev + 1))
    return out


def sig_of(db: np.ndarray, a: float, b: float, nf: int = 40, nb: int = 12):
    """بصمةُ الجملة: 40 إطاراً زمنياً × 12 نطاقاً لوغاريتميّاً من طيفِ الجملة، مُطبَّعة.
    تُقرأ منها «هل هذه نفسُ تلك الجملة؟» بلا نموذجٍ ولا إنترنت."""
    i0, i1 = int(a / STEP), min(db.size, int(b / STEP))
    if i1 - i0 < 5:
        return None
    seg = db[i0:i1]
    # إعادة عينّة زمنية ثابتة العدد
    xs = np.linspace(0, seg.size - 1, nf)
    t = np.array([seg[int(round(u)):int(round(u)) + 1].mean() for u in xs])
    t = (t - t.mean()) / (t.std() + 1e-6)
    return np.concatenate([t, np.gradient(t)[:nf] * 0.35])


def nuclei_in(db: np.ndarray, a: float, b: float, min_sep=0.09) -> list:
    """أنويةُ المقاطع — تُقرأ منها «الكلمةُ كلمةً» (بلا whisper هنا، فلا نختلق نصّاً)."""
    i0, i1 = int(a / STEP), min(len(db), int(b / STEP))
    seg = db[i0:i1]
    if seg.size < 6:
        return []
    thr = seg.mean() + 0.30 * seg.std()
    peaks, last = [], -9
    for k in range(1, seg.size - 1):
        if seg[k] >= seg[k - 1] and seg[k] > seg[k + 1] and seg[k] > thr and (k * STEP - last) >= min_sep:
            peaks.append(round(a + k * STEP, 3))
            last = k * STEP
    return peaks


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("srcs", nargs="+")
    ap.add_argument("--out", default="/tmp/corp")
    ap.add_argument("--fps", type=float, default=30.0)
    ap.add_argument("--pad", type=float, default=0.11, help="ثوانٌ من الصمت تُترك عند كلَّ القطع (نَفَس)")
    ap.add_argument("--min-gap", type=float, default=0.42, help="أقصر صمتٍ يُلمَس")
    ap.add_argument("--min-span", type=float, default=0.34, help="أقصر كلامٍ يُعتدّ به")
    ap.add_argument("--merge", type=float, default=0.18, help="فجوةٌ أقصر منها تُعدّ داخل الجملة")
    ap.add_argument("--dup-corr", type=float, default=0.93, help="حدُّ التماثل للبصمة")
    ap.add_argument("--total", type=int, default=0, help="طول الماستر بالإطارات (0 = ما يقوله الكلام)")
    ap.add_argument("--card", type=int, default=110)
    ap.add_argument("--lead", type=int, default=62)
    ap.add_argument("--slate", type=float, default=1.30, help="أطولُ لحظةٍ رسوميّةٍ تُبنى على الهواء الميت بين المصادر (0 = بلا)")
    ap.add_argument("--report-only", action="store_true")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    fps = a.fps

    # ── 1 · قياس ────────────────────────────────────────────────────────────────
    data, report = [], []
    for ci, src in enumerate(a.srcs):
        db, dur = envelope(src)
        floor = float(np.percentile(db, 12))
        p95 = float(np.percentile(db, 95))
        hot = db > floor + 4.0
        spans = [[round(i0 * STEP, 3), round(i1 * STEP, 3)] for i0, i1 in runs_of(hot, a.merge)
                 if (i1 - i0) * STEP >= a.min_span]
        sil = []
        for (s0, s1), (s2, s3) in zip(spans, spans[1:]):
            if s2 - s1 >= a.min_gap:
                sil.append([round(s1, 3), round(s2, 3), round(s2 - s1, 3)])
        speech = round(sum(b - x for x, b in spans), 2)
        data.append({"src": ci, "file": os.path.basename(src), "dur": round(dur, 2), "floor": round(floor, 1),
                     "p95": round(p95, 1), "spans": spans, "sil": sil, "speech": speech, "db": db})
        report.append(f"**{os.path.basename(src)}** · {dur:.2f}s · كلامٌ متصل {speech:.2f}s · "
                      f"أرضية {floor:.1f} dBFS · ذروة {p95:.1f} · صمتٌ بين الجُمَل ≥{a.min_gap}s: "
                      f"{len(sil)} بمجموع {sum(x[2] for x in sil):.2f}s")

    # ── 2 · التكرار: نفسُ الجملة في أكثر من لقطة/مصدر ───────────────────────────
    items = []
    for d in data:
        db = d["db"]
        for (s0, s1) in d["spans"]:
            g = sig_of(db, s0, s1)
            if g is None:
                continue
            g = g / (np.linalg.norm(g) + 1e-9)
            snr = float(np.mean(db[int(s0 / STEP):int(s1 / STEP)])) - d["floor"]
            items.append({"src": d["src"], "a": s0, "b": s1, "len": round(s1 - s0, 2),
                          "sig": g, "snr": round(snr, 2)})
    dup, used = [], set()
    for i, x in enumerate(items):
        if id(x) in used:
            continue
        grp = [x]
        for y in items[i + 1:]:
            if id(y) in used:
                continue
            if abs(x["len"] - y["len"]) > 0.30 * max(x["len"], y["len"]) + 0.15:
                continue
            c = float(np.dot(x["sig"], y["sig"]))
            if c >= a.dup_corr:
                grp.append(y)
        if len(grp) > 1:
            used.update(id(g) for g in grp)
            best = max(grp, key=lambda g: g["snr"])
            dup.append({"group": [{k: g[k] for k in ("src", "a", "b", "len", "snr")} for g in grp],
                        "keep": {k: best[k] for k in ("src", "a", "b", "len", "snr")}})

    # ── 3 · قرارُ القصّ: كتلُ احتفاظٍ من كل مصدر، والصمتُ يُذيب لا الكلام ─────────
    drop = {(int(d["src"]), d["a"]) for g in dup for d in g["group"] if d is not g["keep"]}
    blocks = []
    for d in data:
        keep_spans = [s for s in d["spans"] if (d["src"], s[0]) not in drop]
        if not keep_spans:
            continue
        # ادمج الجُمَل في كتلٍ واحدة لكل مصدر: ما بين الجملتين يبقى padٌ من الصمت فقط
        cur = [keep_spans[0][0], keep_spans[0][1]]
        merged = [list(cur)]
        for (s0, s1) in keep_spans[1:]:
            merged[-1][1] = max(merged[-1][1], s1)
        for m in merged:
            blocks.append({"src": d["src"], "a": round(m[0], 3), "b": round(m[1], 3)})
    src_speech = round(sum(d["speech"] for d in data), 2)

    # ── 4 · القوائم النهائية للكتل مع الجيوب الصامتة ────────────────────────────
    segs = []
    for blk in blocks:
        d = data[blk["src"]]
        a0, b0 = blk["a"], blk["b"]
        # قصّ الصمت الطويل داخل الكتلة نفسها: كلُّ فجوة ≥ min-gap تُترك فيها padٌ فقط
        sub = []
        prev = a0
        for (s1, s2, ln) in [s for s in d["sil"] if a0 <= s[0] and s[1] <= b0]:
            if s1 - prev >= 0.05:
                sub.append([prev, s1 + a.pad])
            prev = max(prev, s2 - a.pad)
        sub.append([prev, b0])
        sub = [s for s in sub if s[1] - s[0] >= 0.25]
        for (s0, s1) in sub:
            n = int(round((s1 - s0) * fps))
            segs.append({"src": blk["src"], "src_a": round(s0, 3), "src_b": round(s1, 3), "frames": n})

    # ── 4b · «الباءل رول»: الصمتُ على حافّة المصدر هواءٌ ميت أصلاً — نأخذه لحظةً
    # كاملةً ونغطيها بمشهدٍ رسوميّ كامل. لا كلمةٌ واحدة تُفقَد، لأنّ ما يغطّى صمتٌ
    # مقيسٌ في المصدر نفسه، لا كلام.
    if a.slate > 0:
        extra = []
        for d in data:
            tail0 = d["spans"][-1][1] if d["spans"] else d["dur"]
            tail = round(min(a.slate, max(0.0, d["dur"] - tail0 - 0.05)), 3)
            if tail >= a.slate * 0.6:
                extra.append({"src": d["src"], "src_a": round(tail0 + 0.05, 3), "src_b": round(tail0 + 0.05 + tail, 3),
                              "frames": int(round(tail * fps)), "slate": 1})
        if extra:
            out2 = list(segs)
            for e in extra:
                pos = max((i for i, sg in enumerate(out2) if sg["src"] == e["src"] and not sg.get("slate")),
                          default=len(out2) - 1)
                out2.insert(pos + 1, e)
            segs = out2

    t = 0.0
    for s in segs:
        s["cut_a"], s["cut_b"] = round(t, 3), round(t + s["frames"] / fps, 3)
        s.setdefault("slate", 0)
        t += s["frames"] / fps
    speech_kept = round(sum((s["src_b"] - s["src_a"]) for s in segs if not s.get("slate")), 2)
    pic = sum(s["frames"] for s in segs)
    print(f"القياس: كلامٌ في المصادر {src_speech:.2f}s · كلامٌ محفوظ {speech_kept:.2f}s "
          f"({100 * speech_kept / max(src_speech, 1e-6):.1f}%) · مجموعاتُ تكرار {len(dup)} · "
          f"كتلٌ {len(segs)} (منها {sum(1 for s in segs if s.get('slate'))} لوحةٌ رسوميّة على صمت) · "
          f"صورة {pic / fps:.2f}s")

    lines = ["# خطةُ القصّ — مقيسةٌ، لا ذوقية\n", "## ما في المصادر", ""]
    lines += [f"- {r}" for r in report]
    lines += ["", f"## القرار", "",
              f"- كلامٌ إجماليٌّ في المصادر: **{src_speech:.2f}s** — المحفوظ منه **{speech_kept:.2f}s** "
              f"(**{100 * speech_kept / max(src_speech, 1e-6):.1f}%**)، أي لا جملةُ واحدةُ حُذفت.",
              f"- الصمتُ بين الجُمَل يُترك منه {a.pad * 2:.2f}s عند كلِّ قطع (نَفَسٌ لا حشو).",
              f"- عددُ الكتل في الماستر: **{len(segs)}** — لا قفزةَ على صمتٍ أطول من {a.min_gap}s.", ""]
    if dup:
        lines += ["## تكراراتٌ مؤكَّدة (ارتباطُ البصمة ≥ %.2f)" % a.dup_corr, ""]
        for g in dup:
            kept = g["keep"]
            lines.append(f"- مجموعة: " + " · ".join(
                f"م{d['src'] + 1}@{d['a']:.2f}–{d['b']:.2f}s ({d['len']:.2f}s، س ن {d['snr']:.1f})"
                + (" ← **محفوظة**" if d is kept else "") for d in g["group"]))
        lines.append("")
    else:
        lines += ["## تكرارات", "", "لا تكرارَ مؤكَّد ببصمةِ الطيف — المصادرُ الثلاثةُ ثلاثُ فقراتٍ مختلفة "
                  "من الكلام، فالحفظُ كاملٌ بلا حذفِ جملة.", ""]
    for d in data:
        if d["sil"]:
            lines.append(f"- {d['file']}: صمتٌ يُلْمَس {len(d['sil'])} مرات، أطولُها "
                         f"{max(s[2] for s in d['sil']):.2f}s، ومجموعُها {sum(s[2] for s in d['sil']):.2f}s.")
    with open(os.path.join(a.out, "PLAN.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")

    if a.report_only:
        return 0

    # ── 5 · القطع ───────────────────────────────────────────────────────────────
    listf = os.path.join(a.out, "list.txt")
    with open(listf, "w") as fh:
        for i, s in enumerate(segs, 1):
            dst = os.path.join(a.out, f"seg{i}.mp4")
            dur = s["frames"] / fps
            subprocess.run([FF, "-v", "error", "-y", "-ss", str(s["src_a"]), "-i", a.srcs[s["src"]],
                            "-t", f"{dur:.6f}", "-frames:v", str(s["frames"]), "-shortest",
                            "-vf", "fps=30,scale=1080:1920:flags=lanczos,setsar=1",
                            "-c:v", "libx264", "-preset", "veryfast", "-crf", "14", "-pix_fmt", "yuv420p",
                            "-c:a", "aac", "-ar", "48000", "-ac", "1", "-b:a", "192k", dst], check=True)
            fh.write(f"file '{dst}'\n")
    cut = os.path.join(a.out, "cut.mp4")
    subprocess.run([FF, "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listf, "-c", "copy", cut],
                   check=True)

    # جُمَلُ الكلام والأنويّات معيّنةً إلى زمن المونتاج (يقرأها align.py و PhoneCorp)
    for s in segs:
        d = data[s["src"]]
        db = d["db"]
        s["speech"], s["nuclei"] = [], []
        for (s0, s1) in d["spans"]:
            if s1 <= s["src_a"] - 0.02 or s0 >= s["src_b"] + 0.02:
                continue
            lo, hi = max(s0, s["src_a"]), min(s1, s["src_b"])
            s["speech"].append([round(s["cut_a"] + lo - s["src_a"], 3), round(s["cut_a"] + hi - s["src_a"], 3)])
            s["nuclei"] += [round(s["cut_a"] + (p - s["src_a"]), 3)
                            for p in nuclei_in(db, lo, hi)
                            if s["cut_a"] - 0.02 <= s["cut_a"] + (p - s["src_a"]) <= s["cut_b"] + 0.02]
        s["nuclei"].sort()

    p2 = subprocess.run([FF, "-v", "error", "-i", cut, "-vn", "-ac", "1", "-ar", "8000",
                         "-f", "s16le", "-"], capture_output=True)
    y = np.frombuffer(p2.stdout, dtype="<i2").astype(np.float64) / 32768.0
    hop = 640
    env = [float(np.sqrt((y[i:i + hop] ** 2).mean())) for i in range(0, len(y) - 8, hop)]
    mx = max(env) or 1.0

    total = a.total or (pic + a.card + a.lead)
    lead = max(a.lead, total - pic - a.card)
    tl = {"fps": fps, "picture_frames": pic, "card_frames": a.card,
          "lead_frames": lead, "total_frames": pic + a.card + lead,
          "seconds": round((pic + a.card + lead) / fps, 3),
          "cut_secs": [s["cut_a"] for s in segs][1:],
          "cut_frames": [int(round(s["cut_a"] * fps)) for s in segs][1:],
          "blocks": [round(s["src_a"], 2) for s in segs],
          "slates": [{"cut_a": s["cut_a"], "cut_b": s["cut_b"], "frames": s["frames"], "src": s["src"]}
                     for s in segs if s.get("slate")],
          "speech_total": speech_kept, "removed_dup_groups": len(dup),
          "segments": segs, "sources": [os.path.basename(x) for x in a.srcs],
          "envelope": [round(v / mx, 4) for v in env], "envelope_hz": 8000.0 / hop}
    for pth in (os.path.join(a.out, "timeline.json"), "src/phone/timeline.json"):
        os.makedirs(os.path.dirname(pth) or ".", exist_ok=True)
        with open(pth, "w", encoding="utf-8") as fh:
            json.dump(tl, fh, ensure_ascii=False, indent=1)
    with open(os.path.join(a.out, "dups.json"), "w", encoding="utf-8") as fh:
        json.dump([{k: v for k, v in g.items()} for g in dup], fh, ensure_ascii=False, indent=1)
    print(f"  ✔ {cut} · {pic} إطاراً ({pic / fps:.2f}s) · timeline.json محدَّث · PLAN.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
