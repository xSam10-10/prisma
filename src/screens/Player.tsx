import { T } from '../ui/tokens';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Engine } from '../core/engine';
import { IS_WEBOS } from '../core/platform';
import { useSettings } from '../core/settings';
import { useLayout } from '../ui/layout';
import { progressOf } from '../core/epg';
import type { Channel, Playlist } from '../core/types';
import { ChannelLogo, Icon, fmtTime } from '../ui/bits';
import { KEY, dirOf, focusFirst, isBack, isEnter } from '../ui/nav';
import { useClock, useEpg } from '../ui/useEpg';

export type PlayerMode = 'off' | 'preview' | 'full';
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
  radius?: number;
}

interface Props {
  playlist?: Playlist;
  channel?: Channel;
  zapList: Channel[];
  allLive: Channel[];
  mode: PlayerMode;
  rect?: Rect;
  isFav: (c: Channel) => boolean;
  toggleFav: (c: Channel) => void;
  onMode: (m: PlayerMode) => void;
  onZap: (c: Channel) => void;
}

type Status = 'loading' | 'playing' | 'error';

export function Player({ playlist, channel, zapList, allLive, mode, rect, isFav, toggleFav, onMode, onZap }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const engine = useRef<Engine>();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [errMsg, setErrMsg] = useState('');
  // Fonte escolhida vale só para o canal atual; trocar de canal volta à fonte 1.
  const [src, setSrc] = useState<{ ch?: string; idx: number }>({ idx: 0 });
  const srcIdx = src.ch === channel?.id ? src.idx : 0;
  const setSrcIdx = (f: (i: number) => number) => setSrc({ ch: channel?.id, idx: f(srcIdx) });
  const autoRef = useRef({ ch: '', tried: 0 });
  const [attempt, setAttempt] = useState(0);
  const [height, setHeight] = useState<number>();
  // Camada por cima do vídeo: 'info' (ao trocar de canal) ou 'controls' (botões).
  const [overlayKind, setOverlayKind] = useState<false | 'info' | 'controls'>(false);
  const overlay = overlayKind !== false;
  const setOverlay = (v: boolean) => setOverlayKind(v ? 'controls' : false);
  const { settings: S } = useSettings();
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const padX = L.px;
  const padT = (mobile ? 14 : 36) + L.safeY;
  const padB = (mobile ? 16 : 36) + L.safeY;
  const [digits, setDigits] = useState('');
  const hideTimer = useRef<number>();
  const digitTimer = useRef<number>();
  const epg = useEpg(playlist, channel, 200);
  const now = useClock();

  // Tentativas em ordem: cada fonte com o motor JS (hls.js / mpegts.js) e,
  // na TV LG, também com o player nativo da TV.
  const urls0 = channel ? [channel.url, ...(channel.altUrls ?? [])].filter(Boolean) : [];
  // Formato preferido (Ajustes › Player): coloca HLS ou MPEG-TS primeiro.
  const prefExt = S.liveFormat === 'hls' ? /\.m3u8(\?|$)/i : S.liveFormat === 'ts' ? /\.ts(\?|$)/i : null;
  const urls = prefExt ? [...urls0.filter((u) => prefExt.test(u)), ...urls0.filter((u) => !prefExt.test(u))] : urls0;
  const sources = urls.reduce<{ u: string; n: number; native: boolean }[]>((acc, u, n) => {
    acc.push({ u, n, native: false });
    if (IS_WEBOS) acc.push({ u, n, native: true });
    return acc;
  }, []);
  const cur0 = sources[srcIdx] ?? sources[0];

  useEffect(() => {
    const v = videoRef.current!;
    engine.current = new Engine(v, (e) => {
      if (e.type === 'playing') setStatus('playing');
      else if (e.type === 'waiting') setStatus((s) => (s === 'error' ? s : 'loading'));
      else if (e.type === 'levels') setHeight(e.height);
      else if (e.type === 'error') onErrorRef.current(e.message);
    });
    return () => engine.current?.destroy();
  }, []);

  // Falhou: tenta sozinho as outras fontes do canal (uma vez cada) antes de avisar.
  const onErrorRef = useRef<(m: string) => void>(() => {});
  onErrorRef.current = (message: string) => {
    const id = channel?.id ?? '';
    if (autoRef.current.ch !== id) autoRef.current = { ch: id, tried: 0 };
    if (autoRef.current.tried < sources.length - 1) {
      autoRef.current.tried++;
      setSrc({ ch: id, idx: (srcIdx + 1) % sources.length });
      return;
    }
    setStatus('error');
    setErrMsg(message);
  };

  useEffect(() => setHeight(undefined), [channel?.id]);

  useEffect(() => {
    if (!channel || mode === 'off') {
      engine.current?.stop();
      return;
    }
    const t = sources[srcIdx] ?? sources[0];
    if (!t) {
      setStatus('error');
      setErrMsg('Este item não tem endereço de vídeo.');
      return;
    }
    setStatus('loading');
    engine.current?.play(t.u, channel, 0, t.native);
  }, [channel?.id, srcIdx, attempt, mode === 'off']); // eslint-disable-line react-hooks/exhaustive-deps

  const osdMs = Math.max(2, S.osdSeconds || 5) * 1000;
  /** focus=true: mostra os botões (o usuário interagiu). false: só as informações, conforme Ajustes. */
  const showOverlay = useCallback(
    (focus = false) => {
      clearTimeout(hideTimer.current);
      if (!focus && S.osd === 'none') {
        setOverlayKind((k) => (k === 'controls' ? k : false));
        return;
      }
      setOverlayKind((k) => (focus || k === 'controls' ? 'controls' : 'info'));
      hideTimer.current = window.setTimeout(() => setOverlayKind(false), osdMs);
      if (focus) requestAnimationFrame(() => focusFirst(overlayRef.current));
    },
    [S.osd, osdMs],
  );

  const zap = useCallback(
    (delta: number) => {
      if (!channel || !zapList.length) return;
      const i = zapList.findIndex((c) => c.id === channel.id);
      const next = zapList[(i + delta + zapList.length) % zapList.length];
      onZap(next);
      showOverlay();
    },
    [channel, zapList, onZap, showOverlay],
  );

  // Teclas no modo tela cheia
  useEffect(() => {
    if (mode !== 'full') return;
    showOverlay(false);
    const onKey = (e: KeyboardEvent) => {
      const k = e.keyCode;
      const d = dirOf(e);
      let handled = true;
      const interactive = overlayKind === 'controls' || status === 'error';
      if (isBack(e)) {
        if (overlayKind === 'controls' && status !== 'error') setOverlay(false);
        else onMode('preview');
      } else if (k === KEY.CH_UP || d === 'up') zap(-1);
      else if (k === KEY.CH_DOWN || d === 'down') zap(1);
      else if (k >= 48 && k <= 57) {
        const nd = (digits + String(k - 48)).slice(-4);
        setDigits(nd);
        clearTimeout(digitTimer.current);
        digitTimer.current = window.setTimeout(() => {
          const n = parseInt(nd, 10);
          const target = allLive.find((c) => c.number === n);
          if (target) {
            onZap(target);
            showOverlay();
          }
          setDigits('');
        }, 1500);
      } else if (!interactive && (d || isEnter(e))) showOverlay(true);
      else if (interactive) {
        showOverlay(); // reinicia o tempo; deixa a navegação dos botões agir
        handled = false;
      } else handled = false;
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [mode, overlay, overlayKind, status, digits, zap, allLive, onMode, onZap, showOverlay]);

  useEffect(() => {
    if (mode === 'full' && overlay) requestAnimationFrame(() => {
      if (!overlayRef.current?.contains(document.activeElement)) focusFirst(overlayRef.current);
    });
  }, [mode, overlay]);

  const cur = epg?.[0];
  const next = epg?.[1];
  const full = mode === 'full';
  const style = full || !rect ? undefined : { left: rect.left, top: rect.top, width: rect.width, height: rect.height, borderRadius: rect.radius ?? 28 };
  const fav = channel ? isFav(channel) : false;

  return (
    <div
      className={'player' + (full ? ' full' : '') + (mode === 'off' ? ' hidden' : '')}
      style={style}
      data-nav-scope={full ? '' : undefined}
      onMouseMove={full ? () => showOverlay(true) : undefined}
    >
      <video
        ref={videoRef}
        playsInline
        autoPlay
        style={{ objectFit: S.videoFit }}
        onClick={() => (full ? (overlayKind === 'controls' ? setOverlay(false) : showOverlay(true)) : onMode('full'))}
      />

      {status === 'loading' && mode !== 'off' && (
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div className="spinner" />
        </div>
      )}

      {status === 'error' && mode !== 'off' && channel && (
        <div className="gy-14"
          style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(11,11,18,0.88)', textAlign: 'center', padding: 24,
          }}
        >
          <span className="badge-live" style={{ background: T.live }}>Canal fora do ar</span>
          <span className="title" style={{ fontSize: full ? 32 : 22 }}>{channel.name}</span>
          <span className="muted" style={{ fontSize: 16 }}>{errMsg}</span>
          {full && (
            <div className="gx-12" style={{ display: 'flex', marginTop: 22, flexWrap: mobile ? 'wrap' : undefined, justifyContent: 'center' }}>
              {sources.length > 1 && (
                <button className="btn primary" data-nav="" data-nav-default="" onClick={() => setSrcIdx((i) => (i + 1) % sources.length)}>
                  Tentar outra fonte
                </button>
              )}
              <button className="btn" data-nav="" onClick={() => {
                autoRef.current = { ch: '', tried: 0 };
                setAttempt((a) => a + 1);
              }}>Tentar de novo</button>
              <button className="btn" data-nav="" onClick={() => zap(1)}>Próximo canal</button>
            </div>
          )}
          {!full && <span className="muted" style={{ fontSize: 15 }}>Aperte OK para ver opções</span>}
        </div>
      )}

      {full && channel && status !== 'error' && overlayKind === 'info' && S.osd === 'name' && (
        <div className="gx-10" style={{ position: 'absolute', left: padX, top: padT, display: 'flex', alignItems: 'center', padding: '8px 14px 8px 8px', borderRadius: 16, background: 'rgba(0,0,0,0.55)' }}>
          <ChannelLogo ch={channel} size={mobile ? 32 : 40} />
          <span style={{ fontSize: mobile ? 15 : 18, fontWeight: 700 }}>{channel.number} · {channel.name}</span>
        </div>
      )}

      {full && channel && status !== 'error' && (overlayKind === 'controls' || (overlayKind === 'info' && S.osd === 'full')) && (
        <div
          ref={overlayRef}
          style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'auto',
            background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.35) 38%, transparent 60%), linear-gradient(to bottom, rgba(0,0,0,0.6), transparent 22%)',
          }}
        >
          <div className="gx-10" style={{ position: 'absolute', left: padX, top: padT, display: 'flex', alignItems: 'center' }}>
            <span className="badge-live">● Ao vivo</span>
            {height ? <span className="chip" style={{ height: 30, display: 'inline-flex', alignItems: 'center' }}>{height >= 2000 ? '4K' : height >= 1000 ? 'Full HD' : height >= 700 ? 'HD' : 'SD'}</span> : null}
            {cur0 && (urls.length > 1 || cur0.native) && (
              <span className="muted" style={{ fontSize: 15 }}>
                Fonte {cur0.n + 1} de {urls.length}
                {cur0.native ? ' · player da TV' : ''}
              </span>
            )}
          </div>
          <div style={{ position: 'absolute', right: padX, top: padT, fontSize: 18, fontWeight: 700 }}>{fmtTime(now)}</div>

          <div
            className={mobile ? 'gy-12' : 'gx-22'}
            style={{ position: 'absolute', left: padX, right: padX, bottom: padB, display: 'flex', flexDirection: mobile ? 'column' : 'row', alignItems: mobile ? 'stretch' : 'flex-end' }}
          >
            <div className="gx-14" style={{ display: 'flex', alignItems: 'flex-end', flexGrow: 1, minWidth: 0 }}>
            <ChannelLogo ch={channel} size={mobile ? 48 : 84} />
            <div className="gy-6" style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 16, color: '#D6D6E0' }}>
                {channel.number} · {channel.name}
                {cur ? ` · ${fmtTime(cur.start)} – ${fmtTime(cur.end)}` : ''}
              </span>
              <span className="title" style={{ fontSize: mobile ? 22 : 34, lineHeight: 1.1 }}>{cur?.title ?? channel.name}</span>
              {cur ? (
                <div className="progress" style={{ maxWidth: 640 }}><div style={{ width: `${progressOf(cur, now) * 100}%` }} /></div>
              ) : (
                <span className="muted" style={{ fontSize: 16 }}>Ao vivo · este canal não tem guia de programação</span>
              )}
              {next && <span className="muted" style={{ fontSize: 16 }}>A seguir · {fmtTime(next.start)} {next.title}</span>}
              {!mobile && <span className="muted" style={{ fontSize: 14, marginTop: 10 }}>▲▼ trocar de canal · números para ir direto · Voltar sai da tela cheia</span>}
            </div>
            </div>
            <div className="gx-10" style={{ display: 'flex', flexShrink: 0, justifyContent: mobile ? 'flex-end' : undefined }}>
              {mobile && (
                <>
                  <button className="btn icon" data-nav="" aria-label="Canal anterior" style={{ width: 46, padding: 0, justifyContent: 'center' }} onClick={() => zap(-1)}>▲</button>
                  <button className="btn icon" data-nav="" aria-label="Próximo canal" style={{ width: 46, padding: 0, justifyContent: 'center' }} onClick={() => zap(1)}>▼</button>
                </>
              )}
              <button className="btn" data-nav="" onClick={() => toggleFav(channel)} aria-pressed={fav}>
                {Icon.star(fav)} {mobile ? null : fav ? 'Favorito' : 'Favoritar'}
              </button>
              {sources.length > 1 && (
                <button className="btn" data-nav="" onClick={() => setSrcIdx((i) => (i + 1) % sources.length)}>{mobile ? 'Fonte' : 'Trocar fonte'}</button>
              )}
              <button className="btn primary" data-nav="" data-nav-default="" onClick={() => onMode('preview')}>{mobile ? 'Canais' : 'Lista de canais'}</button>
            </div>
          </div>
        </div>
      )}

      {full && digits && (
        <div className="title" style={{ position: 'absolute', right: padX, top: padT + 44, fontSize: 64, textShadow: '0 2px 12px #000' }}>{digits}</div>
      )}
    </div>
  );
}
