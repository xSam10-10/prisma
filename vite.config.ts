import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
// @ts-expect-error módulo JS sem tipos
import { prismaProxyPlugin } from './server/proxy.mjs';

// Modo "webos": app empacotado para TV LG. Caminhos relativos (o app abre
// via file://) e código compatível com o Chromium antigo das TVs
// (webOS 3.5 = Chrome 38 — a OLED B7 de 2017 —, webOS 4 = 53, webOS 5 = 68). Só scripts "legacy" (sem
// type=module), porque módulos ES não carregam via file:// na TV.
/** Commit do código (na publicação vem do GitHub Actions). */
function commit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

export default defineConfig(({ mode }) => {
  const webos = mode === 'webos';
  return {
    base: webos ? './' : '/',
    define: {
      __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync('package.json', 'utf8')).version),
      __APP_COMMIT__: JSON.stringify(commit()),
    },
    plugins: [
      react(),
      prismaProxyPlugin(),
      ...(webos
        ? [legacy({ targets: ['chrome >= 38'], renderModernChunks: false })]
        : []),
    ],
    build: {
      outDir: webos ? 'dist-webos' : mode === 'android' ? 'dist-android' : 'dist',
      chunkSizeWarningLimit: 1200,
      // TV: a atualização dentro do app troca só o código principal (prisma-webos-<v>.json), então
      // tudo precisa caber nele: sem partes separadas e com as fontes embutidas (0.35.0).
      ...(webos
        ? {
            cssTarget: 'chrome38',
            assetsInlineLimit: (file: string) => (/\.woff2$/.test(file) ? true : undefined),
            rollupOptions: { output: { inlineDynamicImports: true } },
          }
        : {}),
    },
    server: { host: '127.0.0.1', port: 5173 },
  };
});
