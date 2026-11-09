import { beforeEach, describe, expect, it } from 'vitest';

// localStorage mínimo para o teste (ambiente node)
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() {
    return mem.size;
  },
} as Storage;

const { nextToWatch, setWatched, saveProgress } = await import('../src/core/vod');
const eps = [1, 2, 3, 4, 5].map((n) => ({ id: 'e' + n }));

describe('card da série abre no próximo episódio', () => {
  beforeEach(() => mem.clear());
  it('sem nada visto: o primeiro', () => expect(nextToWatch(eps)?.id).toBe('e1'));
  it('episódio pela metade: ele', () => {
    setWatched(['e1', 'e2'], true);
    saveProgress('e3', 300, 2700);
    expect(nextToWatch(eps)?.id).toBe('e3');
  });
  it('terminou o 2: abre o 3', () => {
    saveProgress('e2', 2690, 2700); // > 95% = visto
    expect(nextToWatch(eps)?.id).toBe('e3');
  });
  it('marcou a temporada até o 4 à mão: abre o 5', () => {
    setWatched(['e1', 'e2', 'e3', 'e4'], true);
    expect(nextToWatch(eps)?.id).toBe('e5');
  });
});

const { fuzzyMatch } = await import('../src/core/fuzzy');
describe('busca tolerante', () => {
  it('erros de digitação', () => {
    expect(fuzzyMatch('Breaking Bad', 'breking bad')).toBe(true);
    expect(fuzzyMatch('Horizonte Perdido (2018)', 'orizonte')).toBe(true);
    expect(fuzzyMatch('Os Herdeiros', 'herdeiro')).toBe(true);
    expect(fuzzyMatch('Código Vermelho', 'codigo vermelo')).toBe(true);
  });
  it('não casa qualquer coisa', () => {
    expect(fuzzyMatch('Maré Alta', 'terror')).toBe(false);
    expect(fuzzyMatch('Rota 66', 'roma')).toBe(false);
  });
});
