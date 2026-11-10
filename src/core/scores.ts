import { fetchText } from './net';
import { prefGet, prefSet } from './storage';
import type { Game } from './games';
import { matchOf } from './games';

// Placar ao vivo: placares públicos da ESPN (sem chave), cruzados com os
// jogos encontrados no guia pelos nomes dos times.

export interface Score {
  home: string;
  away: string;
  homeScore: string;
  awayScore: string;
  /** pre = não começou · in = ao vivo · post = encerrado */
  state: 'pre' | 'in' | 'post';
  detail: string; // "45'", "Intervalo", "Encerrado"…
  start: number;
  league: string;
  /** Id do jogo na ESPN e o caminho da liga (para estatísticas e escalações). */
  id?: string;
  path?: string;
  /** Escudos e cores dos times (ESPN). */
  homeLogo?: string;
  awayLogo?: string;
  homeColor?: string;
  awayColor?: string;
}

const LEAGUES: [string, string][] = [
  ['soccer/bra.1', 'Brasileirão'],
  ['soccer/bra.2', 'Brasileirão Série B'],
  ['soccer/bra.copa_do_brazil', 'Copa do Brasil'],
  ['soccer/conmebol.libertadores', 'Libertadores'],
  ['soccer/conmebol.sudamericana', 'Sul-Americana'],
  ['soccer/uefa.champions', 'Champions League'],
  ['soccer/eng.1', 'Premier League'],
  ['soccer/esp.1', 'La Liga'],
  ['soccer/ita.1', 'Serie A'],
  ['soccer/ger.1', 'Bundesliga'],
  ['soccer/fra.1', 'Ligue 1'],
  ['basketball/nba', 'NBA'],
  ['football/nfl', 'NFL'],
  ['mma/ufc', 'UFC'],
];

function base(): string {
  // Permite apontar para outro servidor (testes).
  return prefGet<string>('scoresBase', 'https://site.api.espn.com/apis/site/v2/sports');
}

type Obj = Record<string, unknown>;
const get = (o: unknown, path: string): unknown => path.split('.').reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Obj)[k] : undefined), o);

function detailPt(state: string, short: string): string {
  if (state === 'post') return 'Encerrado';
  if (/half|HT|intervalo/i.test(short)) return 'Intervalo';
  return short.replace(/^FT$/, 'Encerrado');
}

let cache: { at: number; scores: Score[] } | null = null;

export async function loadScores(force = false): Promise<Score[]> {
  if (!force && cache && Date.now() - cache.at < 55000) return cache.scores;
  const all: Score[] = [];
  await Promise.all(
    LEAGUES.map(async ([path, league]) => {
      try {
        const r = JSON.parse(await fetchText(`${base()}/${path}/scoreboard`, 12000)) as Obj;
        for (const ev of (r.events as Obj[]) ?? []) {
          const comp = ((ev.competitions as Obj[]) ?? [])[0] ?? {};
          const cs = (comp.competitors as Obj[]) ?? [];
          const home = cs.find((c) => c.homeAway === 'home') ?? cs[0];
          const away = cs.find((c) => c.homeAway === 'away') ?? cs[1];
          if (!home || !away) continue;
          const state = String(get(ev, 'status.type.state') ?? 'pre') as Score['state'];
          all.push({
            home: String(get(home, 'team.displayName') ?? get(home, 'athlete.displayName') ?? ''),
            away: String(get(away, 'team.displayName') ?? get(away, 'athlete.displayName') ?? ''),
            homeScore: String(home.score ?? ''),
            awayScore: String(away.score ?? ''),
            state,
            detail: detailPt(state, String(get(ev, 'status.type.shortDetail') ?? '')),
            start: Date.parse(String(ev.date ?? '')),
            league,
            id: ev.id != null ? String(ev.id) : undefined,
            path,
            homeLogo: (get(home, 'team.logo') as string) || undefined,
            awayLogo: (get(away, 'team.logo') as string) || undefined,
            homeColor: get(home, 'team.color') ? '#' + String(get(home, 'team.color')) : undefined,
            awayColor: get(away, 'team.color') ? '#' + String(get(away, 'team.color')) : undefined,
          });
        }
      } catch {
        /* liga sem resposta: ignora */
      }
    }),
  );
  cache = { at: Date.now(), scores: all };
  return all;
}

const STOP = /\b(fc|ec|sc|se|cr|ac|ca|afc|cf|club|clube|esporte|futebol|de|do|da|the|united|city)\b/g;
export function teamKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(STOP, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sameTeam(a: string, b: string): boolean {
  const x = teamKey(a);
  const y = teamKey(b);
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  // primeira palavra significativa ("bayern" ~ "bayern munich", "atletico mg" ~ "atletico mineiro")
  const fx = x.split(' ')[0];
  const fy = y.split(' ')[0];
  return fx.length >= 4 && fx === fy;
}

/** Placar do jogo do guia (pelos dois times e o horário). */
export function scoreFor(g: Game, scores: Score[]): Score | undefined {
  const teams = matchOf(g.title).split(/\s+(?:x|vs\.?|versus|×)\s+/i);
  if (teams.length !== 2) return undefined;
  return scores.find(
    (s) =>
      Math.abs(s.start - g.start) < 4 * 3600 * 1000 &&
      ((sameTeam(teams[0], s.home) && sameTeam(teams[1], s.away)) || (sameTeam(teams[0], s.away) && sameTeam(teams[1], s.home))),
  );
}

/** Placar na ordem do título do jogo ("Flamengo x Palmeiras" → [gols do Flamengo, gols do Palmeiras]). */
export function orderedScore(g: Game, s: Score): [string, string] {
  const first = matchOf(g.title).split(/\s+(?:x|vs\.?|versus|×)\s+/i)[0];
  return sameTeam(first, s.home) ? [s.homeScore, s.awayScore] : [s.awayScore, s.homeScore];
}

// ---------------------------------------------------------------- Tabela
export interface TableRow {
  rank: number;
  team: string;
  short: string;
  logo?: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gd: number;
  points: number;
}
export interface Table {
  name: string;
  rows: TableRow[];
}

function standingsBase(): string {
  const b = base();
  return b.includes('/apis/site/v2/') ? b.replace('/apis/site/v2/', '/apis/v2/') : b;
}

const stat = (stats: Obj[], ...names: string[]): number => {
  for (const n of names) {
    const s = stats.find((x) => x.name === n || x.type === n || x.abbreviation === n);
    if (s) return Number(s.value ?? s.displayValue ?? 0) || 0;
  }
  return 0;
};

/** Classificação da liga (ESPN). Ligas com grupos (Libertadores) devolvem várias tabelas. */
export async function loadStandings(path: string): Promise<Table[]> {
  const r = JSON.parse(await fetchText(`${standingsBase()}/${path}/standings`, 15000)) as Obj;
  const groups: Obj[] = ((r.children as Obj[]) ?? []).length ? (r.children as Obj[]) : [r];
  return groups
    .map((g) => {
      const entries = (get(g, 'standings.entries') as Obj[]) ?? [];
      const rows = entries.map((e, i): TableRow => {
        const st = (e.stats as Obj[]) ?? [];
        const logos = (get(e, 'team.logos') as Obj[]) ?? [];
        return {
          rank: stat(st, 'rank') || i + 1,
          team: String(get(e, 'team.displayName') ?? ''),
          short: String(get(e, 'team.abbreviation') ?? get(e, 'team.shortDisplayName') ?? ''),
          logo: logos[0] ? String(logos[0].href) : undefined,
          played: stat(st, 'gamesPlayed', 'GP'),
          wins: stat(st, 'wins', 'W'),
          draws: stat(st, 'ties', 'draws', 'T', 'D'),
          losses: stat(st, 'losses', 'L'),
          gd: stat(st, 'pointDifferential', 'GD'),
          points: stat(st, 'points', 'P'),
        };
      });
      rows.sort((a, b) => a.rank - b.rank);
      return { name: String(g.name ?? g.abbreviation ?? ''), rows };
    })
    .filter((t) => t.rows.length);
}

// ---------------------------------------------------------------- Estatísticas do jogo
export interface MatchStats {
  /** [rótulo, casa, fora] */
  stats: [string, string, string][];
  events: { minute: string; kind: 'goal' | 'yellow' | 'red' | 'sub' | 'other'; team: string; text: string }[];
  lineups: { team: string; formation?: string; starters: string[]; bench: string[] }[];
}

const STAT_PT: Record<string, string> = {
  possessionPct: 'Posse de bola (%)',
  totalShots: 'Finalizações',
  shotsOnTarget: 'No gol',
  wonCorners: 'Escanteios',
  foulsCommitted: 'Faltas',
  offsides: 'Impedimentos',
  yellowCards: 'Cartões amarelos',
  redCards: 'Cartões vermelhos',
  saves: 'Defesas',
};

export async function loadMatchStats(s: Score): Promise<MatchStats | null> {
  if (!s.id || !s.path) return null;
  const r = JSON.parse(await fetchText(`${base()}/${s.path}/summary?event=${encodeURIComponent(s.id)}`, 15000)) as Obj;
  const teams = (get(r, 'boxscore.teams') as Obj[]) ?? [];
  const byTeam = (name: string) => teams.find((t) => teamKey(String(get(t, 'team.displayName') ?? '')) === teamKey(name));
  const h = byTeam(s.home) ?? teams[0];
  const a = byTeam(s.away) ?? teams[1];
  const stats: MatchStats['stats'] = [];
  if (h && a) {
    const hs = (h.statistics as Obj[]) ?? [];
    const as = (a.statistics as Obj[]) ?? [];
    for (const [key, label] of Object.entries(STAT_PT)) {
      const x = hs.find((q) => q.name === key);
      const y = as.find((q) => q.name === key);
      if (x || y) stats.push([label, String(x?.displayValue ?? '0'), String(y?.displayValue ?? '0')]);
    }
  }
  const events: MatchStats['events'] = ((r.keyEvents as Obj[]) ?? []).map((e) => {
    const t = String(get(e, 'type.text') ?? get(e, 'type.type') ?? '').toLowerCase();
    const kind: MatchStats['events'][number]['kind'] = e.scoringPlay || /goal|gol/.test(t) ? 'goal' : /red/.test(t) ? 'red' : /yellow/.test(t) ? 'yellow' : /sub/.test(t) ? 'sub' : 'other';
    const who = ((e.participants as Obj[]) ?? []).map((p) => String(get(p, 'athlete.displayName') ?? '')).filter(Boolean).join(', ');
    return { minute: String(get(e, 'clock.displayValue') ?? ''), kind, team: String(get(e, 'team.displayName') ?? ''), text: who || String(e.text ?? e.shortText ?? '') };
  }).filter((e) => e.kind !== 'other');
  const lineups: MatchStats['lineups'] = ((r.rosters as Obj[]) ?? []).map((ro) => {
    const players = (ro.roster as Obj[]) ?? [];
    const fmt = (p: Obj) => `${p.jersey ? p.jersey + ' ' : ''}${String(get(p, 'athlete.displayName') ?? '')}`;
    return {
      team: String(get(ro, 'team.displayName') ?? ''),
      formation: ro.formation ? String(ro.formation) : undefined,
      starters: players.filter((p) => p.starter).map(fmt),
      bench: players.filter((p) => !p.starter).map(fmt),
    };
  });
  return { stats, events, lineups };
}

/** O time está na lista de "Meus times"? */
export function isMyTeam(name: string, mine: string[]): boolean {
  return mine.some((m) => sameTeam(m, name));
}

// ---------------------------------------------------------------- Placar flutuante (0.26.0)

/** Jogo fixado no placar flutuante (aparece por cima do vídeo em tela cheia). */
export interface PinnedScore {
  id: string;
  path: string;
  home: string;
  away: string;
  start: number;
}
export function pinnedScores(): PinnedScore[] {
  // Some sozinho 4 h depois do começo do jogo.
  return prefGet<PinnedScore[]>('pinnedScores', []).filter((p) => p.start > Date.now() - 4 * 3600000);
}
export function isPinned(s: Pick<Score, 'id' | 'path'>): boolean {
  return pinnedScores().some((p) => p.id === s.id && p.path === s.path);
}
/** Liga/desliga o placar na tela (no máximo 2 jogos). Devolve se ficou ligado. */
export function togglePinned(s: Score): boolean {
  if (!s.id || !s.path) return false;
  const cur = pinnedScores();
  const on = cur.some((p) => p.id === s.id && p.path === s.path);
  const next = on ? cur.filter((p) => !(p.id === s.id && p.path === s.path)) : [...cur, { id: s.id, path: s.path, home: s.home, away: s.away, start: s.start }].slice(-2);
  prefSet('pinnedScores', next);
  return !on;
}
