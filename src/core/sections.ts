import { createContext, useContext } from 'react';
import type { Category, Channel } from './types';

// Seções (agrupadores) da tela Ao vivo.
//  · nativas: as categorias que vieram na lista (id = nome da categoria);
//  · criadas: as do usuário (id "c:<número>");
//  · qualquer canal pode ser acrescentado a qualquer seção (nativa ou criada);
//  · ordem: por prioridade (1, 2, 3… definida pelo usuário) ou alfabética.
// "Favoritos" e "Todos" ficam sempre no topo.

export interface CustomSection {
  id: string;
  name: string;
}

export interface SectionsData {
  custom: CustomSection[];
  /** Canais acrescentados pelo usuário a cada seção (id da seção → ids dos canais). */
  members: Record<string, string[]>;
  /** Ordem de prioridade (ids das seções). Seções novas da lista entram no fim. */
  order: string[];
  sort: 'priority' | 'alpha';
}

export const EMPTY_SECTIONS: SectionsData = { custom: [], members: {}, order: [], sort: 'priority' };

export interface SectionView {
  id: string;
  name: string;
  count: number;
  custom: boolean;
  /** Número de prioridade (1, 2, 3…). */
  priority: number;
}

/** Seções na ordem escolhida, com contagem e número de prioridade. */
export function orderedSections(native: Category[], data: SectionsData, live: Channel[]): SectionView[] {
  const liveIds = new Set(live.map((c) => c.id));
  const extra = (id: string) => (data.members[id] ?? []).filter((x) => liveIds.has(x));
  const all: Omit<SectionView, 'priority'>[] = [
    ...native.map((c) => ({ id: c.id, name: c.name, count: c.count + extra(c.id).filter((x) => !live.some((l) => l.id === x && l.group === c.id)).length, custom: false })),
    ...data.custom.map((c) => ({ id: c.id, name: c.name, count: extra(c.id).length, custom: true })),
  ];
  // Prioridade: a ordem salva; o que não estiver nela vem depois, na ordem da lista.
  const pos = new Map(data.order.map((id, i) => [id, i]));
  const byPriority = [...all].sort((a, b) => (pos.get(a.id) ?? 1e6 + all.indexOf(a)) - (pos.get(b.id) ?? 1e6 + all.indexOf(b)));
  const withNum = byPriority.map((s, i) => ({ ...s, priority: i + 1 }));
  if (data.sort === 'alpha') return [...withNum].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
  return withNum;
}

/** Canais de uma seção: os da categoria (se nativa) + os acrescentados, sem repetir. */
export function sectionChannels(id: string, live: Channel[], data: SectionsData): Channel[] {
  const extraIds = data.members[id] ?? [];
  const byId = new Map(live.map((c) => [c.id, c]));
  const base = live.filter((c) => c.group === id);
  const seen = new Set(base.map((c) => c.id));
  const extra = extraIds.map((x) => byId.get(x)).filter((c): c is Channel => !!c && !seen.has(c.id));
  return [...base, ...extra];
}

export function isMember(id: string, ch: Channel, data: SectionsData): boolean {
  return ch.group === id || (data.members[id] ?? []).includes(ch.id);
}

// ---- Operações (devolvem um novo SectionsData) ----

export function createSection(data: SectionsData, name: string): [SectionsData, string] {
  const id = 'c:' + Date.now().toString(36);
  return [{ ...data, custom: [...data.custom, { id, name: name.trim() }] }, id];
}

export function renameSection(data: SectionsData, id: string, name: string): SectionsData {
  return { ...data, custom: data.custom.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)) };
}

export function deleteSection(data: SectionsData, id: string): SectionsData {
  const members = { ...data.members };
  delete members[id];
  return { ...data, custom: data.custom.filter((c) => c.id !== id), members, order: data.order.filter((x) => x !== id) };
}

export function toggleMember(data: SectionsData, id: string, ch: Channel): SectionsData {
  const cur = data.members[id] ?? [];
  const next = cur.includes(ch.id) ? cur.filter((x) => x !== ch.id) : [...cur, ch.id];
  return { ...data, members: { ...data.members, [id]: next } };
}

/** Move a seção para a posição de prioridade `to` (1 = primeira). Renumera 1, 2, 3… */
export function moveSection(data: SectionsData, views: SectionView[], id: string, to: number): SectionsData {
  const ids = [...views].sort((a, b) => a.priority - b.priority).map((v) => v.id);
  const from = ids.indexOf(id);
  if (from < 0) return data;
  ids.splice(from, 1);
  ids.splice(Math.max(0, Math.min(ids.length, to - 1)), 0, id);
  return { ...data, order: ids };
}

export interface SectionsApi {
  data: SectionsData;
  set: (fn: (d: SectionsData) => SectionsData) => void;
}

export const SectionsContext = createContext<SectionsApi>({ data: EMPTY_SECTIONS, set: () => {} });

export function useSections(): SectionsApi {
  return useContext(SectionsContext);
}
