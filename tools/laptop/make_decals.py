"""Writes the printed marks as masks (red = ink, green = black print) and the
flattened textures the web export uses, as procedural nodes do not survive glTF.

Run with system Python (needs Pillow): python tools/laptop/make_decals.py
"""
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

import layout as L
import legends

HERE = Path(__file__).parent
PX = 20  # per mm
FONTS = Path("C:/Windows/Fonts")


def font(name, mm):
    return ImageFont.truetype(str(FONTS / name), int(mm * PX))


def logo(img, name, width_mm, center):
    """Stamps a mask from logos/ into the red channel, centred on `center` (px)."""
    mask = Image.open(HERE / "logos" / f"{name}.mask.png").getchannel("A")
    mask = mask.crop(mask.getbbox())
    w = int(width_mm * PX)
    mask = mask.resize((w, round(mask.height * w / mask.width)), Image.LANCZOS)
    box = (round(center[0] - mask.width / 2), round(center[1] - mask.height / 2))
    img.paste((255, 0, 0), box, mask)


def deck():
    w, h = int(L.WIDTH * PX), int(L.DEPTH * PX)
    img = Image.new("RGB", (w, h), (0, 0, 0))
    d = ImageDraw.Draw(img)

    def at(x, y):
        return (x + L.WIDTH / 2) * PX, (L.DEPTH / 2 - y) * PX

    for key in L.keys():
        legends.draw(d, key, at, PX, (255, 0, 0))

    logo(img, "panasonic", 31.6, at(-111, -25))
    d.text(at(-90, -25), "CF-QV", fill=(255, 0, 0), font=font("arial.ttf", 3.0), anchor="lm")
    logo(img, "letsnote", 27.0, at(111.5, -28))

    # speaker perforation under the hinges
    for sx in (-1, 1):
        for i in range(9):
            for j in range(4):
                cx, cy = at(sx * 94 + (i - 4) * 1.5 + (j % 2) * 0.75, 89 + (j - 1.5) * 1.3)
                r = 0.42 * PX
                d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(0, 255, 0))

    # status lights at the front edge: an icon each above a dark capsule
    icons = ["bat", "A", "1", "hdd", "SD"]
    for i, name in enumerate(icons):
        x = -29.5 + i * 6.35
        cx, cy = at(x, -98.2)
        if name in ("A", "1", "SD"):
            d.rounded_rectangle((cx - 1.1 * PX, cy - 1.2 * PX, cx + 1.1 * PX, cy + 1.2 * PX), radius=int(0.3 * PX),
                                outline=(255, 0, 0), width=int(0.16 * PX))
            d.text((cx, cy), name, fill=(255, 0, 0), font=font("arialbd.ttf", 1.5), anchor="mm")
        elif name == "bat":
            d.rectangle((cx - 0.7 * PX, cy - 1.0 * PX, cx + 0.7 * PX, cy + 1.2 * PX), outline=(255, 0, 0), width=int(0.16 * PX))
            d.rectangle((cx - 0.3 * PX, cy - 1.4 * PX, cx + 0.3 * PX, cy - 1.0 * PX), fill=(255, 0, 0))
        else:
            for j in range(3):
                d.ellipse((cx - 1.1 * PX, cy + (j - 1.5) * 0.7 * PX, cx + 1.1 * PX, cy + (j - 0.5) * 0.9 * PX),
                          outline=(255, 0, 0), width=int(0.14 * PX))
        cx, cy = at(x, -101.4)
        d.rounded_rectangle((cx - 0.45 * PX, cy - 0.8 * PX, cx + 0.45 * PX, cy + 0.8 * PX), radius=int(0.4 * PX), fill=(0, 255, 0))

    img.save(HERE / "decal_deck.png")


def lid():
    w, h = int(L.WIDTH * PX), int(L.DEPTH * PX)
    img = Image.new("RGB", (w, h), (0, 0, 0))
    d = ImageDraw.Draw(img)
    # hinge at the bottom of the image, as the lid is seen closed
    logo(img, "panasonic", 45.8, (w / 2, h * 0.283))
    img.save(HERE / "decal_lid.png")


def bottom():
    """Everything printed or stuck on the underside, on transparency. Laid out from a
    photo of the machine, redrawn so its serial numbers stay out of the model."""
    W, H = 4096, 3139
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    fx, fy = W / 1600, H / 1175
    ink, grey, line = (34, 33, 31, 255), (120, 117, 110, 255), (48, 46, 43, 255)

    def p(x, y):
        return (x - 185) * fx, (y - 90) * fy

    def rect(x0, y0, x1, y1):
        return (*p(x0, y0), *p(x1, y1))

    def text(x, y, s, size, name="meiryob.ttc", fill=ink, anchor="lm"):
        d.text(p(x, y), s, fill=fill, font=ImageFont.truetype(str(FONTS / name), int(size * fy)), anchor=anchor)

    d.rounded_rectangle(rect(248, 828, 1648, 1262), radius=int(8 * fx), outline=line, width=5)        # battery
    for x0, x1, tip in ((302, 470, 1), (1430, 1595, -1)):                                             # latches
        d.rounded_rectangle(rect(x0 - 6, 836, x1 + 22 if tip > 0 else x1 + 6, 886), radius=int(8 * fx), fill=(205, 203, 198, 255))
        d.rounded_rectangle(rect(x0, 838, x1, 884), radius=int(10 * fx), fill=grey)
        for i in range(10):
            for j in range(3):
                cx, cy = p(x0 + 18 + i * 11, 850 + j * 11)
                d.ellipse((cx - 4, cy - 4, cx + 4, cy + 4), fill=(92, 90, 84, 255))
    for row in (648, 706):                                                                            # intake
        for i in range(22):
            x = 1115 + i * 16
            d.rectangle(rect(x, row, x + 6, row + 32), fill=(12, 12, 12, 255))
    for x, ys in ((1655, (370, 415, 460)), (335, (563, 620, 680))):
        for y in ys:
            d.rectangle(rect(x, y, x + 5, y + 32), fill=(12, 12, 12, 255))
            d.rectangle(rect(x + 16, y, x + 21, y + 32), fill=(12, 12, 12, 255))

    d.rounded_rectangle(rect(545, 140, 905, 183), radius=4, outline=grey, width=3)
    text(596, 161, "警告", 28)
    text(698, 152, "長時間通風孔(排気)から", 15)
    text(698, 171, "の温風にあたらない", 15)
    d.rounded_rectangle(rect(528, 212, 918, 266), radius=int(10 * fx), fill=(132, 128, 120, 255))
    mask = Image.open(HERE / "logos" / "panasonic.mask.png").getchannel("A")
    mask = mask.crop(mask.getbbox())
    w = int(143 * fx)
    mask = mask.resize((w, w * mask.height // mask.width), Image.LANCZOS)
    img.paste(ink, tuple(int(v) for v in p(535, 290)), mask)
    text(535, 340, "機器名称   CF-QV", 16)
    text(535, 355, "パーソナルコンピューター", 15)
    text(535, 376, "外部電源   DC 16 V   パナソニック株式会社   日本製", 15)
    d.rounded_rectangle(rect(533, 390, 905, 435), radius=4, outline=grey, width=3)
    text(590, 412, "警告", 28)
    text(692, 412, "● 低温やけどに注意", 22)
    for i, s in enumerate(("注意  高温の場所に長時間放置しないでください。", "変形・変色・故障することがあります",
                           "ACアダプターは指定品をご使用ください。")):
        text(535, 455 + i * 15, s, 11, fill=(70, 68, 64, 255))
    text(722, 527, "技術基準認証済みの無線装置を内蔵", 11)
    text(535, 563, "無線LANのW52(登録局との通信を除く)、W53は屋外使用禁止です。", 11)

    d.ellipse(rect(955, 510, 1015, 570), fill=(150, 148, 142, 255), outline=(96, 94, 88, 255), width=4)
    for x, y in ((263, 103), (522, 153), (985, 155), (1452, 160), (1708, 118), (235, 635), (1737, 642)):
        cx, cy = p(x, y)
        r = 13 * fx
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(172, 170, 164, 255), outline=(90, 88, 82, 255), width=4)
        d.line((cx - r * 0.6, cy, cx + r * 0.6, cy), fill=(70, 68, 64, 255), width=5)
        d.line((cx, cy - r * 0.6, cx, cy + r * 0.6), fill=(70, 68, 64, 255), width=5)

    # Windows sticker and rating plate, the plate without its serial numbers
    d.rectangle(rect(518, 610, 612, 738), fill=(238, 238, 236, 255))
    d.rectangle(rect(518, 700, 612, 738), fill=(26, 58, 130, 255))
    for a in (0, 1):
        for b in (0, 1):
            d.rectangle(rect(535 + a * 34, 628 + b * 32, 565 + a * 34, 656 + b * 32), fill=(150, 150, 150, 255))
    d.rectangle(rect(1107, 318, 1455, 572), fill=(208, 206, 200, 255))
    text(1125, 340, "品番  CF-QV9", 17)
    text(1125, 470, "パナソニックのお問い合わせ窓口", 12)
    for i in range(4):
        d.rectangle(rect(1125, 495 + i * 18, 1440, 503 + i * 18), fill=(150, 148, 142, 255))
    img.save(HERE / "print_bottom.png")


def boot_screen():
    """What the display shows: the mark alone, the size and place it has in the site's
    boot splash, so the zoom lands on the very logo the boot goes on to build."""
    w, h = 3840, 2560
    mask = Image.open(HERE / "logos" / "lucya-mark.mask.png").getchannel("A")
    mask = mask.crop(mask.getbbox())
    lw = int(w * 0.44)
    mask = mask.resize((lw, lw * mask.height // mask.width), Image.LANCZOS)
    box = ((w - lw) // 2, int(h * 0.47) - mask.height // 2)
    full = Image.new("L", (w, h), 0)
    full.paste(mask, box)
    glow = full.filter(ImageFilter.GaussianBlur(70)).point(lambda v: int(v * 0.55))
    img = Image.new("RGB", (w, h), (0, 0, 0))
    img.paste((70, 92, 190), (0, 0), glow)
    img.paste((132, 150, 240), (0, 0), full)
    img.save(HERE.parent.parent / "intro" / "boot-screen.webp", quality=92)


def vpro_sticker():
    """The supplied Core i5 badge, relabelled: the machine's own says vPRO."""
    src = Image.open(HERE / "logos" / "intel-core-i5-10.png").convert("RGB")
    w, h = src.size
    band = src.crop((0, int(h * 0.02), w, int(h * 0.1))).resize((w, int(h * 0.25)))
    src.paste(band.crop((int(w * 0.1), 0, int(w * 0.9), band.height)), (int(w * 0.1), int(h * 0.72)))
    d = ImageDraw.Draw(src)
    d.text((w / 2, h * 0.83), "vPRO", fill=(72, 74, 78), anchor="mm",
           font=ImageFont.truetype(str(FONTS / "impact.ttf"), int(h * 0.15)))
    src.save(HERE / "logos" / "intel-core-i5-vpro.png")


def srgb(linear):
    linear = np.asarray(linear)
    return np.where(linear <= 0.0031308, linear * 12.92, 1.055 * linear ** (1 / 2.4) - 0.055)


def flatten(mask_name, base, ink, out):
    """Base colour with the print burnt in, at 15 px/mm."""
    mask = Image.open(HERE / mask_name)
    mask = mask.resize((4096, 4096 * mask.height // mask.width), Image.LANCZOS)
    m = np.asarray(mask, dtype=np.float32) / 255
    c = np.ones((*m.shape[:2], 3)) * np.array(base)
    c = c * (1 - m[..., 0:1]) + np.array(ink) * m[..., 0:1]
    c = c * (1 - m[..., 1:2]) + 0.002 * m[..., 1:2]
    Image.fromarray((srgb(c) * 255 + 0.5).astype(np.uint8)).save(HERE / out)


def grain_normal(size=512, tile_mm=24.0):
    """Tiling normal map of the blasted paint: band-limited noise, wraps at the edges."""
    rng = np.random.default_rng(9)
    fy = np.fft.fftfreq(size)[:, None] * size / tile_mm    # cycles per mm
    fx = np.fft.rfftfreq(size)[None, :] * size / tile_mm
    band = np.exp(-((np.hypot(fx, fy) - 3.2) / 1.6) ** 2)  # features around 0.15 mm
    height = np.fft.irfft2(np.fft.rfft2(rng.standard_normal((size, size))) * band, s=(size, size))
    height /= height.std()
    step = tile_mm / size
    amp = 0.02                                             # mm, rms
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * amp / (2 * step)
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * amp / (2 * step)
    n = np.dstack((-dx, dy, np.ones_like(dx)))
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    Image.fromarray(((n * 0.5 + 0.5) * 255 + 0.5).astype(np.uint8)).save(HERE / "tex_grain_normal.png")


def side_prints():
    """Marks beside the ports, as dark ink on transparency. x runs along the wall
    as read from outside, in the photo's px, 0.307 mm each from the near corner."""
    scale, px = 0.307, 40
    w, h = int(L.DEPTH * px), int(L.BASE_H * px)
    ink = (22, 22, 24, 255)

    def sheet(items):
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        for draw in items:
            draw(d)
        return img

    def at(p, z):
        return p * scale * px, (L.BASE_H - z) * px

    def text(p, z, s, size=1.9):
        return lambda d: d.text(at(p, z), s, fill=ink, anchor="mm", font=ImageFont.truetype(str(FONTS / "arialbd.ttf"), int(size * px)))

    def bolt(p, z):
        x, y = at(p, z)
        u = 0.55 * px
        return lambda d: d.polygon([(x + u, y - 2 * u), (x - u, y + 0.3 * u), (x, y + 0.3 * u), (x - u, y + 2 * u),
                                    (x + u, y - 0.3 * u), (x, y - 0.3 * u)], fill=ink)

    def usb(p, z):
        x, y = at(p, z)
        u = 0.5 * px
        return lambda d: (d.line((x, y, x + 5 * u, y), fill=ink, width=3),
                          d.polygon([(x + 5 * u, y - u), (x + 6.4 * u, y), (x + 5 * u, y + u)], fill=ink),
                          d.ellipse((x - u, y - u, x + u, y + u), fill=ink))

    def lan(p, z):
        x, y = at(p, z)
        u = 0.45 * px
        boxes = [(-1, -2), (-3, 1), (1, 1)]
        return lambda d: [d.rectangle((x + a * u, y + b * u, x + (a + 2) * u, y + (b + 1.6) * u), outline=ink, width=2) for a, b in boxes]

    def monitor(p, z):
        x, y = at(p, z)
        u = 0.5 * px
        return lambda d: d.rounded_rectangle((x - 2 * u, y - 1.5 * u, x + 2 * u, y + 1.5 * u), radius=3, outline=ink, width=3)

    def headset(p, z):
        x, y = at(p, z)
        u = 0.55 * px
        return lambda d: (d.arc((x - 2 * u, y - 2 * u, x + 2 * u, y + 2 * u), 180, 360, fill=ink, width=3),
                          d.rectangle((x - 2.2 * u, y, x - 1.4 * u, y + 1.4 * u), fill=ink),
                          d.rectangle((x + 1.4 * u, y, x + 2.2 * u, y + 1.4 * u), fill=ink))

    # the left wall reads rear to front, the right wall front to rear
    sheet([text(125 - 58, 3.0, "DC IN", 1.6), text(219 - 58, 2.8, "HDMI"), bolt(276 - 58, 4.0),
           text(368 - 58, 5.1, "SS", 1.8), usb(378 - 58, 5.1), text(374 - 58, 3.0, "CHARGE", 1.6),
           lan(506 - 58, 4.6), monitor(630 - 58, 4.6), headset(681 - 58, 4.4)]).save(HERE / "side_left.png")
    sheet([text(332 - 58, 5.0, "SS", 1.8), usb(342 - 58, 5.0), text(408 - 58, 5.0, "SS", 1.8), usb(418 - 58, 5.0),
           text(640 - 58, 5.4, "SD", 2.0), text(640 - 58, 3.0, "XC", 2.0)]).save(HERE / "side_right.png")


def stickers():
    """Layer of the lid stickers, and the flattened lid the web export needs."""
    w, h = int(L.WIDTH * PX), int(L.DEPTH * PX)
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for name, x, y, width, angle in L.STICKERS:
        img = Image.open(HERE / "stickers" / f"{name}.png").convert("RGBA")
        size = int(width * PX)
        img = img.resize((size, size * img.height // img.width), Image.LANCZOS)
        img = img.rotate(angle, resample=Image.BICUBIC, expand=True)
        layer.alpha_composite(img, (int(x * PX - img.width / 2), int(y * PX - img.height / 2)))
    clear = tuple(int(v * PX) for v in L.LOGO_CLEAR)
    assert layer.getchannel("A").crop(clear).getbbox() is None, "a sticker covers the Panasonic logo"
    layer.save(HERE / "stickers_lid.png")
    return layer


def lid_maps(layer):
    """Burns the stickers into the web lid and writes its roughness/metal map:
    vinyl and ink are dielectric, unlike the paint around them."""
    size = Image.open(HERE / "tex_lid.png").size
    small = layer.resize(size, Image.LANCZOS)
    Image.alpha_composite(Image.open(HERE / "tex_lid.png").convert("RGBA"), small).convert("RGB").save(HERE / "tex_lid.png")

    mr_size = (2048, 2048 * size[1] // size[0])
    alpha = np.asarray(layer.getchannel("A").resize(mr_size, Image.LANCZOS), dtype=np.float32) / 255
    ink = np.asarray(Image.open(HERE / "decal_lid.png").getchannel("R").resize(mr_size, Image.LANCZOS), dtype=np.float32) / 255
    f = L.FINISHES["silver"]
    plain = np.maximum(alpha, ink)
    rough = f["roughness"] * (1 - alpha) + 0.33 * alpha
    metal = f["metallic"] * (1 - plain)
    mr = np.dstack((np.ones_like(rough), rough, metal))
    Image.fromarray((mr * 255 + 0.5).astype(np.uint8)).save(HERE / "tex_lid_mr.png")


deck()
lid()
side_prints()
bottom()
vpro_sticker()
boot_screen()
f = L.FINISHES["silver"]
flatten("decal_deck.png", f["paint"], f["ink"], "tex_deck.png")
flatten("decal_deck.png", f["key"], f["legend"], "tex_keys.png")
flatten("decal_lid.png", f["paint"], f["ink"], "tex_lid.png")
lid_maps(stickers())
grain_normal()
print("decals written")
