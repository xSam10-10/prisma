import { describe, expect, it } from 'vitest';
import { cleanLabel, logoKey } from '../src/core/logos';

describe('nomes de canais e categorias', () => {
  it('limpa emojis e símbolos das categorias', () => {
    expect(cleanLabel('♦️ CANAIS | FHD H265 ⭐')).toBe('CANAIS | FHD H265');
    expect(cleanLabel('🔶 REDE RECORD')).toBe('REDE RECORD');
    expect(cleanLabel('Esportes | Futebol')).toBe('Esportes | Futebol');
  });
  it('chave do logo ignora qualidade e versão', () => {
    expect(logoKey('SPORTV 2 FHD [H265]')).toBe('sportv 2');
    expect(logoKey('GLOBO SP 4K FHDR')).toBe('globo sp');
    expect(logoKey('CARTOON NETWORK FHD [ALT]')).toBe('cartoon network');
    expect(logoKey('Jovem Pan News 4K FHDR')).toBe('jovem pan news');
    expect(logoKey('A&E HD')).toBe('a e e');
    expect(logoKey('HBO Plus HD')).toBe('hbo plus');
  });
});
