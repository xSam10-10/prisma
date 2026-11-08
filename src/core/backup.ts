// Levar os dados de um aparelho para outro (Ajustes › Dados): exporta um
// arquivo .json com favoritos, seções, Minha lista, histórico, progresso,
// lembretes e ajustes do perfil atual; no outro aparelho, importa juntando
// com o que já existe.

import { IS_ANDROID } from './platform';
import { currentProfile } from './profiles';
import { prefGet, prefSet } from './storage';

const KEYS = ['favs', 'recents', 'sections', 'myList', 'progress', 'vodRecents', 'reminders', 'settings'] as const;

export interface Backup {
  app: 'PRISMA';
  v: 1;
  profile: string;
  at: string;
  data: Partial<Record<(typeof KEYS)[number], unknown>>;
}

export function buildBackup(): Backup {
  const data: Backup['data'] = {};
  for (const k of KEYS) {
    const v = prefGet<unknown>(k, undefined);
    if (v !== undefined) data[k] = v;
  }
  return { app: 'PRISMA', v: 1, profile: currentProfile().name, at: new Date().toISOString(), data };
}

function idOf(x: unknown): string {
  if (x && typeof x === 'object') {
    const o = x as { id?: unknown; key?: unknown };
    if (o.id != null) return String(o.id);
    if (o.key != null) return String(o.key);
  }
  return JSON.stringify(x);
}

/** Junta duas listas sem repetir (o que veio do arquivo fica na frente). */
function mergeList(a: unknown[], b: unknown[]): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const x of [...b, ...a]) {
    const k = idOf(x);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
}

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

/** Junta dois objetos; listas dentro deles também são juntadas. */
function mergeObj(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const cur = out[k];
    if (Array.isArray(cur) && Array.isArray(v)) out[k] = mergeList(cur, v);
    else if (isObj(cur) && isObj(v) && k !== 'settings') out[k] = mergeObj(cur, v);
    else out[k] = v;
  }
  return out;
}

/** Lê o arquivo e aplica. Devolve um resumo do que entrou. */
export function applyBackup(text: string, mode: 'merge' | 'replace'): string {
  let b: Backup;
  try {
    b = JSON.parse(text) as Backup;
  } catch {
    throw new Error('O arquivo não é um backup do PRISMA.');
  }
  if (!b || b.app !== 'PRISMA' || !isObj(b.data)) throw new Error('O arquivo não é um backup do PRISMA.');
  let n = 0;
  for (const k of KEYS) {
    const v = (b.data as Record<string, unknown>)[k];
    if (v === undefined) continue;
    n++;
    const cur = prefGet<unknown>(k, undefined);
    if (mode === 'replace' || cur === undefined) prefSet(k, v);
    else if (k === 'settings') prefSet(k, { ...(isObj(cur) ? cur : {}), ...(v as object) });
    else if (Array.isArray(cur) && Array.isArray(v)) prefSet(k, mergeList(cur, v));
    else if (isObj(cur) && isObj(v)) prefSet(k, mergeObj(cur, v));
    else prefSet(k, v);
  }
  return `${n} grupos de dados de “${b.profile}” (${new Date(b.at).toLocaleDateString('pt-BR')}).`;
}

function fileName(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const who = currentProfile().name.normalize('NFD').replace(/[^\w]+/g, '-').toLowerCase();
  return `prisma-${who}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

/** Salva o arquivo: download no navegador/Windows; Compartilhar no Android. */
export async function exportBackup(): Promise<string> {
  const text = JSON.stringify(buildBackup(), null, 1);
  const name = fileName();
  if (IS_ANDROID) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const r = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: 'Dados do PRISMA', files: [r.uri], dialogTitle: 'Enviar dados do PRISMA' });
    return 'Escolha onde guardar (Drive, WhatsApp, e-mail…).';
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return `Arquivo ${name} salvo em Downloads.`;
}

/** Abre o seletor de arquivo e devolve o texto escolhido. */
export function pickBackupFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) return resolve(null);
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => resolve(null);
      r.readAsText(f);
    };
    inp.click();
  });
}
