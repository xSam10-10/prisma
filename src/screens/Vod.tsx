import { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { useSettings } from '../core/settings';
import { applyStreamSkin } from '../ui/themes';
import type { Channel, ItemKind, Playlist } from '../core/types';
import { ANIME, STREAMINGS, getProgress, inMyList, isWatched, nextToWatch, removeFromContinue, setWatched, collapseVersions, versionLabels, versionsOf, logoSize, logoUrl, myList, streamingsIn, toggleMyList, type Streaming } from '../core/vod';
import { seriesInfo, vodInfo, type Episode, type SeriesDetails, type VodDetails } from '../core/xtream';
import { Symbol, colorFor, initials, rgba } from '../ui/bits';
import { PreviewBackdrop, SkeletonRow, TitleLogo, badgesOf, setPreview } from '../ui/premium';
import { Carousel } from '../ui/Carousel';
import { useLayout } from '../ui/layout';
import { focusEl, focusFirst, pushBack } from '../ui/nav';
import { VirtualGrid, type VirtualGridHandle } from '../ui/VirtualGrid';
import { VirtualList } from '../ui/VirtualList';
import { VoiceButton, voiceSupported } from '../ui/Voice';
import { useTmdb } from '../ui/useTmdb';
import { castOf, episodesOf, personOf, ratingOf, searchTitle, similarOf, trailerOf, type CastMember, type Person } from '../core/tmdb';
import { collectionsIn, findInList, matchedLists, streamCatalog, streamGenreLists, type Collection, type MatchedList } from '../core/tops';
import { CollectionCard, EmptyState, GenreCard, PosterTile, pop, toast, useDominantColor } from '../ui/premium2';
import { StackedRows, StreamBanner, type Row } from './TopRows';
import { useTopsState } from '../ui/useTops';
import { categoryColumnWidth } from '../ui/catColumn';
import { Modal } from '../ui/Dialog';
import { fuzzyMatch } from '../core/fuzzy';
import { hasEpAlert, newEpisodeOf, onNewEpisodes, toggleEpAlert } from '../core/newEpisodes';
import { ZoomFrom } from '../ui/premium4';

// Filmes · Séries · Anime: streamings no topo, categorias à esquerda,
// grade de capas com busca; OK abre o detalhe (sinopse, elenco, episódios).

export type VodTab = 'filmes' | 'series' | 'anime';

function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Capa (2:3) com título, ano/nota, selos e progresso. Sem imagem: arte automática (cor da categoria + símbolo). */
export function PosterCard({ item, w, selected, rank }: { item: Channel; w: number; selected?: boolean; rank?: number }) {
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const tm = useTmdb(item);
  const img = tm?.poster || item.logo;
  useEffect(() => {
    setBroken(false);
    setLoaded(false);
  }, [img]);
  const p = getProgress(item.id);
  const c = colorFor(item.group || item.name);
  const [, tick] = useState(0);
  useEffect(() => (item.kind === 'series' ? onNewEpisodes(() => tick((x) => x + 1)) : undefined), [item.kind]);
  const badges = badgesOf(item);
  return (
    <div className={'poster' + (selected ? ' sel' : '') + (badges.some((b) => b.k === 'newep') ? ' newep' : '')}>
      <div className="poster-art" style={{ height: Math.round(w * 1.5), background: `linear-gradient(160deg, ${rgba(c, 0.6)} 0%, ${rgba(c, 0.18)} 45%, #12121a 100%)` }}>
        {(!img || broken || !loaded) && (
          <div className="poster-fb" aria-hidden={!!img && !broken}>
            <Symbol size={Math.round(w * 0.9)} />
            {(!img || broken) && (
              <>
                <span className="pfb-name" style={{ fontSize: Math.max(14, Math.round(w / 9)) }}>{item.name}</span>
                <span className="pfb-line" style={{ background: c }} />
              </>
            )}
          </div>
        )}
        {img && !broken && <img className={'fade-img' + (loaded ? ' in' : '')} src={img} alt="" loading="lazy" referrerPolicy="no-referrer" onLoad={() => setLoaded(true)} onError={() => setBroken(true)} />}
        {badges.length > 0 && (
          <span className="pbadges">
            {badges.map((b) => (
              <span key={b.t} className={'pbadge ' + b.k}>{b.t}</span>
            ))}
          </span>
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
// Número grande só em ranking de verdade (Top 10 de streaming/gênero/especial), em sequência 1, 2, 3…
const toRow = (l: MatchedList, ranked = l.group !== 'geral'): Row => ({ id: l.id, title: l.title, src: l.src, items: l.items.map((r, i) => ({ item: r.item, rank: i + 1 })), ranked });

export function VodScreen({ playlist, tab, onPlay }: { playlist: Playlist; tab: VodTab; onPlay: (item: Channel, startAt?: number, queue?: Channel[]) => void }) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const { settings } = useSettings();
  const logoMode = settings.streamLogos ?? 'color';
  const skinOn = settings.streamSkin !== false;
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
  // Visual de cada streaming (0.27.0): ao entrar na Netflix, o app veste o visual dela; ao sair, volta o tema do usuário.
  useLayoutEffect(() => {
    applyStreamSkin(st && skinOn ? st : null);
  }, [st?.id, skinOn]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => applyStreamSkin(null), []);

  const byCats = useMemo(() => (st ? all.filter((i) => st.match.test(i.group)) : all), [all, st]);
  // Tops (Netflix oficial, mais populares de cada streaming, gêneros…), só com títulos da lista
  const { data: tops, ready: topsReady } = useTopsState(playlist);
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
  // Conteúdo do streaming: pelas categorias da lista; se ela não separa por streaming
  // (comum em Filmes), pelo catálogo do streaming no TMDB cruzado com a lista.
  const fromCatalog = !!st && byCats.length === 0;
  const inStream = useMemo(
    () => (st && byCats.length === 0 && tab !== 'anime' ? streamCatalog(tops, playlist.items, kindKey, st.id) : byCats),
    [st, byCats, tops, playlist, kindKey, tab],
  );
  // Gêneros do streaming escolhido (ex.: Terror no HBO Max)
  const stGenres = useMemo(() => (st && tab !== 'anime' ? streamGenreLists(tops, playlist.items, kindKey, st.id) : []), [tops, playlist, st, tab, kindKey]);
  // Adicionados recentemente: os 10 últimos que chegaram na lista
  const recentRow = useMemo<Row | null>(() => {
    const r = all.filter((i) => i.added).sort((a, b) => (b.added ?? 0) - (a.added ?? 0)).slice(0, 10);
    return r.length ? { id: 'recent', title: 'Adicionados recentemente', src: `Os últimos ${tab === 'filmes' ? 'filmes' : 'títulos'} que chegaram na sua lista`, items: r.map((item, i) => ({ item, rank: i + 1 })), ranked: false } : null;
  }, [all, tab]);
  // Coleções e sagas (TMDB) com 2+ filmes da lista
  const colls = useMemo(() => (tab === 'filmes' ? collectionsIn(tops, playlist.items) : []), [tops, playlist, tab]);
  const [coll, setColl] = useState<Collection | null>(null);
  const collRow: Row = {
    id: 'colecoes',
    title: 'Coleções e sagas',
    src: 'Os filmes da sua lista em ordem de lançamento',
    items: [],
    ranked: false,
    minWidth: mobile ? 240 : 340,
    cards: colls.map((c) => ({ key: c.id, node: (w: number) => <CollectionCard title={c.title} backdrop={c.backdrop} items={c.items} w={w} onClick={() => setColl(c)} /> })),
  };
  // Listas empilhadas (carrosséis): Top = todas; streaming = Top 10 dele + gêneros dele.
  const rows = useMemo<Row[]>(() => {
    if (topMode) {
      const out: Row[] = [...(recentRow ? [recentRow] : [])];
      const genres = topLists.filter((l) => l.group === 'genero' && l.items.length >= 3);
      topLists.forEach((l, i) => {
        // Antes dos especiais: Coleções e sagas (Filmes). Antes dos gêneros: cartões "Explorar por gênero".
        if (l.group === 'especial' && topLists[i - 1]?.group !== 'especial' && colls.length) out.push(collRow);
        if (l.group === 'genero' && topLists[i - 1]?.group !== 'genero' && genres.length >= 3)
          out.push({
            id: 'explorar',
            title: 'Explorar por gênero',
            src: 'Escolha um gênero para ir até a lista',
            items: [],
            ranked: false,
            minWidth: mobile ? 200 : 250,
            cards: genres.map((g) => ({
              key: g.id,
              node: (w: number) => <GenreCard title={g.title} items={g.items.map((r) => r.item)} w={w} onClick={() => focusFirst(document.querySelector<HTMLElement>(`[data-row-id="${g.id}"]`))} />,
            })),
          });
        out.push(toRow(l));
      });
      if (colls.length && !out.includes(collRow)) out.push(collRow);
      return out;
    }
    if (st) return [...(stTop ? [toRow(stTop)] : []), ...stGenres.map((g) => toRow(g, false))];
    return [];
  }, [topMode, st, recentRow, topLists, stTop, stGenres, colls]); // eslint-disable-line react-hooks/exhaustive-deps
  const pickStream = (s: Streaming) => {
    setStream(s.id);
    setCat('');
    setQuery('');
  };
  // Coluna/chips de categorias: Todos › lançamentos (ex.: "Top Lançamentos 2026") › Últimos adicionados › as demais.
  const cats = useMemo(() => {
    const all = countCats(inStream);
    const launch = all.filter((c) => LAUNCH.test(c.name));
    const rest = all.filter((c) => !LAUNCH.test(c.name));
    const rec = Math.min(RECENT_MAX, inStream.filter((i) => i.added).length);
    return [...launch, ...(rec ? [{ name: RECENT, count: rec, label: 'Últimos adicionados' }] : []), ...rest];
  }, [inStream]);
  const q = norm(query.trim());
  const list = useMemo(() => {
    if (!q && topMode) return [];
    let l = q
      ? (() => {
          const ex = all.filter((i) => norm(i.fullName ?? i.name).includes(q));
          return ex.length >= 8 || q.length < 4 ? ex : [...ex, ...all.filter((i) => !ex.includes(i) && fuzzyMatch(i.fullName ?? i.name, q))];
        })()
      : cat === RECENT
        ? inStream.filter((i) => i.added).sort((a, b) => (b.added ?? 0) - (a.added ?? 0)).slice(0, RECENT_MAX)
        : cat
          ? inStream.filter((i) => i.group === cat)
          : inStream;
    if (sort === 'az') l = [...l].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    else if (sort === 'rating') l = [...l].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    else l = [...l].sort((a, b) => (b.added ?? 0) - (a.added ?? 0));
    // Mesmo título em várias versões (Dublado, Legendado, 4K): uma capa só; a versão escolhe no detalhe.
    return collapseVersions(l);
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
        <button key={c.name} className={'chip' + (cat === c.name ? ' on' : '')} data-nav="" onClick={() => setCat(c.name)}>{c.label ?? c.name}</button>
      ))}
    </div>
  );
  const grid = (
    <VirtualGrid
      ref={gridRef}
      items={list}
      index={index}
      onIndex={(i) => {
        setIndex(i);
        setPreview(list[i] ?? null);
      }}
      onPick={openDetail}
      minCellW={mobile ? 104 : 168}
      ratio={1.5}
      extraH={mobile ? 58 : 56}
      gap={mobile ? 10 : 18}
      label={title}
      render={(it, _i, sel, w) => <PosterCard item={it} w={w} selected={sel} />}
      empty={
        topMode && !q ? (
          <EmptyState kind="empty" title="Os Tops ainda não chegaram" text={`Eles se completam quando a chave do TMDB estiver no GitHub (secret TMDB_KEY) — veja Ajustes › Serviços.`} />
        ) : (
          <EmptyState kind="search" title="Nada encontrado" text="Tente outra palavra ou outra categoria." />
        )
      }
    />
  );

  return (
    <>
      {st && (
        <div aria-hidden="true" className="stream-art" style={{ background: `radial-gradient(ellipse 60% 70% at 85% 10%, ${rgba(st.accent, 0.45)} 0%, rgba(0,0,0,0) 70%), radial-gradient(ellipse 50% 60% at 10% 90%, ${rgba(st.accent2, 0.35)} 0%, rgba(0,0,0,0) 70%), ${st.bg}` }} />
      )}
      <PreviewBackdrop strength={st ? 0.3 : 0.4} />
      {showRow && (
        <StreamCarousel style={{ position: 'absolute', left: L.px, right: L.px, top, height: streamRowH }}>
          <button className={'stream-chip' + (!stream ? ' on' : '')} data-nav="" onClick={() => { setStream(''); setCat(''); }}>Todos</button>
          <button className={'stream-chip topchip' + (topMode ? ' on' : '')} data-nav="" aria-label="Top: listas de recomendações" onClick={openTop}>
            🔥 Top
          </button>
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
              <span className="cat-name" title={c.label ?? c.name}>{c.label ?? c.name}</span>
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
            {q ? `Busca: “${query.trim()}”` : topMode ? 'Top' : cat === RECENT ? `Últimos adicionados · os ${RECENT_MAX} mais novos da lista` : cat || (st ? st.name : `Todos os ${kindLabel}`)}
          </span>
          <span>{list.length.toLocaleString('pt-BR')} {kindLabel}</span>
        </div>}
        {mobile && !noLeft && !q && cats.length > 0 && catChips}
        {topMode && !q && !topsReady && !rows.length ? (
          <div style={{ flexGrow: 1, minHeight: 0, marginTop: 8, marginLeft: -L.px, marginRight: -L.px, overflow: 'hidden' }}>
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : stacked ? (
          <div style={{ flexGrow: 1, minHeight: 0, position: 'relative', marginTop: 8 }}>
            <StackedRows
              key={stream}
              rows={rows}
              width={L.W - L.px * 2 - (mobile || noLeft ? 0 : catW + 18)}
              banner={st ? (c: boolean) => <StreamBanner s={st} count={inStream.length} kindLabel={kindLabel} top={!!stTop} genres={stGenres.length} compact={c} /> : undefined}
              onPick={openDetail}
              tail={
                st && inStream.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div className="vod-tools" style={{ marginTop: 6 }}>
                      <span className="title" style={{ fontSize: mobile ? 19 : 22, flexShrink: 0 }}>
                        Todos · {st.name}
                      </span>
                      <span className="carousel-sub">
                        {list.length.toLocaleString('pt-BR')} {kindLabel} na sua lista{fromCatalog ? ` que estão no ${st.name} (TMDB)` : ''}
                      </span>
                      <div className="spacer" />
                      {!mobile && sortChips}
                    </div>
                    {tab === 'filmes' && cats.length > 1 && catChips /* Séries: sem chips de categoria (pedido 09/11) */}
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

      {coll && <CollectionView playlist={playlist} c={coll} onPlay={onPlay} onClose={() => setColl(null)} />}
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

/** Categoria especial "Últimos adicionados" (os mais novos da lista) e categorias de lançamentos. */
const RECENT = '__recentes__';
const RECENT_MAX = 100;
const LAUNCH = /lan[cç]amento/i;

function countCats(items: Channel[]): { name: string; count: number; label?: string }[] {
  const m = new Map<string, number>();
  for (const i of items) m.set(i.group, (m.get(i.group) ?? 0) + 1);
  return [...m.entries()].map(([name, count]) => ({ name, count }));
}

// ---------------------------------------------------------------- Detalhe

export function VodDetail({ playlist, item: initial, onClose, onPlay }: { playlist: Playlist; item: Channel; onClose: () => void; onPlay: (item: Channel, startAt?: number, queue?: Channel[]) => void }) {
  // "Semelhantes" abre outro título aqui mesmo.
  const [item, setItem] = useState(initial);
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const [info, setInfo] = useState<VodDetails | SeriesDetails | null>(null);
  const [failed, setFailed] = useState(false);
  const [season, setSeason] = useState<number | null>(null);
  const [epIndex, setEpIndex] = useState(0);
  const [saved, setSaved] = useState(inMyList(item.id));
  // Abriu um "Semelhante": volta ao alto com o foco no Assistir.
  const firstItem = useRef(item.id);
  useEffect(() => {
    setSaved(inMyList(item.id));
    if (item.id === firstItem.current) return;
    const sc = box.current?.querySelector<HTMLElement>('.vd-scroll');
    if (sc) sc.scrollTop = 0;
    requestAnimationFrame(() => focusFirst(box.current));
  }, [item.id]);
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
  const resumeEp = nextToWatch(allEps);
  // A série abre na temporada do próximo episódio, com ele selecionado.
  const placed = useRef('');
  useEffect(() => {
    if (!resumeEp || placed.current === item.id) return;
    placed.current = item.id;
    setSeason(resumeEp.season);
    setEpIndex(Math.max(0, allEps.filter((e) => e.season === resumeEp.season).indexOf(resumeEp)));
  }, [resumeEp?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const tm = useTmdb(item);
  const backdrop = tm?.backdrop || info?.backdrop || info?.cover || item.logo;
  const plot = info?.plot || tm?.overview;
  const [trailer, setTrailer] = useState<string | null>(null);
  const [bgOk, setBgOk] = useState(false);
  useEffect(() => setBgOk(false), [backdrop]);
  // Classificação indicativa (TMDB, Brasil), página do ator e "vistos" (re-desenha ao marcar).
  const [cert, setCert] = useState<string | undefined>();
  const [actor, setActor] = useState<CastMember | null>(null);
  const [, bump] = useState(0);
  useEffect(() => {
    setCert(undefined);
    if (!tm) return;
    let alive = true;
    ratingOf(tm).then((c) => alive && setCert(c));
    return () => {
      alive = false;
    };
  }, [tm?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Série: próximo episódio a sair ("Me avise") e episódio novo.
  const [nextEp, setNextEp] = useState<{ date: string; season: number; episode: number } | null>(null);
  const [alert, setAlert] = useState(false);
  useEffect(() => {
    setNextEp(null);
    setAlert(hasEpAlert(item.id));
    if (!tm || item.kind !== 'series') return;
    let alive = true;
    episodesOf(tm).then((r) => alive && r.next && Date.parse(r.next.date + 'T12:00:00') > Date.now() - 86400000 && setNextEp(r.next));
    return () => {
      alive = false;
    };
  }, [tm?.id, item.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const freshEp = item.kind === 'series' ? newEpisodeOf(item.id) : undefined;
  // Elenco com foto e "Semelhantes" (TMDB, só o que existe na lista)
  const [cast, setCast] = useState<CastMember[]>([]);
  const [similar, setSimilar] = useState<Channel[]>([]);
  useEffect(() => {
    setCast([]);
    setSimilar([]);
    if (!tm) return;
    let alive = true;
    castOf(tm).then((c) => alive && setCast(c.filter((x) => x.photo).slice(0, 12)));
    similarOf(tm).then((r) => {
      if (!alive) return;
      const out: Channel[] = [];
      for (const x of r) {
        const hit = findInList({ t: x.title, o: x.original, y: x.year }, tm.type, playlist.items);
        if (hit && hit.id !== item.id && !out.some((o) => o.id === hit.id)) out.push(hit);
        if (out.length >= 10) break;
      }
      setSimilar(out);
    });
    return () => {
      alive = false;
    };
  }, [tm?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const meta = [info?.year ?? item.year ?? tm?.year, info?.duration, info?.genre].filter(Boolean) as (string | number)[];
  // Paleta do título: cor dominante do pôster no brilho do fundo e no botão principal.
  const tint = useDominantColor(tm?.poster, colorFor(item.name));
  const rating = info?.rating ?? item.rating ?? tm?.rating;
  const badges = badgesOf(item).filter((b) => b.k !== 'newep');
  const epH = mobile ? 92 : 112;
  return (
    <div className="vod-detail screen-in" data-nav-scope="" ref={box}>
      <ZoomFrom />
      {backdrop && <img className={'vd-backdrop fade-img' + (bgOk ? ' in' : '')} src={backdrop} alt="" referrerPolicy="no-referrer" onLoad={() => setBgOk(true)} />}
      <div className="vd-shade" />
      <div className="vd-tint" style={{ background: `radial-gradient(ellipse 60% 70% at 15% 85%, ${rgba(tint, 0.28)} 0%, rgba(0,0,0,0) 70%)` }} />
      <div className="scroll-y vd-scroll" style={{ padding: `${mobile ? 20 : 54}px ${L.px}px 60px` }}>
        <div className="vd-hero" style={{ minHeight: mobile ? undefined : Math.round(L.H * 0.56), maxWidth: mobile ? undefined : Math.round(L.W * 0.52) }}>
          <TitleLogo info={tm} name={item.name} height={mobile ? 70 : 120} maxW={mobile ? L.W - L.px * 2 : Math.round(L.W * 0.42)} className="vd-logo" />
          <span className="title caps vd-title" style={{ fontSize: mobile ? 28 : 46 }}>{item.name}</span>
          <div className="vd-pills">
            {cert && <CertBadge c={cert} />}
            {rating ? <span className="vd-pill rate">★ {rating.toFixed(1).replace('.', ',')}</span> : null}
            {meta.map((m) => <span key={String(m)} className="vd-pill">{m}</span>)}
            {badges.map((b) => <span key={b.t} className={'pbadge ' + b.k}>{b.t}</span>)}
            <span className="vd-pill ghost">{item.group}</span>
          </div>
          {(() => {
            const vers = versionsOf(item, playlist.items);
            if (vers.length < 2) return null;
            return (
              <div className="versions">
                <span className="muted">Versões:</span>
                {(() => {
                  const vs = vers.slice(0, 6);
                  const labels = versionLabels(vs);
                  return vs.map((v, k) => (
                    <button key={v.id} className={'chip' + (v.id === item.id ? ' on' : '')} data-nav="" onClick={() => v.id !== item.id && setItem(v)}>
                      {labels[k]}
                    </button>
                  ));
                })()}
              </div>
            );
          })()}
          {(nextEp || freshEp) && (
            <span className="next-ep-line">
              {freshEp && <b className="newep-tag">NOVO EPISÓDIO · T{freshEp.s} E{freshEp.e}</b>}
              {nextEp && <span>Próximo: T{nextEp.season} E{nextEp.episode} · {new Date(nextEp.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}</span>}
            </span>
          )}
          {!info && !failed && <span className="muted">Carregando informações…</span>}
          {plot && <p className="vd-plot">{plot}</p>}
          {info?.director && <span className="muted" style={{ fontSize: 15 }}><b style={{ color: '#D6D6E0' }}>Direção:</b> {info.director}</span>}
          {!cast.length && info?.cast && <span className="muted" style={{ fontSize: 15 }}><b style={{ color: '#D6D6E0' }}>Elenco:</b> {info.cast}</span>}

          <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap', marginTop: 10 }}>
            {!isSeries && (
              <>
                <button className="btn primary" data-nav="" data-nav-default="" style={{ boxShadow: `0 12px 34px ${rgba(tint, 0.55)}` }} onClick={() => onPlay(item, prog?.pos)}>
                  ▶ {prog ? `Continuar (${Math.round((prog.pos / Math.max(1, prog.dur)) * 100)}%)` : 'Assistir'}
                </button>
                {prog && <button className="btn" data-nav="" onClick={() => onPlay(item, 0)}>Do início</button>}
                <button
                  className={'btn' + (isWatched(item.id) ? ' on-alert' : '')}
                  data-nav=""
                  onClick={(e) => {
                    const on = !isWatched(item.id);
                    setWatched([item.id], on);
                    if (on) removeFromContinue([item.id]);
                    pop(e.currentTarget);
                    toast(on ? 'Marcado como visto' : 'Desmarcado', on ? '✓' : '✕');
                    bump((x) => x + 1);
                  }}
                >
                  {isWatched(item.id) ? '✓ Visto' : 'Marcar como visto'}
                </button>
              </>
            )}
            {isSeries && resumeEp && (
              <button className="btn primary" data-nav="" data-nav-default="" style={{ boxShadow: `0 12px 34px ${rgba(tint, 0.55)}` }} onClick={() => onPlay(asChannel(resumeEp), getProgress(resumeEp.id)?.pos, allEps.map(asChannel))}>
                ▶ {getProgress(resumeEp.id) ? 'Continuar' : 'Assistir'} T{resumeEp.season} E{resumeEp.number}
              </button>
            )}
            {tm && (
              <button className="btn" data-nav="" onClick={async () => setTrailer((await trailerOf(tm)) ?? '')}>▶ Trailer</button>
            )}
            <button
              className="btn"
              data-nav=""
              onClick={(e) => {
                const on = toggleMyList(item);
                setSaved(on);
                pop(e.currentTarget);
                toast(on ? 'Adicionado à Minha lista' : 'Removido da Minha lista', on ? '✓' : '✕');
              }}
            >
              {saved ? '✓ Na Minha lista' : '+ Minha lista'}
            </button>
            {nextEp && (
              <button
                className={'btn' + (alert ? ' on-alert' : '')}
                data-nav=""
                onClick={(e) => {
                  const on = toggleEpAlert({ id: item.id, name: item.name, date: nextEp.date, s: nextEp.season, e: nextEp.episode });
                  setAlert(on);
                  pop(e.currentTarget);
                  toast(on ? `Vamos avisar quando sair T${nextEp.season} E${nextEp.episode}` : 'Aviso cancelado', on ? '🔔' : '✕');
                }}
              >
                {alert ? '🔔 Aviso ligado' : '🔔 Me avise'}
              </button>
            )}
            <button className="btn" data-nav="" onClick={onClose}>Voltar</button>
          </div>
        </div>

        {isSeries && info && 'seasons' in info && (
          <section className="vd-sec">
            <span className="title vd-h">Episódios</span>
            <div className="scroll-x" style={{ marginTop: 10 }}>
              {info.seasons.map((s) => (
                <button key={s} className={'chip' + (s === season ? ' on' : '')} data-nav="" onClick={() => { setSeason(s); setEpIndex(0); }} onFocus={() => { if (s !== season) { setSeason(s); setEpIndex(0); } }}>
                  Temporada {s}
                </button>
              ))}
            </div>
            {episodes.length > 0 && (() => {
              const seen = episodes.filter((e) => isWatched(e.id)).length;
              const all = seen === episodes.length;
              return (
                <div className="season-bar">
                  <span className="season-txt">
                    <b>Temporada {season}</b> · {seen} de {episodes.length} {seen === 1 ? 'visto' : 'vistos'}
                    {seen > 0 && !all ? ` · faltam ${episodes.length - seen}` : all ? ' · concluída ✓' : ''}
                  </span>
                  <span className="season-prog"><span style={{ width: `${(seen / episodes.length) * 100}%` }} /></span>
                  <button
                    className="chip"
                    data-nav=""
                    onClick={() => {
                      setWatched(episodes.map((e) => e.id), !all);
                      toast(all ? `Temporada ${season} desmarcada` : `Temporada ${season} marcada como vista`, all ? '✕' : '✓');
                      bump((x) => x + 1);
                    }}
                  >
                    {all ? 'Desmarcar temporada' : '✓ Marcar temporada como vista'}
                  </button>
                  {info && 'episodes' in info && info.seasons.length > 1 && (() => {
                    const allSeen = info.episodes.every((e) => isWatched(e.id));
                    return (
                      <button
                        className="chip"
                        data-nav=""
                        onClick={() => {
                          setWatched(info.episodes.map((e) => e.id), !allSeen);
                          if (!allSeen) removeFromContinue([...info.episodes.map((e) => e.id), item.id]);
                          toast(allSeen ? 'Série desmarcada' : 'Série inteira marcada como vista', allSeen ? '✕' : '✓');
                          bump((x) => x + 1);
                        }}
                      >
                        {allSeen ? 'Desmarcar série' : '✓ Série toda vista'}
                      </button>
                    );
                  })()}
                </div>
              );
            })()}
            <div style={{ height: Math.min(episodes.length || 1, mobile ? 4 : 4.4) * epH + 8, display: 'flex', marginTop: 10 }}>
              <VirtualList
                items={episodes}
                index={epIndex}
                onIndex={setEpIndex}
                rowHeight={epH}
                label="Episódios"
                onPick={(e) => onPlay(asChannel(e), getProgress(e.id)?.pos, allEps.map(asChannel))}
                render={(e) => {
                  const p = getProgress(e.id);
                  const thumb = e.cover || tm?.backdrop || info.backdrop || item.logo;
                  return (
                    <div className="ep-card">
                      <span className="ep-thumb" style={{ width: Math.round((epH - 16) * 1.7), height: epH - 16 }}>
                        {thumb && <img src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" />}
                        <span className="ep-num">{e.number}</span>
                        {isWatched(e.id) ? <span className="ep-seen" title="Visto">✓</span> : null}
                        {isWatched(e.id) ? <span className="ep-bar"><span style={{ width: '100%', background: '#46D369' }} /></span> : p && p.dur ? <span className="ep-bar"><span style={{ width: `${(p.pos / p.dur) * 100}%` }} /></span> : null}
                      </span>
                      <span className="ep-txt">
                        <b>{e.title}</b>
                        {e.plot && !mobile ? <span className="ep-plot">{e.plot}</span> : null}
                        {e.duration ? <span className="ep-dur">{e.duration}</span> : null}
                      </span>
                    </div>
                  );
                }}
                empty={<span className="muted" style={{ padding: 12 }}>Nenhum episódio nesta temporada.</span>}
              />
            </div>
          </section>
        )}
        {isSeries && failed && <span className="muted">Não foi possível carregar os episódios desta série.</span>}
        {!isSeries && failed && !xt && <span className="muted">Detalhes completos só em listas Xtream.</span>}

        {cast.length > 0 && (
          <div className="vd-sec-wide" style={{ marginLeft: -L.px, marginRight: -L.px }}>
            <Carousel
              title="Elenco"
              items={cast}
              keyOf={(c) => c.name}
              minWidth={mobile ? 96 : 132}
              render={(c, _i, w) => (
                <button className="tile grow cast" data-nav="" style={{ width: w }} aria-label={c.name} onClick={() => c.id && setActor(c)}>
                  <span className="cast-face" style={{ width: Math.min(w - 10, 120), height: Math.min(w - 10, 120), background: `linear-gradient(150deg, ${rgba(colorFor(c.name), 0.6)}, #15151F)` }}>
                    {c.photo ? <img src={c.photo} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span>{initials(c.name)}</span>}
                  </span>
                  <b>{c.name}</b>
                  {c.role && <span>{c.role}</span>}
                </button>
              )}
            />
          </div>
        )}

        {similar.length > 0 && (
          <div className="vd-sec-wide" style={{ marginLeft: -L.px, marginRight: -L.px }}>
            <Carousel
              title="Semelhantes"
              subtitle="Recomendados pelo TMDB que estão na sua lista"
              items={similar}
              keyOf={(c) => c.id}
              minWidth={mobile ? 104 : 140}
              render={(c, _i, w) => (
                <PosterTile item={c} w={w} onPick={setItem} />
              )}
            />
          </div>
        )}
      </div>
      {!backdrop && <span aria-hidden="true" className="vd-ghost">{initials(item.name)}</span>}
      {actor && actor.id && (
        <ActorView
          playlist={playlist}
          id={actor.id}
          fallback={actor}
          onClose={() => setActor(null)}
          onOpen={(c) => {
            setActor(null);
            setItem(c);
          }}
        />
      )}
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

// ---------------------------------------------------------------- Classificação indicativa

const CERT_COLOR: Record<string, string> = { L: '#00A651', '10': '#0095DA', '12': '#F8C411', '14': '#F58220', '16': '#EE1C24', '18': '#111111' };

/** Selo da classificação indicativa nas cores oficiais (L, 10, 12, 14, 16, 18). */
export function CertBadge({ c, small }: { c: string; small?: boolean }) {
  const k = c.replace(/^A?L$/i, 'L').replace(/\D*(\d+).*/, '$1');
  const bg = CERT_COLOR[k] ?? '#555';
  return (
    <span className={'cert' + (small ? ' sm' : '')} style={{ background: bg, color: k === '12' ? '#111' : '#fff', borderColor: k === '18' ? 'rgba(255,255,255,0.6)' : 'transparent' }} title={k === 'L' ? 'Livre' : `Não recomendado para menores de ${k} anos`}>
      {k}
    </span>
  );
}

// ---------------------------------------------------------------- Página do ator / diretor

/** Foto grande, biografia curta e "Na sua lista" com os trabalhos dele que estão na lista. */
export function ActorView({ playlist, id, fallback, onClose, onOpen }: { playlist: Playlist; id: number; fallback: CastMember; onClose: () => void; onOpen: (c: Channel) => void }) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const box = useRef<HTMLDivElement>(null);
  const [p, setP] = useState<Person | null>(null);
  const [mine, setMine] = useState<Channel[]>([]);
  useEffect(() => {
    let alive = true;
    personOf(id).then((r) => {
      if (!alive || !r) return;
      setP(r);
      const out: Channel[] = [];
      for (const x of r.credits) {
        const hit = findInList({ t: x.title, o: x.original, y: x.year }, x.type, playlist.items);
        if (hit && !out.some((o) => o.id === hit.id)) out.push(hit);
        if (out.length >= 20) break;
      }
      setMine(out);
    });
    requestAnimationFrame(() => focusFirst(box.current));
    const off = pushBack(() => {
      onClose();
      return true;
    });
    return () => {
      alive = false;
      off();
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const photo = p?.photo || fallback.photo;
  const age = p?.birth ? Math.floor((Date.now() - Date.parse(p.birth)) / (365.25 * 86400000)) : undefined;
  return (
    <div className="vod-detail screen-in actor-view" data-nav-scope="" ref={box}>
      <div className="actor-glow" style={{ background: `radial-gradient(ellipse 60% 70% at 20% 30%, ${rgba(colorFor(fallback.name), 0.35)} 0%, rgba(0,0,0,0) 70%)` }} />
      <div className="scroll-y vd-scroll" style={{ padding: `${mobile ? 20 : 60}px ${L.px}px 60px` }}>
        <div className="actor-head" style={{ flexDirection: mobile ? 'column' : 'row' }}>
          <span className="actor-photo" style={{ width: mobile ? 160 : 260, height: mobile ? 160 : 260 }}>
            {photo ? <img src={photo} alt="" referrerPolicy="no-referrer" /> : <span>{initials(fallback.name)}</span>}
          </span>
          <div className="actor-txt">
            <span className="paused-tag">{p?.dept === 'Directing' ? 'Direção' : 'Elenco'}</span>
            <span className="title" style={{ fontSize: mobile ? 32 : 52, lineHeight: 1.02 }}>{p?.name ?? fallback.name}</span>
            <div className="vd-pills">
              {fallback.role && <span className="vd-pill ghost">como {fallback.role}</span>}
              {age && <span className="vd-pill">{age} anos</span>}
              {p?.place && <span className="vd-pill">{p.place}</span>}
              {mine.length > 0 && <span className="vd-pill rate">{mine.length} na sua lista</span>}
            </div>
            {p?.bio ? <p className="vd-plot actor-bio">{p.bio}</p> : !p ? <span className="muted">Carregando…</span> : <span className="muted">O TMDB não tem biografia em português.</span>}
            <div className="wrap-row" style={{ display: 'flex', marginTop: 8 }}>
              <button className="btn" data-nav="" data-nav-default={mine.length ? undefined : ''} onClick={onClose}>Voltar</button>
            </div>
          </div>
        </div>
        {mine.length > 0 && (
          <div className="vd-sec-wide" style={{ marginLeft: -L.px, marginRight: -L.px }}>
            <Carousel title="Na sua lista" subtitle="Filmes e séries com esta pessoa" items={mine} keyOf={(i) => i.id} minWidth={mobile ? 110 : 150} render={(it, _i, w) => <PosterTile item={it} w={w} onPick={onOpen} />} />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Coleção (saga)

/** Tela da coleção: arte larga, nome e os filmes da lista em ordem de lançamento. */
export function CollectionView({ playlist, c, onClose, onPlay }: { playlist: Playlist; c: Collection; onClose: () => void; onPlay: (item: Channel, startAt?: number, queue?: Channel[]) => void }) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const box = useRef<HTMLDivElement>(null);
  const [detail, setDetail] = useState<Channel | null>(null);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => focusFirst(box.current));
    return pushBack(() => {
      onClose();
      return true;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [chrono, setChrono] = useState(false);
  const [, bump] = useState(0);
  const list = chrono && c.chrono ? c.chrono : c.items;
  const years = c.items.map((i) => i.year ?? searchTitle(i.fullName ?? i.name).year).filter(Boolean) as number[];
  // Maratona: quantos já foram vistos e qual é o próximo na ordem escolhida.
  const seen = (i: Channel) => isWatched(i.id) || (() => {
    const p = getProgress(i.id);
    return !!p && p.dur > 0 && p.pos / p.dur > 0.95;
  })();
  const done = list.filter(seen).length;
  const next = list.find((i) => !seen(i));
  const nextIdx = next ? list.indexOf(next) : -1;
  const started = done > 0 || list.some((i) => getProgress(i.id));
  return (
    <div className="vod-detail screen-in" data-nav-scope="" ref={box}>
      <ZoomFrom />
      {c.backdrop && <img className={'vd-backdrop fade-img' + (ok ? ' in' : '')} src={c.backdrop} alt="" referrerPolicy="no-referrer" onLoad={() => setOk(true)} />}
      <div className="vd-shade" />
      <div className="scroll-y vd-scroll" style={{ padding: `${mobile ? 20 : 70}px ${L.px}px 60px` }}>
        <div className="vd-hero" style={{ minHeight: mobile ? undefined : Math.round(L.H * 0.42), maxWidth: mobile ? undefined : Math.round(L.W * 0.55) }}>
          <span className="paused-tag">Coleção · maratona</span>
          <span className="title vd-title" style={{ fontSize: mobile ? 32 : 56 }}>{c.title}</span>
          <div className="vd-pills">
            <span className="vd-pill">{c.items.length} filmes na sua lista</span>
            {years.length > 1 && <span className="vd-pill">{Math.min(...years)} – {Math.max(...years)}</span>}
          </div>
          <div className="marathon">
            <span className="marathon-txt">
              <b>{done === list.length ? 'Maratona concluída ✓' : `${done} de ${list.length} vistos`}</b>
              {next && done > 0 ? ` · a seguir: ${next.name}` : ''}
            </span>
            <span className="marathon-bar">
              {list.map((i) => (
                <span key={i.id} className={seen(i) ? 'on' : i === next ? 'next' : ''} />
              ))}
            </span>
          </div>
          <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap', marginTop: 10 }}>
            {next ? (
              <button className="btn primary" data-nav="" data-nav-default="" onClick={() => onPlay(next, getProgress(next.id)?.pos, list.slice(nextIdx))}>
                ▶ {started ? `Continuar maratona · ${nextIdx + 1}º` : 'Começar a maratona'}
              </button>
            ) : (
              <button className="btn primary" data-nav="" data-nav-default="" onClick={() => onPlay(list[0], 0, list)}>↺ Rever do primeiro</button>
            )}
            {c.chrono && (
              <span className="seg">
                <button className={'chip' + (!chrono ? ' on' : '')} data-nav="" onClick={() => setChrono(false)}>Ordem de lançamento</button>
                <button className={'chip' + (chrono ? ' on' : '')} data-nav="" onClick={() => setChrono(true)}>Ordem da história</button>
              </span>
            )}
            <button className="btn" data-nav="" onClick={onClose}>Voltar</button>
          </div>
          {!c.chrono && <span className="muted" style={{ fontSize: 15, marginTop: 6 }}>Em ordem de lançamento</span>}
        </div>
        <div className="vd-sec-wide" style={{ marginLeft: -L.px, marginRight: -L.px }}>
          <Carousel title="Filmes da coleção" subtitle={chrono ? 'Na ordem da história' : 'Na ordem de lançamento'} items={list} keyOf={(i) => i.id} minWidth={mobile ? 110 : 168} render={(it, i, w) => <PosterTile item={it} w={w} rank={i + 1} onPick={setDetail} />} />
        </div>
      </div>
      {detail && <VodDetail playlist={playlist} item={detail} onPlay={onPlay} onClose={() => { setDetail(null); bump((x) => x + 1); }} />}
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
            empty={<EmptyState kind="list" title="Sua lista está vazia" text="Abra um filme ou série e toque em “+ Minha lista” para guardar aqui o que você quer ver depois." />}
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
    const l = b.scrollLeft > 4;
    const r = b.scrollLeft + b.clientWidth < b.scrollWidth - 4;
    // Só atualiza se mudou (o efeito roda a cada desenho; gravar sempre causava um laço sem fim).
    setEdge((e) => (e.l === l && e.r === r ? e : { l, r }));
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
