"""Puts a rebuilt lid on the web model without a Blender export.

  python tools/laptop/make_decals.py
  python tools/laptop/publish_lid.py

Writes tex_lid and tex_lid_mr as .webp into intro/laptop/cf-qv9/ and stamps their URLs in the
.gltf with a hash of the new files, so a browser holding the old lid fetches the new one.
Then bump ?v= on MODEL_URL in intro/laptop/GltfLaptop.js, and the versions up its chain
(intro.js, loader.js, index.html): the .gltf itself is cached under its own URL.
"""
import hashlib
import json
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
OUT = HERE.parent.parent / "intro" / "laptop" / "cf-qv9"

for name, quality in (("tex_lid", 80), ("tex_lid_mr", 90)):
    Image.open(HERE / f"{name}.png").convert("RGB").save(OUT / f"{name}.webp", "WEBP", quality=quality, method=6)

path = OUT / "cf-qv9.gltf"
gltf = json.loads(path.read_text("utf8"))
for image in gltf["images"]:
    name = image["uri"].split("?")[0]
    if name.startswith("tex_lid"):
        image["uri"] = f"{name}?v={hashlib.md5((OUT / name).read_bytes()).hexdigest()[:8]}"
        print(image["uri"])
path.write_text(json.dumps(gltf, separators=(",", ":")), "utf8")
