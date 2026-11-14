#!/usr/bin/env bash
# «المقطع الهاتفي» — من اللقطة الخام إلى ثلاث نسخ مُسلَّمة، بأمر واحد.
#
#   node studio/brief.mjs …            (اختياري: يقيس القطع والنَّفَس)
#   python3 studio/comp.py --video …   (القناع + تظليل الخلفية + التنعيم)  ← /tmp/edit/look.mp4
#   npx remotion render Phone …        (الخط والحركة)                      ← /tmp/edit/phone_v.mp4
#   bash studio/phone_build.sh         (الصوت + الماستر + ورقات المراجعة)   ← deliverables/
#
# كل رقم صوتي هنا مأخوذ من اللقطة نفسها: القطع على مواضع الصمت المقيسة، والسقف
# −14 LUFS هو بيت الاستوديو، لا رقم عشوائي.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source .toolenv

SRC=${SRC:-/tmp/edit/cut_raw.mp4}
PIC=${PIC:-/tmp/edit/phone_v.mp4}
OUT=${OUT:-deliverables/vito-phone-1080x1920.mp4}
WIDE=${WIDE:-deliverables/vito-phone-1920x1080.mp4}
FULL=${FULL:-deliverables/vito-phone-full-1080x1920.mp4}
mkdir -p deliverables /tmp/phone

for f in "$SRC" "$PIC"; do
  [ -s "$f" ] || { echo "✗ ناقص: $f" >&2; exit 3; }
done

# ── 1 · درجة صوتية من لوحة الاستوديو: لا مقطوعة مرخَّصة، فلا شبكة ولا حق ──────────
# الخلط تدريجي بطبقتين في كل مرة، لا رسمٌ عملاقٌ في سطر واحد: amix في هذا البناء
# يقسّم على عدد المصادر (لا خيار normalize فيه)، فتُردّ مضاعفةُ المستوى في كل خطوة —
# درجةٌ معروفة لكل طبقة، وخطأٌ واحد يُرى في ملفٍ واحد بدل أن يضيع في رسم بياني.
DUR=30.0
BED=/tmp/phone/bed.wav
"$FFMPEG" -v error -y -stream_loop 2 -i public/audio/bed.wav -t "$DUR" \
  -af "volume=0.34,afade=t=in:st=0:d=1.6,afade=t=out:st=27.6:d=2.3,aresample=48000" -ac 1 "$BED"
AMB=/tmp/phone/amb.wav
"$FFMPEG" -v error -y -stream_loop 2 -i public/audio/ambience.wav -t "$DUR" \
  -af "volume=0.16,aresample=48000" -ac 1 "$AMB"
"$FFMPEG" -v error -y -i "$BED" -i "$AMB" -filter_complex \
  "[0:a][1:a]amix=inputs=2:duration=longest,volume=2.0" -t "$DUR" /tmp/phone/score.wav

# مواضع القطع محسوبة من الإطارات المقيسة: 209 / 374 / 535 / 753 على 30 لقطة/ث
HITS=(
  "impact.wav:0.10:0.55"    # تحت ضربة الفاتحة
  "whoosh.wav:6.55:0.50"    # القصّ 1
  "whoosh.wav:12.05:0.50"   # القصّ 2
  "whoosh.wav:17.42:0.50"   # القصّ 3
  "whoosh.wav:24.68:0.55"   # القصّ 4 — الأخير أعلى قليلاً، إنه مدخل البطاقة
  "riser.wav:24.90:0.62"    # صعودٌ ينتهي عند البطاقة
  "shimmer.wav:27.50:0.48"  # الوميض على الاسم
)
for h in "${HITS[@]}"; do
  IFS=: read -r file at vol <<< "$h"
  ms=$(awk "BEGIN{printf \"%d\", $at*1000}")
  "$FFMPEG" -v error -y -i /tmp/phone/score.wav -i "public/audio/$file" -filter_complex \
    "[1:a]volume=$vol,adelay=$ms|$ms[h];[0:a][h]amix=inputs=2:duration=longest,volume=2.0" \
    -t "$DUR" /tmp/phone/score2.wav && mv /tmp/phone/score2.wav /tmp/phone/score.wav
done
[ -s /tmp/phone/score.wav ] || { echo "✗ لم تُبنَ الدرجة الصوتية" >&2; exit 4; }

# ── 2 · الصوت المنطوق من اللقطة نفسها، ثم الماستر على معيار الاستوديو ────────────
"$FFMPEG" -v error -y -i "$SRC" -af "highpass=f=78,acompressor=threshold=0.10:ratio=2.4:attack=12:release=240,volume=1.5" \
  -ac 1 -ar 48000 /tmp/phone/voice.wav
# amix يقسّم على عدد المصادر في هذا البناء (لا normalize فيه)، فلا يُترك الصوت خافتاً.
# والسرير ينخفض تحت كلامه لا تحت رقمٍ ثابت: sidechaincompress يُغذّى بالصوت نفسه،
# العتبة 0.05 والنسبة 6 — يتنفّس حين يسكت ويبتعد حين يتكلم، بلا مفتاحٍ ولا يد.
"$FFMPEG" -v error -y -i /tmp/phone/voice.wav -i /tmp/phone/score.wav \
  -filter_complex "[1:a][0:a]sidechaincompress=threshold=0.05:ratio=6:attack=30:release=420[duck];\
[duck]volume=1.35[s];[0:a]volume=1.9[v];[v][s]amix=inputs=2:duration=longest:dropout_transition=0,aresample=48000" \
  -t "$DUR" -ar 48000 -ac 2 /tmp/phone/mix.wav

# حارسُ الفلتر: لا نفترض أنّ البناء القديم يملك loudnorm — نقيسه
"$FFMPEG" -hide_banner -filters > /tmp/phone/filters.txt 2>&1
if grep -q " loudnorm " /tmp/phone/filters.txt; then
  # مرّتان، لا واحدة: القياسُ الأحادي يجرّب ويخطئ — خرج −9.1 LUFS على مزجٍ قصير، أي
  # أعلى من هدف البيت بخمسة ديسيبل، لأنه يعوّض ديناميكياً. نقيس أولاً ثم نُطبّق مكسباً
  # خطياً واحداً بالأرقام المقاسة: مستوى الاستوديو بلا ضغطٍ مُخبّأ ولا مفاجأة للمُراجِع.
  "$FFMPEG" -hide_banner -nostats -i /tmp/phone/mix.wav \
    -af "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json" -f null - 2> /tmp/phone/measure.txt || true
  M=$(python3 scripts/loudnorm_measure.py /tmp/phone/measure.txt || true)
  if [ -n "$M" ]; then
    G=${M#gain=}
    # كسبٌ خطيٌّ صريح بدل إعادةِ trustِ الفلتر بنفسه: −14 هو −14، والسقفُ محسوبٌ معه.
    NORM="volume=${G}dB,alimiter=limit=0.82:level=disabled"
    echo "  كسبٌ محسوب: ${G} dB (من −10.6 إلى −14، بسقف −1.5)"
  else
    echo "  ⚠ لم يُقرأ json القياس — نمضي على أحاديّ" >&2
    NORM="loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.82:level=disabled"
  fi
else
  echo "  ⚠ لا loudnorm في هذا البناء — نكتفي بالمانع" >&2
  NORM="alimiter=limit=0.82:level=disabled"
fi

# ثلاثُ دروسٍ من هذا السطر، وكلّها دفعت ثمنها مرة:
#  · duration=first كان يقطع الماستر إلى طول الصوت (27.57s)، فتنقص البطاقةُ كلها —
#    المزجُ يُمدّ إلى DUR ويُقصّ بـ -t، لا بـ -shortest؛
#  · loudnorm يرفع العيّنات إلى 192kHz ويُخرج AAC على 96kHz — بلا aresample أخير؛
#  · مخرج remotion يأتى yuvj420p/bt470bg (نطاق JPEG الكامل)، والهاتف يقرأه باهتاً —
#    إذن يُعاد ترميزه مع بطاقات bt709 ونطاق tv صريحة، لا copy أعمى.
"$FFMPEG" -v error -y -i "$PIC" -i /tmp/phone/mix.wav -map 0:v -map 1:a -t "$DUR" \
  -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p \
  -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 168k -ar 48000 -af "$NORM" -movflags +faststart "$OUT"

# ── 3 · نسخة أفقية بهامشٍ ضبابي: لا قصَّ على وجه، ولا إطارٌ فارغ ──────────────────
"$FFMPEG" -v error -y -i "$OUT" -filter_complex \
  "[0:v]split=2[bg][fg];[bg]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,gblur=sigma=34,eq=brightness=-0.06[b];\
   [fg]scale=-1:1080[f];[b][f]overlay=(W-w)/2:0,format=yuv420p,setsar=1" \
  -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p \
  -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a copy -movflags +faststart "$WIDE"

# ── 4 · النسخة الكاملة (بلا بطاقة، كل المادة المونتاجية) للتدقيق ────────────────
# نسخةٌ كاملة للتحقق: كل ما مرّ بالماسك، بلا بطاقة. يعاد ترميزه (crf 20) بدل copy —
# 31 ميغابايت من crf 15 لا تُهدر في المستودع لمراجعة، والمقياس الذي يهمّنا هو الصورة.
if [ -s /tmp/edit/look.mp4 ]; then
  "$FFMPEG" -v error -y -i /tmp/edit/look.mp4 -i /tmp/phone/voice.wav \
    -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 168k -ar 48000 \
    -af "loudnorm=I=-16:TP=-1.5:LRA=11" -shortest -movflags +faststart "$FULL"
else
  cp "$OUT" "$FULL"
fi

# ── 5 · المراجعة: لا يُسلَّم ماستر بلا ورقة إطارات وقياس صوت ─────────────────────
for m in "$OUT" "$WIDE" "$FULL"; do
  [ -s "$m" ] || continue
  b=$(basename "$m" .mp4)
  "$FFMPEG" -v error -y -i "$m" -vf "fps=2,scale=216:-1,tile=6x10" "/tmp/phone/$b-sheet.jpg" 2>/dev/null || true
  echo "── $b"
  # القياسُ المعتمد هو ebur128 (نفس تعريف −14 LUFS الذي نضبط عليه) — لا RMS الخام
  "$FFMPEG" -hide_banner -nostats -i "$m" -af "ebur128=peak=true" -f null - 2>&1 \
    | grep -A5 "Summary:" | grep -E "I:|LRA:|Peak:" | tr -s ' ' | sed 's/^/   /' || true
  "$FFMPEG" -hide_banner -i "$m" 2>&1 | grep -E "Duration" | sed 's/^/  /' || true
  ls -l "$m" | awk '{print "   "$5" بايت"}' || true
done
echo "✔ النسخ: $OUT · $WIDE · $FULL"
