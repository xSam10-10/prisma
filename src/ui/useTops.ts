import { useEffect, useState } from 'react';
import { fallbackLists, loadTops, onTops, topsNow, type TopsData } from '../core/tops';
import type { Playlist } from '../core/types';

/** Dados dos tops (baixados do GitHub; sem eles, o Top da semana do TMDB do aparelho) e se já terminou de tentar. */
export function useTopsState(playlist: Playlist): { data: TopsData | null; ready: boolean } {
  const [data, setData] = useState<TopsData | null>(topsNow());
  const [ready, setReady] = useState(!!topsNow());
  useEffect(() => {
    let alive = true;
    const off = onTops(() => alive && setData(topsNow()));
    loadTops().then(async (d) => {
      if (!alive) return;
      if (d) setData(d);
      else {
        const f = await fallbackLists(playlist.items).catch(() => null);
        if (alive && f) setData(f);
      }
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
      off();
    };
  }, [playlist]);
  return { data, ready };
}

export function useTops(playlist: Playlist): TopsData | null {
  return useTopsState(playlist).data;
}
