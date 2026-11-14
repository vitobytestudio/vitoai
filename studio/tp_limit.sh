#!/bin/bash
# الحلقةُ الأخيرةُ من الماستر: الذروةُ الحقيقيةُ تُقاسُ بعدَ ترميز AAC لا قبله.
# الترميزُ يعيدُ بناءَ تجاوزاتِ ما بينَ العينات، فخفضُ الكسبِ الثابتُ يُنقصُ LUFS
# ولا يلمسُ dBTP بما يكفي. لذا: كسبٌ استرجاعيٌّ صغير، ثم سقفُ limiter يُعدَّلُ من
# القياسِ نفسه، حتى dBTP ≤ −1.0 و I ضمنَ −14 ± 0.45. إن لم يتحقّق الهدفُ لا يُلغى
# الوعدُ على الشاشة بل يُصحَّح: تُكتَبُ القيمةُ المقيسة.
cd "$(dirname "$0")/.." && source .toolenv
OUT=${OUT:-deliverables/vito-corp-1080x1920.mp4}
TL=${TL:-/tmp/corp/timeline.json}
L=/tmp/corpwork
mkdir -p "$L"
TP_T=${TP_T:--1.0}
I_T=${I_T:--14}
CUR=$OUT
measure() {
  read -r I TP <<EOF1
$(python3 - "$1" <<'PYF'
import os, re, subprocess, sys
ff = os.environ["FFMPEG"]
t = subprocess.run([ff, "-hide_banner", "-i", sys.argv[1], "-af", "ebur128=peak=true", "-f", "null", "-"],
                  capture_output=True).stderr.decode("utf-8", "ignore")
def g(k):
    m = re.findall(r"^\s*%s:\s*(-?[0-9.]+)" % k, t, re.M)
    m = [x for x in m if x not in ("-inf", "inf")]
    return m[-1] if m else "None"
print(g("I"), g("Peak"))
PYF
)
EOF1
}
LIM=${LIM:-0.74}
for it in 1 2 3 4; do
  measure "$CUR"
  echo "  محاولةُ $it: I=${I} · TP=${TP} · سقفُ الحدّ ${LIM}"
  if python3 -c "import sys; sys.exit(0 if (float('$TP') <= $TP_T and abs(float('$I') - $I_T) <= 0.45) else 1)"; then
    echo "  ✔ مقبولٌ قياسيّاً"; break
  fi
  NEED=$(python3 -c "print(round(max(0.0, float('$TP') - ($TP_T) + 0.15), 2))")
  GAIN=$(python3 -c "print(round(min(1.6, max(0.0, ($I_T) - float('$I') + float('$NEED'))), 2))")
  LIM=$(python3 -c "print(round(max(0.55, min(0.95, float('$LIM') * 10 ** (-float('$NEED') / 20))), 4))")
  echo "      خفضُ ذروةٍ ${NEED} dB · كسبٌ استرجاعيٌّ ${GAIN} dB · سقفٌ جديد ${LIM}"
  "$FFMPEG" -v error -y -i "$OUT" -vn -af "volume=${GAIN}dB,alimiter=limit=${LIM}:level=disabled,aresample=48000" \
    -c:a aac -b:a 192k -ar 48000 -ac 2 "$L/aud_fix$it.m4a"
  "$FFMPEG" -v error -y -i "$OUT" -i "$L/aud_fix$it.m4a" -map 0:v:0 -map 1:a:0 -c:v copy -c:a copy \
    -movflags +faststart "$L/mk$it.mp4"
  CUR=$L/mk$it.mp4
done
measure "$CUR"
if python3 -c "import sys; sys.exit(0 if (float('$TP') <= $TP_T and abs(float('$I') - $I_T) <= 0.45) else 1)"; then
  cp "$CUR" "$OUT"; echo "  ✔ مُثبَّت: I=${I} LUFS · TP=${TP} dBTP"
else
  echo "  ✗ لم يبلغْ أهدافَه (I=${I} · TP=${TP}) — تُرِكَ الماسترُ كما هو" >&2
fi
python3 - "$I" "$TP" "$OUT" <<'PYF'
import json, os, re, subprocess, sys
i, tp, out = sys.argv[1], sys.argv[2], sys.argv[3]
d = subprocess.run([os.environ["FFMPEG"], "-hide_banner", "-i", out], capture_output=True)
m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", d.stderr.decode("utf-8", "ignore"))
secs = round(int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3)), 3) if m else 0
p = "/tmp/corp/mix.json"
j = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}
j.update({"final_I_lufs": round(float(i), 2), "final_true_peak_dbtp": round(float(tp), 2),
          "target_I_lufs": -14.0, "target_true_peak_dbtp": -1.0,
          "final_duration_s": secs, "verified_on": os.path.basename(out)})
os.makedirs(os.path.dirname(p), exist_ok=True)
json.dump(j, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("  ✔ mix.json · I=%s · TP=%s" % (j["final_I_lufs"], j["final_true_peak_dbtp"]))
PYF
