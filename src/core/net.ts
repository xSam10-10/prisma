import { SourceError } from './types';

/**
 * No navegador do computador, as listas IPTV quase nunca liberam CORS.
 * Por isso, no modo web, tudo passa pelo proxy local (server/serve.mjs ou
 * o servidor de desenvolvimento do Vite). Na TV LG (app empacotado) e no
 * Android (Capacitor) o acesso é direto.
 */
export const USE_PROXY: boolean = import.meta.env.MODE !== 'webos' && import.meta.env.VITE_DIRECT !== '1';

export function proxify(url: string): string {
  if (!USE_PROXY) return url;
  if (url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (url.includes('/proxy?url=')) return url;
  if (typeof location !== 'undefined' && url.startsWith(location.origin + '/')) return url; // arquivo do próprio app
  return '/proxy?url=' + encodeURIComponent(url);
}

/**
 * Baixa texto. Usa XMLHttpRequest (e não fetch) porque funciona também com
 * file:// (app empacotado na TV) e no Chromium antigo da LG, sem AbortController.
 */
export function fetchText(url: string, timeoutMs = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', proxify(url), true);
    xhr.timeout = timeoutMs;
    xhr.ontimeout = () => reject(new SourceError('network', 'O servidor da lista demorou demais para responder.'));
    xhr.onerror = () => reject(new SourceError('network', 'Não foi possível conectar ao servidor da lista.'));
    xhr.onload = () => {
      const st = xhr.status;
      const isFile = /^file:/i.test(xhr.responseURL || url);
      if (isFile && st === 0) return resolve(xhr.responseText);
      if (st === 401 || st === 403) return reject(new SourceError('auth', 'Usuário ou senha incorretos, ou lista vencida.'));
      if (st === 502 && xhr.getResponseHeader('x-prisma-proxy') === 'error')
        return reject(new SourceError('network', 'Não foi possível conectar ao servidor da lista.'));
      if (st < 200 || st >= 300) return reject(new SourceError('network', `O servidor respondeu com erro ${st}.`));
      resolve(xhr.responseText);
    };
    xhr.send();
  });
}

export async function fetchJson<T>(url: string, timeoutMs?: number): Promise<T> {
  const text = await fetchText(url, timeoutMs);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SourceError('format', 'O servidor não respondeu no formato esperado (Xtream).');
  }
}
