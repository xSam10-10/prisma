import { useEffect, useState } from 'react';
import { lookup, tmdbKey, type TmdbInfo } from '../core/tmdb';
import type { Channel } from '../core/types';

/** Dados do TMDB do título (null enquanto busca ou sem chave). */
export function useTmdb(item: Channel | null | undefined): TmdbInfo | null {
  const [info, setInfo] = useState<TmdbInfo | null>(null);
  useEffect(() => {
    setInfo(null);
    if (!item || item.kind === 'live' || !tmdbKey()) return;
    let alive = true;
    // pequena espera: ao rolar rápido a grade, não busca o que só passou pela tela
    const t = setTimeout(() => lookup(item).then((r) => alive && setInfo(r)), 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return info;
}
