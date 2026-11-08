#!/usr/bin/env bash
# «الطابق الأخير» — the whole film, in one command.
#
#   pre-rendered plates -> edit -> score -> master -> deliverable + review sheet
#
# The loudness is already set inside the score (RMS ≈ −15, one peak at −4 that only the jump
# is allowed to have), so this mux just limits; no loudnorm. If the numbers below drift more
# than 2 dB from the house target, the score is wrong, not this line.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source .toolenv
OUT=${OUT:-deliverables/last-floor-1080x1920.mp4}
mkdir -p deliverables

# plates ship in public/plates/ (lf-*.jpg); the 3D rig that rendered them is gone from this repo
ls public/plates/lf-*.jpg >/dev/null 2>&1 || { echo "missing public/plates/lf-*.jpg" >&2; exit 3; }

npx remotion render src/index.ts LastFloor /tmp/lastfloor-silent.mp4 --concurrency=2 --log=error

[ -f /tmp/lastfloor.wav ] || node studio/score_lastfloor.mjs /tmp/lastfloor.wav

"$FFMPEG" -v error -y -i /tmp/lastfloor-silent.mp4 -i /tmp/lastfloor.wav \
  -af "alimiter=limit=0.83:level=disabled" \
  -c:v copy -c:a aac -b:a 160k -shortest -movflags +faststart "$OUT"

# review: one row of the film per 5 seconds, so a 30s cut is judged in a single look
"$FFMPEG" -v error -y -i "$OUT" -vf "fps=2,scale=216:-1,tile=6x10" /tmp/lastfloor-sheet.png
"$FFMPEG" -v error -i "$OUT" -af "astats=metadata=1:reset=0" -f null - 2>&1 \
  | grep -E "RMS level dB|Peak level dB" | tail -2 || true
"$FFMPEG" -v error -i "$OUT" 2>&1 | grep -E "Duration|Stream" || true
ls -l "$OUT" | awk '{print $5" bytes  "$9}'
