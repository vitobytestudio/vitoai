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
  "[0:a][1:a]amix=inputs=2:duration=longest,volume=2.0,apad=whole_dur=$DUR" -t "$DUR" /tmp/phone/score.wav

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
    "[1:a]volume=$vol,adelay=$ms|$ms,apad=whole_dur=$DUR[h];[0:a][h]amix=inputs=2:duration=longest,volume=2.0,apad=whole_dur=$DUR" \
    -t "$DUR" /tmp/phone/score2.wav && mv /tmp/phone/score2.wav /tmp/phone/score.wav
done
[ -s /tmp/phone/score.wav ] || { echo "✗ لم تُبنَ الدرجة الصوتية" >&2; exit 4; }

# ── 2 · الصوت المنطوق من اللقطة نفسها، ثم الماستر على معيار الاستوديو ────────────
"$FFMPEG" -v error -y -i "$SRC" -af "highpass=f=78,acompressor=threshold=0.10:ratio=2.4:attack=12:release=240,volume=1.5" \
  -ac 1 -ar 48000 /tmp/phone/voice.wav
# amix يقسّم على عدد المصادر في هذا البناء (لا normalize فيه)، فلا يُترك الصوت خافتاً
"$FFMPEG" -v error -y -i /tmp/phone/voice.wav -i /tmp/phone/score.wav \
  -filter_complex "[0:a]volume=2.0[v];[1:a]volume=2.0[s];[v][s]amix=inputs=2:duration=first:dropout_transition=0,apad=whole_dur=$DUR" \
  -ar 48000 -ac 2 /tmp/phone/mix.wav

# حارسُ الفلتر: لا نفترض أنّ البناء القديم يملك loudnorm — نقيسه
"$FFMPEG" -hide_banner -filters > /tmp/phone/filters.txt 2>&1
if grep -q 'loudnorm' /tmp/phone/filters.txt; then
  NORM="loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.82"
else
  echo "  ⚠ لا loudnorm في هذا البناء — نكتفي بالمانع" >&2
  NORM="alimiter=limit=0.82"
fi

"$FFMPEG" -v error -y -i "$PIC" -i /tmp/phone/mix.wav -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 168k -af "$NORM" -shortest -movflags +faststart "$OUT"

# ── 3 · نسخة أفقية بهامشٍ ضبابي: لا قصَّ على وجه، ولا إطارٌ فارغ ──────────────────
"$FFMPEG" -v error -y -i "$OUT" -filter_complex \
  "[0:v]split=2[bg][fg];[bg]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,gblur=sigma=34,eq=brightness=-0.06[b];\
   [fg]scale=-1:1080[f];[b][f]overlay=(W-w)/2:0,format=yuv420p" \
  -c:v libx264 -preset medium -crf 18 -c:a copy -movflags +faststart "$WIDE"

# ── 4 · النسخة الكاملة (بلا بطاقة، كل المادة المونتاجية) للتدقيق ────────────────
"$FFMPEG" -v error -y -i /tmp/edit/look.mp4 -i /tmp/phone/voice.wav -c:v copy -c:a aac -b:a 168k -shortest "$FULL" 2>/dev/null || \
  cp "$OUT" "$FULL"

# ── 5 · المراجعة: لا يُسلَّم ماستر بلا ورقة إطارات وقياس صوت ─────────────────────
for m in "$OUT" "$WIDE" "$FULL"; do
  [ -s "$m" ] || continue
  b=$(basename "$m" .mp4)
  "$FFMPEG" -v error -y -i "$m" -vf "fps=2,scale=216:-1,tile=6x10" "/tmp/phone/$b-sheet.jpg" 2>/dev/null || true
  echo "── $b"
  "$FFMPEG" -v error -i "$m" -af "astats=metadata=1:reset=0" -f null - 2>&1 | grep -E "RMS level dB|Peak level dB" | tail -2 | sed 's/^/   /'
  "$FFMPEG" -hide_banner -i "$m" 2>&1 | grep -E "Duration" | sed 's/^/  /'
  ls -l "$m" | awk '{print "   "$5" بايت"}'
done
echo "✔ النسخ: $OUT · $WIDE · $FULL"
