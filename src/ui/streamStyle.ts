import type { Streaming } from '../core/vod';
import { rgba } from './bits';

// Modo "Marcante" (0.28.0): dentro de cada streaming, o app fica o mais perto
// possível do app oficial — fonte (a gratuita mais parecida com a da marca, do
// Google Fonts, carregada só quando você entra no streaming), peso e caixa dos
// títulos, formato das capas (em pé ou deitadas), jeito do foco do controle,
// botões, selos e nomes das fileiras. Inspirado, sem usar arquivos das marcas.
//
// Sem variáveis CSS (TV de 2017): as regras são montadas aqui e entram numa
// folha própria (#prisma-skin) enquanto você está no streaming.

export type SkinMode = 'marcante' | 'cores' | 'off';

export interface StreamStyle {
  /** Fonte do Google Fonts parecida com a da marca e os pesos usados. */
  font: string;
  weights: string;
  /** Fonte só do título grande do destaque (ex.: Lionsgate, mais clássica). */
  heroFont?: string;
  /** Títulos das fileiras: peso, caixa alta e espaçamento. */
  rowWeight: number;
  rowUpper?: boolean;
  rowTrack?: number;
  /** Título do destaque. */
  heroWeight: number;
  heroUpper?: boolean;
  heroTrack?: number;
  /** Capas das fileiras: em pé (2:3) ou deitadas (16:9). */
  shape: 'portrait' | 'landscape';
  radius: number;
  /** Foco do controle: cresce (Netflix), sobe (Disney+), anel na cor (Max, Prime), brilho (Apple). */
  focus: 'grow' | 'lift' | 'ring' | 'glow';
  /** Esconde o nome embaixo da capa (o nome já está na arte). */
  hideNames?: boolean;
  /** Selo "novo" e o texto acima do título no destaque. */
  newLabel: string;
  kicker: (kind: 'filme' | 'série') => string;
  /** Botões do destaque. */
  play: string;
  playBg: string;
  playFg: string;
  more: string;
  list: string;
  btnRadius: number;
  /** Botão secundário só com ícone ("+"), como no Disney+. */
  iconList?: boolean;
  /** Linha de meta no estilo da marca: "98% relevante" (Netflix), "Incluído no Prime"… */
  metaLead?: (rating?: number) => string | null;
  /** Nome da fileira do Top 10 e da grade com tudo. */
  topRow: (kind: string) => string;
  allRow: string;
}

const MATCH = (r?: number) => (r ? `${Math.min(99, Math.max(60, Math.round(r * 10 + 12)))}% relevante` : null);

/** Estilo de cada streaming (id de STREAMINGS em core/vod.ts). */
export const STREAM_STYLE: Record<string, StreamStyle> = {
  netflix: {
    font: 'Inter', weights: '400;500;700;800;900', rowWeight: 700, heroWeight: 900, heroUpper: true, heroTrack: -1,
    shape: 'portrait', radius: 4, focus: 'grow', hideNames: true, newLabel: 'NOVIDADE',
    kicker: (k) => (k === 'série' ? 'S É R I E' : 'F I L M E'), play: 'Assistir', playBg: '#FFFFFF', playFg: '#000000', more: 'Mais informações', list: 'Minha lista', btnRadius: 4,
    metaLead: MATCH, topRow: (k) => `Top 10 em ${k} hoje`, allRow: 'Explore tudo',
  },
  hbo: {
    font: 'Manrope', weights: '400;600;700;800', rowWeight: 700, heroWeight: 800, heroTrack: -0.5,
    shape: 'landscape', radius: 8, focus: 'ring', newLabel: 'NOVO',
    kicker: () => 'ORIGINAL HBO MAX', play: 'Assistir', playBg: '#FFFFFF', playFg: '#0A0A2E', more: 'Detalhes', list: 'Minha lista', btnRadius: 6,
    topRow: () => 'Top 10 de hoje', allRow: 'Tudo no HBO Max',
  },
  disney: {
    font: 'Figtree', weights: '400;600;700;800', rowWeight: 700, heroWeight: 800, heroTrack: -0.5,
    shape: 'landscape', radius: 10, focus: 'lift', newLabel: 'NOVIDADE',
    kicker: () => 'NOVIDADE NO DISNEY+', play: 'ASSISTIR', playBg: '#F9F9F9', playFg: '#0E1424', more: 'Detalhes', list: '＋', btnRadius: 6, iconList: true,
    topRow: () => 'Em alta', allRow: 'Explore',
  },
  prime: {
    font: 'Open Sans', weights: '400;600;700;800', rowWeight: 700, heroWeight: 800,
    shape: 'landscape', radius: 8, focus: 'ring', newLabel: 'NOVO',
    kicker: () => '✓ INCLUÍDO NO PRIME', play: 'Assistir', playBg: '#00A8E1', playFg: '#0F171E', more: 'Detalhes', list: 'Minha lista', btnRadius: 6,
    topRow: () => 'Top 10 no Brasil', allRow: 'Todo o catálogo',
  },
  apple: {
    font: 'Inter', weights: '300;400;600;700', rowWeight: 600, heroWeight: 300, heroTrack: -2,
    shape: 'landscape', radius: 16, focus: 'glow', hideNames: true, newLabel: 'NOVO',
    kicker: () => 'ORIGINAL', play: 'Assistir agora', playBg: '#F5F5F7', playFg: '#000000', more: 'Detalhes', list: '＋ Na fila', btnRadius: 12,
    topRow: () => 'Top 10 do momento', allRow: 'Tudo',
  },
  paramount: {
    font: 'Montserrat', weights: '400;600;700;800', rowWeight: 700, heroWeight: 800, heroUpper: true,
    shape: 'landscape', radius: 6, focus: 'ring', newLabel: 'NOVO',
    kicker: () => 'ORIGINAL PARAMOUNT+', play: 'Assistir', playBg: '#0064FF', playFg: '#FFFFFF', more: 'Mais informações', list: 'Minha lista', btnRadius: 4,
    topRow: () => 'Os mais vistos', allRow: 'Todo o Paramount+',
  },
  globoplay: {
    font: 'Rubik', weights: '400;500;700;800', rowWeight: 700, heroWeight: 800,
    shape: 'portrait', radius: 12, focus: 'lift', newLabel: 'NOVO',
    kicker: (k) => (k === 'série' ? 'SÉRIE ORIGINAL' : 'FILME'), play: 'Assistir', playBg: '#FB2E5A', playFg: '#FFFFFF', more: 'Saiba mais', list: 'Minha lista', btnRadius: 999,
    topRow: () => 'Em alta no Globoplay', allRow: 'Todo o Globoplay',
  },
  star: {
    font: 'Nunito Sans', weights: '400;600;700;800', rowWeight: 700, heroWeight: 800,
    shape: 'landscape', radius: 10, focus: 'lift', newLabel: 'NOVIDADE',
    kicker: () => 'NOVIDADE NO STAR+', play: 'ASSISTIR', playBg: '#F9F9F9', playFg: '#1A0B2E', more: 'Detalhes', list: '＋', btnRadius: 6, iconList: true,
    topRow: () => 'Em alta', allRow: 'Explore',
  },
  discovery: {
    font: 'Plus Jakarta Sans', weights: '400;600;700;800', rowWeight: 700, heroWeight: 800,
    shape: 'landscape', radius: 8, focus: 'ring', newLabel: 'NOVO',
    kicker: () => 'ORIGINAL', play: 'Assistir', playBg: '#2175FF', playFg: '#FFFFFF', more: 'Detalhes', list: 'Minha lista', btnRadius: 999,
    topRow: () => 'Populares agora', allRow: 'Tudo no Discovery+',
  },
  crunchyroll: {
    font: 'Lato', weights: '400;700;900', rowWeight: 900, rowUpper: true, rowTrack: 0.5, heroWeight: 900, heroUpper: true,
    shape: 'portrait', radius: 4, focus: 'ring', newLabel: 'NOVO',
    kicker: () => 'SIMULCAST', play: 'COMEÇAR A ASSISTIR', playBg: '#F47521', playFg: '#000000', more: 'DETALHES', list: '＋ LISTA', btnRadius: 2,
    topRow: () => 'Mais populares', allRow: 'Navegar por tudo',
  },
  funimation: {
    font: 'Poppins', weights: '400;600;700;800', rowWeight: 700, heroWeight: 800,
    shape: 'portrait', radius: 8, focus: 'ring', newLabel: 'NOVO',
    kicker: () => 'DUBLADO E LEGENDADO', play: 'Assistir', playBg: '#A44DFF', playFg: '#FFFFFF', more: 'Detalhes', list: 'Minha fila', btnRadius: 999,
    topRow: () => 'Em alta', allRow: 'Todos os títulos',
  },
  lionsgate: {
    font: 'Lato', weights: '400;700;900', heroFont: 'Cinzel', rowWeight: 700, rowUpper: true, rowTrack: 2, heroWeight: 700, heroUpper: true, heroTrack: 2,
    shape: 'portrait', radius: 2, focus: 'ring', newLabel: 'ESTREIA',
    kicker: () => 'LIONSGATE+', play: 'Assistir', playBg: '#C8A24B', playFg: '#0D0D0D', more: 'Detalhes', list: 'Minha lista', btnRadius: 2,
    topRow: () => 'Em destaque', allRow: 'Coleção completa',
  },
  claro: {
    font: 'Roboto', weights: '400;500;700;900', rowWeight: 700, heroWeight: 900,
    shape: 'landscape', radius: 4, focus: 'ring', newLabel: 'NOVO',
    kicker: () => 'CLARO VÍDEO', play: 'Assistir', playBg: '#DA291C', playFg: '#FFFFFF', more: 'Mais informações', list: 'Minha lista', btnRadius: 4,
    topRow: () => 'Mais assistidos', allRow: 'Todo o catálogo',
  },
  sbt: {
    font: 'Barlow', weights: '400;600;700;800', rowWeight: 700, heroWeight: 800,
    shape: 'landscape', radius: 10, focus: 'ring', newLabel: 'NOVO',
    kicker: () => 'SBT+', play: 'Assistir', playBg: '#F5B800', playFg: '#04122E', more: 'Detalhes', list: 'Minha lista', btnRadius: 999,
    topRow: () => 'Os mais vistos', allRow: 'Tudo no SBT+',
  },
  directv: {
    font: 'Roboto', weights: '400;500;700;900', rowWeight: 700, heroWeight: 900,
    shape: 'landscape', radius: 6, focus: 'ring', newLabel: 'NOVO',
    kicker: () => 'DIRECTV GO', play: 'Assistir', playBg: '#00A6E8', playFg: '#04101F', more: 'Detalhes', list: 'Minha lista', btnRadius: 4,
    topRow: () => 'Mais assistidos', allRow: 'Todo o catálogo',
  },
  amc: {
    font: 'Barlow Condensed', weights: '400;600;700;800', rowWeight: 700, rowUpper: true, rowTrack: 1, heroWeight: 800, heroUpper: true, heroTrack: 1,
    shape: 'portrait', radius: 0, focus: 'grow', newLabel: 'NOVO',
    kicker: () => 'AMC+ ORIGINAL', play: 'ASSISTIR', playBg: '#E4E4E4', playFg: '#0B0B0B', more: 'DETALHES', list: 'MINHA LISTA', btnRadius: 0,
    topRow: () => 'Top 10', allRow: 'Tudo no AMC+',
  },
  hulu: {
    font: 'Work Sans', weights: '400;600;700;800', rowWeight: 700, heroWeight: 800,
    shape: 'landscape', radius: 8, focus: 'ring', newLabel: 'NOVO',
    kicker: () => 'HULU ORIGINAL', play: 'Assistir', playBg: '#1CE783', playFg: '#0B0C0F', more: 'Detalhes', list: 'Minha lista', btnRadius: 6,
    topRow: () => 'Em alta', allRow: 'Tudo no Hulu',
  },
};

/** Estilo do streaming; os que não estão na tabela ganham um padrão com as cores deles. */
export function styleOf(s: Streaming): StreamStyle {
  return (
    STREAM_STYLE[s.id] ?? {
      font: 'Inter', weights: '400;600;700;800', rowWeight: 700, heroWeight: 800, shape: 'portrait', radius: 10, focus: 'ring', newLabel: 'NOVO',
      kicker: () => s.name.toUpperCase(), play: 'Assistir', playBg: s.accent, playFg: '#FFFFFF', more: 'Detalhes', list: 'Minha lista', btnRadius: 8,
      topRow: () => 'Em alta', allRow: `Tudo no ${s.name}`,
    }
  );
}

// ---------------------------------------------------------------- Fontes

const loaded = new Set<string>();
/** Carrega a fonte do Google Fonts uma vez (só quando o streaming é aberto). */
export function loadFont(family: string, weights: string): void {
  const key = family + weights;
  if (loaded.has(key) || typeof document === 'undefined') return;
  loaded.add(key);
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${weights}&display=swap`;
  document.head.appendChild(l);
}

const fam = (f: string) => `'${f}', 'Inter', sans-serif`;

// ---------------------------------------------------------------- Regras do modo Marcante

/** CSS do streaming no modo Marcante (vai para a folha #prisma-skin). */
export function skinCss(s: Streaming, st: StreamStyle): string {
  const acc = s.accent;
  const f = fam(st.font);
  const art = '.poster-art, .wtile-art';
  const out: string[] = [
    // Fonte da marca em todo o app enquanto está no streaming
    `body, button, input, .title, .poster-title, .poster-meta, .carousel-sub, .chip, .stream-chip, .sbh-meta, .sbh-plot { font-family: ${f} !important; }`,
    `.carousel-head .title, .vod-tools .title { font-family: ${f} !important; font-weight: ${st.rowWeight} !important; letter-spacing: ${st.rowTrack ?? -0.3}px !important; text-transform: ${st.rowUpper ? 'uppercase' : 'none'} !important; }`,
    `.sbh-title { font-family: ${fam(st.heroFont ?? st.font)} !important; font-weight: ${st.heroWeight}; letter-spacing: ${st.heroTrack ?? -1}px; text-transform: ${st.heroUpper ? 'uppercase' : 'none'}; }`,
    `${art} { border-radius: ${st.radius}px !important; }`,
    `.pbadge.new, .wbadge { background: ${acc} !important; color: #FFFFFF !important; border-radius: ${Math.min(st.radius, 4)}px !important; }`,
    // Sem a "respiração" padrão: cada marca tem o seu foco
    `html.kbd .ptile:focus, html.kbd .wtile:focus { -webkit-animation: none !important; animation: none !important; }`,
  ];
  if (st.hideNames) out.push('.ptile .poster-title, .ptile .poster-meta { display: none !important; }');
  const foc = 'html.kbd .ptile:focus .poster-art, html.kbd .wtile:focus .wtile-art';
  const tr = (v: string) => `-webkit-transform: ${v} !important; transform: ${v} !important;`;
  if (st.focus === 'grow') {
    out.push(`html.kbd .ptile:focus, html.kbd .wtile:focus { ${tr('scale(1.1)')} }`, `${foc} { box-shadow: 0 0 0 3px #FFFFFF, 0 22px 44px rgba(0,0,0,0.7) !important; }`);
  } else if (st.focus === 'lift') {
    out.push(`html.kbd .ptile:focus, html.kbd .wtile:focus { ${tr('translateY(-8px) scale(1.05)')} }`, `${foc} { box-shadow: 0 0 0 4px rgba(249,249,249,0.95), 0 26px 50px rgba(0,0,0,0.65) !important; }`);
  } else if (st.focus === 'ring') {
    out.push(`html.kbd .ptile:focus, html.kbd .wtile:focus { ${tr('scale(1.04)')} }`, `${foc} { box-shadow: 0 0 0 4px ${acc}, 0 0 34px ${rgba(acc, 0.55)} !important; }`);
  } else {
    out.push(`html.kbd .ptile:focus, html.kbd .wtile:focus { ${tr('scale(1.09)')} }`, `${foc} { box-shadow: 0 0 0 2px rgba(255,255,255,0.55), 0 30px 60px rgba(0,0,0,0.85) !important; }`);
  }
  return out.join('\n');
}

let current: string | null = null;
/** Liga (streaming) ou desliga (null) as regras do modo Marcante. */
export function applyMarcante(s: Streaming | null): void {
  const id = s ? s.id : null;
  if (id === current) return;
  current = id;
  let el = document.getElementById('prisma-skin') as HTMLStyleElement | null;
  if (!s) {
    if (el) el.textContent = '';
    document.documentElement.removeAttribute('data-skin');
    return;
  }
  const st = styleOf(s);
  loadFont(st.font, st.weights);
  if (st.heroFont) loadFont(st.heroFont, '400;700');
  if (!el) {
    el = document.createElement('style');
    el.id = 'prisma-skin';
    document.head.appendChild(el);
  }
  el.textContent = skinCss(s, st);
  document.documentElement.setAttribute('data-skin', s.id);
}
