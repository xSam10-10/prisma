// Armazenamento local. IndexedDB para a lista (pode ter dezenas de milhares
// de itens) e localStorage para preferências pequenas.

const DB_NAME = 'prisma';
const STORE = 'kv';

// Uma conexão só, reaproveitada (antes: uma nova a cada leitura/gravação, que
// nunca fechava — e impedia recriar o banco quando falta espaço na TV).
let dbp: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbp = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
  dbp.catch(() => (dbp = null));
  return dbp;
}

/**
 * Recria o banco do zero, guardando de volta só o que for pedido. Na TV LG o
 * espaço de itens apagados demora a voltar (o banco só compacta depois); apagar
 * o banco inteiro libera na hora. Devolve se conseguiu gravar `first`.
 */
export async function idbRebuild(first: [string, unknown], keepKeys: string[]): Promise<boolean> {
  const kept: [string, unknown][] = [];
  for (const k of keepKeys) {
    const v = await idbGet(k);
    if (v !== undefined) kept.push([k, v]);
  }
  try {
    const db = await openDb();
    db.close();
  } catch {
    /* ignora */
  }
  dbp = null;
  await new Promise<void>((resolve) => {
    try {
      const r = indexedDB.deleteDatabase(DB_NAME);
      r.onsuccess = () => resolve();
      r.onerror = () => resolve();
      r.onblocked = () => setTimeout(resolve, 3000);
    } catch {
      resolve();
    }
  });
  const ok = await idbTrySet(first[0], first[1]);
  for (const [k, v] of kept) await idbTrySet(k, v);
  return ok;
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openDb();
    return await new Promise<T | undefined>((resolve, reject) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result as T | undefined);
      r.onerror = () => reject(r.error);
    });
  } catch {
    return undefined;
  }
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* sem armazenamento: o app segue funcionando, só não guarda */
  }
}

/**
 * Espaço livre do armazenamento em bytes (Chrome antigo: webkitTemporaryStorage).
 * Sem como saber: Infinity.
 */
export function storageRoom(): Promise<number> {
  return new Promise((resolve) => {
    try {
      const s = (navigator as unknown as { webkitTemporaryStorage?: { queryUsageAndQuota(ok: (u: number, q: number) => void, err?: () => void): void } }).webkitTemporaryStorage;
      if (!s) return resolve(Infinity);
      s.queryUsageAndQuota((u, q) => resolve(Math.max(0, q - u)), () => resolve(Infinity));
    } catch {
      resolve(Infinity);
    }
  });
}

/** Como idbSet, mas diz se gravou (false: sem espaço ou erro). */
export async function idbTrySet(key: string, value: unknown): Promise<boolean> {
  try {
    const db = await openDb();
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function idbDel(key: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignora */
  }
}

// Preferências por perfil: cada perfil tem os seus. O 1º perfil usa as chaves
// antigas (sem prefixo), para não perder nada de quem já usava o app.
const PER_PROFILE = new Set(['favs', 'recents', 'sections', 'myList', 'progress', 'vodRecents', 'reminders', 'settings', 'live.cat', 'tab', 'lastKind', 'locked', 'myTeams', 'watched', 'epAlerts', 'lockedCats', 'hiddenCats', 'hiddenCh', 'trackPref']);

let profRaw: string | null | undefined;
let profVal = 'p1';
function profileId(): string {
  try {
    const v = localStorage.getItem('prisma.profile');
    if (v !== profRaw) {
      profRaw = v;
      profVal = v ? (JSON.parse(v) as string) : 'p1';
    }
    return profVal;
  } catch {
    return 'p1';
  }
}

function fullKey(key: string): string {
  if (!PER_PROFILE.has(key)) return 'prisma.' + key;
  const id = profileId();
  return id === 'p1' ? 'prisma.' + key : `prisma.p.${id}.${key}`;
}

export function prefGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(fullKey(key));
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

/**
 * Leitura rápida, SÓ PARA CONSULTA (0.35.0): reaproveita o valor já convertido enquanto o texto
 * guardado for o mesmo. As capas consultam progresso/assistidos a cada movimento do controle;
 * antes cada consulta convertia o JSON de novo. Não altere o objeto devolvido (use prefGet).
 */
const readCache = new Map<string, { raw: string | null; val: unknown }>();
export function prefRead<T>(key: string, fallback: T): T {
  try {
    const full = fullKey(key);
    const raw = localStorage.getItem(full);
    const hit = readCache.get(full);
    if (hit && hit.raw === raw) return (raw == null ? fallback : hit.val) as T;
    const val = raw == null ? fallback : (JSON.parse(raw) as T);
    readCache.set(full, { raw, val });
    return val;
  } catch {
    return fallback;
  }
}

/** Preferências que vão para a nuvem (0.30.0). Ficam de fora: lista/senha da assinatura e o que é do aparelho. As chaves do TMDB e da ThePornDB vão (0.31.0, pedido do Samuel), só no Gist privado. */
export const SYNC_KEYS = new Set(['favs', 'recents', 'sections', 'myList', 'progress', 'vodRecents', 'reminders', 'settings', 'myTeams', 'watched', 'epAlerts', 'locked', 'lockedCats', 'hiddenCats', 'hiddenCh', 'trackPref', 'profiles', 'pin', 'epgExtra', 'tmdbKey', 'tpdbKey', 'freeHours']);
export const STAMPS = 'prisma.syncStamps';

/** Guarda quando cada preferência sincronizada mudou (a mais nova vence na nuvem). */
function stamp(full: string): void {
  try {
    const m = JSON.parse(localStorage.getItem(STAMPS) || '{}') as Record<string, number>;
    m[full] = Date.now();
    localStorage.setItem(STAMPS, JSON.stringify(m));
  } catch {
    /* ignora */
  }
}

export function prefSet(key: string, value: unknown): void {
  try {
    const full = fullKey(key);
    const text = JSON.stringify(value);
    if (SYNC_KEYS.has(key) && localStorage.getItem(full) !== text) stamp(full);
    localStorage.setItem(full, text);
  } catch {
    /* ignora */
  }
}

/** Apaga todas as preferências de um perfil (ao excluir o perfil). */
export function dropProfilePrefs(id: string): void {
  try {
    const prefix = id === 'p1' ? null : `prisma.p.${id}.`;
    for (const k of Object.keys(localStorage)) {
      if (prefix ? k.startsWith(prefix) : PER_PROFILE.has(k.replace(/^prisma\./, ''))) localStorage.removeItem(k);
    }
  } catch {
    /* ignora */
  }
}
