import { fetchText } from './net';

// Logotipos dos canais. Prioridade:
//  1. meus logos  (public/logos/custom/meus-logos.json) — escolhidos pelo usuário
//  2. oficiais    (public/logos/br/catalogo.json) — projeto tv-logo/tv-logos
//  3. o logo que veio na lista IPTV (se "Logotipos: da lista primeiro", este vem antes do 2)
//  4. iniciais do canal (feito no componente)

/** Marcas de qualidade/versão que não fazem parte do nome do canal. */
const TAGS = /\b(hd|fhd|uhd|sd|4k|8k|hdr|fhdr|hevc|h ?265|h ?264|60 ?fps|50 ?fps|alt|alternativo|backup|op\d|opcao \d)\b/g;

/** Símbolos e emojis decorativos que alguns provedores colocam nos nomes. */
const DECOR = /[←-⇿⌀-⏿■-◿☀-➿⬀-⯿️‍⃣]|[\uD83C-\uD83E][\uDC00-\uDFFF]/g;

/** Valor de um número decorado (①, ❶, ➊, ⑴, ⒈, ０, 🔟…), ou -1 se não for um. */
function fancyDigit(cp: number): number {
  if (cp >= 0x2460 && cp <= 0x2473) return cp - 0x2460 + 1; // ① a ⑳
  if (cp >= 0x2474 && cp <= 0x2487) return cp - 0x2474 + 1; // ⑴ a ⒇
  if (cp >= 0x2488 && cp <= 0x249b) return cp - 0x2488 + 1; // ⒈ a ⒛
  if (cp === 0x24ea || cp === 0x24ff) return 0; // ⓪ ⓿
  if (cp >= 0x24eb && cp <= 0x24f4) return cp - 0x24eb + 11; // ⓫ a ⓴
  if (cp >= 0x24f5 && cp <= 0x24fe) return cp - 0x24f5 + 1; // ⓵ a ⓾
  if (cp >= 0x2776 && cp <= 0x277f) return cp - 0x2776 + 1; // ❶ a ❿
  if (cp >= 0x2780 && cp <= 0x2789) return cp - 0x2780 + 1; // ➀ a ➉
  if (cp >= 0x278a && cp <= 0x2793) return cp - 0x278a + 1; // ➊ a ➓
  if (cp >= 0xff10 && cp <= 0xff19) return cp - 0xff10; // ０ a ９
  if (cp >= 0x1d7ce && cp <= 0x1d7ff) return (cp - 0x1d7ce) % 10; // 𝟎 𝟏 𝟐…
  if (cp === 0x1f51f) return 10; // 🔟
  if (cp === 0xb9) return 1; // ¹
  if (cp === 0xb2 || cp === 0xb3) return cp - 0xb0; // ² ³
  if (cp === 0x2070 || (cp >= 0x2074 && cp <= 0x2079)) return cp - 0x2070; // ⁰ ⁴ a ⁹
  if (cp >= 0x2080 && cp <= 0x2089) return cp - 0x2080; // ₀ a ₉
  if (cp >= 0x2160 && cp <= 0x216b) return cp - 0x2160 + 1; // Ⅰ a Ⅻ
  if (cp >= 0x2170 && cp <= 0x217b) return cp - 0x2170 + 1; // ⅰ a ⅻ
  return -1;
}

const MAYBE_FANCY = /[²³¹⁰-₉Ⅰ-ⅻ①-⓿❶-➓０-９\ud835\ud83d]/;

/** Troca números decorados por números comuns: "XXX 4K ❿" → "XXX 4K 10" (senão canais numerados viram um só). */
export function plainDigits(s: string): string {
  if (!MAYBE_FANCY.test(s)) return s;
  let out = '';
  let lastFancy = false;
  for (let i = 0; i < s.length; i++) {
    let cp = s.charCodeAt(i);
    let len = 1;
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < s.length) {
      const lo = s.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        cp = (cp - 0xd800) * 0x400 + (lo - 0xdc00) + 0x10000;
        len = 2;
      }
    }
    const d = fancyDigit(cp);
    if (d >= 0) {
      if (!lastFancy && /[A-Za-z0-9]$/.test(out)) out += ' ';
      out += String(d);
      lastFancy = true;
    } else {
      out += s.substr(i, len);
      lastFancy = false;
    }
    i += len - 1;
  }
  return out;
}

/** Nome para exibir: sem emojis e símbolos decorativos, espaços arrumados. */
export function cleanLabel(s: string): string {
  return plainDigits(s)
    .replace(DECOR, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s|•·\-–—:]+|[\s|•·\-–—:]+$/g, '')
    .trim() || plainDigits(s).trim();
}

/** Chave de comparação: "SPORTV 2 FHD [H265]" → "sportv 2". */
export function logoKey(name: string): string {
  return cleanLabel(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9+ ]/g, ' ')
    .replace(TAGS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type Catalog = Record<string, string>;
let official: Map<string, string> = new Map();
let mine: Map<string, string> = new Map();
let loaded = false;

function index(cat: Catalog, folder: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const [k, file] of Object.entries(cat)) {
    const key = logoKey(k);
    // Arquivo vazio = bloqueio: o canal não herda o logo de um nome mais curto (0.34.6;
    // ex.: "TCM canal 10-RN" não é a TCM).
    const url = file ? `logos/${folder}/${file}` : '';
    m.set(key, url);
    m.set(key.replace(/ /g, ''), url); // "rede tv" também casa com "redetv"
  }
  return m;
}

/** Só para os testes: troca os catálogos sem baixar nada. */
export function setLogoCatalogs(o: Catalog, c: Catalog): void {
  loaded = true;
  official = index(o, 'br');
  mine = index(c, 'custom');
}

/** Carrega os catálogos (uma vez). */
export async function loadLogoCatalogs(): Promise<void> {
  if (loaded) return;
  loaded = true;
  const base = new URL('logos/', document.baseURI).href;
  const get = async (f: string): Promise<Catalog> => {
    try {
      return JSON.parse(await fetchText(base + f, 10000)) as Catalog;
    } catch {
      return {};
    }
  };
  const [o, c] = await Promise.all([get('br/catalogo.json'), get('custom/meus-logos.json')]);
  official = index(o, 'br');
  mine = index(c, 'custom');
}

type Hit = { url: string; words: number };

function get(m: Map<string, string>, k: string): string | undefined {
  return m.has(k) ? m.get(k) : m.get(k.replace(/ /g, ''));
}

/** Logo do catálogo e quantas palavras do nome casaram (para saber qual é mais específico).
 *  url vazia = bloqueio. */
function lookup(m: Map<string, string>, key: string): Hit | undefined {
  if (!key) return undefined;
  const words = key.split(' ');
  const hit = get(m, key);
  if (hit !== undefined) return { url: hit, words: words.length };
  // "globo sp" → "globo"; "premiere 5" → "premiere" (tira palavras do fim).
  for (let n = words.length - 1; n >= 1; n--) {
    const k = words.slice(0, n).join(' ');
    if (k.length < 3) break;
    const h = get(m, k);
    if (h !== undefined) return { url: h, words: n };
  }
  return undefined;
}

/**
 * Lista de logos para tentar, em ordem (o componente passa para o próximo
 * se uma imagem falhar).
 */
export function logoCandidates(name: string, listLogo: string | undefined, preferList: boolean): string[] {
  const key = logoKey(name);
  const ownHit = lookup(mine, key);
  const offHit = lookup(official, key);
  // Meu logo só passa na frente do oficial quando é tão específico quanto ele: "Record" genérico
  // não cobre o oficial da "Record RJ" (0.34.6). Um bloqueio meu tira também o oficial menos específico.
  const mineWins = !!ownHit && (!offHit || ownHit.words >= offHit.words);
  const own = mineWins ? ownHit!.url || undefined : undefined;
  const off = mineWins && !ownHit!.url ? undefined : offHit?.url;
  const out: string[] = [];
  if (own) out.push(own);
  if (preferList) {
    if (listLogo) out.push(listLogo);
    if (off) out.push(off);
  } else {
    if (off) out.push(off);
    if (listLogo) out.push(listLogo);
  }
  if (ownHit?.url && !mineWins) out.push(ownHit.url); // reserva, se as outras imagens falharem
  return out.filter((v, i) => out.indexOf(v) === i);
}
