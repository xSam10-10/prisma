// Servidor Xtream falso para testar o PRISMA sem a lista real.
// Uso: node test/fake-xtream.mjs   (porta 8090, usuário "teste", senha "1234")
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const demo = fileURLToPath(new URL('../public/demo/', import.meta.url));
const PORT = Number(process.env.PORT || 8090);
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

const live = [
  { num: 9, name: 'CANAL MULTIÁUDIO HD', stream_id: 9, category_id: '10', epg_channel_id: '', dir: 'MULTI' },
  { num: 1, name: 'Globo SP FHD', stream_id: 1, category_id: '10', epg_channel_id: 'globo', dir: 'prisma1' },
  { num: 443, name: 'GLOBO NEWS 4K', stream_id: 5443, category_id: '60', epg_channel_id: '', dir: 'prisma3' },
  { num: 1125, name: 'SPORTV 2 FHD [H265]', stream_id: 6125, category_id: '60', epg_channel_id: '', dir: 'prisma2' },
  { num: 1058, name: 'REDETV FHD [H265]', stream_id: 6058, category_id: '60', epg_channel_id: '', dir: 'prisma1' },
  { num: 802, name: 'Jovem Pan News 4K FHDR', stream_id: 5802, category_id: '60', epg_channel_id: '', dir: 'prisma4' },
  { num: 2, name: 'SBT HD', stream_id: 2, category_id: '10', epg_channel_id: 'sbt', dir: 'prisma2' },
  { num: 30, name: 'ESPN HD', stream_id: 30, category_id: '20', epg_channel_id: 'espn', dir: 'prisma2' },
  { num: 31, name: 'SporTV FHD', stream_id: 31, category_id: '20', epg_channel_id: 'sportv', dir: 'prisma3' },
  { num: 50, name: 'GloboNews', stream_id: 50, category_id: '30', epg_channel_id: 'gnews', dir: 'prisma3' },
  { num: 70, name: 'Warner HD', stream_id: 70, category_id: '40', epg_channel_id: 'warner', dir: 'prisma4' },
  { num: 71, name: 'Canal Quebrado', stream_id: 71, category_id: '40', epg_channel_id: '', dir: null },
];
// Categorias parecidas com as da Goldcard
[['70', 'REDE BANDEIRANTES', ['BAND SP FHD', 'BAND RJ FHD [ALT]', 'BAND NEWS HD']], ['71', 'CANAIS | UHD 4K', ['GLOBO SP 4K FHDR', 'AXN 4K']],
 ['72', 'GLOBO | CAPITAIS', ['GLOBO RJ FHD', 'GLOBO RJ FHD [ALT]', 'GLOBO RJ HD', 'GLOBO RJ SD']], ['73', 'A FAZENDA 2026', ['A FAZENDA 18 SINAL 01']],
 ['74', 'PPV | AMAZON PRIME', ['PRIME VIDEO 01 FHD']], ['76', 'CANAIS 24H | DESENHOS', ['Zé Buscapé', 'Zatch Bell', 'YU-YU-Hakusho', 'Xuxa só para Baixinhos 2', 'X-Men 2']],
 ['77', 'CANAIS 24H | PREMIERE', ['Premiere 24h Clássicos']], ['78', 'EVENTOS EM DESTAQUE', ['Evento 01 FHD']], ['79', 'CANAIS 24H | SERIES', ['Chaves 24h']], ['80', 'CANAIS 24H | LIVE SHOWS', ['Show Ao Vivo 01']], ['75', 'FILMES E SÉRIES', ['A&E FHD', 'AMC FHD', 'ANIMAL PLANET FHD']], ['81', 'ADULTOS +18', ['ADULTOS HD 01', 'ADULTOS HD 02', 'ADULTOS HD 03', 'XXX (1)', 'XXX (2)', 'XXX FHD [ALT]', 'XXX FHD']]]
  .forEach(([cid, , names], k) => names.forEach((name, j) => live.push({ num: 900 + k * 10 + j, name, stream_id: 7000 + k * 10 + j, category_id: cid, epg_channel_id: '', dir: 'prisma1' })));
// ESPN HD também em Abertos (painéis XUI mandam category_ids)
live.find((c) => c.stream_id === 30).category_ids = ['20', '10'];
for (let i = 0; i < 400; i++) live.push({ num: 100 + i, name: `Canal Extra ${i + 1}`, stream_id: 100 + i, category_id: '50', epg_channel_id: '', dir: ['prisma1', 'prisma2', 'prisma3', 'prisma4'][i % 4] });

// ---- Filmes e séries de teste ----
const VOD_CATS = [['101', 'FILMES | NETFLIX'], ['102', 'FILMES | HBO MAX'], ['103', 'FILMES | DISNEY+'], ['104', 'LANÇAMENTOS 2026'], ['105', 'FILMES | AÇÃO'], ['106', 'DUBLAGEM NAO OFICIAL']];
const SER_CATS = [['201', 'SÉRIES | NETFLIX'], ['202', 'SÉRIES | PRIME VIDEO'], ['203', 'ANIMES | CRUNCHYROLL'], ['204', 'SÉRIES | GLOBOPLAY'],
  // Mais streamings (para testar o carrossel de logotipos)
  ['205', 'SÉRIES | HBO MAX'], ['206', 'SÉRIES | DISNEY+'], ['207', 'SÉRIES | APPLE TV+'], ['208', 'SÉRIES | PARAMOUNT+'], ['209', 'SÉRIES | STAR+'], ['210', 'SÉRIES | DISCOVERY+'],
  ['211', 'ANIMES | FUNIMATION NOW'], ['212', 'SÉRIES | LIONSGATE+'], ['213', 'CLARO VIDEO'], ['214', 'SBT+'], ['215', 'DIRECTV GO'], ['216', 'AMC+']];
const TITLES = ['Horizonte Perdido', 'A Última Estação', 'Código Vermelho', 'Noite em Lisboa', 'O Jardim de Inverno', 'Fronteira Sul', 'Maré Alta', 'Cidade de Vidro', 'O Sétimo Andar', 'Luz do Norte', 'Rota 66', 'O Relojoeiro', 'Ventos de Agosto', 'Plano B', 'Sombras do Rio', 'Estrela Cadente'];
const PAL = ['#C8264B', '#2B5BD7', '#7A2E9C', '#B4531F', '#0E7490', '#1F8A5B', '#8A6D1F'];
const vods = Array.from({ length: 64 }, (_, i) => ({
  name: `${TITLES[i % TITLES.length]}${i >= TITLES.length ? ' ' + (Math.floor(i / TITLES.length) + 1) : ''} (${2018 + (i % 9)})`,
  stream_id: 3000 + i, stream_icon: `http://127.0.0.1:${PORT}/poster/m${i}.svg`, category_id: VOD_CATS[i % VOD_CATS.length][0],
  container_extension: 'mp4', rating: (5 + (i * 37) % 50 / 10).toFixed(1), added: String(1790000000 - i * 3600), year: String(2018 + (i % 9)),
}));
// Mesmo filme em outras versões (para "versões num só card")
vods.push({ name: 'Rota 66 [LEG] (2019)', stream_id: 3900, stream_icon: `http://127.0.0.1:${PORT}/poster/m10.svg`, category_id: '105', container_extension: 'mp4', rating: '7.0', added: String(1789990000), year: '2019' });
vods.push({ name: 'Rota 66 4K (2019)', stream_id: 3901, stream_icon: `http://127.0.0.1:${PORT}/poster/m10.svg`, category_id: '104', container_extension: 'mp4', rating: '7.0', added: String(1789990001), year: '2019' });
const SERIES_NAMES = ['Os Herdeiros', 'Turno da Noite', 'Vila Esperança', 'Detetive Lua', 'Reino de Aço', 'Naruto Shippuden', 'Attack on Titan', 'Café com Lua', 'Rua Augusta', 'O Mecanismo'];
const seriesList = Array.from({ length: 30 }, (_, i) => ({
  name: SERIES_NAMES[i % SERIES_NAMES.length] + (i >= SERIES_NAMES.length ? ' ' + (Math.floor(i / SERIES_NAMES.length) + 1) : ''),
  series_id: 4000 + i, cover: `http://127.0.0.1:${PORT}/poster/s${i}.svg`, category_id: SER_CATS[(i % SERIES_NAMES.length) >= 5 && (i % SERIES_NAMES.length) <= 6 ? 2 : i % 2 === 0 ? 0 : (i % 3 === 0 ? 3 : 1)][0],
  rating: (6 + (i % 4)).toFixed(1), last_modified: String(1790000000 - i * 7200), releaseDate: `${2015 + (i % 10)}-03-01`,
}));
for (let k = 4; k < SER_CATS.length; k++) seriesList.push({ name: `Série ${SER_CATS[k][1].split('|').pop().trim()}`, series_id: 4100 + k, cover: `http://127.0.0.1:${PORT}/poster/s${k}.svg`, category_id: SER_CATS[k][0], rating: '7.5', last_modified: String(1789000000 - k), releaseDate: '2024-01-01' });
function poster(id) {
  const n = Number(id.slice(1)); const c = PAL[n % PAL.length];
  const name = (id[0] === 'm' ? vods[n]?.name : seriesList[n]?.name) || 'PRISMA';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#0B0B12"/></linearGradient></defs><rect width="300" height="450" fill="url(#g)"/><circle cx="230" cy="110" r="90" fill="#ffffff22"/><text x="20" y="380" font-family="sans-serif" font-size="30" font-weight="800" fill="#fff">${name.replace(/ \(.*\)/, '').toUpperCase().slice(0, 16)}</text><text x="20" y="415" font-family="sans-serif" font-size="18" fill="#ffffffaa">${id[0] === 'm' ? 'FILME' : 'SÉRIE'}</text></svg>`;
}

// Canais que guardam gravações (voltar na programação)
for (const c of live) if ([1, 30, 50].includes(c.stream_id)) { c.tv_archive = 1; c.tv_archive_duration = 3; }

function xmltv() {
  const base = Math.floor(Date.now() / 3600000) * 3600000;
  const fmt = (ms) => { const d = new Date(ms); const z = (n) => String(n).padStart(2, '0'); return `${d.getUTCFullYear()}${z(d.getUTCMonth() + 1)}${z(d.getUTCDate())}${z(d.getUTCHours())}${z(d.getUTCMinutes())}00 +0000`; };
  const shows = ['Jornal da Manhã', 'Mais Você', 'Sessão da Tarde', 'Vale a Pena Ver de Novo', 'Jornal Hoje', 'Novela das Seis', 'Jornal Nacional', 'Novela das Nove', 'Futebol: Flamengo x Palmeiras', 'Jornal da Noite', 'Corujão', 'Programa &amp; Cia'];
  let out = '<?xml version="1.0" encoding="UTF-8"?>\n<tv generator-info-name="falso">\n';
  const chans = live.filter((c) => c.epg_channel_id);
  for (const c of chans) out += `<channel id="${c.epg_channel_id}"><display-name>${c.name}</display-name></channel>\n`;
  for (const c of chans) for (let h = -72; h < 168; h++) {
    const st = base + h * 3600000;
    out += `<programme start="${fmt(st)}" stop="${fmt(st + 3600000)}" channel="${c.epg_channel_id}"><title lang="pt">${shows[(h + 300 + c.stream_id) % shows.length]}</title><desc>Descrição de teste do programa.</desc><icon src="http://127.0.0.1:${PORT}/tmdb/img/w500/prog${(h + c.stream_id) % 5}.svg" /></programme>\n`;
  }
  return out + '</tv>';
}

const cats = [
  ['10', 'Abertos'], ['20', 'Esportes | Futebol'], ['30', 'Notícias'], ['40', 'Filmes e Séries 24h'], ['50', 'Variedades'], ['60', '\u2666\uFE0F CANAIS | FHD H265 \u2B50'], ['61', '\uD83D\uDD36 REDE RECORD'], ['70', '\u2666\uFE0F REDE BANDEIRANTES'], ['71', '\u2666\uFE0F CANAIS | UHD 4K \u2B50'], ['72', '\u2666\uFE0F GLOBO | CAPITAIS'], ['73', '\u2666\uFE0F A FAZENDA 2026 \u2B50'], ['74', 'PPV | AMAZON PRIME'], ['76', 'CANAIS 24H | DESENHOS'], ['77', 'CANAIS 24H | PREMIERE'], ['78', 'EVENTOS EM DESTAQUE'], ['79', 'CANAIS 24H | SERIES'], ['80', 'CANAIS 24H | LIVE SHOWS'], ['75', 'FILMES E SÉRIES'], ['81', 'ADULTOS +18'],
].map(([category_id, category_name]) => ({ category_id, category_name, parent_id: 0 }));

let limitG = 4;
let extraGoals = 0;
let lastTimeshift = '';
function epgFor(id) {
  const now = Math.floor(Date.now() / 1000);
  const start = now - (now % 1800) - 900;
  const sporty = [30, 31, 6125, 1125].includes(Number(id)) || Number(id) === 6125;
  const names = sporty
    ? ['Brasileirão: Flamengo x Palmeiras', 'Pré-jogo', 'Libertadores: Grêmio x River Plate', 'NBA: Lakers x Celtics', 'Resenha', 'UFC 310: Pereira x Ankalaev', 'Brasileirão: Corinthians x São Paulo', 'Fórmula 1: GP de Interlagos', 'Jornal do Esporte', 'Premier League: Arsenal x Chelsea', 'Champions League: Real Madrid x Bayern', 'Madrugada']
    : ['Jornal da Manhã', 'Futebol: Flamengo x Palmeiras', 'Sessão da Tarde', 'Novela das Seis'];
  const lim = Math.min(Number(limitG) || 4, names.length);
  return names.slice(0, lim).map((t, i) => ({
    id: String(i), epg_id: String(id), title: b64(t), description: b64(`Programa ${i + 1} do canal ${id}.`), lang: 'pt',
    start_timestamp: String(start + i * (sporty ? 7200 : 1800)), stop_timestamp: String(start + (i + 1) * (sporty ? 7200 : 1800)),
  }));
}

// Títulos em inglês da Netflix (falsa) → nome em português do TMDB (falso)
const EN_PT = {
  'Route 66': { id: 701, title: 'Rota 66', original_title: 'Route 66', release_date: '2019-05-01', vote_average: 7.1 },
  'High Tide': { id: 702, title: 'Maré Alta', original_title: 'High Tide', release_date: '2024-02-01', vote_average: 6.8 },
  'Northern Light': { id: 703, title: 'Luz do Norte', original_title: 'Northern Light', release_date: '1990-01-01', vote_average: 6.1 },
  'Plan B': { id: 704, title: 'Plano B', original_title: 'Plan B', release_date: '2021-01-01', vote_average: 6.5 },
  'Night Shift': { id: 801, name: 'Turno da Noite', original_name: 'Night Shift', first_air_date: '2016-03-01', vote_average: 7.9 },
  'The Heirs': { id: 802, name: 'Os Herdeiros', original_name: 'The Heirs', first_air_date: '2015-03-01', vote_average: 8.0 },
};

function fakeF1(now) {
  const t = (d, h) => Math.floor((Math.floor(now / 86400000) * 86400000 + d * 86400000 + h * 3600000) / 1000);
  const race = (round, name, circuit, city, country, d, w) => [round, name, circuit, city, country, [['TL1', t(d - 2, 15)], ['TL2', t(d - 2, 19)], ['TL3', t(d - 1, 15)], ['CLA', t(d - 1, 19)], ['GP', t(d, 17)]], w];
  return {
    season: '2026', round: 20,
    races: [
      race(19, 'Mexico City Grand Prix', 'Autódromo Hermanos Rodríguez', 'Mexico City', 'Mexico', -16, ['VER', 'Max Verstappen', 'red_bull']),
      race(20, 'Brazilian Grand Prix', 'Autódromo José Carlos Pace', 'São Paulo', 'Brazil', -2, ['NOR', 'Lando Norris', 'mclaren']),
      race(21, 'Las Vegas Grand Prix', 'Las Vegas Strip Street Circuit', 'Las Vegas', 'USA', 4, null),
      race(22, 'Qatar Grand Prix', 'Lusail International Circuit', 'Lusail', 'Qatar', 11, null),
    ],
    drivers: [[1, 'ANT', 'Andrea Kimi', 'Antonelli', '12', 'Mercedes', 'mercedes', 390, 9], [2, 'NOR', 'Lando', 'Norris', '4', 'McLaren', 'mclaren', 341, 3], [3, 'VER', 'Max', 'Verstappen', '1', 'Red Bull', 'red_bull', 320, 3], [4, 'RUS', 'George', 'Russell', '63', 'Mercedes', 'mercedes', 290, 3], [5, 'LEC', 'Charles', 'Leclerc', '16', 'Ferrari', 'ferrari', 210, 1], [6, 'BOR', 'Gabriel', 'Bortoleto', '5', 'Audi', 'audi', 40, 0]],
    teams: [[1, 'Mercedes', 'mercedes', 680, 12], [2, 'McLaren', 'mclaren', 520, 3], [3, 'Red Bull', 'red_bull', 470, 3], [4, 'Ferrari', 'ferrari', 330, 1], [5, 'Audi', 'audi', 60, 0]],
    last: [20, 'Brazilian Grand Prix', [[1, 'NOR', 'Lando Norris', 'McLaren', 'mclaren', '1:35:23.504', 25], [2, 'VER', 'Max Verstappen', 'Red Bull', 'red_bull', '+14.602', 18], [3, 'BOR', 'Gabriel Bortoleto', 'Audi', 'audi', '+24.485', 15], [4, 'RUS', 'George Russell', 'Mercedes', 'mercedes', '+33.991', 12]]],
  };
}

function fakeSports() {
  const now = Date.now();
  const esc = (t) => `http://127.0.0.1:${PORT}/escudo/${encodeURIComponent(t)}.svg`;
  const names = ['Flamengo', 'Palmeiras', 'Botafogo', 'São Paulo', 'Corinthians', 'Fluminense', 'Grêmio', 'Internacional', 'Atlético Mineiro', 'Cruzeiro'];
  const teams = names.map((t) => [t, t.slice(0, 3).toUpperCase(), esc(t), teamColor(t), '']);
  // Rodízio: 18 rodadas semanais; a rodada 12 é a desta semana (com o jogo ao vivo e1 da ESPN falsa).
  const ev = [];
  const live = Math.floor((now - (now % 1800000) - 900000) / 1000);
  const ids = names.map((_, i) => i);
  for (let r = 1; r <= 18; r++) {
    const rot = [ids[0], ...ids.slice(1).map((_, k) => ids[1 + ((k + r - 1) % (ids.length - 1))])];
    for (let k = 0; k < 5; k++) {
      let h = rot[k];
      let a = rot[9 - k];
      if (r > 9) [h, a] = [a, h];
      const t = Math.floor(now / 1000) + (r - 12) * 7 * 86400 + k * 3 * 3600 + 3600;
      const past = r < 12;
      ev.push([`b${r}-${k}`, t, h, a, past ? String((h + r) % 4) : '', past ? String((a + k) % 3) : '', past ? 2 : 0, r, '', 0]);
    }
  }
  // Jogos de hoje da ESPN falsa (ids iguais aos do placar ao vivo)
  ev.push(['e1', live, 0, 1, '2', '1', 1, 12, '', 0]);
  ev.push(['e2', Math.floor(new Date(Math.floor(now / 86400000) * 86400000 + 23 * 3600000).getTime() / 1000), 4, 3, '', '', 0, 12, '', 0]);
  const rows = names.map((t, i) => [i + 1, t, t.slice(0, 3).toUpperCase(), esc(t), 30 - i * 2, 11, 9 - Math.floor(i / 2), 3, i, 25 - i, 10 + i, 15 - i * 2, i < 4 ? '81D6AC' : i > 7 ? 'FF7F84' : '']);
  // Libertadores: semifinais (ida e volta) e final
  const lt = [['River Plate', 'RIV'], ['Grêmio', 'GRE'], ['Flamengo', 'FLA'], ['Palmeiras', 'PAL']].map(([n, s]) => [n, s, esc(n), teamColor(n), '']);
  const d = (days) => Math.floor(now / 1000) + days * 86400;
  const lev = [
    ['l1', d(-20), 0, 1, '1', '0', 2, 'semifinals', 'Ida', 0],
    ['l2', d(-13), 1, 0, '2', '1', 2, 'semifinals', 'Volta · empate no agregado · GRE vence por 4-3 nos pênaltis', 0],
    ['l3', d(-20), 2, 3, '2', '2', 2, 'semifinals', 'Ida', 0],
    ['l4', d(-13), 3, 2, '0', '1', 2, 'semifinals', 'Volta · FLA vence por 3-2 no agregado', 0],
    ['l5', d(9), 1, 2, '', '', 0, 'final', '', 0],
  ];
  return {
    v: 1,
    updated: new Date().toISOString(),
    leagues: [
      { id: 'bra.1', season: '2026 Futebol Brasileiro', logo: `http://127.0.0.1:${PORT}/liga/bra.1.svg`, teams, ev, tables: [{ n: 'Brasileirão Série A', rows }], sc: names.slice(0, 6).map((t, i) => [['Pedro', 'Flaco López', 'Igor Jesus', 'Calleri', 'Yuri Alberto', 'Cano'][i], t, esc(t), 18 - i * 2, 30]), as: names.slice(0, 3).map((t, i) => [['Arrascaeta', 'Estêvão', 'Savarino'][i], t, esc(t), 9 - i, 30]) },
      { id: 'conmebol.libertadores', season: '2026 CONMEBOL Libertadores', logo: `http://127.0.0.1:${PORT}/liga/conmebol.libertadores.svg`, teams: lt, ev: lev, tables: [] },
    ],
    f1: fakeF1(now),
  };
}

const teamColor = (t) => ({ Flamengo: 'C8102E', Palmeiras: '006437', Corinthians: '111111', 'São Paulo': 'E30613', Grêmio: '0D80BF', 'River Plate': 'E4002B' })[t] || '3D7BFF';

// GitHub falso (sincronização pela nuvem, 0.30.0): /gh/user, /gh/gists… com o token "teste-token-0123456789abcdef".
const gists = new Map();
let gistSeq = 0;
function fakeGitHub(req, res, u) {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization, Content-Type, Accept', 'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS' };
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
  const j = (st, o) => res.writeHead(st, { ...cors, 'content-type': 'application/json' }).end(JSON.stringify(o));
  if (req.headers.authorization !== 'token teste-token-0123456789abcdef') return j(401, { message: 'Bad credentials' });
  const path = u.pathname.slice(3);
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const b = body ? JSON.parse(body) : {};
    if (path === '/user') return j(200, { login: 'samuel-teste' });
    if (path === '/gists' && req.method === 'GET') return j(200, [...gists.values()]);
    if (path === '/gists' && req.method === 'POST') {
      const g = { id: 'g' + ++gistSeq, description: b.description, public: !!b.public, files: b.files };
      gists.set(g.id, g);
      return j(201, g);
    }
    const m = path.match(/^\/gists\/(\w+)$/);
    if (m && gists.has(m[1])) {
      const g = gists.get(m[1]);
      if (req.method === 'PATCH') g.files = { ...g.files, ...b.files };
      return j(200, g);
    }
    j(404, { message: 'Not Found' });
  });
}

createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/gh/')) return fakeGitHub(req, res, u);
  // Atualização dentro do app (teste): arquivos de UPDATE_DIR em /updates/
  if (u.pathname.startsWith('/updates/') && process.env.UPDATE_DIR) {
    const f = join(process.env.UPDATE_DIR, u.pathname.slice(9).replace(/\.\./g, ''));
    if (!existsSync(f)) return res.writeHead(404, { 'access-control-allow-origin': '*' }).end();
    return res.writeHead(200, { 'content-type': f.endsWith('.json') ? 'application/json' : 'application/octet-stream', 'access-control-allow-origin': '*' }) && createReadStream(f).pipe(res);
  }
  const send = (obj) => res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(obj));
  // Simula painel que só aceita um player específico: REQUIRE_UA=IPTVSmartersPlayer
  if (process.env.REQUIRE_UA && req.headers['user-agent'] !== process.env.REQUIRE_UA && u.pathname === '/player_api.php') {
    return res.writeHead(502, { 'content-type': 'text/html', server: 'cloudflare' }).end('<html><head><title>502 Bad Gateway</title></head></html>');
  }
  if (u.pathname === '/player_api.php') {
    if (u.searchParams.get('username') !== 'teste' || u.searchParams.get('password') !== '1234') return send({ user_info: { auth: 0 } });
    const a = u.searchParams.get('action');
    if (!a) return send({ user_info: { auth: 1, status: 'Active', exp_date: String(Math.floor(Date.now() / 1000) + 86400 * 40), max_connections: '2', active_cons: '0' }, server_info: { timezone: 'America/Sao_Paulo' } });
    if (a === 'get_live_categories') return send(cats);
    if (a === 'get_live_streams') return send(live.map(({ dir, ...s }) => s));
    if (!a || a === '') {}
    if (a === 'get_vod_categories') return send(VOD_CATS.map(([category_id, category_name]) => ({ category_id, category_name })));
    if (a === 'get_vod_streams') return send(vods);
    if (a === 'get_series_categories') return send(SER_CATS.map(([category_id, category_name]) => ({ category_id, category_name })));
    if (a === 'get_series') return send(seriesList);
    if (a === 'get_vod_info') {
      const v = vods.find((x) => String(x.stream_id) === u.searchParams.get('vod_id'));
      return send({ info: { plot: `Sinopse de teste de ${v?.name}. Uma história sobre escolhas, viagens e reencontros, contada em 90 segundos de barras coloridas.`, genre: 'Drama, Aventura', cast: 'Ana Souza, Bruno Lima, Carla Mendes', director: 'Diego Rocha', releasedate: `${v?.year}-05-10`, rating: v?.rating, duration: '01:52:00', backdrop_path: [`http://127.0.0.1:${PORT}/poster/m${(v?.stream_id ?? 3000) - 3000}.svg`] }, movie_data: { stream_id: v?.stream_id } });
    }
    if (a === 'get_series_info') {
      const sid = u.searchParams.get('series_id');
      const episodes = {};
      for (let season = 1; season <= 3; season++) episodes[season] = Array.from({ length: 8 }, (_, e) => ({ id: `${sid}${season}${e + 1}`, episode_num: e + 1, season, title: `Episódio ${e + 1} — Capítulo ${season * 10 + e + 1}`, container_extension: 'mp4', info: { duration: '00:45:00', plot: 'Episódio de teste.' } }));
      return send({ info: { name: 'Série', plot: 'Sinopse da série de teste: três temporadas de reviravoltas.', genre: 'Suspense', cast: 'Elenco de teste', rating: '8.1', releaseDate: '2021-03-01' }, episodes });
    }
    if (a === 'get_simple_data_table') {
      // Programação completa do canal: 5 dias para trás e 2 à frente (canais "Extra" sem guia).
      const id = Number(u.searchParams.get('stream_id'));
      const ch = live.find((c) => c.stream_id === id);
      if (!ch || id >= 100 && id < 500) return send({ epg_listings: [] });
      const now = Math.floor(Date.now() / 1000);
      const base = now - (now % 7200);
      const shows = ['Jornal da Manhã', 'Esporte Total', 'Sessão da Tarde', 'Brasileirão: Flamengo x Palmeiras', 'Jornal Nacional', 'Filme: Tropa de Elite', 'Programa do Jô', 'Corujão', 'Desenhos', 'Documentário: Amazônia', 'Resenha', 'Madrugada'];
      const out = [];
      for (let h = -60; h < 24; h++) {
        const st = base + h * 7200;
        const arch = ch.tv_archive && st + 7200 <= now && st >= now - (ch.tv_archive_duration || 0) * 86400;
        out.push({ id: String(h), epg_id: String(id), title: b64(shows[(h + 120 + id) % shows.length]), description: b64(`Programa completo de teste (${h >= 0 ? 'futuro' : 'passado'}).`), lang: 'pt', start_timestamp: String(st), stop_timestamp: String(st + 7200), now_playing: st <= now && now < st + 7200 ? 1 : 0, has_archive: arch ? 1 : 0 });
      }
      return send({ epg_listings: out });
    }
    if (a === 'get_short_epg') { limitG = u.searchParams.get('limit'); return send({ epg_listings: epgFor(u.searchParams.get('stream_id')) }); }
    return send([]);
  }
  // Tops: TSV oficial da Netflix (falso) e o arquivo gerado (TOPS_FILE) para o app
  if (u.pathname === '/netflix/top10.tsv') {
    const rows = ['country_name\tcountry_iso2\tweek\tcategory\tweekly_rank\tshow_title\tseason_title\tcumulative_weeks_in_top_10'];
    const films = ['Route 66', 'High Tide', 'Unknown Movie', 'Northern Light', 'Plan B'];
    const tv = ['Night Shift', 'The Heirs', 'Attack on Titan'];
    for (const wk of ['2026-11-01', '2026-10-25']) {
      films.forEach((t, i) => rows.push(`Brazil\tBR\t${wk}\tFilms\t${i + 1}\t${wk === '2026-11-01' ? t : 'Old ' + t}\tN/A\t1`));
      tv.forEach((t, i) => rows.push(`Brazil\tBR\t${wk}\tTV\t${i + 1}\t${t}\t${t}: Season 1\t2`));
    }
    rows.push('Argentina\tAR\t2026-11-01\tFilms\t1\tSomething Else\tN/A\t1');
    return res.writeHead(200, { 'content-type': 'text/tab-separated-values' }).end(rows.join('\n'));
  }
  // Centro de esportes: SPORTS_FILE = um prisma-sports.json real; sem ele, um calendário inventado
  // (Brasileirão de 10 times com o jogo ao vivo "e1" Flamengo x Palmeiras, Libertadores com mata-mata).
  if (u.pathname === '/tops/prisma-sports.json') {
    if (process.env.SPORTS_FILE && existsSync(process.env.SPORTS_FILE)) return res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }) && createReadStream(process.env.SPORTS_FILE).pipe(res);
    return res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }).end(JSON.stringify(fakeSports()));
  }
  if (u.pathname === '/tops/prisma-tops.json') {
    if (!process.env.TOPS_FILE || !existsSync(process.env.TOPS_FILE)) return res.writeHead(404, { 'access-control-allow-origin': '*' }).end();
    return res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }) && createReadStream(process.env.TOPS_FILE).pipe(res);
  }
  if (u.pathname.startsWith('/tmdb/3/') && /^\/tmdb\/3\/(watch\/providers|discover|movie\/top_rated|tv\/top_rated)/.test(u.pathname) || EN_PT[(u.searchParams.get('query') || '')]) {
    if (u.searchParams.get('api_key') !== 'chave-teste') return res.writeHead(401).end('{}');
    const j = (o) => res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(o));
    const path = u.pathname.slice(8);
    const hit = EN_PT[u.searchParams.get('query') || ''];
    if (hit) return j({ results: [hit] });
    if (path.startsWith('watch/providers/')) return j({ results: [{ provider_id: 8, provider_name: 'Netflix', display_priority: 1 }, { provider_id: 1899, provider_name: 'HBO Max', display_priority: 2 }, { provider_id: 337, provider_name: 'Disney Plus', display_priority: 3 }, { provider_id: 307, provider_name: 'Globoplay', display_priority: 4 }] });
    const type = path.startsWith('discover/') ? path.slice(9) : path.split('/')[0];
    const prov = parseInt(u.searchParams.get('with_watch_providers') || '0', 10) || 0;
    const genre = Number(u.searchParams.get('with_genres') || 0);
    const pool = type === 'movie' ? vods.map((v) => ({ title: v.name.replace(/ \(\d{4}\)$/, ''), date: v.year + '-01-01' })) : seriesList.map((x) => ({ title: x.name, date: x.releaseDate }));
    const seed = prov + genre + (path.includes('top_rated') ? 7 : 0) + (u.searchParams.get('with_original_language') || '').length * 3;
    const out = [];
    for (let i = 0; i < 22; i++) {
      if (i % 4 === 3) out.push({ id: 90000 + i, title: 'Fora da Lista ' + i, name: 'Fora da Lista ' + i, release_date: '2020-01-01', first_air_date: '2020-01-01', vote_average: 7 });
      else { const x = pool[(seed + i * 5) % pool.length]; out.push({ id: 50000 + seed * 100 + i, title: x.title, name: x.title, original_title: x.title, original_name: x.title, release_date: x.date, first_air_date: x.date, vote_average: 7.2 }); }
    }
    if (u.searchParams.get('release_date.gte') && u.searchParams.get('release_date.lte') || u.searchParams.get('first_air_date.lte')) out.forEach((x, i) => { const d = new Date(Date.now() + ((i % 9) - 1) * 86400000).toISOString().slice(0, 10); x.release_date = d; x.first_air_date = d; x.poster_path = '/p' + (i % 6) + '.svg'; });
    return j({ results: Number(u.searchParams.get('page') || 1) > 1 ? out.slice(11) : out.slice(0, 20) });
  }
  if (u.pathname.startsWith('/liga/')) {
    const id = decodeURIComponent(u.pathname.slice(6).replace('.svg', ''));
    const [label, c] = id === 'bra.1' ? ['BR', '#0E8F48'] : id.includes('libertadores') ? ['LIB', '#C9A240'] : [id.slice(0, 3).toUpperCase(), '#3D7BFF'];
    return res.writeHead(200, { 'content-type': 'image/svg+xml', 'access-control-allow-origin': '*' }).end(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 4 88 18v34c0 22-17 38-38 44C29 90 12 74 12 52V18z" fill="${c}"/><text x="50" y="62" font-family="Arial" font-weight="900" font-size="28" fill="#fff" text-anchor="middle">${label}</text></svg>`);
  }
  if (u.pathname.startsWith('/escudo/')) {
    const t = decodeURIComponent(u.pathname.slice(8).replace(/\.svg$/, ''));
    const c = '#' + teamColor(t);
    return res.writeHead(200, { 'content-type': 'image/svg+xml', 'access-control-allow-origin': '*' }).end(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path d="M50 4 L90 18 L84 64 Q50 96 50 96 Q50 96 16 64 L10 18 Z" fill="${c}" stroke="#fff" stroke-width="5"/><text x="50" y="62" text-anchor="middle" font-size="34" font-family="sans-serif" font-weight="800" fill="#fff">${t.slice(0, 1)}</text></svg>`);
  }
  if (u.pathname.startsWith('/tmdb/')) {
    const j = (o) => res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(o));
    const path = u.pathname.slice(6);
    if (!path.startsWith('img/') && u.searchParams.get('api_key') !== 'chave-teste') return res.writeHead(401).end('{}');
    if (path === '3/configuration') return j({ images: {} });
    if (path.startsWith('img/')) {
      const svg = (body, w = 300, h = 450) => res.writeHead(200, { 'content-type': 'image/svg+xml', 'access-control-allow-origin': '*' }).end(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);
      const n = (path.match(/(\d+)/g) || ['0']).pop() % 6;
      const hues = ['#7a2e9c', '#b4531f', '#0e7490', '#1f8a5b', '#c8264b', '#2b5bd7'];
      // logo do título (transparente), foto do ator, cena (16:9) ou pôster
      if (/logo/.test(path)) return svg(`<text x="10" y="80" font-size="78" font-family="Georgia,serif" font-weight="700" font-style="italic" fill="#fff">Título</text><rect x="12" y="96" width="270" height="6" fill="#f5b83d"/>`, 300, 110);
      if (/face/.test(path)) return svg(`<rect width="185" height="185" fill="${hues[n]}"/><circle cx="92" cy="72" r="34" fill="#ffffffcc"/><rect x="40" y="118" width="104" height="80" rx="40" fill="#ffffffcc"/>`, 185, 185);
      if (/(\/b|prog)/.test(path)) return svg(`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hues[n]}"/><stop offset="1" stop-color="#0b0b12"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/><circle cx="900" cy="260" r="220" fill="#ffffff22"/><circle cx="1050" cy="520" r="120" fill="#ffffff14"/><text x="60" y="660" font-size="54" font-family="sans-serif" font-weight="800" fill="#ffffff55">CENA ${n}</text>`, 1280, 720);
      return svg(`<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hues[n]}"/><stop offset="1" stop-color="#0b0b12"/></linearGradient></defs><rect width="300" height="450" fill="url(#g)"/><circle cx="220" cy="120" r="80" fill="#ffffff22"/><text x="20" y="420" font-size="30" font-family="sans-serif" font-weight="800" fill="#fff">PÔSTER ${n}</text>`);
    }
    const q = (u.searchParams.get('query') || '').toLowerCase();
    if (path === '3/search/person') return j({ results: /ana|souza/i.test(u.searchParams.get('query') || '') ? [{ id: 500, name: 'Ana Souza', known_for_department: 'Acting', popularity: 12, profile_path: '/face0.jpg' }] : [] });
    if (path === '3/search/movie' || path === '3/search/tv') return j({ results: q ? [{ id: q.length, title: u.searchParams.get('query'), name: u.searchParams.get('query'), poster_path: '/p' + q.length + '.svg', backdrop_path: '/b' + q.length + '.svg', overview: 'Sinopse vinda do TMDB em português. Uma história envolvente sobre escolhas difíceis, viagens inesperadas e reencontros que mudam tudo.', release_date: '2020-01-01', vote_average: 8.4 }] : [] });
    if (path === '3/trending/movie/week') return j({ results: ['Rota 66', 'Inexistente', 'Maré Alta', 'Luz do Norte', 'Plano B'].map((t, i) => ({ id: 100 + i, title: t, poster_path: '/p.svg' })) });
    if (path === '3/trending/tv/week') return j({ results: ['Turno da Noite', 'Os Herdeiros'].map((t, i) => ({ id: 200 + i, name: t, poster_path: '/p.svg' })) });
    if (/^3\/(movie|tv)\/\d+\/videos$/.test(path)) return j({ results: [{ site: 'YouTube', type: 'Trailer', key: 'dQw4w9WgXcQ' }] });
    if (/^3\/person\/\d+$/.test(path)) return j({ id: Number(path.split('/')[2]), name: 'Ana Souza', biography: 'Atriz brasileira premiada, conhecida por papéis intensos no cinema e em séries de streaming. Começou no teatro em São Paulo e estreou na TV em 2008.', profile_path: '/face1.jpg', birthday: '1986-05-01', place_of_birth: 'Rio de Janeiro, Brasil', known_for_department: 'Acting' });
    if (/^3\/person\/\d+\/combined_credits$/.test(path)) return j({ cast: [...vods.slice(0, 6).map((v, i) => ({ id: 6000 + i, media_type: 'movie', title: v.name.replace(/ \(\d{4}\)$/, ''), release_date: v.year + '-01-01', popularity: 50 - i, poster_path: '/p' + i + '.svg' })), ...seriesList.slice(0, 3).map((x, i) => ({ id: 7000 + i, media_type: 'tv', name: x.name, first_air_date: x.releaseDate, popularity: 30 - i }))] });
    if (/^3\/movie\/\d+\/release_dates$/.test(path)) return j({ results: [{ iso_3166_1: 'BR', release_dates: [{ certification: ['L', '10', '12', '14', '16', '18'][Number(path.split('/')[2]) % 6] }] }] });
    if (/^3\/tv\/\d+\/content_ratings$/.test(path)) return j({ results: [{ iso_3166_1: 'BR', rating: '16' }] });
    if (/^3\/tv\/\d+$/.test(path)) return j({ id: Number(path.split('/')[2]), next_episode_to_air: { air_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), season_number: 3, episode_number: 5, name: 'Reviravolta' }, last_episode_to_air: { air_date: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10), season_number: 3, episode_number: 4, name: 'Antes' } });
    if (/^3\/movie\/\d+$/.test(path)) { const id = Number(path.split('/')[2]); return j({ id, belongs_to_collection: id % 3 === 0 ? { id: 77 + (id % 2), name: id % 2 ? 'Rota 66 - Coleção' : 'Coleção Maré Alta', backdrop_path: '/b' + (id % 6) + '.svg' } : null }); }
    if (/^3\/collection\/\d+$/.test(path)) { const cid = Number(path.split('/')[2]); const base = cid % 2 ? 'Rota 66' : 'Maré Alta'; return j({ id: cid, name: base + ' - Coleção', backdrop_path: '/b' + (cid % 6) + '.svg', parts: [{ id: 1, title: base, release_date: '2019-01-01' }, { id: 2, title: base + ' 2', release_date: '2021-01-01' }, { id: 3, title: base + ' 3', release_date: '2023-01-01' }] }); }
    if (/^3\/(movie|tv)\/\d+\/images$/.test(path)) return j({ logos: [{ file_path: '/logo' + path.split('/')[2] + '.png', iso_639_1: 'pt' }], backdrops: [0, 1, 2, 3, 4, 5].map((i) => ({ file_path: '/b' + i + '.svg' })) });
    if (/^3\/(movie|tv)\/\d+\/(credits|aggregate_credits)$/.test(path)) return j({ cast: ['Ana Souza', 'Bruno Lima', 'Carla Mendes', 'Diego Rocha', 'Elisa Prado', 'Fábio Reis', 'Gabi Torres', 'Hugo Alves'].map((name, i) => ({ id: 500 + i, name, character: 'Personagem ' + (i + 1), profile_path: '/face' + i + '.jpg' })) });
    if (/^3\/(movie|tv)\/\d+\/recommendations$/.test(path)) {
      const tv = path.startsWith('3/tv');
      const pool = tv ? seriesList.map((x) => ({ name: x.name, first_air_date: x.releaseDate })) : vods.map((v) => ({ title: v.name.replace(/ \(\d{4}\)$/, ''), release_date: v.year + '-01-01' }));
      return j({ results: pool.slice(3, 15).map((x, i) => ({ id: 9000 + i, ...x, poster_path: '/p.svg', backdrop_path: '/b' + i + '.svg' })) });
    }
    return j({});
  }
  // ESPN falsa: gol de teste (/espn/gol soma um gol do Flamengo), tabela, estatísticas, próximos jogos
  if (u.pathname === '/espn/gol') { extraGoals++; return res.writeHead(200, { 'access-control-allow-origin': '*' }).end('ok'); }
  if (u.pathname.startsWith('/espn/') && u.pathname.endsWith('/standings')) {
    const teams = ['Flamengo', 'Palmeiras', 'Botafogo', 'São Paulo', 'Corinthians', 'Fluminense', 'Grêmio', 'Internacional', 'Atlético Mineiro', 'Cruzeiro'];
    const entries = teams.map((t, i) => ({ team: { displayName: t, abbreviation: t.slice(0, 3).toUpperCase() }, stats: [{ name: 'rank', value: i + 1 }, { name: 'points', value: 70 - i * 4 }, { name: 'gamesPlayed', value: 34 }, { name: 'wins', value: 21 - i }, { name: 'ties', value: 7 }, { name: 'losses', value: 6 + i }, { name: 'pointDifferential', value: 30 - i * 6 }] }));
    return res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }).end(JSON.stringify({ children: [{ name: 'Brasileirão Série A', standings: { entries } }] }));
  }
  if (u.pathname.startsWith('/espn/') && u.pathname.endsWith('/summary')) {
    const st = (n, v) => ({ name: n, displayValue: String(v) });
    return res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }).end(JSON.stringify({
      boxscore: { teams: [
        { team: { displayName: 'Flamengo' }, statistics: [st('possessionPct', 58.4), st('totalShots', 14), st('shotsOnTarget', 6), st('wonCorners', 7), st('foulsCommitted', 9), st('yellowCards', 2)] },
        { team: { displayName: 'Palmeiras' }, statistics: [st('possessionPct', 41.6), st('totalShots', 8), st('shotsOnTarget', 3), st('wonCorners', 3), st('foulsCommitted', 13), st('yellowCards', 3)] },
      ] },
      keyEvents: [
        { type: { text: 'Goal' }, scoringPlay: true, clock: { displayValue: "12'" }, team: { displayName: 'Flamengo' }, participants: [{ athlete: { displayName: 'Pedro' } }] },
        { type: { text: 'Yellow Card' }, clock: { displayValue: "30'" }, team: { displayName: 'Palmeiras' }, participants: [{ athlete: { displayName: 'Gómez' } }] },
        { type: { text: 'Goal' }, scoringPlay: true, clock: { displayValue: "51'" }, team: { displayName: 'Palmeiras' }, participants: [{ athlete: { displayName: 'Estêvão' } }] },
        { type: { text: 'Goal' }, scoringPlay: true, clock: { displayValue: "63'" }, team: { displayName: 'Flamengo' }, participants: [{ athlete: { displayName: 'Arrascaeta' } }] },
      ],
      rosters: [
        { team: { displayName: 'Flamengo' }, formation: '4-2-3-1', roster: ['Rossi', 'Varela', 'Léo Ortiz', 'Léo Pereira', 'Ayrton Lucas', 'Pulgar', 'Gerson', 'Arrascaeta', 'De la Cruz', 'Luiz Araújo', 'Pedro', 'Bruno Henrique'].map((n, i) => ({ athlete: { displayName: n }, starter: i < 11, jersey: String(i + 1) })) },
        { team: { displayName: 'Palmeiras' }, formation: '4-4-2', roster: ['Weverton', 'Mayke', 'Gómez', 'Murilo', 'Piquerez', 'Aníbal', 'Richard Ríos', 'Raphael Veiga', 'Estêvão', 'Flaco López', 'Vitor Roque', 'Dudu'].map((n, i) => ({ athlete: { displayName: n }, starter: i < 11, jersey: String(i + 1) })) },
      ],
    }));
  }
  if (u.pathname.startsWith('/espn/')) {
    const now = Date.now();
    const start = new Date(now - (now % 1800000) - 900000).toISOString();
    let n = 0;
    const ev = (h, a, hs, as, state, short, date = start) => ({ id: 'e' + (++n), date, status: { type: { state, shortDetail: short } }, competitions: [{ competitors: [{ homeAway: 'home', score: hs, team: { displayName: h, color: teamColor(h), logo: `http://127.0.0.1:${PORT}/escudo/${encodeURIComponent(h)}.svg` } }, { homeAway: 'away', score: as, team: { displayName: a, color: teamColor(a), logo: `http://127.0.0.1:${PORT}/escudo/${encodeURIComponent(a)}.svg` } }] }] });
    if (u.searchParams.get('dates') && u.pathname.includes('bra.1')) {
      const day = (d, h) => new Date(Math.floor(now / 86400000) * 86400000 + d * 86400000 + h * 3600000).toISOString();
      return res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }).end(JSON.stringify({ events: [
        ev('Flamengo', 'Palmeiras', String(2 + extraGoals), '1', 'in', "67'"), ev('Corinthians', 'São Paulo', '0', '0', 'pre', '21:30', day(0, 23)),
        ev('Botafogo', 'Fluminense', '', '', 'pre', '', day(1, 22)), ev('Grêmio', 'Internacional', '', '', 'pre', '', day(2, 19)), ev('Cruzeiro', 'Flamengo', '', '', 'pre', '', day(4, 21)),
      ] }));
    }
    const events = u.pathname.includes('bra.1') ? [ev('Flamengo', 'Palmeiras', String(2 + extraGoals), '1', 'in', "67'"), ev('Corinthians', 'São Paulo', '0', '0', 'pre', '21:30')]
      : u.pathname.includes('libertadores') ? [ev('River Plate', 'Grêmio', '1', '1', 'in', 'HT')] : [];
    return res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }).end(JSON.stringify({ events }));
  }
  if (u.pathname === '/xmltv.php') {
    return res.writeHead(200, { 'content-type': 'application/octet-stream' }).end(gzipSync(xmltv()));
  }
  if (/^\/timeshift\/teste\/1234\//.test(u.pathname)) {
    lastTimeshift = u.pathname;
    res.writeHead(200, { 'content-type': 'video/mp2t' });
    return createReadStream(join(demo, 'canal-ts.ts')).pipe(res);
  }
  if (u.pathname === '/ultimo-timeshift') return res.writeHead(200).end(lastTimeshift);
  if (u.pathname.startsWith('/multi/')) {
    const f = fileURLToPath(new URL('.' + u.pathname, import.meta.url));
    if (!existsSync(f)) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': f.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : f.endsWith('.vtt') ? 'text/vtt' : 'video/mp2t' });
    return createReadStream(f).pipe(res);
  }
  if (u.pathname.startsWith('/poster/')) {
    return res.writeHead(200, { 'content-type': 'image/svg+xml' }).end(poster(u.pathname.slice(8).replace('.svg', '')));
  }
  // Filmes e episódios: MP4 com suporte a Range (avançar/voltar)
  if (/^\/(movie|series)\/teste\/1234\/\d+\.mp4$/.test(u.pathname)) {
    const f = fileURLToPath(new URL('./filme-teste.mp4', import.meta.url));
    const size = statSync(f).size;
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (m) {
      const start = m[1] ? Number(m[1]) : 0;
      const end = m[2] ? Number(m[2]) : size - 1;
      res.writeHead(206, { 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
      return createReadStream(f, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'content-length': size });
    return createReadStream(f).pipe(res);
  }
  // /live/teste/1234/30.m3u8  e  /live/teste/1234/30/s00.ts (relativo)
  const m = u.pathname.match(/^\/live\/teste\/1234\/(\d+)(?:\.(m3u8|ts)|\/(.+))$/);
  if (m) {
    const ch = live.find((c) => c.stream_id === Number(m[1]));
    if (!ch || !ch.dir) return res.writeHead(404).end();
    if (m[2] === 'm3u8' && ch.dir === 'MULTI') return res.writeHead(302, { location: '/multi/master.m3u8' }).end();
    if (m[2] === 'm3u8') {
      // Redireciona como muitos servidores reais fazem
      return res.writeHead(302, { location: `/live/teste/1234/${ch.stream_id}/index.m3u8` }).end();
    }
    if (m[2] === 'ts') return res.writeHead(200, { 'content-type': 'video/mp2t' }) && createReadStream(join(demo, 'canal-ts.ts')).pipe(res);
    // Playlist ao vivo (janela deslizante): repete os 5 pedaços de 4 s em loop.
    if (m[3] === 'index.m3u8') {
      const seq = Math.floor(Date.now() / 4000);
      let out = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:4\n#EXT-X-MEDIA-SEQUENCE:${seq}\n#EXT-X-DISCONTINUITY-SEQUENCE:${seq}\n`;
      for (let k = 0; k < 3; k++) out += `#EXT-X-DISCONTINUITY\n#EXTINF:4.000000,\ns0${(seq + k) % 5}.ts\n`;
      return res.writeHead(200, { 'content-type': 'application/vnd.apple.mpegurl', 'cache-control': 'no-cache' }).end(out);
    }
    const f = join(demo, ch.dir, m[3]);
    if (!existsSync(f)) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': f.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t' });
    return createReadStream(f).pipe(res);
  }
  res.writeHead(404).end();
}).listen(PORT, '127.0.0.1', () => console.log(`Xtream falso em http://127.0.0.1:${PORT} (teste / 1234)`));
