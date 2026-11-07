// Motor de reprodução: escolhe hls.js, mpegts.js ou o player nativo
// conforme o tipo do endereço, e avisa quando o canal falha.

import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import { USE_PROXY, proxify } from './net';
import type { Channel } from './types';

export type EngineEvent =
  | { type: 'playing' }
  | { type: 'waiting' }
  | { type: 'error'; message: string }
  | { type: 'levels'; height?: number };

type Kind = 'hls' | 'ts' | 'native';

function kindOf(url: string): Kind {
  const path = url.split('?')[0].toLowerCase();
  if (path.endsWith('.ts') || path.endsWith('.mpegts')) return 'ts';
  if (/\.(mp4|m4v|webm|mov|mkv|avi)$/.test(path)) return 'native';
  return 'hls'; // .m3u8 ou sem extensão (o mais comum em IPTV ao vivo)
}

function withHeaders(url: string, ch?: Channel): string {
  const p = proxify(url);
  if (!USE_PROXY || !ch?.headers || p === url) return p;
  const extra = new URLSearchParams();
  if (ch.headers.userAgent) extra.set('ua', ch.headers.userAgent);
  if (ch.headers.referrer) extra.set('ref', ch.headers.referrer);
  const s = extra.toString();
  return s ? `${p}&${s}` : p;
}

export class Engine {
  private hls?: Hls;
  private ts?: mpegts.Player;
  private stallTimer?: number;
  private destroyed = false;

  constructor(
    private video: HTMLVideoElement,
    private onEvent: (e: EngineEvent) => void,
  ) {
    video.addEventListener('playing', this.onPlaying);
    video.addEventListener('waiting', this.onWaiting);
    video.addEventListener('error', this.onVideoError);
  }

  private onPlaying = () => {
    clearTimeout(this.stallTimer);
    this.onEvent({ type: 'playing' });
  };
  private onWaiting = () => {
    this.onEvent({ type: 'waiting' });
    this.armStall();
  };
  private onVideoError = () => {
    if (this.hls || this.ts) return; // os motores avisam por conta própria
    this.fail('O vídeo não pôde ser aberto neste aparelho.');
  };

  private armStall() {
    clearTimeout(this.stallTimer);
    // Sem imagem por 20 s = canal fora do ar.
    this.stallTimer = window.setTimeout(() => this.fail('O canal não respondeu.'), 20000);
  }

  private fail(message: string) {
    if (this.destroyed) return;
    clearTimeout(this.stallTimer);
    this.stop();
    this.onEvent({ type: 'error', message });
  }

  play(url: string, ch?: Channel, startAt = 0): void {
    this.stop();
    this.destroyed = false;
    this.armStall();
    const v = this.video;
    const k = kindOf(url);
    const src = withHeaders(url, ch);

    if (k === 'hls' && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        manifestLoadingMaxRetry: 2,
        levelLoadingMaxRetry: 3,
        fragLoadingMaxRetry: 4,
        startPosition: startAt || -1,
        xhrSetup: (xhr, u) => {
          // Pedaços e sub-playlists também passam pelo proxy.
          if (USE_PROXY && !u.includes('/proxy?url=')) xhr.open('GET', withHeaders(u, ch), true);
        },
      });
      this.hls = hls;
      let recovered = false;
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) {
          recovered = true;
          hls.recoverMediaError();
          return;
        }
        this.fail(data.type === Hls.ErrorTypes.NETWORK_ERROR ? 'O canal está fora do ar ou não respondeu.' : 'Formato de vídeo não suportado.');
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, d) => {
        this.onEvent({ type: 'levels', height: hls.levels[d.level]?.height });
      });
      hls.loadSource(src);
      hls.attachMedia(v);
      v.play().catch(() => {});
      return;
    }

    if (k === 'ts' && mpegts.getFeatureList().mseLivePlayback) {
      const p = mpegts.createPlayer(
        { type: 'mpegts', isLive: true, url: new URL(src, location.href).href },
        { enableWorker: true, liveBufferLatencyChasing: true, lazyLoad: false },
      );
      this.ts = p;
      p.on(mpegts.Events.ERROR, () => this.fail('O canal está fora do ar ou não respondeu.'));
      p.attachMediaElement(v);
      p.load();
      Promise.resolve(p.play()).catch(() => {});
      return;
    }

    // Nativo: MP4 (filmes) ou HLS no Safari / Android.
    v.src = src;
    if (startAt) v.currentTime = startAt;
    v.play().catch(() => {});
  }

  stop(): void {
    clearTimeout(this.stallTimer);
    if (this.hls) {
      this.hls.destroy();
      this.hls = undefined;
    }
    if (this.ts) {
      try {
        this.ts.pause();
        this.ts.unload();
        this.ts.detachMediaElement();
        this.ts.destroy();
      } catch {
        /* ignora */
      }
      this.ts = undefined;
    }
    const v = this.video;
    if (v.getAttribute('src')) {
      v.removeAttribute('src');
      v.load();
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.stop();
    this.video.removeEventListener('playing', this.onPlaying);
    this.video.removeEventListener('waiting', this.onWaiting);
    this.video.removeEventListener('error', this.onVideoError);
  }
}
