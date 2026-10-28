# VitoAI — Motion Studio

**Fully programmatic 3D motion-graphics pipeline.** No After Effects, no timeline
app, no manual keyframes: every frame of this 1080×1920 · 60 fps · 22.2 s video is
computed from TypeScript and rasterised headlessly, then mastered to a
phone-ready MP4.

```
src/
├─ theme.ts                 design system: palette, type scale, spring presets, scene map
├─ lib/math.ts              vec3 / mat4-lite, perspective projection, noise, PRNG
├─ lib/gl.ts                cached glow sprites, tinted blits, anamorphic streaks
├─ components/
│  ├─ Scene3D.tsx           software 3D engine: lattice sphere, orbital rings,
│  │                        torus-knot stream, glass cards with on-canvas type,
│  │                        perspective floor grid, bokeh DOF, RGB glitch
│  ├─ KineticCaptions.tsx   RTL-safe kinetic typography (word units ⇒ shaping intact)
│  ├─ OverlayLayer.tsx      single-pass compositor: flash, light leak, wipe,
│  │                        vignette, grain, HUD, scanlines
│  ├─ VFXLayer.tsx          Shake, ZoomPunch (spring decay), legacy helpers
│  ├─ AudioEngine.tsx       frame-locked SFX triggers + music auto-ducking
│  └─ ui.tsx               GlassCard, Wordmark, Pill, Kicker, counters
├─ scenes/                  Hook · Chaos · Reveal · Proof · Punch · CTA
├─ data/captions.ts         word-level timeline (frames) + SFX cue map
└─ FontGate.tsx             blocks each frame until every face is decoded
```

## Hard-won environment constraints

| Constraint | Consequence |
|---|---|
| `fc-list` = **0** — no system fonts at all | Every face ships as a base64 data-URI; the composition mounts only after all of them decode |
| `U+0020` must be inside each face's `unicode-range` | Otherwise inter-word gaps render as `.notdef` boxes *
| WebGL/ANGLE cannot initialise (Vulkan fails) | All 3D is software-rasterised on Canvas 2D |
| `fillText()` on a 2D context is unstable | Every glyph is painted by the DOM; canvases carry **geometry only** |
| Blended full-frame DOM layers stack badly | All finishing (flash, leak, grain, vignette, HUD, shutter) is one canvas pass + one DOM HUD |
| Scenes use absolute frames (no `<Sequence>`) | Word timings are 1:1 with the SFX cue map |

\* This exact bug shipped once — `scripts/check_glyphs.py` now fails the build on it.

## Why the 3D is software

This box reports `fc-list` = 0 and its ANGLE/SwiftShader stack cannot initialise
Vulkan, so WebGL is unavailable. `<Scene3D>` therefore implements its own
perspective camera, depth fog, back-to-front sprite blitting and quad mapping on
Canvas 2D — the same maths `@react-three/fiber` would feed a GPU, executed on the
CPU with cached sprites. It averages **~0.34 s/frame** at 1080×1920.

## Typography

The machine has **zero system fonts**, so text painted before a webfont resolves
never repaints — it stays blank. Two defences:

1. **FontGate** — `delayRender` until `document.fonts.load()` (with real Arabic +
   Latin sample strings) has decoded every face, then mounts the composition.
2. **Data-URI embedding** — all 13 faces ship base64 inside the bundle with
   explicit `unicode-range`, so the Arabic and Latin subsets of Cairo coexist
   instead of shadowing each other.

## One command per video

```bash
./make.sh <slug> 30      # 30fps — the fast path (default)
./make.sh <slug> 60      # 60fps — reference quality
```

preflight (3s) → render → mobile cut → publish → links printed.
The content lives in `motion.config.ts`; the engine is fixed.
Every known trap is in `PITFALLS.md` and blocks the build in preflight.

Measured on this 2-vCPU box: **`0.069s × frames + 23s`**.

| Length @30fps | Total |
|---|---|
| 10s | ≈ 40s |
| 15s | ≈ 48s |
| 23s | ≈ 64s |

## First run after a sandbox reset

```bash
./setup.sh && source .toolenv
```

The repo always survives; the toolchain never does. `setup.sh` restores
dependencies, ffmpeg, headless Chromium, the audio palette and writes
`.toolenv` (the single source of truth for binary paths).

## Delivery

**Every video ships through GitHub raw — no other path reaches the user from
this sandbox.** See [DELIVERY.md](DELIVERY.md). One command:

```bash
./publish.sh
```

```
https://github.com/vitobytestudio/vitoai/raw/arena/c36750ba-vitoai/deliverables/vitoai-motion-master-1080x1920.mp4
```

## Build

```bash
./build_video.sh              # full pipeline
./build_video.sh --skip-render # re-master an existing out/master_raw.mp4
```

| Stage | What happens |
|---|---|
| 1 | `scripts/make_audio.py` synthesises the score, ambience and 9 SFX from scratch (no samples) |
| 2 | `scripts/export_captions.py` emits Whisper-schema `subtitles.json` |
| 3 | `scripts/check_glyphs.py` — **hard gate**: every non-ASCII char used in `src/` must exist in an embedded face, or the renderer process dies |
| 4 | `remotion render` · 1332 frames · h264 · aac |
| 5 | FFmpeg mastering: BT.709 conversion, film grade, `loudnorm I=-14 LUFS`, limiter, `+faststart` |
| 6 | Node HTTP server on `:8080` with byte-range streaming and a mobile download page |

## Sound design

The bed is a four-chord Am9 → Fmaj9 → Cmaj7 → G6 cycle with a sub-pulse every 0.9 s.
An automated volume envelope drops it **−18 dB** inside every speech window and
recovers with an exponential release. All 25 SFX cues are keyed to *frame numbers*,
so a whoosh starts on the exact frame a wipe begins.

## Timing map (frames @60)

| Scene | Range | Beat |
|---|---|---|
| Hook | 0–200 | cold open → *من الفكرة · إلى فيديو · خارق.* |
| Chaos | 200–420 | alarm palette, jammed render bar at 97 %, RENDER FAILED stamp |
| Reveal | 420–690 | impact → lattice snaps into a sphere → wordmark resolves |
| Proof | 690–960 | three glass metrics with live counters, real perspective |
| Punch | 960–1176 | three hard statements on a 60-frame grid |
| CTA | 1176–1332 | collapse into the mark, CTA pill, dip to black |
