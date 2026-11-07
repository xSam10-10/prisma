// Proxy local do PRISMA para o modo computador/navegador.
// Os servidores IPTV não liberam CORS, então o navegador pede tudo aqui
// (/proxy?url=...) e este processo busca no servidor real.
// Playlists HLS têm os endereços relativos reescritos para absolutos,
// para que o player continue pedindo os pedaços através do proxy.

import { Readable } from 'node:stream';

const DEFAULT_UA = 'VLC/3.0.20 LibVLC/3.0.20';
// "Nomes de player" tentados quando o servidor recusa o primeiro
// (alguns painéis IPTV só respondem a apps conhecidos).
const FALLBACK_UAS = [
  'IPTVSmartersPlayer',
  'okhttp/4.12.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
];

// Função de rede: no programa de Windows é trocada pela do Chromium
// (net.fetch do Electron), que respeita o proxy/rede configurados no Windows.
let doFetch = (...a) => fetch(...a);
// "Nome de player" que funcionou para cada servidor (vale também para os vídeos).
const uaByHost = new Map();
export function setFetch(fn) {
  doFetch = fn;
}

/**
 * Segue redirecionamentos manualmente para saber o endereço final
 * (a rede do Chromium não informa response.url). Devolve { up, finalUrl }.
 */
async function fetchFollow(url, opts) {
  let current = url;
  for (let hop = 0; hop < 6; hop++) {
    const up = await doFetch(current, { ...opts, redirect: 'manual' });
    const loc = up.headers.get('location');
    if (up.status >= 300 && up.status < 400 && loc) {
      try {
        await up.body?.cancel();
      } catch {
        /* ignora */
      }
      current = new URL(loc, current).href;
      continue;
    }
    // (a rede do Chromium já segue sozinha e informa o endereço final em up.url)
    return { up, finalUrl: up.url || current };
  }
  throw new Error('redirecionamentos demais');
}

/** Resumo do erro do servidor para mostrar na tela (ex.: título da página de bloqueio). */
async function describe(up) {
  const parts = [`HTTP ${up.status}`];
  const server = up.headers.get('server');
  if (server) parts.push(server);
  try {
    const body = (await up.text()).slice(0, 4000);
    const title = body.match(/<title[^>]*>([^<]{1,120})<\/title>/i)?.[1]?.trim();
    if (title) parts.push(title);
    else if (body && !/^\s*</.test(body)) parts.push(body.trim().slice(0, 120));
  } catch {
    /* ignora */
  }
  return parts.join(' · ').replace(/[\r\n]+/g, ' ');
}
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
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, X-Prisma-Final-Url, X-Prisma-Detail, X-Prisma-Proxy');
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

  const host = new URL(target).host;
  const headers = { 'user-agent': reqUrl.searchParams.get('ua') || uaByHost.get(host) || DEFAULT_UA, accept: '*/*' };
  const ref = reqUrl.searchParams.get('ref');
  if (ref) headers.referer = ref;
  if (req.headers.range) headers.range = req.headers.range;

  // Pedidos da lista (não de vídeo) tentam outros "nomes de player" se o servidor recusar.
  const isMedia = /\.(ts|m3u8|mp4|mkv|aac|m4s)(\?|$)/i.test(target) || /\/(live|movie|series)\//i.test(target);
  const uas = (reqUrl.searchParams.get('ua') || isMedia) ? [headers['user-agent']] : [...new Set([headers['user-agent'], DEFAULT_UA, ...FALLBACK_UAS])];

  let up;
  let finalUrl = target;
  let lastErr;
  for (const ua of uas) {
    headers['user-agent'] = ua;
    try {
      ({ up, finalUrl } = await fetchFollow(target, { headers, signal: ctrl.signal }));
    } catch (e) {
      if (ctrl.signal.aborted) return;
      lastErr = e;
      up = undefined;
      continue;
    }
    if (up.ok || up.status === 206) {
      if (!reqUrl.searchParams.get('ua')) uaByHost.set(host, ua);
      break;
    }
    if (up.status === 401 || up.status === 404) break;
  }

  if (!up) {
    const code = lastErr?.cause?.code || lastErr?.message || String(lastErr);
    res.writeHead(502, { 'content-type': 'text/plain', 'x-prisma-proxy': 'error', 'x-prisma-detail': encodeURIComponent(String(code).slice(0, 200)) }).end(String(code));
    return;
  }
  if (!up.ok && up.status !== 206 && !isMedia) {
    const detail = await describe(up);
    res.writeHead(up.status, { 'content-type': 'text/plain', 'x-prisma-detail': encodeURIComponent(detail) }).end(detail);
    return;
  }

  const ctype = (up.headers.get('content-type') || '').toLowerCase();
  const looksHls = /mpegurl/.test(ctype) || /\.m3u8(\?|$)/i.test(finalUrl);
  res.setHeader('X-Prisma-Final-Url', finalUrl);

  if (looksHls && up.ok) {
    const text = await up.text().catch(() => '');
    // Só reescreve playlist HLS (#EXT-X-...); lista IPTV comum passa direto.
    const out = /#EXT-X-/.test(text) ? rewriteHls(text, finalUrl) : text;
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
