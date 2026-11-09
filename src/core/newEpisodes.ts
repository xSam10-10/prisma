// Séries com episódio novo (saiu nos últimos 7 dias, pelo TMDB) e lembretes "Me avise".
import { prefGet, prefSet } from './storage';

const subs = new Set<() => void>();
let fresh = new Map<string, { s: number; e: number; date: string }>();

/** Ids (seriesId) das séries que têm episódio novo — marcado no Início. */
export function setNewEpisodes(m: Map<string, { s: number; e: number; date: string }>): void {
  fresh = m;
  subs.forEach((f) => f());
}
export function newEpisodeOf(seriesId?: string): { s: number; e: number; date: string } | undefined {
  return seriesId ? fresh.get(seriesId) : undefined;
}
export function onNewEpisodes(f: () => void): () => void {
  subs.add(f);
  return () => subs.delete(f);
}

export interface EpAlert { id: string; name: string; date: string; s: number; e: number }
/** Lembretes de próximo episódio ("Me avise"). Por perfil. */
export function epAlerts(): EpAlert[] {
  return prefGet<EpAlert[]>('epAlerts', []);
}
export function hasEpAlert(id: string): boolean {
  return epAlerts().some((a) => a.id === id);
}
export function toggleEpAlert(a: EpAlert): boolean {
  const all = epAlerts();
  const on = !all.some((x) => x.id === a.id);
  prefSet('epAlerts', on ? [...all.filter((x) => x.id !== a.id), a].slice(-50) : all.filter((x) => x.id !== a.id));
  return on;
}
/** Lembretes vencidos (o episódio já saiu): devolve e remove. */
export function takeDueAlerts(today: string): EpAlert[] {
  const all = epAlerts();
  const due = all.filter((a) => a.date <= today);
  if (due.length) prefSet('epAlerts', all.filter((a) => a.date > today));
  return due;
}
