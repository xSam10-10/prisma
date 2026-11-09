import { useEffect, useMemo, useRef, useState } from 'react';
import { ensureReminder, gamesStats, hasReminder, isSportsChannel, loadGames, matchOf, myTeams, setMyTeams, teamsOf, toggleReminder, type Game } from '../core/games';
import { TABLE_LEAGUES, isMyTeam, loadFixtures, loadMatchStats, loadStandings, sameTeam, teamKey, type MatchStats, type Table } from '../core/scores';
import type { Channel, Playlist } from '../core/types';
import { loadScores, orderedScore, scoreFor, type Score } from '../core/scores';
import { ChannelLogo, fmtTime, rgba } from '../ui/bits';
import { Modal } from '../ui/Dialog';
import { useLayout } from '../ui/layout';
import { T } from '../ui/tokens';
import { EmptyState } from '../ui/premium2';
import { VirtualList, type VirtualListHandle } from '../ui/VirtualList';

type Filter = 'agora' | 'hoje' | 'amanha' | 'todos' | 'meus';

/** Clubes sugeridos em "Meus times" (além dos que aparecem no guia). */
const POPULAR = ['Flamengo', 'Palmeiras', 'Corinthians', 'São Paulo', 'Santos', 'Grêmio', 'Internacional', 'Atlético Mineiro', 'Cruzeiro', 'Botafogo', 'Fluminense', 'Vasco', 'Bahia', 'Fortaleza', 'Athletico Paranaense', 'Vitória', 'Sport', 'Ceará', 'Juventude', 'Bragantino', 'Real Madrid', 'Barcelona', 'Manchester City', 'Liverpool', 'Arsenal', 'Chelsea', 'Bayern', 'PSG', 'Inter de Milão', 'Juventus'];

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
  const [mode, setMode] = useState<'jogos' | 'tabela'>('jogos');
  const [teamsDlg, setTeamsDlg] = useState(false);
  const [mine, setMine] = useState<string[]>(myTeams());
  const isMine = (g: Game) => mine.length > 0 && teamsOf(g).some((t) => isMyTeam(t, mine));
  const listRef = useRef<VirtualListHandle>(null);
  // Placar ao vivo (ESPN): atualiza a cada minuto enquanto a tela está aberta.
  const [scores, setScores] = useState<Score[]>([]);
  useEffect(() => {
    let alive = true;
    const tick = () => loadScores().then((s) => alive && setScores(s));
    tick();
    const t = setInterval(tick, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  const now = Date.now();
  const sports = useMemo(() => playlist.items.filter(isSportsChannel), [playlist]);

  useEffect(() => {
    let alive = true;
    loadGames(playlist, (done, total) => alive && setProg({ done, total })).then((g) => {
      if (!alive) return;
      setGames(g);
      // Meus times: lembrete automático de todos os jogos deles.
      const mt = myTeams();
      if (mt.length) for (const x of g) if (x.start > Date.now() && teamsOf(x).some((t) => isMyTeam(t, mt))) ensureReminder(x);
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
    else if (filter === 'meus') l = l.filter(isMine);
    if (league) l = l.filter((g) => g.league === league);
    return l;
  }, [games, filter, league, now, today, mine]); // eslint-disable-line react-hooks/exhaustive-deps
  const leagues = useMemo(() => [...new Set((games ?? []).map((g) => g.league))].slice(0, 12), [games]);
  useEffect(() => setIndex(0), [filter, league]);
  const sel = list[index];

  if (!sports.length) {
    return <Info L={L} title="Jogos" text="Não encontrei canais de esporte na sua lista (procuro por categorias e nomes como Esportes, SporTV, ESPN, Premiere, PPV, UFC)." />;
  }
  if (!games) {
    return (
      <Info L={L} title="Procurando jogos…" text={prog.total ? `Lendo o guia dos canais de esporte: ${prog.done} de ${prog.total}.` : 'Lendo o guia de programação e o placar do dia…'}>
        <div className="progress" style={{ maxWidth: 420, marginTop: 8 }}><div style={{ width: `${prog.total ? (prog.done / prog.total) * 100 : 5}%`, background: T.primary }} /></div>
      </Info>
    );
  }

  const chips: [Filter, string, number][] = [
    ['agora', 'Ao vivo agora', games.filter((g) => status(g, now) === 'live').length],
    ['hoje', 'Hoje', games.filter((g) => dayKey(g.start) === today || status(g, now) === 'live').length],
    ['amanha', 'Amanhã', games.filter((g) => dayKey(g.start) === today + 86400000).length],
    ['todos', 'Todos', games.length],
    ['meus', '★ Meus times', games.filter(isMine).length],
  ];

  const detail = (g: Game) => <GameDetail g={g} score={scoreFor(g, scores)} now={now} onWatch={(c) => onWatch(c, g.channels)} onReminder={() => { toggleReminder(g); force((x) => x + 1); }} />;

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
        <button className={'chip' + (mode === 'tabela' ? ' on' : '')} data-nav="" onClick={() => setMode(mode === 'tabela' ? 'jogos' : 'tabela')} style={{ height: 40, marginLeft: 14 }}>▦ Tabela e próximos jogos</button>
        <button className="chip" data-nav="" onClick={() => setTeamsDlg(true)} style={{ height: 40 }}>☆ Escolher meus times{mine.length ? ` (${mine.length})` : ''}</button>
        {mode === 'jogos' && leagues.length > 1 && <span className="muted" style={{ margin: '0 4px 0 14px', fontSize: 14, flexShrink: 0 }}>Ligas</span>}
        {mode === 'jogos' && leagues.length > 1 && leagues.map((l) => (
          <button key={l} className={'chip' + (league === l ? ' on' : '')} data-nav="" onClick={() => setLeague(league === l ? '' : l)} style={{ height: 40 }}>{l}</button>
        ))}
      </div>

      {teamsDlg && (
        <MyTeamsDialog
          games={games}
          initial={mine}
          onClose={() => setTeamsDlg(false)}
          onSave={(list) => {
            setMyTeams(list);
            setMine(list);
            setTeamsDlg(false);
            for (const x of games) if (x.start > Date.now() && teamsOf(x).some((t) => isMyTeam(t, list))) ensureReminder(x);
            force((n) => n + 1);
          }}
        />
      )}
      {mode === 'tabela' ? (
        <StandingsView games={games} mine={mine} onWatch={(c, list) => onWatch(c, list)} />
      ) : (
      <>
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
                  <span className="sub caps" style={{ fontSize: 13 }}>
                    {g.league} · {g.likely ? (g.channels.length ? 'canais prováveis' : 'canal não informado') : `${g.channels.length} ${g.channels.length > 1 ? 'canais' : 'canal'}`}
                  </span>
                </div>
                {(() => {
                  const sc = scoreFor(g, scores);
                  if (!sc || sc.state === 'pre') return null;
                  const [a, b] = orderedScore(g, sc);
                  return (
                    <span className={'score-pill' + (sc.state === 'in' ? ' live' : '')}>
                      {a} × {b}
                      <small>{sc.detail}</small>
                    </span>
                  );
                })()}
                {isMine(g) && <span title="Meu time" style={{ color: T.warn }}>★</span>}
                {hasReminder(g.key) && <span title="Lembrete" style={{ color: T.warn }}>⏰</span>}
              </>
            );
          }}
          empty={
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <EmptyState
                kind="games"
                title={filter === 'agora' ? 'Nenhum jogo ao vivo agora' : 'Nenhum jogo encontrado'}
                text={`Veja “Hoje” ou “Todos”. Os jogos vêm do guia dos ${sports.length} canais de esporte da sua lista e do placar do dia da ESPN.`}
                action={filter !== 'todos' && games.length ? { label: 'Ver todos os jogos', onClick: () => setFilter('todos') } : undefined}
              />
              {games.length === 0 && <div style={{ padding: '0 20px' }}><GamesDiag /></div>}
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
      )}
    </>
  );
}

function GameDetail({ g, score, now, onWatch, onReminder }: { g: Game; score?: Score; now: number; onWatch: (c: Channel) => void; onReminder: () => void }) {
  const sc = score && score.state !== 'pre' ? orderedScore(g, score) : null;
  const st = status(g, now);
  const teams = matchOf(g.title).split(/\s+(?:x|vs\.?|versus|×)\s+/i);
  const pct = Math.max(0, Math.min(1, (now - g.start) / Math.max(1, g.end - g.start)));
  const rem = hasReminder(g.key);
  const [tab, setTab] = useState<'onde' | 'stats' | 'escal'>('onde');
  useEffect(() => setTab('onde'), [g.key]);
  return (
    <div className="gy-16" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <span className="muted caps" style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>{g.league}</span>
      {teams.length === 2 && score && (score.homeLogo || score.awayLogo) ? (
        <MatchHero g={g} score={score} teams={teams as [string, string]} />
      ) : teams.length === 2 ? (
        <div className="game-teams">
          <span>{teams[0]}</span>
          {sc ? (
            <b className={'big-score' + (score!.state === 'in' ? ' live' : '')}>
              <span className="nums">{sc[0]}<i>×</i>{sc[1]}</span>
              <small>{score!.detail}</small>
            </b>
          ) : (
            <i>×</i>
          )}
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
      <span className="muted" style={{ fontSize: 13 }}>
        {score ? `Placar: ESPN · atualiza a cada minuto${score.state === 'pre' ? ' (ainda não começou)' : ''}` : 'Placar indisponível para este jogo (a fonte cobre as principais ligas de futebol, NBA, NFL e UFC).'}
      </span>
      <div className="gx-8" style={{ display: 'flex', marginTop: 4, flexShrink: 0 }}>
        {(['onde', 'stats', 'escal'] as const).map((t) => (
          <button key={t} className={'chip' + (tab === t ? ' on' : '')} data-nav="" style={{ height: 36 }} onClick={() => setTab(t)}>
            {t === 'onde' ? 'Onde assistir' : t === 'stats' ? 'Estatísticas' : 'Escalações'}
          </button>
        ))}
      </div>
      {tab !== 'onde' ? (
        <MatchInfo score={score} tab={tab} />
      ) : (
      <div className="gy-8 scroll-y" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flexGrow: 1, flexShrink: 1 }}>
        {g.likely && (
          <span className="muted" style={{ fontSize: 14, lineHeight: 1.4 }}>
            {g.channels.length
              ? 'Este jogo veio do placar da ESPN e não apareceu no guia da sua lista. Estes são os canais que costumam transmitir a competição:'
              : 'Este jogo veio do placar da ESPN e não apareceu no guia da sua lista. Procure nos canais de esporte (Ao vivo).'}
          </span>
        )}
        {g.channels.map((c) => (
          <button key={c.id} className="where-row" data-nav="" onClick={() => onWatch(c)}>
            <ChannelLogo ch={c} size={40} />
            <span className="caps" style={{ fontWeight: 700, flexGrow: 1, textAlign: 'left' }}>{c.name}</span>
            <span className="muted" style={{ fontSize: 14 }}>{st === 'live' ? '▶ Assistir' : `Canal ${c.number ?? ''}`}</span>
          </button>
        ))}
      </div>
      )}
      <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap', flexShrink: 0, marginBottom: -12 }}>
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

/** Estatísticas e escalações do jogo (ESPN). */
function MatchInfo({ score, tab }: { score?: Score; tab: 'stats' | 'escal' }) {
  const [data, setData] = useState<MatchStats | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    setData(undefined);
    if (!score?.id) {
      setData(null);
      return;
    }
    const load = () => loadMatchStats(score).then((d) => alive && setData(d), () => alive && setData(null));
    load();
    // Ao vivo: atualiza a cada minuto.
    const t = score.state === 'in' ? setInterval(load, 60000) : undefined;
    return () => {
      alive = false;
      if (t) clearInterval(t);
    };
  }, [score?.id, score?.state]); // eslint-disable-line react-hooks/exhaustive-deps
  if (data === undefined) return <span className="muted" style={{ fontSize: 15 }}>Carregando…</span>;
  if (!data) return <span className="muted" style={{ fontSize: 15 }}>Sem estatísticas para este jogo (a fonte cobre as principais ligas de futebol).</span>;
  if (tab === 'escal') {
    if (!data.lineups.length) return <span className="muted" style={{ fontSize: 15 }}>As escalações saem perto do início do jogo.</span>;
    return (
      <div className="lineups scroll-y">
        {data.lineups.map((l) => (
          <div key={l.team} className="lineup">
            <span className="lineup-team">{l.team}{l.formation ? ` · ${l.formation}` : ''}</span>
            {l.starters.map((p) => <span key={p} className="lineup-p">{p}</span>)}
            {l.bench.length > 0 && <span className="lineup-bench">Reservas: {l.bench.join(', ')}</span>}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="mstats scroll-y">
      {data.events.length > 0 && (
        <div className="mevents">
          {data.events.map((e, i) => (
            <span key={i} className="mevent">
              <b>{e.minute}</b> {e.kind === 'goal' ? '⚽' : e.kind === 'yellow' ? '🟨' : e.kind === 'red' ? '🟥' : '⇄'} {e.text} <i>· {e.team}</i>
            </span>
          ))}
        </div>
      )}
      {data.stats.map(([label, h, a]) => {
        const x = parseFloat(h) || 0;
        const y = parseFloat(a) || 0;
        const pct = x + y > 0 ? (x / (x + y)) * 100 : 50;
        return (
          <div key={label} className="mstat">
            <div className="mstat-l"><b>{h}</b><span>{label}</span><b>{a}</b></div>
            <div className="mstat-bar"><div style={{ width: pct + '%' }} /></div>
          </div>
        );
      })}
      {!data.stats.length && !data.events.length && <span className="muted" style={{ fontSize: 15 }}>As estatísticas aparecem quando o jogo começa.</span>}
    </div>
  );
}

/** Tabela de classificação e próximos jogos da liga. */
function StandingsView({ games, mine, onWatch }: { games: Game[]; mine: string[]; onWatch: (c: Channel, list: Channel[]) => void }) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const [path, setPath] = useState(TABLE_LEAGUES[0][0]);
  const [tables, setTables] = useState<Table[] | null | undefined>(undefined);
  const [fixtures, setFixtures] = useState<Score[] | null>(null);
  const [, force] = useState(0);
  useEffect(() => {
    let alive = true;
    setTables(undefined);
    setFixtures(null);
    loadStandings(path).then((t) => alive && setTables(t), () => alive && setTables(null));
    loadFixtures(path).then((f) => alive && setFixtures(f.filter((x) => x.state !== 'post')), () => alive && setFixtures([]));
    return () => {
      alive = false;
    };
  }, [path]);
  // Jogo do guia correspondente (para "onde assistir" e lembrete).
  const guideGame = (f: Score) =>
    games.find((g) => {
      const t = teamsOf(g);
      if (t.length !== 2 || Math.abs(g.start - f.start) > 4 * 3600000) return false;
      const k = [teamKey(f.home), teamKey(f.away)];
      return t.some((x) => k.some((y) => teamKey(x).split(' ')[0] === y.split(' ')[0]));
    });
  const top = L.top + 60;
  const leftW = mobile ? L.W - L.px * 2 : Math.round((L.W - L.px * 2) * 0.56);
  return (
    <>
      <div className="scroll-x" style={{ position: 'absolute', left: L.px, right: L.px, top, height: 44, alignItems: 'center' }}>
        {TABLE_LEAGUES.map(([p, name]) => (
          <button key={p} className={'chip' + (p === path ? ' on' : '')} data-nav="" style={{ height: 38 }} onClick={() => setPath(p)}>{name}</button>
        ))}
      </div>
      <div className="glass table-box scroll-y" style={{ position: 'absolute', left: L.px, top: top + 56, bottom: mobile ? '45%' : L.bottom, width: leftW, borderRadius: T.radiusPanel }}>
        {tables === undefined ? (
          <span className="muted" style={{ padding: 20, display: 'block' }}>Carregando a tabela…</span>
        ) : !tables || !tables.length ? (
          <span className="muted" style={{ padding: 20, display: 'block' }}>Tabela indisponível agora (fonte: ESPN).</span>
        ) : (
          tables.map((t) => (
            <table key={t.name} className="stand">
              <thead>
                <tr><th className="l" colSpan={2}>{tables.length > 1 ? t.name : 'Classificação'}</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th></tr>
              </thead>
              <tbody>
                {t.rows.map((r) => (
                  <tr key={r.team} className={isMyTeam(r.team, mine) ? 'mine' : ''}>
                    <td className="pos">{r.rank}</td>
                    <td className="l team">{r.team}{isMyTeam(r.team, mine) ? ' ★' : ''}</td>
                    <td className="pts">{r.points}</td><td>{r.played}</td><td>{r.wins}</td><td>{r.draws}</td><td>{r.losses}</td><td>{r.gd > 0 ? '+' + r.gd : r.gd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))
        )}
      </div>
      <div className="glass fixtures scroll-y" style={mobile ? { position: 'absolute', left: L.px, right: L.px, top: '57%', bottom: L.bottom, borderRadius: T.radiusPanel } : { position: 'absolute', left: L.px + leftW + 20, right: L.px, top: top + 56, bottom: L.bottom, borderRadius: T.radiusPanel }}>
        <span className="fix-title">Próximos jogos</span>
        {fixtures === null ? (
          <span className="muted">Carregando…</span>
        ) : !fixtures.length ? (
          <span className="muted">Sem jogos nos próximos 7 dias.</span>
        ) : (
          fixtures.map((f) => {
            const g = guideGame(f);
            const live = f.state === 'in';
            return (
              <div key={(f.id ?? '') + f.home} className={'fix' + (isMyTeam(f.home, mine) || isMyTeam(f.away, mine) ? ' mine' : '')}>
                <span className="fix-when">{live ? <span className="badge-live" style={{ fontSize: 11, padding: '3px 7px' }}>{f.detail}</span> : `${new Date(f.start).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })} ${fmtTime(f.start)}`}</span>
                <span className="fix-teams">{f.home} {live ? `${f.homeScore} × ${f.awayScore}` : '×'} {f.away}</span>
                {g ? (
                  <span className="fix-acts">
                    <button className="btn" data-nav="" style={{ height: 34, fontSize: 14 }} onClick={() => g.channels[0] && onWatch(g.channels[0], g.channels)}>▶ {g.channels[0]?.name}</button>
                    {!live && (
                      <button className="btn" data-nav="" style={{ height: 34, fontSize: 14, color: hasReminder(g.key) ? T.warn : undefined }} onClick={() => { toggleReminder(g); force((x) => x + 1); }}>⏰</button>
                    )}
                  </span>
                ) : (
                  <span className="muted fix-none">sem canal no guia</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

/** Escolher os times: lembrete automático, aviso de gol e destaque nos jogos. */
function MyTeamsDialog({ games, initial, onClose, onSave }: { games: Game[]; initial: string[]; onClose: () => void; onSave: (list: string[]) => void }) {
  const [sel, setSel] = useState<string[]>(initial);
  const [extra, setExtra] = useState('');
  const fromGuide = [...new Set(games.flatMap((g) => teamsOf(g)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const options = [...new Set([...sel, ...POPULAR, ...fromGuide])];
  const has = (t: string) => sel.some((x) => teamKey(x) === teamKey(t));
  const toggle = (t: string) => setSel((cur) => (has(t) ? cur.filter((x) => teamKey(x) !== teamKey(t)) : [...cur, t]));
  return (
    <Modal title="Meus times" onClose={onClose} width={760}>
      <span className="muted" style={{ fontSize: 15, lineHeight: 1.4 }}>
        Os jogos dos times escolhidos ganham ★, lembrete automático (no Android vira notificação) e aviso de gol enquanto o app está aberto.
      </span>
      <div className="team-grid scroll-y">
        {options.map((t) => (
          <button key={t} className={'chip team-chip' + (has(t) ? ' on' : '')} data-nav="" onClick={() => toggle(t)}>
            {has(t) ? '★ ' : '☆ '}
            {t}
          </button>
        ))}
      </div>
      <div className="field" style={{ display: 'flex' }}>
        <input
          data-nav=""
          value={extra}
          placeholder="Outro time (ex.: Remo, Paysandu)"
          onChange={(e) => setExtra(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.keyCode === 13) && extra.trim()) {
              toggle(extra.trim());
              setExtra('');
            }
          }}
        />
      </div>
      <div className="wrap-row" style={{ display: 'flex' }}>
        <button className="btn primary" data-nav="" onClick={() => onSave(sel)}>Salvar ({sel.length})</button>
        <button className="btn" data-nav="" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  );
}

/** Quando não acha jogos: o que o guia da lista devolveu (ajuda a entender o motivo). */
function GamesDiag() {
  const st = gamesStats();
  if (!st) return null;
  return (
    <div className="gy-6" style={{ display: 'flex', flexDirection: 'column', marginTop: 10, fontSize: 14, lineHeight: 1.45 }}>
      <span className="muted">
        Diagnóstico: consultei {st.asked} de {st.sports} canais de esporte no guia rápido — {st.withGuide} responderam com programação; {st.fromXmltv} canais no guia completo; {st.programmes} programas lidos; {st.espn} jogos no placar da ESPN.
      </span>
      {st.programmes === 0 ? (
        <span className="muted">O servidor da lista não devolveu programação para os canais de esporte. Em Ajustes › Lista › “Guia de programação extra”, adicione um guia público (ex.: epgshare01 Brasil) e volte aqui.</span>
      ) : (
        <span className="muted">Exemplos de programas no guia: {st.samples.map((t) => `“${t}”`).join(', ')}. Se forem jogos, me mande um print desta tela para eu ensinar o PRISMA a reconhecê-los.</span>
      )}
    </div>
  );
}

/** Partida com escudos, fundo nas cores dos dois times, minuto pulsando e linha do tempo com os gols. */
function MatchHero({ g, score, teams }: { g: Game; score: Score; teams: [string, string] }) {
  const firstHome = sameTeam(teams[0], score.home) || !sameTeam(teams[0], score.away);
  const left = firstHome ? { name: teams[0], logo: score.homeLogo, color: score.homeColor, goals: score.homeScore } : { name: teams[0], logo: score.awayLogo, color: score.awayColor, goals: score.awayScore };
  const right = firstHome ? { name: teams[1], logo: score.awayLogo, color: score.awayColor, goals: score.awayScore } : { name: teams[1], logo: score.homeLogo, color: score.homeColor, goals: score.homeScore };
  const live = score.state === 'in';
  const started = score.state !== 'pre';
  // Gols na linha do tempo (lances da ESPN), atualizados a cada minuto com o jogo rolando.
  const [events, setEvents] = useState<MatchStats['events']>([]);
  useEffect(() => {
    setEvents([]);
    if (!started) return;
    let alive = true;
    const load = () => loadMatchStats(score).then((m) => alive && m && setEvents(m.events.filter((e) => e.kind === 'goal' || e.kind === 'red')));
    load();
    const t = live ? setInterval(load, 60000) : undefined;
    return () => {
      alive = false;
      if (t) clearInterval(t);
    };
  }, [g.key, score.state]); // eslint-disable-line react-hooks/exhaustive-deps
  const minute = (m: string) => Math.min(100, (parseInt(m, 10) || 0) / 0.95);
  const lc = left.color && left.color.length === 7 ? left.color : '#3D7BFF';
  const rc = right.color && right.color.length === 7 ? right.color : '#FF6B3D';
  return (
    <div className="match-hero" style={{ background: `linear-gradient(105deg, ${rgba(lc, 0.55)} 0%, ${rgba(lc, 0.12)} 46%, ${rgba(rc, 0.12)} 54%, ${rgba(rc, 0.55)} 100%)` }}>
      <div className="mh-row">
        <div className="mh-team">
          {left.logo ? <img src={left.logo} alt="" referrerPolicy="no-referrer" /> : <span className="mh-ini" style={{ background: lc }}>{left.name.slice(0, 1)}</span>}
          <b>{left.name}</b>
        </div>
        <div className="mh-score">
          {started ? (
            <span className="mh-nums">
              {left.goals}
              <i>×</i>
              {right.goals}
            </span>
          ) : (
            <span className="mh-vs">×</span>
          )}
          <span className={'mh-min' + (live ? ' live' : '')}>{live ? `● ${score.detail}` : started ? score.detail : fmtTime(g.start)}</span>
        </div>
        <div className="mh-team r">
          {right.logo ? <img src={right.logo} alt="" referrerPolicy="no-referrer" /> : <span className="mh-ini" style={{ background: rc }}>{right.name.slice(0, 1)}</span>}
          <b>{right.name}</b>
        </div>
      </div>
      {started && (
        <div className="mh-line">
          <span className="mh-ht" />
          {events.map((e, i) => {
            const isLeft = sameTeam(e.team, left.name) || (!sameTeam(e.team, right.name) && sameTeam(e.team, firstHome ? score.home : score.away));
            return (
              <span key={i} className={'mh-ev ' + e.kind + (isLeft ? ' up' : ' down')} style={{ left: `${minute(e.minute)}%` }} title={`${e.minute} ${e.text}`}>
                {e.kind === 'goal' ? '⚽' : '■'}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

