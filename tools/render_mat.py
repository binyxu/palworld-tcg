# -*- coding: utf-8 -*-
"""生成对战桌布（参考官方桌布：天空蓝低多边形 + 草地边缘 + 金色 LOGO）"""
import os, random
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'ui')
W, H = 1600, 1000
random.seed(7)
im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
s = 56
for y in range(-1, H // s + 2):
    for x in range(-1, W // s + 2):
        ox = x * s + (s // 2 if y % 2 else 0)
        for tri in (((ox, y * s), (ox + s, y * s), (ox + s // 2, y * s + s)), ((ox + s // 2, y * s + s), (ox + s * 3 // 2, y * s + s), (ox + s, y * s))):
            cx = sum(p[0] for p in tri) / 3; cy = sum(p[1] for p in tri) / 3
            dist = abs(cy - H / 2) / (H / 2)  # 中线浅，两侧深
            base = lerp((196, 228, 246), (52, 122, 190), dist ** 0.8)
            edge = min(cx, W - cx) / W
            if edge < 0.08: base = lerp((78, 128, 60), base, edge / 0.08)  # 两侧草地
            v = random.randint(-14, 14)
            d.polygon(tri, fill=tuple(max(0, min(255, c + v)) for c in base))
im = im.filter(ImageFilter.GaussianBlur(0.6))
# 云带
cl = Image.new('L', (W, H), 0); cd = ImageDraw.Draw(cl)
for _ in range(60):
    x = random.randint(0, W); y = H // 2 + random.randint(-90, 90); r = random.randint(40, 120)
    cd.ellipse((x - r * 2, y - r, x + r * 2, y + r), fill=random.randint(60, 120))
cl = cl.filter(ImageFilter.GaussianBlur(40))
im = Image.composite(Image.new('RGB', (W, H), (255, 255, 255)), im, cl)
logo = Image.open(os.path.join(ROOT, 'logo.png')).convert('RGBA'); logo.thumbnail((620, 260))
a = logo.split()[3].point(lambda v: int(v * 0.35)); logo.putalpha(a)
im.paste(logo, ((W - logo.width) // 2, (H - logo.height) // 2), logo)
im.save(os.path.join(ROOT, 'playmat.jpg'), quality=85)
print('ok')
