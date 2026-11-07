#!/usr/bin/env bash
# Headless Blender for this box: no GPU, no display, no X, no root.
#
# `bpy` is Blender as a Python module. It refuses to load here for two reasons, and
# both are fixable without a package manager:
#
#  1. it links libGL / libXrender / libSM / libxkbcommon, none of which exist in a
#     slim image — but the Cycles CPU path never calls into them, so empty libraries
#     exporting just the symbols the loader asks for are enough;
#  2. its USD data symbols live in bpy/lib/libusd_ms.so, which is pulled in
#     RTLD_LOCAL, so they are not in the global scope when bpy itself is relocated.
#     studio/blender/bpyrun.py loads libusd first with RTLD_GLOBAL — that is why
#     every render script is run through bpyrun.py.
#
#   bash studio/blender/setup_env.sh                      # ~40 s, idempotent
#   LD_LIBRARY_PATH=/tmp/vitobl/lib /tmp/vitobl/bin/python \
#       studio/blender/bpyrun.py studio/blender/scene_hero.py --out /tmp/hero3d
#
# /tmp is wiped between sandboxes, so expect to re-run this at the start of a session.
set -uo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
ENV=${VITO_BL_ENV:-/tmp/vitobl}
LIB=$ENV/lib
PY=$ENV/bin/python
log(){ printf '%s\n' "$*"; }

# ------------------------------------------------------------------ python env
[ -x "$PY" ] || { log "· venv"; python3 -m venv "$ENV" >/dev/null; }
if ! ls -d $ENV/lib/python3.*/site-packages/bpy >/dev/null 2>&1; then
  log "· bpy + deps (374 MB wheel, one download)"
  $PY -m pip -q install --upgrade pip setuptools wheel
  $PY -m pip -q install --no-deps bpy
  $PY -m pip -q install "numpy<2" fonttools uharfbuzz brotli mapbox_earcut requests zstandard
fi
SP=$(ls -d $ENV/lib/python3.*/site-packages)
BPy=$SP/bpy

# --------------------------------------------------- 1. stubs for absent libraries
mkdir -p "$LIB/src"
echo 'void _vitobl_none(void){}' > "$LIB/src/empty.c"
touch "$LIB/src/names.txt"
cat > "$LIB/src/check.py" <<'EOF'
import bpy
print("VITABL_OK", bpy.app.version_string)
EOF
for i in $(seq 1 15); do
  OUT=$(LD_LIBRARY_PATH=$LIB timeout 300 $PY -c "import bpy" 2>&1 | tail -3)
  echo "$OUT" | grep -q "cannot open shared object file" || break
  MISS=$(echo "$OUT" | sed -n 's/.*: \(lib[^:]*\): cannot open.*/\1/p' | head -1)
  [ -n "$MISS" ] || break
  log "· stub → $MISS"
  grep -qxF "$MISS" "$LIB/src/names.txt" || echo "$MISS" >> "$LIB/src/names.txt"
  gcc -shared -fPIC -w -o "$LIB/$MISS" -Wl,-soname,"$MISS" "$LIB/src/empty.c"
done

# ------------------------------------------- 2. symbols the loader still wants —
# everything bpy and its own libraries reference, minus what anything reachable
# (bpy/lib, the interpreter, libc/libm/X11) already defines. Filtering against the
# real definitions is the whole trick: stubbing `exit` or `PyExc_KeyError` because
# they showed up in some nm output segfaults Blender with no message at all.
{ nm -D --defined-only $BPy/lib/*.so* $BPy/__init__.so 2>/dev/null | awk '$2!="U"{print $3}'
  nm -D --defined-only "$(readlink -f $PY)" 2>/dev/null | awk '$2!="U"{print $3}'
  nm -D --defined-only /usr/lib/x86_64-linux-gnu/lib{c,m,dl,pthread,rt,util,stdc++,gcc_s,X11,Xext,GLdispatch,vulkan}.so* 2>/dev/null | awk '$2!="U"{print $3}'
} | sed 's/@.*//' | sort -u > "$LIB/src/def.txt"
{ nm -D --undefined-only $BPy/__init__.so
  for f in $BPy/lib/*.so*; do nm -D --undefined-only "$f" 2>/dev/null; done
} | awk '{print $NF}' | sed 's/@.*//' | sort -u > "$LIB/src/und.txt"
comm -23 "$LIB/src/und.txt" "$LIB/src/def.txt" | grep -xE "[A-Za-z_][A-Za-z0-9_]*" > "$LIB/src/syms.txt"
{ echo '#include <stddef.h>'; while read -r s; do echo "void $s(void){}"; done < "$LIB/src/syms.txt"; } > "$LIB/src/stub.c"
log "· stubbing $(wc -l < "$LIB/src/syms.txt") loader symbols into $(wc -l < "$LIB/src/names.txt") shims"
while read -r L; do [ -n "$L" ] && gcc -shared -fPIC -w -o "$LIB/$L" -Wl,-soname,"$L" "$LIB/src/stub.c"; done < "$LIB/src/names.txt"

# ----------------------------------------------------- 3. verify through the launcher
for i in $(seq 1 25); do
  OUT=$(LD_LIBRARY_PATH=$LIB timeout 600 $PY "$ROOT/studio/blender/bpyrun.py" "$LIB/src/check.py" 2>&1 | tail -2)
  echo "$OUT" | grep -q "VITABL_OK" && { log "· $OUT"; break; }
  SYM=$(echo "$OUT" | sed -n 's/.*undefined symbol: \([A-Za-z_][A-Za-z0-9_]*\).*/\1/p' | head -1)
  [ -n "$SYM" ] || { log "× $OUT"; exit 1; }
  log "· + $SYM"
  echo "$SYM" >> "$LIB/src/syms.txt"; sort -u -o "$LIB/src/syms.txt" "$LIB/src/syms.txt"
  { echo '#include <stddef.h>'; while read -r s; do echo "void $s(void){}"; done < "$LIB/src/syms.txt"; } > "$LIB/src/stub.c"
  while read -r L; do [ -n "$L" ] && gcc -shared -fPIC -w -o "$LIB/$L" -Wl,-soname,"$L" "$LIB/src/stub.c"; done < "$LIB/src/names.txt"
done

# --------------------------------------------------------------------- 4. the fonts
if [ ! -f /tmp/fonts/Tajawal-800.ttf ]; then
  log "· fonts out of src/fontData.ts"
  $PY "$ROOT/studio/blender/extract_fonts.py" /tmp/fonts | tail -2
fi
log "✓ blender env: $ENV  (LD_LIBRARY_PATH=$LIB)"
