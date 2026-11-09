import { useEffect, useRef, useState } from 'react';
import type { Channel } from '../core/types';
import { trailerOf, type TmdbInfo } from '../core/tmdb';
import { colorFor, rgba } from './bits';
import { useTmdb } from './useTmdb';
import { PosterCard } from '../screens/Vod';
import { RankedCard, TitleLogo, badgesOf, setPreview } from './premium';

// Visual premium, parte 2 (0.21.0): trailer silencioso, card que se expande no
// foco, cor dominante da capa, cartões de gênero, estados vazios ilustrados,
// avisos, confete, abertura animada e sons de navegação. Na TV LG de 2017
// (classe "lite") os efeitos pesados ficam desligados.

const isLite = () => document.documentElement.classList.contains('lite');
const isMobile = () => document.documentElement.classList.contains('mobile');

// ---------------------------------------------------------------- Trailer silencioso

/** Depois de alguns segundos parado, a arte vira o trailer do YouTube, sem som e sem controles. */
export function TrailerLayer({ info, active, delay = 3500, maxMs = 60000 }: { info: TmdbInfo | null; active: boolean; delay?: number; maxMs?: number }) {
  const [key, setKey] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setKey(null);
    setShown(false);
    if (!active || !info || isLite() || isMobile()) return;
    let alive = true;
    const t = setTimeout(() => {
      trailerOf(info).then((k) => alive && k && setKey(k));
    }, delay);
    const stop = setTimeout(() => alive && (setKey(null), setShown(false)), delay + maxMs);
    return () => {
      alive = false;
      clearTimeout(t);
      clearTimeout(stop);
    };
  }, [active, info?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!key) return null;
  const src = `https://www.youtube-nocookie.com/embed/${key}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3&disablekb=1&fs=0`;
  return (
    <div className={'trailer-layer' + (shown ? ' on' : '')} aria-hidden="true">
      <iframe src={src} title="Trailer" allow="autoplay; encrypted-media" tabIndex={-1} onLoad={() => setTimeout(() => setShown(true), 1400)} />
    </div>
  );
}

// ---------------------------------------------------------------- Cor dominante da capa

const colorCache = new Map<string, string | null>();

/** Cor média "viva" da imagem (canvas 12×12). Só funciona com imagens que liberam CORS (TMDB libera). */
export function dominantColor(url: string): Promise<string | null> {
  if (colorCache.has(url)) return Promise.resolve(colorCache.get(url)!);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 12;
        c.height = 12;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0, 12, 12);
        const d = ctx.getImageData(0, 0, 12, 12).data;
        let r = 0, g = 0, b = 0, w = 0;
        for (let i = 0; i < d.length; i += 4) {
          const max = Math.max(d[i], d[i + 1], d[i + 2]);
          const min = Math.min(d[i], d[i + 1], d[i + 2]);
          const sat = max ? (max - min) / max : 0;
          const k = 0.2 + sat * (max / 255); // pixels vivos pesam mais
          r += d[i] * k;
          g += d[i + 1] * k;
          b += d[i + 2] * k;
          w += k;
        }
        const hex = '#' + [r, g, b].map((x) => Math.round(Math.min(255, (x / w) * 1.15)).toString(16).padStart(2, '0')).join('');
        colorCache.set(url, hex);
        resolve(hex);
      } catch {
        colorCache.set(url, null);
        resolve(null);
      }
    };
    img.onerror = () => {
      colorCache.set(url, null);
      resolve(null);
    };
    img.src = url;
  });
}

export function useDominantColor(url: string | undefined, fallback: string): string {
  const [c, setC] = useState(fallback);
  useEffect(() => {
    setC(fallback);
    if (!url || isLite()) return;
    let alive = true;
    dominantColor(url).then((x) => alive && x && setC(x));
    return () => {
      alive = false;
    };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps
  return c;
}

// ---------------------------------------------------------------- Capa que se expande no foco

/** Capa de carrossel: parado ~2 s nela, abre um card largo com arte, logo, ano, nota, selos e sinopse. */
export function PosterTile({ item, w, rank, onPick }: { item: Channel; w: number; rank?: number; onPick: (c: Channel) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const timer = useRef<number>();
  const [peek, setPeek] = useState<'r' | 'l' | null>(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onFocus = () => {
    setPreview(item);
    clearTimeout(timer.current);
    if (isLite() || isMobile() || !document.documentElement.classList.contains('kbd')) return;
    timer.current = window.setTimeout(() => {
      const b = ref.current;
      if (!b || document.activeElement !== b) return;
      let view: HTMLElement | null = b.parentElement;
      while (view && !view.classList.contains('carousel-view')) view = view.parentElement;
      const r = b.getBoundingClientRect();
      const vr = view ? view.getBoundingClientRect() : { right: window.innerWidth };
      setPeek(r.left + r.width * 2.4 < vr.right ? 'r' : 'l');
    }, 1800);
  };
  const posterW = rank ? Math.round(w * 0.7) : w;
  return (
    <button
      ref={ref}
      className={'tile grow ptile' + (peek ? ' peeking' : '')}
      data-nav=""
      style={{ width: w }}
      onFocus={onFocus}
      onBlur={() => {
        clearTimeout(timer.current);
        setPeek(null);
      }}
      onClick={() => onPick(item)}
      aria-label={(rank ? `${rank}º ` : '') + item.name}
    >
      {rank ? <RankedCard rank={rank} w={w}>{(pw) => <PosterCard item={item} w={pw} />}</RankedCard> : <PosterCard item={item} w={w} />}
      {peek && <Peek item={item} posterW={posterW} offset={rank ? w - posterW : 0} dir={peek} />}
    </button>
  );
}

function Peek({ item, posterW, offset, dir }: { item: Channel; posterW: number; offset: number; dir: 'r' | 'l' }) {
  const tm = useTmdb(item);
  const h = Math.round(posterW * 1.5);
  const width = Math.round(posterW * 2.35);
  const img = tm?.backdrop || tm?.poster || item.logo;
  const tint = useDominantColor(tm?.poster, colorFor(item.group || item.name));
  const rating = tm?.rating ?? item.rating;
  return (
    <span
      className={'peek ' + dir}
      style={{ width, height: h, ...(dir === 'r' ? { left: offset } : { right: 0 }), boxShadow: `0 24px 60px rgba(0,0,0,0.7), 0 0 0 3px #f4f4f8, 0 0 60px ${rgba(tint, 0.35)}` }}
    >
      {img && <img src={img} alt="" referrerPolicy="no-referrer" />}
      <span className="peek-shade" style={{ background: `linear-gradient(to top, rgba(8,8,12,0.96) 0%, rgba(8,8,12,0.75) 45%, ${rgba(tint, 0.15)} 100%)` }} />
      <span className="peek-txt">
        <TitleLogo info={tm} name={item.name} height={Math.round(h * 0.2)} maxW={Math.round(width * 0.6)} />
        <b className="caps peek-name">{item.name}</b>
        <span className="peek-meta">
          {[tm?.year ?? item.year, rating ? `★ ${rating.toFixed(1).replace('.', ',')}` : null, item.kind === 'series' ? 'Série' : 'Filme'].filter(Boolean).join('  ·  ')}
          {badgesOf(item).map((b) => (
            <span key={b.t} className={'pbadge ' + b.k}>{b.t}</span>
          ))}
        </span>
        {tm?.overview && <span className="peek-plot">{tm.overview}</span>}
        <span className="peek-hint">OK para ver detalhes</span>
      </span>
    </span>
  );
}

// ---------------------------------------------------------------- Cartões de gênero

export function GenreCard({ title, items, w, onClick }: { title: string; items: Channel[]; w: number; onClick: () => void }) {
  const c = colorFor(title);
  const h = Math.round(w * 0.62);
  const pw = Math.round(h * 0.58);
  return (
    <button className="tile grow genre-card" data-nav="" style={{ width: w }} onClick={onClick} aria-label={title}>
      <span className="genre-art" style={{ height: h, background: `radial-gradient(ellipse 80% 90% at 85% 20%, ${rgba(c, 0.85)} 0%, ${rgba(c, 0.25)} 55%, #12121a 100%)` }}>
        {items.slice(0, 3).map((it, i) => (
          <span key={it.id} className={'genre-p p' + i} style={{ width: pw, height: Math.round(pw * 1.5), right: 14 + (2 - i) * Math.round(pw * 0.42) }}>
            <PosterCard item={it} w={pw} />
          </span>
        ))}
        <span className="genre-name">{title.replace(/^Top 10\s+/, '')}</span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- Estados vazios ilustrados

const EMPTY_ART: Record<string, React.ReactNode> = {
  list: (
    <g>
      <rect x="22" y="26" width="56" height="56" rx="10" fill="#fff" opacity="0.18" />
      <path d="M38 22h24v46l-12-9-12 9z" fill="#fff" opacity="0.9" />
    </g>
  ),
  search: (
    <g fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round">
      <circle cx="44" cy="44" r="20" opacity="0.9" />
      <path d="M59 59l17 17" opacity="0.9" />
    </g>
  ),
  games: (
    <g>
      <circle cx="50" cy="50" r="26" fill="#fff" opacity="0.9" />
      <polygon points="50,36 62,45 57,59 43,59 38,45" fill="#0B0B12" opacity="0.55" />
    </g>
  ),
  empty: (
    <g>
      <polygon points="30,30 30,74 64,52" fill="#fff" opacity="0.9" />
      <polygon points="44,30 44,74 78,52" fill="#fff" opacity="0.35" />
    </g>
  ),
};

/** Estado vazio com ilustração, título, texto e uma ação sugerida. */
export function EmptyState({ kind, title, text, action }: { kind: 'list' | 'search' | 'games' | 'empty'; title: string; text?: string; action?: { label: string; onClick: () => void } }) {
  const c = kind === 'games' ? '#1F8A5B' : kind === 'search' ? '#2B5BD7' : kind === 'list' ? '#C8264B' : '#7A2E9C';
  return (
    <div className="empty-state">
      <svg width="120" height="120" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id={'es-' + kind} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={c} />
            <stop offset="1" stopColor="#0B0B12" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="28" fill={`url(#es-${kind})`} />
        {EMPTY_ART[kind]}
      </svg>
      <span className="title es-title">{title}</span>
      {text && <span className="muted es-text">{text}</span>}
      {action && (
        <button className="btn primary" data-nav="" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Avisos (toast) e confete

type Toast = { id: number; text: string; icon?: string };
let toasts: Toast[] = [];
const toastSubs = new Set<() => void>();
let confettiOn = 0;

export function toast(text: string, icon = '✓'): void {
  const t = { id: Date.now() + Math.random(), text, icon };
  toasts = [...toasts, t].slice(-3);
  toastSubs.forEach((f) => f());
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    toastSubs.forEach((f) => f());
  }, 2600);
}

export function celebrate(text?: string): void {
  confettiOn = Date.now();
  toastSubs.forEach((f) => f());
  if (text) toast(text, '🎉');
  setTimeout(() => toastSubs.forEach((f) => f()), 2700);
}

/** Avisos e confete (montado uma vez no App). */
export function Toasts() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((x) => x + 1);
    toastSubs.add(f);
    return () => {
      toastSubs.delete(f);
    };
  }, []);
  const party = Date.now() - confettiOn < 2600 && !isLite();
  return (
    <>
      <div className="ptoasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="ptoast">
            <span className="ptoast-ic">{t.icon}</span>
            {t.text}
          </div>
        ))}
      </div>
      {party && (
        <div className="confetti" aria-hidden="true">
          {Array.from({ length: 36 }, (_, i) => (
            <i key={i} style={{ left: `${(i * 37) % 100}%`, background: ['#FF6B3D', '#F5B83D', '#3DD6C4', '#F4F4F8', '#A020F0'][i % 5], animationDelay: `${(i % 9) * 0.08}s`, animationDuration: `${1.6 + (i % 5) * 0.2}s` }} />
          ))}
        </div>
      )}
    </>
  );
}

/** Anima o ícone (ex.: estrela de favorito) com um "pulo" e brilho. */
export function pop(el: EventTarget | null): void {
  const e = el as HTMLElement | null;
  if (!e || !e.classList) return;
  e.classList.remove('pop');
  void e.offsetWidth;
  e.classList.add('pop');
  setTimeout(() => e.classList.remove('pop'), 700);
}

// ---------------------------------------------------------------- Abertura animada

/** Símbolo do PRISMA montando-se (três "plays") com um brilho; ~1,4 s, uma vez por abertura. */
export function Splash() {
  const [phase, setPhase] = useState<'on' | 'out' | 'off'>(isLite() ? 'off' : 'on');
  useEffect(() => {
    if (phase === 'off') return;
    const a = setTimeout(() => setPhase('out'), 1400);
    const b = setTimeout(() => setPhase('off'), 1900);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (phase === 'off') return null;
  return (
    <div className={'splash' + (phase === 'out' ? ' out' : '')} aria-hidden="true">
      <div className="splash-in">
        <svg width="180" height="154" viewBox="0 0 140 120" style={{ isolation: 'isolate' }}>
          <polygon className="sp1" points="20,20 20,100 88,60" fill="#FF6B3D" />
          <polygon className="sp2" points="38,20 38,100 106,60" fill="#F5B83D" style={{ mixBlendMode: 'screen' }} />
          <polygon className="sp3" points="56,20 56,100 124,60" fill="#3DD6C4" style={{ mixBlendMode: 'screen' }} />
        </svg>
        <span className="splash-name">PRISMA</span>
        <span className="splash-shine" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Menu que reage à rolagem

let homeScrolled = false;
const scrollSubs = new Set<() => void>();
export function setHomeScrolled(v: boolean): void {
  if (v === homeScrolled) return;
  homeScrolled = v;
  scrollSubs.forEach((f) => f());
}
export function useHomeScrolled(): boolean {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((x) => x + 1);
    scrollSubs.add(f);
    return () => {
      scrollSubs.delete(f);
    };
  }, []);
  return homeScrolled;
}

// ---------------------------------------------------------------- Coleções e sagas

/** Card largo da coleção: arte, nome, quantos filmes estão na lista e as capas em fila. */
export function CollectionCard({ title, backdrop, items, w, onClick }: { title: string; backdrop?: string; items: Channel[]; w: number; onClick: () => void }) {
  const h = Math.round((w * 9) / 16);
  const [ok, setOk] = useState(false);
  const c = colorFor(title);
  const pw = Math.round(h * 0.34);
  return (
    <button className="tile grow coll-card" data-nav="" style={{ width: w }} onClick={onClick} aria-label={`Coleção ${title}`}>
      <span className="coll-art" style={{ height: h, background: `linear-gradient(150deg, ${rgba(c, 0.6)} 0%, #12121a 85%)` }}>
        {backdrop && <img className={'fade-img' + (ok ? ' in' : '')} src={backdrop} alt="" loading="lazy" referrerPolicy="no-referrer" onLoad={() => setOk(true)} />}
        <span className="coll-shade" />
        <span className="coll-posters">
          {items.slice(0, 4).map((it) => (
            <span key={it.id} className="coll-p" style={{ width: pw }}>
              <PosterCard item={it} w={pw} />
            </span>
          ))}
        </span>
        <span className="coll-txt">
          <span className="coll-kicker">Coleção</span>
          <b>{title}</b>
          <span>{items.length} filmes na sua lista</span>
        </span>
      </span>
    </button>
  );
}
