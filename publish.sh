#!/usr/bin/env bash
# =============================================================================
#  publish.sh — deliver the rendered video through GitHub raw (the only
#  delivery path that actually reaches the user from this sandbox).
#  usage: ./publish.sh [message]
# =============================================================================
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

BRANCH="arena/c36750ba-vitoai"
REPO="vitobytestudio/vitoai"
MASTER_SRC="out/master_video.mp4"
LITE_SRC="out/vitoai_motion_1080p.mp4"
MASTER_DST="deliverables/vitoai-motion-master-1080x1920.mp4"
LITE_DST="deliverables/vitoai-motion-1080x1920.mp4"
FFMPEG="${FFMPEG:-/home/user/probe/node_modules/@ffmpeg-installer/linux-x64/ffmpeg}"

step() { printf "\n\033[1;35m▸ %s\033[0m\n" "$1"; }
ok()   { printf "  \033[0;32m✓\033[0m %s\n" "$1"; }

[[ -f "$MASTER_SRC" ]] || { echo "missing $MASTER_SRC — render first"; exit 1; }
mkdir -p deliverables

step "1/5 · verify master"
"$FFMPEG" -v error -i "$MASTER_SRC" -f null - && ok "decodes cleanly"
SIZE=$(du -m "$MASTER_SRC" | cut -f1)
[[ "$SIZE" -lt 95 ]] || { echo "master is ${SIZE}MB — GitHub rejects >100MB"; exit 1; }
ok "${SIZE}MB (under the 100MB limit)"

step "2/5 · build the mobile cut"
if [[ ! -f "$LITE_SRC" ]]; then
  "$FFMPEG" -y -hide_banner -loglevel error -i "$MASTER_SRC" \
    -c:v libx264 -preset slow -crf 24 -profile:v high -pix_fmt yuv420p \
    -c:a aac -b:a 160k -movflags +faststart "$LITE_SRC"
fi
ok "lite cut ready"

step "3/5 · stage the deliverables"
cp "$MASTER_SRC" "$MASTER_DST"
cp "$LITE_SRC" "$LITE_DST"
ls -lh deliverables/*.mp4 | awk '{print "  "$9"  "$5}'

step "4/5 · publish"
git add -f "$MASTER_DST" "$LITE_DST"
MSG="${1:-deliver: re-render $(date -u +%Y-%m-%dT%H:%MZ)}"
if git diff --cached --quiet; then ok "nothing changed"; else
  git -c user.name="VitoAI Agent" -c user.email="agent@vitoai.local" commit -q -m "$MSG"
  git push -q origin "$BRANCH"
  ok "pushed → $BRANCH"
fi

step "5/5 · download links"
echo
echo "  MASTER (${SIZE}MB)"
echo "  https://github.com/${REPO}/raw/${BRANCH}/${MASTER_DST}"
echo
echo "  LITE (9MB)"
echo "  https://github.com/${REPO}/raw/${BRANCH}/${LITE_DST}"
echo
