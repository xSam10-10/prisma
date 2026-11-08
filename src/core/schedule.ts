// Programação de um canal por dia (painel da seta → na lista de canais).
// Junta as duas fontes que a lista pode oferecer:
//  1. Guia completo XMLTV (M3U url-tvg ou Xtream xmltv.php), já baixado no app;
//  2. Xtream get_simple_data_table: a programação do próprio canal no servidor,
//     com a marca de "tem gravação". É pedida só ao abrir o painel.
// Quantos dias aparecem depende do que o servidor manda (ver guideCoverage).

import type { Channel, EpgEntry, Playlist } from './types';
import { loadXmltv, programmesOf, xmltvCoverage } from './xmltv';
import { fullEpg } from './xtream';

const DAY = 86400000;
const TTL = 30 * 60000;
const cache = new Map<string, { at: number; list: EpgEntry[] }>();

export function dayStart(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function merge(a: EpgEntry[], b: EpgEntry[]): EpgEntry[] {
  if (!a.length) return b;
  if (!b.length) return a;
  const byStart = new Map<number, EpgEntry>();
  for (const e of a) byStart.set(Math.round(e.start / 60000), e);
  // A do servidor do canal ganha (traz a marca de gravação).
  for (const e of b) byStart.set(Math.round(e.start / 60000), { ...byStart.get(Math.round(e.start / 60000)), ...e });
  const out = [...byStart.values()].sort((x, y) => x.start - y.start);
  // Remove sobreposições (fontes com horários um pouco diferentes).
  return out.filter((e, i) => i === 0 || e.start >= out[i - 1].end - 60000 || e.archive);
}

/** Programação do canal (todas as datas que as fontes tiverem). */
export async function channelSchedule(pl: Playlist, ch: Channel): Promise<EpgEntry[]> {
  const hit = cache.get(ch.id);
  if (hit && Date.now() - hit.at < TTL) return hit.list;
  await loadXmltv(pl).catch(() => null);
  const fromGuide = programmesOf(ch);
  let fromServer: EpgEntry[] = [];
  if (pl.source.type === 'xtream') {
    try {
      fromServer = await fullEpg(pl.source, ch.id);
    } catch {
      /* servidor sem essa função ou fora do ar: fica só o XMLTV */
    }
  }
  const list = merge(fromGuide, fromServer);
  cache.set(ch.id, { at: Date.now(), list });
  return list;
}

export function programmesOn(list: EpgEntry[], day: number): EpgEntry[] {
  const end = day + DAY;
  return list.filter((e) => e.end > day && e.start < end);
}

/** Dias mostrados na coluna: pelo menos 3 para trás e 3 para frente (como o app de referência), mais se houver dados ou gravação. */
export function scheduleDays(list: EpgEntry[], ch: Channel, now = Date.now()): number[] {
  const today = dayStart(now);
  const first = list.length ? dayStart(list[0].start) : today;
  const last = list.length ? dayStart(list[list.length - 1].start) : today;
  const back = Math.min(7, Math.max(3, Math.round((today - first) / DAY), ch.catchupDays ?? 0));
  const ahead = Math.min(7, Math.max(3, Math.round((last - today) / DAY)));
  const out: number[] = [];
  for (let i = -back; i <= ahead; i++) out.push(dayStart(today + i * DAY + 3 * 3600000)); // +3h: atravessa horário de verão
  return out;
}

/** Resumo do que a lista entrega de guia (Ajustes › Lista). */
export function guideCoverage(): ReturnType<typeof xmltvCoverage> {
  return xmltvCoverage();
}

export function clearScheduleCache(): void {
  cache.clear();
}
