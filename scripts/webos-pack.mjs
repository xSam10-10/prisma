// Copia o appinfo.json e os ícones da LG para dist-webos.
// Depois: ares-package dist-webos  (gera o .ipk)  e  ares-install --device tv com.prisma.iptv_0.1.0_all.ipk
import { cpSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
const out = new URL('../dist-webos/', import.meta.url);
const src = new URL('../webos/', import.meta.url);
for (const f of readdirSync(src)) cpSync(new URL(f, src), new URL(f, out));
// Sem "crossorigin": scripts locais (file://) na TV não precisam e podem falhar.
const html = new URL('index.html', out);
writeFileSync(html, readFileSync(html, 'utf8').replace(/ crossorigin(?=[ >])/g, ''));
console.log('dist-webos pronto para o ares-package.');
