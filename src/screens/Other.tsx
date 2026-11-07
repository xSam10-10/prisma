import { T } from '../ui/tokens';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Channel, Playlist } from '../core/types';
import { Ambient, ChannelLogo, Icon, Symbol } from '../ui/bits';
import { VirtualList, type VirtualListHandle } from '../ui/VirtualList';
import { focusFirst } from '../ui/nav';
import { useLayout } from '../ui/layout';

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function ChannelCard({ ch, onClick }: { ch: Channel; onClick: () => void }) {
  return (
    <button
      className="grow"
      data-nav=""
      onClick={onClick}
      style={{
        width: 200, height: 130, flexShrink: 0, borderRadius: 20, border: 0, cursor: 'pointer', padding: 16, textAlign: 'left',
        background: 'rgba(255,255,255,0.08)', color: T.text, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ChannelLogo ch={ch} size={48} />
      </div>
      <div className="gy-2" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.name}</span>
        <span className="muted" style={{ fontSize: 14 }}>{ch.number} · {ch.group}</span>
      </div>
    </button>
  );
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
      <div className="gy-12" style={{ padding: `${mobile ? 4 : 12}px ${L.px}px 0`, maxWidth: 760, display: 'flex', flexDirection: 'column' }}>
        <span className="badge-live" style={{ alignSelf: 'flex-start', fontSize: mobile ? 12 : 14 }}>{last ? 'Continuar assistindo' : 'Ao vivo'}</span>
        <span className="title" style={{ fontSize: mobile ? 28 : 40, fontWeight: 800, lineHeight: 1.05 }}>{last ? last.name : 'Bem-vindo ao PRISMA'}</span>
        <span className="muted" style={{ fontSize: mobile ? 15 : 18 }}>
          {playlist.source.name} · {live.length.toLocaleString('pt-BR')} canais · {movies.toLocaleString('pt-BR')} filmes · {series.toLocaleString('pt-BR')} séries
        </span>
        <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap', marginTop: 14 }}>
          {last && (
            <button className="btn primary" data-nav="" data-nav-default="" onClick={() => onWatch(last, recents)}>▶ Assistir {last.name}</button>
          )}
          <button className="btn" data-nav="" data-nav-default={last ? undefined : ''} onClick={onGoLive}>Ver todos os canais</button>
        </div>
      </div>

      <Shelf title="Favoritos" items={favs} empty="Favorite canais na tela cheia (botão ★) para eles aparecerem aqui." onWatch={(c) => onWatch(c, favs)} />
      <Shelf title="Vistos por último" items={recents} empty="Os canais que você assistir aparecem aqui." onWatch={(c) => onWatch(c, recents)} />
    </div>
  );
}

function Shelf({ title, items, empty, onWatch }: { title: string; items: Channel[]; empty: string; onWatch: (c: Channel) => void }) {
  const L = useLayout();
  return (
    <div className="gy-12" style={{ marginTop: L.form === 'mobile' ? 22 : 34, display: 'flex', flexDirection: 'column' }}>
      <span className="title" style={{ fontSize: L.form === 'mobile' ? 19 : 22, padding: `0 ${L.px}px` }}>{title}</span>
      {items.length ? (
        <div className="scroll-x gx-16" style={{ padding: `10px ${L.px}px 14px ${L.px}px`, margin: '-8px 0 -14px 0' }}>
          {items.slice(0, 20).map((c) => <ChannelCard key={c.id} ch={c} onClick={() => onWatch(c)} />)}
        </div>
      ) : (
        <span className="muted" style={{ fontSize: 16, padding: `0 ${L.px}px` }}>{empty}</span>
      )}
    </div>
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
    return playlist.items.filter((i) => normalize(i.name).includes(n)).slice(0, 500);
  }, [q, playlist]);
  const live = results.filter((r) => r.kind === 'live');
  const vod = results.length - live.length;
  const L = useLayout();
  const mobile = L.form === 'mobile';
  return (
    <div className="gy-16" style={{ position: 'absolute', left: L.px, right: L.px, top: L.top + (mobile ? 0 : 10), bottom: L.bottom, display: 'flex', flexDirection: 'column' }}>
      <div className="field">
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
          style={{ height: mobile ? 50 : 60, fontSize: mobile ? 18 : 22 }}
        />
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
          render={(c) => (
            <>
              <span className="num">{c.number ?? ''}</span>
              <ChannelLogo ch={c} />
              <div className="txt">
                <span className="name">{c.name}</span>
                <span className="sub">{c.group}</span>
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
