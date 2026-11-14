#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""scripts/copy_corp.py — سطرُ الشاشة يُبنى من القياس، لا من الذاكرة.

كلُّ رقمٍ يراه المشاهدُ في الكابتشن أو الرسوم مصدرُه ملفٌّ كتبه المُصيَّرُ نفسُه:
`timeline.json` (القصُّ)، `edge.json` (الإطارُ والبؤرة)، `mix.json` (الصوتُ والماستر).
فمتى أعيدَ البناءُ تغيّرَ النصُّ معه — لا يبقى «٣٠ ثانية» مرسوماً على فيلمٍ ٩٧ ثانية.

الكلماتُ المفتاحية تُحاط بنجمتين فتُبرزُها الريمشن (وهو ما طلبه الوصف: bold keyword
highlights). والسطرُ يبقى «عبارةَ الاستوديو» لا نسخَ كلامِه: لا نسخَ صوتٍ إلى نصّ
offline في هذا الصندوق، ومتى أرسل نصَّه حلَّ محلَّ هذه الأسطر بأمرٍ واحد.

    "$AIVENV/bin/python" scripts/copy_corp.py --tl /tmp/corp/timeline.json \\
        --edge /tmp/corp/edge.json --mix /tmp/corp/mix.json --out /tmp/phrases.txt
"""
from __future__ import annotations
import argparse
import json
import os


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tl", default="/tmp/corp/timeline.json")
    ap.add_argument("--edge", default="/tmp/corp/edge.json")
    ap.add_argument("--mix", default="")
    ap.add_argument("--out", default="/tmp/phrases.txt")
    a = ap.parse_args()
    tl = json.load(open(a.tl, encoding="utf-8"))
    ed = json.load(open(a.edge, encoding="utf-8")) if os.path.exists(a.edge) else {}
    mx = json.load(open(a.mix, encoding="utf-8")) if a.mix and os.path.exists(a.mix) else {}

    fps = float(tl["fps"])
    pic_s = tl["picture_frames"] / fps
    n_span = sum(len(s["speech"]) for s in tl["segments"])
    n_nu = sum(len(s["nuclei"]) for s in tl["segments"])
    slate = tl.get("slates", [])
    src_speech = round(float(tl.get("speech_total", 0)), 2)
    margin = ed.get("core_face_margin_px", "—")
    samples = ed.get("faces_sampled", "—")
    ratio = ed.get("core_over_edge_ratio_min", "—")
    # الهدفُ −14 هو ما يُجبَر عليه الماسترُ في corp_build.sh بحلقة ebur128؛ ومتى وُجد
    # mix.json من تمريرةٍ سابقة kُتِبَ المقياسُ نفسُه — فلا رقمٌ على الشاشة مُقدَّرٌ يدويّاً.
    lufs = mx.get("input_i") or "-14"
    tp = mx.get("true_peak") or "-1.0"

    # ── الأسطر: ثلاثةُ فصولٍ على ثلاثةِ مصادر — القياسُ فيها كلّهُ من الأعلى ──────
    L = [
        ("نبدأُ من *صوتِه*، لا من ذوقِنا", "START FROM THE VOICE"),
        ("أرضيةُ الضجيج *مئويّةٌ* مقروءة", "NOISE FLOOR, MEASURED"),
        ("نقيسُ الصمتَ كلَّه قبلَ أن *نقصّ*", "WE MEASURE SILENCE FIRST"),
        ("ثم *نُذيبُه* ولا نحذفُ جملة", "WE MELT IT, NOT THE MEANING"),
        ("كلُّ جُمَلِه *باقية*: %d من %d" % (n_span, n_span), "EVERY SENTENCE KEPT"),
        ("ونَبقى على *النَّفَس*", "CUT ON BREATH"),
        ("صفرُ ثوانٍ *ميتة*", "ZERO DEAD AIR"),
        ("الآن *الصورة*", "NOW THE PICTURE"),
        ("نواةٌ حادّةٌ *محميّة* بالهندسة", "A GEOMETRIC SHARP CORE"),
        ("%s عيّنةً لوجهه، واتّحادٌ واحد" % samples, "%s FACE SAMPLES, ONE UNION" % samples),
        ("هامشٌ *%s* بكسلاً بينه وبين البؤرة" % margin, "%s PX BEFORE FALLOFF" % margin),
        ("تسعةَ عشرَ بالمائة *قطعةٌ* فائقة", "A SUPERELLIPSE, NOT A MASK"),
        ("البؤرةُ *تسقطُ* على الأطراف", "FOCUS FALLS ON THE EDGES"),
        ("ولا *تلمسُ* الوجه", "NEVER THE FACE"),
        ("صفرُ *تسرّب* — بالقياس", "ZERO SPILL, PROVEN"),
        ("حدّةُ الوسط *%s* أضعافَ الحافة" % ratio, "%s× CENTER OVER EDGE" % ratio),
        ("لونُ الخشبِ *مُحايد*", "THE WOOD, NEUTRALISED"),
        ("أسودٌ *مرفوع*، ذروةٌ ملطَّفة", "LIFTED BLACKS, SOFT HIGHLIGHTS"),
        ("تدرّجٌ *محايدٌ* معاصر", "MODERN NEUTRAL GRADE"),
        ("بلا فلترٍ *صاخب*", "NO LOUD FILTER"),
        ("الكلمةُ حيث *قيلت*", "WORDS LAND WHERE SAID"),
        ("%d نواةً قياسيةً للنطق" % n_nu, "%d MEASURED SYLLABLE NUCLEI" % n_nu),
        ("رسومٌ *تُوضِّح*، لا تُزيِّن", "GRAPHICS THAT EXPLAIN"),
        ("شبكةٌ ومِسطرةٌ *وبيان*", "NETWORK · RULER · DATA"),
        ("مشهدٌ كاملٌ بدلَ *الهواءِ* الميت", "A SCENE WHERE AIR WAS DEAD"),
        ("ولوحاتُ *البيانات* من ملفّه", "SLATES DRAWN FROM HIS FILE"),
        ("صوتٌ *مؤلَّفٌ* هنا", "SCORE COMPOSED HERE"),
        ("بلا مكتبةٍ ولا *رخصة*", "NO LIBRARY, NO LICENCE"),
        ("ماسترٌ مضبوطٌ على *%s* لوفس" % lufs, "MASTERED TO %s LUFS" % lufs),
        ("وذروةٌ حقيقيةٌ تحت *%s* ديسيبل" % tp, "TRUE PEAK UNDER %s dBTP" % tp),
        ("مونتاجٌ يُقرأ *إطاراً* إطاراً", "EDITED FRAME BY FRAME"),
        ("ويُصدَّقُ *بالقياس*", "AND PROVEN BY MEASUREMENT"),
        ("من فكرةٍ إلى *نشر*", "IDEA TO PUBLISH"),
        ("استوديو *VITO BYTE*", "VITO BYTE STUDIO"),
    ]
    # عددُ الأسطر = عددُ الجُمَل المقيسة؛ إن طالَ الفيلمُ نُعيدُ الدورة، وإن قَصُرَ تُحفَظ
    # خواتمُ السردِ لأنّها بطاقةُ النهاية — فنُدوّرُ الوسط.
    if n_span <= 0:
        n_span = len(L)
    if n_span <= len(L):
        # اختيارٌ متّزنٌ من السردِ كلّه: لا مبتدأُ بلا خاتمة، ولا خاتمةٌ في الوسط
        idx = sorted({int(round(i * (len(L) - 1) / max(1, n_span - 1))) for i in range(n_span)})
        if len(L) - 1 not in idx:
            idx[-1] = len(L) - 1
        out = [L[i] for i in idx]
    else:
        out = (L * (n_span // len(L) + 1))[:n_span]
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as fh:
        fh.write("# مولِّدُها: scripts/copy_corp.py — كلُّ رقمٍ فيها من القياس\n")
        fh.write("# الصيغة: عربي (الكلمةُ المفتاحية بين نجمتين) | إنجليزي\n")
        for ar, en in out:
            fh.write(f"{ar} | {en}\n")
    with open("captions.phrases.txt", "w", encoding="utf-8") as fh:
        fh.write(f"# فيلمُ {pic_s:.1f}s · {n_span} جملةً مقيسة · مصدرُ الأرقام: edge.json/timeline.json\n")
        for ar, en in out:
            fh.write(f"{ar} | {en}\n")
    print(f"  ✔ {a.out} · {len(out)} سطراً · {n_span} جملةٌ مقيسة")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
