import { useEffect, useRef, useState } from 'react';
import type { Channel } from '../core/types';
import { Engine } from '../core/engine';
import { getProgress } from '../core/vod';
import type { Upcoming } from '../core/tops';
import { colorFor, rgba } from './bits';
import { useTmdb } from './useTmdb';
import { pushBack, focusFirst } from './nav';
import { TitleLogo } from './premium';
import { useLayout } from './layout';

// Visual premium, parte 3 (0.22.0): abertura "Continuar de onde parou",
// vídeo do canal dentro do card, card de estreia e saudação por horário.

const isLite = () => document.documentElement.classList.contains('lite');
const isMobile = () => document.documentElement.classList.contains('mobile');

// ---------------------------------------------------------------- Horário do dia

export type DayPart = 'manha' | 'tarde' | 'noite' | 'madrugada';

export function dayPart(now = new Date()): DayPart {
  const h = now.getHours();
  return h >= 5 && h < 12 ? 'manha' : h >= 12 && h < 18 ? 'tarde' : h >= 18 ? 'noite' : 'madrugada';
}

export const DAYPART: Record<DayPart, { hi: string; sub: string; color: string }> = {
  manha: { hi: 'Bom dia', sub: 'Notícias, desenhos e o que está passando agora', color: '#F5B83D' },
  tarde: { hi: 'Boa tarde', sub: 'Filmes, novelas e as séries em andamento', color: '#3DD6C4' },
  noite: { hi: 'Boa noite', sub: 'Jogos, lançamentos e o melhor da programação', color: '#7A2E9C' },
  madrugada: { hi: 'Boa madrugada', sub: 'Filmes e séries para maratonar', color: '#2B5BD7' },
};

// ---------------------------------------------------------------- Abertura "Continuar de onde parou"

let resumeShown = false;
/** Mostra a abertura só uma vez por vez que o app é aberto. */
export function takeResumeOnce(): boolean {
  if (resumeShown) return false;
  resumeShown = true;
  return true;
}

/** Tela cheia ao abrir o app: arte do filme/série em andamento, logo, progresso e "Continuar de onde parou". */
export function ResumeOpen({ item, onPlay, onClose }: { item: Channel; onPlay: () => void; onClose: () => void }) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const box = useRef<HTMLDivElement>(null);
  const base = item.seriesId ? { ...item, name: item.group, kind: 'series' as const, fullName: undefined } : item;
  const tm = useTmdb(base);
  const p = getProgress(item.id);
  const ep = item.seriesId ? item.name.split(' · ').slice(1).join(' · ') : '';
  const [ok, setOk] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => focusFirst(box.current));
    return pushBack(() => {
      onClose();
      return true;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const left = p && p.dur ? Math.max(1, Math.round((p.dur - p.pos) / 60)) : 0;
  return (
    <div className="resume-open screen-in" data-nav-scope="" ref={box}>
      {tm?.backdrop && <img className={'resume-bg fade-img' + (ok ? ' in' : '')} src={tm.backdrop} alt="" referrerPolicy="no-referrer" onLoad={() => setOk(true)} />}
      <div className="resume-shade" style={{ background: `radial-gradient(ellipse 70% 80% at 20% 80%, ${rgba(colorFor(base.name), 0.3)} 0%, rgba(0,0,0,0) 70%)` }} />
      <div className="resume-txt" style={{ left: L.px, right: mobile ? L.px : undefined, bottom: mobile ? 60 : 110, maxWidth: mobile ? undefined : Math.round(L.W * 0.5) }}>
        <span className="paused-tag">Continuar assistindo</span>
        <TitleLogo info={tm} name={base.name} height={mobile ? 70 : 130} maxW={mobile ? 300 : 620} />
        <span className="title caps resume-title">{base.name}</span>
        {ep && <span className="paused-ep">{ep}</span>}
        {p && p.dur ? (
          <div className="resume-prog">
            <span className="resume-bar"><span style={{ width: `${(p.pos / p.dur) * 100}%` }} /></span>
            <span>{left >= 60 ? `faltam ${Math.floor(left / 60)} h ${left % 60} min` : `faltam ${left} min`}</span>
          </div>
        ) : null}
        <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap', marginTop: 8 }}>
          <button className="btn primary resume-btn" data-nav="" data-nav-default="" onClick={onPlay}>▶ Continuar de onde parou</button>
          <button className="btn" data-nav="" onClick={onClose}>Ir para o Início</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Vídeo do canal dentro do card

/** Vídeo do canal sem som, dentro do card (usa 1 conexão da assinatura enquanto o card está em foco). */
export function LivePeek({ ch }: { ch: Channel }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    const eng = new Engine(v, (e) => {
      if (e.type === 'playing') setOn(true);
    });
    try {
      eng.play(ch.url, ch);
    } catch {
      /* sem vídeo: fica o card normal */
    }
    return () => eng.destroy();
  }, [ch.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span className={'live-peek' + (on ? ' on' : '')} aria-hidden="true">
      <video ref={ref} muted playsInline />
      <span className="live-peek-tag">● AO VIVO</span>
    </span>
  );
}

/** Liga a prévia depois de ~2 s parado no card (não na TV de 2017 nem no celular). */
export function useLivePeek(): { peek: boolean; onFocus: () => void; onBlur: () => void } {
  const [peek, setPeek] = useState(false);
  const t = useRef<number>();
  useEffect(() => () => clearTimeout(t.current), []);
  return {
    peek,
    onFocus: () => {
      clearTimeout(t.current);
      if (isLite() || isMobile() || !document.documentElement.classList.contains('kbd')) return;
      t.current = window.setTimeout(() => setPeek(true), 2000);
    },
    onBlur: () => {
      clearTimeout(t.current);
      setPeek(false);
    },
  };
}

// ---------------------------------------------------------------- Chegando esta semana

const WD = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

/** Card de estreia: data grande, pôster, título e se já está na lista. */
export function UpcomingCard({ u, w, onClick }: { u: Upcoming; w: number; onClick: () => void }) {
  const d = new Date(u.date);
  const today = new Date();
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
  const when = diff === 0 ? 'HOJE' : diff === 1 ? 'AMANHÃ' : diff < 0 ? 'JÁ SAIU' : WD[d.getDay()];
  const ph = Math.round(w * 0.62);
  const c = colorFor(u.title);
  return (
    <button className="tile grow up-card" data-nav="" style={{ width: w }} onClick={onClick} aria-label={`${u.title}, ${d.toLocaleDateString('pt-BR')}`}>
      <span className="up-art" style={{ background: `linear-gradient(160deg, ${rgba(c, 0.5)} 0%, #12121a 90%)` }}>
        <span className="up-date">
          <b>{when}</b>
          <span>{String(d.getDate()).padStart(2, '0')}/{String(d.getMonth() + 1).padStart(2, '0')}</span>
        </span>
        {u.poster && <img className="up-poster" src={u.poster} alt="" loading="lazy" referrerPolicy="no-referrer" style={{ width: ph * 0.68, height: ph }} />}
        <span className="up-txt">
          <b>{u.title}</b>
          <span>{u.ep ? u.ep : u.kind === 'tv' ? 'Série' : 'Filme'}</span>
          <span className={'up-tag' + (u.item ? ' in' : '')}>{u.item ? '✓ Na sua lista' : 'Em breve'}</span>
        </span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- Modo cinema

/** Ao começar um filme/episódio: fundo preto e a logo do título por ~1,5 s. */
export function CinemaIntro({ item }: { item: Channel }) {
  const base = item.seriesId ? { ...item, name: item.group, kind: 'series' as const, fullName: undefined } : item;
  const tm = useTmdb(base);
  return (
    <div className="cinema-intro" aria-hidden="true">
      <TitleLogo info={tm} name={base.name} height={140} maxW={680} />
      <span className="title caps cinema-name">{base.name}</span>
    </div>
  );
}

/** Pausado por mais de 5 min: as artes dos seus títulos passando devagar, com o relógio. Qualquer tecla volta. */
export function Screensaver({ items, title, onExit }: { items: Channel[]; title: string; onExit: () => void }) {
  const [imgs, setImgs] = useState<string[]>([]);
  const [i, setI] = useState(0);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    let alive = true;
    import('../core/tmdb').then(({ lookup }) =>
      Promise.all(items.slice(0, 10).map((c) => lookup(c.seriesId ? { ...c, name: c.group, kind: 'series' } : c).catch(() => null))).then((r) => {
        if (!alive) return;
        const list = r.map((x) => x?.backdrop).filter(Boolean) as string[];
        setImgs([...new Set(list)]);
      }),
    );
    const t = setInterval(() => {
      setI((x) => x + 1);
      setNow(new Date());
    }, 9000);
    const c = setInterval(() => setNow(new Date()), 30000);
    return () => {
      alive = false;
      clearInterval(t);
      clearInterval(c);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="saver" onClick={onExit} aria-hidden="true">
      {imgs.map((src, k) => (
        <img key={src} className={'saver-img' + (k === i % Math.max(1, imgs.length) ? ' on' : '') + (k % 2 ? ' alt' : '')} src={src} alt="" referrerPolicy="no-referrer" />
      ))}
      <div className="saver-shade" />
      <div className="saver-clock">
        <b>{now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</b>
        <span>{now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).replace(/^./, (c) => c.toUpperCase())}</span>
      </div>
      <div className="saver-paused">❚❚ Pausado · {title} · aperte qualquer tecla</div>
    </div>
  );
}

// ---------------------------------------------------------------- Créditos finais

/** Perto do fim do filme: a imagem vai para o canto e aparecem "Continuar a coleção" e "Semelhantes". */
export function EndCredits({ item, items, next, onPlay, onDismiss }: { item: Channel; items: Channel[]; next?: Channel; onPlay: (c: Channel) => void; onDismiss: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const tm = useTmdb(item);
  const [similar, setSimilar] = useState<Channel[]>([]);
  useEffect(() => {
    requestAnimationFrame(() => focusFirst(box.current));
  }, []);
  useEffect(() => {
    if (!tm) return;
    let alive = true;
    Promise.all([import('../core/tmdb'), import('../core/tops')]).then(([t, tops]) =>
      t.similarOf(tm).then((r) => {
        if (!alive) return;
        const out: Channel[] = [];
        for (const x of r) {
          const hit = tops.findInList({ t: x.title, o: x.original, y: x.year }, tm.type, items);
          if (hit && hit.id !== item.id && hit.id !== next?.id && !out.some((o) => o.id === hit.id)) out.push(hit);
          if (out.length >= 5) break;
        }
        setSimilar(out);
      }),
    );
    return () => {
      alive = false;
    };
  }, [tm?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="credits-panel" ref={box}>
      <span className="paused-tag">Créditos finais</span>
      <span className="title credits-h">E agora?</span>
      {next && (
        <button className="credits-next" data-nav="" data-nav-default="" onClick={() => onPlay(next)}>
          <CreditPoster item={next} w={120} />
          <span className="credits-next-txt">
            <span className="paused-tag" style={{ color: '#3DD6C4' }}>Continuar a coleção</span>
            <b className="caps">{next.name}</b>
            <span>▶ Assistir agora</span>
          </span>
        </button>
      )}
      {similar.length > 0 && (
        <>
          <span className="credits-sub">Semelhantes na sua lista</span>
          <div className="credits-row" data-nav-row="">
            {similar.map((c) => (
              <button key={c.id} className="credits-sim" data-nav="" onClick={() => onPlay(c)} aria-label={c.name}>
                <CreditPoster item={c} w={96} />
              </button>
            ))}
          </div>
        </>
      )}
      <button className="btn" data-nav="" data-nav-default={next ? undefined : ''} style={{ marginTop: 18, alignSelf: 'flex-start' }} onClick={onDismiss}>
        Voltar ao filme
      </button>
    </div>
  );
}

function CreditPoster({ item, w }: { item: Channel; w: number }) {
  const tm = useTmdb(item);
  const img = tm?.poster || item.logo;
  const c = colorFor(item.name);
  return (
    <span className="credit-poster" style={{ width: w, height: Math.round(w * 1.5), background: `linear-gradient(160deg, ${rgba(c, 0.6)}, #12121a)` }}>
      {img ? <img src={img} alt="" referrerPolicy="no-referrer" /> : <span>{item.name}</span>}
    </span>
  );
}

// ---------------------------------------------------------------- Miniatura da barra de tempo

/** Cena do filme (TMDB) acima da barra de tempo, na posição atual. */
export function SeekThumb({ scenes, frac }: { scenes: string[]; frac: number }) {
  if (!scenes.length) return null;
  const k = Math.min(scenes.length - 1, Math.max(0, Math.floor(frac * scenes.length)));
  return (
    <span className="seek-thumb" style={{ left: `${Math.max(6, Math.min(94, frac * 100))}%` }} aria-hidden="true">
      <img src={scenes[k]} alt="" referrerPolicy="no-referrer" />
    </span>
  );
}
