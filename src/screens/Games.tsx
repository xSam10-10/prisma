import { useEffect, useMemo, useRef, useState } from 'react';
import { hasReminder, isSportsChannel, loadGames, matchOf, toggleReminder, type Game } from '../core/games';
import type { Channel, Playlist } from '../core/types';
import { ChannelLogo, fmtTime } from '../ui/bits';
import { Modal } from '../ui/Dialog';
import { useLayout } from '../ui/layout';
import { T } from '../ui/tokens';
import { VirtualList, type VirtualListHandle } from '../ui/VirtualList';

type Filter = 'agora' | 'hoje' | 'amanha' | 'todos';

function dayKey(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function status(g: Game, now: number): 'live' | 'soon' | 'later' {
  if (g.start <= now && now < g.end) return 'live';
  if (g.start - now < 60 * 60 * 1000) return 'soon';
  return 'later';
}

export function Games({ playlist, onWatch }: { playlist: Playlist; onWatch: (c: Channel, list: Channel[]) => void }) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const [games, setGames] = useState<Game[] | null>(null);
  const [prog, setProg] = useState({ done: 0, total: 0 });
  const [filter, setFilter] = useState<Filter>('agora');
  const [league, setLeague] = useState('');
  const [index, setIndex] = useState(0);
  const [, force] = useState(0);
  const [open, setOpen] = useState<Game | null>(null);
  const listRef = useRef<VirtualListHandle>(null);
  const now = Date.now();
  const sports = useMemo(() => playlist.items.filter(isSportsChannel), [playlist]);

  useEffect(() => {
    let alive = true;
    loadGames(playlist, (done, total) => alive && setProg({ done, total })).then((g) => {
      if (!alive) return;
      setGames(g);
      // Sem jogo ao vivo agora: começa em "Hoje".
      if (!g.some((x) => status(x, Date.now()) === 'live')) setFilter('hoje');
      requestAnimationFrame(() => listRef.current?.focus());
    });
    return () => {
      alive = false;
    };
  }, [playlist]);

  const today = dayKey(now);
  const list = useMemo(() => {
    let l = games ?? [];
    if (filter === 'agora') l = l.filter((g) => status(g, now) === 'live');
    else if (filter === 'hoje') l = l.filter((g) => dayKey(g.start) === today || status(g, now) === 'live');
    else if (filter === 'amanha') l = l.filter((g) => dayKey(g.start) === today + 86400000);
    if (league) l = l.filter((g) => g.league === league);
    return l;
  }, [games, filter, league, now, today]);
  const leagues = useMemo(() => [...new Set((games ?? []).map((g) => g.league))].slice(0, 12), [games]);
  useEffect(() => setIndex(0), [filter, league]);
  const sel = list[index];

  if (playlist.source.type !== 'xtream') {
    return <Info L={L} title="Jogos" text="O guia de jogos é montado com o guia de programação dos canais de esporte, que hoje vem da API Xtream. Com lista M3U, ele chega junto com o guia completo (XMLTV)." />;
  }
  if (!sports.length) {
    return <Info L={L} title="Jogos" text="Não encontrei canais de esporte na sua lista (procuro por categorias e nomes como Esportes, SporTV, ESPN, Premiere, PPV, UFC)." />;
  }
  if (!games) {
    return (
      <Info L={L} title="Procurando jogos…" text={`Lendo o guia dos canais de esporte: ${prog.done} de ${prog.total || sports.length}.`}>
        <div className="progress" style={{ maxWidth: 420, marginTop: 8 }}><div style={{ width: `${prog.total ? (prog.done / prog.total) * 100 : 5}%`, background: T.primary }} /></div>
      </Info>
    );
  }

  const chips: [Filter, string, number][] = [
    ['agora', 'Ao vivo agora', games.filter((g) => status(g, now) === 'live').length],
    ['hoje', 'Hoje', games.filter((g) => dayKey(g.start) === today || status(g, now) === 'live').length],
    ['amanha', 'Amanhã', games.filter((g) => dayKey(g.start) === today + 86400000).length],
    ['todos', 'Todos', games.length],
  ];

  const detail = (g: Game) => <GameDetail g={g} now={now} onWatch={(c) => onWatch(c, g.channels)} onReminder={() => { toggleReminder(g); force((x) => x + 1); }} />;

  const listW = mobile ? L.W - L.px * 2 : Math.round(Math.min(620, Math.max(440, L.W * 0.42)));

  return (
    <>
      <div className="scroll-x" style={{ position: 'absolute', left: L.px, right: L.px, top: L.top, height: 48, alignItems: 'center' }}>
        {chips.map(([id, label, n]) => (
          <button key={id} className={'chip' + (filter === id ? ' on' : '')} data-nav="" onClick={() => setFilter(id)} style={{ height: 40 }}>
            {id === 'agora' && <span style={{ color: filter === id ? T.live : T.live, marginRight: 6 }}>●</span>}
            {label} · {n}
          </button>
        ))}
        {leagues.length > 1 && <span className="muted" style={{ margin: '0 4px 0 14px', fontSize: 14, flexShrink: 0 }}>Ligas</span>}
        {leagues.length > 1 && leagues.map((l) => (
          <button key={l} className={'chip' + (league === l ? ' on' : '')} data-nav="" onClick={() => setLeague(league === l ? '' : l)} style={{ height: 40 }}>{l}</button>
        ))}
      </div>

      <div className={mobile ? '' : 'glass'} style={{ position: 'absolute', left: L.px, top: L.top + 60, bottom: L.bottom, width: listW, borderRadius: T.radiusPanel, padding: mobile ? 0 : 14, display: 'flex' }}>
        <VirtualList
          ref={listRef}
          items={list}
          index={index}
          onIndex={setIndex}
          rowHeight={74}
          label="Jogos"
          onPick={(g) => (mobile ? setOpen(g) : g.channels[0] && status(g, now) === 'live' ? onWatch(g.channels[0], g.channels) : undefined)}
          render={(g) => {
            const st = status(g, now);
            return (
              <>
                <span className="game-time">
                  {st === 'live' ? <span className="badge-live" style={{ fontSize: 11, padding: '3px 7px' }}>Ao vivo</span> : fmtTime(g.start)}
                  {st !== 'live' && dayKey(g.start) !== today && <small>{dayKey(g.start) === today + 86400000 ? 'amanhã' : new Date(g.start).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</small>}
                </span>
                <div className="txt">
                  <span className="name" style={{ textTransform: 'none' }}>{matchOf(g.title)}</span>
                  <span className="sub caps" style={{ fontSize: 13 }}>{g.league} · {g.channels.length} {g.channels.length > 1 ? 'canais' : 'canal'}</span>
                </div>
                {hasReminder(g.key) && <span title="Lembrete" style={{ color: T.warn }}>⏰</span>}
              </>
            );
          }}
          empty={
            <div className="gy-8" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
              <span className="title" style={{ fontSize: 20 }}>{filter === 'agora' ? 'Nenhum jogo ao vivo agora' : 'Nenhum jogo encontrado'}</span>
              <span className="muted" style={{ fontSize: 15 }}>Veja “Hoje” ou “Todos”. Os jogos vêm do guia dos {sports.length} canais de esporte da sua lista.</span>
            </div>
          }
        />
      </div>

      {!mobile && (
        <div className="glass" style={{ position: 'absolute', left: L.px + listW + 24, right: L.px, top: L.top + 60, bottom: L.bottom, borderRadius: T.radiusPanel, padding: 28, overflow: 'hidden' }}>
          {sel ? detail(sel) : <span className="muted" style={{ fontSize: 16 }}>Escolha um jogo na lista.</span>}
        </div>
      )}
      {mobile && open && (
        <Modal title={open.league} onClose={() => setOpen(null)} width={L.W - 24}>
          {detail(open)}
        </Modal>
      )}
    </>
  );
}

function GameDetail({ g, now, onWatch, onReminder }: { g: Game; now: number; onWatch: (c: Channel) => void; onReminder: () => void }) {
  const st = status(g, now);
  const teams = matchOf(g.title).split(/\s+(?:x|vs\.?|versus|×)\s+/i);
  const pct = Math.max(0, Math.min(1, (now - g.start) / Math.max(1, g.end - g.start)));
  const rem = hasReminder(g.key);
  return (
    <div className="gy-16" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <span className="muted caps" style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>{g.league}</span>
      {teams.length === 2 ? (
        <div className="game-teams">
          <span>{teams[0]}</span>
          <i>×</i>
          <span>{teams[1]}</span>
        </div>
      ) : (
        <span className="title" style={{ fontSize: 34, lineHeight: 1.1 }}>{matchOf(g.title)}</span>
      )}
      <div className="gx-12" style={{ display: 'flex', alignItems: 'center' }}>
        {st === 'live' ? <span className="badge-live">● Ao vivo</span> : <span className="chip" style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(245,184,61,0.18)', color: T.warn }}>{st === 'soon' ? 'Começa em breve' : 'Agendado'}</span>}
        <span style={{ fontSize: 17, fontWeight: 700 }}>
          {new Date(g.start).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })} · {fmtTime(g.start)} – {fmtTime(g.end)}
        </span>
      </div>
      {st === 'live' && <div className="progress" style={{ maxWidth: 520 }}><div style={{ width: `${pct * 100}%` }} /></div>}
      <span className="muted" style={{ fontSize: 14 }}>Placar ao vivo e estatísticas: em breve (precisa de um serviço de dados esportivos).</span>
      <span className="title" style={{ fontSize: 19, marginTop: 4 }}>Onde assistir</span>
      <div className="gy-8 scroll-y" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: 230 }}>
        {g.channels.map((c) => (
          <button key={c.id} className="where-row" data-nav="" onClick={() => onWatch(c)}>
            <ChannelLogo ch={c} size={40} />
            <span className="caps" style={{ fontWeight: 700, flexGrow: 1, textAlign: 'left' }}>{c.name}</span>
            <span className="muted" style={{ fontSize: 14 }}>{st === 'live' ? '▶ Assistir' : `Canal ${c.number ?? ''}`}</span>
          </button>
        ))}
      </div>
      <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap', marginTop: 'auto' }}>
        <button className="btn primary" data-nav="" onClick={() => g.channels[0] && onWatch(g.channels[0])}>▶ {st === 'live' ? 'Assistir agora' : 'Ir para o canal'}</button>
        {st !== 'live' && (
          <button className="btn" data-nav="" onClick={onReminder} style={rem ? { color: T.warn } : undefined}>
            {rem ? '⏰ Lembrete ativado' : '⏰ Lembrar quando começar'}
          </button>
        )}
      </div>
    </div>
  );
}

function Info({ L, title, text, children }: { L: ReturnType<typeof useLayout>; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="gy-14" style={{ position: 'absolute', left: L.px, right: L.px, top: L.top + 40, display: 'flex', flexDirection: 'column', maxWidth: 760 }}>
      <span className="title" style={{ fontSize: L.form === 'mobile' ? 28 : 40, fontWeight: 800 }}>{title}</span>
      <span className="muted" style={{ fontSize: 18, lineHeight: 1.5 }}>{text}</span>
      {children}
    </div>
  );
}
