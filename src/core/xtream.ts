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
  server_info?: { url?: string; port?: string; server_protocol?: string };
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
}
interface XSeries {
  name: string;
  series_id: number;
  cover?: string;
  category_id?: string | null;
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
    fetchJson<XVod[]>(api(c, 'get_vod_streams'), 90000).catch(() => []),
    fetchJson<XCategory[]>(api(c, 'get_series_categories')).catch(() => []),
    fetchJson<XSeries[]>(api(c, 'get_series'), 90000).catch(() => []),
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
    });
  });
  (Array.isArray(series) ? series : []).forEach((s) => {
    out.push({
      id: 's' + s.series_id,
      kind: 'series',
      name: s.name?.trim() || `Série ${s.series_id}`,
      group: sc.get(String(s.category_id)) ?? 'Sem categoria',
      logo: s.cover || undefined,
      url: '', // episódios vêm de get_series_info (passo 4 da Fase 1)
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
