import { T } from '../ui/tokens';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Engine } from '../core/engine';
import { IS_ANDROID, IS_WEBOS } from '../core/platform';
import { useSettings } from '../core/settings';
import { SectionPicker } from './Sections';
import { fmtDuration, myList, saveProgress, vodRecents } from '../core/vod';
import type { Tracks } from '../core/engine';
import { Modal } from '../ui/Dialog';
import { useLayout } from '../ui/layout';
import { progressOf } from '../core/epg';
import type { Channel, EpgEntry, Playlist } from '../core/types';
import { useTmdb } from '../ui/useTmdb';
import { TitleLogo } from '../ui/premium';
import { celebrate, pop, toast } from '../ui/premium2';
import { CinemaIntro, EndCredits, Screensaver, SeekThumb } from '../ui/premium3';
import { scenesOf } from '../core/tmdb';
import { collectionsIn, topsNow } from '../core/tops';
import { ChannelLogo, Icon, fmtTime } from '../ui/bits';
import { KEY, dirOf, focusFirst, isBack, isEnter } from '../ui/nav';
import { useClock, useEpg } from '../ui/useEpg';
import { BarIcon, BarMenu, BarTop, ClassicBar, MenuItem, MenuToggle, PinDialog, PipWindow, pipSlotStyle, type BarAction } from './ChannelBar';
import { FullList } from './FullList';
import { Guide } from './Guide';
import { NowOnTV } from './NowOnTV';
import { checkPin, hasPin, isLockMarked, isLocked, setLocked, setPin, unlockForSession } from '../core/parental';

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
  /** Canal assistido antes do atual (botão/tecla "Último canal"). */
  lastChannel?: Channel;
  /** Filme/episódio: começar deste segundo (continuar de onde parou). */
  startAt?: number;
  /** Próximo episódio (série): toca sozinho ao terminar. */
  nextEp?: Channel;
  onNext?: () => void;
  /** Telas auxiliares (PIP), até 3. */
  pips?: Channel[];
  onPips?: (p: Channel[]) => void;
  /** Troca a tela principal com a janela i. */
  onSwapPip?: (i: number) => void;
  /** Canal escolhido na lista da tela cheia (com a lista do grupo para o ▲▼). */
  onPickList?: (c: Channel, list: Channel[]) => void;
  /** Gravação/filme escolhido na programação. */
  onPlayVod?: (item: Channel) => void;
}

type Status = 'loading' | 'playing' | 'error' | 'locked';
// PIP: uma tela pequena a mais (o plano do usuário permite 2 telas ao mesmo tempo).
const MAX_PIPS = 1;
const FIT_LABEL: Record<string, string> = { contain: 'Normal', fill: 'Esticar', cover: 'Zoom' };
const FIT_NEXT: Record<string, 'contain' | 'fill' | 'cover'> = { contain: 'fill', fill: 'cover', cover: 'contain' };

export function Player({ playlist, channel, zapList, allLive, mode, rect, isFav, toggleFav, onMode, onZap, lastChannel, startAt, nextEp, onNext, pips = [], onPips, onSwapPip, onPickList, onPlayVod }: Props) {
  const vod = !!channel && channel.kind !== 'live';
  // Reconexão automática
  const okRef = useRef('');
  const channelIdRef = useRef('');
  const reconnRef = useRef(0);
  const reconnTimer = useRef<number>();
  const stableTimer = useRef<number>();
  const [reconnecting, setReconnecting] = useState(0);
  // Áudio e legendas
  const [tracks, setTracks] = useState<Tracks | null>(null);
  const [trackDlg, setTrackDlg] = useState(false);
  const hasTracks = !!tracks && (tracks.audio.length > 1 || tracks.text.length > 0);
  // Próximo episódio
  const [nextIn, setNextIn] = useState<number | null>(null);
  const [time, setTime] = useState({ cur: 0, dur: 0, paused: false });
  const lastSave = useRef(0);
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
  const { settings: S, update: updateSettings } = useSettings();
  // Barra clássica: menu aberto acima de um ícone, painel de informações, senha, velocidade.
  const [menu, setMenu] = useState<string | null>(null);
  const menuRef = useRef<string | null>(null);
  menuRef.current = menu;
  const [infoOpen, setInfoOpen] = useState(false);
  const [pinDlg, setPinDlg] = useState<null | 'unlock' | 'lock' | 'unlockMark'>(null);
  const [speed, setSpeed] = useState<number>();
  const [lockTick, setLockTick] = useState(0);
  // Lista de canais por cima do vídeo (OK na tela cheia).
  const [listOpen, setListOpen] = useState(false);
  const listOpenRef = useRef(false);
  // Barra clássica: OK abre a lista de canais, a não ser que a pessoa tenha
  // acabado de escolher uma função com ◀▶ (como no app de referência).
  const barNavRef = useRef(false);
  listOpenRef.current = listOpen;
  const [guideOpen, setGuideOpen] = useState<null | { channels: Channel[]; index: number }>(null);
  const [nowOpen, setNowOpen] = useState<null | { channels: Channel[]; title: string }>(null);
  const guideOpenRef = useRef(false);
  guideOpenRef.current = !!guideOpen || !!nowOpen;
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const padX = L.px;
  const padT = (mobile ? 14 : 36) + L.safeY;
  const padB = (mobile ? 16 : 36) + L.safeY;
  const [digits, setDigits] = useState('');
  const [picker, setPicker] = useState(false);
  const hideTimer = useRef<number>();
  const lastMouse = useRef<{ x: number; y: number } | null>(null);
  const digitTimer = useRef<number>();
  const epg = useEpg(playlist, channel, 200);
  const now = useClock();
  const full = mode === 'full';
  const isLiteTv = typeof document !== 'undefined' && document.documentElement.classList.contains('lite');
  // ---- Premium (filme/série): cenas na barra de tempo, modo cinema, créditos finais e protetor de tela ----
  const vodBase = vod && channel ? (channel.seriesId ? { ...channel, name: channel.group, kind: 'series' as const, fullName: undefined } : channel) : null;
  const tmP = useTmdb(vodBase);
  const [scenes, setScenes] = useState<string[]>([]);
  useEffect(() => {
    setScenes([]);
    if (!tmP) return;
    let alive = true;
    scenesOf(tmP).then((x) => alive && setScenes(x));
    return () => {
      alive = false;
    };
  }, [tmP?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [intro, setIntro] = useState(false);
  useEffect(() => {
    if (!(full && vod && channel) || isLiteTv) return;
    setIntro(true);
    const t = setTimeout(() => setIntro(false), 1700);
    return () => clearTimeout(t);
  }, [channel?.id, full]); // eslint-disable-line react-hooks/exhaustive-deps
  const [creditsOff, setCreditsOff] = useState(false);
  useEffect(() => setCreditsOff(false), [channel?.id]);
  const [saver, setSaver] = useState(false);
  const saverRef = useRef(false);
  saverRef.current = saver;
  const creditsRef = useRef(false);
  // Pausado por 5 min em tela cheia: protetor de tela.
  useEffect(() => {
    setSaver(false);
    if (!(full && vod && time.paused)) return;
    const t = setTimeout(() => setSaver(true), 5 * 60 * 1000);
    return () => clearTimeout(t);
  }, [full, vod, time.paused]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tentativas em ordem: cada fonte com o motor JS (hls.js / mpegts.js) e,
  // na TV LG, também com o player nativo da TV.
  const urls0 = channel ? [channel.url, ...(channel.altUrls ?? [])].filter(Boolean) : [];
  // Formato preferido (Ajustes › Player): coloca HLS ou MPEG-TS primeiro.
  const prefExt = S.liveFormat === 'hls' || (IS_ANDROID && S.liveFormat === 'auto') ? /\.m3u8(\?|$)/i : S.liveFormat === 'ts' ? /\.ts(\?|$)/i : null;
  const urls = prefExt ? [...urls0.filter((u) => prefExt.test(u)), ...urls0.filter((u) => !prefExt.test(u))] : urls0;
  const sources = urls.reduce<{ u: string; n: number; native: boolean }[]>((acc, u, n) => {
    // Android: HLS e filmes primeiro no player do aparelho (não esbarra em CORS).
    if (IS_ANDROID && !/\.ts(\?|$)/i.test(u)) acc.push({ u, n, native: true });
    acc.push({ u, n, native: false });
    if (IS_WEBOS) acc.push({ u, n, native: true });
    return acc;
  }, []);
  const cur0 = sources[srcIdx] ?? sources[0];

  useEffect(() => {
    const v = videoRef.current!;
    engine.current = new Engine(v, (e) => {
      if (e.type === 'playing') {
        setStatus('playing');
        setReconnecting(0);
        // 15 s tocando sem cair: zera as tentativas (cada nova queda ganha 3 tentativas de novo).
        clearTimeout(stableTimer.current);
        stableTimer.current = window.setTimeout(() => (reconnRef.current = 0), 15000);
        okRef.current = channelIdRef.current;
        setTracks(engine.current?.tracks() ?? null);
      } else if (e.type === 'waiting') setStatus((s) => (s === 'error' ? s : 'loading'));
      else if (e.type === 'levels') setHeight(e.height);
      else if (e.type === 'tracks') setTracks(engine.current?.tracks() ?? null);
      else if (e.type === 'error') onErrorRef.current(e.message);
    });
    return () => engine.current?.destroy();
  }, []);

  // Falhou: tenta sozinho as outras fontes do canal (uma vez cada) antes de avisar.
  const onErrorRef = useRef<(m: string) => void>(() => {});
  onErrorRef.current = (message: string) => {
    const id = channel?.id ?? '';
    // Canal que já estava tocando e caiu: reconecta sozinho (2 s, 4 s, 8 s) antes de trocar de fonte.
    if (okRef.current === id && reconnRef.current < 3) {
      clearTimeout(stableTimer.current);
      reconnRef.current++;
      const n = reconnRef.current;
      setReconnecting(n);
      setStatus('loading');
      clearTimeout(reconnTimer.current);
      reconnTimer.current = window.setTimeout(() => setAttempt((a) => a + 1), 1000 * 2 ** n);
      return;
    }
    okRef.current = '';
    if (autoRef.current.ch !== id) autoRef.current = { ch: id, tried: 0 };
    if (autoRef.current.tried < sources.length - 1) {
      autoRef.current.tried++;
      setSrc({ ch: id, idx: (srcIdx + 1) % sources.length });
      return;
    }
    setStatus('error');
    setErrMsg(message);
  };

  useEffect(() => {
    setHeight(undefined);
    setTracks(null);
    setReconnecting(0);
    reconnRef.current = 0;
    channelIdRef.current = channel?.id ?? '';
    clearTimeout(reconnTimer.current);
  }, [channel?.id]);

  // Filme/episódio: tempo, pausa e progresso salvo a cada 10 s.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !vod || !channel) return;
    const id = channel.id;
    const save = () => {
      if (v.duration && isFinite(v.duration) && v.currentTime > 0) saveProgress(id, v.currentTime, v.duration);
    };
    const onTime = () => {
      setTime({ cur: v.currentTime, dur: isFinite(v.duration) ? v.duration : 0, paused: v.paused });
      if (Date.now() - lastSave.current > 10000) {
        lastSave.current = Date.now();
        save();
      }
    };
    const onPause = () => {
      setTime((t) => ({ ...t, paused: v.paused }));
      save();
    };
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('pause', onPause);
    v.addEventListener('play', onPause);
    const onEnded = () => {
      save();
      // Fim de temporada (o próximo é de outra temporada, ou não há próximo): confete e parabéns.
      const seasonOf = (c?: Channel | null) => Number(c?.name.match(/·\s*T(\d+)\s*E\d+/)?.[1] ?? NaN);
      if (channel?.seriesId) {
        const cur = seasonOf(channel);
        if (!isNaN(cur) && (!nextEp || seasonOf(nextEp) !== cur)) celebrate(nextEp ? `Temporada ${cur} concluída!` : 'Série concluída! 🎬');
      }
      if (nextEp) setNextIn(10);
    };
    v.addEventListener('ended', onEnded);
    return () => {
      save();
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('play', onPause);
      v.removeEventListener('ended', onEnded);
    };
  }, [channel?.id, vod, nextEp?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Contagem do próximo episódio
  useEffect(() => {
    if (nextIn === null) return;
    if (nextIn <= 0) {
      setNextIn(null);
      onNext?.();
      return;
    }
    const t = setTimeout(() => setNextIn((n) => (n === null ? n : n - 1)), 1000);
    return () => clearTimeout(t);
  }, [nextIn]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setNextIn(null), [channel?.id]);
  useEffect(() => {
    if (nextIn === 10) requestAnimationFrame(() => focusFirst(document.querySelector<HTMLElement>('.next-ep')));
  }, [nextIn]);

  const seek = (delta: number) => {
    const v = videoRef.current;
    if (!v || !isFinite(v.duration)) return;
    v.currentTime = Math.max(0, Math.min(v.duration - 1, v.currentTime + delta));
    setTime((t) => ({ ...t, cur: v.currentTime }));
  };
  const togglePause = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      try {
        const r = v.play() as Promise<void> | undefined;
        if (r && typeof r.catch === 'function') r.catch(() => {});
      } catch {
        /* ignora */
      }
    } else v.pause();
  };

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
    if (isLocked(channel.id)) {
      engine.current?.stop();
      setStatus('locked');
      return;
    }
    setStatus('loading');
    setTime({ cur: 0, dur: 0, paused: false });
    engine.current?.play(t.u, channel, vod ? startAt || 0 : 0, t.native);
  }, [channel?.id, srcIdx, attempt, mode === 'off']); // eslint-disable-line react-hooks/exhaustive-deps

  // Velocidade de download (canto superior direito), enquanto a barra aparece.
  useEffect(() => {
    if (mode !== 'full' || vod || !overlayKind) return;
    const tick = () => setSpeed(engine.current?.speed());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [mode, vod, overlayKind]);
  useEffect(() => {
    setMenu(null);
    setInfoOpen(false);
  }, [channel?.id, mode]);
  useEffect(() => {
    if (mode !== 'full') {
      setListOpen(false);
      setGuideOpen(null);
      setNowOpen(null);
    }
  }, [mode]);

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
      hideTimer.current = window.setTimeout(() => {
        if (menuRef.current) return; // menu aberto: a barra fica
        barNavRef.current = false;
        setOverlayKind(false);
        setInfoOpen(false);
      }, osdMs);
      if (focus) requestAnimationFrame(() => focusFirst(overlayRef.current));
    },
    [S.osd, osdMs],
  );

  // ---- Zapear por número e "Último canal" ----
  const digitsRef = useRef('');
  const goNumber = useCallback(
    (nd: string) => {
      clearTimeout(digitTimer.current);
      digitsRef.current = '';
      setDigits('');
      const target = allLive.find((c) => c.number === parseInt(nd, 10));
      if (target && target.id !== channel?.id) {
        onZap(target);
        if (mode === 'full') showOverlay();
      }
    },
    [allLive, channel, onZap, mode], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const goLast = useCallback(() => {
    if (!lastChannel) return;
    onZap(lastChannel);
    if (mode === 'full') showOverlay();
  }, [lastChannel, onZap, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Trata números (teclado, controle, teclado numérico), OK/Voltar durante a digitação e a tecla amarela / L. */
  const zapKey = useCallback(
    (e: KeyboardEvent): boolean => {
      if (vod) return false;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return false;
      const k = e.keyCode;
      const n = k >= 48 && k <= 57 && !e.shiftKey ? k - 48 : k >= 96 && k <= 105 ? k - 96 : -1;
      if (n >= 0) {
        const nd = (digitsRef.current + String(n)).slice(-4);
        digitsRef.current = nd;
        setDigits(nd);
        clearTimeout(digitTimer.current);
        digitTimer.current = window.setTimeout(() => goNumber(nd), 2000);
        return true;
      }
      if (digitsRef.current) {
        if (isEnter(e)) {
          goNumber(digitsRef.current);
          return true;
        }
        if (isBack(e)) {
          clearTimeout(digitTimer.current);
          digitsRef.current = '';
          setDigits('');
          return true;
        }
      }
      if (k === KEY.YELLOW || (k === 76 && !e.ctrlKey && !e.metaKey && !e.altKey)) {
        goLast();
        return true;
      }
      return false;
    },
    [vod, goNumber, goLast],
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

  // Ao entrar em tela cheia: mostra as informações uma vez (somem no tempo dos Ajustes).
  // Fica separado do efeito das teclas: antes ele rodava de novo quando as
  // informações sumiam e as fazia voltar — por isso não desapareciam.
  useEffect(() => {
    if (mode === 'full') showOverlay(false);
    else {
      clearTimeout(hideTimer.current);
      setOverlayKind(false);
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Teclas no modo tela cheia
  useEffect(() => {
    if (mode !== 'full') return;
    const onKey = (e: KeyboardEvent) => {
      // Janela aberta (ex.: escolher seção) ou lista de canais: elas tratam as teclas.
      if (document.querySelector('.modal-back') || listOpenRef.current || guideOpenRef.current) return;
      // Protetor de tela: qualquer tecla volta (sem mais efeito).
      if (saverRef.current) {
        setSaver(false);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // Créditos finais: as setas/OK andam nos botões; Voltar fecha e volta ao filme.
      if (vod && creditsRef.current) {
        if (isBack(e)) {
          setCreditsOff(true);
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      const k = e.keyCode;
      const d = dirOf(e);
      let handled = true;
      const interactive = overlayKind === 'controls' || status === 'error';
      // ---- Filme/episódio ----
      if (vod && nextIn !== null) {
        // Aviso de próximo episódio: as setas/OK andam nos botões dele; Voltar cancela.
        if (isBack(e)) {
          setNextIn(null);
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      if (vod) {
        let h = true;
        if (isBack(e)) {
          if (overlayKind === 'controls' && status !== 'error') setOverlay(false);
          else onMode('preview');
        } else if (k === KEY.PLAY || k === KEY.PAUSE || k === KEY.PLAY_PAUSE) {
          togglePause();
          showOverlay(true);
        } else if (k === 417 /* avançar */ || (!interactive && d === 'right')) {
          seek(k === 417 ? 30 : 10);
          setOverlayKind((o) => (o === 'controls' ? o : 'info'));
          clearTimeout(hideTimer.current);
          hideTimer.current = window.setTimeout(() => setOverlayKind(false), osdMs);
        } else if (k === 412 /* voltar */ || (!interactive && d === 'left')) {
          seek(k === 412 ? -30 : -10);
          setOverlayKind((o) => (o === 'controls' ? o : 'info'));
          clearTimeout(hideTimer.current);
          hideTimer.current = window.setTimeout(() => setOverlayKind(false), osdMs);
        } else if (!interactive && isEnter(e)) {
          togglePause();
          showOverlay(true);
        } else if (!interactive && d) showOverlay(true);
        else if (interactive) {
          showOverlay(true);
          h = false;
        } else h = false;
        if (h) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      // Menu da barra aberto: as setas andam nele; Voltar fecha.
      if (menuRef.current) {
        if (isBack(e)) {
          closeMenu();
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      if (zapKey(e)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (k === 457 || k === 93 || (k === 73 && !e.ctrlKey)) {
        // Info (controle LG) / Menu / "i": detalhes do programa
        setInfoOpen((o) => !o);
        showOverlay(true);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (isBack(e) && infoOpen) {
        setInfoOpen(false);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (isBack(e)) {
        if (overlayKind === 'controls' && status !== 'error') setOverlay(false);
        else onMode('preview');
      } else if (k === KEY.CH_UP || d === 'up') {
        barNavRef.current = false;
        zap(-1);
      } else if (k === KEY.CH_DOWN || d === 'down') {
        barNavRef.current = false;
        zap(1);
      } else if (isEnter(e) && status !== 'error' && (!interactive || (S.osdStyle !== 'prisma' && !barNavRef.current))) openList();
      else if (!interactive && d) {
        barNavRef.current = true;
        showOverlay(true);
      }
      else if (interactive) {
        if (d === 'left' || d === 'right') barNavRef.current = true;
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
  }, [mode, overlay, overlayKind, status, vod, nextIn, zap, zapKey, onMode, showOverlay, infoOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Na tela Ao vivo (vídeo pequeno): números e "Último canal" também valem.
  useEffect(() => {
    if (mode !== 'preview') return;
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('.modal-back')) return;
      if (zapKey(e)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [mode, zapKey]);

  useEffect(() => {
    if (mode === 'full' && overlay) requestAnimationFrame(() => {
      if (!overlayRef.current?.contains(document.activeElement)) focusFirst(overlayRef.current);
    });
  }, [mode, overlay]);

  const cur = epg?.[0];
  const next = epg?.[1];

  // ---------- Barra clássica: funções ----------
  // Visual da tela cheia: Clássica (barra de receptor), Prisma (escuro) ou Cartão (cartão que sobe ao trocar de canal;
  // as funções continuam na barra clássica ao apertar OK/Menu).
  const classic = S.osdStyle === 'classic';
  const cardStyle = S.osdStyle === 'card';
  const showBar = full && !vod && !!channel && status !== 'error' && (classic || cardStyle) && (overlayKind === 'controls' || (classic && overlayKind === 'info' && S.osd === 'full'));
  const showCard = full && !vod && !!channel && status !== 'error' && cardStyle && overlayKind === 'info' && S.osd === 'full';
  // Créditos finais (filme, perto do fim): imagem no canto + "Continuar a coleção" e "Semelhantes".
  const creditsOn = !!(full && vod && channel && !channel.seriesId && status !== 'error' && time.dur > 600 && time.dur - time.cur < Math.max(120, time.dur * 0.04) && !creditsOff && nextIn === null);
  creditsRef.current = creditsOn;
  const nextInColl = (() => {
    if (!creditsOn || !channel || !playlist) return undefined;
    const c = collectionsIn(topsNow(), playlist.items).find((x) => x.items.some((i) => i.id === channel.id));
    if (!c) return undefined;
    return c.items[c.items.findIndex((i) => i.id === channel.id) + 1];
  })();
  const [barH, setBarH] = useState(0);
  useLayoutEffect(() => {
    // Só atualiza quando muda: um setState a cada commit entrava em laço
    // ("Maximum update depth") durante a reprodução de filmes.
    const h = showBar && overlayRef.current ? overlayRef.current.offsetHeight : 0;
    if (h !== barH) setBarH(h);
  });
  function openList() {
    clearTimeout(hideTimer.current);
    setMenu(null);
    setInfoOpen(false);
    setOverlayKind(false);
    setListOpen(true);
  }
  const focusIcon = (id: string) =>
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`.cbar-ic[data-ic="${id}"]`);
      if (el) el.focus();
    });
  const openMenu = (id: string) => {
    barNavRef.current = true;
    clearTimeout(hideTimer.current);
    setOverlayKind('controls');
    setMenu(id);
    requestAnimationFrame(() => focusFirst(document.querySelector<HTMLElement>('.cbar-pop')));
  };
  const closeMenu = () => {
    const id = menuRef.current;
    setMenu(null);
    showOverlay(false);
    setOverlayKind('controls');
    if (id) focusIcon(id);
  };
  const acc = playlist?.account;
  const addPip = (c: Channel) => {
    if (!onPips || pips.some((p) => p.id === c.id) || pips.length >= MAX_PIPS) return;
    onPips([...pips, c]);
  };
  const resLabel = height ? (height >= 2000 ? '4K' : height >= 1000 ? 'FHD' : height >= 700 ? 'HD' : 'SD') : channel && /\b(4k|uhd)\b/i.test(channel.name) ? '4K' : channel && /\bfhd\b/i.test(channel.name) ? 'FHD' : channel && /\bhd\b/i.test(channel.name) ? 'HD' : undefined;
  const connNote = acc?.maxConnections
    ? `Sua assinatura: ${acc.maxConnections} ${acc.maxConnections === 1 ? 'tela' : 'telas'} ao mesmo tempo. Cada janela usa 1.`
    : 'Cada janela usa 1 conexão da sua assinatura.';
  // Aviso só quando a assinatura permite 1 tela (a janela pequena usaria a 2ª conexão).
  const overLimit = !!acc?.maxConnections && acc.maxConnections < 2;
  const barActions: BarAction[] = [];
  if (channel && !vod) {
    if (mobile) {
      barActions.push({ id: 'up', label: 'Canal anterior', icon: BarIcon.up, onClick: () => zap(-1) });
      barActions.push({ id: 'down', label: 'Próximo canal', icon: BarIcon.down, onClick: () => zap(1) });
    }
    barActions.push({
      id: 'pip',
      label: 'Pip',
      icon: BarIcon.pip,
      onClick: () => (menu === 'pip' ? closeMenu() : openMenu('pip')),
      menu: (
        <BarMenu>
          {/* Só duas funções: ligar/desligar a tela pequena e trocar com a principal.
              Depois de usar, o menu fecha: ▲▼ voltam a trocar o canal principal. */}
          <MenuToggle on={pips.length > 0} onClick={() => { if (pips.length) onPips?.([]); else addPip(channel); closeMenu(); }} />
          {pips.length > 0 && (
            <MenuItem def onClick={() => { onSwapPip?.(0); closeMenu(); }}>Trocar PIP</MenuItem>
          )}
          {overLimit && <span className="cbar-pop-note">{connNote}</span>}
        </BarMenu>
      ),
    });
    const qs = engine.current?.qualities() ?? [];
    const q = engine.current?.quality() ?? -1;
    barActions.push({
      id: 'hd',
      label: 'Qualidade',
      icon: BarIcon.hd,
      onClick: () => (menu === 'hd' ? closeMenu() : openMenu('hd')),
      menu: (
        <BarMenu>
          {qs.length > 0 && (
            <>
              <MenuItem def={q === -1} on={q === -1} onClick={() => { engine.current?.setQuality(-1); closeMenu(); }}>Automática</MenuItem>
              {qs.map((x) => (
                <MenuItem key={x.id} on={q === x.id} onClick={() => { engine.current?.setQuality(x.id); closeMenu(); }}>{x.label}</MenuItem>
              ))}
            </>
          )}
          {sources.length > 1 &&
            sources.map((t, i) => (
              <MenuItem key={'s' + i} def={qs.length === 0 && i === srcIdx} on={i === srcIdx} onClick={() => { setSrcIdx(() => i); closeMenu(); }}>
                Fonte {t.n + 1}
                {/\.m3u8(\?|$)/i.test(t.u) ? ' · HLS' : /\.ts(\?|$)/i.test(t.u) ? ' · TS' : ''}
                {t.native ? (IS_ANDROID ? ' · aparelho' : ' · TV') : ''}
              </MenuItem>
            ))}
          {qs.length === 0 && sources.length < 2 && <span className="cbar-pop-note">Este canal tem uma só qualidade{resLabel ? ` (${resLabel})` : ''}.</span>}
        </BarMenu>
      ),
    });
    if (lastChannel) barActions.push({ id: 'last', label: 'Último canal', icon: BarIcon.last, onClick: goLast });
    barActions.push({ id: 'aspect', label: 'Formato: ' + FIT_LABEL[S.videoFit], icon: BarIcon.aspect, onClick: () => updateSettings({ videoFit: FIT_NEXT[S.videoFit] }) });
    barActions.push({ id: 'fav', label: isFav(channel) ? 'Favorito' : 'Favoritar', icon: BarIcon.heart(isFav(channel)), onClick: () => {
        const was = isFav(channel);
        toggleFav(channel);
        toast(was ? `${channel.name} saiu dos favoritos` : `${channel.name} nos favoritos`, was ? '✕' : '★');
      } });
    const marked = isLockMarked(channel.id) || lockTick < 0;
    barActions.push({
      id: 'lock',
      label: marked ? 'Desbloquear' : 'Bloquear',
      icon: BarIcon.lock(marked),
      onClick: () => {
        if (marked) setPinDlg('unlockMark');
        else if (!hasPin()) setPinDlg('lock');
        else {
          setLocked(channel.id, true);
          unlockForSession(channel.id); // quem bloqueou continua assistindo
          setLockTick((t) => t + 1);
        }
      },
    });
    if (hasTracks) barActions.push({ id: 'audio', label: 'Áudio e legendas', icon: BarIcon.audio, onClick: () => setTrackDlg(true) });
    barActions.push({ id: 'sec', label: 'Seção', icon: BarIcon.folder, onClick: () => setPicker(true) });
    barActions.push({ id: 'list', label: 'Lista de canais', icon: BarIcon.list, onClick: () => openList() });
  }
  const pipBox = full
    ? { w: mobile ? 36 : 26, side: Math.round(padX * 0.6), top: padT + (mobile ? 30 : 56), bottom: showBar ? barH + 12 : padB }
    : { w: 30, side: 10, top: 10, bottom: '36%' }; // vídeo pequeno: acima do cartão de informações
  const style = full || !rect ? undefined : { left: rect.left, top: rect.top, width: rect.width, height: rect.height, borderRadius: rect.radius ?? 28 };
  const fav = channel ? isFav(channel) : false;

  return (
    <div
      className={'player' + (full ? ' full' : '') + (mode === 'off' ? ' hidden' : '') + (creditsOn ? ' credits' : '')}
      style={style}
      data-nav-scope={full ? '' : undefined}
      onMouseMove={
        full
          ? (e) => {
              // Só movimento real do mouse (alguns aparelhos disparam o evento sem mexer).
              const m = lastMouse.current;
              lastMouse.current = { x: e.clientX, y: e.clientY };
              if (m && Math.abs(m.x - e.clientX) + Math.abs(m.y - e.clientY) > 4) showOverlay(true);
            }
          : undefined
      }
    >
      <video
        ref={videoRef}
        playsInline
        autoPlay
        style={{ objectFit: S.videoFit }}
        onClick={() => (full ? (overlayKind === 'controls' ? setOverlay(false) : showOverlay(true)) : onMode('full'))}
      />

      {status === 'loading' && mode !== 'off' && (
        <div className="gy-12" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div className="spinner" />
          {reconnecting > 0 && <span className="reconn">Sinal caiu · reconectando ({reconnecting}/3)…</span>}
        </div>
      )}

      {status === 'error' && mode !== 'off' && channel && (
        <div className="gy-14"
          style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(11,11,18,0.88)', textAlign: 'center', padding: 24,
          }}
        >
          <span className="badge-live" style={{ background: T.live }}>Canal fora do ar</span>
          <span className="title caps" style={{ fontSize: full ? 32 : 22 }}>{channel.name}</span>
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

      {full && vod && channel && status !== 'error' && (overlayKind || time.paused) && (
        <div ref={overlayRef} className={'vod-osd' + (time.paused ? ' paused' : '')}>
          <div style={{ position: 'absolute', left: padX, right: padX, top: padT, display: 'flex', alignItems: 'center' }}>
            <span className="caps" style={{ fontSize: mobile ? 14 : 16, color: '#D6D6E0', flexGrow: 1 }}>{channel.seriesId ? 'Série' : 'Filme'} · {channel.group}</span>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{fmtTime(now)}</span>
          </div>
          {time.paused && !creditsOn && <PausedInfo ch={channel} padX={padX} mobile={mobile} />}
          <div className="gy-12" style={{ position: 'absolute', left: padX, right: padX, bottom: padB, display: 'flex', flexDirection: 'column' }}>
            {!time.paused && <span className="title caps" style={{ fontSize: mobile ? 22 : 30, lineHeight: 1.1 }}>{channel.name}</span>}
            <div className={'vod-seek' + (overlayKind === 'controls' || time.paused ? ' big' : '')}>
              <span>{fmtDuration(time.cur)}</span>
              <div className="vod-bar">
                <div style={{ width: time.dur ? `${(time.cur / time.dur) * 100}%` : '0%' }} />
                <i style={{ left: time.dur ? `${(time.cur / time.dur) * 100}%` : '0%' }} />
                {(overlayKind === 'controls' || time.paused) && time.dur > 0 && !channel.seriesId && <SeekThumb scenes={scenes} frac={time.cur / time.dur} />}
              </div>
              <span>{time.dur ? '-' + fmtDuration(time.dur - time.cur) : '--:--'}</span>
            </div>
            {overlayKind === 'controls' || time.paused ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: mobile ? 'center' : 'flex-start', flexWrap: 'wrap' }}>
                <button className="pbtn" data-nav="" aria-label="Voltar 10 segundos" onClick={() => seek(-10)}>⟲ 10s</button>
                <button className="pbtn main" data-nav="" data-nav-default="" aria-label={time.paused ? 'Continuar' : 'Pausar'} onClick={togglePause}>
                  {time.paused ? '▶ Continuar' : '❚❚ Pausar'}
                </button>
                <button className="pbtn" data-nav="" aria-label="Avançar 10 segundos" onClick={() => seek(10)}>10s ⟳</button>
                <div style={{ flexGrow: 1 }} />
                {hasTracks && <button className="pbtn" data-nav="" onClick={() => setTrackDlg(true)}>Áudio e legendas</button>}
                {nextEp && <button className="pbtn" data-nav="" onClick={() => onNext?.()}>Próximo episódio ›</button>}
                <button className="pbtn" data-nav="" onClick={() => onMode('preview')}>Sair</button>
              </div>
            ) : null}
            {(overlayKind === 'controls' || time.paused) && !mobile && <span className="muted" style={{ fontSize: 13 }}>◀ ▶ voltar/avançar · OK pausa · Voltar sai</span>}
          </div>
        </div>
      )}

      {full && !vod && channel && status !== 'error' && overlayKind === 'info' && S.osd === 'name' && (
        <div className="gx-10" style={{ position: 'absolute', left: padX, top: padT, display: 'flex', alignItems: 'center', padding: '8px 14px 8px 8px', borderRadius: 16, background: 'rgba(0,0,0,0.55)' }}>
          <ChannelLogo ch={channel} size={mobile ? 32 : 40} />
          <span className="caps" style={{ fontSize: mobile ? 15 : 18, fontWeight: 700 }}>{channel.number} · {channel.name}</span>
        </div>
      )}

      {showCard && channel && <NowCard ch={channel} epg={epg} now={now} padX={padX} padB={padB} mobile={mobile} />}

      {full && !vod && channel && status !== 'error' && S.osdStyle === 'prisma' && (overlayKind === 'controls' || (overlayKind === 'info' && S.osd === 'full')) && (
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
                {cur0.native ? (IS_ANDROID ? ' · player do aparelho' : ' · player da TV') : ''}
              </span>
            )}
          </div>
          <div style={{ position: 'absolute', right: padX, top: padT, fontSize: 18, fontWeight: 700 }}>{fmtTime(now)}</div>

          <div
            className="gy-14"
            style={{ position: 'absolute', left: padX, right: padX, bottom: padB, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
          >
            <div className="gx-14" style={{ display: 'flex', alignItems: 'flex-end', flexGrow: 1, minWidth: 0 }}>
            <ChannelLogo ch={channel} size={mobile ? 48 : 84} />
            <div className="gy-6" style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span className="caps" style={{ fontSize: 16, color: '#D6D6E0' }}>
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
              {!mobile && <span className="muted" style={{ fontSize: 14, marginTop: 10 }}>▲▼ trocar de canal · números para ir direto · amarelo (ou L) volta ao último canal · Voltar sai da tela cheia</span>}
            </div>
            </div>
            <div className="gx-10" style={{ display: 'flex', flexShrink: 0, justifyContent: 'flex-end' }}>
              {mobile && (
                <>
                  <button className="btn icon" data-nav="" aria-label="Canal anterior" style={{ width: 46, padding: 0, justifyContent: 'center' }} onClick={() => zap(-1)}>▲</button>
                  <button className="btn icon" data-nav="" aria-label="Próximo canal" style={{ width: 46, padding: 0, justifyContent: 'center' }} onClick={() => zap(1)}>▼</button>
                </>
              )}
              {lastChannel && (
                <button className="btn" data-nav="" aria-label={`Último canal: ${lastChannel.name}`} onClick={goLast}>
                  ↺ {mobile ? null : <span className="caps">{lastChannel.name}</span>}
                </button>
              )}
              <button className="btn" data-nav="" onClick={(e) => { toggleFav(channel); pop(e.currentTarget); toast(fav ? `${channel.name} saiu dos favoritos` : `${channel.name} nos favoritos`, fav ? '✕' : '★'); }} aria-pressed={fav}>
                {Icon.star(fav)} {mobile ? null : fav ? 'Favorito' : 'Favoritar'}
              </button>
              {hasTracks && (
                <button className="btn" data-nav="" onClick={() => setTrackDlg(true)} aria-label="Áudio e legendas">{mobile ? 'Áudio' : 'Áudio e legendas'}</button>
              )}
              <button className="btn" data-nav="" onClick={() => setPicker(true)} aria-label="Adicionar a uma seção">
                {Icon.folder} {mobile ? null : 'Seção'}
              </button>
              {sources.length > 1 && (
                <button className="btn" data-nav="" onClick={() => setSrcIdx((i) => (i + 1) % sources.length)}>{mobile ? 'Fonte' : 'Trocar fonte'}</button>
              )}
              <button className="btn primary" data-nav="" data-nav-default="" onClick={() => onMode('preview')}>{mobile ? 'Canais' : 'Lista de canais'}</button>
            </div>
          </div>
        </div>
      )}

      {mode !== 'off' && !vod && pips.map((p, i) => (
        <PipWindow key={p.id} ch={p} small={!full} style={pipSlotStyle(i, pipBox)} onSwap={() => onSwapPip?.(i)} onClose={() => onPips?.(pips.filter((x) => x.id !== p.id))} />
      ))}

      {showBar && channel && (
        <>
          <BarTop now={now} speed={speed} padX={padX} padT={padT} />
          <ClassicBar
            channel={channel}
            cur={cur}
            next={next}
            now={now}
            quality={resLabel}
            fitLabel={FIT_LABEL[S.videoFit]}
            actions={barActions}
            openMenu={menu}
            mobile={mobile}
            padX={padX}
            padB={Math.max(14, padB - 12)}
            onInfo={() => { setInfoOpen((o) => !o); showOverlay(true); }}
            infoOpen={infoOpen}
            barRef={overlayRef}
            stack={mobile && L.H > L.W}
          />
        </>
      )}

      {full && !vod && listOpen && channel && playlist && (
        <FullList
          variant={classic ? 'classic' : 'prisma'}
          playlist={playlist}
          live={allLive}
          current={channel}
          isFav={isFav}
          onClose={() => setListOpen(false)}
          onOpenNow={(chs, title) => {
            setListOpen(false);
            setNowOpen({ channels: chs, title });
          }}
          onOpenGuide={(chs, i) => {
            setListOpen(false);
            setGuideOpen({ channels: chs, index: i });
          }}
          onPlayVod={(it) => {
            setListOpen(false);
            onPlayVod?.(it);
          }}
          onPick={(c, list) => {
            setListOpen(false);
            if (c.id !== channel.id) {
              if (onPickList) onPickList(c, list);
              else onZap(c);
            }
            showOverlay();
          }}
        />
      )}

      {full && nowOpen && playlist && (
        <NowOnTV
          playlist={playlist}
          title={nowOpen.title}
          channels={nowOpen.channels}
          current={channel}
          onClose={() => setNowOpen(null)}
          onWatch={(c) => {
            const list = nowOpen.channels;
            setNowOpen(null);
            if (c.id !== channel?.id) {
              if (onPickList) onPickList(c, list);
              else onZap(c);
            }
            showOverlay();
          }}
        />
      )}

      {full && guideOpen && playlist && (
        <Guide
          playlist={playlist}
          channels={guideOpen.channels}
          startIndex={guideOpen.index}
          onClose={() => setGuideOpen(null)}
          onWatch={(c) => {
            setGuideOpen(null);
            if (c.id !== channel?.id) {
              if (onPickList) onPickList(c, guideOpen.channels);
              else onZap(c);
            }
            showOverlay();
          }}
          onPlayVod={(it) => {
            setGuideOpen(null);
            onPlayVod?.(it);
          }}
        />
      )}

      {status === 'locked' && mode !== 'off' && channel && (
        <div className={'lock-screen ' + (full ? 'gy-14' : 'gy-8')} style={full ? undefined : { paddingBottom: '32%' }}>
          <span style={{ fontSize: full ? 56 : 28 }}>🔒</span>
          <span className="title caps" style={{ fontSize: full ? 30 : 18 }}>{channel.name}</span>
          {full && <span className="muted" style={{ fontSize: 16 }}>Canal bloqueado. Digite a senha para assistir.</span>}
          <button className="btn primary" data-nav="" data-nav-default="" onClick={() => setPinDlg('unlock')}>Digitar senha</button>
        </div>
      )}

      {pinDlg && channel && (
        <PinDialog
          title={pinDlg === 'lock' ? 'Criar senha de bloqueio' : pinDlg === 'unlockMark' ? 'Desbloquear canal' : 'Canal bloqueado'}
          help={
            pinDlg === 'lock'
              ? 'Escolha 4 números. A senha vale para todos os canais bloqueados neste aparelho; guarde-a.'
              : pinDlg === 'unlockMark'
                ? `Digite a senha para tirar o bloqueio de ${channel.name}.`
                : `Digite a senha para assistir ${channel.name}.`
          }
          onClose={() => { setPinDlg(null); if (full) showOverlay(true); }}
          onSubmit={(pin) => {
            if (pinDlg === 'lock') {
              setPin(pin);
              setLocked(channel.id, true);
              unlockForSession(channel.id);
            } else {
              if (!checkPin(pin)) return 'Senha incorreta.';
              if (pinDlg === 'unlockMark') setLocked(channel.id, false);
              else {
                unlockForSession(channel.id);
                setAttempt((a) => a + 1);
              }
            }
            setPinDlg(null);
            setLockTick((t) => t + 1);
            return null;
          }}
        />
      )}

      {picker && channel && <SectionPicker ch={channel} live={allLive} onClose={() => { setPicker(false); showOverlay(true); }} />}

      {trackDlg && tracks && (
        <Modal title="Áudio e legendas" onClose={() => { setTrackDlg(false); showOverlay(true); }} width={560}>
          {tracks.audio.length > 0 && <span className="muted" style={{ fontSize: 15, fontWeight: 700 }}>ÁUDIO</span>}
          {tracks.audio.map((t) => (
            <button key={'a' + t.id} className={'pick-row' + (t.id === tracks.audioId ? ' on' : '')} data-nav="" onClick={() => { engine.current?.setAudio(t.id); setTracks(engine.current?.tracks() ?? null); }}>
              <span className="pick-check">{t.id === tracks.audioId ? '✓' : ''}</span>
              <span className="sec-name">{t.label}</span>
            </button>
          ))}
          <span className="muted" style={{ fontSize: 15, fontWeight: 700 }}>LEGENDAS</span>
          {[{ id: -1, label: 'Desligadas' }, ...tracks.text].map((t) => (
            <button key={'t' + t.id} className={'pick-row' + (t.id === tracks.textId ? ' on' : '')} data-nav="" onClick={() => { engine.current?.setText(t.id); setTracks(engine.current?.tracks() ?? null); }}>
              <span className="pick-check">{t.id === tracks.textId ? '✓' : ''}</span>
              <span className="sec-name">{t.label}</span>
            </button>
          ))}
          <div className="wrap-row" style={{ display: 'flex' }}>
            <button className="btn primary" data-nav="" onClick={() => { setTrackDlg(false); showOverlay(true); }}>Concluir</button>
          </div>
        </Modal>
      )}

      {creditsOn && channel && playlist && (
        <EndCredits item={channel} items={playlist.items} next={nextInColl} onDismiss={() => setCreditsOff(true)} onPlay={(c) => { setCreditsOff(true); onPlayVod?.(c); }} />
      )}
      {intro && channel && <CinemaIntro item={channel} />}
      {saver && channel && <Screensaver items={[channel, ...vodRecents(), ...myList()].filter((c, i, a) => a.findIndex((x) => x.id === c.id) === i)} title={channel.seriesId ? channel.group : channel.name} onExit={() => setSaver(false)} />}
      {full && vod && nextEp && nextIn !== null && (
        <div className="next-ep">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <svg className="next-ring" width="54" height="54" viewBox="0 0 54 54" aria-hidden="true">
              <circle cx="27" cy="27" r="23" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="4" />
              <circle cx="27" cy="27" r="23" fill="none" stroke="#F4F4F8" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(2 * Math.PI * 23 * Math.max(0, nextIn)) / 10} 999`} transform="rotate(-90 27 27)" />
              <text x="27" y="33" textAnchor="middle" fontSize="18" fontWeight="800" fill="#F4F4F8">{Math.max(0, nextIn)}</text>
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 14, minWidth: 0 }}>
              <span className="muted" style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1 }}>PRÓXIMO EPISÓDIO</span>
              <span className="caps" style={{ fontSize: 18, fontWeight: 800 }}>{nextEp.name}</span>
            </div>
          </div>
          <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <button className="btn primary" data-nav="" data-nav-default="" onClick={() => { setNextIn(null); onNext?.(); }}>▶ Assistir agora</button>
            <button className="btn" data-nav="" onClick={() => setNextIn(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {digits && mode !== 'off' && (() => {
        const hit = allLive.find((c) => c.number === parseInt(digits, 10));
        return (
          <div className="zap-num" style={full ? { right: padX, top: padT + 44 } : { right: 14, top: 14 }} role="status">
            <span className="title" style={{ fontSize: full ? 64 : 34, lineHeight: 1 }}>{digits}</span>
            <span className="caps" style={{ fontSize: full ? 18 : 13, fontWeight: 700, opacity: hit ? 1 : 0.6 }}>{hit ? hit.name : 'Canal não encontrado'}</span>
          </div>
        );
      })()}
    </div>
  );
}

/** Pausa (filme/série): logo do título, nome do episódio e sinopse sobre o vídeo escurecido. */
function PausedInfo({ ch, padX, mobile }: { ch: Channel; padX: number; mobile: boolean }) {
  const series = ch.seriesId ? { ...ch, name: ch.group, kind: 'series' as const, fullName: undefined } : ch;
  const tm = useTmdb(series);
  const ep = ch.seriesId ? ch.name.split(' · ').slice(1).join(' · ') : '';
  return (
    <div className="paused-info" style={{ left: padX, maxWidth: mobile ? undefined : '52%', right: mobile ? padX : undefined }}>
      <span className="paused-tag">Pausado</span>
      <TitleLogo info={tm} name={series.name} height={mobile ? 56 : 96} maxW={mobile ? 280 : 520} />
      <span className="title caps paused-title">{series.name}</span>
      {ep && <span className="paused-ep">{ep}</span>}
      {tm?.overview && !mobile && <p className="paused-plot">{tm.overview}</p>}
    </div>
  );
}

/** Estilo "Cartão": ao trocar de canal, um cartão sobe com logo, programa, tempo e o próximo. */
function NowCard({ ch, epg, now, padX, padB, mobile }: { ch: Channel; epg: EpgEntry[] | null; now: number; padX: number; padB: number; mobile: boolean }) {
  const cur = epg?.find((e) => e.start <= now && e.end > now);
  const next = epg?.find((e) => e.start >= (cur ? cur.end : now));
  return (
    <div className="livecard" style={{ left: padX, right: mobile ? padX : undefined, bottom: padB }}>
      <div className="livecard-logo"><ChannelLogo ch={ch} size={mobile ? 44 : 64} /></div>
      <div className="livecard-body">
        <span className="livecard-ch caps">{ch.number != null ? `${ch.number} · ` : ''}{ch.name}</span>
        <span className="livecard-title">{cur ? cur.title : 'Ao vivo'}</span>
        {cur && (
          <div className="livecard-time">
            <span>{fmtTime(cur.start)}</span>
            <div className="livecard-bar"><div style={{ width: `${progressOf(cur, now) * 100}%` }} /></div>
            <span>{fmtTime(cur.end)}</span>
          </div>
        )}
        {next && <span className="livecard-next">A seguir · {fmtTime(next.start)} {next.title}</span>}
      </div>
    </div>
  );
}

