"""Writes the model for the web: intro/laptop/cf-qv9/ as .gltf + .bin + textures.

  blender --background tools/laptop/cf-qv9.blend --python tools/laptop/export_gltf.py

Separate files, not a .glb: GLTFLoader unpacks embedded images through blob:
URLs, which the site's CSP refuses. Procedural nodes do not survive glTF, so
shells get flattened textures (make_decals.py) and a tiling grain normal map.
"""
import json
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import layout as L  # noqa: E402

OUT = os.path.join(HERE, "..", "..", "intro", "laptop", "cf-qv9")
MM = 0.001
LINK = (L.BASE_H + L.GAP + L.LID_H) / 2
AXIS_INSET = LINK / 2 - 0.1
GRAIN_TILE = 0.024  # metres per repeat of the grain map

for ob in list(bpy.data.objects):
    if ob.type in ("LIGHT", "CAMERA") or ob.name == "sweep":
        bpy.data.objects.remove(ob)

root = bpy.data.objects["laptop"]
root["hinge_deg"] = 0.0
# Laptop.setHinge() takes these: lower axis y, z and the link to the upper axis
root["hinge"] = [L.BASE_H / 2 * MM, -(L.DEPTH / 2 - AXIS_INSET) * MM, LINK * MM]

hinge_links = [ob for ob in bpy.data.objects if ob.name.startswith("hinge link")]
for ob, name in zip(sorted(hinge_links, key=lambda o: o.location.x), ("hingeLinkL", "hingeLinkR")):
    ob.animation_data_clear()
    ob.rotation_euler = (0, 0, 0)
    ob.name = name
bpy.data.objects["lidPivot"].animation_data_clear()
bpy.data.objects["lidPivot"].rotation_euler = (0, 0, 0)   # closed; Laptop.setHinge() drives it


def project(ob, u, v):
    me = ob.data
    uv = me.uv_layers.new(name="UVMap")
    for loop in me.loops:
        co = me.vertices[loop.vertex_index].co
        uv.data[loop.index].uv = (u(co), v(co))


W, D = L.WIDTH * MM, L.DEPTH * MM
deck_u, deck_v = (lambda c: c.x / W + 0.5), (lambda c: c.y / D + 0.5)
project(bpy.data.objects["base"], deck_u, deck_v)
project(bpy.data.objects["keys"], deck_u, deck_v)
e = AXIS_INSET * MM
project(bpy.data.objects["lid"], lambda c: -c.x / W + 0.5, lambda c: (e - c.y) / D)

# strip every material down to what its Principled node holds as plain values
for mat in bpy.data.materials:
    if mat.name == "intel sticker" or mat.name.startswith("side print"):   # plain images on UVs
        continue
    nodes = mat.node_tree.nodes
    bsdf = nodes["Principled BSDF"]
    out = nodes.get("Material Output")
    for node in list(nodes):
        if node != bsdf and node != out:
            nodes.remove(node)


def texture(mat, name, normal_strength):
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(os.path.join(HERE, name))
    links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    grain = nodes.new("ShaderNodeTexImage")
    grain.image = bpy.data.images.load(os.path.join(HERE, "tex_grain_normal.png"), check_existing=True)
    grain.image.colorspace_settings.name = "Non-Color"
    coord = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (W / GRAIN_TILE, D / GRAIN_TILE, 1)
    links.new(coord.outputs["UV"], mapping.inputs["Vector"])
    links.new(mapping.outputs[0], grain.inputs["Vector"])
    normal = nodes.new("ShaderNodeNormalMap")
    normal.inputs["Strength"].default_value = normal_strength
    links.new(grain.outputs["Color"], normal.inputs["Color"])
    links.new(normal.outputs[0], bsdf.inputs["Normal"])


# ACES burns anything brighter to white in the browser
bpy.data.materials["led"].node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 1

texture(bpy.data.materials["magnesium paint"], "tex_deck.png", 1.0)
texture(bpy.data.materials["magnesium paint lid"], "tex_lid.png", 1.0)
texture(bpy.data.materials["key cap"], "tex_keys.png", 0.3)

bpy.context.view_layer.update()
os.makedirs(OUT, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT, "cf-qv9.gltf"),
    export_format="GLTF_SEPARATE",
    export_image_format="WEBP",
    export_yup=True,
    export_apply=True,
    export_extras=True,
    export_animations=False,
    export_cameras=False,
    export_lights=False,
)
# the exporter ignores the Alpha link on these
path = os.path.join(OUT, "cf-qv9.gltf")
with open(path, encoding="utf8") as f:
    gltf = json.load(f)
for mat in gltf["materials"]:
    if mat["name"].startswith("side print"):
        mat["alphaMode"] = "BLEND"
with open(path, "w", encoding="utf8") as f:
    json.dump(gltf, f, separators=(",", ":"))

print("exported", os.path.abspath(OUT))
