import { T } from '../ui/tokens';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Channel, Playlist } from '../core/types';
import { hasReminder, toggleReminder } from '../core/games';
import { todayHighlights } from '../core/highlights';
import { hasXmltv, loadXmltv } from '../core/xmltv';
import { Ambient, ChannelLogo, ChannelTile, Icon, Symbol, colorFor, fmtTime, rgba } from '../ui/bits';
import { progressOf } from '../core/epg';
import { useClock, useEpg } from '../ui/useEpg';
import { VirtualList, type VirtualListHandle } from '../ui/VirtualList';
import { focusFirst } from '../ui/nav';
import { useLayout } from '../ui/layout';
import { Carousel } from '../ui/Carousel';
import { PosterCard, VodDetail } from './Vod';
import { getProgress, myList, vodRecents } from '../core/vod';
import { homeShelves, topChannels, type TopChannelPick } from '../core/tops';
import { useTopsState } from '../ui/useTops';
import { TitleLogo } from '../ui/premium';
import { useTmdb } from '../ui/useTmdb';
import { FeatureRow, PreviewBackdrop, RankedCard, SkeletonRow, WideCard, setPreview } from '../ui/premium';
import { prefGet } from '../core/storage';
import { VoiceButton } from '../ui/Voice';

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// ---------------------------------------------------------------- Início
export function Home({
  playlist, live, favs, recents, onWatch, onGoLive, onPlayVod,
}: {
  playlist: Playlist;
  live: Channel[];
  favs: Channel[];
  recents: Channel[];
  onWatch: (c: Channel, list: Channel[]) => void;
  onGoLive: () => void;
  onPlayVod: (item: Channel, startAt?: number) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  // Filmes/episódios em andamento (com progresso) e Minha lista.
  const vodNow = vodRecents().filter((v) => getProgress(v.id));
  const saved = myList();
  const lastVod = prefGet<string>('lastKind', 'live') === 'vod' ? vodNow[0] : undefined;
  const heroItem = lastVod ?? recents[0];
  const movies = playlist.items.filter((i) => i.kind === 'movie').length;
  const series = playlist.items.filter((i) => i.kind === 'series').length;
  const [detail, setDetail] = useState<Channel | null>(null);
  const onGoVod = (v: Channel) => setDetail(v);
  // Tops (arquivo atualizado no GitHub): filmes e séries juntos, só o que existe na lista
  const { data: tops, ready: topsReady } = useTopsState(playlist);
  const shelves = useMemo(() => homeShelves(tops, playlist.items), [tops, playlist]);
  const L = useLayout();
  const mobile = L.form === 'mobile';
  useEffect(() => {
    requestAnimationFrame(() => focusFirst(root.current));
  }, []);
  // Destaques do dia (do guia): espera o guia completo carregar.
  const [hlTick, force] = useState(0);
  const [guideReady, setGuideReady] = useState(hasXmltv());
  useEffect(() => {
    if (guideReady) return;
    let alive = true;
    loadXmltv(playlist).then(() => alive && setGuideReady(true), () => {});
    return () => {
      alive = false;
    };
  }, [playlist]); // eslint-disable-line react-hooks/exhaustive-deps
  const highlights = useMemo(() => todayHighlights(live, favs.map((f) => f.id)), [live, favs, guideReady, hlTick]); // eslint-disable-line react-hooks/exhaustive-deps
  // Top 10 canais agora: popularidade + o que está passando + favoritos e vistos por último
  const topCh = useMemo(() => topChannels(tops, live, favs.map((f) => f.id), recents.map((r) => r.id)), [tops, live, favs, recents, guideReady]); // eslint-disable-line react-hooks/exhaustive-deps
  const topChList = useMemo(() => topCh.map((p) => p.ch), [topCh]);
  return (
    <>
    <PreviewBackdrop strength={0.32} />
    <div ref={root} className="scroll-y" style={{ position: 'absolute', left: 0, right: 0, top: L.top, bottom: mobile ? L.bottom : 0 }}>
      <Hero
        playlist={playlist}
        last={heroItem}
        live={live}
        movies={movies}
        series={series}
        onPlay={() => {
          if (!heroItem) return;
          if (heroItem.kind === 'live') onWatch(heroItem, recents);
          else onPlayVod(heroItem, getProgress(heroItem.id)?.pos);
        }}
        onGoLive={onGoLive}
      />
      {vodNow.length > 0 && (
        <Carousel
          title="Continuar assistindo"
          items={vodNow}
          keyOf={(v) => v.id}
          minWidth={mobile ? 220 : 330}
          render={(v, _i, w) => <WideCard item={v} w={w} onClick={() => onPlayVod(v, getProgress(v.id)?.pos)} />}
        />
      )}
      {shelves[0] && shelves[0].items.length >= 3 && <FeatureRow title="Destaque da semana" items={shelves[0].items.slice(0, 3).map((r) => r.item)} onOpen={onGoVod} />}

      {highlights.length > 0 && (
        <Carousel
          title="Destaques de hoje"
          items={highlights}
          keyOf={(h) => h.ch.id + h.e.start}
          minWidth={mobile ? 170 : 260}
          render={(h, _i, w) => {
            const live = h.e.start <= Date.now();
            const key = `g:${h.ch.id}:${h.e.start}`;
            return (
              <button
                className="tile grow hl-card"
                data-nav=""
                style={{ width: w }}
                aria-label={`${h.e.title}, ${h.ch.name}`}
                onClick={() => {
                  if (live) onWatch(h.ch, live ? [h.ch] : []);
                  else {
                    toggleReminder({ key, title: `${h.e.title} · ${h.ch.name}`, league: '', start: h.e.start, end: h.e.end, channels: [h.ch] });
                    force((x) => x + 1);
                  }
                }}
              >
                <span className={'hl-when' + (live ? ' live' : '')}>
                  {live ? '● AO VIVO' : fmtTime(h.e.start)} · {h.kind === 'jogo' ? 'Jogo' : h.kind === 'filme' ? 'Filme' : 'Programa'}
                </span>
                <span className="hl-title">{h.e.title}</span>
                <span className="hl-ch">
                  <ChannelLogo ch={h.ch} size={28} />
                  <span>{h.ch.name}</span>
                  {!live && <b>{hasReminder(key) ? '⏰ agendado' : '⏰ lembrar'}</b>}
                </span>
              </button>
            );
          }}
        />
      )}

      {topCh.length >= 3 && (
        <Carousel
          title="Top 10 canais agora"
          items={topCh}
          keyOf={(p) => p.ch.id}
          render={(p, i, w) => <TopChannelTile playlist={playlist} pick={p} rank={i + 1} width={w} onClick={() => onWatch(p.ch, topChList)} />}
        />
      )}
      <Shelf playlist={playlist} title="Favoritos" items={favs} empty="Favorite canais na tela cheia (botão ★) para eles aparecerem aqui." onWatch={(c) => onWatch(c, favs)} />
      {!topsReady && !shelves.length && (
        <>
          <SkeletonRow />
          <SkeletonRow />
        </>
      )}
      {shelves.map((sh) => (
        <Carousel
          key={sh.id}
          title={sh.title}
          subtitle={sh.src}
          items={sh.items}
          keyOf={(r) => r.item.id}
          minWidth={mobile ? 150 : 210}
          render={(r, _i, w) => (
            <button className="tile grow" data-nav="" style={{ width: w }} onFocus={() => setPreview(r.item)} onClick={() => onGoVod(r.item)} aria-label={`${r.rank}º ${r.item.name}`}>
              <RankedCard rank={r.rank} w={w}>{(pw) => <PosterCard item={r.item} w={pw} />}</RankedCard>
            </button>
          )}
        />
      ))}
      {saved.length > 0 && (
        <Carousel
          title="Minha lista"
          items={saved}
          keyOf={(v) => v.id}
          minWidth={mobile ? 110 : 160}
          render={(v, _i, w) => (
            <button className="tile grow" data-nav="" style={{ width: w }} onClick={() => onGoVod(v)} aria-label={v.name}>
              <PosterCard item={v} w={w} />
            </button>
          )}
        />
      )}
      <Shelf playlist={playlist} title="Vistos por último" badgeFor={(_c, i) => (i === 0 ? 'Último' : undefined)} items={recents} empty="Os canais que você assistir aparecem aqui." onWatch={(c) => onWatch(c, recents)} />
      {detail && <VodDetail playlist={playlist} item={detail} onPlay={onPlayVod} onClose={() => setDetail(null)} />}
    </div>
    </>
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
  const c = last ? colorFor(last.name) : T.primary;
  const isVod = last && last.kind !== 'live';
  // Filme/série: arte larga do TMDB atrás do destaque e logo oficial no lugar do nome.
  const vodItem = isVod && last ? (last.seriesId ? { ...last, name: last.group, kind: 'series' as const, fullName: undefined } : last) : null;
  const tm = useTmdb(vodItem);
  const [bdOk, setBdOk] = useState(false);
  useEffect(() => setBdOk(false), [tm?.backdrop]);
  const bd = tm?.backdrop;
  // TV/computador: duas colunas — à esquerda o canal e os botões, à direita a
  // programação (Agora · A seguir · Depois) ou, sem guia, o resumo da lista.
  const wide = !mobile;
  const progs = (epg ?? []).slice(0, 3);
  const side = wide ? (
    <div className="hero-side glass">
      {last && !isVod && progs.length ? (
        <>
          <div className="hero-side-head">
            <ChannelLogo ch={last} size={52} />
            <div className="hero-side-t">
              <span className="caps">{last.name}</span>
              <span className="muted">Na programação</span>
            </div>
          </div>
          {progs.map((e, i) => (
            <div key={e.start} className={'hero-prog' + (i === 0 ? ' now' : '')}>
              <span className="hero-prog-when">{i === 0 ? 'Agora' : i === 1 ? 'A seguir' : 'Depois'}</span>
              <div className="hero-prog-body">
                <span className="hero-prog-time">{fmtTime(e.start)} – {fmtTime(e.end)}</span>
                <span className="hero-prog-title">{e.title}</span>
                {i === 0 && <div className="progress" style={{ marginTop: 8 }}><div style={{ width: `${progressOf(e, now) * 100}%` }} /></div>}
              </div>
            </div>
          ))}
        </>
      ) : (
        <>
          <div className="hero-side-head">
            {last ? <ChannelLogo ch={last} size={52} /> : null}
            <div className="hero-side-t">
              <span className="caps">{playlist.source.name}</span>
              <span className="muted">Sua lista</span>
            </div>
          </div>
          <div className="hero-stats">
            {([['Canais', live.length], ['Filmes', movies], ['Séries', series]] as [string, number][]).map(([k, v]) => (
              <div key={k} className="hero-stat">
                <span className="hero-stat-n">{v.toLocaleString('pt-BR')}</span>
                <span className="muted">{k}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  ) : null;
  const info = (
    <div className="gy-12" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0, maxWidth: wide ? undefined : 680 }}>
      <span className="badge-live" style={{ alignSelf: 'flex-start', fontSize: mobile ? 12 : 13 }}>{last ? 'Continuar assistindo' : 'Bem-vindo'}</span>
      {vodItem && <TitleLogo info={tm} name={vodItem.name} height={mobile ? 64 : 110} maxW={mobile ? 300 : 560} className="hero-logo" />}
      <span className="title caps" style={{ fontSize: mobile ? 30 : 46, fontWeight: 800, lineHeight: 1.02 }}>{last ? last.name : 'PRISMA'}</span>
      {vodItem && tm?.overview && !mobile && <span className="muted hero-desc">{tm.overview}</span>}
      {last ? (
        <span className="muted caps" style={{ fontSize: mobile ? 14 : 16, fontWeight: 600 }}>
          {last.number != null ? `Canal ${last.number} · ` : ''}{last.group}
        </span>
      ) : null}
      {cur && wide ? (
        <div className="gy-6" style={{ display: 'flex', flexDirection: 'column', marginTop: 4 }}>
          <span style={{ fontSize: 19, fontWeight: 700 }}>
            <span style={{ color: T.live }}>Agora · </span>{cur.title}
          </span>
          {cur.description && <span className="muted hero-desc">{cur.description}</span>}
        </div>
      ) : cur ? (
        <div className="gy-6" style={{ display: 'flex', flexDirection: 'column', marginTop: 4 }}>
          <span style={{ fontSize: mobile ? 16 : 19, fontWeight: 700 }}>
            <span style={{ color: T.live }}>Agora · </span>{cur.title}
          </span>
          <div className="progress" style={{ maxWidth: 420 }}><div style={{ width: `${progressOf(cur, now) * 100}%` }} /></div>
          <span className="muted" style={{ fontSize: 14 }}>
            {fmtTime(cur.start)} – {fmtTime(cur.end)}{next ? ` · A seguir: ${next.title}` : ''}
          </span>
        </div>
      ) : vodItem ? null : (
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
  return (
    <div style={{ position: 'relative', padding: `${mobile ? 4 : 10}px ${L.px}px 0px`, minHeight: bd && !mobile ? Math.round(L.H * 0.5) : undefined, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      {bd && <img className={'hero-bd fade-img' + (bdOk ? ' in' : '')} src={bd} alt="" referrerPolicy="no-referrer" onLoad={() => setBdOk(true)} style={{ top: -L.top }} />}
      {bd && <div className="hero-bd-fade" style={{ top: -L.top, background: `linear-gradient(to bottom, rgba(0,0,0,0) 45%, ${T.bg} 100%)` }} />}
      <div aria-hidden="true" className="hero-glow" style={{ background: `radial-gradient(ellipse at 70% 40%, ${rgba(c, bd ? 0 : 0.28)} 0%, rgba(0,0,0,0) 60%)` }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: mobile ? 'column-reverse' : 'row', alignItems: mobile ? 'stretch' : 'center' }}>
        <div style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, marginTop: mobile ? 8 : 0, paddingRight: wide ? 48 : 0 }}>{info}</div>
        {side && !bd && <div style={{ flexBasis: '44%', maxWidth: 720, flexShrink: 0 }}>{side}</div>}
      </div>
    </div>
  );
}

/** Card do "Top 10 canais agora": logo, posição e o programa que está passando. */
function TopChannelTile({ playlist, pick, rank, width, onClick }: { playlist: Playlist; pick: TopChannelPick; rank: number; width: number; onClick: () => void }) {
  const epg = useEpg(playlist, pick.ch, 300 + rank * 120);
  const now = Date.now();
  const cur = epg?.find((e) => e.start <= now && e.end > now);
  return <ChannelTile ch={pick.ch} width={width} onClick={onClick} rank={rank} badge={pick.why} sub={cur ? `Agora: ${cur.title}` : pick.cat} image={cur?.image} progress={cur ? progressOf(cur, now) : undefined} />;
}

/** Card de canal com o programa de agora (imagem, título e progresso) — Favoritos e Vistos por último. */
function LiveTile({ playlist, ch, width, onClick, badge, i }: { playlist: Playlist; ch: Channel; width: number; onClick: () => void; badge?: string; i: number }) {
  const epg = useEpg(playlist, ch, 400 + i * 120);
  const now = Date.now();
  const cur = epg?.find((e) => e.start <= now && e.end > now);
  return <ChannelTile ch={ch} width={width} onClick={onClick} badge={badge} sub={cur ? `Agora: ${cur.title}` : undefined} image={cur?.image} progress={cur ? progressOf(cur, now) : undefined} />;
}

/** Fileira do Início: sempre carrossel, no máximo 10 canais, só cards inteiros. */
function Shelf({ playlist, title, items, empty, onWatch, badgeFor }: { playlist: Playlist; title: string; items: Channel[]; empty: string; onWatch: (c: Channel) => void; badgeFor?: (c: Channel, i: number) => string | undefined }) {
  return (
    <Carousel
      title={title}
      items={items}
      keyOf={(c) => c.id}
      empty={empty}
      render={(c, i, w) => <LiveTile playlist={playlist} ch={c} width={w} i={i} onClick={() => onWatch(c)} badge={badgeFor?.(c, i)} />}
    />
  );
}

// ---------------------------------------------------------------- Busca
export function Search({ playlist, onWatch, onPlayVod }: { playlist: Playlist; onWatch: (c: Channel, list: Channel[]) => void; onPlayVod: (item: Channel, startAt?: number, queue?: Channel[]) => void }) {
  const [detail, setDetail] = useState<Channel | null>(null);
  const [kind, setKind] = useState<'all' | 'live' | 'movie' | 'series'>('all');
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
  const movies = results.filter((r) => r.kind === 'movie');
  const series = results.filter((r) => r.kind === 'series');
  // Canais primeiro, depois filmes e séries.
  const shown = kind === 'live' ? live : kind === 'movie' ? movies : kind === 'series' ? series : [...live, ...movies, ...series];
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
            if (e.key === 'Enter' && shown.length) {
              e.preventDefault();
              listRef.current?.focus();
            }
          }}
          style={{ height: mobile ? 50 : 60, fontSize: mobile ? 18 : 22, flexGrow: 1, textTransform: 'uppercase' }}
        />
        <span style={{ marginLeft: 12 }}><VoiceButton size={mobile ? 46 : 56} onText={(t) => { setQ(t); setIndex(0); }} /></span>
      </div>
      {q.trim().length < 2 ? (
        <span className="muted" style={{ fontSize: 16 }}>Digite pelo menos 2 letras. Procura em canais, filmes e séries. Na TV, o teclado do aparelho aparece ao apertar OK no campo.</span>
      ) : (
        <div className="scroll-x" style={{ flexShrink: 0 }}>
          {([['all', 'Tudo', results.length], ['live', 'Canais', live.length], ['movie', 'Filmes', movies.length], ['series', 'Séries', series.length]] as const).map(([id, label, n]) => (
            <button key={id} className={'chip' + (kind === id ? ' on' : '')} data-nav="" onClick={() => { setKind(id); setIndex(0); }}>{label} · {n}</button>
          ))}
        </div>
      )}
      <div className={mobile ? '' : 'glass'} style={{ flexGrow: 1, borderRadius: T.radiusPanel, padding: mobile ? 0 : 16, display: 'flex', minHeight: 0 }}>
        <VirtualList
          ref={listRef}
          items={shown}
          index={index}
          onIndex={setIndex}
          onPick={(c) => (c.kind === 'live' ? onWatch(c, live) : setDetail(c))}
          label="Resultados"
          rowHeight={60}
          render={(c) => (
            <>
              <span className="num">{c.kind === 'live' ? c.number ?? '' : ''}</span>
              {c.kind === 'live' ? (
                <ChannelLogo ch={c} />
              ) : (
                <span className="mini-poster">{c.logo ? <img src={c.logo} alt="" loading="lazy" referrerPolicy="no-referrer" /> : null}</span>
              )}
              <div className="txt">
                <span className="name">{c.name}</span>
                <span className="sub caps" style={{ fontSize: 13 }}>
                  {c.kind === 'live' ? 'Canal' : c.kind === 'movie' ? 'Filme' : 'Série'}{c.year ? ` · ${c.year}` : ''} · {c.group}
                </span>
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
      {detail && <VodDetail playlist={playlist} item={detail} onPlay={onPlayVod} onClose={() => { setDetail(null); requestAnimationFrame(() => listRef.current?.focus()); }} />}
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
