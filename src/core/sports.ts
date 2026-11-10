// Centro de esportes (0.25.0): campeonatos com calendário, tabela e times.
//
// O calendário da temporada vem pronto de "prisma-sports.json", gerado no
// GitHub a cada 2 horas (scripts/sports/build-sports.mjs, workflow sports.yml)
// e publicado na Release "tops". O placar ao vivo do dia continua vindo direto
// da ESPN (scores.ts) e é aplicado por cima do calendário.

import { fetchText } from './net';
import { idbGet, idbSet, prefGet } from './storage';
import { loadStandings, sameTeam, teamKey, type Score, type Table } from './scores';
import defs from '../../scripts/sports/leagues.json';

export const DEFAULT_SPORTS = 'https://github.com/xSam10-10/prisma/releases/download/tops/prisma-sports.json';
const MAX_AGE = 2 * 3600 * 1000;

export interface LeagueDef {
  id: string;
  name: string;
  full: string;
  kind: 'liga' | 'copa';
  span: string;
  /** Cores do tema (gradiente do banner e do cartão). */
  c: [string, string];
  flag: string;
}
export const LEAGUE_DEFS = defs as LeagueDef[];

/** [nome, sigla, escudo (número da ESPN ou URL), cor, cor alternativa] */
type RawTeam = [string, string, number | string, string, string];
/** [id, horário (s), casa, fora, gols casa, gols fora, estado 0/1/2, rodada ou fase, nota, adiado] */
type RawEvent = [string, number, number, number, string, string, number, number | string, string, number];
/** [pos, time, sigla, escudo, P, J, V, E, D, GP, GC, SG, cor da zona] */
type RawRow = [number, string, string, number | string, number, number, number, number, number, number, number, number, string];

interface RawLeague {
  id: string;
  season: string;
  logo: string;
  teams: RawTeam[];
  ev: RawEvent[];
  tables: { n: string; rows: RawRow[] }[];
  /** Artilheiros e assistências: [nome, time, escudo, total, jogos] */
  sc?: [string, string, number | string, number, number][];
  as?: [string, string, number | string, number, number][];
}
export interface SportsFeed {
  v: number;
  updated: string;
  leagues: RawLeague[];
  f1?: RawF1 | null;
  at: number;
}

export interface Team {
  name: string;
  short: string;
  logo?: string;
  color?: string;
}
export interface Match {
  id: string;
  start: number;
  home: Team;
  away: Team;
  homeScore: string;
  awayScore: string;
  state: 'pre' | 'in' | 'post';
  /** Minuto ou situação ("67'", "Intervalo") quando ao vivo. */
  detail?: string;
  /** Liga: número da rodada. Copa: fase ("Semifinal"). */
  round: number;
  phase: string;
  phaseOrder: number;
  note?: string;
  league: LeagueDef;
}
export interface StandRow {
  rank: number;
  team: Team;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  zone?: string;
}
export interface Leader {
  name: string;
  team: Team;
  total: number;
  games: number;
}
export interface League {
  def: LeagueDef;
  season: string;
  logo?: string;
  teams: Team[];
  matches: Match[];
  tables: { name: string; rows: StandRow[] }[];
  scorers: Leader[];
  assists: Leader[];
  /** Montada sem o arquivo do GitHub (só tabela e jogos de hoje). */
  partial?: boolean;
}

/** Fases das copas (mesma tabela do gerador). */
const PHASES: Record<string, [string, number]> = {
  'preliminary-round': ['Fase preliminar', 1],
  'first-qualifying-round': ['1ª fase preliminar', 1],
  'second-qualifying-round': ['2ª fase preliminar', 2],
  'third-qualifying-round': ['3ª fase preliminar', 3],
  'first-stage': ['1ª fase', 1],
  'second-stage': ['2ª fase', 2],
  'third-stage': ['3ª fase', 3],
  qualifying: ['Fase preliminar', 3],
  playoff: ['Playoff', 4],
  'playoff-round': ['Playoff', 4],
  'knockout-round-playoffs': ['Playoffs', 9],
  'first-round': ['1ª fase', 5],
  'second-round': ['2ª fase', 6],
  'third-round': ['3ª fase', 7],
  'fourth-round': ['4ª fase', 8],
  'fifth-round': ['5ª fase', 8.5],
  'group-stage': ['Fase de grupos', 8],
  'league-phase': ['Fase de liga', 8],
  'round-of-32': ['16 avos de final', 9],
  'round-of-16': ['Oitavas de final', 10],
  quarterfinals: ['Quartas de final', 11],
  semifinals: ['Semifinal', 12],
  'third-place': ['3º lugar', 13],
  final: ['Final', 14],
};
export function phaseName(slug: string): [string, number] {
  if (PHASES[slug]) return PHASES[slug];
  const nice = slug.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  return [nice || 'Jogos', 7];
}

export const espnLogo = (v: number | string | undefined): string | undefined =>
  v === undefined || v === '' ? undefined : typeof v === 'number' ? `https://a.espncdn.com/i/teamlogos/soccer/500/${v}.png` : v;

function hex(c: string | undefined): string | undefined {
  return c && /^[0-9a-f]{6}$/i.test(c) ? '#' + c : undefined;
}

function decode(raw: RawLeague, def: LeagueDef): League {
  const teams: Team[] = raw.teams.map(([name, short, logo, color]) => ({ name, short, logo: espnLogo(logo), color: hex(color) }));
  const matches: Match[] = raw.ev.map(([id, t, h, a, hs, as, st, r, n]) => {
    const isCup = typeof r === 'string';
    const [phase, order] = isCup ? phaseName(r as string) : [`Rodada ${r}`, Number(r)];
    return {
      id,
      start: t * 1000,
      home: teams[h],
      away: teams[a],
      homeScore: hs,
      awayScore: as,
      state: st === 1 ? 'in' : st === 2 ? 'post' : 'pre',
      round: isCup ? 0 : Number(r),
      phase,
      phaseOrder: order,
      note: n || undefined,
      league: def,
    };
  });
  const tables = raw.tables.map((tb) => ({
    name: tb.n,
    rows: tb.rows.map(([rank, name, short, logo, points, played, wins, draws, losses, gf, ga, gd, zone]) => ({
      rank,
      team: teams.find((x) => x.name === name) ?? { name, short, logo: espnLogo(logo) },
      points,
      played,
      wins,
      draws,
      losses,
      gf,
      ga,
      gd,
      zone: zone ? '#' + zone.replace('#', '') : undefined,
    })),
  }));
  const leader = (x: [string, string, number | string, number, number]): Leader => ({ name: x[0], team: teams.find((t) => t.name === x[1]) ?? { name: x[1], short: x[1].slice(0, 3).toUpperCase(), logo: espnLogo(x[2]) }, total: x[3], games: x[4] });
  return { def, season: raw.season, logo: raw.logo || undefined, teams, matches, tables, scorers: (raw.sc ?? []).map(leader), assists: (raw.as ?? []).map(leader) };
}

// ---------------------------------------------------------------- Baixar e guardar

let mem: SportsFeed | null = null;
let decoded: Map<string, League> | null = null;
/** Arquivo de onde veio o cache decodificado (outro arquivo, ou nenhum, refaz). */
let decodedFrom: SportsFeed | null = null;
let inflight: Promise<SportsFeed | null> | null = null;

export function sportsUrl(): string {
  return prefGet<string>('sportsFeed', '') || DEFAULT_SPORTS;
}

/** Calendário dos campeonatos: memória › IndexedDB (até 2 h) › internet. */
export function loadSports(force = false): Promise<SportsFeed | null> {
  if (!force && mem && Date.now() - mem.at < MAX_AGE) return Promise.resolve(mem);
  if (inflight) return inflight;
  inflight = (async () => {
    const cached = mem ?? (await idbGet<SportsFeed>('sports')) ?? null;
    if (cached && !mem) {
      mem = cached;
      decoded = null;
    }
    if (!force && cached && Date.now() - cached.at < MAX_AGE) return cached;
    try {
      const d = JSON.parse(await fetchText(sportsUrl() + '?t=' + Date.now(), 30000)) as SportsFeed;
      if (!d || !Array.isArray(d.leagues)) throw new Error('arquivo inválido');
      d.at = Date.now();
      mem = d;
      decoded = null;
      idbSet('sports', d);
      return d;
    } catch {
      return cached;
    }
  })();
  const p = inflight;
  p.then(
    () => (inflight = null),
    () => (inflight = null),
  );
  return p;
}

/** Campeonatos na ordem combinada (Brasileirão primeiro). */
export function leaguesOf(feed: SportsFeed | null): League[] {
  if (!decoded || decodedFrom !== feed) {
    decoded = new Map();
    decodedFrom = feed;
    for (const raw of feed?.leagues ?? []) {
      const def = LEAGUE_DEFS.find((d) => d.id === raw.id);
      if (def) decoded.set(def.id, decode(raw, def));
    }
  }
  return LEAGUE_DEFS.map((def) => decoded!.get(def.id) ?? { def, season: '', teams: [], matches: [], tables: [], scorers: [], assists: [], partial: true });
}

/** Sem o arquivo do GitHub: tabela direto da ESPN (a página mostra o aviso). */
export async function partialLeague(def: LeagueDef): Promise<League> {
  const tables: Table[] = await loadStandings('soccer/' + def.id).catch(() => []);
  return {
    def,
    season: '',
    teams: [],
    matches: [],
    scorers: [],
    assists: [],
    partial: true,
    tables: tables.map((t) => ({
      name: t.name,
      rows: t.rows.map((r) => ({ rank: r.rank, team: { name: r.team, short: r.short, logo: r.logo }, points: r.points, played: r.played, wins: r.wins, draws: r.draws, losses: r.losses, gf: 0, ga: 0, gd: r.gd })),
    })),
  };
}

// ---------------------------------------------------------------- Ao vivo por cima do calendário

/** Aplica o placar do dia (ESPN, atualizado a cada minuto) aos jogos do calendário. */
export function withLive(matches: Match[], scores: Score[]): Match[] {
  if (!scores.length) return matches;
  const byId = new Map<string, Score>();
  for (const s of scores) if (s.id) byId.set(s.path + '|' + s.id, s);
  return matches.map((m) => {
    const s = byId.get('soccer/' + m.league.id + '|' + m.id);
    if (!s) return m;
    return { ...m, state: s.state, homeScore: s.state === 'pre' ? '' : s.homeScore, awayScore: s.state === 'pre' ? '' : s.awayScore, detail: s.state === 'in' ? s.detail : undefined, start: Number.isFinite(s.start) ? s.start : m.start };
  });
}

/** Jogos de hoje do placar da ESPN que ainda não estão no calendário (arquivo velho). */
export function liveExtras(leagues: League[], scores: Score[]): Match[] {
  const ids = new Set<string>();
  for (const l of leagues) for (const m of l.matches) ids.add('soccer/' + l.def.id + '|' + m.id);
  const out: Match[] = [];
  for (const s of scores) {
    if (!s.id || !s.path || ids.has(s.path + '|' + s.id)) continue;
    const def = LEAGUE_DEFS.find((d) => 'soccer/' + d.id === s.path);
    if (!def) continue;
    const team = (name: string, logo?: string, color?: string): Team => ({ name, short: name.slice(0, 3).toUpperCase(), logo, color });
    out.push({
      id: s.id,
      start: s.start,
      home: team(s.home, s.homeLogo, s.homeColor),
      away: team(s.away, s.awayLogo, s.awayColor),
      homeScore: s.state === 'pre' ? '' : s.homeScore,
      awayScore: s.state === 'pre' ? '' : s.awayScore,
      state: s.state,
      detail: s.state === 'in' ? s.detail : undefined,
      round: 0,
      phase: '',
      phaseOrder: 0,
      league: def,
    });
  }
  return out;
}

// ---------------------------------------------------------------- Rodadas e fases

export interface Stage {
  key: string;
  label: string;
  order: number;
  matches: Match[];
}

/** Rodadas (liga) ou fases (copa), na ordem. */
export function stagesOf(l: League): Stage[] {
  const map = new Map<string, Stage>();
  for (const m of l.matches) {
    const key = l.def.kind === 'liga' ? String(m.round) : m.phase;
    let s = map.get(key);
    if (!s) {
      s = { key, label: m.phase, order: m.phaseOrder, matches: [] };
      map.set(key, s);
    }
    s.matches.push(m);
  }
  const list = [...map.values()];
  for (const s of list) s.matches.sort((a, b) => a.start - b.start);
  // Copas: fases na ordem em que acontecem (a ordem da tabela é só para empate).
  list.sort((a, b) => (l.def.kind === 'liga' ? a.order - b.order : a.matches[0].start - b.matches[0].start || a.order - b.order));
  return list;
}

/** Rodada/fase "da vez": a que tem jogo ao vivo, ou a próxima, ou a última. */
export function currentStage(stages: Stage[], now = Date.now()): number {
  if (!stages.length) return 0;
  const live = stages.findIndex((s) => s.matches.some((m) => m.state === 'in'));
  if (live >= 0) return live;
  // A primeira com algum jogo que ainda não acabou (e que não seja só um jogo adiado solto).
  const next = stages.findIndex((s) => s.matches.some((m) => m.state === 'pre' && m.start > now - 3 * 3600000) && s.matches.filter((m) => m.state === 'post').length < s.matches.length / 2 + 1);
  if (next >= 0) return next;
  return stages.length - 1;
}

export function nextMatch(l: League, now = Date.now()): Match | undefined {
  return l.matches.find((m) => m.state === 'in') ?? l.matches.find((m) => m.state === 'pre' && m.start > now - 2 * 3600000);
}

/** Jogos de um time (pelo nome). */
export function matchesOfTeam(l: League, name: string): Match[] {
  return l.matches.filter((m) => sameTeam(m.home.name, name) || sameTeam(m.away.name, name));
}

/** Confrontos de mata-mata: ida e volta do mesmo par juntos. */
export interface Tie {
  a: Team;
  b: Team;
  legs: Match[];
  /** Quem passou (pela nota da ESPN ou pelo placar). */
  winner?: string;
}
export function tiesOf(stage: Stage): Tie[] {
  const out: Tie[] = [];
  for (const m of stage.matches) {
    const k = [teamKey(m.home.name), teamKey(m.away.name)].sort().join('|');
    let t = out.find((x) => [teamKey(x.a.name), teamKey(x.b.name)].sort().join('|') === k);
    if (!t) {
      t = { a: m.home, b: m.away, legs: [] };
      out.push(t);
    }
    t.legs.push(m);
  }
  for (const t of out) {
    const last = t.legs[t.legs.length - 1];
    if (last.state !== 'post') continue;
    const n = last.note ?? '';
    const w = n.match(/(\S+) vence/);
    if (w) {
      const ab = w[1].toLowerCase();
      t.winner = [t.a, t.b].find((x) => x.short.toLowerCase() === ab || teamKey(x.name).startsWith(ab))?.name;
    }
    if (!t.winner) {
      let ga = 0;
      let gb = 0;
      for (const m of t.legs) {
        const h = Number(m.homeScore) || 0;
        const a = Number(m.awayScore) || 0;
        if (sameTeam(m.home.name, t.a.name)) {
          ga += h;
          gb += a;
        } else {
          ga += a;
          gb += h;
        }
      }
      if (ga !== gb) t.winner = ga > gb ? t.a.name : t.b.name;
    }
  }
  return out;
}

// ---------------------------------------------------------------- Destaques simples

export interface LeagueFacts {
  leader?: StandRow;
  bestAttack?: StandRow;
  bestDefense?: StandRow;
  biggestWin?: Match;
  goals: number;
  played: number;
}
export function factsOf(l: League): LeagueFacts {
  const rows = l.tables.length === 1 ? l.tables[0].rows : [];
  const done = l.matches.filter((m) => m.state === 'post');
  let biggest: Match | undefined;
  let goals = 0;
  for (const m of done) {
    const h = Number(m.homeScore) || 0;
    const a = Number(m.awayScore) || 0;
    goals += h + a;
    if (!biggest || Math.abs(h - a) > Math.abs((Number(biggest.homeScore) || 0) - (Number(biggest.awayScore) || 0))) biggest = m;
  }
  const by = (f: (r: StandRow) => number) => (rows.length ? rows.reduce((x, y) => (f(y) > f(x) ? y : x)) : undefined);
  return {
    leader: rows[0],
    bestAttack: rows.some((r) => r.gf) ? by((r) => r.gf) : undefined,
    bestDefense: rows.some((r) => r.ga) ? by((r) => -r.ga / Math.max(1, r.played)) : undefined,
    biggestWin: biggest,
    goals,
    played: done.length,
  };
}

// ---------------------------------------------------------------- Sequências e forma (etapa 3)

export type FormLetter = 'V' | 'E' | 'D';
/** Últimos resultados de cada time (do mais antigo para o mais recente). */
export function formOf(l: League): Map<string, FormLetter[]> {
  const map = new Map<string, FormLetter[]>();
  for (const m of l.matches) {
    if (m.state !== 'post' || m.homeScore === '' || m.awayScore === '') continue;
    const h = Number(m.homeScore);
    const a = Number(m.awayScore);
    const push = (t: string, r: FormLetter) => {
      const list = map.get(t) ?? [];
      list.push(r);
      map.set(t, list);
    };
    push(m.home.name, h > a ? 'V' : h < a ? 'D' : 'E');
    push(m.away.name, a > h ? 'V' : a < h ? 'D' : 'E');
  }
  return map;
}

export interface Streak {
  label: string;
  team: Team;
  count: number;
}
/** Sequências atuais mais longas: vitórias seguidas, invencibilidade e jejum de vitórias. */
export function streaksOf(l: League): Streak[] {
  const form = formOf(l);
  const team = (name: string) => l.teams.find((t) => t.name === name) ?? { name, short: name.slice(0, 3).toUpperCase() };
  const run = (list: FormLetter[], ok: (r: FormLetter) => boolean) => {
    let n = 0;
    for (let i = list.length - 1; i >= 0 && ok(list[i]); i--) n++;
    return n;
  };
  const best = (label: string, ok: (r: FormLetter) => boolean): Streak | null => {
    let top: Streak | null = null;
    form.forEach((list, name) => {
      const n = run(list, ok);
      if (n >= 2 && (!top || n > top.count)) top = { label, team: team(name), count: n };
    });
    return top;
  };
  return [best('Vitórias seguidas', (r) => r === 'V'), best('Invicto há', (r) => r !== 'D'), best('Sem vencer há', (r) => r !== 'V'), best('Derrotas seguidas', (r) => r === 'D')].filter(Boolean) as Streak[];
}

// ---------------------------------------------------------------- Fórmula 1 (etapa 2)

/** [rodada, nome, circuito, cidade, país, sessões [[código, horário (s)]], vencedor [sigla, nome, id da equipe] | null] */
type RawRace = [number, string, string, string, string, [string, number][], [string, string, string] | null];
export interface RawF1 {
  season: string;
  races: RawRace[];
  round: number;
  drivers: [number, string, string, string, string, string, string, number, number][];
  teams: [number, string, string, number, number][];
  last: [number, string, [number, string, string, string, string, string, number][]] | null;
}

export interface F1Session {
  code: string;
  label: string;
  start: number;
}
export interface F1Race {
  round: number;
  name: string;
  circuit: string;
  city: string;
  country: string;
  sessions: F1Session[];
  /** Horário da corrida. */
  start: number;
  winner?: { code: string; name: string; team: string };
}
export interface F1Driver {
  pos: number;
  code: string;
  name: string;
  number: string;
  team: string;
  teamId: string;
  points: number;
  wins: number;
}
export interface F1Team {
  pos: number;
  name: string;
  id: string;
  points: number;
  wins: number;
}
export interface F1Data {
  season: string;
  races: F1Race[];
  round: number;
  drivers: F1Driver[];
  teams: F1Team[];
  last?: { round: number; name: string; results: { pos: number; code: string; name: string; team: string; teamId: string; time: string; points: number }[] };
}

const SESSION_PT: Record<string, string> = { TL1: 'Treino livre 1', TL2: 'Treino livre 2', TL3: 'Treino livre 3', QS: 'Classificação sprint', SPR: 'Sprint', CLA: 'Classificação', GP: 'Corrida' };

/** Nome do GP em português ("Las Vegas Grand Prix" → "GP de Las Vegas"). */
const GP_PT: Record<string, string> = {
  Australian: 'da Austrália', Chinese: 'da China', Japanese: 'do Japão', Bahrain: 'do Bahrein', 'Saudi Arabian': 'da Arábia Saudita', Miami: 'de Miami',
  'Emilia Romagna': 'da Emília-Romanha', Monaco: 'de Mônaco', Spanish: 'da Espanha', 'Barcelona-Catalunya': 'de Barcelona', Canadian: 'do Canadá', Austrian: 'da Áustria',
  British: 'da Inglaterra', Belgian: 'da Bélgica', Hungarian: 'da Hungria', Dutch: 'da Holanda', Italian: 'da Itália', Azerbaijan: 'do Azerbaijão', Singapore: 'de Singapura',
  'United States': 'dos Estados Unidos', 'Mexico City': 'da Cidade do México', Mexican: 'do México', 'São Paulo': 'de São Paulo', Brazilian: 'de São Paulo', 'Las Vegas': 'de Las Vegas',
  Qatar: 'do Catar', 'Abu Dhabi': 'de Abu Dhabi', Madrid: 'de Madri', Portuguese: 'de Portugal', French: 'da França', German: 'da Alemanha', Russian: 'da Rússia', Turkish: 'da Turquia',
};
export function gpName(raw: string): string {
  const base = raw.replace(/\s*Grand Prix$/i, '').trim();
  return GP_PT[base] ? `GP ${GP_PT[base]}` : `GP ${base}`;
}

/** Cores das equipes (inspiradas, para as barras e os pontos). */
const TEAM_COLOR: Record<string, string> = {
  mercedes: '#27F4D2', ferrari: '#E8002D', red_bull: '#3671C6', mclaren: '#FF8000', aston_martin: '#229971', alpine: '#FF87BC', williams: '#64C4FF',
  rb: '#6692FF', racing_bulls: '#6692FF', sauber: '#52E252', audi: '#BB0A30', haas: '#B6BABD', cadillac: '#C9B26B',
};
export const teamColor = (id: string): string => TEAM_COLOR[id] ?? '#8A8FA3';

export function f1Of(feed: SportsFeed | null): F1Data | null {
  const r = feed?.f1;
  if (!r || !r.races?.length) return null;
  return {
    season: r.season,
    round: r.round,
    races: r.races.map(([round, name, circuit, city, country, s, w]) => {
      const sessions = s.map(([code, t]) => ({ code, label: SESSION_PT[code] ?? code, start: t * 1000 }));
      return { round, name: gpName(name), circuit, city, country, sessions, start: (s.find((x) => x[0] === 'GP')?.[1] ?? s[s.length - 1]?.[1] ?? 0) * 1000, winner: w ? { code: w[0], name: w[1], team: w[2] } : undefined };
    }),
    drivers: r.drivers.map(([pos, code, given, family, number, team, teamId, points, wins]) => ({ pos, code, name: `${given} ${family}`.trim(), number, team, teamId, points, wins })),
    teams: r.teams.map(([pos, name, id, points, wins]) => ({ pos, name, id, points, wins })),
    last: r.last ? { round: r.last[0], name: gpName(r.last[1]), results: r.last[2].map(([pos, code, name, team, teamId, time, points]) => ({ pos, code, name, team, teamId, time, points })) } : undefined,
  };
}

/** Próximo GP (ou o que está acontecendo: até 3 h depois da largada). */
export function nextRace(f: F1Data, now = Date.now()): F1Race | undefined {
  return f.races.find((r) => r.start + 3 * 3600000 > now);
}

/** "Semana do GP": do 7º dia antes do primeiro treino até 3 h depois da corrida. */
export function raceWeek(f: F1Data | null, now = Date.now()): F1Race | undefined {
  if (!f) return undefined;
  const r = nextRace(f, now);
  if (!r || !r.sessions.length) return undefined;
  return r.sessions[0].start - 7 * 86400000 <= now ? r : undefined;
}
