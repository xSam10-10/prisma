import { fetchText } from './net';
import { idbGet, idbSet, prefGet } from './storage';
import type { Channel } from './types';

// TMDB (The Movie Database): capas, fundos, sinopse em português, trailer e
// "Top 10 da semana". Precisa de uma chave gratuita (API v3) nos Ajustes.

export interface TmdbInfo {
  id: number;
  type: 'movie' | 'tv';
  title: string;
  poster?: string;
  backdrop?: string;
  overview?: string;
  year?: number;
  rating?: number;
  trailer?: string; // id do YouTube
}

const API = () => prefGet<string>('tmdbBase', 'https://api.themoviedb.org/3');
const IMG = () => prefGet<string>('tmdbImg', 'https://image.tmdb.org/t/p');

export function tmdbKey(): string {
  return (prefGet<string>('tmdbKey', '') || prefGet<{ tmdbKey?: string }>('settings', {}).tmdbKey || '').trim();
}

async function call<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = tmdbKey();
  if (!key) throw new Error('sem chave');
  const q = new URLSearchParams({ api_key: key, language: 'pt-BR', ...params });
  return JSON.parse(await fetchText(`${API()}${path}?${q.toString()}`, 15000)) as T;
}

/** Testa a chave (Ajustes). */
export async function testKey(key: string): Promise<boolean> {
  try {
    const q = new URLSearchParams({ api_key: key.trim() });
    const r = JSON.parse(await fetchText(`${API()}/configuration?${q.toString()}`, 15000)) as { images?: unknown };
    return !!r.images;
  } catch {
    return false;
  }
}

/** Título "limpo" para buscar: sem ano, qualidade, legendado/dublado etc. */
export function searchTitle(name: string): { title: string; year?: number } {
  const year = name.match(/\((19|20)\d{2}\)|\b(19|20)\d{2}\b/);
  const title = name
    .replace(/\((19|20)\d{2}\)|\[[^\]]*\]|\((?:dub|leg|dublado|legendado|nacional)[^)]*\)/gi, ' ')
    .replace(/\b(4k|uhd|fhd|hd|sd|h265|hevc|dublado|legendado|dual|nacional|leg|dub|cam|ts)\b/gi, ' ')
    .replace(/\s*[-–|:]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { title, year: year ? Number(year[0].replace(/\D/g, '')) : undefined };
}

export function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

type Raw = { id: number; title?: string; name?: string; original_title?: string; original_name?: string; poster_path?: string; backdrop_path?: string; overview?: string; release_date?: string; first_air_date?: string; vote_average?: number };

function toInfo(r: Raw, type: 'movie' | 'tv'): TmdbInfo {
  const date = r.release_date || r.first_air_date || '';
  return {
    id: r.id,
    type,
    title: r.title || r.name || '',
    poster: r.poster_path ? `${IMG()}/w342${r.poster_path}` : undefined,
    backdrop: r.backdrop_path ? `${IMG()}/w1280${r.backdrop_path}` : undefined,
    overview: r.overview || undefined,
    year: date ? Number(date.slice(0, 4)) : undefined,
    rating: r.vote_average || undefined,
  };
}

// ---- Cache (memória + IndexedDB) ----
let cache: Record<string, TmdbInfo | null> | null = null;
let saveTimer: number | undefined;
async function loadCache(): Promise<Record<string, TmdbInfo | null>> {
  if (!cache) cache = (await idbGet<Record<string, TmdbInfo | null>>('tmdb')) ?? {};
  return cache;
}
function persist() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => cache && idbSet('tmdb', cache), 2000);
}
export function clearTmdbCache(): void {
  cache = {};
  idbSet('tmdb', {});
}

/** Fila: no máximo 3 buscas ao mesmo tempo (a grade pede várias capas). */
let running = 0;
const waiting: (() => void)[] = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= 3) await new Promise<void>((r) => waiting.push(r));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

/** Encontra o título no TMDB (com cache). */
export async function lookup(item: Channel): Promise<TmdbInfo | null> {
  if (!tmdbKey() || item.kind === 'live') return null;
  const type = item.kind === 'movie' ? 'movie' : 'tv';
  const { title, year } = searchTitle(item.fullName ?? item.name);
  const key = `${type}|${norm(title)}|${year ?? item.year ?? ''}`;
  const c = await loadCache();
  if (key in c) return c[key];
  return slot(async () => {
    try {
      const y = year ?? item.year;
      const params: Record<string, string> = { query: title };
      if (y) params[type === 'movie' ? 'year' : 'first_air_date_year'] = String(y);
      let r = await call<{ results: Raw[] }>(`/search/${type}`, params);
      if (!r.results?.length && y) r = await call<{ results: Raw[] }>(`/search/${type}`, { query: title });
      const best = r.results?.[0];
      const info = best ? toInfo(best, type) : null;
      c[key] = info;
      persist();
      return info;
    } catch {
      return null;
    }
  });
}

/** Trailer no YouTube (pt-BR; se não houver, em inglês). */
export async function trailerOf(info: TmdbInfo): Promise<string | undefined> {
  if (info.trailer) return info.trailer;
  type V = { results: { site: string; type: string; key: string }[] };
  const pick = (v: V) => v.results?.find((x) => x.site === 'YouTube' && /trailer/i.test(x.type))?.key ?? v.results?.find((x) => x.site === 'YouTube')?.key;
  try {
    const pt = pick(await call<V>(`/${info.type}/${info.id}/videos`));
    info.trailer = pt ?? pick(await call<V>(`/${info.type}/${info.id}/videos`, { language: 'en-US' }));
    return info.trailer;
  } catch {
    return undefined;
  }
}

/**
 * Top 10 da semana do TMDB cruzado com a lista (só entra o que você pode assistir).
 * Procura cada título em alta pelo nome (sem acentos) na lista.
 */
export async function weeklyTop(items: Channel[], kind: 'movie' | 'series'): Promise<{ item: Channel; info: TmdbInfo }[]> {
  if (!tmdbKey()) return [];
  const type = kind === 'movie' ? 'movie' : 'tv';
  const pool = items.filter((i) => i.kind === kind);
  const byTitle = new Map<string, Channel>();
  for (const i of pool) {
    const k = norm(searchTitle(i.fullName ?? i.name).title);
    if (k && !byTitle.has(k)) byTitle.set(k, i);
  }
  const out: { item: Channel; info: TmdbInfo }[] = [];
  try {
    for (let page = 1; page <= 3 && out.length < 10; page++) {
      const r = await call<{ results: Raw[] }>(`/trending/${type}/week`, { page: String(page) });
      for (const raw of r.results ?? []) {
        const info = toInfo(raw, type);
        const names = [raw.title, raw.name, raw.original_title, raw.original_name].filter(Boolean).map((n) => norm(n!));
        const hit = names.map((n) => byTitle.get(n)).find(Boolean);
        if (hit && !out.some((o) => o.item.id === hit.id)) out.push({ item: hit, info });
        if (out.length >= 10) break;
      }
    }
  } catch {
    /* sem rede/chave inválida */
  }
  return out;
}
