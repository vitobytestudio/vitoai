#!/usr/bin/env bash
# «المقطع الفخم» — ماسترُ الإعادة: الصورة من studio/stage.py، والخطُّ من PhonePro،
# والصوتُ من اللقطة نفسها + نقراتٍ على مواضع الكلمات المقيسة.
#
#   bash studio/phonepro_build.sh
#
# كلُّ رقمٍ صوتيٍّ هنا مأخوذٌ من الملفّ: مواضعُ القطع من timeline.json، ومواضعُ
# الكلمات من captions.json (أنويّاتُ القياس)، والسقفُ −14 LUFS هو بيتُ الاستوديو.
# دروسٌ مدفوعة الثمن محفوظة من build v1: المزجُ بـ -t لا -shortest؛ amix يقسّم على
# عدد المصادر ف نُضاعف في كل خطوة؛ loudnorm يُخرج 192kHz فَنُعيدُ العيّنة أخيراً؛
# و alimiter يرفع المستوى وحده إن لم نُلغِ level.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source .toolenv

EDIT=${EDIT:-/tmp/edit3}
SRC=${SRC:-$EDIT/cut.mp4}            # صوتُه المونتاجي (المقاطع مُلحَمة بترتيبها)
PIC=${PIC:-$EDIT/pro_v.mp4}          # مخرج Remotion: اللوحة + الرسوم + الخط
OUT=${OUT:-deliverables/vito-phonepro-1080x1920.mp4}
WIDE=${WIDE:-deliverables/vito-phonepro-1920x1080.mp4}
PLATE=${PLATE:-deliverables/vito-phonepro-plate-1080x1920.mp4}
mkdir -p deliverables /tmp/phonepro

for f in "$SRC" "$PIC"; do
  [ -s "$f" ] || { echo "✗ ناقص: $f" >&2; exit 3; }
done

# ── 0 · أطوالٌ ومواضعُ من الحقيقة، لا من الذاكرة ─────────────────────────────────
TL=$EDIT/timeline.json
[ -s "$TL" ] || TL=src/phone/timeline.json
read -r DUR CUTS_CSV <<EOF2
$(python3 - "$TL" <<'PY'
import json,sys
d=json.load(open(sys.argv[1],encoding="utf-8"))
fps=d["fps"]; lead=d.get("lead_frames",0)
cs=[lead]+[lead+int(c) for c in d["cut_frames"]]+[lead+int(d["picture_frames"])]
print(round(d["total_frames"]/fps,3), " ".join(f"{c/fps:.3f}" for c in cs))
PY
)
EOF2
IFS=' ' read -r -a HITS_T <<< "$CUTS_CSV"
echo "  الطول ${DUR}s · مواضع القطع: ${CUTS_CSV}"

# ── 1 · درجةٌ من لوحة الاستوديو: لا مقطوعة مرخّصة، فلا شبكة ولا حقّ ──────────────
FADE_OUT=$(python3 -c "print(round($DUR - 2.6, 2))")
RISER_AT=$(python3 -c "print(round($DUR - 5.0, 2))")
BED=/tmp/phonepro/bed.wav
"$FFMPEG" -v error -y -stream_loop 3 -i public/audio/bed.wav -t "$DUR" \
  -af "volume=0.32,afade=t=in:st=0:d=1.4,afade=t=out:st=${FADE_OUT}:d=2.4,aresample=48000" -ac 1 "$BED"
AMB=/tmp/phonepro/amb.wav
"$FFMPEG" -v error -y -stream_loop 3 -i public/audio/ambience.wav -t "$DUR" \
  -af "volume=0.15,aresample=48000" -ac 1 "$AMB"
"$FFMPEG" -v error -y -i "$BED" -i "$AMB" -filter_complex \
  "[0:a][1:a]amix=inputs=2:duration=longest,volume=2.0" -t "$DUR" /tmp/phonepro/score.wav

# ضربةُ الفاتحة عند مدخل الصورة، ومنحطَّاتٌ على كلِّ قطع، وصعودٌ ينتهي عند البطاقة
i=0
last=$((${#HITS_T[@]} - 1))
for at in "${HITS_T[@]}"; do
  i=$((i+1))
  vol=0.46
  file=whoosh.wav
  if [ "$i" = "1" ]; then file=impact.wav; vol=0.58; fi
  if [ "$i" = "$last" ]; then file=shimmer.wav; vol=0.50; fi
  ms=$(awk "BEGIN{printf \"%d\", $at*1000}")
  "$FFMPEG" -v error -y -i /tmp/phonepro/score.wav -i "public/audio/$file" -filter_complex \
    "[1:a]volume=$vol,adelay=$ms|$ms[h];[0:a][h]amix=inputs=2:duration=longest,volume=2.0" \
    -t "$DUR" /tmp/phonepro/score2.wav && mv /tmp/phonepro/score2.wav /tmp/phonepro/score.wav
done
"$FFMPEG" -v error -y -i /tmp/phonepro/score.wav -i public/audio/riser.wav -filter_complex \
  "[1:a]volume=0.55,adelay=$(awk "BEGIN{printf \"%d\", $RISER_AT*1000}")|$(awk "BEGIN{printf \"%d\", $RISER_AT*1000}")[r];[0:a][r]amix=inputs=2:duration=longest,volume=2.0" \
  -t "$DUR" /tmp/phonepro/score2.wav && mv /tmp/phonepro/score2.wav /tmp/phonepro/score.wav

# ── 2 · كلامُه، ثم النقراتُ على مواضع كلماته، ثم الماستر ────────────────────────
"$FFMPEG" -v error -y -i "$SRC" \
  -af "highpass=f=78,acompressor=threshold=0.10:ratio=2.4:attack=12:release=240,volume=1.5" \
  -ac 1 -ar 48000 /tmp/phonepro/voice.wav
"$FFMPEG" -v error -y -i /tmp/phonepro/voice.wav -i /tmp/phonepro/score.wav \
  -filter_complex "[1:a][0:a]sidechaincompress=threshold=0.05:ratio=6:attack=30:release=420[duck];\
[duck]volume=1.35[s];[0:a]volume=1.9[v];[v][s]amix=inputs=2:duration=longest:dropout_transition=0,aresample=48000" \
  -t "$DUR" -ar 48000 -ac 2 /tmp/phonepro/mix.wav
# النقراتُ تُضاف بعد الانخفاض الجانبي لا قبله: هي تتبعُ الكلمة الظاهرة، وإخفاؤها تحت
# صوتِه يُلغي الغرض منها — فهي إيقاعٌ مرئيٌّ مسموع، لا خلفية.
if [ -s "$EDIT/ticks.wav" ]; then
  "$FFMPEG" -v error -y -i /tmp/phonepro/mix.wav -i "$EDIT/ticks.wav" -filter_complex \
    "[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=0,volume=2.0" \
    -t "$DUR" -ar 48000 -ac 2 /tmp/phonepro/mix2.wav && mv /tmp/phonepro/mix2.wav /tmp/phonepro/mix.wav
  echo "  ✔ نُقراتٌ على الكلمات مُمزوجة"
fi

# ── 3 · مستوى الاستوديو: قياسٌ ثم كسبٌ خطيّ صريح ────────────────────────────────
"$FFMPEG" -hide_banner -filters > /tmp/phonepro/filters.txt 2>&1
if grep -q " loudnorm " /tmp/phonepro/filters.txt; then
  "$FFMPEG" -hide_banner -nostats -i /tmp/phonepro/mix.wav \
    -af "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json" -f null - 2> /tmp/phonepro/measure.txt || true
  M=$(python3 scripts/loudnorm_measure.py /tmp/phonepro/measure.txt || true)
  if [ -n "$M" ]; then
    G=${M#gain=}
    NORM="volume=${G}dB,alimiter=limit=0.82:level=disabled"
    echo "  كسبٌ محسوب: ${G} dB"
  else
    echo "  ⚠ لم يُقرأ json القياس — نمضي على أحاديّ" >&2
    NORM="loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.82:level=disabled"
  fi
else
  echo "  ⚠ لا loudnorm في هذا البناء — نكتفي بالمانع" >&2
  NORM="alimiter=limit=0.82:level=disabled"
fi

"$FFMPEG" -v error -y -i "$PIC" -i /tmp/phonepro/mix.wav -map 0:v -map 1:a -t "$DUR" \
  -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p \
  -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 168k -ar 48000 -af "$NORM" -movflags +faststart "$OUT"

# ── 3b · تصحيحٌ ثانٍ ببوابة الاستوديو نفسها ────────────────────────────────────
# Kسبُ loudnorm يُحسَب بسقفِ True-Peak عنده −1.5، فبقي الماستر تحت الهدف بدرجتين.
# المقياسُ المعتمد هنا هو ebur128 (نفس تعريف −14 الذي نضبط عليه)، فلا نجادل الفرق
# بين بوابتَين — نقيسُ على البوابة التي سيُراجَع بها، ونُصلِح مرّتين كحدٍّ أقصى.
for it in 1 2; do
  M=$("$FFMPEG" -hide_banner -nostats -i "$OUT" -af "ebur128=peak=true" -f null - 2>&1 \
       | grep -A5 "Summary:" | grep "I:" | awk '{print $2}' | head -1 || true)
  case "$M" in -*) ;; *) echo "  ⚠ لم يُقرأ ebur128 (المخرج: '$M')"; break;; esac
  D=$(python3 -c "d = -14.0 - float('$M'); print(round(d, 2) if abs(d) > 0.4 else 0)")
  [ "$D" = "0" ] && { echo "  ✔ المستوى على الهدف: ${M} LUFS (تصحيحٌ بعد $((it-1)))"; break; }
  echo "  تصحيح $it: ${M} → ${D} dB"
  "$FFMPEG" -v error -y -i /tmp/phonepro/mix.wav \
    -af "volume=${D}dB,alimiter=limit=0.80:level=disabled" -ar 48000 -ac 2 /tmp/phonepro/mixc.wav
  cp /tmp/phonepro/mixc.wav /tmp/phonepro/mix.wav
  # لا copy هنا: مخرجُ Remotion يأتى yuvj420p(pc, bt470bg) بلا بطاقةٍ صحيحة، ونسخُه
  # يُسلِّم للهاتف صورةً باهتة. نُعيد الترميز ببطاقات bt709/narrow صريحة — نفسُ السطر
  # الذي علّمنا درسَه في المَرّة الماضية.
  "$FFMPEG" -v error -y -i "$PIC" -i /tmp/phonepro/mix.wav -map 0:v -map 1:a -t "$DUR" \
    -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p \
    -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
    -c:a aac -b:a 168k -ar 48000 -movflags +faststart "$OUT"
done

# ── 4 · نسخةٌ أفقية بهامشٍ ضبابي (لا قصَّ على وجه) ───────────────────────────────
"$FFMPEG" -v error -y -i "$OUT" -filter_complex \
  "[0:v]split=2[bg][fg];[bg]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,gblur=sigma=34,eq=brightness=-0.06[b];\
   [fg]scale=-1:1080[f];[b][f]overlay=(W-w)/2:0,format=yuv420p,setsar=1" \
  -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p \
  -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a copy -movflags +faststart "$WIDE"

# ── 5 · نسخةُ «اللوحة وحدها»: بلا خطٍّ ولا رسوم، ليرى أثرَ القناع وحده ──────────
if [ -s "$EDIT/stage.mp4" ]; then
  "$FFMPEG" -v error -y -i "$EDIT/stage.mp4" -i /tmp/phonepro/voice.wav \
    -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 168k -ar 48000 \
    -af "loudnorm=I=-16:TP=-1.5:LRA=11" -shortest -movflags +faststart "$PLATE"
fi

# ── 6 · المراجعة: لا يُسلَّم ماستر بلا ورقة إطارات وقياسِ صوت ────────────────────
for m in "$OUT" "$WIDE" "$PLATE"; do
  [ -s "$m" ] || continue
  b=$(basename "$m" .mp4)
  "$FFMPEG" -v error -y -i "$m" -vf "fps=2,scale=216:-1,tile=6x10" "/tmp/phonepro/$b-sheet.jpg" 2>/dev/null || true
  echo "── $b"
  "$FFMPEG" -hide_banner -nostats -i "$m" -af "ebur128=peak=true" -f null - 2>&1 \
    | grep -A5 "Summary:" | grep -E "I:|LRA:|Peak:" | tr -s ' ' | sed 's/^/   /' || true
  "$FFMPEG" -hide_banner -i "$m" 2>&1 | grep -E "Duration" | sed 's/^/  /' || true
  ls -l "$m" | awk '{print "   "$5" بايت"}' || true
done
echo "✔ النسخ: $OUT · $WIDE · $PLATE"
