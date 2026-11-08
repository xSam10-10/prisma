# Gera os logotipos dos streamings para os botões de Filmes/Séries:
# todos BRANCOS (monocromáticos), 96 px de altura, recortados.
#  - Logos de imagem: scripts/streaming-src/<id>.png (coloridos, do pacote do usuário).
#    Partes brancas "por dentro" do desenho (ex.: montanha do Paramount+) viram vazadas.
#  - Sem imagem: logotipo tipográfico provisório (fonte Inter) — troque pondo
#    scripts/streaming-src/<id>.png e rodando de novo.
# Uso: python3 scripts/streaming-logos.py
import os, colorsys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'scripts', 'streaming-src')
OUT = os.path.join(ROOT, 'public', 'streaming')
FONTS = '/usr/share/fonts/opentype/inter/'
H = 96
os.makedirs(OUT, exist_ok=True)

WHITE_ALREADY = {'disney', 'hbo', 'apple'}
# id: (texto, fonte, espaçamento entre letras em fração do tamanho)
TEXT = {
    'star': ('Star+', 'Inter-Bold.otf', 0.0),
    'discovery': ('discovery+', 'Inter-Bold.otf', -0.02),
    'funimation': ('funimation', 'Inter-Bold.otf', -0.02),
    'lionsgate': ('LIONSGATE', 'Inter-ExtraBold.otf', 0.0),
    'sbt': ('SBT+', 'Inter-Bold.otf', 0.02),
    'directv': ('DIRECTV', 'Inter-ExtraBold.otf', 0.04),
    'claro': ('claro video', 'Inter-Bold.otf', -0.02),
    'amc': ('AMC+', 'Inter-Bold.otf', 0.04),
    'hulu': ('hulu', 'Inter-Bold.otf', -0.03),
}

def crop(im):
    a = im.split()[3].point(lambda v: 255 if v > 40 else 0)
    return im.crop(a.getbbox())

def finish(im, name):
    im = crop(im)
    w = round(im.width * H / im.height)
    im.resize((w, H), Image.LANCZOS).save(os.path.join(OUT, name + '.png'), optimize=True)
    print(name, (w, H))

def mono(src, white_already):
    im = Image.open(src).convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if not white_already:
                h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
                if l > 0.82 and s < 0.35:  # branco por dentro do desenho: vaza
                    px[x, y] = (255, 255, 255, 0)
                    continue
            px[x, y] = (255, 255, 255, a)
    return im

def wordmark(text, font, spacing):
    size = 300
    f = ImageFont.truetype(FONTS + font, size)
    im = Image.new('RGBA', (int(size * len(text) * 1.1) + 200, int(size * 1.6)), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x = 40
    for ch in text:
        d.text((x, 40), ch, font=f, fill=(255, 255, 255, 255))
        x += d.textlength(ch, font=f) + spacing * size
    return im

for f in sorted(os.listdir(SRC)):
    if f.endswith('.png'):
        sid = f[:-4]
        finish(mono(os.path.join(SRC, f), sid in WHITE_ALREADY), sid)
for sid, (text, font, sp) in TEXT.items():
    if not os.path.exists(os.path.join(SRC, sid + '.png')):
        finish(wordmark(text, font, sp), sid)
