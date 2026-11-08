// Modelo único de dados do PRISMA, independente da origem (M3U ou Xtream).

export type ItemKind = 'live' | 'movie' | 'series';

export interface Channel {
  id: string;            // id estável dentro da lista
  kind: ItemKind;
  name: string;
  /** Nome completo como veio na lista (o `name` é o curto). */
  fullName?: string;
  number?: number;       // número do canal (tvg-chno ou posição)
  group: string;         // categoria (group-title / categoria Xtream)
  logo?: string;
  epgId?: string;        // tvg-id, para cruzar com o guia
  url: string;           // endereço de reprodução
  altUrls?: string[];    // "fonte 2": mesma emissora em outra URL
  headers?: { userAgent?: string; referrer?: string };
  catchupDays?: number;
  /** Filmes/séries: nota (0–10), ano e data em que entrou na lista (ms). */
  rating?: number;
  year?: number;
  added?: number;
  /** Episódio: id da série a que pertence. */
  seriesId?: string;
}

export interface Category {
  id: string;
  name: string;
  kind: ItemKind;
  count: number;
}

export interface Playlist {
  source: SourceConfig;
  loadedAt: number;
  epgUrl?: string;
  items: Channel[];
  account?: AccountInfo;
}

export interface AccountInfo {
  status?: string;          // "Active", "Expired", ...
  expiresAt?: number;       // ms
  maxConnections?: number;
  activeConnections?: number;
}

export type SourceConfig =
  | { type: 'm3u'; name: string; url: string }
  | { type: 'm3u-file'; name: string; fileName: string; content: string }
  | { type: 'xtream'; name: string; server: string; username: string; password: string };

export interface EpgEntry {
  title: string;
  description?: string;
  start: number; // ms
  end: number;   // ms
}

export class SourceError extends Error {
  constructor(
    public code: 'network' | 'auth' | 'expired' | 'format' | 'empty' | 'cors',
    message: string,
  ) {
    super(message);
    this.name = 'SourceError';
  }
}
