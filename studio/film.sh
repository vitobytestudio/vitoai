#!/usr/bin/env bash
# film.sh — one decision in, one deliverable out.
#
#   studio/film.sh /tmp/dec.json deliverables/name.mp4
#
# The picture comes from the same component the studio previews with; the score
# is generated from the same cue sheet the picture is cut from, so an impact and
# a cut are the same second and cannot drift. Normalised to -14 LUFS, which is
# what a phone expects.
set -euo pipefail
cd "$(dirname "$0")/.."
source .toolenv

PROPS="${1:?props json}"
OUT="${2:?output mp4}"
TMP=$(mktemp -d)

echo "1/3  cue sheet"
node -e "
const d = require('$PROPS').decision;
const beats = [];
let t = 0;
for (const b of d.beats) { beats.push({ kind: b.kind, start: +t.toFixed(3), seconds: b.seconds, transition: b.transition }); t += b.seconds; }
require('fs').writeFileSync('$TMP/cues.json', JSON.stringify({ beats, accent: d.accent }));
console.log('   ', beats.length, 'cues,', t.toFixed(2), 's');
"

echo "2/3  picture"
npx remotion render src/index.ts AgentFilm "$TMP/picture.mp4" --props="$PROPS" --concurrency=2 --log=error

echo "3/3  score + mix"
node studio/score.mjs "$TMP/cues.json" "$TMP/score.wav"
"$FFMPEG" -y -hide_banner -loglevel error -i "$TMP/picture.mp4" -i "$TMP/score.wav" \
  -map 0:v -map 1:a -c:v copy -af "loudnorm=I=-14:TP=-1.5:LRA=11" \
  -ar 48000 -c:a aac -b:a 192k -shortest "$OUT"

"$FFMPEG" -hide_banner -i "$OUT" 2>&1 | grep -E "Duration|Stream" || true
ls -lh "$OUT" | awk '{print "  " $5, $9}'
rm -rf "$TMP"
