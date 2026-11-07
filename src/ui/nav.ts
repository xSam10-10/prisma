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
export function findNeighbor(from: HTMLElement, dir: Dir, root?: HTMLElement): HTMLElement | null {
  const a = from.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of focusables(root)) {
    if (el === from || from.contains(el)) continue;
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

/** Sobe na árvore até um [data-nav-group] (sem Element.closest: a TV de 2017 não tem). */
function groupOf(el: HTMLElement): HTMLElement | null {
  let p: HTMLElement | null = el;
  while (p && p !== document.body) {
    if (p.hasAttribute && p.hasAttribute('data-nav-group')) return p;
    p = p.parentElement;
  }
  return null;
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
    let next = findNeighbor(cur, d, scope);
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
