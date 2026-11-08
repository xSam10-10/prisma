import { fetchJson } from './net';
import { SourceError, type AccountInfo, type Channel, type EpgEntry } from './types';

// API Xtream Codes — a mesma usada pelo IPTV Smarters e pelo XCIPTV.

export interface XtreamCreds {
  server: string;
  username: string;
  password: string;
}

interface XUserInfo {
  auth?: number;
  status?: string;
  exp_date?: string | null;
  max_connections?: string;
  active_cons?: string;
}
interface XLogin {
  user_info?: XUserInfo;
  server_info?: { url?: string; port?: string; server_protocol?: string; timezone?: string };
}
interface XCategory {
  category_id: string;
  category_name: string;
}
interface XLive {
  num?: number;
  name: string;
  stream_id: number;
  stream_icon?: string;
  epg_channel_id?: string | null;
  category_id?: string | null;
  tv_archive?: number;
  tv_archive_duration?: number | string;
}
interface XVod {
  name: string;
  stream_id: number;
  stream_icon?: string;
  category_id?: string | null;
  container_extension?: string;
  rating?: string | number;
  added?: string;
  year?: string | number;
}
interface XSeries {
  name: string;
  series_id: number;
  cover?: string;
  category_id?: string | null;
  rating?: string | number;
  releaseDate?: string;
  last_modified?: string;
  year?: string | number;
}

function num(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
function yearOf(...vals: unknown[]): number | undefined {
  for (const v of vals) {
    const m = String(v ?? '').match(/(19|20)\d{2}/);
    if (m) return Number(m[0]);
  }
  return undefined;
}

export function normalizeServer(server: string): string {
  let s = server.trim();
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
  return s.replace(/\/+$/, '').replace(/\/(player_api|get)\.php.*$/i, '');
}

function api(c: XtreamCreds, action?: string, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams({ username: c.username, password: c.password, ...extra });
  if (action) p.set('action', action);
  return `${normalizeServer(c.server)}/player_api.php?${p.toString()}`;
}

export async function login(c: XtreamCreds): Promise<AccountInfo> {
  const r = await fetchJson<XLogin>(api(c));
  const u = r.user_info;
  if (!u || u.auth === 0) throw new SourceError('auth', 'Usuário ou senha incorretos.');
  const expiresAt = u.exp_date ? parseInt(u.exp_date, 10) * 1000 : undefined;
  const status = u.status;
  if ((status && status.toLowerCase() !== 'active') || (expiresAt && expiresAt < Date.now())) {
    throw new SourceError('expired', 'A assinatura desta lista está vencida ou desativada.');
  }
  return {
    status,
    expiresAt,
    maxConnections: u.max_connections ? parseInt(u.max_connections, 10) : undefined,
    activeConnections: u.active_cons ? parseInt(u.active_cons, 10) : undefined,
    timezone: r.server_info?.timezone || undefined,
  };
}

function catMap(cats: XCategory[]): Map<string, string> {
  return new Map(cats.map((c) => [String(c.category_id), c.category_name]));
}

/**
 * Formato do vídeo ao vivo. HLS (m3u8) funciona em todas as plataformas;
 * MPEG-TS é o padrão do Xtream e usa menos o servidor.
 */
export type LiveFormat = 'm3u8' | 'ts';

export async function loadAll(c: XtreamCreds, liveFormat: LiveFormat = 'm3u8'): Promise<Channel[]> {
  const base = normalizeServer(c.server);
  const u = encodeURIComponent(c.username);
  const p = encodeURIComponent(c.password);

  const [liveCats, live, vodCats, vod, serCats, series] = await Promise.all([
    fetchJson<XCategory[]>(api(c, 'get_live_categories')),
    fetchJson<XLive[]>(api(c, 'get_live_streams'), 90000),
    fetchJson<XCategory[]>(api(c, 'get_vod_categories')).catch(() => []),
    fetchJson<XVod[]>(api(c, 'get_vod_streams'), 240000).catch(() => []),
    fetchJson<XCategory[]>(api(c, 'get_series_categories')).catch(() => []),
    fetchJson<XSeries[]>(api(c, 'get_series'), 240000).catch(() => []),
  ]);

  const lc = catMap(Array.isArray(liveCats) ? liveCats : []);
  const vc = catMap(Array.isArray(vodCats) ? vodCats : []);
  const sc = catMap(Array.isArray(serCats) ? serCats : []);
  const out: Channel[] = [];

  (Array.isArray(live) ? live : []).forEach((s, i) => {
    out.push({
      id: 'l' + s.stream_id,
      kind: 'live',
      name: s.name?.trim() || `Canal ${s.stream_id}`,
      number: s.num ?? i + 1,
      group: lc.get(String(s.category_id)) ?? 'Sem categoria',
      logo: s.stream_icon || undefined,
      epgId: s.epg_channel_id || undefined,
      url: `${base}/live/${u}/${p}/${s.stream_id}.${liveFormat}`,
      altUrls: [`${base}/live/${u}/${p}/${s.stream_id}.${liveFormat === 'm3u8' ? 'ts' : 'm3u8'}`],
      catchupDays: s.tv_archive ? Number(s.tv_archive_duration) || undefined : undefined,
    });
  });
  (Array.isArray(vod) ? vod : []).forEach((s) => {
    out.push({
      id: 'm' + s.stream_id,
      kind: 'movie',
      name: s.name?.trim() || `Filme ${s.stream_id}`,
      group: vc.get(String(s.category_id)) ?? 'Sem categoria',
      logo: s.stream_icon || undefined,
      url: `${base}/movie/${u}/${p}/${s.stream_id}.${s.container_extension || 'mp4'}`,
      rating: num(s.rating),
      year: yearOf(s.year, s.name),
      added: num(s.added) ? num(s.added)! * 1000 : undefined,
    });
  });
  (Array.isArray(series) ? series : []).forEach((s) => {
    out.push({
      id: 's' + s.series_id,
      kind: 'series',
      name: s.name?.trim() || `Série ${s.series_id}`,
      group: sc.get(String(s.category_id)) ?? 'Sem categoria',
      logo: s.cover || undefined,
      url: '', // episódios vêm de get_series_info
      rating: num(s.rating),
      year: yearOf(s.year, s.releaseDate, s.name),
      added: num(s.last_modified) ? num(s.last_modified)! * 1000 : undefined,
    });
  });

  return out;
}

function b64(s: string): string {
  try {
    const bin = atob(s);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return s;
  }
}

/** Guia curto (agora e a seguir) de um canal. */
export async function shortEpg(c: XtreamCreds, streamId: string, limit = 4): Promise<EpgEntry[]> {
  const id = streamId.replace(/^l/, '');
  const r = await fetchJson<{ epg_listings?: Array<Record<string, string | number>> }>(
    api(c, 'get_short_epg', { stream_id: id, limit: String(limit) }),
    15000,
  );
  return (r.epg_listings ?? [])
    .map((e) => ({
      title: b64(String(e.title ?? '')),
      description: e.description ? b64(String(e.description)) : undefined,
      start: Number(e.start_timestamp) * 1000 || Date.parse(String(e.start).replace(' ', 'T')),
      end: Number(e.stop_timestamp) * 1000 || Date.parse(String(e.end).replace(' ', 'T')),
    }))
    .filter((e) => e.title && Number.isFinite(e.start) && Number.isFinite(e.end));
}

// ---- Detalhes de filmes e séries ----

export interface VodDetails {
  plot?: string;
  genre?: string;
  cast?: string;
  director?: string;
  year?: number;
  rating?: number;
  duration?: string;
  backdrop?: string;
  cover?: string;
  trailer?: string;
}

export interface Episode {
  id: string;
  season: number;
  number: number;
  title: string;
  plot?: string;
  duration?: string;
  cover?: string;
  url: string;
}

export interface SeriesDetails extends VodDetails {
  seasons: number[];
  episodes: Episode[];
}

type Obj = Record<string, unknown>;
const str = (v: unknown) => (v == null || v === '' ? undefined : String(v));
const first = (v: unknown) => (Array.isArray(v) ? str(v[0]) : str(v));

function details(info: Obj): VodDetails {
  return {
    plot: str(info.plot ?? info.description),
    genre: str(info.genre),
    cast: str(info.cast ?? info.actors),
    director: str(info.director),
    year: yearOf(info.releasedate, info.releaseDate, info.release_date, info.year),
    rating: num(info.rating),
    duration: str(info.duration),
    backdrop: first(info.backdrop_path),
    cover: str(info.movie_image ?? info.cover ?? info.cover_big),
    trailer: str(info.youtube_trailer),
  };
}

export async function vodInfo(c: XtreamCreds, movieId: string): Promise<VodDetails> {
  const r = await fetchJson<{ info?: Obj }>(api(c, 'get_vod_info', { vod_id: movieId.replace(/^m/, '') }), 20000);
  return details(r.info ?? {});
}

export async function seriesInfo(c: XtreamCreds, seriesId: string): Promise<SeriesDetails> {
  const base = normalizeServer(c.server);
  const u = encodeURIComponent(c.username);
  const p = encodeURIComponent(c.password);
  const r = await fetchJson<{ info?: Obj; episodes?: Record<string, Obj[]> | Obj[][] }>(api(c, 'get_series_info', { series_id: seriesId.replace(/^s/, '') }), 30000);
  const eps: Episode[] = [];
  const groups = r.episodes ?? {};
  const lists: Obj[][] = Array.isArray(groups) ? groups : Object.values(groups);
  for (const list of lists) {
    for (const e of list ?? []) {
      const info = (e.info ?? {}) as Obj;
      const season = Number(e.season ?? info.season ?? 1) || 1;
      eps.push({
        id: 'e' + String(e.id),
        season,
        number: Number(e.episode_num ?? 0) || eps.filter((x) => x.season === season).length + 1,
        title: str(e.title) ?? `Episódio ${e.episode_num}`,
        plot: str(info.plot),
        duration: str(info.duration),
        cover: str(info.movie_image),
        url: `${base}/series/${u}/${p}/${e.id}.${str(e.container_extension) ?? 'mp4'}`,
      });
    }
  }
  eps.sort((a, b) => a.season - b.season || a.number - b.number);
  return { ...details(r.info ?? {}), seasons: [...new Set(eps.map((e) => e.season))], episodes: eps };
}
