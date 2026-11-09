// Gera "prisma-tops.json": Top 10 dos streamings, por gênero, especiais e o
// ranking de canais. Roda no GitHub Actions (workflow tops.yml) algumas vezes
// por dia e publica o arquivo na Release "tops"; os apps baixam de lá.
//
// Fontes (todas públicas):
//  - Netflix: ranking OFICIAL semanal do Brasil (top10.netflix.com, arquivo
//    TSV aberto, sem chave).
//  - TMDB (precisa do secret TMDB_KEY, chave v3 grátis): mais populares em cada
//    streaming no Brasil (provedores do JustWatch/TMDB), em alta na semana,
//    gêneros (terror, comédia…), lançamentos no streaming, aclamados, doramas,
//    novelas turcas, animes e nacionais. Também traduz os títulos da Netflix
//    (vêm em inglês) para o nome em português, que é o que a lista IPTV usa.
//  - Canais: scripts/tops/canais.json (ranking editável no GitHub).
//
// Uso: node scripts/tops/build-tops.mjs <saída.json>
// Testes: NETFLIX_TSV=<url> TMDB_BASE=<url> (servidor falso).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const NETFLIX_TSV = process.env.NETFLIX_TSV || 'https://www.netflix.com/tudum/top10/data/all-weeks-countries.tsv';
const TMDB = process.env.TMDB_BASE || 'https://api.themoviedb.org/3';
const KEY = (process.env.TMDB_KEY || '').trim();
const PER_LIST = 20;
const ST_GENRE_MAX = 30;

/** Streamings do PRISMA (mesmos ids de src/core/vod.ts) × nome do provedor no TMDB. */
export const PROVIDERS = [
  ['netflix', 'Netflix', /^netflix$/i],
  ['hbo', 'HBO Max', /^(hbo )?max$|^hbo max$/i],
  ['disney', 'Disney+', /^disney( plus|\+)$/i],
  ['apple', 'Apple TV', /^apple tv( plus|\+)?$/i],
  ['prime', 'Prime Video', /^amazon prime video$|^prime video$/i],
  ['paramount', 'Paramount+', /^paramount( plus|\+)$/i],
  ['globoplay', 'Globoplay', /^globoplay$/i],
  ['crunchyroll', 'Crunchyroll', /^crunchyroll$/i],
  ['discovery', 'Discovery+', /^discovery( plus|\+)$/i],
  ['claro', 'Claro Vídeo', /^claro ?video$/i],
  ['directv', 'DirecTV GO', /^directv go$/i],
  ['lionsgate', 'Lionsgate', /^lionsgate\+?$|^starzplay$/i],
];

const MOVIE_GENRES = [
  [27, 'Terror'], [28, 'Ação'], [35, 'Comédia'], [53, 'Suspense'], [878, 'Ficção científica'], [18, 'Drama'],
  [10749, 'Romance'], [16, 'Animação'], [80, 'Crime'], [10751, 'Família'], [99, 'Documentários'], [14, 'Fantasia'],
];
const TV_GENRES = [
  [80, 'Crime'], [18, 'Drama'], [35, 'Comédia'], [9648, 'Mistério'], [10765, 'Ficção e fantasia'], [10759, 'Ação e aventura'],
  [16, 'Animação'], [99, 'Documentários'], [10764, 'Reality shows'], [10762, 'Infantil'],
];

// ---------------------------------------------------------------- Netflix (oficial)

/** Lê o TSV oficial e devolve o Top 10 da semana mais recente do país. */
export function parseNetflixTsv(tsv, country = 'BR') {
  const lines = tsv.split(/\r?\n/).filter(Boolean);
  const head = lines.shift().split('\t');
  const col = (n) => head.indexOf(n);
  const ci = { iso: col('country_iso2'), week: col('week'), cat: col('category'), rank: col('weekly_rank'), show: col('show_title'), season: col('season_title') };
  if (Object.values(ci).some((i) => i < 0 && i !== ci.season)) throw new Error('TSV da Netflix com colunas inesperadas: ' + head.join(','));
  let week = '';
  const rows = [];
  for (const l of lines) {
    const c = l.split('\t');
    if (c[ci.iso] !== country) continue;
    rows.push(c);
    if (c[ci.week] > week) week = c[ci.week];
  }
  const pick = (re) =>
    rows
      .filter((c) => c[ci.week] === week && re.test(c[ci.cat]))
      .sort((a, b) => Number(a[ci.rank]) - Number(b[ci.rank]))
      .map((c) => ({ t: c[ci.show], s: ci.season >= 0 && c[ci.season] && c[ci.season] !== 'N/A' ? c[ci.season] : undefined }))
      // A mesma série pode ocupar várias posições (uma por temporada): fica a melhor.
      .filter((x, i, arr) => arr.findIndex((y) => y.t === x.t) === i);
  return { week, movie: pick(/^films?/i), tv: pick(/^tv/i) };
}

// ---------------------------------------------------------------- TMDB

let calls = 0;
async function tmdb(path, params = {}) {
  const q = new URLSearchParams({ api_key: KEY, language: 'pt-BR', ...params });
  for (let i = 0; i < 3; i++) {
    calls++;
    const r = await fetch(`${TMDB}${path}?${q}`);
    if (r.status === 429) {
      await new Promise((ok) => setTimeout(ok, 1500 * (i + 1)));
      continue;
    }
    if (!r.ok) throw new Error(`TMDB ${path}: ${r.status}`);
    return r.json();
  }
  throw new Error(`TMDB ${path}: muitas tentativas`);
}

const yearOf = (d) => (d ? Number(String(d).slice(0, 4)) || undefined : undefined);

/** Item compacto: i=id TMDB, t=título em português, o=original (se diferente), y=ano, r=nota. */
export function compact(raw, type) {
  const t = raw.title || raw.name || '';
  const o = raw.original_title || raw.original_name || '';
  const it = { i: raw.id, t };
  if (o && o !== t) it.o = o;
  const y = yearOf(raw.release_date || raw.first_air_date);
  if (y) it.y = y;
  if (raw.vote_average) it.r = Math.round(raw.vote_average * 10) / 10;
  if (type) it.k = type === 'movie' ? 'm' : 's';
  return it;
}

async function discover(type, params, pages = 1, max = PER_LIST) {
  const out = [];
  for (let p = 1; p <= pages && out.length < max; p++) {
    const r = await tmdb(`/discover/${type}`, { watch_region: 'BR', include_adult: 'false', page: String(p), ...params });
    for (const x of r.results ?? []) if (!out.some((o) => o.i === x.id)) out.push(compact(x));
    if ((r.total_pages ?? 1) <= p) break;
  }
  return out.slice(0, max);
}

async function listOf(path, params = {}) {
  const r = await tmdb(path, { region: 'BR', ...params });
  return (r.results ?? []).slice(0, PER_LIST).map((x) => compact(x));
}

/** Procura no TMDB o título (em inglês) que a Netflix publica. */
async function resolveNetflix(entry, type) {
  try {
    const r = await tmdb(`/search/${type}`, { query: entry.t });
    const hit = (r.results ?? [])[0];
    if (!hit) return { t: entry.t };
    const it = compact(hit);
    // O nome em inglês também ajuda a achar na lista IPTV.
    if (entry.t !== it.t && entry.t !== it.o) it.e = entry.t;
    return it;
  } catch {
    return { t: entry.t };
  }
}

// ---------------------------------------------------------------- Montagem

function isoDay(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export async function build({ log = console.log } = {}) {
  const lists = [];
  const warn = [];
  const add = (l) => {
    if (l.items?.length) lists.push(l);
  };
  const safe = async (name, fn) => {
    try {
      await fn();
    } catch (e) {
      warn.push(`${name}: ${e.message}`);
      log(`aviso: ${name}: ${e.message}`);
    }
  };

  // 1) Netflix oficial
  await safe('Netflix oficial', async () => {
    const r = await fetch(NETFLIX_TSV);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const nf = parseNetflixTsv(await r.text());
    const label = nf.week ? `semana até ${nf.week.split('-').reverse().join('/')}` : 'semana';
    for (const type of ['movie', 'tv']) {
      const raw = nf[type];
      const items = KEY ? await Promise.all(raw.map((e) => resolveNetflix(e, type))) : raw.map((e) => ({ t: e.t }));
      add({ id: `netflix-oficial-${type}`, kind: type, group: 'streaming', sid: 'netflix', title: 'Top 10 Netflix', src: `Ranking oficial da Netflix no Brasil (${label})`, items });
    }
  });

  if (!KEY) {
    warn.push('Sem TMDB_KEY: só o ranking da Netflix (títulos em inglês) e os canais.');
  } else {
    // 2) Mais populares em cada streaming (Brasil)
    await safe('Streamings', async () => {
      for (const type of ['movie', 'tv']) {
        const prov = await tmdb(`/watch/providers/${type}`, { watch_region: 'BR' });
        const all = (prov.results ?? []).sort((a, b) => (a.display_priorities?.BR ?? a.display_priority ?? 99) - (b.display_priorities?.BR ?? b.display_priority ?? 99));
        for (const [sid, name, re] of PROVIDERS) {
          if (sid === 'netflix' && lists.some((l) => l.id === `netflix-oficial-${type}`)) continue;
          const p = all.find((x) => re.test(x.provider_name.trim()));
          if (!p) continue;
          await safe(`${name} ${type}`, async () => {
            const items = await discover(type, { with_watch_providers: String(p.provider_id), with_watch_monetization_types: 'flatrate', sort_by: 'popularity.desc', 'vote_count.gte': '10' });
            add({ id: `${sid}-${type}`, kind: type, group: 'streaming', sid, title: `Top 10 ${name}`, src: `Mais populares no ${name} no Brasil (TMDB)`, items });
          });
          // Catálogo do streaming (os 200 mais populares no Brasil): o app usa para montar
          // "Todos · <streaming>" quando a lista não separa os títulos por streaming nas categorias.
          await safe(`${name} catálogo ${type}`, async () => {
            const items = await discover(type, { with_watch_providers: String(p.provider_id), with_watch_monetization_types: 'flatrate', sort_by: 'popularity.desc' }, 10, 200);
            add({ id: `${sid}-all-${type}`, kind: type, group: 'stall', sid, title: `Todos · ${name}`, src: `Catálogo do ${name} no Brasil (TMDB)`, items: items.map(({ t, o, y }) => (o ? { t, o, y } : { t, y })) });
          });
          // Por gênero dentro do streaming: até 30 candidatos (o app completa os 10 com o que existir na lista)
          for (const [g, gname] of type === 'movie' ? MOVIE_GENRES : TV_GENRES) {
            await safe(`${name} ${gname} ${type}`, async () => {
              const items = await discover(type, { with_watch_providers: String(p.provider_id), with_watch_monetization_types: 'flatrate', with_genres: String(g), sort_by: 'popularity.desc', 'vote_count.gte': '10' }, 2, ST_GENRE_MAX);
              add({ id: `${sid}-g${g}-${type}`, kind: type, group: 'stgenero', sid, title: gname, src: `${gname} no ${name} (TMDB)`, items: items.map(({ r, ...x }) => x) });
            });
          }
        }
      }
    });

    // 3) Em alta na semana
    for (const type of ['movie', 'tv']) {
      await safe(`Em alta ${type}`, async () => {
        const items = [];
        for (let p = 1; p <= 2; p++) items.push(...(await tmdb(`/trending/${type}/week`, { page: String(p) })).results.map((x) => compact(x)));
        add({ id: `semana-${type}`, kind: type, group: 'geral', title: 'Em alta na semana', src: 'Mais vistos e comentados da semana (TMDB)', items: items.slice(0, PER_LIST) });
      });
    }

    // 4) Lançamentos que chegaram ao streaming (filmes) e séries novas
    await safe('Lançamentos', async () => {
      const from = isoDay(new Date(Date.now() - 120 * 86400000));
      add({ id: 'lancamentos-movie', kind: 'movie', group: 'geral', title: 'Chegaram ao streaming', src: 'Lançamentos digitais dos últimos meses (TMDB)', items: await discover('movie', { sort_by: 'popularity.desc', with_release_type: '4|5', 'release_date.gte': from, region: 'BR', 'vote_count.gte': '20' }, 2) });
      add({ id: 'lancamentos-tv', kind: 'tv', group: 'geral', title: 'Séries novas', src: 'Estreias dos últimos meses (TMDB)', items: await discover('tv', { sort_by: 'popularity.desc', 'first_air_date.gte': from, 'vote_count.gte': '10' }, 2) });
    });

    // 5) Aclamados (crítica e público)
    for (const type of ['movie', 'tv']) {
      await safe(`Aclamados ${type}`, async () => {
        add({ id: `aclamados-${type}`, kind: type, group: 'geral', title: 'Mais aclamados', src: 'Maiores notas do público no TMDB, de todos os tempos', items: await listOf(`/${type}/top_rated`) });
      });
    }

    // 6) Gêneros
    for (const [type, genres] of [['movie', MOVIE_GENRES], ['tv', TV_GENRES]]) {
      for (const [g, name] of genres) {
        await safe(`${name} ${type}`, async () => {
          const items = await discover(type, { with_genres: String(g), sort_by: 'popularity.desc', 'vote_count.gte': type === 'movie' ? '300' : '100', 'vote_average.gte': '6' }, 2);
          add({ id: `genero-${g}-${type}`, kind: type, group: 'genero', title: `Top 10 ${name}`, src: `${name}: populares e bem avaliados (TMDB)`, items });
        });
      }
    }

    // 7) Especiais (combinam com categorias comuns das listas brasileiras)
    const specials = [
      ['doramas-tv', 'tv', 'Top 10 Doramas', 'Séries coreanas em alta (TMDB)', { with_original_language: 'ko', sort_by: 'popularity.desc', 'vote_count.gte': '30' }],
      ['turcas-tv', 'tv', 'Top 10 Novelas turcas', 'Novelas e séries da Turquia em alta (TMDB)', { with_original_language: 'tr', sort_by: 'popularity.desc', 'vote_count.gte': '5' }],
      ['anime-tv', 'tv', 'Top 10 Animes', 'Animes em alta (TMDB)', { with_genres: '16', with_original_language: 'ja', sort_by: 'popularity.desc', 'vote_count.gte': '50' }],
      ['anime-movie', 'movie', 'Top 10 Animes', 'Filmes de anime em alta (TMDB)', { with_genres: '16', with_original_language: 'ja', sort_by: 'popularity.desc', 'vote_count.gte': '50' }],
      ['nacionais-movie', 'movie', 'Top 10 Nacionais', 'Filmes brasileiros em alta (TMDB)', { with_origin_country: 'BR', sort_by: 'popularity.desc', 'vote_count.gte': '10' }],
      ['nacionais-tv', 'tv', 'Top 10 Nacionais', 'Séries e novelas brasileiras em alta (TMDB)', { with_origin_country: 'BR', sort_by: 'popularity.desc', 'vote_count.gte': '5' }],
    ];
    for (const [id, type, title, src, params] of specials) {
      await safe(title, async () => add({ id, kind: type, group: 'especial', title, src, items: await discover(type, params, 2) }));
    }
  }

  // 7a) Chegando esta semana: filmes que chegam ao digital e séries que estreiam (hoje −2 a +8 dias)
  if (KEY) {
    await safe('Estreias', async () => {
      const day = (n) => isoDay(new Date(Date.now() + n * 86400000));
      const withDate = (raw, d) => ({ ...compact(raw), d, ...(raw.poster_path ? { p: raw.poster_path } : {}) });
      const mv = await tmdb('/discover/movie', { region: 'BR', watch_region: 'BR', with_release_type: '4|5', 'release_date.gte': day(-2), 'release_date.lte': day(8), sort_by: 'popularity.desc' });
      const tv = await tmdb('/discover/tv', { watch_region: 'BR', 'first_air_date.gte': day(-2), 'first_air_date.lte': day(8), sort_by: 'popularity.desc', 'vote_count.gte': '0', with_watch_monetization_types: 'flatrate' });
      add({ id: 'estreias-movie', kind: 'movie', group: 'estreias', title: 'Chegando esta semana', src: 'Lançamentos digitais da semana (TMDB)', items: (mv.results ?? []).slice(0, 14).map((x) => withDate(x, x.release_date)) });
      add({ id: 'estreias-tv', kind: 'tv', group: 'estreias', title: 'Chegando esta semana', src: 'Séries que estreiam esta semana (TMDB)', items: (tv.results ?? []).slice(0, 14).map((x) => withDate(x, x.first_air_date)) });
    });
  }

  // 7b) Coleções e sagas: a que coleção pertencem os filmes das listas (até 300 consultas),
  // depois os filmes de cada coleção em ordem de lançamento.
  if (KEY) {
    await safe('Coleções', async () => {
      const ids = [];
      for (const l of lists) if (l.kind === 'movie') for (const it of l.items) if (it.i && !ids.includes(it.i)) ids.push(it.i);
      const cols = new Map();
      for (const id of ids.slice(0, 300)) {
        try {
          const m = await tmdb(`/movie/${id}`);
          const c = m.belongs_to_collection;
          if (c && c.id) cols.set(c.id, { name: c.name, b: c.backdrop_path || undefined, n: (cols.get(c.id)?.n ?? 0) + 1 });
        } catch {
          /* filme sem detalhe: ignora */
        }
      }
      const best = [...cols.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 40);
      for (const [cid, c] of best) {
        await safe(`Coleção ${c.name}`, async () => {
          const r = await tmdb(`/collection/${cid}`);
          const parts = (r.parts ?? []).filter((x) => x.release_date).sort((a, b) => String(a.release_date).localeCompare(String(b.release_date)));
          if (parts.length < 2) return;
          add({ id: `colecao-${cid}`, kind: 'movie', group: 'colecao', title: (r.name || c.name).replace(/\s*[-–]\s*Cole[cç][aã]o$|\s*Cole[cç][aã]o\s*$/i, '').replace(/^Cole[cç][aã]o\s+/i, '').replace(/[\s:–-]+$/, '') || c.name, src: 'Coleção (TMDB), em ordem de lançamento', b: r.backdrop_path || c.b, items: parts.map((x) => compact(x)) });
        });
      }
    });
  }

  // 8) Canais (ranking editável)
  const channels = JSON.parse(readFileSync(join(here, 'canais.json'), 'utf8')).canais;

  log(`listas: ${lists.length} · chamadas TMDB: ${calls} · avisos: ${warn.length}`);
  return { v: 1, updated: new Date().toISOString(), lists, channels, warn };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = process.argv[2] || 'out/prisma-tops.json';
  const data = await build();
  if (!data.lists.length && !process.env.ALLOW_EMPTY) {
    console.error('Nenhuma lista gerada (fontes fora do ar?). Mantendo o arquivo anterior.');
    process.exit(1);
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(data));
  console.log(`${out}: ${(JSON.stringify(data).length / 1024).toFixed(0)} KB`);
}
