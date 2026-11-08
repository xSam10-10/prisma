// PRISMA para Windows (Electron).
// O programa sobe internamente o mesmo servidor do modo computador
// (app + proxy das listas) e abre uma janela própria apontando para ele.
// Porta fixa (47815) para que favoritos e a lista salva não se percam.

import { app, BrowserWindow, ipcMain, Menu, session, shell } from 'electron';
import updaterPkg from 'electron-updater';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromiumFetch } from './netfetch.mjs';
import { fileURLToPath } from 'node:url';
import { setFetch } from '../server/proxy.mjs';
import { startServer } from '../server/serve.mjs';

const PORT = 47815;
let win = null;

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

/** Versão nova instalada: limpa o cache do navegador interno (os dados — lista, favoritos — ficam). */
async function clearCacheOnUpdate() {
  const mark = join(app.getPath('userData'), 'versao.txt');
  const before = existsSync(mark) ? readFileSync(mark, 'utf8').trim() : '';
  if (before !== app.getVersion()) {
    await session.defaultSession.clearCache();
    writeFileSync(mark, app.getVersion());
  }
}

async function createWindow() {
  await clearCacheOnUpdate();
  const root = fileURLToPath(new URL('../dist/', import.meta.url));
  // Rede do Chromium: usa o proxy e os certificados configurados no Windows.
  setFetch(chromiumFetch);
  const port = await startServer(root, PORT);

  win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: '#0B0B12',
    title: 'PRISMA',
    icon: fileURLToPath(new URL('./icon.png', import.meta.url)),
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)) },
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => win.show());

  // F11 = tela cheia · Ctrl+R = recarregar · F12 = ferramentas (diagnóstico)
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    } else if (input.key === 'F12') {
      win.webContents.toggleDevTools();
      e.preventDefault();
    } else if (input.control && input.key.toLowerCase() === 'r') {
      win.webContents.reload();
      e.preventDefault();
    } else if (input.key === 'Escape' && win.isFullScreen() && input.shift) {
      win.setFullScreen(false);
    }
  });

  // Links externos abrem no navegador, não dentro do app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadURL(`http://127.0.0.1:${port}/`);
  win.on('closed', () => (win = null));
}

// Vídeo começa a tocar sem precisar de clique.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.whenReady().then(async () => {
  await createWindow();
  checkUpdates();
});

// Atualização dentro do app: procura uma versão nova nas Releases públicas
// (repositório xSam10-10/prisma-releases, só com os instaladores). A tela
// (Ajustes › Sobre, ou o aviso ao abrir) pede para baixar e instalar.
// Se ninguém pedir, uma versão já baixada é instalada ao fechar o programa.
const FEED = process.env.PRISMA_UPDATE_FEED || 'https://github.com/xSam10-10/prisma-releases/releases/latest/download';
function checkUpdates() {
  const { autoUpdater } = updaterPkg;
  const send = (data) => win && !win.isDestroyed() && win.webContents.send('upd:event', data);
  autoUpdater.setFeedURL({ provider: 'generic', url: FEED });
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('error', (e) => send({ type: 'error', message: String((e && e.message) || e).slice(0, 200) }));
  autoUpdater.on('download-progress', (p) => send({ type: 'progress', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => send({ type: 'ready', version: info.version }));
  ipcMain.handle('upd:check', async () => {
    if (!app.isPackaged) return null;
    const r = await autoUpdater.checkForUpdates();
    const v = r && r.updateInfo && r.updateInfo.version;
    return v && v !== app.getVersion() ? { version: v } : null;
  });
  ipcMain.handle('upd:download', async () => {
    await autoUpdater.downloadUpdate();
    return true;
  });
  ipcMain.handle('upd:install', () => {
    // isSilent=true (sem perguntas do instalador), isForceRunAfter=true (abre de novo)
    setImmediate(() => autoUpdater.quitAndInstall(true, true));
  });
}
app.on('window-all-closed', () => app.quit());
