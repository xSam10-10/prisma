// Onde o app está rodando.
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
export const IS_WEBOS = import.meta.env.MODE === 'webos' || /web0s|webos|netcast/i.test(ua);
/** Chromium da TV (webOS 3.5 = 38). 0 se não der para saber. */
export const CHROME_VERSION = Number((ua.match(/Chrome\/(\d+)/) || [])[1] || 0);
/** App Android / Google TV (Capacitor). */
export const IS_ANDROID = import.meta.env.MODE === 'android';
/** Aparelho fraco/antigo: sem blur, sem worker, menos efeitos. */
export const LITE = IS_WEBOS || (CHROME_VERSION > 0 && CHROME_VERSION < 70);
