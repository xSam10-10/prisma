// Servidor do PRISMA: serve o app compilado (pasta dist) e o proxy das listas.
// Usado pelo programa de Windows (desktop/main.mjs) e por "npm run serve".
// Para abrir de outro aparelho da casa:  HOST=0.0.0.0 npm run serve

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleProxy } from './proxy.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.m3u': 'audio/x-mpegurl',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.woff2': 'font/woff2',
};

/** Sobe o servidor e devolve a porta usada. Tenta as portas seguintes se a primeira estiver ocupada. */
export function startServer(root, port = 4173, host = '127.0.0.1', tries = 10) {
  const base = normalize(root.endsWith(sep) ? root : root + sep);
  const server = createServer((req, res) => {
    if (req.url?.startsWith('/proxy?')) return void handleProxy(req, res);
    const path = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = normalize(join(base, path));
    if (!file.startsWith(base)) return void res.writeHead(403).end();
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(base, 'index.html');
    // index.html nunca em cache (senão uma versão nova abre o app velho);
    // os arquivos de /assets têm o código no nome e podem ficar em cache.
    const cache = file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-store';
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': cache });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    const attempt = (p, left) => {
      server.once('error', (e) => {
        if (e.code === 'EADDRINUSE' && left > 0) attempt(p + 1, left - 1);
        else reject(e);
      });
      server.listen(p, host, () => resolve(p));
    };
    attempt(port, tries);
  });
}

// Execução direta: npm run serve
if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const root = fileURLToPath(new URL('../dist/', import.meta.url));
  if (!existsSync(join(root, 'index.html'))) {
    console.error('Pasta dist não encontrada. Rode "npm run build" antes.');
    process.exit(1);
  }
  const HOST = process.env.HOST || '127.0.0.1';
  startServer(root, Number(process.env.PORT || 4173), HOST).then((p) =>
    console.log(`PRISMA rodando em http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${p}`),
  );
}
