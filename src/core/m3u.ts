import type { Channel, ItemKind } from './types';

export interface ParsedM3U {
  epgUrl?: string;
  items: Channel[];
}

const ATTR_RE = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
const VOD_EXT = /\.(mp4|mkv|avi|mov|wmv|m4v|webm|flv)(\?|$)/i;

/** Lê o atributo da linha #EXTINF e devolve { atributos, título }. */
function parseExtinf(line: string): { attrs: Record<string, string>; title: string } {
  const body = line.slice(line.indexOf(':') + 1);
  // O título é o que vem depois da última vírgula que está fora de aspas.
  let inQuote = false;
  let commaAt = -1;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '"') inQuote = !inQuote;
    else if (ch === ',' && !inQuote) commaAt = i;
  }
  const head = commaAt >= 0 ? body.slice(0, commaAt) : body;
  const title = commaAt >= 0 ? body.slice(commaAt + 1).trim() : '';
  const attrs: Record<string, string> = {};
  for (const m of head.matchAll(ATTR_RE)) attrs[m[1].toLowerCase()] = m[2].trim();
  return { attrs, title };
}

/** Descobre se a entrada é canal ao vivo, filme ou série. */
export function classify(url: string, group: string): ItemKind {
  if (/\/series\//i.test(url)) return 'series';
  if (/\/movie\//i.test(url)) return 'movie';
  const g = group.toLowerCase();
  if (VOD_EXT.test(url)) {
    if (/s[eé]rie|temporada|season|anime|novela/.test(g)) return 'series';
    return 'movie';
  }
  return 'live';
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/**
 * Leitor de M3U / M3U8 (formato "extended M3U" das listas IPTV, inclusive
 * as usadas pelo SS IPTV). Tolerante a linhas quebradas e a BOM.
 */
export function parseM3U(text: string, baseUrl?: string): ParsedM3U {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const items: Channel[] = [];
  let epgUrl: string | undefined;

  let pending: { attrs: Record<string, string>; title: string } | null = null;
  let extGroup: string | undefined;
  let headers: Channel['headers'] | undefined;
  let liveCount = 0;
  const seen = new Map<string, number>();

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('#EXTM3U')) {
      const { attrs } = parseExtinf('#EXTM3U:' + line.slice(7) + ',');
      epgUrl = attrs['url-tvg'] || attrs['x-tvg-url'] || attrs['tvg-url'] || epgUrl;
      if (epgUrl) epgUrl = epgUrl.split(',')[0].trim();
      continue;
    }
    if (line.startsWith('#EXTINF')) {
      pending = parseExtinf(line);
      continue;
    }
    if (line.startsWith('#EXTGRP:')) {
      extGroup = line.slice(8).trim();
      continue;
    }
    if (line.startsWith('#EXTVLCOPT:')) {
      const opt = line.slice(11);
      const [k, ...rest] = opt.split('=');
      const v = rest.join('=').trim();
      headers = headers ?? {};
      if (/http-user-agent/i.test(k)) headers.userAgent = v;
      if (/http-referr?er/i.test(k)) headers.referrer = v;
      continue;
    }
    if (line.startsWith('#')) continue;

    // Linha de URL (endereços relativos valem quando a lista veio de um link)
    let entry = line;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(entry)) {
      if (!baseUrl || !/^[\w./%-]/.test(entry)) {
        pending = null;
        continue;
      }
      try {
        entry = new URL(entry, baseUrl).href;
      } catch {
        pending = null;
        continue;
      }
    }
    // Algumas listas usam "url|User-Agent=...&Referer=..."
    let url = entry;
    const pipe = entry.indexOf('|');
    if (pipe > 0) {
      url = entry.slice(0, pipe);
      const params = new URLSearchParams(entry.slice(pipe + 1));
      headers = headers ?? {};
      const ua = params.get('User-Agent') || params.get('user-agent');
      const ref = params.get('Referer') || params.get('referer');
      if (ua) headers.userAgent = ua;
      if (ref) headers.referrer = ref;
    }

    const attrs = pending?.attrs ?? {};
    const name = (pending?.title || attrs['tvg-name'] || url.split('/').pop() || 'Sem nome').trim();
    const group = (attrs['group-title'] || extGroup || 'Sem categoria').trim();
    const kind = classify(url, group);
    const chno = parseInt(attrs['tvg-chno'] || attrs['channel-number'] || '', 10);
    if (kind === 'live') liveCount++;

    // Canal repetido (mesmo nome e grupo) vira "fonte 2" do primeiro.
    const dupKey = kind + '|' + group + '|' + name.toLowerCase();
    const prev = seen.get(dupKey);
    if (prev !== undefined && kind === 'live') {
      const first = items[prev];
      (first.altUrls ??= []).push(url);
    } else {
      seen.set(dupKey, items.length);
      items.push({
        id: hash(kind + url),
        kind,
        name,
        number: Number.isFinite(chno) ? chno : kind === 'live' ? liveCount : undefined,
        group,
        logo: attrs['tvg-logo'] || attrs['logo'] || undefined,
        epgId: attrs['tvg-id'] || undefined,
        url,
        headers,
        catchupDays: attrs['catchup-days'] ? parseInt(attrs['catchup-days'], 10) : attrs['tvg-rec'] ? parseInt(attrs['tvg-rec'], 10) : undefined,
        catchupSource: attrs['catchup-source'] || undefined,
        catchupType: attrs['catchup'] || undefined,
      });
    }
    pending = null;
    extGroup = undefined;
    headers = undefined;
  }

  return { epgUrl, items };
}

/**
 * Se o link M3U for do tipo Xtream (get.php?username=..&password=..),
 * devolve os dados de acesso para usar a API, que é bem mais completa.
 */
export function detectXtreamFromUrl(url: string): { server: string; username: string; password: string } | null {
  try {
    const u = new URL(url);
    const username = u.searchParams.get('username');
    const password = u.searchParams.get('password');
    if (username && password && /\/(get|player_api)\.php$/i.test(u.pathname)) {
      return { server: u.origin, username, password };
    }
  } catch {
    /* URL inválida */
  }
  return null;
}
