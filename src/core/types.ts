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
  /** M3U: modelo de endereço para voltar na programação (catchup-source). */
  catchupSource?: string;
  catchupType?: string;
  /** Filmes/séries: nota (0–10), ano e data em que entrou na lista (ms). */
  rating?: number;
  year?: number;
  added?: number;
  /** Episódio: id da série a que pertence. */
  seriesId?: string;
  /** Série montada de uma lista M3U: episódios já conhecidos. */
  episodes?: EpisodeRef[];
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
  /** Fuso do servidor Xtream (para voltar na programação). */
  timezone?: string;
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
  /** O servidor tem a gravação deste programa (Xtream has_archive). */
  archive?: boolean;
  /** Imagem do programa (XMLTV <icon src>), quando o guia traz. */
  image?: string;
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

export interface EpisodeRef {
  id: string;
  season: number;
  number: number;
  title: string;
  url: string;
  cover?: string;
}
