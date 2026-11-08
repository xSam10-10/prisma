import { prefGet, prefSet } from './storage';
import { syncNativeReminders } from './native';
import type { Channel, EpgEntry, Playlist } from './types';
import { shortEpg } from './xtream';
import { loadXmltv, programmesOf } from './xmltv';
import { loadScores, scoreFor } from './scores';

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
    /\b(futebol|brasileiro|rodada|partida)\b/i.test(title) ||
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
  /** Jogo vindo só do placar da ESPN: os canais são os prováveis da competição. */
  likely?: boolean;
}

let cache: { at: number; games: Game[] } | null = null;

/** O que a última busca encontrou (aparece na tela quando não há jogos). */
export interface GamesStats {
  sports: number;
  asked: number;
  withGuide: number;
  fromXmltv: number;
  programmes: number;
  espn: number;
  samples: string[];
}
let stats: GamesStats | null = null;
export function gamesStats(): GamesStats | null {
  return stats;
}

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Canais que costumam passar cada competição (quando o jogo vem só do placar da
 * ESPN e não aparece no guia). É só uma sugestão: a tela mostra "canais prováveis".
 */
const LIKELY: [RegExp, RegExp][] = [
  [/brasileir|copa do brasil/i, /premiere|sportv|^globo|caz[eé]|record/i],
  [/libertadores/i, /espn|globo|sportv|paramount|caz[eé]/i],
  [/sul-?americana/i, /espn|sbt|paramount|caz[eé]/i],
  [/champions/i, /tnt|space|sbt|hbo|max/i],
  [/premier league|la liga|serie a/i, /espn|disney/i],
  [/bundesliga/i, /sportv|caz[eé]|onefootball/i],
  [/nba/i, /espn|sportv|band ?sports|prime/i],
  [/nfl/i, /espn|disney|prime/i],
  [/ufc/i, /combate|band/i],
];

function likelyChannels(league: string, sports: Channel[]): Channel[] {
  const rule = LIKELY.find(([l]) => l.test(league));
  if (!rule) return [];
  const seen = new Set<string>();
  const out: Channel[] = [];
  for (const c of sports) {
    if (!rule[1].test(c.name)) continue;
    const k = norm(c.name).replace(/\b(hd|fhd|uhd|sd|4k|h265)\b/g, '').trim();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
    if (out.length >= 6) break;
  }
  return out;
}

const BRANDS = /sportv|premiere|espn|band ?sports|tnt|combate|globo|sbt|record|caz[eé]|dazn|paramount|disney/i;

/**
 * Monta a lista de jogos juntando três fontes:
 *  1. guia completo (XMLTV) de todos os canais de esporte, se já baixado;
 *  2. guia curto do Xtream dos canais de esporte — primeiro os que têm guia
 *     (epg_channel_id) e as marcas conhecidas, até 120 canais;
 *  3. placar do dia da ESPN: jogos que não apareceram no guia entram com os
 *     canais prováveis da competição.
 */
export async function loadGames(pl: Playlist, onProgress?: (done: number, total: number) => void): Promise<Game[]> {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return cache.games;
  const sports = pl.items.filter(isSportsChannel);
  const byKey = new Map<string, Game>();
  const st: GamesStats = { sports: sports.length, asked: 0, withGuide: 0, fromXmltv: 0, programmes: 0, espn: 0, samples: [] };
  const now = Date.now();
  const until = now + 3 * 86400000;
  const add = (ch: Channel, e: EpgEntry) => {
    st.programmes++;
    if (st.samples.length < 6 && e.title && !st.samples.includes(e.title)) st.samples.push(e.title);
    if (!looksLikeGame(e.title) || e.end < now || e.start > until) return;
    const title = e.title.replace(/\s+/g, ' ').trim();
    const key = norm(matchOf(title)) + '|' + Math.round(e.start / 600000);
    const g = byKey.get(key);
    if (g) {
      if (!g.channels.some((c) => c.id === ch.id)) g.channels.push(ch);
    } else byKey.set(key, { key, title, league: leagueOf(title), start: e.start, end: e.end, channels: [ch] });
  };

  // 1) Guia completo (XMLTV), em paralelo; espera no máximo 40 s no total.
  const xmlP = Promise.race([loadXmltv(pl).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 40000))]);

  // 2) Guia curto do Xtream
  if (pl.source.type === 'xtream') {
    const src = pl.source;
    const score = (c: Channel) => (c.epgId ? 2 : 0) + (BRANDS.test(c.name) ? 1 : 0);
    const ask = sports
      .slice()
      .sort((a, b) => score(b) - score(a))
      .slice(0, 120);
    st.asked = ask.length;
    let done = 0;
    const queue = [...ask];
    const worker = async () => {
      while (queue.length) {
        const ch = queue.shift()!;
        try {
          const list = await shortEpg(src, ch.id, 12);
          if (list.length) st.withGuide++;
          for (const e of list) add(ch, e);
        } catch {
          /* canal sem guia: ignora */
        }
        onProgress?.(++done, ask.length);
      }
    };
    // 6 pedidos por vez, para não pesar no servidor.
    await Promise.all(Array.from({ length: 6 }, worker));
  }
  if (await xmlP) {
    for (const ch of sports) {
      const progs = programmesOf(ch);
      if (!progs.length) continue;
      st.fromXmltv++;
      for (const e of progs) add(ch, e);
    }
  }

  // 3) Placar da ESPN: jogos de hoje que o guia não trouxe
  try {
    const scores = await loadScores();
    const fromGuide = [...byKey.values()];
    for (const s of scores) {
      if (s.state === 'post' || !s.home || !s.away || !Number.isFinite(s.start)) continue;
      const title = `${s.league}: ${s.home} x ${s.away}`;
      if (fromGuide.some((g) => scoreFor(g, [s]))) continue;
      st.espn++;
      const key = 'espn|' + (s.id ?? norm(title));
      byKey.set(key, { key, title, league: s.league, start: s.start, end: s.start + 2 * 3600000, channels: likelyChannels(s.league, sports), likely: true });
    }
  } catch {
    /* sem placar: segue só com o guia */
  }

  stats = st;
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

// ---- Meus times ----

/** Times escolhidos (por perfil). */
export function myTeams(): string[] {
  return prefGet<string[]>('myTeams', []);
}
export function setMyTeams(list: string[]): void {
  prefSet('myTeams', [...new Set(list.map((t) => t.trim()).filter(Boolean))]);
}

/** Os dois times de um jogo ("Brasileirão: Flamengo x Palmeiras" → ["Flamengo", "Palmeiras"]). */
export function teamsOf(g: Game | string): string[] {
  const t = matchOf(typeof g === 'string' ? g : g.title);
  const p = t.split(/\s+(?:x|vs\.?|versus|×)\s+/i).map((x) => x.replace(/\s*[-–(].*$/, '').trim());
  return p.length === 2 && p[0] && p[1] ? p : [];
}

/** Jogos já lidos do guia (sem buscar de novo). */
export function cachedGames(): Game[] {
  return cache ? cache.games : [];
}

/** Liga o lembrete (sem desligar se já existir). */
export function ensureReminder(g: Game): boolean {
  const cur = reminders();
  if (cur.some((r) => r.key === g.key)) return false;
  const next = [...cur, { key: g.key, title: g.title, start: g.start, channelId: g.channels[0]?.id }];
  prefSet('reminders', next);
  void syncNativeReminders(next);
  return true;
}
