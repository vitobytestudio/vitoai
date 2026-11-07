#!/usr/bin/env bash
# «الطابق الأخير» — Cycles frames to conformed plates for the trailer.
#
# Every shot is 24 fps (a toy film should have film cadence, not video), so each one is
# encoded at 24 and then *conformed* to 30 with motion-compensated interpolation: the
# editor cuts at 30 and the picture never repeats a frame.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source .toolenv
SRC=${SRC:-/tmp/lastfloor}
OUTDIR=public/plates
mkdir -p "$OUTDIR"

for shot in spawn lineup run stalk; do
  n=$(ls "$SRC/$shot"/*.png 2>/dev/null | wc -l)
  [ "$n" -gt 0 ] || { echo "skip $shot (no frames)"; continue; }
  "$FFMPEG" -v error -y -framerate 24 -pattern_type glob -i "$SRC/$shot/*.png" \
    -vf "scale=1080:1920:flags=lanczos,format=yuv420p" \
    -c:v libx264 -preset medium -crf 11 "/tmp/lf-$shot-24.mp4"
  "$FFMPEG" -v error -y -i "/tmp/lf-$shot-24.mp4" \
    -vf "minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,format=yuv420p" \
    -c:v libx264 -preset medium -crf 12 "$OUTDIR/lf-$shot.mp4"
  ls -l "$OUTDIR/lf-$shot.mp4" | awk -v s="$shot" '{print s" plate: "$5" bytes"}'
done

# the two stills go in as images; the trailer moves them, the renderer does not
for still in hero face; do
  f=$(ls "$SRC/$still"/*.png 2>/dev/null | head -1) || true
  [ -n "${f:-}" ] || continue
  "$FFMPEG" -v error -y -i "$f" -vf "scale=1080:1920:flags=lanczos" -q:v 2 "$OUTDIR/lf-$still.jpg"
  ls -l "$OUTDIR/lf-$still.jpg" | awk -v s="$still" '{print s" still: "$5" bytes"}'
done
