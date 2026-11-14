# قواعد التسليم — VitoAI Motion Studio

## 🔒 القاعدة الثابتة (من اليوم فصاعداً)

**كل فيديو يُسلَّم عبر GitHub raw، حصراً.**

| # | الخطوة |
|---|---|
| 1 | الرندر يُخرج `out/master_video.mp4` |
| 2 | يُنسخ إلى `deliverables/vitoai-motion-master-1080x1920.mp4` |
| 3 | نسخة خفيفة (CRF 24) إلى `deliverables/vitoai-motion-1080x1920.mp4` |
| 4 | `git add -f deliverables/*.mp4 && git push` |
| 5 | أعطي المستخدم رابط `github.com/.../raw/...` مباشرة |

## لماذا GitHub raw؟

| الطريقة | النتيجة |
|---|---|
| سيرفر محلي `:8080` | ❌ لا يصل للمستخدم خارج البيئة |
| GitHub Releases | ❌ `uploads.github.com` محجوب |
| **GitHub raw في المستودع** | ✅ مثبت عملياً — نجح أول مرة |

الريبو عام (`vitobytestudio/vitoai`)، لذلك الروابط تعمل بدون توثيق.

## قالب الروابط

```
https://github.com/vitobytestudio/vitoai/raw/arena/c36750ba-vitoai/deliverables/<الملف>.mp4
```

## المواصفات الفنية المعتمدة

| | Master | Lite |
|---|---|---|
| الملف | `vitoai-motion-master-1080x1920.mp4` | `vitoai-motion-1080x1920.mp4` |
| الحجم | 31.8 MB | 9.2 MB |
| المقطع | 1080×1920 · 60fps · 22.23s · 1332 إطاراً | نفسه |
| الكوديك | H.264 High · CRF 18 · 11.7 Mbps | H.264 High · CRF 24 |
| الصوت | AAC 320k · −14.1 LUFS · −1.0 dBTP | AAC 160k |
| اللون | BT.709 · faststart | BT.709 · faststart |

## حجم الملف

GitHub يرفض أي ملف > 100 MB. كل الرندرات الحالية تحت 50 MB و آمنة.
إن تجاوز فيديو 100 MB مستقبلاً: يُقسَّم بـ`ffmpeg -f segment` أو تُرفع نسخة CRF أعلى.

## ⚙️ عند إعادة تشغيل البيئة

الأدوات تضيع، الأكواد والفيديوهات لا. **أمر واحد يستعيد كل شيء:**

```bash
./setup.sh          # ~60 ثانية
source .toolenv     # يضبط ffmpeg + chromium + المكتبات
```

ثم أي أمر رندر يعمل. لا حاجة لأي خطوة يدوية أخرى.

### ما يضيع وما يبقى

| يضيع | يبقى |
|---|---|
| `node_modules/` | `src/` كل الأكواد |
| Chromium + ffmpeg | `scripts/` |
| `out/` (نسخ الرندر) | `deliverables/` (الفيديوهات) |
| | **روابط GitHub** |

### الدروس المثبّتة في الكود

| العطل | الحل الدائم |
|---|---|
| `npm install --no-save` يحذف الأدوات الأخرى | الأدوات في `devDependencies` |
| مسار Chromium مثبّت في `remotion.config.ts` | يُقرأ من `.toolenv` |
| انقطاع TLS | `NODE_EXTRA_CA_CERTS` داخل `setup.sh` |

## سكربت التسليم الآلي

```bash
./publish.sh          # ينسخ الملفين، يعمل commit، يدفع، ويطبع الروابط
```
