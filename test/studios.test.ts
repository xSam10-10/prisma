import { describe, expect, it } from 'vitest';
import { buildStudios, studioInTitle, studioKey, studiosToVerify } from '../src/core/studios';
import type { Channel } from '../src/core/types';

const mk = (id: string, name: string): Channel => ({ id, name, group: 'ADULTOS +18', kind: 'movie', url: '' } as Channel);

describe('produtoras da categoria de adultos (0.34.0)', () => {
  it('acha a produtora nos formatos comuns de nome', () => {
    expect(studioInTitle('Vixen - Ana Exemplo - Hotel Nove')).toEqual({ name: 'Vixen', strong: true });
    expect(studioInTitle('[Tiny4K] Dia Dez')).toEqual({ name: 'Tiny4K', strong: true });
    expect(studioInTitle('[4K] Dia Dez')).toBeNull();
    expect(studioInTitle('Blacked.24.03.15.Bia.Modelo.Onze')).toEqual({ name: 'Blacked', strong: true });
    expect(studioInTitle('Vixen Carla Teste Doze')).toEqual({ name: 'Vixen', strong: true });
    expect(studioInTitle('BRAZZERS - Hot Night - Cena')).toEqual({ name: 'Brazzers', strong: true });
    expect(studioInTitle('Ana Exemplo - Noite')).toEqual({ name: 'Ana Exemplo', strong: false });
    expect(studioInTitle('Titulo Sem Capa Tres')).toBeNull();
  });
  it('"Tiny 4K" e "Tiny4K" são a mesma', () => {
    expect(studioKey('Tiny 4K')).toBe(studioKey('Tiny4K'));
  });
  it('sem token: conhecidas na hora; as outras com 2+ títulos; atriz nunca vira produtora', () => {
    const items = [mk('1', '[Tiny4K] Dia Dez'), mk('2', 'Outro Estudio - Bia Modelo - Seis'), mk('3', 'Outro Estudio - Carla Teste - Sete'), mk('4', 'Raro Estudio - X Y - Oito'), mk('5', 'Ana Exemplo - Nove'), mk('6', 'Ana Exemplo - Dez')];
    const l = buildStudios(items, new Map(), new Map(), false, new Set(['ana exemplo']));
    expect(l.map((s) => [s.name, s.ids.size])).toEqual([['Outro Estudio', 2], ['Tiny4K', 1]]);
  });
  it('com token: vale o nome e o logotipo da ThePornDB; o que ela não conhece sai', () => {
    const items = [mk('1', '[Tiny4K] Dia Dez'), mk('2', 'Outro Estudio - Bia Modelo - Seis'), mk('3', 'Outro Estudio - Carla Teste - Sete'), mk('4', 'Cena Solta')];
    const verified = new Map([[studioKey('Tiny4K'), { name: 'Tiny 4K', logo: 't.png' }], [studioKey('Outro Estudio'), null]]);
    const site = new Map([['4', { name: 'Vixen', logo: 'v.png' }]]);
    const l = buildStudios(items, site, verified, true);
    expect(l.map((s) => [s.name, s.logo, [...s.ids]])).toEqual([['Tiny 4K', 't.png', ['1']], ['Vixen', 'v.png', ['4']]]);
    expect(studiosToVerify(items, verified)).toEqual([]);
  });
});
