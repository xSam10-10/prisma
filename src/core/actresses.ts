import type { Channel } from './types';
import type { Performer } from './tpdb';

// Filtro de atrizes da categoria de adultos (0.32.0). As atrizes vêm de dois lugares:
// 1) a ThePornDB (com o token), que diz quem está em cada cena e traz a foto;
// 2) o próprio nome na lista ("Estúdio - Atriz & Atriz - Título").
// Com o token, nome tirado do título só entra se a ThePornDB confirmar que é uma atriz.

export interface Actress {
  key: string;
  name: string;
  photo?: string;
  /** Títulos da categoria em que ela aparece. */
  ids: Set<string>;
}

export const actressKey = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Palavras que aparecem em títulos e nunca são nome de pessoa.
const STOP = new Set(
  'the and with in on of a an to my her his your our for from at by is are hot night day big little new full scene scenes part vol volume movie movies xxx hd uhd fhd sd 4k dublado legendado dual nacional video videos episode ep best of collection compilation threesome anal teen milf lesbian amateur hardcore sexy girls girl boys boy love sex porn adult adultos filme filmes cena cenas'.split(' '),
);
const NAME = /^[A-ZÀ-Þ][a-zß-ÿ'.]+(?: [A-ZÀ-Þ][a-zß-ÿ'.]+){1,2}$/;

/** Nomes com cara de pessoa num título da lista (2 ou 3 palavras com inicial maiúscula). */
export function namesInTitle(title: string): string[] {
  const segs = title
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .split(/\s+[-–|]\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const out: string[] = [];
  segs.forEach((seg, i) => {
    // "Estúdio - Atriz - Título": o primeiro pedaço costuma ser o estúdio.
    if (segs.length >= 3 && i === 0) return;
    for (const p of seg.split(/\s*[,&+]\s*|\s+(?:feat\.?|ft\.?|and|e|with|x)\s+/i)) {
      const n = p.trim().replace(/\s+/g, ' ');
      if (NAME.test(n) && !n.split(' ').some((w) => STOP.has(w.toLowerCase())) && out.indexOf(n) < 0) out.push(n);
    }
  });
  return out;
}

/** Estúdios: o primeiro pedaço dos títulos "Estúdio - Atriz - Título" (nunca contam como atriz). */
export function studiosOf(items: Channel[]): Set<string> {
  const out = new Set<string>();
  for (const it of items) {
    const segs = (it.fullName ?? it.name).split(/\s+[-–|]\s+/);
    if (segs.length >= 3) out.add(actressKey(segs[0]));
  }
  return out;
}

/**
 * Monta a lista de atrizes.
 * - perfOf: atrizes que a ThePornDB achou para cada título;
 * - verified: nomes do título já conferidos na ThePornDB (null = não é atriz);
 * - withKey: há token da ThePornDB (aí nome do título precisa ser confirmado).
 */
export function buildActresses(items: Channel[], perfOf: Map<string, Performer[]>, verified: Map<string, Performer | null>, withKey: boolean): Actress[] {
  const map = new Map<string, Actress>();
  const add = (name: string, id: string, photo?: string) => {
    const key = actressKey(name);
    if (!key) return;
    let a = map.get(key);
    if (!a) map.set(key, (a = { key, name, photo, ids: new Set() }));
    if (!a.photo && photo) a.photo = photo;
    a.ids.add(id);
  };
  const parsed = new Map<string, { name: string; ids: string[] }>();
  const studios = studiosOf(items);
  for (const it of items) {
    for (const p of perfOf.get(it.id) ?? []) add(p.name, it.id, p.photo);
    for (const n of namesInTitle(it.fullName ?? it.name)) {
      const k = actressKey(n);
      if (studios.has(k)) continue;
      const e = parsed.get(k) ?? { name: n, ids: [] };
      e.ids.push(it.id);
      parsed.set(k, e);
    }
  }
  parsed.forEach((e, k) => {
    const v = verified.get(k);
    const ok = map.has(k) || (withKey ? !!v : e.ids.length >= 2);
    if (!ok) return;
    e.ids.forEach((id) => add(v?.name ?? e.name, id, v?.photo));
  });
  // Quem a ThePornDB achou numa cena também vale para os outros títulos com o nome dela.
  const titles = items.map((it) => ({ id: it.id, t: ' ' + actressKey(it.fullName ?? it.name) + ' ' }));
  map.forEach((a) => {
    const needle = ' ' + a.key + ' ';
    for (const x of titles) if (x.t.indexOf(needle) >= 0) a.ids.add(x.id);
  });
  return [...map.values()].sort((a, b) => b.ids.size - a.ids.size || a.name.localeCompare(b.name));
}

/** Nomes do título que ainda precisam ser conferidos na ThePornDB (os mais frequentes primeiro). */
export function namesToVerify(items: Channel[], perfOf: Map<string, Performer[]>, verified: Map<string, Performer | null>, max = 40): string[] {
  const known = new Set<string>();
  perfOf.forEach((l) => l.forEach((p) => known.add(actressKey(p.name))));
  const count = new Map<string, { name: string; n: number }>();
  const studios = studiosOf(items);
  for (const it of items)
    for (const n of namesInTitle(it.fullName ?? it.name)) {
      const k = actressKey(n);
      if (known.has(k) || verified.has(k) || studios.has(k)) continue;
      const e = count.get(k) ?? { name: n, n: 0 };
      e.n++;
      count.set(k, e);
    }
  return [...count.values()].sort((a, b) => b.n - a.n).slice(0, max).map((e) => e.name);
}
