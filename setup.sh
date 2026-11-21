#!/usr/bin/env bash
# =============================================================================
#  setup.sh — restore the render toolchain in one command.
#
#  WHY THIS EXISTS
#  ---------------
#  The sandbox is ephemeral: `node_modules/` and files outside the project are
#  dropped between sessions. The repo (src, scripts, deliverables) always
#  survives — the *tools* don't. This script rebuilds them deterministically
#  and is safe to run any number of times.
#
#  usage: ./setup.sh          (add --force to wipe and redownload)
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

TOOLS="$HOME/.render-tools"          # outside the repo: big, disposable, rebuilt here
CHROME_LIBS="$TOOLS/chromelibs"
CHROME_BIN="$TOOLS/chromium"
ENV_FILE="$ROOT/.toolenv"

FORCE=0
AI=0                                  # --ai:التخزين البصري المحلي (قصّ/إضاءة/لون ثوب)
AIVENV="$TOOLS/venv-ai"
for a in "$@"; do
  [[ "$a" == "--force" ]] && FORCE=1
  [[ "$a" == "--ai" ]] && AI=1
done

step() { printf "\n\033[1;35m▸ %s\033[0m\n" "$1"; }
ok()   { printf "  \033[0;32m✓\033[0m %s\n" "$1"; }
die()  { printf "  \033[0;31m✗\033[0m %s\n" "$1" >&2; exit 1; }
warn() { printf "  \033[0;33m!\033[0m %s\n" "$1"; }

# --- this box intercepts TLS; npm needs the local CA or it fails with
#     UNABLE_TO_VERIFY_LEAF_SIGNATURE --------------------------------------
CA_FILE=/usr/local/share/ca-certificates/e2b-ca.crt
if [[ -f "$CA_FILE" ]]; then export NODE_EXTRA_CA_CERTS="$CA_FILE"; fi

mkdir -p "$TOOLS"

# ---------------------------------------------------------------- 1. deps ---
step "1/5 · node dependencies"
if [[ $FORCE -eq 1 ]] || [[ ! -d node_modules/remotion ]]; then
  npm install --no-audit --no-fund 2>&1 | tail -3
  ok "installed ($(ls node_modules | wc -l) packages)"
else
  ok "already present"
fi

# ------------------------------------------------------------- 2. ffmpeg ---
step "2/5 · ffmpeg"
FFMPEG_BIN="$ROOT/node_modules/@ffmpeg-installer/linux-x64/ffmpeg"
if [[ -x "$FFMPEG_BIN" ]]; then
  chmod +x "$FFMPEG_BIN"
  ok "$("$FFMPEG_BIN" -version 2>/dev/null | head -1 | cut -c1-40)"
  # measured, not assumed: this static build is years old and can differ after a reset. These are
  # the only filters the pipeline calls — cuts and dissolves are Remotion's job, never ffmpeg's.
  # قائمة تقرأ مرة واحدة: grep -q تغلق الأنبوب بعد أول مطابقة، فيموت ffmpeg بإشارة SIGPIPE،
  # ومع set -o pipefail يُحسب الأنبوب فاشلاً — فتصرخ الحراسة على نسخة سليمة. أحمق أنواع الإنذار.
  FILTERS="$("$FFMPEG_BIN" -hide_banner -filters 2>/dev/null || true)"
  for f in format loudnorm tile scale fps alimiter; do
    printf '%s\n' "$FILTERS" | grep -qw "$f" \
      || die "this ffmpeg build has no '$f' — the review sheet and the master both need it"
  done
  ok "filters: format loudnorm tile scale fps alimiter ✓"
else
  warn "ffmpeg unavailable — mastering/audio steps will fail"
fi

# ----------------------------------------------------------- 3. chromium ---
step "3/5 · headless chromium"
if [[ $FORCE -eq 1 ]] || [[ ! -x "$CHROME_BIN" ]] || [[ ! -f "$CHROME_LIBS/vk_swiftshader_icd.json" ]]; then
  # chromium ships in devDependencies; only the decompression happens here
  TOOLS="$TOOLS" node -e '
    const zlib = require("zlib"), fs = require("fs"), path = require("path");
    const b = "node_modules/@sparticuz/chromium/bin";
    const out = process.env.TOOLS;
    fs.mkdirSync(out + "/chromelibs", { recursive: true });
    fs.writeFileSync(out + "/chromium",
      zlib.brotliDecompressSync(fs.readFileSync(path.join(b, "chromium.br"))));
    for (const f of ["swiftshader", "fonts", "al2023"]) {
      fs.writeFileSync(`${out}/chromelibs/${f}.tar`,
        zlib.brotliDecompressSync(fs.readFileSync(path.join(b, f + ".tar.br"))));
    }
    console.log("extracted to " + out);
  '
  chmod +x "$CHROME_BIN"
  ( cd "$CHROME_LIBS" && for t in swiftshader fonts al2023; do tar xf "$t.tar" 2>/dev/null; done )
fi
if [[ -x "$CHROME_BIN" ]]; then
  ok "chromium $("$CHROME_BIN" --version 2>/dev/null | awk '{print $2}')"
else
  warn "chromium unavailable — rendering will fail"
fi

# ------------------------------------------------------------- 4. audio ---
step "4/5 · sound design assets"
if [[ ! -f public/audio/bed.wav ]] || [[ $FORCE -eq 1 ]]; then
  python3 scripts/make_audio.py 2>&1 | tail -3
else
  ok "audio palette present ($(ls public/audio 2>/dev/null | wc -l) files)"
fi

# ------------------------------------------------- 4.6 local vision stack ---
if [[ $AI -eq 1 ]]; then
step "4.6/5 · local vision stack (--ai)"
if [[ $FORCE -eq 0 ]] && [[ -x "$AIVENV/bin/python" ]] && "$AIVENV/bin/python" -c "import cv2, mediapipe" 2>/dev/null; then
  ok "venv-ai جاهز ($(find "$AIVENV/lib" -name '*.tflite' 2>/dev/null | wc -l) نموذج مضمّن)"
else
  python3 -m venv "$AIVENV" >/dev/null 2>&1 || die "تعذّر إنشاء venv"
  # لا تُصدِّر SSL_CERT_FILE/REQUESTS_CA_BUNDLE إلى pip: ملف e2b-ca.crt يحمل شهادة واحدة،
  # وبه يفشل pip بـ «unable to get local issuer certificate» بينما ينجح بلا شيء — لأن مخزن
  # النظام فيه السلسلة كاملة. (npm وحده يحتاج NODE_EXTRA_CA_CERTS، وقد فُعِّل أعلاه.)
  "$AIVENV/bin/pip" install -q --disable-pip-version-check -r requirements-ai.txt 2>&1 | tail -2
  # فخٌّ لا يُرى في pip list: mediapipe==0.10.21 يعلن اعتماديته إلى opencv-contrib-python،
  # فيُثبَّت مع headless ويكتب `cv2` فوق نفسه — وcontrib ينادي libGL.so.1 غير الموجود هنا،
  # فـ«import cv2» يموت بـImportError رغم أن كل باقة ظاهرة في pip list. الحذف وحده يمحو مجلد
  # cv2 المشترك، لذا يُعاد تثبيت headless في الحال ولا يُترك نصفاً. (بلا هذا الإصلاح تموت
  # 4.6/5 على آلةٍ نظيفة بكاملها، والرسالة تقول «0 نموذج» — وهي كذبة لطيفة.)
  for u in opencv-contrib-python opencv-python opencv-contrib-python-headless; do
    "$AIVENV/bin/pip" uninstall -y -q "$u" >/dev/null 2>&1
  done
  # الحذفُ من pip لا يمحو مجلدَ cv2 إذا تركتْ باقتانِ بصمتيهما فيه — لذا يُمحى المجلدُ أوّلاً
  rm -rf "$AIVENV"/lib/python3*/site-packages/cv2
  "$AIVENV/bin/pip" install -q --disable-pip-version-check --force-reinstall --no-deps \
      opencv-python-headless==4.10.0.84 >/dev/null 2>&1 || true
  "$AIVENV/bin/python" -c "import cv2, mediapipe, numpy; assert numpy.__version__[0]=='1'" 2>/dev/null \
    || die "cv2/mediapipe لا يُستورَدان بعد الإصلاح — venv-ai مكسور، احذفه وأعد: rm -rf $AIVENV && bash setup.sh --ai"
  N=$("$AIVENV/bin/python" - <<'PY' 2>/dev/null
import os, glob, mediapipe as mp
print(len(glob.glob(os.path.dirname(mp.__file__) + "/modules/*/*.tflite")))
PY
)
  [[ "${N:-0}" -ge 5 ]] || die "عجلة mediapipe تحمل ${N:-0} نموذجاً؛ القصّ بلا شبكة يحتاج النماذج المضمّنة (انظر requirements-ai.txt)"
  ok "$N نموذج مضمّن في العجلة — بلا huggingface ولا مفتاح ولا حدود"
fi
fi

# -------------------------------------------------------------- 5. env -----
step "5/5 · environment contract"
cat > "$ENV_FILE" <<EOF
# generated by setup.sh — source this before any render command
export FFMPEG="$FFMPEG_BIN"
export CHROME_BIN="$CHROME_BIN"
export LD_LIBRARY_PATH="$CHROME_LIBS:$CHROME_LIBS/lib\${LD_LIBRARY_PATH:+:\$LD_LIBRARY_PATH}"
export FONTCONFIG_PATH="$CHROME_LIBS"
export VK_ICD_FILENAMES="$CHROME_LIBS/vk_swiftshader_icd.json"
export AIVENV="$AIVENV"
EOF
ok ".toolenv written"

printf "\n\033[1;32m✔ TOOLCHAIN READY\033[0m\n"
printf "  next:  bash build_video.sh\n"
[[ $AI -eq 1 ]] && printf "  vision:  source .toolenv && \"$AIVENV/bin/python\" studio/comp.py --self-test\n"
printf "  or:    /publish.sh after a render\n"
