// PRISMA para Windows (Electron).
// O programa sobe internamente o mesmo servidor do modo computador
// (app + proxy das listas) e abre uma janela própria apontando para ele.
// Porta fixa (47815) para que favoritos e a lista salva não se percam.

import { app, BrowserWindow, Menu, shell } from 'electron';
import { fileURLToPath } from 'node:url';
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

async function createWindow() {
  const root = fileURLToPath(new URL('../dist/', import.meta.url));
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
    webPreferences: { contextIsolation: true, sandbox: true },
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
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
