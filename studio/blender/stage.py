"""
The studio: scene, lights, floor, shaders, framing, grade.

Everything here exists because the box has 2 CPU cores and no GPU. So the scene is
built to be *cheap to converge*: few bounces, one glossy floor, area lights only,
denoise on, and a glare in the compositor instead of volumetrics. The premium read
comes from the camera and the light travelling across metal — not from samples.
"""
from __future__ import annotations

import math
from typing import Sequence, Tuple

import bpy
from mathutils import Vector

RGB = Tuple[float, float, float]


def srgb(h: str) -> RGB:
    h = h.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)  # type: ignore


def ease_out_cubic(t: float) -> float:
    return 1 - (1 - t) ** 3


def ease_in_out_cubic(t: float) -> float:
    return 4 * t ** 3 if t < 0.5 else 1 - ((-2 * t + 2) ** 3) / 2


def clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


# --------------------------------------------------------------------- scene

def new_scene(samples: int = 24, res: Tuple[int, int] = (1080, 1920),
              exposure: float = 0.0, motion_blur: bool = True):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.02
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 5
    sc.cycles.diffuse_bounces = 2
    sc.cycles.glossy_bounces = 3
    sc.cycles.transmission_bounces = 4
    sc.cycles.transparent_max_bounces = 4
    sc.cycles.volume_bounces = 0
    sc.cycles.blur_glossy = 1.0
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_depth = "16"
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Punchy"
    sc.view_settings.exposure = exposure
    if motion_blur:
        sc.render.use_motion_blur = True
        sc.render.motion_blur_shutter = 0.4
        _try(sc.cycles, "motion_blur_position", "CENTER")     # moved/renamed across 4.x→5.x
    return sc


def _try(obj, attr, value):
    """Blender renames settings between majors; a render must not die over that."""
    try:
        setattr(obj, attr, value)
        return True
    except (AttributeError, TypeError):
        return False


def world_gradient(sc, top: RGB = (0.004, 0.006, 0.013), bottom: RGB = (0.0, 0.0, 0.0),
                   strength: float = 1.0):
    w = bpy.data.worlds.new("W")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes["Background"]
    for n in list(nt.nodes):
        if n.type in {"TEX_COORD", "SEPXYZ", "MAP_RANGE", "VALTORGB"}:
            nt.nodes.remove(n)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    mp = nt.nodes.new("ShaderNodeMapRange")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    mp.inputs["From Min"].default_value = -0.35
    mp.inputs["From Max"].default_value = 0.65
    ramp.color_ramp.elements[0].color = (*bottom, 1.0)
    ramp.color_ramp.elements[1].color = (*top, 1.0)
    nt.links.new(tc.outputs["Generated"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Z"], mp.inputs["Value"])
    nt.links.new(mp.outputs["Result"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = strength
    return w


def floor(z: float = 0.0, rough: float = 0.07, base: RGB = (0.010, 0.012, 0.019),
           bump: float = 0.0012):
    """An infinite polished slab. The faint large-scale bump stops it reading as a
    perfect mirror, which is what gives cheap 3D its glassy tell."""
    bpy.ops.mesh.primitive_plane_add(size=800, location=(0, 0, z))
    ob = bpy.context.object
    ob.name = "floor"
    m = bpy.data.materials.new("floor")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*base, 1.0)
    b.inputs["Metallic"].default_value = 0.35
    b.inputs["Roughness"].default_value = rough
    b.inputs["Specular IOR Level"].default_value = 0.6
    nt = m.node_tree
    if bump:
        tex = nt.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = 2.2
        tex.inputs["Detail"].default_value = 2.0
        tex.inputs["Roughness"].default_value = 0.4
        dsp = nt.nodes.new("ShaderNodeBump")
        dsp.inputs["Strength"].default_value = bump
        dsp.invert = True
        nt.links.new(tex.outputs["Fac"], dsp.inputs["Height"])
        nt.links.new(dsp.outputs["Normal"], b.inputs["Normal"])
    ob.data.materials.append(m)
    return ob


def strip_light(name: str, loc, size=(6.0, 0.9), power: float = 800.0,
                color: RGB = (1, 1, 1), target=(0.0, 0.0, 0.6)):
    """A studio strip: a big rectangular area light.

    This is what the metal is actually reflecting. Emissive *meshes* were the
    obvious version of this and they showed up in the frame even with
    visible_camera=False (Blender 5.0), which is how you get the "glowing white
    card" look of cheap 3D. An area light is invisible to camera rays by
    definition, so the highlight lands on the object and nothing lands in the shot.
    """
    lt = bpy.data.lights.new(name, "AREA")
    lt.shape = "RECTANGLE"
    lt.size, lt.size_y = max(size) , min(size)
    lt.energy = power
    lt.color = color
    ob = bpy.data.objects.new(name, lt)
    bpy.context.scene.collection.objects.link(ob)
    place(ob, loc, target)
    return ob


def area(name: str, loc, energy: float, size: float, color: RGB = (1, 1, 1),
         target=(0.0, 0.0, 0.6), rect=None):
    lt = bpy.data.lights.new(name, "AREA")
    lt.energy = energy
    lt.color = color
    if rect:
        lt.shape = "RECTANGLE"
        lt.size, lt.size_y = size, rect
    else:
        lt.size = size
    ob = bpy.data.objects.new(name, lt)
    bpy.context.scene.collection.objects.link(ob)
    place(ob, loc, target)
    return ob


def place(ob, loc, target=(0.0, 0.0, 0.6)):
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return ob


def key_three_light(blue: RGB = (0.42, 0.60, 1.0)):
    """Soft north key, low white fill, blue rim from behind — three lights, nothing else."""
    k = area("key", (5.2, -4.4, 4.6), 820, 2.0, rect=4.5)
    f = area("fill", (-6.2, -3.0, 1.6), 320, 3.4, (0.85, 0.9, 1.0))
    r = area("rim", (-2.2, 6.5, 3.2), 700, 1.1, blue, rect=6.0)
    return k, f, r


# ------------------------------------------------------------------ materials

def metal(name: str, base: RGB, rough: float = 0.12, aniso: float = 0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*base, 1.0)
    b.inputs["Metallic"].default_value = 1.0
    b.inputs["Roughness"].default_value = rough
    if "Anisotropic" in b.inputs and aniso:
        b.inputs["Anisotropic"].default_value = aniso
    if "Coat Weight" in b.inputs:
        b.inputs["Coat Weight"].default_value = 0.25
        b.inputs["Coat Roughness"].default_value = 0.05
    return m


def emission(name: str, color: RGB, strength: float = 1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1.0)
    em.inputs["Strength"].default_value = strength
    nt.links.new(em.outputs[0], out.inputs["Surface"])   # "Color" in 4.x, "Emission" in 5.x
    return m


def pulse(m, strength: float):
    """Brighten an emission material per frame. The node is looked up, not stashed in
    an ID property — Blender 5.x refuses a node pointer in material['...']."""
    node = m.node_tree.nodes.get("Emission") if m.use_nodes else None
    if node is not None:
        node.inputs["Strength"].default_value = strength


# -------------------------------------------------------------------- camera

def frame_camera(cam_obj, center: Sequence[float], width: float, height: float,
                 margin: float = 1.15, azimuth_deg: float = 14.0,
                 elevation_deg: float = 7.0, lens: float = 70.0, sensor: float = 36.0,
                 fstop: float | None = 4.0):
    """Put the camera where the whole block fits at that angle — both axes.

    Blender fits the *larger* frame dimension by default, so on a 9:16 canvas the
    horizontal field is the narrow one. Getting that backwards is how text silently
    walks off the edge of a vertical render.
    """
    cam = cam_obj.data
    cam.lens = lens
    cam.sensor_width = sensor
    cam.sensor_fit = "HORIZONTAL"          # pin it: AUTO maps the sensor to the long
    res_x = bpy.context.scene.render.resolution_x     # edge, which for 9:16 is the
    res_y = bpy.context.scene.render.resolution_y     # vertical — the opposite of what
    sensor_h = sensor                       # the naive formula assumes, and it puts
    sensor_v = sensor * (res_y / res_x)      # the camera inside the subject
    vfov = 2 * math.atan(sensor_v / (2 * lens))
    hfov = 2 * math.atan(sensor_h / (2 * lens))
    d = max((height * margin / 2) / math.tan(vfov / 2),
            (width * margin / 2) / math.tan(hfov / 2))
    span_v = 2 * d * math.tan(vfov / 2)          # what the frame actually swallows at d
    span_h = 2 * d * math.tan(hfov / 2)

    az = math.radians(azimuth_deg)
    el = math.radians(elevation_deg)
    c = Vector(center)
    cam_obj.location = (c.x + d * math.sin(az) * math.cos(el),
                        c.y - d * math.cos(az) * math.cos(el),
                        c.z + d * math.sin(el))
    place(cam_obj, tuple(cam_obj.location), (c.x, c.y, c.z))
    cam.dof.use_dof = fstop is not None
    if fstop is not None:
        cam.dof.focus_distance = max(0.1, (Vector(cam_obj.location) - c).length)
        cam.dof.aperture_fstop = fstop
    print("frame: d=%.2f fills h=%.0f%% v=%.0f%% (subject %.2f x %.2f)"
          % (d, 100.0 * width / span_h, 100.0 * height / span_v, width, height))
    return d


# ---------------------------------------------------------------------- grade

def compositor_glare(threshold: float = 1.05, mix: float = -0.42, size: int = 7,
                     streaks: int = 0):
    """Fog-glow in comp buys the one thing metal needs: light bleeding off the edges.

    4.x moved the compositor out of Scene.node_tree into a node group, and the Glare
    node's knobs into inputs. Everything here is guarded: a render must never die
    because a post-process was renamed.
    """
    sc = bpy.context.scene
    try:
        ng = bpy.data.node_groups.new("vito_comp", "CompositorNodeTree")
        rl = ng.nodes.new("CompositorNodeRLayers")
        try:
            out = ng.nodes.new("CompositorNodeComposite")        # ≤ 4.x
        except Exception:
            out = ng.nodes.new("NodeGroupOutput")                 # 5.x: the group ends
            try:                                                  # in a group output,
                ng.interface.new_socket("Image", in_out="OUTPUT",  # and needs a socket
                                        socket_type="NodeSocketImage")
            except Exception:
                pass
        g = ng.nodes.new("CompositorNodeGlare")
        key = "STREAKS" if streaks else "FOG_GLOW"
        # 4.x: a property with enum identifiers. 5.x: an input socket whose enum items
        # are the *display* names ("Fog Glow"), so try both spellings.
        want = [key, key.replace("_", " ").title()]
        for prop in ("glare_type", "type"):
            if any(_try(g, prop, v) for v in want):
                break
        else:
            sock = g.inputs.get("Type")
            if sock is not None:
                for v in want:
                    try:
                        sock.default_value = v
                        break
                    except TypeError:
                        continue
        _try(g, "quality", "HIGH")
        _try(g, "iterations", 6)
        # 4.x calls the amount "Mix" (−1..1), 5.x calls it "Strength" (0..1)
        amt = ("Mix", mix) if g.inputs.get("Mix") is not None else ("Strength", 0.62 + mix * 0.45)
        for key, val in (("Threshold", threshold), amt, ("Size", size),
                         ("Quality", "HIGH"), ("Iterations", 6)):
            sock = g.inputs.get(key)
            if sock is not None:
                try:
                    sock.default_value = val
                except TypeError:
                    pass
        def sock(node, *names):
            for nm in names:
                for side in (node.inputs, node.outputs):
                    got = side.get(nm)
                    if got is not None:
                        return got
            for side in (node.outputs, node.inputs):
                if len(side):
                    return side[0]
            return None
        # the layers pass is "Image" in 4.x, "Combined"/"Render Layers" in 5.x
        src = sock(rl, "Image", "Combined", "Render Layers")
        ng.links.new(src, g.inputs["Image"])
        ng.links.new(g.outputs[0], sock(out, "Image", "Output"))
        _try(sc, "use_nodes", True)
        _try(sc, "compositing_node_group", ng)
        return g
    except Exception as e:                                        # noqa: BLE001
        print("comp glare skipped:", e)
        return None
