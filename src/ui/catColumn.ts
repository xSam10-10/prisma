import type { Channel } from '../core/types';
import { STREAMINGS } from '../core/vod';

// Largura ÚNICA da coluna de categorias (Ao vivo, Filmes, Séries e o menu da
// tela cheia): medida pelo nome mais longo de TODAS as categorias da lista,
// dos Tops e dos rótulos fixos — assim nenhum nome aparece cortado e a coluna
// tem o mesmo tamanho em todas as abas. Nomes enormes (acima do máximo) quebram
// em duas linhas (CSS .cat-name).

let ctx: CanvasRenderingContext2D | null = null;
export function textWidth(text: string, font: string): number {
  try {
    ctx = ctx ?? document.createElement('canvas').getContext('2d');
    if (!ctx) return text.length * 9.5;
    ctx.font = font;
    return ctx.measureText(text).width;
  } catch {
    return text.length * 9.5;
  }
}

const FONT = '600 15px Inter, sans-serif';
const MIN = 260;
const MAX = 420;

/** Rótulos que o app mesmo escreve na coluna (Tops, gêneros, cabeçalhos). */
const FIXED = [
  'FAVORITOS', 'TODOS', 'GRAVAÇÕES', 'ADICIONADOS RECENTEMENTE', 'CHEGARAM AO STREAMING', 'EM ALTA NA SEMANA', 'MAIS ACLAMADOS', 'SÉRIES NOVAS',
  'TOP 10 NOVELAS TURCAS', 'TOP 10 FICÇÃO CIENTÍFICA', 'TOP 10 FICÇÃO E FANTASIA', 'TOP 10 AÇÃO E AVENTURA', 'TOP 10 DOCUMENTÁRIOS', 'TOP 10 REALITY SHOWS',
  ...STREAMINGS.map((s) => `🔥 TOP 10 ${s.name.toUpperCase()}`),
  ...STREAMINGS.map((s) => `TODOS · ${s.name.toUpperCase()}`),
];

const cache = new WeakMap<Channel[], number>();

export function categoryColumnWidth(items: Channel[]): number {
  const hit = cache.get(items);
  if (hit) return hit;
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.group, (counts.get(i.group) ?? 0) + 1);
  let max = 0;
  for (const t of FIXED) max = Math.max(max, textWidth(t, FONT));
  for (const g of counts.keys()) max = Math.max(max, textWidth(g.toUpperCase(), FONT));
  // Selo da contagem com milhar ("44.379"): o maior número da lista.
  const digits = items.length.toLocaleString('pt-BR').length;
  const badge = Math.max(28, digits * 8 + 14);
  // nome (+6% de folga: a fonte da TV pode medir diferente) + selo + margens (14 + 10 + 8) + coluna (3 + 10 + 12)
  const w = Math.round(Math.min(MAX, Math.max(MIN, max * 1.06 + badge + 14 + 10 + 8 + 25)));
  cache.set(items, w);
  return w;
}
