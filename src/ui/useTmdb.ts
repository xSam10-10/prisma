import { useEffect, useState } from 'react';
import { lookup, tmdbKey, type TmdbInfo } from '../core/tmdb';
import { tpdbKey } from '../core/tpdb';
import type { Channel } from '../core/types';

/** Dados do TMDB do título (null enquanto busca ou sem chave). */
export function useTmdb(item: Channel | null | undefined, logoBroken = false): TmdbInfo | null {
  const [info, setInfo] = useState<TmdbInfo | null>(null);
  useEffect(() => {
    setInfo(null);
    if (!item || item.kind === 'live' || (!tmdbKey() && !tpdbKey())) return;
    let alive = true;
    // pequena espera: ao rolar rápido a grade, não busca o que só passou pela tela
    const t = setTimeout(() => lookup(item, logoBroken).then((r) => alive && setInfo(r)), 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [item?.id, logoBroken]); // eslint-disable-line react-hooks/exhaustive-deps
  return info;
}
