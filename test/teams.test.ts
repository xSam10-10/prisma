import { describe, expect, it } from 'vitest';
import { teamsOf } from '../src/core/games';
import { isMyTeam } from '../src/core/scores';

describe('Meus times', () => {
  it('separa os dois times do título do guia', () => {
    expect(teamsOf('Brasileirão: Flamengo x Palmeiras')).toEqual(['Flamengo', 'Palmeiras']);
    expect(teamsOf('Libertadores | River Plate vs. Grêmio')).toEqual(['River Plate', 'Grêmio']);
    expect(teamsOf('Jornal Nacional')).toEqual([]);
  });
  it('reconhece o time com nomes diferentes', () => {
    expect(isMyTeam('CR Flamengo', ['Flamengo'])).toBe(true);
    expect(isMyTeam('Atlético Mineiro', ['Atletico-MG'])).toBe(true);
    expect(isMyTeam('Palmeiras', ['Flamengo'])).toBe(false);
  });
});
