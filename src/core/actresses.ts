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
  /** Foto em pé (vira a capa dos filmes dela sem capa, 0.34.1). */
  portrait?: string;
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
  segs.forEach((raw, i) => {
    // "Estúdio - Atriz - Título": o primeiro pedaço costuma ser o estúdio.
    if (segs.length >= 3 && i === 0) return;
    // Título todo em MAIÚSCULAS ou minúsculas: passa para "Nome Sobrenome" (0.34.2).
    const seg = /[a-zß-ÿ]/.test(raw) && /[A-ZÀ-Þ]/.test(raw) ? raw : raw.toLowerCase().replace(/(^|[\s'.-])([a-zß-ÿ])/g, (_m, a: string, b: string) => a + b.toUpperCase());
    for (const p of seg.split(/\s*[,&+]\s*|\s+(?:feat\.?|ft\.?|and|e|with|x)\s+/i)) {
      const n = p.trim().replace(/\s+/g, ' ');
      if (NAME.test(n) && !n.split(' ').some((w) => STOP.has(w.toLowerCase())) && out.indexOf(n) < 0) out.push(n);
    }
  });
  return out;
}

/**
 * Nome colado no resto do título ("Kissa Sins Gets Lucky"): as duas primeiras palavras de cada
 * pedaço, quando têm cara de nome (0.34.2). Só vale depois de a ThePornDB confirmar.
 */
export function leadNames(title: string): string[] {
  const out: string[] = [];
  for (const seg of title.replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').split(/\s+[-–|:]\s+/)) {
    const w = seg.trim().split(/\s+/);
    if (w.length < 3) continue;
    const two = namesInTitle(w.slice(0, 2).join(' '));
    if (two.length === 1 && two[0].split(' ').length === 2 && out.indexOf(two[0]) < 0) out.push(two[0]);
  }
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
  const add = (name: string, id: string, photo?: string, portrait?: string) => {
    const key = actressKey(name);
    if (!key) return;
    let a = map.get(key);
    if (!a) map.set(key, (a = { key, name, photo, portrait, ids: new Set() }));
    if (!a.photo && photo) a.photo = photo;
    if (!a.portrait && portrait) a.portrait = portrait;
    a.ids.add(id);
  };
  const parsed = new Map<string, { name: string; ids: string[] }>();
  const studios = studiosOf(items);
  for (const it of items) {
    for (const p of perfOf.get(it.id) ?? []) add(p.name, it.id, p.photo, p.portrait);
    const full = it.fullName ?? it.name;
    const lead = withKey ? leadNames(full) : [];
    for (const n of namesInTitle(full).concat(lead.filter((x) => verified.get(actressKey(x))))) {
      const k = actressKey(n);
      if (studios.has(k)) continue;
      const e = parsed.get(k) ?? { name: n, ids: [] };
      if (e.ids.indexOf(it.id) >= 0) continue;
      e.ids.push(it.id);
      parsed.set(k, e);
    }
  }
  parsed.forEach((e, k) => {
    const v = verified.get(k);
    const ok = map.has(k) || (withKey ? !!v : e.ids.length >= 2);
    if (!ok) return;
    e.ids.forEach((id) => add(v?.name ?? e.name, id, v?.photo, v?.portrait));
  });
  // Quem a ThePornDB achou numa cena também vale para os outros títulos com o nome dela.
  const titles = items.map((it) => ({ id: it.id, t: ' ' + actressKey(it.fullName ?? it.name) + ' ' }));
  map.forEach((a) => {
    const needle = ' ' + a.key + ' ';
    for (const x of titles) if (x.t.indexOf(needle) >= 0) a.ids.add(x.id);
  });
  return [...map.values()].sort((a, b) => b.ids.size - a.ids.size || a.name.localeCompare(b.name));
}

/**
 * Atrizes de cada título, na ordem em que o nome aparece no título (0.34.1). Serve de capa
 * para os filmes sem capa: o filtro acha a atriz em qualquer lugar do nome ("Kissa Sins Gets…"),
 * mesmo quando a busca da capa não achou.
 */
export function castByItem(items: Channel[], list: Actress[]): Map<string, Actress[]> {
  const byId = new Map<string, Actress[]>();
  for (const a of list) a.ids.forEach((id) => (byId.get(id) ?? byId.set(id, []).get(id)!).push(a));
  const title = new Map(items.map((it) => [it.id, ' ' + actressKey(it.fullName ?? it.name) + ' '] as [string, string]));
  byId.forEach((l, id) => {
    const t = title.get(id) ?? '';
    const at = (a: Actress) => {
      const i = t.indexOf(' ' + a.key + ' ');
      return i < 0 ? 1e6 : i;
    };
    l.sort((a, b) => at(a) - at(b));
  });
  return byId;
}

/** Nomes do título que ainda precisam ser conferidos na ThePornDB (os mais frequentes primeiro). */
export function namesToVerify(items: Channel[], perfOf: Map<string, Performer[]>, verified: Map<string, Performer | null>, max = 40): string[] {
  const known = new Set<string>();
  perfOf.forEach((l) => l.forEach((p) => known.add(actressKey(p.name))));
  const count = new Map<string, { name: string; n: number }>();
  const studios = studiosOf(items);
  const lead = new Map<string, { name: string; n: number }>();
  const bump = (m: Map<string, { name: string; n: number }>, n: string) => {
    const k = actressKey(n);
    if (known.has(k) || verified.has(k) || studios.has(k)) return;
    const e = m.get(k) ?? { name: n, n: 0 };
    e.n++;
    m.set(k, e);
  };
  for (const it of items) {
    const full = it.fullName ?? it.name;
    namesInTitle(full).forEach((n) => bump(count, n));
    leadNames(full).forEach((n) => bump(lead, n));
  }
  // Nome colado no título só vale a busca quando se repete (atriz aparece em vários filmes).
  lead.forEach((e, k) => {
    if (e.n >= 2 && !count.has(k)) count.set(k, e);
  });
  return [...count.values()].sort((a, b) => b.n - a.n).slice(0, max).map((e) => e.name);
}
