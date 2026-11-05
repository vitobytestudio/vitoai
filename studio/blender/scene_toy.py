"""
scene_toy.py — «الطابق الأخير», the game's own shots: blocky toy figures in the corridor.

    LD_LIBRARY_PATH=/tmp/vitobl/lib /tmp/vitobl/bin/python studio/blender/bpyrun.py \
        studio/blender/scene_toy.py --shot spawn --out /tmp/lastfloor/spawn --from 1 --to 24

Four shots and two stills, all the same set (the corridor of the horror beat, so the
trailer and the film are the same place):

    spawn   the squad assembles itself out of loose bricks      24 fr @ 24
    lineup  four figures walk past the camera in single file    30 fr
    stalk   what the game actually hunts with                   24 fr
    run     the sprint, and one of them stops existing          30 fr
    hero    the poster frame (one still, full res)               1 fr
    face    the jump frame (one still, full res)                 1 fr

Same rule as the horror scene: everything is evaluated from the frame index, so any
subset of frames is self-consistent, and no two shots can drift apart in timing.
"""
from __future__ import annotations

import argparse
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import stage  # noqa: E402
import toys  # noqa: E402

FPS = 24
WARM = (1.0, 0.55, 0.22)
COLD = (0.40, 0.58, 0.98)
ACCENT = (0.86, 0.27, 0.05)          # the game's orange, sRGB-ish
ICE = (0.20, 0.44, 0.80)             # and its cold complement
X, Y0, Y1, ZC = 1.35, -7.4, 2.0, 2.55
DUR = {"spawn": 24, "stalk": 24, "run": 30, "hero": 1, "face": 1}   # lineup was cut: a walk
# cycle is a tech demo, not a story beat (see PITFALLS)


def hash01(i, salt=0):
    x = (i * 2654435761 + salt * 40503) & 0xFFFFFFFF
    x ^= x >> 15
    x = (x * 2246822519) & 0xFFFFFFFF
    x ^= x >> 13
    return (x & 0xFFFFFF) / 0xFFFFFF


def box(name, loc, dims, mat=None, rot=(0.0, 0.0, 0.0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = dims
    ob.rotation_euler = rot
    if bevel > 0:
        bv = ob.modifiers.new("bv", "BEVEL")
        bv.width = bevel
        bv.segments = 2
    if mat is not None:
        ob.data.materials.append(mat)
    return ob


def bulb_level(t: float, i: int, seed: int = 0, alive: bool = False) -> float:
    """One alive, two warnings, the long dark, one violent return — the same curve as
    the horror beat on purpose, so the two pieces of film feel lit by the same bulb."""
    j = 0.93 + 0.14 * (hash01(i + seed, 3) - 0.5)
    if alive:
        # the squad arrives, the lights stutter twice and stay on: the shot still has a
        # pulse of dread in it, but it does not end blind
        if 0.26 <= t < 0.30:
            return 0.14
        if 0.58 <= t < 0.615:
            return 0.20 + 0.7 * max(0.0, math.sin((t - 0.58) / 0.035 * math.pi))
        return j
    if t < 0.10:
        return j
    if t < 0.145:
        return 0.12 + 0.88 * max(0.0, math.sin((t - 0.10) / 0.045 * math.pi))
    if t < 0.44:
        return j
    if t < 0.47:
        return 0.16
    if t < 0.66:
        return j
    if t < 0.80:
        return 0.0
    if t < 0.86:
        return 3.0 * (0.9 + 0.2 * hash01(i + seed, 7))
    return max(0.0, 1.0 - (t - 0.86) / 0.10) * 0.85


# ------------------------------------------------------------------------------ set
def build_set(sc, m):
    """The corridor: slabs, not booleans, with the details a camera actually reads."""
    box("floor", (0, (Y0 + Y1) / 2, 0), (X * 2 + 0.4, Y1 - Y0 + 3.0, 0.14), m["concrete"])
    box("ceil", (0, (Y0 + Y1) / 2, ZC), (X * 2 + 0.4, Y1 - Y0 + 3.0, 0.14), m["paint"])
    box("wall-l", (-X, (Y0 + Y1) / 2, ZC / 2), (0.14, Y1 - Y0 + 3.0, ZC), m["paint"])
    box("wall-r", (X, (Y0 + Y1) / 2, ZC / 2), (0.14, Y1 - Y0 + 3.0, ZC), m["paint"])

    DW, DH = 0.98, 2.06
    box("far-l", (-(DW / 2 + (X - DW / 2) / 2), Y1, ZC / 2), (X - DW / 2, 0.2, ZC), m["paint"])
    box("far-r", ((DW / 2 + (X - DW / 2) / 2), Y1, ZC / 2), (X - DW / 2, 0.2, ZC), m["paint"])
    box("far-top", (0, Y1, (ZC + DH) / 2), (DW + 0.3, 0.2, ZC - DH), m["paint"])
    for sx in (-1, 1):
        box("jamb", (sx * (DW / 2 + 0.035), Y1 - 0.02, DH / 2), (0.07, 0.16, DH + 0.08), m["dark"])
    box("header", (0, Y1 - 0.02, DH + 0.03), (DW + 0.15, 0.16, 0.08), m["dark"])

    box("beyond-floor", (0, Y1 + 2.6, 0), (4.6, 5.4, 0.14), m["concrete"])
    box("beyond-back", (0, Y1 + 5.2, 1.6), (5.0, 0.2, 3.4), m["paint"])
    win = box("window", (0.55, Y1 + 5.05, 1.95), (1.35, 0.02, 1.05), m["win"])
    win.visible_shadow = False
    for k in range(4):
        box("bar", (0.55 - 0.5 + k * 0.34, Y1 + 5.0, 1.95), (0.035, 0.05, 1.05), m["dark"])

    # a painted queue line on the floor: the one thing a game level always has
    box("stripe", (0.0, (Y0 + Y1) / 2, 0.072), (0.09, Y1 - Y0 + 1.0, 0.006), m["accent"], bevel=0.002)
    for k in range(11):
        box("tick", (-0.62, Y0 + 0.5 + k * 0.86, 0.072), (0.36, 0.05, 0.005), m["accent"])

    # props: a stack of the toy's own bricks, a cone, a bench. Scale is the whole trick —
    # everything in the room is bigger than the figures, so the figures read as toys.
    box("bench", (-X + 0.30, -3.55, 0.20), (0.52, 1.5, 0.075), m["wood"], rot=(0, 0, 0.02))
    for k, yy in enumerate((-4.05, -3.05)):
        box("benchleg", (-X + 0.30, yy, 0.10), (0.10, 0.10, 0.20), m["dark"])
    box("cone-base", (X - 0.42, -2.05, 0.09), (0.34, 0.34, 0.035), m["accent"])
    box("cone-top", (X - 0.42, -2.05, 0.26), (0.10, 0.10, 0.32), m["accent"], bevel=0.03)
    for k in range(3):
        box("brick", (-X + 0.42, -1.25 + k * 0.30, 0.10 + k * 0.19),
            (0.30 - k * 0.02, 0.19, 0.18), m["accent" if k % 2 else "ice"], rot=(0, 0, 0.10 * (k - 1)))

    # the bulb, on a cord, off-centre like everything a human installed
    BX, BY, BZ = 0.16, -1.05, 2.02
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.038, segments=20, ring_count=14, location=(BX, BY, BZ))
    bulb = bpy.context.object
    bulb.name = "bulb"
    bulb.data.materials.append(m["filament"])   # the shell *is* the emitter at this size
    fil = m["filament"]
    box("filament", (BX, BY, BZ - 0.004), (0.010, 0.010, 0.026), m["filament"])
    box("cord", (BX, BY, (ZC - 0.07 + BZ) / 2), (0.008, 0.008, ZC - 0.07 - BZ), m["dark"])
    box("socket", (BX, BY, BZ + 0.045), (0.042, 0.042, 0.05), m["dark"], bevel=0.008)
    bulb_l = bpy.data.lights.new("bulbl", "POINT")
    bulb_l.color = WARM
    bulb_l.shadow_soft_size = 0.05
    bulb_lo = bpy.data.objects.new("bulbl", bulb_l)
    sc.collection.objects.link(bulb_lo)
    bulb_lo.location = (BX, BY, BZ - 0.03)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, (Y0 + Y1) / 2, ZC / 2))
    vol = bpy.context.object
    vol.name = "air"
    vol.scale = (X * 2, Y1 - Y0 + 1.2, ZC)
    vm = bpy.data.materials.new("airvol")
    vm.use_nodes = True
    nt = vm.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    pv = nt.nodes.new("ShaderNodeVolumePrincipled")
    pv.inputs["Color"].default_value = (0.55, 0.60, 0.72, 1.0)
    pv.inputs["Density"].default_value = 0.05
    pv.inputs["Anisotropy"].default_value = 0.5
    nt.links.new(pv.outputs["Volume"], out.inputs["Volume"])
    vol.data.materials.append(vm)
    vol.visible_shadow = False
    vol.display_type = "WIRE"

    lights = {
        "moon": stage.area("moon", (0.55, Y1 + 3.3, 1.72), 130.0, 1.9, COLD,
                           target=(0.30, Y1 + 5.05, 0.95), rect=1.35),
        "bounce": stage.strip_light("bounce", (0.0, Y1 + 0.9, 0.18), size=(1.9, 0.45), power=95.0,
                                     color=COLD, target=(0.0, Y1 - 2.4, 1.1)),
        "edge-l": stage.strip_light("edge-l", (-2.6, -3.2, 2.10), size=(0.5, 2.4), power=95.0,
                                     color=(0.55, 0.68, 1.0), target=(-1.0, -2.2, 1.0)),
        "edge-r": stage.strip_light("edge-r", (2.7, -2.0, 1.95), size=(0.5, 2.2), power=70.0,
                                     color=(1.0, 0.72, 0.45), target=(1.0, -2.2, 1.0)),
        # the toys need a key of their own: a moulded figure with no highlight on it is a
        # black silhouette, however good the plastic shader is
        "toy-key": stage.strip_light("toy-key", (0.45, -3.55, 2.18), size=(1.7, 1.25), power=52.0,
                                      color=(1.0, 0.78, 0.52), target=(0.05, -1.80, 0.86)),
        "toy-top": stage.strip_light("toy-top", (0.0, -1.80, 2.46), size=(1.2, 1.6), power=17.0,
                                     color=(0.80, 0.88, 1.0), target=(0.0, -1.80, 0.60)),
    }
    # the player's torch: a first-person film is lit by what the player is holding
    td = bpy.data.lights.new("torch", "SPOT")
    td.energy = 150.0
    td.color = (1.0, 0.90, 0.76)
    td.spot_size = math.radians(46.0)
    td.spot_blend = 0.55
    td.shadow_soft_size = 0.09
    torch = bpy.data.objects.new("torch", td)
    sc.collection.objects.link(torch)
    return {"bulb": bulb, "bulb_l": bulb_l, "fil": fil, "win": m["win"], "vol": pv,
            "lights": lights, "bulb_xyz": (BX, BY, BZ), "torch": torch}


def make_materials():
    m = {}
    m["concrete"] = toys.paint("toy-concrete", (0.020, 0.021, 0.025), rough=0.52)
    m["paint"] = toys.paint("toy-paint", (0.038, 0.041, 0.049), rough=0.66)
    m["wood"] = toys.paint("toy-wood", (0.048, 0.030, 0.017), rough=0.5)
    m["dark"] = stage.metal("toy-dark", (0.014, 0.014, 0.016), rough=0.45, aniso=0.15)
    m["accent"] = toys.plastic("plastic-accent", ACCENT, rough=0.26, coat=0.5)
    m["ice"] = toys.plastic("plastic-ice", ICE, rough=0.30, coat=0.45)
    m["skin"] = toys.plastic("plastic-skin", (0.85, 0.66, 0.30), rough=0.34, coat=0.35)
    m["shirtA"] = toys.plastic("plastic-shirtA", (0.72, 0.24, 0.05), rough=0.30)
    m["shirtB"] = toys.plastic("plastic-shirtB", (0.16, 0.36, 0.70), rough=0.30)
    m["shirtC"] = toys.plastic("plastic-shirtC", (0.30, 0.32, 0.36), rough=0.34)
    m["shirtD"] = toys.plastic("plastic-shirtD", (0.10, 0.42, 0.38), rough=0.30)
    m["pants"] = toys.plastic("plastic-pants", (0.045, 0.05, 0.065), rough=0.52, coat=0.12)
    m["ghost"] = toys.plastic("plastic-ghost", (0.012, 0.013, 0.016), rough=0.44, coat=0.3)
    m["bone"] = toys.plastic("plastic-bone", (0.60, 0.60, 0.56), rough=0.40, coat=0.2, scratch=0.6)
    m["glass"] = stage.emission("bulbglass", WARM, 1.0)
    m["filament"] = stage.emission("filament", WARM, 22.0)
    m["lampface"] = stage.emission("lampface", (0.85, 0.93, 1.0), 2.4)
    m["win"] = stage.emission("win", COLD, 1.4)
    return m


# ------------------------------------------------------------------------------ shots
def build(shot: str):
    sc = bpy.context.scene
    m = make_materials()
    setd = build_set(sc, m)
    av = {}
    CAM_AT = {"spawn": (-1.12, -6.05, 1.42), "hero": (0.0, -6.62, 1.60),
              "lineup": (-1.30, -3.55, 0.94), "run": (0.0, -7.05, 1.06)}
    if shot in ("spawn", "lineup", "run", "hero"):
        crew = [("a", m["shirtA"], "lamp", 1.00), ("b", m["shirtB"], "cap", 0.94),
                ("c", m["shirtC"], "pack", 0.90), ("d", m["shirtD"], "", 0.97)]
        for k, (tag, shirt, hat, h) in enumerate(crew):
            mats = {"shirt": shirt, "pants": m["pants"], "skin": m["skin"],
                    "dark": m["dark"], "accent": m["accent"], "lampface": m["lampface"]}
            # blocking is a table, not arithmetic: four figures in a 2.7 m corridor have
            # exactly one arrangement that reads — a loose diamond, not a row.
            place = {"spawn": [(-0.44, -1.42), (0.34, -1.86), (-0.16, -2.32), (0.58, -1.18)],
                     "lineup": [(0.0, -5.40), (0.0, -4.25), (0.0, -3.10), (0.0, -1.95)],
                     "run": [(-0.66, -2.10), (0.62, -2.28), (-0.20, -2.62), (0.24, -1.86)],
                     "hero": [(-0.40, -1.30), (0.32, -1.72), (-0.14, -2.18), (0.52, -2.55)]}[shot]
            place = (place[k][0], place[k][1], 0.072)
            a = toys.avatar(tag, place, mats, height=h, hat=hat)
            cx, cy = CAM_AT[shot][0], CAM_AT[shot][1]
            a["yaw"] = math.atan2(cx - place[0], cy - place[1])   # front is +Y, so this faces the lens
            av[tag] = a
    if shot in ("stalk", "face"):
        mats = {"shirt": m["ghost"], "pants": m["ghost"], "skin": m["bone"],
                "dark": m["dark"], "accent": m["ghost"], "lampface": m["lampface"]}
        av["e"] = toys.avatar("e", (0.18, Y1 - 0.4, 0.072), mats, height=1.34, hat="")
        face_of(av["e"], m["dark"])
    return setd, av, m


def face_of(e, mat) -> None:
    """The blank toy head gets the one thing that makes it a threat: a smiley face, in black.
    Two cubes for eyes and a grin wide enough to read at nine metres — the platform's classic
    tile face, wrong.

    They are parented to the HEAD, not the root, so `pose()`'s head tilt carries the expression.
    That also means the coordinates are in head space, and a toy slab is a unit cube with
    `scale = dims`: 0.5 is the surface, 1.0 is twice the head's width. Any figure-space number
    dropped in here lands inside the skull, which is exactly how the first version of this
    function rendered nothing at all."""
    head = e["parts"]["head"]
    for nm, (ox, oz, sx, sz) in {
        "eye_l": (-0.19, 0.13, 0.19, 0.19),
        "eye_r": (0.19, 0.13, 0.19, 0.19),
        "mouth": (0.0, -0.13, 0.52, 0.075),
        "grin_l": (-0.30, -0.055, 0.10, 0.10),
        "grin_r": (0.30, -0.055, 0.10, 0.10),
    }.items():
        ob = toys._slab(f"e_{nm}", (ox, 0.5 + 0.045, oz), (sx, 0.10, sz), mat, bevel=0.012)
        ob.parent = head
        ob.matrix_parent_inverse = Matrix.Identity(4)
        e["extra"][f"face_{nm}"] = ob


def camera_for(shot: str):
    cd = bpy.data.cameras.new("C")
    cd.lens = {"spawn": 40.0, "lineup": 28.0, "stalk": 38.0, "run": 35.0,
               "hero": 30.0, "face": 60.0}[shot]
    cd.clip_end = 200.0
    cd.dof.use_dof = shot not in ("hero", "face")
    cd.dof.aperture_fstop = 2.8
    ob = bpy.data.objects.new("C", cd)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.scene.camera = ob
    return ob, cd


def frame_state(setd, av, shot: str, i: int, n: int):
    """One frame of one shot, from the index alone."""
    sc = bpy.context.scene
    t = (i - 1) / max(1, n - 1)
    lv = bulb_level(t, i, seed=len(shot), alive=shot in ("spawn", "hero", "run"))
    stage.pulse(setd["fil"], 22.0 * lv + 0.25)
    setd["bulb_l"].energy = 26.0 * lv
    setd["bulb"].rotation_euler.z = math.radians(3.0 * math.sin(t * 2.2))
    setd["vol"].inputs["Density"].default_value = 0.034 if lv > 0.05 else 0.026
    for tag in av:
        lp = av[tag].get("lamp")
        if lp is not None:
            lp.data.energy = 240.0 * (0.35 + 0.65 * lv) if lv > 0.05 else 0.0
    for nm in ("toy-key", "toy-top"):
        setd["lights"][nm].data.energy = (52.0 if nm == "toy-key" else 17.0) * (0.25 + 0.75 * lv)
    moon = setd["lights"]["moon"]
    moon.data.energy = 95.0 + (700.0 if (shot == "stalk" and t > 0.62) else 0.0)
    if shot == "spawn":
        for k, tag in enumerate("abcd"):
            toys.assemble(av[tag], t * 1.0, 0.03 + 0.09 * k, 0.42, seed=k)
            if t > 0.55:
                toys.pose(av[tag], "idle", (t - 0.55) * 2.2, look=0.0)
    elif shot == "lineup":
        for k, tag in enumerate("abcd"):
            a = av[tag]
            a["at"] = Vector((0.0, -5.40 + 1.15 * k + 1.60 * stage.ease_in_out_cubic(t), 0.072))
            a["yaw"] = math.radians(0.0)
            toys.pose(a, "walk", t * 3.1 + k * 0.27, look=6.0)
    elif shot == "stalk":
        e = av["e"]
        e["at"] = Vector((0.18, (Y1 - 0.4) - 3.15 * stage.ease_in_out_cubic(t), 0.072))
        e["yaw"] = math.pi                        # it walks at us, so its front is our way
        toys.pose(e, "stalk", t * 2.4, look=3.0)
    elif shot == "run":
        for k, tag in enumerate("abcd"):
            a = av[tag]
            a["at"] = Vector(((-0.66, 0.62, -0.20, 0.24)[k] + 0.05 * math.sin(t * 11.0 + k),
                               (-2.10, -2.28, -2.62, -1.86)[k] - (1.95 + 0.09 * k) * (t ** 1.30), 0.072))
            toys.pose(a, "run", t * 5.4 + k * 0.41, look=-4.0)
            if tag == "c":
                # one of them stops existing mid-stride; the counter in the edit does the rest
                gone = 0.58
                vis = t < gone
                for ob in list(a["parts"].values()) + list(a["extra"].values()):
                    ob.hide_render = not vis
    elif shot == "hero":
        for k, tag in enumerate("abcd"):
            toys.pose(av[tag], "idle", 0.2 + k * 0.17, look=0.0)
    elif shot == "face":
        e = av.get("e")
        if e is not None:
            e["at"] = Vector((0.06, -2.35, 0.072))
            e["yaw"] = math.radians(168.0)     # turned almost away, head looking back
            toys.pose(e, "idle", 0.4, look=-11.0)

    # ---- camera
    cam = bpy.data.objects["C"]
    cd = cam.data
    if shot == "spawn":
        cam.location = (-1.12 + 0.52 * t, -6.05 + 0.72 * t, 1.52 - 0.16 * t)
        look = Vector((0.04, -1.70, 0.42))     # a giant looking down at toys: the whole figure
    elif shot == "lineup":
        cam.location = (-1.30, -3.55 + 0.35 * t, 0.94)
        look = Vector((0.62, -3.55 + 0.35 * t, 0.86))
    elif shot == "stalk":
        cam.location = (0.0, -4.62, 1.24)
        look = Vector((0.10, -1.2, 1.05))
    elif shot == "run":
        cam.location = (0.03 * math.sin(t * 9.0), -7.05 + 0.20 * t, 1.06)
        look = Vector((0.0, -4.6 + 0.9 * t, 0.86))
    elif shot == "hero":
        cam.location = (0.0, -6.62, 1.60)
        look = Vector((0.04, -0.30, 0.96))
    elif shot == "face":
        e = av.get("e")
        hz = (e["dims"]["shoulder_z"] + e["dims"]["head_h"] * 0.52) if e else 1.15
        cam.location = (0.05, -3.88, hz + 0.02)   # 1.5 m: head *and* shoulders, never a wall
        look = Vector((0.06, -2.35, hz))
    use_torch = shot in ("run", "hero", "spawn")
    tr = setd["torch"]
    tr.location = (cam.location[0] + 0.10, cam.location[1] + 0.02, cam.location[2] - 0.12)
    tdir = (look - Vector(tr.location)).normalized()
    tr.rotation_euler = (-tdir).to_track_quat("Z", "Y").to_euler()
    tr.data.energy = (150.0 if use_torch else 0.0) * (0.82 + 0.18 * lv) * (0.9 + 0.2 * hash01(i, 17))

    cam.location.x += 0.012 * math.sin(t * 3.1) + 0.004 * math.sin(t * 27.0)
    cam.location.z += 0.008 * math.sin(t * 2 * math.pi * 1.1)
    d = (look - Vector(cam.location)).normalized()
    cam.rotation_euler = (-d).to_track_quat("Z", "Y").to_euler()
    cam.rotation_euler.z += math.radians(0.5 * math.sin(t * 17.0))
    cd.dof.focus_distance = (Vector((0, -1.6, 1.0)) - Vector(cam.location)).length


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--shot", required=True, choices=sorted(DUR))
    ap.add_argument("--from", dest="f0", type=int, default=1)
    ap.add_argument("--to", dest="f1", type=int, default=-1)
    ap.add_argument("--samples", type=int, default=7)
    ap.add_argument("--scale", type=float, default=0.70)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    n = DUR[a.shot]
    a.f1 = n if a.f1 < 0 else min(a.f1, n)

    still = a.shot in ("hero", "face")
    sc = stage.new_scene(samples=(14 if still else a.samples), res=(1080, 1920), motion_blur=False,
                         exposure=(0.0 if still else -0.10))
    sc.render.resolution_percentage = int(round((1.0 if still else a.scale) * 100))
    sc.render.fps = FPS
    sc.cycles.max_bounces = 5
    sc.cycles.diffuse_bounces = 3
    sc.cycles.volume_step_rate = 4.0
    sc.cycles.volume_max_steps = 64
    sc.cycles.adaptive_threshold = 0.14
    sc.cycles.sample_clamp_indirect = 4.0
    try:
        sc.cycles.volume_bounces = 0
    except Exception:
        pass
    try:
        sc.render.use_persistent_data = True
    except Exception:
        pass
    stage.compositor_glare(threshold=1.35, mix=-0.52, size=7)

    camera_for(a.shot)
    setd, av, m = build(a.shot)
    bpy.context.view_layer.update()

    for i in range(a.f0, a.f1 + 1):
        path = os.path.join(a.out, f"t_{a.shot}_{i:04d}.png")
        if os.path.exists(path):
            continue
        frame_state(setd, av, a.shot, i, n)
        bpy.context.view_layer.update()
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        print(f"{a.shot} FRAME {i}/{a.f1}", flush=True)
    print("TOY DONE", a.shot, flush=True)


main()
