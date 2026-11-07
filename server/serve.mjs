// Servidor do PRISMA para usar no computador: serve o app já compilado
// (pasta dist) e o proxy das listas. Uso:  npm run build && npm run serve
// Para abrir de outro aparelho da casa:  HOST=0.0.0.0 npm run serve

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleProxy } from './proxy.mjs';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '127.0.0.1';
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

if (!existsSync(join(root, 'index.html'))) {
  console.error('Pasta dist não encontrada. Rode "npm run build" antes.');
  process.exit(1);
}

createServer((req, res) => {
  if (req.url?.startsWith('/proxy?')) return void handleProxy(req, res);
  const path = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = normalize(join(root, path));
  if (!file.startsWith(root)) return void res.writeHead(403).end();
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(PORT, HOST, () => {
  console.log(`PRISMA rodando em http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
});
