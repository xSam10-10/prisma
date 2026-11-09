// Armazenamento local. IndexedDB para a lista (pode ter dezenas de milhares
// de itens) e localStorage para preferências pequenas.

const DB_NAME = 'prisma';
const STORE = 'kv';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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
const PER_PROFILE = new Set(['favs', 'recents', 'sections', 'myList', 'progress', 'vodRecents', 'reminders', 'settings', 'live.cat', 'tab', 'lastKind', 'locked', 'myTeams', 'watched', 'epAlerts']);

function profileId(): string {
  try {
    const v = localStorage.getItem('prisma.profile');
    return v ? (JSON.parse(v) as string) : 'p1';
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

export function prefSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(fullKey(key), JSON.stringify(value));
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
