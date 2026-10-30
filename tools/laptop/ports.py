"""The side ports of the CF-QV9, measured off side-on photos (0.307 mm per px).

Each port is one cut into the base plus thin liner parts inside it. Everything
is expressed in (y, z) offsets on the side wall; `s` is -1 for the left wall,
+1 for the right. Left wall reads rear to front, right wall front to rear.
"""
import math

import layout as L

DEPTH = 3.4   # shallow: the keyboard well starts a few mm behind the wall


def rrect(w, h, r, seg=5):
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90),
                       (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def circle(r, n=32):
    return [(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n)) for i in range(n)]


HDMI = [(-7.3, 2.5), (7.3, 2.5), (7.3, 0.7), (5.7, -2.5), (-5.7, -2.5), (-7.3, 0.7)]
VGA = [(-8.8, 4.5), (8.8, 4.5), (7.7, -4.5), (-7.7, -4.5)]
RJ45 = [(-7, 4.6), (7, 4.6), (7, -1.6), (4.6, -1.6), (4.6, -3.4), (2.4, -3.4), (2.4, -4.6),
        (-2.4, -4.6), (-2.4, -3.4), (-4.6, -3.4), (-4.6, -1.6), (-7, -1.6)]

PORTS = [
    # kind, wall, y, z
    ("dc", -1, 91.6, 5.2),
    ("hdmi", -1, 67.0, 5.0),
    ("usbc", -1, 43.5, 5.0),
    ("usba", -1, 19.6, 5.0),
    ("lan", -1, -22.8, 5.2),
    ("vga", -1, -56.6, 5.2),
    ("jack", -1, -81.5, 5.2),
    ("usba", 1, -6.4, 5.0),
    ("usba", 1, 16.6, 5.0),
    ("sd", 1, 54.4, 3.7),
    ("lock", 1, 90.5, 7.6),
]

SHAPES = {
    "dc": circle(3.05), "hdmi": HDMI, "usbc": rrect(8.4, 2.8, 1.35), "usba": rrect(13.2, 5.4, 0.4),
    "lan": RJ45, "vga": VGA, "jack": circle(2.15), "sd": rrect(24.6, 3.0, 0.3), "lock": rrect(12.0, 5.4, 1.4),
}
CUT_DEPTH = {"sd": 1.6, "lock": 0.8}


class Parts:
    """Collects (x, y, z) geometry per material, so all ports share a few meshes."""

    def __init__(self):
        self.meshes = {}

    def add(self, material, verts, faces):
        v, f = self.meshes.setdefault(material, ([], []))
        base = len(v)
        v.extend(verts)
        f.extend(tuple(i + base for i in face) for face in faces)

    def plate(self, material, pts, x):
        self.add(material, [(x, y, z) for y, z in pts], [tuple(range(len(pts)))])

    def sleeve(self, material, pts, x0, x1):
        n = len(pts)
        verts = [(x0, y, z) for y, z in pts] + [(x1, y, z) for y, z in pts]
        self.add(material, verts, [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)])

    def bar(self, material, y, z, w, h, x0, x1):
        pts = [(y - w / 2, z - h / 2), (y + w / 2, z - h / 2), (y + w / 2, z + h / 2), (y - w / 2, z + h / 2)]
        self.sleeve(material, pts, x0, x1)
        self.plate(material, pts, x0)


def place(pts, y, z):
    return [(y + a, z + b) for a, b in pts]


def build():
    """Returns the cut outlines [(wall, pts, depth)] and the liner Parts."""
    cuts, parts = [], Parts()
    for kind, s, y, z in PORTS:
        pts = place(SHAPES[kind], y, z)
        depth = CUT_DEPTH.get(kind, DEPTH)
        cuts.append((s, pts, depth))
        out = s * (L.WIDTH / 2 - 0.05)
        back = s * (L.WIDTH / 2 - depth + 0.02)
        at = lambda mm: s * (L.WIDTH / 2 - mm)   # noqa: E731

        if kind not in ("sd", "lock"):
            parts.sleeve("metal", pts, out, back)
        parts.plate("black", pts, back)

        if kind == "usba":
            parts.bar("blue", y, z + 0.55, 11.4, 1.8, at(0.7), back)
        elif kind == "hdmi":
            parts.bar("black", y, z + 0.5, 10.6, 1.3, at(0.8), back)
        elif kind == "usbc":
            parts.bar("black", y, z, 6.4, 0.7, at(0.5), back)
        elif kind == "dc":
            parts.sleeve("metal", place(circle(1.0, 16), y, z), at(0.8), back)
            parts.plate("metal", place(circle(1.0, 16), y, z), at(0.8))
        elif kind == "lan":
            for i in range(8):
                parts.bar("gold", y + (i - 3.5) * 1.05, z + 3.4, 0.5, 1.6, at(2.6), back)
            parts.bar("metal", y - 5.6, z + 1.2, 1.2, 2.4, at(2.2), back)
            parts.bar("metal", y + 5.6, z + 1.2, 1.2, 2.4, at(2.2), back)
        elif kind == "vga":
            inner = place([(a * 0.9, b * 0.84) for a, b in VGA], y, z)
            parts.plate("navy", inner, at(1.6))
            for row, (count, dz, offset) in enumerate(((5, 2.3, 0), (5, 0, 0.6), (5, -2.3, 0))):
                for i in range(count):
                    hole = place(circle(0.5, 10), y + (i - 2) * 2.3 + offset - 0.3, z + dz)
                    parts.plate("black", hole, at(1.55))
        elif kind == "jack":
            parts.sleeve("metal", place(circle(1.75, 24), y, z), at(0.1), back)
        elif kind == "sd":
            parts.bar("rubber", y, z + 0.5, 23, 0.5, at(1.4), back)
        elif kind == "lock":
            parts.plate("rubber", place(rrect(4.5, 2.9, 0.5), y + 0.4, z), s * (L.WIDTH / 2 - depth + 0.06))
    return cuts, parts
