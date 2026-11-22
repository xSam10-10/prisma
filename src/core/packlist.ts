// Lista compacta para guardar no aparelho (1.0.2).
//
// A TV LG (webOS 3.5) dá só ~24 MB de armazenamento ao app. A lista da Goldcard
// (55 mil itens) ocupava 16 MB e não cabia regravar junto com o resto
// (QuotaExceededError): o guia, as capas e as atualizações da lista falhavam
// sem aviso. Aqui a lista vira:
//  · endereços (url, logo, fontes extras) com o começo repetido guardado uma vez
//    só ("http://servidor/movie/usuario/senha/" vira um número);
//  · categorias numa tabela;
//  · cada item num array na ordem de um "molde" de campos (sem repetir os nomes
//    dos campos 55 mil vezes).
// O formato é genérico: qualquer campo novo de Channel entra sozinho.

import type { Channel, Playlist } from './types';

export interface PackedPlaylist {
  packed: 1;
  head: Omit<Playlist, 'items'>;
  /** Começos de endereço (até a última "/"). */
  pfx: string[];
  groups: string[];
  /** Moldes: a lista de campos de cada formato de item. */
  shapes: string[][];
  /** Cada item: [índice do molde, ...valores na ordem do molde]. */
  rows: unknown[][];
}

const URL_FIELDS = new Set(['url', 'logo', 'catchupSource']);
const MARK = '\u0001';

export function isPacked(x: unknown): x is PackedPlaylist {
  return !!x && typeof x === 'object' && (x as PackedPlaylist).packed === 1;
}

export function packPlaylist(p: Playlist): PackedPlaylist {
  const pfxIdx = new Map<string, number>();
  const pfx: string[] = [];
  const grpIdx = new Map<string, number>();
  const groups: string[] = [];
  const shapeIdx = new Map<string, number>();
  const shapes: string[][] = [];
  const enc = (s: string): string => {
    if (typeof s !== 'string') return s;
    if (s.charAt(0) === MARK) return MARK + MARK + s; // escapa (não acontece na prática)
    const cut = s.lastIndexOf('/') + 1;
    if (cut < 12) return s; // curto demais para valer a pena
    const head = s.slice(0, cut);
    let i = pfxIdx.get(head);
    if (i === undefined) {
      i = pfx.length;
      pfx.push(head);
      pfxIdx.set(head, i);
    }
    return MARK + i.toString(36) + MARK + s.slice(cut);
  };
  const rows: unknown[][] = new Array(p.items.length);
  for (let n = 0; n < p.items.length; n++) {
    const it = p.items[n] as unknown as Record<string, unknown>;
    const keys = Object.keys(it).filter((k) => it[k] !== undefined);
    // fullName igual ao name: não guarda (volta igual ao abrir).
    const sameFull = it.fullName === it.name;
    const ks = sameFull ? keys.filter((k) => k !== 'fullName') : keys;
    const sig = ks.join(',') + (sameFull ? '|=' : '');
    let si = shapeIdx.get(sig);
    if (si === undefined) {
      si = shapes.length;
      shapes.push(sameFull ? [...ks, '='] : ks);
      shapeIdx.set(sig, si);
    }
    const row: unknown[] = [si];
    for (const k of ks) {
      const v = it[k];
      if (k === 'group' && typeof v === 'string') {
        let g = grpIdx.get(v);
        if (g === undefined) {
          g = groups.length;
          groups.push(v);
          grpIdx.set(v, g);
        }
        row.push(g);
      } else if (URL_FIELDS.has(k) && typeof v === 'string') row.push(enc(v));
      else if (k === 'altUrls' && Array.isArray(v)) row.push(v.map((u) => (typeof u === 'string' ? enc(u) : u)));
      else row.push(v);
    }
    rows[n] = row;
  }
  const { items: _items, ...head } = p;
  return { packed: 1, head, pfx, groups, shapes, rows };
}

export function unpackPlaylist(x: PackedPlaylist): Playlist {
  const { pfx, groups, shapes, rows } = x;
  const dec = (s: unknown): unknown => {
    if (typeof s !== 'string' || s.charAt(0) !== MARK) return s;
    if (s.charAt(1) === MARK) return s.slice(2);
    const j = s.indexOf(MARK, 1);
    return pfx[parseInt(s.slice(1, j), 36)] + s.slice(j + 1);
  };
  const items: Channel[] = new Array(rows.length);
  for (let n = 0; n < rows.length; n++) {
    const row = rows[n];
    const shape = shapes[row[0] as number];
    const o: Record<string, unknown> = {};
    let sameFull = false;
    for (let i = 0; i < shape.length; i++) {
      const k = shape[i];
      if (k === '=') {
        sameFull = true;
        continue;
      }
      const v = row[i + 1];
      if (k === 'group') o.group = typeof v === 'number' ? groups[v] : v;
      else if (URL_FIELDS.has(k)) o[k] = dec(v);
      else if (k === 'altUrls' && Array.isArray(v)) o[k] = v.map(dec);
      else o[k] = v;
    }
    if (sameFull) o.fullName = o.name;
    items[n] = o as unknown as Channel;
  }
  return { ...(x.head as Omit<Playlist, 'items'>), items } as Playlist;
}
