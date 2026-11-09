import { useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '../core/settings';
import type { Channel, ItemKind, Playlist } from '../core/types';
import { ANIME, STREAMINGS, getProgress, inMyList, logoSize, logoUrl, myList, streamingsIn, toggleMyList, type Streaming } from '../core/vod';
import { seriesInfo, vodInfo, type Episode, type SeriesDetails, type VodDetails } from '../core/xtream';
import { colorFor, initials, rgba } from '../ui/bits';
import { useLayout } from '../ui/layout';
import { focusEl, focusFirst, pushBack } from '../ui/nav';
import { VirtualGrid, type VirtualGridHandle } from '../ui/VirtualGrid';
import { VirtualList } from '../ui/VirtualList';
import { VoiceButton, voiceSupported } from '../ui/Voice';
import { useTmdb } from '../ui/useTmdb';
import { trailerOf } from '../core/tmdb';
import { matchedLists, streamGenreLists, type MatchedList } from '../core/tops';
import { StackedRows, StreamBanner, type Row } from './TopRows';
import { useTops } from '../ui/useTops';
import { categoryColumnWidth } from '../ui/catColumn';
import { Modal } from '../ui/Dialog';

// Filmes · Séries · Anime: streamings no topo, categorias à esquerda,
// grade de capas com busca; OK abre o detalhe (sinopse, elenco, episódios).

export type VodTab = 'filmes' | 'series' | 'anime';

function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Capa (2:3) com título, ano/nota e progresso. Sem imagem: arte com o nome. */
export function PosterCard({ item, w, selected, rank }: { item: Channel; w: number; selected?: boolean; rank?: number }) {
  const [broken, setBroken] = useState(false);
  const tm = useTmdb(item);
  const img = tm?.poster || item.logo;
  useEffect(() => setBroken(false), [img]);
  const p = getProgress(item.id);
  const c = colorFor(item.name);
  return (
    <div className={'poster' + (selected ? ' sel' : '')}>
      <div className="poster-art" style={{ height: Math.round(w * 1.5), background: `linear-gradient(160deg, ${rgba(c, 0.55)} 0%, #15151F 85%)` }}>
        {img && !broken ? (
          <img src={img} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        ) : (
          <span className="poster-fallback caps" style={rank ? { left: rank > 9 ? 84 : 52 } : undefined}>{item.name}</span>
        )}
        {rank ? <span className="poster-rank">{rank}</span> : null}
        {item.rating ? <span className="poster-rate">★ {item.rating.toFixed(1).replace('.', ',')}</span> : null}
        {p && p.dur ? <span className="poster-prog"><span style={{ width: `${(p.pos / p.dur) * 100}%` }} /></span> : null}
      </div>
      <span className="poster-title caps">{item.name}</span>
      {item.year ? <span className="poster-meta">{item.year}</span> : null}
    </div>
  );
}

type Sort = 'recent' | 'az' | 'rating';
/** Botão "Top" na fileira de streamings. */
const TOPS = '__top__';
const toRow = (l: MatchedList, ranked = true): Row => ({ id: l.id, title: l.title, src: l.src, items: l.items, ranked });

export function VodScreen({ playlist, tab, onPlay }: { playlist: Playlist; tab: VodTab; onPlay: (item: Channel, startAt?: number, queue?: Channel[]) => void }) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const logoMode = useSettings().settings.streamLogos ?? 'color';
  const all = useMemo(() => {
    const kinds: ItemKind[] = tab === 'filmes' ? ['movie'] : tab === 'series' ? ['series'] : ['movie', 'series'];
    const list = playlist.items.filter((i) => kinds.includes(i.kind));
    return tab === 'anime' ? list.filter((i) => ANIME.test(i.group)) : list;
  }, [playlist, tab]);
  const groups = useMemo(() => [...new Set(all.map((i) => i.group))], [all]);
  const fromCats = useMemo(() => streamingsIn(groups), [groups]);
  const [stream, setStream] = useState<string>('');
  const [cat, setCat] = useState<string>('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [index, setIndex] = useState(0);
  const [detail, setDetail] = useState<Channel | null>(null);
  const gridRef = useRef<VirtualGridHandle>(null);
  const st: Streaming | undefined = STREAMINGS.find((s) => s.id === stream);
  const topMode = stream === TOPS;

  const inStream = useMemo(() => (st ? all.filter((i) => st.match.test(i.group)) : all), [all, st]);
  // Tops (Netflix oficial, mais populares de cada streaming, gêneros…), só com títulos da lista
  const tops = useTops(playlist);
  const topLists = useMemo<MatchedList[]>(() => (tab === 'anime' ? [] : matchedLists(tops, playlist.items, tab === 'filmes' ? 'movie' : 'tv')), [tops, playlist, tab]);
  // Top do streaming escolhido (ex.: "Top 10 Netflix" no alto das categorias da Netflix)
  const stTop = st ? topLists.find((l) => l.sid === st.id) : undefined;
  // Streamings da fileira: os das categorias da lista + os que têm Top com títulos da lista
  // (em Filmes, muitas listas não separam os filmes por streaming nas categorias).
  const streamings = useMemo(
    () => STREAMINGS.filter((s) => fromCats.some((x) => x.id === s.id) || topLists.some((l) => l.sid === s.id)),
    [fromCats, topLists],
  );
  const kindKey = tab === 'filmes' ? 'movie' : 'tv';
  // Gêneros do streaming escolhido (ex.: Terror no HBO Max)
  const stGenres = useMemo(() => (st && tab !== 'anime' ? streamGenreLists(tops, playlist.items, kindKey, st.id) : []), [tops, playlist, st, tab, kindKey]);
  // Adicionados recentemente: os 10 últimos que chegaram na lista
  const recentRow = useMemo<Row | null>(() => {
    const r = all.filter((i) => i.added).sort((a, b) => (b.added ?? 0) - (a.added ?? 0)).slice(0, 10);
    return r.length ? { id: 'recent', title: 'Adicionados recentemente', src: `Os últimos ${tab === 'filmes' ? 'filmes' : 'títulos'} que chegaram na sua lista`, items: r.map((item, i) => ({ item, rank: i + 1 })), ranked: false } : null;
  }, [all, tab]);
  // Listas empilhadas (carrosséis): Top = todas; streaming = Top 10 dele + gêneros dele.
  const rows = useMemo<Row[]>(() => {
    if (topMode) return [...(recentRow ? [recentRow] : []), ...topLists.map((l) => toRow(l))];
    if (st) return [...(stTop ? [toRow(stTop)] : []), ...stGenres.map((g) => toRow(g, false))];
    return [];
  }, [topMode, st, recentRow, topLists, stTop, stGenres]);
  const pickStream = (s: Streaming) => {
    setStream(s.id);
    setCat('');
    setQuery('');
  };
  const cats = useMemo(() => countCats(inStream), [inStream]);
  const q = norm(query.trim());
  const list = useMemo(() => {
    if (!q && topMode) return [];
    let l = q ? all.filter((i) => norm(i.fullName ?? i.name).includes(q)) : cat ? inStream.filter((i) => i.group === cat) : inStream;
    if (sort === 'az') l = [...l].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    else if (sort === 'rating') l = [...l].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    else l = [...l].sort((a, b) => (b.added ?? 0) - (a.added ?? 0));
    return l;
  }, [all, inStream, cat, q, sort, topMode]);
  const openTop = () => {
    setStream(TOPS);
    setCat('');
    setQuery('');
  };
  // Top e streaming: sem a coluna da esquerda; uma página só, que rola (carrosséis e, no
  // streaming, a grade com todo o conteúdo dele no fim). "Todos": coluna + grade, como antes.
  const stacked = !q && (topMode ? rows.length > 0 : !!st);
  const noLeft = topMode || !!st;
  // Volta o foco para onde estava ao fechar o detalhe.
  const lastFocus = useRef<HTMLElement | null>(null);
  const openDetail = (it: Channel) => {
    lastFocus.current = document.activeElement as HTMLElement | null;
    setDetail(it);
  };

  useEffect(() => setIndex(0), [stream, cat, q, sort]);
  useEffect(() => {
    requestAnimationFrame(() => gridRef.current?.focus());
  }, [tab]);

  const title = tab === 'filmes' ? 'Filmes' : tab === 'series' ? 'Séries' : 'Anime';
  const kindLabel = tab === 'filmes' ? 'filmes' : tab === 'series' ? 'séries' : 'títulos';

  if (!all.length) {
    return (
      <div className="gy-14" style={{ position: 'absolute', left: L.px, right: L.px, top: L.top + 40, display: 'flex', flexDirection: 'column', maxWidth: 760 }}>
        <span className="title" style={{ fontSize: mobile ? 28 : 40, fontWeight: 800 }}>{title}</span>
        <span className="muted" style={{ fontSize: 18, lineHeight: 1.5 }}>
          {tab === 'anime'
            ? 'Nenhuma categoria de anime foi encontrada na sua lista (procuro por “anime” ou “Crunchyroll” no nome da categoria).'
            : `A sua lista não trouxe ${kindLabel}. Se a assinatura inclui ${kindLabel}, use Ajustes › Lista › Atualizar lista agora: listas grandes podem demorar para responder.`}
        </span>
      </div>
    );
  }

  const top = L.top;
  const showRow = tab !== 'anime';
  const streamRowH = showRow ? (mobile ? 46 : 54) : 0;
  const catW = mobile ? 0 : categoryColumnWidth(playlist.items);
  const sortChips = (
    <div className="gx-6" style={{ display: 'flex', marginLeft: 12, flexShrink: 0 }}>
      {(['recent', 'az', 'rating'] as Sort[]).map((s) => (
        <button key={s} className={'chip' + (sort === s ? ' on' : '')} data-nav="" onClick={() => setSort(s)}>
          {s === 'recent' ? 'Recentes' : s === 'az' ? 'A–Z' : 'Nota'}
        </button>
      ))}
    </div>
  );
  const catChips = (
    <div className="scroll-x" style={{ marginTop: 8, flexShrink: 0 }}>
      <button className={'chip' + (!cat ? ' on' : '')} data-nav="" onClick={() => setCat('')}>Todos</button>
      {cats.map((c) => (
        <button key={c.name} className={'chip' + (cat === c.name ? ' on' : '')} data-nav="" onClick={() => setCat(c.name)}>{c.name}</button>
      ))}
    </div>
  );
  const grid = (
    <VirtualGrid
      ref={gridRef}
      items={list}
      index={index}
      onIndex={setIndex}
      onPick={openDetail}
      minCellW={mobile ? 104 : 168}
      ratio={1.5}
      extraH={mobile ? 58 : 56}
      gap={mobile ? 10 : 18}
      label={title}
      render={(it, _i, sel, w) => <PosterCard item={it} w={w} selected={sel} />}
      empty={
        <div className="muted" style={{ padding: 20, fontSize: 16 }}>
          {topMode && !q
            ? `Os Tops ainda não encontraram ${kindLabel} da sua lista. Eles se completam quando a chave do TMDB estiver no GitHub (secret TMDB_KEY) — veja Ajustes › Serviços.`
            : 'Nada encontrado. Tente outra palavra ou outra categoria.'}
        </div>
      }
    />
  );

  return (
    <>
      {st && (
        <div aria-hidden="true" className="stream-art" style={{ background: `radial-gradient(ellipse 60% 70% at 85% 10%, ${rgba(st.accent, 0.45)} 0%, rgba(0,0,0,0) 70%), radial-gradient(ellipse 50% 60% at 10% 90%, ${rgba(st.accent2, 0.35)} 0%, rgba(0,0,0,0) 70%), ${st.bg}` }} />
      )}
      {showRow && (
        <StreamCarousel style={{ position: 'absolute', left: L.px, right: L.px, top, height: streamRowH }}>
          <button className={'stream-chip topchip' + (topMode ? ' on' : '')} data-nav="" aria-label="Top: listas de recomendações" onClick={openTop}>
            🔥 Top
          </button>
          <button className={'stream-chip' + (!stream ? ' on' : '')} data-nav="" onClick={() => { setStream(''); setCat(''); }}>Todos</button>
          {streamings.map((s) => (
            <button
              key={s.id}
              className={'stream-chip' + (stream === s.id ? ' on' : '') + (s.logo ? ' logo ' + logoMode : '')}
              data-nav=""
              aria-label={s.name}
              title={s.name}
              style={stream === s.id && !s.logo ? { background: s.accent, color: '#fff' } : undefined}
              data-sid={s.id}
              onClick={() => pickStream(s)}
            >
              {s.logo ? (
                <img src={logoUrl(s.id, logoMode)} alt={s.name} style={mobile ? logoSize(s.logo, 1900, 100, 22, 16) : logoSize(s.logo)} draggable={false} />
              ) : (
                <>
                  <i style={{ background: s.accent }} />
                  {s.name}
                </>
              )}
            </button>
          ))}
        </StreamCarousel>
      )}

      {!mobile && !noLeft && (
        <div className="scroll-y cats" data-nav-group="" data-nav-stop="left" style={{ position: 'absolute', left: L.px, top: top + streamRowH + 12, bottom: L.bottom, width: catW, padding: '3px 10px 3px 3px' }}>
          <button className={'cat' + (!cat ? ' on' : '')} data-nav="" data-nav-active={!cat ? '' : undefined} onFocus={() => { if (cat) { setCat(''); setQuery(''); } }} onClick={() => { setCat(''); setQuery(''); gridRef.current?.focus(); }}>
            <span className="cat-name">Todos</span>
            <span className="cat-count">{inStream.length.toLocaleString('pt-BR')}</span>
          </button>
          {cats.map((c) => (
            <button key={c.name} className={'cat' + (cat === c.name ? ' on' : '')} data-nav="" data-nav-active={cat === c.name ? '' : undefined} onFocus={() => { if (cat !== c.name) { setCat(c.name); setQuery(''); } }} onClick={() => { setCat(c.name); setQuery(''); gridRef.current?.focus(); }}>
              <span className="cat-name" title={c.name}>{c.name}</span>
              <span className="cat-count">{c.count.toLocaleString('pt-BR')}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ position: 'absolute', left: L.px + (mobile || noLeft ? 0 : catW + 18), right: L.px, top: top + streamRowH + 12, bottom: L.bottom, display: 'flex', flexDirection: 'column' }}>
        <div className="vod-tools">
          <div className="live-search" style={{ flexGrow: 1 }}>
            <span className="ic" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            </span>
            <input
              data-nav=""
              type="search"
              placeholder={`Buscar ${kindLabel}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.keyCode === 13) {
                  e.preventDefault();
                  gridRef.current?.focus();
                }
              }}
            />
            {voiceSupported() && <span className="live-voice"><VoiceButton size={36} onText={setQuery} /></span>}
          </div>
          {!mobile && !stacked && sortChips}
        </div>
        {!stacked && <div className="muted caps" style={{ fontSize: 14, fontWeight: 600, margin: '10px 4px 0', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {q ? `Busca: “${query.trim()}”` : topMode ? 'Top' : cat || (st ? st.name : `Todos os ${kindLabel}`)}
          </span>
          <span>{list.length.toLocaleString('pt-BR')} {kindLabel}</span>
        </div>}
        {mobile && !noLeft && !q && cats.length > 0 && catChips}
        {stacked ? (
          <div style={{ flexGrow: 1, minHeight: 0, position: 'relative', marginTop: 8 }}>
            <StackedRows
              key={stream}
              rows={rows}
              width={L.W - L.px * 2 - (mobile || noLeft ? 0 : catW + 18)}
              banner={st ? <StreamBanner s={st} count={inStream.length} kindLabel={kindLabel} top={!!stTop} genres={stGenres.length} /> : undefined}
              onPick={openDetail}
              tail={
                st && inStream.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div className="vod-tools" style={{ marginTop: 6 }}>
                      <span className="title" style={{ fontSize: mobile ? 19 : 22, flexShrink: 0 }}>
                        Todos · {st.name}
                      </span>
                      <span className="carousel-sub">{list.length.toLocaleString('pt-BR')} {kindLabel} na sua lista</span>
                      <div className="spacer" />
                      {!mobile && sortChips}
                    </div>
                    {cats.length > 1 && catChips}
                    <div style={{ flexGrow: 1, minHeight: 0, display: 'flex', marginTop: 6 }}>{grid}</div>
                  </div>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div style={{ flexGrow: 1, minHeight: 0, display: 'flex', marginTop: 6 }}>{grid}</div>
        )}
      </div>

      {detail && (
        <VodDetail
          playlist={playlist}
          item={detail}
          onClose={() => {
            setDetail(null);
            const back = lastFocus.current;
            requestAnimationFrame(() => (back && document.body.contains(back) ? focusEl(back) : gridRef.current?.focus()));
          }}
          onPlay={onPlay}
        />
      )}
    </>
  );
}

function countCats(items: Channel[]): { name: string; count: number }[] {
  const m = new Map<string, number>();
  for (const i of items) m.set(i.group, (m.get(i.group) ?? 0) + 1);
  return [...m.entries()].map(([name, count]) => ({ name, count }));
}

// ---------------------------------------------------------------- Detalhe

export function VodDetail({ playlist, item, onClose, onPlay }: { playlist: Playlist; item: Channel; onClose: () => void; onPlay: (item: Channel, startAt?: number, queue?: Channel[]) => void }) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const [info, setInfo] = useState<VodDetails | SeriesDetails | null>(null);
  const [failed, setFailed] = useState(false);
  const [season, setSeason] = useState<number | null>(null);
  const [epIndex, setEpIndex] = useState(0);
  const [saved, setSaved] = useState(inMyList(item.id));
  const box = useRef<HTMLDivElement>(null);
  const isSeries = item.kind === 'series' && !item.url;
  const xt = playlist.source.type === 'xtream' ? playlist.source : null;

  useEffect(() => {
    let alive = true;
    setInfo(null);
    setFailed(false);
    // Série de lista M3U: os episódios já vieram na lista.
    if (item.episodes) {
      const eps = item.episodes.map((e) => ({ ...e, plot: undefined, duration: undefined }));
      setInfo({ seasons: [...new Set(eps.map((e) => e.season))], episodes: eps });
      setSeason(eps[0]?.season ?? 1);
      return;
    }
    if (!xt) {
      setFailed(true);
      return;
    }
    const req: Promise<VodDetails | SeriesDetails> = isSeries ? seriesInfo(xt, item.id) : vodInfo(xt, item.id);
    req
      .then((r) => {
        if (!alive) return;
        setInfo(r);
        const seasons = (r as SeriesDetails).seasons;
        if (seasons && seasons.length) setSeason(seasons[0]);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    requestAnimationFrame(() => focusFirst(box.current));
    return pushBack(() => {
      onClose();
      return true;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const episodes: Episode[] = info && 'episodes' in info ? info.episodes.filter((e) => e.season === season) : [];
  const prog = !isSeries ? getProgress(item.id) : undefined;
  const asChannel = (e: Episode): Channel => ({
    id: e.id,
    kind: 'series',
    name: `${item.name} · T${e.season} E${e.number}${e.title && !/^epis/i.test(e.title) ? ' · ' + e.title : ''}`,
    group: item.name,
    logo: e.cover || item.logo,
    url: e.url,
    seriesId: item.id,
  });
  // Próximo episódio a assistir: o último com progresso, ou o 1º.
  const allEps = info && 'episodes' in info ? info.episodes : [];
  const resumeEp = allEps.find((e) => getProgress(e.id)) ?? allEps[0];
  const tm = useTmdb(item);
  const backdrop = tm?.backdrop || info?.backdrop || info?.cover || item.logo;
  const plot = info?.plot || tm?.overview;
  const [trailer, setTrailer] = useState<string | null>(null);

  return (
    <div className="vod-detail" data-nav-scope="" ref={box}>
      {backdrop && <img className="vd-backdrop" src={backdrop} alt="" referrerPolicy="no-referrer" />}
      <div className="vd-shade" />
      <div className="vd-body" style={{ left: L.px, right: L.px, top: mobile ? 20 : 50, bottom: mobile ? 20 : 36, flexDirection: mobile ? 'column' : 'row' }}>
        {!mobile && (
          <div style={{ width: 280, flexShrink: 0, marginRight: 36 }}>
            <PosterCard item={item} w={280} />
          </div>
        )}
        <div className="gy-14" style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <span className="title caps" style={{ fontSize: mobile ? 28 : 44, fontWeight: 800, lineHeight: 1.05 }}>{item.name}</span>
          <span className="vd-meta">
            {[info?.year ?? item.year, (info?.rating ?? item.rating) ? `★ ${(info?.rating ?? item.rating)!.toFixed(1).replace('.', ',')}` : null, info?.duration, info?.genre, item.group]
              .filter(Boolean)
              .join('  ·  ')}
          </span>
          {!info && !failed && <span className="muted">Carregando informações…</span>}
          {plot && <p className="vd-plot">{plot}</p>}
          {info?.cast && <span className="muted" style={{ fontSize: 15 }}><b style={{ color: '#D6D6E0' }}>Elenco:</b> {info.cast}</span>}
          {info?.director && <span className="muted" style={{ fontSize: 15 }}><b style={{ color: '#D6D6E0' }}>Direção:</b> {info.director}</span>}

          <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap', marginTop: 6 }}>
            {!isSeries && (
              <>
                <button className="btn primary" data-nav="" data-nav-default="" onClick={() => onPlay(item, prog?.pos)}>
                  ▶ {prog ? `Continuar (${Math.round((prog.pos / Math.max(1, prog.dur)) * 100)}%)` : 'Assistir'}
                </button>
                {prog && <button className="btn" data-nav="" onClick={() => onPlay(item, 0)}>Do início</button>}
              </>
            )}
            {isSeries && resumeEp && (
              <button className="btn primary" data-nav="" data-nav-default="" onClick={() => onPlay(asChannel(resumeEp), getProgress(resumeEp.id)?.pos, allEps.map(asChannel))}>
                ▶ {getProgress(resumeEp.id) ? 'Continuar' : 'Assistir'} T{resumeEp.season} E{resumeEp.number}
              </button>
            )}
            {tm && (
              <button className="btn" data-nav="" onClick={async () => setTrailer((await trailerOf(tm)) ?? '')}>▶ Trailer</button>
            )}
            <button className="btn" data-nav="" onClick={() => setSaved(toggleMyList(item))}>{saved ? '✓ Na Minha lista' : '+ Minha lista'}</button>
            <button className="btn" data-nav="" onClick={onClose}>Voltar</button>
          </div>

          {isSeries && info && 'seasons' in info && (
            <div className="gy-10" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0, marginTop: 8 }}>
              <div className="scroll-x">
                {info.seasons.map((s) => (
                  <button key={s} className={'chip' + (s === season ? ' on' : '')} data-nav="" onClick={() => { setSeason(s); setEpIndex(0); }} onFocus={() => { if (s !== season) { setSeason(s); setEpIndex(0); } }}>
                    Temporada {s}
                  </button>
                ))}
              </div>
              <div style={{ flexGrow: 1, minHeight: mobile ? 260 : 0, display: 'flex' }}>
                <VirtualList
                  items={episodes}
                  index={epIndex}
                  onIndex={setEpIndex}
                  rowHeight={58}
                  label="Episódios"
                  onPick={(e) => onPlay(asChannel(e), getProgress(e.id)?.pos, allEps.map(asChannel))}
                  render={(e) => {
                    const p = getProgress(e.id);
                    return (
                      <>
                        <span className="num">{e.number}</span>
                        <div className="txt">
                          <span className="name" style={{ textTransform: 'none' }}>{e.title}</span>
                        </div>
                        {e.duration && <span className="muted" style={{ fontSize: 14 }}>{e.duration}</span>}
                        {p && p.dur ? <span className="ep-prog"><span style={{ width: `${(p.pos / p.dur) * 100}%` }} /></span> : null}
                      </>
                    );
                  }}
                  empty={<span className="muted" style={{ padding: 12 }}>Nenhum episódio nesta temporada.</span>}
                />
              </div>
            </div>
          )}
          {isSeries && failed && <span className="muted">Não foi possível carregar os episódios desta série.</span>}
          {!isSeries && failed && !xt && <span className="muted">Detalhes completos só em listas Xtream.</span>}
        </div>
      </div>
      {!backdrop && <span aria-hidden="true" className="vd-ghost">{initials(item.name)}</span>}
      {trailer !== null && (
        <Modal title={`Trailer · ${item.name}`} onClose={() => setTrailer(null)} width={Math.min(1100, L.W - 40)}>
          {trailer ? (
            <iframe
              className="trailer"
              src={`https://www.youtube.com/embed/${trailer}?autoplay=1&rel=0`}
              title="Trailer"
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
              style={{ height: Math.round((Math.min(1100, L.W - 40) - 56) * 0.5625) }}
            />
          ) : (
            <span className="muted">O TMDB não tem trailer para este título.</span>
          )}
          <div className="wrap-row" style={{ display: 'flex' }}>
            <button className="btn primary" data-nav="" data-nav-default="" onClick={() => setTrailer(null)}>Fechar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Minha lista

export function MyList({ playlist, onPlay }: { playlist: Playlist; onPlay: (item: Channel, startAt?: number, queue?: Channel[]) => void }) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const [items, setItems] = useState<Channel[]>(myList);
  const [index, setIndex] = useState(0);
  const [detail, setDetail] = useState<Channel | null>(null);
  const gridRef = useRef<VirtualGridHandle>(null);
  useEffect(() => {
    requestAnimationFrame(() => gridRef.current?.focus());
  }, []);
  return (
    <>
      <div style={{ position: 'absolute', left: L.px, right: L.px, top: L.top + (mobile ? 0 : 10), bottom: L.bottom, display: 'flex', flexDirection: 'column' }}>
        <span className="title" style={{ fontSize: mobile ? 24 : 30, fontWeight: 800 }}>Minha lista</span>
        <span className="muted" style={{ fontSize: 15, margin: '6px 0 8px' }}>
          {items.length ? `${items.length} títulos salvos para ver depois.` : 'Abra um filme ou série e toque em “+ Minha lista” para salvar aqui. Os canais favoritos ficam em Ao vivo › Favoritos.'}
        </span>
        <div style={{ flexGrow: 1, minHeight: 0, display: 'flex' }}>
          <VirtualGrid
            ref={gridRef}
            items={items}
            index={index}
            onIndex={setIndex}
            onPick={(it) => setDetail(it)}
            minCellW={mobile ? 104 : 168}
            ratio={1.5}
            extraH={mobile ? 58 : 56}
            gap={mobile ? 10 : 18}
            label="Minha lista"
            render={(it, _i, sel, w) => <PosterCard item={it} w={w} selected={sel} />}
          />
        </div>
      </div>
      {detail && (
        <VodDetail
          playlist={playlist}
          item={detail}
          onPlay={onPlay}
          onClose={() => {
            setDetail(null);
            setItems(myList());
            requestAnimationFrame(() => gridRef.current?.focus());
          }}
        />
      )}
    </>
  );
}

/** Fileira de streamings em carrossel: setas ‹ › quando não cabe tudo
 * (no controle, a fileira acompanha o foco; no celular, arrasta com o dedo). */
function StreamCarousel({ style, children }: { style: React.CSSProperties; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ l: false, r: false });
  const update = () => {
    const b = box.current;
    if (!b) return;
    setEdge({ l: b.scrollLeft > 4, r: b.scrollLeft + b.clientWidth < b.scrollWidth - 4 });
  };
  useEffect(() => {
    update();
    const t = setTimeout(update, 400);
    window.addEventListener('resize', update);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', update);
    };
  });
  const go = (dir: number) => {
    const b = box.current;
    if (!b) return;
    // Avança de botão em botão (sem parar no meio de um logotipo).
    const chips = Array.prototype.slice.call(b.children) as HTMLElement[];
    if (!chips.length) return;
    const base = chips[0].offsetLeft;
    // primeiro botão inteiro à vista
    let first = 0;
    while (first < chips.length - 1 && chips[first].offsetLeft - base < b.scrollLeft - 2) first++;
    const step = chips.length > 2 ? chips[2].offsetLeft - chips[1].offsetLeft : 170;
    const per = Math.max(1, Math.floor((b.clientWidth - 60) / step));
    const to = Math.max(0, Math.min(chips.length - 1, first + dir * per));
    b.scrollLeft = Math.max(0, Math.min(b.scrollWidth - b.clientWidth, to === 0 ? 0 : chips[to].offsetLeft - base - 44));
    update();
  };
  return (
    <div className="stream-carousel" style={style}>
      <div ref={box} className={'scroll-x stream-row' + (edge.l ? ' fade-l' : '') + (edge.r ? ' fade-r' : '')} style={{ height: '100%' }} onScroll={update} onFocus={() => setTimeout(update, 0)}>
        {children}
      </div>
      {edge.l && (
        <button className="stream-arrow left" aria-label="Streamings anteriores" onClick={() => go(-1)}>
          ‹
        </button>
      )}
      {edge.r && (
        <button className="stream-arrow right" aria-label="Mais streamings" onClick={() => go(1)}>
          ›
        </button>
      )}
    </div>
  );
}
