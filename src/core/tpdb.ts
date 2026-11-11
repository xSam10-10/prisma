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
  site?: Site;
  performers?: Perf[];
}
type Site = { name?: string; logo?: string; favicon?: string; poster?: string; parent?: { name?: string; logo?: string } | null };
/** Produtora (0.34.0): nome e logotipo. */
export interface StudioInfo {
  name: string;
  logo?: string;
}
export function toStudio(x?: Site | null): StudioInfo | undefined {
  const name = (x?.name || '').trim();
  // "FansDB: Fulana" é a página da própria atriz (OnlyFans etc.), não uma produtora.
  if (!name || /^fansdb\s*:/i.test(name)) return undefined;
  return { name, logo: x?.logo || x?.poster || x?.favicon || undefined };
}
/** Página da atriz no OnlyFans e parecidos ("FansDB: Fulana", 0.34.3): a imagem serve de capa em último caso. */
export interface FansPage {
  name: string;
  image?: string;
}
export function fansOf(x?: Site | null): FansPage | undefined {
  const m = /^fansdb\s*:\s*(.+)$/i.exec((x?.name || '').trim());
  if (!m) return undefined;
  return { name: m[1].trim(), image: x?.poster || x?.logo || x?.favicon || undefined };
}
type Gender = { gender?: string };
interface Perf {
  name?: string;
  image?: string;
  face?: string;
  thumbnail?: string;
  posters?: { url?: string }[];
  extra?: Gender;
  extras?: Gender;
  parent?: { name?: string; image?: string; face?: string; thumbnail?: string; posters?: { url?: string }[]; extras?: Gender; extra?: Gender };
}

/** Atriz do resultado (0.32.0): nome e foto do rosto. Homens ficam de fora. */
export interface Performer {
  name: string;
  /** Rosto (para o filtro, redondo). */
  photo?: string;
  /** Foto em pé (para a capa, 0.33.0). */
  portrait?: string;
}
function toPerformer(p: Perf): Performer | null {
  const name = (p.name || p.parent?.name || '').trim();
  if (!name) return null;
  const g = (p.extra?.gender || p.extras?.gender || p.parent?.extras?.gender || p.parent?.extra?.gender || '').toLowerCase();
  if (g && !/female|woman|trans/.test(g)) return null;
  const photo = p.face || p.parent?.face || p.image || p.parent?.image || p.thumbnail || p.parent?.thumbnail || undefined;
  const post = (l?: { url?: string }[]) => (Array.isArray(l) ? l.map((x) => x && x.url).filter(Boolean)[0] : undefined);
  const portrait = post(p.posters) || post(p.parent?.posters) || p.image || p.parent?.image || p.thumbnail || p.parent?.thumbnail || photo;
  return { name, photo, portrait };
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

// ---- Nome parecido (0.33.0) ----
// "Anal Buffet 10" na lista e "Anal Buffet Vol. 10" na ThePornDB são o mesmo filme; "... 11" não é.

const allWords = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !FILLER.has(w));
const FILLER = new Set(['vol', 'volume', 'part', 'parte', 'the', 'a', 'an', 'and', 'e', 'o', 'de', 'of', 'episode', 'ep', 'scene', 'cena']);
const isNum = (w: string) => /^\d+$/.test(w);
function lev(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
/** Palavras iguais ou com uma letra de diferença (palavras de 4+ letras; números só iguais). */
const wordEq = (x: string, y: string) => x === y || (!isNum(x) && !isNum(y) && x.length >= 4 && y.length >= 4 && lev(x, y) <= 1);

/**
 * Semelhança entre dois títulos (0 a 1). Os números precisam ser os mesmos (parte/volume),
 * senão é 0. Palavras com uma letra de diferença contam como iguais.
 */
export function similar(a: string, b: string): number {
  const A = allWords(a);
  const B = allWords(b);
  if (!A.length || !B.length) return 0;
  if (A.filter(isNum).join(',') !== B.filter(isNum).join(',')) return 0;
  const used: boolean[] = [];
  let hit = 0;
  for (const x of A) {
    for (let j = 0; j < B.length; j++)
      if (!used[j] && wordEq(x, B[j])) {
        used[j] = true;
        hit++;
        break;
      }
  }
  return (2 * hit) / (A.length + B.length);
}

/** Pedaços do nome "Estúdio - Atriz - Título": o título é o último. */
export function titlePart(name: string): string {
  const segs = adultQuery(name)
    .replace(/\((19|20)\d{2}\)/g, ' ')
    .split(/\s+[-–|]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return segs.length ? segs[segs.length - 1] : '';
}

function toInfo(best: Item, q: string, year?: number): TmdbInfo | null {
  const poster = pick(best.posters) || best.poster || best.image;
  const backdrop = pick(best.background) || best.image || poster;
  if (!poster && !backdrop) return null;
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
    studio: toStudio(best.site),
    fans: fansOf(best.site),
  };
}

/**
 * Procura o título na ThePornDB:
 * 1) cena e filme pelo nome inteiro (modo "parse", que entende "Estúdio - Atriz - Título");
 * 2) filme e cena só pelo título, aceitando nome bem parecido (ver `similar`).
 * Se achar o conteúdo mas sem capa, devolve só as atrizes (a capa vira a foto delas).
 */
export async function tpdbLookup(name: string, year?: number): Promise<TmdbInfo | null> {
  const key = tpdbKey();
  if (!key) return null;
  const q = adultQuery(name);
  if (q.length < 3) return null;
  let cast: Performer[] = [];
  let studio: StudioInfo | undefined;
  let fans: FansPage | undefined;
  for (const kind of ['scenes', 'movies']) {
    const r = await get(`/${kind}?parse=${encodeURIComponent(q)}&per_page=5`, key);
    let best: Item | undefined;
    let score = 0;
    for (const it of r?.data ?? []) {
      const full = `${it.title ?? ''} ${it.site?.name ?? ''} ${(it.performers ?? []).map((p) => p.name ?? p.parent?.name ?? '').join(' ')}`;
      const sc = sameContent(q, full, 0.5) ? Math.max(overlap(q, full), overlap(it.title ?? '', q)) : 0;
      if (sc > score) {
        score = sc;
        best = it;
      }
    }
    if (best && score > 0) {
      const info = toInfo(best, q, year);
      if (info) return info;
      if (!cast.length) cast = performersOfItem(best);
      if (!studio) studio = toStudio(best.site);
      if (!fans) fans = fansOf(best.site);
    }
  }
  // Nome parecido: busca de texto só com o título (sem estúdio e atriz).
  const t = titlePart(name);
  if (allWords(t).length >= 2 || (allWords(t).length === 1 && t.length >= 6)) {
    for (const kind of ['movies', 'scenes']) {
      const r = await get(`/${kind}?q=${encodeURIComponent(t)}&per_page=10`, key);
      let best: Item | undefined;
      let score = 0;
      for (const it of r?.data ?? []) {
        const sc = similar(t, it.title ?? '');
        // Ano diferente (quando os dois dizem) derruba.
        const y = it.date ? Number(it.date.slice(0, 4)) : undefined;
        if (year && y && Math.abs(year - y) > 1) continue;
        if (sc > score) {
          score = sc;
          best = it;
        }
      }
      if (best && score >= 0.8) {
        const info = toInfo(best, t, year);
        if (info) return info;
        if (!cast.length) cast = performersOfItem(best);
        if (!studio) studio = toStudio(best.site);
        if (!fans) fans = fansOf(best.site);
      }
    }
  }
  return cast.length || studio || fans ? { id: negId('cast:' + q), type: 'movie', title: t || q, performers: cast, studio, fans } : null;
}

// Atrizes já procuradas nesta sessão (o mesmo nome aparece em vários filmes).
const perfMemo = new Map<string, Promise<Performer | null>>();

/** Atriz pelo nome (aceita uma letra de diferença, ex.: "Kali Rose" × "Kali Roses"). */
export function tpdbPerformer(name: string): Promise<Performer | null> {
  const k = words(name).join(' ');
  let p = perfMemo.get(k);
  if (!p) {
    p = (async () => {
      const key = tpdbKey();
      if (!key) return null;
      const r = await get(`/performers?q=${encodeURIComponent(name)}&per_page=5`, key).catch(() => null);
      const found = ((r?.data ?? []) as Perf[]).map(toPerformer).filter((x): x is Performer => !!x);
      return found.find((x) => words(x.name).join(' ') === k) ?? found.find((x) => similar(name, x.name) === 1) ?? null;
    })();
    perfMemo.set(k, p);
  }
  return p;
}

// Produtoras já procuradas nesta sessão.
const siteMemo = new Map<string, Promise<StudioInfo | null>>();

/** Produtora pelo nome (0.34.0), com o logotipo. Aceita "Tiny 4K" = "Tiny4K". */
export function tpdbSite(name: string): Promise<StudioInfo | null> {
  const flat = (x: string) => words2(x).join('');
  const k = flat(name);
  let p = siteMemo.get(k);
  if (!p) {
    p = (async () => {
      const key = tpdbKey();
      if (!key || !k) return null;
      const r = (await get(`/sites?q=${encodeURIComponent(name)}&per_page=10`, key).catch(() => null)) as { data?: Site[] } | null;
      const list = (r?.data ?? []).map(toStudio).filter((x): x is StudioInfo => !!x);
      return list.find((x) => flat(x.name) === k) ?? list.find((x) => similar(name, x.name) === 1) ?? null;
    })();
    siteMemo.set(k, p);
  }
  return p;
}
const words2 = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);

/** Confere a chave com uma busca pequena. */
export async function testTpdbKey(key: string): Promise<boolean> {
  try {
    const r = await get('/scenes?parse=test&per_page=1', key.trim());
    return !!r && Array.isArray(r.data);
  } catch {
    return false;
  }
}
