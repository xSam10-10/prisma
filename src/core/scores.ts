import { fetchText } from './net';
import { prefGet } from './storage';
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

function sameTeam(a: string, b: string): boolean {
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
