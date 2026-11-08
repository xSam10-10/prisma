import { describe, expect, it } from 'vitest';
import { dayStart, programmesOn, scheduleDays } from '../src/core/schedule';
import type { Channel, EpgEntry } from '../src/core/types';

const H = 3600000;
const D = 86400000;
const now = new Date(2026, 10, 8, 14, 30).getTime();
const ch = { id: 'l1', name: 'Canal', kind: 'live', url: 'x', group: 'g' } as Channel;
const mk = (fromDay: number, toDay: number): EpgEntry[] => {
  const out: EpgEntry[] = [];
  for (let t = dayStart(now) + fromDay * D; t < dayStart(now) + (toDay + 1) * D; t += 2 * H) out.push({ title: 'P', start: t, end: t + 2 * H });
  return out;
};

describe('programação por dia', () => {
  it('mostra pelo menos 3 dias para trás e 3 à frente, mesmo sem dados', () => {
    const days = scheduleDays([], ch, now);
    expect(days.length).toBe(7);
    expect(days[3]).toBe(dayStart(now));
  });
  it('estende até onde a lista tem dados (no máximo 7 de cada lado)', () => {
    const days = scheduleDays(mk(-5, 10), ch, now);
    expect(days[0]).toBe(dayStart(now - 5 * D));
    expect(days[days.length - 1]).toBe(dayStart(now + 7 * D));
  });
  it('usa os dias de gravação do canal para trás', () => {
    const days = scheduleDays([], { ...ch, catchupDays: 6 }, now);
    expect(days[0]).toBe(dayStart(now - 6 * D));
  });
  it('separa os programas por dia (inclui o que atravessa a meia-noite)', () => {
    const list = [
      { title: 'Corujão', start: dayStart(now) - H, end: dayStart(now) + H },
      { title: 'Manhã', start: dayStart(now) + 8 * H, end: dayStart(now) + 9 * H },
      { title: 'Amanhã', start: dayStart(now) + D + H, end: dayStart(now) + D + 2 * H },
    ];
    expect(programmesOn(list, dayStart(now)).map((e) => e.title)).toEqual(['Corujão', 'Manhã']);
  });
});
