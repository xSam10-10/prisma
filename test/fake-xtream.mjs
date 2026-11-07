// Servidor Xtream falso para testar o PRISMA sem a lista real.
// Uso: node test/fake-xtream.mjs   (porta 8090, usuário "teste", senha "1234")
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
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
 ['74', 'PPV | AMAZON PRIME', ['PRIME VIDEO 01 FHD']], ['75', 'FILMES E SÉRIES', ['A&E FHD', 'AMC FHD', 'ANIMAL PLANET FHD']]]
  .forEach(([cid, , names], k) => names.forEach((name, j) => live.push({ num: 900 + k * 10 + j, name, stream_id: 7000 + k * 10 + j, category_id: cid, epg_channel_id: '', dir: 'prisma1' })));
for (let i = 0; i < 400; i++) live.push({ num: 100 + i, name: `Canal Extra ${i + 1}`, stream_id: 100 + i, category_id: '50', epg_channel_id: '', dir: ['prisma1', 'prisma2', 'prisma3', 'prisma4'][i % 4] });

const cats = [
  ['10', 'Abertos'], ['20', 'Esportes | Futebol'], ['30', 'Notícias'], ['40', 'Filmes e Séries 24h'], ['50', 'Variedades'], ['60', '\u2666\uFE0F CANAIS | FHD H265 \u2B50'], ['61', '\uD83D\uDD36 REDE RECORD'], ['70', '\u2666\uFE0F REDE BANDEIRANTES'], ['71', '\u2666\uFE0F CANAIS | UHD 4K \u2B50'], ['72', '\u2666\uFE0F GLOBO | CAPITAIS'], ['73', '\u2666\uFE0F A FAZENDA 2026 \u2B50'], ['74', 'PPV | AMAZON PRIME'], ['75', 'FILMES E SÉRIES'],
].map(([category_id, category_name]) => ({ category_id, category_name, parent_id: 0 }));

function epgFor(id) {
  const now = Math.floor(Date.now() / 1000);
  const start = now - (now % 1800) - 900;
  const names = ['Jornal da Manhã', 'Futebol: Flamengo x Palmeiras', 'Sessão da Tarde', 'Novela das Seis'];
  return names.map((t, i) => ({
    id: String(i), epg_id: String(id), title: b64(t), description: b64(`Programa ${i + 1} do canal ${id}.`), lang: 'pt',
    start_timestamp: String(start + i * 1800), stop_timestamp: String(start + (i + 1) * 1800),
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
    if (a === 'get_vod_categories') return send([{ category_id: '1', category_name: 'Filmes | Netflix' }]);
    if (a === 'get_vod_streams') return send([{ name: 'Filme Teste', stream_id: 900, category_id: '1', container_extension: 'mp4' }]);
    if (a === 'get_series_categories') return send([{ category_id: '2', category_name: 'Séries | HBO Max' }, { category_id: '3', category_name: 'Animes' }]);
    if (a === 'get_series') return send([{ name: 'Série Teste', series_id: 1, category_id: '2' }, { name: 'Anime Teste', series_id: 2, category_id: '3' }]);
    if (a === 'get_short_epg') return send({ epg_listings: epgFor(u.searchParams.get('stream_id')) });
    return send([]);
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
