// Destaques do dia (Início): o que vale a pena hoje, montado a partir do guia
// de programação — jogos, filmes e grandes programas — nos canais da lista.

import { cachedGames, looksLikeGame, matchOf } from './games';
import type { Channel, EpgEntry } from './types';
import { programmesOf } from './xmltv';

const MOVIE = /^filme\b|\bfilme:|sess[aã]o da tarde|tela quente|supercine|coruj[aã]o|temperatura m[aá]xima|domingo maior|cinema especial|intercine|cine (record|band|sbt)|tela de sucessos/i;
const SHOW = /jornal nacional|fant[aá]stico|big brother|\bbbb\b|a fazenda|masterchef|the voice|domingão|altas horas|caldeir[aã]o|globo rep[oó]rter|roda viva|lady night|conversa com bial|show da virada|f[oó]rmula ?1|\bgp d[eo]\b/i;

export interface Highlight {
  ch: Channel;
  e: EpgEntry;
  kind: 'jogo' | 'filme' | 'programa';
}

export function kindOf(title: string): Highlight['kind'] | null {
  if (looksLikeGame(title)) return 'jogo';
  if (MOVIE.test(title)) return 'filme';
  if (SHOW.test(title)) return 'programa';
  return null;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Até `max` destaques de agora até o fim do dia (ou as próximas 10 h, o que for maior). */
export function todayHighlights(live: Channel[], favIds: string[], now = Date.now(), max = 12): Highlight[] {
  const end = Math.max(new Date(new Date(now).setHours(23, 59, 59, 999)).getTime(), now + 10 * 3600 * 1000);
  const fav = new Set(favIds);
  const byKey = new Map<string, Highlight & { score: number }>();
  const add = (ch: Channel, e: EpgEntry, kind: Highlight['kind']) => {
    if (e.end <= now || e.start > end) return;
    // Jogo: pela partida ("Brasileirão: A x B" = "Futebol: A x B"), com 1 h de folga no horário.
    const key = kind === 'jogo' ? 'j|' + norm(matchOf(e.title)) + '|' + Math.round(e.start / 3600000) : norm(e.title) + '|' + Math.round(e.start / 600000);
    const score = (fav.has(ch.id) ? 2 : 0) + (/\b(fhd|4k|uhd)\b/i.test(ch.name) ? 1 : 0);
    const cur = byKey.get(key);
    if (!cur || score > cur.score) byKey.set(key, { ch, e, kind, score });
  };
  // Guia completo (XMLTV)
  for (const ch of live) {
    for (const e of programmesOf(ch)) {
      const k = kindOf(e.title);
      if (k) add(ch, e, k);
    }
  }
  // Jogos já lidos na aba Jogos (canais de esporte, guia curto do Xtream)
  for (const g of cachedGames()) if (g.channels[0]) add(g.channels[0], { title: g.title, start: g.start, end: g.end }, 'jogo');
  const list = [...byKey.values()];
  // Ao vivo primeiro, depois por horário; mistura os tipos para não virar só futebol.
  list.sort((a, b) => (a.e.start <= now ? 0 : 1) - (b.e.start <= now ? 0 : 1) || a.e.start - b.e.start);
  const out: Highlight[] = [];
  const perKind: Record<string, number> = {};
  for (const h of list) {
    if ((perKind[h.kind] ?? 0) >= Math.ceil(max / 2)) continue;
    perKind[h.kind] = (perKind[h.kind] ?? 0) + 1;
    out.push({ ch: h.ch, e: h.e, kind: h.kind });
    if (out.length >= max) break;
  }
  return out.sort((a, b) => a.e.start - b.e.start);
}

/**
 * "Para assistir hoje à noite": jogos, filmes e grandes programas que começam
 * entre 19h e meia-noite (depois das 22h30, a noite de amanhã), do guia completo.
 */
export function tonightPicks(live: Channel[], favIds: string[], now = Date.now(), max = 12): Highlight[] {
  const d = new Date(now);
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (d.getHours() * 60 + d.getMinutes() > 22 * 60 + 30 ? 1 : 0));
  const from = new Date(base).setHours(19, 0, 0, 0);
  const to = new Date(base).setHours(23, 59, 59, 999);
  const fav = new Set(favIds);
  const byKey = new Map<string, Highlight & { score: number }>();
  for (const ch of live) {
    for (const e of programmesOf(ch)) {
      if (e.start < from || e.start > to || e.end <= now) continue;
      const k = kindOf(e.title);
      if (!k) continue;
      const key = (k === 'jogo' ? norm(matchOf(e.title)) : norm(e.title)) + '|' + Math.round(e.start / 1800000);
      const score = (fav.has(ch.id) ? 2 : 0) + (/\b(fhd|4k|uhd)\b/i.test(ch.name) ? 1 : 0) + (e.image ? 1 : 0);
      const cur = byKey.get(key);
      if (!cur || score > cur.score) byKey.set(key, { ch, e, kind: k, score });
    }
  }
  return [...byKey.values()]
    .sort((a, b) => a.e.start - b.e.start || b.score - a.score)
    .slice(0, max)
    .map(({ ch, e, kind }) => ({ ch, e, kind }));
}
