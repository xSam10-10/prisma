// Motor de reprodução: escolhe hls.js, mpegts.js ou o player nativo
// conforme o tipo do endereço, e avisa quando o canal falha.

import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import { USE_PROXY, proxify } from './net';
import { LITE } from './platform';
import type { Channel } from './types';

/** video.play() só devolve Promise no Chromium 50+ (a TV de 2017 tem o 38). */
function safePlay(v: HTMLVideoElement) {
  try {
    const p = v.play() as Promise<void> | undefined;
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    /* ignora */
  }
}

export type EngineEvent =
  | { type: 'playing' }
  | { type: 'waiting' }
  | { type: 'error'; message: string }
  | { type: 'levels'; height?: number }
  | { type: 'tracks' };

export interface Track {
  id: number;
  label: string;
}
export interface Tracks {
  audio: Track[];
  text: Track[];
  audioId: number;
  /** -1 = legendas desligadas */
  textId: number;
}

const LANG: Record<string, string> = { por: 'Português', pt: 'Português', 'pt-br': 'Português', eng: 'Inglês', en: 'Inglês', spa: 'Espanhol', es: 'Espanhol', fre: 'Francês', fra: 'Francês', fr: 'Francês', ita: 'Italiano', it: 'Italiano', deu: 'Alemão', ger: 'Alemão', de: 'Alemão', jpn: 'Japonês', ja: 'Japonês' };
function trackLabel(name?: string, lang?: string, i = 0): string {
  const l = (lang || '').toLowerCase();
  const nice = LANG[l] || LANG[l.slice(0, 2)];
  if (name && !/^(audio|track|und|subtitles?|sub|faixa)[\s_-]*\d*$/i.test(name)) return nice && !name.toLowerCase().includes(nice.toLowerCase()) ? `${name} (${nice})` : name;
  return nice || (lang ? lang.toUpperCase() : `Faixa ${i + 1}`);
}

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

  /** native = usa o player do próprio aparelho (na LG, o da TV). */
  play(url: string, ch?: Channel, startAt = 0, native = false): void {
    this.stop();
    this.destroyed = false;
    this.armStall();
    const v = this.video;
    const k = kindOf(url);
    const src = withHeaders(url, ch);

    if (!native && k === 'hls' && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: !LITE, // o worker não recebe os polyfills da TV antiga
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
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => this.onEvent({ type: 'tracks' }));
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => this.onEvent({ type: 'tracks' }));
      hls.loadSource(src);
      hls.attachMedia(v);
      safePlay(v);
      return;
    }

    if (!native && k === 'ts' && mpegts.getFeatureList().mseLivePlayback) {
      const p = mpegts.createPlayer(
        { type: 'mpegts', isLive: !ch || ch.kind === 'live', url: new URL(src, location.href).href },
        { enableWorker: !LITE, liveBufferLatencyChasing: true, lazyLoad: false },
      );
      this.ts = p;
      p.on(mpegts.Events.ERROR, () => this.fail('O canal está fora do ar ou não respondeu.'));
      p.attachMediaElement(v);
      p.load();
      try {
        const r = p.play() as Promise<void> | undefined;
        if (r && typeof r.catch === 'function') r.catch(() => {});
      } catch {
        /* ignora */
      }
      return;
    }

    // Nativo: MP4 (filmes) ou HLS no Safari / Android.
    v.src = src;
    if (startAt) {
      // Só dá para pular depois de saber a duração.
      const seek = () => {
        v.removeEventListener('loadedmetadata', seek);
        try {
          v.currentTime = startAt;
        } catch {
          /* ignora */
        }
      };
      v.addEventListener('loadedmetadata', seek);
    }
    safePlay(v);
  }

  /** Trilhas de áudio e legendas disponíveis (hls.js ou player nativo). */
  tracks(): Tracks {
    const h = this.hls;
    if (h) {
      return {
        audio: h.audioTracks.map((t, i) => ({ id: i, label: trackLabel(t.name, t.lang, i) })),
        text: h.subtitleTracks.map((t, i) => ({ id: i, label: trackLabel(t.name, t.lang, i) })),
        audioId: h.audioTrack,
        textId: h.subtitleDisplay ? h.subtitleTrack : -1,
      };
    }
    const v = this.video as HTMLVideoElement & { audioTracks?: ArrayLike<{ label: string; language: string; enabled: boolean }> };
    const audio: Track[] = [];
    let audioId = 0;
    if (v.audioTracks) {
      for (let i = 0; i < v.audioTracks.length; i++) {
        audio.push({ id: i, label: trackLabel(v.audioTracks[i].label, v.audioTracks[i].language, i) });
        if (v.audioTracks[i].enabled) audioId = i;
      }
    }
    const text: Track[] = [];
    let textId = -1;
    for (let i = 0; i < v.textTracks.length; i++) {
      const t = v.textTracks[i];
      if (t.kind !== 'subtitles' && t.kind !== 'captions') continue;
      text.push({ id: i, label: trackLabel(t.label, t.language, i) });
      if (t.mode === 'showing') textId = i;
    }
    return { audio, text, audioId, textId };
  }

  setAudio(id: number): void {
    if (this.hls) {
      this.hls.audioTrack = id;
      return;
    }
    const at = (this.video as HTMLVideoElement & { audioTracks?: ArrayLike<{ enabled: boolean }> }).audioTracks;
    if (at) for (let i = 0; i < at.length; i++) at[i].enabled = i === id;
  }

  setText(id: number): void {
    if (this.hls) {
      this.hls.subtitleDisplay = id >= 0;
      this.hls.subtitleTrack = id;
      return;
    }
    const tt = this.video.textTracks;
    for (let i = 0; i < tt.length; i++) tt[i].mode = i === id ? 'showing' : 'disabled';
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
