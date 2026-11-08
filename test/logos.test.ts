import { describe, expect, it } from 'vitest';
import { cleanLabel, logoKey } from '../src/core/logos';
import { parseEpisodeName, simplifyGroup, simplifyGroups, simplifyName } from '../src/core/names';

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

describe('nome curto do canal', () => {
  it('corta o que vem depois da qualidade', () => {
    expect(simplifyName('GLOBO RJ HD [ALT]')).toBe('GLOBO RJ HD');
    expect(simplifyName('GLOBO RJ FHD [H265]')).toBe('GLOBO RJ FHD');
    expect(simplifyName('SPORTV 2 FHD [H265]')).toBe('SPORTV 2 FHD');
    expect(simplifyName('GLOBO SP 4K FHDR')).toBe('GLOBO SP 4K');
    expect(simplifyName('Jovem Pan News 4K FHDR')).toBe('Jovem Pan News 4K');
    expect(simplifyName('CARTOON NETWORK FHD [ALT]')).toBe('CARTOON NETWORK FHD');
    expect(simplifyName('GLOBO RJ SD')).toBe('GLOBO RJ SD');
  });
  it('sem qualidade, mantém o nome', () => {
    expect(simplifyName('A FAZENDA 18 SINAL 01')).toBe('A FAZENDA 18 SINAL 01');
    expect(simplifyName('HD Channel')).toBe('HD Channel');
  });
});

describe('nome curto da categoria', () => {
  it('tira H265/HEVC', () => {
    expect(simplifyGroup('CANAIS | FHD H265')).toBe('CANAIS | FHD');
    expect(simplifyGroup('Filmes HEVC')).toBe('Filmes');
    expect(simplifyGroup('REDE RECORD')).toBe('REDE RECORD');
  });
  it('não cria categorias com nome repetido', () => {
    const m = simplifyGroups(['CANAIS | FHD H265', 'CANAIS | UHD 4K', 'ABERTOS']);
    expect(m.get('CANAIS | FHD H265')).toBe('CANAIS | FHD');
    const c = simplifyGroups(['CANAIS | FHD', 'CANAIS | FHD H265']);
    expect(c.get('CANAIS | FHD H265')).toBe('CANAIS | FHD H265');
  });
});

describe('episódios de lista M3U', () => {
  it('reconhece os formatos comuns', () => {
    expect(parseEpisodeName('The Office S02 E05')).toEqual({ show: 'The Office', season: 2, number: 5, title: '' });
    expect(parseEpisodeName('Chaves S01E10 - O Festival')).toEqual({ show: 'Chaves', season: 1, number: 10, title: 'O Festival' });
    expect(parseEpisodeName('Naruto T3E21')).toMatchObject({ show: 'Naruto', season: 3, number: 21 });
    expect(parseEpisodeName('Friends 4x07')).toMatchObject({ show: 'Friends', season: 4, number: 7 });
    expect(parseEpisodeName('Filme Qualquer (2020)')).toBeNull();
  });
});
