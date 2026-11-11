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

import { buildActresses, castByItem } from '../src/core/actresses';
describe('capa com a atriz do filtro (0.34.1)', () => {
  it('a atriz achada em qualquer lugar do título vira a capa, na ordem do título', () => {
    const items = [mk('1', 'Kissa Sins Gets Lucky With Ana Exemplo'), mk('2', 'Estudio - Kissa Sins - Dois'), mk('3', 'Estudio - Ana Exemplo - Tres')];
    const ver = new Map([['kissa sins', { name: 'Kissa Sins', photo: 'k.jpg', portrait: 'kp.jpg' }], ['ana exemplo', { name: 'Ana Exemplo', photo: 'a.jpg', portrait: 'ap.jpg' }]]);
    const list = buildActresses(items, new Map(), ver, true);
    expect(castByItem(items, list).get('1')!.map((a) => a.portrait)).toEqual(['kp.jpg', 'ap.jpg']);
  });
});

import { leadNames, namesInTitle, namesToVerify } from '../src/core/actresses';
import { toStudio } from '../src/core/tpdb';
describe('mais atrizes e produtoras limpas (0.34.2)', () => {
  it('título em maiúsculas também dá nome de atriz', () => {
    expect(namesInTitle('BRAZZERS - KISSA SINS - HOT DAY')).toEqual(['Kissa Sins']);
  });
  it('nome colado no título: só entra se a ThePornDB confirmar', () => {
    expect(leadNames('Kissa Sins Gets Lucky Today')).toEqual(['Kissa Sins']);
    const items = [mk('1', 'Kissa Sins Gets Lucky'), mk('2', 'Kissa Sins Takes It All'), mk('3', 'Outra Coisa Qualquer Aqui')];
    expect(namesToVerify(items, new Map(), new Map())).toEqual(['Kissa Sins']);
    const ver = new Map([['kissa sins', { name: 'Kissa Sins', photo: 'k.jpg', portrait: 'kp.jpg' }]]);
    const l = buildActresses(items, new Map(), ver, true);
    expect(l.map((a) => [a.name, a.ids.size])).toEqual([['Kissa Sins', 2]]);
  });
  it('"FansDB: Fulana" não é produtora', () => {
    expect(toStudio({ name: 'FansDB: Angela White' })).toBeUndefined();
    expect(toStudio({ name: 'Brasileirinhas', logo: 'b.png' })).toEqual({ name: 'Brasileirinhas', logo: 'b.png' });
  });
});
