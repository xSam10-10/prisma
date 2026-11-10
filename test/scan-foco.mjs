// Varredura: anda com as setas por todas as telas e avisa se o item em foco fica cortado.
// Uso: node test/fake-xtream.mjs & npx vite --port 5173 & e depois
//   NPMROOT=$(npm root -g) node test/scan-foco.mjs 2000x800   (ou 1280x720, tamanho da TV)
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.env.NPMROOT + '/')('playwright');
const [W, H] = (process.argv[2] || '2000x800').split('x').map(Number);
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {}); // CHROME=caminho de outro Chromium (ex.: Edge), opcional
const p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.route(/\/live\//, () => {});
await p.addInitScript(() => {
  const set = (k, v) => localStorage.setItem('prisma.' + k, JSON.stringify(v));
  set('topsFeed', 'http://127.0.0.1:8090/tops/prisma-tops.json');
  set('sportsFeed', 'http://127.0.0.1:8090/tops/prisma-sports.json'); set('scoresBase', 'http://127.0.0.1:8090/espn');
  set('tmdbKey', 'chave-teste'); set('tmdbBase', 'http://127.0.0.1:8090/tmdb/3'); set('tmdbImg', 'http://127.0.0.1:8090/tmdb/img');
});
await p.goto('http://localhost:5173/'); await p.waitForTimeout(2500);
await p.fill('#f-server', 'http://127.0.0.1:8090'); await p.fill('#f-user', 'teste'); await p.fill('#f-pass', '1234');
await p.click('text=Entrar'); await p.waitForTimeout(5000);
await p.evaluate(() => document.documentElement.classList.add('kbd'));
// Verifica se o foco está inteiro visível: na janela, abaixo do menu e dentro de cada ancestral que corta (overflow).
const check = () => p.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return null;
  const r = a.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const top = document.querySelector('.top, header, nav')?.closest('.top, header') || null;
  const hb = top ? top.getBoundingClientRect().bottom : 0;
  const issues = [];
  const tol = 4;
  if (r.bottom > innerHeight + tol) issues.push('abaixo da tela ' + Math.round(r.bottom - innerHeight) + 'px');
  if (r.top < -tol) issues.push('acima da tela');
  let el = a.parentElement;
  while (el && el !== document.body) {
    const cs = getComputedStyle(el);
    if (/(auto|scroll|hidden)/.test(cs.overflowY) && el.clientHeight > 0) {
      const er = el.getBoundingClientRect();
      if (r.bottom > er.bottom + tol) issues.push('cortado embaixo por .' + (el.className || el.tagName).toString().split(' ')[0] + ' ' + Math.round(r.bottom - er.bottom) + 'px');
      if (r.top < er.top - tol) issues.push('cortado em cima por .' + (el.className || el.tagName).toString().split(' ')[0] + ' ' + Math.round(er.top - r.top) + 'px');
      break;
    }
    el = el.parentElement;
  }
  const label = ((a.getAttribute('aria-label') || a.textContent || a.tagName) + '').trim().replace(/\s+/g, ' ').slice(0, 40);
  return issues.length ? label + ' → ' + issues.join(', ') : null;
});
const walk = async (name, keys) => {
  const seen = new Set();
  for (const k of keys) {
    await p.keyboard.press(k); await p.waitForTimeout(260);
    const c = await check();
    if (c && !seen.has(c)) { seen.add(c); console.log(`[${name}] ${k}: ${c}`); }
  }
  console.log(`[${name}] ok (${keys.length} teclas, ${seen.size} problemas)`);
};
const downs = (n) => Array(n).fill('ArrowDown');
const ups = (n) => Array(n).fill('ArrowUp');
const tab = async (t) => { await p.click(`nav >> text=${t}`); await p.waitForTimeout(2500); await p.evaluate(() => document.documentElement.classList.add('kbd')); };
const focusFirst = (sel) => p.evaluate((s) => document.querySelector(s)?.focus(), sel);

await tab('Início'); await focusFirst('[data-home-top] button, .scroll-y button'); await walk('Início', [...downs(22), ...ups(22)]);
await tab('Ao vivo'); await focusFirst('.cats .cat'); await walk('Ao vivo · categorias', downs(30));
await p.keyboard.press('ArrowRight'); await walk('Ao vivo · canais', downs(25));
await tab('Jogos'); await focusFirst('.sports-hub [data-nav]'); await walk('Jogos · início', [...downs(12), 'ArrowRight', 'ArrowRight', ...ups(12)]);
// Página de cada tipo de campeonato (liga e copa): menu e cada seção
for (const nth of [0, 1]) {
  await p.locator('.lcard').nth(nth).click(); await p.waitForTimeout(1500); await p.evaluate(() => document.documentElement.classList.add('kbd'));
  const n = await p.locator('.lg-menu .lg-mi').count();
  for (let i = 0; i < n - 1; i++) { await p.locator('.lg-menu .lg-mi').nth(i).focus(); await p.waitForTimeout(400); await walk(`Jogos · campeonato ${nth + 1} · seção ${i + 1}`, ['ArrowRight', ...downs(25), ...ups(25)]); }
  await p.keyboard.press('Escape'); await p.waitForTimeout(1000);
}
await p.click('button.chip:has-text("Guia de jogos")'); await p.waitForTimeout(2500); await p.evaluate(() => document.documentElement.classList.add('kbd'));
await focusFirst('.chip, button.chip'); await walk('Jogos · guia', [...downs(15), 'ArrowRight', ...downs(15)]);
for (const t of ['Filmes', 'Séries']) {
  await tab(t); await focusFirst('.stream-chip, .chip'); await walk(t, [...downs(18), ...ups(18)]);
}
await p.locator('button[aria-label="Buscar"]:visible').first().click(); await p.waitForTimeout(1200);
await p.keyboard.type('do'); await p.waitForTimeout(1200);
await focusFirst('.sk-key'); await walk('Busca · teclado', downs(8));
await walk('Busca · resultados', ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', ...downs(6)]);
await p.locator('button[aria-label="Minha lista"]:visible, button[aria-label*="lista" i]:visible').first().click().catch(() => {}); await p.waitForTimeout(1500);
await focusFirst('.scroll-y [data-nav], [data-nav]'); await walk('Minha lista', downs(10));
await p.locator('button.avatar:visible').first().click(); await p.waitForTimeout(1200);
await focusFirst('button.sec'); await walk('Ajustes · seções', downs(12));
for (const sec of ['Tela', 'Player', 'Aparência', 'Perfis', 'Proteção', 'Lista', 'Serviços', 'Dados e limpeza', 'Sobre']) {
  await p.click(`button.sec:has-text("${sec}")`).catch(() => {}); await p.waitForTimeout(500);
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(300);
  await walk('Ajustes · ' + sec, downs(18));
}
await b.close();
