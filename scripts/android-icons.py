# Gera ícones, banner (Google TV), splash e ícone de notificação do Android
# a partir da marca PRISMA (três "plays" sobrepostos). Rodar da raiz:
#   python3 scripts/android-icons.py
import glob
from PIL import Image, ImageDraw, ImageFont

BG = (11, 11, 18, 255)
RES = 'android/app/src/main/res'
FONT = '/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf'

def mark(size, mono=False):
    """Marca em fundo transparente, ocupando o quadrado size×size."""
    S = size * 4
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    h = S * 0.62
    top, bot = (S - h) / 2, (S + h) / 2
    w = h * 0.62
    xs = [S * 0.21, S * 0.31, S * 0.41]
    cols = [(255, 107, 61), (245, 184, 61), (255, 243, 214)]
    for i, (x, c) in enumerate(zip(xs, cols)):
        fill = (255, 255, 255, 255) if mono else c + (255,)
        tri = [(x, top), (x + w, S / 2), (x, bot)]
        if i == 2 and not mono:
            d.polygon(tri, fill=(61, 214, 196, 255))
            k = S * 0.03
            d.polygon([(x + k, top + k * 1.9), (x + w - k * 2.1, S / 2), (x + k, bot - k * 1.9)], fill=fill)
        else:
            d.polygon(tri, fill=fill)
    return im.resize((size, size), Image.LANCZOS)

def save(im, path):
    im.save(path)

def rounded(size, radius):
    m = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1], radius * 4, fill=255)
    return m.resize((size, size), Image.LANCZOS)

for dens, n in {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}.items():
    L = int(48 * n)
    # ícone clássico (quadrado arredondado) e redondo
    bg = Image.new('RGBA', (L, L), BG)
    bg.alpha_composite(mark(L))
    sq = Image.new('RGBA', (L, L), (0, 0, 0, 0)); sq.paste(bg, (0, 0), rounded(L, L * 0.2))
    save(sq, f'{RES}/mipmap-{dens}/ic_launcher.png')
    ci = Image.new('L', (L * 4, L * 4), 0); ImageDraw.Draw(ci).ellipse([0, 0, L * 4 - 1, L * 4 - 1], fill=255)
    rd = Image.new('RGBA', (L, L), (0, 0, 0, 0)); rd.paste(bg, (0, 0), ci.resize((L, L), Image.LANCZOS))
    save(rd, f'{RES}/mipmap-{dens}/ic_launcher_round.png')
    # ícone adaptativo: 108 dp, a marca dentro da área segura (66 dp)
    F = int(108 * n)
    fg = Image.new('RGBA', (F, F), (0, 0, 0, 0))
    m = mark(int(72 * n)); fg.alpha_composite(m, ((F - m.width) // 2, (F - m.height) // 2))
    save(fg, f'{RES}/mipmap-{dens}/ic_launcher_foreground.png')
    # notificação: branco sobre transparente, 24 dp
    import os
    os.makedirs(f'{RES}/drawable-{dens}', exist_ok=True)
    save(mark(int(24 * n), mono=True), f'{RES}/drawable-{dens}/ic_stat_prisma.png')

# Banner da Google TV / Android TV: 320×180 (xhdpi)
B = Image.new('RGBA', (320, 180), BG)
B.alpha_composite(mark(110), (14, 35))
d = ImageDraw.Draw(B)
d.text((118, 90), 'PRISMA', font=ImageFont.truetype(FONT, 46), fill=(244, 244, 248, 255), anchor='lm')
save(B, f'{RES}/drawable-xhdpi/banner.png')

# Splash: fundo do app com a marca no centro
for p in glob.glob(f'{RES}/drawable*/splash.png'):
    w, h = Image.open(p).size
    im = Image.new('RGBA', (w, h), BG)
    s = int(min(w, h) * 0.35)
    im.alpha_composite(mark(s), ((w - s) // 2, (h - s) // 2))
    save(im.convert('RGB'), p)
print('ok')
