import { detectXtreamFromUrl, parseM3U } from './m3u';
import { cleanLabel } from './logos';
import { parseEpisodeName, sameChannelKey, simplifyGroups, simplifyName } from './names';
import { fetchText } from './net';
import { idbDel, idbGet, idbSet } from './storage';
import { SourceError, type Category, type Channel, type ItemKind, type Playlist, type SourceConfig } from './types';
import * as xtream from './xtream';

const PLAYLIST_KEY = 'playlist';

export type Progress = (msg: string) => void;

/**
 * Arruma a lista para exibir:
 *  · tira emojis e símbolos decorativos (ex.: "♦ CANAIS | FHD ⭐");
 *  · categoria sem termos de codificação ("CANAIS | FHD H265" → "CANAIS | FHD"), se não repetir nome;
 *  · nome curto do canal, até a qualidade ("GLOBO RJ HD [ALT]" → "GLOBO RJ HD");
 *  · canais ao vivo que ficam com o mesmo nome na mesma categoria viram um só,
 *    e as outras versões passam a ser "fonte 2, 3…" (o player troca sozinho se uma cair).
 */
export function tidyPlaylist(p: Playlist): Playlist {
  const seen = new Map<string, Channel>();
  const out: Channel[] = [];
  for (const it of p.items) it.group = cleanLabel(it.group);
  const groupName = simplifyGroups(p.items.map((i) => i.group));
  for (const it of p.items) {
    it.group = groupName.get(it.group) ?? it.group;
    const full = cleanLabel(it.fullName ?? it.name);
    it.fullName = full;
    it.name = simplifyName(full);
    if (it.kind === 'live') {
      // Junta só fontes do mesmo canal ([ALT], BACKUP, H265…); canais numerados ou de nome parecido ficam separados.
      const key = it.group + '|' + sameChannelKey(full);
      const first = seen.get(key);
      if (first) {
        const extra = [it.url, ...(it.altUrls ?? [])].filter((u) => u && u !== first.url && !(first.altUrls ?? []).includes(u));
        first.altUrls = [...(first.altUrls ?? []), ...extra];
        if (!first.logo && it.logo) first.logo = it.logo;
        continue;
      }
      seen.set(key, it);
    }
    out.push(it);
  }
  p.items = groupM3uSeries(out);
  return p;
}

/** Listas M3U mandam cada episódio solto: junta em séries com temporadas. */
function groupM3uSeries(items: Channel[]): Channel[] {
  const shows = new Map<string, Channel>();
  const out: Channel[] = [];
  for (const it of items) {
    const ep = it.kind === 'series' && it.url ? parseEpisodeName(it.fullName ?? it.name) : null;
    if (!ep) {
      out.push(it);
      continue;
    }
    const key = it.group + '|' + ep.show.toLowerCase();
    let show = shows.get(key);
    if (!show) {
      show = { id: 'ms' + key.length.toString(36) + '_' + hashKey(key), kind: 'series', name: ep.show, fullName: ep.show, group: it.group, logo: it.logo, url: '', episodes: [] };
      shows.set(key, show);
      out.push(show);
    }
    show.episodes!.push({ id: it.id, season: ep.season, number: ep.number, title: ep.title || `Episódio ${ep.number}`, url: it.url, cover: it.logo });
  }
  for (const s of shows.values()) s.episodes!.sort((a, b) => a.season - b.season || a.number - b.number);
  return out;
}

function hashKey(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Carrega a lista de qualquer origem e devolve no modelo único. */
export async function loadSource(src: SourceConfig, onProgress: Progress = () => {}): Promise<Playlist> {
  return tidyPlaylist(await loadSourceRaw(src, onProgress));
}

async function loadSourceRaw(src: SourceConfig, onProgress: Progress = () => {}): Promise<Playlist> {
  if (src.type === 'xtream') {
    onProgress('Entrando na conta…');
    const account = await xtream.login(src);
    onProgress('Baixando canais, filmes e séries…');
    const items = await xtream.loadAll(src);
    if (!items.length) throw new SourceError('empty', 'A lista está vazia.');
    return { source: src, loadedAt: Date.now(), items, account };
  }

  let text: string;
  if (src.type === 'm3u') {
    // Link get.php do Xtream: usa a API, que traz guia e categorias melhores.
    const x = detectXtreamFromUrl(src.url);
    if (x) {
      try {
        return await loadSourceRaw({ type: 'xtream', name: src.name, ...x }, onProgress);
      } catch (e) {
        if (e instanceof SourceError && (e.code === 'auth' || e.code === 'expired')) throw e;
        // Se a API falhar por outro motivo, cai para a leitura M3U normal.
      }
    }
    onProgress('Baixando a lista…');
    text = await fetchText(src.url, 120000);
  } else {
    text = src.content;
  }

  onProgress('Lendo os canais…');
  if (!/#EXTINF/i.test(text)) {
    if (/<html|<!doctype/i.test(text)) throw new SourceError('auth', 'O link não devolveu uma lista. Confira o endereço ou se a lista está ativa.');
    throw new SourceError('format', 'O arquivo não parece ser uma lista M3U.');
  }
  const parsed = parseM3U(text, src.type === 'm3u' ? src.url : undefined);
  if (!parsed.items.length) throw new SourceError('empty', 'A lista está vazia.');
  return { source: src, loadedAt: Date.now(), items: parsed.items, epgUrl: parsed.epgUrl };
}

export async function savePlaylist(p: Playlist): Promise<void> {
  await idbSet(PLAYLIST_KEY, p);
}

export async function loadSavedPlaylist(): Promise<Playlist | undefined> {
  const p = await idbGet<Playlist>(PLAYLIST_KEY);
  return p ? tidyPlaylist(p) : p;
}

export async function clearPlaylist(): Promise<void> {
  await idbDel(PLAYLIST_KEY);
}

/** Categorias na ordem em que aparecem na lista. */
export function categoriesOf(items: Channel[], kind: ItemKind): Category[] {
  const map = new Map<string, Category>();
  for (const it of items) {
    if (it.kind !== kind) continue;
    const c = map.get(it.group);
    if (c) c.count++;
    else map.set(it.group, { id: it.group, name: it.group, kind, count: 1 });
  }
  return [...map.values()];
}
