// Ponte com o app Android / Google TV (Capacitor). Nas outras plataformas
// (navegador, Windows, TV LG) nada daqui é carregado: IS_ANDROID é uma
// constante do build e o Vite remove os imports dinâmicos.

import { IS_ANDROID } from './platform';
import type { Reminder } from './games';

/** User-Agent das listas no Android (o mesmo que o proxy tenta primeiro). */
const UA = 'VLC/3.0.20 LibVLC/3.0.20';

/** Baixa texto ou bytes pela rede nativa do Android (sem bloqueio de CORS). */
export async function nativeGet(url: string, timeoutMs: number, binary: boolean): Promise<{ status: number; text?: string; bytes?: Uint8Array }> {
  const { CapacitorHttp } = await import('@capacitor/core');
  const r = await CapacitorHttp.request({
    url,
    method: 'GET',
    headers: { 'User-Agent': UA },
    connectTimeout: Math.min(timeoutMs, 30000),
    readTimeout: timeoutMs,
    responseType: binary ? 'arraybuffer' : 'text',
  });
  if (!binary) return { status: r.status, text: typeof r.data === 'string' ? r.data : JSON.stringify(r.data) };
  // No modo binário o plugin devolve base64.
  const b64 = String(r.data ?? '');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return { status: r.status, bytes: out };
}

/** Botão Voltar do celular / controle da Google TV. */
export async function installNative(onReminderTap: (r: Reminder) => void): Promise<void> {
  if (!IS_ANDROID) return;
  const { App } = await import('@capacitor/app');
  App.addListener('backButton', () => {
    // Passa pelo mesmo caminho da tecla Voltar (nav.ts). Se nada tratar, sai.
    const ev = new KeyboardEvent('keydown', { key: 'GoBack', bubbles: true, cancelable: true });
    window.dispatchEvent(ev);
    if (!ev.defaultPrevented) App.minimizeApp().catch(() => App.exitApp());
  });
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  LocalNotifications.addListener('localNotificationActionPerformed', (a) => {
    const r = a.notification.extra as Reminder | undefined;
    if (r && r.key) onReminderTap(r);
  });
}

function idOf(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h) % 2000000000 || 1;
}

/**
 * Lembretes como notificações do sistema: avisam mesmo com o app fechado.
 * Chamado sempre que a lista de lembretes muda.
 */
export async function syncNativeReminders(list: Reminder[]): Promise<void> {
  if (!IS_ANDROID) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const r = await LocalNotifications.requestPermissions();
      if (r.display !== 'granted') return;
    }
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    const now = Date.now();
    const future = list.filter((r) => r.start - 60000 > now);
    if (!future.length) return;
    await LocalNotifications.schedule({
      notifications: future.map((r) => ({
        id: idOf(r.key),
        title: 'Vai começar',
        body: r.title,
        schedule: { at: new Date(r.start - 60000), allowWhileIdle: true },
        extra: r,
      })),
    });
  } catch {
    /* sem permissão: os avisos continuam só com o app aberto */
  }
}

/** Aviso imediato do sistema (ex.: gol do seu time) — Android. */
export async function notifyNow(title: string, body: string): Promise<void> {
  if (!IS_ANDROID) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') return;
    await LocalNotifications.schedule({ notifications: [{ id: Math.floor(Date.now() % 2000000000), title, body, schedule: { at: new Date(Date.now() + 500) } }] });
  } catch {
    /* sem permissão */
  }
}

/** Resultado do player nativo ao fechar. */
export interface NativePlayResult {
  posMs: number;
  durMs: number;
  ended: boolean;
  error?: string;
}

/**
 * Filmes e séries no player nativo do Android (ExoPlayer, 0.30.0): troca de
 * áudio, legendas e velocidade pelos controles do próprio Android.
 */
export async function nativePlayVod(url: string, title: string, subtitle: string, startSec: number): Promise<NativePlayResult> {
  const { registerPlugin } = await import('@capacitor/core');
  const NativePlayer = registerPlugin<{ play(o: { url: string; title: string; subtitle: string; startMs: number; ua: string }): Promise<NativePlayResult> }>('NativePlayer');
  return NativePlayer.play({ url, title, subtitle, startMs: Math.max(0, Math.round(startSec * 1000)), ua: UA });
}
