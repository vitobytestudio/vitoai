"""
«الطابق الأخير» — a horror beat, fully generated. No footage, no image models.

    LD_LIBRARY_PATH=/tmp/vitobl/lib /tmp/vitobl/bin/python \\
        studio/blender/bpyrun.py studio/blender/scene_horror.py --out /tmp/horror --from 1 --to 72

Why this is buildable on 2 CPU cores: a horror frame is *mostly darkness*, and
darkness converges. What sells it is not samples, it is: a volume the light has to
push through, a floor whose albedo is uneven, props that break the perfect corner,
handheld motion with a breath in it, and one silhouette held back until the light fails.
"""
from __future__ import annotations

import argparse
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import stage  # noqa: E402

FPS = 24
N = 48                      # 2.0 s at 24 fps
WARM = (1.0, 0.58, 0.26)    # the bulb: sodium-amber, the only warm thing in the building
COLD = (0.42, 0.58, 0.95)  # what is outside the window


# ------------------------------------------------------------------ set dressing

def box(name, loc, dims, mat=None, rot=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = dims
    ob.rotation_euler = rot
    if mat is not None:
        ob.data.materials.append(mat)
    return ob


def plane(name, loc, dims, mat=None, rot=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = dims
    ob.rotation_euler = rot
    if mat is not None:
        ob.data.materials.append(mat)
    return ob


def grime(name, c_low, c_high, scale=1.7, rough=0.62, grain=2.6, bump=0.006):
    """Two-tone albedo + roughness broken up by noise, and a real bump.

    One flat colour with one flat roughness is the single biggest 'this is 3D' tell.
    Nothing in a building is uniform at two scales at once.
    """
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = scale
    tex.inputs["Detail"].default_value = 6.0
    tex.inputs["Roughness"].default_value = 0.55
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*c_low, 1.0)
    ramp.color_ramp.elements[1].color = (*c_high, 1.0)
    nt.links.new(tex.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    tex2 = nt.nodes.new("ShaderNodeTexNoise")
    tex2.inputs["Scale"].default_value = grain
    tex2.inputs["Detail"].default_value = 4.0
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = 0.25
    mr.inputs["From Max"].default_value = 0.8
    mr.inputs["To Min"].default_value = rough * 0.72
    mr.inputs["To Max"].default_value = min(1.0, rough * 1.32)
    nt.links.new(tex2.outputs["Fac"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], b.inputs["Roughness"])
    bmp = nt.nodes.new("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = bump
    nt.links.new(tex.outputs["Fac"], bmp.inputs["Height"])
    nt.links.new(bmp.outputs["Normal"], b.inputs["Normal"])
    return m


def volume_cube(name, loc, dims, density=0.10, color=(0.62, 0.68, 0.8), aniso=0.55):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = dims
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (*color, 1.0)
    vol.inputs["Density"].default_value = density
    vol.inputs["Anisotropy"].default_value = aniso
    nt.links.new(vol.outputs["Volume"], out.inputs["Volume"])
    ob.data.materials.append(m)
    ob.visible_shadow = False
    ob.display_type = "WIRE"
    return ob, m


# ------------------------------------------------------------------------ light

def hash01(i, salt=0):
    x = (i * 2654435761 + salt * 40503) & 0xFFFFFFFF
    x ^= x >> 15
    x = (x * 2246822519) & 0xFFFFFFFF
    x ^= x >> 13
    return (x % 100000) / 100000.0


def bulb_level(t, i):
    """The filament: alive, doubting, dead, stabbing back, dying.

    A flicker that is *random* reads as a screensaver; one that has a narrative
    (two warnings, a long failure, one violent return) reads as a haunted building.
    """
    j = 0.94 + 0.12 * (hash01(i, 3) - 0.5)                 # mains micro-jitter
    if t < 0.055:
        return j
    if t < 0.085:                                            # first warning
        return 0.10 + 0.9 * max(0.0, math.sin((t - 0.055) / 0.03 * math.pi))
    if t < 0.235:
        return j
    if t < 0.262:                                            # second warning
        return 0.14
    if t < 0.548:
        return j
    if t < 0.832:
        return 0.0                                           # the long dark
    if t < 0.878:
        return 3.1 * (0.9 + 0.2 * hash01(i, 7))              # it stabs back on
    if t < 0.905:
        return 0.35
    return max(0.0, 1.0 - (t - 0.905) / 0.075) * 0.9        # and goes for good


def moon_level(t, i):
    base = 1.0
    if 0.70 <= t < 0.752:                       # the flash that shows what moved
        k = (t - 0.70) / 0.052
        return base + 5.4 * math.sin(k * math.pi) ** 1.5
    if 0.752 <= t < 0.79:
        return base + 0.55 * max(0.0, math.sin((t - 0.752) / 0.038 * math.pi))
    return base


# ------------------------------------------------------------------------ scene

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="/tmp/horror")
    ap.add_argument("--from", dest="f0", type=int, default=1)
    ap.add_argument("--to", dest="f1", type=int, default=N)
    ap.add_argument("--samples", type=int, default=10)
    ap.add_argument("--scale", type=float, default=0.62, help="resolution_percentage/100")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    sc = stage.new_scene(samples=a.samples, res=(1080, 1920), motion_blur=False,
                         exposure=0.05)
    sc.render.resolution_percentage = int(round(a.scale * 100))
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = a.f0, a.f1
    sc.cycles.max_bounces = 6
    sc.cycles.diffuse_bounces = 3
    sc.cycles.glossy_bounces = 3
    sc.cycles.volume_step_rate = 4.0
    sc.cycles.volume_max_steps = 96
    sc.cycles.adaptive_threshold = 0.10
    sc.cycles.sample_clamp_indirect = 4.0
    stage.compositor_glare(threshold=1.42, mix=-0.55, size=7)   # the bulb must bleed like a lens, not like a UI
    sc.cycles.volume_bounces = 1
    sc.cycles.use_denoising = True
    stage.world_gradient(sc, top=(0.0016, 0.0022, 0.0040), bottom=(0.0, 0.0, 0.0))

    conc = grime("concrete", (0.013, 0.014, 0.017), (0.050, 0.050, 0.053), 2.4, 0.50, 4.6, 0.006)
    paint = grime("paint", (0.028, 0.029, 0.034), (0.078, 0.079, 0.084), 1.5, 0.66, 3.1, 0.003)
    dark = stage.metal("darkmetal", (0.030, 0.031, 0.034), rough=0.42, aniso=0.2)
    wood = grime("wood", (0.024, 0.017, 0.011), (0.075, 0.050, 0.030), 4.0, 0.52, 7.5, 0.004)
    matte = stage.metal("matte", (0.004, 0.004, 0.005), rough=1.0)

    X = 1.35          # half width
    ZC = 2.55         # ceiling
    Y0, Y1 = -7.4, 2.0    # corridor span; doorway in the far wall

    box("floor", (0, (Y0 + Y1) / 2, 0), (X * 2 + 0.4, Y1 - Y0 + 3.0, 0.14), conc)
    box("ceil", (0, (Y0 + Y1) / 2, ZC), (X * 2 + 0.4, Y1 - Y0 + 3.0, 0.14), paint)
    box("wall-l", (-X, (Y0 + Y1) / 2, ZC / 2), (0.14, Y1 - Y0 + 3.0, ZC), paint)
    box("wall-r", (X, (Y0 + Y1) / 2, ZC / 2), (0.14, Y1 - Y0 + 3.0, ZC), paint)

    # far wall with a real opening (four slabs, not a texture)
    DW, DH = 0.98, 2.06
    box("far-l", (-(DW / 2 + (X - DW / 2) / 2), Y1, ZC / 2), ((X - DW / 2), 0.2, ZC), paint)
    box("far-r", ((DW / 2 + (X - DW / 2) / 2), Y1, ZC / 2), ((X - DW / 2), 0.2, ZC), paint)
    box("far-top", (0, Y1, (ZC + DH) / 2), (DW + 0.3, 0.2, ZC - DH), paint)
    # frame: the reveal that makes a doorway look built rather than booleaned
    for sx in (-1, 1):
        box(" jamb", (sx * (DW / 2 + 0.035), Y1 - 0.02, DH / 2), (0.07, 0.16, DH + 0.08), dark)
    box("header", (0, Y1 - 0.02, DH + 0.03), (DW + 0.15, 0.16, 0.08), dark)

    # the room beyond, and its window
    box("beyond-floor", (0, Y1 + 2.6, 0), (4.6, 5.4, 0.14), conc)
    box("beyond-back", (0, Y1 + 5.2, 1.6), (5.0, 0.2, 3.4), paint)
    box("beyond-l", (-2.4, Y1 + 2.6, 1.6), (0.2, 5.4, 3.4), paint)
    box("beyond-r", (2.4, Y1 + 2.6, 1.6), (0.2, 5.4, 3.4), paint)
    box("beyond-ceil", (0, Y1 + 2.6, 3.2), (5.0, 5.4, 0.2), paint)
    win = plane("window", (0.55, Y1 + 5.05, 1.95), (1.35, 1.05, 1),
                stage.emission("win", COLD, 1.5), rot=(math.pi / 2, 0, 0))
    win.visible_shadow = False
    for k in range(4):      # glazing bars: the shaft must arrive striped
        box("bar", (0.55 - 0.5 + k * 0.34, Y1 + 5.0, 1.95), (0.035, 0.05, 1.05), dark)

    # props that break the perfect corridor
    for sx in (-1, 1):
        box("skirt", (sx * (X - 0.045), (Y0 + Y1) / 2, 0.055), (0.055, Y1 - Y0 + 2.0, 0.11), wood)
    pipe = box("pipe", (X - 0.22, (Y0 + Y1) / 2, ZC - 0.16), (0.075, Y1 - Y0 + 2.0, 0.075), dark)
    for k in range(6):      # pipe brackets, evenly spaced — a human did that
        box("brk", (X - 0.22, Y0 + 0.6 + k * 1.55, ZC - 0.235), (0.12, 0.05, 0.06), dark)
    for k in range(9):      # a vent grille on the left wall
        box("slat", (-X + 0.075, -1.4 - k * 0.055, 2.02), (0.05, 0.028, 0.012), dark)
    box("vent", (-X + 0.06, -1.62, 2.02), (0.045, 0.62, 0.42), matte)
    box("switch", (X - 0.075, -2.35, 1.22), (0.03, 0.11, 0.16), stage.metal("plate", (0.06, 0.06, 0.062), rough=0.5))
    box("crate", (-X + 0.42, -3.15, 0.17), (0.44, 0.4, 0.34), wood, rot=(0, 0, 0.32))
    box("crate-flap", (-X + 0.62, -3.05, 0.34), (0.3, 0.26, 0.015), wood, rot=(0.5, 0.2, 0.3))

    # the door, on a hinge
    hinge = bpy.data.objects.new("hinge", None)
    sc.collection.objects.link(hinge)
    hinge.location = (-DW / 2 - 0.04, Y1 - 0.03, 0)
    door = box("door", (DW / 2 + 0.04, 0, DH / 2), (DW + 0.06, 0.05, DH), wood)
    door.parent = hinge
    door.matrix_parent_inverse = hinge.matrix_world.inverted()
    handle = box("handle", (DW - 0.06 + 0.04, -0.075, 1.02), (0.11, 0.11, 0.045), dark)
    handle.parent = hinge
    handle.matrix_parent_inverse = hinge.matrix_world.inverted()

    # the bulb
    BX, BY, BZ = 0.16, -1.05, 2.02
    fil = stage.emission("fil", WARM, 1.0)
    fil_node = fil.node_tree.nodes["Emission"]
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.038, segments=24, ring_count=16, location=(BX, BY, BZ))
    bulb = bpy.context.object
    bulb.name = "bulb"
    bulb.data.materials.append(fil)
    bulb.visible_shadow = False
    box("cord", (BX, BY, (ZC + BZ) / 2), (0.008, 0.008, ZC - BZ), matte)
    bulb_l = bpy.data.lights.new("bulb", "POINT")
    bulb_l.energy = 19.0
    bulb_l.color = WARM
    bulb_l.shadow_soft_size = 0.05
    bulb_lo = bpy.data.objects.new("bulbl", bulb_l)
    sc.collection.objects.link(bulb_lo)
    bulb_lo.location = (BX, BY, BZ - 0.03)

    moon = stage.area("moon", (0.55, Y1 + 3.3, 1.72), 95.0, 1.9, COLD,
                      target=(0.30, Y1 + 5.05, 0.95), rect=1.35)
    # the far room is never a black hole: one dim source, and the doorway has an interior
    stage.strip_light("far-fill", (0.40, Y1 + 3.6, 2.20), size=(1.5, 1.0), power=6.0,
                      color=COLD, target=(0.30, Y1 + 5.05, 1.25))
    stage.strip_light("bounce", (0.0, Y1 + 0.9, 0.18), size=(1.9, 0.45), power=64.0,
                      color=COLD, target=(0.0, Y1 - 2.4, 1.1))
    # a rim that exists only for the flash: it draws the silhouette in one stroke
    rim = stage.strip_light("rim", (1.05, Y1 + 3.30, 1.40), size=(0.26, 1.70), power=0.0,
                            color=COLD, target=(-0.30, Y1 + 2.35, 1.18))

    # dust in the light — the cheapest proof that air exists
    motemat = stage.emission("dust", (1.0, 0.78, 0.52), 0.35)
    motes = []
    for kk in range(64):
        u = hash01(kk, 11)
        v = hash01(kk, 12)
        w = hash01(kk, 13)
        if kk % 2:      # the cone under the bulb
            ang = 6.283 * u
            rad = 0.62 * math.sqrt(v)
            p = Vector((BX + rad * math.cos(ang), BY + rad * math.sin(ang) - 0.10, 0.86 + 1.12 * w))
        else:           # the shaft arriving from the doorway
            p = Vector((-0.42 + 1.05 * u, Y1 - 1.75 + 1.85 * v, 0.10 + 1.15 * w))
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=0, radius=0.0062 + 0.0052 * u, location=p)
        ob = bpy.context.object
        ob.name = f"mote{kk}"
        ob.data.materials.append(motemat)
        ob.visible_shadow = False
        motes.append((ob, p, kk))

    # what stands in the room
    fig = bpy.data.objects.new("fig", None)
    sc.collection.objects.link(fig)
    fig.location = (-0.27, Y1 + 2.4, 0)   # off-centre, so the window is behind a shoulder
    figparts = []
    parts = [("torso", (0, 0, 1.24), (0.315, 0.205, 0.88)),
             ("shoulders", (0, 0, 1.585), (0.375, 0.185, 0.115)),
             ("hips", (0, 0, 0.80), (0.30, 0.20, 0.16)),
             ("neck", (0.0, 0.015, 1.70), (0.11, 0.12, 0.10)),
             ("head", (0.0, 0.01, 1.80), (0.165, 0.175, 0.215)),
             # arms against the body: a floating rectangle reads as a robot, not a person
             ("arm-l", (-0.187, 0.0, 1.20), (0.085, 0.115, 0.66)),
             ("arm-r", (0.187, 0.05, 1.20), (0.085, 0.115, 0.66)),
             ("leg-l", (-0.10, 0.0, 0.40), (0.115, 0.13, 0.80)),
             ("leg-r", (0.10, 0.0, 0.40), (0.115, 0.13, 0.80))]
    for nm, off, dims in parts:
        if nm == "head":
            # a box for a head is the one shortcut an audience never forgives
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.115, segments=24, ring_count=16,
                                                 location=(fig.location.x + off[0], fig.location.y + off[1], off[2]))
            b = bpy.context.object
            b.name = nm
            b.scale = (0.94, 1.0, 1.16)
        else:
            b = box(nm, (fig.location.x + off[0], fig.location.y + off[1], off[2]), dims, matte)
            bv = b.modifiers.new("bv", "BEVEL")          # soft corners: a body, not a crate
            bv.width = min(0.05, 0.26 * min(dims))
            bv.segments = 3
        b.parent = fig
        b.matrix_parent_inverse = fig.matrix_world.inverted()
        b.visible_shadow = True   # it has to eat the flash, not just block it
        figparts.append(b)
    # a body squared to the camera is a cardboard cut-out
    fig.rotation_euler.z = math.radians(12.0)
    fig.rotation_euler.x = math.radians(-3.2)   # a lean, not a mannequin
    bpy.data.objects["head"].rotation_euler.z = math.radians(-21.0)
    bpy.data.objects["head"].rotation_euler.x = math.radians(6.0)

    vol, volmat = volume_cube("air", (0, (Y0 + Y1) / 2, ZC / 2), (X * 2, Y1 - Y0 + 1.2, ZC),
                              density=0.055, color=(0.55, 0.6, 0.72), aniso=0.5)

    # camera
    cam_d = bpy.data.cameras.new("C")
    cam_d.lens = 42.0     # a 9:16 corridor wants a vertical fit: 31 mm left the room a small band
    cam_d.sensor_width = 36.0
    cam_d.clip_end = 200.0
    cam_d.dof.use_dof = True
    cam_d.dof.aperture_fstop = 2.0
    cam = bpy.data.objects.new("C", cam_d)
    sc.collection.objects.link(cam)
    sc.camera = cam

    tgt = Vector((0.05, Y1 - 0.2, 1.28))
    def set_frame(i):
        t = (i - 1) / (N - 1)

        lv = bulb_level(t, i)
        flash = max(0.0, moon_level(t, i) - 1.0) / 5.4     # 0 outside the flash, 1 at its peak
        fil_node.inputs[0].default_value = (*WARM, 1.0)
        stage.pulse(fil, 26.0 * lv + 0.2)
        bulb_l.energy = 21.0 * lv
        moon.data.energy = 95.0 + 1400.0 * flash
        try:
            moon.data.spread = math.radians(48.0 if flash > 0.02 else 120.0)
        except Exception:
            pass                       # the knob moved around between 4.x builds
        rim.data.energy = 260.0 * flash          # one edge of light, never a face
        volmat.node_tree.nodes["Principled Volume"].inputs["Density"].default_value = (
            0.055 if lv > 0.05 else 0.042)

        # the door gives way once, slowly, then Settles
        open_amt = 0.0
        if t > 0.42:
            open_amt = 1.0 - math.exp(-(t - 0.42) * 7.0)
            open_amt = min(1.0, open_amt)
        hinge.rotation_euler.z = math.radians(-34.0 * stage.ease_in_out_cubic(open_amt))

        # it steps forward only in the dark
        step = 0.0
        if t > 0.60:
            step = min(1.0, (t - 0.60) / 0.20)
        fig.location.y = Y1 + 2.4 - 2.75 * stage.ease_out_cubic(step)
        for ob in figparts:
            ob.hide_render = t < 0.560   # an Empty cannot hide its children
        # and the flash that shows it must not show it *before* the audience looks
        stage.pulse(bpy.data.materials["win"], 1.0 + 1.2 * flash)

        cam.location.x = 0.02 * math.sin(t * 3.1) + 0.0075 * math.sin(t * 29.0) + 0.004 * math.sin(t * 61.0)
        cam.location.y = -5.30 + 2.55 * stage.ease_in_out_cubic(t * 0.92 + 0.04 * math.sin(t * 2.4))
        cam.location.z = 1.500 + 0.012 * math.sin(t * 2 * math.pi * 1.15) + 0.005 * math.sin(t * 47.0)
        d = (tgt - Vector(cam.location)).normalized()
        cam.rotation_euler = (-d).to_track_quat("Z", "Y").to_euler()
        cam.rotation_euler.z += math.radians(0.55 * math.sin(t * 19.0) + 0.35 * math.sin(t * 7.3))
        cam_d.dof.focus_distance = (Vector((0, Y1, 0)) - Vector(cam.location)).length

        for ob, p, k in motes:            # dust drifts, it does not orbit
            ob.location = (p.x + 0.05 * math.sin(t * 2.1 + k), p.y + 0.035 * math.cos(t * 1.4 + k * 0.7),
                           p.z + 0.03 * math.sin(t * 1.05 + k * 1.3) + 0.02 * t * (k % 5))
        stage.pulse(motemat, 0.12 + 0.30 * lv)

    sc.render.use_persistent_data = True

    for i in range(a.f0, a.f1 + 1):
        path = os.path.join(a.out, f"h_{i:04d}.png")
        if os.path.exists(path):
            continue
        set_frame(i)
        bpy.context.view_layer.update()
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        print(f"FRAME {i} / {a.f1}", flush=True)


    print("SCENE DONE", a.out, flush=True)


main()
