"""Builds a Panasonic Let's note CF-QV9 in Blender, from scratch.

  python tools/laptop/make_decals.py
  blender --background --python tools/laptop/build_cf_qv9.py -- [--finish silver|black] [--render hero,lid,keys,pad,rear,tablet]

Writes tools/laptop/cf-qv9.blend. Drag `hinge_deg` on the `laptop` empty to run
the hinge from 0 to 360. Node names match intro/laptop/Laptop.js: base, lidPivot,
lid, screen. --finish black gives the Black Deep Metal model.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import layout as L  # noqa: E402
import ports  # noqa: E402

REPO = os.path.dirname(os.path.dirname(HERE))
MM = 0.001

FINISHES = L.FINISHES

# hinge: lid axis on a short link from the base axis; see build_hinges()
LINK = (L.BASE_H + L.GAP + L.LID_H) / 2
AXIS_INSET = LINK / 2 - 0.1
AXIS_Y = L.DEPTH / 2 - AXIS_INSET
AXIS_Z = L.BASE_H / 2

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
RENDERS = args[args.index("--render") + 1].split(",") if "--render" in args else []
SPP = int(args[args.index("--spp") + 1]) if "--spp" in args else 192
FINISH = FINISHES[args[args.index("--finish") + 1] if "--finish" in args else "silver"]


# ---- mesh helpers ---------------------------------------------------------

def new_object(name, mesh, parent=None):
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(ob)
    ob.parent = parent
    return ob


def empty(name, parent=None):
    return new_object(name, None, parent)


def mesh_from(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(c * MM for c in v) for v in verts], [], faces)
    me.update()
    if len(faces) > 1:   # outward normals, whatever order the faces came in
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
    return me


def box(cx, cy, cz, sx, sy, sz, name="cut"):
    x, y, z = sx / 2, sy / 2, sz / 2
    v = [(cx + a * x, cy + b * y, cz + c * z) for a in (-1, 1) for b in (-1, 1) for c in (-1, 1)]
    f = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    return mesh_from(name, v, f)


def outline_rect(w, d, r_front, r_rear, seg=24):
    """Footprint with rounded corners, counter-clockwise from the front left."""
    pts = []
    corners = [(-w / 2, -d / 2, r_front, 180), (w / 2, -d / 2, r_front, 270),
               (w / 2, d / 2, r_rear, 0), (-w / 2, d / 2, r_rear, 90)]
    for x, y, r, a0 in corners:
        cx = x + (r if x < 0 else -r)
        cy = y + (r if y < 0 else -r)
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def prism(pts, z0, z1, name="prism"):
    n = len(pts)
    v = [(x, y, z0) for x, y in pts] + [(x, y, z1) for x, y in pts]
    f = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
    f += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return mesh_from(name, v, f)


def extrude_x(profile, half_w, name):
    """Extrudes a (y, z) profile along x."""
    n = len(profile)
    v = [(-half_w, y, z) for y, z in profile] + [(half_w, y, z) for y, z in profile]
    f = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
    f += [(i, n + i, n + (i + 1) % n, (i + 1) % n) for i in range(n)]
    return mesh_from(name, v, f)


def revolve(profile, center, name, seg=192):
    """Spins an (r, z) profile around z. r = 0 closes to a point."""
    cx, cy = center
    v, f, rings = [], [], []
    for r, z in profile:
        if r == 0:
            rings.append(None)
            v.append((cx, cy, z))
            rings[-1] = len(v) - 1
        else:
            rings.append(len(v))
            for i in range(seg):
                a = 2 * math.pi * i / seg
                v.append((cx + r * math.cos(a), cy + r * math.sin(a), z))
    for k in range(len(profile) - 1):
        a, b = rings[k], rings[k + 1]
        ra, rb = profile[k][0], profile[k + 1][0]
        for i in range(seg):
            j = (i + 1) % seg
            if ra == 0:
                f.append((a, b + i, b + j))
            elif rb == 0:
                f.append((a + i, b, a + j))
            else:
                f.append((a + i, b + i, b + j, a + j))
    return mesh_from(name, v, f)


def cut_collection(name, meshes):
    col = bpy.data.collections.new(name)
    for me in meshes:
        ob = bpy.data.objects.new(me.name, me)
        col.objects.link(ob)
    return col


def bake_modifiers(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.clear()
    ob.data = me


def finish(ob, bevel=0.45, angle=30, segments=4):
    """Bevels hard edges, then keeps large faces flat under smooth shading."""
    if bevel:
        mod = ob.modifiers.new("bevel", "BEVEL")
        mod.width = bevel * MM
        mod.segments = segments
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(angle)
        mod.harden_normals = False
        bake_modifiers(ob)
    ob.data.shade_smooth()
    ob.data.set_sharp_from_angle(angle=math.radians(50))
    mod = ob.modifiers.new("flat faces", "WEIGHTED_NORMAL")
    mod.keep_sharp = True


def boolean(ob, operand, op="DIFFERENCE"):
    mod = ob.modifiers.new(op.lower(), "BOOLEAN")
    mod.operation = op
    mod.solver = "EXACT"
    if isinstance(operand, bpy.types.Collection):
        mod.operand_type = "COLLECTION"
        mod.collection = operand
    else:
        mod.object = operand
    bake_modifiers(ob)


def wall_cut(side, pts, depth):
    """Prism through a side wall, from just outside to `depth` inside."""
    x0, x1 = side * (L.WIDTH / 2 + 2), side * (L.WIDTH / 2 - depth)
    n = len(pts)
    v = [(x0, y, z) for y, z in pts] + [(x1, y, z) for y, z in pts]
    f = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
    f += [(i, n + i, n + (i + 1) % n, (i + 1) % n) for i in range(n)]
    return mesh_from("port", v, f)


# ---- materials ------------------------------------------------------------

def principled(name, color, metallic=0.0, roughness=0.5, specular=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Specular IOR Level"].default_value = specular
    return mat, bsdf


def fine_grain(mat, bsdf, grain=7000, strength=0.2):
    """The bead-blasted tooth of painted magnesium, plus metallic flake.

    Grain and flake sit at 0.1-0.2 mm, the scale the review photos show; a
    broad noise on roughness keeps the sheen from looking computer-perfect."""
    n = mat.node_tree.nodes
    link = mat.node_tree.links.new
    coord = n.new("ShaderNodeTexCoord")

    noise = n.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = grain
    noise.inputs["Detail"].default_value = 3
    link(coord.outputs["Object"], noise.inputs["Vector"])

    flake = n.new("ShaderNodeTexVoronoi")
    flake.inputs["Scale"].default_value = grain * 0.7
    link(coord.outputs["Object"], flake.inputs["Vector"])

    bump_a = n.new("ShaderNodeBump")
    bump_a.inputs["Strength"].default_value = strength
    bump_a.inputs["Distance"].default_value = 0.00012
    link(noise.outputs[0], bump_a.inputs["Height"])

    bump_b = n.new("ShaderNodeBump")
    bump_b.inputs["Strength"].default_value = strength * 0.7
    bump_b.inputs["Distance"].default_value = 0.00008
    link(flake.outputs["Distance"], bump_b.inputs["Height"])
    link(bump_a.outputs["Normal"], bump_b.inputs["Normal"])
    link(bump_b.outputs["Normal"], bsdf.inputs["Normal"])

    base = bsdf.inputs["Roughness"].default_value
    broad = n.new("ShaderNodeTexNoise")
    broad.inputs["Scale"].default_value = 60
    link(coord.outputs["Object"], broad.inputs["Vector"])
    rough = n.new("ShaderNodeMapRange")
    rough.inputs["To Min"].default_value = base - 0.03
    rough.inputs["To Max"].default_value = base + 0.03
    link(broad.outputs[0], rough.inputs["Value"])
    link(rough.outputs[0], bsdf.inputs["Roughness"])


def add_decal(mat, bsdf, image_path, scale, loc):
    """Overlays a top-projected mask: red is the finish's ink, green is black."""
    n = mat.node_tree.nodes
    link = mat.node_tree.links.new
    tex = n.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(image_path, check_existing=True)
    tex.image.colorspace_settings.name = "Non-Color"
    tex.extension = "CLIP"
    coord = n.new("ShaderNodeTexCoord")
    mapping = n.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (*scale, 1)
    mapping.inputs["Location"].default_value = (*loc, 0)
    link(coord.outputs["Object"], mapping.inputs["Vector"])
    link(mapping.outputs[0], tex.inputs["Vector"])

    sep = n.new("ShaderNodeSeparateColor")
    link(tex.outputs["Color"], sep.inputs[0])

    # top faces only, or the print would project through the whole body
    normal = n.new("ShaderNodeSeparateXYZ")
    link(coord.outputs["Normal"], normal.inputs[0])
    facing = n.new("ShaderNodeMath")
    facing.operation = "GREATER_THAN"
    facing.inputs[1].default_value = 0.5
    link(normal.outputs["Z"], facing.inputs[0])
    white = n.new("ShaderNodeMath")
    white.operation = "MULTIPLY"
    link(sep.outputs[0], white.inputs[0])
    link(facing.outputs[0], white.inputs[1])
    dark = n.new("ShaderNodeMath")
    dark.operation = "MULTIPLY"
    link(sep.outputs[1], dark.inputs[0])
    link(facing.outputs[0], dark.inputs[1])

    base = n.new("ShaderNodeRGB")
    base.outputs[0].default_value = bsdf.inputs["Base Color"].default_value
    mix_w = n.new("ShaderNodeMix")
    mix_w.data_type = "RGBA"
    mix_w.inputs["B"].default_value = (*FINISH["ink"], 1)
    link(white.outputs[0], mix_w.inputs["Factor"])
    link(base.outputs[0], mix_w.inputs["A"])
    mix_d = n.new("ShaderNodeMix")
    mix_d.data_type = "RGBA"
    mix_d.inputs["B"].default_value = (0.002, 0.002, 0.002, 1)
    link(dark.outputs[0], mix_d.inputs["Factor"])
    link(mix_w.outputs["Result"], mix_d.inputs["A"])
    link(mix_d.outputs["Result"], bsdf.inputs["Base Color"])

    # ink is a dielectric sitting on the metal
    keep = bsdf.inputs["Metallic"].default_value
    metal = n.new("ShaderNodeMapRange")
    metal.inputs["To Min"].default_value = keep
    metal.inputs["To Max"].default_value = 0
    link(white.outputs[0], metal.inputs["Value"])
    link(metal.outputs[0], bsdf.inputs["Metallic"])
    gloss = n.new("ShaderNodeMapRange")
    gloss.inputs["To Min"].default_value = bsdf.inputs["Specular IOR Level"].default_value
    gloss.inputs["To Max"].default_value = 0.05
    link(white.outputs[0], gloss.inputs["Value"])
    link(gloss.outputs[0], bsdf.inputs["Specular IOR Level"])


def add_overlay(mat, bsdf, image_path, scale, loc):
    """Lays an RGBA sheet over what add_decal built: vinyl stickers on the paint."""
    n = mat.node_tree.nodes
    link = mat.node_tree.links.new
    tex = n.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(image_path, check_existing=True)
    tex.extension = "CLIP"
    coord = n.new("ShaderNodeTexCoord")
    mapping = n.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (*scale, 1)
    mapping.inputs["Location"].default_value = (*loc, 0)
    link(coord.outputs["Object"], mapping.inputs["Vector"])
    link(mapping.outputs[0], tex.inputs["Vector"])

    normal = n.new("ShaderNodeSeparateXYZ")
    link(coord.outputs["Normal"], normal.inputs[0])
    facing = n.new("ShaderNodeMath")
    facing.operation = "GREATER_THAN"
    facing.inputs[1].default_value = 0.5
    link(normal.outputs["Z"], facing.inputs[0])
    alpha = n.new("ShaderNodeMath")
    alpha.operation = "MULTIPLY"
    link(tex.outputs["Alpha"], alpha.inputs[0])
    link(facing.outputs[0], alpha.inputs[1])

    colour = bsdf.inputs["Base Color"].links[0].from_socket
    mix = n.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    link(alpha.outputs[0], mix.inputs["Factor"])
    link(colour, mix.inputs["A"])
    link(tex.outputs["Color"], mix.inputs["B"])
    link(mix.outputs["Result"], bsdf.inputs["Base Color"])

    metal = n.new("ShaderNodeMix")
    metal.data_type = "FLOAT"
    metal.inputs["B"].default_value = 0
    link(alpha.outputs[0], metal.inputs["Factor"])
    link(bsdf.inputs["Metallic"].links[0].from_socket, metal.inputs["A"])
    link(metal.outputs["Result"], bsdf.inputs["Metallic"])
    rough = n.new("ShaderNodeMix")
    rough.data_type = "FLOAT"
    rough.inputs["B"].default_value = 0.33
    link(alpha.outputs[0], rough.inputs["Factor"])
    link(bsdf.inputs["Roughness"].links[0].from_socket, rough.inputs["A"])
    link(rough.outputs["Result"], bsdf.inputs["Roughness"])


def build_materials():
    m = {}
    w, d = L.WIDTH * MM, L.DEPTH * MM

    f = FINISH
    shell = dict(metallic=f["metallic"], roughness=f["roughness"], specular=f["specular"])

    m["paint"], b = principled("magnesium paint", f["paint"], **shell)
    fine_grain(m["paint"], b, grain=4800, strength=f["grain"])
    add_decal(m["paint"], b, os.path.join(HERE, "decal_deck.png"), (1 / w, 1 / d), (0.5, 0.5))

    m["lid"], b = principled("magnesium paint lid", f["paint"], **shell)
    fine_grain(m["lid"], b, grain=4800, strength=f["grain"])
    # lid-local: hinge at +y, far edge at -y, read from outside with the hinge down
    add_decal(m["lid"], b, os.path.join(HERE, "decal_lid.png"), (-1 / w, -1 / d), (0.5, AXIS_INSET / L.DEPTH))
    add_overlay(m["lid"], b, os.path.join(HERE, "stickers_lid.png"), (-1 / w, -1 / d), (0.5, AXIS_INSET / L.DEPTH))

    m["key"], b = principled("key cap", f["key"], roughness=0.5)
    fine_grain(m["key"], b, grain=2500, strength=0.08)
    add_decal(m["key"], b, os.path.join(HERE, "decal_deck.png"), (1 / w, 1 / d), (0.5, 0.5))

    m["ring"], b = principled("wheel ring", f["ring"], roughness=0.58, specular=0.3)
    fine_grain(m["ring"], b, strength=0.25)
    m["chrome"], _ = principled("chrome bezel", (0.93, 0.93, 0.94), metallic=1, roughness=0.04)
    m["pad"], b = principled("wheel pad surface", f["pad"], metallic=0.5, roughness=0.42)
    fine_grain(m["pad"], b, grain=4800, strength=0.3)
    m["rubber"], _ = principled("rubber", (0.008, 0.008, 0.008), roughness=0.75)
    m["hinge"], _ = principled("hinge", f["hinge"], metallic=0.9, roughness=0.34)
    m["port metal"], _ = principled("port metal", (0.62, 0.62, 0.6), metallic=1, roughness=0.28)
    m["port black"], _ = principled("port black", (0.006, 0.006, 0.006), roughness=0.55)
    m["port blue"], _ = principled("port blue", (0.01, 0.12, 0.62), roughness=0.4)
    m["port gold"], _ = principled("port gold", (0.9, 0.62, 0.22), metallic=1, roughness=0.25)
    m["port rubber"], _ = principled("port rubber", (0.03, 0.03, 0.03), roughness=0.6)
    for name in ("left", "right", "bottom"):
        m["side " + name], b = principled("side print " + name, (0, 0, 0), roughness=0.5)
        tex = m["side " + name].node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(os.path.join(HERE, "print_bottom.png" if name == "bottom" else f"side_{name}.png"),
                                         check_existing=True)
        links = m["side " + name].node_tree.links
        links.new(tex.outputs["Color"], b.inputs["Base Color"])
        links.new(tex.outputs["Alpha"], b.inputs["Alpha"])

    m["tab"], _ = principled("grey tab", (0.17, 0.165, 0.155), roughness=0.6)
    m["lens"], _ = principled("lens", (0.002, 0.002, 0.003), roughness=0.04)
    m["pill"], _ = principled("pill", f["pill"], roughness=0.5)
    m["led"], b = principled("led", (0, 0, 0))
    b.inputs["Emission Color"].default_value = (0.08, 1, 0.16, 1)
    b.inputs["Emission Strength"].default_value = 5
    m["bezel"], _ = principled("bezel glass", (0.003, 0.003, 0.003), roughness=0.1)

    m["sticker"], b = principled("intel sticker", (1, 1, 1), roughness=0.3)
    n = m["sticker"].node_tree.nodes
    tex = n.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(os.path.join(HERE, "logos", "intel-core-i5-vpro.png"), check_existing=True)
    m["sticker"].node_tree.links.new(tex.outputs["Color"], b.inputs["Base Color"])

    # touch panel: reflections on the real one stay soft, unlike the bezel around it
    screen, b = principled("cover glass", (0.0, 0.0, 0.0), roughness=0.32)
    b.inputs["Specular IOR Level"].default_value = 0.3
    n = screen.node_tree.nodes
    tex = n.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(os.path.join(REPO, "intro", "screen.webp"), check_existing=True)
    link = screen.node_tree.links.new
    link(tex.outputs["Color"], b.inputs["Emission Color"])
    b.inputs["Emission Strength"].default_value = 1.1
    m["screen"] = screen
    return m


# ---- parts ----------------------------------------------------------------

def build_base(root, m):
    d2, h = L.DEPTH / 2, L.BASE_H
    profile = [(-d2 + 6, 0), (d2 - 3, 0), (d2, 2.5), (d2, h - 2.6), (d2 - 2.6, h),
               (-d2 + 1.4, h), (-d2, h - 1.6), (-d2, 3.4)]
    base = new_object("base", extrude_x(profile, L.WIDTH / 2, "base"), root)
    base.data.materials.append(m["paint"])
    outline = new_object("_outline", prism(outline_rect(L.WIDTH, L.DEPTH, 8, 5), -1, h + 1))
    boolean(base, outline, "INTERSECT")
    bpy.data.objects.remove(outline)

    cuts = [
        box((L.KB_LEFT + L.KB_RIGHT) / 2, 38, h, L.KB_RIGHT - L.KB_LEFT + 2.4, 92, 3.0, "kb well"),
        box(110.5, -9, h, 42, 18, 3.0, "arrow step"),
    ]
    for sx in (-1, 1):
        cuts.append(box(sx * L.HINGE_X, d2 - 5, h / 2, L.HINGE_W + 1.6, 12, h + 4, "hinge notch"))
        # the side walls tuck under toward the bottom
        wedge = [(sx * (L.WIDTH / 2 + 1), -1), (sx * (L.WIDTH / 2 + 1), 1.5), (sx * (L.WIDTH / 2 - 1.7), -1)]
        v = [(x, y, z) for y in (-d2 - 1, d2 + 1) for x, z in wedge]
        cuts.append(mesh_from("side taper", v, [(0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]))
    # exhaust: a recessed strip with ten slits in it, measured off the rear
    cuts.append(box(46, d2, 5.2, 60, 0.8, 7.4, "vent panel"))
    for i in range(10):
        cuts.append(box(46 + (i - 4.5) * 5.95, d2 - 1, 5.2, 4.4, 8, 5.2, "vent"))
    # thumb scoop under the SD slot
    pts = [(L.WIDTH / 2 + 3 + 5.5 * math.cos(a / 24 * math.tau), 54.4 + 14 * math.sin(a / 24 * math.tau)) for a in range(24)]
    cuts.append(prism(pts, -1, 2.3, "sd scoop"))

    outlines, port_parts = ports.build()
    for side, pts, depth in outlines:
        cuts.append(wall_cut(side, pts, depth))

    col = cut_collection("base cuts", cuts)
    boolean(base, col)

    well_r = L.PAD_OUTER_R + 0.75
    well = new_object("_well", revolve([(0, h + 2), (well_r, h + 2), (well_r, h - 0.9), (0, h - 0.9)], L.PAD_CENTER, "well"))
    boolean(base, well)
    bpy.data.objects.remove(well)
    finish(base, bevel=0.4)

    # top case and bottom case meet here, all the way round
    seam("case seam", base, dense(outline_rect(L.WIDTH, L.DEPTH, 8, 5)), 6.6, base_seam_skip(6.6), m["port black"])

    # the black groove the wheel ring floats in
    groove = new_object("wheel groove", revolve([(well_r + 0.05, h - 0.85), (L.PAD_INNER_R - 1, h - 0.85)],
                                                L.PAD_CENTER, "groove"), base)
    groove.data.materials.append(m["port black"])

    d2 = L.DEPTH / 2
    new_object("vent back", box(46, d2 - 2.4, 5.2, 59, 0.1, 6.2, "vent back"), base).data.materials.append(m["port black"])
    for sx in (-1, 1):
        # grey bumper low on each side wall, and the slim strips beside the keys
        new_object("bumper", box(sx * (L.WIDTH / 2 + 0.05), -93, 2.0, 0.5, 7.2, 2.8, "bumper"), base).data.materials.append(m["tab"])
        strip = new_object("key strip", prism(outline_rect(1.5, 16, 0.7, 0.7, 6), h - 0.2, h + 0.04), base)
        for v in strip.data.vertices:
            v.co.x += sx * 134.2 * MM
            v.co.y += 22 * MM
        strip.data.materials.append(m["tab"])

    # underside print and labels
    x, y0, y1, z = L.WIDTH / 2 - 0.6, -d2 + 6.5, d2 - 3.5, -0.03
    print_mesh = mesh_from("side print bottom", [(-x, y0, z), (x, y0, z), (x, y1, z), (-x, y1, z)], [(3, 2, 1, 0)])
    uv = print_mesh.uv_layers.new(name="UVMap")
    for loop in print_mesh.loops:
        co = print_mesh.vertices[loop.vertex_index].co / MM
        uv.data[loop.index].uv = (0.5 - co.x / L.WIDTH, 0.5 + co.y / L.DEPTH)
    new_object("side print bottom", print_mesh, base).data.materials.append(m["side bottom"])

    for name, (verts, faces) in port_parts.meshes.items():
        me = bpy.data.meshes.new("ports " + name)
        me.from_pydata([tuple(c * MM for c in co) for co in verts], [], faces)
        me.update()
        me.shade_smooth()
        me.set_sharp_from_angle(angle=math.radians(40))
        new_object("ports " + name, me, base).data.materials.append(m["port " + name])

    # printed on the side walls, from make_decals.py
    d2 = L.DEPTH / 2
    for side, name in ((-1, "left"), (1, "right")):
        x = side * (L.WIDTH / 2 + 0.12)
        z0, z1 = 0.0, h
        v = [(x, -d2, z0), (x, d2, z0), (x, d2, z1), (x, -d2, z1)]
        label = mesh_from("side print " + name, v, [(0, 1, 2, 3)])
        uv = label.uv_layers.new(name="UVMap")
        # both read left to right from outside: rear first on the left wall
        us = [1, 0, 0, 1] if side < 0 else [0, 1, 1, 0]
        for loop, co in zip(label.loops, [(us[0], 0), (us[1], 0), (us[2], 1), (us[3], 1)]):
            uv.data[loop.index].uv = co
        new_object("side print " + name, label, base).data.materials.append(m["side " + name])

    # keys, each in a black collar: the shadow gap around the real ones
    bm = bmesh.new()
    collars = bmesh.new()
    for key in L.keys():
        add_key(bm, key)
        add_collar(collars, key)
    me = bpy.data.meshes.new("key gaps")
    collars.to_mesh(me)
    collars.free()
    new_object("key gaps", me, base).data.materials.append(m["port black"])
    me = bpy.data.meshes.new("keys")
    bm.to_mesh(me)
    bm.free()
    keys = new_object("keys", me, base)
    keys.data.materials.append(m["key"])
    keys.data.shade_smooth()
    keys.data.set_sharp_from_angle(angle=math.radians(55))

    # wheel pad: ring with click-button slits, chrome chamfer, soft centre
    ring = new_object("wheel ring", revolve(
        [(L.PAD_INNER_R, h - 0.6), (L.PAD_INNER_R, h + 0.22), (L.PAD_INNER_R + 0.3, h + 0.3),
         (L.PAD_OUTER_R - 0.3, h + 0.3), (L.PAD_OUTER_R, h + 0.05), (L.PAD_OUTER_R, h - 0.6),
         (L.PAD_INNER_R, h - 0.6)], L.PAD_CENTER, "ring"), base)
    ring.data.materials.append(m["ring"])
    ring.data.shade_smooth()
    slits = []
    cx, cy = L.PAD_CENTER
    mid = (L.PAD_INNER_R + L.PAD_OUTER_R) / 2
    span = L.PAD_OUTER_R - L.PAD_INNER_R + 2
    for deg in (-90, -38, 218):
        a = math.radians(deg)
        me = box(0, 0, h, span, 0.9, 3, "slit")
        me.transform(Matrix.Translation((cx * MM, cy * MM, 0)) @ Matrix.Rotation(a, 4, "Z")
                     @ Matrix.Translation((mid * MM, 0, 0)))
        slits.append(me)
    col = cut_collection("slits", slits)
    boolean(ring, col)
    ring.data.shade_smooth()
    ring.data.set_sharp_from_angle(angle=math.radians(40))

    chrome = new_object("wheel chrome", revolve(
        [(L.PAD_INNER_R, h - 0.3), (L.PAD_INNER_R - 0.05, h + 0.28), (L.PAD_INNER_R - 0.7, h + 0.34),
         (L.PAD_INNER_R - 2.0, h + 0.1), (L.CHROME_R + 0.3, h - 0.32), (L.CHROME_R, h - 0.42)], L.PAD_CENTER, "chrome"), base)
    chrome.data.materials.append(m["chrome"])
    chrome.data.shade_smooth()

    pad = new_object("wheel pad", revolve(
        [(L.CHROME_R + 0.1, h - 0.44), (0, h - 0.44)], L.PAD_CENTER, "pad"), base)
    pad.data.materials.append(m["pad"])

    # power light on the front edge, battery light by the status row
    d2 = L.DEPTH / 2
    front = mesh_from("power led", [(-126, -d2 - 0.04, 5.4), (-117, -d2 - 0.04, 5.4), (-117, -d2 - 0.04, 6.6),
                                    (-126, -d2 - 0.04, 6.6)], [(0, 1, 2, 3)])
    new_object("power led", front, base).data.materials.append(m["led"])
    top = revolve([(0.75, h + 0.04), (0, h + 0.04)], (-29.5, -101.4), "battery led", 24)
    new_object("battery led", top, base).data.materials.append(m["led"])

    # the Intel badge: a label stuck on the palm rest
    x, y = L.STICKER
    w, d = L.STICKER_SIZE
    z = h + 0.2
    label = mesh_from("intel sticker", [(x - w / 2, y - d / 2, z), (x + w / 2, y - d / 2, z),
                                        (x + w / 2, y + d / 2, z), (x - w / 2, y + d / 2, z)], [(0, 1, 2, 3)])
    uv = label.uv_layers.new(name="UVMap")
    for loop, co in zip(label.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        uv.data[loop.index].uv = co
    new_object("intel sticker", label, base).data.materials.append(m["sticker"])

    # pills on the deck: sensor up top, four stops along the front
    pills = [(0, 92, 8, 2.6, h + 0.02)] + [(x, -92.6, 7.1, 3.9, h + 0.16) for x in (-130, -49.2, 15.9, 129)]
    for x, y, w, d, z in pills:
        p = new_object("pill", prism(outline_rect(w, d, d / 2 - 0.01, d / 2 - 0.01, 6), z - 0.5, z + 0.08), base)
        for v in p.data.vertices:
            v.co.x += x * MM
            v.co.y += y * MM
        p.data.materials.append(m["pill"])
        finish(p, bevel=0.14, segments=3)
    return base


def rounded(poly, inset, radius, seg=7):
    """Outline of a right-angled polygon (counter-clockwise), pushed `inset` inwards
    and filleted: convex corners tighten by the inset, concave ones open up."""
    out = []
    n = len(poly)
    for i in range(n):
        a, b, c = Vector(poly[i - 1]), Vector(poly[i]), Vector(poly[(i + 1) % n])
        p, q = (b - a).normalized(), (c - b).normalized()
        left = Vector((-p.y, p.x)) + Vector((-q.y, q.x))
        corner = b + left * inset
        convex = p.x * q.y - p.y * q.x > 0
        r = radius - inset if convex else radius + inset
        centre = corner + (q - p) * r
        for k in range(seg + 1):
            t = k / seg * math.pi / 2
            out.append(centre + (p * math.sin(t) - q * math.cos(t)) * r)
    return out


def dense(loop, step=1.5):
    """Closed outline with no span longer than `step`."""
    out = []
    for i, a in enumerate(loop):
        a, b = Vector(a), Vector(loop[(i + 1) % len(loop)])
        count = max(1, int((b - a).length / step))
        out += [a.lerp(b, k / count) for k in range(count)]
    return out


def seam(name, parent, loop, z, skip, material):
    """The hairline where two shells of the case meet: a dark ribbon just off the
    wall, broken where something interrupts it."""
    n = len(loop)
    verts, faces = [], []
    for i, p in enumerate(loop):
        t = loop[(i + 1) % n] - loop[i - 1]
        out = Vector((t.y, -t.x)).normalized() * 0.05
        verts += [(p.x + out.x, p.y + out.y, z - 0.12), (p.x + out.x, p.y + out.y, z + 0.12)]
    for i in range(n):
        j = (i + 1) % n
        if not skip(*((loop[i] + loop[j]) / 2)):
            faces.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(c * MM for c in v) for v in verts], [], faces)
    me.update()
    new_object(name, me, parent).data.materials.append(material)


def base_seam_skip(z):
    def skip(x, y):
        if abs(x) > L.WIDTH / 2 - 3:
            for kind, wall, py, pz in ports.PORTS:
                shape = ports.SHAPES[kind]
                half_y = max(a for a, _ in shape)
                half_z = max(b for _, b in shape)
                if wall * x > 0 and abs(z - pz) < half_z + 0.25 and abs(y - py) < half_y + 0.6:
                    return True
        if y > L.DEPTH / 2 - 3:
            return abs(abs(x) - L.HINGE_X) < L.HINGE_W / 2 + 1.5 or abs(x - 46) < 31
        return False
    return skip


def add_collar(bm, key):
    """Dark outline on the well floor, a little wider than the cap."""
    ring = rounded(key["poly"], -0.42, key["r"], 5)
    bm.faces.new([bm.verts.new((v.x * MM, v.y * MM, 9.52 * MM)) for v in ring])


def add_key(bm, key):
    """One cap from its outline: straight skirt, soft shoulder, slightly dished top."""
    top = L.BASE_H - 0.15

    def ring(inset, z):
        return [bm.verts.new((v.x * MM, v.y * MM, z * MM)) for v in rounded(key["poly"], inset, key["r"])]

    rings = [ring(0.0, 9.0), ring(0.06, top - 0.55), ring(0.2, top - 0.16), ring(0.48, top - 0.02),
             ring(0.8, top), ring(1.5, top - 0.1)]
    count = len(rings[0])
    for lo, hi in zip(rings, rings[1:]):
        for i in range(count):
            j = (i + 1) % count
            bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bm.faces.new(rings[-1])


def lid_height(x, y_from_hinge):
    """Top of the lid above its centre plane.

    Single bonnet: a raised centre panel between two creases, a band across the
    far edge, all so shallow it shows up mostly as a change of sheen."""
    far = L.DEPTH - y_from_hinge
    edge = 69.4
    z = L.LID_H / 2
    side = max(0.0, abs(x) - edge)
    z -= 0.014 * side                      # side panels fall away to the edge
    if abs(x) < edge:
        z += 0.22
    if far < 17.1:
        z -= 0.7 * (1 - far / 17.1) + 0.1  # band along the far edge, ducking under
    if abs(abs(x) - edge) < 0.01 or abs(far - 17.1) < 0.01:
        z -= 0.2                           # the crease itself, a fine pressed line
    return z


def build_lid(pivot, m):
    # top surface as a grid with its break lines in place
    xs = [-L.WIDTH / 2 - 1, -69.7, -69.4, -69.0, 69.0, 69.4, 69.7, L.WIDTH / 2 + 1]
    far = L.DEPTH
    ys = [-1, far - 17.5, far - 17.1, far - 16.7, far + 1]   # distance from the hinge edge
    v, f = [], []
    for y in ys:
        for x in xs:
            v.append((x, AXIS_INSET - y, lid_height(x, y)))
    nx = len(xs)
    for j in range(len(ys) - 1):
        for i in range(nx - 1):
            f.append((j * nx + i, j * nx + i + 1, (j + 1) * nx + i + 1, (j + 1) * nx + i))
    n = len(v)
    v += [(x, y, -L.LID_H / 2) for x, y, _ in v]
    f += [tuple(reversed([n + c for c in face])) for face in f]
    for j in range(len(ys) - 1):
        f.append(((j + 1) * nx, j * nx, n + j * nx, n + (j + 1) * nx))
        a, b = j * nx + nx - 1, (j + 1) * nx + nx - 1
        f.append((a, b, n + b, n + a))
    for i in range(nx - 1):
        a, b = i, i + 1
        f.append((b, a, n + a, n + b))
        a, b = (len(ys) - 1) * nx + i, (len(ys) - 1) * nx + i + 1
        f.append((a, b, n + b, n + a))

    # parented at the end: booleans work in world space, and the pivot is not
    # at the origin
    lid = new_object("lid", mesh_from("lid", v, f))
    lid.data.materials.append(m["lid"])

    pts = [(x, y - L.DEPTH / 2 + AXIS_INSET) for x, y in outline_rect(L.WIDTH, L.DEPTH, 8, 5)]
    outline = new_object("_outline", prism(pts, -10, 10))
    boolean(lid, outline, "INTERSECT")
    bpy.data.objects.remove(outline)

    # The rear edge is a full round about the lid axis, or the lid would dig
    # into the deck on its first half turn: that axis stays put until 180.
    r = LINK + AXIS_Z - L.BASE_H - 0.05
    arc = [(r * math.cos(a / 20 * math.pi - math.pi / 2), r * math.sin(a / 20 * math.pi - math.pi / 2)) for a in range(21)]
    rounded = new_object("_round", extrude_x([(-240, -10), (0, -10)] + arc + [(0, 10), (-240, 10)], 150, "round"))
    boolean(lid, rounded, "INTERSECT")
    bpy.data.objects.remove(rounded)

    cuts = [box(sx * L.HINGE_X, AXIS_INSET - 5, 0, L.HINGE_W + 1.6, 12, 12, "hinge notch") for sx in (-1, 1)]
    # the rubber gasket around the panel
    z = -L.LID_H / 2
    # the glass stops short of the hinge: a silver band stays along that edge
    far_edge = AXIS_INSET - L.DEPTH
    glass_h = 198.0
    pts = [(x, y + far_edge + 1.5 + glass_h / 2) for x, y in outline_rect(270.0, glass_h, 6, 6)]
    me = prism(pts, z - 1, z + 0.5, "panel seat")
    cuts.append(me)
    col = cut_collection("lid cuts", cuts)
    boolean(lid, col)
    finish(lid, bevel=0.45)
    lid.parent = pivot
    loop = dense([(x, y - L.DEPTH / 2 + AXIS_INSET) for x, y in outline_rect(L.WIDTH, L.DEPTH, 8, 5)])
    seam("lid seam", lid, loop, -1.2, lambda x, y: y > -2, m["port black"])

    # cover glass edge to edge: black around the image, the image plane just in front
    bezel = new_object("bezel", prism(pts, z - 0.0, z + 0.5, "bezel"), lid)
    bezel.data.materials.append(m["bezel"])
    finish(bezel, bevel=0.25, segments=2)

    # 12" at 3:2 is 253.6 x 169.1, with about 14.6 of black glass above and below
    sw, sh = 253.6, 169.1
    top = far_edge + 16.1        # image top toward the far edge
    bottom = top + sh
    plane_z = z - 0.02
    me = mesh_from("screen", [(-sw / 2, bottom, plane_z), (sw / 2, bottom, plane_z),
                              (sw / 2, top, plane_z), (-sw / 2, top, plane_z)], [(3, 2, 1, 0)])
    uv = me.uv_layers.new(name="UVMap")
    # seen from below (-z), +x is on the left... the panel faces the keyboard,
    # so with the lid open the viewer's right is +x
    for loop in me.loops:
        co = me.vertices[loop.vertex_index].co / MM
        uv.data[loop.index].uv = ((co.x + sw / 2) / sw, 1 - (co.y - top) / sh)
    screen = new_object("screen", me, lid)
    screen.data.materials.append(m["screen"])
    screen["size_cm"] = (sw / 10, sh / 10)

    # webcam, IR camera and sensor behind the glass
    for x, r in ((-24.4, 2.4), (-4.0, 2.4), (4.4, 0.7)):
        cam = new_object("lens", revolve([(r, z - 0.03), (0, z - 0.03)], (x, far_edge + 7.2), "lens", 32), lid)
        cam.data.materials.append(m["lens"])
    return lid


def build_hinges(root, base, lid, m):
    """Block on two axes. The lid turns on the upper axis alone up to 180; from
    there the block itself swings on the lower one, carrying the lid under."""
    d2 = L.DEPTH / 2
    for sx in (-1, 1):
        # 18.7 tall like the closed machine, in block space with the lower axis at 0
        pts = [(y, z + (L.BASE_H + L.LID_H + L.GAP) / 2 - AXIS_Z) for y, z in ports.rrect(9.0, 18.7, 1.6)]
        link = new_object("hinge link", extrude_x(pts, L.HINGE_W / 2, "hinge"), root)
        link.location = (sx * L.HINGE_X * MM, AXIS_Y * MM, AXIS_Z * MM)
        link.data.materials.append(m["hinge"])
        finish(link, bevel=0.3, segments=3)
        drive(link, "rotation_euler", 0, "-radians(max(h - 180, 0))")

        # a single cross-head screw, centred across the block, level with the lid
        z = 12.3 - AXIS_Z
        screw = revolve([(2.5, 0), (2.5, 0.2), (2.2, 0.36), (1.4, 0.46), (0, 0.46)], (0, 0), "screw", 48)
        s = new_object("hinge screw", screw, link)
        s.rotation_euler = (math.radians(-90), 0, 0)
        s.location = (0, 4.5 * MM, z * MM)
        s.data.materials.append(m["port metal"])
        s.data.shade_smooth()
        for w, d in ((3.0, 0.55), (0.55, 3.0)):
            cross = new_object("hinge screw cross", box(0, 4.97, z, w, 0.06, d, "cross"), link)
            cross.data.materials.append(m["port black"])
        tab = new_object("hinge tab", box(0, 4.6, -3.7, 9, 0.5, 3.6, "hinge tab"), link)
        tab.data.materials.append(m["tab"])
        finish(tab, bevel=0.15, segments=2)

        # the arms that run from the block into the base and into the lid
        arm = new_object("hinge arm", box(sx * L.HINGE_X, d2 - 9.5, AXIS_Z, L.HINGE_W - 3, 11, 5.0, "arm"), base)
        arm.data.materials.append(m["hinge"])
        finish(arm, bevel=0.5, segments=3)
        arm = new_object("hinge arm", box(sx * L.HINGE_X, -5.0, 0, L.HINGE_W - 3, 11, 4.4, "arm"), lid)
        arm.data.materials.append(m["hinge"])
        finish(arm, bevel=0.5, segments=3)


def drive(ob, path, index, expr):
    fc = ob.driver_add(path, index)
    fc.driver.type = "SCRIPTED"
    var = fc.driver.variables.new()
    var.name = "h"
    var.targets[0].id = bpy.data.objects["laptop"]
    var.targets[0].data_path = '["hinge_deg"]'
    fc.driver.expression = expr


# ---- studio ---------------------------------------------------------------

def set_hinge(deg):
    bpy.data.objects["laptop"]["hinge_deg"] = float(deg)
    bpy.data.objects["laptop"].update_tag()
    bpy.context.view_layer.update()


def studio():
    scene = bpy.context.scene
    world = bpy.data.worlds.new("studio")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.82, 0.83, 0.85, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.22
    scene.world = world

    mat, _ = principled("sweep", FINISH["sweep"], roughness=0.55)
    floor = new_object("sweep", mesh_from("sweep", [(-3000, -3000, -3), (3000, -3000, -3), (3000, 3000, -3),
                                                    (-3000, 3000, -3)], [(0, 1, 2, 3)]))
    floor.data.materials.append(mat)

    def softbox(name, loc, size, power, color=(1, 1, 1)):
        li = bpy.data.lights.new(name, "AREA")
        li.shape = "RECTANGLE"
        li.size, li.size_y = size
        li.energy = power
        li.color = color
        ob = new_object(name, li)
        ob.location = loc
        ob.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

    softbox("key", (-0.5, 0.15, 0.8), (0.8, 0.5), 20)
    softbox("rim", (0.6, 0.7, 0.45), (1.0, 0.25), 22, (0.9, 0.95, 1))
    softbox("fill", (0.7, -0.5, 0.3), (0.5, 0.5), 7)

    cam_data = bpy.data.cameras.new("cam")
    cam = new_object("cam", cam_data)
    scene.camera = cam

    scene.render.engine = "CYCLES"
    scene.cycles.samples = SPP
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 2560, 1600
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "OPTIX"
    prefs.get_devices()
    for dev in prefs.devices:
        dev.use = dev.type == "OPTIX"
    scene.cycles.device = "GPU"
    return cam


VIEWS = {
    #         hinge, lens, camera (m),            target (m)
    "hero":   (118, 58, (-0.40, -0.72, 0.34), (0.0, 0.03, 0.075)),
    "lid":    (0, 70, (0.0, -0.05, 0.86), (0.0, 0.0, 0.0)),
    "keys":   (135, 75, (0.0, -0.08, 0.62), (0.0, -0.03, 0.0)),
    "pad":    (120, 100, (-0.1, -0.33, 0.2), (-0.018, -0.056, 0.01)),
    "rear":   (112, 60, (0.42, 0.62, 0.24), (0.0, 0.03, 0.06)),
    "tablet": (360, 70, (0.28, -0.5, 0.48), (0.0, 0.0, 0.0)),
    "left":   (0, 110, (-0.95, 0.0, 0.012), (0.0, 0.0, 0.012)),
    "right":  (0, 110, (0.95, 0.0, 0.012), (0.0, 0.0, 0.012)),
    "ports":  (112, 150, (-0.5, -0.05, 0.06), (-0.13, 0.03, 0.006)),
    "portsr": (112, 150, (0.5, 0.05, 0.06), (0.13, 0.03, 0.006)),
    "enter":  (135, 120, (0.1, -0.06, 0.42), (0.1, 0.03, 0.01)),
    "hinge":  (110, 150, (-0.18, 0.5, 0.08), (-0.104, 0.1, 0.012)),
    "bottom": (0, 70, (0.0, 0.05, 0.86), (0.0, 0.0, 0.0)),
    "back":   (0, 110, (0.0, 0.95, 0.012), (0.0, 0.0, 0.012)),
    "flat":   (180, 60, (0.0, -0.45, 0.62), (0.0, 0.06, 0.0)),
    "fold":   (285, 65, (0.5, -0.45, 0.32), (0.0, 0.02, 0.0)),
}


def render(cam, name):
    deg, lens, pos, target = VIEWS[name]
    set_hinge(deg)
    root = bpy.data.objects["laptop"]
    root.rotation_euler = (0, 0, math.radians(180) if name == "lid" else 0)
    if name == "bottom":
        root.rotation_euler = (math.radians(180), 0, 0)
    # stands on its feet; folded into a tablet the lid is underneath
    root.location = (0, 0, 0.0195 if name == "bottom" else 0.09 if 200 < deg < 300 else 0.009 if deg > 300 else 0.0009)
    cam.data.lens = lens
    cam.location = pos
    cam.rotation_euler = (Vector(target) - Vector(pos)).to_track_quat("-Z", "Y").to_euler()
    out = os.path.join(HERE, "renders", name + ".png")
    bpy.context.scene.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print("rendered", out)


# ---- go -------------------------------------------------------------------

bpy.ops.wm.read_factory_settings(use_empty=True)
materials = build_materials()

root = empty("laptop")
root["hinge_deg"] = 118.0
ui = root.id_properties_ui("hinge_deg")
ui.update(min=0.0, max=360.0, soft_min=0.0, soft_max=360.0, step=100, description="0 closed, 180 flat, 360 tablet")

base = build_base(root, materials)
lid_pivot = empty("lidPivot", root)
drive(lid_pivot, "location", 1, f"{AXIS_Y * MM} + {LINK * MM} * sin(radians(max(h - 180, 0)))")
drive(lid_pivot, "location", 2, f"{AXIS_Z * MM} + {LINK * MM} * cos(radians(max(h - 180, 0)))")
drive(lid_pivot, "rotation_euler", 0, "-radians(h)")
lid = build_lid(lid_pivot, materials)
build_hinges(root, base, lid, materials)

camera = studio()
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "cf-qv9.blend"))
print("saved", os.path.join(HERE, "cf-qv9.blend"))

for view in RENDERS:
    render(camera, view)
