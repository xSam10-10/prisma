// Ponte segura entre a tela do PRISMA e o programa (só atualização).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('prismaDesktop', {
  checkUpdate: () => ipcRenderer.invoke('upd:check'),
  downloadUpdate: () => ipcRenderer.invoke('upd:download'),
  installUpdate: () => ipcRenderer.invoke('upd:install'),
  onUpdate: (cb) => {
    const h = (_e, data) => cb(data);
    ipcRenderer.on('upd:event', h);
    return () => ipcRenderer.removeListener('upd:event', h);
  },
});
