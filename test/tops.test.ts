import { describe, expect, it } from 'vitest';
import { findInList, homeShelves, interleave, matchList, topChannels, type TopsData } from '../src/core/tops';
import type { Channel } from '../src/core/types';

const mk = (id: string, kind: Channel['kind'], name: string, extra: Partial<Channel> = {}): Channel => ({ id, kind, name, group: 'G', url: 'u', ...extra });

const items: Channel[] = [
  mk('m1', 'movie', 'Rota 66 (2019)'),
  mk('m2', 'movie', 'Maré Alta [L] (2024)'),
  mk('m3', 'movie', 'Duna 4K', { year: 1984 }),
  mk('m4', 'movie', 'Duna', { year: 2021 }),
  mk('m5', 'movie', 'Wandinha', { year: 2022 }),
  mk('s1', 'series', 'Round 6'),
  mk('s2', 'series', 'Turno da Noite (2016)'),
];

describe('tops: cruzar com a lista', () => {
  it('acha pelo nome em português, ignorando ano/qualidade e acentos', () => {
    expect(findInList({ t: 'Rota 66', y: 2019 }, 'movie', items)?.id).toBe('m1');
    expect(findInList({ t: 'mare alta', y: 2024 }, 'movie', items)?.id).toBe('m2');
  });
  it('filmes: escolhe o do ano certo (remakes) e recusa ano distante', () => {
    expect(findInList({ t: 'Duna', y: 2021 }, 'movie', items)?.id).toBe('m4');
    expect(findInList({ t: 'Duna', y: 1984 }, 'movie', items)?.id).toBe('m3');
    expect(findInList({ t: 'Duna', y: 2000 }, 'movie', items)).toBeUndefined();
  });
  it('usa o nome original ou o inglês (Netflix) quando o português não bate', () => {
    expect(findInList({ t: 'Squid Game', o: '오징어 게임' }, 'tv', items)).toBeUndefined();
    expect(findInList({ t: 'Jogo da Lula', e: 'Round 6' }, 'tv', items)?.id).toBe('s1');
    expect(findInList({ t: 'Wednesday', o: 'Wandinha' }, 'movie', items)?.id).toBe('m5');
  });
  it('séries não confundem com filmes', () => {
    expect(findInList({ t: 'Rota 66' }, 'tv', items)).toBeUndefined();
  });
  it('mantém a posição original do ranking e pula o que não existe', () => {
    const m = matchList({ id: 'x', kind: 'movie', group: 'geral', title: 'T', src: 'S', items: [{ t: 'Nada' }, { t: 'Rota 66', y: 2019 }, { t: 'Maré Alta', y: 2024 }] }, items);
    expect(m.items.map((r) => [r.item.id, r.rank])).toEqual([['m1', 2], ['m2', 3]]);
  });
  it('mescla filmes e séries alternando e renumera', () => {
    const a = [{ item: items[0], rank: 3 }, { item: items[1], rank: 5 }];
    const b = [{ item: items[5], rank: 1 }];
    expect(interleave(a, b).map((r) => [r.item.id, r.rank])).toEqual([['m1', 1], ['s1', 2], ['m2', 3]]);
  });
  it('Início: filmes e séries de cada streaming em fileiras separadas, só com 4+ títulos', () => {
    const data: TopsData = {
      v: 1, updated: '', at: 0, channels: [],
      lists: [
        { id: 'netflix-oficial-movie', kind: 'movie', group: 'streaming', sid: 'netflix', title: 'Top 10 Netflix', src: 's', items: [{ t: 'Rota 66' }, { t: 'Maré Alta' }] },
        { id: 'netflix-oficial-tv', kind: 'tv', group: 'streaming', sid: 'netflix', title: 'Top 10 Netflix', src: 's', items: [{ t: 'Round 6' }, { t: 'Turno da Noite' }] },
        { id: 'hbo-movie', kind: 'movie', group: 'streaming', sid: 'hbo', title: 'Top 10 HBO Max', src: 's', items: [{ t: 'Duna', y: 2021 }] },
      ],
    };
    const sh = homeShelves(data, items);
    // HBO tem só 1 filme na lista: não entra; Netflix tem 2 filmes e 2 séries (< 4 cada): não entra.
    expect(sh.map((s) => s.id)).toEqual([]);
    const many: TopsData = { ...data, lists: [
      { id: 'netflix-oficial-movie', kind: 'movie', group: 'streaming', sid: 'netflix', title: 'Top 10 Netflix', src: 's', items: [{ t: 'Rota 66' }, { t: 'Maré Alta' }, { t: 'Duna', y: 2021 }, { t: 'Wandinha' }] },
      { id: 'netflix-oficial-tv', kind: 'tv', group: 'streaming', sid: 'netflix', title: 'Top 10 Netflix', src: 's', items: [{ t: 'Round 6' }] },
    ] };
    const sh2 = homeShelves(many, items);
    expect(sh2.map((s) => [s.id, s.title])).toEqual([['st-netflix-movie', 'Top 10 Filmes Netflix']]);
    expect(sh2[0].items.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });
});

describe('tops: canais', () => {
  const live = [
    mk('c1', 'live', 'GLOBO SP FHD', { number: 1 }),
    mk('c2', 'live', 'GLOBO NEWS HD', { number: 50 }),
    mk('c3', 'live', 'GLOBO RJ HD', { number: 2 }),
    mk('c4', 'live', 'SPORTV 2 FHD [H265]', { number: 31 }),
    mk('c5', 'live', 'Canal Qualquer', { number: 99 }),
  ];
  it('casa pelo nome (Globo não pega GloboNews) e escolhe uma versão por marca', () => {
    const r = topChannels(null, live, [], []);
    expect(r.map((p) => p.ch.id)).toEqual(['c1', 'c4', 'c2']);
  });
  it('a versão vista por último ganha (Globo RJ)', () => {
    const r = topChannels(null, live, [], ['c3']);
    expect(r[0].ch.id).toBe('c3');
  });
  it('ranking do arquivo baixado substitui o embutido', () => {
    const data: TopsData = { v: 1, updated: '', at: 0, lists: [], channels: [{ n: 'Qualquer', m: '^canal qualquer$', c: 'X' }] };
    expect(topChannels(data, live, [], []).map((p) => p.ch.id)).toEqual(['c5']);
  });
});
