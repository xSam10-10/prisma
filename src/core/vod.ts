import { prefGet, prefSet } from './storage';
import type { Channel } from './types';
import { norm, searchTitle } from './tmdb';
import { isAdultName } from './parental';

// Filmes, séries e anime: streamings, progresso, Minha lista e "continuar".

export interface Streaming {
  id: string;
  name: string;
  match: RegExp;
  bg: string;
  accent: string;
  accent2: string;
  /** Logotipo (public/streaming/<id>.png) e a largura/altura dele, para o mesmo "peso" visual em todos. */
  logo?: { w: number; h: number; k?: number };
}

/** Altura do logo no botão: os mais largos ficam mais baixos, os compactos mais altos (área parecida). */
export function logoSize(l: { w: number; h: number; k?: number }, area = 2600, maxW = 130, maxH = 26, minH = 20): { width: number; height: number } {
  const ratio = l.w / l.h;
  // k: ajuste óptico (logos com texto pequeno dentro do desenho ganham altura; letras grossas perdem)
  const k = l.k ?? 1;
  // Alturas quase iguais (entre minH e maxH; os compactos um pouco mais altos)
  // e nenhum mais largo que maxW — todos com o mesmo "tamanho" na fileira.
  let height = Math.max(minH, Math.min(maxH, Math.sqrt(area / ratio))) * k;
  if (height * ratio > maxW) height = maxW / ratio;
  if (height > maxH * 1.5) height = maxH * 1.5;
  return { width: Math.round(height * ratio), height: Math.round(height) };
}

/** Logotipo colorido (padrão) ou branco (Ajustes › Aparência). */
export function logoUrl(id: string, mode: 'color' | 'mono' = 'color'): string {
  return `${import.meta.env.BASE_URL}streaming/${mode}/${id}.png`;
}

/** Streamings reconhecidos pelos nomes das categorias da lista (cores = arte do protótipo v2). */
export const STREAMINGS: Streaming[] = [
  // Ordem combinada com o usuário (08/11): os 12 primeiros; depois os demais.
  { id: 'netflix', name: 'Netflix', match: /netflix/i, bg: '#141414', accent: '#E50914', accent2: '#7A0A0F', logo: { w: 536, h: 144, k: 0.94 } },
  { id: 'hbo', name: 'HBO Max', match: /\bhbo\b|\bmax\b/i, bg: '#0A0A2E', accent: '#3D2BFF', accent2: '#A020F0', logo: { w: 806, h: 144 } },
  { id: 'disney', name: 'Disney+', match: /disney/i, bg: '#0B1A3D', accent: '#1F80E0', accent2: '#00D4FF', logo: { w: 272, h: 144, k: 1.4 } },
  { id: 'apple', name: 'Apple TV', match: /apple/i, bg: '#000000', accent: '#8E8E93', accent2: '#3A3A3C', logo: { w: 287, h: 144, k: 1.12 } },
  { id: 'prime', name: 'Prime Video', match: /prime|amazon/i, bg: '#0F171E', accent: '#00A8E1', accent2: '#1A4D8F', logo: { w: 470, h: 144, k: 1.08 } },
  { id: 'paramount', name: 'Paramount+', match: /paramount/i, bg: '#00112E', accent: '#0064FF', accent2: '#00B3FF', logo: { w: 238, h: 144, k: 1.45 } },
  { id: 'globoplay', name: 'Globoplay', match: /globoplay/i, bg: '#1E0A12', accent: '#FB2E5A', accent2: '#FF7A00', logo: { w: 652, h: 144 } },
  { id: 'star', name: 'Star+', match: /star\s?\+|star plus/i, bg: '#1A0B2E', accent: '#C724B1', accent2: '#FF6C00', logo: { w: 505, h: 144, k: 0.94 } },
  { id: 'discovery', name: 'Discovery+', match: /discovery/i, bg: '#00101F', accent: '#2175FF', accent2: '#00C2FF', logo: { w: 715, h: 144 } },
  { id: 'crunchyroll', name: 'Crunchyroll', match: /crunchy/i, bg: '#1A1206', accent: '#F47521', accent2: '#FFB000', logo: { w: 789, h: 144 } },
  { id: 'funimation', name: 'Funimation Now', match: /funimation/i, bg: '#14081F', accent: '#5B0BB5', accent2: '#A44DFF', logo: { w: 879, h: 144, k: 1.15 } },
  { id: 'lionsgate', name: 'Lionsgate', match: /lions\s?gate|starzplay/i, bg: '#0D0D0D', accent: '#C8A24B', accent2: '#5A4A22', logo: { w: 1143, h: 144 } },
  { id: 'claro', name: 'Claro Vídeo', match: /claro\s?(video|vídeo|tv)/i, bg: '#1A0505', accent: '#DA291C', accent2: '#7A0F08', logo: { w: 745, h: 144 } },
  { id: 'sbt', name: 'SBT+', match: /\bsbt\s?(\+|plus|video|vídeo)/i, bg: '#04122E', accent: '#0055B8', accent2: '#F5B800', logo: { w: 159, h: 144, k: 1.5 } },
  { id: 'directv', name: 'DirecTV GO', match: /direc\s?tv|\bdgo\b/i, bg: '#04101F', accent: '#00A6E8', accent2: '#0D3B66', logo: { w: 755, h: 144 } },
  { id: 'amc', name: 'AMC+', match: /\bamc\b/i, bg: '#0B0B0B', accent: '#E4E4E4', accent2: '#5A5A5A', logo: { w: 305, h: 144, k: 1.2 } },
  { id: 'hulu', name: 'Hulu', match: /hulu/i, bg: '#0B0C0F', accent: '#1CE783', accent2: '#0B8F52', logo: { w: 437, h: 144 } },
];

export function streamingsIn(groups: string[]): Streaming[] {
  return STREAMINGS.filter((s) => groups.some((g) => s.match.test(g)));
}

/** Anime: categorias com "anime" ou Crunchyroll. */
export const ANIME = /anime|crunchy|otaku/i;

// ---- Progresso (onde parou) ----

export interface Progress {
  pos: number; // segundos
  dur: number; // segundos
  at: number; // quando
}

export function getProgress(id: string): Progress | undefined {
  return prefGet<Record<string, Progress>>('progress', {})[id];
}

export function saveProgress(id: string, pos: number, dur: number): void {
  const all = prefGet<Record<string, Progress>>('progress', {});
  // Terminou (95%) ou mal começou (< 20 s): não guarda. Terminou = marca como visto.
  if (dur > 0 && pos / dur > 0.95) {
    delete all[id];
    setWatched([id], true);
  }
  else if (pos >= 20) all[id] = { pos: Math.round(pos), dur: Math.round(dur), at: Date.now() };
  // Mantém só os 200 mais recentes (app leve).
  const keys = Object.keys(all).sort((a, b) => all[b].at - all[a].at);
  for (const k of keys.slice(200)) delete all[k];
  prefSet('progress', all);
}

// ---- Assistidos por último (filmes e episódios) ----

export function vodRecents(): Channel[] {
  return prefGet<Channel[]>('vodRecents', []);
}

export function pushVodRecent(item: Channel): void {
  const list = [item, ...vodRecents().filter((x) => x.id !== item.id)].slice(0, 20);
  prefSet('vodRecents', list);
}

// ---- Minha lista ----

export function myList(): Channel[] {
  return prefGet<Channel[]>('myList', []);
}

export function inMyList(id: string): boolean {
  return myList().some((x) => x.id === id);
}

export function toggleMyList(item: Channel): boolean {
  const cur = myList();
  const has = cur.some((x) => x.id === item.id);
  prefSet('myList', has ? cur.filter((x) => x.id !== item.id) : [item, ...cur]);
  return !has;
}

export function fmtDuration(sec: number): string {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

// ---- Vistos (episódios e filmes terminados ou marcados à mão) ----

export function watchedIds(): Record<string, number> {
  return prefGet<Record<string, number>>('watched', {});
}

export function isWatched(id: string): boolean {
  return !!watchedIds()[id];
}

export function setWatched(ids: string[], on: boolean): void {
  const all = watchedIds();
  for (const id of ids) {
    if (on) all[id] = Date.now();
    else delete all[id];
  }
  // Mantém os 3000 mais recentes.
  const keys = Object.keys(all);
  if (keys.length > 3000) keys.sort((a, b) => all[a] - all[b]).slice(0, keys.length - 3000).forEach((k) => delete all[k]);
  prefSet('watched', all);
}

/** Próximo episódio a assistir (o card da série abre nele): o que está pela metade,
 * senão o seguinte ao último visto, senão o primeiro não visto. */
export function nextToWatch<E extends { id: string }>(eps: E[]): E | undefined {
  if (!eps.length) return undefined;
  let lastSeen = -1;
  eps.forEach((e, i) => {
    if (isWatched(e.id)) lastSeen = i;
  });
  let half = -1;
  let halfAt = 0;
  eps.forEach((e, i) => {
    const p = getProgress(e.id);
    if (p && p.at >= halfAt) {
      half = i;
      halfAt = p.at;
    }
  });
  if (half >= 0 && half >= lastSeen) return eps[half];
  if (lastSeen >= 0 && lastSeen + 1 < eps.length) return eps[lastSeen + 1];
  return eps.find((e) => !isWatched(e.id)) ?? eps[0];
}

/** Tirar de "Continuar assistindo" (o progresso some; a lista "vistos" não muda). */
export function removeFromContinue(ids: string[]): void {
  const all = prefGet<Record<string, Progress>>('progress', {});
  for (const id of ids) delete all[id];
  prefSet('progress', all);
  const set = new Set(ids);
  prefSet('vodRecents', vodRecents().filter((v) => !set.has(v.id) && !(v.seriesId && set.has(v.seriesId))));
}

// ---- Versões do mesmo título (Dublado, Legendado, 4K…) ----
const vKeyCache = new WeakMap<Channel, string>();
/** Número ou parte entre colchetes diferencia títulos: "Holed [01]", "Duna [Parte 2]", "Kill Bill [Vol. 2]". */
const PART_IN_BRACKETS = /\[\s*((?:parte|part|pt|vol|volume|cap[ií]tulo|cap|cena|scene|ep|epis[oó]dio|n[ºo°]?|#)?\.?\s*\d{1,3})\s*\]/gi;
export function versionKey(c: Channel): string {
  let k = vKeyCache.get(c);
  if (k === undefined) {
    const st = searchTitle((c.fullName ?? c.name).replace(PART_IN_BRACKETS, ' $1 '));
    k = `${c.kind}|${norm(st.title)}|${c.year ?? st.year ?? ''}`;
    vKeyCache.set(c, k);
  }
  return k;
}
/** Áudio pelo nome ou pela categoria: "[L]", "(Leg)", "Legendado", "DUB", "Dual", "Nacional"… */
const RE_DUAL = /\bdual\b|dual[\s-]?[aá]udio/i;
const RE_LEG = /\b(leg|legendad[oa]s?|legenda|sub|subtitled)\b|\[\s*l\s*\]|\(\s*l\s*\)|[\s|–-]l$/i;
const RE_DUB = /\b(dub|dublad[oa]s?|dublagem)\b|\[\s*d\s*\]|\(\s*d\s*\)|[\s|–-]d$/i;
const RE_NAC = /\bnacional\b/i;
function tagOf(s: string): 'leg' | 'dub' | 'dual' | 'nac' | undefined {
  return RE_DUAL.test(s) ? 'dual' : RE_LEG.test(s) ? 'leg' : RE_DUB.test(s) ? 'dub' : RE_NAC.test(s) ? 'nac' : undefined;
}
export function audioTag(c: Channel): 'leg' | 'dub' | 'dual' | 'nac' | undefined {
  return tagOf(c.fullName ?? c.name) ?? tagOf(c.group);
}
/**
 * Áudio que o app mostra (selo DUB/LEG/DUAL e filtro de áudio). Nacional conta como dublado.
 * Sem marca no nome nem na categoria, o filme ou a série conta como dublado: na Goldcard só os
 * legendados vêm marcados ("… Legendado", "Doramas Legendados", "[LEGENDADO]"). Ao vivo e a
 * categoria de adultos ficam sem selo quando a lista não diz nada.
 */
export function audioShown(c: Channel): 'leg' | 'dub' | 'dual' | undefined {
  const a = audioTag(c);
  if (a === 'nac') return 'dub';
  if (a) return a;
  return c.kind !== 'live' && !isAdultName(c.group) ? 'dub' : undefined;
}
export function versionLabel(c: Channel): string {
  const s = `${c.fullName ?? c.name} ${c.group}`;
  const parts: string[] = [];
  if (/\b(4k|uhd|2160p?)\b/i.test(s)) parts.push('4K');
  const a = audioTag(c);
  if (a) parts.push(a === 'leg' ? 'Legendado' : a === 'dual' ? 'Dual áudio' : 'Dublado');
  if (!parts.length) parts.push(/\b(fhd|1080p?)\b/i.test(s) ? 'Full HD' : /\bsd\b/i.test(s) ? 'SD' : 'HD');
  return parts.join(' · ');
}
/** Rótulos das versões; se dois ficarem iguais, acrescenta a categoria de cada uma. */
export function versionLabels(vers: Channel[]): string[] {
  const base = vers.map(versionLabel);
  return base.map((l, i) => (base.filter((x) => x === l).length > 1 ? `${l} · ${vers[i].group.replace(/^(filmes|séries|series)\s*[|:-]\s*/i, '')}` : l));
}

const vIndex = new WeakMap<Channel[], Map<string, Channel[]>>();
/** Todas as versões do título (inclui ele mesmo), na ordem da lista. */
export function versionsOf(item: Channel, all: Channel[]): Channel[] {
  if (item.kind === 'live') return [item];
  let m = vIndex.get(all);
  if (!m) {
    m = new Map();
    for (const c of all) {
      if (c.kind === 'live') continue;
      const k = versionKey(c);
      const l = m.get(k);
      if (l) l.push(c);
      else m.set(k, [c]);
    }
    vIndex.set(all, m);
  }
  return m.get(versionKey(item)) ?? [item];
}
/** Numa grade/fileira: uma capa por título (a primeira versão). */
export function collapseVersions(items: Channel[]): Channel[] {
  const seen = new Set<string>();
  const out: Channel[] = [];
  for (const c of items) {
    if (c.kind === 'live') {
      out.push(c);
      continue;
    }
    const k = versionKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

// ---- Capa genérica da lista (0.31.0) ----
// Muitas listas usam a mesma imagem para vários títulos (ex.: todos os filmes de
// adulto com o mesmo "XXX"). Essas capas são trocadas pela oficial quando acha.

const logoCount = new Map<string, number>();
const GENERIC = /no[_-]?(image|poster|cover)|placeholder|default[_-]?(poster|cover)?\.|\/(xxx|adult[os]*|18)\.(png|jpe?g|webp)$/i;

/** Conta quantos títulos usam cada capa (chamado quando a lista carrega). */
export function indexLogos(items: Channel[]): void {
  logoCount.clear();
  for (const i of items) if (i.kind !== 'live' && i.logo) logoCount.set(i.logo, (logoCount.get(i.logo) ?? 0) + 1);
}

/** Sem capa, capa com cara de "sem imagem" ou a mesma imagem em 3+ títulos. */
export function isGenericLogo(url?: string): boolean {
  if (!url) return true;
  return GENERIC.test(url) || (logoCount.get(url) ?? 0) >= 3;
}
