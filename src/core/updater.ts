// Atualizar o PRISMA de dentro do próprio app.
//
// Todas as versões publicam, nas Releases do repositório PÚBLICO
// xSam10-10/prisma (público desde 08/11/2026), um manifesto "prisma-update.json":
//   { version, date, notes[], files: { windows, android, webos, ipk } }
// "releases/latest/download/<arquivo>" sempre aponta para a versão mais nova.
//
// Como cada plataforma instala:
//  - Windows (Electron): electron-updater baixa o instalador e reinicia.
//  - Android / Google TV: baixa o APK e abre o instalador do sistema
//    (plugin nativo ApkInstaller). A assinatura é sempre a mesma, então
//    instala por cima sem perder os dados.
//  - TV LG (webOS): um app não pode instalar .ipk. Como o PRISMA na TV é um
//    app web, baixa só o código novo (prisma-webos-<v>.json) e guarda no
//    IndexedDB; o index.html da TV carrega esse código no lugar do
//    instalado. Se o código novo não abrir, volta sozinho para o instalado.

import { fetchText } from './net';
import { IS_ANDROID, IS_WEBOS } from './platform';
import { idbDel, idbGet, idbSet, prefGet, prefSet } from './storage';
import { VERSION } from '../version';

export const DEFAULT_FEED = 'https://github.com/xSam10-10/prisma/releases/latest/download/';

export interface UpdateManifest {
  version: string;
  date?: string;
  notes?: string[];
  files: { windows?: string; android?: string; webos?: string; ipk?: string };
}

export type Platform = 'windows' | 'android' | 'webos' | 'web';

interface DesktopBridge {
  checkUpdate: () => Promise<{ version: string } | null>;
  downloadUpdate: () => Promise<boolean>;
  installUpdate: () => Promise<void>;
  onUpdate: (cb: (e: { type: string; percent?: number; version?: string; message?: string }) => void) => () => void;
}
export function desktop(): DesktopBridge | undefined {
  return (window as unknown as { prismaDesktop?: DesktopBridge }).prismaDesktop;
}

export function platform(): Platform {
  if (IS_WEBOS) return 'webos';
  if (IS_ANDROID) return 'android';
  if (desktop() || /electron/i.test(navigator.userAgent)) return 'windows';
  return 'web';
}

export function feedBase(): string {
  const f = prefGet<string>('updateFeed', '') || DEFAULT_FEED;
  return f.endsWith('/') ? f : f + '/';
}

/** "0.10.2" > "0.9.10" */
export function newer(a: string, b: string): boolean {
  const pa = a.split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = b.split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

/** Versão rodando agora (na LG pode ser a baixada por atualização). */
export function runningVersion(): string {
  const w = window as unknown as { __PRISMA_OTA__?: string };
  return w.__PRISMA_OTA__ || VERSION;
}

export async function fetchManifest(): Promise<UpdateManifest> {
  const text = await fetchText(feedBase() + 'prisma-update.json?t=' + Date.now(), 20000);
  const m = JSON.parse(text) as UpdateManifest;
  if (!m || typeof m.version !== 'string' || !m.files) throw new Error('Manifesto inválido.');
  return m;
}

export interface CheckResult {
  available: boolean;
  version?: string;
  notes?: string[];
  manifest?: UpdateManifest;
  /** Plataforma sem atualização automática (ex.: navegador). */
  unsupported?: boolean;
}

export async function checkForUpdate(): Promise<CheckResult> {
  const p = platform();
  prefSet('updateCheckedAt', Date.now());
  if (p === 'web') return { available: false, unsupported: true };
  const m = await fetchManifest();
  const file = p === 'windows' ? m.files.windows : p === 'android' ? m.files.android : m.files.webos;
  const available = !!file && newer(m.version, runningVersion());
  return { available, version: m.version, notes: m.notes, manifest: m };
}

/** Atualização automática ligada (Ajustes › Sobre; vem ligada). */
export function autoUpdateOn(): boolean {
  return prefGet<boolean>('updateAuto', true) !== false;
}

/** Verifica sozinho ao abrir o app (0.34.2: toda vez, com folga de 10 min para não repetir à toa). */
export function shouldAutoCheck(): boolean {
  if (!autoUpdateOn()) return false;
  return Date.now() - prefGet<number>('updateCheckedAt', 0) > 10 * 60 * 1000;
}

/**
 * Atualização automática (0.34.2), sem atrapalhar o que está passando:
 * - TV LG: baixa o código novo e guarda; vale na próxima vez que o app abrir → 'ready';
 * - Windows: baixa o instalador; instala ao fechar o programa → 'ready';
 * - Android: o sistema sempre pede para confirmar a instalação → 'ask' (o aviso tem "Atualizar agora").
 */
export async function autoInstall(m: UpdateManifest): Promise<'ready' | 'ask'> {
  const p = platform();
  if (p === 'webos') {
    await installWebos(m, () => {}, false);
    return 'ready';
  }
  if (p === 'windows' && desktop()) {
    await installWindows(() => {}, false);
    return 'ready';
  }
  return 'ask';
}

/** Aplica já o que foi baixado (TV: reabre; Windows: fecha, instala e abre). */
export function applyNow(): void {
  const p = platform();
  if (p === 'windows') void desktop()?.installUpdate();
  else location.reload();
}

export type Progress = (pct: number | null, msg: string) => void;

/** Baixa e instala. Devolve uma mensagem final (ou lança erro). */
export async function installUpdate(m: UpdateManifest, onProgress: Progress): Promise<string> {
  const p = platform();
  if (p === 'windows') return installWindows(onProgress);
  if (p === 'android') return installAndroid(feedBase() + m.files.android, onProgress);
  if (p === 'webos') return installWebos(m, onProgress);
  throw new Error('Esta forma do app não se atualiza sozinha.');
}

// ---------- Windows ----------
function installWindows(onProgress: Progress, install = true): Promise<string> {
  const d = desktop();
  if (!d) return Promise.reject(new Error('Feche e abra o programa de novo para atualizar.'));
  return new Promise((resolve, reject) => {
    const off = d.onUpdate((e) => {
      if (e.type === 'progress') onProgress(e.percent ?? null, 'Baixando…');
      else if (e.type === 'ready') {
        off();
        if (!install) return resolve('Pronto: instala ao fechar o programa.');
        onProgress(100, 'Instalando… o PRISMA vai fechar e abrir de novo.');
        d.installUpdate();
        resolve('Reiniciando…');
      } else if (e.type === 'error') {
        off();
        reject(new Error(e.message || 'Não deu para baixar.'));
      }
    });
    onProgress(0, 'Procurando…');
    d.checkUpdate()
      .then((r) => {
        if (!r) {
          off();
          reject(new Error('O instalador novo ainda não está disponível.'));
          return;
        }
        onProgress(0, 'Baixando…');
        return d.downloadUpdate();
      })
      .catch((e: Error) => {
        off();
        reject(e);
      });
  });
}

// ---------- Android ----------
async function installAndroid(url: string, onProgress: Progress): Promise<string> {
  const { registerPlugin } = await import('@capacitor/core');
  const ApkInstaller = registerPlugin<{
    install: (o: { url: string }) => Promise<{ status: string }>;
    addListener: (ev: 'progress', cb: (d: { percent: number }) => void) => Promise<{ remove: () => void }>;
  }>('ApkInstaller');
  const h = await ApkInstaller.addListener('progress', (d) => onProgress(d.percent, 'Baixando…'));
  try {
    onProgress(0, 'Baixando…');
    const r = await ApkInstaller.install({ url });
    if (r.status === 'permission') return 'Permita “Instalar apps desconhecidos” para o PRISMA na tela que abriu e toque em Atualizar de novo.';
    return 'Confirme “Atualizar” na tela do Android. Seus dados continuam.';
  } finally {
    h.remove();
  }
}

// ---------- TV LG ----------
interface WebosBundle {
  version: string;
  polyfills: string;
  entry: string;
}
async function installWebos(m: UpdateManifest, onProgress: Progress, reload = true): Promise<string> {
  if (!m.files.webos) throw new Error('Esta versão não tem pacote para a TV.');
  onProgress(null, 'Baixando…');
  const text = await fetchText(feedBase() + m.files.webos, 180000);
  onProgress(70, 'Conferindo…');
  const b = JSON.parse(text) as WebosBundle;
  if (!b || b.version !== m.version || typeof b.entry !== 'string' || b.entry.length < 1000 || typeof b.polyfills !== 'string') throw new Error('O pacote baixado veio incompleto. Tente de novo.');
  onProgress(85, 'Guardando…');
  await idbSet('ota', { ...b, at: Date.now() });
  const saved = await idbGet<WebosBundle>('ota');
  if (!saved || saved.version !== b.version) throw new Error('A TV não conseguiu guardar a atualização (pouco espaço).');
  try {
    localStorage.removeItem('prisma.otaBoot');
  } catch {
    /* ignora */
  }
  if (!reload) return 'Pronto: vale na próxima vez que o PRISMA abrir.';
  onProgress(100, 'Pronto! Reabrindo…');
  setTimeout(() => location.reload(), 800);
  return 'Reabrindo na versão ' + b.version + '…';
}

/** LG: volta para a versão instalada pelo .ipk (apaga a baixada). */
export async function resetWebosUpdate(): Promise<void> {
  await idbDel('ota');
  location.reload();
}

/** LG: o app abriu bem com o código baixado — avisa o carregador. */
export function markBootOk(): void {
  try {
    localStorage.removeItem('prisma.otaBoot');
  } catch {
    /* ignora */
  }
}
