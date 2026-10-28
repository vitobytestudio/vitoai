# PITFALLS — every trap this sandbox has, and the guard that stops it

> Read this before touching the renderer. Each row cost a destroyed render at
> least once. Each one is now caught by `scripts/preflight.sh` in under 3s.

## A. Kills the render (browser tab dies, message is useless)

| Symptom | Real cause | Guard |
|---|---|---|
| Glyphs like `→` `▲` `█` are in **no** bundled face | same crash; the Latin guard covers it |
| `ProtocolError: Target closed` — no stack, no clue | A character painted in Arabic copy that **no `@font-face` covers**. Chromium falls back to a system font; this box has zero fonts, so the tab dies. | `scripts/check_glyphs_cf.py` |
| Same crash, only on one scene | `font-weight: 600` (or 500) on Cairo. Only 400/700/800/900 exist. 600 resolves to 700, which is the **Arabic-only** subset. | glyph check reports `NEEDS-900` |
| Copy renders as `□□□` boxes | Missing `U+0020` in the face's `unicode-range` | every range starts `U+0020, U+00A0, …` |
| Text is invisible | `ctx.fillText` — canvas text paints **0 px** here | preflight greps `fillText` / `strokeText` |

### The glyph rule, stated once

```
Cairo ARABIC subset  (400/700/800/900) -> Arabic block only
                                          NO '.'  NO '—'  NO '%'  NO '·'
Cairo LATIN  subset  (800/900  ONLY)   -> ASCII + U+2000-206F
```

So: **Arabic copy that contains any punctuation or Latin character must be
painted at weight 800 or 900.** At 700 it must be Arabic-block characters only.
There is no third option — `sans-serif` has nothing to fall back to.

## A2. 3D camera — the traps that are specific to projection

| Symptom | Cause | Guard in repo |
|---|---|---|
| Giant streaks smear over the whole frame, content vanishes | a point **behind** the lens: `project()` clamps depth to `NEAR`, so the scale becomes `FOV/26 = 44x` | `Swarm` culls `depth < 260` before projecting — never clamp, always cull |
| Cards pop in and out of existence | depth recycled without a crossfade | `fadeNear/fadeFar` in `world()` + near-fade on `pl.scale` |
| Type looks pasted on top of the 3D | text placed in 2D screen space | `world()` runs the same projection the canvas does, so type inherits scale, blur and haze |
| "Motion blur" kills the render | a full-frame CSS or canvas blur filter | streaks are **drawn** from previous to current position (one stroke); whip cuts use a small per-layer blur only |
| Ring/row of objects reads flat | all objects share one y | derive x and y from the same orbit angle |
| Extruded title looks like a shadow | one layer offset in z | N copies stacked in a `preserve-3d` context, back copies darkened + blurred |

## B. Silently wrong picture

| Symptom | Cause | Fix in repo |
|---|---|---|
| Colours look washed on phones | render is `yuvj420p(pc, bt470bg)` | `--color-space=bt709` at render time (was: a second 96s mastering pass) |
| Black is milky grey | `pc → tv` range never converted | covered by the same flag |
| Thin wireframe disappears | unsharp/contrast was doing the work in mastering | line alphas raised in `Globe.tsx` |
| Word-by-word caption overlaps | scene offset applied twice after switching to absolute frames | `local = frame - word.to` — never re-add the scene `from` |
| Globe reads as a fuzzy ball | a point cloud without a graticule | 12 meridians + parallels in `Globe.tsx`; this is what makes it read as a planet |
| Sphere has no depth | transparent body | off-centre radial body fill + rim light |

## C. Silent timeline damage

| Symptom | Cause | Fix |
|---|---|---|
| Audio drifts out of sync | `<Sequence>` re-bases every child's frame | `Gated` — scenes read the **absolute** frame |
| Everything is 2x slow at 30fps | timings authored at 60fps | `timeline.ts` — scale the clock, never re-author (`frame = raw * 60/fps`) |
| Springs feel wrong after an fps change | `spring()` needs the **authored** fps, not the render fps | pass `AUTHORED_FPS` explicitly |
| Composition id rejected | ids must match `[a-zA-Z0-9-]` | only that charset |

## D. Environment

| Symptom | Cause | Fix |
|---|---|---|
| `npm install` → `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | box intercepts TLS | `NODE_EXTRA_CA_CERTS` set inside `setup.sh` |
| tools vanish between sessions | `node_modules`, chromium are excluded from the snapshot | `setup.sh` + `ensure_tools.sh` (auto-runs before any render) |
| `npm install --no-save X` deletes ffmpeg | `--no-save` prunes the rest of the tree | tools live in `devDependencies` |
| WebGL unavailable | no GPU | software rasteriser, `--gl=swangle` |
| `apt-get` fails | offline | bundled binaries only |
| GitHub Release upload fails | `uploads.github.com` blocked | publish as repo files → `publish.sh` |

## The measured cost of each step (2 vCPU)

| Step | Time |
|---|---|
| frame capture + encode | **0.069 s / frame** (the hard floor) |
| fixed startup (bundle + browser) | ~8 s |
| mobile cut (`ultrafast`) | ~5 s |
| git push (~8 MB) | ~10 s |
| render pass to fix colour | **96 s — eliminated** |

`0.069 × frames + 23s overhead`. That is the whole performance model:

| Length @30fps | Frames | Total |
|---|---|---|
| 10 s | 300 | **≈ 40 s** |
| 15 s | 450 | ≈ 48 s |
| 23 s | 690 | ≈ 66 s |

Anything slower than this model is a regression — check it first.
