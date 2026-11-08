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
import { useLayout, type Layout } from '../ui/layout';
import { orderedSections, sectionChannels, useSections, createSection } from '../core/sections';
import { NameDialog } from '../ui/Dialog';
import { VoiceButton, voiceSupported } from '../ui/Voice';
import { OrganizeSections } from './Sections';
import { Guide } from './Guide';

/** Geometria da tela Ao vivo para a tela atual (o Player usa o mesmo retângulo). */
function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Mede a largura de um texto na fonte da interface (canvas: funciona também na TV de 2017). */
let measureCtx: CanvasRenderingContext2D | null = null;
function textWidth(text: string, font: string): number {
  try {
    measureCtx = measureCtx ?? document.createElement('canvas').getContext('2d');
    if (!measureCtx) return text.length * 9;
    measureCtx.font = font;
    return measureCtx.measureText(text).width;
  } catch {
    return text.length * 9;
  }
}

const widthCache = new WeakMap<Channel[], number>();
/**
 * Largura da coluna de categorias: o suficiente para o nome mais longo caber
 * inteiro (em caixa alta) com o número de prioridade, entre 240 e 380.
 */
export function catColumnWidth(live: Channel[]): number {
  const hit = widthCache.get(live);
  if (hit) return hit;
  const cats = categoriesOf(live, 'live');
  let max = Math.max(textWidth('FAVORITOS', '600 15px Inter'), textWidth('TODOS', '600 15px Inter'));
  let maxCount = String(live.length).length;
  for (const c of cats) {
    max = Math.max(max, textWidth(c.name.toUpperCase(), '600 15px Inter'));
    maxCount = Math.max(maxCount, String(c.count).length);
  }
  // nome + selo da contagem + margens internas (14 + 10 + 8) + borda/rolagem (14)
  const badge = Math.max(28, maxCount * 8 + 14);
  const w = Math.round(Math.min(380, Math.max(240, max + badge + 22 + 14 + 10 + 8 + 14 + 6)));
  widthCache.set(live, w);
  return w;
}

export function liveGeometry(L: Layout, catW = CAT_W) {
  if (L.form === 'mobile') {
    const pad = L.px;
    if (L.landscape) {
      // Celular deitado: vídeo à esquerda, lista à direita.
      const vw = Math.round((L.W - pad * 3) * 0.58);
      // Deixa espaço para a faixa de informações (56) abaixo do vídeo.
      const vh = Math.min(Math.round((vw * 9) / 16), L.H - L.top - L.bottom - 64);
      const preview: Rect = { left: pad, top: L.top, width: vw, height: vh, radius: 16 };
      return { preview, list: { left: pad * 2 + vw, top: L.top, right: pad, bottom: L.bottom }, info: { left: pad, top: L.top + vh + 8, width: vw }, next: null };
    }
    const vw = L.W - pad * 2;
    const vh = Math.round((vw * 9) / 16);
    const preview: Rect = { left: pad, top: L.top, width: vw, height: vh, radius: 16 };
    const infoTop = L.top + vh + 8;
    return { preview, list: { left: pad, top: infoTop + 64, right: pad, bottom: L.bottom }, info: { left: pad, top: infoTop, width: vw }, next: null };
  }
  // TV / computador: lista à esquerda, prévia e "A seguir" à direita.
  // Painel com duas colunas: categorias (vertical) + canais.
  // A largura total do painel fica a mesma de antes; a coluna de categorias cresce
  // até caber o nome mais longo e a de canais cede o espaço, sem ficar menor que 320.
  const total = CAT_W + Math.round(Math.min(500, Math.max(340, L.W * 0.26)));
  const chanW = Math.max(340, total - catW);
  const listW = catW + 11 + chanW + 28;
  const left = L.px + listW + 24;
  const width = L.W - left - L.px;
  const avail = L.H - L.top - L.bottom;
  const height = Math.round(Math.max(300, Math.min((width * 9) / 16, avail - 200)));
  const preview: Rect = { left, top: L.top, width, height, radius: 28 };
  return {
    preview,
    list: { left: L.px, top: L.top, width: listW, bottom: L.bottom },
    info: null,
    next: { left, right: L.px, top: L.top + height + 16, bottom: L.bottom },
  };
}

const CAT_W = 236;

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
  lastChannel?: Channel;
  onLast?: () => void;
  onPlayVod: (item: Channel) => void;
}

export function LiveTV({ playlist, live, favIds, playing, isFav, toggleFav, onPlay, onFull, onPlayVod, lastChannel, onLast }: Props) {
  const [guide, setGuide] = useState(false);
  const native = useMemo(() => categoriesOf(live, 'live'), [live]);
  const { data: secData, set: setSecData } = useSections();
  const cats = useMemo(() => orderedSections(native, secData, live), [native, secData, live]);
  const [dialog, setDialog] = useState<null | 'new' | 'organize'>(null);
  const [cat, setCat] = useState<string>(() => {
    const saved = prefGet<string>('live.cat', favIds.length ? FAV : ALL);
    // Categoria salva que não existe mais (lista mudou): volta para Todos.
    return saved === FAV || saved === ALL || cats.some((c) => c.id === saved) ? saved : ALL;
  });
  // Seção apagada enquanto aberta: volta para Todos.
  useEffect(() => {
    if (cat !== FAV && cat !== ALL && !cats.some((c) => c.id === cat)) setCat(ALL);
  }, [cats, cat]);
  // Busca dentro da tela Ao vivo: filtra todos os canais pelo nome (ou número).
  const [query, setQuery] = useState('');
  const q = normalizeText(query.trim());
  const list = useMemo(() => {
    if (q) {
      const num = /^\d+$/.test(q) ? Number(q) : NaN;
      return live.filter((c) => c.number === num || normalizeText(c.fullName ?? c.name).includes(q));
    }
    if (cat === FAV) {
      const set = new Set(favIds);
      return live.filter((c) => set.has(c.id));
    }
    if (cat === ALL) return live;
    return sectionChannels(cat, live, secData);
  }, [cat, live, favIds, q, secData]);

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
    const el = chipsRef.current?.querySelector<HTMLElement>('.chip.on, .cat.on');
    if (el) ensureVisible(el);
  }, [cat]);

  const selected = list[index];
  const epgSel = useEpg(playlist, selected);
  const epgPlay = useEpg(playlist, playing, 0);
  const now = useClock();
  const curPlay = epgPlay?.[0];

  // Números de prioridade aparecem na coluna quando a ordem é por prioridade.
  const showNums = secData.sort === 'priority' && secData.order.length > 0;
  const chips: { id: string; name: string; count: number; priority?: number }[] = [
    { id: FAV, name: 'Favoritos', count: favIds.length },
    { id: ALL, name: 'Todos', count: live.length },
    ...cats.map((c) => ({ id: c.id, name: c.name, count: c.count, priority: c.priority as number | undefined })),
  ];

  const L = useLayout();
  const catW = catColumnWidth(live);
  const G = liveGeometry(L, catW);
  const P = G.preview;
  const mobile = L.form === 'mobile';

  const pick = (c: Channel) => {
    if (playing?.id === c.id) onFull();
    else onPlay(c, list);
  };

  return (
    <>
      {/* Lista de canais */}
      <div
        className={mobile ? '' : 'glass'}
        style={{
          position: 'absolute', ...G.list, padding: mobile ? 0 : 14, borderRadius: T.radiusPanel,
          display: 'flex', flexDirection: 'row', }}
      >
        {!mobile && (
          // Categorias na vertical (TV e computador). Ao entrar na coluna, o foco vai para a categoria atual.
          <div className="cats-col" style={{ width: catW }}>
          <div className="cats-tools">
            <button className="tool" data-nav="" onClick={() => setDialog('new')} aria-label="Criar nova seção">+ Nova seção</button>
            <button className="tool" data-nav="" onClick={() => setDialog('organize')} aria-label="Organizar e ordenar seções">⇅ Organizar</button>
          </div>
          <div ref={chipsRef} className="scroll-y cats" data-nav-group="" role="tablist" aria-label="Categorias">
            {chips.map((c) => (
              <button
                key={c.id}
                className={'cat' + (c.id === cat ? ' on' : '')}
                data-nav=""
                data-nav-active={c.id === cat ? '' : undefined}
                role="tab"
                aria-selected={c.id === cat}
                onFocus={() => {
                  if (c.id !== cat) {
                    setCat(c.id);
                    setIndex(0);
                    setQuery('');
                  }
                }}
                onClick={() => {
                  setCat(c.id);
                  setIndex(0);
                  setQuery('');
                  listRef.current?.focus();
                }}
              >
                {showNums && c.priority ? <span className="cat-pri">{c.priority}</span> : null}
                <span className="cat-name" title={c.name}>{c.name}</span>
                <span className="cat-count">{c.count.toLocaleString('pt-BR')}</span>
              </button>
            ))}
          </div>
          </div>
        )}
        <div className={mobile ? 'gy-8' : 'gy-12'} style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 }}>
        {mobile && (
        <div ref={chipsRef} className="scroll-x" role="tablist" aria-label="Categorias">
          <button className="chip" data-nav="" style={{ color: T.primary }} onClick={() => setDialog('new')}>+ Nova</button>
          <button className="chip" data-nav="" onClick={() => setDialog('organize')}>⇅</button>
          <button className="chip" data-nav="" onClick={() => setGuide(true)}>▦ Guia</button>
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
                setQuery('');
                listRef.current?.focus();
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
        )}
        <div className="live-search">
          <span className="ic" aria-hidden="true">{Icon.search}</span>
          <input
            data-nav=""
            type="search"
            placeholder="Buscar canal ou número"
            aria-label="Buscar canal"
            value={query}
            autoCapitalize="characters"
            autoCorrect="off"
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.keyCode === 13) {
                e.preventDefault();
                listRef.current?.focus();
              } else if ((e.key === 'Escape' || e.keyCode === 27) && query) {
                e.preventDefault();
                e.stopPropagation();
                setQuery('');
              }
            }}
          />
          {query && (
            <button className="clear" tabIndex={-1} aria-label="Limpar busca" onClick={() => setQuery('')} style={voiceSupported() ? { right: 50 } : undefined}>✕</button>
          )}
          {voiceSupported() && (
            <span className="live-voice">
              <VoiceButton size={36} onText={(t) => { setQuery(t); setIndex(0); }} />
            </span>
          )}
        </div>
        <div className="muted" style={{ fontSize: 14, fontWeight: 600, padding: '0 4px', display: 'flex', justifyContent: 'space-between' }}>
          <span className="caps">{q ? `Busca: “${query.trim()}”` : chips.find((c) => c.id === cat)?.name ?? ''}</span>
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
          rowHeight={54}
          render={(c) => (
            <>
              <span className="num">{c.number ?? ''}</span>
              <ChannelLogo ch={c} />
              <div className="txt">
                <span className="name">{c.name}</span>
              </div>
              {isFav(c) && <span style={{ color: T.warn, display: 'flex' }}>{Icon.star(true)}</span>}
              {playing?.id === c.id && <span className="playing" aria-label="Assistindo" />}
            </>
          )}
          empty={
            <div className="gy-10" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
              <span className="title" style={{ fontSize: 20 }}>{q ? 'Nenhum canal encontrado' : cat === FAV ? 'Nenhum favorito ainda' : 'Nenhum canal aqui'}</span>
              <span className="muted" style={{ fontSize: 16 }}>
                {q ? 'Tente parte do nome (ex.: “SPORTV”) ou o número do canal.' : cat === FAV ? 'Abra um canal em tela cheia e aperte "Favoritar". Ele aparece aqui.' : 'Escolha outra categoria.'}
              </span>
            </div>
          }
        />
        </div>
      </div>

      {/* Prévia: o vídeo é o Player (desenhado por cima, no mesmo lugar) */}
      <div
        style={{
          position: 'absolute', left: P.left, top: P.top, width: P.width, height: P.height,
          borderRadius: P.radius, overflow: 'hidden', background: '#2A1640',
        }}
      >
        <div aria-hidden="true" style={{ position: 'absolute', left: 300, top: -80, width: 440, height: 440, borderRadius: '50%', background: '#5B2B85' }} />
        <div aria-hidden="true" style={{ position: 'absolute', left: 60, top: 190, width: 240, height: 240, borderRadius: '50%', background: '#3D1E5E' }} />
        {!playing && (
          <div className="gy-12" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Symbol size={mobile ? 44 : 64} />
            <span className="title" style={{ fontSize: mobile ? 17 : 22 }}>{mobile ? 'Toque num canal para assistir' : 'Escolha um canal e aperte OK'}</span>
            <span className="muted" style={{ fontSize: mobile ? 14 : 16 }}>{mobile ? 'Toque de novo para tela cheia' : 'OK de novo abre em tela cheia'}</span>
          </div>
        )}
      </div>

      {playing && (
        <>
          <span className="badge-live" style={{ position: 'absolute', left: P.left + (mobile ? 10 : 18), top: P.top + (mobile ? 10 : 18), zIndex: 6, fontSize: mobile ? 12 : 14 }}>● Ao vivo</span>
          <div
            className="glass gx-16"
            style={
              G.info
                ? { position: 'absolute', left: G.info.left, top: G.info.top, width: G.info.width, height: 56, padding: '6px 10px', borderRadius: 16, display: 'flex', alignItems: 'center', zIndex: 6 }
                : {
                    position: 'absolute', left: P.left + 14, width: P.width - 28, top: P.top + P.height - 14 - 92,
                    height: 92, padding: '14px 18px', borderRadius: 20, background: 'rgba(11,11,18,0.6)', zIndex: 6,
                    display: 'flex', alignItems: 'center', }
            }
          >
            <div className="gy-4" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 }}>
              <span className="caps" style={{ fontSize: mobile ? 12 : 15, color: '#D6D6E0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {playing.number} · {playing.name}
                {curPlay ? ` · ${fmtTime(curPlay.start)} – ${fmtTime(curPlay.end)}` : ''}
              </span>
              <span className="title" style={{ fontSize: mobile ? 16 : 22, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {curPlay?.title ?? playing.name}
              </span>
              <div className="progress"><div style={{ width: curPlay ? `${progressOf(curPlay, now) * 100}%` : '100%' }} /></div>
            </div>
            {lastChannel && onLast && (
              <button className="btn icon" data-nav="" aria-label={`Último canal: ${lastChannel.name}`} title={`Último canal: ${lastChannel.name}`} style={{ width: 46, padding: 0, justifyContent: 'center', fontSize: 20 }} onClick={onLast}>
                ↺
              </button>
            )}
            <button
              className="btn icon"
              data-nav=""
              aria-label={isFav(playing) ? 'Remover dos favoritos' : 'Favoritar'}
              style={{ width: 46, padding: 0, justifyContent: 'center', color: isFav(playing) ? T.warn : undefined }}
              onClick={() => toggleFav(playing)}
            >
              {Icon.star(isFav(playing))}
            </button>
            <button className={'btn primary' + (mobile ? ' icon' : '')} data-nav="" aria-label="Tela cheia" onClick={onFull} style={mobile ? { width: 46, padding: 0, justifyContent: 'center' } : undefined}>
              {Icon.expand}
              {mobile ? null : ' Tela cheia'}
            </button>
          </div>
        </>
      )}

      {/* A seguir (do canal selecionado na lista) — só na TV/computador */}
      {G.next && (
      <div
        className="glass gy-12"
        style={{
          position: 'absolute', ...G.next, padding: '14px 18px', borderRadius: 26,
          display: 'flex', flexDirection: 'column', overflow: 'hidden', }}
      >
        <div className="gx-18" style={{ display: 'flex', fontSize: 16, fontWeight: 700, alignItems: 'center' }}>
          <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>A seguir</span>
          <button className="chip" data-nav="" onClick={() => setGuide(true)} style={{ height: 32, flexShrink: 0 }}>▦ Guia de 7 dias</button>
          <span className="muted caps" style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selected ? `${selected.number ?? ''} · ${selected.name}` : ''}
          </span>
        </div>
        {epgSel === null && selected ? (
          <div className="gx-12 cols" style={{ display: 'flex' }}>
            {(G.preview.width < 560 ? [0, 1] : [0, 1, 2]).map((i) => <div key={i} className="skel" style={{ height: 132 }} />)}
          </div>
        ) : epgSel && epgSel.length ? (
          <div className="gx-12 cols" style={{ display: 'flex' }}>
            {epgSel.slice(0, G.preview.width < 560 ? 2 : 3).map((e, i) => (
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
      )}
      {dialog === 'new' && (
        <NameDialog
          title="Nova seção"
          placeholder="Ex.: Futebol, Meus canais 24h"
          onClose={() => setDialog(null)}
          onSave={(name) => {
            let newId = '';
            setSecData((d) => {
              const [nd, id] = createSection(d, name);
              newId = id;
              return nd;
            });
            setDialog(null);
            requestAnimationFrame(() => {
              if (newId) {
                setCat(newId);
                setIndex(0);
              }
            });
          }}
        />
      )}
      {dialog === 'organize' && <OrganizeSections views={cats} onClose={() => setDialog(null)} />}
      {guide && (
        <Guide
          playlist={playlist}
          channels={list.length ? list : live}
          startIndex={index}
          onClose={() => {
            setGuide(false);
            requestAnimationFrame(() => listRef.current?.focus());
          }}
          onWatch={(c) => {
            setGuide(false);
            onPlay(c, list);
            requestAnimationFrame(onFull);
          }}
          onPlayVod={(it) => {
            setGuide(false);
            onPlayVod(it);
          }}
        />
      )}
    </>
  );
}
