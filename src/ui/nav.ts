import { navSound } from './sound';
// Navegação por controle remoto (D-pad): foco espacial.
// Qualquer elemento com o atributo data-nav pode receber foco. As setas
// procuram o vizinho mais próximo na direção apertada, dentro do escopo
// ativo (o último [data-nav-scope] aberto, como o player em tela cheia).
// Componentes podem tratar as próprias teclas no onKeyDown e chamar
// e.preventDefault() para que o foco espacial não interfira.

export type Dir = 'up' | 'down' | 'left' | 'right';

export const KEY = {
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  ENTER: 13,
  BACK_WEBOS: 461,
  ESC: 27,
  BACKSPACE: 8,
  CH_UP: 33, // PageUp: Canal + na LG
  CH_DOWN: 34, // PageDown: Canal −
  RED: 403,
  GREEN: 404,
  YELLOW: 405,
  BLUE: 406,
  PLAY: 415,
  PAUSE: 19,
  PLAY_PAUSE: 10252,
  STOP: 413,
} as const;

export function dirOf(e: KeyboardEvent | React.KeyboardEvent): Dir | null {
  switch (e.keyCode || 0) {
    case KEY.LEFT:
      return 'left';
    case KEY.UP:
      return 'up';
    case KEY.RIGHT:
      return 'right';
    case KEY.DOWN:
      return 'down';
  }
  switch (e.key) {
    case 'ArrowLeft':
      return 'left';
    case 'ArrowUp':
      return 'up';
    case 'ArrowRight':
      return 'right';
    case 'ArrowDown':
      return 'down';
  }
  return null;
}

export function isBack(e: KeyboardEvent | React.KeyboardEvent): boolean {
  const k = e.keyCode;
  if (k === KEY.BACK_WEBOS || k === KEY.ESC || e.key === 'GoBack' || e.key === 'BrowserBack') return true;
  if (k === KEY.BACKSPACE) {
    const t = e.target as HTMLElement | null;
    return !(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'));
  }
  return false;
}

export function isEnter(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return e.keyCode === KEY.ENTER || e.key === 'Enter';
}

function activeScope(): HTMLElement {
  const scopes = document.querySelectorAll<HTMLElement>('[data-nav-scope]');
  return scopes.length ? scopes[scopes.length - 1] : document.body;
}

function visible(el: HTMLElement): boolean {
  if (el.hasAttribute('disabled')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

export function focusables(root: HTMLElement = activeScope()): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('[data-nav]')].filter(visible);
}

/** Escolhe o melhor vizinho na direção pedida. */
export function findNeighbor(from: HTMLElement, dir: Dir, root?: HTMLElement, exclude?: HTMLElement | null): HTMLElement | null {
  // Saindo de uma fileira (carrossel) para cima/baixo: vai para a fileira MAIS PRÓXIMA,
  // na capa mais perto — mesmo que ela seja curta (não pula fileiras).
  if (exclude && (dir === 'up' || dir === 'down')) {
    const a = from.getBoundingClientRect();
    const ax = a.left + a.width / 2;
    const cands: { el: HTMLElement; main: number; cross: number }[] = [];
    for (const el of focusables(root)) {
      if (el === from || from.contains(el) || exclude.contains(el)) continue;
      const b = el.getBoundingClientRect();
      const by = b.top + b.height / 2;
      const ay = a.top + a.height / 2;
      if (dir === 'up' ? by >= ay : by <= ay) continue;
      cands.push({ el, main: Math.max(0, dir === 'up' ? a.top - b.bottom : b.top - a.bottom), cross: Math.abs(b.left + b.width / 2 - ax) });
    }
    if (!cands.length) return null;
    const near = Math.min(...cands.map((c) => c.main));
    let best: (typeof cands)[0] | null = null;
    for (const c of cands) if (c.main <= near + 40 && (!best || c.cross < best.cross)) best = c;
    return best ? best.el : null;
  }
  const a = from.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of focusables(root)) {
    if (el === from || from.contains(el)) continue;
    if (exclude && exclude.contains(el)) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    let main: number; // distância na direção
    let cross: number; // desvio lateral
    let overlap: boolean;
    if (dir === 'left' || dir === 'right') {
      main = dir === 'left' ? a.left - b.right : b.left - a.right;
      if (dir === 'left' ? bx >= ax : bx <= ax) continue;
      cross = Math.abs(by - ay);
      overlap = b.top < a.bottom && b.bottom > a.top;
    } else {
      main = dir === 'up' ? a.top - b.bottom : b.top - a.bottom;
      if (dir === 'up' ? by >= ay : by <= ay) continue;
      cross = Math.abs(bx - ax);
      overlap = b.left < a.right && b.right > a.left;
    }
    main = Math.max(0, main);
    // Prefere o que está alinhado (sobreposto) com o elemento atual.
    const score = main + cross * (overlap ? 0.3 : 2.5) + (overlap ? 0 : 40);
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

/**
 * Rola só o contêiner mais próximo (fileira de chips, prateleira) para o
 * elemento ficar à vista. Não usa scrollIntoView com opções, que o
 * Chromium 38 da TV trata como "alinhar no topo" e desloca a tela toda.
 */
export function ensureVisible(el: HTMLElement): void {
  let p = el.parentElement;
  while (p && !p.classList.contains('stage')) {
    if (p.classList.contains('scroll-x') || p.classList.contains('scroll-y')) {
      const er = el.getBoundingClientRect();
      const pr = p.getBoundingClientRect();
      const k = pr.width / (p.clientWidth || pr.width) || 1; // escala do palco
      if (er.left < pr.left) p.scrollLeft -= (pr.left - er.left) / k + 8;
      else if (er.right > pr.right) p.scrollLeft += (er.right - pr.right) / k + 8;
      if (er.top < pr.top) p.scrollTop -= (pr.top - er.top) / k + 8;
      else if (er.bottom > pr.bottom) p.scrollTop += (er.bottom - pr.bottom) / k + 8;
    }
    p = p.parentElement;
  }
  resetStageScroll();
}

/** Na TV antiga, focar um elemento rola o palco sozinho: desfaz. */
function resetStageScroll() {
  const st = document.querySelector<HTMLElement>('.stage');
  if (st && (st.scrollTop || st.scrollLeft)) {
    st.scrollTop = 0;
    st.scrollLeft = 0;
  }
  const vp = st?.parentElement;
  if (vp && (vp.scrollTop || vp.scrollLeft)) {
    vp.scrollTop = 0;
    vp.scrollLeft = 0;
  }
}

export function focusEl(el: HTMLElement | null | undefined): boolean {
  if (!el) return false;
  if (el !== document.activeElement && document.documentElement.classList.contains('kbd')) navSound('move');
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
  ensureVisible(el);
  return true;
}

export function focusFirst(root?: HTMLElement | null, selector?: string): boolean {
  const scope = root ?? activeScope();
  if (selector) {
    const el = scope.querySelector<HTMLElement>(selector);
    if (el && visible(el)) return focusEl(el);
  }
  const pref = scope.querySelector<HTMLElement>('[data-nav-default]');
  if (pref && visible(pref)) return focusEl(pref);
  return focusEl(focusables(scope)[0]);
}

// ---- Pilha de "Voltar" -------------------------------------------------
type BackHandler = () => boolean | void; // true = tratado
const backStack: BackHandler[] = [];

export function pushBack(h: BackHandler): () => void {
  backStack.push(h);
  return () => {
    const i = backStack.lastIndexOf(h);
    if (i >= 0) backStack.splice(i, 1);
  };
}

/** Sobe na árvore até um elemento com o atributo (sem Element.closest: a TV de 2017 não tem). */
function upTo(el: HTMLElement, attr: string): HTMLElement | null {
  let p: HTMLElement | null = el;
  while (p && p !== document.body) {
    if (p.hasAttribute && p.hasAttribute(attr)) return p;
    p = p.parentElement;
  }
  return null;
}
function groupOf(el: HTMLElement): HTMLElement | null {
  return upTo(el, 'data-nav-group');
}

let installed = false;

export function installNavigation(): void {
  if (installed) return;
  installed = true;
  const html = document.documentElement;

  window.addEventListener('mousedown', () => html.classList.remove('kbd'), true);
  window.addEventListener('keydown', (e) => {
    const d = dirOf(e);
    if (d || isEnter(e)) html.classList.add('kbd');
    if (isEnter(e)) navSound('ok');
    if (e.defaultPrevented) return;

    if (isBack(e)) {
      for (let i = backStack.length - 1; i >= 0; i--) {
        if (backStack[i]() !== false) {
          e.preventDefault();
          return;
        }
      }
      return; // nada a fazer: deixa o sistema tratar (sair do app)
    }

    if (!d) return;
    const scope = activeScope();
    const cur = document.activeElement as HTMLElement | null;
    // Em campos de texto, esquerda/direita andam no texto.
    if (cur && cur.tagName === 'INPUT' && (d === 'left' || d === 'right')) {
      const inp = cur as HTMLInputElement;
      const atStart = inp.selectionStart === 0 && inp.selectionEnd === 0;
      const atEnd = inp.selectionStart === inp.value.length;
      if ((d === 'left' && !atStart) || (d === 'right' && !atEnd)) return;
    }
    e.preventDefault();
    if (!cur || cur === document.body || !scope.contains(cur)) {
      focusFirst(scope);
      return;
    }
    // Fileira (carrossel): ◀ ▶ andam só dentro dela; nas pontas, não pulam para outra fileira.
    // E ▲▼ sempre saem dela (capas com título de 2 linhas parecem "mais baixas" que as vizinhas).
    const curRow = upTo(cur, 'data-nav-row');
    if (curRow && (d === 'left' || d === 'right')) {
      const inRow = findNeighbor(cur, d, curRow);
      if (inRow) focusEl(inRow);
      return;
    }
    // Bloco com borda (ex.: coluna de categorias, data-nav-stop="left"): na borda, fica parado.
    const stop = upTo(cur, 'data-nav-stop');
    if (stop && (stop.getAttribute('data-nav-stop') || '').indexOf(d) >= 0) {
      const inside = findNeighbor(cur, d, stop);
      if (inside) focusEl(inside);
      return;
    }
    // ▲▼ dentro de uma área que rola (Início, colunas): procura primeiro nela — uma fileira
    // rolada para cima, escondida sob o cabeçalho, ainda é a de cima, e não o menu do topo.
    let next: HTMLElement | null = null;
    if (d === 'up' || d === 'down') {
      let sc: HTMLElement | null = cur.parentElement;
      while (sc && sc !== scope && !(sc.classList && sc.classList.contains('scroll-y'))) sc = sc.parentElement;
      if (sc && sc !== scope) next = findNeighbor(cur, d, sc, curRow);
    }
    if (!next) next = findNeighbor(cur, d, scope, d === 'up' || d === 'down' ? curRow : null);
    // Entrando num grupo (ex.: coluna de categorias): vai para o item ativo,
    // e não para o vizinho mais próximo (que trocaria a categoria sem querer).
    const grp = next ? groupOf(next) : null;
    if (grp && !grp.contains(cur)) {
      const act = grp.querySelector<HTMLElement>('[data-nav-active]');
      if (act && visible(act)) next = act;
    }
    if (next) focusEl(next);
  });
}
