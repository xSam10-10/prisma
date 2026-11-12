import { T } from '../ui/tokens';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Channel, Playlist } from '../core/types';
import { hasReminder, toggleReminder } from '../core/games';
import { todayHighlights, tonightPicks } from '../core/highlights';
import { hasXmltv, loadXmltv } from '../core/xmltv';
import { ChannelLogo, ChannelTile, Icon, colorFor, fmtTime, initials, rgba } from '../ui/bits';
import { progressOf } from '../core/epg';
import { useClock, useEpg } from '../ui/useEpg';
import { focusEl, focusFirst, pushBack } from '../ui/nav';
import { LayoutContext, useLayout } from '../ui/layout';
import { Carousel } from '../ui/Carousel';
import { CollectionView, PosterCard, VodDetail } from './Vod';
import { collapseVersions, getProgress, myList, removeFromContinue, vodRecents } from '../core/vod';
import { Modal } from '../ui/Dialog';
import { collectionsIn, homeShelves, topChannels, upcomingOf, type Collection, type TopChannelPick, type Upcoming } from '../core/tops';
import { useTopsState } from '../ui/useTops';
import { TitleLogo } from '../ui/premium';
import { useTmdb } from '../ui/useTmdb';
import { FeatureRow, PreviewBackdrop, SkeletonRow, WideCard } from '../ui/premium';
import { CollectionCard, EmptyState, PosterTile, TrailerLayer, pop, setHomeScrolled, toast } from '../ui/premium2';
import { episodesOf, lookup, personOf, searchPerson, searchTitles, similarOf, tmdbKey } from '../core/tmdb';
import { fuzzyMatch } from '../core/fuzzy';
import { DAYPART, LivePeek, ResumeOpen, UpcomingCard, dayPart, takeResumeOnce, useLivePeek } from '../ui/premium3';
import { currentProfile } from '../core/profiles';
import { SEARCH_GENRES, findInList, genreMatches } from '../core/tops';
import { prefGet } from '../core/storage';
import { VoiceButton } from '../ui/Voice';
import { GameDay } from './GameDay';
import { RaceWeek } from './F1';
import { expiryWarning } from './Subscription';
import { setNewEpisodes, takeDueAlerts } from '../core/newEpisodes';

const EDIT_CARD: Channel = { id: '__edit', kind: 'movie', name: '', group: '', url: '' };

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// ---------------------------------------------------------------- Início
export function Home({
  playlist, live, favs, recents, onWatch, onGoLive, onPlayVod, onGoGames,
}: {
  playlist: Playlist;
  live: Channel[];
  favs: Channel[];
  recents: Channel[];
  onWatch: (c: Channel, list: Channel[]) => void;
  onGoLive: () => void;
  /** Abre a aba Jogos numa parte (ex.: 'f1'). */
  onGoGames?: (view: string) => void;
  onPlayVod: (item: Channel, startAt?: number) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  // Filmes/episódios em andamento (com progresso) e Minha lista.
  useEffect(() => expiryWarning(playlist), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [editCont, setEditCont] = useState(false);
  const [, setEditTick] = useState(0);
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
  const colls = useMemo(() => collectionsIn(tops, playlist.items), [tops, playlist]);
  const [coll, setColl] = useState<Collection | null>(null);
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
  const tonight = useMemo(() => tonightPicks(live, favs.map((f) => f.id)), [live, favs, guideReady, hlTick]); // eslint-disable-line react-hooks/exhaustive-deps
  // Horário do dia: saudação, cor do fundo e o que sobe no Início (manhã: canais agora; noite: hoje à noite).
  const part = dayPart();
  // Ao abrir o app no meio de um filme/episódio: tela "Continuar de onde parou" (uma vez por abertura).
  const [resume, setResume] = useState<Channel | null>(() => (lastVod && takeResumeOnce() ? lastVod : null));
  // Chegando esta semana: estreias (TMDB) + próximo episódio das séries que você acompanha.
  const [followed, setFollowed] = useState<Upcoming[]>([]);
  useEffect(() => {
    let alive = true;
    const series: Channel[] = [];
    const ids = [...vodRecents().map((v) => v.seriesId), ...myList().filter((m) => m.kind === 'series').map((m) => m.id)];
    for (const id of ids) {
      if (!id || series.some((x) => x.id === id)) continue;
      const s = playlist.items.find((i) => i.id === id);
      if (s) series.push(s);
      if (series.length >= 10) break;
    }
    // Lembretes "Me avise" cujo episódio já saiu
    const today = new Date().toISOString().slice(0, 10);
    for (const a of takeDueAlerts(today)) toast(`Saiu T${a.s} E${a.e} de ${a.name}`, '🔔');
    const fresh = new Map<string, { s: number; e: number; date: string }>();
    Promise.all(
      series.map(async (s) => {
        const info = await lookup(s);
        const eps = info ? await episodesOf(info) : {};
        const l = eps.last;
        if (l && Date.parse(l.date + 'T12:00:00') > Date.now() - 7 * 86400000 && Date.parse(l.date + 'T12:00:00') <= Date.now() + 86400000) fresh.set(s.id, { s: l.season, e: l.episode, date: l.date });
        const n = eps.next && Date.parse(eps.next.date + 'T12:00:00') <= Date.now() + 9 * 86400000 ? eps.next : l;
        if (!n) return null;
        const d = Date.parse(n.date + 'T12:00:00');
        if (d < Date.now() - 2 * 86400000 || d > Date.now() + 9 * 86400000) return null;
        return { key: 'f' + s.id, title: s.name, date: d, kind: 'tv' as const, poster: info?.poster, item: s, ep: `Novo episódio · T${n.season} E${n.episode}` };
      }),
    ).then((r) => {
      if (!alive) return;
      setFollowed(r.filter(Boolean) as Upcoming[]);
      setNewEpisodes(fresh);
    });
    return () => {
      alive = false;
    };
  }, [playlist]); // eslint-disable-line react-hooks/exhaustive-deps
  const upcoming = useMemo(() => [...followed, ...upcomingOf(tops, playlist.items).filter((u) => !followed.some((f) => f.title === u.title))].sort((a, b) => a.date - b.date).slice(0, 14), [followed, tops, playlist]);
  // "Porque você assistiu…": semelhantes (TMDB) do último filme/série visto, só o que existe na lista.
  const lastSeen = vodRecents()[0];
  const becauseBase = lastSeen ? (lastSeen.seriesId ? { ...lastSeen, name: lastSeen.group, kind: 'series' as const, fullName: undefined } : lastSeen) : null;
  const becauseTm = useTmdb(becauseBase);
  const [because, setBecause] = useState<Channel[]>([]);
  useEffect(() => {
    setBecause([]);
    if (!becauseTm) return;
    let alive = true;
    similarOf(becauseTm).then((r) => {
      if (!alive) return;
      const out: Channel[] = [];
      for (const x of r) {
        const hit = findInList({ t: x.title, o: x.original, y: x.year }, becauseTm.type, playlist.items);
        if (hit && !out.some((o) => o.id === hit.id) && hit.id !== lastSeen?.id && hit.id !== lastSeen?.seriesId) out.push(hit);
        if (out.length >= 10) break;
      }
      setBecause(out);
    });
    return () => {
      alive = false;
    };
  }, [becauseTm?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Top 10 canais agora: popularidade + o que está passando + favoritos e vistos por último
  const topCh = useMemo(() => topChannels(tops, live, favs.map((f) => f.id), recents.map((r) => r.id)), [tops, live, favs, recents, guideReady]); // eslint-disable-line react-hooks/exhaustive-deps
  const topChList = useMemo(() => topCh.map((p) => p.ch), [topCh]);
  return (
    <>
    <div className="daypart-tint" aria-hidden="true" style={{ background: `radial-gradient(ellipse 70% 55% at 85% 0%, ${rgba(DAYPART[part].color, 0.16)} 0%, rgba(0,0,0,0) 70%)` }} />
    <PreviewBackdrop strength={0.32} />
    <div ref={root} className="scroll-y" style={{ position: 'absolute', left: 0, right: 0, top: L.top, bottom: mobile ? L.bottom : 0, display: 'flex', flexDirection: 'column' }} onScroll={(e) => setHomeScrolled(e.currentTarget.scrollTop > 30)}
      onFocusCapture={(e) => {
        // Voltou ao destaque do alto (saudação, Dia de jogo, destaque): rola até o topo,
        // senão o quadro do destaque fica cortado sob o menu.
        const t = e.target as HTMLElement;
        if (root.current && t.closest && t.closest('[data-home-top]')) requestAnimationFrame(() => root.current && (root.current.scrollTop = 0));
      }}>
      <div className="daypart-hi" style={{ order: -3, padding: `${mobile ? 0 : 4}px ${L.px}px 0` }}>
        <b>{DAYPART[part].hi}, {currentProfile().name}</b>
        {!mobile && <span>{DAYPART[part].sub}</span>}
      </div>
      <div data-home-top="" style={{ order: -2 }}>
        <GameDay playlist={playlist} onWatch={onWatch} />
      </div>
      <div data-home-top="" style={{ order: -2 }}>
        <RaceWeek playlist={playlist} onWatch={onWatch} onOpen={() => onGoGames?.('f1')} />
      </div>
      <div data-home-top="" style={{ order: -2 }}>
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
      </div>
      {vodNow.length > 0 && (
        <Carousel
          title="Continuar assistindo"
          items={[...vodNow, EDIT_CARD]}
          keyOf={(v) => v.id}
          minWidth={mobile ? 220 : 330}
          render={(v, _i, w) =>
            v === EDIT_CARD ? (
              <button className="tile grow edit-card" data-nav="" style={{ width: w }} onClick={() => setEditCont(true)} aria-label="Editar Continuar assistindo">
                <span className="edit-card-art" style={{ height: Math.round((w * 9) / 16) }}>
                  <b>✕</b>
                  <span>Tirar títulos daqui</span>
                </span>
              </button>
            ) : (
              <WideCard item={v} w={w} onClick={() => onPlayVod(v, getProgress(v.id)?.pos)} />
            )
          }
        />
      )}

      {shelves[0] && shelves[0].items.length >= 3 && <FeatureRow title="Destaque da semana" items={shelves[0].items.slice(0, 3).map((r) => r.item)} onOpen={onGoVod} />}
      {because.length >= 3 && becauseBase && (
        <Carousel
          title={`Porque você assistiu ${becauseBase.name.replace(/\s*\((19|20)\d{2}\)\s*$/, '')}`}
          subtitle="Semelhantes que estão na sua lista"
          items={because}
          keyOf={(v) => v.id}
          minWidth={mobile ? 110 : 160}
          render={(v, _i, w) => <PosterTile item={v} w={w} onPick={onGoVod} />}
        />
      )}

      {upcoming.length >= 3 && (
        <Carousel
          title="Chegando esta semana"
          subtitle="Episódios novos das suas séries e estreias dos streamings (TMDB)"
          items={upcoming}
          keyOf={(u) => u.key}
          minWidth={mobile ? 220 : 300}
          render={(u, _i, w) => <UpcomingCard u={u} w={w} onClick={() => (u.item ? onGoVod(u.item) : toast(`${u.title} ainda não está na sua lista`, '⏳'))} />}
        />
      )}
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

      <div style={{ order: part === 'manha' ? -1 : 0 }}>
      {topCh.length >= 3 && (
        <Carousel
          title="Top 10 canais agora"
          items={topCh}
          keyOf={(p) => p.ch.id}
          render={(p, i, w) => <TopChannelTile playlist={playlist} pick={p} rank={i + 1} width={w} onClick={() => onWatch(p.ch, topChList)} />}
        />
      )}
      </div>
      <div style={{ order: part === 'noite' ? -1 : 0 }}>
      {tonight.length >= 3 && (
        <Carousel
          title="Para assistir hoje à noite"
          subtitle="Do guia de programação · OK liga o lembrete"
          items={tonight}
          keyOf={(h) => h.ch.id + h.e.start}
          minWidth={mobile ? 200 : 300}
          render={(h, _i, w) => {
            const key = `g:${h.ch.id}:${h.e.start}`;
            const live = h.e.start <= Date.now();
            return (
              <button
                className="tile grow night-card"
                data-nav=""
                style={{ width: w }}
                aria-label={`${fmtTime(h.e.start)} ${h.e.title}, ${h.ch.name}`}
                onClick={(ev) => {
                  if (live) onWatch(h.ch, [h.ch]);
                  else {
                    const on = toggleReminder({ key, title: `${h.e.title} · ${h.ch.name}`, league: '', start: h.e.start, end: h.e.end, channels: [h.ch] });
                    pop(ev.currentTarget.querySelector('.night-bell'));
                    toast(on ? `Lembrete ligado: ${h.e.title}` : 'Lembrete desligado', on ? '⏰' : '✕');
                    force((x) => x + 1);
                  }
                }}
              >
                <span className="night-art" style={{ height: Math.round((w * 9) / 16) }}>
                  {h.e.image && <img src={h.e.image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
                  <span className="night-shade" />
                  <span className="night-time">{fmtTime(h.e.start)}</span>
                  <span className="night-kind">{h.kind === 'jogo' ? 'Jogo' : h.kind === 'filme' ? 'Filme' : 'Programa'}</span>
                  <span className="night-bell">{hasReminder(key) ? '⏰' : ''}</span>
                  <span className="night-txt">
                    <b>{h.e.title}</b>
                    <span className="night-ch">
                      <ChannelLogo ch={h.ch} size={24} />
                      <span>{h.ch.name}</span>
                    </span>
                  </span>
                </span>
              </button>
            );
          }}
        />
      )}
      </div>
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
          render={(r, _i, w) => <PosterTile item={r.item} w={w} rank={r.rank} onPick={onGoVod} />}
        />
      ))}
      {colls.length > 0 && (
        <Carousel
          title="Coleções e sagas"
          subtitle="Os filmes da sua lista em ordem de lançamento"
          items={colls}
          keyOf={(c) => c.id}
          minWidth={mobile ? 240 : 360}
          render={(c, _i, w) => <CollectionCard title={c.title} backdrop={c.backdrop} items={c.items} w={w} onClick={() => setColl(c)} />}
        />
      )}
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
    </div>
    {/* Fora da área rolável: senão o detalhe fica preso ao alto do conteúdo quando o Início está rolado. */}
    {coll && <CollectionView playlist={playlist} c={coll} onPlay={onPlayVod} onClose={() => setColl(null)} />}
    {detail && <VodDetail playlist={playlist} item={detail} onPlay={onPlayVod} onClose={() => setDetail(null)} />}
    {editCont && (
        <Modal title="Continuar assistindo" onClose={() => setEditCont(false)} width={620}>
          <span className="muted" style={{ fontSize: 15 }}>Tire o que você não vai terminar. O título continua na lista; só sai desta fileira.</span>
          {vodNow.length === 0 && <span className="muted">Nada aqui agora.</span>}
          {vodNow.map((v) => (
            <div key={v.id} className="prot-row">
              <span className="prot-name">{v.name}</span>
              <button className="chip" data-nav="" onClick={() => { removeFromContinue([v.id]); setEditTick((x) => x + 1); toast('Tirado de Continuar assistindo', '✕'); }}>✕ Tirar</button>
            </div>
          ))}
          <div className="wrap-row" style={{ display: 'flex' }}>
            {vodNow.length > 1 && <button className="btn" data-nav="" onClick={() => { removeFromContinue(vodNow.map((v) => v.id)); setEditTick((x) => x + 1); setEditCont(false); }}>Limpar tudo</button>}
            <button className="btn primary" data-nav="" onClick={() => setEditCont(false)}>Concluir</button>
          </div>
        </Modal>
      )}
    {resume && (
      <ResumeOpen
        item={resume}
        onClose={() => setResume(null)}
        onPlay={() => {
          setResume(null);
          onPlayVod(resume, getProgress(resume.id)?.pos);
        }}
      />
    )}
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
  // Trailer silencioso depois de alguns segundos com o foco no destaque.
  const [heroFocus, setHeroFocus] = useState(false);
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
    <div
      style={{ position: 'relative', padding: `${mobile ? 4 : 10}px ${L.px}px 0px`, minHeight: bd && !mobile ? Math.round(L.H * 0.5) : undefined, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onFocus={() => setHeroFocus(true)}
      onBlur={() => setHeroFocus(false)}
    >
      {bd && <img className={'hero-bd fade-img' + (bdOk ? ' in' : '')} src={bd} alt="" referrerPolicy="no-referrer" onLoad={() => setBdOk(true)} style={{ top: -L.top }} />}
      {bd && (
        <div className="hero-trailer" style={{ top: -L.top }}>
          <TrailerLayer info={tm} active={heroFocus} />
        </div>
      )}
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
  const lp = useLivePeek();
  return <ChannelTile ch={pick.ch} width={width} onClick={onClick} rank={rank} badge={pick.why} sub={cur ? `Agora: ${cur.title}` : pick.cat} image={cur?.image} progress={cur ? progressOf(cur, now) : undefined} onFocus={lp.onFocus} onBlur={lp.onBlur} overlay={lp.peek ? <LivePeek ch={pick.ch} /> : undefined} />;
}

/** Card de canal com o programa de agora (imagem, título e progresso) — Favoritos e Vistos por último. */
function LiveTile({ playlist, ch, width, onClick, badge, i }: { playlist: Playlist; ch: Channel; width: number; onClick: () => void; badge?: string; i: number }) {
  const epg = useEpg(playlist, ch, 400 + i * 120);
  const now = Date.now();
  const cur = epg?.find((e) => e.start <= now && e.end > now);
  const lp = useLivePeek();
  return <ChannelTile ch={ch} width={width} onClick={onClick} badge={badge} sub={cur ? `Agora: ${cur.title}` : undefined} image={cur?.image} progress={cur ? progressOf(cur, now) : undefined} onFocus={lp.onFocus} onBlur={lp.onBlur} overlay={lp.peek ? <LivePeek ch={ch} /> : undefined} />;
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
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const tops = useTopsState(playlist).data;
  const [person, setPerson] = useState<null | { name: string; photo?: string; items: Channel[] }>(null);
  // "Ver todos" de uma fileira: grade com todos os resultados dela.
  const [allView, setAllView] = useState<null | { title: string; items: Channel[] }>(null);
  useEffect(() => setAllView(null), [q]);
  useEffect(() => {
    if (!allView) return;
    requestAnimationFrame(() => {
      box.current?.querySelector<HTMLElement>('.sr-grid [data-nav]')?.focus();
      const col = box.current?.querySelector<HTMLElement>('.sr-col');
      if (col) col.scrollTop = 0;
    });
    return pushBack(() => {
      setAllView(null);
      return true;
    });
  }, [allView]);
  useEffect(() => {
    if (mobile) inputRef.current?.focus();
    else requestAnimationFrame(() => box.current?.querySelector<HTMLElement>('.sk-key')?.focus());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const qt = q.trim();
  const results = useMemo(() => {
    const n = normalize(qt);
    if (n.length < 2) return [];
    const exact = playlist.items.filter((i) => normalize(i.fullName ?? i.name).includes(n)).slice(0, 500);
    if (exact.length >= 8 || n.length < 4) return exact;
    // Poucos resultados: tolera erros de digitação.
    const ids = new Set(exact.map((e) => e.id));
    const fuzzy = playlist.items.filter((i) => !ids.has(i.id) && fuzzyMatch(i.fullName ?? i.name, n)).slice(0, 300);
    return [...exact, ...fuzzy];
  }, [qt, playlist]);
  // Pelo nome em outro idioma (TMDB): "The Office", "La Casa de Papel"…
  const [alt, setAlt] = useState<Channel[]>([]);
  useEffect(() => {
    setAlt([]);
    if (qt.length < 4 || !tmdbKey()) return;
    let alive = true;
    const t = setTimeout(async () => {
      const r = await searchTitles(qt);
      const out: Channel[] = [];
      for (const x of r) {
        const hit = findInList({ t: x.t, o: x.o, y: x.y }, x.kind, playlist.items);
        if (hit && !out.some((o) => o.id === hit.id)) out.push(hit);
      }
      if (alive) setAlt(out);
    }, 700);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [qt, playlist]);
  const live = results.filter((r) => r.kind === 'live' && r.id.indexOf('@') < 0).slice(0, 30);
  const movies = collapseVersions(results.filter((r) => r.kind === 'movie'));
  const series = collapseVersions(results.filter((r) => r.kind === 'series'));
  const genre = useMemo(() => genreMatches(tops, qt, playlist.items), [tops, qt, playlist]);
  // Ator/diretor (TMDB): espera parar de digitar e mostra os títulos dele que estão na lista.
  useEffect(() => {
    setPerson(null);
    if (qt.length < 4 || !tmdbKey() || genre) return;
    let alive = true;
    const t = setTimeout(async () => {
      const p = await searchPerson(qt);
      if (!alive || !p) return;
      const full = await personOf(p.id);
      if (!alive || !full) return;
      const mine: Channel[] = [];
      for (const x of full.credits) {
        const hit = findInList({ t: x.title, o: x.original, y: x.year }, x.type, playlist.items);
        if (hit && !mine.some((m) => m.id === hit.id)) mine.push(hit);
        if (mine.length >= 20) break;
      }
      if (alive && mine.length) setPerson({ name: p.name, photo: p.photo, items: mine });
    }, 650);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [qt, playlist, !!genre]); // eslint-disable-line react-hooks/exhaustive-deps
  const type = (k: string) => setQ((v) => (k === '⌫' ? v.slice(0, -1) : k === 'limpar' ? '' : k === 'espaço' ? (v && !v.endsWith(' ') ? v + ' ' : v) : v + k));
  // No computador: digitar com o teclado físico mesmo com o foco nas teclas da tela.
  useEffect(() => {
    if (mobile) return;
    const onKey = (e: KeyboardEvent) => {
      if (detail || e.ctrlKey || e.altKey || e.metaKey) return;
      const a = document.activeElement;
      if (a && a.tagName === 'INPUT') return;
      if (e.key.length === 1 && /[a-z0-9à-ÿ ]/i.test(e.key)) {
        e.preventDefault();
        type(e.key === ' ' ? 'espaço' : e.key.toLowerCase());
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        type('⌫');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobile, detail]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = (c: Channel) => {
    lastFocus.current = document.activeElement as HTMLElement | null;
    if (c.kind === 'live') onWatch(c, live);
    else setDetail(c);
  };
  const kbW = mobile ? 0 : Math.min(470, Math.round(L.W * 0.3));
  const gapK = 40;
  const resW = L.W - L.px * 2 - (mobile ? 0 : kbW + gapK);
  const inner = { ...L, W: resW + 2, px: 1 };
  const keys = 'abcdefghijklmnopqrstuvwxyz1234567890'.split('');
  const nothing = qt.length >= 2 && !results.length && !genre && !person && !alt.length;
  return (
    <>
    <div ref={box} className="search2 screen-in" style={{ position: 'absolute', left: L.px, right: L.px, top: L.top + (mobile ? 0 : 10), bottom: L.bottom, display: 'flex', flexDirection: mobile ? 'column' : 'row' }}>
      <div className="sk-col" data-nav-stop="down" style={mobile ? { flexShrink: 0 } : { width: kbW, flexShrink: 0, marginRight: gapK }}>
        <div className="sk-field">
          <span className="sk-ic">{Icon.search}</span>
          <input
            ref={inputRef}
            data-nav=""
            placeholder="Buscar"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const first = box.current?.querySelector<HTMLElement>('.sr-col [data-nav]');
                first?.focus();
              }
            }}
          />
          <VoiceButton size={mobile ? 44 : 50} onText={(t) => setQ(t)} />
        </div>
        {!mobile && (
          <>
            <div className="sk-grid" data-nav-group="">
              {keys.map((k) => (
                <button key={k} className="sk-key" data-nav="" onClick={() => type(k)}>{k}</button>
              ))}
            </div>
            <div className="sk-row">
              <button className="sk-key wide" data-nav="" onClick={() => type('espaço')}>espaço</button>
              <button className="sk-key" data-nav="" aria-label="Apagar" onClick={() => type('⌫')}>⌫</button>
              <button className="sk-key wide" data-nav="" onClick={() => type('limpar')}>limpar</button>
            </div>
            <span className="muted sk-hint">Busca por nome, ator, diretor ou gênero. No computador, pode digitar direto.</span>
          </>
        )}
      </div>
      <div
        className="scroll-y sr-col"
        data-nav-stop="down"
        style={{ flexGrow: 1, minWidth: 0, paddingBottom: 80 }}
        onKeyDown={(e) => {
          // ◀ na primeira capa de uma fileira: volta para o teclado (a fileira prende ◀▶).
          if (mobile || (e.key !== 'ArrowLeft' && e.keyCode !== 37)) return;
          const a = document.activeElement as HTMLElement | null;
          const row = a?.closest('[data-nav-row]');
          if (!a || !row) return;
          const items = Array.prototype.slice.call(row.querySelectorAll('[data-nav]')) as HTMLElement[];
          const left = Math.min(...items.filter((i) => i.getBoundingClientRect().width > 0).map((i) => i.getBoundingClientRect().left));
          const ar = a.getBoundingClientRect();
          if (ar.left > left + 2) return;
          const keys = Array.prototype.slice.call(box.current?.querySelectorAll('.sk-key') ?? []) as HTMLElement[];
          const cy = ar.top + ar.height / 2;
          let best: HTMLElement | null = null;
          let bd = Infinity;
          for (const k of keys) {
            const r = k.getBoundingClientRect();
            const dd = Math.abs(r.top + r.height / 2 - cy) * 3 - r.right;
            if (dd < bd) {
              bd = dd;
              best = k;
            }
          }
          if (best) {
            e.preventDefault();
            focusEl(best);
          }
        }}
      >
        <LayoutContext.Provider value={inner}>
          {qt.length < 2 ? (
            <div className="sr-intro">
              <span className="sr-h">Explorar por gênero</span>
              <div className="sr-genres">
                {SEARCH_GENRES.slice(0, 14).map((g, i) => (
                  <button key={g} className="sr-genre" data-nav="" onClick={() => setQ(g)} style={{ background: `linear-gradient(135deg, ${rgba(colorFor(g + i), 0.55)} 0%, ${rgba(colorFor(g), 0.18)} 100%)` }}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
          ) : allView ? (
            <div className="sr-all">
              <div className="sr-all-head">
                <span className="sr-h" style={{ margin: 0 }}>{allView.title} <span className="muted" style={{ fontSize: 18, fontWeight: 600 }}>· {allView.items.length}</span></span>
                <button className="chip" data-nav="" onClick={() => setAllView(null)}>← Voltar às fileiras</button>
              </div>
              {(() => {
                const isLive = allView.items[0]?.kind === 'live';
                const gap = mobile ? 12 : 18;
                const minW = isLive ? (mobile ? 150 : 190) : mobile ? 100 : 132;
                const gw = resW - 20;
                const per = Math.max(2, Math.floor((gw + gap) / (minW + gap)));
                const w = Math.floor((gw - gap * (per - 1)) / per);
                return (
                  <div className="sr-grid">
                    {allView.items.map((it, i) => (
                      <div key={it.id} style={{ width: w, marginRight: (i + 1) % per ? gap : 0, marginBottom: gap }}>
                        {it.kind === 'live' ? <ChannelTile ch={it} width={w} onClick={() => open(it)} sub={it.group} /> : <PosterTile item={it} w={w} onPick={open} />}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          ) : nothing ? (
            <EmptyState kind="search" title={`Nada encontrado para “${qt}”`} text="Tente outra palavra, sem “HD” ou “FHD”, só parte do nome, o nome de um ator ou um gênero." />
          ) : (
            <>
              {genre && (
                <Carousel title={`Gênero: ${genre.genre}`} subtitle={`${genre.items.length} títulos na sua lista`} onAll={() => setAllView({ title: `Gênero: ${genre.genre}`, items: genre.items })} items={genre.items} keyOf={(i) => i.id} minWidth={mobile ? 100 : 132} render={(it, _i, w) => <PosterTile item={it} w={w} onPick={open} />} />
              )}
              {live.length > 0 && (
                <Carousel title="Canais" subtitle={`${live.length}`} onAll={() => setAllView({ title: 'Canais', items: live })} items={live} keyOf={(i) => i.id} minWidth={mobile ? 150 : 190} render={(c, _i, w) => <ChannelTile ch={c} width={w} onClick={() => open(c)} sub={c.group} />} />
              )}
              {movies.length > 0 && (
                <Carousel title="Filmes" subtitle={`${movies.length}`} onAll={() => setAllView({ title: 'Filmes', items: movies })} items={movies} keyOf={(i) => i.id} minWidth={mobile ? 100 : 132} render={(it, _i, w) => <PosterTile item={it} w={w} onPick={open} />} />
              )}
              {series.length > 0 && (
                <Carousel title="Séries" subtitle={`${series.length}`} onAll={() => setAllView({ title: 'Séries', items: series })} items={series} keyOf={(i) => i.id} minWidth={mobile ? 100 : 132} render={(it, _i, w) => <PosterTile item={it} w={w} onPick={open} />} />
              )}
              {(() => {
                const extra = alt.filter((a) => !results.some((r) => r.id === a.id));
                return extra.length > 0 ? (
                  <Carousel title="Pelo nome em outro idioma" subtitle="Encontrados pelo TMDB" items={extra} keyOf={(i) => i.id} minWidth={mobile ? 100 : 132} render={(it, _i, w) => <PosterTile item={it} w={w} onPick={open} />} />
                ) : null;
              })()}
              {person && (
                <div className="sr-person">
                  <div className="sr-person-head">
                    <span className="sr-person-ph">{person.photo ? <img src={person.photo} alt="" referrerPolicy="no-referrer" /> : initials(person.name)}</span>
                    <span><span className="paused-tag">Elenco e direção</span><b>{person.name}</b></span>
                  </div>
                  <Carousel title="Na sua lista" subtitle={`${person.items.length} títulos com ${person.name.split(' ')[0]}`} items={person.items} keyOf={(i) => i.id} minWidth={mobile ? 100 : 132} render={(it, _i, w) => <PosterTile item={it} w={w} onPick={open} />} />
                </div>
              )}
            </>
          )}
        </LayoutContext.Provider>
      </div>
    </div>
    {detail && <VodDetail playlist={playlist} item={detail} onPlay={onPlayVod} onClose={() => { setDetail(null); requestAnimationFrame(() => lastFocus.current?.focus()); }} />}
    </>
  );
}

