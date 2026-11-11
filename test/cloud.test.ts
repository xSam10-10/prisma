import { describe, expect, it } from 'vitest';
import { mergeSnapshots, type Snapshot } from '../src/core/cloud';

const snap = (keys: Snapshot['keys']): Snapshot => ({ app: 'PRISMA', v: 2, at: 0, keys });

describe('sincronização pela nuvem', () => {
  it('a alteração mais nova vence, dos dois lados', () => {
    const local = snap({ 'prisma.favs': { t: 200, v: ['a', 'b'] }, 'prisma.myList': { t: 50, v: ['x'] } });
    const remote = snap({ 'prisma.favs': { t: 100, v: ['a'] }, 'prisma.myList': { t: 300, v: ['x', 'y'] } });
    const { merged, toLocal, toRemote } = mergeSnapshots(local, remote);
    expect(merged.keys['prisma.favs'].v).toEqual(['a', 'b']);
    expect(merged.keys['prisma.myList'].v).toEqual(['x', 'y']);
    expect(toRemote).toEqual(['prisma.favs']);
    expect(toLocal).toEqual(['prisma.myList']);
  });
  it('apagar num aparelho apaga nos outros (não junta listas)', () => {
    const local = snap({ 'prisma.favs': { t: 500, v: [] } });
    const remote = snap({ 'prisma.favs': { t: 100, v: ['a', 'b'] } });
    expect(mergeSnapshots(local, remote).merged.keys['prisma.favs'].v).toEqual([]);
  });
  it('dados antigos sem hora: vale a nuvem (o primeiro aparelho conectado é a base)', () => {
    const local = snap({ 'prisma.favs': { t: 0, v: ['meu'] } });
    const remote = snap({ 'prisma.favs': { t: 0, v: ['base'] } });
    const r = mergeSnapshots(local, remote);
    expect(r.merged.keys['prisma.favs'].v).toEqual(['base']);
    expect(r.toLocal).toEqual(['prisma.favs']);
    expect(r.toRemote).toEqual([]);
  });
  it('sem nada na nuvem: tudo daqui vai para ela', () => {
    const r = mergeSnapshots(snap({ 'prisma.p.p2.favs': { t: 0, v: ['z'] } }), null);
    expect(r.toRemote).toEqual(['prisma.p.p2.favs']);
  });
});
