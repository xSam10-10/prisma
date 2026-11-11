import { useEffect, useRef, useState } from 'react';
import type { Channel } from '../core/types';
import { getProgress, inMyList, logoUrl, toggleMyList, type Streaming } from '../core/vod';
import { logoOf, type TmdbInfo } from '../core/tmdb';
import { useLayout } from '../ui/layout';
import { colorFor, rgba } from '../ui/bits';
import { useTmdb } from '../ui/useTmdb';
import { badgesOf, setPreview } from '../ui/premium';
import { pop, toast } from '../ui/premium2';
import type { StreamStyle } from '../ui/streamStyle';

// Modo Marcante (0.28.0): destaque grande no topo do streaming (arte, logo do
// título, meta no estilo da marca, sinopse e botões da marca) e a capa deitada
// (16:9) das fileiras dos streamings que usam esse formato.

const isLite = () => document.documentElement.classList.contains('lite');

/** Logo do título (TMDB) ou o nome por escrito, na fonte da marca. */
function TitleArt({ info, name, height, maxW, textSize, className }: { info: TmdbInfo | null; name: string; height: number; maxW: number; textSize: number; className?: string }) {
  const [logo, setLogo] = useState<string | undefined>();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    setLogo(undefined);
    setOk(false);
    if (!info) return;
    let alive = true;
    logoOf(info).then((l) => alive && setLogo(l), () => undefined);
    return () => {
      alive = false;
    };
  }, [info?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span className={'sbh-tart ' + (className ?? '')} style={{ minHeight: logo && ok ? height : undefined }}>
      {logo && <img src={logo} alt={name} style={{ maxHeight: height, maxWidth: maxW, display: ok ? 'block' : 'none' }} onLoad={() => setOk(true)} onError={() => setLogo(undefined)} referrerPolicy="no-referrer" />}
      {!(logo && ok) && <span className="sbh-title" style={{ fontSize: textSize }}>{name}</span>}
    </span>
  );
}

/** Arte larga do título: fundo do TMDB (w1280) ou a capa da lista. */
function wideArt(tm: ReturnType<typeof useTmdb>, item: Channel, size = 'w780'): string | undefined {
  if (tm?.backdrop) return tm.backdrop.replace(/\/w\d+\//, `/${size}/`);
  return tm?.poster || item.logo || undefined;
}

export function StreamHero({ s, sty, items, kindLabel, compact, onPlay, onInfo }: {
  s: Streaming;
  sty: StreamStyle;
  /** Títulos em destaque (o 1º do Top 10 do streaming e os seguintes); gira a cada 10 s. */
  items: Channel[];
  kindLabel: string;
  compact?: boolean;
  onPlay: (item: Channel, pos?: number) => void;
  onInfo: (item: Channel) => void;
}) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const [i, setI] = useState(0);
  const [, bump] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const item = items[Math.min(i, items.length - 1)];
  const tm = useTmdb(item);
  useEffect(() => setI(0), [s.id]);
  // Gira os destaques (fora da TV antiga e quando o foco não está nos botões).
  useEffect(() => {
    if (items.length < 2 || isLite()) return;
    const t = setInterval(() => {
      if (box.current && box.current.contains(document.activeElement)) return;
      setI((x) => (x + 1) % Math.min(items.length, 5));
    }, 10000);
    return () => clearInterval(t);
  }, [items.length, s.id]);
  if (!item) return null;
  const art = wideArt(tm, item, mobile ? 'w780' : 'w1280');
  const kind = item.kind === 'series' ? 'série' : 'filme';
  const rating = tm?.rating ?? item.rating;
  const year = tm?.year ?? item.year;
  const lead = sty.metaLead?.(rating);
  const prog = getProgress(item.id);
  const mine = inMyList(item.id);
  const tint = colorFor(item.group || item.name);
  const playIt = () => (item.kind === 'series' ? onInfo(item) : onPlay(item, prog?.pos));
  if (compact) {
    return (
      <div className="sbh compact" style={{ background: s.bg }}>
        {art && <img className="sbh-art" src={art} alt="" referrerPolicy="no-referrer" />}
        <div className="sbh-shade" style={{ background: `linear-gradient(90deg, ${s.bg} 0%, ${rgba(s.bg, 0.92)} 45%, ${rgba(s.bg, 0.4)} 100%)` }} />
        <div className="sbh-row">
          {s.logo && <img className="sbh-slogo" src={logoUrl(s.id, 'color')} alt={s.name} style={{ height: mobile ? 20 : 28 }} />}
          <span className="sbh-title sm">{item.name}</span>
        </div>
      </div>
    );
  }
  return (
    <div ref={box} className="sbh" style={{ background: s.bg }}>
      {art ? <img key={art} className="sbh-art in" src={art} alt="" referrerPolicy="no-referrer" /> : <div className="sbh-art" style={{ background: `linear-gradient(120deg, ${rgba(tint, 0.6)}, ${s.bg})` }} />}
      <div
        className="sbh-shade"
        style={{ background: `linear-gradient(90deg, ${s.bg} 0%, ${rgba(s.bg, 0.86)} 32%, ${rgba(s.bg, 0.15)} 68%, ${rgba(s.bg, 0)} 100%), linear-gradient(0deg, ${s.bg} 0%, ${rgba(s.bg, 0)} 38%)` }}
      />
      <div className="sbh-txt" style={{ padding: mobile ? '0 18px 14px' : '0 40px 26px', maxWidth: mobile ? '100%' : '58%' }}>
        <span className="sbh-top">
          {s.logo && <img className="sbh-slogo" src={logoUrl(s.id, 'color')} alt={s.name} style={{ height: mobile ? 16 : 22 }} />}
          <span className="sbh-kick" style={{ color: s.id === 'netflix' ? s.accent : undefined }}>{sty.kicker(kind)}</span>
        </span>
        <TitleArt info={tm} name={item.name} height={mobile ? 48 : 92} maxW={mobile ? 220 : 460} textSize={mobile ? 28 : 54} />
        <span className="sbh-meta">
          {lead && <b className="sbh-lead">{lead}</b>}
          {year ? <span>{year}</span> : null}
          {rating && !lead ? <span>★ {rating.toFixed(1).replace('.', ',')}</span> : null}
          <span>{item.kind === 'series' ? 'Série' : 'Filme'}</span>
          {badgesOf(item).map((b) => (
            <em key={b.t}>{b.t}</em>
          ))}
        </span>
        {!mobile && tm?.overview && <span className="sbh-plot">{tm.overview}</span>}
        <span className="sbh-btns">
          <button className="sbh-btn play" data-nav="" style={{ background: sty.playBg, color: sty.playFg, borderRadius: sty.btnRadius }} onFocus={() => setPreview(item)} onClick={playIt}>
            ▶ {prog && item.kind !== 'series' ? 'Continuar' : sty.play}
          </button>
          <button className="sbh-btn" data-nav="" style={{ borderRadius: sty.btnRadius }} onClick={() => onInfo(item)}>
            {sty.iconList ? 'ⓘ' : 'ⓘ ' + sty.more}
          </button>
          <button
            className={'sbh-btn' + (sty.iconList ? ' icon' : '')}
            data-nav=""
            style={{ borderRadius: sty.iconList ? 999 : sty.btnRadius }}
            onClick={(e) => {
              const on = toggleMyList(item);
              pop(e.currentTarget);
              toast(on ? 'Adicionado à Minha lista' : 'Tirado da Minha lista', on ? '＋' : '✕');
              bump((x) => x + 1);
            }}
          >
            {mine ? '✓' : ''} {sty.iconList ? (mine ? '' : '＋') : sty.list}
          </button>
        </span>
      </div>
      {items.length > 1 && !mobile && (
        <span className="sbh-dots" aria-hidden="true">
          {items.slice(0, 5).map((x, k) => (
            <i key={x.id} className={k === i ? 'on' : ''} style={k === i ? { background: s.id === 'netflix' ? s.accent : '#fff' } : undefined} />
          ))}
        </span>
      )}
      <span className="sbh-count">{kindLabel}</span>
    </div>
  );
}

/** Capa deitada (16:9) com a arte do título, logo/nome e progresso — Disney+, Max, Prime, Apple TV… */
export function WideTile({ item, w, onPick }: { item: Channel; w: number; onPick: (c: Channel) => void }) {
  const tm = useTmdb(item);
  const [ok, setOk] = useState(false);
  const art = wideArt(tm, item);
  useEffect(() => setOk(false), [art]);
  const p = getProgress(item.id);
  const h = Math.round((w * 9) / 16);
  const badge = badgesOf(item).find((b) => b.k === 'new' || b.k === 'newep');
  const c = colorFor(item.group || item.name);
  return (
    <button className="tile grow wtile" data-nav="" style={{ width: w }} onFocus={() => setPreview(item)} onClick={() => onPick(item)} aria-label={item.name}>
      <span className="wtile-art" style={{ height: h, background: `linear-gradient(150deg, ${rgba(c, 0.55)} 0%, #12121a 100%)` }}>
        {art && <img className={'fade-img' + (ok ? ' in' : '') + (tm?.backdrop ? '' : ' wtile-poster')} src={art} alt="" loading="lazy" referrerPolicy="no-referrer" onLoad={() => setOk(true)} />}
        <span className="wtile-shade" />
        <span className="wtile-name">
          <TitleArt info={tm} name={item.name} height={Math.round(h * 0.3)} maxW={Math.round(w * 0.62)} textSize={Math.max(14, Math.round(w / 14))} className="wt" />
        </span>
        {badge && <span className="wbadge">{badge.t}</span>}
        {p && p.dur ? <span className="wtile-prog"><span style={{ width: `${(p.pos / p.dur) * 100}%` }} /></span> : null}
      </span>
      <span className="poster-title caps">{item.name}</span>
    </button>
  );
}

