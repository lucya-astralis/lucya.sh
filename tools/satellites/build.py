"""Render the hero's satellites and write them for the page.

    python tools/satellites/build.py              # Blender in the background, then the WebPs
    python tools/satellites/build.py --skip-render # only crop and convert renders/*.png
    python tools/satellites/build.py --draft       # half size, few samples

The scene is tools/satellites/scene.py; it also runs in an open Blender (see its
docstring). Writes concept/sat-relay.webp and concept/sat-observer.webp, cropped to the
satellite and scaled for 2x screens at the largest size concept.css shows them, the
matching sat-*-glint.webp (the cells' sun glint as light, for the sweep in concept.css),
and renders/preview.png: each satellite, then with its glint, on black. Blender is looked for in BLENDER, then on
PATH, then in the default install.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
RENDERS = HERE / "renders"
# name -> width in px of the WebP: twice the widest the hero draws it
WIDTHS = {"relay": 760, "observer": 560}
BLOOM = 0.9   # how far the glint spills past the cells


def blender() -> str:
    for cand in (os.environ.get("BLENDER"), shutil.which("blender"),
                 r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"):
        if cand and Path(cand).exists():
            return cand
    raise SystemExit("Blender not found: set BLENDER to blender.exe")


def box(img: Image.Image, pad: float = 0.015) -> tuple[int, int, int, int]:
    """The satellite and nothing else, with a hair of room for the glow."""
    alpha = img.getchannel("A").point(lambda a: 255 if a > 3 else 0)
    x0, y0, x1, y1 = alpha.getbbox()
    p = round(max(x1 - x0, y1 - y0) * pad)
    return max(0, x0 - p), max(0, y0 - p), min(img.width, x1 + p), min(img.height, y1 + p)


def scaled(img: Image.Image, width: int) -> Image.Image:
    # premultiplied while scaling, or the dark fringe of the transparent pixels bleeds in
    h = round(img.height * width / img.width)
    return img.convert("RGBa").resize((width, h), Image.LANCZOS).convert("RGBA")


def light(img: Image.Image) -> Image.Image:
    """The glint pass as light: how bright a pixel is becomes how much it covers, so laid
    over the satellite it brightens the cells and never darkens them."""
    px = np.asarray(img, dtype=np.float32) / 255
    rgb = px[..., :3] * px[..., 3:]                 # what the pass adds, on black
    # a flash that bright blooms past the panels' edges, as it would in any camera
    lit = Image.fromarray(np.round(rgb * 255).astype(np.uint8), "RGB")
    halo = np.asarray(lit.filter(ImageFilter.GaussianBlur(img.width * 0.012)), dtype=np.float32) / 255
    rgb = np.clip(rgb + halo * BLOOM, 0, 1)
    peak = rgb.max(axis=2, keepdims=True)
    hue = np.divide(rgb, peak, out=np.zeros_like(rgb), where=peak > 0)   # its colour at full strength
    out = np.concatenate([hue, peak ** 1.15], axis=2)
    return Image.fromarray(np.round(out * 255).astype(np.uint8), "RGBA")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-render", action="store_true")
    ap.add_argument("--draft", action="store_true")
    a = ap.parse_args()
    if not a.skip_render:
        cmd = [blender(), "-b", "--factory-startup", "-P", str(HERE / "scene.py"), "--",
               "--out", str(RENDERS), "--samples", "48" if a.draft else "384",
               "--scale", "0.5" if a.draft else "1"]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)

    shots = []
    for name, width in WIDTHS.items():
        base = Image.open(RENDERS / f"{name}.png").convert("RGBA")
        b = box(base)
        img = scaled(base.crop(b), width)
        # the glint pass shares the camera, so the same box lays it exactly over the cells
        glint = light(scaled(Image.open(RENDERS / f"{name}_glint.png").convert("RGBA").crop(b), width))
        for suffix, im, q in (("", img, 90), ("-glint", glint, 82)):
            out = REPO / "concept" / f"sat-{name}{suffix}.webp"
            im.save(out, "WEBP", quality=q, alpha_quality=100, method=6)
            print(f"{out.relative_to(REPO)}  {im.width}x{im.height}  {out.stat().st_size // 1024} KB")
        shots.append(img)
        lit = img.copy()
        lit.alpha_composite(glint)
        shots.append(lit)

    sheet = Image.new("RGBA", (sum(i.width for i in shots) + 60, max(i.height for i in shots) + 40), (3, 5, 10, 255))
    x = 20
    for img in shots:
        sheet.alpha_composite(img, (x, 20))
        x += img.width + 20
    sheet.convert("RGB").save(RENDERS / "preview.png")


if __name__ == "__main__":
    main()
