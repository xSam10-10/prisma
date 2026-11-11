import type { Channel } from './types';
import { actressKey } from './actresses';

// Filtro por produtora da categoria de adultos (0.34.0). A produtora vem:
// 1) do próprio nome na lista: "Estúdio - Atriz - Título", "[Estúdio] Título",
//    "Estudio.24.03.15.Atriz.Titulo" ou um nome conhecido no começo ("Vixen ...");
// 2) da ThePornDB (com o token), que diz o site de cada cena e traz o logotipo.

export interface Studio {
  key: string;
  name: string;
  logo?: string;
  /** Títulos da categoria dessa produtora. */
  ids: Set<string>;
}

/** Chave sem espaços: "Tiny 4K" = "Tiny4K", "Reality Kings" = "RealityKings". */
export const studioKey = (s: string): string => actressKey(s).replace(/ /g, '');

// Produtoras conhecidas (nome como aparece na tela). Servem para reconhecer o nome no começo do
// título mesmo sem o " - " e, sem o token, para aceitar a produtora com um título só.
const KNOWN = [
  'Vixen', 'Blacked', 'Blacked Raw', 'Tushy', 'Tushy Raw', 'Deeper', 'Slayed', 'Milfy', 'Wifey', 'Tiny4K', 'Passion HD', 'Exotic4K', 'Cum4K',
  'Lubed', 'Holed', 'POVD', 'Casting Couch X', 'Nanny Spy', 'Spy Fam', 'Brazzers', 'Reality Kings', 'BangBros', 'Naughty America',
  'Digital Playground', 'Evil Angel', 'Jules Jordan', 'Private', 'Marc Dorcel', 'Dorcel', 'Wicked', 'New Sensations', 'Team Skeet', 'Mofos',
  'Pure Taboo', 'Adult Time', 'MetArt', 'X-Art', 'Babes', 'Twistys', 'Nubiles', 'Kink', 'Elegant Angel', 'Hustler', 'Penthouse', 'Playboy',
  'Vivid', 'Girlsway', 'Sweetheart Video', 'Fake Taxi', 'Fake Hostel', 'Public Agent', 'Family Strokes', 'Sis Loves Me', 'Bratty Sis',
  'Moms Teach Sex', 'Brasileirinhas', 'Buttman', 'Rocco Siffredi', '21Sextury', 'Tonights Girlfriend', 'Lets Doe It', 'Dane Jones',
  'Sexy Hub', 'Fitness Rooms', 'Mature NL', 'Bang', 'Jesse Loads Monster Facials', 'Hard X', 'Dark X', 'Lesbian X', 'Eros X', 'Erito',
  'Brattysis', 'MYLF', 'Pervz', 'Swappz', 'Shoplyfter', 'Bellesa Films', 'Lust Cinema', 'Sex Art', 'Joymii', 'Ultra Films', 'Hegre',
  'Club Seventeen', 'Anal Vids', 'Legal Porno', 'Porn World', 'Proxy Paige', 'Manyvids', 'OnlyFans',
];
const KNOWN_BY_KEY = new Map(KNOWN.map((n) => [studioKey(n), n] as [string, string]));
export const knownStudio = (name: string): string | undefined => KNOWN_BY_KEY.get(studioKey(name));

// Etiquetas que aparecem entre colchetes e não são produtora.
const TAG = /^(?:4k|uhd|fhd|hd|sd|1080p?|720p?|2160p?|xxx|18\+?|\+18|dub|leg|dublado|legendado|nacional|dual|hevc|h265|x265|new|novo)$/i;

/** Nome bonito: "BLACKED" → "Blacked", mantendo "Tiny4K" e "POVD" como estão. */
function prettyName(s: string): string {
  const t = s.replace(/[_.]+/g, ' ').replace(/\s+/g, ' ').trim();
  return knownStudio(t) ?? (t === t.toUpperCase() && t.length > 4 ? t.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : t);
}

/**
 * Produtora tirada do nome do título.
 * strong = formato que quase sempre traz a produtora (3+ pedaços, colchetes, nome de arquivo
 * de cena ou nome conhecido); fraco = "Algo - Título" (pode ser a atriz).
 */
export function studioInTitle(title: string): { name: string; strong: boolean } | null {
  const s = title.trim();
  // [Estúdio] Título
  const br = /^\[([^\]]{2,30})\]/.exec(s);
  if (br && !TAG.test(br[1].trim())) return { name: prettyName(br[1]), strong: true };
  // Estudio.24.03.15.Atriz.Titulo (nome de arquivo de cena)
  const dot = /^([A-Za-z0-9]{3,30})\.\d{2}\.\d{2}\.\d{2}\./.exec(s);
  if (dot) return { name: prettyName(dot[1]), strong: true };
  const segs = s
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .split(/\s+[-–|]\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (segs.length >= 3 && segs[0].length <= 40) return { name: prettyName(segs[0]), strong: true };
  // Nome conhecido no começo ("Vixen Kali Roses ...", "Tiny4K - ...")
  const w = actressKey(s).split(' ');
  for (let n = 3; n >= 1; n--) {
    const k = w.slice(0, n).join('');
    if (w.length > n && KNOWN_BY_KEY.has(k)) return { name: KNOWN_BY_KEY.get(k)!, strong: true };
  }
  if (segs.length === 2 && segs[0].length <= 30 && segs[0].split(' ').length <= 3) return { name: prettyName(segs[0]), strong: false };
  return null;
}

/** Site da ThePornDB por título (já procurado) e produtoras conferidas lá (null = não existe). */
export interface SiteInfo {
  name: string;
  logo?: string;
}

/**
 * Monta a lista de produtoras.
 * - siteOf: produtora que a ThePornDB disse para cada título;
 * - verified: nomes do título conferidos na ThePornDB (null = não é produtora);
 * - withKey: há token (aí nome do título precisa ser conferido, a não ser os conhecidos);
 * - people: chaves das atrizes (nunca contam como produtora).
 */
export function buildStudios(items: Channel[], siteOf: Map<string, SiteInfo>, verified: Map<string, SiteInfo | null>, withKey: boolean, people: Set<string> = new Set()): Studio[] {
  const map = new Map<string, Studio>();
  const add = (name: string, id: string, logo?: string) => {
    const key = studioKey(name);
    if (!key || people.has(actressKey(name))) return;
    let st = map.get(key);
    if (!st) map.set(key, (st = { key, name, logo, ids: new Set() }));
    if (!st.logo && logo) st.logo = logo;
    st.ids.add(id);
  };
  const parsed = new Map<string, { name: string; strong: number; ids: string[] }>();
  for (const it of items) {
    const site = siteOf.get(it.id);
    if (site) add(site.name, it.id, site.logo);
    const f = studioInTitle(it.fullName ?? it.name);
    if (!f) continue;
    const k = studioKey(f.name);
    const e = parsed.get(k) ?? { name: f.name, strong: 0, ids: [] };
    if (f.strong) e.strong++;
    e.ids.push(it.id);
    parsed.set(k, e);
  }
  parsed.forEach((e, k) => {
    const v = verified.get(k);
    const known = KNOWN_BY_KEY.has(k);
    const ok = map.has(k) || !!v || known || (!withKey && e.strong >= 2) || (withKey && v === undefined && e.strong >= 3);
    // Conhecida fica mesmo se a busca na ThePornDB não achar (nome escrito diferente lá).
    if (!ok || (v === null && !known)) return;
    e.ids.forEach((id) => add(v?.name ?? e.name, id, v?.logo));
  });
  return [...map.values()].filter((s) => s.ids.size > 0).sort((a, b) => b.ids.size - a.ids.size || a.name.localeCompare(b.name));
}

/** Nomes de produtora do título que ainda precisam ser conferidos na ThePornDB (mais frequentes primeiro). */
export function studiosToVerify(items: Channel[], verified: Map<string, SiteInfo | null>, max = 30): string[] {
  const count = new Map<string, { name: string; n: number }>();
  for (const it of items) {
    const f = studioInTitle(it.fullName ?? it.name);
    if (!f) continue;
    const k = studioKey(f.name);
    if (verified.has(k)) continue;
    const e = count.get(k) ?? { name: f.name, n: 0 };
    e.n++;
    count.set(k, e);
  }
  return [...count.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map((e) => e.name);
}
