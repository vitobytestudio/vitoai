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

## §D  Download links — what actually serves an MP4

Verified 2026-10-29 by fetching each URL from outside the sandbox:

| Channel | MP4? | Note |
|---|---|---|
| `raw.githubusercontent.com/<repo>/<ref>/path` | **YES** | direct, no redirect. Often blocked/throttled on some ISP networks — this was the real cause of "links don't work". |
| `github.com/<repo>/raw/<ref>/path` | YES | 302 → `raw.githubusercontent.com`, so it inherits that block. |
| `cdn.jsdelivr.net/gh/<repo>@<ref>/path` | **NO** | returns `403 Package size exceeded the configured limit of 50 MB` for this repo (169 MB), and `500` on `.mp4` even from a ≤50 MB tag. Also caches the failure ~12 h. |
| `cdn.statically.io/gh/...` | **NO** | `File type not allowed` for mp4. |
| `rawcdn.githack.com/...` | redirect | 302 → raw.githubusercontent, so no help when raw is blocked. |
| `ghfast.top/https://raw.githubusercontent.com/...` | **YES** | server-side proxy, different domain — best fallback. |
| `gh-proxy.com/https://raw.githubusercontent.com/...` | **YES** | second proxy fallback. |

**Rule:** always hand out the master on `ghfast.top` first, `gh-proxy.com` second, direct raw third.
Put deliverables behind an **immutable tag** (`cdn-N`), not a branch, so links survive branch commits.

```bash
# build a delivery-only tag (does not touch the branch or any history)
export GIT_INDEX_FILE=/tmp/cdn.idx && rm -f /tmp/cdn.idx
git read-tree --empty
git update-index --add cdn/vito-autonomy-master.mp4 cdn/vito-autonomy-lite.mp4
T=$(git write-tree) && C=$(git commit-tree $T -m "cdn") && unset GIT_INDEX_FILE
git tag -f cdn-4 $C && git push -q origin refs/tags/cdn-4 --force
```

**Rotation protocol (user's rule):** publish → user downloads → user confirms → `git rm` the file from the
working tree + force the tag to a tree without it. Never rewrite history (`filter-branch`/`filter-repo`)
and never delete the repo root; deleting a blob from a branch tip does **not** shrink packed history,
it only removes it from future serving.

## E — procedural places (Oct 2026)

- **`mix()` must parse its own output.** It returned `rgb(...)`, and the natural
  thing to write is `mix(mix(a, b, 0.2), "#000", 0.4)`. The second call parsed
  `rgb(` as hex, produced `NaN`, the browser dropped the declaration, and nested
  blends rendered as *transparent* — which read as "the facade is missing".
  Always round-trip colours through one parser.
- **SVG layers are not reliable for procedural scenography.** The skyline built
  from `<svg><rect>` rendered empty while the identical data as absolutely
  positioned divs rendered correctly. Use divs for anything that must appear.
- **Review order matters, not just review content.** The budget pass trimmed the
  logo card to 1.6 s *after* the minimum-duration check had already passed it, so
  the second round flagged a problem the first round created. Any critic needs
  `floor` exceptions per beat kind and must run twice.
- **A silhouette needs density.** Sprinkling 22 buildings at random x leaves a
  skyline full of holes; marching them across the frame with overlapping widths
  and varying heights is what makes it read as a city.
- **Never let a repair drop copy silently.** The headline re-wrap once sliced to
  three lines and discarded the rest without saying so. Every edit must be logged
  with what was held back.

## F — sound (Oct 2026)

- **A silent render is not a deliverable.** The product film shipped without an
  audio stream and immediately read as a downgrade, because it was one. Every
  delivery now runs through `studio/make-film.sh`, which generates the score,
  merges it and normalises to -14 LUFS in the same command.
- **Sound and picture must share one source of truth.** The score generator
  reads the cue sheet that the picture is cut from (`cueSheet()` in
  `src/studio/productplan.ts`). When the two were separate, cuts and impacts had
  different timings; now a change to a beat's duration moves both.
- **Verify the mix by looking at it.** `showspectrumpic` and `showwavespic`
  reveal what ears miss on a laptop: no impacts on the cuts, a riser that never
  arrives, a bed with no harmonic movement. The spectrum should show pads
  changing with each act, vertical lines exactly on the cuts, and a rising curve
  before the biggest beat.
- **Software clipping is free and better than a limiter here.** `tanh(x * 1.15)`
  before normalising keeps the transients musical; a hard limiter made the
  impacts sound like a compressor was pumping.
- **Three libraries will be reached for and none is needed.** Sine + noise +
  envelope is a complete sound design toolkit at 48 kHz; 23 s of stereo score
  synthesises in half a second.
