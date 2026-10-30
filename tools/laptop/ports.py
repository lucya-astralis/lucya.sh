"""The side ports of the CF-QV9, measured off side-on photos (0.307 mm per px).

Interiors follow the connector standards (USB-A tongue 11.5 x 1.84, USB-C 6.6 x 0.68
with 24 contacts, HD-15 at 2.29 / 1.98), checked against the KiCad 3D library's STEP
models. Those are reference only: the library's parts are through-hole sizes that
would not fit an 11 mm body, and its CC-BY-SA licence would bind the published model.

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
            # tongue sits high in the shell, contact fingers along its underside
            parts.bar("blue", y, z + 0.75, 11.5, 1.84, at(0.6), back)
            for i, w in enumerate((1.0, 2.0, 2.0, 2.0, 1.0)):
                parts.bar("gold", y - 4.4 + i * 2.2, z - 0.2, w * 0.82, 0.06, at(0.9), back)
            for dy in (-3.6, 3.6):      # grounding springs punched out of the shell
                parts.bar("metal", y + dy, z + 2.45, 2.0, 0.22, at(1.2), at(2.8))
                parts.bar("metal", y + dy, z - 2.45, 2.0, 0.22, at(1.2), at(2.8))
        elif kind == "hdmi":
            parts.bar("black", y, z + 0.55, 12.4, 1.1, at(0.8), back)
            for i in range(10):
                parts.bar("gold", y + (i - 4.5) * 1.0, z + 1.12, 0.5, 0.05, at(1.0), back)
                parts.bar("gold", y + (i - 4.5) * 1.0 + 0.5, z - 0.02, 0.5, 0.05, at(1.0), back)
            for dy in (-6.2, 6.2):
                parts.bar("metal", y + dy, z + 2.2, 1.0, 0.18, at(1.0), at(2.6))
        elif kind == "usbc":
            parts.bar("black", y, z, 6.6, 0.68, at(0.45), back)
            for i in range(12):
                x = y + (i - 5.5) * 0.5
                parts.bar("gold", x, z + 0.36, 0.26, 0.04, at(0.6), back)
                parts.bar("gold", x, z - 0.36, 0.26, 0.04, at(0.6), back)
        elif kind == "dc":
            parts.sleeve("black", place(circle(2.5, 32), y, z), at(0.2), back)
            parts.sleeve("metal", place(circle(1.0, 16), y, z), at(0.9), back)
            parts.plate("metal", place(circle(1.0, 16), y, z), at(0.9))
        elif kind == "lan":
            parts.sleeve("black", place([(a * 0.93, b * 0.93) for a, b in RJ45], y, z), at(0.3), back)
            for i in range(8):
                parts.bar("gold", y + (i - 3.5) * 1.02, z + 3.2, 0.46, 1.9, at(1.6), back)
            parts.bar("metal", y - 5.9, z + 1.0, 0.9, 2.6, at(1.8), back)
            parts.bar("metal", y + 5.9, z + 1.0, 0.9, 2.6, at(1.8), back)
            parts.bar("rubber", y, z - 2.6, 3.8, 0.5, at(2.0), back)
        elif kind == "vga":
            inner = place([(a * 0.9, b * 0.84) for a, b in VGA], y, z)
            parts.sleeve("rubber", inner, at(0.3), at(1.5))
            parts.plate("rubber", inner, at(1.5))
            # HD-15: three rows of five, each row half a pitch along
            for dz, offset in ((1.98, 0), (0, -1.14), (-1.98, 0)):
                for i in range(5):
                    hole = place(circle(0.5, 12), y + (i - 2) * 2.29 + offset + 0.3, z + dz)
                    parts.plate("black", hole, at(1.47))
                    parts.plate("gold", place(circle(0.26, 8), y + (i - 2) * 2.29 + offset + 0.3, z + dz), at(1.45))
        elif kind == "jack":
            parts.sleeve("black", place(circle(1.75, 24), y, z), at(0.1), back)
            parts.plate("metal", place(circle(1.1, 16), y, z), at(2.6))
            parts.plate("black", place(circle(0.8, 16), y, z), at(2.58))
        elif kind == "sd":
            parts.bar("rubber", y, z + 0.5, 23, 0.5, at(1.4), back)
            parts.bar("metal", y - 8.5, z - 0.6, 2.2, 0.3, at(1.2), back)
        elif kind == "lock":
            parts.plate("rubber", place(rrect(4.5, 2.9, 0.5), y + 0.4, z), s * (L.WIDTH / 2 - depth + 0.06))
    return cuts, parts
