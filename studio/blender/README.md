# studio/blender — generated 3D scenes, on this box

The step beyond montage: scenes that are *built*, not composited. Real geometry, real
light, real depth of field, Arabic type as an object you can walk around.

## What is here

| file | what it does |
|---|---|
| `setup_env.sh` | builds the headless Blender environment from nothing (~20 s once `/tmp` is warm) |
| `bpyrun.py` | launcher — loads `libusd_ms.so` RTLD_GLOBAL before `import bpy`, then runs a script |
| `ar.py` | Arabic text → shaped (HarfBuzz) → outlines (fontTools) → watertight mesh (earcut) |
| `stage.py` | the studio: Cycles settings, world, matte floor, area-light strips, metal/emission shaders, camera framing, compositor glare |
| `scene_hero.py` | NAKSAB 3D hero: the wordmark in metal rising out of a slab under a live network |
| `extract_fonts.py` | unpacks the film fonts from `src/fontData.ts` into `/tmp/fonts/*.ttf` |

## Run

```bash
bash studio/blender/setup_env.sh                       # /tmp is wiped between sandboxes
LD_LIBRARY_PATH=/tmp/vitobl/lib /tmp/vitobl/bin/python \
  studio/blender/bpyrun.py studio/blender/scene_hero.py --out /tmp/hero3d --from 1 --to 24
```

Frames already on disk are skipped, so an interrupted sequence resumes where it died.
Then encode (bloom + vignette + grain in ffmpeg, because the compositor is fragile across
Blender majors):

```bash
$FF -y -framerate 24 -i /tmp/hero3d/f_%04d.png \
   -filter_complex "[0:v]split[a][b];[b]gblur=sigma=16,eq=brightness=-0.05[b];[a][b]blend=all_mode=screen:all_opacity=0.30,vignette=PI/4.6,noise=alls=2.2:allf=t" \
   -c:v libx264 -crf 17 -pix_fmt yuv420p /tmp/hero3d.mp4
```

## The honest budget — read this before planning a film around 3D

2 CPU cores, no GPU, Cycles:

| what | cost per frame |
|---|---|
| 1080×1920, 14 spp, denoise, DOF + motion blur, glossy floor | **~60 s** |
| 1080×1920, 40 spp, same scene | ~90 s |
| 720×1280, 16 spp | ~12 s |

So **30 s of video = 900 frames ≈ 15 hours.** A 24 s *insert* is 24 frames ≈ 25 min and
that is the right size of bite: 3D carries one or two beats of a 25–30 s film, montage
carries the rest. Any brief that wants a fully generated 40 s film is a lie at this
hardware, and saying so is part of the job.

## Traps this directory exists to remember

1. **`import bpy` fails with a USD undefined symbol** even though the symbol is right
   there in `bpy/lib/libusd_ms.so` — the module is pulled in RTLD_LOCAL. `bpyrun.py`
   loads it first with RTLD_GLOBAL.
2. **No X, no GL, no apt.** `libGL / libXrender / libXi / libXt / libICE / libSM /
   libxkbcommon` are simply missing. Cycles-CPU never calls into them, so `setup_env.sh`
   writes empty libraries exporting exactly the symbols the loader asks for. The set is
   computed as *(everything bpy references) − (everything bpy's own libs, the interpreter
   and libc already define)*. Stub `exit` or `PyExc_KeyError` because some `nm` output
   mentioned them and Blender dies with **no message at all**.
3. **`ldd -r` is a liar here**: it reports 0 undefined symbols while python's import
   fails, because the missing ones are only needed under `RTLD_NOW`. Trust the import.
4. **Blender 5.0 renames**: `Curve.fill_mode` has no `BOTH`; the Glare node's enum items
   are display strings (`"Fog Glow"`) and the amount input is `Strength`, not `Mix`;
   there is no `CompositorNodeComposite` (a node group ends in `NodeGroupOutput`);
   `mathutils.geometry.triangulate` is gone. Every one of those is wrapped in a
   `try` — a render must never die over a renamed knob.
5. **Blender does not shape Arabic.** Its FONT curve draws isolated, unjoined glyphs in
   LTR order. Shape with HarfBuzz, pull outlines with fontTools, build the mesh yourself.
6. **A CURVE with `extrude` fills each contour separately** — the counter of ة becomes a
   floating disc and the word looks like crumpled foil. Triangulate all rings of a glyph
   in one earcut pass and recalc normals.
7. **Emissive planes as "studio strips" show up in the frame** (with
   `visible_camera = False` in 5.0 they still lit the shot). A rectangular **area light**
   is invisible to camera rays by definition: that is the softbox.
