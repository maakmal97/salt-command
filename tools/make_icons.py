"""Generate the Salt Desk browser tab icon: the gold cube on a clear ground.

The home-screen icons (icon-180, icon-192, icon-512, icon-512-maskable) are the brand's own plates, copied from
Code\\salt-ds\\brand\\assets since v472, and this script never writes them. The tab icon is the same mark: the cube
the rail, the bar and the printed board draw (master/salt_command.html, aria-label "Salt crystal"), its gradient
#c5a059 to #b87333 laid on each part's own box as the SVG does (objectBoundingBox). The front edge 50,50 to 50,95 is
a line with no width, so the SVG paints nothing there and neither does this; the plates have no front edge either.
3 Nov 2026, his word: the tab icon had kept the crystal retired at v472. Run: python tools/make_icons.py
"""
from PIL import Image, ImageDraw
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "public")

TOP, BOTTOM = (197, 160, 89), (184, 115, 51)   # the mark's stops, #c5a059 and #b87333
SS = 4                                           # supersample factor
STROKE = 3                                       # the mark's stroke-width, in its 100-unit viewBox

# the mark's parts in its 100-unit viewBox: (points, closed, filled, opacity)
PARTS = [
    ([(50, 5), (95, 28), (95, 72), (50, 95), (5, 72), (5, 28)], True, False, 1.0),
    ([(50, 5), (50, 50), (95, 28)], False, False, 1.0),
    ([(50, 50), (5, 28)], False, False, 1.0),
    ([(50, 28), (72, 39), (50, 50), (28, 39)], True, True, 0.85),
]


def _gradient(S, scale, off, pts):
    """the gradient over this part's box, (0,0) to (1,1) in box units, padded past it"""
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    x0, y0, w, h = min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)
    img = Image.new("RGB", (S, S))
    px = img.load()
    for y in range(S):
        v = ((y - off) / scale - y0) / h
        for x in range(S):
            t = min(1.0, max(0.0, (((x - off) / scale - x0) / w + v) / 2))
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(TOP, BOTTOM))
    return img


def make_tab(size=128):
    S = size * SS
    span = 100 - 2 * (5 - STROKE / 2)            # the mark's drawn extent, stroke included
    scale = S * 0.96 / span
    off = (S - 100 * scale) / 2
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    w = STROKE * scale
    for pts, closed, filled, opacity in PARTS:
        mask = Image.new("L", (S, S), 0)
        d = ImageDraw.Draw(mask)
        xy = [(off + x * scale, off + y * scale) for x, y in pts]
        if filled:
            d.polygon(xy, fill=255)
        else:
            path = xy + [xy[0]] if closed else xy
            d.line(path, fill=255, width=round(w))
            for x, y in xy:                      # round joins and caps
                d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=255)
        if opacity < 1:
            mask = mask.point(lambda a: round(a * opacity))
        layer = _gradient(S, scale, off, pts).convert("RGBA")
        layer.putalpha(mask)
        img = Image.alpha_composite(img, layer)
    # colour and cover downscaled apart, the colour laid over the whole mark's gradient first, so the clear ground's
    # black never bleeds into an antialiased edge (a premultiplied resize still rounds the faintest edge to black)
    colour = _gradient(S, scale, off, PARTS[0][0])
    colour.paste(img.convert("RGB"), mask=img.getchannel("A"))
    out = colour.resize((size, size), Image.LANCZOS).convert("RGBA")
    out.putalpha(img.getchannel("A").resize((size, size), Image.LANCZOS))
    return out


def main():
    p = os.path.normpath(os.path.join(OUT, "icon-tab.png"))
    make_tab().save(p)
    print("wrote", p, os.path.getsize(p), "bytes")


if __name__ == "__main__":
    main()
