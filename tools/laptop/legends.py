"""Keycap legends of the JIS CF-QV9, drawn from a straight-on photo of the keys.

draw(d, key, at, px, ink) prints one key; u, v run -1..1 across the cap, v up.
"""
from pathlib import Path

from PIL import ImageFont

FONTS = Path("C:/Windows/Fonts")
_cache = {}


def font(name, mm, px):
    key = (name, int(mm * px))
    if key not in _cache:
        _cache[key] = ImageFont.truetype(str(FONTS / name), key[1])
    return _cache[key]


SANS, JP = "segoeuib.ttf", "meiryob.ttc"

# number row: shifted, kana, shifted kana, Fn-numpad digit
NUMBERS = {
    "1": ("!", "ぬ", "", ""), "2": ('"', "ふ", "", ""), "3": ("#", "あ", "ぁ", ""), "4": ("$", "う", "ぅ", ""),
    "5": ("%", "え", "ぇ", ""), "6": ("&", "お", "ぉ", ""), "7": ("'", "や", "ゃ", "7"),
    "8": ("(", "ゆ", "ゅ", "8"), "9": (")", "よ", "ょ", "9"), "0": ("", "わ", "を", ""),
}
LETTERS = {
    "Q": "た", "W": "て", "E": "い", "R": "す", "T": "か", "Y": "ん", "U": "な", "I": "に", "O": "ら", "P": "せ",
    "A": "ち", "S": "と", "D": "し", "F": "は", "G": "き", "H": "く", "J": "ま", "K": "の", "L": "り",
    "Z": "つ", "X": "さ", "C": "そ", "V": "ひ", "B": "こ", "N": "み", "M": "も",
}
NUMPAD = {"U": "4", "I": "5", "O": "6", "J": "1", "K": "2", "L": "3", "M": "0"}
# punctuation: upper, lower, kana, Fn-numpad mark
SYMBOLS = {
    "-": ("=", "-", "ほ", "-"), "^": ("~", "^", "へ", ""), "¥": ("|", "¥", "ー", ""),
    "@": ("`", "@", "゛", "↵"), "[": ("{", "[", "「", ""), ";": ("+", ";", "れ", "+"),
    ":": ("*", ":", "け", "*"), "]": ("}", "]", "む", ""), ",": ("<", ",", "ね", ""),
    ".": (">", ".", "る", "."), "/": ("?", "/", "め", "/"), "\\": ("_", "\\", "ろ", ""),
}
FUNCTION = {"F1": "☼", "F2": "☼", "F3": "▭", "F4": "×", "F5": "◀", "F6": "▶", "F7": "▭", "F8": "",
            "F9": "▮", "F10": "▭", "F11": "SysRq", "F12": "PrtSc"}
STACKED = {"NumLk": "ScrLk", "Ins": "Pause", "Del": "Break"}
ARROWS = {"PgUp": (0, 1), "PgDn": (0, -1), "Home": (-1, 0), "End": (1, 0)}


def draw(d, key, at, px, ink):
    label = key["label"]
    x, y, w, h = key["x"], key["y"], key["w"], key["h"]
    if not label:
        return

    def pos(u, v):
        return at(x + u * w / 2, y + v * h / 2)

    def text(s, u, v, mm, name=SANS):
        d.text(pos(u, v), s, fill=ink, font=font(name, mm, px), anchor="mm")

    def boxed(s, u, v, bw, bh, mm=2.1):
        cx, cy = pos(u, v)
        rect = (cx - bw * px / 2, cy - bh * px / 2, cx + bw * px / 2, cy + bh * px / 2)
        d.rounded_rectangle(rect, radius=0.5 * px, outline=ink, width=max(2, int(0.16 * px)))
        if s:
            d.text((cx, cy), s, fill=ink, font=font(SANS, mm, px), anchor="mm")

    if label in NUMBERS:
        shifted, kana, small, pad = NUMBERS[label]
        if shifted:
            text(shifted, -0.6, 0.42, 3.4)
        text(label, -0.6, -0.36, 4.2)
        text(kana, 0.55, -0.36, 2.5, JP)
        if small:
            text(small, 0.55, 0.32, 2.1, JP)
        if pad:
            boxed(pad, 0.0, 0.08, 2.5, 2.5)
    elif label in LETTERS:
        text(label, -0.5, 0.36, 4.6)
        text(LETTERS[label], 0.56, -0.46, 2.7, JP)
        if label in NUMPAD:
            boxed(NUMPAD[label], 0.08, 0.05, 2.5, 2.5)
    elif label in SYMBOLS:
        upper, lower, kana, pad = SYMBOLS[label]
        text(upper, -0.56, 0.4, 3.3)
        text(lower, -0.56, -0.4, 3.3)
        text(kana, 0.54, -0.4, 2.5, JP)
        if pad:
            boxed(pad, 0.08, 0.08, 2.5, 2.5)
    elif label in FUNCTION:
        text(label, 0, 0.42, 2.6)
        icon = FUNCTION[label]
        if len(icon) > 1:
            boxed(icon, 0, -0.38, w * 0.8, 3.0, 2.1)
        elif label != "F8":
            boxed(icon, 0, -0.38, w * 0.66, 2.8, 1.8)
    elif label in STACKED:
        text(label, 0, 0.42, 2.4)
        boxed(STACKED[label], 0, -0.38, w * 0.8, 3.0, 2.0)
    elif label in ARROWS:
        cx, cy = pos(0, 0.5)
        dx, dy = ARROWS[label]
        s = 1.3 * px
        tip = (cx + dx * s, cy - dy * s)
        d.line((cx - dx * s, cy + dy * s, *tip), fill=ink, width=int(0.28 * px))
        d.polygon([(tip[0] + dx * 0.6 * s, tip[1] - dy * 0.6 * s),
                   (tip[0] + dy * 0.6 * s, tip[1] + dx * 0.6 * s),
                   (tip[0] - dy * 0.6 * s, tip[1] - dx * 0.6 * s)], fill=ink)
        boxed(label, 0, -0.42, w * 0.8, 3.1, 2.3)
    elif label == "Esc":
        text("Esc", 0, 0, 3.0)
    elif label == "半/全":
        text("半角/全角", 0, 0.32, 2.0, JP)
        text("漢字", 0, -0.32, 2.3, JP)
    elif label == "Back space":
        text("Back", 0, 0.62, 2.3)
        text("space", 0, 0.2, 2.3)
        boxed("Ct+Al+Del", 0, -0.48, w * 0.84, 2.7, 1.6)
    elif label == "Tab":
        text("Tab", -0.12, 0.42, 3.0)
        cx, cy = pos(-0.12, -0.3)
        d.line((cx - 2.2 * px, cy - 0.7 * px, cx + 2.2 * px, cy - 0.7 * px), fill=ink, width=int(0.2 * px))
        d.line((cx - 2.2 * px, cy + 0.7 * px, cx + 2.2 * px, cy + 0.7 * px), fill=ink, width=int(0.2 * px))
    elif label == "Caps Lock":
        text("Caps Lock", 0, 0.36, 2.5)
        text("英数", 0, -0.38, 2.5, JP)
    elif label == "Shift":
        text("Shift", 0.14, 0, 3.1)
        cx, cy = pos(-0.32, 0)
        s = 1.05 * px
        d.polygon([(cx, cy - s), (cx + s, cy), (cx + 0.45 * s, cy), (cx + 0.45 * s, cy + s),
                   (cx - 0.45 * s, cy + s), (cx - 0.45 * s, cy), (cx - s, cy)], outline=ink, width=int(0.14 * px))
    elif label == "Enter":
        text("Enter", 0.1, 0.42, 3.4)
    elif label == "Fn":
        boxed("Fn", 0, 0, 7.0, 3.2, 2.6)
    elif label == "Ctrl":
        text("Ctrl", 0, 0, 3.1)
    elif label == "Alt":
        text("Alt", 0, 0.06, 3.1)
        cx, cy = pos(0, -0.4)
        d.line((cx - 3 * px, cy, cx + 3 * px, cy), fill=ink, width=int(0.2 * px))
    elif label == "Win":
        cx, cy = pos(0, 0)
        s, g = 1.6 * px, 0.25 * px
        for a in (-1, 1):
            for b in (-1, 1):
                x0 = cx + (a * (s / 2 + g / 2)) - s / 2
                y0 = cy + (b * (s / 2 + g / 2)) - s / 2
                d.rectangle((x0, y0, x0 + s, y0 + s), fill=ink)
    elif label == "≡":
        boxed("≡", 0, 0, 4.2, 4.2, 3.0)
    elif label == "カナ":
        text("カタカナ", 0, 0.5, 1.8, JP)
        text("ひらがな", 0, 0.05, 1.8, JP)
        text("ローマ字", 0, -0.45, 1.8, JP)
    else:
        text(label, 0, 0, 2.3, JP)
