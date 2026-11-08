# Gera os logotipos dos streamings para os botões de Filmes/Séries, em duas versões:
#   public/streaming/color/<id>.png  — coloridos (padrão), do pacote do usuário
#   public/streaming/mono/<id>.png   — brancos monocromáticos (opção em Ajustes › Aparência)
# Fonte: scripts/streaming-src/<id>.png (coloridos, já na versão para fundo escuro).
# No branco, as partes brancas "por dentro" do Paramount+ (montanha, estrelas) viram vazadas.
# Sem arquivo de fonte: logotipo tipográfico branco (fonte Inter), igual nas duas versões.
# Uso: python3 scripts/streaming-logos.py   (depois atualize logo { w, h } em src/core/vod.ts)
import os
import colorsys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'scripts', 'streaming-src')
OUT = os.path.join(ROOT, 'public', 'streaming')
FONTS = '/usr/share/fonts/opentype/inter/'
H = 144  # altura final (nítida até ~4x numa altura de 30 px)
KNOCKOUT = {'paramount'}

# Sem logotipo no pacote: texto
TEXT = {
    'star': ('Star+', 'Inter-Bold.otf', 0.0),
    'discovery': ('discovery+', 'Inter-Bold.otf', -0.02),
    'hulu': ('hulu', 'Inter-Bold.otf', -0.03),
}

for d in ('color', 'mono'):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)


def crop(im):
    a = im.split()[3].point(lambda v: 255 if v > 40 else 0)
    return im.crop(a.getbbox())


def save(im, sub, name):
    w = round(im.width * H / im.height)
    im.resize((w, H), Image.LANCZOS).save(os.path.join(OUT, sub, name + '.png'), optimize=True)
    return w


def mono(im, knockout):
    im = im.copy()
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if knockout:
                _, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
                if l > 0.82 and s < 0.35:
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


sizes = {}
for f in sorted(os.listdir(SRC)):
    if not f.endswith('.png'):
        continue
    sid = f[:-4]
    im = crop(Image.open(os.path.join(SRC, f)).convert('RGBA'))
    save(im, 'color', sid)
    sizes[sid] = (save(mono(im, sid in KNOCKOUT), 'mono', sid), H)
for sid, (text, font, sp) in TEXT.items():
    if sid in sizes:
        continue
    im = crop(wordmark(text, font, sp))
    save(im, 'color', sid)
    sizes[sid] = (save(im, 'mono', sid), H)
for sid, (w, h) in sorted(sizes.items()):
    print(f"{sid}: {{ w: {w}, h: {h} }}")
