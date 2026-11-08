import { gunzipSync, strFromU8 } from 'fflate';
import { logoKey } from './logos';
import { fetchBytes } from './net';
import { LITE } from './platform';
import { idbGet, idbSet, prefGet, prefSet } from './storage';
import type { Channel, EpgEntry, Playlist } from './types';
import { normalizeServer } from './xtream';

// Guia completo (XMLTV): de listas M3U (url-tvg) e do Xtream (xmltv.php).
// Guarda só os canais da lista e a janela [3 dias atrás, 7 dias à frente]
// (na TV de 2017: 1 dia atrás e 2 à frente, para caber na memória).

const KEY = 'xmltv';
const REFRESH = 12 * 3600 * 1000;
const PAST = (LITE ? 1 : 3) * 86400000;
const AHEAD = (LITE ? 2 : 7) * 86400000;

interface Stored {
  url: string;
  at: number;
  /** id do canal no guia → programas */
  guide: Record<string, EpgEntry[]>;
  /** nome do canal no guia (normalizado) → id */
  names: Record<string, string>;
}

let mem: Stored | null = null;
let loading: Promise<Stored | null> | null = null;

export function xmltvUrl(pl: Playlist): string | undefined {
  if (pl.epgUrl) return pl.epgUrl;
  if (pl.source.type === 'xtream') {
    const s = pl.source;
    return `${normalizeServer(s.server)}/xmltv.php?username=${encodeURIComponent(s.username)}&password=${encodeURIComponent(s.password)}`;
  }
  return undefined;
}

/** "20261108143000 -0300" → ms */
export function parseXmltvDate(v: string): number {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/);
  if (!m) return NaN;
  const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  if (!m[7]) return utc;
  const sign = m[7][0] === '-' ? -1 : 1;
  const off = sign * (parseInt(m[7].slice(1, 3), 10) * 60 + parseInt(m[7].slice(3, 5), 10));
  return utc - off * 60000;
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function unescape(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (_, e: string) =>
      e[0] === '#' ? String.fromCharCode(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e] ?? '&' + e + ';',
    )
    .trim();
}
function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(name + '="([^"]*)"'));
  return m ? unescape(m[1]) : '';
}
function inner(block: string, name: string): string {
  const m = block.match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)</' + name + '>'));
  return m ? unescape(m[1]) : '';
}

/**
 * Lê o XMLTV sem montar a árvore inteira (arquivos de dezenas de MB):
 * percorre <channel> e <programme> com indexOf.
 */
export function parseXmltv(xml: string, wanted: (id: string, names: string[]) => boolean, now = Date.now()): Omit<Stored, 'url' | 'at'> {
  const guide: Record<string, EpgEntry[]> = {};
  const names: Record<string, string> = {};
  const keep = new Set<string>();
  let i = 0;
  // Canais
  for (;;) {
    const a = xml.indexOf('<channel ', i);
    if (a < 0) break;
    const b = xml.indexOf('</channel>', a);
    if (b < 0) break;
    const block = xml.slice(a, b);
    const id = attr(block.slice(0, block.indexOf('>') + 1), 'id');
    const dn: string[] = [];
    const re = /<display-name[^>]*>([\s\S]*?)<\/display-name>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(block))) dn.push(unescape(m[1]));
    if (id && wanted(id, dn)) {
      keep.add(id);
      for (const n of dn) names[logoKey(n)] = id;
    }
    i = b + 10;
  }
  const from = now - PAST;
  const to = now + AHEAD;
  // Programas
  i = 0;
  for (;;) {
    const a = xml.indexOf('<programme', i);
    if (a < 0) break;
    const b = xml.indexOf('</programme>', a);
    if (b < 0) break;
    const head = xml.slice(a, xml.indexOf('>', a) + 1);
    const ch = attr(head, 'channel');
    if (keep.size === 0 || keep.has(ch)) {
      const start = parseXmltvDate(attr(head, 'start'));
      const end = parseXmltvDate(attr(head, 'stop'));
      if (end > from && start < to) {
        const block = xml.slice(a, b);
        const title = inner(block, 'title');
        if (title) (guide[ch] ??= []).push({ title, description: inner(block, 'desc') || undefined, start, end });
      }
    }
    i = b + 12;
  }
  for (const k of Object.keys(guide)) guide[k].sort((x, y) => x.start - y.start);
  return { guide, names };
}

// ---- Guias extras (Ajustes › Lista): completam canais sem programação ----

/** Endereços de guias XMLTV extras (valem para todos os perfis). */
export function extraGuides(): string[] {
  return prefGet<string[]>('epgExtra', []);
}
export function setExtraGuides(list: string[]): void {
  prefSet('epgExtra', [...new Set(list.map((u) => u.trim()).filter(Boolean))]);
}
/** Guias públicos sugeridos (Brasil). Podem sair do ar; teste em Ajustes. */
export const PUBLIC_GUIDES: { name: string; url: string }[] = [
  { name: 'Brasil 1 (epgshare01)', url: 'https://epgshare01.online/epgshare01/epg_ripper_BR1.xml.gz' },
  { name: 'Brasil 2 (epgshare01)', url: 'https://epgshare01.online/epgshare01/epg_ripper_BR2.xml.gz' },
  { name: 'Pluto TV Brasil (i.mjh.nz)', url: 'https://i.mjh.nz/PlutoTV/br.xml.gz' },
];

async function fetchGuide(url: string, pl: Playlist): Promise<Omit<Stored, 'url' | 'at'>> {
  const bytes = await fetchBytes(url);
  const raw = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes;
  const xml = strFromU8(raw);
  const ids = new Set(pl.items.filter((c) => c.kind === 'live' && c.epgId).map((c) => c.epgId!));
  const nameKeys = new Set(pl.items.filter((c) => c.kind === 'live').map((c) => logoKey(c.fullName ?? c.name)));
  return parseXmltv(xml, (id, dn) => ids.has(id) || dn.some((n) => nameKeys.has(logoKey(n))));
}

/** Resultado da última leitura de cada guia extra (para Ajustes). */
export const extraStatus: Record<string, string> = {};

/** Baixa (ou usa o guardado) e devolve o guia. */
export function loadXmltv(pl: Playlist, force = false): Promise<Stored | null> {
  const main = xmltvUrl(pl);
  const extras = extraGuides();
  if (!main && !extras.length) return Promise.resolve(null);
  const url = [main ?? '', ...extras].join('|');
  if (!force && mem && mem.url === url && Date.now() - mem.at < REFRESH) return Promise.resolve(mem);
  if (loading) return loading;
  loading = (async () => {
    try {
      if (!force) {
        const saved = await idbGet<Stored>(KEY);
        if (saved && saved.url === url && Date.now() - saved.at < REFRESH) return (mem = saved);
      }
      let parsed: Omit<Stored, 'url' | 'at'> = { guide: {}, names: {} };
      if (main) {
        try {
          parsed = await fetchGuide(main, pl);
        } catch {
          /* guia da lista fora do ar: seguem os extras */
        }
      }
      // Extras: só completam (o guia da lista tem prioridade).
      for (const x of extras) {
        try {
          const g = await fetchGuide(x, pl);
          let added = 0;
          for (const [id, progs] of Object.entries(g.guide)) {
            if (parsed.guide[id]) continue;
            parsed.guide[id] = progs;
            added++;
          }
          for (const [n, id] of Object.entries(g.names)) if (!parsed.names[n] && parsed.guide[id]) parsed.names[n] = id;
          extraStatus[x] = `${Object.keys(g.guide).length} canais da sua lista no guia · ${added} novos`;
        } catch (e) {
          extraStatus[x] = 'não respondeu' + ((e as Error)?.message ? ` (${(e as Error).message})` : '');
        }
      }
      if (!Object.keys(parsed.guide).length && !main) throw new Error('vazio');
      const st: Stored = { url, at: Date.now(), ...parsed };
      mem = st;
      await idbSet(KEY, st);
      return st;
    } catch {
      return mem;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** Programas de um canal no guia completo (por tvg-id ou pelo nome). */
export function programmesOf(ch: Channel): EpgEntry[] {
  if (!mem) return [];
  const id = (ch.epgId && mem.guide[ch.epgId] ? ch.epgId : undefined) ?? mem.names[logoKey(ch.fullName ?? ch.name)];
  return id ? mem.guide[id] ?? [] : [];
}

/** Cobertura do guia baixado: quantos canais têm programação e de que dia a que dia. */
export function xmltvCoverage(): { channels: number; from: number; to: number; at: number; limited: boolean } | null {
  if (!mem) return null;
  let from = Infinity;
  let to = 0;
  const ids = Object.keys(mem.guide);
  for (const k of ids) {
    const g = mem.guide[k];
    if (!g.length) continue;
    if (g[0].start < from) from = g[0].start;
    if (g[g.length - 1].end > to) to = g[g.length - 1].end;
  }
  if (!ids.length) return { channels: 0, from: 0, to: 0, at: mem.at, limited: LITE };
  return { channels: ids.length, from, to, at: mem.at, limited: LITE };
}

export function hasXmltv(): boolean {
  return !!mem && Object.keys(mem.guide).length > 0;
}

export function clearXmltv(): void {
  mem = null;
  idbSet(KEY, null);
}
