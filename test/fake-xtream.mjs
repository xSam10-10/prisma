// Servidor Xtream falso para testar o PRISMA sem a lista real.
// Uso: node test/fake-xtream.mjs   (porta 8090, usuário "teste", senha "1234")
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const demo = fileURLToPath(new URL('../public/demo/', import.meta.url));
const PORT = Number(process.env.PORT || 8090);
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

const live = [
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
 ['77', 'CANAIS 24H | PREMIERE', ['Premiere 24h Clássicos']], ['78', 'EVENTOS EM DESTAQUE', ['Evento 01 FHD']], ['79', 'CANAIS 24H | SERIES', ['Chaves 24h']], ['80', 'CANAIS 24H | LIVE SHOWS', ['Show Ao Vivo 01']], ['75', 'FILMES E SÉRIES', ['A&E FHD', 'AMC FHD', 'ANIMAL PLANET FHD']]]
  .forEach(([cid, , names], k) => names.forEach((name, j) => live.push({ num: 900 + k * 10 + j, name, stream_id: 7000 + k * 10 + j, category_id: cid, epg_channel_id: '', dir: 'prisma1' })));
for (let i = 0; i < 400; i++) live.push({ num: 100 + i, name: `Canal Extra ${i + 1}`, stream_id: 100 + i, category_id: '50', epg_channel_id: '', dir: ['prisma1', 'prisma2', 'prisma3', 'prisma4'][i % 4] });

// ---- Filmes e séries de teste ----
const VOD_CATS = [['101', 'FILMES | NETFLIX'], ['102', 'FILMES | HBO MAX'], ['103', 'FILMES | DISNEY+'], ['104', 'LANÇAMENTOS 2026'], ['105', 'FILMES | AÇÃO']];
const SER_CATS = [['201', 'SÉRIES | NETFLIX'], ['202', 'SÉRIES | PRIME VIDEO'], ['203', 'ANIMES | CRUNCHYROLL'], ['204', 'SÉRIES | GLOBOPLAY']];
const TITLES = ['Horizonte Perdido', 'A Última Estação', 'Código Vermelho', 'Noite em Lisboa', 'O Jardim de Inverno', 'Fronteira Sul', 'Maré Alta', 'Cidade de Vidro', 'O Sétimo Andar', 'Luz do Norte', 'Rota 66', 'O Relojoeiro', 'Ventos de Agosto', 'Plano B', 'Sombras do Rio', 'Estrela Cadente'];
const PAL = ['#C8264B', '#2B5BD7', '#7A2E9C', '#B4531F', '#0E7490', '#1F8A5B', '#8A6D1F'];
const vods = Array.from({ length: 64 }, (_, i) => ({
  name: `${TITLES[i % TITLES.length]}${i >= TITLES.length ? ' ' + (Math.floor(i / TITLES.length) + 1) : ''} (${2018 + (i % 9)})`,
  stream_id: 3000 + i, stream_icon: `http://127.0.0.1:${PORT}/poster/m${i}.svg`, category_id: VOD_CATS[i % VOD_CATS.length][0],
  container_extension: 'mp4', rating: (5 + (i * 37) % 50 / 10).toFixed(1), added: String(1790000000 - i * 3600), year: String(2018 + (i % 9)),
}));
const SERIES_NAMES = ['Os Herdeiros', 'Turno da Noite', 'Vila Esperança', 'Detetive Lua', 'Reino de Aço', 'Naruto Shippuden', 'Attack on Titan', 'Café com Lua', 'Rua Augusta', 'O Mecanismo'];
const seriesList = Array.from({ length: 30 }, (_, i) => ({
  name: SERIES_NAMES[i % SERIES_NAMES.length] + (i >= SERIES_NAMES.length ? ' ' + (Math.floor(i / SERIES_NAMES.length) + 1) : ''),
  series_id: 4000 + i, cover: `http://127.0.0.1:${PORT}/poster/s${i}.svg`, category_id: SER_CATS[(i % SERIES_NAMES.length) >= 5 && (i % SERIES_NAMES.length) <= 6 ? 2 : i % 2 === 0 ? 0 : (i % 3 === 0 ? 3 : 1)][0],
  rating: (6 + (i % 4)).toFixed(1), last_modified: String(1790000000 - i * 7200), releaseDate: `${2015 + (i % 10)}-03-01`,
}));
function poster(id) {
  const n = Number(id.slice(1)); const c = PAL[n % PAL.length];
  const name = (id[0] === 'm' ? vods[n]?.name : seriesList[n]?.name) || 'PRISMA';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#0B0B12"/></linearGradient></defs><rect width="300" height="450" fill="url(#g)"/><circle cx="230" cy="110" r="90" fill="#ffffff22"/><text x="20" y="380" font-family="sans-serif" font-size="30" font-weight="800" fill="#fff">${name.replace(/ \(.*\)/, '').toUpperCase().slice(0, 16)}</text><text x="20" y="415" font-family="sans-serif" font-size="18" fill="#ffffffaa">${id[0] === 'm' ? 'FILME' : 'SÉRIE'}</text></svg>`;
}

const cats = [
  ['10', 'Abertos'], ['20', 'Esportes | Futebol'], ['30', 'Notícias'], ['40', 'Filmes e Séries 24h'], ['50', 'Variedades'], ['60', '\u2666\uFE0F CANAIS | FHD H265 \u2B50'], ['61', '\uD83D\uDD36 REDE RECORD'], ['70', '\u2666\uFE0F REDE BANDEIRANTES'], ['71', '\u2666\uFE0F CANAIS | UHD 4K \u2B50'], ['72', '\u2666\uFE0F GLOBO | CAPITAIS'], ['73', '\u2666\uFE0F A FAZENDA 2026 \u2B50'], ['74', 'PPV | AMAZON PRIME'], ['76', 'CANAIS 24H | DESENHOS'], ['77', 'CANAIS 24H | PREMIERE'], ['78', 'EVENTOS EM DESTAQUE'], ['79', 'CANAIS 24H | SERIES'], ['80', 'CANAIS 24H | LIVE SHOWS'], ['75', 'FILMES E SÉRIES'],
].map(([category_id, category_name]) => ({ category_id, category_name, parent_id: 0 }));

let limitG = 4;
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

createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const send = (obj) => res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(obj));
  // Simula painel que só aceita um player específico: REQUIRE_UA=IPTVSmartersPlayer
  if (process.env.REQUIRE_UA && req.headers['user-agent'] !== process.env.REQUIRE_UA && u.pathname === '/player_api.php') {
    return res.writeHead(502, { 'content-type': 'text/html', server: 'cloudflare' }).end('<html><head><title>502 Bad Gateway</title></head></html>');
  }
  if (u.pathname === '/player_api.php') {
    if (u.searchParams.get('username') !== 'teste' || u.searchParams.get('password') !== '1234') return send({ user_info: { auth: 0 } });
    const a = u.searchParams.get('action');
    if (!a) return send({ user_info: { auth: 1, status: 'Active', exp_date: String(Math.floor(Date.now() / 1000) + 86400 * 40), max_connections: '2', active_cons: '0' }, server_info: {} });
    if (a === 'get_live_categories') return send(cats);
    if (a === 'get_live_streams') return send(live.map(({ dir, ...s }) => s));
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
    if (a === 'get_short_epg') { limitG = u.searchParams.get('limit'); return send({ epg_listings: epgFor(u.searchParams.get('stream_id')) }); }
    return send([]);
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
    if (m[2] === 'm3u8') {
      // Redireciona como muitos servidores reais fazem
      return res.writeHead(302, { location: `/live/teste/1234/${ch.stream_id}/index.m3u8` }).end();
    }
    if (m[2] === 'ts') return res.writeHead(200, { 'content-type': 'video/mp2t' }) && createReadStream(join(demo, 'canal-ts.ts')).pipe(res);
    const f = join(demo, ch.dir, m[3]);
    if (!existsSync(f)) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': f.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t' });
    return createReadStream(f).pipe(res);
  }
  res.writeHead(404).end();
}).listen(PORT, '127.0.0.1', () => console.log(`Xtream falso em http://127.0.0.1:${PORT} (teste / 1234)`));
