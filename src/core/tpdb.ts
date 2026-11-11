import { IS_ANDROID } from './platform';
import { prefGet } from './storage';
import type { TmdbInfo } from './tmdb';

// ThePornDB (0.31.0): capas oficiais de cenas e filmes adultos que o TMDB não
// tem. Só é usada para títulos das categorias de adulto cuja capa na lista é
// a genérica, e só com a chave gratuita do usuário (Ajustes › Serviços).
// O modo "parse" entende nomes no formato de arquivo ("Estúdio - Atriz - Título").

const API = () => prefGet<string>('tpdbBase', 'https://api.theporndb.net');

export function tpdbKey(): string {
  return (prefGet<string>('tpdbKey', '') || '').trim();
}

type Img = { large?: string; medium?: string; small?: string; full?: string } | string | null | undefined;
interface Item {
  id?: string | number;
  _id?: string | number;
  title?: string;
  description?: string;
  date?: string;
  image?: string;
  poster?: string;
  posters?: Img;
  background?: Img;
  site?: { name?: string };
  performers?: Perf[];
}
type Gender = { gender?: string };
interface Perf {
  name?: string;
  image?: string;
  face?: string;
  thumbnail?: string;
  extra?: Gender;
  extras?: Gender;
  parent?: { name?: string; image?: string; face?: string; thumbnail?: string; extras?: Gender; extra?: Gender };
}

/** Atriz do resultado (0.32.0): nome e foto do rosto. Homens ficam de fora. */
export interface Performer {
  name: string;
  photo?: string;
}
function toPerformer(p: Perf): Performer | null {
  const name = (p.name || p.parent?.name || '').trim();
  if (!name) return null;
  const g = (p.extra?.gender || p.extras?.gender || p.parent?.extras?.gender || p.parent?.extra?.gender || '').toLowerCase();
  if (g && !/female|woman|trans/.test(g)) return null;
  const photo = p.face || p.parent?.face || p.image || p.parent?.image || p.thumbnail || p.parent?.thumbnail || undefined;
  return { name, photo };
}
export function performersOfItem(it: { performers?: Perf[] }): Performer[] {
  const out: Performer[] = [];
  for (const p of it.performers ?? []) {
    const x = toPerformer(p);
    if (x && !out.some((o) => o.name === x.name)) out.push(x);
  }
  return out;
}

function pick(i: Img): string | undefined {
  if (!i) return undefined;
  if (typeof i === 'string') return i || undefined;
  return i.large || i.full || i.medium || i.small || undefined;
}

/** GET com a chave (XMLHttpRequest na TV/Windows; rede nativa no Android). */
async function get(path: string, key: string): Promise<{ data?: Item[] } | null> {
  const url = API() + path;
  if (IS_ANDROID) {
    const { CapacitorHttp } = await import('@capacitor/core');
    const r = await CapacitorHttp.request({ url, method: 'GET', headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' }, connectTimeout: 15000, readTimeout: 15000 });
    if (r.status < 200 || r.status >= 300) return null;
    return (typeof r.data === 'string' ? JSON.parse(r.data) : r.data) as { data?: Item[] };
  }
  return new Promise((resolve) => {
    const x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.timeout = 15000;
    x.setRequestHeader('Authorization', 'Bearer ' + key);
    x.setRequestHeader('Accept', 'application/json');
    x.onload = () => {
      if (x.status < 200 || x.status >= 300) return resolve(null);
      try {
        resolve(JSON.parse(x.responseText) as { data?: Item[] });
      } catch {
        resolve(null);
      }
    };
    x.onerror = () => resolve(null);
    x.ontimeout = () => resolve(null);
    x.send();
  });
}

const words = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 2);

/** Quanto do título da lista aparece no resultado (0 a 1), para não aceitar capa de outro conteúdo. */
export function overlap(listName: string, found: string): number {
  const a = words(listName);
  if (!a.length) return 0;
  const b = new Set(words(found));
  return a.filter((w) => b.has(w)).length / a.length;
}

/**
 * O resultado é o mesmo conteúdo? Aceita quando boa parte do nome da lista está no resultado,
 * ou quando o título encontrado (2+ palavras) aparece inteiro no nome da lista — as listas
 * costumam pôr o estúdio ou a atriz na frente ("Estúdio - Título").
 */
export function sameContent(listName: string, found: string, min = 0.6): boolean {
  return overlap(listName, found) >= min || (words(found).length >= 2 && overlap(found, listName) >= 0.8);
}

/** Nome da lista limpo para a busca (sem XXX, 4K, [tags], categoria…). */
export function adultQuery(name: string): string {
  return name
    .replace(/\[[^\]]*\]|\((?:dub|leg|xxx|18\+?)[^)]*\)/gi, ' ')
    .replace(/\b(xxx|4k|uhd|fhd|hd|sd|1080p|720p|2160p|h265|hevc|dublado|legendado|leg|dub|\+18|18\+)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Hash curto do texto → número negativo (as capas da ThePornDB não têm número do TMDB). */
function negId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return -Math.abs(h || 1);
}

/** Procura cena e depois filme; aceita só se o título bater o suficiente com o da lista. */
export async function tpdbLookup(name: string, year?: number): Promise<TmdbInfo | null> {
  const key = tpdbKey();
  if (!key) return null;
  const q = adultQuery(name);
  if (q.length < 3) return null;
  for (const kind of ['scenes', 'movies']) {
    const r = await get(`/${kind}?parse=${encodeURIComponent(q)}&per_page=5`, key);
    const list = r?.data ?? [];
    let best: Item | undefined;
    let score = 0;
    for (const it of list) {
      const full = `${it.title ?? ''} ${it.site?.name ?? ''} ${(it.performers ?? []).map((p) => p.name ?? p.parent?.name ?? '').join(' ')}`;
      const sc = sameContent(q, full, 0.5) ? Math.max(overlap(q, full), overlap(it.title ?? '', q)) : 0;
      if (sc > score) {
        score = sc;
        best = it;
      }
    }
    if (best && score > 0) {
      const poster = pick(best.posters) || best.poster || best.image;
      const backdrop = pick(best.background) || best.image || poster;
      if (!poster && !backdrop) continue;
      const y = best.date ? Number(best.date.slice(0, 4)) : year;
      return {
        id: negId(String(best.id ?? best._id ?? best.title)),
        type: 'movie',
        title: best.title || q,
        poster: poster || backdrop,
        backdrop,
        overview: best.description || undefined,
        year: y && !isNaN(y) ? y : undefined,
        performers: performersOfItem(best),
      };
    }
  }
  return null;
}

/** Foto de uma atriz pelo nome (para quem só aparece no título da lista). */
export async function tpdbPerformer(name: string): Promise<Performer | null> {
  const key = tpdbKey();
  if (!key) return null;
  const r = await get(`/performers?q=${encodeURIComponent(name)}&per_page=5`, key).catch(() => null);
  const n = words(name).join(' ');
  for (const it of (r?.data ?? []) as Perf[]) {
    const p = toPerformer(it);
    if (p && words(p.name).join(' ') === n) return p;
  }
  return null;
}

/** Confere a chave com uma busca pequena. */
export async function testTpdbKey(key: string): Promise<boolean> {
  try {
    const r = await get('/scenes?parse=test&per_page=1', key.trim());
    return !!r && Array.isArray(r.data);
  } catch {
    return false;
  }
}
