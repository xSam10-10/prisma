import { useEffect, useState } from 'react';
import type { Channel } from '../core/types';
import { getProgress } from '../core/vod';
import { logoOf, type TmdbInfo } from '../core/tmdb';
import { newEpisodeOf } from '../core/newEpisodes';
import { colorFor, rgba } from './bits';
import { useTmdb } from './useTmdb';
import { useLayout } from './layout';
import { revealSection } from './Carousel';
import { TrailerLayer, useDominantColor } from './premium2';

// Peças do visual "premium" (0.20.0): fundo que acompanha a capa em foco,
// selos, número do ranking atrás da capa, cards horizontais, destaque da
// semana e esqueletos de carregamento. Tudo sem variáveis CSS nem grid
// (TV LG de 2017); animações desligadas na LG pela classe "lite".

// ---------------------------------------------------------------- Prévia (fundo que acompanha o foco)

let previewItem: Channel | null = null;
let previewTimer: number | undefined;
const previewSubs = new Set<() => void>();

/** Capa em foco: depois de ~0,6 s parado nela, o fundo da tela troca para a arte dela. */
export function setPreview(item: Channel | null, delay = 600): void {
  clearTimeout(previewTimer);
  previewTimer = window.setTimeout(() => {
    if (previewItem?.id === item?.id) return;
    previewItem = item;
    previewSubs.forEach((f) => f());
  }, delay);
}

function usePreviewItem(): Channel | null {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((x) => x + 1);
    previewSubs.add(f);
    return () => {
      previewSubs.delete(f);
    };
  }, []);
  return previewItem;
}

/**
 * Fundo da tela com a arte larga (TMDB) do título em foco, esmaecendo para a
 * esquerda e para baixo; sem arte, um brilho na cor do título. Troca com fade.
 */
export function PreviewBackdrop({ strength = 0.42 }: { strength?: number }) {
  const item = usePreviewItem();
  useEffect(() => () => setPreview(null, 0), []);
  const tm = useTmdb(item);
  const img = tm?.backdrop;
  // Duas camadas: a nova aparece por cima e a antiga some (fade cruzado).
  const [layers, setLayers] = useState<{ a?: string; b?: string; top: 'a' | 'b' }>({ top: 'a' });
  useEffect(() => {
    if (!img) return;
    setLayers((l) => (l.top === 'a' ? (l.a === img ? l : { ...l, b: img, top: 'b' }) : l.b === img ? l : { ...l, a: img, top: 'a' }));
  }, [img]);
  // Cor do título: a dominante do pôster (quando a imagem libera) ou a cor calculada pelo nome.
  const glow = useDominantColor(tm?.poster, item ? colorFor(item.name) : '#3DD6C4');
  return (
    <div className="pv-wrap" aria-hidden="true">
      <div className="pv-glow" style={{ background: `radial-gradient(ellipse 55% 60% at 80% 18%, ${rgba(glow, item ? 0.32 : 0)} 0%, rgba(0,0,0,0) 70%), radial-gradient(ellipse 50% 50% at 10% 100%, ${rgba(glow, item ? 0.14 : 0)} 0%, rgba(0,0,0,0) 70%)` }} />
      {(['a', 'b'] as const).map((k) =>
        layers[k] ? (
          <img
            key={k}
            className={'pv-img' + (layers.top === k && img ? ' on' : '')}
            src={layers[k]}
            alt=""
            referrerPolicy="no-referrer"
            style={{ opacity: layers.top === k && img ? strength : 0 }}
          />
        ) : null,
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Selos

const WEEK = 7 * 86400000;

/** Selos da capa: 4K, DUB, LEG, NOVO (entrou na lista nos últimos 7 dias). */
export function badgesOf(item: Channel, now = Date.now()): { t: string; k: string }[] {
  const s = `${item.fullName ?? item.name} ${item.group}`;
  const out: { t: string; k: string }[] = [];
  if (item.kind === 'series' && newEpisodeOf(item.seriesId ?? item.id)) out.push({ t: 'NOVO EP.', k: 'newep' });
  else if (item.added && now - item.added < WEEK) out.push({ t: 'NOVO', k: 'new' });
  if (/\b(4k|uhd|2160p?)\b/i.test(s)) out.push({ t: '4K', k: 'q' });
  if (/\b(leg|legendad[oa]s?|sub)\b/i.test(s)) out.push({ t: 'LEG', k: 'l' });
  else if (/\b(dub|dublad[oa]s?|dual)\b/i.test(s)) out.push({ t: 'DUB', k: 'l' });
  return out.slice(0, 2);
}

// ---------------------------------------------------------------- Ranking (número atrás da capa)

/** Card do Top 10: número grande com contorno, por trás e à esquerda da capa. */
export function RankedCard({ rank, w, children }: { rank: number; w: number; children: (posterW: number) => React.ReactNode }) {
  const posterW = Math.round(w * 0.7);
  const h = Math.round(posterW * 1.5);
  const two = rank >= 10;
  return (
    <div className="rk" style={{ width: w, paddingLeft: w - posterW }}>
      <span className={'rk-num' + (two ? ' two' : '')} style={{ fontSize: Math.round(h * (two ? 0.62 : 0.78)), height: h, lineHeight: `${h}px` }} aria-hidden="true">
        {rank}
      </span>
      <div className="rk-poster">{children(posterW)}</div>
    </div>
  );
}

// ---------------------------------------------------------------- Cards horizontais

function fmtLeft(sec: number): string {
  const m = Math.max(1, Math.round(sec / 60));
  return m >= 60 ? `faltam ${Math.floor(m / 60)} h ${m % 60} min` : `faltam ${m} min`;
}

/** "Continuar assistindo": card 16:9 com a cena (TMDB), título e barra de progresso. */
export function WideCard({ item, w, onClick }: { item: Channel; w: number; onClick: () => void }) {
  const tm = useTmdb(item.seriesId ? { ...item, name: item.group, kind: 'series' } : item);
  const img = tm?.backdrop || item.logo;
  const p = getProgress(item.id);
  const h = Math.round((w * 9) / 16);
  const c = colorFor(item.name);
  const [ok, setOk] = useState(false);
  const ep = item.name.match(/·\s*(T\d+\s*E\d+)/)?.[1];
  const title = (item.seriesId ? item.group : item.name).replace(/\s*\((19|20)\d{2}\)\s*$/, '');
  return (
    <button className="tile grow wide" data-nav="" style={{ width: w }} onClick={onClick} aria-label={item.name}>
      <span className="wide-art" style={{ height: h, background: `linear-gradient(150deg, ${rgba(c, 0.5)} 0%, #15151F 80%)` }}>
        {img && <img className={'fade-img' + (ok ? ' in' : '')} src={img} alt="" loading="lazy" referrerPolicy="no-referrer" onLoad={() => setOk(true)} />}
        <span className="wide-shade" />
        <span className="wide-txt">
          <b className="caps">{title}</b>
          <span>
            {ep ? ep.replace(/\s+/g, ' ') + ' · ' : ''}
            {p && p.dur ? fmtLeft(p.dur - p.pos) : ''}
          </span>
        </span>
        {p && p.dur ? (
          <span className="wide-prog">
            <span style={{ width: `${(p.pos / p.dur) * 100}%` }} />
          </span>
        ) : null}
        <span className="wide-play" aria-hidden="true">▶</span>
      </span>
    </button>
  );
}

/** Logo oficial do título (TMDB) ou o nome em letras grandes. */
export function TitleLogo({ info, name, height, maxW, className }: { info: TmdbInfo | null; name: string; height: number; maxW: number; className?: string }) {
  const [logo, setLogo] = useState<string | undefined>();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    setLogo(undefined);
    setOk(false);
    if (!info) return;
    let alive = true;
    logoOf(info).then((l) => alive && setLogo(l));
    return () => {
      alive = false;
    };
  }, [info?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (logo)
    return (
      <span className={'tlogo ' + (className ?? '')} style={{ height, maxWidth: maxW }}>
        <img src={logo} alt={name} style={{ maxHeight: height, maxWidth: maxW, opacity: ok ? 1 : 0 }} onLoad={() => setOk(true)} onError={() => setLogo(undefined)} referrerPolicy="no-referrer" />
      </span>
    );
  return null;
}

/** Destaque da semana: um card grande e dois médios, com a arte, logo e sinopse. */
export function FeatureRow({ title, items, onOpen }: { title: string; items: Channel[]; onOpen: (c: Channel) => void }) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  if (items.length < 3 || mobile) return null;
  const gap = 22;
  const avail = L.W - L.px * 2;
  const bigW = Math.round(avail * 0.5);
  const smallW = Math.floor((avail - bigW - gap * 2) / 2);
  const h = Math.round((bigW * 9) / 16);
  return (
    <section className="carousel" style={{ marginTop: 30 }}>
      <div className="carousel-head" style={{ padding: `0 ${L.px}px` }}>
        <span className="title" style={{ fontSize: 22 }}>{title}</span>
      </div>
      <div className="feat" data-nav-row="" style={{ margin: `10px ${L.px - 14}px 0`, padding: 14 }}>
        {items.slice(0, 3).map((it, i) => (
          <FeatureCard key={it.id} item={it} w={i === 0 ? bigW : smallW} h={h} big={i === 0} last={i === 2} gap={gap} onClick={() => onOpen(it)} />
        ))}
      </div>
    </section>
  );
}

function FeatureCard({ item, w, h, big, last, gap, onClick }: { item: Channel; w: number; h: number; big: boolean; last: boolean; gap: number; onClick: () => void }) {
  const tm = useTmdb(item);
  const [focused, setFocused] = useState(false);
  const img = big ? tm?.backdrop : tm?.backdrop || tm?.poster;
  const [ok, setOk] = useState(false);
  const c = colorFor(item.name);
  return (
    <button className={'tile grow feat-card' + (big ? ' big' : '')} data-nav="" style={{ width: w, height: h, marginRight: last ? 0 : gap }} onFocus={(e) => { revealSection(e.currentTarget); setFocused(true); }} onBlur={() => setFocused(false)} onClick={onClick} aria-label={item.name}>
      <span className="feat-art" style={{ background: `linear-gradient(150deg, ${rgba(c, 0.55)} 0%, #15151F 85%)` }}>
        {img && <img className={'fade-img' + (ok ? ' in' : '')} src={img} alt="" referrerPolicy="no-referrer" onLoad={() => setOk(true)} />}
        {big && <TrailerLayer info={tm} active={focused} delay={3000} />}
        <span className="feat-shade" />
        <span className="feat-txt">
          {big && <span className="feat-kicker">Destaque da semana</span>}
          <TitleLogo info={tm} name={item.name} height={big ? 74 : 40} maxW={big ? Math.round(w * 0.55) : Math.round(w * 0.8)} />
          <b className="caps feat-name">{item.name}</b>
          <span className="feat-meta">
            {[tm?.year ?? item.year, (tm?.rating ?? item.rating) ? `★ ${(tm?.rating ?? item.rating)!.toFixed(1).replace('.', ',')}` : null, item.kind === 'series' ? 'Série' : 'Filme'].filter(Boolean).join('  ·  ')}
          </span>
          {big && tm?.overview && <span className="feat-plot">{tm.overview}</span>}
        </span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- Esqueletos

/** Fileira "carregando": título e capas cinzas pulsando. */
export function SkeletonRow({ count = 6, poster = true }: { count?: number; poster?: boolean }) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const gap = mobile ? 14 : 22;
  const avail = L.W - L.px * 2;
  const n = mobile ? 3 : count;
  const w = Math.floor((avail - gap * (n - 1)) / n);
  return (
    <section className="carousel skel-row" style={{ marginTop: mobile ? 20 : 30 }} aria-hidden="true">
      <div style={{ padding: `0 ${L.px}px` }}>
        <span className="skel" style={{ width: 240, height: 22, display: 'block', borderRadius: 8 }} />
      </div>
      <div style={{ display: 'flex', padding: `14px ${L.px}px 0` }}>
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className="skel" style={{ width: w, height: poster ? Math.round(w * 1.5) : Math.round((w * 9) / 16), marginRight: i < n - 1 ? gap : 0, borderRadius: 14, flexShrink: 0 }} />
        ))}
      </div>
    </section>
  );
}
