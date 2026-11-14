# -*- coding: utf-8 -*-
"""studio/stage.py — «المسرح»: قناعٌ على مرورين، خلفيةٌ مُصمَّمة، ومنظورٌ يتنفّس.

لماذا وُجد هذا الملف بعد `comp.py --video`؟ لأنّ التشويشَ الذي وُضع خلف الشخص كان
يفشل عند الحركة: كنتُ أخفّف الأثر حيث القناعُ متردّد، فأيُّ حركةٍ بيدِه كانت تُرجع
الخلفيةَ الحادّة للحظة — وهذا ما يراه المشاهدُ «اختفاءً للتشويش». العلاجُ هنا قرارٌ،
لا معايرة:

  1) مرورٌ أول للقناع وحده على ربع الدقة، يُخزَّن؛ ثم **توسيعٌ زمني** (أقصى النافذة ±2)
     في المرور الثاني: القناعُ لا يفقد تغطيةً أبداً لأنّنا لا نخمّن المستقبل ولا نتأخّر
     عنه — نأخذ الاتحاد. لا لطمةَ يد، ولا رفرفةَ شعر.
  2) الخلفية ليست منزلاً: **لوحةٌ مولّدة** (جرافيت متدرّج + شبكة خفيفة + توهّج كتف +
     أرضٌ بظلّها). لو أخطأ القناعُ بكسلين فالفاتورةُ على سطحٍ داكنٍ صامت، لا على خزانة.
  3) اللوحةُ تتحرّك بضعة بكسلات عكس مركز الشخص (parallax) فيقرأ المشهد عدسةً لا قصّاً.
  4) ظلُّ ارتكازٍ من القناع نفسه، وتلاشٍ لونيُّ Reinhard على الشخص، ومنحنى بُعد خفيف.

    python3 studio/stage.py --in cut.mp4 --out /tmp/stage --plate auto
"""
from __future__ import annotations
import argparse, json, os, subprocess, sys, time

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comp import clean, feather, grade_subject, load, save  # آلياتٌ واحدة، لا نسخةٌ ثانية


# ------------------------------------------------------------------ اللوحة
def make_plate(w: int, h: int, seed: int = 11, grid: bool = True) -> np.ndarray:
    """خلفية «شركةٍ عالمية»: داكنة، هندسية، بلا الشيء الذي يسرق النظ."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    v = yy / h
    plate = np.zeros((h, w, 3), np.float32)
    # تدرّج رأسيٌّ بارد: أعلى أفتحُ (جدارٌ يصله ضوءٌ علوي) وأسفلُ أثقل. أزرقُ رماديّ
    # لا بنّيّ — أول نسخةٍ كانت دافئة فبدا المقطعُ مغبّراً تحت الوجه، واللوحةُ هنا
    # يجب أن تُشعِر بالمكتب الفخم لا بغرفةٍ مغلقة.
    for c, (a, b) in enumerate([(74, 34), (68, 30), (60, 26)]):   # B,G,R من الأعلى للأسفل
        plate[..., c] = a + (b - a) * v
    # توهّجٌ بيضاوي خلف الرأس — نورٌ لا نقش
    glow = np.exp(-(((xx - w * 0.5) / (w * 0.42)) ** 2 + ((yy - h * 0.34) / (h * 0.30)) ** 2))
    plate += (glow[..., None] * np.float32([58, 52, 44]))
    # شبكةٌ تُحسّ ولا تُرى
    if grid:
        step = max(64, w // 12)
        g = np.zeros((h, w), np.float32)
        g[(yy % step) < 1.4] = 1.0
        g[(xx % step) < 1.4] = 1.0
        plate += g[..., None] * 7.0
    # أفقٌ عند 0.72 من العلوّ، وأرضيةٌ تظلم تحت الثقل
    hor = int(h * 0.72)
    floor = np.clip((yy - hor) / max(1.0, h - hor), 0, 1)
    plate -= (floor[..., None] ** 1.4) * np.float32([7, 7, 6])
    plate += rng.normal(0, 1.6, plate.shape)                         # حبيبةٌ تمنع التدرّج المرقّط
    vig = (((yy - h * 0.44) / h) ** 2 + ((xx - w * 0.5) / w) ** 2 * 1.25) ** 1.1
    plate *= (1.0 - 0.17 * vig)[..., None]                               # فينييتٌ خفيف
    # رقعةُ ضوءٍ خلف الكتفين: تفصلُ الشخص عن الجدار بلا هالةٍ بيضاء حوله
    wash = np.exp(-(((xx - w * 0.5) / (w * 0.62)) ** 2 + ((yy - h * 0.52) / (h * 0.34)) ** 2))
    plate += (wash[..., None] * np.float32([26, 20, 12]))
    return np.clip(plate, 0, 255).astype(np.uint8)


def chroma_cast(subject: np.ndarray, bg: np.ndarray, strength: float) -> np.ndarray:
    """تبريدُ لونِ الشخص نحو اللوحة — بلا مسٍّ بالإضاءة. مطابقةُ L (Reinhard الكامل)
    كانت تسحبُ الوجه إلى متوسطِ لوحةٍ داكنةٍ فيصير الطينُ مكان البشرة؛ والقاعدةُ في
    التركيب: الخلفيةُ تُطابَق لوناً، والموضوعُ يُضاء كما صوّرته الكاميرا."""
    if strength <= 0:
        return subject
    sl = cv2.cvtColor(subject, cv2.COLOR_BGR2Lab).astype(np.float32)
    bl = cv2.cvtColor(bg, cv2.COLOR_BGR2Lab).astype(np.float32)
    for c in (1, 2):
        sm = float(sl[..., c].mean())
        bm = float(bl[..., c].mean())
        sl[..., c] = np.clip(sl[..., c] + (bm - sm) * strength, 0, 255)
    return cv2.cvtColor(sl.astype(np.uint8), cv2.COLOR_Lab2BGR)


# ------------------------------------------------------------------ القناع
FF = os.environ.get("FFMPEG") or "ffmpeg"


def alphas(src: str, fps: float, qw: int, qh: int, cache: str) -> int:
    """المرور الأول: الشبكة فقط، على دقة ربعية، مُخزَّنة uint8 — ذاكرتنا 3 غيغابايت."""
    from comp import Matter
    os.makedirs(cache, exist_ok=True)
    dec = subprocess.Popen([FF, "-v", "error", "-i", src, "-vf", f"fps={fps},scale={qw}:{qh}",
                            "-pix_fmt", "bgr24", "-f", "rawvideo", "-"], stdout=subprocess.PIPE,
                           bufsize=qw * qh * 3)
    mat = Matter()
    n = 0
    t0 = time.time()
    while True:
        buf = dec.stdout.read(qw * qh * 3)
        if len(buf) < qw * qh * 3:
            break
        fr = np.frombuffer(buf, np.uint8).reshape(qh, qw, 3)
        a = np.clip(mat.alpha(np.ascontiguousarray(fr), small=1), 0, 1)
        np.clip(a * 255, 0, 255).astype(np.uint8).tofile(os.path.join(cache, f"a{n:05d}.raw"))
        n += 1
        if n % 200 == 0:
            print(f"    قناع {n} · {(time.time()-t0)/n*1000:.0f} ms", flush=True)
    dec.stdout.close(); dec.wait()
    try:
        mat.close()
    except Exception:
        pass
    print(f"    المرور الأول: {n} قناعاً في {time.time()-t0:.0f} ث")
    return n


def temporal_fill(n: int, cache: str, qw: int, qh: int, span: int = 2) -> None:
    """اتحادٌ زمني: كل لقطةٍ تأخذ أقصى ما رأته الجيران — فلا تفقد اليدُ تغطيتَها."""
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    read = lambda i: np.fromfile(os.path.join(cache, f"a{i:05d}.raw"), np.uint8).reshape(qh, qw)
    win, nxt = [], 0            # [(idx, mask)] — نافذةٌ منزلقة بفهرسٍ صريح، لا بحسابٍ يدوي
    for i in range(n):
        while nxt <= min(n - 1, i + span):
            win.append((nxt, read(nxt)))
            nxt += 1
        while win and win[0][0] < i - span:
            win.pop(0)
        acc = np.zeros((qh, qw), np.uint8)
        for _, m in win:
            acc = np.maximum(acc, cv2.dilate(m, k))
        # انسحابٌ بسيط عند الحافة: الخطأُ إن وقع فليفوتِ الخلفيةَ لا العكس
        np.clip(acc.astype(np.int16) - 26, 0, 255).astype(np.uint8).tofile(os.path.join(cache, f"f{i:05d}.raw"))
    print(f"    مرورٌ زمني ±{span}: اكتمل على {n} لقطة")


# ------------------------------------------------------------------ التركيب
def stage(src: str, outdir: str, plate_path: str, fps: float, parallax: float, light: float,
           punch: float, feather_r: int, qw: int, qh: int) -> dict:
    os.makedirs(outdir, exist_ok=True)
    cache = os.path.join(outdir, "alphas")
    # المخزونُ يُعاد استعماله: المرورُ الأول والتمريرُ الزمنيّ مشتقّان من الملفّ نفسه،
    # فإن كانا كاملين لا داعي لإهدار أربع دقائق في إعادة قناعٍ موجود. (لحذف المخزون:
    # rm -rf <out>/alphas — وهو أولُ ما يُلغى عند تغيير المصدر.)
    ra = len([x for x in os.listdir(cache) if x.startswith("a") and x.endswith(".raw")]) if os.path.isdir(cache) else 0
    rf = len([x for x in os.listdir(cache) if x.startswith("f") and x.endswith(".raw")]) if os.path.isdir(cache) else 0
    if ra and ra == rf:
        n = ra
        print(f"    مخزونُ أقنعة: {n} لقطة — يُعاد استعمالها")
    else:
        n = alphas(src, fps, qw, qh, cache)
        temporal_fill(n, cache, qw, qh)

    info = subprocess.run([FF, "-hide_banner", "-i", src], capture_output=True, text=True).stderr
    m = __import__("re").search(r"(\d{2,4})x(\d{3,4})", info)
    W, H = (int(m.group(1)), int(m.group(2))) if m else (1080, 1920)
    plate = load(plate_path) if plate_path and plate_path != "auto" else make_plate(W, H)
    plate_hi = cv2.resize(plate, (W, H), interpolation=cv2.INTER_LANCZOS4)
    pad_x, pad_y = int(W * 0.06), int(H * 0.04)                       # هامشٌ للتحريك بلا حوافّ
    big = cv2.copyMakeBorder(plate_hi, pad_y, pad_y, pad_x, pad_x, cv2.BORDER_REPLICATE)

    dec = subprocess.Popen([FF, "-v", "error", "-i", src, "-vf", f"fps={fps},scale={W}:{H}:flags=lanczos,setsar=1",
                            "-pix_fmt", "bgr24", "-f", "rawvideo", "-"], stdout=subprocess.PIPE, bufsize=W * H * 3)
    enc_path = os.path.join(outdir, "stage.mp4")
    enc = subprocess.Popen([FF, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
                            "-r", str(fps), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "16",
                            "-pix_fmt", "yuv420p", "-color_range", "tv", "-colorspace", "bt709",
                            "-color_primaries", "bt709", "-color_trc", "bt709", enc_path], stdin=subprocess.PIPE)
    prev_c = None
    GY, GX = np.mgrid[0:qh, 0:qw].astype(np.float32)                 # شبكةُ المركز، مرةً واحدة
    # شبكةُ الجانب على الدقة الكاملة: تُقاس بها المسافةُ الأفقية عن مركزِ الشخص،
    # فـ«الغرفة التي يبتلعها القناعُ مع ذراعِه» (المكتبُ الخشبيّ إلى جانبه) تُسحبُ
    # إلى اللوحة بدل أن تُترك خشباً حادّاً. لا تلمس الوجهَ ولا الجذع.
    XS = np.abs((np.arange(W, dtype=np.float32) / W) - 0.5)[None, :].repeat(H, axis=0)
    KG = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))         # تمدّدُ البوّابة (ربعُ الدقة)
    KI = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))       # نواةُ «بؤرةٍ» داخلية (ربعُ الدقة)
    ko = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (max(5, int(W * 0.014)) | 1,) * 2)
    ki = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (max(3, int(W * 0.008)) | 1,) * 2)
    t0, i = time.time(), 0
    stride = W * H * 3
    while True:
        buf = dec.stdout.read(stride)
        if len(buf) < stride:
            break
        fr = np.frombuffer(buf, np.uint8).reshape(H, W, 3).copy()
        small = np.fromfile(os.path.join(cache, f"f{i:05d}.raw"), np.uint8).reshape(qh, qw).astype(np.float32)
        # بوّابةُ اللقطة الجارية: الاتحادُ الزمنيّ يضمن التغطية لكنه يجرّف معه شريطاً
        # من الغرفة القديمة بجانب الرأس، فيبدو «باباً خلف أذنه». لذا يُضرب الاتحادُ
        # بقناعِ اللقطة نفسِها بعد تمدّدٍ ناعم: إن لم ترَه الكاميرا الآن فلا يُرسَم.
        rawf = np.fromfile(os.path.join(cache, f"a{i:05d}.raw"), np.uint8).reshape(qh, qw)
        gate = cv2.GaussianBlur(cv2.dilate(rawf, KG), (0, 0), 0.9).astype(np.float32) / 255.0
        small = np.clip(small * gate, 0, 255).astype(np.uint8)
        a = cv2.resize(small, (W, H), interpolation=cv2.INTER_LINEAR).astype(np.float32) / 255.0
        a = feather(clean(a, 5), feather_r)
        # مركز الكتلة على الربع (رخيصٌ ودقيقٌ بما يكفي): اللوحةُ تنزلق عكس الشخص،
        # فلا حافّةُ «قصٍّ» ولا جمودٌ فوتوغرافيُّ العين.
        sw = small.astype(np.float32) / 255.0
        wsum = float(sw.sum()) + 1e-6
        cx = float((sw * GX).sum()) / wsum / max(1, qw)
        cy = float((sw * GY).sum()) / wsum / max(1, qh)
        c = np.array([cx, cy], np.float32)
        prev_c = c if prev_c is None else prev_c * 0.82 + c * 0.18      # تهدئةُ المركز لا الشخص
        ox = int(pad_x + (0.5 - prev_c[0]) * parallax * W)
        oy = int(pad_y + (0.42 - prev_c[1]) * parallax * H * 0.6)
        bg = big[oy:oy + H, ox:ox + W]
        lat = np.clip((XS - (0.215 + 0.05 * float(np.clip(abs(0.5 - prev_c[0]), 0, 1)))) / 0.16, 0, 1)
        lat = np.clip(lat * (a > 0.12), 0, 1)                        # داخلُ القصّ فقط
        m = (0.82 * lat)[..., None]
        subj = grade_subject(fr, punch, 0.10)
        subj = chroma_cast(subj, bg, light)
        subj = np.clip(subj.astype(np.float32) * (1.0 - m) + bg.astype(np.float32) * m, 0, 255).astype(np.uint8)
        # سقوطُ البؤرة: أولُ أربعين بكسلاً داخل القصّ يُنعَّم، فيقرأ تسريبُ الباب
        # الضيّق كتأثيرِ عدسةٍ لا كغلطةِ قناع — وهو ما طلبه هو أصلاً: العمق. الوجه
        # والجذع داخل النطاق لا يمسّهما شيء، واليدُ تبقى حادّةً لأنّها وسطُ الشخص.
        inner = cv2.erode(small, KI).astype(np.float32) / 255.0
        soft = 1.0 - cv2.GaussianBlur(inner, (0, 0), 3.2)
        soft = np.clip(soft, 0, 1) * (small.astype(np.float32) / 255.0 > 0.35)
        soft = cv2.resize(soft, (W, H), interpolation=cv2.INTER_LINEAR)   # الربعُ حسابٌ، الكاملُ تلوين
        blurred = cv2.GaussianBlur(subj, (0, 0), 5.5).astype(np.float32)
        sb = (subj.astype(np.float32) * (1.0 - 0.85 * soft[..., None]) + blurred * (0.85 * soft[..., None]))
        subj = np.clip(sb, 0, 255).astype(np.uint8)
        au = (a * 255.0).astype(np.uint8)
        band = cv2.dilate(au, ko).astype(np.float32) - cv2.erode(au, ki).astype(np.float32)
        band = cv2.GaussianBlur(np.clip(band, 0, 255).astype(np.uint8), (0, 0), 3.0).astype(np.float32) / 255.0
        # تسريبُ الحافة: يبقى شريطٌ ضيّقٌ من الغرفة القديمة ملتصقاً بالرأس مهما دقّقنا
        # القناع (نموذجُ التقطيع يرى البابَ خلف أذنه جزءاً منه)، فنُذيبُ اللوحةَ داخل
        # عقدةِ القصّ نفسها: الحافةُ تصير تليّناً مقصوداً لا خطأً، ولا يمسّ جسدَه من
        # الداخل لأنّ النطاقَ لا يتجاوز عرضَ المورفولوجيا.
        edge = cv2.GaussianBlur(np.clip(cv2.dilate(au, ki) - cv2.erode(au, ki), 0, 255).astype(np.uint8), (0, 0), 2.2).astype(np.float32) / 255.0
        mm = (0.60 * edge)[..., None]
        subj = (subj.astype(np.float32) * (1.0 - mm) + bg.astype(np.float32) * mm).astype(np.uint8)
        bg = (bg.astype(np.float32) * (1.0 - 0.15 * band[..., None])).astype(np.uint8)
        out = (bg * (1 - a[..., None]) + subj * a[..., None]).astype(np.float32)
        # حدٌّ فاتحٌ رفيع داخل القصّ: هي أبخرةُ الفصل بين الجلد والجدار، وهي ما يجعل
        # اللقطةَ مُركَّبةً باحتراف بدل «ملصقٍ على خلفية».
        rim = np.clip(a - cv2.erode(au, ki).astype(np.float32) / 255.0, 0, 1)
        rim = cv2.GaussianBlur((rim * 255.0).astype(np.uint8), (0, 0), 1.6).astype(np.float32) / 255.0
        out += (rim[..., None] * np.float32([15, 11, 4]))
        out = np.clip(out, 0, 255).astype(np.uint8)
        enc.stdin.write(out.tobytes())
        i += 1
        if i % 150 == 0:
            print(f"    تركيب {i}/{n} · {(time.time()-t0)/i*1000:.0f} ms/لقطة", flush=True)
    dec.stdout.close(); dec.wait()
    enc.stdin.close(); enc.wait()
    return {"frames": i, "seconds": round(time.time() - t0, 1), "size": [W, H], "out": enc_path,
            "plate": plate_path or "auto", "peak_rss_mb": round(resource_rss(), 1)}


def resource_rss() -> float:
    import resource
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024


def main() -> int:
    global FF
    FF = os.environ.get("FFMPEG") or "ffmpeg"
    ap = argparse.ArgumentParser(description="قناعٌ على مرورين + لوحة مُصمَّمة + منظور.")
    ap.add_argument("--in", dest="src", required=True)
    ap.add_argument("--out", default="/tmp/stage")
    ap.add_argument("--plate", default="auto", help="auto = لوحةٌ مولّدة، أو مسار صورة")
    ap.add_argument("--fps", type=float, default=30.0)
    ap.add_argument("--parallax", type=float, default=0.05)
    ap.add_argument("--light", type=float, default=0.45, help="شفافية مطابقة اللون للّوحة")
    ap.add_argument("--punch", type=float, default=0.40)
    ap.add_argument("--feather", type=int, default=4)
    ap.add_argument("--qscale", type=int, default=4, help="مرور القناع على 1/qscale من الدقة")
    ap.add_argument("--keep-alphas", action="store_true")
    a = ap.parse_args()
    info = subprocess.run([FF, "-hide_banner", "-i", a.src], capture_output=True, text=True).stderr
    import re
    m = re.search(r"(\d{2,4})x(\d{3,4})", info)
    W, H = (int(m.group(1)), int(m.group(2))) if m else (1080, 1920)
    q = max(2, a.qscale)
    qw, qh = (W + q - 1) // q, (H + q - 1) // q
    if a.plate not in ("auto", "") and not os.path.exists(a.plate):
        raise SystemExit(f"✗ لا لوحة كهذه: {a.plate}")
    rep = stage(a.src, a.out, a.plate, a.fps, a.parallax, a.light, a.punch, a.feather, qw, qh)
    if not a.keep_alphas:
        subprocess.run(["rm", "-rf", os.path.join(a.out, "alphas")], check=False)
    print(json.dumps(rep, ensure_ascii=False, indent=1))
    return 0 if rep["frames"] > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
