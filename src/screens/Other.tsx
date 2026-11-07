import { T } from '../ui/tokens';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Channel, Playlist } from '../core/types';
import { Ambient, ChannelLogo, Icon, Symbol } from '../ui/bits';
import { VirtualList, type VirtualListHandle } from '../ui/VirtualList';
import { focusFirst } from '../ui/nav';

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
  useEffect(() => {
    requestAnimationFrame(() => focusFirst(root.current));
  }, []);
  return (
    <div ref={root} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
      <div className="gy-12" style={{ position: 'absolute', left: 64, top: 112, width: 640, display: 'flex', flexDirection: 'column' }}>
        <span className="badge-live" style={{ alignSelf: 'flex-start' }}>{last ? 'Continuar assistindo' : 'Ao vivo'}</span>
        <span className="title" style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.05 }}>{last ? last.name : 'Bem-vindo ao PRISMA'}</span>
        <span className="muted" style={{ fontSize: 18 }}>
          {playlist.source.name} · {live.length.toLocaleString('pt-BR')} canais · {movies.toLocaleString('pt-BR')} filmes · {series.toLocaleString('pt-BR')} séries
        </span>
        <div className="gx-12" style={{ display: 'flex', marginTop: 20 }}>
          {last && (
            <button className="btn primary" data-nav="" data-nav-default="" onClick={() => onWatch(last, recents)}>▶ Assistir {last.name}</button>
          )}
          <button className="btn" data-nav="" data-nav-default={last ? undefined : ''} onClick={onGoLive}>Ver todos os canais</button>
        </div>
      </div>

      <Shelf title="Favoritos" items={favs} empty="Favorite canais na tela cheia (botão ★) para eles aparecerem aqui." top={330} onWatch={(c) => onWatch(c, favs)} />
      <Shelf title="Vistos por último" items={recents} empty="Os canais que você assistir aparecem aqui." top={520} onWatch={(c) => onWatch(c, recents)} />
    </div>
  );
}

function Shelf({ title, items, empty, top, onWatch }: { title: string; items: Channel[]; empty: string; top: number; onWatch: (c: Channel) => void }) {
  return (
    <div className="gy-12" style={{ position: 'absolute', left: 64, right: 0, top, display: 'flex', flexDirection: 'column' }}>
      <span className="title" style={{ fontSize: 22 }}>{title}</span>
      {items.length ? (
        <div className="scroll-x gx-16" style={{ padding: '10px 64px 14px 8px', margin: '2px 0 -14px -8px' }}>
          {items.slice(0, 20).map((c) => <ChannelCard key={c.id} ch={c} onClick={() => onWatch(c)} />)}
        </div>
      ) : (
        <span className="muted" style={{ fontSize: 16 }}>{empty}</span>
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
  return (
    <div className="gy-16" style={{ position: 'absolute', left: 64, right: 64, top: 110, bottom: 36, display: 'flex', flexDirection: 'column' }}>
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
          style={{ height: 60, fontSize: 22 }}
        />
      </div>
      <span className="muted" style={{ fontSize: 16 }}>
        {q.trim().length < 2
          ? 'Digite pelo menos 2 letras. Na TV, o teclado do aparelho aparece ao apertar OK no campo.'
          : `${live.length} canais${vod ? ` · ${vod} filmes/séries (chegam no passo 4 da Fase 1)` : ''}`}
      </span>
      <div className="glass" style={{ flexGrow: 1, borderRadius: T.radiusPanel, padding: 16, display: 'flex', minHeight: 0 }}>
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

// ---------------------------------------------------------------- Ajustes
export function Settings({
  playlist, onReload, onChange, onRemove, reloading,
}: {
  playlist: Playlist;
  onReload: () => void;
  onChange: () => void;
  onRemove: () => void;
  reloading: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    requestAnimationFrame(() => focusFirst(root.current));
  }, []);
  const s = playlist.source;
  const a = playlist.account;
  const count = (k: Channel['kind']) => playlist.items.filter((i) => i.kind === k).length.toLocaleString('pt-BR');
  const kind = s.type === 'xtream' ? 'Xtream (Smarters / XCIPTV)' : s.type === 'm3u' ? 'Link M3U' : 'Arquivo M3U';
  const rows: [string, string][] = [
    ['Nome', s.name],
    ['Tipo', kind],
    ...(s.type === 'xtream' ? ([['Servidor', s.server], ['Usuário', s.username]] as [string, string][]) : []),
    ...(s.type === 'm3u' ? ([['Link', s.url.replace(/(password=)[^&]+/i, '$1••••')]] as [string, string][]) : []),
    ...(a?.expiresAt ? ([['Vence em', new Date(a.expiresAt).toLocaleDateString('pt-BR')]] as [string, string][]) : []),
    ...(a?.maxConnections ? ([['Telas ao mesmo tempo', `${a.activeConnections ?? 0} em uso de ${a.maxConnections}`]] as [string, string][]) : []),
    ['Conteúdo', `${count('live')} canais · ${count('movie')} filmes · ${count('series')} séries`],
    ['Atualizada', new Date(playlist.loadedAt).toLocaleString('pt-BR')],
  ];
  return (
    <div className="gx-24" ref={root} style={{ position: 'absolute', left: 64, right: 64, top: 110, bottom: 36, display: 'flex' }}>
      <div className="gy-10" style={{ width: 300, display: 'flex', flexDirection: 'column' }}>
        <span className="title" style={{ fontSize: 26 }}>Ajustes</span>
        <button className="btn primary" data-nav="" style={{ borderRadius: 16, height: 52, justifyContent: 'flex-start' }}>Lista</button>
        <button className="btn" data-nav="" disabled style={{ borderRadius: 16, height: 52, justifyContent: 'flex-start' }}>Aparência · passo 5</button>
        <button className="btn" data-nav="" disabled style={{ borderRadius: 16, height: 52, justifyContent: 'flex-start' }}>Perfis · passo 5</button>
      </div>
      <div className="glass gy-14" style={{ flexGrow: 1, borderRadius: T.radiusPanel, padding: 28, display: 'flex', flexDirection: 'column' }}>
        {rows.map(([k, v]) => (
          <div className="gx-16" key={k} style={{ display: 'flex', fontSize: 17 }}>
            <span className="muted" style={{ width: 210, flexShrink: 0 }}>{k}</span>
            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
          </div>
        ))}
        <div style={{ flexGrow: 1 }} />
        <div className="gx-12" style={{ display: 'flex', alignItems: 'center' }}>
          <button className="btn primary" data-nav="" data-nav-default="" disabled={reloading || s.type === 'm3u-file'} onClick={onReload}>
            {reloading ? 'Atualizando…' : 'Atualizar lista agora'}
          </button>
          <button className="btn" data-nav="" onClick={onChange}>Trocar lista</button>
          <button className="btn" data-nav="" onClick={onRemove}>Remover lista</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Em breve
export function Soon({ title, step, text, count }: { title: string; step: string; text: string; count?: number }) {
  return (
    <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
      <Ambient variant="soft" />
      <div className="gy-14" style={{ position: 'absolute', left: 64, top: 160, width: 720, display: 'flex', flexDirection: 'column' }}>
        <Symbol size={72} />
        <span className="title" style={{ fontSize: 40, fontWeight: 800 }}>{title}</span>
        <span className="chip" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', background: 'rgba(245,184,61,0.18)', color: T.warn }}>
          {step}
        </span>
        <span className="muted" style={{ fontSize: 18, lineHeight: 1.5 }}>{text}</span>
        {count !== undefined && (
          <span style={{ fontSize: 18 }}>
            {Icon.bookmark} <b>{count.toLocaleString('pt-BR')}</b> itens já foram lidos da sua lista e estão prontos para esta tela.
          </span>
        )}
      </div>
    </div>
  );
}
