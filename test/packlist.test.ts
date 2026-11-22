import { describe, expect, it } from 'vitest';
import { isPacked, packPlaylist, unpackPlaylist } from '../src/core/packlist';
import type { Playlist } from '../src/core/types';

const base = 'http://servidor.exemplo:8080';
const pl: Playlist = {
  source: { type: 'xtream', name: 'Teste', server: base, username: 'u', password: 'p' },
  loadedAt: 123,
  tidied: '1.0.2',
  account: { status: 'Active', maxConnections: 2 },
  items: [
    { id: 'l1', kind: 'live', name: 'GLOBO RJ HD', fullName: 'GLOBO RJ HD', number: 1, group: 'CANAIS | HD', logo: 'http://logos.exemplo/abc/globo.png', epgId: 'globo.rj', url: `${base}/live/u/p/1.m3u8`, altUrls: [`${base}/live/u/p/1.ts`, 'http://outro/x.ts'], catchupDays: 3 },
    { id: 'l2', kind: 'live', name: 'SBT', fullName: 'SBT HD [ALT]', group: 'CANAIS | HD', url: `${base}/live/u/p/2.m3u8` },
    { id: 'm9', kind: 'movie', name: 'Duna', group: 'FILMES', logo: 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/xyz.jpg', url: `${base}/movie/u/p/9.mkv`, rating: 8.1, year: 2021, added: 1700000000000 },
    { id: 's5', kind: 'series', name: 'Série', group: 'SÉRIES', url: '', episodes: [{ id: 'e1', season: 1, number: 1, title: 'Piloto', url: `${base}/series/u/p/1.mp4` }] },
    { id: 'x', kind: 'movie', name: 'Curto', group: 'FILMES', url: 'a/b', logo: '\u0001estranho' },
  ],
};

describe('lista compacta (TV LG)', () => {
  it('volta exatamente igual', () => {
    const copy = JSON.parse(JSON.stringify(pl)) as Playlist;
    const packed = packPlaylist(copy);
    expect(isPacked(packed)).toBe(true);
    expect(isPacked(pl)).toBe(false);
    const back = unpackPlaylist(JSON.parse(JSON.stringify(packed)));
    expect(back).toEqual(pl);
  });

  it('guarda o começo dos endereços e as categorias uma vez só', () => {
    const packed = packPlaylist(pl);
    expect(packed.pfx).toContain(`${base}/live/u/p/`);
    expect(packed.pfx.filter((p) => p === `${base}/live/u/p/`)).toHaveLength(1);
    expect(packed.groups).toEqual(['CANAIS | HD', 'FILMES', 'SÉRIES']);
  });

  it('fica bem menor numa lista grande', () => {
    const items = Array.from({ length: 3000 }, (_, i) => ({ id: 'm' + i, kind: 'movie' as const, name: 'Filme ' + i, group: 'G' + (i % 30), logo: `https://image.tmdb.org/t/p/w600_and_h900_bestv2/${i}abcdefghijklmnop.jpg`, url: `${base}/movie/usuario123/senha456/${i}.mp4`, rating: 7, year: 2020 }));
    const big: Playlist = { ...pl, items };
    const a = JSON.stringify(big).length;
    const b = JSON.stringify(packPlaylist(big)).length;
    expect(b / a).toBeLessThan(0.55);
    expect(unpackPlaylist(packPlaylist(big))).toEqual(big);
  });
});
