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

## G — the door (Oct 2026)

- **A Latin-only display face will stall an Arabic headline.** Space Grotesk
  carries no Arabic glyphs; asking the renderer for a 104px headline in a family
  with no glyph for the text does not fall back gracefully — it hangs the frame
  until the render timeout and reports nothing useful. Route every string
  through `fontFor(rtl)` / `monoFor(rtl)`: Arabic gets Cairo, Latin gets Space
  Grotesk and JetBrains Mono. The same trap exists in the browser build, where
  it degrades to an invisible glyph instead of a hang.
- **Diagnose a hang by bisecting the props, not the code.** Injecting a real
  plan and shrinking it beat after beat located the failure in the hook's
  headline in four renders, after an hour of guessing at Audio and delayRender.
- **A world may appear once per film.** Cycling `allowed[i % n]` with three
  places and four place-beats repeated the Haussmann facade; the pool needs a
  second tier to draw from, not a modulus.
- **An empty lower half reads as a bug, not as restraint.** The hook frame only
  filled while copy animated in. A designed field under the type — bars that
  rise with the score — is what makes a sparse frame look intentional.
- **Narration needs its own scrim.** White text over a lit Haussmann facade is
  unreadable however good the shadow is; a 620px gradient at 55–90% black under
  the lower third fixes it and also seats the frame.
- **`Audio` must not receive an empty string.** `score: undefined` is fine;
  `src=""` raises a load error that surfaces as a generic render timeout.

## H — the studio, and the browser it really runs in

- **Arabic on a Latin stack hangs a still, twice, in silence.** First it was
  «مشاهد» in the contents page sitting on `MONO`; later a single Arabic-Indic
  numeral inside a `DISP` figure. Both produced the identical symptom — a 33 s
  `waitForReady` timeout with no error in the log — and both were found by
  rendering to string with `react-dom/server` first (fast, no browser) and then
  grepping the HTML for Arabic next to a Latin `font-family`. Rule: every string
  goes through `fam(rtl)` / `monoFam(rtl)`, and numerals through `rl(n, rtl)`.
- **Bundle size is a first-paint bug, not a footnote.** 2 684 290 B of
  `@remotion/player` + web-renderer parsed before the textarea accepted a
  keystroke read as "the page is frozen". Fix: `splitting: true`, the encoder
  behind `import("./exporter")`, and the maths split out of `kit.tsx` into
  `pure.ts` so the film's own components never pull the renderer. 286 KB on the
  first request, field focusable in 3 ms, first frame in 329 ms.
- **Never build the soundtrack on the input path.** A 28 s stereo 48 kHz WAV is
  ~5 MB and turns into a ~7 MB data URL; doing that inside the click handler
  cost 1.5 s of dead UI. Build it in `requestIdleCallback`, after the picture.
- **`@remotion/web-renderer` composites on WebGL.** In a headless sandbox with
  no GPU the capability probe does not return false — it blocks the main
  thread, so `await canRenderMediaOnWeb()` hangs forever behind a "rendering 0%"
  button. Probe `VideoEncoder` + a `webgl` context yourself, synchronously, and
  say what is missing in one sentence.
- **The sandbox Chromium has no fonts at all** unless `FONTCONFIG_FILE` points
  at a config that exists: `.render-tools/chromelibs/fonts.conf` lists
  `/var/task/fonts`, which is a Lambda path. Every glyph then lays out at zero
  height — text is invisible but present in the DOM, which reads as a CSS bug
  and is not one. `fonts-local/fonts.conf` → `/usr/share/fonts/truetype` fixed
  it. This matters for screenshots only, never for the delivered film: Remotion
  embeds its own faces.
- **Drive the browser over CDP, don't screenshot blind.** `tools/drive.mjs`
  opens a tab, types into the field, clicks Create and photographs the result;
  every claim about "feels instant" in this repository is measured there.


## I — a site, not a page

- **`router.ts` containing JSX does not compile.** esbuild resolves `.ts` before
  `.tsx`; a component in a `.ts` file fails with `Expected ">" but found "href"`,
  which reads like a syntax error in the JSX and is really a file extension. The
  router is `router.tsx`.
- **The Arabic page needs its own face and its own letter-spacing.** Cairo, with
  `letter-spacing: 0`, for every eyebrow, label and footnote — otherwise the
  tracked-out monospace that makes the Latin design feel premium turns Arabic
  into disconnected letters. `.site.rtl` does this once, at the root.
- **A front-page demo must be in the page's language.** Showing an Arabic film to
  a French visitor undoes the translation. `demoFilm(lang)` builds three demos;
  the planner had to learn French for that, which it now does (`isFrench`, a
  caption table, a narrator branch).
- **The film's fonts are subsets, so a dash is a box.** `L'arrivée. Position, plan
  et lumière — dans cet ordre.` rendered the em dash as tofu. Every string that
  reaches a frame goes through `txt()`, which converts em/en dashes to ` · `,
  non-breaking spaces to spaces and `…` to `...`. The line reads better for it.
- **A stat never shows a zero it cannot stand behind.** "0 files uploaded" was a
  truism dressed as a number; the fourth stat is now the trial's real limit.
- **A blank studio is a template.** The empty state renders three real beats of a
  real film, each labelled with the page architecture it actually got, computed
  from `chooseArch` rather than typed by hand.

## Spot pass — what actually broke (36 s Vito Byte film)

- **A link is invisible if its opacity is the product of two small numbers.**
  `near = (1 - len/420) * cl((1500 - d)/1100)` topped out around 0.13, then
  multiplied again by a pulse of ~0.4 → alpha 0.05 on a dark frame. The lattice
  rendered as loose dots with no edges. Rule for line work: compute one
  visibility term in the 0..1 range, and make the *weakest* case still ≥0.25.
- **`placeContent: center` on a wrapper is not inherited by an absolutely
  positioned child.** The drop cards sat top-left for a whole render because the
  body was inside `position:absolute; inset:0` with only a transform. Centering
  belongs on the element that actually holds the content.
- **A "whip" driven by `f % 60` fires on every bar, not on every cut.** Bar
  lines and cuts are not the same list once a film has sections that are not 2 s
  long. Keep an explicit `CUTS` array and derive both the shake and the flash
  from it.
- **`-shortest` with `-c:v copy` does not trim the audio.** The mux kept 0.86 s
  of tail past the last picture frame. Add `-t <picture length>` on the mux.
- **A panel that is 1060 px tall with 800 px of content reads as broken.** Size
  the glass to the content (916 px here) instead of padding it with `margin:auto`.
- **Freezing a descending counter at a value the slate does not agree with is
  the fastest way to look careless.** Every displayed number must be derived
  from one source of truth.

## Motion language — the five failures behind "it feels dry"

- **A reveal is not a move.** Every element entering with the same 0.16/1/0.3/1
  curve at 18 frames makes a frame that *appears*. Movement needs a
  destination that keeps travelling after the element has arrived: the camera.
- **A static plate has no depth, however nice the type.** `plate(depth)` with
  three separations (0.2 / 0.55 / 0.9) and a camera push is the difference
  between a poster and a shot.
- **Cuts that start from zero kill velocity.** A cut must carry motion across
  it — a 6-frame whip, a mask-match, or a scale-through. A hard cut plus a
  settle from rest is a slideshow.
- **Rotation on a full-frame wrapper moves type off its mark.** On a 1920px
  plane a 2° rotateY shifts a headline by 30+ px. Rotate *elements*, translate
  and scale *wrappers*. This cost three renders to find.
- **Flex centring plus a transform is not centring.** `display:flex` +
  `plate()` on the same node lands content at the flex start corner when the
  transform resets the containing block. Absolute coordinates per block, one
  transform per wrapper, verified with a still.

## EDGE — three traps that each cost a render

- **The `€` was a tofu box, and no font was missing it.** The woff2 subsets did
  carry U+20AC; the `unicode-range` the fonts are registered with stopped at
  U+2000-206F, so the browser refused the face and fell through to nothing.
  `src/fonts.ts` now appends `U+20A0-20CF` for the three Latin families. If a
  glyph renders as a box, check the *range* before you check the *font*.
- **Space Grotesk's counters are squarish, and squarish looks like clipping.**
  At 132 px the flat tops of `W A S T E D` and of `0` read exactly like a
  `clip-path` bug. Ten minutes went into "fixing" a font that was fine. Settle
  it with pixels, not eyes: crop a column and print the luminance ramp —
  a real clip gives a 1 px step, a glyph gives a 5 px anti-aliased ramp.
- **A whip pan with nothing to blur is a black dropout.** Cutting to a new
  scene and sliding that scene in leaves 3-4 frames of empty frame. A whip needs
  the *light crossing the lens*: a wide, heavily blurred white→emerald streak at
  0.4 opacity, fading with the move. Same for the mid-scene cuts.
