"""A/B على إطارٍ واحد: المصدر مقابل تمريرة الإطار، مع خريطةِ الفرق مضروبةً ×4."""
import cv2
import numpy as np
import sys

src, edge, frame, outp = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
a = cv2.imread(src)
cap = cv2.VideoCapture(edge)
cap.set(cv2.CAP_PROP_POS_FRAMES, frame)
ok, b = cap.read()
cap.release()
assert a is not None and b is not None, "قراءةٌ فاشلة"
d = cv2.absdiff(a, b).max(axis=2)
core = d[int(a.shape[0] * 0.22):int(a.shape[0] * 0.80), int(a.shape[1] * 0.16):int(a.shape[1] * 0.84)]
print(f"الفرقُ كلُّه: متوسّط {d.mean():.2f}/255 · p99 {np.percentile(d, 99):.1f} · أقصى {d.max():.0f}")
print(f"الفرقُ داخل النواة: متوسّط {core.mean():.3f} · أقصى {core.max():.0f}   ← يجب أن يكون صغيراً جداً")
print(f"مساحةُ التغيّر (>6): {100 * float((d > 6).mean()):.1f}% من الإطار")
h = 820
W = int(a.shape[1] * h / a.shape[0])
dd = cv2.resize(np.clip(d * 4, 0, 255).astype(np.uint8), (W, h))
panel = np.hstack([cv2.resize(a, (W, h)), np.full((h, 10, 3), 255, np.uint8),
                   cv2.resize(b, (W, h)), np.full((h, 10, 3), 255, np.uint8),
                   cv2.merge([dd, dd, dd])])
for i, t in enumerate([f"SOURCE f{frame}", f"EDGE f{frame}", "DIFF x4"]):
    cv2.putText(panel, t, (22 + i * (W + 10), 44), cv2.FONT_HERSHEY_SIMPLEX, 1.05, (255, 255, 255), 3)
cv2.imwrite(outp, panel, [cv2.IMWRITE_JPEG_QUALITY, 88])
print("wrote", outp, panel.shape)
