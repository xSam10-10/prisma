import { prefGet, prefSet } from './storage';
import { syncNativeReminders } from './native';
import type { Channel, Playlist } from './types';
import { shortEpg } from './xtream';

// Jogos: partidas encontradas no guia dos canais de esporte da lista.
// (Placar ao vivo precisa de um serviço esportivo externo — ver pendências.)

const SPORT_GROUP = /esport|sport|futebol|premiere|espn|ppv|ufc|nfl|nba|combate|dazn|tnt sports|eventos|copa|brasileir|libertadores|champions/i;
const SPORT_NAME = /sportv|espn|premiere|band ?sports|tnt sports|dazn|combate|fox sports|xsports|esporte|ufc|nba|nfl|cazé|caze/i;

export function isSportsChannel(c: Channel): boolean {
  return c.kind === 'live' && (SPORT_GROUP.test(c.group) || SPORT_NAME.test(c.name));
}

/** O título parece uma partida/evento esportivo? */
export function looksLikeGame(title: string): boolean {
  return (
    /\S\s+(x|vs\.?|versus|×)\s+\S/i.test(title) ||
    /\b(ufc|nba|nfl|nhl|mlb|f[oó]rmula ?1|\bf1\b|gp |grande pr[eê]mio|brasileir[aã]o|libertadores|sul-?americana|champions|copa do (brasil|mundo|nordeste)|premier league|la liga|serie a|bundesliga|paulist[aã]o|carioca|mineiro|ga[uú]cho|t[eê]nis|wta|atp|v[oô]lei|basquete|boxe|luta)\b/i.test(title)
  );
}

/** Liga/competição a partir do título ("Brasileirão: A x B" → "Brasileirão"). */
export function leagueOf(title: string): string {
  const m = title.match(/^([^:|–-]{3,40})\s*[:|–-]\s*.+(\sx\s|\svs\.?\s)/i);
  if (m) return m[1].trim();
  const k = title.match(/\b(UFC|NBA|NFL|NHL|MLB|F[oó]rmula ?1|Brasileir[aã]o( S[ée]rie [AB])?|Libertadores|Sul-?Americana|Champions League|Copa do Brasil|Premier League|La Liga|Serie A|Bundesliga|Paulist[aã]o|Carioca)\b/i);
  return k ? k[1] : 'Esporte';
}

/** Só a partida, sem a liga na frente. */
export function matchOf(title: string): string {
  return title.replace(/^[^:|]{3,40}[:|]\s*/, '').trim();
}

export interface Game {
  key: string;
  title: string;
  league: string;
  start: number;
  end: number;
  channels: Channel[];
}

let cache: { at: number; games: Game[] } | null = null;

/** Busca o guia (agora e próximas horas) dos canais de esporte e monta a lista de jogos. */
export async function loadGames(pl: Playlist, onProgress?: (done: number, total: number) => void): Promise<Game[]> {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return cache.games;
  if (pl.source.type !== 'xtream') return [];
  const src = pl.source;
  const sports = pl.items.filter(isSportsChannel).slice(0, 80);
  const byKey = new Map<string, Game>();
  let done = 0;
  // 6 pedidos por vez, para não pesar no servidor.
  const queue = [...sports];
  const worker = async () => {
    while (queue.length) {
      const ch = queue.shift()!;
      try {
        const list = await shortEpg(src, ch.id, 12);
        for (const e of list) {
          if (!looksLikeGame(e.title) || e.end < Date.now()) continue;
          const title = e.title.replace(/\s+/g, ' ').trim();
          const key = matchOf(title).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + '|' + Math.round(e.start / 600000);
          const g = byKey.get(key);
          if (g) {
            if (!g.channels.some((c) => c.id === ch.id)) g.channels.push(ch);
          } else byKey.set(key, { key, title, league: leagueOf(title), start: e.start, end: e.end, channels: [ch] });
        }
      } catch {
        /* canal sem guia: ignora */
      }
      onProgress?.(++done, sports.length);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  const games = [...byKey.values()].sort((a, b) => a.start - b.start);
  cache = { at: Date.now(), games };
  return games;
}

export function clearGamesCache(): void {
  cache = null;
}

// ---- Lembretes ----

export interface Reminder {
  key: string;
  title: string;
  start: number;
  channelId: string;
  fired?: boolean;
}

export function reminders(): Reminder[] {
  return prefGet<Reminder[]>('reminders', []).filter((r) => r.start > Date.now() - 3 * 3600 * 1000);
}

export function hasReminder(key: string): boolean {
  return reminders().some((r) => r.key === key);
}

export function toggleReminder(g: Game): boolean {
  const cur = reminders();
  const has = cur.some((r) => r.key === g.key);
  const next = has ? cur.filter((r) => r.key !== g.key) : [...cur, { key: g.key, title: g.title, start: g.start, channelId: g.channels[0]?.id }];
  prefSet('reminders', next);
  void syncNativeReminders(next); // Android: notificação mesmo com o app fechado
  return !has;
}

/** Lembretes que começam agora (até 1 min antes) e ainda não avisaram. */
export function dueReminders(): Reminder[] {
  const now = Date.now();
  const all = reminders();
  const due = all.filter((r) => !r.fired && r.start - 60000 <= now && now < r.start + 2 * 3600 * 1000);
  if (due.length) prefSet('reminders', all.map((r) => (due.some((d) => d.key === r.key) ? { ...r, fired: true } : r)));
  return due;
}
