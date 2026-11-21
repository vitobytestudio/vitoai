#!/usr/bin/env bash
# make-film.sh — render the product film WITH its score.
#
# The silent render is never a deliverable. Sound is generated from the same cue
# sheet the picture is cut from, then merged and normalised to -14 LUFS.
set -euo pipefail
cd "$(dirname "$0")/.."
source .toolenv

ID="${1:-ProductFilm}"
BRIEF="${2:-github}"
OUT="${3:-deliverables/product-gh-sound-1080x1920.mp4}"
TMP=$(mktemp -d)

echo "1/4  cue sheet"
cat > "$TMP/cues.mts" <<EOF
import { planProduct, cueSheet } from "/home/user/vitoai/src/studio/productplan";
const p = planProduct("$BRIEF");
console.log(JSON.stringify({ beats: cueSheet(p), accent: p.accent }));
EOF
cp "$TMP/cues.mts" ./cues.mts
npx esbuild ./cues.mts --bundle --platform=node --format=esm --outfile="$TMP/cues.mjs" --log-level=error
node "$TMP/cues.mjs" > "$TMP/cues.json"
rm -f ./cues.mts

echo "2/4  picture"
npx remotion render src/index.ts "$ID" "$TMP/picture.mp4" --concurrency=2 --log=error

echo "3/4  score"
node studio/score.mjs "$TMP/cues.json" "$TMP/score.wav"

echo "4/4  mix"
"$FFMPEG" -y -hide_banner -loglevel error -i "$TMP/picture.mp4" -i "$TMP/score.wav" \
  -map 0:v -map 1:a -c:v copy -af "loudnorm=I=-14:TP=-1.5:LRA=11" \
  -ar 48000 -c:a aac -b:a 192k -shortest "$OUT"

"$FFMPEG" -hide_banner -i "$OUT" 2>&1 | grep -E "Duration|Audio" || true
ls -lh "$OUT" | awk '{print "  " $5, $9}'
rm -rf "$TMP"
