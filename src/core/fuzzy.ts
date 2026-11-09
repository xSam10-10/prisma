// Busca tolerante: aceita erros de digitação ("brekin bad" → "Breaking Bad").
// Cada palavra digitada precisa casar com alguma palavra do nome: começo igual
// ou até 1 erro (palavras de 5+ letras) / 2 erros (7+ letras).

export function normText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function dist(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

function wordOk(q: string, words: string[]): boolean {
  const max = q.length >= 7 ? 2 : q.length >= 5 ? 1 : 0;
  for (const w of words) {
    if (w.startsWith(q)) return true;
    if (max && (dist(q, w, max) <= max || (w.length > q.length && dist(q, w.slice(0, q.length), max) <= max))) return true;
  }
  return false;
}

const cache = new Map<string, string[]>();
/** O nome casa com a busca, com tolerância a erros? */
export function fuzzyMatch(name: string, query: string): boolean {
  const qs = normText(query).split(' ').filter(Boolean);
  if (!qs.length) return false;
  let words = cache.get(name);
  if (!words) {
    words = normText(name).split(' ').filter(Boolean);
    if (cache.size > 60000) cache.clear();
    cache.set(name, words);
  }
  return qs.every((q) => wordOk(q, words!));
}
