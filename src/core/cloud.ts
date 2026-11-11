import { prefGet, STAMPS, SYNC_KEYS } from './storage';

// Sincronização pela nuvem (0.30.0) num Gist PRIVADO do GitHub do próprio
// usuário: favoritos, Minha lista, seções, progresso, histórico, lembretes,
// Meus times, vistos, proteção, perfis e ajustes vão para um arquivo
// prisma-sync.json. Em cada aparelho, digita-se uma vez um token do GitHub com
// permissão só de "gist". Para cada preferência fica a versão mais nova
// (cada alteração local guarda a hora — storage.ts › prefSet).
//
// Nunca vão para a nuvem: login/senha da lista IPTV (sources), chave do TMDB,
// tamanho/margens da tela (são do aparelho). O token fica só neste aparelho.

const CFG = 'prisma.cloud';
const FILE = 'prisma-sync.json';
const DESC = 'PRISMA · sincronização (não apague)';
/** Ajustes que são do aparelho, não da pessoa. */
const DEVICE_SETTINGS = ['layoutForm', 'uiScale', 'safeMargin', 'tmdbKey', 'liveFormat'];

export interface CloudCfg {
  token: string;
  gistId: string;
  user?: string;
  last?: number;
  lastError?: string;
}

interface Entry {
  t: number;
  v: unknown;
}
export interface Snapshot {
  app: 'PRISMA';
  v: 2;
  at: number;
  keys: Record<string, Entry>;
}

export function cloudCfg(): CloudCfg | null {
  try {
    const c = JSON.parse(localStorage.getItem(CFG) || 'null') as CloudCfg | null;
    return c && c.token && c.gistId ? c : null;
  } catch {
    return null;
  }
}
function saveCfg(c: CloudCfg | null): void {
  try {
    if (c) localStorage.setItem(CFG, JSON.stringify(c));
    else localStorage.removeItem(CFG);
  } catch {
    /* ignora */
  }
}

/** Endereço da API (trocável para testes no servidor falso). */
function apiBase(): string {
  return prefGet<string>('cloudApi', 'https://api.github.com');
}

/** Chamada à API do GitHub (XMLHttpRequest: funciona também no Chromium antigo da TV LG). */
function gh<T>(token: string, method: string, path: string, body?: unknown, timeoutMs = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open(method, apiBase() + path, true);
    x.timeout = timeoutMs;
    x.setRequestHeader('Authorization', 'token ' + token);
    x.setRequestHeader('Accept', 'application/vnd.github+json');
    if (body !== undefined) x.setRequestHeader('Content-Type', 'application/json');
    x.ontimeout = () => reject(new Error('O GitHub demorou demais para responder.'));
    x.onerror = () => reject(new Error('Sem conexão com o GitHub.'));
    x.onload = () => {
      if (x.status === 401) return reject(new Error('Token recusado pelo GitHub (confira se copiou inteiro e se ainda vale).'));
      if (x.status === 403 || x.status === 404) return reject(new Error('O token não tem permissão de Gist (marque "gist" ao criar).'));
      if (x.status < 200 || x.status >= 300) return reject(new Error(`O GitHub respondeu com erro ${x.status}.`));
      try {
        resolve((x.responseText ? JSON.parse(x.responseText) : {}) as T);
      } catch {
        reject(new Error('Resposta inesperada do GitHub.'));
      }
    };
    x.send(body === undefined ? null : JSON.stringify(body));
  });
}

// ---------------------------------------------------------------- Retrato local

/** A chave local é sincronizável? (prisma.favs, prisma.p.p2.favs, prisma.profiles…) */
function syncable(full: string): boolean {
  const m = full.match(/^prisma\.(?:p\.[^.]+\.)?(.+)$/);
  return !!m && SYNC_KEYS.has(m[1]);
}
function stamps(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STAMPS) || '{}') as Record<string, number>;
  } catch {
    return {};
  }
}
function clean(full: string, v: unknown): unknown {
  if (/\.settings$/.test(full) && v && typeof v === 'object') {
    const o = { ...(v as Record<string, unknown>) };
    for (const k of DEVICE_SETTINGS) delete o[k];
    return o;
  }
  return v;
}

/** Tudo o que é sincronizável neste aparelho, com a hora da última alteração. */
export function localSnapshot(): Snapshot {
  const st = stamps();
  const keys: Record<string, Entry> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !syncable(k)) continue;
    try {
      keys[k] = { t: st[k] ?? 0, v: clean(k, JSON.parse(localStorage.getItem(k) as string)) };
    } catch {
      /* valor estragado: fica de fora */
    }
  }
  return { app: 'PRISMA', v: 2, at: Date.now(), keys };
}

/**
 * Junta o retrato da nuvem com o local: para cada preferência, a mais nova vence.
 * Devolve o resultado e o que mudou de cada lado.
 */
export function mergeSnapshots(local: Snapshot, remote: Snapshot | null): { merged: Snapshot; toLocal: string[]; toRemote: string[] } {
  const keys: Record<string, Entry> = { ...(remote?.keys ?? {}) };
  const toLocal: string[] = [];
  const toRemote: string[] = [];
  for (const [k, e] of Object.entries(local.keys)) {
    const r = keys[k];
    if (!r || e.t > r.t) {
      if (!r || JSON.stringify(r.v) !== JSON.stringify(e.v)) toRemote.push(k);
      keys[k] = e;
    }
  }
  // Empate (inclusive dados de antes da sincronização, sem hora): vale a nuvem — o primeiro
  // aparelho conectado vira a base e os outros recebem o que está nele.
  for (const [k, r] of Object.entries(remote?.keys ?? {})) {
    const e = local.keys[k];
    if ((!e || r.t >= e.t) && (!e || JSON.stringify(e.v) !== JSON.stringify(r.v))) toLocal.push(k);
  }
  return { merged: { app: 'PRISMA', v: 2, at: Date.now(), keys }, toLocal, toRemote };
}

/** Grava neste aparelho o que veio mais novo da nuvem (ajustes: mantém os do aparelho). */
function applyLocal(snap: Snapshot, keys: string[]): void {
  const st = stamps();
  for (const k of keys) {
    const e = snap.keys[k];
    if (!e) continue;
    let v = e.v;
    if (/\.settings$/.test(k)) {
      try {
        const cur = JSON.parse(localStorage.getItem(k) || '{}') as Record<string, unknown>;
        const keep: Record<string, unknown> = {};
        for (const d of DEVICE_SETTINGS) if (d in cur) keep[d] = cur[d];
        v = { ...(e.v as Record<string, unknown>), ...keep };
      } catch {
        /* usa como veio */
      }
    }
    localStorage.setItem(k, JSON.stringify(v));
    st[k] = e.t;
  }
  localStorage.setItem(STAMPS, JSON.stringify(st));
}

// ---------------------------------------------------------------- Gist

interface Gist {
  id: string;
  description?: string;
  files: Record<string, { content?: string; truncated?: boolean; raw_url?: string }>;
}

async function readRemote(c: CloudCfg): Promise<Snapshot | null> {
  const g = await gh<Gist>(c.token, 'GET', '/gists/' + c.gistId);
  const f = g.files?.[FILE];
  if (!f) return null;
  let text = f.content ?? '';
  if (f.truncated && f.raw_url) {
    text = await new Promise<string>((res, rej) => {
      const x = new XMLHttpRequest();
      x.open('GET', f.raw_url as string, true);
      x.onload = () => res(x.responseText);
      x.onerror = () => rej(new Error('Sem conexão com o GitHub.'));
      x.send();
    });
  }
  try {
    const s = JSON.parse(text) as Snapshot;
    return s && s.app === 'PRISMA' && s.keys ? s : null;
  } catch {
    return null;
  }
}

/** Liga a sincronização com o token: acha o Gist do PRISMA na conta ou cria um (privado). */
export async function cloudConnect(token: string): Promise<string> {
  const t = token.trim();
  if (t.length < 20) throw new Error('Esse token parece incompleto.');
  const user = await gh<{ login: string }>(t, 'GET', '/user');
  const list = await gh<Gist[]>(t, 'GET', '/gists?per_page=100');
  let g = list.find((x) => x.description === DESC && x.files && x.files[FILE]);
  if (!g) g = await gh<Gist>(t, 'POST', '/gists', { description: DESC, public: false, files: { [FILE]: { content: JSON.stringify(localSnapshot()) } } });
  saveCfg({ token: t, gistId: g.id, user: user.login });
  return user.login;
}

export function cloudDisconnect(): void {
  saveCfg(null);
}

let busy: Promise<{ pulled: number; pushed: number }> | null = null;

/**
 * Sincroniza: lê a nuvem, junta com o local e grava a versão mais nova dos dois lados.
 * apply=false (com o app aberto): só envia; o que veio mais novo da nuvem entra
 * na próxima abertura (senão a tela, com os dados antigos na memória, regravaria por cima).
 */
export function cloudSync(apply: boolean): Promise<{ pulled: number; pushed: number }> {
  const c = cloudCfg();
  if (!c) return Promise.resolve({ pulled: 0, pushed: 0 });
  if (busy) return busy;
  busy = (async () => {
    try {
      const remote = await readRemote(c);
      const { merged, toLocal, toRemote } = mergeSnapshots(localSnapshot(), remote);
      if (apply && toLocal.length) applyLocal(merged, toLocal);
      // Sem aplicar aqui, a nuvem fica com a versão mais nova de cada lado (nada se perde).
      if (toRemote.length || !remote) await gh(c.token, 'PATCH', '/gists/' + c.gistId, { files: { [FILE]: { content: JSON.stringify(merged) } } });
      saveCfg({ ...c, last: Date.now(), lastError: undefined });
      return { pulled: apply ? toLocal.length : 0, pushed: toRemote.length };
    } catch (e) {
      saveCfg({ ...c, lastError: (e as Error).message });
      throw e;
    } finally {
      setTimeout(() => (busy = null), 0);
    }
  })();
  return busy;
}

/** Na abertura do app: puxa da nuvem (até `ms`), sem travar a abertura se a internet estiver lenta. */
export function cloudPullOnStart(ms = 4000): Promise<void> {
  if (!cloudCfg()) return Promise.resolve();
  return Promise.race([cloudSync(true).then(() => undefined, () => undefined), new Promise<void>((r) => setTimeout(r, ms))]);
}
