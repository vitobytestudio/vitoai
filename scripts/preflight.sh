#!/usr/bin/env bash
# =============================================================================
#  preflight.sh — fail in 3 seconds instead of 6 minutes.
#  Every check here exists because it has already cost a destroyed render.
# =============================================================================
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
FAIL=0
ok(){ printf "  \033[0;32m✓\033[0m %s\n" "$1"; }
bad(){ printf "  \033[0;31m✗ %s\033[0m\n" "$1"; FAIL=1; }

echo "▸ preflight"

# 1. types
if npx tsc --noEmit >/tmp/tsc.log 2>&1; then ok "typescript"; else bad "typescript — see /tmp/tsc.log"; head -5 /tmp/tsc.log; fi

# 2. every glyph must resolve in the font stack, or the browser tab dies
#    with "Target closed" and no stack trace
if python3 scripts/check_glyphs_cf.py | grep -q "^BROKEN"; then
  bad "uncovered glyph(s) — this crashes the renderer:"; python3 scripts/check_glyphs_cf.py | grep "^BROKEN" | head -5
else ok "glyph coverage"; fi

# 3. canvas text paints 0px in this sandbox — never reintroduce it
if grep -rn "fillText\|strokeText" src/ --include=*.tsx --include=*.ts | grep -v "[[:space:]]*//.*fillText\|^[^:]*:[0-9]*:[[:space:]]*//" | grep -v "^[^:]*:[0-9]*: *//" | grep -q .; then
  bad "canvas text found — renders blank here, use DOM"
else ok "no canvas text"; fi

# 4. audio must match picture length or the last seconds are silent
AUDIO=public/audio/cf_bed.wav
if [[ -f "$AUDIO" ]]; then
  ADUR=$(python3 -c "import wave;w=wave.open('$AUDIO');print(round(w.getnframes()/w.getframerate(),2))")
  ok "score bed ${ADUR}s — verify against durationInFrames/fps"
else bad "missing $AUDIO"; fi

# 5. toolchain
[[ -x "$HOME/.render-tools/chromium" ]] && ok "chromium" || bad "chromium missing — run ./setup.sh"

echo
[[ $FAIL -eq 0 ]] && echo "PREFLIGHT OK" || echo "PREFLIGHT FAILED"
exit $FAIL
