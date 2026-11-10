"""Two satellites for the hero, modelled from scratch and rendered on a transparent ground.

    python tools/satellites/build.py      # renders, crops, writes concept/sat-*.webp
    blender -b --factory-startup -P tools/satellites/scene.py -- --out <dir> [--only relay] [--samples 256] [--save]

In a running Blender (the MCP bridge, or the Text Editor) run the file with a
`__name__` other than "__main__" and call build(): it makes or replaces a scene
called "satellites" and leaves every other scene alone. render() writes the PNGs,
render_glint() the solar glint layers that go with them.

relay     a geostationary relay: box bus, two three-panel wings, two deployed reflectors
observer  an Earth observer: hexagonal bus over a telescope with its door open,
          roll-out wings on masts and a dish on a boom

Both wear lucya.systems: silver foil, graphite, and violet only where it is real, in
the cells. They are marked as flight hardware is: the Shinsei Concordia flag and the
house's mark printed on a black blanket, FM1 under them, and the data plate where a
plate really sits, small, on a unit (the star tracker electronics out on the deck). The sun stands where hero-planet.js has it, low on the
left and a little behind, so the planet's light and theirs agree. Metres, Z up; each
satellite hangs under an empty of its name, which carries its pose.
"""
import argparse
import math
import os
import random
import re
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

try:
    HERE = os.path.dirname(os.path.abspath(__file__))
except NameError:   # run from Blender's Text Editor
    HERE = os.path.dirname(bpy.path.abspath(bpy.context.space_data.text.filepath))
REPO = os.path.dirname(os.path.dirname(HERE))
LOGO = os.path.join(REPO, "images", "logo", "lucya_logo.svg")
LOGO_TEXT = os.path.join(REPO, "images", "logo", "lucya_logo_text.svg")
D = math.radians

# where the sun is, seen from the satellites: low on the left, as on the planet, and a
# little in front, so the faces we see catch it
SUN = Vector((-0.78, -0.42, -0.14)).normalized()
SCENE = "satellites"
scene = None


def setup_scene(samples):
    """A scene of its own; a rebuild replaces it with everything that was in it."""
    global scene
    old = bpy.data.scenes.get(SCENE)
    if old:
        for coll in list(old.collection.children_recursive):
            for ob in list(coll.objects):
                bpy.data.objects.remove(ob)
            bpy.data.collections.remove(coll)
        for ob in list(old.collection.objects):
            bpy.data.objects.remove(ob)
        if len(bpy.data.scenes) > 1:
            bpy.data.scenes.remove(old)
            old = None
    scene = old or bpy.data.scenes.new(SCENE)
    for kind in ("meshes", "materials", "lights", "cameras", "worlds", "node_groups"):
        coll = getattr(bpy.data, kind)
        for block in list(coll):
            if block.users == 0:
                coll.remove(block)
    for win in bpy.context.window_manager.windows:
        win.scene = scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.preview_samples = 32
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for backend in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = backend
            prefs.get_devices()
            if any(d.type == backend for d in prefs.devices):
                for d in prefs.devices:
                    d.use = d.type == backend
                scene.cycles.device = "GPU"
                break
        except TypeError:
            continue
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.view_transform = "AgX"
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass


# ------------------------------------------------------------------ materials
def lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c) + (1.0,)


def node(nt, kind, x=0, **inputs):
    n = nt.nodes.new(kind)
    n.location = (x, 0)
    for k, v in inputs.items():
        if hasattr(n, k):
            setattr(n, k, v)
        else:
            n.inputs[k].default_value = v
    return n


def sock(n, name, out=False):
    """The enabled socket of that name: Mix keeps one per data type."""
    for s in (n.outputs if out else n.inputs):
        if s.name == name and s.enabled:
            return s
    raise KeyError(name)


def material(name, color, metal=0.0, rough=0.5, coat=0.0, coat_rough=0.03, aniso=0.0, spec=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = color if len(color) == 4 else (*color, 1.0)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    b.inputs["Specular IOR Level"].default_value = spec
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = coat_rough
    b.inputs["Anisotropic"].default_value = aniso
    return m


def crinkle(m, scale, strength, rough=None, space=None):
    """Foil: blankets are never flat; facets from Voronoi, folds from noise. With space,
    the folds are that object's, for ink printed on its blanket."""
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = node(nt, "ShaderNodeTexCoord", -900)
    tc.object = space
    noise = node(nt, "ShaderNodeTexNoise", -700, Scale=scale, Detail=8.0, Roughness=0.62, Distortion=1.1)
    vor = node(nt, "ShaderNodeTexVoronoi", -700, Scale=scale * 3.2)
    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
    nt.links.new(tc.outputs["Object"], vor.inputs["Vector"])
    add = node(nt, "ShaderNodeMath", -500, operation="MULTIPLY_ADD")
    nt.links.new(vor.outputs["Distance"], add.inputs[0])
    add.inputs[1].default_value = 0.6
    nt.links.new(noise.outputs["Fac"], add.inputs[2])
    bump = node(nt, "ShaderNodeBump", -300, Strength=strength, Distance=0.02)
    nt.links.new(add.outputs[0], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    if rough:
        mr = node(nt, "ShaderNodeMapRange", -300)
        mr.inputs["From Min"].default_value = 0.3
        mr.inputs["From Max"].default_value = 0.7
        mr.inputs["To Min"].default_value = rough[0]
        mr.inputs["To Max"].default_value = rough[1]
        nt.links.new(noise.outputs["Fac"], mr.inputs["Value"])
        nt.links.new(mr.outputs["Result"], b.inputs["Roughness"])
    return m


def tiles(m, size, gap, seam_color, seam_rough=0.6):
    """Optical solar reflectors: mirror tiles on whichever face the material sits."""
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = node(nt, "ShaderNodeTexCoord", -1100)
    scaled = node(nt, "ShaderNodeVectorMath", -900, operation="SCALE")
    nt.links.new(tc.outputs["Object"], scaled.inputs[0])
    scaled.inputs["Scale"].default_value = 1.0 / size
    sep = node(nt, "ShaderNodeSeparateXYZ", -700)
    nt.links.new(scaled.outputs[0], sep.inputs[0])
    nsep = node(nt, "ShaderNodeSeparateXYZ", -700)
    nt.links.new(tc.outputs["Normal"], nsep.inputs[0])
    seams = []
    for i in range(3):
        fr = node(nt, "ShaderNodeMath", -500, operation="FRACT")
        nt.links.new(sep.outputs[i], fr.inputs[0])
        off = node(nt, "ShaderNodeMath", -400, operation="SUBTRACT")
        nt.links.new(fr.outputs[0], off.inputs[0])
        off.inputs[1].default_value = 0.5
        ab = node(nt, "ShaderNodeMath", -300, operation="ABSOLUTE")
        nt.links.new(off.outputs[0], ab.inputs[0])
        gt = node(nt, "ShaderNodeMath", -200, operation="GREATER_THAN")
        nt.links.new(ab.outputs[0], gt.inputs[0])
        gt.inputs[1].default_value = 0.5 - gap
        # an axis only draws seams on the faces it runs across
        na = node(nt, "ShaderNodeMath", -300, operation="ABSOLUTE")
        nt.links.new(nsep.outputs[i], na.inputs[0])
        lt = node(nt, "ShaderNodeMath", -200, operation="LESS_THAN")
        nt.links.new(na.outputs[0], lt.inputs[0])
        lt.inputs[1].default_value = 0.5
        mul = node(nt, "ShaderNodeMath", -100, operation="MULTIPLY")
        nt.links.new(gt.outputs[0], mul.inputs[0])
        nt.links.new(lt.outputs[0], mul.inputs[1])
        seams.append(mul)
    mx = node(nt, "ShaderNodeMath", 0, operation="MAXIMUM")
    nt.links.new(seams[0].outputs[0], mx.inputs[0])
    nt.links.new(seams[1].outputs[0], mx.inputs[1])
    seam = node(nt, "ShaderNodeMath", 100, operation="MAXIMUM")
    nt.links.new(mx.outputs[0], seam.inputs[0])
    nt.links.new(seams[2].outputs[0], seam.inputs[1])
    # each tile sits a hair off true, so the reflection breaks at every seam
    cell = node(nt, "ShaderNodeVectorMath", -500, operation="FLOOR")
    nt.links.new(scaled.outputs[0], cell.inputs[0])
    wn = node(nt, "ShaderNodeTexWhiteNoise", -300)
    wn.noise_dimensions = "3D"
    nt.links.new(cell.outputs[0], wn.inputs["Vector"])
    rough = node(nt, "ShaderNodeMapRange", 200)
    nt.links.new(wn.outputs["Value"], rough.inputs["Value"])
    rough.inputs["To Min"].default_value = b.inputs["Roughness"].default_value
    rough.inputs["To Max"].default_value = b.inputs["Roughness"].default_value + 0.06
    mixr = node(nt, "ShaderNodeMix", 300, data_type="FLOAT")
    nt.links.new(seam.outputs[0], sock(mixr, "Factor"))
    nt.links.new(rough.outputs["Result"], sock(mixr, "A"))
    sock(mixr, "B").default_value = seam_rough
    nt.links.new(sock(mixr, "Result", True), b.inputs["Roughness"])
    mixc = node(nt, "ShaderNodeMix", 300, data_type="RGBA")
    nt.links.new(seam.outputs[0], sock(mixc, "Factor"))
    sock(mixc, "A").default_value = b.inputs["Base Color"].default_value[:]
    sock(mixc, "B").default_value = seam_color
    nt.links.new(sock(mixc, "Result", True), b.inputs["Base Color"])
    return m


def cells(name, nx, ny, gap=0.035):
    """Solar cells under cover glass: deep indigo, violet where the coat catches the
    light, grey substrate between them. Laid out on the object's own box."""
    m = material(name, lin("#1d2160"), rough=0.14, coat=1.0, coat_rough=0.015, spec=0.6)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = node(nt, "ShaderNodeTexCoord", -1200)
    grid = node(nt, "ShaderNodeVectorMath", -1000, operation="MULTIPLY")
    nt.links.new(tc.outputs["Generated"], grid.inputs[0])
    grid.inputs[1].default_value = (nx, ny, 1.0)
    sep = node(nt, "ShaderNodeSeparateXYZ", -800)
    nt.links.new(grid.outputs[0], sep.inputs[0])
    gaps = []
    for i in range(2):
        fr = node(nt, "ShaderNodeMath", -600, operation="FRACT")
        nt.links.new(sep.outputs[i], fr.inputs[0])
        off = node(nt, "ShaderNodeMath", -500, operation="SUBTRACT")
        nt.links.new(fr.outputs[0], off.inputs[0])
        off.inputs[1].default_value = 0.5
        ab = node(nt, "ShaderNodeMath", -400, operation="ABSOLUTE")
        nt.links.new(off.outputs[0], ab.inputs[0])
        gt = node(nt, "ShaderNodeMath", -300, operation="GREATER_THAN")
        nt.links.new(ab.outputs[0], gt.inputs[0])
        gt.inputs[1].default_value = 0.5 - gap
        gaps.append(gt)
    seam = node(nt, "ShaderNodeMath", -200, operation="MAXIMUM")
    nt.links.new(gaps[0].outputs[0], seam.inputs[0])
    nt.links.new(gaps[1].outputs[0], seam.inputs[1])
    # no two cells are quite the same
    cid = node(nt, "ShaderNodeVectorMath", -800, operation="FLOOR")
    nt.links.new(grid.outputs[0], cid.inputs[0])
    wn = node(nt, "ShaderNodeTexWhiteNoise", -600)
    wn.noise_dimensions = "3D"
    nt.links.new(cid.outputs[0], wn.inputs["Vector"])
    var = node(nt, "ShaderNodeMix", -400, data_type="RGBA")
    nt.links.new(wn.outputs["Value"], sock(var, "Factor"))
    sock(var, "A").default_value = lin("#10123a")
    sock(var, "B").default_value = lin("#171a4c")
    # the violet is the anti-reflection coat's, an interference colour, not paint
    b.inputs["Thin Film Thickness"].default_value = 420.0
    b.inputs["Thin Film IOR"].default_value = 2.0
    col = node(nt, "ShaderNodeMix", 0, data_type="RGBA")
    nt.links.new(seam.outputs[0], sock(col, "Factor"))
    nt.links.new(sock(var, "Result", True), sock(col, "A"))
    sock(col, "B").default_value = lin("#55545c")
    nt.links.new(sock(col, "Result", True), b.inputs["Base Color"])
    inv = node(nt, "ShaderNodeMath", 0, operation="SUBTRACT")
    inv.inputs[0].default_value = 1.0
    nt.links.new(seam.outputs[0], inv.inputs[1])
    nt.links.new(inv.outputs[0], b.inputs["Coat Weight"])
    rough = node(nt, "ShaderNodeMapRange", 0)
    nt.links.new(seam.outputs[0], rough.inputs["Value"])
    rough.inputs["To Min"].default_value = 0.1
    rough.inputs["To Max"].default_value = 0.32
    nt.links.new(rough.outputs["Result"], b.inputs["Roughness"])
    return m


class M:
    pass


def make_materials():
    M.mli = crinkle(material("mli_silver", lin("#d4d4da"), metal=1.0, rough=0.16), 4.5, 0.18, (0.1, 0.3))
    M.mli_black = crinkle(material("mli_black", lin("#0b0b0e"), rough=0.22, spec=0.7), 4.5, 0.22, (0.14, 0.38))
    M.graphite = material("graphite", (0.045, 0.045, 0.055), metal=1.0, rough=0.34, coat=0.4, coat_rough=0.12)
    M.cfrp = material("cfrp", (0.02, 0.02, 0.024), rough=0.3, coat=0.6, coat_rough=0.06)
    M.alu = material("aluminium", lin("#c9c9ce"), metal=1.0, rough=0.24, aniso=0.6)
    M.osr = tiles(material("osr", lin("#e6e6ec"), metal=1.0, rough=0.03), 0.11, 0.06, lin("#2a2a30"))
    M.mli_fine = crinkle(material("mli_silver_fine", lin("#d4d4da"), metal=1.0, rough=0.14), 8.0, 0.1, (0.1, 0.26))
    M.white = material("white_paint", lin("#d7d6d2"), rough=0.5)
    M.reflector = crinkle(material("reflector", lin("#e2e1dc"), rough=0.42), 1.2, 0.08)
    M.back = material("panel_back", lin("#8e8a83"), rough=0.6)
    M.niobium = material("niobium", lin("#6d6585"), metal=1.0, rough=0.32)
    M.black = material("inner_black", (0.004, 0.004, 0.005), rough=0.92, spec=0.2)
    M.emblem = material("emblem", lin("#e9e9ee"), metal=1.0, rough=0.11)
    # clear-anodised, satin: rough enough to take the sun, not only mirror the dark
    M.plate = brushed(material("plate", lin("#d6d7db"), metal=1.0, rough=0.44, aniso=0.55))
    M.ink = material("plate_ink", lin("#141416"), rough=0.42)
    M.steel = material("steel", lin("#b4b5b9"), metal=1.0, rough=0.26)


def brushed(m, streak=900.0):
    """Brushed along U: fine streaks in the roughness, the sheen drawn out along them."""
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = node(nt, "ShaderNodeTexCoord", -900)
    st = node(nt, "ShaderNodeVectorMath", -700, operation="MULTIPLY")
    nt.links.new(tc.outputs["UV"], st.inputs[0])
    st.inputs[1].default_value = (4.0, streak, 1.0)
    noise = node(nt, "ShaderNodeTexNoise", -500, Scale=1.0, Detail=6.0, Roughness=0.6)
    nt.links.new(st.outputs[0], noise.inputs["Vector"])
    mr = node(nt, "ShaderNodeMapRange", -300)
    mr.inputs["From Min"].default_value = 0.3
    mr.inputs["From Max"].default_value = 0.7
    r = b.inputs["Roughness"].default_value
    mr.inputs["To Min"].default_value = r - 0.08
    mr.inputs["To Max"].default_value = r + 0.08
    nt.links.new(noise.outputs["Fac"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], b.inputs["Roughness"])
    tan = node(nt, "ShaderNodeTangent", -300, direction_type="UV_MAP")
    tan.uv_map = "UVMap"
    nt.links.new(tan.outputs["Tangent"], b.inputs["Tangent"])
    return m


# ------------------------------------------------------------------ geometry
COLL = None
PARTS = {}


def autosmooth(bm, angle=35):
    bm.normal_update()
    lim = D(angle)
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        if len(e.link_faces) != 2 or e.calc_face_angle(0.0) > lim:
            e.smooth = False


def obj(name, bm, mats, parent=None, loc=(0, 0, 0), rot=(0, 0, 0), bevel=0.0, smooth=35,
        solidify=0.0, sol_offset=0, sol_rim=0):
    if smooth:
        autosmooth(bm, smooth)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    COLL.objects.link(ob)
    ob.parent = parent
    ob.location = loc
    ob.rotation_euler = rot
    if solidify:
        s = ob.modifiers.new("solidify", "SOLIDIFY")
        s.thickness = solidify
        s.offset = -1
        s.material_offset = sol_offset
        s.material_offset_rim = sol_rim
        s.use_even_offset = True
    if bevel:
        b = ob.modifiers.new("bevel", "BEVEL")
        b.width = bevel
        b.segments = 2
        b.limit_method = "ANGLE"
        b.harden_normals = True
    PARTS[COLL.name].append(ob)
    return ob


def empty(name, parent=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    ob = bpy.data.objects.new(name, None)
    COLL.objects.link(ob)
    ob.parent = parent
    ob.location = loc
    ob.rotation_euler = rot
    ob.empty_display_size = 0.3
    return ob


def bm_box(sx, sy, sz, c=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    bmesh.ops.translate(bm, vec=c, verts=bm.verts)
    bm.normal_update()
    return bm


def bm_cyl(r1, r2, depth, seg=32, caps=True, z=0.0):
    """Along Z, r1 at the bottom, centred on z."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=seg, radius1=r1, radius2=r2, depth=depth)
    if z:
        bmesh.ops.translate(bm, vec=(0, 0, z), verts=bm.verts)
    bm.normal_update()
    return bm


def paint(bm, pick):
    bm.normal_update()
    for f in bm.faces:
        f.material_index = pick(f.normal, f.calc_center_median())


def aim(ob, direction):
    ob.rotation_mode = "QUATERNION"
    ob.rotation_quaternion = Vector(direction).normalized().to_track_quat("Z", "Y")


def rod(name, a, b, r, mat, parent, seg=12):
    a, b = Vector(a), Vector(b)
    ob = obj(name, bm_cyl(r, r, (b - a).length, seg), [mat], parent, loc=(a + b) / 2)
    aim(ob, b - a)
    return ob


def cylinder(name, r, depth, mats, parent, loc, direction=(0, 0, 1), seg=32, bevel=0.0, r2=None, caps=True):
    ob = obj(name, bm_cyl(r, r if r2 is None else r2, depth, seg, caps), mats, parent, loc=loc, bevel=bevel)
    aim(ob, direction)
    return ob


def dish(name, radius, focal, parent, loc, boresight, front=None, back=None, rings=16, seg=56):
    """A paraboloid opening along +Z, a rim, ribs behind it."""
    bm = bmesh.new()
    centre = bm.verts.new((0, 0, 0))
    ring_vs = []
    for i in range(1, rings + 1):
        r = radius * (i / rings) ** 0.9
        z = r * r / (4 * focal)
        ring_vs.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z))
                        for a in (2 * math.pi * k / seg for k in range(seg))])
    for k in range(seg):
        bm.faces.new((centre, ring_vs[0][k], ring_vs[0][(k + 1) % seg]))
    for i in range(rings - 1):
        a, b = ring_vs[i], ring_vs[i + 1]
        for k in range(seg):
            bm.faces.new((a[k], b[k], b[(k + 1) % seg], a[(k + 1) % seg]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # normals into the bowl, so the solidify shell grows out of its back
    if sum((f.normal.z for f in bm.faces), 0.0) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    ob = obj(name, bm, [front or M.reflector, back or M.cfrp], parent, loc=loc, smooth=80,
             solidify=radius * 0.03, sol_offset=1, sol_rim=1)
    aim(ob, boresight)
    zr = radius * radius / (4 * focal)
    rim = obj(name + "_rim", bm_cyl(radius * 1.01, radius * 1.01, radius * 0.05, seg, caps=False),
              [M.alu], ob, loc=(0, 0, zr - radius * 0.02), smooth=80, solidify=radius * 0.02)
    # ribs behind the shell, following its curve, and the hub they meet in
    back = radius * 0.06
    for k in range(8):
        a = 2 * math.pi * k / 8
        pts = [(r * math.cos(a), r * math.sin(a), r * r / (4 * focal) - back)
               for r in (radius * t for t in (0.12, 0.4, 0.68, 0.94))]
        for j in range(len(pts) - 1):
            rod(f"{name}_rib{k}{j}", pts[j], pts[j + 1], radius * 0.016, M.cfrp, ob, 6)
    obj(name + "_hub", bm_cyl(radius * 0.14, radius * 0.1, radius * 0.12, 24), [M.alu], ob,
        loc=(0, 0, -back - radius * 0.04), bevel=radius * 0.01)
    return ob, zr


def outline(d, steps=6):
    """An SVG path's subpaths as polygons: absolute M, L, C and Z, curves flattened."""
    toks = re.findall(r"[MLCZ]|-?\d*\.?\d+(?:e-?\d+)?", d)
    polys, cur, i, cmd = [], [], 0, None

    def pt():
        nonlocal i
        i += 2
        return float(toks[i - 2]), float(toks[i - 1])
    while i < len(toks):
        if toks[i].isalpha():
            cmd = toks[i]
            i += 1
        if cmd == "M":
            if cur:
                polys.append(cur)
            cur, cmd = [pt()], "L"
        elif cmd == "L":
            cur.append(pt())
        elif cmd == "C":
            p0, c1, c2, p3 = cur[-1], pt(), pt(), pt()
            for k in range(1, steps + 1):
                t = k / steps
                u = 1 - t
                cur.append(tuple(u ** 3 * a + 3 * u * u * t * b + 3 * u * t * t * c + t ** 3 * e
                                 for a, b, c, e in zip(p0, c1, c2, p3)))
        elif cmd == "Z":
            polys.append(cur)
            cur = []
    if cur:
        polys.append(cur)
    out = []
    for p in polys:
        q = [v for j, v in enumerate(p) if j == 0 or math.dist(v, p[j - 1]) > 1e-6]
        if len(q) > 2 and math.dist(q[0], q[-1]) < 1e-6:
            q.pop()
        if len(q) > 2:
            out.append(q)
    return out


def svg_polys(path):
    """Every path of an SVG as polygons in its viewBox units, y down, with the matrix()
    transforms of the groups it sits in."""
    import xml.etree.ElementTree as ET
    root = ET.parse(path).getroot()
    vb = [float(v) for v in root.get("viewBox").split()]
    polys = []

    def walk(el, m):
        t = el.get("transform")
        if t:
            a = [float(v) for v in re.findall(r"-?\d*\.?\d+(?:e-?\d+)?", t)]
            m = (m[0] * a[0] + m[2] * a[1], m[1] * a[0] + m[3] * a[1],
                 m[0] * a[2] + m[2] * a[3], m[1] * a[2] + m[3] * a[3],
                 m[0] * a[4] + m[2] * a[5] + m[4], m[1] * a[4] + m[3] * a[5] + m[5])
        if el.tag.endswith("path"):
            for poly in outline(el.get("d")):
                polys.append([(m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]) for x, y in poly])
        for child in el:
            walk(child, m)
    walk(root, (1, 0, 0, 1, 0, 0))
    return vb, polys


def mark(name, path, width, depth, parent, loc, rot=(0, 0, 0), mat=None):
    """A mark from images/logo, centred on loc and standing depth off it."""
    vb, polys = svg_polys(path)
    s = width / vb[2]
    bm = bmesh.new()
    for poly in polys:
        vs2 = [((x - vb[0] - vb[2] / 2) * s, -(y - vb[1] - vb[3] / 2) * s) for x, y in poly]
        if sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(vs2, vs2[1:] + vs2[:1])) < 0:
            vs2.reverse()
        face = bm.faces.new([bm.verts.new((x, y, 0)) for x, y in vs2])
        ext = bmesh.ops.extrude_face_region(bm, geom=[face])
        top = [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, verts=top, vec=(0, 0, depth))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj(name, bm, [mat or M.emblem], parent, loc=loc, rot=rot,
               bevel=depth * 0.3 if depth > 0.004 else 0.0, smooth=30)


FONTS = {"sans": "SpaceGrotesk-VariableFont_wght.woff2", "mono": "JetBrainsMono-VariableFont_wght.woff2"}


def font(kind):
    """The site's own faces from fonts/; Blender's built-in one if they will not load."""
    try:
        return bpy.data.fonts.load(os.path.join(REPO, "fonts", FONTS[kind]), check_existing=True)
    except (RuntimeError, OSError):
        return None


def text(name, body, size, kind, parent, loc, mat, align="LEFT", weight=0.0, track=1.0, rot=(0, 0, 0)):
    """Lettering as a flat mesh, its origin on the baseline."""
    cu = bpy.data.curves.new(name, "FONT")
    cu.body, cu.size, cu.align_x = body, size, align
    cu.offset, cu.space_character = weight, track
    face = font(kind)
    if face:
        cu.font = face
    tmp = bpy.data.objects.new(name, cu)
    me = bpy.data.meshes.new_from_object(tmp)
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(cu)
    bm = bmesh.new()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    return obj(name, bm, [mat], parent, loc=loc, rot=rot, smooth=0)


def bm_plate(w, h, t, r, seg=6):
    """A plate in XY with rounded corners, from z=0 up to t; UVs in metres, for the grain."""
    bm = bmesh.new()
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90),
                       (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        pts += [(cx + r * math.cos(D(a0 + 90 * k / seg)), cy + r * math.sin(D(a0 + 90 * k / seg)))
                for k in range(seg + 1)]
    face = bm.faces.new([bm.verts.new((x, y, 0)) for x, y in pts])
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    bmesh.ops.translate(bm, verts=[e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)], vec=(0, 0, t))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        for lp in f.loops:
            lp[uv].uv = (lp.vert.co.x, lp.vert.co.y)
    return bm


def datamatrix(name, seed, n, size, parent, loc, mat):
    """A Data Matrix as parts are marked: solid L on the left and bottom, the clock
    track along the top and right. The data inside is only the look of one."""
    rnd = random.Random(seed)
    q = size / n
    bm = bmesh.new()
    for i in range(n):            # column, from the left
        for j in range(n):        # row, from the bottom
            on = (i == 0 or j == 0 or (j == n - 1 and i % 2 == 0) or (i == n - 1 and j % 2 == 0)
                  or (0 < i < n - 1 and 0 < j < n - 1 and rnd.random() < 0.5))
            if on:
                x, y = (i - n / 2) * q, (j - n / 2) * q
                bm.faces.new([bm.verts.new(v) for v in ((x, y, 0), (x + q, y, 0), (x + q, y + q, 0), (x, y + q, 0))])
    return obj(name, bm, [mat], parent, loc=loc, smooth=0)


PLATE = (1.2, 0.70, 0.01)   # drawn at twelve times its size, see nameplate()


def nameplate(name, unit, program, pn, rev, sn, mass, dom, esd, parent, loc, rot, scale=0.085):
    """A unit's data plate, as flight hardware carries one: brushed aluminium, riveted,
    engraved and filled black. The house's mark and FM (flight model) on top, the unit's
    name, then the fields a plate has (no orbit, no power: those are on data sheets)
    and the Data Matrix every part is marked with. Drawn at 1.2 x 0.7 in its own XY,
    face to +Z, and scaled to its 102 x 60 mm."""
    W, H, T = PLATE
    rows = (("PROGRAM", program), ("P/N", pn), ("REV", rev), ("S/N", sn), ("MASS", mass),
            ("DOM", dom), ("ESD", esd))
    uid = f"{pn} {sn}"
    root = empty(name, parent, loc, rot)
    root.scale = (scale,) * 3
    obj(name + "_blank", bm_plate(W, H, T, 0.022), [M.plate], root, bevel=0.0025)
    z = T + 0.0003   # the fill in the engraving, flush with the face
    ink = dict(parent=root, mat=M.ink)
    for i, (cx, cy, sx, sy) in enumerate(((0, H / 2 - 0.02, W - 0.04, 0.005), (0, -H / 2 + 0.02, W - 0.04, 0.005),
                                          (W / 2 - 0.02, 0, 0.005, H - 0.04), (-W / 2 + 0.02, 0, 0.005, H - 0.04))):
        obj(f"{name}_border{i}", bm_box(sx, sy, 0.0004), [M.ink], root, loc=(cx, cy, z), smooth=0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * (W / 2 - 0.045), sy * (H / 2 - 0.045)
            obj(f"{name}_rivet{sx}{sy}", bm_cyl(0.019, 0.009, 0.008, 24, z=0.004), [M.steel], root,
                loc=(x, y, T), bevel=0.003, smooth=60)

    left, right, top = -W / 2 + 0.085, W / 2 - 0.085, H / 2 - 0.07
    vb = svg_polys(LOGO_TEXT)[0]
    lw = 0.6
    lh = lw * vb[3] / vb[2]
    mark(name + "_mark", LOGO_TEXT, lw, 0.0004, root, (left + lw / 2, top - lh / 2, T + 0.0001), mat=M.ink)
    text(name + "_model", "FM", 0.12, "sans", loc=(right, top - lh, z), align="RIGHT", weight=0.0035, **ink)
    text(name + "_unit", unit, 0.024, "mono", loc=(left, top - lh - 0.05, z), track=1.15, **ink)
    rule = top - lh - 0.076
    obj(name + "_rule", bm_box(right - left, 0.004, 0.0004), [M.ink], root, loc=((left + right) / 2, rule, z), smooth=0)
    y = rule - 0.062
    for i, (label, value) in enumerate(rows):
        text(f"{name}_label{i}", label, 0.023, "mono", loc=(left, y, z), track=1.1, **ink)
        text(f"{name}_value{i}", value, 0.036, "mono", loc=(left + 0.25, y, z), **ink)
        y -= 0.057
    dm = 0.19
    datamatrix(name + "_code", uid, 16, dm, root, (right - dm / 2, rule - 0.05 - dm / 2, z), M.ink)
    text(name + "_uid", uid, 0.017, "mono", loc=(right - dm / 2, rule - 0.05 - dm - 0.04, z), align="CENTER", **ink)
    return root


# what each satellite's star tracker electronics say about themselves
PLATES = {
    "relay": dict(unit="STAR TRACKER ELECTRONICS UNIT", program="LS-R1 RELAY", pn="LS-STE-210-01", rev="C",
                  sn="0007", mass="1.84 kg", dom="2026-08", esd="CLASS 1B"),
    "observer": dict(unit="STAR TRACKER ELECTRONICS UNIT", program="LS-O1 OBSERVER", pn="LS-STE-210-01", rev="C",
                     sn="0012", mass="1.84 kg", dom="2026-09", esd="CLASS 1B"),
}


def unit(name, parent, loc, plate):
    """An electronics box out on the deck: black anodised, on its feet, two connectors
    with their labels, and its data plate on the face that looks out (-Y)."""
    UX, UY, UZ = 0.26, 0.16, 0.12
    box = empty(name, parent, loc)
    obj(name + "_case", bm_box(UX, UY, UZ), [M.graphite], box, bevel=0.004)
    for sx in (-1, 1):
        obj(f"{name}_foot{sx}", bm_box(0.04, UY + 0.02, 0.006), [M.graphite], box,
            loc=(sx * (UX / 2 + 0.01), 0, -UZ / 2 + 0.003), bevel=0.001)
    for i, x in enumerate((0.045, 0.095)):
        cylinder(f"{name}_j{i + 1}", 0.014, 0.024, [M.alu], box, (x, -UY / 2 - 0.012, -0.01),
                 direction=(0, -1, 0), bevel=0.002)
        cylinder(f"{name}_j{i + 1}_cap", 0.0095, 0.004, [M.black], box, (x, -UY / 2 - 0.025, -0.01),
                 direction=(0, -1, 0))
        text(f"{name}_j{i + 1}_label", f"J{i + 1}", 0.013, "mono", box, (x, -UY / 2 - 0.0003, 0.02), M.white,
             align="CENTER", rot=(D(90), 0, 0))
    nameplate(name + "_plate", parent=box, loc=(-UX / 2 + 0.064, -UY / 2, 0), rot=(D(90), 0, 0), **plate)
    return box


FLAG = os.path.join(HERE, "concordia-flag.png")   # Shinsei Concordia's, from the sc branding


def printed(name, space, color=None, image=None):
    """Ink screen-printed on a black blanket. It lies in the blanket's own folds: the
    bump runs in the space of the object the blanket belongs to."""
    m = crinkle(material(name, color or lin("#e4e4e1"), rough=0.4, spec=0.5), 4.5, 0.22, space=space)
    if image:
        nt = m.node_tree
        tex = node(nt, "ShaderNodeTexImage", -400)
        tex.image = bpy.data.images.load(image, check_existing=True)
        tex.interpolation = "Cubic"
        nt.links.new(node(nt, "ShaderNodeTexCoord", -600).outputs["UV"], tex.inputs["Vector"])
        nt.links.new(tex.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
    return m


def decal(name, w, h, parent, loc, mat):
    bm = bmesh.new()
    face = bm.faces.new([bm.verts.new((x * w / 2, y * h / 2, 0)) for x, y in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    uv = bm.loops.layers.uv.new("UVMap")
    for lp in face.loops:
        lp[uv].uv = (lp.vert.co.x / w + 0.5, lp.vert.co.y / h + 0.5)
    return obj(name, bm, [mat], parent, loc=loc, smooth=0)


def livery(name, blanket, parent, loc, rot, flag_w, mark_w):
    """What a bus wears on its black blanket, printed in it: the Concordia flag over the
    house's mark, and FM1 under it, the first flight model. Centred on loc, face to +Z."""
    root = empty(name, parent, loc, rot)
    ink = printed(name + "_ink", blanket)
    vb = svg_polys(LOGO_TEXT)[0]
    fh, lh = flag_w * 2 / 3, mark_w * vb[3] / vb[2]
    gap = fh * 0.3
    top = (fh + gap + lh) / 2
    z = 0.0003
    decal(name + "_flag", flag_w, fh, root, (0, top - fh / 2, z), printed(name + "_flag", blanket, image=FLAG))
    mark(name + "_mark", LOGO_TEXT, mark_w, 0.0002, root, (0, top - fh - gap - lh / 2, z), mat=ink)
    text(name + "_fm", "FM1", fh * 0.23, "mono", root, (mark_w / 2, -top - fh * 0.42, z), ink, align="RIGHT",
         track=1.1)
    return root


def panel(name, w, h, t, nx, ny, parent, loc, rot=(D(90), 0, 0)):
    """A solar panel in its own XY plane, cells on +Z; rotated (90, 0, 0) they face -Y."""
    bm = bm_box(w, h, t)
    paint(bm, lambda n, c: 0 if n.z > 0.9 else 1 if n.z < -0.9 else 2)
    return obj(name, bm, [cells(name + "_cells", nx, ny), M.back, M.alu], parent, loc=loc, rot=rot, bevel=t * 0.25)


def new_satellite(name, at):
    global COLL
    COLL = bpy.data.collections.new(name)
    scene.collection.children.link(COLL)
    PARTS[name] = []
    return empty(name, None, at)


# ------------------------------------------------------------------ relay
def build_relay(root):
    BX, BY, BZ = 1.8, 1.6, 2.0
    bus = empty("relay_bus", root)

    # ±X carry the wings and radiate; ±Y and the top are foil; the earth deck graphite
    bm = bm_box(BX, BY, BZ)
    paint(bm, lambda n, c: 1 if abs(n.x) > 0.9 else 2 if n.z < -0.9 else 0)
    obj("relay_body", bm, [M.mli, M.osr, M.graphite], bus, bevel=0.03)
    # corner rails
    for sx in (-1, 1):
        for sy in (-1, 1):
            obj(f"relay_rail_z{sx}{sy}", bm_box(0.06, 0.06, BZ + 0.04), [M.alu], bus,
                loc=(sx * BX / 2, sy * BY / 2, 0), bevel=0.008)
            obj(f"relay_rail_x{sx}{sy}", bm_box(BX + 0.04, 0.05, 0.05), [M.alu], bus,
                loc=(0, sx * BY / 2, sy * BZ / 2), bevel=0.008)
            obj(f"relay_rail_y{sx}{sy}", bm_box(0.05, BY + 0.04, 0.05), [M.alu], bus,
                loc=(sx * BX / 2, 0, sy * BZ / 2), bevel=0.008)
    # a black blanket on the east face, the flag and the house's mark printed on it
    blanket = obj("relay_plate", bm_box(BX - 0.26, 0.03, 1.0), [M.mli_black], bus,
                  loc=(0, -BY / 2 - 0.015, BZ / 2 - 0.68), bevel=0.01)
    livery("relay_livery", blanket, bus, (0, -BY / 2 - 0.03, BZ / 2 - 0.68), (D(90), 0, 0), 0.45, 1.2)
    # the star tracker electronics sit out on the deck by their heads, data plate to the east
    unit("relay_ste", bus, (-0.32, -0.56, BZ / 2 + 0.06), PLATES["relay"])
    # a thin band of radiator under it, as on the real thing
    obj("relay_band", bm_box(BX - 0.26, 0.025, 0.42), [M.osr], bus,
        loc=(0, -BY / 2 - 0.012, -0.42), bevel=0.006)

    # anti-earth deck: apogee engine, omni antennas, star trackers
    cylinder("relay_lae_mount", 0.2, 0.12, [M.alu], bus, (0, 0, BZ / 2 + 0.06), bevel=0.01)
    obj("relay_lae", bm_cyl(0.09, 0.32, 0.55, 40, caps=False), [M.niobium, M.black], bus,
        loc=(0, 0, BZ / 2 + 0.38), smooth=80, solidify=0.015, sol_offset=1)
    for i, (x, y) in enumerate(((0.62, 0.55), (-0.62, -0.5))):
        rod(f"relay_omni{i}", (x, y, BZ / 2), (x, y, BZ / 2 + 0.75), 0.014, M.alu, bus)
        cylinder(f"relay_omni_tip{i}", 0.06, 0.12, [M.white], bus, (x, y, BZ / 2 + 0.78), r2=0.01)
    for i, d in enumerate(((0.55, -0.35, 0.75), (0.2, -0.6, 0.75))):
        st = cylinder(f"relay_tracker{i}", 0.08, 0.26, [M.graphite], bus,
                      (0.55 - i * 0.22, -0.5, BZ / 2 + 0.12), direction=d, bevel=0.006)
        obj(f"relay_tracker_hood{i}", bm_cyl(0.08, 0.13, 0.18, 28, caps=False), [M.black], st,
            loc=(0, 0, 0.21), smooth=80, solidify=0.01)

    # earth deck: feeds and a small steerable dish, all looking down at the planet
    for i, (x, y, d) in enumerate(((-0.35, -0.45, (0, -0.55, -1)), (0.35, -0.45, (0.1, -0.55, -1)),
                                   (0.0, 0.5, (0, 0.55, -1)))):
        horn = cylinder(f"relay_feed{i}", 0.06, 0.38, [M.white, M.black], bus,
                        (x, y, -BZ / 2 - 0.2), direction=d, r2=0.17, caps=False)
        horn.modifiers.new("solidify", "SOLIDIFY").thickness = 0.012
    gim = cylinder("relay_ku_gimbal", 0.09, 0.25, [M.alu], bus, (0.45, 0.35, -BZ / 2 - 0.12), bevel=0.01)
    dish("relay_ku", 0.42, 0.32, bus, (0.45, 0.35, -BZ / 2 - 0.3), (0.25, 0.2, -1))

    # thrusters at the deck corners
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                cylinder(f"relay_rcs{sx}{sy}{sz}", 0.022, 0.09, [M.niobium, M.black], bus,
                         (sx * (BX / 2 - 0.12), sy * (BY / 2 - 0.12), sz * (BZ / 2 + 0.05)),
                         direction=(sx * 0.4, sy * 0.4, sz), r2=0.05, caps=False, seg=16)

    # east and west reflectors, deployed on arms from the lower edge, looking down
    for sy, rad in ((-1, 1.05), (1, 0.9)):
        y = sy * (BY / 2 + 0.55)
        bore = (0, sy * 0.42, -1)
        rf, zr = dish(f"relay_reflector{'ew'[sy > 0]}", rad, rad * 0.95, bus, (0, y, -BZ / 2 + 0.05), bore)
        rod(f"relay_arm{'ew'[sy > 0]}a", (0.25, sy * BY / 2, -BZ / 2 + 0.25), (0.2, y - sy * 0.15, -BZ / 2 + 0.05),
            0.03, M.cfrp, bus)
        rod(f"relay_arm{'ew'[sy > 0]}b", (-0.25, sy * BY / 2, -BZ / 2 + 0.25), (-0.2, y - sy * 0.15, -BZ / 2 + 0.05),
            0.03, M.cfrp, bus)
        cylinder(f"relay_hinge{'ew'[sy > 0]}", 0.05, 0.6, [M.alu], bus,
                 (0, sy * BY / 2, -BZ / 2 + 0.25), direction=(1, 0, 0), bevel=0.008)

    # north and south wings: drive, yoke, three panels; cells to the front
    PW, PH, PT, GAP = 1.75, 2.05, 0.04, 0.07
    for sx in (-1, 1):
        wing = empty(f"relay_wing{'sn'[sx > 0]}", bus, (sx * BX / 2, 0, 0), (D(14), 0, 0))
        cylinder(f"relay_sada{'sn'[sx > 0]}", 0.17, 0.16, [M.alu], wing, (sx * 0.08, 0, 0), direction=(1, 0, 0), bevel=0.01)
        cylinder(f"relay_sada_shaft{'sn'[sx > 0]}", 0.05, 0.4, [M.graphite], wing, (sx * 0.3, 0, 0), direction=(1, 0, 0))
        root_x = sx * 1.25
        for sz in (-1, 1):
            rod(f"relay_yoke{'sn'[sx > 0]}{sz}", (sx * 0.45, 0, 0), (root_x, 0, sz * (PH / 2 - 0.15)), 0.028, M.cfrp, wing)
        rod(f"relay_yoke_bar{'sn'[sx > 0]}", (root_x, 0, -PH / 2 + 0.1), (root_x, 0, PH / 2 - 0.1), 0.03, M.cfrp, wing)
        for i in range(3):
            cx = root_x + sx * (GAP + PW / 2 + i * (PW + GAP))
            panel(f"relay_panel{'sn'[sx > 0]}{i}", PW, PH, PT, 16, 20, wing, (cx, 0, 0))
            for sz in (-1, 1):   # hinges toward the yoke
                hx = cx - sx * (PW / 2 + GAP / 2)
                obj(f"relay_hinge{'sn'[sx > 0]}{i}{sz}", bm_box(GAP + 0.06, 0.07, 0.14), [M.alu], wing,
                    loc=(hx, 0, sz * PH * 0.3), bevel=0.01)


# ------------------------------------------------------------------ observer
def build_observer(root):
    R, H = 0.85, 1.4
    bus = empty("observer_bus", root)

    # hexagonal bus, faces in turn foil, radiator and graphite; the one facing -Y carries the plate
    bm = bmesh.new()
    bot = [bm.verts.new((R * math.cos(D(60 * k)), R * math.sin(D(60 * k)), 0)) for k in range(6)]
    top = [bm.verts.new((v.co.x, v.co.y, H)) for v in bot]
    bm.faces.new(bot[::-1])
    bm.faces.new(top)
    for k in range(6):
        bm.faces.new((bot[k], bot[(k + 1) % 6], top[(k + 1) % 6], top[k]))
    side = [2, 1, 0, 1, 0, 2]   # by the direction a face looks: 30, 90, 150, 210, 270, 330 degrees

    def pick(n, c):
        if abs(n.z) > 0.9:
            return 3
        a = (math.degrees(math.atan2(n.y, n.x)) + 360) % 360
        return side[int(round((a - 30) / 60)) % 6]
    paint(bm, pick)
    body = obj("observer_body", bm, [M.mli_black, M.osr, M.mli, M.graphite], bus, bevel=0.025)
    for z in (0.0, H):
        ring = bmesh.new()
        bmesh.ops.create_cone(ring, cap_ends=False, cap_tris=False, segments=6, radius1=R + 0.035,
                              radius2=R + 0.035, depth=0.09)
        obj(f"observer_ring{int(z * 10)}", ring, [M.alu], bus, loc=(0, 0, z), smooth=0, solidify=0.05, bevel=0.01)
    livery("observer_livery", body, bus, (0, -R * math.cos(D(30)), H * 0.55), (D(90), 0, 0), 0.36, 0.62)

    # equipment cap and star trackers on top
    cylinder("observer_cap", 0.55, 0.28, [M.graphite], bus, (0, 0, H + 0.14), seg=6, bevel=0.015)
    for k, ang in enumerate((40, 160, 280)):
        a = D(ang)
        d = (math.cos(a) * 0.6, math.sin(a) * 0.6, 1)
        st = cylinder(f"observer_tracker{k}", 0.075, 0.24, [M.alu], bus,
                      (0.32 * math.cos(a), 0.32 * math.sin(a), H + 0.36), direction=d, bevel=0.006)
        obj(f"observer_tracker_hood{k}", bm_cyl(0.075, 0.12, 0.2, 28, caps=False), [M.black], st,
            loc=(0, 0, 0.22), smooth=80, solidify=0.01)
    unit("observer_ste", bus, (-0.2, -0.22, H + 0.34), PLATES["observer"])
    rod("observer_mag", (0, R * 0.8, H - 0.1), (0.2, R + 1.15, H + 0.25), 0.012, M.cfrp, bus)
    obj("observer_mag_head", bm_box(0.08, 0.12, 0.08), [M.white], bus, loc=(0.2, R + 1.17, H + 0.26), bevel=0.01)

    # the telescope hangs under the bus, its sunshade cut on a slant, the door open
    TR, TL, SHADE = 0.58, 1.55, 0.75
    seg = 64
    tb = bmesh.new()
    upper = [tb.verts.new((TR * math.cos(2 * math.pi * k / seg), TR * math.sin(2 * math.pi * k / seg), 0))
             for k in range(seg)]
    mid = [tb.verts.new((v.co.x, v.co.y, -TL)) for v in upper]
    lower = []
    for k, v in enumerate(upper):
        a = 2 * math.pi * k / seg
        lower.append(tb.verts.new((v.co.x, v.co.y, -TL - SHADE * (1 + math.cos(a - D(90))) / 2)))
    for ring_a, ring_b in ((upper, mid), (mid, lower)):
        for k in range(seg):
            tb.faces.new((ring_a[k], ring_a[(k + 1) % seg], ring_b[(k + 1) % seg], ring_b[k]))
    bmesh.ops.recalc_face_normals(tb, faces=tb.faces)
    if tb.faces[0].normal.dot(tb.faces[0].calc_center_median()) < 0:   # foil outside
        bmesh.ops.reverse_faces(tb, faces=tb.faces)
    obj("observer_tube", tb, [M.mli_fine, M.black], bus, smooth=60, solidify=0.03, sol_offset=1, sol_rim=1)
    for k, z in enumerate((-0.25, -0.8, -1.35)):
        obj(f"observer_tube_rib{k}", bm_cyl(TR + 0.02, TR + 0.02, 0.05, seg, caps=False), [M.alu], bus,
            loc=(0, 0, z), smooth=60, solidify=0.03)
    # the primary, a long way in
    obj("observer_primary", bm_cyl(TR - 0.04, TR - 0.04, 0.02, seg), [M.emblem], bus, loc=(0, 0, -0.2))
    # door: hinged at the long side of the shade, swung open past square
    hinge = Vector((0, TR, -TL - SHADE))
    door_pivot = empty("observer_door_pivot", bus, hinge, (D(-108), 0, 0))
    db = bm_cyl(TR + 0.03, TR + 0.03, 0.05, seg)
    paint(db, lambda n, c: 1 if n.z < -0.9 else 0)
    obj("observer_door", db, [M.mli_fine, M.black], door_pivot, loc=(0, -(TR + 0.03), 0), bevel=0.012)
    cylinder("observer_door_hinge", 0.04, 0.4, [M.alu], bus, hinge, direction=(1, 0, 0))

    # roll-out wings: a mast, two blankets either side of it, spreader bars at both ends
    BL, BW, GAP = 3.7, 0.86, 0.13
    for sx in (-1, 1):
        wing = empty(f"observer_wing{'lr'[sx > 0]}", bus, (sx * (R * 0.866 + 0.05), 0, H * 0.55), (D(-24), 0, 0))
        cylinder(f"observer_drive{'lr'[sx > 0]}", 0.13, 0.22, [M.alu], wing, (sx * 0.1, 0, 0), direction=(1, 0, 0), bevel=0.01)
        rod(f"observer_mast{'lr'[sx > 0]}", (sx * 0.2, 0, 0), (sx * (0.45 + BL + 0.1), 0, 0), 0.035, M.alu, wing)
        for end, x in (("root", sx * 0.42), ("tip", sx * (0.45 + BL + 0.05))):
            rod(f"observer_spreader{'lr'[sx > 0]}{end}", (x, 0, -(GAP / 2 + BW + 0.02)), (x, 0, GAP / 2 + BW + 0.02),
                0.03, M.alu, wing)
        for sz in (-1, 1):
            panel(f"observer_blanket{'lr'[sx > 0]}{'bt'[sz > 0]}", BL - 0.1, BW, 0.014, 40, 10, wing,
                  (sx * (0.45 + BL / 2), 0, sz * (GAP / 2 + BW / 2)))

    # high-gain dish on a boom off the back, looking up and away for the relay
    rod("observer_boom", (0.1, R * 0.7, H * 0.8), (0.45, R + 1.35, H + 0.9), 0.035, M.alu, bus)
    cylinder("observer_hga_gimbal", 0.08, 0.2, [M.graphite], bus, (0.45, R + 1.35, H + 0.95), bevel=0.01)
    dish("observer_hga", 0.5, 0.36, bus, (0.45, R + 1.38, H + 1.08), (0.35, 0.55, 0.75))
    # thrusters round the lower ring
    for k in range(6):
        a = D(60 * k + 30)
        cylinder(f"observer_rcs{k}", 0.02, 0.08, [M.niobium, M.black], bus,
                 ((R - 0.1) * math.cos(a), (R - 0.1) * math.sin(a), -0.05),
                 direction=(math.cos(a) * 0.5, math.sin(a) * 0.5, -1), r2=0.045, caps=False, seg=16)


# ------------------------------------------------------------------ light and world
def world():
    w = bpy.data.worlds.new("space")
    scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes["Background"]
    tc = node(nt, "ShaderNodeTexCoord", -900)
    sep = node(nt, "ShaderNodeSeparateXYZ", -700)
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    mr = node(nt, "ShaderNodeMapRange", -500)
    mr.inputs["From Min"].default_value = -1.0
    nt.links.new(sep.outputs[2], mr.inputs["Value"])
    ramp = node(nt, "ShaderNodeValToRGB", -300)
    nt.links.new(mr.outputs["Result"], ramp.inputs["Fac"])
    el = ramp.color_ramp.elements
    # below: the planet's night side, then its lit limb; above: nothing
    stops = [(0.0, (0.004, 0.008, 0.02)), (0.42, (0.012, 0.03, 0.08)), (0.478, (0.16, 0.3, 0.75)),
             (0.492, (0.55, 0.72, 1.0)), (0.505, (0.03, 0.05, 0.12)), (0.56, (0.0, 0.0, 0.0))]
    el[0].position, el[0].color = stops[0][0], (*stops[0][1], 1)
    el[1].position, el[1].color = stops[1][0], (*stops[1][1], 1)
    for p, c in stops[2:]:
        e = el.new(p)
        e.color = (*c, 1)
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 1.4

    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    scene.collection.objects.link(sun)
    sun.data.energy = 6.0
    sun.data.angle = D(0.53)
    sun.data.color = (1.0, 0.97, 0.93)
    sun.rotation_mode = "QUATERNION"
    sun.rotation_quaternion = SUN.to_track_quat("Z", "Y")


def frame(cam, name, res, elev, lens, scale=1.0, margin=0.04):
    """Point the camera, then let Blender move it until the whole satellite fits."""
    scene.render.resolution_x = round(res[0] * scale)
    scene.render.resolution_y = round(res[1] * scale)
    cam.data.lens = lens
    cam.rotation_euler = Euler((D(90 + elev), 0, 0))
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    pts = []
    for ob in PARTS[name]:
        ev = ob.evaluated_get(deps)
        me = ev.to_mesh()
        mw = ev.matrix_world.copy()
        pts += [mw @ v.co for v in me.vertices]
        ev.to_mesh_clear()
    loc, _ = cam.camera_fit_coords(deps, [c for p in pts for c in p])
    fwd = cam.rotation_euler.to_matrix() @ Vector((0, 0, -1))
    centre = sum(pts, Vector()) / len(pts)
    cam.location = loc - fwd * ((centre - loc).dot(fwd) * margin)
    # a little fill from beside the camera, so the shade side still has a shape
    fill = bpy.data.objects.get("fill")
    if not fill:
        fill = bpy.data.objects.new("fill", bpy.data.lights.new("fill", "AREA"))
        scene.collection.objects.link(fill)
        fill.data.size = 6
        fill.data.color = (0.75, 0.82, 1.0)
    dist = (centre - cam.location).length
    fill.data.energy = 0.6 * dist * dist
    fill.location = cam.location + Vector((dist * 0.35, 0, dist * 0.25))
    aim(fill, fill.location - centre)
    # and the planet's day side, low on the left in the hero, lighting them from below
    day = bpy.data.objects.get("dayside")
    if not day:
        day = bpy.data.objects.new("dayside", bpy.data.lights.new("dayside", "AREA"))
        scene.collection.objects.link(day)
        day.data.shape = "DISK"
        day.data.size = 40
        day.data.color = (0.55, 0.72, 1.0)
    day.data.energy = 1.1 * dist * dist
    day.location = centre + Vector((-0.55, -0.35, -0.76)).normalized() * dist
    aim(day, day.location - centre)


# ------------------------------------------------------------------ build and render
# poses: each turns its near wing toward the screen edge it stands at
POSES = {
    "relay": dict(at=(-14, 0, 0), rot=(4, -7, 32)),
    "observer": dict(at=(14, 0, 0), rot=(-6, 14, -34)),
}
SHOTS = {
    "relay": dict(res=(1800, 1000), elev=7, lens=58),
    "observer": dict(res=(1500, 1200), elev=7, lens=58),
}


def build(samples=256):
    PARTS.clear()
    setup_scene(samples)
    make_materials()
    world()
    for name, builder in (("relay", build_relay), ("observer", build_observer)):
        root = new_satellite(name, POSES[name]["at"])
        builder(root)
        root.rotation_euler = Euler([D(a) for a in POSES[name]["rot"]])
    cam = bpy.data.objects.new("camera", bpy.data.cameras.new("camera"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.sensor_width = 36
    frame(cam, "relay", **SHOTS["relay"])
    return scene


def render(out, names=("relay", "observer"), scale=1.0):
    os.makedirs(out, exist_ok=True)
    written = []
    for name in names:
        for other in SHOTS:
            scene.collection.children[other].hide_render = other != name
        frame(scene.camera, name, scale=scale, **SHOTS[name])
        scene.render.filepath = os.path.join(out, f"{name}.png")
        bpy.ops.render.render(write_still=True, scene=scene.name)
        written.append(scene.render.filepath)
    for other in SHOTS:
        scene.collection.children[other].hide_render = False
    return written


def glint_direction(name):
    """Where a sun would have to stand for the cells to throw it straight into the
    camera: the view mirrored in the panels' normal. Their panels are coplanar."""
    panels = [o for o in PARTS[name] if o.data.materials and o.data.materials[0].name.endswith("_cells")]
    normal, centre = Vector(), Vector()
    for p in panels:
        normal += (p.matrix_world.to_3x3() @ Vector((0, 0, 1))).normalized()
        centre += p.matrix_world.translation
    normal.normalize()
    centre /= len(panels)
    view = (scene.camera.location - centre).normalized()
    if normal.dot(view) < 0:
        normal = -normal
    return panels, (2 * normal.dot(view) * normal - view).normalized()


def render_glint(out, names=("relay", "observer"), scale=1.0, spread=22.0, energy=1.6, coat_rough=0.16):
    """The glint layer: same camera and frame as render(), lit only by a sun in the mirror
    direction, every part but the cells held out so the bus and the yokes still hide them.
    build.py turns it into the mask the page sweeps a band of light through."""
    os.makedirs(out, exist_ok=True)
    bg = scene.world.node_tree.nodes["Background"]
    strength = bg.inputs["Strength"].default_value
    glint = bpy.data.objects.new("glint", bpy.data.lights.new("glint", "SUN"))
    scene.collection.objects.link(glint)
    glint.data.angle = D(spread)
    glint.data.energy = energy
    glint.rotation_mode = "QUATERNION"
    lights = {}
    written = []
    # a sharper cover glass would draw the lamp's disc with a hard rim; the glint wants a hot spot
    coats = {}
    for m in bpy.data.materials:
        if m.name.endswith("_cells"):
            sock_ = m.node_tree.nodes["Principled BSDF"].inputs["Coat Roughness"]
            coats[m.name] = sock_.default_value
            sock_.default_value = coat_rough
    try:
        bg.inputs["Strength"].default_value = 0.0
        for name in names:
            for other in SHOTS:
                scene.collection.children[other].hide_render = other != name
            frame(scene.camera, name, scale=scale, **SHOTS[name])
            for ob in scene.objects:   # frame() may just have made the fill lights
                if ob.type == "LIGHT" and ob is not glint:
                    lights.setdefault(ob.name, ob.hide_render)
                    ob.hide_render = True
            panels, toward = glint_direction(name)
            glint.rotation_quaternion = toward.to_track_quat("Z", "Y")
            for ob in PARTS[name]:
                ob.is_holdout = ob not in panels
            scene.render.filepath = os.path.join(out, f"{name}_glint.png")
            bpy.ops.render.render(write_still=True, scene=scene.name)
            written.append(scene.render.filepath)
    finally:
        bg.inputs["Strength"].default_value = strength
        for n, v in coats.items():
            bpy.data.materials[n].node_tree.nodes["Principled BSDF"].inputs["Coat Roughness"].default_value = v
        for name in PARTS:
            for ob in PARTS[name]:
                ob.is_holdout = False
        for n, hidden in lights.items():
            bpy.data.objects[n].hide_render = hidden
        bpy.data.objects.remove(glint)
        for other in SHOTS:
            scene.collection.children[other].hide_render = False
    return written


def closeup(target, path, dist, lens=85, res=(1600, 1000), off=(0.22, 0.12), samples=128):
    """A look at one part head on, from in front of its face (its +Z) and a little to the
    side, with its satellite alone: for checking a plate or a print up close."""
    ob = bpy.data.objects[target]
    name = target.split("_")[0]
    bpy.context.view_layer.update()
    m3 = ob.matrix_world.to_3x3()
    n, up, side = [(m3 @ Vector(v)).normalized() for v in ((0, 0, 1), (0, 1, 0), (1, 0, 0))]
    c = ob.matrix_world.translation
    cam = bpy.data.objects.new("closeup", bpy.data.cameras.new("closeup"))
    scene.collection.objects.link(cam)
    cam.data.lens = lens
    cam.location = c + n * dist + side * dist * off[0] + up * dist * off[1]
    fwd = (c - cam.location).normalized()
    right = fwd.cross(up).normalized()
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = Matrix((right, right.cross(fwd), -fwd)).transposed().to_quaternion()
    keep = (scene.camera, scene.render.resolution_x, scene.render.resolution_y, scene.cycles.samples)
    try:
        scene.camera = cam
        for other in SHOTS:
            scene.collection.children[other].hide_render = other != name
        scene.render.resolution_x, scene.render.resolution_y = res
        scene.cycles.samples = samples
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True, scene=scene.name)
    finally:
        scene.camera, scene.render.resolution_x, scene.render.resolution_y, scene.cycles.samples = keep
        for other in SHOTS:
            scene.collection.children[other].hide_render = False
        bpy.data.objects.remove(cam)
    return path


def save():
    """The satellites' scene alone, without touching the file that is open. The flag is
    found next to it, so the file travels with this folder."""
    path = os.path.join(HERE, "satellites.blend")
    bpy.data.libraries.write(path, {scene}, path_remap="RELATIVE", fake_user=True, compress=True)
    return path


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "renders"))
    ap.add_argument("--only", default="relay,observer")
    ap.add_argument("--samples", type=int, default=256)
    ap.add_argument("--scale", type=float, default=1.0, help="resolution factor, for drafts")
    ap.add_argument("--save", action="store_true", help="also write tools/satellites/satellites.blend")
    args = ap.parse_args(argv)
    if bpy.app.background:
        bpy.ops.wm.read_factory_settings(use_empty=True)
    build(args.samples)
    names = args.only.split(",")
    for path in render(args.out, names, args.scale) + render_glint(args.out, names, args.scale):
        print("wrote", path, flush=True)
    if args.save:
        save()
