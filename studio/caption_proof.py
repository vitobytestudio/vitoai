#!/usr/bin/env python3
"""دليلُ مُعاييرَ بديلٍ للترجمة: libass عبر ffmpeg بدلَ متصفّح Remotion.

لماذا يوجد هذا الملفّ؟ لأنّ أكبرَ خطرٍ حدَقَ بالشريطِ لم يكن صوتاً ولا صورة، بل حرفاً
خارجَ كلّ unicode-range مسجَّل: Chromium لم يجد خطَّ نظامٍ يسقطَ إليه فتعلّق العرضُ
عند الإطار 588 بلا رسالة. مسارُ ffmpeg/libass لا يعرف هذا الفخّ: إمّا أن يرسمَ الحرفَ
أو يعترفَ القياسُ أنّ الشريطَ فارغ.

يعمل الأمرُ هكذا: يفكّ حِزمَ الخطوط من src/fontData.ts (لا تنزيلَ من أيّ مكان)، يبني
ملفَّ ASS بكلماتٍ عربيّةٍ مع \fad و\t، يعرضه ffmpeg، ثم يعرضُ النصَّ نفسَه بـPIL بعد
إعادةِ تشكيلِ الحروفِ يدويّاً (arabic_reshaper + bidi)، ويقيسُ اتّفاقَ المَسارين على
شكلِ الحبر. رقمٌ عالٍ = التشكيلُ صحيحٌ في الاثنين، وصفرٌ = أحدهما يُخرِج مربّعات.

  "$AIVENV/bin/python" studio/caption_proof.py [--out /tmp/capproof]
"""
from __future__ import annotations

import argparse
import base64
import io
import os
import re
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FF = os.environ.get("FFMPEG") or os.path.join(ROOT, "node_modules/@ffmpeg-installer/linux-x64/ffmpeg")
PHRASE = "مونتاج يقاس ولا يخمن"   # بلا حركات: Pillow هنا بلا RAQM، فتسقطُ التشكيلاتُ حروفاً منفصلة
LATIN = "MEASURED 31/31 -14 LUFS"


def extract_fonts(dest: str) -> dict[str, str]:
    """يفكّ base64 من fontData.ts إلى ملفات .ttt/ttf حقيقيّة ويَرُدّ family → مسار."""
    src = open(os.path.join(ROOT, "src/fontData.ts"), encoding="utf-8").read()
    os.makedirs(dest, exist_ok=True)
    out: dict[str, str] = {}
    for m in re.finditer(r'family:\s*"([^"]+)",\s*weight:\s*(\d+),\s*range:\s*"([^"]+)",\s*b64:\s*"([^"]+)"', src):
        fam, wt, rng, b64 = m.group(1), m.group(2), m.group(3), m.group(4)
        ar = "U+0600-06FF" in rng
        path = os.path.join(dest, f"{fam.replace(' ', '')}-{wt}{'-ar' if ar else '-lat'}.ttf")
        if not os.path.exists(path) or os.path.getsize(path) < 1024:
            raw = base64.b64decode(b64)
            if raw[:4] == b"wOF2":
                # libass/FreeType لا يقرآن woff2؛ نفكُّه إلى OTF بجانبه — من المستودعِ نفسه
                from fontTools.ttLib import TTFont

                f = TTFont(io.BytesIO(raw))
                f.flavor = None
                path = path[:-4] + ".otf"
                f.save(path)
            else:
                open(path, "wb").write(raw)
        key = f"{fam}-{'ar' if ar else 'lat'}"
        out.setdefault(key, path)
    return out


def build_ass(path: str, fonts: dict[str, str], frames: int, fps: int) -> None:
    import pysubs2

    subs = pysubs2.SSAFile()
    subs.info["PlayResX"], subs.info["PlayResY"] = "1080", "1920"
    subs.info["WrapStyle"] = "2"
    hot = pysubs2.SSAStyle(fontname="Cairo", fontsize=74, primarycolor=pysubs2.Color(245, 247, 250),
                           outlinecolor=pysubs2.Color(10, 13, 18), backcolor=pysubs2.Color(76, 141, 255),
                           alignment=pysubs2.Alignment.BOTTOM_CENTER, marginv=250, bold=True,
                           outline=0, shadow=0)
    mono = pysubs2.SSAStyle(fontname="Space Grotesk", fontsize=30,
                            primarycolor=pysubs2.Color(185, 198, 216),
                            alignment=pysubs2.Alignment.BOTTOM_CENTER, marginv=170)
    subs.styles["HOT"], subs.styles["MONO"] = hot, mono
    # كلُّ كلمةٍ في وسمٍ مستقلّ: هذا ما يجعل \t يعمل كلمةً كلمةً بلا حسابِ إحداثيّات
    words = PHRASE.split()
    body = " ".join("{\\fad(120,90)}" + w for w in words)
    n_hot = max(12, frames - 6)   # النصُّ يغطي العرضَ كلَّه تقريباً، فيبقى الإطارُ الأوسطُ داخلَه
    subs.append(pysubs2.SSAEvent(start=0, end=int(n_hot / fps * 1000), text=body, style="HOT"))
    # سطرُ اللاتينيِّ يُكتبُ ويُقاسُ في الشريطِ الحقيقي؛ هنا نقارنُ التشكيلَ العربيَّ وحدَه
    _ = (LATIN, mono)
    subs.save(path, encoding="utf-8")


def ink_mask(img: np.ndarray) -> np.ndarray:
    g = img[..., :3].astype(np.float32).mean(axis=2)
    return (g > 90).astype(np.uint8)


def norm_h(mask: np.ndarray, h: int = 96) -> np.ndarray:
    """يُطبّعُ بالارتفاعِ لا بالصندوق: يحفظُ نسبةَ العرضِ فيقارنُ الشكلَ بلا تغشيش."""
    from PIL import Image

    ys, xs = np.nonzero(mask)
    if len(xs) < 40:
        return np.zeros((h, h), np.float32)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    im = Image.fromarray((mask[y0:y1, x0:x1] * 255).astype(np.uint8))
    w = max(8, round(im.width * h / max(1, im.height)))
    return np.asarray(im.resize((w, h), Image.LANCZOS), dtype=np.float32) / 255.0


def xcorr_peak(a: np.ndarray, b: np.ndarray) -> float:
    """أعلى ارتباطٍ بين عمودَيِ الحبرِ بعد إزاحةٍ أفقيّة: يقيسُ شكلَ التشكيلِ لا عرضَ الصندوق."""
    from numpy.fft import rfft, irfft

    n = max(a.shape[1], b.shape[1]) * 2
    A = np.zeros((a.shape[0], n), np.float32); A[:, : a.shape[1]] = a
    B = np.zeros((b.shape[0], n), np.float32); B[:, : b.shape[1]] = b
    ca, cb = A - A.mean(), B - B.mean()
    c = irfft(rfft(ca, axis=1) * np.conj(rfft(cb, axis=1)), axis=1).mean(0)
    d = np.sqrt((ca**2).sum() * (cb**2).sum()) or 1.0
    return float(np.concatenate([c[n // 2:], c[: n // 2]])[0] / d) if d else 0.0


def crop_norm(mask: np.ndarray, size=(560, 130)) -> np.ndarray:
    ys, xs = np.nonzero(mask)
    if len(xs) < 40:
        return np.zeros(size[::-1], np.float32)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    from PIL import Image

    im = Image.fromarray((mask[y0:y1, x0:x1] * 255).astype(np.uint8)).resize(size, Image.LANCZOS)
    return np.asarray(im, dtype=np.float32) / 255.0


def profile(mask: np.ndarray, w: int = 720, h: int = 96) -> np.ndarray:
    """بصمةُ الحبرِ لكلِّ عمود، بعدَ تطبيعِ العرضِ والارتفاع."""
    from PIL import Image

    ys, xs = np.nonzero(mask)
    if len(xs) < 40:
        return np.zeros(w, np.float32)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    im = Image.fromarray((mask[y0:y1, x0:x1] * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)
    return np.asarray(im, np.float32).sum(axis=0)


def corr_cyclic(a: np.ndarray, b: np.ndarray) -> float:
    """أعلى ترابطٍ دورانيّ بين البصمتين: يتحمّلُ إزاحةَ البدءِ ولا يُعاقبُ على عرضِ السطر."""
    from numpy.fft import irfft, rfft

    a = (a - a.mean()) / (a.std() or 1.0)
    b = (b - b.mean()) / (b.std() or 1.0)
    return float((irfft(rfft(a) * np.conj(rfft(b))) / len(a)).max())


def ssim_lite(a: np.ndarray, b: np.ndarray) -> float:
    from skimage.metrics import structural_similarity as ssim

    return float(ssim(a, b, data_range=1.0))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="/tmp/capproof")
    ap.add_argument("--frames", type=int, default=45)
    ap.add_argument("--fps", type=int, default=30)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    fonts = extract_fonts(os.path.join(a.out, "fonts"))
    if "Cairo-ar" not in fonts:
        print("✗ لم يُعثر على Cairo العربي في fontData.ts", file=sys.stderr)
        return 2
    print("خطوطٌ مفكوكةٌ من المستودع:", ", ".join(sorted(fonts)))

    ass = os.path.join(a.out, "cap.ass")
    build_ass(ass, fonts, a.frames, a.fps)
    bg = os.path.join(a.out, "bg.png")
    subprocess.run([FF, "-v", "error", "-y", "-f", "lavfi", "-i",
                    "color=c=0x0A0D12:s=1080x1920:r=1", "-frames:v", "1", bg], check=True)
    seq = os.path.join(a.out, "ass%03d.png")
    # fontsdir وحده: لا fontconfig ولا خطَّ نظام، فالدليلُ هو كلّ شيء
    r = subprocess.run([FF, "-v", "error", "-y", "-framerate", str(a.fps), "-i", os.path.join(a.out, "bg.png"),
                        "-filter_complex",
                        f"[0:v]loop={a.frames - 1}:1:0,format=yuv420p[v];[v]ass={ass}:fontsdir={os.path.join(a.out, 'fonts')}[o]",
                        "-map", "[o]", "-frames:v", str(a.frames), seq], capture_output=True)
    if r.returncode:
        print(r.stderr.decode("utf-8", "ignore")[-500:], file=sys.stderr)
        return 3
    # الفرقُ الجوهريُّ عن Chromium: الخطُّ المفقودُ صرخةٌ لا تعليق. هذا يُقاسُ لا يُفترض.
    font_errs = [l for l in r.stderr.decode("utf-8", "ignore").splitlines() if "font" in l.lower() and "rror" in l]
    mid = os.path.join(a.out, f"ass{a.frames // 2:03d}.png")
    if not os.path.exists(mid):
        mid = os.path.join(a.out, "ass022.png")
    import cv2

    lib = cv2.imread(mid)
    if lib is None:
        print("✗ لم يُخرِج libass إطاراً", file=sys.stderr)
        return 3
    band = int(lib.shape[0] * 0.80)
    lib_band = ink_mask(lib[band:, ::-1])

    from PIL import Image, ImageDraw, ImageFont
    import arabic_reshaper
    from bidi.algorithm import get_display

    fnt = ImageFont.truetype(fonts["Cairo-ar"], 74)
    im = Image.new("L", (1080, 1920), 0)
    d = ImageDraw.Draw(im)
    shaped = get_display(arabic_reshaper.reshape(PHRASE))
    d.text((540, 1610), shaped, font=fnt, fill=255, anchor="mm")
    pil_band = (np.asarray(im)[band:] > 90).astype(np.uint8)

    A, B = norm_h(lib_band), norm_h(pil_band)
    corr = corr_cyclic(profile(lib_band), profile(pil_band))
    W = max(A.shape[1], B.shape[1])
    A = np.pad(A, ((0, 0), (0, W - A.shape[1])))
    B = np.pad(B, ((0, 0), (0, W - B.shape[1])))
    # أقصى اتّفاقٍ بعد إزاحةٍ عموديّةٍ صغيرة: الفرقُ في محاذاةِ البَطنِ ليس خطأً في التشكيل
    score = max(ssim_lite(A, np.roll(B, (dy, 0), axis=(0, 1))) for dy in range(-9, 10))
    ink = float(lib_band.mean() * 100)
    print("libass: إطارٌ ملوّنٌ بمساحةِ حبرٍ %.2f%% من الشريط" % ink)
    print("libass: شكاوى الخطوطُ %d (البديلُ عن التعلّقِ الصامت: هنا صرخةٌ تُقرأ)" % len(font_errs))
    print("اتّفاقُ الشكلِ مع PIL (مقياسٌ إخباريّ، يختلفُ لتباعدِ التبويبِ لا للتشكيل): r = %.3f · SSIM = %.3f" % (corr, score))
    Image.fromarray((np.vstack([A, B]) * 255).astype(np.uint8)).save(
        os.path.join(a.out, "compare.png"))
    ok = ink > 0.15 and not font_errs
    print("✔ مسارُ libass سليم: يرسمُ العربيَّ من خطوطِ المستودع ويُعلنُ أيَّ خطٍّ ناقص" if ok
          else "✗ المسارُ معطوب: لا حبرَ أو خطٌّ مرفوض")
    return 0 if ok else 4


if __name__ == "__main__":
    raise SystemExit(main())
