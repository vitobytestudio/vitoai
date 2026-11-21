#!/usr/bin/env bash
# =============================================================================
#  publish.sh — deliver a render through GitHub raw.
#
#  GitHub raw is the ONLY path that actually reaches the user from this sandbox
#  (local ports are unreachable, uploads.github.com is blocked). Files must stay
#  under 100 MB or the push is rejected.
#
#  usage:  ./publish.sh <slug> [commit message]
#          reads  out/<slug>_master.mp4
#          builds out/<slug>_1080p.mp4  (mobile cut, crf 24)
#          ships  deliverables/<slug>-master-1080x1920.mp4
#                 deliverables/<slug>-1080x1920.mp4
# =============================================================================
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
# shellcheck source=/dev/null
source ./ensure_tools.sh

BRANCH="arena/c36750ba-vitoai"
REPO="vitobytestudio/vitoai"
FFMPEG="${FFMPEG:?run ./setup.sh}"

SLUG="${1:-}"
if [[ -z "$SLUG" ]]; then
  echo "usage: ./publish.sh <slug> [message]"; exit 1
fi

MASTER_SRC="out/${SLUG}_master.mp4"
LITE_SRC="out/${SLUG}_1080p.mp4"
MASTER_DST="deliverables/${SLUG}-master-1080x1920.mp4"
LITE_DST="deliverables/${SLUG}-1080x1920.mp4"

step() { printf "\n\033[1;35m▸ %s\033[0m\n" "$1"; }
ok()   { printf "  \033[0;32m✓\033[0m %s\n" "$1"; }

[[ -f "$MASTER_SRC" ]] || { echo "missing $MASTER_SRC — render + master first"; exit 1; }
mkdir -p deliverables

step "1/5 · verify master"
"$FFMPEG" -v error -i "$MASTER_SRC" -f null - && ok "decodes cleanly"
SIZE=$(($(stat -c%s "$MASTER_SRC") / 1048576))
[[ "$SIZE" -lt 95 ]] || { echo "master is ${SIZE}MB — GitHub rejects >100MB"; exit 1; }
ok "${SIZE}MB (under the 100MB limit)"

step "2/5 · build the mobile cut"
if [[ ! -f "$LITE_SRC" ]]; then
  "$FFMPEG" -y -hide_banner -loglevel error -i "$MASTER_SRC" \
    -c:v libx264 -preset slow -crf 24 -profile:v high -pix_fmt yuv420p \
    -c:a aac -b:a 160k -movflags +faststart "$LITE_SRC"
  ok "encoded"
else
  ok "already encoded"
fi
"$FFMPEG" -v error -i "$LITE_SRC" -f null - && ok "lite decodes cleanly"

step "3/5 · stage the deliverables"
cp "$MASTER_SRC" "$MASTER_DST"
ls -lh "$MASTER_DST" | awk '{print "  "$9"  "$5}'

# a lite cut that is not actually lighter is a second 8MB download for nothing
STAGE_LITE=1
if cmp -s "$MASTER_SRC" "$LITE_SRC" || [[ $(stat -c%s "$LITE_SRC") -ge $(stat -c%s "$MASTER_SRC") ]]; then
  STAGE_LITE=0
  ok "single file — the master is already phone-sized"
else
  cp "$LITE_SRC" "$LITE_DST"
  ls -lh "$LITE_DST" | awk '{print "  "$9"  "$5}'
fi

step "4/5 · publish"
if [[ $STAGE_LITE -eq 1 ]]; then git add -f "$MASTER_DST" "$LITE_DST"; else git add -f "$MASTER_DST"; fi
MSG="${2:-deliver: $SLUG $(date -u +%Y-%m-%dT%H:%MZ)}"
if git diff --cached --quiet; then ok "nothing changed"; else
  git -c user.name="VitoAI Agent" -c user.email="agent@vitoai.local" commit -q -m "$MSG"
  git push -q origin "$BRANCH"
  ok "pushed → $BRANCH"
fi

step "5/5 · download links"
LITE_MB=$(($(stat -c%s "$LITE_SRC") / 1048576))
echo
echo "  MASTER (${SIZE}MB)"
echo "  https://github.com/${REPO}/raw/${BRANCH}/${MASTER_DST}"
if [[ $STAGE_LITE -eq 1 ]]; then
echo
echo "  LITE (${LITE_MB}MB)"
echo "  https://github.com/${REPO}/raw/${BRANCH}/${LITE_DST}"
fi
echo
