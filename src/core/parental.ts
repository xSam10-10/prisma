// Bloquear canal (cadeado da barra do canal): o canal só abre com a senha
// de 4 números. A senha vale para o aparelho; os canais bloqueados são de
// cada perfil. Desbloqueado uma vez, o canal fica liberado até fechar o app.
// No horário livre (padrão 22:00–06:00) nada pede a senha.

import { prefGet, prefRead, prefSet } from './storage';
import type { Channel, Playlist } from './types';

const unlocked = new Set<string>();

export function hasPin(): boolean {
  return !!prefGet<string>('pin', '');
}
export function setPin(pin: string): void {
  prefSet('pin', pin);
}
export function checkPin(pin: string): boolean {
  return !!pin && pin === prefGet<string>('pin', '');
}

export function lockedIds(): string[] {
  return prefGet<string[]>('locked', []);
}
export function isLocked(id: string): boolean {
  return prefRead<string[]>('locked', []).includes(id) && !unlocked.has(id) && !inFreeHours();
}
export function isLockMarked(id: string): boolean {
  return prefRead<string[]>('locked', []).includes(id);
}
export function setLocked(id: string, on: boolean): void {
  const cur = lockedIds().filter((x) => x !== id);
  prefSet('locked', on ? [...cur, id] : cur);
  if (on) unlocked.delete(id);
}
export function unlockForSession(id: string): void {
  unlocked.add(id);
}

// ---------------------------------------------------------------- Categorias protegidas e itens escondidos
// Categoria protegida: some do app (Ao vivo, Filmes, Séries, Início, busca) até digitar a senha;
// liberada, fica aberta até fechar o app. As de adulto (+18, XXX, Adultos…) vêm protegidas
// assim que existe uma senha. Esconder: some de vez (volta em Ajustes › Proteção).
// Chave das categorias: "tipo|nome" (ex.: "live|ADULTOS +18").


const ADULT = /(adult|\+ ?18|18 ?\+|xxx|er[oó]tic|hot ?club|playboy|sexy|porn|for ?adults|\bhot\b)/i;
export const catKey = (kind: string, group: string): string => `${kind}|${group}`;
export function isAdultName(n: string): boolean {
  return ADULT.test(n);
}

const subs = new Set<() => void>();
let ver = 0;
const bumpVer = () => {
  ver++;
  subs.forEach((f) => f());
};
export function onParental(f: () => void): () => void {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}
export function parentalVersion(): number {
  return ver;
}

let catsOpen = false;

// ---------------------------------------------------------------- Horário livre (0.32.0)
// Antes do horário (padrão 22:00) a senha vale; das 22:00 até o fim (padrão 06:00) as categorias
// protegidas e os canais bloqueados abrem sem senha. Mudar o horário sempre pede a senha.
export interface FreeHours {
  on: boolean;
  /** Hora em que libera (0–23). */
  from: number;
  /** Hora em que volta a pedir a senha (0–23; 0 = meia-noite). */
  to: number;
}
export function freeHours(): FreeHours {
  return { on: true, from: 22, to: 6, ...prefGet<Partial<FreeHours>>('freeHours', {}) };
}
export function setFreeHours(f: FreeHours): void {
  prefSet('freeHours', f);
  lastFree = inFreeHours();
  bumpVer();
}
/** Agora está no horário livre? */
export function inFreeHours(d: Date = new Date()): boolean {
  const f = freeHours();
  if (!f.on || f.from === f.to) return false;
  const h = d.getHours();
  return f.from < f.to ? h >= f.from && h < f.to : h >= f.from || h < f.to;
}
const hh = (h: number) => (h === 0 ? '00:00' : (h < 10 ? '0' : '') + h + ':00');
export function hourLabel(h: number): string {
  return hh(h);
}
// Vira o horário com o app aberto: mostra (ou esconde de novo) as categorias sozinho.
let lastFree = inFreeHours();
if (typeof window !== 'undefined')
  window.setInterval(() => {
    const now = inFreeHours();
    if (now !== lastFree) {
      lastFree = now;
      bumpVer();
    }
  }, 30000);
/** As categorias protegidas estão abertas agora (senha digitada ou horário livre)? */
function openNow(): boolean {
  return catsOpen || inFreeHours();
}
/** Lista salva de categorias protegidas (null = ainda não mexeu: usa as de adulto). */
function savedLocked(): string[] | null {
  return prefGet<string[] | null>('lockedCats', null);
}
export function lockedCats(items: Channel[]): string[] {
  const s = savedLocked();
  if (s) return s;
  const out = new Set<string>();
  for (const i of items) if (isAdultName(i.group)) out.add(catKey(i.kind, i.group));
  return [...out];
}
export function setCatLocked(items: Channel[], key: string, on: boolean): void {
  const cur = lockedCats(items).filter((k) => k !== key);
  prefSet('lockedCats', on ? [...cur, key] : cur);
  bumpVer();
}
/** Há categorias protegidas fechadas agora? */
export function unlockCats(): void {
  catsOpen = true;
  bumpVer();
}
export function relockCats(): void {
  catsOpen = false;
  bumpVer();
}
export function catsUnlocked(): boolean {
  return catsOpen;
}
export function pinChanged(): void {
  bumpVer();
}

export function hiddenCats(): string[] {
  return prefGet<string[]>('hiddenCats', []);
}
export function setCatHidden(key: string, on: boolean): void {
  const cur = hiddenCats().filter((k) => k !== key);
  prefSet('hiddenCats', on ? [...cur, key] : cur);
  bumpVer();
}
export function hiddenChannels(): { id: string; name: string }[] {
  return prefGet<{ id: string; name: string }[]>('hiddenCh', []);
}
export function setChannelHidden(ch: { id: string; name: string }, on: boolean): void {
  const cur = hiddenChannels().filter((c) => c.id !== ch.id);
  prefSet('hiddenCh', on ? [...cur, { id: ch.id, name: ch.name }] : cur);
  bumpVer();
}

let closedCount = 0;
/** Quantas categorias protegidas estão fechadas (escondidas) agora. */
export function closedCats(): number {
  return closedCount;
}

/** A lista como o app deve mostrar: sem escondidos e sem categorias protegidas fechadas. */
export function applyParental(pl: Playlist): Playlist {
  const hc = new Set(hiddenCats());
  const hi = new Set(hiddenChannels().map((c) => c.id));
  const lc = new Set(hasPin() && !openNow() ? lockedCats(pl.items) : []);
  closedCount = lc.size;
  if (!hc.size && !hi.size && !lc.size) return pl;
  const items = pl.items.filter((i) => {
    if (hi.has(i.id)) return false;
    const k = catKey(i.kind, i.group);
    return !hc.has(k) && !lc.has(k);
  });
  return { ...pl, items };
}
