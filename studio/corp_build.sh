#!/usr/bin/env bash
# «أسلوب الشركات» — مرحلتان، لأنّ رقماتِ الشاشة يجب أن تُقرأ من الصوت لا تُختلق:
#
#   STAGE=audio   يُنظِّفُ صوتَه (مرشّحاتٌ محسوبةٌ على أرضيّته)، يُولِّفُ موسيقى الفيلم
#                 بطولِه، ويكتب mix.json (مقياسُ LUFS/ذروةٌ حقيقية) ← ثم تُعادُ محاذاةُ
#                 الكابتشن فتظهر الأرقامُ المقاسةُ لا المُقدَّرة.
#   STAGE=master  يُلحِمُ صورة Remotion مع المازر، ويُصحِّحُ السمع إلى −14 LUFS بحلقة
#                 ebur128 (درسُ v1: loudnorm وحده يُنقص ~1.9 dB)، ويخرج ثلاث نُسخٍ
#                 موقّعةِ الألوان bt709/tv — لا yuvj420p القادمة من المتصفّح.
#
#   bash studio/corp_build.sh            # audio ثم master (يفترض أنّ PIC موجود)
#   STAGE=audio bash studio/corp_build.sh
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source .toolenv

STAGE=${STAGE:-all}
EDIT=${EDIT:-/tmp/corp}
SRC=${SRC:-$EDIT/cut.mp4}                      # المونتاج بصوتِه الأصليّ (كتلٌ على النَّفَس)
PIC=${PIC:-$EDIT/corp_v.mp4}                   # مخرج Remotion: الإطارُ + الرسومُ + الخطّ
OUT=${OUT:-deliverables/vito-corp-1080x1920.mp4}
WIDE=${WIDE:-deliverables/vito-corp-1920x1080.mp4}
COVER=${COVER:-deliverables/vito-corp-cover.jpg}
PROOF=${PROOF:-deliverables/vito-corp-framing-proof.jpg}
SHEET=${SHEET:-deliverables/vito-corp-sheet.jpg}
TARGET_I=${TARGET_I:--14}
WORK=/tmp/corpwork
W="$AIVENV/bin/python"
mkdir -p "$WORK" deliverables

TL=$EDIT/timeline.json
[ -s "$TL" ] || TL=src/phone/timeline.json

# ── 0 · الأطوالُ والمواضعُ من الملفات، لا من الذاكرة ──────────────────────────────
read -r DUR FRAMES PIC_FRAMES <<EOF2
$(python3 - "$TL" <<'PY'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
fps = float(d["fps"])
tot = d.get("total_frames", d["picture_frames"])
print(round(tot / fps, 3), round(fps * tot), d["picture_frames"])
PY
)
EOF2
echo "  الطول ${DUR}s · ${FRAMES} إطاراً · المرحلة ${STAGE}"

# ── 1 · تنظيفُ الصوت: أرضيّتُه هي المُعايرة ───────────────────────────────────────
if [ "$STAGE" = "audio" ] || [ "$STAGE" = "all" ]; then
  # أرضيةُ الضجيج من الملفّ نفسه: المئويّة 12 من غلاف RMS بعيّنات 8kHz — لا رقمٌ من وثيقة.
  FLOOR=$("$W" - "$SRC" <<'PYF'
import importlib.util, sys
import numpy as np
spec = importlib.util.spec_from_file_location("pr", "scripts/prune.py")
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
db, _ = m.envelope(sys.argv[1]); print(round(float(np.percentile(db, 12)), 1))
PYF
) || true
  case "$FLOOR" in -[0-9]*) : ;; *) FLOOR=-62 ;; esac
  NF=$(python3 -c "print(round(max(-72.0, float('$FLOOR') + 4.0), 1))")   # فوق الأرضية بأربعٍ: لا نأكلُ النَّفَس
  echo "  أرضيةُ الغلاف $(printf '%.1f' "$FLOOR") dBFS ← حدُّ الضجيج ${NF} dBFS"

  # (أ) معالجةُ التنظيف أولاً — بلا كسبٍ عشوائيّ
  FX=$WORK/voice_fx.wav
  "$FFMPEG" -v error -y -i "$SRC" -vn -ac 1 -ar 48000 \
    -af "highpass=f=74,lowpass=f=15500,adeclick,afftdn=nr=9:nf=${NF}:tn=1,\
equalizer=f=6400:t=q:w=1.2:g=-2.6,equalizer=f=2600:t=q:w=1.6:g=1.4,\
acompressor=threshold=0.20:ratio=2.0:attack=15:release=250,aresample=48000" \
    -t "$DUR" "$FX"
  # (ب) ثم مرورُ قياسٍ لـ loudnorm، ومرورٌ ثاني خطّيٌّ بالضبط — الكسبُ محسوبٌ لا مقدَّر،
  #     والصوتُ يستقرّ على −17 LUFS تحت الماستر، والمرّةُ الوحيدةُ التي يُلْمَسُ فيها الحدُّ.
  read -r MI ML MTP MTH MO <<EOF2
$(python3 - "$FX" <<'PYF'
import os, re, subprocess, sys
ff = os.environ["FFMPEG"]
t = subprocess.run([ff, "-hide_banner", "-i", sys.argv[1],
                    "-af", "loudnorm=I=-17:TP=-1.5:LRA=10:print_format=json", "-f", "null", "-"],
                   capture_output=True).stderr.decode("utf-8", "ignore")
g = lambda k: (re.search(r'"%s"\s*:\s*"([-0-9.na]+)"' % k, t) or [None, "-99.0"])[1]
print(g("input_i"), g("input_lra"), g("input_tp"), g("input_thresh"), g("target_offset"))
PYF
)
EOF2
  echo "  loudnorm خطّيٌّ: I=$MI · LRA=$ML · TP=$MTP · عتبة=$MTH"
  "$FFMPEG" -v error -y -i "$FX" \
    -af "loudnorm=I=-17:TP=-1.5:LRA=10:measured_I=${MI}:measured_LRA=${ML}:measured_TP=${MTP}:measured_thresh=${MTH}:offset=${MO}:linear=true:print_format=summary,\
alimiter=limit=0.89:level=disabled,aformat=sample_fmts=s16:channel_layouts=mono,aresample=48000" \
    -c:a pcm_s16le "$WORK/voice.wav"

  # ── 2 · طبقةُ الاستوديو: موسيقى الفيلم مُولَّدةٌ مع مواضعِ قطعِه ──────────────
  [ -s public/audio/corp/score.wav ] || "$W" scripts/score_corp.py --tl "$TL" --out public/audio/corp
  SCORE=$WORK/score.wav
  AMB=$WORK/amb.wav
  # ضجيجُ غرفةٍ مستمرٌ تحت القطع: القفزةُ في «هواء» المصدرِ الآخر هي ما يُفضحُ القصّ
  "$FFMPEG" -v error -y -stream_loop 5 -i public/audio/ambience.wav -t "$DUR" \
    -af "volume=0.10,aresample=48000" -ac 1 "$AMB"
  FADE_AT=$(python3 -c "print(round($DUR - 2.4, 2))")
  "$FFMPEG" -v error -y -i public/audio/corp/score.wav -i "$AMB" -filter_complex \
    "[0:a]volume=0.34[a0];[a0][1:a]amix=inputs=2:duration=longest,volume=2.0,\
afade=t=in:st=0:d=1.2,afade=t=out:st=${FADE_AT}:d=2.2,aformat=sample_fmts=s16:channel_layouts=stereo,aresample=48000[s]" \
    -map "[s]" -t "$DUR" -c:a pcm_s16le "$SCORE"

  # ── 3 · نقراتُ الكلمات: على مواضعِ الكلمات المقيسةِ لا على الإيقاع الموسيقي ────
  if [ -s src/phone/captions.json ]; then
    "$W" scripts/ticks.py --tl "$TL" --caps src/phone/captions.json --out "$WORK/ticks.wav" --gain 0.30 2>/dev/null \
      || "$W" scripts/ticks.py --out "$WORK/ticks.wav" --gain 0.30
  fi

  # ── 4 · المزجُ بخفضٍ جانبيٍّ من كلامه إلى الموسيقى ─────────────────────────────
  MIX=$WORK/mix_pre.wav
  if [ -s "$WORK/ticks.wav" ]; then
    "$FFMPEG" -v error -y -i "$WORK/voice.wav" -i "$SCORE" -i "$WORK/ticks.wav" -filter_complex \
      "[1:a][0:a]sidechaincompress=threshold=0.05:ratio=6:attack=30:release=420[duck];\
[0:a][2:a]amix=inputs=2:duration=longest,volume=1.75,aresample=48000[voct];\
[voct][duck]amix=inputs=2:duration=longest,volume=2.0,aresample=48000[m]" \
      -map "[m]" -t "$DUR" -c:a pcm_s16le "$MIX"
  else
    "$FFMPEG" -v error -y -i "$WORK/voice.wav" -i "$SCORE" -filter_complex \
      "[1:a][0:a]sidechaincompress=threshold=0.05:ratio=6:attack=30:release=420[duck];\
[0:a][duck]amix=inputs=2:duration=longest,volume=2.0,aresample=48000[m]" \
      -map "[m]" -t "$DUR" -c:a pcm_s16le "$MIX"
  fi
  touch "$MIX"

  # ── 5 · القياسُ يُكتب قبل أن يُقرأ: mix.json يغذّي copy_corp ────────────────────
  "$W" - "$MIX" "$EDIT/mix.json" <<'PY'
import json, re, subprocess, sys, os
mix, outp = sys.argv[1], sys.argv[2]
ff = os.environ["FFMPEG"]
p = subprocess.run([ff, "-hide_banner", "-i", mix, "-af",
                    "ebur128=peak=true", "-f", "null", "-"], capture_output=True)
txt = p.stderr.decode("utf-8", "ignore")
def grab(k):
    m = re.findall(rf"^\s*{k}:\s*(-?[0-9.]+)", txt, re.M)
    m = [x for x in m if x not in ("-inf", "inf")]
    return float(m[-1]) if m else None
d = {"input_i": grab("I"), "lra": grab("LRA"), "true_peak": grab("Peak")}
d = {k: (round(v, 2) if isinstance(v, float) else v) for k, v in d.items()}
json.dump(d, open(outp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("  ", "مقيسٌ: I", d["input_i"], "LUFS · ذروةٌ حقيقية", d["true_peak"], "dBTP")
PY
  echo "  ✔ $MIX · $EDIT/mix.json"
fi

# ── 5.5 · تتابعُ JPEG للصورة المُصحَّحة: الطبقةُ التي يقرأها Remotion إطاراً إطاراً
#        لا OffthreadVideo — خادمُ الاستخراجِ في صندوقٍ بناتين/3.GB يُغلق الطلبَ عند
#        إطاراتٍ بعينها بلا رسالة. التتابعُ يُلغي طبقةَ الفشلِ كلَّها. (مُستثنى من git)
PIC_SRC=${PIC_SRC:-$EDIT/edge.mp4}
if [ "$STAGE" = "frames" ] || [ "$STAGE" = "all" ]; then
  # لا يُعرَضُ إطارٌ فيه حرفٌ لا يملكُه خطٌّ مضمَّن: تعلّقُ العرضِ عند 588 كان حرفاً لا غير.
  if [ -x "$W" ]; then
    "$W" scripts/fontlint.py >/dev/null 2>&1 \
      || { echo "  ✗ fontlint: رمزٌ على الشاشة بلا وجهٍ يملكُه — راجِعْه قبل العرض:" >&2
           "$W" scripts/fontlint.py 2>/dev/null | grep "✗" | head -4 >&2; exit 5; }
    echo "  ✔ fontlint: كلُّ رمزٍ مغطّى بوجهٍ من fontData.ts"
  fi
  mkdir -p public/inbox/fr
  if [ -s public/inbox/fr/f0000.jpg ] && [ "$(ls public/inbox/fr | wc -l)" = "$PIC_FRAMES" ]; then
    echo "  ✔ public/inbox/fr موجودٌ ومطابقٌ ($(ls public/inbox/fr | wc -l) إطاراً)"
  else
    [ -s "$PIC_SRC" ] || { echo "✗ ناقص: $PIC_SRC — شغّل studio/edge.py أولاً" >&2; exit 2; }
    "$FFMPEG" -v error -y -i "$PIC_SRC" -vf "scale=1080:1920:flags=bicubic" -q:v 4 -start_number 0 public/inbox/fr/f%04d.jpg
    echo "  ✔ public/inbox/fr · $(ls public/inbox/fr | wc -l) إطاراً"
  fi
fi

# ── 6 · الماستر: تصحيحٌ مقيسٌ إلى الهدف، ولا نسخةٍ تحملُ وسومَ المتصفّح ──────────
if [ "$STAGE" = "master" ] || [ "$STAGE" = "all" ]; then
  [ -s "$PIC" ] || { echo "✗ ناقص: $PIC (شغّل remotion render أولاً)" >&2; exit 3; }
  MIX=${MIX:-$WORK/mix_pre.wav}
  [ -s "$MIX" ] || { echo "✗ ناقص: $MIX — شغّل STAGE=audio" >&2; exit 3; }
  CUR=$MIX
  for it in 1 2 3; do
    read -r I TP <<EOF3
$(python3 - "$CUR" <<'PY'
import os, re, subprocess, sys
ff = os.environ["FFMPEG"]
p = subprocess.run([ff, "-hide_banner", "-i", sys.argv[1], "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True)
t = p.stderr.decode("utf-8", "ignore")
def g(k):
    m = re.findall(rf"^\s*{k}:\s*(-?[0-9.]+|\-inf)", t, re.M)
    v = [x for x in m if x not in ("-inf", "inf")]
    return float(v[-1]) if v else None
print(g("I"), g("Peak"))
PY
)
EOF3
    if [ "$I" = "None" ]; then echo "  ✗ تعذّرَ قياسُ ebur128 — لا تصحيحَ أعمى" >&2; exit 4; fi
    G=$(python3 -c "print(round(max(-9.0, min(9.0, $TARGET_I - $I)), 2))")
    echo "  تصحيحُ $it: I=$I dB ← كسبٌ ${G} dB (ذروة $TP)"
    if python3 -c "import sys; sys.exit(0 if abs($I - $TARGET_I) < 0.25 else 1)"; then break; fi
    "$FFMPEG" -v error -y -i "$CUR" -af "volume=${G}dB,alimiter=limit=0.80:level=disabled,aresample=48000" \
      -c:a pcm_s16le "$WORK/mix_fix$it.wav"
    CUR=$WORK/mix_fix$it.wav
  done
  # ترميزٌ بمُعدّلٍ مُحكَمٍ لا CRF مفتوح: الماسترُ يُرفع إلى منصّةٍ، والحجمُ جزءٌ من التسليم
  "$FFMPEG" -v error -y -i "$PIC" -i "$CUR" -map 0:v:0 -map 1:a:0 -c:v libx264 -preset medium \
    -b:v 5200k -maxrate 6800k -bufsize 11M \
    -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
    -c:a aac -b:a 192k -ar 48000 -ac 2 -movflags +faststart -shortest "$OUT"
  # نسخةٌ عريضة: الصورةُ في الوسط وحوافُّها مُغلَّطةٌ خلفَها (لا قصَّ للمحتوى)
  "$FFMPEG" -v error -y -i "$OUT" -vf "split=2[bg][fg];[bg]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,gblur=sigma=32,eq=brightness=-0.06[b];\
[fg]scale=-2:1080[p];[b][p]overlay=(W-w)/2:0,setsar=1" -c:v libx264 -preset medium -b:v 5400k -maxrate 7000k -bufsize 10M \
    -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
    -c:a copy -movflags +faststart "$WIDE"
  # غلافٌ + ورقةُ فحصٍ + صورةُ إثباتِ «التأطيرُ حادٌّ والأطرافُ لينة»
  CVF=$(python3 - "$TL" <<'PY'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
print(int(d["picture_frames"] * 0.55))
PY
)
  "$FFMPEG" -v error -y -i "$OUT" -vf "select=eq(n\\,$CVF),scale=1080:1920" -frames:v 1 -q:v 3 "$COVER" || true
  "$FFMPEG" -v error -y -i "$OUT" -vf "fps=2,scale=216:-1,tile=6x10" -frames:v 1 -q:v 4 "$SHEET" || true
  "$FFMPEG" -v error -y -ss "$(python3 -c "print(round($CVF/30,3))")" -i "$SRC" -frames:v 1 -vf "scale=720:1280" "$WORK/raw_frame.png"
  "$FFMPEG" -v error -y -ss "$(python3 -c "print(round($CVF/30,3))")" -i "$OUT" -frames:v 1 -vf "scale=720:1280" "$WORK/cut_frame.png"
  "$W" - "$WORK/raw_frame.png" "$WORK/cut_frame.png" "$PROOF" <<'PY' || true
import sys, cv2, numpy as np
raw, cut, outp = sys.argv[1], sys.argv[2], sys.argv[3]
def sharp(im):
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(g, cv2.CV_32F).var())
A, B = cv2.imread(raw), cv2.imread(cut)
if A is None or B is None:
    raise SystemExit(0)
h = 1100
A = cv2.resize(A, (int(A.shape[1] * h / A.shape[0]), h)); B = cv2.resize(B, (int(B.shape[1] * h / B.shape[0]), h))
def band_stats(im):
    H, Wd = im.shape[:2]
    core = im[int(H * 0.18):int(H * 0.74), int(Wd * 0.18):int(Wd * 0.82)]
    side = np.hstack([im[:, :int(Wd * 0.06)], im[:, int(Wd * 0.94):]])
    return sharp(core), sharp(side)
ca, sa = band_stats(A); cb, sb = band_stats(B)
strip = np.hstack([A, np.full((h, 12, 3), 255, np.uint8), B])
cv2.putText(strip, "SOURCE", (24, 52), cv2.FONT_HERSHEY_SIMPLEX, 1.3, (255, 255, 255), 3)
cv2.putText(strip, "CORP PASS", (A.shape[1] + 36, 52), cv2.FONT_HERSHEY_SIMPLEX, 1.3, (255, 255, 255), 3)
cv2.rectangle(strip, (int(0.18 * A.shape[1]), int(0.18 * h)), (int(0.82 * A.shape[1]), int(0.74 * h)), (255, 255, 255), 2)
cv2.rectangle(strip, (A.shape[1] + int(0.18 * B.shape[1]) + 12, int(0.18 * h)),
              (A.shape[1] + int(0.82 * B.shape[1]) + 12, int(0.74 * h)), (80, 160, 255), 2)
foot = np.full((150, strip.shape[1], 3), 10, np.uint8)
lines = [f"SHARPNESS  core: {ca:.1f} -> {cb:.1f}   edges: {sa:.1f} -> {sb:.1f}",
         f"CORE/EDGE RATIO  source {ca/max(sa,1e-6):.2f}x  ->  after {cb/max(sb,1e-6):.2f}x",
         "blur weight is identically 0 inside the core (studio/edge.py:weight_map) - measured in edge.json"]
for i, t in enumerate(lines):
    cv2.putText(foot, t, (26, 40 + i * 38), cv2.FONT_HERSHEY_SIMPLEX, 0.72, (235, 240, 250), 2)
cv2.imwrite(outp, np.vstack([strip, foot]), [cv2.IMWRITE_JPEG_QUALITY, 90])
print("  ✔", outp)
PY
  echo "  ✔ $OUT"
  "$FFMPEG" -i "$OUT" 2>&1 | grep -E "Duration|Stream" | sed 's/^/     /'
fi
