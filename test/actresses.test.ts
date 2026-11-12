import { beforeEach, describe, expect, it } from 'vitest';

// Armazenamento de mentira (os testes rodam fora do navegador).
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
};
import { actressKey, buildActresses, namesInTitle, namesToVerify } from '../src/core/actresses';
import { freeHours, inFreeHours, setFreeHours } from '../src/core/parental';
import { performersOfItem } from '../src/core/tpdb';
import type { Channel } from '../src/core/types';

const mk = (id: string, name: string): Channel => ({ id, name, group: 'ADULTOS +18', kind: 'movie', url: '' } as Channel);

describe('atrizes da categoria de adultos', () => {
  it('tira nomes de pessoa do título (sem o estúdio)', () => {
    expect(namesInTitle('Estudio Teste - Ana Exemplo & Bia Modelo - Tarde Cinco')).toEqual(['Ana Exemplo', 'Bia Modelo', 'Tarde Cinco']);
    expect(namesInTitle('Brazzers - Abella Danger - Hot Night [4K]')).toEqual(['Abella Danger']);
    expect(namesInTitle('Titulo Sem Capa Tres')).toEqual([]);
  });
  it('a ThePornDB deixa só as atrizes (homem fica de fora) e traz a foto', () => {
    const p = performersOfItem({ performers: [{ name: 'Ana Exemplo', face: 'f.jpg', parent: { extras: { gender: 'Female' } } }, { name: 'Joao Ator', parent: { extras: { gender: 'Male' } } }] });
    expect(p).toEqual([{ name: 'Ana Exemplo', photo: 'f.jpg', portrait: 'f.jpg', female: true }]);
  });
  it('sem token: entra o nome que aparece em 2+ títulos', () => {
    const items = [mk('1', 'Estudio Teste - Ana Exemplo - Noite Quatro'), mk('2', 'Estudio Teste - Ana Exemplo & Bia Modelo - Tarde Cinco'), mk('3', 'Outro Estudio - Bia Modelo - Manha Seis'), mk('4', 'Outro - Carla Teste - Sete'), mk('5', 'Estudio Teste - Cena Adulta Dois'), mk('6', 'Estudio Teste - Filme Adulto Um')];
    const l = buildActresses(items, new Map(), new Map(), false);
    expect(l.map((a) => [a.name, a.ids.size])).toEqual([['Ana Exemplo', 2], ['Bia Modelo', 2]]);
  });
  it('com token: só nome confirmado; a atriz da cena vale para os outros títulos com o nome dela', () => {
    const items = [mk('1', 'Estudio Teste - Ana Exemplo - Noite Quatro'), mk('2', 'Estudio Teste - Ana Exemplo & Bia Modelo - Tarde Cinco'), mk('3', 'Outro Estudio - Bia Modelo - Manha Seis'), mk('9', 'Cena Adulta Dois')];
    const perf = new Map([['9', [{ name: 'Ana Exemplo', photo: 'ana.jpg' }]]]);
    expect(namesToVerify(items, perf, new Map())).toEqual(['Bia Modelo', 'Noite Quatro', 'Tarde Cinco', 'Manha Seis']);
    const ver = new Map([[actressKey('Bia Modelo'), { name: 'Bia Modelo', photo: 'bia.jpg' }], [actressKey('Noite Quatro'), null], [actressKey('Tarde Cinco'), null], [actressKey('Manha Seis'), null]]);
    const l = buildActresses(items, perf, ver, true);
    expect(l.map((a) => [a.name, a.photo, [...a.ids].sort().join(',')])).toEqual([
      ['Ana Exemplo', 'ana.jpg', '1,2,9'],
      ['Bia Modelo', 'bia.jpg', '2,3'],
    ]);
  });
});

describe('horário livre da senha', () => {
  beforeEach(() => localStorage.clear());
  const at = (h: number) => new Date(2026, 10, 11, h, 30);
  it('padrão: senha antes das 22:00; livre das 22:00 às 06:00', () => {
    expect(freeHours()).toEqual({ on: true, from: 22, to: 6 });
    expect(inFreeHours(at(21))).toBe(false);
    expect(inFreeHours(at(22))).toBe(true);
    expect(inFreeHours(at(2))).toBe(true);
    expect(inFreeHours(at(6))).toBe(false);
    expect(inFreeHours(at(14))).toBe(false);
  });
  it('até meia-noite e desligado', () => {
    setFreeHours({ on: true, from: 22, to: 0 });
    expect(inFreeHours(at(23))).toBe(true);
    expect(inFreeHours(at(1))).toBe(false);
    setFreeHours({ on: false, from: 22, to: 6 });
    expect(inFreeHours(at(23))).toBe(false);
  });
});

describe('nome parecido na ThePornDB (0.33.0)', () => {
  it('aceita volume escrito diferente e uma letra trocada; recusa outro número', async () => {
    const { similar, titlePart } = await import('../src/core/tpdb');
    expect(titlePart('Estudio Teste - Ana Exemplo - Grande Festa 10 (2016) [4K]')).toBe('Grande Festa 10');
    expect(similar('Grande Festa 10', 'Grande Festa Vol. 10')).toBe(1);
    expect(similar('Anal Bufet 10', 'Anal Buffet 10')).toBe(1);
    expect(similar('Grande Festa 11', 'Grande Festa Vol. 10')).toBe(0);
    expect(similar('Grande Festa', 'Pequena Reuniao')).toBe(0);
    expect(similar('Kali Rose', 'Kali Roses')).toBe(1);
  });
});

describe('só atrizes (0.35.2)', () => {
  it('homem sai; mulher fica marcada; sexo em branco fica para conferir no perfil', async () => {
    const { performersOfItem } = await import('../src/core/tpdb');
    const r = performersOfItem({
      performers: [
        { name: 'Ana', parent: { extras: { gender: 'Female' } } },
        { name: 'Jesus', extra: { gender: 'Male' } },
        { name: 'Joao', parent: { extras: { gender: 'Male' } }, extra: { gender: null } },
        { name: 'Lia', extras: { gender: 'Transgender Female' } },
        { name: 'Sem Sexo' },
      ],
    });
    expect(r.map((p) => [p.name, !!p.female])).toEqual([['Ana', true], ['Lia', true], ['Sem Sexo', false]]);
  });
});
