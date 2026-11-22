// TV LG (1.0.2): adianta, em fatias curtas e depois da abertura, os cálculos que
// a 1ª visita a Filmes/Séries/Início fazia de uma vez (~6 s travado na B7):
// a chave de "versões do mesmo título" de cada item e o índice de títulos dos Tops.
import { versionKey } from './vod';
import { warmTopsIndex } from './tops';
import type { Channel } from './types';

let warmed: Channel[] | null = null;

export function warmUp(items: Channel[], delay = 8000): void {
  if (warmed === items) return;
  warmed = items;
  setTimeout(() => {
    let i = 0;
    const step = () => {
      if (warmed !== items) return;
      const end = Math.min(items.length, i + 400);
      for (; i < end; i++) if (items[i].kind !== 'live') versionKey(items[i]);
      if (i < items.length) setTimeout(step, 40);
      else void warmTopsIndex(items);
    };
    step();
  }, delay);
}
