"""Generates square favicons (dark tile + white logo) from the real logo SVG.

Google Search needs a square icon (multiple of 48px) and shows it on a white
circle, so the plain white-on-transparent logo is unusable there.

Usage (from the repo root):
    python tools/make_favicons.py

Writes favicon.ico (root), images/logo/favicon.svg and favicon-*.png / apple-touch-icon.png.
Needs Pillow.
"""
import re
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SVG = ROOT / "images/logo/lucya_logo.svg"
OUT = ROOT / "images/logo"
BG = "#0d1117"
FG = "#ffffff"
FILL = 0.74  # logo width relative to tile; stays inside Google's circle crop
SS = 8

src = SVG.read_text(encoding="utf-8")
vw, vh = map(float, re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', src).groups())
paths = re.findall(r'<path[^>]*\sd="([^"]+)"', src)

def polys(d):  # logo uses only M/L/Z
    out = []
    for seg in re.findall(r"M[^M]*", d):
        nums = list(map(float, re.findall(r"-?\d*\.?\d+", seg)))
        out.append(list(zip(nums[::2], nums[1::2])))
    return out

shapes = [p for d in paths for p in polys(d)]

def render(size):
    n = size * SS
    img = Image.new("RGB", (n, n), BG)
    dr = ImageDraw.Draw(img)
    s = n * FILL / vw
    ox, oy = (n - vw * s) / 2, (n - vh * s) / 2
    for poly in shapes:
        dr.polygon([(ox + x * s, oy + y * s) for x, y in poly], fill=FG)
    return img.resize((size, size), Image.LANCZOS)

for size in (48, 96, 192, 512):
    render(size).save(OUT / f"favicon-{size}.png", optimize=True)
render(180).save(OUT / "apple-touch-icon.png", optimize=True)
render(256).save(ROOT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

# square SVG variant: same paths, padded viewBox, background tile
side = vw / FILL
pad_x, pad_y = (side - vw) / 2, (side - vh) / 2
body = "\n".join(f'  <path d="{d}" fill="{FG}"/>' for d in paths)
(OUT / "favicon.svg").write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {side:.0f} {side:.0f}">\n'
    f'  <rect width="100%" height="100%" fill="{BG}"/>\n'
    f'  <g transform="translate({pad_x:.1f} {pad_y:.1f})">\n{body}\n  </g>\n</svg>\n',
    encoding="utf-8")
print("ok")
