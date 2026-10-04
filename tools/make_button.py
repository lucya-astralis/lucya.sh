"""Generates the animated 88x31 lucya.sh button from the real logo SVG.

Usage (from the repo root):
    python tools/make_button.py            # writes images/88x31 buttons/lucya.gif
    python tools/make_button.py --preview  # also writes a 4x frame strip to preview.png

Needs Pillow and numpy.
"""
import math, random, re, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H, SS = 88, 31, 8
FRAMES, DELAY = 120, 50  # 6 s loop @ 20 fps
ROOT = Path(__file__).resolve().parent.parent
SVG = ROOT / "images/logo/lucya_logo_text.svg"
OUT = ROOT / "images/88x31 buttons/lucya.gif"

# ---------------------------------------------------------------- palette
BG    = np.array([7, 7, 11], float)
BG2   = np.array([14, 15, 26], float)
CY    = np.array([91, 138, 255], float)
MAG   = np.array([165, 148, 255], float)
TEXT  = np.array([238, 240, 255], float)
DIM   = np.array([158, 160, 188], float)
GHOST = np.array([52, 54, 78], float)
OK    = np.array([61, 255, 165], float)

def grad(x):  # x in 0..1 → blue → violet
    x = np.clip(x, 0, 1)[..., None]
    return CY * (1 - x) + MAG * x

# ---------------------------------------------------------------- svg parse
src = open(SVG, encoding="utf-8").read()

def parse_path(d):
    toks = re.findall(r"[MLCZHVmlczhv]|-?\d*\.?\d+(?:e-?\d+)?", d)
    polys, cur, pt, cmd, i = [], [], (0, 0), None, 0
    num = lambda: float(toks[i])
    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            cmd = t; i += 1
            if cmd in "Zz":
                if cur: polys.append(cur); cur = []
            continue
        if cmd == "M":
            pt = (float(toks[i]), float(toks[i+1])); i += 2; cur = [pt]; cmd = "L"
        elif cmd == "L":
            pt = (float(toks[i]), float(toks[i+1])); i += 2; cur.append(pt)
        elif cmd == "H":
            pt = (float(toks[i]), pt[1]); i += 1; cur.append(pt)
        elif cmd == "V":
            pt = (pt[0], float(toks[i])); i += 1; cur.append(pt)
        elif cmd == "C":
            p1 = (float(toks[i]), float(toks[i+1])); p2 = (float(toks[i+2]), float(toks[i+3]))
            p3 = (float(toks[i+4]), float(toks[i+5])); i += 6
            for k in range(1, 13):
                u = k / 12; v = 1 - u
                cur.append((v**3*pt[0] + 3*v*v*u*p1[0] + 3*v*u*u*p2[0] + u**3*p3[0],
                            v**3*pt[1] + 3*v*v*u*p1[1] + 3*v*u*u*p2[1] + u**3*p3[1]))
            pt = p3
        else:
            raise ValueError(cmd)
    if cur: polys.append(cur)
    return polys

pieces = []  # (kind, polygon list in svg-root coords)
for m in re.finditer(r'<g([^>]*)>(.*?)</g>', src, re.S):
    attrs, body = m.groups()
    a, b, c, d, e, f = map(float, re.search(r"matrix\(([^)]*)\)", attrs).group(1).split(","))
    gid = re.search(r'id="([^"]+)"', attrs)
    for d_ in re.findall(r'd="([^"]+)"', body):
        polys = [[(a*x + c*y + e, b*x + d*y + f) for x, y in p] for p in parse_path(d_)]
        pieces.append(("bird" if gid else "text", gid.group(1) if gid else None, polys))

VBW, VBH = 5730, 805
LOGO_W = 72
s = LOGO_W / VBW
OX, OY = (W - LOGO_W) / 2, 5.5
BIRD_C = (482 * 1.4825, 250 * 1.4825)

def centroid(polys):
    pts = [p for poly in polys for p in poly]
    return sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)

# ---------------------------------------------------------------- pixel font 3x5
FONT = {
 "A":"010101111101101","C":"011100100100011","H":"101101111101101","I":"111010010010111",
 "K":"101101110101101","L":"100100100100111","O":"010101101101010","P":"110101110100100",
 "S":"011100010001110","T":"111010010010010","U":"101101101101111","V":"101101101101010",
 "Y":"101101010010010",".":"000000000000010",":":"000010000010000","/":"001001010100100",
 " ":"000000000000000","$":"011110111011110","N":"110101101101101","G":"011100101101011",
 "B":"110101110101110","E":"111100110100111","M":"101111111101101","=":"000111000111000",
 "0":"111101101101111","1":"010110010010111","2":"110001010100111","3":"110001010001110",
 "4":"101101111001001","5":"111100110001110","6":"011100110101010","7":"111001010010010",
 "8":"010101010101010","9":"010101011001110",
}

def draw_text(img, s_, x, y, col, alpha=1.0):
    for ch in s_:
        g = FONT[ch]
        for r in range(5):
            for c in range(3):
                if g[r*3 + c] == "1" and 0 <= x+c < W:
                    img[y+r, x+c] = img[y+r, x+c] * (1 - alpha) + col * alpha
        x += 4

# ---------------------------------------------------------------- helpers
ease_out = lambda t: 1 - (1 - min(max(t, 0), 1)) ** 3
ease_in  = lambda t: min(max(t, 0), 1) ** 3

def render_mask(polys, dx, dy):
    im = Image.new("L", (W*SS, H*SS), 0)
    dr = ImageDraw.Draw(im)
    for poly in polys:
        dr.polygon([((OX + x*s + dx) * SS, (OY + y*s + dy) * SS) for x, y in poly], fill=255)
    a = np.asarray(im, float).reshape(H, SS, W, SS).mean(axis=(1, 3)) / 255
    return a

rng = random.Random(7)
stars = [(rng.randrange(2, W-2), rng.randrange(2, H-2), rng.random()*6.28, 0.4 + rng.random()*0.6)
         for _ in range(16)]

# perimeter path for the running border light
perim = [(x, 0) for x in range(W)] + [(W-1, y) for y in range(1, H)] + \
        [(x, H-1) for x in range(W-2, -1, -1)] + [(0, y) for y in range(H-2, 0, -1)]

MSGS = [(14, 46, 90, 99, "HTTPS://LUCYA.SH")]

xs = np.arange(W)[None, :].repeat(H, 0)
ys = np.arange(H)[:, None].repeat(W, 1)

frames = []
for f in range(FRAMES):
    # background: vertical gradient + scanlines + stars
    t = (ys / (H-1))[..., None]
    img = BG * (1 - t) + BG2 * t
    img[::2] *= 0.82
    for (sx, sy, ph, br) in stars:
        k = (0.5 + 0.5 * math.sin(f / FRAMES * 2 * math.pi * 3 + ph)) ** 3 * br
        img[sy, sx] = img[sy, sx] * (1 - k) + np.array([190, 200, 255]) * k

    # logo pieces: assemble in (f0-14), fly out at the end (f110-119)
    mask = np.zeros((H, W))
    for idx, (kind, gid, polys) in enumerate(pieces):
        cx, cy = centroid(polys)
        if kind == "bird":
            vx, vy = cx - BIRD_C[0], cy - BIRD_C[1]
            n = math.hypot(vx, vy) or 1
            vx, vy = vx / n * 9, vy / n * 9
            delay = idx * 0.8
        else:
            vx, vy = 0, -8
            delay = 4 + (idx - 8) * 1.5
        pin  = ease_out((f - delay) / 8)
        pout = ease_in((f - 110 - (idx % 5) * 0.6) / 7)
        off  = (1 - pin) + pout
        alpha = pin * (1 - pout)
        if alpha <= 0.001:
            continue
        mask = np.maximum(mask, render_mask(polys, vx * off, vy * off) * alpha)

    # glow + logo fill (pastel gradient) + shimmer sweep
    glow = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(1.6)), float) / 255
    pulse = 0.75 + 0.25 * math.sin(f / FRAMES * 2 * math.pi * 2)
    gcol = grad(xs / W)
    img = img + gcol * (glow * 1.1 * pulse)[..., None]
    base = TEXT * 0.55 + gcol * 0.45
    band = np.exp(-(((xs + ys * 0.6) - (-20 + (f - 44) * 6)) / 3.0) ** 2) if 44 <= f <= 66 else 0 * xs
    fill = base * (1 - band[..., None]) + np.array([255, 255, 255]) * band[..., None]
    img = img * (1 - mask[..., None]) + fill * mask[..., None]

    # divider
    for x in range(6, W-6):
        k = 1 - abs((x - W/2) / (W/2 - 6))
        img[18, x] = img[18, x] * (1 - k*0.6) + GHOST * (k*0.6)

    # terminal line: type → hold → erase
    for (t0, t1, t2, t3, msg) in MSGS:
        if t0 <= f < t3:
            if f < t1:   n = int((f - t0) / (t1 - t0) * len(msg)) + 1
            elif f < t2: n = len(msg)
            else:        n = max(0, len(msg) - int((f - t2) / (t3 - t2) * len(msg) * 1.2))
            txt = msg[:n]
            x0 = (W - (len(msg) * 4 - 1)) // 2
            draw_text(img, txt, x0, 21, DIM)
            cx = x0 + len(txt) * 4
            if (f // 4) % 2 == 0 or f < t1 or f >= t2:
                if cx + 2 < W - 2:
                    img[21:26, cx:cx+3] = CY
    # status dot
    k = 0.5 + 0.5 * math.sin(f / FRAMES * 2 * math.pi * 4)
    img[3:5, W-5:W-3] = OK * (0.4 + 0.6 * k)

    # border: dim frame + running gradient comet
    for (x, y) in perim:
        img[y, x] = GHOST
    head = int(f / FRAMES * len(perim) * 2) % len(perim)
    for i in range(34):
        x, y = perim[(head - i) % len(perim)]
        k = (1 - i / 34) ** 1.5
        img[y, x] = GHOST * (1 - k) + grad(np.array(i / 34)) * k + (60 if i < 2 else 0)
    # corner ticks
    for (x, y) in [(1, 1), (W-2, 1), (1, H-2), (W-2, H-2)]:
        img[y, x] = DIM

    # glitch burst before fly-out
    if f in (100, 101, 104, 105, 106):
        r = random.Random(f)
        out = img.copy()
        for _ in range(4):
            y0 = r.randrange(0, H - 3); h = r.randrange(1, 5); d = r.choice([-3, -2, 2, 3])
            out[y0:y0+h] = np.roll(img[y0:y0+h], d, axis=1)
        out[..., 0] = np.roll(out[..., 0], 1, axis=1)
        out[..., 2] = np.roll(out[..., 2], -1, axis=1)
        img = out

    frames.append(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGB"))

# shared palette across all frames
sheet = Image.new("RGB", (W, H * FRAMES))
for i, fr in enumerate(frames):
    sheet.paste(fr, (0, i * H))
pal = sheet.quantize(colors=255, method=Image.Quantize.MEDIANCUT)
q = [fr.quantize(palette=pal, dither=Image.Dither.NONE) for fr in frames]
q[0].save(OUT, save_all=True, append_images=q[1:], duration=DELAY, loop=0, optimize=True, disposal=1)

# preview strip (4x) for checking
if "--preview" in sys.argv:
    strip = Image.new("RGB", (W * 4 * 4, H * 4 * 3))
    for i, fi in enumerate([8, 16, 30, 50, 56, 75, 88, 96, 101, 105, 112, 119]):
        strip.paste(frames[fi].resize((W*4, H*4), Image.NEAREST), ((i % 4) * W * 4, (i // 4) * H * 4))
    strip.save("preview.png")
print(f"wrote {OUT}")
