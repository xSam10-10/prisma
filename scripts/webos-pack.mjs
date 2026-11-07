// Prepara dist-webos para a TV LG:
// 1. Converte os scripts finais para ES5 (o minificador do Vite 8 devolve
//    crases e arrow functions, que o Chromium 38 da OLED B7 não entende).
// 2. Tira "crossorigin" do index.html (scripts locais via file://).
// 3. Copia appinfo.json e ícones.
// Depois: ares-package dist-webos  e  ares-install --device tv com.prisma.iptv_0.1.0_all.ipk
import { cpSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { transformSync } from '@babel/core';

const out = new URL('../dist-webos/', import.meta.url);
const assets = new URL('assets/', out);

for (const f of readdirSync(assets)) {
  if (!f.endsWith('.js')) continue;
  const file = new URL(f, assets);
  const code = readFileSync(file, 'utf8');
  const r = transformSync(code, {
    babelrc: false,
    configFile: false,
    compact: true,
    comments: false,
    sourceType: 'script',
    presets: [['@babel/preset-env', { targets: { chrome: '38' }, modules: false, bugfixes: true }]],
  });
  writeFileSync(file, r.code);
  console.log(`ES5: ${f} (${Math.round(r.code.length / 1024)} KB)`);
}

const html = new URL('index.html', out);
writeFileSync(html, readFileSync(html, 'utf8').replace(/ crossorigin(?=[ >])/g, ''));

const src = new URL('../webos/', import.meta.url);
for (const f of readdirSync(src)) cpSync(new URL(f, src), new URL(f, out));
console.log('dist-webos pronto para o ares-package.');
