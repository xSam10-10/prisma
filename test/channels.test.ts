import { describe, expect, it } from 'vitest';
import { cleanLabel, plainDigits } from '../src/core/logos';
import { parseM3U } from '../src/core/m3u';
import { tidyPlaylist } from '../src/core/source';
import type { Channel, Playlist } from '../src/core/types';

const live = (name: string, url: string, group = 'ADULTOS +18'): Channel => ({ id: url, kind: 'live', name, group, url });
const tidy = (items: Channel[]) => tidyPlaylist({ items } as unknown as Playlist).items;
const ten = (f: (n: number) => string, host = 'srv.exemplo.com:8080') =>
  Array.from({ length: 10 }, (_, i) => live(f(i + 1), `http://${host}/live/u/p/${i + 1}.ts`));

describe('canais com o mesmo nome', () => {
  it('no mesmo servidor ficam separados e numerados de 1 a 10', () => {
    const out = tidy(ten(() => 'XXX 4K'));
    expect(out.map((c) => c.name)).toEqual(Array.from({ length: 10 }, (_, i) => `XXX 4K ${i + 1}`));
    expect(out.every((c) => !c.altUrls?.length)).toBe(true);
    // O nome completo não muda (guia e logotipo continuam achando o canal).
    expect(out[3].fullName).toBe('XXX 4K');
  });

  it('em servidores diferentes continuam como fonte reserva', () => {
    const out = tidy([live('GLOBO SP HD', 'http://a.com/1.ts', 'Abertos'), live('GLOBO SP HD', 'http://b.com/1.ts', 'Abertos')]);
    expect(out).toHaveLength(1);
    expect(out[0].altUrls).toEqual(['http://b.com/1.ts']);
  });

  it('[ALT] e H265 continuam juntando com o canal principal', () => {
    const out = tidy([live('SPORTV 2 FHD', 'http://a.com/1.ts', 'Esportes'), live('SPORTV 2 FHD [H265]', 'http://a.com/2.ts', 'Esportes')]);
    expect(out).toHaveLength(1);
    expect(out[0].altUrls).toEqual(['http://a.com/2.ts']);
  });

  it('em categorias diferentes não ganham número', () => {
    const out = tidy([live('XXX 4K', 'http://a.com/1.ts', 'A'), live('XXX 4K', 'http://a.com/2.ts', 'B')]);
    expect(out.map((c) => c.name)).toEqual(['XXX 4K', 'XXX 4K']);
  });

  it('arrumar a lista de novo não numera duas vezes', () => {
    const once = tidy(ten(() => 'XXX 4K'));
    const twice = tidy(once);
    expect(twice.map((c) => c.name)).toEqual(once.map((c) => c.name));
  });

  it('M3U: mesmo nome no mesmo servidor não vira fonte 2', () => {
    const m3u = '#EXTM3U\n' + [1, 2, 3].map((n) => `#EXTINF:-1 group-title="Adultos",XXX 4K\nhttp://srv.com/live/u/p/${n}.ts`).join('\n');
    expect(tidy(parseM3U(m3u).items).map((c) => c.name)).toEqual(['XXX 4K 1', 'XXX 4K 2', 'XXX 4K 3']);
  });
});

describe('números decorados', () => {
  it('viram números comuns', () => {
    expect(plainDigits('XXX 4K ❿')).toBe('XXX 4K 10');
    expect(plainDigits('XXX 4K①')).toBe('XXX 4K 1');
    expect(plainDigits('XXX ➊')).toBe('XXX 1');
    expect(plainDigits('CANAL ０２')).toBe('CANAL 02');
    expect(cleanLabel('XXX 4K 🔟')).toBe('XXX 4K 10');
    expect(cleanLabel('XXX 4K 1️⃣')).toBe('XXX 4K 1');
    expect(plainDigits('GLOBO SP HD')).toBe('GLOBO SP HD');
  });

  it('canais com números decorados ficam separados', () => {
    const out = tidy(ten((n) => `XXX 4K ${String.fromCodePoint(0x2775 + n)}`));
    expect(out.map((c) => c.name)).toEqual(Array.from({ length: 10 }, (_, i) => `XXX 4K ${i + 1}`));
  });
});
