import { T } from '../ui/tokens';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Channel, Playlist } from '../core/types';
import { Ambient, ChannelLogo, ChannelTile, Icon, Symbol, colorFor, fmtTime, initials, rgba, useLogo } from '../ui/bits';
import { progressOf } from '../core/epg';
import { useClock, useEpg } from '../ui/useEpg';
import { VirtualList, type VirtualListHandle } from '../ui/VirtualList';
import { focusFirst } from '../ui/nav';
import { useLayout } from '../ui/layout';
import { Carousel } from '../ui/Carousel';
import { VoiceButton } from '../ui/Voice';

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// ---------------------------------------------------------------- Início
export function Home({
  playlist, live, favs, recents, onWatch, onGoLive,
}: {
  playlist: Playlist;
  live: Channel[];
  favs: Channel[];
  recents: Channel[];
  onWatch: (c: Channel, list: Channel[]) => void;
  onGoLive: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const movies = playlist.items.filter((i) => i.kind === 'movie').length;
  const series = playlist.items.filter((i) => i.kind === 'series').length;
  const last = recents[0];
  const L = useLayout();
  const mobile = L.form === 'mobile';
  useEffect(() => {
    requestAnimationFrame(() => focusFirst(root.current));
  }, []);
  return (
    <div ref={root} className="scroll-y" style={{ position: 'absolute', left: 0, right: 0, top: L.top, bottom: mobile ? L.bottom : 0 }}>
      <Hero playlist={playlist} last={last} live={live} movies={movies} series={series} onPlay={() => last && onWatch(last, recents)} onGoLive={onGoLive} />

      <Shelf title="Favoritos" items={favs} empty="Favorite canais na tela cheia (botão ★) para eles aparecerem aqui." onWatch={(c) => onWatch(c, favs)} />
      <Shelf title="Vistos por último" badgeFor={(_c, i) => (i === 0 ? 'Último' : undefined)} items={recents} empty="Os canais que você assistir aparecem aqui." onWatch={(c) => onWatch(c, recents)} />
    </div>
  );
}

/** Destaque do Início ("Continuar assistindo"): texto + quadro grande com logo (canal) ou capa (filme/série). */
function Hero({ playlist, last, live, movies, series, onPlay, onGoLive }: {
  playlist: Playlist; last?: Channel; live: Channel[]; movies: number; series: number; onPlay: () => void; onGoLive: () => void;
}) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const epg = useEpg(playlist, last, 0);
  const now = useClock();
  const cur = epg?.[0];
  const next = epg?.[1];
  const c = last ? colorFor(last.name) : '#3DD6C4';
  const artW = mobile ? L.W - L.px * 2 : Math.round(Math.min(620, Math.max(420, L.W * 0.36)));
  const isVod = last && last.kind !== 'live';
  const info = (
    <div className="gy-12" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0, maxWidth: 680 }}>
      <span className="badge-live" style={{ alignSelf: 'flex-start', fontSize: mobile ? 12 : 13 }}>{last ? 'Continuar assistindo' : 'Bem-vindo'}</span>
      <span className="title caps" style={{ fontSize: mobile ? 30 : 46, fontWeight: 800, lineHeight: 1.02 }}>{last ? last.name : 'PRISMA'}</span>
      {last ? (
        <span className="muted caps" style={{ fontSize: mobile ? 14 : 16, fontWeight: 600 }}>
          {last.number != null ? `Canal ${last.number} · ` : ''}{last.group}
        </span>
      ) : null}
      {cur ? (
        <div className="gy-6" style={{ display: 'flex', flexDirection: 'column', marginTop: 4 }}>
          <span style={{ fontSize: mobile ? 16 : 19, fontWeight: 700 }}>
            <span style={{ color: T.live }}>Agora · </span>{cur.title}
          </span>
          <div className="progress" style={{ maxWidth: 420 }}><div style={{ width: `${progressOf(cur, now) * 100}%` }} /></div>
          <span className="muted" style={{ fontSize: 14 }}>
            {fmtTime(cur.start)} – {fmtTime(cur.end)}{next ? ` · A seguir: ${next.title}` : ''}
          </span>
        </div>
      ) : (
        <span className="muted" style={{ fontSize: mobile ? 14 : 16 }}>
          {playlist.source.name} · {live.length.toLocaleString('pt-BR')} canais · {movies.toLocaleString('pt-BR')} filmes · {series.toLocaleString('pt-BR')} séries
        </span>
      )}
      <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap', marginTop: 10 }}>
        {last && (
          <button className="btn primary" data-nav="" data-nav-default="" onClick={onPlay}>▶ {isVod ? 'Continuar' : 'Assistir agora'}</button>
        )}
        <button className="btn" data-nav="" data-nav-default={last ? undefined : ''} onClick={onGoLive}>Ver todos os canais</button>
      </div>
    </div>
  );
  const art = last ? (
    <button
      className="hero-art grow"
      data-nav=""
      onClick={onPlay}
      aria-label={`Assistir ${last.name}`}
      style={{
        width: artW,
        height: Math.round((artW * 9) / 16),
        background: `radial-gradient(ellipse 70% 80% at 50% 45%, ${rgba(c, 0.5)} 0%, ${rgba(c, 0.16)} 50%, rgba(0,0,0,0) 78%), linear-gradient(150deg, #2A2A3C 0%, #13131B 100%)`,
      }}
    >
      <HeroImage ch={last} />
      <span className="badge-live" style={{ position: 'absolute', left: 16, top: 16, fontSize: 12 }}>● {isVod ? 'Continuar' : 'Ao vivo'}</span>
      {cur && <span className="hero-bar"><span style={{ width: `${progressOf(cur, now) * 100}%` }} /></span>}
      <span className="hero-play" aria-hidden="true">▶</span>
    </button>
  ) : null;
  return (
    <div style={{ position: 'relative', padding: `${mobile ? 4 : 10}px ${L.px}px 0` }}>
      <div aria-hidden="true" className="hero-glow" style={{ background: `radial-gradient(ellipse at 70% 40%, ${rgba(c, 0.28)} 0%, rgba(0,0,0,0) 60%)` }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: mobile ? 'column-reverse' : 'row', alignItems: mobile ? 'stretch' : 'center' }}>
        <div style={{ flexGrow: 1, minWidth: 0, marginRight: mobile ? 0 : 40, marginTop: mobile ? 16 : 0 }}>{info}</div>
        {art}
      </div>
    </div>
  );
}

/** Logo grande (canal) ou capa (filme/série/anime) no destaque. */
function HeroImage({ ch }: { ch: Channel }) {
  const { src, onError } = useLogo(ch);
  if (ch.kind !== 'live' && ch.logo) return <img className="hero-cover" src={ch.logo} alt="" referrerPolicy="no-referrer" />;
  return src ? (
    <img key={src} className="hero-logo" src={src} alt="" referrerPolicy="no-referrer" onError={onError} />
  ) : (
    <span className="tile-ini" style={{ background: colorFor(ch.name), width: '26%', height: '36%', fontSize: 40 }}>{initials(ch.name)}</span>
  );
}

/** Fileira do Início: sempre carrossel, no máximo 10 canais, só cards inteiros. */
function Shelf({ title, items, empty, onWatch, badgeFor }: { title: string; items: Channel[]; empty: string; onWatch: (c: Channel) => void; badgeFor?: (c: Channel, i: number) => string | undefined }) {
  return (
    <Carousel
      title={title}
      items={items}
      keyOf={(c) => c.id}
      empty={empty}
      render={(c, i, w) => <ChannelTile ch={c} width={w} onClick={() => onWatch(c)} badge={badgeFor?.(c, i)} />}
    />
  );
}

// ---------------------------------------------------------------- Busca
export function Search({ playlist, onWatch }: { playlist: Playlist; onWatch: (c: Channel, list: Channel[]) => void }) {
  const [q, setQ] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<VirtualListHandle>(null);
  useEffect(() => inputRef.current?.focus(), []);
  const results = useMemo(() => {
    const n = normalize(q.trim());
    if (n.length < 2) return [];
    return playlist.items.filter((i) => normalize(i.fullName ?? i.name).includes(n)).slice(0, 500);
  }, [q, playlist]);
  const live = results.filter((r) => r.kind === 'live');
  const vod = results.length - live.length;
  const L = useLayout();
  const mobile = L.form === 'mobile';
  return (
    <div className="gy-16" style={{ position: 'absolute', left: L.px, right: L.px, top: L.top + (mobile ? 0 : 10), bottom: L.bottom, display: 'flex', flexDirection: 'column' }}>
      <div className="field" style={{ flexDirection: 'row', alignItems: 'center' }}>
        <input
          ref={inputRef}
          data-nav=""
          placeholder="Buscar canal, filme ou série"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && live.length) {
              e.preventDefault();
              listRef.current?.focus();
            }
          }}
          style={{ height: mobile ? 50 : 60, fontSize: mobile ? 18 : 22, flexGrow: 1, textTransform: 'uppercase' }}
        />
        <span style={{ marginLeft: 12 }}><VoiceButton size={mobile ? 46 : 56} onText={(t) => { setQ(t); setIndex(0); }} /></span>
      </div>
      <span className="muted" style={{ fontSize: 16 }}>
        {q.trim().length < 2
          ? 'Digite pelo menos 2 letras. Na TV, o teclado do aparelho aparece ao apertar OK no campo.'
          : `${live.length} canais${vod ? ` · ${vod} filmes/séries (chegam no passo 4 da Fase 1)` : ''}`}
      </span>
      <div className={mobile ? '' : 'glass'} style={{ flexGrow: 1, borderRadius: T.radiusPanel, padding: mobile ? 0 : 16, display: 'flex', minHeight: 0 }}>
        <VirtualList
          ref={listRef}
          items={live}
          index={index}
          onIndex={setIndex}
          onPick={(c) => onWatch(c, live)}
          label="Resultados"
          rowHeight={54}
          render={(c) => (
            <>
              <span className="num">{c.number ?? ''}</span>
              <ChannelLogo ch={c} />
              <div className="txt">
                <span className="name">{c.name}</span>
              </div>
            </>
          )}
          empty={
            q.trim().length >= 2 ? (
              <div className="gy-8" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
                <span className="title" style={{ fontSize: 20 }}>Nada encontrado para “{q.trim()}”</span>
                <span className="muted" style={{ fontSize: 16 }}>Tente outra palavra, sem “HD” ou “FHD”, ou só parte do nome.</span>
              </div>
            ) : null
          }
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Em breve
export function Soon({ title, step, text, count }: { title: string; step: string; text: string; count?: number }) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  return (
    <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
      <Ambient variant="soft" />
      <div className="gy-14" style={{ position: 'absolute', left: L.px, top: L.top + (mobile ? 20 : 60), width: Math.min(720, L.W - L.px * 2), display: 'flex', flexDirection: 'column' }}>
        <Symbol size={mobile ? 52 : 72} />
        <span className="title" style={{ fontSize: mobile ? 30 : 40, fontWeight: 800 }}>{title}</span>
        <span className="chip" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', background: 'rgba(245,184,61,0.18)', color: T.warn }}>
          {step}
        </span>
        <span className="muted" style={{ fontSize: mobile ? 16 : 18, lineHeight: 1.5 }}>{text}</span>
        {count !== undefined && (
          <span style={{ fontSize: mobile ? 16 : 18 }}>
            {Icon.bookmark} <b>{count.toLocaleString('pt-BR')}</b> itens já foram lidos da sua lista e estão prontos para esta tela.
          </span>
        )}
      </div>
    </div>
  );
}
