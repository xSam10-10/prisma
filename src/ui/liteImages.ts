// TV LG (1.0.2): imagens menores do TMDB.
//
// Na B7, decodificar um fundo w780 leva ~0,25 s e o Início chegava a gastar 8 s
// só decodificando imagens ao andar com as setas. Aqui, só na versão LITE, todo
// endereço do TMDB que chega a um <img> troca para um tamanho menor — a tela de
// 1080 p da TV mostra os cartões com ~170–340 px, então a perda de nitidez é pequena.
// Um ponto só (setAttribute/src), sem mexer nas 54 imagens do app.

const MAP: Record<string, string> = {
  original: 'w780',
  w1280: 'w780',
  w780: 'w300',
  w500: 'w342',
  w600_and_h900_bestv2: 'w342',
  w600_and_h900_face: 'w342',
};

const RX = /(\/\/image\.tmdb\.org\/t\/p\/)([a-z0-9_]+)(\/)/;

export function liteImageUrl(url: string): string {
  if (typeof url !== 'string' || url.indexOf('image.tmdb.org') < 0) return url;
  return url.replace(RX, (all, a: string, size: string, b: string) => (MAP[size] ? a + MAP[size] + b : all));
}

let installed = false;
export function installLiteImages(): void {
  if (installed) return;
  installed = true;
  try {
    const setAttr = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (this: Element, name: string, value: string) {
      if ((name === 'src' || name === 'srcset') && this.tagName === 'IMG') value = liteImageUrl(String(value));
      return setAttr.call(this, name, value);
    };
    // Chrome 38: "src" é propriedade de cada elemento (não do protótipo), e o
    // React grava img.src = … — então cada <img> criado ganha o seu src trocado.
    const getAttr = Element.prototype.getAttribute;
    const wrap = (el: Element) => {
      try {
        Object.defineProperty(el, 'src', {
          configurable: true,
          enumerable: true,
          get(this: Element) {
            const v = getAttr.call(this, 'src');
            if (!v) return '';
            const a = document.createElement('a');
            a.href = v;
            return a.href;
          },
          set(this: Element, v: string) {
            setAttr.call(this, 'src', liteImageUrl(String(v)));
          },
        });
      } catch {
        /* ignora */
      }
    };
    const create = Document.prototype.createElement;
    Document.prototype.createElement = function (this: Document, tag: string, opts?: ElementCreationOptions) {
      const el = create.call(this, tag, opts as ElementCreationOptions);
      if (typeof tag === 'string' && tag.toLowerCase() === 'img') wrap(el);
      return el;
    } as typeof Document.prototype.createElement;
  } catch {
    /* sem como trocar: segue com as imagens originais */
  }
}
