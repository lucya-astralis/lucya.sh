"""Cuts the lid stickers out of their photo backgrounds, with a die-cut white edge.

  python tools/laptop/cut_stickers.py <folder with the source images>

Writes stickers/*.png. Only needed when the source images change.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).parent / "stickers"
OUT.mkdir(exist_ok=True)

# source, output, flood-fill tolerance (0 = already cut out), white edge in px of 1000
SOURCES = [
    ("42-31-202_europaeische_unio-1-png.png", "eu", 0, 0),
    ("PrideFlagsPNG-01_2048x.png", "pride", 0, 0),
    ("intel.png", "potato", 0, 0),
    ("ESAxPokemonMissionSticker.webp", "esa", 70, 0),
    ("evangelion-rei-ayanami-outdoor-sticker-851695.1.webp", "rei", 45, 14),
    ("frieren_sticker_17_ijunk30_com_by_ijungakrom_dgz9udv-fullview.jpg", "frieren", 30, 16),
    ("st,small,507x507-pad,600x600,f8f8f8.jpg", "japan", 7, 0),
    ("st,small,507x507-pad,600x600,f8f8f8.u1.jpg", "jaxa", 7, 0),
    ("kuromi.png", "kuromi", "ring", 0),
    ("arasaka.jpg", "arasaka", "tag", 0),
]


def cut_ring(img):
    """For a sticker with a white edge on a grey ground with a drop shadow: everything
    not white, reached from the border, is background. The white edge stops the fill."""
    rgb = np.asarray(img.convert("RGB"), dtype=np.int16)
    open_ = rgb.min(axis=2) < 238
    seen = np.zeros(open_.shape, bool)
    seen[0, :] = seen[-1, :] = seen[:, 0] = seen[:, -1] = True
    seen &= open_
    while True:
        grown = seen.copy()
        grown[1:, :] |= seen[:-1, :]
        grown[:-1, :] |= seen[1:, :]
        grown[:, 1:] |= seen[:, :-1]
        grown[:, :-1] |= seen[:, 1:]
        grown &= open_
        if (grown == seen).all():
            break
        seen = grown
    alpha = Image.fromarray(np.where(seen, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))
    out = img.convert("RGBA")
    out.putalpha(alpha.filter(ImageFilter.GaussianBlur(0.8)))
    return out


def cut_tag(img, margin=13, radius=30):
    """For a white-edged label on white: the outline comes from the dark print inside it."""
    rgb = np.asarray(img.convert("L"))
    ys, xs = np.nonzero(rgb < 90)
    box = (xs.min() - margin, ys.min() - margin, xs.max() + margin, ys.max() + margin)
    scale = 4
    mask = Image.new("L", (img.width * scale, img.height * scale), 0)
    ImageDraw.Draw(mask).rounded_rectangle([v * scale for v in box], radius * scale, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask.resize(img.size, Image.LANCZOS))
    return out


def cut(img, tolerance, edge):
    """Flood-fills the background in from the border, so white inside the art stays."""
    scale = 2
    rgb = img.convert("RGB").resize((img.width * scale, img.height * scale), Image.LANCZOS)
    w, h = rgb.size
    marker = (255, 0, 254)
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)):
        if rgb.getpixel((x, y)) != marker:
            ImageDraw.floodfill(rgb, (x, y), marker, thresh=tolerance)
    px = rgb.load()
    alpha = Image.new("L", (w, h), 255)
    ap = alpha.load()
    for yy in range(h):
        for xx in range(w):
            if px[xx, yy] == marker:
                ap[xx, yy] = 0
    # keep only clean pixels: pull the edge in a touch to drop the JPEG halo
    alpha = alpha.filter(ImageFilter.MinFilter(5))
    source = img.convert("RGB").resize((w, h), Image.LANCZOS)
    if edge:
        radius = max(3, int(edge * max(w, h) / 1000) | 1)
        grown = alpha.filter(ImageFilter.MaxFilter(min(radius, 31)))
        for _ in range(radius // 31):
            grown = grown.filter(ImageFilter.MaxFilter(31))
        grown = grown.filter(ImageFilter.GaussianBlur(2)).point(lambda v: 255 if v > 127 else 0)
        white = Image.new("RGB", (w, h), (252, 252, 252))
        white.paste(source, (0, 0), alpha)
        source, alpha = white, grown
    alpha = alpha.filter(ImageFilter.GaussianBlur(1.2))
    out = source.convert("RGBA")
    out.putalpha(alpha)
    return out.resize((img.width, img.height), Image.LANCZOS)


src = Path(sys.argv[1])
for name, out, tolerance, edge in SOURCES:
    if not (src / name).exists():
        continue
    img = Image.open(src / name)
    if tolerance == "ring":
        result = cut_ring(img)
    elif tolerance == "tag":
        result = cut_tag(img)
    else:
        result = cut(img, tolerance, edge) if tolerance else img.convert("RGBA")
    result = result.crop(result.getchannel("A").getbbox())
    result.thumbnail((1200, 1200), Image.LANCZOS)
    result.save(OUT / f"{out}.png")
    print(out, result.size)
