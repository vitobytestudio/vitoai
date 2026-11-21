#!/usr/bin/env bash
# =============================================================================
#  ensure_tools.sh — sourced by every render/deliver script.
#  If the toolchain is missing (a sandbox reset wiped it), restore it silently.
#  When it is present this costs ~25ms and prints nothing.
# =============================================================================
_ENSURE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -f "$_ENSURE_ROOT/.toolenv" ]] \
   || ! grep -q . "$_ENSURE_ROOT/.toolenv" 2>/dev/null \
   || [[ ! -x "$_ENSURE_ROOT/node_modules/@ffmpeg-installer/linux-x64/ffmpeg" ]] \
   || [[ ! -x "$HOME/.render-tools/chromium" ]] \
   || [[ ! -d "$_ENSURE_ROOT/node_modules/remotion" ]]; then
  printf "\033[0;33m▸ toolchain missing — restoring (about 40s)…\033[0m\n"
  bash "$_ENSURE_ROOT/setup.sh" >/dev/null 2>&1 || true
fi

# shellcheck disable=SC1091
source "$_ENSURE_ROOT/.toolenv" 2>/dev/null || true
