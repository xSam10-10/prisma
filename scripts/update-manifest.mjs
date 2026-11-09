// Gera o manifesto da atualização dentro do app: prisma-update.json
// Uso: node scripts/update-manifest.mjs <pasta-dos-arquivos>
// Lê a versão do package.json e as notas da seção dela em release-notes.md.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] || 'out';
const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const md = readFileSync(new URL('../release-notes.md', import.meta.url), 'utf8');
// Aceita "## 0.22.0" e "## 0.22.0 — subtítulo".
const sec = md.split(/^## /m).find((s) => s.startsWith(version) && /^[\s—–-]/.test(s.slice(version.length)));
const notes = sec ? sec.split('\n').slice(1).filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim()) : [];
const files = readdirSync(dir);
const pick = (re) => files.find((f) => re.test(f));
const manifest = {
  version,
  date: new Date().toISOString(),
  notes,
  files: {
    windows: pick(new RegExp(`^PRISMA-Setup-${version.replace(/\./g, '\\.')}\\.exe$`)),
    android: pick(new RegExp(`^PRISMA-Android-${version.replace(/\./g, '\\.')}\\.apk$`)),
    webos: pick(new RegExp(`^prisma-webos-${version.replace(/\./g, '\\.')}\\.json$`)),
    ipk: pick(/^com\.prisma\.iptv_.*\.ipk$/),
  },
};
writeFileSync(join(dir, 'prisma-update.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
for (const [k, v] of Object.entries(manifest.files)) if (!v) console.warn(`aviso: arquivo de ${k} da versão ${version} não encontrado em ${dir}`);
