import { detectXtreamFromUrl, parseM3U } from './m3u';
import { fetchText } from './net';
import { idbDel, idbGet, idbSet } from './storage';
import { SourceError, type Category, type Channel, type ItemKind, type Playlist, type SourceConfig } from './types';
import * as xtream from './xtream';

const PLAYLIST_KEY = 'playlist';

export type Progress = (msg: string) => void;

/** Carrega a lista de qualquer origem e devolve no modelo único. */
export async function loadSource(src: SourceConfig, onProgress: Progress = () => {}): Promise<Playlist> {
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
        return await loadSource({ type: 'xtream', name: src.name, ...x }, onProgress);
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
  return idbGet<Playlist>(PLAYLIST_KEY);
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
