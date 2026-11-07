// Proxy local do PRISMA para o modo computador/navegador.
// Os servidores IPTV não liberam CORS, então o navegador pede tudo aqui
// (/proxy?url=...) e este processo busca no servidor real.
// Playlists HLS têm os endereços relativos reescritos para absolutos,
// para que o player continue pedindo os pedaços através do proxy.

import { Readable } from 'node:stream';

const DEFAULT_UA = 'VLC/3.0.20 LibVLC/3.0.20';
const PASS_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control', 'last-modified', 'etag'];

function rewriteHls(body, baseUrl) {
  const abs = (u) => {
    try {
      return new URL(u, baseUrl).href;
    } catch {
      return u;
    }
  };
  return body
    .split(/\r?\n/)
    .map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_, u) => `URI="${abs(u)}"`);
      return abs(t);
    })
    .join('\n');
}

export async function handleProxy(req, res) {
  const reqUrl = new URL(req.url, 'http://local');
  const target = reqUrl.searchParams.get('url');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, X-Prisma-Final-Url');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.writeHead(204).end();
    return;
  }
  if (!target || !/^https?:\/\//i.test(target)) {
    res.writeHead(400, { 'content-type': 'text/plain' }).end('url inválida');
    return;
  }

  const ctrl = new AbortController();
  res.on('close', () => ctrl.abort());

  const headers = { 'user-agent': reqUrl.searchParams.get('ua') || DEFAULT_UA, accept: '*/*' };
  const ref = reqUrl.searchParams.get('ref');
  if (ref) headers.referer = ref;
  if (req.headers.range) headers.range = req.headers.range;

  let up;
  try {
    up = await fetch(target, { headers, redirect: 'follow', signal: ctrl.signal });
  } catch (e) {
    if (ctrl.signal.aborted) return;
    res.writeHead(502, { 'content-type': 'text/plain', 'x-prisma-proxy': 'error' }).end(String(e?.cause?.code || e?.message || e));
    return;
  }

  const ctype = (up.headers.get('content-type') || '').toLowerCase();
  const looksHls = /mpegurl/.test(ctype) || /\.m3u8(\?|$)/i.test(up.url);
  res.setHeader('X-Prisma-Final-Url', up.url);

  if (looksHls && up.ok) {
    const text = await up.text().catch(() => '');
    // Só reescreve playlist HLS (#EXT-X-...); lista IPTV comum passa direto.
    const out = /#EXT-X-/.test(text) ? rewriteHls(text, up.url) : text;
    res.writeHead(up.status, { 'content-type': ctype || 'application/vnd.apple.mpegurl', 'cache-control': 'no-cache' });
    res.end(out);
    return;
  }

  const outHeaders = {};
  for (const h of PASS_HEADERS) {
    const v = up.headers.get(h);
    if (v) outHeaders[h] = v;
  }
  // fetch já descompactou: o tamanho original não vale mais.
  if (up.headers.get('content-encoding')) delete outHeaders['content-length'];
  res.writeHead(up.status, outHeaders);
  if (!up.body) {
    res.end();
    return;
  }
  Readable.fromWeb(up.body)
    .on('error', () => res.destroy())
    .pipe(res);
}

/** Plugin do Vite: o mesmo proxy no `npm run dev`. */
export function prismaProxyPlugin() {
  return {
    name: 'prisma-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/proxy?')) handleProxy(req, res);
        else next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/proxy?')) handleProxy(req, res);
        else next();
      });
    },
  };
}
