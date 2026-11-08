import { useEffect, useState } from 'react';
import { fallbackLists, loadTops, onTops, topsNow, type TopsData } from '../core/tops';
import type { Playlist } from '../core/types';

/** Dados dos tops (baixados do GitHub; sem eles, o Top da semana do TMDB do aparelho). */
export function useTops(playlist: Playlist): TopsData | null {
  const [data, setData] = useState<TopsData | null>(topsNow());
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
    });
    return () => {
      alive = false;
      off();
    };
  }, [playlist]);
  return data;
}
