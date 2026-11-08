#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""studio/comp.py — قصّ الشخص، تبديل الخلفية، ومطابقة الإضاءة: محلياً وعلى المعالج.

لماذا هذا الملف موجود أصلاً: لا GPU هنا، ولا منفذ إلى huggingface.co ولا إلى ملفات إصدارات
GitHub (`objects.githubusercontent.com`) — أي أن أوزان نماذج التوليد (try-on / diffusion) لا تصل
إلى هذا الصندوق ولا تشغّله ذاكرته أصلاً (نويّتان و3 غيغابايت). لكن `mediapipe==0.10.21` coming
من PyPI **يحمل نماذجه داخل العجلة نفسها**: `selfie_segmentation` و`pose_landmark` و`face_landmark`
وغيرها — بلا تنزيل ولا مفتاح ولا حدود. ومع OpenCV/scikit-image يكفي ذلك لعمل القصّ والمطابقة:

    matte        قناع الشخص من الشبكة المضمّنة (أو grabCut إن طُلب صندوق يدوي)
    background   تركيب على أي plate جاهز مع تنعيم حافة حافظ للتفاصيل
    light        نقل إضاءة ولون الخلفية إلى الشخص (Reinhard في Lab) بشفافية مختارة
    shadow       ظلّ ارتكاز مولّد من القناع نفسه، لا من خيال
    recolor      تغيير لون ثوب مع الحفاظ على النسيج والإضاءة (LCh) — لا تبديل ملابس توليدي

الاستعمال:
    python3 studio/comp.py --subject p.jpg --bg public/plates/lf-hero.jpg --out /tmp/comp
    python3 studio/comp.py --self-test            # يثبت أنّ الآلة تعمل بلا صورة لك
"""
from __future__ import annotations
import argparse, json, os, resource, sys, time

import cv2
import numpy as np


# ---------------------------------------------------------------- IO بأسماء عربية
def load(path: str) -> np.ndarray:
    """قراءة بصورة سليمة حتى لو كان الاسم عربياً أو فيه مسافات (cv2.imread يفشل بصمت هناك)."""
    buf = np.fromfile(path, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit(f"✗ لم تُقرأ الصورة: {path}")
    return img


def save(path: str, img: np.ndarray, quality: int = 94) -> None:
    ext = os.path.splitext(path)[1].lower()
    params = [int(cv2.IMWRITE_JPEG_QUALITY), quality] if ext in (".jpg", ".jpeg") else []
    ok, enc = cv2.imencode(ext, img, params)
    if not ok:
        raise SystemExit("✗ تعذّر ترميز " + path)
    enc.tofile(path)


# ---------------------------------------------------------------- الماسكات
def matte_subject(img: np.ndarray, refine: int = 1) -> np.ndarray:
    """قناع الشخص من النموذج المضمّن. يرجّع float32 في [0,1] بنفس دقة الصورة."""
    try:
        import mediapipe as mp
    except ImportError:
        raise SystemExit("✗ mediapipe غير مثبّت:  bash setup.sh --ai")
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    with mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=refine) as seg:
        res = seg.process(rgb)
    m = np.asarray(res.segmentation_mask, dtype=np.float32)
    if m.shape[:2] != img.shape[:2]:
        m = cv2.resize(m, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_LINEAR)
    return np.clip(m, 0.0, 1.0)


def matte_box(img: np.ndarray, rect: tuple, iters: int = 4) -> np.ndarray:
    """grabCut داخل صندوق — للملابس والأشياء التي لا يراها قنّاع الشخص، ولا يحتاج أوزاناً."""
    mask = np.zeros(img.shape[:2], np.uint8)
    x, y, w, h = rect
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(img, mask, (x, y, w, h), bgd, fgd, iters, cv2.GC_INIT_WITH_RECT)
    fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    return fg.astype(np.float32) / 255.0


def clean(alpha: np.ndarray, close_px: int = 5) -> np.ndarray:
    """قفل القناع قبل التنعيم: إغلاق صغير + وسيطي، فيموت «الكتلة المتدرّجة» عند الحواف."""
    u8 = (np.clip(alpha, 0, 1) * 255).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_px, close_px))
    u8 = cv2.morphologyEx(u8, cv2.MORPH_CLOSE, k)
    u8 = cv2.morphologyEx(u8, cv2.MORPH_OPEN, k)
    u8 = cv2.medianBlur(u8, max(3, close_px | 1))
    return u8.astype(np.float32) / 255.0


def feather(alpha: np.ndarray, radius: int = 3, boost: float = 1.15) -> np.ndarray:
    """حواف نظيفة بلا هالة: شدّ القناع قليلاً ثم مرشّة حافظة للحافة بدل Gaussian الغامضة."""
    a = np.clip((alpha - 0.5) * boost + 0.5, 0, 1)
    u8 = (a * 255).astype(np.uint8)
    # قطر النواة هو d نفسه في bilateralFilter — لا ksize هنا (خطأ قتلته التجربة لا القراءة)
    sm = cv2.bilateralFilter(u8, max(0, 2 * radius + 1), 45, 45)
    return sm.astype(np.float32) / 255.0


# ---------------------------------------------------------------- التركيب والإضاءة
def fit(bg: np.ndarray, shape: tuple) -> np.ndarray:
    """تعبئة الخلفية بنفس قياسات الموضوع بلا تمديد (cover-crop)."""
    H, W = shape[:2]
    bh, bw = bg.shape[:2]
    s = max(H / bh, W / bw)
    nb = cv2.resize(bg, (max(1, int(bw * s)), max(1, int(bh * s))), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_LINEAR)
    y0 = (nb.shape[0] - H) // 2
    x0 = (nb.shape[1] - W) // 2
    return nb[y0:y0 + H, x0:x0 + W].copy()


def lab_match(subject: np.ndarray, target: np.ndarray, strength: float = 0.6) -> np.ndarray:
    """نقل إضاءة ولون: Reinhard في Lab — يعيد ضبط متوسطات L وa وb، فيبدو المقطوع مغلفاً في المكان."""
    def stats(img):
        # Lab بـ uint8 (L في 0..255 كما يفسّره OpenCV) — لا مقاييس عائمة تُخربط
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2Lab).astype(np.float32)
        return lab, lab.reshape(-1, 3).mean(0), lab.reshape(-1, 3).std(0) + 1e-6
    subject = subject if subject.dtype == np.uint8 else subject.astype(np.uint8)
    target = target if target.dtype == np.uint8 else target.astype(np.uint8)
    sl, sm_, ss = stats(subject)
    tl, tm, ts = stats(target)
    out = (sl - sm_) * (ts / ss) * strength + tm * strength + sm_ * (1 - strength)
    out[..., 0] = np.clip(out[..., 0], 0, 255)
    out[..., 1:] = np.clip(out[..., 1:], 0, 255)
    return cv2.cvtColor(out.astype(np.uint8), cv2.COLOR_Lab2BGR)


def contact_shadow(alpha: np.ndarray, h: int, w: int, strength: float = 0.45, blur: int = 41) -> np.ndarray:
    """ظلّ ارتكاز من القناع: نجمع وزن القناع في الأعمدة ثم نلوّحه أسفل الصورة."""
    band = alpha[int(h * 0.72):, :]
    if band.size == 0:
        return np.zeros((h, w), np.float32)
    prof = (band > 0.45).sum(0).astype(np.float32)
    prof = cv2.GaussianBlur(prof.reshape(1, -1), (0, 0), max(3, w / 90)).reshape(-1)
    sh = np.zeros((h, w), np.float32)
    y0 = int(h * 0.72)
    for i, v in enumerate(prof):
        if v <= 0:
            continue
        th = min(int(h - y0), max(6, int(v * 0.9)))
        cv2.ellipse(sh, (i, h - 2), (max(2, th // 2), max(2, th // 3)), 0, 0, 360, float(np.clip(v / 12, 0, 1)), -1)
    sh = cv2.GaussianBlur(sh, (blur, blur), 0)
    return np.clip(sh, 0, 1) * strength


def recolor(img: np.ndarray, alpha: np.ndarray, hexcolor: str, strength: float = 0.85) -> np.ndarray:
    """لون جديد مع بقاء النسيج: L untouched، وCh تُسحب نحو اللون المطلوب داخل القناع."""
    hexcolor = hexcolor.lstrip("#")
    if len(hexcolor) != 6:
        raise SystemExit("✗ اكتب اللون هكذا #RRGGBB")
    r, g, b = (int(hexcolor[i:i + 2], 16) for i in (0, 2, 4))
    swatch = cv2.cvtColor(np.uint8([[[b, g, r]]]), cv2.COLOR_BGR2Lab).reshape(3).astype(np.float32)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2Lab).astype(np.float32)
    a = np.clip(alpha, 0, 1) * strength
    for c in (1, 2):
        lab[..., c] = lab[..., c] * (1 - a) + (swatch[c] * a)
    lab[..., 0] = np.clip(lab[..., 0], 0, 255)
    return cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_Lab2BGR)


def sheet(items: list, labels: list, cell: int = 512) -> np.ndarray:
    """ورقة مراجعة أفقية: قبل/بعد بجانب بعضهما، لأن المقارنة البصرية هي الحكم."""
    h = int(cell * items[0].shape[0] / items[0].shape[1])
    tiles = [cv2.resize(i, (cell, h), interpolation=cv2.INTER_AREA) for i in items]
    bar = np.full((34, cell * len(tiles), 3), 12, np.uint8)
    for i, (lb, x) in enumerate(zip(labels, range(0, cell * len(tiles), cell))):
        cv2.putText(bar, lb, (x + 12, 23), cv2.FONT_HERSHEY_SIMPLEX, 0.62, (235, 235, 235), 1, cv2.LINE_AA)
    return np.vstack([np.hstack(tiles), bar])


# ---------------------------------------------------------------- تجربة ذاتية
def synthetic() -> tuple:
    """مشهد مُركَّب ذاتياً: «شخص» بيضاوي على خلفية متدرجة — يثبت الآلة لا الجمال."""
    H, W = 1280, 720
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    bg = np.zeros((H, W, 3), np.float32)
    bg[..., 0] = 40 + 90 * (yy / H)
    bg[..., 1] = 60 + 70 * (xx / W)
    bg[..., 2] = 90 + 50 * (1 - yy / H)
    bg += np.random.default_rng(7).normal(0, 6, bg.shape)
    bg = np.clip(bg, 0, 255).astype(np.uint8)
    subj = bg.copy()
    cv2.ellipse(subj, (W // 2, int(H * .38)), (60, 78), 0, 0, 360, (180, 170, 160), -1)     # رأس
    cv2.ellipse(subj, (W // 2, int(H * .74)), (150, 260), 0, 0, 360, (60, 60, 210), -1)      # جسد
    return subj, bg


def self_test(outdir: str) -> int:
    os.makedirs(outdir, exist_ok=True)
    subj, bg = synthetic()
    rep = {"notes": [], "ok": True}
    t0 = time.time()
    a = matte_box(subj, (subj.shape[1] // 2 - 200, int(subj.shape[0] * .28), 400, 700))
    rep["grabcut_seconds"] = round(time.time() - t0, 2)
    cov = float(a.mean())
    rep["coverage"] = round(cov, 3)
    if not 0.02 < cov < 0.9:
        rep["notes"].append(f"تغطية غريبة: {cov:.3f}")
        rep["ok"] = False
    t0 = time.time()
    a_f = feather(a, 3)
    matched = lab_match(subj, bg, 0.7)
    H, W = subj.shape[:2]
    comp = (bg * (1 - a_f[..., None]) + matched * a_f[..., None]).astype(np.uint8)
    sh = contact_shadow(a_f, H, W)
    comp = np.clip(comp.astype(np.float32) * (1 - 0.55 * sh[..., None]), 0, 255).astype(np.uint8)
    rep["composite_seconds"] = round(time.time() - t0, 2)
    t0 = time.time()
    recolored = recolor(subj, a, "#7a1f2b", 0.9)
    rep["recolor_seconds"] = round(time.time() - t0, 2)
    save(os.path.join(outdir, "matte.png"), (a_f * 255).astype(np.uint8))
    save(os.path.join(outdir, "comp.jpg"), comp)
    save(os.path.join(outdir, "recolor.jpg"), recolored)
    save(os.path.join(outdir, "sheet.jpg"), sheet([subj, bg, comp, recolored],
                                                  ["subject", "background", "comp+shadow", "recolor"]))
    for f in ("matte.png", "comp.jpg", "recolor.jpg", "sheet.jpg"):
        p = os.path.join(outdir, f)
        if not (os.path.exists(p) and os.path.getsize(p) > 2000):
            rep["notes"].append("ملف صغير أو مفقود: " + f)
            rep["ok"] = False
    try:
        import mediapipe as mp
        rep["mediapipe"] = mp.__version__
        t0 = time.time()                                  # المسار السريع: قناع الشخص للشots الحقيقية
        big = cv2.resize(subj, (1080, 1920), interpolation=cv2.INTER_NEAREST)
        with mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=1) as seg:
            r = seg.process(cv2.cvtColor(big, cv2.COLOR_BGR2RGB))
        m = np.asarray(r.segmentation_mask, np.float32)
        rep["mp_frame_s"] = round(time.time() - t0, 3)
        rep["mp_coverage"] = round(float(np.clip(m, 0, 1).mean()), 3)
        # على مشهد مُركَّب لا يُتوقَّع أن يرى «شخصاً» — نُسجّل ذلك ولا نُخفيه
        if rep["mp_coverage"] < 0.05:
            rep["notes"].append("القناع العصبي لم يجد شخصاً في المشهد المُركَّب (طبيعي) — على صورة حقيقية يتغيّر الحكم")
    except Exception as e:  # ليس شرطاً لمسار grabCut
        rep["mediapipe"] = f"غير متاح: {type(e).__name__}"
    rep["peak_rss_mb"] = round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1)
    print(json.dumps(rep, ensure_ascii=False, indent=1))
    return 0 if rep["ok"] else 1


# ---------------------------------------------------------------- CLI
def parse_rect(s: str):
    v = [int(x) for x in s.replace(" ", "").split(",")]
    if len(v) != 4:
        raise SystemExit("✗ الصندوق: x,y,w,h")
    return tuple(v)


def main() -> int:
    ap = argparse.ArgumentParser(description="قصّ وتركيب ومطابقة إضاءة محلياً (بلا أوزان من الإنترنت).")
    ap.add_argument("--subject", help="الصورة التي سيُقصّ منها الشخص/العنصر")
    ap.add_argument("--bg", help="الخلفية الجديدة (أي plate في المستودع)")
    ap.add_argument("--out", default="/tmp/comp", help="مجلد المخرجات")
    ap.add_argument("--rect", help="صندوق x,y,w,h لقصّ عنصر محدد بـ grabCut بدل قناع الشخص")
    ap.add_argument("--recolor", help="لون الثوب الجديد #RRGGBB (يحفظ النسيج)")
    ap.add_argument("--light", type=float, default=0.6, help="شفافية مطابقة الإضاءة 0..1")
    ap.add_argument("--feather", type=int, default=3, help="نصف قطر تنعيم الحافة")
    ap.add_argument("--shadow", type=float, default=0.45, help="قوة ظلّ الارتكاز")
    ap.add_argument("--self-test", action="store_true", help="اثبت الآلة على مشهد مُركَّب")
    a = ap.parse_args()

    if a.self_test:
        return self_test(a.out)
    if not a.subject:
        ap.error("أعطني --subject، أو جرّب --self-test")

    os.makedirs(a.out, exist_ok=True)
    img = load(a.subject)
    t0 = time.time()
    if a.rect:
        alpha = matte_box(img, parse_rect(a.rect))
        how = "grabCut"
    else:
        alpha = matte_subject(img)
        how = "selfie_segmentation"
    tm = time.time() - t0
    cov = float(alpha.mean())
    if cov < 0.01:
        print(f"⚠ النموذج لم يجد شيئاً (تغطية {cov:.3f}) — جرّب --rect x,y,w,h", file=sys.stderr)
    alpha = feather(clean(alpha), a.feather)
    out = img
    if a.bg:
        bg = fit(load(a.bg), img.shape)
        H, W = img.shape[:2]
        matched = lab_match(img, bg, a.light)
        out = (bg * (1 - alpha[..., None]) + matched * alpha[..., None]).astype(np.uint8)
        sh = contact_shadow(alpha, H, W, a.shadow)
        out = np.clip(out.astype(np.float32) * (1 - 0.55 * sh[..., None]), 0, 255).astype(np.uint8)
    if a.recolor:
        out = recolor(out if a.bg else img, alpha, a.recolor)
    save(os.path.join(a.out, "matte.png"), (alpha * 255).astype(np.uint8))
    save(os.path.join(a.out, "comp.jpg"), out)
    items = [img, out] if not a.bg else [img, load(a.bg), out]
    labels = ["subject", "comp"] if not a.bg else ["subject", "background", "comp"]
    save(os.path.join(a.out, "sheet.jpg"), sheet(items, labels))
    print(json.dumps({"mask": how, "coverage": round(cov, 3), "matte_s": round(tm, 2),
                      "size": list(img.shape[:2]),
                      "peak_rss_mb": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1),
                      "files": [os.path.join(a.out, f) for f in ("matte.png", "comp.jpg", "sheet.jpg")]},
                     ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
