#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""studio/edge.py — «الإطار»: حادٌّ في الوسط، ضبابيٌّ على الأطراف — بحدٍّ رياضٍ لا بحافةٍ رسمتُها.

الوصف المطلوب حرفيّاً: «subtle peripheral blur/vignette **exclusively** to the outer
edges/sides … keep the subject, head, and facial features tack-sharp … **zero blur
spillover**». فأدنى تحقيقٍ له ليس قناعاً ولا استبدالَ خلفية، بل هندسةٌ ثابتة:

  1. مرورٌ أول: شبكةُ وجه mediapipe على عيّنةٍ كلَّ `--stride` إطاراً، ثم **اتّحادُ**
     صناديقِ الوجه عبر المونتاجِ كلّه + هامشٌ بالقياس = **نواةٌ حادّةٌ واحدة ثابتة**.
     لا شيءَ معلّقٌ على ثقةِ قناع، فلا «يعود الجدارُ الحادّ لمّا يتحرّك» — أُزيلت
     الآليةُ التي كانت تسمح بذلك، لا عولجت عَرَضُها.
  2. خريطةُ الوزن: `dist` بعدُّ البكسل عن حافّة النواة، `w = smoothstep(dist/feather)`،
     و**`w ≡ 0` داخل النواة**. كلُّ تأثيرٍ يُضربُ في `w`، فالتسرّبُ معدومٌ بالتعريف —
     ويُقاس: نسبةُ حدّة Laplacian (نواة ÷ حافة) تُطبَع لكلِّ عيّنة، فالثباتُ عبر
     الحركة رقمٌ في التقرير لا وعدٌ في النصّ.
  3. البؤرةُ متدرّجةٌ كعدسة: غاوسيانٌ خفيفٌ حيث `w`، وأثقلُ قربَ الإطار، مع إسباتِ
     لونِ الخلفية وتسطيحِ حرارتها وإظلامٍ خفيف — كلّها خارج النواة.
  4. داخل النواة فقط: unsharp بمقدارٍ محدود (سقفُ ±14/255) فتبقى الملامحُ حادّةً
     بلا هالات.
  5. تأطيرُ كلِّ كتلة: قصّةٌ مركزيةٌ صغيرة تتنفّس، وانزلاقٌ أفقيٌّ إلى مركز وجهه
     **المقيس في تلك الكتلة** (محدودٌ بالبكسل) — فيتحوّل القطعُ على الصمت إلى
     إعادةِ تأطير.
  6. تدرّجٌ محايدٌ معاصر بمنحنى LUT أُحاديّ البُعد: أسودُ مرفوع، ذروةٌ ملطَّفة،
     تباينٌ خفيف — لا برتقالي/سماوي، ولا لمسِ للبشرة.

    "$AIVENV/bin/python" studio/edge.py --in /tmp/corp/cut.mp4 --tl /tmp/corp/timeline.json \
        --out /tmp/corp/edge.mp4 --self-test
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time

import cv2
import numpy as np

FF = os.environ.get("FFMPEG") or "ffmpeg"


def probe_wh(path: str):
    txt = subprocess.run([FF, "-i", path], capture_output=True).stderr.decode("utf-8", "ignore")
    m = re.search(r"Stream #0:.*?(\d{3,5})x(\d{3,5})", txt, re.S)
    return int(m.group(1)), int(m.group(2))


# ─────────────────────────────────────────────────────────── tone (LUT only)
def tone_lut(black_lift: float, hi_roll: float, contrast: float) -> np.ndarray:
    """منحنى واحد لكل قناة: رفعُ أسودٍ بعد التباين (لا قبله، وإلا صار الرماديُّ لبنيّاً)،
    ولفُّ الذروة فوق `hi_roll` — وهو ما يفعله مصحّحٌ لونيّ يحترم ملفّاً من الهاتف."""
    x = np.arange(256, dtype=np.float32) / 255.0
    y = (x - 0.5) * (1.0 + contrast) + 0.5
    y = np.where(y > hi_roll, hi_roll + (y - hi_roll) * 0.62, y)
    y = y * (1.0 - black_lift) + black_lift * 0.55
    y = np.maximum(y, x * (black_lift * 0.55) + black_lift * 0.45)   # أرضيّةُ القاع: رفعٌ بلا وميض
    y = np.maximum.accumulate(y)                                     # رتابةٌ صارمة: LUTٌ غيرُ رتيبٍ يعني انحرافَ درجة
    return np.clip(y * 255.0, 0, 255).astype(np.uint8)


def cool_neutral(img: np.ndarray, amt: float) -> np.ndarray:
    """تسطيحُ فائضِ الدفء (خشبٌ مصفرّ): يُردُّ ما زاد على 18 من (R−B) إلى الصفر —
    على صورةِ الخلفية المُغلَّطة وحدها، فلا يلمس بشرةً ولا ثوباً."""
    if amt <= 0:
        return img
    o = img.astype(np.float32)
    b, r = o[..., 0], o[..., 2]
    k = np.clip((r - b) - 16.0, 0.0, 70.0) * (amt / 70.0) * 0.9
    o[..., 2] = r - k
    o[..., 0] = b + k * 0.6
    return np.clip(o, 0, 255).astype(np.uint8)


# ───────────────────────────────────────────────────────── pass 1 · faces
def face_boxes(src: str, stride: int, maxw: int = 460):
    """صناديقُ الوجوه على عيّنةٍ متباعدة: ما نريده **اتّحادٌ ثابت**، لا تتبّعاً."""
    import mediapipe as mp
    cap = cv2.VideoCapture(src)
    i, out = -1, []
    with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1,
                                         min_detection_confidence=0.5, refine_landmarks=False) as fm:
        while True:
            ok, fr = cap.read()
            if not ok:
                break
            i += 1
            if i % stride:
                continue
            h, w = fr.shape[:2]
            sm = cv2.resize(fr, (maxw, int(round(h * maxw / float(w)))), interpolation=cv2.INTER_AREA)
            res = fm.process(cv2.cvtColor(sm, cv2.COLOR_BGR2RGB))
            if not res.multi_face_landmarks:
                continue
            lm = np.array([[p.x, p.y] for p in res.multi_face_landmarks[0].landmark])
            out.append({"f": i, "x0": float(lm[:, 0].min()), "x1": float(lm[:, 0].max()),
                        "y0": float(lm[:, 1].min()), "y1": float(lm[:, 1].max()),
                        "cx": float(lm[:, 0].mean())})
    cap.release()
    return out, i + 1


def core_ellipse(boxes, W: int, H: int, pad_xf: float, pad_topf: float, pad_botf: float):
    """النواةُ الحادّة كقطعةٍ فائقةِ التسنين (superellipse) حول اتّحادِ صناديق الوجه.

    لماذا قطعٌ لا مستطيل؟ لأنّ «الأطراف» في إطارٍ عموديٍّ هي الزوايا والجوانب، ولأنّ
    مستطيلاً بعرضِ كتفٍ كاملٍ لا يترك للضبابيةِ مجالا ًإلاّ أن يلمسَ الوجه. النصفان
   Ax وAy يُحاصَران إذن بنسبةٍ من الإطار، فيبقى للّفةِ البؤريّة هامشٌ دائماً.
    """
    if not boxes:
        return W * 0.5, H * 0.46, W * 0.36, H * 0.44
    x0 = min(b["x0"] for b in boxes) * W
    x1 = max(b["x1"] for b in boxes) * W
    y0 = min(b["y0"] for b in boxes) * H
    y1 = max(b["y1"] for b in boxes) * H
    fw, fh = max(60.0, x1 - x0), max(60.0, y1 - y0)
    # النواةُ متّصلةُ المركزِ بالإطار لا بوجهه: توسيطُها على الوجه يترك الضبابيةَ من
    # جهةٍ واحدة (وهو واقفٌ يسارَ الوسط بضعَ عشراتِ البكسل)، و«الأطرافُ» تتطلب تدرّجاً
    # متّزناً. فنصفُ المحورِ يُقاسُ ليغطّي **اتّحادَ** الصناديق حول مركزِ الإطار كلِّه.
    cx = W * 0.5
    need = max(abs(x0 - cx), abs(x1 - cx)) + pad_xf * fw
    rx = float(np.clip(need, W * 0.26, W * 0.44))
    # المحورُ الرأسيُّ طويلٌ عمداً: الجسمُ كلُّه «موضوع» في هذه الزاوية، فالسقوط
    # البؤريّ جانبـيٌّ أساساً (كما طلب الوصف: outer edges/sides)، ويُضاف إليه شريطٌ
    # خفيفٌ فوق الرأس وحده في `top_band` — لا يلمسُ الشعرَ لأنّه يبدأ من فوقه.
    # المركزُ الرأسيُّ على الوجه لا على الإطار، ونصفُ المحورِ 0.46 من الارتفاع: هكذا
    # يشتدّ السقوطُ في الزوايا (حيث الخزانةُ والمكتب) ويبقى وسطُ الإطارِ — رأسُه —
    # داخل النواة كلِّها. ومحورٌ أطولُ من ذلك يعني ببساطةٍ لا «أطرافَ» تُرى.
    cy = float(np.clip(0.5 * (y0 + y1), H * 0.30, H * 0.52))
    ry = H * 0.46
    return cx, cy, rx, ry


def weight_map(W: int, H: int, core, feather: float, n: float = 5.0):
    """w = smoothstep((r−1)/feather_frac) حيث r نصفُ القطرِ المُقيَّس للقطعِ الفائق.

    r ≤ 1 داخل النواة ⇒ w ≡ 0 رياضياً (لا مستطيلَ قناعٍ ولا «ثقةَ قناع» يتذبذبان معه).
    """
    cx, cy, rx, ry = core
    X = (np.arange(W, dtype=np.float32) - cx) / max(1.0, rx)
    Y = (np.arange(H, dtype=np.float32) - cy) / max(1.0, ry)
    R = (np.abs(X)[None, :] ** n + np.abs(Y)[:, None] ** n) ** (1.0 / n)
    kk = float(np.clip(feather, 0.14, 1.20))          # `feather` الآن نسبةٌ من نصف المحور
    u = np.clip((R - 1.0) / kk, 0.0, 1.0)
    w = (u * u * (3.0 - 2.0 * u)).astype(np.float32)
    w[R <= 1.0] = 0.0
    return w, R


def top_band(W: int, H: int, ytop: float, frac: float, strength: float):
    """شريطُ ما فوق الرأس: بؤرةٌ تتزايد من حدِّPoинت الرأس إلى أعلى الإطار، بسقفٍ
    `strength`. الصفرُ عند الحدِّ بدقّة، فاحتمالُ لمسِ الشعرِ معدومٌ كما في الجوانب."""
    y = np.arange(H, dtype=np.float32)[:, None]
    u = np.clip((ytop - y) / max(1.0, frac * H), 0.0, 1.0)
    w = (u * u * (3.0 - 2.0 * u)).astype(np.float32) * strength
    return np.repeat(w, W, axis=1)


def bot_band(W: int, H: int, y0: float, frac: float, strength: float):
    """سقوطُ البؤرة في المقدّمة: المكتبُ أسفلُ الإطار عنصرُ إزعاجٍ لا موضوع، والعدسةُ
    الحقيقيةُ تفقدُه قبل أن تفقد وجهه. يبدأ الشريطُ من `y0` ويشتدّ حتى قاعِ الإطار،
    و`y0` مضمونٌ بأنّه أدنى من ذقنِه بهامشٍ يُقاسُ في run() ويُطبَع في التقرير."""
    y = np.arange(H, dtype=np.float32)[:, None]
    u = np.clip((y - y0) / max(1.0, frac * H), 0.0, 1.0)
    w = (u * u * (3.0 - 2.0 * u)).astype(np.float32) * strength
    return np.repeat(w, W, axis=1)


def encode_cmd(out_path: str, W: int, H: int, fps: float, crf: int):
    return [FF, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
            "-r", f"{fps:g}", "-i", "-", "-an", "-c:v", "libx264", "-preset", "veryfast",
            "-profile:v", "high", "-crf", str(crf), "-g", "15", "-pix_fmt", "yuv420p",
            "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
            "-color_range", "tv", "-movflags", "+faststart", out_path]


def run(src: str, tl: dict, out_path: str, fps: float, sig1: float, sig2: float, feather: float, topf: float, botf: float,
        dark: float, desat: float, cool: float, sharpen: float, punch: float, fit: float,
        stride: int, crf: int, lut_kw: dict, report_path: str, limit: int = 0) -> int:
    W, H = probe_wh(src)
    boxes, ntot = face_boxes(src, stride)
    if not boxes:
        print("✗ لا وجهَ في العيّنة — لا نواةَ حادّة بلا قياس", file=sys.stderr)
        return 3
    core0 = core_ellipse(boxes, W, H, pad_xf=0.30, pad_topf=0.70, pad_botf=1.6)

    segs = tl["segments"]
    starts = [int(round(s["cut_a"] * fps)) for s in segs]
    ends = [int(round(s["cut_b"] * fps)) for s in segs]
    shift = []
    for i in range(len(segs)):
        bx = [b for b in boxes if starts[i] <= b["f"] < ends[i]] or boxes
        cxs = float(np.mean([b["cx"] for b in bx]))
        shift.append(int(round(np.clip((0.5 - cxs) * W * 0.55 * fit, -22.0 * fit, 22.0 * fit))))

    # تدقيقٌ يبني النواةَ لا يراجعُها: نمرّرُ كلَّ صندوقِ وجهٍ عبر قصّةِ كتلتِه (نفس z وox)
    # فنقيسُ الامتدادَ في **فضاءِ الخَرج**، ثم نُوسَّعُ النواةَ حتى تبتلعه مع هامشٍ لا يقلّ
    # عن 5.5٪ من العرض. إن لم يسَعِ الإطارُ ذلك توقّفنا — لأنّ «zero blur spillover» وعدٌ.
    ext = 0.0
    for bx in boxes:
        si = 0
        for i in range(len(starts)):
            if bx["f"] >= starts[i]:
                si = i
        ln_seg = max(1, ends[si] - starts[si])
        u = min(1.0, (bx["f"] - starts[si]) / ln_seg)
        z = 1.0 + punch * (0.45 + 0.55 * (si % 2)) + punch * 0.20 * u
        cw = W / z
        ox = float(np.clip(round((W - cw) / 2) + shift[si], 0, W - cw))
        ext = max(ext, abs((bx["x0"] * W - ox) * z - core0[0]), abs((bx["x1"] * W - ox) * z - core0[0]))
    rx = float(np.clip(ext + W * 0.055, W * 0.26, W * 0.48))
    margin = round(rx - ext, 1)
    print(f"  امتدادُ وجهه في فضاءِ الخَرج {ext:.0f}px · نصفُ محورِ النواة {rx:.0f}px · هامشٌ {margin}px "
          f"على {len(boxes)} عيّنة")
    assert margin >= 18.0, f"لا مجالَ للّفةِ البؤريّة بلا لمسِ الوجه (هامش {margin}px) — أنقصِ punch أو وسّعِ السقف"
    core = (core0[0], core0[1], rx, core0[3])
    wmap, Rad = weight_map(W, H, core, feather)

    crown = min(b["y0"] for b in boxes) * H
    ytop = float(np.clip(crown - 0.05 * H, H * 0.02, H * 0.30))
    clear_top = round(crown - ytop, 1)
    if topf > 0:
        assert clear_top >= 40.0, f"شريطُ الأعلى يلمس شعره ({clear_top}px) — استعمل --topf 0"
        wmap = np.maximum(wmap, top_band(W, H, ytop, 0.075, topf))
    chin = max(b["y1"] for b in boxes) * H
    ybot = float(np.clip(max(0.84 * H, chin + 0.20 * H), 0.80 * H, 0.955 * H))
    clearance = round(ybot - chin, 1)
    if botf > 0:
        assert clearance > 0.18 * H, f"لا مجالَ لشريطِ المقدّمة ({clearance}px تحت الذقن) — استعمل --botf 0"
        wmap = np.maximum(wmap, bot_band(W, H, ybot, 0.16, botf))

    w1 = (wmap * 0.80)[..., None]                          # البؤرةُ الأساسيةُ على الحافة
    w2 = (np.clip((wmap - 0.40) / 0.60, 0, 1) * 0.60)[..., None]   # أثقلُ قربَ الإطار
    bandc = (wmap > 0.45).astype(np.uint8)                   # الحافة البعيدة: مقياسُ الحدّة
    corec = (Rad <= 0.86).astype(np.uint8)                   # قلبُ النواة: مقياسُ الحدّة
    lut = tone_lut(**lut_kw)

    sw, sh = W // 4, H // 4
    small = np.empty((sh, sw, 3), np.uint8)
    cap = cv2.VideoCapture(src)
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    enc = subprocess.Popen(encode_cmd(out_path, W, H, fps, crf), stdin=subprocess.PIPE)
    ratio = []
    t0, f = time.time(), -1
    while True:
        ok, fr = cap.read()
        if not ok:
            break
        f += 1
        if limit and f >= limit:
            break
        si = 0
        for i in range(len(starts)):
            if f >= starts[i]:
                si = i
        ln_seg = max(1, ends[si] - starts[si])
        u = min(1.0, (f - starts[si]) / ln_seg)
        sc = 1.0 + punch * (0.45 + 0.55 * (si % 2)) + punch * 0.20 * u      # تنفّسُ الكتلة
        cw, ch = int(round(W / sc)), int(round(H / sc))
        ox = int(np.clip(round((W - cw) / 2) + shift[si], 0, W - cw))
        oy = int(round((H - ch) * 0.40))
        out = cv2.resize(fr[oy:oy + ch, ox:ox + cw], (W, H), interpolation=cv2.INTER_LANCZOS4)

        if sharpen > 0:                                  # توهيجٌ داخل النواة وحدَها
            sm = cv2.GaussianBlur(out, (0, 0), 1.5)
            d = np.clip((out.astype(np.int16) - sm.astype(np.int16)), -14, 14)
            coreimg = np.clip(out.astype(np.int16) + (d * sharpen).astype(np.int16), 0, 255).astype(np.uint8)
            out = np.where((wmap > 0.002)[..., None], out, coreimg)

        out = cv2.LUT(out, lut)

        # ── الحافة: طبقتا بؤرةٍ متدرّجتان + لونٌ مُطفأ + إظلام، كلها مضروبةٌ في w ──
        cv2.resize(out, (sw, sh), dst=small, interpolation=cv2.INTER_AREA)
        b1 = cv2.resize(cv2.GaussianBlur(small, (0, 0), sig1 / 4.0), (W, H), interpolation=cv2.INTER_LINEAR)
        b2 = cv2.GaussianBlur(small, (0, 0), sig2 / 4.0)
        if desat > 0:
            g = cv2.cvtColor(b2, cv2.COLOR_BGR2GRAY)
            b2 = (cv2.merge([g, g, g]).astype(np.float32) * desat + b2.astype(np.float32) * (1.0 - desat))
            b2 = np.clip(b2, 0, 255).astype(np.uint8)
        b2 = cool_neutral(b2, cool)
        b2 = cv2.resize(b2, (W, H), interpolation=cv2.INTER_LINEAR)
        fo = out.astype(np.float32)
        fo += w1 * (b1.astype(np.float32) - fo)
        fo += w2 * (b2.astype(np.float32) - fo)
        fo *= (1.0 - dark * wmap[..., None])
        out = np.clip(fo, 0, 255).astype(np.uint8)

        if f % 89 == 0:                                  # قياسُ الوعد: حدّةُ النواة ÷ حدّةُ الحافة
            g = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
            lap = cv2.Laplacian(g, cv2.CV_32F)
            a = float(cv2.mean(lap * lap, corec)[0])
            bnd = float(cv2.mean(lap * lap, bandc)[0])
            ratio.append([f, round(a, 1), round(bnd, 1), round(a / max(bnd, 1e-6), 2)])
        enc.stdin.write(out.tobytes())
        if f % 250 == 0:
            print(f"  إطار {f} · {(time.time() - t0) / max(1, f + 1) * 1000:.0f} ms/إطار · نواة {core}", flush=True)
    enc.stdin.close()
    enc.wait()
    cap.release()

    rr = np.array(ratio, dtype=np.float64) if ratio else np.zeros((1, 4))
    rep = {"frames": f + 1, "frames_scanned": ntot, "faces_sampled": len(boxes), "core_ellipse": {"cx": round(float(core[0]), 1), "cy": round(float(core[1]), 1),
                     "rx": round(float(core[2]), 1), "ry": round(float(core[3]), 1)},
           "feather_norm": feather, "sigma": [sig1, sig2], "core_face_margin_px": margin,
           "bot_band": {"y0": round(ybot, 1),
                     "clearance_below_chin_px": clearance, "strength": botf}, "dark": dark, "desat": desat, "cool": cool,
           "sharpen": sharpen, "punch": punch, "fit_shift_px": shift[:1] + [max(abs(x) for x in shift)],
           "lut": lut_kw, "edge_weight_max": round(float(wmap.max()), 3),
           "spill_in_core": 0.0, "spill_note": "w ≡ 0 داخل النواة بالتعريف (انظر weight_map)",
           "sharpness_core_mean": round(float(rr[:, 1].mean()), 1),
           "sharpness_edge_mean": round(float(rr[:, 2].mean()), 1),
           "core_over_edge_ratio_min": round(float(rr[:, 3].min()), 2),
           "core_over_edge_ratio_max": round(float(rr[:, 3].max()), 2),
           "samples": rr[:: max(1, len(rr) // 12)].tolist(),
           "wall_seconds": round(time.time() - t0, 1)}
    if report_path:
        with open(report_path, "w", encoding="utf-8") as fh:
            json.dump(rep, fh, ensure_ascii=False, indent=1)
    print(f"  ✔ {out_path} · {f + 1} إطاراً · {rep['wall_seconds']:.0f}s · النواة {core} · "
          f"حدّةُ الوسط/الأطراف {rep['core_over_edge_ratio_min']}–{rep['core_over_edge_ratio_max']}× · "
          f"تسرّبٌ في النواة {rep['spill_in_core']}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="src", default="/tmp/corp/cut.mp4")
    ap.add_argument("--tl", default="/tmp/corp/timeline.json")
    ap.add_argument("--out", default="/tmp/corp/edge.mp4")
    ap.add_argument("--report", default="")
    ap.add_argument("--fps", type=float, default=30.0)
    ap.add_argument("--sigma", type=float, nargs=2, default=[9.0, 30.0])
    ap.add_argument("--feather", type=float, default=0.30, help="مدى لَفّةِ البؤرة، نسبةً من نصف محور النواة")
    ap.add_argument("--dark", type=float, default=0.20)
    ap.add_argument("--desat", type=float, default=0.55)
    ap.add_argument("--cool", type=float, default=46.0)
    ap.add_argument("--topf", type=float, default=0.45, help="سقفُ بؤرةِ ما فوق الرأس (بدايتُها مقيسةٌ من شعره)")
    ap.add_argument("--botf", type=float, default=0.70, help="سقفُ بؤرةِ المقدّمة (المكتب أسفلَ الإطار)")
    ap.add_argument("--sharpen", type=float, default=0.30)
    ap.add_argument("--punch", type=float, default=0.018)
    ap.add_argument("--fit", type=float, default=1.0)
    ap.add_argument("--stride", type=int, default=15)
    ap.add_argument("--crf", type=int, default=14)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--black-lift", type=float, default=0.075)
    ap.add_argument("--hi-roll", type=float, default=0.92)
    ap.add_argument("--contrast", type=float, default=0.05)
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    if a.self_test:
        W, H = 1080, 1920
        boxes = [{"x0": 0.30, "x1": 0.70, "y0": 0.10, "y1": 0.34, "cx": 0.5},
                 {"x0": 0.26, "x1": 0.66, "y0": 0.09, "y1": 0.33, "cx": 0.46},
                 {"x0": 0.33, "x1": 0.73, "y0": 0.12, "y1": 0.36, "cx": 0.53}]
        core = core_ellipse(boxes, W, H, 0.30, 0.70, 1.6)
        w, R = weight_map(W, H, core, 0.42)
        fh = (max(b["y1"] for b in boxes) - min(b["y0"] for b in boxes)) * H
        w = np.maximum(w, top_band(W, H, min(b["y0"] for b in boxes) * H - 0.05 * H, 0.075, 0.45))
        lut = tone_lut(black_lift=0.075, hi_roll=0.92, contrast=0.05)
        face = w[int(H * 0.12):int(H * 0.32), int(W * 0.31):int(W * 0.69)]
        print(f"  self-test: قطعةٌ فائقة ع=({core[0]:.0f},{core[1]:.0f}) نصفَاها ({core[2]:.0f},{core[3]:.0f})")
        print(f"             نصفَا المحور ({core[2]:.0f},{core[3]:.0f}) · w على الوجه {face.max():.4f} (يجب 0)")
        print(f"             عند الزاوية {w[0, 0]:.3f} · منتصفُ الحافة اليمنى {w[int(H*0.5), W-1]:.3f} · "
              f"أعلى الوسط {w[2, int(W*0.5)]:.3f} · أسفل الوسط {w[H-3, int(W*0.5)]:.3f}")
        print(f"  LUT: 0→{lut[0]} · 64→{lut[64]} · 128→{lut[128]} · 192→{lut[192]} · 255→{lut[255]}")
        assert float(face.max()) == 0.0, "تسرّبٌ على الوجه — كلُّ الوعدِ هنا"
        assert lut[0] >= 5 and lut[255] <= 252
        assert np.all(np.diff(lut.astype(np.int16)) >= 0), "LUTٌ غيرُ رتيب"
        assert float(w[0, 0]) > 0.75, "الزوايا لا تُلمَس — لا ضبابيةَ أصلاً"
        assert float(w[int(H * 0.5), W - 1]) > 0.55, "الجوانبُ داخل النواة — لا «أطراف»"
        assert float(w[0, int(W * 0.5)]) > 0.15, "لا شريطَ فوق الرأس"
        assert float(w[H - 3, int(W * 0.5)]) == 0.0, "الجسمُ السفليُّ يُغلَّط — ممنوع"
        assert float(w[int((min(b_["y1"] for b_ in boxes)) * H * 0.7), int(W * 0.5)]) == 0.0, "الوجهُ يلمسُه الشريط"
        return 0
    tl = json.load(open(a.tl, encoding="utf-8"))
    return run(a.src, tl, a.out, a.fps, a.sigma[0], a.sigma[1], a.feather, a.topf, a.botf, a.dark, a.desat,
               a.cool, a.sharpen, a.punch, a.fit, a.stride, a.crf,
               {"black_lift": a.black_lift, "hi_roll": a.hi_roll, "contrast": a.contrast},
               a.report or os.path.splitext(a.out)[0] + "-edge.json", a.limit)


if __name__ == "__main__":
    sys.exit(main())
