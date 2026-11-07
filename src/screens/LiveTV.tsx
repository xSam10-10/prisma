import { T } from '../ui/tokens';
import { useEffect, useMemo, useRef, useState } from 'react';
import { progressOf } from '../core/epg';
import { categoriesOf } from '../core/source';
import { prefGet, prefSet } from '../core/storage';
import type { Channel, Playlist } from '../core/types';
import { ChannelLogo, Icon, Symbol, fmtTime } from '../ui/bits';
import { VirtualList, type VirtualListHandle } from '../ui/VirtualList';
import { ensureVisible } from '../ui/nav';
import { useClock, useEpg } from '../ui/useEpg';
import type { Rect } from './Player';

export const PREVIEW_RECT: Rect = { left: 518, top: 100, width: 698, height: 330, radius: 28 };

export const FAV = '__fav__';
export const ALL = '__all__';

interface Props {
  playlist: Playlist;
  live: Channel[];
  favIds: string[];
  playing?: Channel;
  isFav: (c: Channel) => boolean;
  toggleFav: (c: Channel) => void;
  onPlay: (c: Channel, list: Channel[]) => void;
  onFull: () => void;
}

export function LiveTV({ playlist, live, favIds, playing, isFav, toggleFav, onPlay, onFull }: Props) {
  const cats = useMemo(() => categoriesOf(live, 'live'), [live]);
  const [cat, setCat] = useState<string>(() => prefGet('live.cat', favIds.length ? FAV : ALL));
  const list = useMemo(() => {
    if (cat === FAV) {
      const set = new Set(favIds);
      return live.filter((c) => set.has(c.id));
    }
    if (cat === ALL) return live;
    return live.filter((c) => c.group === cat);
  }, [cat, live, favIds]);

  const [index, setIndex] = useState(() => {
    const i = playing ? list.findIndex((c) => c.id === playing.id) : -1;
    return Math.max(0, i);
  });
  const listRef = useRef<VirtualListHandle>(null);
  const chipsRef = useRef<HTMLDivElement>(null);

  useEffect(() => prefSet('live.cat', cat), [cat]);
  // Trocou de canal na tela cheia: a lista acompanha.
  useEffect(() => {
    if (!playing) return;
    const i = list.findIndex((c) => c.id === playing.id);
    if (i >= 0) setIndex(i);
  }, [playing?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (index >= list.length) setIndex(Math.max(0, list.length - 1));
  }, [list.length, index]);

  // Ao abrir a tela, o foco vai para a lista de canais.
  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.focus());
  }, []);

  // Rola os chips para mostrar a categoria escolhida.
  useEffect(() => {
    const el = chipsRef.current?.querySelector<HTMLElement>('.chip.on');
    if (el) ensureVisible(el);
  }, [cat]);

  const selected = list[index];
  const epgSel = useEpg(playlist, selected);
  const epgPlay = useEpg(playlist, playing, 0);
  const now = useClock();
  const curPlay = epgPlay?.[0];

  const chips = [
    { id: FAV, name: 'Favoritos', count: favIds.length },
    { id: ALL, name: 'Todos', count: live.length },
    ...cats.map((c) => ({ id: c.id, name: c.name, count: c.count })),
  ];

  const pick = (c: Channel) => {
    if (playing?.id === c.id) onFull();
    else onPlay(c, list);
  };

  return (
    <>
      {/* Lista de canais */}
      <div
        className="glass gy-12"
        style={{
          position: 'absolute', left: 64, top: 100, bottom: 36, width: 430, padding: 16, borderRadius: T.radiusPanel,
          display: 'flex', flexDirection: 'column', }}
      >
        <div ref={chipsRef} className="scroll-x" role="tablist" aria-label="Categorias">
          {chips.map((c) => (
            <button
              key={c.id}
              className={'chip' + (c.id === cat ? ' on' : '')}
              data-nav=""
              role="tab"
              aria-selected={c.id === cat}
              onFocus={() => {
                if (c.id !== cat) {
                  setCat(c.id);
                  setIndex(0);
                }
              }}
              onClick={() => {
                setCat(c.id);
                setIndex(0);
                listRef.current?.focus();
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="muted" style={{ fontSize: 14, fontWeight: 600, padding: '0 4px', display: 'flex', justifyContent: 'space-between' }}>
          <span>{chips.find((c) => c.id === cat)?.name ?? ''}</span>
          <span>{list.length ? `${index + 1} de ${list.length}` : ''}</span>
        </div>
        <VirtualList
          ref={listRef}
          items={list}
          index={index}
          onIndex={setIndex}
          onPick={pick}
          navDefault
          label="Canais"
          render={(c) => (
            <>
              <span className="num">{c.number ?? ''}</span>
              <ChannelLogo ch={c} />
              <div className="txt">
                <span className="name">{c.name}</span>
                <span className="sub">{c.group}</span>
              </div>
              {isFav(c) && <span style={{ color: T.warn, display: 'flex' }}>{Icon.star(true)}</span>}
              {playing?.id === c.id && <span className="playing" aria-label="Assistindo" />}
            </>
          )}
          empty={
            <div className="gy-10" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
              <span className="title" style={{ fontSize: 20 }}>{cat === FAV ? 'Nenhum favorito ainda' : 'Nenhum canal aqui'}</span>
              <span className="muted" style={{ fontSize: 16 }}>
                {cat === FAV ? 'Abra um canal em tela cheia e aperte "Favoritar". Ele aparece aqui.' : 'Escolha outra categoria.'}
              </span>
            </div>
          }
        />
      </div>

      {/* Prévia: o vídeo é o Player (desenhado por cima, no mesmo lugar) */}
      <div
        style={{
          position: 'absolute', left: PREVIEW_RECT.left, top: PREVIEW_RECT.top, width: PREVIEW_RECT.width, height: PREVIEW_RECT.height,
          borderRadius: 28, overflow: 'hidden', background: '#2A1640',
        }}
      >
        <div aria-hidden="true" style={{ position: 'absolute', left: 300, top: -80, width: 440, height: 440, borderRadius: '50%', background: '#5B2B85' }} />
        <div aria-hidden="true" style={{ position: 'absolute', left: 60, top: 190, width: 240, height: 240, borderRadius: '50%', background: '#3D1E5E' }} />
        {!playing && (
          <div className="gy-12" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Symbol size={64} />
            <span className="title" style={{ fontSize: 22 }}>Escolha um canal e aperte OK</span>
            <span className="muted" style={{ fontSize: 16 }}>OK de novo abre em tela cheia</span>
          </div>
        )}
      </div>

      {playing && (
        <>
          <span className="badge-live" style={{ position: 'absolute', left: PREVIEW_RECT.left + 18, top: PREVIEW_RECT.top + 18, zIndex: 6 }}>● Ao vivo</span>
          <div
            className="glass gx-16"
            style={{
              position: 'absolute', left: PREVIEW_RECT.left + 14, width: PREVIEW_RECT.width - 28, top: PREVIEW_RECT.top + PREVIEW_RECT.height - 14 - 92,
              height: 92, padding: '14px 18px', borderRadius: 20, background: 'rgba(11,11,18,0.6)', zIndex: 6,
              display: 'flex', alignItems: 'center', }}
          >
            <div className="gy-4" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 }}>
              <span style={{ fontSize: 15, color: '#D6D6E0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {playing.number} · {playing.name}
                {curPlay ? ` · ${fmtTime(curPlay.start)} – ${fmtTime(curPlay.end)}` : ''}
              </span>
              <span className="title" style={{ fontSize: 22, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {curPlay?.title ?? playing.name}
              </span>
              <div className="progress"><div style={{ width: curPlay ? `${progressOf(curPlay, now) * 100}%` : '100%' }} /></div>
            </div>
            <button
              className="btn icon"
              data-nav=""
              aria-label={isFav(playing) ? 'Remover dos favoritos' : 'Favoritar'}
              style={{ width: 46, padding: 0, justifyContent: 'center', color: isFav(playing) ? T.warn : undefined }}
              onClick={() => toggleFav(playing)}
            >
              {Icon.star(isFav(playing))}
            </button>
            <button className="btn primary" data-nav="" onClick={onFull}>
              {Icon.expand} Tela cheia
            </button>
          </div>
        </>
      )}

      {/* A seguir (do canal selecionado na lista) */}
      <div
        className="glass gy-12"
        style={{
          position: 'absolute', left: 518, right: 64, top: 446, bottom: 36, padding: '14px 18px', borderRadius: 26,
          display: 'flex', flexDirection: 'column', }}
      >
        <div className="gx-18" style={{ display: 'flex', fontSize: 16, fontWeight: 700, alignItems: 'baseline' }}>
          <span>A seguir</span>
          <span className="muted" style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selected ? `${selected.number ?? ''} · ${selected.name}` : ''}
          </span>
        </div>
        {epgSel === null && selected ? (
          <div className="gx-12 cols" style={{ display: 'flex' }}>
            {[0, 1, 2].map((i) => <div key={i} className="skel" style={{ height: 132 }} />)}
          </div>
        ) : epgSel && epgSel.length ? (
          <div className="gx-12 cols" style={{ display: 'flex' }}>
            {epgSel.slice(0, 3).map((e, i) => (
              <div className="gy-6" key={i} style={{ height: 132, padding: 14, borderRadius: 18, background: 'rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: i === 0 ? T.live : T.warn }}>
                  {i === 0 ? 'Agora · ' : ''}{fmtTime(e.start)} – {fmtTime(e.end)}
                </span>
                <span style={{ fontSize: 17, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
                <span className="muted" style={{ fontSize: 15, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                  {e.description ?? ''}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="gx-14" style={{ display: 'flex', alignItems: 'center', padding: '10px 4px' }}>
            <span className="badge-live">Ao vivo</span>
            <span className="muted" style={{ fontSize: 16 }}>
              {selected ? 'Este canal não tem guia de programação.' : 'Nenhum canal selecionado.'}
              {playlist.source.type !== 'xtream' && playlist.epgUrl ? ' O guia completo da lista (XMLTV) chega no próximo passo.' : ''}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
