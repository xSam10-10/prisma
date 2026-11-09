import { T } from './tokens';

// Temas do PRISMA: só aparência (cores, botões, cantos, fonte). A estrutura
// (A, B, C) é escolhida à parte. Funciona sem variáveis CSS (TV de 2017):
// as cores-base do tema Prisma são trocadas direto nas regras carregadas.

export interface Theme {
  id: string;
  name: string;
  bg: string;
  surface: string;
  text: string;
  text2: string;
  primary: string;
  onPrimary: string;
  live: string;
  warn: string;
  /** cores das manchas de luz do fundo */
  ambient: [string, string, string];
  square?: boolean;
  /** fonte dos títulos */
  titleFont?: string;
  /** cor de destaque em telas (selecionado) */
  sel?: string;
}

export const THEMES: Theme[] = [
  { id: 'prisma', name: 'Prisma', bg: '#0B0B12', surface: '#1E1E2A', text: '#F4F4F8', text2: '#A6A6B8', primary: '#3DD6C4', onPrimary: '#0B0B12', live: '#FF6B3D', warn: '#F5B83D', ambient: ['#7A2E9C', '#3DD6C4', '#FF6B3D'] },
  { id: 'netflix', name: 'Netflix', bg: '#141414', surface: '#1F1F1F', text: '#FFFFFF', text2: '#B3B3B3', primary: '#FFFFFF', onPrimary: '#000000', live: '#E50914', warn: '#46D369', ambient: ['#E50914', '#7A0A0F', '#2F2F2F'], square: true, titleFont: "'Inter', sans-serif" },
  { id: 'hbo', name: 'HBO Max', bg: '#08081F', surface: '#17173D', text: '#F4F3FF', text2: '#A9A6D6', primary: '#7B5CFF', onPrimary: '#FFFFFF', live: '#FF4D7D', warn: '#C9A6FF', ambient: ['#3D2BFF', '#A020F0', '#002BE7'] },
  { id: 'disney', name: 'Disney+', bg: '#0E1424', surface: '#1A1D29', text: '#F9F9F9', text2: '#A8B0C2', primary: '#0063E5', onPrimary: '#FFFFFF', live: '#FF5A5F', warn: '#00D4FF', ambient: ['#1F80E0', '#00D4FF', '#0B1A3D'] },
  { id: 'prime', name: 'Prime Video', bg: '#0F171E', surface: '#1A242F', text: '#F2F4F5', text2: '#8197A4', primary: '#00A8E1', onPrimary: '#0F171E', live: '#FF6138', warn: '#F2C94C', ambient: ['#00A8E1', '#1A4D8F', '#0F171E'], square: true },
  // OLED: preto absoluto (ótimo na LG OLED), sem manchas de luz; a cor fica só nas artes.
  { id: 'oled', name: 'OLED (preto absoluto)', bg: '#000000', surface: '#0A0A0C', text: '#FFFFFF', text2: '#9A9AA6', primary: '#F4F4F8', onPrimary: '#000000', live: '#FF453A', warn: '#FFD60A', ambient: ['#000000', '#000000', '#000000'] },
  { id: 'apple', name: 'Apple TV', bg: '#000000', surface: '#1C1C1E', text: '#F5F5F7', text2: '#8E8E93', primary: '#F5F5F7', onPrimary: '#000000', live: '#FF453A', warn: '#FFD60A', ambient: ['#3A3A3C', '#8E8E93', '#1C1C1E'] },
  { id: 'globoplay', name: 'Globoplay', bg: '#120A0E', surface: '#22141B', text: '#FFFFFF', text2: '#B9A9B1', primary: '#FB2E5A', onPrimary: '#FFFFFF', live: '#FF7A00', warn: '#FFB000', ambient: ['#FB2E5A', '#FF7A00', '#5B1430'] },
];

export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

// Cores-base (tema Prisma) como o navegador as normaliza nas regras.
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const BASE = THEMES[0];

/** Pares [cor do Prisma, papel] trocados no CSS. */
function pairs(t: Theme): [[number, number, number], [number, number, number]][] {
  const sur = rgb(t.surface);
  return [
    [rgb(BASE.primary), rgb(t.primary)],
    [rgb(BASE.live), rgb(t.live)],
    [rgb(BASE.warn), rgb(t.warn)],
    [rgb(BASE.bg), rgb(t.bg)],
    [rgb(BASE.text), rgb(t.text)],
    [rgb(BASE.text2), rgb(t.text2)],
    [[30, 30, 42], sur],
    [[24, 24, 34], sur],
    [[21, 21, 31], sur],
    [[228, 228, 238], rgb(t.text)],
  ];
}

const originals = new WeakMap<CSSStyleRule, string>();

function rewrite(text: string, map: ReturnType<typeof pairs>): string {
  // "rgb(61, 214, 196)" / "rgba(61, 214, 196, 0.5)" e também "#3dd6c4"
  return text.replace(/rgba?\((\d+),\s*(\d+),\s*(\d+)(,\s*[\d.]+)?\)|#[0-9a-fA-F]{6}\b/g, (m, r, g, b, a) => {
    const c: [number, number, number] = r ? [+r, +g, +b] : rgb(m);
    const hit = map.find(([from]) => from[0] === c[0] && from[1] === c[1] && from[2] === c[2]);
    if (!hit) return m;
    const [x, y, z] = hit[1];
    return a ? `rgba(${x}, ${y}, ${z}${a})` : `rgb(${x}, ${y}, ${z})`;
  });
}

function eachRule(list: CSSRuleList, fn: (r: CSSStyleRule) => void) {
  for (let i = 0; i < list.length; i++) {
    const r = list[i] as CSSRule & { cssRules?: CSSRuleList; style?: CSSStyleDeclaration };
    // Regra de estilo primeiro (no Chrome novo ela também tem .cssRules, vazio).
    if (r.style) fn(r as CSSStyleRule);
    else if (r.cssRules) eachRule(r.cssRules, fn);
  }
}

/** Aplica o tema em todas as regras CSS do app + regras extras do tema. */
export function applyTheme(t: Theme): void {
  // Inline (componentes): troca o objeto de cores.
  Object.assign(T, { bg: t.bg, text: t.text, text2: t.text2, primary: t.primary, live: t.live, warn: t.warn, radiusPanel: t.square ? 8 : 28, ambient: t.ambient });
  const map = pairs(t);
  const sheets = document.styleSheets;
  for (let i = 0; i < sheets.length; i++) {
    const sh = sheets[i];
    if (sh.ownerNode && (sh.ownerNode as HTMLElement).id === 'prisma-theme') continue;
    let rules: CSSRuleList;
    try {
      rules = sh.cssRules;
    } catch {
      continue; // folha de outro domínio (fontes)
    }
    eachRule(rules, (r) => {
      if (!originals.has(r)) originals.set(r, r.style.cssText);
      const base = originals.get(r)!;
      const next = t.id === 'prisma' ? base : rewrite(base, map);
      if (r.style.cssText !== next) r.style.cssText = next;
    });
  }
  // Regras extras (formas e botão principal)
  let el = document.getElementById('prisma-theme') as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = 'prisma-theme';
    document.head.appendChild(el);
  }
  const extra: string[] = [
    `body, html { background: ${t.bg}; }`,
    `.btn.primary, .chip.on.primary { color: ${t.onPrimary}; }`,
    `.sec.on { color: ${t.onPrimary}; }`,
    `.cat.on .cat-count { color: ${t.onPrimary}; }`,
  ];
  if (t.square) {
    extra.push(
      '.btn, .chip, .round, .sec, .choice, .cat, .stream-chip, .pill, .pill button, .m-tabs, .m-tabs button, .tool, .mini { border-radius: 4px !important; }',
      '.glass, .modal, .poster-art, .tile-art, .hero-art, .row, .vlist, .guide-prog, .where-row, .pick-row, .live-search input, .field input { border-radius: 6px !important; }',
      '.logo-box { border-radius: 4px !important; }',
    );
  }
  if (t.titleFont) extra.push(`.title, .brand span, .tile-ini, .poster-fallback, .game-teams { font-family: ${t.titleFont} !important; font-weight: 800 !important; letter-spacing: -0.5px; }`);
  el.textContent = extra.join('\n');
  document.documentElement.setAttribute('data-theme', t.id);
}
