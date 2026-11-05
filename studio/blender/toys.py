"""
toys.py — blocky toy figures, built as real geometry for Cycles.

The look the studio is after: small injection-moulded plastic figures standing in a
photoreal building. Two things make that read as *quality* instead of as a screensaver:
the plastic has to behave like plastic (a coat, a roughness that varies, an edge that
catches), and the figures have to move like toys (short, snappy limb swings, a body
that bobs on the beat of the step, no soft secondary motion because a moulded toy has
no soft parts).

Everything here is math evaluated per frame — no keyframes, no F-curves — so a still,
a 24-frame shot and a 48-frame shot come from the same function and cannot drift.
"""
from __future__ import annotations

import math
import os
import sys
from typing import Dict, List, Sequence, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

IDENTITY = Matrix.Identity(4)

import stage  # noqa: E402

STUD = 0.20          # one stud, in metres: the whole figure is built on this grid
PIV = math.pi


def hash01(i: int, salt: int = 0) -> float:
    x = (i * 2654435761 + salt * 40503) & 0xFFFFFFFF
    x ^= x >> 15
    x = (x * 2246822519) & 0xFFFFFFFF
    x ^= x >> 13
    return (x & 0xFFFFFF) / 0xFFFFFF


def elastic(t: float) -> float:
    """A snap with one overshoot — a piece locking onto a toy, not a feather landing."""
    if t <= 0:
        return 0.0
    if t >= 1:
        return 1.0
    p = 0.36
    return pow(2.0, -10 * t) * math.sin((t - p / 4) * (2 * math.pi) / p) + 1.0


# ----------------------------------------------------------------------- materials
def plastic(name: str, color: Sequence[float], rough: float = 0.30,
            coat: float = 0.45, scratch: float = 1.0) -> "bpy.types.Material":
    """Injection-moulded ABS: a base lobe, a clear coat, and roughness that is not constant.

    The `scratch` noise is what separates this from default CGI: a moulded toy is glossy
    in some places and matte in others, and a highlight that breaks up reads as plastic
    at any sample count.
    """
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Metallic"].default_value = 0.0
    b.inputs["Roughness"].default_value = rough
    _try_input(b, "Specular IOR Level", 0.55)
    _try_input(b, "Coat Weight", coat)
    _try_input(b, "Coat Roughness", 0.16)
    if scratch > 0:
        tex = nt.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = 46.0 * scratch
        tex.inputs["Detail"].default_value = 3.0
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["From Min"].default_value = 0.28
        mr.inputs["From Max"].default_value = 0.78
        mr.inputs["To Min"].default_value = max(0.05, rough * 0.72)
        mr.inputs["To Max"].default_value = min(0.95, rough * 1.45)
        nt.links.new(tex.outputs["Fac"], mr.inputs["Value"])
        nt.links.new(mr.outputs["Result"], b.inputs["Roughness"])
    return m


def paint(name: str, color: Sequence[float], rough: float = 0.62) -> "bpy.types.Material":
    """Worn enamel on a wall — the world the toys are standing in."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Roughness"].default_value = rough
    tex = nt.nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = 3.4
    tex.inputs["Detail"].default_value = 8.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*[c * 0.55 for c in color], 1.0)
    ramp.color_ramp.elements[1].color = (*[min(1.0, c * 1.55 + 0.012) for c in color], 1.0)
    nt.links.new(tex.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    bmp = nt.nodes.new("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = 0.006
    nt.links.new(tex.outputs["Fac"], bmp.inputs["Height"])
    nt.links.new(bmp.outputs["Normal"], b.inputs["Normal"])
    return m


def _try_input(sock_node, name: str, value) -> bool:
    try:
        s = sock_node.inputs.get(name)
        if s is not None:
            s.default_value = value
            return True
    except Exception:
        pass
    return False


# -------------------------------------------------------------------------- body
def _block(name: str, loc, dims, mat, bevel: float = 0.0, seg: int = 2):
    """A cube whose *origin* is at `loc` — so `loc` is where the joint is, and the
    geometry hangs below/around it. That is the whole trick for posing limbs."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.0, 0.0, 0.0))
    ob = bpy.context.object
    ob.name = name
    ob.scale = (dims[0], dims[1], dims[2])
    ob.location = (loc[0], loc[1], loc[2] - dims[2] / 2.0)
    if bevel > 0:
        bv = ob.modifiers.new("bv", "BEVEL")
        bv.width = bevel
        bv.segments = seg
    if mat is not None:
        ob.data.materials.append(mat)
    return ob


def _slab(name: str, loc, dims, mat, bevel: float = 0.0, seg: int = 2):
    """A cube centred exactly on `loc` (no joint semantics)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = dims
    if bevel > 0:
        bv = ob.modifiers.new("bv", "BEVEL")
        bv.width = bevel
        bv.segments = seg
    if mat is not None:
        ob.data.materials.append(mat)
    return ob


def avatar(tag: str, loc: Sequence[float], mats: Dict[str, "bpy.types.Material"],
            height: float = 1.0, hat: str = "", parent=None) -> Dict:
    """A four-limb blocky figure, built on the stud grid and ready to be posed.

    `hat` is character at the cheapest possible price: "lamp" bolts a working headlamp on
    (which is also a real light in the scene), "cap" tilts a slab, "pack" adds a backpack.
    """
    # The classic toy grid: five units tall, two across, a head the size of a die.
    # Anything softer — real shoulders, a neck, a tapered waist — stops reading as a toy
    # at three metres, which is the distance this film is built to be seen from.
    U = 0.20 * height
    s = 2.0 * U                             # torso width
    leg_l, leg_w = 1.95 * U, 0.72 * U
    hip_z = 2.0 * U
    torso_h, torso_d = 2.0 * U, 1.0 * U
    shoulder_z = hip_z + torso_h
    head_h, head_w = 1.05 * U, 1.18 * U
    arm_l, arm_w = 1.9 * U, 0.70 * U

    root = bpy.data.objects.new(f"av_{tag}", None)
    bpy.context.scene.collection.objects.link(root)
    root.location = loc
    if parent is not None:
        root.parent = parent
        root.matrix_parent_inverse = parent.matrix_world.inverted()

    parts: Dict[str, object] = {}
    parts["pelvis"] = _slab(f"{tag}_pelvis", (0, 0, hip_z - 0.12 * U), (s * 0.94, torso_d * 0.92, 0.28 * U),
                            mats["pants"], bevel=0.03 * U)
    parts["torso"] = _slab(f"{tag}_torso", (0, 0, hip_z + torso_h / 2 - 0.06 * U), (s, torso_d, torso_h),
                           mats["shirt"], bevel=0.06 * U)
    parts["head"] = _slab(f"{tag}_head", (0, 0, shoulder_z + head_h / 2 + 0.06 * U),
                          (head_w, head_h * 0.94, head_h), mats["skin"], bevel=0.14 * U, seg=3)
    parts["arm-l"] = _block(f"{tag}_arml", (-s / 2 - arm_w * 0.52, 0, shoulder_z - 0.06 * U),
                            (arm_w, arm_w, arm_l), mats["shirt"], bevel=0.05 * U)
    parts["arm-r"] = _block(f"{tag}_armr", (s / 2 + arm_w * 0.52, 0, shoulder_z - 0.06 * U),
                            (arm_w, arm_w, arm_l), mats["shirt"], bevel=0.05 * U)
    parts["leg-l"] = _block(f"{tag}_legl", (-s * 0.25, 0, hip_z - 0.04 * U),
                            (leg_w, leg_w * 1.05, leg_l), mats["pants"], bevel=0.05 * U)
    parts["leg-r"] = _block(f"{tag}_legr", (s * 0.25, 0, hip_z - 0.04 * U),
                            (leg_w, leg_w * 1.05, leg_l), mats["pants"], bevel=0.05 * U)

    for ob in parts.values():
        ob.parent = root
        ob.matrix_parent_inverse = IDENTITY
        ob.visible_shadow = True

    extra: Dict[str, object] = {}
    lamp = None
    if hat == "lamp":
        extra["lampbody"] = _slab(f"{tag}_lampb", (0, head_h * 0.34, shoulder_z + head_h + 0.16 * U),
                                  (head_h * 0.88, head_h * 0.36, 0.26 * U), mats["dark"], bevel=0.01)
        lens = _slab(f"{tag}_lens", (0, head_h * 0.52, shoulder_z + head_h + 0.035 * height),
                     (0.28 * U, 0.05 * U, 0.24 * U), mats["lampface"])
        extra["lens"] = lens
        ld = bpy.data.lights.new(f"{tag}_beam", "SPOT")
        ld.energy = 260.0
        ld.color = (0.86, 0.93, 1.0)
        ld.spot_size = math.radians(34.0)
        ld.shadow_soft_size = 0.03
        lamp = bpy.data.objects.new(f"{tag}_beaml", ld)
        bpy.context.scene.collection.objects.link(lamp)
        lamp.location = (0, 0.10 * U, shoulder_z + head_h + 0.10 * U)
        lamp.rotation_euler = (math.radians(96.0), 0.0, 0.0)   # local -Z -> forward, 6 deg down
        lamp.parent = root
        lamp.matrix_parent_inverse = IDENTITY
        for k in ("lampbody", "lens"):
            extra[k].parent = root
            extra[k].matrix_parent_inverse = IDENTITY
    elif hat == "cap":
        c = _slab(f"{tag}_cap", (0, 0.02 * U, shoulder_z + head_h + 0.14 * U),
                  (head_h * 1.10, head_h * 1.04, 0.18 * U), mats["accent"], bevel=0.04 * U)
        br = _slab(f"{tag}_brim", (0, head_h * 0.62, shoulder_z + head_h + 0.06 * U),
                   (head_h * 0.84, head_h * 0.44, 0.08 * U), mats["accent"], bevel=0.02 * U)
        for ob in (c, br):
            ob.parent = root
            ob.matrix_parent_inverse = IDENTITY
        extra["cap"] = c
    elif hat == "pack":
        p = _slab(f"{tag}_pack", (0, -s * 0.36, hip_z + torso_h * 0.55),
                  (s * 0.74, s * 0.32, torso_h * 0.72), mats["accent"], bevel=0.07 * U)
        p.parent = root
        p.matrix_parent_inverse = IDENTITY
        extra["pack"] = p

    rest = {k: (Vector(ob.location), Vector(ob.rotation_euler)) for k, ob in parts.items()}
    # `at`/`yaw` are the only two things a caller has to write to move a figure: pose()
    # rebuilds the root transform from them every frame, so nothing accumulates across frames.
    return {"tag": tag, "root": root, "parts": parts, "extra": extra, "rest": rest,
            "lamp": lamp, "at": Vector(loc), "yaw": 0.0,
            "dims": {"s": s, "head_h": head_h, "shoulder_z": shoulder_z, "hip_z": hip_z,
                     "leg_l": leg_l, "arm_l": arm_l, "top_z": shoulder_z + head_h + 0.12 * U}}


# ------------------------------------------------------------------------- posing
def pose(av: Dict, mode: str, ph: float, look: float = 0.0, lean: float = 0.0) -> None:
    """Evaluate one frame of a gait. `ph` is the stride phase in turns.

    Toys do not have soft secondary motion, so the whole performance is three numbers:
    how far the limbs swing, how hard the body bobs on the beat of the step, and where
    the head is looking. Add a double-frequency bob and a figure walking reads instantly.
    """
    parts = av["parts"]
    rest = av["rest"]
    P = lambda k: parts[k]
    for k, (loc0, rot0) in rest.items():
        P(k).rotation_euler = rot0
        P(k).location = loc0

    root = av["root"]
    root.location = Vector(av["at"])
    root.rotation_euler = (0.0, 0.0, av.get("yaw", 0.0))
    if mode == "idle":
        bob = 0.006 * math.sin(ph * 2 * PIV)
        root.location.z += bob
        for k, sgn in (("arm-l", 1), ("arm-r", -1)):
            P(k).rotation_euler.x += math.radians(sgn * (4.0 + 2.6 * math.sin(ph * 2 * PIV)))
        P("head").rotation_euler.z += math.radians(9.0 * math.sin(ph * PIV * 0.7))
        P("head").rotation_euler.x += math.radians(2.0 * math.sin(ph * PIV * 1.3))
    elif mode in ("walk", "run"):
        amp = 34.0 if mode == "walk" else 52.0
        arm_amp = 26.0 if mode == "walk" else 46.0
        s = math.sin(ph * 2 * PIV)
        c = math.cos(ph * 2 * PIV)
        P("leg-l").rotation_euler.x += math.radians(amp * s)
        P("leg-r").rotation_euler.x += math.radians(-amp * s)
        P("arm-l").rotation_euler.x += math.radians(-arm_amp * s)
        P("arm-r").rotation_euler.x += math.radians(arm_amp * s)
        # the bob rides the *stride*, twice per cycle: both feet pass under the body together
        root.location.z += (0.014 if mode == "walk" else 0.026) * abs(c) - 0.007
        root.rotation_euler.x += math.radians(-6.0 if mode == "walk" else -15.0) + math.radians(lean)
        root.rotation_euler.z += math.radians(2.4 * s)
        P("head").rotation_euler.z += math.radians(4.0 * c)
        P("head").rotation_euler.x += math.radians(look)
    elif mode == "stalk":
        # the entity: a walk with the arms left behind and the head held too still
        s = math.sin(ph * 2 * PIV)
        P("leg-l").rotation_euler.x += math.radians(26.0 * s)
        P("leg-r").rotation_euler.x += math.radians(-26.0 * s)
        P("arm-l").rotation_euler.x += math.radians(6.0)
        P("arm-r").rotation_euler.x += math.radians(-2.0)
        P("arm-l").rotation_euler.z += math.radians(-16.0)
        P("arm-r").rotation_euler.z += math.radians(11.0)
        root.location.z += 0.020 * abs(math.cos(ph * 2 * PIV)) - 0.010
        P("head").rotation_euler.z += math.radians(look)
        P("head").rotation_euler.x += math.radians(6.0)
    elif mode == "scared":
        # both arms up, elbows out, a tremble — a toy has exactly one fear pose
        for k, sgn in (("arm-l", 1), ("arm-r", -1)):
            P(k).rotation_euler.x += math.radians(-58.0 + 5.0 * math.sin(ph * 30.0))
            P(k).rotation_euler.z += math.radians(sgn * 24.0)
        root.location.z += 0.004 * math.sin(ph * 41.0)
    elif mode == "down":
        # a figure that has left the game: face down, one arm out, nothing moving
        root.rotation_euler.x += math.radians(-88.0)
        root.location.z += 0.12
        P("arm-l").rotation_euler.z += math.radians(-64.0)
        P("arm-r").rotation_euler.x += math.radians(-24.0)
        P("leg-r").rotation_euler.x += math.radians(16.0)


def assemble(av: Dict, t: float, t0: float, dur: float = 0.55, seed: int = 0) -> float:
    """The pieces fall in from a scatter and lock together. Returns how assembled it is.

    This is the shot a game trailer needs and a film cannot fake: the character *is* the
    loading screen. Each part gets its own stagger, so a figure builds itself in one
    snap rather than fading in.
    """
    k = 0.0
    for idx, (nm, ob) in enumerate(av["parts"].items()):
        u = (t - t0 - 0.055 * ((idx * 7 + seed) % 5)) / dur
        u = stage.clamp01(u)
        e = elastic(u)
        k += u
        loc0, rot0 = av["rest"][nm]
        h = hash01(seed * 31 + idx, 5)
        h2 = hash01(seed * 31 + idx, 9)
        if u < 1.0:
            off = (1.0 - e)
            ob.location = (loc0.x + off * (h - 0.5) * 0.5,
                           loc0.y + off * (h2 - 0.5) * 0.5,
                           loc0.z + off * (1.1 + 1.5 * h))
            ob.rotation_euler = (rot0[0] + off * (h2 - 0.5) * 7.0,
                                 rot0[1] + off * (h - 0.5) * 7.0,
                                 rot0[2] + off * (h - 0.5) * 9.0)
        else:
            ob.location = loc0
            ob.rotation_euler = rot0
    return k / max(1, len(av["parts"]))
