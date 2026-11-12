import { useEffect, useState } from 'react';
import { cachedInfo, lookup, tmdbKey, type TmdbInfo } from '../core/tmdb';
import { tpdbKey } from '../core/tpdb';
import type { Channel } from '../core/types';

/** Dados do TMDB do título (null enquanto busca ou sem chave). */
export function useTmdb(item: Channel | null | undefined, logoBroken = false): TmdbInfo | null {
  // Já guardada (0.35.3): a capa aparece na hora, sem a espera nem a capa genérica piscando.
  const [info, setInfo] = useState<TmdbInfo | null>(() => (item ? cachedInfo(item, logoBroken) ?? null : null));
  useEffect(() => {
    if (!item || item.kind === 'live' || (!tmdbKey() && !tpdbKey())) {
      setInfo(null);
      return;
    }
    const known = cachedInfo(item, logoBroken);
    if (known !== undefined) {
      setInfo(known);
      return;
    }
    setInfo(null);
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
