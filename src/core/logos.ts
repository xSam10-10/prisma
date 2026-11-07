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

/** Nome para exibir: sem emojis e símbolos decorativos, espaços arrumados. */
export function cleanLabel(s: string): string {
  return s
    .replace(DECOR, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s|•·\-–—:]+|[\s|•·\-–—:]+$/g, '')
    .trim() || s.trim();
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
    const url = `logos/${folder}/${file}`;
    m.set(key, url);
    m.set(key.replace(/ /g, ''), url); // "rede tv" também casa com "redetv"
  }
  return m;
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

function lookup(m: Map<string, string>, key: string): string | undefined {
  if (!key) return undefined;
  const hit = m.get(key) ?? m.get(key.replace(/ /g, ''));
  if (hit) return hit;
  // "globo sp" → "globo"; "premiere 5" → "premiere" (tira palavras do fim).
  const words = key.split(' ');
  for (let n = words.length - 1; n >= 1; n--) {
    const k = words.slice(0, n).join(' ');
    if (k.length < 3) break;
    const h = m.get(k) ?? m.get(k.replace(/ /g, ''));
    if (h) return h;
  }
  return undefined;
}

/**
 * Lista de logos para tentar, em ordem (o componente passa para o próximo
 * se uma imagem falhar).
 */
export function logoCandidates(name: string, listLogo: string | undefined, preferList: boolean): string[] {
  const key = logoKey(name);
  const own = lookup(mine, key);
  const off = lookup(official, key);
  const out: string[] = [];
  if (own) out.push(own);
  if (preferList) {
    if (listLogo) out.push(listLogo);
    if (off) out.push(off);
  } else {
    if (off) out.push(off);
    if (listLogo) out.push(listLogo);
  }
  return out.filter((v, i) => out.indexOf(v) === i);
}
