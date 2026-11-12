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

describe('meus logos x oficiais', async () => {
  const { setLogoCatalogs, logoCandidates } = await import('../src/core/logos');
  setLogoCatalogs({ record: 'record-br.png', 'record rj': 'record-rj-br.png', tcm: 'tcm-br.png' }, { record: 'record.png', 'espn 2': 'espn-2.png', espn: 'espn.png', tcm: 'tcm.png', 'tcm canal 10 rn': '' });
  const first = (n: string) => logoCandidates(n, 'lista.png', false)[0];
  it('meu logo vence o oficial do mesmo nível', () => expect(first('RECORD SP FHD')).toBe('logos/custom/record.png'));
  it('oficial mais específico é preservado', () => expect(first('RECORD RJ HD')).toBe('logos/br/record-rj-br.png'));
  it('variante numerada', () => {
    expect(first('ESPN 2 FHD')).toBe('logos/custom/espn-2.png');
    expect(first('ESPN 1 FHD')).toBe('logos/custom/espn.png');
  });
  it('bloqueio: não herda o logo de nome mais curto', () => {
    expect(first('TCM canal 10-RN')).toBe('lista.png');
    expect(first('TCM HD')).toBe('logos/custom/tcm.png');
  });
});

describe('ícones da TV atualizada pelo app', async () => {
  const { mergeCustom } = await import('../src/core/logos');
  it('o que a TV já tem fica local; o novo vem da internet', () => {
    const r = mergeCustom({ globo: 'globo.png' }, { globo: 'globo.png', dazn: 'dazn.png', 'tcm canal 10 rn': '' }, 'https://cdn/x/');
    expect(r.urls).toEqual({ 'dazn.png': 'https://cdn/x/dazn.png' });
    expect(r.cat['tcm canal 10 rn']).toBe('');
  });
  it('arquivo trocado com o mesmo nome de chave vem da internet', () => {
    expect(mergeCustom({ sbt: 'sbt-velho.png' }, { sbt: 'sbt.png' }, 'B/').urls).toEqual({ 'sbt.png': 'B/sbt.png' });
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

import { sameChannelKey } from '../src/core/names';
describe('canais numerados não viram um só', () => {
  it('nome curto mantém a numeração', () => {
    expect(simplifyName('ADULTOS HD 01')).toBe('ADULTOS HD 01');
    expect(simplifyName('CANAL XXX (2)')).toBe('CANAL XXX 2');
    expect(simplifyName('GLOBO RJ HD [ALT]')).toBe('GLOBO RJ HD');
  });
  it('junta só fontes reservas do mesmo canal', () => {
    expect(sameChannelKey('GLOBO RJ FHD [ALT]')).toBe(sameChannelKey('GLOBO RJ FHD'));
    expect(sameChannelKey('SPORTV 2 FHD [H265]')).toBe(sameChannelKey('SPORTV 2 FHD'));
    expect(sameChannelKey('ADULTOS HD 01')).not.toBe(sameChannelKey('ADULTOS HD 02'));
    expect(sameChannelKey('Venus (1)')).not.toBe(sameChannelKey('Venus (2)'));
    expect(sameChannelKey('GLOBO RJ HD')).not.toBe(sameChannelKey('GLOBO RJ SD'));
    expect(sameChannelKey('HBO+ FHD')).not.toBe(sameChannelKey('HBO FHD'));
    expect(sameChannelKey('HBO+ FHD [ALT]')).toBe(sameChannelKey('HBO+ FHD'));
  });
});
