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
# a hit only counts when it is real code: strip block comments first
CANVAS_TEXT=$(python3 - <<'PYEOF'
import glob, re
hits = []
for p in glob.glob("src/**/*.ts", recursive=True) + glob.glob("src/**/*.tsx", recursive=True):
    src = open(p, encoding="utf-8").read()
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    for i, line in enumerate(src.splitlines(), 1):
        code = line.split("//")[0]
        if "fillText" in code or "strokeText" in code:
            hits.append(f"{p}:{i}")
print("\n".join(hits))
PYEOF
)
if [[ -n "$CANVAS_TEXT" ]]; then
  bad "canvas text found — renders blank here, use DOM"
  echo "$CANVAS_TEXT" | head -3
else ok "no canvas text"; fi

# 4. audio sets — generated, gitignored, so a reset wipes them all
for pair in "make_audio.py:cf_bed.wav" "make_audio_cf.py:cf_bed.wav" "make_audio_nx.py:nx_bed.wav" "make_audio_reel.py:rl_bed.wav"; do
  gen="${pair%%:*}"; out="${pair##*:}"
  if [[ ! -f "public/audio/$out" && -f "scripts/$gen" ]]; then
    python3 "scripts/$gen" >/dev/null 2>&1 || true
  fi
done

AUDIO=public/audio/cf_bed.wav
if [[ -f "$AUDIO" ]]; then
  ADUR=$(python3 -c "import wave;w=wave.open('$AUDIO');print(round(w.getnframes()/w.getframerate(),2))")
  ok "score bed ${ADUR}s — verify against durationInFrames/fps"
else bad "missing $AUDIO"; fi

# 5. design mix — more than a third of beats in 3D is a tech demo, not an ad
if [[ -f src/nexus3d/Reel.tsx ]]; then
  MIX=$(python3 scripts/check_mix.py 2>/dev/null | grep -oE "\\([0-9]+%\\)" | tr -d '()')
  if [[ "${MIX%\%}" -gt 34 ]]; then
    printf "  \033[0;33m!\033[0m %s\n" "3D mix ${MIX} — over the one-third ceiling (see DESIGN.md)"
    [[ "${STRICT_MIX:-0}" == "1" ]] && FAIL=1
  else ok "3D mix ${MIX}"; fi
fi

# 6. toolchain
[[ -x "$HOME/.render-tools/chromium" ]] && ok "chromium" || bad "chromium missing — run ./setup.sh"

echo
[[ $FAIL -eq 0 ]] && echo "PREFLIGHT OK" || echo "PREFLIGHT FAILED"
exit $FAIL
