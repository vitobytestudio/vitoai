"""
NAKSAB — 3D hero: the wordmark cut in metal, rising out of a polished slab,
with the talent network burning above it. This is the proof that the studio can
generate real scenes, and the plate Ep.03 will be built around.

    LD_LIBRARY_PATH=/tmp/glstub/lib /tmp/bvenv/bin/python studio/blender/scene_hero.py \
        --out /tmp/hero3d --from 1 --to 48 --samples 20

Frames are skipped if they already exist, so an interrupted sequence resumes.
"""
from __future__ import annotations

import argparse
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import ar  # noqa: E402
import stage  # noqa: E402

BLACK = "#04060B"
BLUE = "#2F5BFF"
WHITE = "#FFFFFF"

N = 48           # frames of the insert
FPS = 24         # 2.0 s — the cadence real brand films cut 3D inserts at


def bbox(ob):
    bpy.context.view_layer.update()
    pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    xs = [p.x for p in pts]
    ys = [p.y for p in pts]
    zs = [p.z for p in pts]
    return (min(xs), max(xs)), (min(ys), max(ys)), (min(zs), max(zs))


def lattice(count=20, seed=7):
    """A network that is not random: two arcs at different depths, so it reads as
    infrastructure rather than confetti."""
    rng = seed
    pts = []
    for i in range(count):
        rng = (rng * 1103515245 + 12345) % 2147483648
        j = (rng >> 8) / 16777216.0 - 0.5
        u = i / (count - 1)
        arc = 0 if i % 2 == 0 else 1
        x = -3.6 + 7.2 * u + j * 0.5
        y = (2.6 if arc == 0 else 5.2) + j * 0.7
        z = (1.05 if arc == 0 else 2.30) + math.sin(u * math.pi) * 0.45 + j * 0.30
        pts.append(Vector((x, y, z)))
    return pts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="/tmp/hero3d")
    ap.add_argument("--from", dest="f0", type=int, default=1)
    ap.add_argument("--to", dest="f1", type=int, default=N)
    ap.add_argument("--samples", type=int, default=14)
    ap.add_argument("--font", default="/tmp/fonts/Tajawal-800.ttf")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    sc = stage.new_scene(samples=a.samples, motion_blur=True, exposure=-0.25)
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = a.f0, a.f1
    stage.world_gradient(sc, top=(0.0035, 0.0055, 0.0125), bottom=(0.0, 0.0, 0.0015))
    stage.floor(z=0.0, rough=0.62, base=(0.0032, 0.0042, 0.0075), bump=0.0002)


    # ---- the word
    word = ar.arabic_mesh("word", "نكسب", a.font, size=1.0, depth=0.16)
    bpy.ops.object.select_all(action="DESELECT")
    word.select_set(True)
    bpy.context.view_layer.objects.active = word
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    (x0, x1), (y0, y1), (z0, z1) = bbox(word)
    word.location.z = -z0 + 0.012
    (x0, x1), (y0, y1), (z0, z1) = bbox(word)
    word.data.materials.append(stage.metal("steel", (0.60, 0.64, 0.70), rough=0.22, aniso=0.25))
    W, H = x1 - x0, z1 - z0
    cx = (x0 + x1) / 2
    cz = (z0 + z1) / 2
    base_z = word.location.z

    # ---- the network
    pts = lattice(20)
    nodes, mats = [], []
    for i, p in enumerate(pts):
        hub = i in (4, 9, 14)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.030 if hub else 0.017, location=p)
        ob = bpy.context.object
        ob.name = f"n{i}"
        m = stage.emission(f"nm{i}", stage.srgb(WHITE) if hub else stage.srgb(BLUE), 3.2 if hub else 1.4)
        ob.data.materials.append(m)
        ob.visible_shadow = False
        nodes.append((ob, p, m, hub, i * 0.37))
        mats.append(m)

    cu = bpy.data.curves.new("edges", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 0.0055
    cu.bevel_resolution = 2
    cu.fill_mode = "FULL"
    em = stage.emission("edge", stage.srgb(BLUE), 0.55)
    cu.materials.append(em)
    cz = (z0 + z1) / 2
    seen = set()
    for i, p in enumerate(pts):
        d = sorted((( (pts[j] - p).length, j) for j in range(len(pts)) if j != i))[:2]
        for _, j in d:
            key = (min(i, j), max(i, j))
            if key in seen:
                continue
            seen.add(key)
            sp = cu.splines.new("POLY")
            sp.points.add(1)
            sp.points[0].co = (p.x, p.y, p.z, 1)
            sp.points[1].co = (*pts[j], 1)
    edges = bpy.data.objects.new("edges", cu)
    sc.collection.objects.link(edges)

    # ---- lights: a studio, not a sun — the strips are what the metal reflects
    k, f, r = stage.key_three_light(blue=stage.srgb(BLUE))
    k.data.energy, f.data.energy, r.data.energy = 520.0, 140.0, 430.0
    stage.strip_light("top", (0.0, -1.2, 7.2), size=(11.0, 1.5), power=150.0,
                      target=(cx, 0.0, cz))
    stage.strip_light("edge-l", (-6.0, -0.6, 1.3), size=(6.0, 0.55), power=215.0,
                      target=(cx, 0.0, cz))
    stage.strip_light("edge-r", (6.0, -0.6, 1.1), size=(4.6, 0.45), power=150.0,
                      target=(cx, 0.0, cz))
    stage.strip_light("rim", (0.6, 6.4, 2.9), size=(9.0, 1.0), power=300.0,
                      color=stage.srgb(BLUE), target=(cx, 0.0, cz))
    sweep = stage.area("sweep", (-7.0, -1.5, 2.4), 900, 0.7, (0.92, 0.95, 1.0),
                        target=(cx, 0, cz), rect=5.5)
    sweep.visible_shadow = False

    # ---- camera frames the word AND the network over it, not just the type
    bpy.context.view_layer.update()
    pts = [Vector((p.x, p.y, p.z)) for p in [n[1] for n in nodes]]
    allz = [min(p.z for p in pts), max(p.z for p in pts)]
    allx = [min(p.x for p in pts), max(p.x for p in pts)]
    top = max(z1, allz[1] + 0.25)
    word_w = x1 - x0
    centre = (cx, 0.0, top * 0.50)

    # ---- camera path
    stage.compositor_glare(threshold=1.02, mix=-0.46, size=7)
    cam_d = bpy.data.cameras.new("C")
    cam = bpy.data.objects.new("C", cam_d)
    sc.collection.objects.link(cam)
    sc.camera = cam

    for i in range(a.f0, a.f1 + 1):
        path = os.path.join(a.out, f"f_{i:04d}.png")
        if os.path.exists(path):
            continue
        t = (i - 1) / (N - 1)
        e = stage.clamp01(t / 0.42)

        # the word climbs out of the slab and settles
        rise = (1 - stage.ease_out_cubic(e)) * -1.55
        word.location.z = base_z + rise
        word.rotation_euler.y = math.radians(6.0 - 10.0 * stage.ease_in_out_cubic(t))

        # the highlight travels across the metal
        sweep.location.x = -7.0 + 14.0 * stage.ease_in_out_cubic(t)
        sweep.data.energy = 900 + 2200 * math.sin(math.pi * t) ** 2

        # network breathes
        tau = t * math.pi * 1.6
        for ob, p, m, hub, ph in nodes:
            ob.location = (p.x + 0.05 * math.sin(tau + ph),
                           p.y + 0.035 * math.cos(tau * 0.8 + ph),
                           p.z + 0.045 * math.sin(tau * 1.2 + ph * 1.7))
            stage.pulse(m, (2.6 + 1.5 * math.sin(tau * 2 + ph)) if hub else
                        (0.9 + 0.8 * max(0.0, math.sin(tau * 2.4 + ph))))
        stage.pulse(em, 0.35 + 0.5 * t)

        c = (centre[0], centre[1], centre[2] + rise * 0.34)
        stage.frame_camera(cam, c, word_w * 1.03, top + 0.45,
                           margin=1.40 - 0.16 * stage.ease_in_out_cubic(t),
                           azimuth_deg=-9.0 + 13.0 * stage.ease_in_out_cubic(t),
                           elevation_deg=10.5 - 4.5 * stage.ease_in_out_cubic(t),
                           lens=68.0, fstop=5.6)

        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        print(f"FRAME {i} {t:.2f}", flush=True)

    print("SCENE DONE", a.out, flush=True)


main()
