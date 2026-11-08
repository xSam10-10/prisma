import { describe, expect, it } from 'vitest';
import { parseXmltv, parseXmltvDate } from '../src/core/xmltv';
import { catchupUrl, inArchive } from '../src/core/catchup';
import type { Channel, Playlist } from '../src/core/types';

const XML = `<?xml version="1.0"?><tv>
<channel id="globo.br"><display-name>Globo SP</display-name></channel>
<channel id="outro"><display-name>Outro Canal</display-name></channel>
<programme start="20261108120000 -0300" stop="20261108130000 -0300" channel="globo.br"><title lang="pt">Jornal &amp; Cia</title><desc>Notícias</desc></programme>
<programme start="20261108130000 -0300" stop="20261108140000 -0300" channel="globo.br"><title><![CDATA[Novela]]></title></programme>
<programme start="20261108120000 -0300" stop="20261108130000 -0300" channel="outro"><title>Fora</title></programme>
</tv>`;

describe('XMLTV', () => {
  it('lê datas com fuso', () => {
    expect(new Date(parseXmltvDate('20261108120000 -0300')).toISOString()).toBe('2026-11-08T15:00:00.000Z');
    expect(new Date(parseXmltvDate('20261108120000')).toISOString()).toBe('2026-11-08T12:00:00.000Z');
  });
  it('guarda só os canais da lista, com títulos decodificados', () => {
    const r = parseXmltv(XML, (id) => id === 'globo.br', Date.parse('2026-11-08T15:30:00Z'));
    expect(Object.keys(r.guide)).toEqual(['globo.br']);
    expect(r.guide['globo.br'].map((e) => e.title)).toEqual(['Jornal & Cia', 'Novela']);
    expect(r.guide['globo.br'][0].description).toBe('Notícias');
    expect(r.names['globo sp']).toBe('globo.br');
  });
});

describe('voltar na programação', () => {
  const now = Date.parse('2026-11-08T20:00:00Z');
  const e = { title: 'Jornal', start: Date.parse('2026-11-08T15:00:00Z'), end: Date.parse('2026-11-08T16:00:00Z') };
  const ch: Channel = { id: 'l30', kind: 'live', name: 'ESPN', group: 'Esportes', url: 'http://s.com/live/u/p/30.m3u8', catchupDays: 3 };
  it('só dentro da janela de gravação', () => {
    expect(inArchive(ch, e, now)).toBe(true);
    expect(inArchive({ ...ch, catchupDays: undefined }, e, now)).toBe(false);
    expect(inArchive(ch, { ...e, start: now - 5 * 86400000, end: now - 5 * 86400000 + 3600000 }, now)).toBe(false);
  });
  it('monta o endereço Xtream (timeshift) e M3U (modelo)', () => {
    const pl = { source: { type: 'xtream', name: 'x', server: 'http://s.com', username: 'u', password: 'p' }, loadedAt: 0, items: [], account: { timezone: 'UTC' } } as Playlist;
    expect(catchupUrl(pl, ch, e, now)).toBe('http://s.com/timeshift/u/p/60/2026-11-08:15-00/30.ts');
    const m3u = { source: { type: 'm3u', name: 'm', url: 'http://l' }, loadedAt: 0, items: [] } as Playlist;
    const c2 = { ...ch, catchupSource: 'http://arq.com/30?utc={utc}&dur=${duration}' };
    expect(catchupUrl(m3u, c2, e, now)).toBe(`http://arq.com/30?utc=${e.start / 1000}&dur=3600`);
  });
});
