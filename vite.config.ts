import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
// @ts-expect-error módulo JS sem tipos
import { prismaProxyPlugin } from './server/proxy.mjs';

// Modo "webos": app empacotado para TV LG. Caminhos relativos (o app abre
// via file://) e código compatível com o Chromium antigo das TVs
// (webOS 4.x = Chrome 53, webOS 5 = Chrome 68). Só scripts "legacy" (sem
// type=module), porque módulos ES não carregam via file:// na TV.
export default defineConfig(({ mode }) => {
  const webos = mode === 'webos';
  return {
    base: webos ? './' : '/',
    plugins: [
      react(),
      prismaProxyPlugin(),
      ...(webos
        ? [legacy({ targets: ['chrome >= 53'], renderModernChunks: false })]
        : []),
    ],
    build: {
      outDir: webos ? 'dist-webos' : 'dist',
      chunkSizeWarningLimit: 1200,
    },
    server: { host: '127.0.0.1', port: 5173 },
  };
});
