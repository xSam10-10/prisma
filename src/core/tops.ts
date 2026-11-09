// Tops e recomendações: Top 10 dos streamings, por gênero, especiais e o
// "Top 10 canais agora".
//
// Os dados vêm prontos de "prisma-tops.json", gerado algumas vezes por dia no
// GitHub (scripts/tops/build-tops.mjs, workflow tops.yml) e publicado na
// Release "tops" do repositório. Assim a TV e o celular só baixam um arquivo
// pequeno, sem precisar de chave — e as listas se atualizam sozinhas, sem
// versão nova do app. Aqui cada lista é cruzada com a lista IPTV: só aparece o
// que dá para assistir.

import { fetchText } from './net';
import { idbGet, idbSet, prefGet } from './storage';
import { logoKey } from './logos';
import { norm, searchTitle, tmdbImage, tmdbKey, weeklyTop } from './tmdb';
import { programmesOf } from './xmltv';
import { kindOf } from './highlights';
import { STREAMINGS } from './vod';
import type { Channel } from './types';
import base from '../../scripts/tops/canais.json';

export const DEFAULT_TOPS = 'https://github.com/xSam10-10/prisma/releases/download/tops/prisma-tops.json';
const MAX_AGE = 6 * 3600 * 1000;

/** i = id TMDB, t = título em português, o = original, e = inglês (Netflix), y = ano, r = nota. */
export interface TopItem {
  i?: number;
  /** Estreias: data (AAAA-MM-DD) e pôster (caminho do TMDB). */
  d?: string;
  p?: string;
  t: string;
  o?: string;
  e?: string;
  y?: number;
  r?: number;
}
export interface TopList {
  id: string;
  kind: 'movie' | 'tv';
  /** stgenero = um gênero dentro de um streaming (aparece ao escolher o streaming). */
  group: 'streaming' | 'geral' | 'genero' | 'especial' | 'stgenero' | 'stall' | 'colecao' | 'estreias';
  /** Coleção: arte larga (caminho do TMDB). */
  b?: string;
  sid?: string;
  title: string;
  src: string;
  items: TopItem[];
}
export interface TopChannel {
  n: string;
  m: string;
  c: string;
}
export interface TopsData {
  v: number;
  updated: string;
  lists: TopList[];
  channels: TopChannel[];
  warn?: string[];
  /** Quando este aparelho baixou. */
  at: number;
}

// ---------------------------------------------------------------- Baixar e guardar

let mem: TopsData | null = null;
let inflight: Promise<TopsData | null> | null = null;
let lastError = '';
const listeners = new Set<() => void>();

export function topsUrl(): string {
  return prefGet<string>('topsFeed', '') || DEFAULT_TOPS;
}

export function onTops(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function topsNow(): TopsData | null {
  return mem;
}

export function topsStatus(): { data: TopsData | null; error: string } {
  return { data: mem, error: lastError };
}

/** Dados dos tops: memória › IndexedDB (até 6 h) › internet. Sem internet, usa o último baixado. */
export function loadTops(force = false): Promise<TopsData | null> {
  if (!force && mem && Date.now() - mem.at < MAX_AGE) return Promise.resolve(mem);
  if (inflight) return inflight;
  inflight = (async () => {
    const cached = mem ?? (await idbGet<TopsData>('tops')) ?? null;
    if (cached && !mem) {
      mem = cached;
      listeners.forEach((f) => f());
    }
    if (!force && cached && Date.now() - cached.at < MAX_AGE) return cached;
    try {
      const d = JSON.parse(await fetchText(topsUrl() + '?t=' + Date.now(), 30000)) as TopsData;
      if (!d || !Array.isArray(d.lists)) throw new Error('arquivo inválido');
      d.at = Date.now();
      mem = d;
      lastError = '';
      idbSet('tops', d);
      listeners.forEach((f) => f());
      return d;
    } catch (e) {
      lastError = (e as Error).message || 'sem conexão';
      return cached;
    }
  })();
  const p = inflight;
  p.then(
    () => (inflight = null),
    () => (inflight = null),
  );
  return p;
}

// ---------------------------------------------------------------- Cruzar com a lista

export interface Ranked {
  item: Channel;
  /** Posição no ranking original (1 = primeiro). */
  rank: number;
}
export interface MatchedList {
  id: string;
  kind: 'movie' | 'tv';
  group: TopList['group'];
  sid?: string;
  title: string;
  src: string;
  items: Ranked[];
}

type Index = Map<string, Channel[]>;
const indexes = new WeakMap<Channel[], { movie: Index; series: Index }>();

function indexOf(items: Channel[]): { movie: Index; series: Index } {
  let idx = indexes.get(items);
  if (idx) return idx;
  idx = { movie: new Map(), series: new Map() };
  for (const it of items) {
    if (it.kind !== 'movie' && it.kind !== 'series') continue;
    const k = norm(searchTitle(it.fullName ?? it.name).title);
    if (!k) continue;
    const m = it.kind === 'movie' ? idx.movie : idx.series;
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  indexes.set(items, idx);
  return idx;
}

function yearOfItem(it: Channel): number | undefined {
  return it.year ?? searchTitle(it.fullName ?? it.name).year;
}

/** Acha o título na lista IPTV pelo nome em português, original ou inglês. Filmes: ano com 1 de folga. */
export function findInList(t: TopItem, kind: 'movie' | 'tv', items: Channel[]): Channel | undefined {
  const idx = indexOf(items)[kind === 'movie' ? 'movie' : 'series'];
  const names = [t.t, t.o, t.e].filter(Boolean).map((n) => norm(searchTitle(n!).title));
  for (const n of names) {
    const hits = idx.get(n);
    if (!hits) continue;
    if (kind === 'tv' || !t.y) return hits[0];
    const ok = hits.filter((h) => {
      const y = yearOfItem(h);
      return !y || Math.abs(y - t.y!) <= 1;
    });
    const exact = ok.find((h) => yearOfItem(h) === t.y);
    if (exact || ok[0]) return exact ?? ok[0];
  }
  return undefined;
}

export function matchList(l: TopList, items: Channel[], max = 10): MatchedList {
  const out: Ranked[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < l.items.length && out.length < max; i++) {
    const hit = findInList(l.items[i], l.kind, items);
    if (hit && !seen.has(hit.id)) {
      seen.add(hit.id);
      out.push({ item: hit, rank: i + 1 });
    }
  }
  return { id: l.id, kind: l.kind, group: l.group, sid: l.sid, title: l.title, src: l.src, items: out };
}

/** Ordem combinada (08/11): Chegaram ao streaming, Em alta, Aclamados; streamings; especiais; gêneros. */
const GERAL_ORDER = ['lancamentos', 'semana', 'aclamados'];

/** Todas as listas de um tipo, já cruzadas (só as que têm algo para assistir). Sem os gêneros por streaming. */
export function matchedLists(data: TopsData | null, items: Channel[], kind: 'movie' | 'tv', min = 1): MatchedList[] {
  if (!data) return [];
  const order = (l: TopList) => {
    const g = { geral: 0, streaming: 1, especial: 2, genero: 3 }[l.group as string] ?? 4;
    const s = l.group === 'geral' ? GERAL_ORDER.findIndex((p) => l.id.startsWith(p)) : l.sid ? STREAMINGS.findIndex((x) => x.id === l.sid) : 0;
    return g * 100 + (s < 0 ? 50 : s);
  };
  return data.lists
    .filter((l) => l.kind === kind && l.group !== 'stgenero' && l.group !== 'stall' && l.group !== 'colecao' && l.group !== 'estreias')
    .sort((a, b) => order(a) - order(b))
    .map((l) => matchList(l, items))
    .filter((l) => l.items.length >= min);
}

/** Gêneros dentro de um streaming (ex.: Terror no HBO Max), só com 3+ títulos da lista. */
export function streamGenreLists(data: TopsData | null, items: Channel[], kind: 'movie' | 'tv', sid: string, min = 3): MatchedList[] {
  if (!data) return [];
  return data.lists
    .filter((l) => l.kind === kind && l.group === 'stgenero' && l.sid === sid)
    .map((l) => matchList(l, items))
    .filter((l) => l.items.length >= min);
}

/**
 * Títulos da lista que estão num streaming segundo o TMDB (catálogo + Top 10 + gêneros dele).
 * Usado em "Todos · <streaming>" quando as categorias da lista não dizem o streaming.
 */
export function streamCatalog(data: TopsData | null, items: Channel[], kind: 'movie' | 'tv', sid: string): Channel[] {
  if (!data) return [];
  const out: Channel[] = [];
  const seen = new Set<string>();
  for (const l of data.lists) {
    if (l.kind !== kind || l.sid !== sid) continue;
    for (const r of matchList(l, items, 1000).items) {
      if (!seen.has(r.item.id)) {
        seen.add(r.item.id);
        out.push(r.item);
      }
    }
  }
  return out;
}

export interface Collection {
  id: string;
  title: string;
  /** Arte larga (URL completa) */
  backdrop?: string;
  items: Channel[];
  /** Ordem da história, quando é diferente da de lançamento (ex.: Star Wars, X-Men). */
  chrono?: Channel[];
}

// Ordem cronológica da história (ids de filmes do TMDB), só das sagas em que ela muda.
const CHRONO: number[][] = [
  // Star Wars: I, II, III, Solo, Rogue One, IV, V, VI, VII, VIII, IX
  [1893, 1894, 1895, 348350, 330459, 11, 1891, 1892, 140607, 181808, 181812],
  // X-Men: Primeira Classe, Dias de um Futuro Esquecido, Apocalipse, Fênix Negra, X-Men, X2, O Confronto Final
  [49538, 127585, 246655, 320288, 36657, 36658, 36668],
];

function chronoOf(l: TopList, ranked: Ranked[]): Channel[] | undefined {
  const ids = ranked.map((r) => l.items[r.rank - 1]?.i);
  const order = CHRONO.find((c) => ids.filter((id) => id && c.includes(id)).length >= 2);
  if (!order) return undefined;
  const pos = (id?: number) => (id && order.includes(id) ? order.indexOf(id) : 999);
  const sorted = ranked.map((r, k) => ({ item: r.item, p: pos(ids[k]), k })).sort((a, b) => a.p - b.p || a.k - b.k);
  return sorted.some((x, k) => x.k !== k) ? sorted.map((x) => x.item) : undefined;
}

/** Coleções e sagas (TMDB) com 2+ filmes na lista, em ordem de lançamento; as mais completas primeiro. */
export function collectionsIn(data: TopsData | null, items: Channel[]): Collection[] {
  if (!data) return [];
  return data.lists
    .filter((l) => l.group === 'colecao')
    .map((l) => {
      const m = matchList(l, items, 50).items;
      return { id: l.id, title: l.title, backdrop: l.b ? tmdbImage(l.b, 'w780') : undefined, items: m.map((r) => r.item), chrono: chronoOf(l, m) };
    })
    .filter((c) => c.items.length >= 2)
    .sort((a, b) => b.items.length - a.items.length);
}

export interface Upcoming {
  key: string;
  title: string;
  date: number;
  kind: 'movie' | 'tv';
  poster?: string;
  /** Já está na lista (pode abrir). */
  item?: Channel;
  /** Série que você acompanha: "T2 E5". */
  ep?: string;
}

/** Estreias da semana (TMDB) — filmes e séries —, com o que já estiver na lista marcado. */
export function upcomingOf(data: TopsData | null, items: Channel[]): Upcoming[] {
  if (!data) return [];
  const out: Upcoming[] = [];
  for (const l of data.lists) {
    if (l.group !== 'estreias') continue;
    for (const it of l.items) {
      if (!it.d) continue;
      out.push({ key: l.kind + (it.i ?? it.t), title: it.t, date: Date.parse(it.d + 'T12:00:00'), kind: l.kind, poster: it.p ? tmdbImage(it.p, 'w342') : undefined, item: findInList(it, l.kind, items) });
    }
  }
  return out.sort((a, b) => a.date - b.date);
}

/** Junta filmes e séries de um mesmo top, alternando (1º filme, 1ª série…). */
export function interleave(a: Ranked[], b: Ranked[], max = 10): Ranked[] {
  const out: Ranked[] = [];
  for (let i = 0; out.length < max && (i < a.length || i < b.length); i++) {
    if (a[i]) out.push(a[i]);
    if (b[i] && out.length < max) out.push(b[i]);
  }
  return out.map((r, i) => ({ item: r.item, rank: i + 1 }));
}

export interface Shelf {
  id: string;
  title: string;
  src: string;
  items: Ranked[];
}

/** Fileiras do Início: em alta (filmes e séries juntos) e, para cada streaming, filmes e séries em fileiras separadas. */
export function homeShelves(data: TopsData | null, items: Channel[], maxStreams = 6): Shelf[] {
  const mv = matchedLists(data, items, 'movie');
  const tv = matchedLists(data, items, 'tv');
  const get = (arr: MatchedList[], pred: (l: MatchedList) => boolean) => arr.find(pred)?.items ?? [];
  const out: Shelf[] = [];
  const week = interleave(get(mv, (l) => l.id === 'semana-movie'), get(tv, (l) => l.id === 'semana-tv'));
  if (week.length >= 3) out.push({ id: 'semana', title: 'Top 10 da semana', src: 'Filmes e séries em alta, só o que está na sua lista', items: week });
  // Cada streaming: "Top 10 Filmes <streaming>" e, logo abaixo, "Top 10 Séries <streaming>".
  let n = 0;
  for (const st of STREAMINGS) {
    if (n >= maxStreams) break;
    const m = mv.find((l) => l.sid === st.id);
    const t = tv.find((l) => l.sid === st.id);
    const rows: Shelf[] = [];
    const seq = (l: MatchedList) => l.items.map((r, i) => ({ item: r.item, rank: i + 1 }));
    if (m && m.items.length >= 4) rows.push({ id: 'st-' + st.id + '-movie', title: `Top 10 Filmes ${st.name}`, src: m.src, items: seq(m) });
    if (t && t.items.length >= 4) rows.push({ id: 'st-' + st.id + '-tv', title: `Top 10 Séries ${st.name}`, src: t.src, items: seq(t) });
    if (!rows.length) continue;
    out.push(...rows);
    n++;
  }
  return out;
}

/** Sem o arquivo de tops (ex.: primeira vez sem internet): Top 10 da semana do TMDB, se houver chave no aparelho. */
export async function fallbackLists(items: Channel[]): Promise<TopsData | null> {
  if (!tmdbKey()) return null;
  const [m, s] = await Promise.all([weeklyTop(items, 'movie'), weeklyTop(items, 'series')]);
  const toList = (kind: 'movie' | 'tv', r: typeof m): TopList => ({
    id: `semana-${kind}`,
    kind,
    group: 'geral',
    title: 'Em alta na semana',
    src: 'Em alta na semana (TMDB)',
    items: r.map((x) => ({ t: x.info.title, y: x.info.year })),
  });
  if (!m.length && !s.length) return null;
  return { v: 1, updated: new Date().toISOString(), lists: [toList('movie', m), toList('tv', s)], channels: [], at: Date.now() };
}

// ---------------------------------------------------------------- Top 10 canais agora

export interface TopChannelPick {
  ch: Channel;
  /** "Aberta", "Esportes"… */
  cat: string;
  /** Motivo de estar no topo agora (programa especial), se houver. */
  why?: string;
}

const compiled = new Map<string, RegExp | null>();
function re(src: string): RegExp | null {
  if (!compiled.has(src)) {
    try {
      compiled.set(src, new RegExp(src));
    } catch {
      compiled.set(src, null);
    }
  }
  return compiled.get(src)!;
}

const QUALITY = /\b(fhd|4k|uhd)\b/i;

/**
 * Os 10 canais para ver agora: ranking de popularidade (arquivo de tops, ou o
 * embutido no app) + o que está passando (jogo, filme, grande programa) +
 * favoritos e vistos por último.
 */
export function topChannels(data: TopsData | null, live: Channel[], favIds: string[], recentIds: string[], now = Date.now(), max = 10): TopChannelPick[] {
  const rank = data?.channels?.length ? data.channels : (base.canais as TopChannel[]);
  const fav = new Set(favIds);
  const recentPos = new Map(recentIds.slice(0, 15).map((id, i) => [id, i]));
  const keys = new Map<string, string>();
  const keyOf = (c: Channel) => {
    let k = keys.get(c.id);
    if (k == null) keys.set(c.id, (k = logoKey(c.fullName ?? c.name)));
    return k;
  };
  const used = new Set<string>();
  const scored: (TopChannelPick & { score: number })[] = [];
  rank.forEach((entry, r) => {
    const rx = re(entry.m);
    if (!rx) return;
    const cands = live.filter((c) => !used.has(c.id) && rx.test(keyOf(c)));
    if (!cands.length) return;
    // Melhor versão: a que você viu por último › favorita › FHD/4K › menor número.
    const pref = (c: Channel) => (recentPos.has(c.id) ? 100 - recentPos.get(c.id)! : 0) + (fav.has(c.id) ? 50 : 0) + (QUALITY.test(c.fullName ?? c.name) ? 10 : 0);
    const best = cands.slice().sort((a, b) => pref(b) - pref(a) || (a.number ?? 1e9) - (b.number ?? 1e9))[0];
    used.add(best.id);
    let score = (rank.length - r) * 2;
    let why: string | undefined;
    const cur = programmesOf(best).find((e) => e.start <= now && e.end > now);
    const k = cur ? kindOf(cur.title) : null;
    if (k === 'jogo') {
      score += 25;
      why = 'Jogo agora';
    } else if (k === 'filme') {
      score += 10;
      why = 'Filme agora';
    } else if (k === 'programa') {
      score += 10;
      why = 'Destaque agora';
    }
    if (fav.has(best.id)) score += 6;
    if (recentPos.has(best.id)) score += 8;
    scored.push({ ch: best, cat: entry.c, why, score });
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(({ ch, cat, why }) => ({ ch, cat, why }));
}

/** Gêneros que a busca reconhece (os das listas de Tops). */
export const SEARCH_GENRES = ['Ação', 'Aventura', 'Animação', 'Comédia', 'Crime', 'Documentário', 'Drama', 'Família', 'Fantasia', 'Ficção científica', 'Mistério', 'Romance', 'Suspense', 'Terror', 'Guerra', 'Faroeste', 'Infantil', 'Novelas', 'Reality'];

/** Busca por gênero: títulos das listas de Tops desse gênero + itens de categorias com o nome do gênero. */
export function genreMatches(data: TopsData | null, q: string, items: Channel[]): { genre: string; items: Channel[] } | null {
  const n = norm(q.trim());
  if (n.length < 3) return null;
  const genre = SEARCH_GENRES.find((g) => norm(g) === n || (n.length >= 4 && norm(g).startsWith(n)));
  if (!genre) return null;
  const gn = norm(genre);
  const out: Channel[] = [];
  const push = (c?: Channel) => c && !out.some((o) => o.id === c.id) && out.push(c);
  for (const l of data?.lists ?? []) {
    if (l.group !== 'genero' && l.group !== 'stgenero') continue;
    if (!norm(l.title).includes(gn)) continue;
    for (const it of l.items) push(findInList(it, l.kind, items));
    if (out.length >= 60) break;
  }
  for (const c of items) {
    if (out.length >= 80) break;
    if (c.kind !== 'live' && norm(c.group).includes(gn)) push(c);
  }
  return out.length ? { genre, items: out } : null;
}
