import { useEffect, useMemo, useRef, useState } from 'react';
import type { Channel, ItemKind, Playlist } from '../core/types';
import { ANIME, STREAMINGS, getProgress, inMyList, myList, streamingsIn, toggleMyList, type Streaming } from '../core/vod';
import { seriesInfo, vodInfo, type Episode, type SeriesDetails, type VodDetails } from '../core/xtream';
import { colorFor, initials, rgba } from '../ui/bits';
import { useLayout } from '../ui/layout';
import { focusFirst, pushBack } from '../ui/nav';
import { VirtualGrid, type VirtualGridHandle } from '../ui/VirtualGrid';
import { VirtualList } from '../ui/VirtualList';
import { VoiceButton, voiceSupported } from '../ui/Voice';

// Filmes · Séries · Anime: streamings no topo, categorias à esquerda,
// grade de capas com busca; OK abre o detalhe (sinopse, elenco, episódios).

export type VodTab = 'filmes' | 'series' | 'anime';

function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Capa (2:3) com título, ano/nota e progresso. Sem imagem: arte com o nome. */
export function PosterCard({ item, w, selected }: { item: Channel; w: number; selected?: boolean }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [item.logo]);
  const p = getProgress(item.id);
  const c = colorFor(item.name);
  return (
    <div className={'poster' + (selected ? ' sel' : '')}>
      <div className="poster-art" style={{ height: Math.round(w * 1.5), background: `linear-gradient(160deg, ${rgba(c, 0.55)} 0%, #15151F 85%)` }}>
        {item.logo && !broken ? (
          <img src={item.logo} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        ) : (
          <span className="poster-fallback caps">{item.name}</span>
        )}
        {item.rating ? <span className="poster-rate">★ {item.rating.toFixed(1).replace('.', ',')}</span> : null}
        {p && p.dur ? <span className="poster-prog"><span style={{ width: `${(p.pos / p.dur) * 100}%` }} /></span> : null}
      </div>
      <span className="poster-title caps">{item.name}</span>
      {item.year ? <span className="poster-meta">{item.year}</span> : null}
    </div>
  );
}

type Sort = 'recent' | 'az' | 'rating';

export function VodScreen({ playlist, tab, onPlay }: { playlist: Playlist; tab: VodTab; onPlay: (item: Channel, startAt?: number, queue?: Channel[]) => void }) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const all = useMemo(() => {
    const kinds: ItemKind[] = tab === 'filmes' ? ['movie'] : tab === 'series' ? ['series'] : ['movie', 'series'];
    const list = playlist.items.filter((i) => kinds.includes(i.kind));
    return tab === 'anime' ? list.filter((i) => ANIME.test(i.group)) : list;
  }, [playlist, tab]);
  const groups = useMemo(() => [...new Set(all.map((i) => i.group))], [all]);
  const streamings = useMemo(() => streamingsIn(groups), [groups]);
  const [stream, setStream] = useState<string>('');
  const [cat, setCat] = useState<string>('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [index, setIndex] = useState(0);
  const [detail, setDetail] = useState<Channel | null>(null);
  const gridRef = useRef<VirtualGridHandle>(null);
  const st: Streaming | undefined = STREAMINGS.find((s) => s.id === stream);

  const inStream = useMemo(() => (st ? all.filter((i) => st.match.test(i.group)) : all), [all, st]);
  const cats = useMemo(() => countCats(inStream), [inStream]);
  const q = norm(query.trim());
  const list = useMemo(() => {
    let l = q ? all.filter((i) => norm(i.fullName ?? i.name).includes(q)) : cat ? inStream.filter((i) => i.group === cat) : inStream;
    if (sort === 'az') l = [...l].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    else if (sort === 'rating') l = [...l].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    else l = [...l].sort((a, b) => (b.added ?? 0) - (a.added ?? 0));
    return l;
  }, [all, inStream, cat, q, sort]);

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
  const streamRowH = streamings.length ? (mobile ? 46 : 54) : 0;
  const catW = mobile ? 0 : 250;

  return (
    <>
      {st && (
        <div aria-hidden="true" className="stream-art" style={{ background: `radial-gradient(ellipse 60% 70% at 85% 10%, ${rgba(st.accent, 0.45)} 0%, rgba(0,0,0,0) 70%), radial-gradient(ellipse 50% 60% at 10% 90%, ${rgba(st.accent2, 0.35)} 0%, rgba(0,0,0,0) 70%), ${st.bg}` }} />
      )}
      {streamings.length > 0 && (
        <div className="scroll-x stream-row" style={{ position: 'absolute', left: L.px, right: L.px, top, height: streamRowH }}>
          <button className={'stream-chip' + (!stream ? ' on' : '')} data-nav="" onClick={() => { setStream(''); setCat(''); }}>Todos</button>
          {streamings.map((s) => (
            <button
              key={s.id}
              className={'stream-chip' + (stream === s.id ? ' on' : '')}
              data-nav=""
              style={stream === s.id ? { background: s.accent, color: '#fff' } : undefined}
              onClick={() => { setStream(s.id); setCat(''); setQuery(''); }}
            >
              <i style={{ background: s.accent }} />
              {s.name}
            </button>
          ))}
        </div>
      )}

      {!mobile && (
        <div className="scroll-y cats" data-nav-group="" style={{ position: 'absolute', left: L.px, top: top + streamRowH + 12, bottom: L.bottom, width: catW, padding: '3px 10px 3px 3px' }}>
          <button className={'cat' + (!cat ? ' on' : '')} data-nav="" data-nav-active={!cat ? '' : undefined} onClick={() => { setCat(''); setQuery(''); }}>
            <span className="cat-name">{st ? st.name : 'Todos'}</span>
            <span className="cat-count">{inStream.length.toLocaleString('pt-BR')}</span>
          </button>
          {cats.map((c) => (
            <button key={c.name} className={'cat' + (cat === c.name ? ' on' : '')} data-nav="" data-nav-active={cat === c.name ? '' : undefined} onClick={() => { setCat(c.name); setQuery(''); gridRef.current?.focus(); }}>
              <span className="cat-name" title={c.name}>{c.name}</span>
              <span className="cat-count">{c.count.toLocaleString('pt-BR')}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ position: 'absolute', left: L.px + (mobile ? 0 : catW + 18), right: L.px, top: top + streamRowH + 12, bottom: L.bottom, display: 'flex', flexDirection: 'column' }}>
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
          {!mobile && (
            <div className="gx-6" style={{ display: 'flex', marginLeft: 12 }}>
              {(['recent', 'az', 'rating'] as Sort[]).map((s) => (
                <button key={s} className={'chip' + (sort === s ? ' on' : '')} data-nav="" onClick={() => setSort(s)}>
                  {s === 'recent' ? 'Recentes' : s === 'az' ? 'A–Z' : 'Nota'}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="muted caps" style={{ fontSize: 14, fontWeight: 600, margin: '10px 4px 0', display: 'flex', justifyContent: 'space-between' }}>
          <span>{q ? `Busca: “${query.trim()}”` : cat || (st ? st.name : `Todos os ${kindLabel}`)}</span>
          <span>{list.length.toLocaleString('pt-BR')} {kindLabel}</span>
        </div>
        {mobile && cats.length > 0 && (
          <div className="scroll-x" style={{ marginTop: 8 }}>
            <button className={'chip' + (!cat ? ' on' : '')} data-nav="" onClick={() => setCat('')}>Todos</button>
            {cats.map((c) => (
              <button key={c.name} className={'chip' + (cat === c.name ? ' on' : '')} data-nav="" onClick={() => setCat(c.name)}>{c.name}</button>
            ))}
          </div>
        )}
        <div style={{ flexGrow: 1, minHeight: 0, display: 'flex', marginTop: 6 }}>
          <VirtualGrid
            ref={gridRef}
            items={list}
            index={index}
            onIndex={setIndex}
            onPick={(it) => setDetail(it)}
            minCellW={mobile ? 104 : 168}
            ratio={1.5}
            extraH={mobile ? 58 : 56}
            gap={mobile ? 10 : 18}
            label={title}
            render={(it, _i, sel, w) => <PosterCard item={it} w={w} selected={sel} />}
            empty={<div className="muted" style={{ padding: 20, fontSize: 16 }}>Nada encontrado. Tente outra palavra ou outra categoria.</div>}
          />
        </div>
      </div>

      {detail && <VodDetail playlist={playlist} item={detail} onClose={() => { setDetail(null); requestAnimationFrame(() => gridRef.current?.focus()); }} onPlay={onPlay} />}
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
  const backdrop = info?.backdrop || info?.cover || item.logo;

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
          {info?.plot && <p className="vd-plot">{info.plot}</p>}
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
