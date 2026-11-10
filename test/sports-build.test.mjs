import { describe, expect, it } from 'vitest';
import { assignRounds, notePt } from '../scripts/sports/build-sports.mjs';

/** Turno e returno com o "método do círculo": 2 × (n − 1) rodadas, uma por semana. */
function roundRobin(n, start = 1_700_000_000) {
  const ev = [];
  const real = [];
  const ids = Array.from({ length: n }, (_, i) => i);
  for (let r = 0; r < 2 * (n - 1); r++) {
    const rot = [ids[0], ...ids.slice(1).map((_, k) => ids[1 + ((k + r) % (n - 1))])];
    for (let k = 0; k < n / 2; k++) {
      ev.push({ t: start + r * 7 * 86400 + k * 3600, h: rot[k], a: rot[n - 1 - k] });
      real.push(r + 1);
    }
  }
  return { ev, real };
}

describe('gerador do centro de esportes', () => {
  it('numera as rodadas de uma liga em turno e returno', () => {
    const { ev, real } = roundRobin(10);
    expect(assignRounds(ev, 10)).toBe(18);
    expect(ev.map((e) => e.r)).toEqual(real);
  });

  it('jogo adiado volta para a rodada em que os dois times ficaram sem jogar', () => {
    const { ev, real } = roundRobin(10);
    // Um jogo da rodada 3 é disputado no meio da semana entre as rodadas 6 e 7.
    const i = ev.findIndex((_, k) => real[k] === 3);
    ev[i].t = 1_700_000_000 + 5 * 7 * 86400 + 3.5 * 86400;
    assignRounds(ev, 10);
    expect(ev[i].r).toBe(3);
    expect(ev.filter((e) => e.r === 3)).toHaveLength(5);
    expect(ev.filter((e) => e.r === 6)).toHaveLength(5);
  });

  it('rodada dividida por uma pausa continua sendo uma rodada só', () => {
    const { ev, real } = roundRobin(10);
    // Rodada 4: 2 jogos antes, 3 jogos duas semanas depois (pausa), e as rodadas seguintes empurradas.
    let inRound4 = 0;
    ev.forEach((e, k) => {
      if (real[k] > 4) e.t += 14 * 86400;
      else if (real[k] === 4 && inRound4++ >= 2) e.t += 10 * 86400;
    });
    expect(assignRounds(ev, 10)).toBe(18);
    expect(ev.filter((e) => e.r === 4)).toHaveLength(5);
  });

  it('traduz as notas da ESPN', () => {
    expect(notePt('2nd Leg - Tied on aggregate - PAL win 5-4 on penalties')).toBe('Volta · empate no agregado · PAL vence por 5-4 nos pênaltis');
    expect(notePt('2nd Leg - Atlético-MG win 3-2 on aggregate')).toBe('Volta · Atlético-MG vence por 3-2 no agregado');
  });
});


describe('Fórmula 1 no gerador', () => {
  it('compacta calendário, sessões, vencedores, classificações e último GP', async () => {
    const { f1Compact } = await import('../scripts/sports/build-sports.mjs');
    const cal = { MRData: { RaceTable: { season: '2026', Races: [
      { round: '1', raceName: 'Australian Grand Prix', Circuit: { circuitName: 'Albert Park', Location: { locality: 'Melbourne', country: 'Australia' } }, date: '2026-03-08', time: '04:00:00Z', FirstPractice: { date: '2026-03-06', time: '01:30:00Z' }, Qualifying: { date: '2026-03-07', time: '05:00:00Z' } },
      { round: '2', raceName: 'Chinese Grand Prix', Circuit: { circuitName: 'Shanghai', Location: { locality: 'Shanghai', country: 'China' } }, date: '2026-03-15', time: '07:00:00Z', Sprint: { date: '2026-03-14', time: '03:00:00Z' } },
    ] } } };
    const drivers = { MRData: { StandingsTable: { StandingsLists: [{ round: '1', DriverStandings: [{ position: '1', points: '25', wins: '1', Driver: { code: 'RUS', givenName: 'George', familyName: 'Russell', permanentNumber: '63' }, Constructors: [{ name: 'Mercedes', constructorId: 'mercedes' }] }] }] } } };
    const teams = { MRData: { StandingsTable: { StandingsLists: [{ ConstructorStandings: [{ position: '1', points: '43', wins: '1', Constructor: { name: 'Mercedes', constructorId: 'mercedes' } }] }] } } };
    const winners = { MRData: { RaceTable: { Races: [{ round: '1', Results: [{ Driver: { code: 'RUS', givenName: 'George', familyName: 'Russell' }, Constructor: { constructorId: 'mercedes' } }] }] } } };
    const f = f1Compact(cal, drivers, teams, winners, null);
    expect(f.season).toBe('2026');
    expect(f.races[0][5].map((s) => s[0])).toEqual(['TL1', 'CLA', 'GP']);
    expect(f.races[0][6]).toEqual(['RUS', 'George Russell', 'mercedes']);
    expect(f.races[1][5].map((s) => s[0])).toEqual(['SPR', 'GP']);
    expect(f.races[1][6]).toBe(null);
    expect(f.drivers[0]).toEqual([1, 'RUS', 'George', 'Russell', '63', 'Mercedes', 'mercedes', 25, 1]);
    expect(f.teams[0]).toEqual([1, 'Mercedes', 'mercedes', 43, 1]);
    expect(f.last).toBe(null);
  });
});
