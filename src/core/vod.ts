import { prefGet, prefSet } from './storage';
import type { Channel } from './types';

// Filmes, séries e anime: streamings, progresso, Minha lista e "continuar".

export interface Streaming {
  id: string;
  name: string;
  match: RegExp;
  bg: string;
  accent: string;
  accent2: string;
}

/** Streamings reconhecidos pelos nomes das categorias da lista (cores = arte do protótipo v2). */
export const STREAMINGS: Streaming[] = [
  { id: 'netflix', name: 'Netflix', match: /netflix/i, bg: '#141414', accent: '#E50914', accent2: '#7A0A0F' },
  { id: 'hbo', name: 'HBO Max', match: /\bhbo\b|\bmax\b/i, bg: '#0A0A2E', accent: '#3D2BFF', accent2: '#A020F0' },
  { id: 'disney', name: 'Disney+', match: /disney/i, bg: '#0B1A3D', accent: '#1F80E0', accent2: '#00D4FF' },
  { id: 'prime', name: 'Prime Video', match: /prime|amazon/i, bg: '#0F171E', accent: '#00A8E1', accent2: '#1A4D8F' },
  { id: 'apple', name: 'Apple TV', match: /apple/i, bg: '#000000', accent: '#8E8E93', accent2: '#3A3A3C' },
  { id: 'globoplay', name: 'Globoplay', match: /globoplay/i, bg: '#1E0A12', accent: '#FB2E5A', accent2: '#FF7A00' },
  { id: 'paramount', name: 'Paramount+', match: /paramount/i, bg: '#00112E', accent: '#0064FF', accent2: '#00B3FF' },
  { id: 'star', name: 'Star+', match: /star\s?\+|star plus/i, bg: '#1A0B2E', accent: '#C724B1', accent2: '#FF6C00' },
  { id: 'hulu', name: 'Hulu', match: /hulu/i, bg: '#0B0C0F', accent: '#1CE783', accent2: '#0B8F52' },
  { id: 'crunchyroll', name: 'Crunchyroll', match: /crunchy/i, bg: '#1A1206', accent: '#F47521', accent2: '#FFB000' },
  { id: 'discovery', name: 'Discovery+', match: /discovery/i, bg: '#00101F', accent: '#2175FF', accent2: '#00C2FF' },
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
  // Terminou (95%) ou mal começou (< 20 s): não guarda.
  if (dur > 0 && pos / dur > 0.95) delete all[id];
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
