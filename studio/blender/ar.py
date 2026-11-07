"""
Arabic type as real 3D geometry.

Blender's FONT curves do not shape Arabic — they draw isolated, unjoined forms in
left-to-right order (verified in this box: "نكسب شغل" came out as eight detached
glyphs, mirrored). So the text is shaped *outside* Blender with HarfBuzz, the glyph
outlines are pulled from the original TTF with fontTools, flattened to polylines,
and rebuilt as Blender curve splines — one spline per contour, so counters (the
holes: ت, ة, م) stay holes and shading is clean.

That makes every letter a real object: extrudable, bevelable, metal or glass,
lit, thrown out of focus, and cast onto a floor. None of which CSS can do.
"""
from __future__ import annotations

import math
from typing import List, Tuple

import bpy
import uharfbuzz as hb
from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont

Contour = List[Tuple[float, float]]


# --------------------------------------------------------------------- shaping

def shape(text: str, font_path: str):
    """(glyph ids in visual order, pen-x advances, upem) — HarfBuzz does the joining."""
    blob = hb.Blob.from_file_path(font_path)
    face = hb.Face(blob)
    font = hb.Font(face)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf, {"kern": True, "liga": True, "calt": True})
    out, pen_x = [], 0.0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        out.append((info.codepoint, pen_x + pos.x_offset, pos.y_offset))
        pen_x += pos.x_advance
    return out, pen_x, face.upem


# -------------------------------------------------------------------- outlines

class _Flatten(BasePen):
    """Quad/cubic outlines → polyline, in font units. Tolerance is in units/em,
    so 0.8 is invisible on a 1000-upem face and keeps a 4-letter word near 4 k pts."""

    def __init__(self, glyphSet, tol=0.25):
        super().__init__(glyphSet)
        self.tol = tol
        self.contours: List[Contour] = []
        self.cur: Contour = []

    @staticmethod
    def _quad(p0, p1, p2, tol):
        d = math.hypot(p0[0] - 2 * p1[0] + p2[0], p0[1] - 2 * p1[1] + p2[1])
        n = max(2, min(24, int(math.sqrt(d / max(tol, 1e-6)))))
        return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
                 (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])
                for t in (i / n for i in range(1, n + 1))]

    @staticmethod
    def _cubic(p0, p1, p2, p3, tol):
        d = (math.hypot(p0[0] - 2 * p1[0] + p2[0], p0[1] - 2 * p1[1] + p2[1]) +
             math.hypot(p1[0] - 2 * p2[0] + p3[0], p1[1] - 2 * p2[1] + p3[1]))
        n = max(3, min(32, int(math.sqrt(d / max(tol, 1e-6)))))
        pts = []
        for i in range(1, n + 1):
            t, u = i / n, 1 - i / n
            pts.append((u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
                        u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]))
        return pts

    def moveTo(self, p):
        if len(self.cur) > 2:
            self.contours.append(self.cur)
        self.cur = [p]

    def lineTo(self, p):
        self.cur.append(p)

    def qCurveTo(self, *points):
        if points[-1] is None:                       # TrueType implied on-curve start
            pts = list(points[:-1])
            start = self.cur[-1] if self.cur else (0, 0)
            mid = ((start[0] + pts[0][0]) / 2, (start[1] + pts[0][1]) / 2)
            self.cur = [mid]
            pts = pts[1:] + [pts[0]]
            p0 = mid
            for i in range(0, len(pts), 2):
                c = pts[i]
                e = pts[i + 1] if i + 1 < len(pts) else mid
                self.cur.extend(self._quad(p0, c, e, self.tol))
                p0 = e
            return
        p0 = self.cur[-1]
        for i in range(len(points) - 1):
            c, e = points[i], points[i + 1]
            if i == len(points) - 2:
                self.cur.extend(self._quad(p0, c, e, self.tol))
            else:
                mid = ((c[0] + e[0]) / 2, (c[1] + e[1]) / 2)
                self.cur.extend(self._quad(p0, c, mid, self.tol))
                p0 = mid

    def curveTo(self, *points):
        p0, pts = self.cur[-1], list(points)
        while len(pts) > 3:
            self.cur.extend(self._cubic(p0, pts[0], pts[1], pts[2], self.tol))
            p0, pts = pts[2], pts[2:]
        if len(pts) == 3:
            self.cur.extend(self._cubic(p0, pts[0], pts[1], pts[2], self.tol))

    def closePath(self):
        if len(self.cur) > 2:
            self.contours.append(self.cur)
        self.cur = []

    def endPath(self):
        self.closePath()


def glyph_contours(font: TTFont, gid: int) -> List[Contour]:
    gs, order = font.getGlyphSet(), font.getGlyphOrder()
    if gid >= len(order):
        return []
    pen = _Flatten(gs)
    gs[order[gid]].draw(pen)
    return [c for c in pen.contours if len(c) > 2]


# ---------------------------------------------------------------------- object

def world_bbox(ob):
    """World-space (xmin,xmax),(ymin,ymax),(zmin,zmax) — after a view_layer.update()."""
    from mathutils import Vector
    bpy.context.view_layer.update()
    pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    xs, ys, zs = ([p[i] for p in pts] for i in range(3))
    return (min(xs), max(xs)), (min(ys), max(ys)), (min(zs), max(zs))


def arabic_curve(name: str, text: str, font_path: str, size: float = 1.0,
                 extrude: float = 0.0, bevel: float = 0.0, anchor: str = "center"):
    """One Blender curve object per word: real 3D type, centred on the origin.

    The word is stood up into the X-Z plane (X across, Z up) because that is how a
    title reads to a camera looking down −Y, and every framing helper here assumes it.
    """
    glyphs, adv, upem = shape(text, font_path)
    tt = TTFont(font_path)
    scale = size / upem

    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.fill_mode = "FULL"                     # "BOTH" does not exist for 3D curves
    curve.extrude = extrude                      # spline points are already world units
    curve.bevel_depth = bevel                    # so bevel/extrude must be too
    curve.bevel_resolution = 4
    curve.resolution_u = 8
    curve.use_fill_caps = True

    total = adv * scale
    dx = {"center": -total / 2, "right": -total, "left": 0.0}[anchor]
    for gid, gx, gy in glyphs:
        for contour in glyph_contours(tt, gid):
            sp = curve.splines.new("POLY")
            sp.points.add(len(contour) - 1)
            for i, (x, y) in enumerate(contour):
                sp.points[i].co = ((gx + x) * scale + dx, (gy + y) * scale, 0.0, 1.0)
            sp.use_cyclic_u = True

    ob = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(ob)
    ob.rotation_euler = (math.pi / 2, 0.0, 0.0)
    return ob


def arabic_mesh(name: str, text: str, font_path: str, size: float = 1.0,
                depth: float = 0.14, anchor: str = "center"):
    """Real 3D type as a watertight mesh — the only correct way to do it here.

    A Blender CURVE with `extrude` triangulates each contour on its own and has no
    idea that the counter of ة is a *hole* in the letter, so Arabic comes out as a fan
    of overlapping triangles. Ear-clipping the whole glyph at once (mapbox_earcut, fed
    contiguous ring runs) keeps the holes, and recalc_face_normals closes the shell, so
    the metal reflects a solid letter instead of crumpled foil.
    """
    import bmesh
    import mapbox_earcut as earcut
    import numpy as np

    glyphs, adv, upem = shape(text, font_path)
    tt = TTFont(font_path)
    scale = size / upem
    total = adv * scale
    dx = {"center": -total / 2, "right": -total, "left": 0.0}[anchor]
    z0, z1 = -depth / 2.0, depth / 2.0

    bm = bmesh.new()
    for gid, gx, gy in glyphs:
        contours = [c for c in glyph_contours(tt, gid) if len(c) > 2]
        if not contours:
            continue
        pts, runs = [], []
        for c in contours:
            runs.append((len(pts), len(c)))
            pts += [((x + gx) * scale + dx, (y + gy) * scale) for (x, y) in c]

        # earcut 2.x: an (n,2) float64 array of points, a uint32 [start, len, ...] of
        # rings, and it hands back a flat uint32 index list
        flat = np.asarray(pts, dtype=np.float64).reshape(-1, 2)
        # 2.x wants ring *end* indices (cumulative), the last one being the vertex count
        rings = np.cumsum(np.asarray([ln for _, ln in runs], dtype=np.uint32)).astype(np.uint32)
        tri = earcut.triangulate_float64(flat, rings)

        top = [bm.verts.new((x, y, z1)) for (x, y) in pts]
        bot = [bm.verts.new((x, y, z0)) for (x, y) in pts]
        for k in range(0, len(tri), 3):
            a, b, c = (int(tri[k]), int(tri[k + 1]), int(tri[k + 2]))
            if a == b or b == c or a == c:
                continue
            for face in ((top[a], top[b], top[c]), (bot[c], bot[b], bot[a])):
                try:
                    bm.faces.new(face)
                except ValueError:
                    pass                      # coincident points from the outline, skip
        for start, ln in runs:
            for i in range(ln):
                a, b = start + i, start + (i + 1) % ln
                try:
                    bm.faces.new((top[a], top[b], bot[b], bot[a]))
                except ValueError:
                    pass

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = False
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.rotation_euler = (math.pi / 2, 0.0, 0.0)   # stand the type up: X across, Z up
    return ob


def material(name: str, base: Tuple[float, float, float], metallic: float = 0.0,
             roughness: float = 0.4, emission=None, emission_strength: float = 0.0,
             coat: float = 0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*base, 1.0)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = roughness
    if "Coat Weight" in b.inputs:
        b.inputs["Coat Weight"].default_value = coat
        b.inputs["Coat Roughness"].default_value = 0.08
    if emission is not None and "Emission Color" in b.inputs:
        b.inputs["Emission Color"].default_value = (*emission, 1.0)
        b.inputs["Emission Strength"].default_value = emission_strength
    return m
