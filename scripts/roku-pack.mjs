// Empacota o app do Roku (pasta roku/) num .zip para instalar no modo
// desenvolvedor do Roku (http://IP-DO-ROKU › Upload › Install).
// A versão do manifest vem do package.json (0.30.0 → major 0, minor 30, build 0).
// Uso: node scripts/roku-pack.mjs [pasta-de-saída]

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = new URL('../roku/', import.meta.url);
const outDir = process.argv[2] || 'dist-roku';
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const [maj, min, pat] = version.split('.');

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// CRC-32 (zip)
const table = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const base = fileURLToPath(root);
const files = walk(base).filter((p) => !/LEIAME\.md$/i.test(p));
// Data/hora no formato do zip (DOS)
const now = new Date();
const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
const parts = [];
const central = [];
let offset = 0;
for (const p of files) {
  const name = relative(base, p).split('\\').join('/');
  let data = readFileSync(p);
  if (name === 'manifest') {
    data = Buffer.from(
      data
        .toString('utf8')
        .replace(/^major_version=.*$/m, `major_version=${maj}`)
        .replace(/^minor_version=.*$/m, `minor_version=${min}`)
        .replace(/^build_version=.*$/m, `build_version=${pat}`),
    );
  }
  const comp = deflateRawSync(data);
  const crc = crc32(data);
  const nameBuf = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // nomes em UTF-8
  local.writeUInt16LE(8, 8);
  local.writeUInt16LE(dosTime, 10);
  local.writeUInt16LE(dosDate, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(comp.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  parts.push(local, nameBuf, comp);
  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0);
  cen.writeUInt16LE(20, 4);
  cen.writeUInt16LE(20, 6);
  cen.writeUInt16LE(0x0800, 8);
  cen.writeUInt16LE(8, 10);
  cen.writeUInt16LE(dosTime, 12);
  cen.writeUInt16LE(dosDate, 14);
  cen.writeUInt32LE(crc, 16);
  cen.writeUInt32LE(comp.length, 20);
  cen.writeUInt32LE(data.length, 24);
  cen.writeUInt16LE(nameBuf.length, 28);
  cen.writeUInt32LE(offset, 42);
  central.push(cen, nameBuf);
  offset += 30 + nameBuf.length + comp.length;
}
const cenSize = central.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cenSize, 12);
end.writeUInt32LE(offset, 16);
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `PRISMA-Roku-${version}.zip`);
writeFileSync(out, Buffer.concat([...parts, ...central, end]));
console.log(`${out} (${files.length} arquivos)`);
