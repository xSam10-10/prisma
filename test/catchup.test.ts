import { describe, expect, it } from 'vitest';
import { catchupItem, startOverItem } from '../src/core/catchup';
import type { Channel, Playlist } from '../src/core/types';

const pl = { source: { type: 'xtream', server: 'http://srv.test', username: 'u', password: 'p' }, loadedAt: 0, items: [] } as unknown as Playlist;
const ch: Channel = { id: 'l42', kind: 'live', name: 'Canal', group: 'G', url: 'http://srv.test/live/u/p/42.ts', catchupDays: 3 };

describe('começar do início', () => {
  const now = Date.UTC(2026, 10, 9, 15, 30);
  const e = { title: 'Jornal', start: Date.UTC(2026, 10, 9, 15, 0), end: Date.UTC(2026, 10, 9, 16, 0) };
  it('programa no ar, canal que grava: timeshift desde o começo', () => {
    const it2 = startOverItem(pl, ch, e, now);
    expect(it2?.url).toMatch(/^http:\/\/srv\.test\/timeshift\/u\/p\/60\/\d{4}-\d{2}-\d{2}:\d{2}-00\/42\.ts$/);
    expect(it2?.kind).toBe('movie');
  });
  it('canal sem gravação ou programa que não está no ar: nada', () => {
    expect(startOverItem(pl, { ...ch, catchupDays: 0 }, e, now)).toBeNull();
    expect(startOverItem(pl, ch, { ...e, start: now + 60000, end: now + 3600000 }, now)).toBeNull();
  });
  it('programa no ar não vale como gravação passada', () => {
    expect(catchupItem(pl, ch, { ...e, end: Date.now() + 3600000, start: Date.now() - 600000 })).toBeNull();
  });
});
