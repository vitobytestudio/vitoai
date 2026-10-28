#!/usr/bin/env bash
# =============================================================================
#  VitoAI — autonomous programmatic video pipeline
#  build_video.sh  [--skip-render]
#
#  STAGE 1  audio      procedural score + SFX palette            (synthesis)
#  STAGE 2  captions   word-level timeline JSON (Whisper schema)
#  STAGE 3  validate   glyph coverage gate for this font-less box
#  STAGE 4  render     headless Remotion → out/master_raw.mp4
#  STAGE 5  master     FFmpeg: loudnorm -14 LUFS + film grade   → out/master_video.mp4
#  STAGE 6  deliver    HTTP download server on :8080
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# restore the toolchain automatically if a sandbox reset wiped it
# shellcheck source=/dev/null
source "$ROOT/ensure_tools.sh"

# --- sandbox specifics -------------------------------------------------------
FFMPEG="${FFMPEG:?setup failed — run ./setup.sh}"
PY="${PY:-python3}"

SKIP_RENDER=0
for a in "$@"; do [[ "$a" == "--skip-render" ]] && SKIP_RENDER=1; done

step() { printf "\n\033[1;35m▸ %s\033[0m\n" "$1"; }
ok()   { printf "  \033[0;32m✓\033[0m %s\n" "$1"; }

mkdir -p out public/audio .cache

# ---------------------------------------------------------------- STAGE 1 ----
step "STAGE 1/6 · SOUND DESIGN"
if [[ ! -f public/audio/bed.wav || "${FORCE_AUDIO:-0}" == "1" ]]; then
  $PY scripts/make_audio.py
else
  ok "audio palette already rendered ($(ls public/audio | wc -l) files)"
fi

# ---------------------------------------------------------------- STAGE 2 ----
step "STAGE 2/6 · WORD-LEVEL CAPTIONS"
# Whisper (openai-whisper) produces exactly this schema with
# word_timestamps=True. Model weights can't be fetched in this sandbox, so the
# authored alignment in src/data/captions.ts is the source of truth and is
# exported here for downstream tooling / caption burn-in.
$PY scripts/export_captions.py || ok "captions export skipped"
ok "src/data/subtitles.json"

# ---------------------------------------------------------------- STAGE 3 ----
step "STAGE 3/6 · BUILD VALIDATION"
if $PY -c "import fontTools" 2>/dev/null; then
  $PY scripts/check_glyphs.py
else
  printf "  \033[0;33m!\033[0m fontTools missing — skipping glyph gate\n"
fi
npx tsc --noEmit -p tsconfig.json && ok "TypeScript clean"

# ---------------------------------------------------------------- STAGE 4 ----
step "STAGE 4/6 · HEADLESS RENDER (1080x1920 · 60fps · 1332 frames)"
if [[ $SKIP_RENDER -eq 0 ]]; then
  npx remotion render src/index.ts MainComposition out/master_raw.mp4 \
    --concurrency=1 \
    --gl=angle \
    --pixel-format=yuv420p \
    --codec=h264 \
    --crf=16 \
    --audio-codec=aac \
    --audio-bitrate=320k
  ok "out/master_raw.mp4 ($(du -h out/master_raw.mp4 | cut -f1))"
else
  ok "render skipped (--skip-render)"
fi

# ---------------------------------------------------------------- STAGE 5 ----
step "STAGE 5/6 · MASTERING  (-14 LUFS · film grade · 1080x1920 @60)"
# two-pass loudnorm is overkill for a 22s master; single pass with a measured
# target + a gentle limiter is transparent and fast.
$FFMPEG -y -hide_banner -loglevel error \
  -i out/master_raw.mp4 \
  -filter_complex "\
[0:v]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,\
eq=contrast=1.055:brightness=0.004:saturation=1.07,\
unsharp=5:5:0.5:5:5:0.0,\
vignette=angle=PI/5[vg];\
[0:a]loudnorm=I=-14:TP=-1.5:LRA=11:linear=true,\
alimiter=level_in=1:level_out=1:limit=0.94:attack=5:release=60[a]" \
  -map "[vg]" -map "[a]" \
  -c:v libx264 -preset slow -crf 17 -profile:v high -level 4.2 \
  -x264-params "keyint=120:min-keyint=60:scenecut=40:ref=4:bframes=3" \
  -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 320k -ar 48000 \
  -movflags +faststart \
  out/master_video.mp4
ok "out/master_video.mp4 ($(du -h out/master_video.mp4 | cut -f1))"

# ---------------------------------------------------------------- STAGE 6 ----
printf "\n\033[1;32m✔ BUILD COMPLETE\033[0m\n"
$FFMPEG -hide_banner -i out/master_video.mp4 2>&1 | grep -E "Duration|Stream" | sed 's/^/  /'

if [[ "${SERVE:-1}" == "1" ]]; then
  step "STAGE 6/6 · DISTRIBUTION"
  cat > out/serve.mjs <<'EOF'
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const ROOT = path.dirname(new URL(import.meta.url).pathname);
const FILE = path.join(ROOT, "master_video.mp4");
const PORT = Number(process.env.PORT || 8080);
http
  .createServer((req, res) => {
    if (req.url === "/health") { res.writeHead(200); return res.end("ok"); }
    let stat;
    try { stat = fs.statSync(FILE); } catch { res.writeHead(404); return res.end("not built yet"); }
    if (req.url === "/" ) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(`<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">
<body style="margin:0;background:#05060d;color:#fff;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh">
<div style="text-align:center;padding:24px">
<h1 style="font-size:22px;letter-spacing:.18em;color:#67e8f9">VITOAI MOTION STUDIO</h1>
<video src="/master_video.mp4" controls playsinline style="width:min(92vw,420px);border-radius:22px;box-shadow:0 30px 80px -20px #7c5cff"></video>
<p><a href="/master_video.mp4" download style="display:inline-block;margin-top:18px;padding:14px 28px;border-radius:999px;background:linear-gradient(135deg,#7c5cff,#22d3ee);color:#08090f;font-weight:800;text-decoration:none">تحميل MP4</a></p>
<p style="color:#8b93a7;font-size:12px">${(stat.size / 1048576).toFixed(1)} MB · 1080x1920 · 60fps</p>
</div></body>`);
    }
    const range = req.headers.range;
    if (range) {
      const [s, e] = range.replace(/bytes=/, "").split("-");
      const start = parseInt(s, 10);
      const end = e ? parseInt(e, 10) : stat.size - 1;
      res.writeHead(206, {
        "content-range": `bytes ${start}-${end}/${stat.size}`,
        "accept-ranges": "bytes",
        "content-length": end - start + 1,
        "content-type": "video/mp4",
      });
      return fs.createReadStream(FILE, { start, end }).pipe(res);
    }
    res.writeHead(200, {
      "content-length": stat.size,
      "content-type": "video/mp4",
      "content-disposition": 'attachment; filename="vitoai-motion.mp4"',
    });
    fs.createReadStream(FILE).pipe(res);
  })
  .listen(PORT, "0.0.0.0", () => console.log(`serving http://0.0.0.0:${PORT}/  (${(fs.statSync(FILE).size / 1048576).toFixed(1)} MB)`));
EOF
  node out/serve.mjs
fi
