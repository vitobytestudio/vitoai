#!/usr/bin/env bash
# horror plate: 48 Cycles frames -> 24 fps master -> 30 fps conform for Remotion.
# The conform is interpolated (minterpolate MCI), never dropped: 60 frames of a 48-frame
# shot played at a slower rate would be a slideshow.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source .toolenv
SRC=${SRC:-/tmp/horror}
OUT=${OUT:-public/plates/horror-plate.mp4}
T24=/tmp/horror/plate24.mp4
mkdir -p public/plates

# the render comes out at 72 % (778x1382). Upscale FIRST, interpolate SECOND: motion
# vectors have to be estimated on the frames the audience will actually see, and a
# lanczos reconstruction of a dark grainy plate is free of artefacts at this ratio.
"$FFMPEG" -v error -y -framerate 24 -i "$SRC"/h_%04d.png \
  -vf "scale=1080:1920:flags=lanczos,format=yuv420p" \
  -c:v libx264 -preset medium -crf 11 "$T24"
"$FFMPEG" -v error -y -i "$T24" \
  -vf "minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,format=yuv420p" \
  -c:v libx264 -preset medium -crf 12 "$OUT"
"$FFMPEG" -v error -i "$OUT" 2>&1 | grep -E "Duration|Stream" || true
ls -l "$OUT" | awk '{print $5" bytes "$9}'
