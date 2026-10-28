#!/usr/bin/env bash
# =============================================================================
#  make.sh — request → delivered link, one command.
#
#  usage:  ./make.sh <slug> [fps]        fps = 30 (default, fast) or 60
#
#  Pipeline:
#    preflight (3s) → render → mobile cut → publish to GitHub → print links
#
#  What makes it fast (measured, 2 vCPU):
#    · --color-space=bt709  : correct colour on the FIRST encode. The old
#                             pipeline re-encoded the whole file afterwards to
#                             fix the colour matrix — that pass alone was 96s.
#    · --x264-preset=veryfast + crf 18 : visually identical at delivery bitrate
#    · 30fps                : half the frames, same motion in seconds
#    · no intermediate      : render lands straight in out/<slug>_master.mp4
# =============================================================================
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
# shellcheck source=/dev/null
source ./ensure_tools.sh

SLUG="${1:-}"; FPSMODE="${2:-30}"
[[ -n "$SLUG" ]] || { echo "usage: ./make.sh <slug> [30|60]"; exit 1; }

case "$FPSMODE" in
  30) COMP="CloudflareAd30" ;;
  60) COMP="CloudflareAd" ;;
  *)  echo "fps must be 30 or 60"; exit 1 ;;
esac

step(){ printf "\n\033[1;35m▸ %s\033[0m\n" "$1"; }
ok(){ printf "  \033[0;32m✓\033[0m %s\n" "$1"; }

T0=$(date +%s)

step "1/4 · preflight"
./scripts/preflight.sh || { echo "fix the failures above, then re-run"; exit 1; }

step "2/4 · render ($COMP)"
mkdir -p out
RS=$(date +%s); npx remotion render src/index.ts "$COMP" "out/${SLUG}_master.mp4" \
  --concurrency=2 --pixel-format=yuv420p --codec=h264 --crf=18 \
  --x264-preset=veryfast --color-space=bt709 \
  --audio-codec=aac --audio-bitrate=192k 2>&1 | tail -1; echo "  render wall: $(( $(date +%s) - RS ))s"
ok "master: $(du -h "out/${SLUG}_master.mp4" | cut -f1)"

step "3/4 · mobile cut"
MASTER_MB=$(du -m "out/${SLUG}_master.mp4" | cut -f1)
if [[ "$MASTER_MB" -le 12 ]]; then
  # the fast path already produces a phone-sized master; a second encode would
  # be bigger than the source AND waste 5s. One file is better than two.
  cp "out/${SLUG}_master.mp4" "out/${SLUG}_1080p.mp4"
  ok "skipped — master is already ${MASTER_MB}MB"
else
  "$FFMPEG" -y -hide_banner -loglevel error -i "out/${SLUG}_master.mp4" \
    -c:v libx264 -preset ultrafast -crf 26 -pix_fmt yuv420p \
    -c:a aac -b:a 128k -movflags +faststart "out/${SLUG}_1080p.mp4"
  ok "lite: $(du -h "out/${SLUG}_1080p.mp4" | cut -f1)"
fi

step "4/4 · publish"
./publish.sh "$SLUG" "deliver: $SLUG (${FPSMODE}fps, fast path)"

T1=$(date +%s)
printf "\n\033[1;32mTOTAL: %ss\033[0m\n" "$((T1-T0))"
