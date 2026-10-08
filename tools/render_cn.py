# -*- coding: utf-8 -*-
"""生成中文卡面：保留官方插画，以中文重新排版卡名、种类、属性、适应性、效果文本与数值。
用法：python3 tools/render_cn.py data/cards_public.json"""
import json, os, re, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'public', 'cards')
DST = os.path.join(ROOT, 'public', 'cards_cn')
ICON = os.path.join(ROOT, 'public', 'icons')
FONT = '/System/Library/Fonts/Hiragino Sans GB.ttc'
W, H = 400, 559
S = 2  # 超采样
COL = {'red': (196, 32, 44), 'blue': (28, 104, 186), 'green': (40, 146, 62), 'purple': (118, 58, 170), None: (96, 96, 100)}
TYPE_IMG = {'火': 'fire', '水': 'water', '草': 'grass', '雷': 'thunder', '地': 'earth', '冰': 'ice', '暗': 'dark', '龙': 'dragon', '无': 'none'}
KIND_CN = {'pal': '帕鲁', 'building': '建筑物', 'gear': '装备', 'event': '事件'}

_fc = {}
def font(sz, bold=False):
    k = (sz, bold)
    if k not in _fc: _fc[k] = ImageFont.truetype(FONT, sz * S, index=1 if bold else 0)
    return _fc[k]
def icon(name, h):
    im = Image.open(os.path.join(ICON, name)).convert('RGBA')
    return im.resize((max(1, round(im.width * h * S / im.height)), h * S), Image.LANCZOS)
def sc(*v): return tuple(int(x * S) for x in v)
def darker(c, f=0.6): return tuple(int(x * f) for x in c)

def art_box(src_im, fname, kind):
    w, h = src_im.size
    full = re.search(r'(OSR|SSP|SP|S)\.png$', fname) is not None
    if w > h:  # 横版建筑物：左侧插画
        return src_im.crop((14, 14, int(w * 0.50), int(h * 0.78)))
    if full:
        return src_im.crop((10, 60, w - 10, int(h * 0.74)))
    return src_im.crop((14, 14, w - 14, int(h * 0.55)))

def cover(im, tw, th):
    r = max(tw / im.width, th / im.height)
    im = im.resize((max(tw, round(im.width * r)), max(th, round(im.height * r))), Image.LANCZOS)
    x = (im.width - tw) // 2; y = max(0, (im.height - th) // 3)
    return im.crop((x, y, x + tw, y + th))

def wrap(draw, text, fnt, maxw):
    lines = []
    for para in text.split('\n'):
        cur = ''
        for ch in para:
            if draw.textlength(cur + ch, font=fnt) + (cur + ch).count('【') * 6 * S > maxw and cur:
                # 避免行首标点
                if ch in '，。、）】〉」；：！？' and len(cur) > 1:
                    lines.append(cur[:-1]); cur = cur[-1] + ch
                else:
                    lines.append(cur); cur = ch
            else:
                cur += ch
        lines.append(cur)
    return lines

TOKEN = re.compile(r'(【[^】]+】|〈[^〉]*〉|［[^］]+］)')
def draw_rich(draw, x, y, line, fnt, base=(30, 30, 30)):
    for part in TOKEN.split(line):
        if not part: continue
        if part.startswith('【'):
            inner = part[1:-1]; pad = 3 * S
            tw = draw.textlength(inner, font=fnt) + pad * 2
            draw.rounded_rectangle((x + S, y + 1 * S, x + tw, y + fnt.size + 3 * S), radius=4 * S, fill=(70, 70, 76))
            draw.text((x + pad, y), inner, font=fnt, fill=(255, 236, 160))
            x += tw + 2 * S
            continue
        elif part.startswith('［'):
            draw.text((x, y), part, font=fnt, fill=(150, 40, 30))
        else:
            draw.text((x, y), part, font=fnt, fill=base)
        x += draw.textlength(part, font=fnt)

def render(card, fname):
    src = Image.open(os.path.join(SRC, fname)).convert('RGB')
    kind = card['kind']; col = COL.get(card['color'])
    im = Image.new('RGB', sc(W, H), (24, 24, 28))
    d = ImageDraw.Draw(im)
    # 外框
    d.rounded_rectangle(sc(0, 0, W - 1, H - 1), radius=18 * S, fill=(30, 32, 36))
    d.rounded_rectangle(sc(8, 8, W - 9, H - 9), radius=12 * S, fill=darker(col, 0.45))
    # 插画
    ART = (14, 14, W - 14, 318)
    art = cover(art_box(src, fname, kind), (ART[2] - ART[0]) * S, (ART[3] - ART[1]) * S)
    mask = Image.new('L', art.size, 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, art.width - 1, art.height - 1), radius=8 * S, fill=255)
    im.paste(art, sc(ART[0], ART[1]), mask)
    # 费用菱形
    cx, cy, r = 44, 46, 30
    d.polygon([sc(cx, cy - r), sc(cx + r, cy), sc(cx, cy + r), sc(cx - r, cy)], fill=(255, 255, 255))
    r2 = r - 4
    d.polygon([sc(cx, cy - r2), sc(cx + r2, cy), sc(cx, cy + r2), sc(cx - r2, cy)], fill=col)
    d.text(sc(cx, cy + 1), str(card['cost']), font=font(30, True), fill='white', anchor='mm')
    # 幸运/快速标记
    bx = W - 58
    if card.get('lucky'):
        d.rounded_rectangle(sc(bx, 20, bx + 38, 58), radius=8 * S, fill=(30, 30, 30), outline=(230, 200, 90), width=2 * S)
        d.text(sc(bx + 19, 39), '☆', font=font(24, True), fill=(255, 220, 90), anchor='mm')
        bx -= 46
    if card.get('quick'):
        d.rounded_rectangle(sc(bx - 10, 24, bx + 38, 54), radius=8 * S, fill=(255, 210, 60))
        d.text(sc(bx + 14, 39), '快速', font=font(15, True), fill=(40, 30, 0), anchor='mm')
    # 种类标签
    y0 = 300
    kt = KIND_CN[kind] + ('·幸运' if card.get('lucky') else '')
    kw_ = d.textlength(kt, font=font(14, True)) / S + 24
    d.rounded_rectangle(sc(18, y0 - 2, 18 + kw_, y0 + 22), radius=6 * S, fill=(25, 25, 28))
    d.text(sc(30, y0 + 10), kt, font=font(14, True), fill='white', anchor='lm')
    # 卡名条
    ny = y0 + 24
    d.rectangle(sc(14, ny, W - 14, ny + 40), fill=col)
    d.rectangle(sc(14, ny + 36, W - 14, ny + 40), fill=darker(col, 0.7))
    name = card['name']
    parts = name.split(' ', 1)
    sub, main = (parts[0], parts[1]) if len(parts) == 2 else ('', name)
    fx = 24
    if sub:
        fs = 14
        d.text(sc(fx, ny + 20), sub, font=font(fs, True), fill=(255, 240, 220), anchor='lm')
        fx += d.textlength(sub, font=font(fs, True)) / S + 8
    ms = 24
    while ms > 14 and fx + d.textlength(main, font=font(ms, True)) / S > W - 60: ms -= 1
    d.text(sc(fx, ny + 19), main, font=font(ms, True), fill='white', anchor='lm', stroke_width=2 * S // 2, stroke_fill=darker(col, 0.5))
    # 属性图标
    tx = W - 22
    for t in reversed(card.get('types') or []):
        if t in TYPE_IMG:
            ic = icon('type_img_attribute-%s.png' % TYPE_IMG[t], 28)
            tx -= ic.width // S + 2
            im.paste(ic, sc(tx, ny + 6), ic)
    # 适应性行
    ay = ny + 44
    d.rectangle(sc(14, ay, W - 14, ay + 22), fill=(44, 44, 48))
    chips = list(card.get('apts') or [])
    x = 20
    for a in chips:
        tw = d.textlength(a, font=font(12, True)) / S + 14
        d.rounded_rectangle(sc(x, ay + 3, x + tw, ay + 19), radius=8 * S, fill=(235, 230, 215))
        d.text(sc(x + tw / 2, ay + 11), a, font=font(12, True), fill=(40, 40, 40), anchor='mm')
        x += tw + 5
    # 文本框
    tb = (14, ay + 26, W - 14, H - 64)
    d.rounded_rectangle(sc(*tb), radius=6 * S, fill=(244, 239, 226))
    text = card.get('text') or ''
    fs = 15
    while True:
        f = font(fs)
        lines = wrap(d, text, f, (tb[2] - tb[0] - 16) * S)
        lh = fs * 1.42
        if len(lines) * lh <= tb[3] - tb[1] - 12 or fs <= 9: break
        fs -= 1
    yy = tb[1] + 7
    for ln in lines:
        draw_rich(d, (tb[0] + 8) * S, yy * S, ln, f)
        yy += lh
    # 底部数值
    by = H - 60
    if kind in ('pal', 'building'):
        lab = '战斗力' if kind == 'pal' else '耐久力'
        ic = icon('texticon_アイコン_%s黒.png' % ('戦闘力' if kind == 'pal' else '耐久力'), 22)
        bx0 = 110
        d.rounded_rectangle(sc(bx0, by, bx0 + 150, by + 38), radius=8 * S, fill=col)
        d.rounded_rectangle(sc(bx0 - 46, by + 2, bx0 + 4, by + 36), radius=6 * S, fill=(245, 245, 245))
        im.paste(ic, sc(bx0 - 36, by + 4), ic)
        d.text(sc(bx0 - 21, by + 30), lab, font=font(9, True), fill=(30, 30, 30), anchor='mm')
        d.text(sc(bx0 + 78, by + 19), str(card['power']), font=font(28, True), fill='white', anchor='mm')
        if kind == 'pal':
            sx = bx0 + 162
            d.rounded_rectangle(sc(sx, by, sx + 64, by + 38), radius=8 * S, fill=(245, 245, 245))
            d.text(sc(sx + 32, by + 9), '打击力', font=font(10, True), fill=(30, 30, 30), anchor='mm')
            si = icon('texticon_アイコン_打撃力黒.png', 16)
            im.paste(si, sc(sx + 12, by + 18), si)
            d.text(sc(sx + 44, by + 26), str(card['strike']), font=font(20, True), fill=darker(col, 0.9), anchor='mm')
    num = os.path.splitext(os.path.basename(fname))[0]
    d.text(sc(20, H - 12), num, font=font(9), fill=(200, 200, 200), anchor='lm')
    d.text(sc(W - 20, H - 12), '©PALWORLD', font=font(9), fill=(200, 200, 200), anchor='rm')
    out = os.path.join(DST, os.path.splitext(fname)[0] + '.jpg')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.resize((W, H), Image.LANCZOS).save(out, quality=88, optimize=True)

if __name__ == '__main__':
    cards = json.load(open(sys.argv[1], encoding='utf-8'))
    only = sys.argv[2:] 
    n = 0
    for c in cards:
        for fname in c['imgs']:
            if only and not any(o in fname for o in only): continue
            render(c, fname); n += 1
    print('rendered', n)
