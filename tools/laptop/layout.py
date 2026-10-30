"""Shared measurements of the CF-QV8/QV9 chassis, in millimetres.

Used by make_decals.py (system Python) and build_cf_qv9.py (Blender), so the
printed legends land on the modelled keys. Measured off review photos and the
published 273 x 209.2 x 18.7 mm, 19 / 15.2 mm key pitch, 70 mm wheel pad.

Deck coordinates: origin at the centre of the footprint, +x right, +y toward
the hinge, as seen from above with the keyboard the right way up.
"""
WIDTH = 273.0
DEPTH = 209.2
BASE_H = 11.0
LID_H = 7.2
GAP = 0.5

KB_LEFT = -131.3
KB_RIGHT = 130.0

PAD_CENTER = (-18.0, -54.0)
PAD_OUTER_R = 35.3
PAD_INNER_R = 25.6      # chrome ring, down to CHROME_R
CHROME_R = 21.7
STICKER = (116.0, -56.0)   # Intel Core i5 10th Gen, where the QV8 had its fingerprint reader
STICKER_SIZE = (14.0, 13.7)

HINGE_X = 104.0
HINGE_W = 25.0

# Factory finishes. Silver: warm champagne magnesium as on the real machine,
# matching keys, dark print, dark wheel ring around a light pad.
# Black Deep Metal: near-black everywhere, white print.
FINISHES = {
    "silver": {
        "paint": (0.33, 0.315, 0.285), "metallic": 0.72, "roughness": 0.44, "specular": 0.5,
        "key": (0.3, 0.29, 0.27), "ink": (0.006, 0.006, 0.007), "legend": (0.05, 0.048, 0.045),
        "ring": (0.06, 0.056, 0.05), "pad": (0.33, 0.32, 0.29), "hinge": (0.36, 0.355, 0.345),
        "pill": (0.1, 0.095, 0.085), "grain": 0.36, "sweep": (0.3, 0.3, 0.31),
    },
    "black": {
        "paint": (0.016, 0.016, 0.018), "metallic": 0.45, "roughness": 0.46, "specular": 0.28,
        "key": (0.009, 0.009, 0.01), "ink": (0.8, 0.8, 0.8), "legend": (0.7, 0.7, 0.7),
        "ring": (0.09, 0.085, 0.085), "pad": (0.02, 0.02, 0.022), "hinge": (0.012, 0.012, 0.013),
        "pill": (0.02, 0.02, 0.02), "grain": 0.5, "sweep": (0.8, 0.8, 0.8),
    },
}

# On the lid, seen closed with the hinge at the bottom: file, centre x, y from the
# top-left corner, width (mm), rotation. LOGO_CLEAR is kept free for the Panasonic mark.
STICKERS = [
    # placed by hand, straight
    ("rei", 30.6, 131, 56, 0),
    ("arasaka", 33.6, 184, 62.4, 0),
    ("japan", 244.8, 184, 49.5, 0),
    # the rest, loosely
    ("esa", 32, 58, 36, -6),
    ("frieren", 232, 72, 40, 4),
    ("eu", 84, 112, 32, 5),
    ("kuromi", 128, 100, 30, -5),
    ("pride", 176, 108, 38, -8),
    ("potato", 234, 133, 24, 7),
    ("jaxa", 112, 156, 50, 5),
    ("clawd", 173, 168, 44, -4),
]
LOGO_CLEAR = (108, 50, 165, 68)

# Measured off a straight-on photo of the keys. Rows: photo y, cap height, then
# (label, photo x0, x1). A photo px is SCALE_X / SCALE_Y mm.
SCALE_X = 0.1386
SCALE_Y = 0.1365
ROWS = [
    (72, 75, [("Esc", 25, 122), ("半/全", 135, 235), ("F1", 255, 355), ("F2", 367, 465), ("F3", 478, 575),
              ("F4", 590, 685), ("F5", 707, 803), ("F6", 817, 913), ("F7", 927, 1023), ("F8", 1037, 1133),
              ("F9", 1152, 1250), ("F10", 1262, 1360), ("F11", 1372, 1470), ("F12", 1482, 1575),
              ("NumLk", 1590, 1688), ("Ins", 1700, 1797), ("Del", 1805, 1905)]),
    (170, 95, [("1", 58, 185), ("2", 198, 325), ("3", 338, 462), ("4", 475, 600), ("5", 612, 738), ("6", 750, 877),
               ("7", 890, 1015), ("8", 1025, 1155), ("9", 1165, 1285), ("0", 1300, 1420), ("-", 1435, 1535),
               ("^", 1550, 1650), ("¥", 1665, 1765), ("Back space", 1780, 1895)]),
    (282, 95, [("Tab", 25, 113), ("Q", 128, 253), ("W", 268, 392), ("E", 406, 530), ("R", 545, 668), ("T", 685, 808),
               ("Y", 823, 945), ("U", 960, 1082), ("I", 1096, 1218), ("O", 1230, 1353), ("P", 1368, 1490),
               ("@", 1505, 1622), ("[", 1637, 1735), ("Enter", 1750, 1900)]),
    (393, 95, [("Caps Lock", 22, 148), ("A", 162, 288), ("S", 303, 425), ("D", 441, 565), ("F", 580, 705),
               ("G", 720, 843), ("H", 858, 982), ("J", 995, 1118), ("K", 1130, 1253), ("L", 1267, 1390),
               (";", 1405, 1525), (":", 1540, 1660), ("]", 1672, 1770)]),
    (505, 95, [("Shift", 22, 218), ("Z", 232, 357), ("X", 372, 495), ("C", 510, 635), ("V", 650, 775), ("B", 790, 913),
               ("N", 928, 1050), ("M", 1063, 1185), (",", 1200, 1320), (".", 1337, 1460), ("/", 1475, 1597),
               ("\\", 1610, 1710), ("Shift", 1725, 1905)]),
    (617, 95, [("Fn", 22, 147), ("Ctrl", 160, 287), ("Win", 302, 405), ("Alt", 420, 522), ("無変換", 537, 630),
               ("", 650, 1050), ("変換", 1065, 1150), ("カナ", 1167, 1255), ("≡", 1270, 1362), ("Ctrl", 1375, 1478),
               ("Fn", 1490, 1597)]),
    (590, 70, [("PgUp", 1722, 1830)]),
    (670, 70, [("Home", 1628, 1730), ("PgDn", 1738, 1820), ("End", 1830, 1910)]),
]


def keys():
    out = []

    def add(label, x0, x1, py, h):
        out.append({"label": label, "x": KB_LEFT + ((x0 + x1) / 2 - 22) * SCALE_X, "y": 60.8 - (py - 170) * SCALE_Y,
                    "w": (x1 - x0) * SCALE_X, "h": h * SCALE_Y})

    for py, h, row in ROWS:
        for label, x0, x1 in row:
            add(label, x0, x1, py, h)

    def mm(px, py):
        return KB_LEFT + (px - 22) * SCALE_X, 60.8 - (py - 170) * SCALE_Y

    # Enter is one L-shaped cap, counter-clockwise from the bottom of the leg
    enter = next(k for k in out if k["label"] == "Enter")
    enter["poly"] = [mm(*p) for p in ((1785, 430), (1900, 430), (1900, 232), (1750, 232), (1750, 330), (1785, 330))]
    enter["leg"] = mm(1845, 385)
    for key in out:
        if "poly" not in key:
            x, y, a, b = key["x"], key["y"], key["w"] / 2, key["h"] / 2
            key["poly"] = [(x - a, y - b), (x + a, y - b), (x + a, y + b), (x - a, y + b)]
        key["r"] = min(2.7, key["h"] * 0.26)
    return out
