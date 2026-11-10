// Centro de esportes: gera prisma-sports.json com o calendário da temporada
// (todas as rodadas/fases, com placar dos jogos já encerrados) e a tabela de
// cada campeonato, a partir dos dados públicos da ESPN.
//
// A ESPN só devolve o calendário inteiro pedindo o ano (?dates=2026), em
// arquivos de 1 a 5 MB por liga — pesado demais para a TV. Aqui isso vira um
// arquivo compacto que o app baixa da Release "tops" (workflow sports.yml).
//
// Uso: node scripts/sports/build-sports.mjs out/prisma-sports.json
//      (ESPN_BASE=http://127.0.0.1:8090/espn para testar com o servidor falso)

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const LEAGUES = JSON.parse(readFileSync(new URL('./leagues.json', import.meta.url), 'utf8'));

const SITE = process.env.ESPN_BASE || 'https://site.api.espn.com/apis/site/v2/sports';
const STAND = SITE.includes('/apis/site/v2/') ? SITE.replace('/apis/site/v2/', '/apis/v2/') : SITE;

const get = (o, path) => path.split('.').reduce((v, k) => (v && typeof v === 'object' ? v[k] : undefined), o);

async function json(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'prisma-sports/1.0' } });
      if (r.ok) return await r.json();
      if (r.status < 500) throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      if (i === 2) throw e;
    }
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  return null;
}

const STATE = { pre: 0, in: 1, post: 2 };

/** Fases das copas, em português (slug da ESPN → nome e ordem). */
export const PHASES = {
  'preliminary-round': ['Fase preliminar', 1],
  'first-qualifying-round': ['1ª fase preliminar', 1],
  'second-qualifying-round': ['2ª fase preliminar', 2],
  'third-qualifying-round': ['3ª fase preliminar', 3],
  qualifying: ['Fase preliminar', 3],
  playoff: ['Playoff', 4],
  'playoff-round': ['Playoff', 4],
  'knockout-round-playoffs': ['Playoff', 4],
  'first-round': ['1ª fase', 5],
  'second-round': ['2ª fase', 6],
  'third-round': ['3ª fase', 7],
  'group-stage': ['Fase de grupos', 8],
  'league-phase': ['Fase de liga', 8],
  'round-of-32': ['16 avos de final', 9],
  'round-of-16': ['Oitavas de final', 10],
  quarterfinals: ['Quartas de final', 11],
  semifinals: ['Semifinal', 12],
  'third-place': ['Disputa de 3º lugar', 13],
  final: ['Final', 14],
};

/** "2nd Leg - PAL win 5-4 on penalties" → em português. */
export function notePt(t) {
  if (!t) return '';
  return t
    .replace(/^1st Leg\b/i, 'Ida')
    .replace(/^2nd Leg\b/i, 'Volta')
    .replace(/Tied on aggregate/i, 'empate no agregado')
    .replace(/(\S+) win (\d+-\d+) on penalties/i, '$1 vence por $2 nos pênaltis')
    .replace(/(\S+) win (\d+-\d+) on aggregate/i, '$1 vence por $2 no agregado')
    .replace(/(\S+) advance(s)? on away goals/i, '$1 passa pelos gols fora')
    .replace(/Aggregate:?\s*/i, 'Agregado ')
    .replace(/\s+-\s+/g, ' · ');
}

/**
 * Numera as rodadas de uma liga: agrupa os jogos por período (rodadas ficam
 * separadas por mais de ~30 h sem jogo). Grupos pequenos (jogo adiado num dia
 * solto) entram na rodada do período em que são jogados.
 */
export function assignRounds(events, teamCount) {
  const per = Math.max(1, Math.floor(teamCount / 2));
  const sorted = events.slice().sort((a, b) => a.t - b.t);
  const clusters = [];
  for (const e of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && e.t - last[last.length - 1].t <= 30 * 3600) last.push(e);
    else clusters.push([e]);
  }
  // Um período grande demais (duas rodadas coladas): corta no maior intervalo.
  const split = [];
  for (const c of clusters) {
    let parts = [c];
    while (parts.some((p) => p.length > per * 1.5)) {
      parts = parts.flatMap((p) => {
        if (p.length <= per * 1.5) return [p];
        let at = 1;
        let gap = -1;
        for (let i = 1; i < p.length; i++) {
          const g = p[i].t - p[i - 1].t;
          if (g > gap) {
            gap = g;
            at = i;
          }
        }
        return [p.slice(0, at), p.slice(at)];
      });
    }
    split.push(...parts);
  }
  const teamsOf = (list) => {
    const s = new Set();
    for (const e of list) {
      s.add(e.h);
      s.add(e.a);
    }
    return s;
  };
  // Períodos → rodadas. Metade de rodada antes de uma pausa continua no período seguinte
  // (times diferentes); períodos pequenos com times repetidos são jogos adiados.
  const rounds = [];
  const makeups = [];
  for (const c of split) {
    const last = rounds[rounds.length - 1];
    const ts = teamsOf(c);
    const lt = last ? teamsOf(last) : new Set();
    const disjoint = [...ts].every((t) => !lt.has(t));
    if (last && disjoint && last.length + c.length <= per) last.push(...c);
    else if (c.length >= per * 0.5) rounds.push([...c]);
    else makeups.push(...c);
  }
  // Dentro de uma rodada, cada time joga uma vez: o jogo repetido mais longe do meio da rodada é adiado.
  for (const r of rounds) {
    for (;;) {
      const count = new Map();
      for (const e of r) {
        count.set(e.h, (count.get(e.h) || 0) + 1);
        count.set(e.a, (count.get(e.a) || 0) + 1);
      }
      const dup = r.filter((e) => count.get(e.h) > 1 || count.get(e.a) > 1);
      if (!dup.length && r.length <= per) break;
      const mid = r[Math.floor(r.length / 2)].t;
      const pool = dup.length ? dup : r;
      const worst = pool.reduce((x, y) => (Math.abs(y.t - mid) > Math.abs(x.t - mid) ? y : x));
      r.splice(r.indexOf(worst), 1);
      makeups.push(worst);
    }
  }
  // Pontos corridos em turno e returno têm 2 × (times − 1) rodadas: rodadas a mais
  // (pedaços de rodada separados por uma pausa, como a da Copa) são desfeitas,
  // da menor para a maior, e seus jogos voltam a procurar a rodada certa.
  const expected = 2 * (teamCount - 1);
  while (expected > 0 && rounds.length > expected) {
    let small = 0;
    for (let i = 1; i < rounds.length; i++) if (rounds[i].length < rounds[small].length) small = i;
    makeups.push(...rounds.splice(small, 1)[0]);
  }
  // Jogo adiado: vai para a primeira rodada em que os dois times ficaram sem jogar.
  makeups.sort((x, y) => x.t - y.t);
  for (const e of makeups) {
    let target = rounds.find((r) => r.length < per && !r.some((q) => q.h === e.h || q.a === e.h || q.h === e.a || q.a === e.a));
    if (!target) target = rounds.reduce((best, r) => (!best || Math.abs(r[0].t - e.t) < Math.abs(best[0].t - e.t) ? r : best), null);
    if (target) target.push(e);
  }
  rounds.forEach((r, i) => r.forEach((e) => (e.r = i + 1)));
  return rounds.length;
}

/** Janela da temporada atual: ano civil (Brasil/América do Sul) ou julho→junho (Europa). */
function seasonWindow(span, now = new Date()) {
  const y = now.getUTCFullYear();
  if (span === 'year') return { from: Date.UTC(y, 0, 1), to: Date.UTC(y + 1, 0, 1), years: [y] };
  const start = now.getUTCMonth() >= 6 ? y : y - 1;
  return { from: Date.UTC(start, 6, 1), to: Date.UTC(start + 1, 6, 1), years: [start, start + 1] };
}

async function buildLeague(def, warn) {
  const win = seasonWindow(def.span);
  const raw = [];
  let info = {};
  for (const y of win.years) {
    try {
      const r = await json(`${SITE}/soccer/${def.id}/scoreboard?dates=${y}&limit=1000`);
      if (!r) continue;
      if (r.leagues?.[0] && !info.name) info = r.leagues[0];
      raw.push(...(r.events ?? []));
    } catch (e) {
      warn.push(`${def.id} ${y}: ${e.message}`);
    }
  }
  const teams = [];
  const teamIdx = new Map();
  const team = (c) => {
    const id = String(get(c, 'team.id') ?? get(c, 'team.displayName') ?? '');
    if (teamIdx.has(id)) return teamIdx.get(id);
    const t = c.team ?? {};
    const logo = String(t.logo ?? '');
    // Escudos da ESPN: guarda só o número (o app monta a URL).
    const m = logo.match(/teamlogos\/soccer\/500\/(\d+)\.png/);
    teams.push([String(t.displayName ?? ''), String(t.abbreviation ?? ''), m ? Number(m[1]) : logo, t.color ? String(t.color) : '', t.alternateColor ? String(t.alternateColor) : '']);
    teamIdx.set(id, teams.length - 1);
    return teams.length - 1;
  };
  const seen = new Set();
  const evs = [];
  for (const ev of raw) {
    const ms = Date.parse(ev.date);
    if (!Number.isFinite(ms) || ms < win.from || ms >= win.to || seen.has(ev.id)) continue;
    seen.add(ev.id);
    const comp = ev.competitions?.[0] ?? {};
    const cs = comp.competitors ?? [];
    const h = cs.find((c) => c.homeAway === 'home') ?? cs[0];
    const a = cs.find((c) => c.homeAway === 'away') ?? cs[1];
    if (!h || !a) continue;
    const st = STATE[get(ev, 'status.type.state')] ?? 0;
    const e = {
      id: String(ev.id),
      t: Math.round(ms / 1000),
      h: team(h),
      a: team(a),
      hs: st ? String(h.score ?? '') : '',
      as: st ? String(a.score ?? '') : '',
      st,
      // Pênaltis (copas): "PAL win 5-4 on penalties" vem na nota.
      ph: def.kind === 'copa' ? String(get(ev, 'season.slug') ?? '') : '',
      n: notePt(String(comp.notes?.[0]?.headline ?? comp.notes?.[0]?.text ?? '')),
      // Cancelado/adiado
      x: /postponed|canceled|cancelled|suspended/i.test(String(get(ev, 'status.type.name') ?? '')) ? 1 : 0,
    };
    evs.push(e);
  }
  // Jogo adiado sem data: a ESPN cria outro jogo com a data nova; o antigo sai.
  for (let i = evs.length - 1; i >= 0; i--) if (evs[i].x) evs.splice(i, 1);
  if (def.kind === 'liga') assignRounds(evs, Math.max(teams.length, 2));

  // Tabela (grupos nas copas)
  let tables = [];
  try {
    const r = await json(`${STAND}/soccer/${def.id}/standings`);
    const groups = (r?.children ?? []).length ? r.children : r ? [r] : [];
    tables = groups
      .map((g) => {
        const entries = get(g, 'standings.entries') ?? [];
        const rows = entries.map((en, i) => {
          const s = en.stats ?? [];
          const v = (...names) => {
            for (const n of names) {
              const x = s.find((q) => q.name === n || q.abbreviation === n);
              if (x) return Number(x.value ?? 0) || 0;
            }
            return 0;
          };
          const logos = get(en, 'team.logos') ?? [];
          const href = String(logos[0]?.href ?? '');
          const m = href.match(/teamlogos\/soccer\/500\/(\d+)\.png/);
          return [v('rank') || i + 1, String(get(en, 'team.displayName') ?? ''), String(get(en, 'team.abbreviation') ?? ''), m ? Number(m[1]) : href, v('points'), v('gamesPlayed'), v('wins'), v('ties'), v('losses'), v('pointsFor'), v('pointsAgainst'), v('pointDifferential'), String(get(en, 'note.color') ?? '')];
        });
        rows.sort((x, y) => x[0] - y[0]);
        return { n: String(g.name ?? g.abbreviation ?? ''), rows };
      })
      .filter((t) => t.rows.length);
  } catch (e) {
    warn.push(`${def.id} tabela: ${e.message}`);
  }

  // Artilheiros e assistências (ESPN): [nome, time, escudo, gols ou assistências, jogos]
  const leaders = { sc: [], as: [] };
  try {
    const r = await json(`${SITE}/soccer/${def.id}/statistics`);
    for (const s of r?.stats ?? []) {
      const key = s.name === 'goalsLeaders' ? 'sc' : s.name === 'assistsLeaders' ? 'as' : '';
      if (!key) continue;
      leaders[key] = (s.leaders ?? []).slice(0, key === 'sc' ? 10 : 5).map((l) => {
        const t = l.athlete?.team ?? {};
        const href = String(t.logos?.[0]?.href ?? '');
        const m = href.match(/teamlogos\/soccer\/500\/(\d+)\.png/);
        const games = Number((l.athlete?.statistics ?? []).find((x) => x.name === 'appearances')?.value ?? 0) || Number(String(l.displayValue ?? '').match(/Matches: (\d+)/)?.[1] ?? 0);
        return [String(l.athlete?.displayName ?? ''), String(t.displayName ?? t.name ?? ''), m ? Number(m[1]) : href, Number(l.value ?? 0), games];
      });
    }
  } catch (e) {
    warn.push(`${def.id} artilheiros: ${e.message}`);
  }

  evs.sort((x, y) => x.t - y.t);
  if (!evs.length) warn.push(`${def.id}: nenhum jogo na temporada`);
  return {
    id: def.id,
    season: String(get(info, 'season.displayName') ?? get(info, 'season.year') ?? ''),
    logo: String(get(info, 'logos.0.href') ?? ''),
    teams,
    // [id, horário (s), casa, fora, gols casa, gols fora, estado 0/1/2, rodada ou fase, nota, adiado]
    ev: evs.map((e) => [e.id, e.t, e.h, e.a, e.hs, e.as, e.st, def.kind === 'liga' ? e.r ?? 0 : e.ph, e.n, e.x]),
    tables,
    sc: leaders.sc,
    as: leaders.as,
  };
}

// ---------------------------------------------------------------- Fórmula 1 (Jolpica, sucessora do Ergast)
const F1 = process.env.F1_BASE || 'https://api.jolpi.ca/ergast/f1';
const SESSIONS = [
  ['FirstPractice', 'TL1'],
  ['SprintQualifying', 'QS'],
  ['SecondPractice', 'TL2'],
  ['ThirdPractice', 'TL3'],
  ['Sprint', 'SPR'],
  ['Qualifying', 'CLA'],
];
const sec = (d, t) => (d ? Math.round(Date.parse(`${d}T${t || '12:00:00Z'}`) / 1000) : 0);

export function f1Compact(cal, drivers, teams, winners, last) {
  const races = (cal?.MRData?.RaceTable?.Races ?? []).map((r) => {
    const s = SESSIONS.filter(([k]) => r[k]).map(([k, code]) => [code, sec(r[k].date, r[k].time)]);
    s.push(['GP', sec(r.date, r.time)]);
    s.sort((a, b) => a[1] - b[1]);
    const w = (winners?.MRData?.RaceTable?.Races ?? []).find((x) => x.round === r.round)?.Results?.[0];
    // [rodada, nome, circuito, cidade, país, sessões, vencedor (sigla, nome, equipe)]
    return [Number(r.round), String(r.raceName ?? ''), String(r.Circuit?.circuitName ?? ''), String(r.Circuit?.Location?.locality ?? ''), String(r.Circuit?.Location?.country ?? ''), s, w ? [w.Driver?.code ?? '', `${w.Driver?.givenName ?? ''} ${w.Driver?.familyName ?? ''}`.trim(), w.Constructor?.constructorId ?? ''] : null];
  });
  const dl = drivers?.MRData?.StandingsTable?.StandingsLists?.[0];
  const tl = teams?.MRData?.StandingsTable?.StandingsLists?.[0];
  const lr = last?.MRData?.RaceTable?.Races?.[0];
  return {
    season: String(cal?.MRData?.RaceTable?.season ?? ''),
    races,
    round: Number(dl?.round ?? 0),
    // [pos, sigla, nome, sobrenome, número, equipe (nome), id da equipe, pontos, vitórias]
    drivers: (dl?.DriverStandings ?? []).map((d) => [Number(d.position ?? d.positionText ?? 0) || 0, d.Driver?.code ?? '', d.Driver?.givenName ?? '', d.Driver?.familyName ?? '', d.Driver?.permanentNumber ?? '', d.Constructors?.[0]?.name ?? '', d.Constructors?.[0]?.constructorId ?? '', Number(d.points ?? 0), Number(d.wins ?? 0)]),
    // [pos, equipe, id, pontos, vitórias]
    teams: (tl?.ConstructorStandings ?? []).map((c) => [Number(c.position ?? 0) || 0, c.Constructor?.name ?? '', c.Constructor?.constructorId ?? '', Number(c.points ?? 0), Number(c.wins ?? 0)]),
    // Último GP: [rodada, nome, [[pos, sigla, nome, equipe, id, tempo/status, pontos]…10]]
    last: lr ? [Number(lr.round), lr.raceName ?? '', (lr.Results ?? []).slice(0, 10).map((x) => [Number(x.position), x.Driver?.code ?? '', `${x.Driver?.givenName ?? ''} ${x.Driver?.familyName ?? ''}`.trim(), x.Constructor?.name ?? '', x.Constructor?.constructorId ?? '', x.Time?.time ?? x.status ?? '', Number(x.points ?? 0)])] : null,
  };
}

async function buildF1(warn) {
  try {
    const [cal, drivers, teams, winners, last] = await Promise.all([
      json(`${F1}/current.json`),
      json(`${F1}/current/driverStandings.json`),
      json(`${F1}/current/constructorStandings.json`),
      json(`${F1}/current/results/1.json?limit=100`),
      json(`${F1}/current/last/results.json`),
    ]);
    const f = f1Compact(cal, drivers, teams, winners, last);
    if (!f.races.length) warn.push('F1: calendário vazio');
    return f;
  } catch (e) {
    warn.push(`F1: ${e.message}`);
    return null;
  }
}

async function main() {
  const out = process.argv[2] || 'out/prisma-sports.json';
  const warn = [];
  const leagues = [];
  for (const def of LEAGUES) {
    try {
      leagues.push(await buildLeague(def, warn));
    } catch (e) {
      warn.push(`${def.id}: ${e.message}`);
    }
  }
  const f1 = await buildF1(warn);
  const data = { v: 1, updated: new Date().toISOString(), leagues, f1, warn };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(data));
  for (const l of leagues) console.log(`${l.id}: ${l.ev.length} jogos, ${l.teams.length} times, ${l.tables.length} tabela(s), ${l.sc.length} artilheiros`);
  if (f1) console.log(`F1 ${f1.season}: ${f1.races.length} GPs, ${f1.drivers.length} pilotos, último GP ${f1.last?.[1] ?? '—'}`);
  for (const w of warn) console.log('aviso: ' + w);
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('build-sports.mjs')) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
