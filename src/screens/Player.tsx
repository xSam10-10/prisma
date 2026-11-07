import { useCallback, useEffect, useRef, useState } from 'react';
import { Engine } from '../core/engine';
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
  const [overlay, setOverlay] = useState(false);
  const [digits, setDigits] = useState('');
  const hideTimer = useRef<number>();
  const digitTimer = useRef<number>();
  const epg = useEpg(playlist, channel, 200);
  const now = useClock();

  const sources = channel ? [channel.url, ...(channel.altUrls ?? [])].filter(Boolean) : [];

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
    const url = sources[srcIdx] ?? sources[0];
    if (!url) {
      setStatus('error');
      setErrMsg('Este item não tem endereço de vídeo.');
      return;
    }
    setStatus('loading');
    engine.current?.play(url, channel);
  }, [channel?.id, srcIdx, attempt, mode === 'off']); // eslint-disable-line react-hooks/exhaustive-deps

  const showOverlay = useCallback((focus = false) => {
    setOverlay(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setOverlay(false), 5000);
    if (focus) requestAnimationFrame(() => focusFirst(overlayRef.current));
  }, []);

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
    showOverlay(true);
    const onKey = (e: KeyboardEvent) => {
      const k = e.keyCode;
      const d = dirOf(e);
      let handled = true;
      const interactive = overlay || status === 'error';
      if (isBack(e)) {
        if (overlay && status !== 'error') setOverlay(false);
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
  }, [mode, overlay, status, digits, zap, allLive, onMode, onZap, showOverlay]);

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
      onMouseMove={full ? () => showOverlay() : undefined}
    >
      <video ref={videoRef} playsInline autoPlay onClick={() => (full ? setOverlay((o) => !o) : onMode('full'))} />

      {status === 'loading' && mode !== 'off' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div className="spinner" />
        </div>
      )}

      {status === 'error' && mode !== 'off' && channel && (
        <div
          style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 14, background: 'rgba(11,11,18,0.88)', textAlign: 'center', padding: 24,
          }}
        >
          <span className="badge-live" style={{ background: 'var(--live)' }}>Canal fora do ar</span>
          <span className="title" style={{ fontSize: full ? 32 : 22 }}>{channel.name}</span>
          <span className="muted" style={{ fontSize: 16 }}>{errMsg}</span>
          {full && (
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              {sources.length > 1 && (
                <button className="btn primary" data-nav="" data-nav-default="" onClick={() => setSrcIdx((i) => (i + 1) % sources.length)}>
                  Tentar fonte {((srcIdx + 1) % sources.length) + 1}
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

      {full && channel && status !== 'error' && (
        <div
          ref={overlayRef}
          style={{
            position: 'absolute', inset: 0, pointerEvents: overlay ? 'auto' : 'none', opacity: overlay ? 1 : 0, transition: 'opacity .25s',
            background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.35) 38%, transparent 60%), linear-gradient(to bottom, rgba(0,0,0,0.6), transparent 22%)',
          }}
        >
          <div style={{ position: 'absolute', left: 64, top: 36, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="badge-live">● Ao vivo</span>
            {height ? <span className="chip" style={{ height: 30, display: 'inline-flex', alignItems: 'center' }}>{height >= 2000 ? '4K' : height >= 1000 ? 'Full HD' : height >= 700 ? 'HD' : 'SD'}</span> : null}
            {sources.length > 1 && <span className="muted" style={{ fontSize: 15 }}>Fonte {srcIdx + 1} de {sources.length}</span>}
          </div>
          <div style={{ position: 'absolute', right: 64, top: 36, fontSize: 18, fontWeight: 700 }}>{fmtTime(now)}</div>

          <div style={{ position: 'absolute', left: 64, right: 64, bottom: 36, display: 'flex', alignItems: 'flex-end', gap: 22 }}>
            <ChannelLogo ch={channel} size={84} />
            <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 16, color: '#D6D6E0' }}>
                {channel.number} · {channel.name}
                {cur ? ` · ${fmtTime(cur.start)} – ${fmtTime(cur.end)}` : ''}
              </span>
              <span className="title" style={{ fontSize: 34, lineHeight: 1.1 }}>{cur?.title ?? channel.name}</span>
              {cur ? (
                <div className="progress" style={{ maxWidth: 640 }}><div style={{ width: `${progressOf(cur, now) * 100}%` }} /></div>
              ) : (
                <span className="muted" style={{ fontSize: 16 }}>Ao vivo · este canal não tem guia de programação</span>
              )}
              {next && <span className="muted" style={{ fontSize: 16 }}>A seguir · {fmtTime(next.start)} {next.title}</span>}
              <span className="muted" style={{ fontSize: 14, marginTop: 4 }}>▲▼ trocar de canal · números para ir direto · Voltar sai da tela cheia</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" data-nav="" onClick={() => toggleFav(channel)} aria-pressed={fav}>
                {Icon.star(fav)} {fav ? 'Favorito' : 'Favoritar'}
              </button>
              {sources.length > 1 && (
                <button className="btn" data-nav="" onClick={() => setSrcIdx((i) => (i + 1) % sources.length)}>Trocar fonte</button>
              )}
              <button className="btn primary" data-nav="" data-nav-default="" onClick={() => onMode('preview')}>Lista de canais</button>
            </div>
          </div>
        </div>
      )}

      {full && digits && (
        <div className="title" style={{ position: 'absolute', right: 64, top: 80, fontSize: 64, textShadow: '0 2px 12px #000' }}>{digits}</div>
      )}
    </div>
  );
}
