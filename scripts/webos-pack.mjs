// Prepara dist-webos para a TV LG:
// 1. Converte os scripts finais para ES5 (o minificador do Vite 8 devolve
//    crases e arrow functions, que o Chromium 38 da OLED B7 não entende).
// 2. Tira "crossorigin" do index.html (scripts locais via file://).
// 3. Copia appinfo.json e ícones.
// Depois: ares-package dist-webos  e  ares-install --device tv com.prisma.iptv_0.1.0_all.ipk
import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
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
let page = readFileSync(html, 'utf8').replace(/ crossorigin(?=[ >])/g, '');

// 4. Atualização dentro do app (TV LG): um carregador decide se abre o código
//    instalado ou o código mais novo baixado pelo próprio app (guardado no
//    IndexedDB). Se o código baixado não abrir, volta sozinho para o instalado.
const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const poly = page.match(/<script id="vite-legacy-polyfill" src="([^"]+)"><\/script>/);
const entry = page.match(/<script id="vite-legacy-entry" data-src="([^"]+)">[^<]*<\/script>/);
if (!poly || !entry) throw new Error('index.html da TV mudou: não achei os scripts legacy.');
const loader = `<script>(function(){
var PACKAGED=${JSON.stringify(version)},POLY=${JSON.stringify(poly[1])},ENTRY=${JSON.stringify(entry[1])};
function newer(a,b){a=String(a).split('.');b=String(b).split('.');for(var i=0;i<Math.max(a.length,b.length);i++){var x=parseInt(a[i],10)||0,y=parseInt(b[i],10)||0;if(x!==y)return x>y;}return false;}
function packaged(){var s=document.createElement('script');s.src=POLY;s.onload=function(){System.import(ENTRY);};document.body.appendChild(s);}
var done=false;function go(f){if(!done){done=true;f();}}
var tried=null;try{tried=localStorage.getItem('prisma.otaBoot');}catch(e){}
setTimeout(function(){go(packaged);},4000);
try{var rq=indexedDB.open('prisma',1);
rq.onupgradeneeded=function(){rq.result.createObjectStore('kv');};
rq.onerror=function(){go(packaged);};
rq.onsuccess=function(){try{var db=rq.result,g=db.transaction('kv','readonly').objectStore('kv').get('ota');
g.onerror=function(){go(packaged);};
g.onsuccess=function(){var b=g.result;
if(!b||!b.version||!newer(b.version,PACKAGED)){go(packaged);return;}
if(tried===b.version){try{db.transaction('kv','readwrite').objectStore('kv').delete('ota');localStorage.removeItem('prisma.otaBoot');}catch(e){}go(packaged);return;}
go(function(){try{localStorage.setItem('prisma.otaBoot',b.version);}catch(e){}
window.__PRISMA_OTA__=b.version;
var s=document.createElement('script');s.text=b.polyfills;document.body.appendChild(s);
System.import(URL.createObjectURL(new Blob([b.entry],{type:'text/javascript'})));
setTimeout(function(){if(!window.__PRISMA_BOOTED__)location.reload();},25000);});};
}catch(e){go(packaged);}};
}catch(e){go(packaged);}
})();</script>`;
page = page.replace(poly[0], '').replace(entry[0], loader);
writeFileSync(html, page);

// Pacote do código para a atualização dentro do app: dist-ota/prisma-webos-<versão>.json
const ota = new URL('../dist-ota/', import.meta.url);
mkdirSync(ota, { recursive: true });
const bundle = {
  version,
  polyfills: readFileSync(new URL(poly[1].replace(/^\.\//, ''), out), 'utf8'),
  entry: readFileSync(new URL(entry[1].replace(/^\.\//, ''), out), 'utf8'),
};
writeFileSync(new URL(`prisma-webos-${version}.json`, ota), JSON.stringify(bundle));
console.log(`Pacote de atualização da TV: dist-ota/prisma-webos-${version}.json (${Math.round(JSON.stringify(bundle).length / 1024)} KB)`);

const src = new URL('../webos/', import.meta.url);
for (const f of readdirSync(src)) cpSync(new URL(f, src), new URL(f, out));
console.log('dist-webos pronto para o ares-package.');
