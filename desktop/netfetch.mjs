// "fetch" pela rede do Chromium (Electron net.request): respeita o proxy,
// a VPN e os certificados configurados no Windows. Segue redirecionamentos
// e informa o endereço final em response.url (o net.fetch não informa).
import { net } from 'electron';
import { Readable } from 'node:stream';

export function chromiumFetch(url, { headers = {}, signal } = {}) {
  return new Promise((resolve, reject) => {
    let finalUrl = url;
    let done = false;
    const req = net.request({ url, method: 'GET', redirect: 'manual', useSessionCookies: false });
    for (const [k, v] of Object.entries(headers)) req.setHeader(k, v);
    req.on('redirect', (_status, _method, redirectUrl) => {
      finalUrl = redirectUrl;
      req.followRedirect();
    });
    req.on('response', (res) => {
      done = true;
      const h = new Headers();
      for (const [k, v] of Object.entries(res.headers)) h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
      const body = Readable.toWeb(res);
      const status = res.statusCode;
      resolve({
        status,
        ok: status >= 200 && status < 300,
        url: finalUrl,
        headers: h,
        body,
        text: () => new Response(body).text(),
      });
    });
    req.on('error', (e) => {
      if (!done) reject(e);
    });
    if (signal) {
      if (signal.aborted) return reject(new Error('cancelado'));
      signal.addEventListener('abort', () => {
        try {
          req.abort();
        } catch {
          /* ignora */
        }
        if (!done) reject(new Error('cancelado'));
      });
    }
    req.end();
  });
}
