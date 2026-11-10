import { useEffect, useMemo, useRef, useState } from 'react';
import { ensureReminder, gamesStats, hasReminder, isSportsChannel, likelyChannels, loadGames, matchOf, myTeams, setMyTeams, teamsOf, toggleReminder, type Game } from '../core/games';
import { isMyTeam, loadMatchStats, sameTeam, teamKey, type MatchStats } from '../core/scores';
import type { Match } from '../core/sports';
import { LeaguePage, SportsHub, useLeagues, type SportsCtx } from './Sports';
import { pushBack } from '../ui/nav';
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

/** Placar no formato da ESPN a partir de uma partida do calendário (para o detalhe do jogo). */
function scoreOfMatch(m: Match): Score {
  return {
    home: m.home.name,
    away: m.away.name,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    state: m.state,
    detail: m.state === 'in' ? m.detail || 'Ao vivo' : m.state === 'post' ? 'Encerrado' : '',
    start: m.start,
    league: m.league.name,
    id: m.id,
    path: 'soccer/' + m.league.id,
    homeLogo: m.home.logo,
    awayLogo: m.away.logo,
    homeColor: m.home.color,
    awayColor: m.away.color,
  };
}

export function Games({ playlist, onWatch }: { playlist: Playlist; onWatch: (c: Channel, list: Channel[]) => void }) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  // Centro de esportes: 'hub' (tela inicial), 'guia' (jogos do guia dos canais) ou o id de um campeonato.
  const [view, setView] = useState<string>('hub');
  const [games, setGames] = useState<Game[] | null>(null);
  const [prog, setProg] = useState({ done: 0, total: 0 });
  const [filter, setFilter] = useState<Filter>('agora');
  const [league, setLeague] = useState('');
  const [index, setIndex] = useState(0);
  const [, force] = useState(0);
  const [open, setOpen] = useState<Game | null>(null);
  const [openMatch, setOpenMatch] = useState<Match | null>(null);
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
    });
    return () => {
      alive = false;
    };
  }, [playlist]);
  useEffect(() => {
    if (view === 'guia' && games) requestAnimationFrame(() => listRef.current?.focus());
  }, [view, !!games]); // eslint-disable-line react-hooks/exhaustive-deps
  // Guia de jogos: Voltar retorna à tela inicial de Jogos.
  useEffect(() => {
    if (view !== 'guia') return;
    return pushBack(() => {
      setView('hub');
      return true;
    });
  }, [view]);

  const { leagues, ready } = useLeagues(scores);
  // Jogo do guia de cada partida do calendário (canal e lembrete); calculado uma vez por partida.
  const guideCache = useRef(new Map<string, Game | null>());
  useEffect(() => guideCache.current.clear(), [games]);
  const guideOf = (m: Match): Game | undefined => {
    const c = guideCache.current;
    const ck = m.league.id + '|' + m.id;
    if (c.has(ck)) return c.get(ck) ?? undefined;
    const s = scoreOfMatch(m);
    const g = (games ?? []).find((x) => x.key === 'espn|' + m.id) ?? (games ?? []).find((x) => !x.likely && scoreFor(x, [s]));
    c.set(ck, g ?? null);
    return g;
  };
  const gameOf = (m: Match): Game =>
    guideOf(m) ?? {
      key: 'espn|' + m.id,
      title: `${m.league.name}: ${m.home.name} x ${m.away.name}`,
      league: m.league.name,
      start: m.start,
      end: m.start + 2 * 3600000,
      channels: likelyChannels(`${m.league.name} ${m.league.full}`, sports),
      likely: true,
    };
  const ctx: SportsCtx = {
    mine,
    scores,
    channelOf: (m) => {
      const g = guideOf(m);
      return g && !g.likely ? g.channels[0]?.name : undefined;
    },
    reminderOf: (m) => hasReminder(gameOf(m).key),
    onMatch: (m) => {
      const g = guideOf(m);
      // Ao vivo e com canal no guia: vai direto para o jogo.
      if (m.state === 'in' && g && !g.likely && g.channels[0]) onWatch(g.channels[0], g.channels);
      else setOpenMatch(m);
    },
  };
  const toggleTeam = (name: string) => {
    const has = mine.some((t) => sameTeam(t, name));
    const list = has ? mine.filter((t) => !sameTeam(t, name)) : [...mine, name];
    setMyTeams(list);
    setMine(list);
    if (!has) for (const x of games ?? []) if (x.start > Date.now() && teamsOf(x).some((t) => isMyTeam(t, list))) ensureReminder(x);
    // Jogos do calendário do time (sem canal no guia) também ganham lembrete.
    if (!has) for (const l of leagues) for (const m of l.matches) if (m.state === 'pre' && m.start > Date.now() && m.start < Date.now() + 14 * 86400000 && (sameTeam(m.home.name, name) || sameTeam(m.away.name, name))) ensureReminder(gameOf(m));
    force((n) => n + 1);
  };

  const matchModal = openMatch && (
    <Modal title={openMatch.league.full} onClose={() => setOpenMatch(null)} width={mobile ? L.W - 24 : Math.min(900, L.W - 120)}>
      <div style={{ height: mobile ? Math.round(L.H * 0.7) : Math.min(560, Math.round(L.H * 0.72)), display: 'flex', flexDirection: 'column' }}>
        <GameDetail
          g={gameOf(openMatch)}
          score={scoreOfMatch(openMatch)}
          now={Date.now()}
          onWatch={(c) => {
            const g = gameOf(openMatch);
            setOpenMatch(null);
            onWatch(c, g.channels);
          }}
          onReminder={() => {
            toggleReminder(gameOf(openMatch));
            force((x) => x + 1);
          }}
        />
      </div>
    </Modal>
  );
  const teamsDialog = teamsDlg && (
    <MyTeamsDialog
      games={games ?? []}
      initial={mine}
      onClose={() => setTeamsDlg(false)}
      onSave={(list) => {
        setMyTeams(list);
        setMine(list);
        setTeamsDlg(false);
        for (const x of games ?? []) if (x.start > Date.now() && teamsOf(x).some((t) => isMyTeam(t, list))) ensureReminder(x);
        force((n) => n + 1);
      }}
    />
  );


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
  const guideLeagues = useMemo(() => [...new Set((games ?? []).map((g) => g.league))].slice(0, 12), [games]);
  useEffect(() => setIndex(0), [filter, league]);
  const sel = list[index];

  const lg = leagues.find((l) => l.def.id === view);
  if (lg) {
    return (
      <>
        <LeaguePage key={lg.def.id} league={lg} ctx={ctx} onBack={() => setView('hub')} onToggleTeam={toggleTeam} />
        {matchModal}
      </>
    );
  }
  if (view === 'hub') {
    const liveGuide = (games ?? []).filter((g) => !g.likely && status(g, Date.now()) === 'live' && !/futebol|brasileir|libertadores|sul-?americana|champions|premier|la liga|serie a|bundesliga|ligue 1|copa do brasil/i.test(g.league + ' ' + g.title));
    return (
      <>
        <div className="scroll-x" style={{ position: 'absolute', left: L.px, right: L.px, top: L.top, height: 48, alignItems: 'center' }}>
          <button className="chip on" data-nav="" style={{ height: 40 }} onClick={() => undefined}>⚽ Início</button>
          <button className="chip" data-nav="" style={{ height: 40 }} onClick={() => setView('guia')}>
            ▤ Guia de jogos{games ? ` · ${games.length}` : ''}
          </button>
          <button className="chip" data-nav="" onClick={() => setTeamsDlg(true)} style={{ height: 40 }}>☆ Meus times{mine.length ? ` (${mine.length})` : ''}</button>
        </div>
        <SportsHub leagues={leagues} ready={ready} ctx={ctx} liveGuide={liveGuide} onLeague={setView} onGuideGame={(g) => (g.channels[0] ? onWatch(g.channels[0], g.channels) : setOpen(g))} onTeams={() => setTeamsDlg(true)} onGuide={() => setView('guia')} />
        {teamsDialog}
        {matchModal}
        {open && (
          <Modal title={open.league} onClose={() => setOpen(null)} width={L.W - 24}>
            <GameDetail g={open} score={scoreFor(open, scores)} now={Date.now()} onWatch={(c) => onWatch(c, open.channels)} onReminder={() => { toggleReminder(open); force((x) => x + 1); }} />
          </Modal>
        )}
      </>
    );
  }

  const backChip = (
    <button className="chip" data-nav="" onClick={() => setView('hub')} style={{ height: 40, marginRight: 14 }}>‹ Início</button>
  );
  if (!sports.length) {
    return (
      <>
        <div className="scroll-x" style={{ position: 'absolute', left: L.px, right: L.px, top: L.top, height: 48, alignItems: 'center' }}>{backChip}</div>
        <Info L={L} title="Guia de jogos" text="Não encontrei canais de esporte na sua lista (procuro por categorias e nomes como Esportes, SporTV, ESPN, Premiere, PPV, UFC)." />
      </>
    );
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
        {backChip}
        {chips.map(([id, label, n]) => (
          <button key={id} className={'chip' + (filter === id ? ' on' : '')} data-nav="" onClick={() => setFilter(id)} style={{ height: 40 }}>
            {id === 'agora' && <span style={{ color: filter === id ? T.live : T.live, marginRight: 6 }}>●</span>}
            {label} · {n}
          </button>
        ))}
        <button className="chip" data-nav="" onClick={() => setTeamsDlg(true)} style={{ height: 40, marginLeft: 14 }}>☆ Escolher meus times{mine.length ? ` (${mine.length})` : ''}</button>
        {guideLeagues.length > 1 && <span className="muted" style={{ margin: '0 4px 0 14px', fontSize: 14, flexShrink: 0 }}>Ligas</span>}
        {guideLeagues.length > 1 && guideLeagues.map((l) => (
          <button key={l} className={'chip' + (league === l ? ' on' : '')} data-nav="" onClick={() => setLeague(league === l ? '' : l)} style={{ height: 40 }}>{l}</button>
        ))}
      </div>

      {teamsDialog}
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
    <div className="gy-16 scroll-y game-detail" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% + 8px)', padding: 4, margin: -4 }}>
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
      <div className="gy-8" style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
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

