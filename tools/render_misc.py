# -*- coding: utf-8 -*-
"""灵魂卡中文化 + 生成卡背"""
import os, glob, random
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
F = ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc', 22, index=1)
os.makedirs(os.path.join(ROOT, 'cards_cn', 'SOUL'), exist_ok=True)
for f in glob.glob(os.path.join(ROOT, 'cards', 'SOUL', '*.png')):
    im = Image.open(f).convert('RGB'); d = ImageDraw.Draw(im)
    d.rounded_rectangle((140, 506, 258, 540), radius=6, fill=(22, 22, 24))
    d.text((199, 523), '灵 魂', font=F, fill='white', anchor='mm')
    im.save(os.path.join(ROOT, 'cards_cn', 'SOUL', os.path.basename(f)[:-4] + '.jpg'), quality=90)

# 卡背：深色低多边形 + 官方 LOGO
W, H = 400, 559
im = Image.new('RGB', (W, H), (34, 30, 28)); d = ImageDraw.Draw(im)
random.seed(3)
s = 40
for y in range(-1, H // s + 2):
    for x in range(-1, W // s + 2):
        ox = x * s + (s // 2 if y % 2 else 0)
        for tri in (((ox, y * s), (ox + s, y * s), (ox + s // 2, y * s + s)), ((ox + s // 2, y * s + s), (ox + s * 3 // 2, y * s + s), (ox + s, y * s))):
            v = random.randint(0, 22)
            d.polygon(tri, fill=(44 + v, 38 + v, 34 + v))
d.rounded_rectangle((6, 6, W - 7, H - 7), radius=16, outline=(201, 168, 106), width=5)
d.rounded_rectangle((18, 18, W - 19, H - 19), radius=10, outline=(140, 112, 70), width=2)
logo = Image.open(os.path.join(ROOT, 'ui', 'logo.png')).convert('RGBA')
logo.thumbnail((320, 140))
im.paste(logo, ((W - logo.width) // 2, (H - logo.height) // 2), logo)
im.save(os.path.join(ROOT, 'ui', 'card_back.jpg'), quality=90)
print('ok')
