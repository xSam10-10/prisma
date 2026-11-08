import { SourceError } from './types';
import { IS_ANDROID } from './platform';
import { nativeGet } from './native';

/**
 * No navegador do computador, as listas IPTV quase nunca liberam CORS.
 * Por isso, no modo web, tudo passa pelo proxy local (server/serve.mjs ou
 * o servidor de desenvolvimento do Vite). Na TV LG (app empacotado) e no
 * Android (Capacitor) o acesso é direto.
 */
export const USE_PROXY: boolean = import.meta.env.MODE !== 'webos' && import.meta.env.MODE !== 'android' && import.meta.env.VITE_DIRECT !== '1';

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
  if (IS_ANDROID) {
    return nativeGet(url, timeoutMs, false).then(
      (r) => {
        if (r.status === 401 || r.status === 403) throw new SourceError('auth', 'O servidor recusou o acesso. Confira usuário e senha.');
        if (r.status < 200 || r.status >= 300) throw new SourceError('network', `O servidor respondeu com erro ${r.status}.`);
        return r.text ?? '';
      },
      (e) => {
        if (e instanceof SourceError) throw e;
        throw new SourceError('network', 'Não foi possível conectar ao servidor da lista.');
      },
    );
  }
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
      let detail = '';
      try {
        detail = decodeURIComponent(xhr.getResponseHeader('x-prisma-detail') || '');
      } catch {
        /* ignora */
      }
      const why = detail ? ` (${detail})` : '';
      if (st === 401 || st === 403) return reject(new SourceError('auth', `O servidor recusou o acesso${why}. Confira usuário e senha; se estiver numa rede de empresa, ela pode estar bloqueando.`));
      if (st === 502 && xhr.getResponseHeader('x-prisma-proxy') === 'error')
        return reject(new SourceError('network', `Não foi possível conectar ao servidor da lista${why}.`));
      if (st >= 500)
        return reject(
          new SourceError('network', `O servidor da lista respondeu com erro ${st}${why}. Pode ser instabilidade do servidor ou bloqueio da rede (por exemplo, rede de empresa).`),
        );
      if (st < 200 || st >= 300) return reject(new SourceError('network', `O servidor respondeu com erro ${st}${why}.`));
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

/** Baixa dados binários (ex.: guia .xml.gz). Mesmo caminho do fetchText (proxy no computador). */
export function fetchBytes(url: string, timeoutMs = 180000): Promise<Uint8Array> {
  if (IS_ANDROID) {
    return nativeGet(url, timeoutMs, true).then((r) => {
      if (r.status < 200 || r.status >= 300) throw new SourceError('network', `O guia respondeu com erro ${r.status}.`);
      return r.bytes ?? new Uint8Array();
    });
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', proxify(url), true);
    xhr.responseType = 'arraybuffer';
    xhr.timeout = timeoutMs;
    xhr.ontimeout = () => reject(new SourceError('network', 'O guia demorou demais para baixar.'));
    xhr.onerror = () => reject(new SourceError('network', 'Não foi possível baixar o guia.'));
    xhr.onload = () => {
      const ok = (xhr.status >= 200 && xhr.status < 300) || (xhr.status === 0 && /^file:/i.test(url));
      if (!ok) return reject(new SourceError('network', `O guia respondeu com erro ${xhr.status}.`));
      resolve(new Uint8Array(xhr.response as ArrayBuffer));
    };
    xhr.send();
  });
}
