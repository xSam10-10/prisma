import { fetchText } from './net';
import { idbGet, idbSet, prefGet } from './storage';
import type { Channel } from './types';
import { isAdultName } from './parental';
import { isGenericLogo } from './vod';
import { adultQuery, sameContent, titlePart, tpdbKey, tpdbLookup, tpdbPerformer, type FansPage, type Performer, type StudioInfo } from './tpdb';
import { actressKey, namesInTitle } from './actresses';

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
  /** Título original (para cruzar com a lista). */
  original?: string;
  /** Atrizes (ThePornDB, 0.32.0). */
  performers?: Performer[];
  /** Sem capa do filme: a capa é a foto das atrizes (0.33.0). */
  actressCover?: boolean;
  /** Produtora (ThePornDB, 0.34.0). */
  studio?: StudioInfo;
  /** Página da atriz no OnlyFans ("FansDB: …", 0.34.3). */
  fans?: FansPage;
}

const API = () => prefGet<string>('tmdbBase', 'https://api.themoviedb.org/3');
const IMG = () => prefGet<string>('tmdbImg', 'https://image.tmdb.org/t/p');

/** URL de imagem do TMDB a partir do caminho (não precisa de chave). */
export function tmdbImage(path: string, size = 'w780'): string {
  return `${IMG()}/${size}${path}`;
}

export function tmdbKey(): string {
  return (prefGet<string>('tmdbKey', '') || prefGet<{ tmdbKey?: string }>('settings', {}).tmdbKey || '').trim();
}

async function call<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = tmdbKey();
  if (!key) throw new Error('sem chave');
  // Capa vinda da ThePornDB (número negativo): não tem página no TMDB.
  if (/\/-\d/.test(path)) throw new Error('fora do TMDB');
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

type Raw = { id: number; adult?: boolean; title?: string; name?: string; original_title?: string; original_name?: string; poster_path?: string; backdrop_path?: string; overview?: string; release_date?: string; first_air_date?: string; vote_average?: number };

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
  if (!cache) {
    cache = (await idbGet<Record<string, TmdbInfo | null>>('tmdb')) ?? {};
    // Buscas de adultos de antes da 0.35.2 (podiam ter homens no elenco): saem para dar lugar às novas.
    for (const k of Object.keys(cache)) if (/^adult[0-5]\|/.test(k)) delete cache[k];
  }
  return cache;
}
/** Leu do cache: passa para o fim da fila, para não ser o próximo a sair (0.35.2). */
function hit(c: Record<string, TmdbInfo | null>, key: string): TmdbInfo | null {
  const v = c[key];
  delete c[key];
  c[key] = v;
  return v;
}
/** Títulos guardados no máximo (0.35.0): antes crescia sem fim e era regravado inteiro a cada 2 s.
 *  0.35.2: 3.000 era pouco para listas grandes (as capas voltavam a ser buscadas na internet); sai o menos usado. */
const CACHE_MAX = 6000;
let tmdbDirty = false;
function flushTmdb() {
  clearTimeout(saveTimer);
  if (!cache || !tmdbDirty) return;
  tmdbDirty = false;
  // Os menos usados saem primeiro (a ordem das chaves é a do último uso, ver hit).
  const keys = Object.keys(cache);
  for (let i = 0; i < keys.length - CACHE_MAX; i++) delete cache[keys[i]];
  void idbSet('tmdb', cache);
}
function persist() {
  tmdbDirty = true;
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flushTmdb, 10000);
}
/** Chave nova (TMDB ou ThePornDB): procura de novo o que ficou sem capa. As capas de adultos achadas ficam. */
export function clearTmdbCache(): void {
  cache = {};
  idbSet('tmdb', {});
  void loadAdult().then((m) => {
    m.forEach((e, k) => {
      if (!e.v) {
        m.delete(k);
        dirty[shardOf(k)] = true;
      }
    });
    saveAdult();
  });
}

// ---- Capas de adultos guardadas sem prazo (0.35.3) ----
// Pedido do Samuel: capa de adulto baixada uma vez não é baixada de novo. Antes dividiam o cache
// do TMDB (6.000 títulos para filmes, séries e adultos; a categoria tem 10 mil) e falha de rede
// ficava guardada como "sem capa". Agora: guardadas à parte, sem limite, em 16 pedaços (só o
// pedaço que mudou é regravado) e gravadas também quando o app sai da tela.
interface AdultEntry {
  /** O que achou (null = procurou e não tem). */
  v: TmdbInfo | null;
  /** Com que chaves procurou: "p" ThePornDB, "t" TMDB. Chave nova refaz só as que não tinham. */
  f: string;
}
const SHARDS = 16;
let adultMap: Map<string, AdultEntry> | null = null;
let adultLoading: Promise<Map<string, AdultEntry>> | null = null;
const dirty: boolean[] = [];
let adultTimer: number | undefined;
function shardOf(k: string): number {
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) | 0;
  return Math.abs(h) % SHARDS;
}
function flushAdult(): void {
  clearTimeout(adultTimer);
  if (!adultMap) return;
  const out: Record<string, Record<string, AdultEntry>> = {};
  for (let i = 0; i < SHARDS; i++) if (dirty[i]) out[i] = {};
  if (!Object.keys(out).length) return;
  adultMap.forEach((e, k) => {
    const s = out[shardOf(k)];
    if (s) s[k] = e;
  });
  for (const i of Object.keys(out)) {
    dirty[+i] = false;
    void idbSet('adultc' + i, out[i]);
  }
}
function saveAdult(): void {
  clearTimeout(adultTimer);
  adultTimer = window.setTimeout(flushAdult, 3000);
}
function loadAdult(): Promise<Map<string, AdultEntry>> {
  if (adultMap) return Promise.resolve(adultMap);
  if (!adultLoading)
    adultLoading = (async () => {
      const m = new Map<string, AdultEntry>();
      const parts = await Promise.all(Array.from({ length: SHARDS }, (_, i) => idbGet<Record<string, AdultEntry>>('adultc' + i)));
      for (const p of parts) if (p) for (const k of Object.keys(p)) m.set(k, p[k]);
      // Da 0.35.2 (cache do TMDB, "adult6|pt|título|ano"): passam para cá as que acharam capa.
      const c = await loadCache();
      let moved = false;
      for (const k of Object.keys(c)) {
        const mm = /^adult6\|([pt]*)\|(.*)$/.exec(k);
        if (!mm) continue;
        if (c[k] && !m.has(mm[2])) {
          m.set(mm[2], { v: c[k], f: mm[1] });
          dirty[shardOf(mm[2])] = true;
        }
        delete c[k];
        moved = true;
      }
      adultMap = m;
      if (moved) {
        persist();
        saveAdult();
      }
      // Saiu do app (TV desligada, botão Home): grava na hora o que falta.
      const out = () => {
        flushAdult();
        flushTmdb();
      };
      document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && out());
      window.addEventListener('pagehide', out);
      return m;
    })();
  return adultLoading;
}
const adultFlags = () => (tpdbKey() ? 'p' : '') + (tmdbKey() ? 't' : '');
/** A busca guardada já usou todas as chaves que o aparelho tem agora? */
const covers = (had: string, now: string) => now.split('').every((ch) => had.indexOf(ch) >= 0);
function adultKey(item: Channel): string {
  const { title, year } = searchTitle(adultQuery(item.fullName ?? item.name));
  return `${norm(title)}|${year ?? item.year ?? ''}`;
}
function adultHit(item: Channel): TmdbInfo | null | undefined {
  const e = adultMap?.get(adultKey(item));
  return e && covers(e.f, adultFlags()) ? e.v : undefined;
}

/**
 * O que já foi baixado (sem internet): `hit` por id do título; `miss` são os que ainda faltam.
 * Os filtros de atrizes e produtoras aparecem na hora com isso (0.35.3).
 */
export async function adultCached(items: Channel[]): Promise<{ hit: Map<string, TmdbInfo | null>; miss: Channel[] }> {
  await loadAdult();
  const hit = new Map<string, TmdbInfo | null>();
  const miss: Channel[] = [];
  for (const it of items) {
    const v = adultHit(it);
    if (v === undefined) miss.push(it);
    else hit.set(it.id, v);
  }
  return { hit, miss };
}

/** Já está na memória? (a capa aparece na hora, sem esperar). undefined = ainda não sabe. */
export function cachedInfo(item: Channel, logoBroken = false): TmdbInfo | null | undefined {
  if (item.kind === 'live') return null;
  if (isAdultName(item.group)) return isGenericLogo(item.logo) || logoBroken ? adultHit(item) : null;
  if (!cache || !tmdbKey()) return undefined;
  const key = tmdbCacheKey(item);
  return key in cache ? cache[key] : undefined;
}
function tmdbCacheKey(item: Channel): string {
  const type = item.kind === 'movie' ? 'movie' : 'tv';
  const { title, year } = searchTitle(item.fullName ?? item.name);
  return `${type}|${norm(title)}|${year ?? item.year ?? ''}`;
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
export async function lookup(item: Channel, logoBroken = false): Promise<TmdbInfo | null> {
  if (item.kind === 'live') return null;
  // Adultos (0.31.0): só procura quando a capa da lista é a genérica; aí tenta o TMDB com
  // conteúdo adulto e, se não achar, a ThePornDB. Capa de verdade da lista fica como está.
  // 0.32.0: capa da lista que não abre (link quebrado) também conta como genérica.
  if (isAdultName(item.group)) return isGenericLogo(item.logo) || logoBroken ? adultInfo(item) : null;
  if (!tmdbKey()) return null;
  const type = item.kind === 'movie' ? 'movie' : 'tv';
  const { title, year } = searchTitle(item.fullName ?? item.name);
  const key = tmdbCacheKey(item);
  const c = await loadCache();
  if (key in c) return hit(c, key);
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

/**
 * Título de adulto: ThePornDB (capa + atrizes) › TMDB (só resultado marcado como adulto e com o título batendo).
 * 0.32.0: a ThePornDB vem primeiro (traz as atrizes) e o cache separa "com token" de "sem token", para
 * que o token que chega pela nuvem refaça as buscas que antes deram em nada.
 */
export async function adultInfo(item: Channel): Promise<TmdbInfo | null> {
  const key = adultKey(item);
  const m = await loadAdult();
  const f = adultFlags();
  const e = m.get(key);
  // Já baixada (ou já procurada com as mesmas chaves): não vai à internet.
  if (e && covers(e.f, f)) return e.v;
  if (!f) return e ? e.v : null;
  // O mesmo título pedido pela grade e pelos filtros ao mesmo tempo: uma busca só.
  let p = inflight.get(key);
  if (!p) {
    p = slot(() => fetchAdult(item, key, f, e?.v ?? null));
    inflight.set(key, p);
    void p.then(() => inflight.delete(key));
  }
  return p;
}
const inflight = new Map<string, Promise<TmdbInfo | null>>();

async function fetchAdult(item: Channel, key: string, f: string, old: TmdbInfo | null): Promise<TmdbInfo | null> {
  const name = item.fullName ?? item.name;
  const { title, year } = searchTitle(adultQuery(name));
  let info: TmdbInfo | null = null;
  try {
    if (tpdbKey()) info = await tpdbLookup(name, year ?? item.year);
    if (!info?.poster && tmdbKey()) {
      const r = await call<{ results: Raw[] }>('/search/movie', { query: title, include_adult: 'true' });
      const hit = (r.results ?? []).find((x) => x.adult && x.poster_path && (sameContent(title, x.title ?? '') || sameContent(title, x.original_title ?? '')));
      if (hit) info = { ...toInfo(hit, 'movie'), performers: info?.performers, studio: info?.studio, fans: info?.fans };
    }
    // Nada de capa: a foto das atrizes vira a capa (a do título primeiro).
    if (!info?.poster && tpdbKey()) info = await actressCover(name, info);
    // Último recurso antes da capa genérica: a imagem da página dela no OnlyFans (FansDB).
    if (info && !info.poster && info.fans?.image) info = { ...info, poster: info.fans.image, backdrop: info.backdrop || info.fans.image };
  } catch {
    // Sem internet / servidor ocupado: não guarda nada, tenta de novo na próxima vez.
    return old;
  }
  // Achou menos que antes (uma chave a mais não trouxe capa): fica a que já tinha.
  if (!info?.poster && old?.poster) info = { ...old, performers: info?.performers?.length ? info.performers : old.performers };
  adultMap!.set(key, { v: info, f });
  dirty[shardOf(key)] = true;
  saveAdult();
  return info;
}

/**
 * Capa com a foto das atrizes (0.33.0): as que a ThePornDB disse que estão no filme e/ou os nomes
 * do título, conferidos lá. A atriz cujo nome está no título vem primeiro (é a capa padrão).
 */
async function actressCover(name: string, found: TmdbInfo | null): Promise<TmdbInfo | null> {
  const inTitle = namesInTitle(name);
  const cast = (found?.performers ?? []).slice();
  for (const n of inTitle) if (!cast.some((p) => actressKey(p.name) === actressKey(n))) cast.push({ name: n });
  const rank = (p: Performer) => {
    const i = inTitle.findIndex((n) => actressKey(n) === actressKey(p.name));
    return i < 0 ? 99 : i;
  };
  cast.sort((a, b) => rank(a) - rank(b));
  const out: Performer[] = [];
  for (const p of cast.slice(0, 5)) {
    // Sem foto (ou só um nome do título): procura a atriz na ThePornDB.
    const full = p.portrait ? p : await tpdbPerformer(p.name);
    if (full?.portrait) out.push({ ...full, name: full.name || p.name });
  }
  if (!out.length) return found;
  return {
    id: found?.id ?? -Math.abs(name.length * 7919 + 1),
    type: 'movie',
    title: found?.title || titlePart(name) || name,
    poster: out[0].portrait,
    backdrop: out[0].portrait,
    overview: found?.overview,
    studio: found?.studio,
    fans: found?.fans,
    year: found?.year,
    performers: out,
    actressCover: true,
  };
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

// ---------------------------------------------------------------- Extras do detalhe (0.20.0)
// Logo oficial do título, elenco com foto e "Semelhantes". Cache em memória.

const extras = new Map<string, unknown>();
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (extras.has(key)) return extras.get(key) as T;
  const v = await fn();
  extras.set(key, v);
  return v;
}

/** Logo do título (PNG/SVG transparente): português › inglês › sem idioma. */
export function logoOf(info: TmdbInfo): Promise<string | undefined> {
  return cached(`logo|${info.type}|${info.id}`, async () => {
    try {
      type L = { logos?: { file_path: string; iso_639_1: string | null; vote_average?: number }[] };
      const r = await call<L>(`/${info.type}/${info.id}/images`, { include_image_language: 'pt,en,null' });
      const all = r.logos ?? [];
      const pick = all.find((l) => l.iso_639_1 === 'pt') ?? all.find((l) => l.iso_639_1 === 'en') ?? all.find((l) => !l.iso_639_1) ?? all[0];
      if (!pick) return undefined;
      return `${IMG()}/${/\.svg$/i.test(pick.file_path) ? 'original' : 'w500'}${pick.file_path}`;
    } catch {
      return undefined;
    }
  });
}

export interface CastMember {
  id?: number;
  name: string;
  role?: string;
  photo?: string;
}

/** Elenco principal (até 12) com foto. */
export function castOf(info: TmdbInfo): Promise<CastMember[]> {
  return cached(`cast|${info.type}|${info.id}`, async () => {
    try {
      type C = { cast?: { id?: number; name: string; character?: string; roles?: { character?: string }[]; profile_path?: string }[] };
      const r = await call<C>(`/${info.type}/${info.id}/${info.type === 'tv' ? 'aggregate_credits' : 'credits'}`);
      return (r.cast ?? []).slice(0, 12).map((c) => ({ id: c.id, name: c.name, role: c.character || c.roles?.[0]?.character || undefined, photo: c.profile_path ? `${IMG()}/w185${c.profile_path}` : undefined }));
    } catch {
      return [];
    }
  });
}

/** Recomendações do TMDB para o título (a tela cruza com a lista). */
export function similarOf(info: TmdbInfo): Promise<TmdbInfo[]> {
  return cached(`sim|${info.type}|${info.id}`, async () => {
    try {
      const r = await call<{ results: Raw[] }>(`/${info.type}/${info.id}/recommendations`);
      return (r.results ?? []).map((x) => ({ ...toInfo(x, info.type), original: x.original_title || x.original_name }));
    } catch {
      return [];
    }
  });
}

// ---------------------------------------------------------------- 0.22.0: ator, cenas, classificação, próximo episódio

export interface Person {
  id: number;
  name: string;
  bio?: string;
  photo?: string;
  birth?: string;
  place?: string;
  dept?: string;
  /** Trabalhos (filmes e séries), mais populares primeiro. */
  credits: TmdbInfo[];
}

/** Página do ator/diretor: biografia e trabalhos (combined_credits). */
export function personOf(id: number): Promise<Person | null> {
  return cached(`person|${id}`, async () => {
    try {
      type P = { id: number; name: string; biography?: string; profile_path?: string; birthday?: string; place_of_birth?: string; known_for_department?: string };
      type CC = { cast?: (Raw & { media_type: 'movie' | 'tv'; popularity?: number })[]; crew?: (Raw & { media_type: 'movie' | 'tv'; popularity?: number; job?: string })[] };
      const [p, cc] = await Promise.all([call<P>(`/person/${id}`), call<CC>(`/person/${id}/combined_credits`)]);
      const all = [...(cc.cast ?? []), ...(cc.crew ?? []).filter((c) => c.job === 'Director')];
      const seen = new Set<string>();
      const credits = all
        .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
        .filter((x) => {
          const k = x.media_type + x.id;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .map((x) => ({ ...toInfo(x, x.media_type), original: x.original_title || x.original_name }));
      return { id: p.id, name: p.name, bio: p.biography || undefined, photo: p.profile_path ? `${IMG()}/h632${p.profile_path}` : undefined, birth: p.birthday || undefined, place: p.place_of_birth || undefined, dept: p.known_for_department, credits };
    } catch {
      return null;
    }
  });
}

/** Cenas (imagens largas) do título, para as miniaturas da barra de tempo. */
export function scenesOf(info: TmdbInfo): Promise<string[]> {
  return cached(`scenes|${info.type}|${info.id}`, async () => {
    try {
      const r = await call<{ backdrops?: { file_path: string }[] }>(`/${info.type}/${info.id}/images`, { include_image_language: 'null,pt,en' });
      return (r.backdrops ?? []).slice(0, 24).map((b) => `${IMG()}/w300${b.file_path}`);
    } catch {
      return [];
    }
  });
}

/** Classificação indicativa no Brasil (L, 10, 12, 14, 16, 18). */
export function ratingOf(info: TmdbInfo): Promise<string | undefined> {
  return cached(`cert|${info.type}|${info.id}`, async () => {
    try {
      if (info.type === 'movie') {
        const r = await call<{ results?: { iso_3166_1: string; release_dates: { certification: string }[] }[] }>(`/movie/${info.id}/release_dates`);
        const br = r.results?.find((x) => x.iso_3166_1 === 'BR');
        return br?.release_dates.map((d) => d.certification).find(Boolean) || undefined;
      }
      const r = await call<{ results?: { iso_3166_1: string; rating: string }[] }>(`/tv/${info.id}/content_ratings`);
      return r.results?.find((x) => x.iso_3166_1 === 'BR')?.rating || undefined;
    } catch {
      return undefined;
    }
  });
}

export interface NextEpisode {
  date: string;
  season: number;
  episode: number;
  name?: string;
}

/** Próximo episódio a sair e o último que saiu (para o selo "NOVO EPISÓDIO"). */
export function episodesOf(info: TmdbInfo): Promise<{ next?: NextEpisode; last?: NextEpisode }> {
  return cached(`eps|${info.id}`, async () => {
    try {
      type E = { air_date: string; season_number: number; episode_number: number; name?: string } | null;
      const r = await call<{ next_episode_to_air?: E; last_episode_to_air?: E }>(`/tv/${info.id}`);
      const conv = (n?: E) => (n && n.air_date ? { date: n.air_date, season: n.season_number, episode: n.episode_number, name: n.name } : undefined);
      return { next: conv(r.next_episode_to_air), last: conv(r.last_episode_to_air) };
    } catch {
      return {};
    }
  });
}

/** Busca por pessoa (ator/diretor) para a busca do app: a mais conhecida com esse nome. */
export function searchPerson(q: string): Promise<{ id: number; name: string; photo?: string } | null> {
  return cached(`sperson|${q.toLowerCase()}`, async () => {
    try {
      type R = { results?: { id: number; name: string; profile_path?: string; popularity?: number; known_for_department?: string }[] };
      const r = await call<R>('/search/person', { query: q });
      const p = (r.results ?? []).filter((x) => (x.known_for_department === 'Acting' || x.known_for_department === 'Directing') && (x.popularity ?? 0) >= 1)[0];
      return p ? { id: p.id, name: p.name, photo: p.profile_path ? `${IMG()}/w185${p.profile_path}` : undefined } : null;
    } catch {
      return null;
    }
  });
}

/** Títulos do TMDB para um texto (português ou inglês), para achar na lista pelo outro nome. */
export function searchTitles(q: string): Promise<{ t: string; o?: string; y?: number; kind: 'movie' | 'tv' }[]> {
  return cached(`smulti|${q.toLowerCase()}`, async () => {
    try {
      type R = { results?: (Raw & { media_type?: string })[] };
      const r = await call<R>('/search/multi', { query: q });
      return (r.results ?? [])
        .filter((x) => x.media_type === 'movie' || x.media_type === 'tv')
        .slice(0, 8)
        .map((x) => {
          const date = x.release_date || x.first_air_date || '';
          return { t: x.title || x.name || '', o: x.original_title || x.original_name, y: date ? Number(date.slice(0, 4)) : undefined, kind: x.media_type as 'movie' | 'tv' };
        });
    } catch {
      return [];
    }
  });
}
