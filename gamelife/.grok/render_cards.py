#!/usr/bin/env python3
"""Stylized Soulmate share card + X banner. Exact pixels, exact title."""
import math
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

INK = (20, 24, 29)        # #14181d
SLATE = (30, 37, 45)      # #1e252d
PAPER = (244, 239, 230)   # #f4efe6
AMBER = (224, 161, 92)    # #e0a15c
INK_DEEP = (14, 17, 21)
SLATE_LIFT = (42, 51, 62)
AMBER_DIM = (168, 112, 62)
AMBER_HOT = (240, 196, 138)

SERIF = "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf"
SERIF_ITAL = "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf"


def lerp(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def sky(w, h, sun_xy, sun_r):
    img = Image.new("RGB", (w, h))
    px = img.load()
    sx, sy = sun_xy
    for y in range(h):
        vt = y / max(1, h - 1)
        base = lerp(INK_DEEP, SLATE, vt ** 0.85)
        warm = lerp(SLATE, AMBER, 0.28)
        row = lerp(base, warm, max(0.0, (vt - 0.42) * 1.15))
        for x in range(0, w, 2):
            dx = (x - sx) / sun_r
            dy = (y - sy) / (sun_r * 0.72)
            d = math.sqrt(dx * dx + dy * dy)
            glow = max(0.0, 1.0 - d) ** 1.6
            c = lerp(row, lerp(AMBER, PAPER, 0.35), glow * 0.55)
            # slight horizontal dusk falloff
            edge = abs(x - w / 2) / (w / 2)
            c = lerp(c, INK, edge * 0.18)
            px[x, y] = c
            if x + 1 < w:
                px[x + 1, y] = c
    return img


def tracked_width(text, font, tracking):
    return sum(font.getlength(ch) for ch in text) + tracking * max(0, len(text) - 1)


def draw_tracked(draw, text, x, y, font, fill, tracking):
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += font.getlength(ch) + tracking
    return x


def text_layer(size, text, font, fill, tracking, origin):
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    draw_tracked(d, text, origin[0], origin[1], font, fill, tracking)
    return layer


def paste_glow_text(base, text, font, origin, tracking, fill, glow, blur):
    """base is RGBA."""
    glow_layer = text_layer(base.size, text, font, glow, tracking, origin)
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(glow_layer)
    sharp = text_layer(base.size, text, font, fill, tracking, origin)
    base.alpha_composite(sharp)


def windows_for(rng, x, y, w, h, density=0.62):
    specs = []
    pad_x, pad_y = 5, 6
    cw, ch, gx, gy = 4, 5, 7, 8
    if w < 22:
        cw, gx = 3, 6
    col = pad_x
    while col + cw < w - 3:
        row = pad_y
        while row + ch < h - 4:
            if rng.random() < density:
                hot = rng.random()
                if hot > 0.86:
                    colr = AMBER_HOT
                elif hot < 0.18:
                    colr = AMBER_DIM
                else:
                    colr = AMBER
                specs.append((x + col, y + row, cw, ch, colr))
            row += gy
        col += gx
    return specs


def draw_building(draw, rng, x, y, w, h, fill, window_density=0.62):
    draw.rectangle((x, y, x + w, y + h), fill=fill)
    # parapet lip
    draw.rectangle((x, y, x + w, y + 3), fill=lerp(fill, PAPER, 0.08))
    if rng.random() < 0.35 and w > 30:
        tw = max(6, w // 6)
        tx = x + w // 2 - tw // 2
        draw.rectangle((tx, y - 10, tx + tw, y + 2), fill=lerp(fill, INK, 0.2))
    return windows_for(rng, x, y, w, h, window_density)


def city_row(rng, w, baseline, y_min, y_max, gap=None, palette=None):
    """Return building rects and window specs. gap is (x0, x1, max_height) to keep a canyon."""
    palette = palette or [SLATE, (26, 32, 40), (24, 30, 38), SLATE_LIFT, (22, 27, 34)]
    x = -8
    buildings = []
    windows = []
    while x < w + 8:
        bw = rng.randint(26, 64)
        bh = rng.randint(y_min, y_max)
        if gap and gap[0] - 10 < x + bw and x < gap[1] + 10:
            bh = min(bh, gap[2])
        by = baseline - bh
        fill = palette[rng.randrange(len(palette))]
        buildings.append((x, by, bw, bh, fill))
        windows.extend(windows_for(rng, x, by, bw, bh, 0.58 if bh < 90 else 0.7))
        x += bw + rng.randint(3, 10)
    return buildings, windows


def paint_windows(base, windows, bloom=7):
    glow = Image.new("RGB", base.size, (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    sharp = ImageDraw.Draw(base)
    for x, y, w, h, col in windows:
        gd.rectangle((x - 2, y - 2, x + w + 2, y + h + 2), fill=col)
        sharp.rectangle((x, y, x + w, y + h), fill=col)
    glow = glow.filter(ImageFilter.GaussianBlur(bloom))
    # screen-ish add
    gpx = glow.load()
    bpx = base.load()
    w, h = base.size
    for y in range(h):
        for x in range(0, w):
            r, g, b = bpx[x, y][:3]
            gr, gg, gb = gpx[x, y]
            bpx[x, y] = (
                min(255, r + int(gr * 0.45)),
                min(255, g + int(gg * 0.28)),
                min(255, b + int(gb * 0.12)),
            )


def draw_figure(base, fx, feet_y, scale=1.0, face=1):
    """Small distant person. face=1 looks right, -1 looks left. feet_y is the ground line."""
    s = scale
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    # soft ground contact
    d.ellipse((fx - 7 * s, feet_y - 2 * s, fx + 7 * s, feet_y + 3 * s), fill=(0, 0, 0, 70))
    body_w = 7 * s
    body_h = 16 * s
    top = feet_y - body_h - 7 * s
    # coat
    d.rounded_rectangle(
        (fx - body_w / 2, top + 6 * s, fx + body_w / 2, feet_y),
        radius=3 * s,
        fill=PAPER + (235,),
    )
    # head
    hr = 4.2 * s
    d.ellipse((fx - hr, top, fx + hr, top + hr * 2), fill=PAPER + (245,))
    # amber soul-edge on the facing side
    edge_x = fx + face * (body_w / 2)
    d.line(
        (edge_x, top + 8 * s, edge_x, feet_y - 2 * s),
        fill=AMBER + (210,),
        width=max(1, int(2 * s)),
    )
    base.alpha_composite(layer)


def grain(img, amount=5, seed=3):
    rng = random.Random(seed)
    px = img.load()
    w, h = img.size
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            n = rng.randint(-amount, amount)
            r, g, b = px[x, y][:3]
            c = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)))
            px[x, y] = c
            if x + 1 < w:
                px[x + 1, y] = c
            if y + 1 < h:
                px[x, y + 1] = c
                if x + 1 < w:
                    px[x + 1, y + 1] = c


def vignette(img, strength=0.45):
    px = img.load()
    w, h = img.size
    cx, cy = w / 2, h / 2
    for y in range(h):
        for x in range(0, w, 2):
            dx = (x - cx) / cx
            dy = (y - cy) / cy
            d = math.sqrt(dx * dx * 0.85 + dy * dy)
            k = max(0.0, d - 0.45) / 0.75
            k = min(1.0, k) * strength
            if k <= 0:
                continue
            r, g, b = px[x, y][:3]
            c = lerp((r, g, b), (0, 0, 0), k)
            px[x, y] = c
            if x + 1 < w:
                px[x + 1, y] = c


def stars(draw, rng, w, h, y_max, avoid):
    for _ in range(48):
        x = rng.randint(8, w - 8)
        y = rng.randint(8, y_max)
        if avoid and avoid[0] <= x <= avoid[2] and avoid[1] <= y <= avoid[3]:
            continue
        r = 1 if rng.random() < 0.8 else 1
        a = rng.choice([PAPER, lerp(PAPER, AMBER, 0.4)])
        draw.point((x, y), fill=a)


def lockup(base, title, tagline, center, title_px, tag_px, tracking=6, tag_tracking=3):
    """center is (cx, cy) of the whole lockup. Returns glyph bbox (l, t, r, b)."""
    title_font = ImageFont.truetype(SERIF, title_px)
    tag_font = ImageFont.truetype(SERIF_ITAL, tag_px)
    tw = tracked_width(title, title_font, tracking)
    gw = tracked_width(tagline, tag_font, tag_tracking)
    # vertical rhythm
    title_h = title_px
    tag_h = tag_px
    gap = int(title_px * 0.28)
    block_h = title_h + gap + tag_h
    cx, cy = center
    top = cy - block_h / 2
    title_origin = (cx - tw / 2, top - title_px * 0.18)
    tag_origin = (cx - gw / 2, top + title_h + gap - tag_px * 0.25)
    # measure actual ink after draw using font bbox
    paste_glow_text(
        base, title, title_font, title_origin, tracking,
        PAPER + (255,), AMBER + (180,), blur=10,
    )
    paste_glow_text(
        base, tagline, tag_font, tag_origin, tag_tracking,
        lerp(PAPER, AMBER, 0.18) + (255,), AMBER + (90,), blur=3,
    )
    # ornament: small amber diamond between the lines, centered
    d = ImageDraw.Draw(base)
    oy = top + title_h + gap * 0.42
    diamond(d, cx, oy, 4.5)
    left = min(title_origin[0], tag_origin[0])
    right = max(title_origin[0] + tw, tag_origin[0] + gw)
    bottom = tag_origin[1] + tag_h
    return (left, top, right, bottom)


def diamond(d, cx, cy, r):
    d.polygon(
        [(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)],
        fill=AMBER + (230,),
    )


def render_og():
    w, h = 1200, 630
    rng = random.Random(20)
    sun = (600, 430)
    img = sky(w, h, sun, 260).convert("RGBA")
    draw = ImageDraw.Draw(img)
    stars(draw, rng, w, h, 250, avoid=(250, 180, 950, 460))

    # distant ridge of roofs
    far_rng = random.Random(4)
    far_buildings, far_windows = city_row(
        far_rng, w, baseline=h + 10, y_min=70, y_max=160,
        gap=(300, 900, 90),
        palette=[(32, 40, 50), (36, 44, 54), (28, 35, 44)],
    )
    bd = ImageDraw.Draw(img)
    for x, y, bw, bh, fill in far_buildings:
        bd.rectangle((x, y, x + bw, y + bh), fill=fill)

    # foreground canyon: tall sides, low center so the lockup stays on sky
    near_rng = random.Random(9)
    near_buildings, near_windows = city_row(
        near_rng, w, baseline=h + 20, y_min=150, y_max=300,
        gap=(250, 950, 150),
        palette=[INK, (18, 22, 28), SLATE, (16, 20, 25), (26, 32, 40)],
    )
    for x, y, bw, bh, fill in near_buildings:
        bd.rectangle((x, y, x + bw, y + bh), fill=fill)
        bd.rectangle((x, y, x + bw, y + 3), fill=lerp(fill, PAPER, 0.1))

    # a quiet rooftop terrace in the lower center, two figures across a gap
    terrace_y = 508
    bd.rounded_rectangle((330, terrace_y, 870, h), radius=2, fill=(16, 19, 24, 255))
    # warm path between them
    for i, px in enumerate(range(470, 740, 28)):
        ww = 5
        bd.rectangle((px, terrace_y + 18, px + ww, terrace_y + 24), fill=AMBER)

    # bloom windows (not on the terrace slab)
    rgb = img.convert("RGB")
    paint_windows(rgb, far_windows, bloom=5)
    paint_windows(rgb, near_windows, bloom=8)
    img = rgb.convert("RGBA")

    # figures after bloom so they stay crisp
    draw_figure(img, 430, terrace_y + 2, scale=1.55, face=1)
    draw_figure(img, 770, terrace_y + 2, scale=1.55, face=-1)

    # faint connecting mote
    mote = Image.new("RGBA", img.size, (0, 0, 0, 0))
    md = ImageDraw.Draw(mote)
    md.ellipse((560, terrace_y - 36, 640, terrace_y + 8), fill=AMBER + (40,))
    mote = mote.filter(ImageFilter.GaussianBlur(8))
    img.alpha_composite(mote)

    grain(img, amount=4, seed=11)
    vignette(img, strength=0.42)

    # lockup truly centered
    bbox = lockup(
        img,
        "SOULMATE",
        "two paths, one dusk",
        center=(600, 318),
        title_px=104,
        tag_px=30,
        tracking=7,
        tag_tracking=2.2,
    )
    return img.convert("RGB"), bbox


def render_banner():
    w, h = 1200, 264
    rng = random.Random(21)
    img = sky(w, h, sun_xy=(860, 150), sun_r=220).convert("RGBA")
    draw = ImageDraw.Draw(img)
    stars(draw, rng, w, h, 110, avoid=(20, 10, 560, 190))

    far_rng = random.Random(5)
    far_buildings, far_windows = city_row(
        far_rng, w, baseline=h + 6, y_min=36, y_max=78,
        gap=(0, 520, 46),
        palette=[(34, 42, 52), (30, 38, 48)],
    )
    bd = ImageDraw.Draw(img)
    for x, y, bw, bh, fill in far_buildings:
        bd.rectangle((x, y, x + bw, y + bh), fill=fill)

    near_rng = random.Random(8)
    near_buildings, near_windows = city_row(
        near_rng, w, baseline=h + 16, y_min=70, y_max=150,
        gap=(0, 560, 58),
        palette=[INK, (17, 21, 26), SLATE, (22, 28, 35)],
    )
    for x, y, bw, bh, fill in near_buildings:
        bd.rectangle((x, y, x + bw, y + bh), fill=fill)
        bd.rectangle((x, y, x + bw, y + 2), fill=lerp(fill, PAPER, 0.08))

    # right-side rooftop where the two figures almost meet
    roof_y = 168
    bd.rectangle((760, roof_y, 1120, h), fill=(15, 18, 23, 255))
    for px in range(820, 1060, 26):
        bd.rectangle((px, roof_y + 16, px + 4, roof_y + 21), fill=AMBER)

    rgb = img.convert("RGB")
    paint_windows(rgb, far_windows, bloom=4)
    paint_windows(rgb, near_windows, bloom=6)
    img = rgb.convert("RGBA")

    draw_figure(img, 860, roof_y + 1, scale=1.15, face=1)
    draw_figure(img, 1025, roof_y + 1, scale=1.15, face=-1)

    grain(img, amount=3, seed=6)
    vignette(img, strength=0.35)

    # Left lockup, above the midline, clear of the right half and bottom fifth.
    # Frame is 1200×264. Midline y=132. Right half starts at x=600. Bottom fifth y>211.
    title_font = ImageFont.truetype(SERIF, 54)
    tag_font = ImageFont.truetype(SERIF_ITAL, 20)
    title = "SOULMATE"
    tagline = "two paths, one dusk"
    tracking, tag_tracking = 4, 1.5
    tw = tracked_width(title, title_font, tracking)
    gw = tracked_width(tagline, tag_font, tag_tracking)
    ox, oy = 56, 36
    paste_glow_text(
        img, title, title_font, (ox, oy), tracking,
        PAPER + (255,), AMBER + (170,), blur=7,
    )
    tag_y = oy + 64
    paste_glow_text(
        img, tagline, tag_font, (ox, tag_y), tag_tracking,
        lerp(PAPER, AMBER, 0.15) + (255,), AMBER + (80,), blur=2,
    )
    d = ImageDraw.Draw(img)
    diamond(d, ox + 8, tag_y - 8, 3.2)
    bbox = (ox, oy, max(ox + tw, ox + gw), tag_y + 22)
    return img.convert("RGB"), bbox


def main():
    og, og_box = render_og()
    ban, ban_box = render_banner()
    og.save("/workspace/.grok/og-raw.png", "PNG")
    ban.save("/workspace/.grok/banner-raw.png", "PNG")
    print("og", og.size, "lockup", tuple(round(v, 1) for v in og_box))
    print("banner", ban.size, "lockup", tuple(round(v, 1) for v in ban_box))


if __name__ == "__main__":
    main()
