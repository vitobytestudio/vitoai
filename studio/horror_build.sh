#!/usr/bin/env bash
# The horror beat, end to end: edit -> score -> master -> contact sheet.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source .toolenv
OUT=deliverables/horror-01-1080x1920.mp4

# the plate is pre-rendered in public/plates/ (the 3D rig that produced it no longer lives here)
[ -f public/plates/horror-plate.mp4 ] || { echo "missing public/plates/horror-plate.mp4" >&2; exit 3; }

npx remotion render src/index.ts Horror01 /tmp/horror-silent.mp4 --concurrency=2 --log=error

[ -f /tmp/horror.wav ] || node studio/score_horror.mjs /tmp/horror.wav

"$FFMPEG" -v error -y -i /tmp/horror-silent.mp4 -i /tmp/horror.wav \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.82:level=disabled" \
  -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT"

# a sheet of every half-second: the only honest way to review a 4-second film
"$FFMPEG" -v error -y -i "$OUT" -vf "fps=2,scale=200:-1,tile=4x3" /tmp/horror-sheet.png
ls -l "$OUT" | awk '{print $5" bytes "$9}'
"$FFMPEG" -v error -i "$OUT" 2>&1 | grep -E "Duration" || true
