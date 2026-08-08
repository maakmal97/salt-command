"""Generate the Salt Command PWA icons.

The Obsidian Salt crystal from the desk's own inline favicon: a diamond with a gold
top-right face and a violet lower-left face over a cyan body, on the desk's dark ground.
Rendered at 4x and downscaled so the facets have clean edges. Run: python tools/make_icons.py
"""
from PIL import Image, ImageDraw
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "public")

BG     = (24, 15, 44, 255)     # #180f2c, the desk ground
GLOW   = (68, 40, 92)          # a faint violet lift behind the crystal
CYAN   = (99, 230, 224)        # #63e6e0 body
GOLD   = (245, 196, 81)        # #f5c451 top-right face
VIOLET = (176, 124, 255)       # #b07cff lower-left face
SS = 4                         # supersample factor

# crystal in 32-space (matches the favicon path)
BODY   = [(16, 5), (26, 13), (16, 27), (6, 13)]
FGOLD  = [(16, 5), (26, 13), (16, 13)]
FVIOL  = [(6, 13), (16, 13), (16, 27)]


def _pts(poly, S, frac):
    """map 32-space to a centred square occupying `frac` of the canvas"""
    c = S / 2.0
    span = frac * S
    return [(c + (x - 16) / 32.0 * span, c + (y - 15.5) / 32.0 * span) for (x, y) in poly]


def _layer(S, poly, S4, frac, colour, alpha):
    lay = Image.new("RGBA", (S4, S4), (0, 0, 0, 0))
    ImageDraw.Draw(lay).polygon(_pts(poly, S4, frac), fill=colour + (alpha,))
    return lay


def make(size, maskable=False):
    S4 = size * SS
    frac = 0.52 if maskable else 0.66
    img = Image.new("RGBA", (S4, S4), BG)

    # rounded ground for the non-maskable icons (iOS re-masks, but this looks right raw);
    # maskable stays full-bleed so the launcher's own mask has room.
    if not maskable:
        ground = Image.new("RGBA", (S4, S4), (0, 0, 0, 0))
        r = int(0.22 * S4)
        ImageDraw.Draw(ground).rounded_rectangle([0, 0, S4 - 1, S4 - 1], radius=r, fill=BG)
        img = Image.new("RGBA", (S4, S4), (0, 0, 0, 0))
        img = Image.alpha_composite(img, ground)

    # faint radial glow behind the crystal
    glow = Image.new("RGBA", (S4, S4), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    c = S4 / 2
    for i, rad in enumerate(range(int(0.42 * S4), 0, -max(1, S4 // 90))):
        a = int(46 * (1 - rad / (0.42 * S4)))
        gd.ellipse([c - rad, c - rad, c + rad, c + rad], fill=GLOW + (a,))
    img = Image.alpha_composite(img, glow)

    img = Image.alpha_composite(img, _layer(size, BODY,  S4, frac, CYAN,   235))
    img = Image.alpha_composite(img, _layer(size, FGOLD, S4, frac, GOLD,   255))
    img = Image.alpha_composite(img, _layer(size, FVIOL, S4, frac, VIOLET, 140))

    img = img.resize((size, size), Image.LANCZOS)
    if maskable:
        # a maskable icon must be fully opaque
        base = Image.new("RGBA", (size, size), BG)
        img = Image.alpha_composite(base, img)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [("icon-180.png", 180, False), ("icon-192.png", 192, False),
            ("icon-512.png", 512, False), ("icon-512-maskable.png", 512, True)]
    for name, size, mask in jobs:
        p = os.path.normpath(os.path.join(OUT, name))
        make(size, mask).save(p)
        print("wrote", p, os.path.getsize(p), "bytes")


if __name__ == "__main__":
    main()
