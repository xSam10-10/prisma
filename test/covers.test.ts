import { describe, expect, it } from 'vitest';
import { adultQuery, overlap, sameContent } from '../src/core/tpdb';
import { indexLogos, isGenericLogo } from '../src/core/vod';
import type { Channel } from '../src/core/types';

describe('capas oficiais dos títulos de adulto', () => {
  it('limpa o nome da lista para a busca', () => {
    expect(adultQuery('[XXX] Estudio Teste - Cena Adulta Dois 4K FHD (LEG)')).toBe('Estudio Teste - Cena Adulta Dois');
  });
  it('só aceita resultado com o título batendo', () => {
    expect(overlap('Estudio Teste - Cena Adulta Dois', 'Cena Adulta Dois Estudio Teste')).toBe(1);
    expect(overlap('Estudio Teste - Cena Adulta Dois', 'Outra Coisa Qualquer')).toBe(0);
    // Estúdio na frente do título na lista
    expect(sameContent('Estudio Teste - Filme Adulto Um', 'Filme Adulto Um')).toBe(true);
    expect(sameContent('Estudio Teste - Filme Adulto Um', 'Filme')).toBe(false);
    expect(sameContent('Estudio Teste - Filme Adulto Um', 'Outro Filme Diferente')).toBe(false);
  });
  it('capa genérica: sem capa, "sem imagem" ou a mesma imagem em 3+ títulos', () => {
    const mk = (id: string, logo?: string): Channel => ({ id, name: id, group: 'ADULTOS', kind: 'movie', url: '', logo } as Channel);
    indexLogos([mk('a', 'http://x/xxx-geral.jpg'), mk('b', 'http://x/xxx-geral.jpg'), mk('c', 'http://x/xxx-geral.jpg'), mk('d', 'http://x/capa-certa.jpg')]);
    expect(isGenericLogo('http://x/xxx-geral.jpg')).toBe(true);
    expect(isGenericLogo('http://x/capa-certa.jpg')).toBe(false);
    expect(isGenericLogo(undefined)).toBe(true);
    expect(isGenericLogo('http://x/no_image.png')).toBe(true);
  });
});
