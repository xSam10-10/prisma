import type { Channel, EpgEntry, Playlist } from './types';
import { shortEpg } from './xtream';

// Guia de programação. Fase 1 · passo 2: "agora / a seguir" pela API Xtream.
// O guia completo em XMLTV (listas M3U com url-tvg) entra no passo 3.

const cache = new Map<string, { at: number; list: EpgEntry[] }>();
const TTL = 5 * 60 * 1000;

export async function nowNext(pl: Playlist | undefined, ch: Channel): Promise<EpgEntry[]> {
  if (!pl || ch.kind !== 'live' || pl.source.type !== 'xtream') return [];
  const key = ch.id;
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < TTL) return hit.list.filter((e) => e.end > now);
  try {
    const list = await shortEpg(pl.source, ch.id, 4);
    cache.set(key, { at: now, list });
    return list.filter((e) => e.end > now);
  } catch {
    return [];
  }
}

export function progressOf(e: EpgEntry, now = Date.now()): number {
  return Math.max(0, Math.min(1, (now - e.start) / Math.max(1, e.end - e.start)));
}
