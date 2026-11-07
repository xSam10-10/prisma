import { useEffect, useState } from 'react';
import { nowNext } from '../core/epg';
import type { Channel, EpgEntry, Playlist } from '../core/types';

/** "Agora e a seguir" do canal, com pequena espera para não pedir a cada seta. */
export function useEpg(pl: Playlist | undefined, ch: Channel | undefined, delay = 350): EpgEntry[] | null {
  const [list, setList] = useState<EpgEntry[] | null>(null);
  useEffect(() => {
    setList(null);
    if (!ch) return;
    let alive = true;
    const t = setTimeout(() => {
      nowNext(pl, ch).then((l) => alive && setList(l));
    }, delay);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [pl, ch, delay]);
  return list;
}

/** Relógio que atualiza a cada 30 s (barras de progresso do guia). */
export function useClock(ms = 30000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
