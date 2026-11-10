import { useEffect, useMemo, useRef, useState } from 'react';
import type { Game } from '../core/games';
import { isMyTeam } from '../core/scores';
import { currentStage, factsOf, formOf, streaksOf, type FormLetter, type Leader, leaguesOf, liveExtras, loadSports, matchesOfTeam, nextMatch, partialLeague, stagesOf, tiesOf, withLive, type League, type LeagueDef, type Match, type SportsFeed, type StandRow, type Team } from '../core/sports';
import type { Score } from '../core/scores';
import { Carousel } from '../ui/Carousel';
import { F1Card } from './F1';
import type { F1Data } from '../core/sports';
import { Modal } from '../ui/Dialog';
import { focusFirst, pushBack } from '../ui/nav';
import { useLayout } from '../ui/layout';
import { fmtTime, rgba } from '../ui/bits';
import { T } from '../ui/tokens';

// Centro de esportes (0.25.0): tela inicial de Jogos (ao vivo, campeonatos,
// meus times, hoje) e a página de cada campeonato (banner com o tema da liga,
// menu lateral, calendário por rodada/fase, tabela, chaves e times).

// ---------------------------------------------------------------- Dados

/** Calendário dos campeonatos com o placar ao vivo por cima. */
export function useLeagues(scores: Score[]): { leagues: League[]; ready: boolean; feed: SportsFeed | null } {
  const [feed, setFeed] = useState<SportsFeed | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    loadSports().then((f) => {
      if (!alive) return;
      setFeed(f);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  const leagues = useMemo(() => leaguesOf(feed).map((l) => ({ ...l, matches: withLive(l.matches, scores) })), [feed, scores]);
  return { leagues, ready, feed };
}

// ---------------------------------------------------------------- Formatação

const DAY = 86400000;
function dayStart(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
/** "Hoje 21:30", "Amanhã 16:00", "sáb 14/11 18:30". */
export function whenLabel(ms: number, withTime = true): string {
  const d = dayStart(ms);
  const today = dayStart(Date.now());
  const t = withTime ? ' ' + fmtTime(ms) : '';
  if (d === today) return 'Hoje' + t;
  if (d === today + DAY) return 'Amanhã' + t;
  if (d === today - DAY) return 'Ontem' + t;
  const x = new Date(ms);
  const wd = x.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  return `${wd} ${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}${t}`;
}
/** "em 2 dias", "em 3h10", "em 25 min". */
export function countdown(ms: number): string {
  const diff = ms - Date.now();
  if (diff <= 0) return 'agora';
  const m = Math.round(diff / 60000);
  if (m < 60) return `em ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `em ${h}h${String(m % 60).padStart(2, '0')}`;
  const d = Math.round(h / 24);
  return `em ${d} ${d > 1 ? 'dias' : 'dia'}`;
}
/** Texto do cartão do campeonato: "Rodada 35 · sáb 14/11 18:30". */
function leagueLine(l: League): string {
  const nx = nextMatch(l);
  if (!nx) return l.matches.length ? 'Temporada encerrada' : l.partial ? 'Tabela' : 'Sem jogos agora';
  if (nx.state === 'in') return `${nx.phase} · ao vivo agora`;
  return `${nx.phase} · ${whenLabel(nx.start)}`;
}
const lc = (def: LeagueDef) => def.c;

// ---------------------------------------------------------------- Peças

/** Escudo do time (com a inicial na cor do time se a imagem falhar). */
export function Crest({ team, size = 36 }: { team?: Team; size?: number }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [team?.logo]);
  if (!team) return null;
  if (team.logo && !bad) return <img className="crest" src={team.logo} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setBad(true)} style={{ width: size, height: size }} />;
  return (
    <span className="crest-ini" style={{ width: size, height: size, borderRadius: size / 2, fontSize: Math.round(size * 0.42), background: team.color || '#3D4252' }}>
      {(team.short || team.name).slice(0, 1)}
    </span>
  );
}

function LeagueBadge({ league, size = 44 }: { league: League; size?: number }) {
  const [bad, setBad] = useState(false);
  return (
    <span className="lg-badge" style={{ width: size, height: size, borderRadius: size / 2 }}>
      {league.logo && !bad ? (
        <img src={league.logo} alt="" referrerPolicy="no-referrer" onError={() => setBad(true)} style={{ width: size * 0.72, height: size * 0.72 }} />
      ) : (
        // Sem logotipo: sigla na cor da liga (bandeiras em emoji não aparecem no Windows nem na TV).
        <b className="lg-ini" style={{ fontSize: size * 0.34, color: league.def.c[0] }}>{league.def.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase()}</b>
      )}
    </span>
  );
}

/** Cartão de partida (fileiras do hub). */
function MatchCard({ m, w, channel, reminder, onPick }: { m: Match; w: number; channel?: string; reminder: boolean; onPick: () => void }) {
  const [c1, c2] = lc(m.league);
  const live = m.state === 'in';
  const started = m.state !== 'pre';
  return (
    <button className={'tile grow mcard' + (live ? ' live' : '')} data-nav="" style={{ width: w }} onClick={onPick} aria-label={`${m.home.name} x ${m.away.name}`}>
      <span className="mcard-art" style={{ background: `linear-gradient(135deg, ${rgba(c1, 0.95)} 0%, ${rgba(c1, 0.55)} 55%, ${rgba(c2, 0.55)} 100%)` }}>
        <span className="mcard-top">
          <span className="mcard-lg">{m.league.name}</span>
          <span className="spacer" />
          {live ? <span className="badge-live mcard-live">● {m.detail || 'Ao vivo'}</span> : <span className="mcard-st">{m.phase}</span>}
        </span>
        <span className="mcard-mid">
          <span className="mcard-team">
            <Crest team={m.home} size={52} />
            <b>{m.home.short || m.home.name}</b>
          </span>
          <span className="mcard-score">
            {started ? (
              <span className="nums">
                {m.homeScore}
                <i>×</i>
                {m.awayScore}
              </span>
            ) : (
              <span className="mcard-time">{fmtTime(m.start)}</span>
            )}
          </span>
          <span className="mcard-team">
            <Crest team={m.away} size={52} />
            <b>{m.away.short || m.away.name}</b>
          </span>
        </span>
      </span>
      <span className="tile-name mcard-name">
        {m.home.name} × {m.away.name}
      </span>
      <span className="tile-sub">
        {live ? '' : m.state === 'post' ? 'Encerrado · ' : whenLabel(m.start, false) + ' · '}
        {channel ? `▶ ${channel}` : 'canal provável'}
        {reminder ? ' · ⏰' : ''}
      </span>
    </button>
  );
}

/** Cartão de partida que só existe no guia (outros esportes: NBA, UFC, tênis…). */
function GuideCard({ g, w, onPick }: { g: Game; w: number; onPick: () => void }) {
  return (
    <button className="tile grow mcard" data-nav="" style={{ width: w }} onClick={onPick}>
      <span className="mcard-art" style={{ background: 'linear-gradient(135deg, #2B2F45 0%, #161925 100%)' }}>
        <span className="mcard-top">
          <span className="mcard-lg">{g.league}</span>
          <span className="spacer" />
          <span className="badge-live mcard-live">● Ao vivo</span>
        </span>
        <span className="mcard-mid">
          <span className="mcard-title">{g.title.replace(/^[^:|]{3,40}[:|]\s*/, '')}</span>
        </span>
      </span>
      <span className="tile-name mcard-name">{g.channels[0]?.name ?? g.league}</span>
      <span className="tile-sub">{g.channels.length > 1 ? `${g.channels.length} canais` : 'no guia'}</span>
    </button>
  );
}

function LeagueCard({ league, w, onPick }: { league: League; w: number; onPick: () => void }) {
  const [c1, c2] = lc(league.def);
  const nx = nextMatch(league);
  return (
    <button className="tile grow lcard" data-nav="" style={{ width: w }} onClick={onPick} aria-label={league.def.name}>
      <span className="lcard-art" style={{ height: Math.round(w * 0.56), background: `linear-gradient(140deg, ${c1} 0%, ${rgba(c1, 0.85)} 45%, ${c2} 130%)` }}>
        <span className="lcard-glow" style={{ background: `radial-gradient(circle at 85% 15%, ${rgba(c2, 0.55)} 0%, rgba(0,0,0,0) 60%)` }} />
        <LeagueBadge league={league} size={58} />
        <span className="lcard-name">{league.def.name}</span>
        <span className="lcard-full">{league.def.full}</span>
        {nx && nx.state === 'in' && <span className="badge-live lcard-live">● Ao vivo</span>}
      </span>
      <span className="tile-sub lcard-line">{leagueLine(league)}</span>
    </button>
  );
}

/** Linha de partida (calendário, visão geral, hoje). OK abre o jogo. */
function MatchRow({ m, channel, mine, reminder, showLeague, day, onPick }: { m: Match; channel?: string; mine: string[]; reminder: boolean; showLeague?: boolean; day?: boolean; onPick: () => void }) {
  const live = m.state === 'in';
  const started = m.state !== 'pre';
  const my = isMyTeam(m.home.name, mine) || isMyTeam(m.away.name, mine);
  const hw = started && Number(m.homeScore) > Number(m.awayScore);
  const aw = started && Number(m.awayScore) > Number(m.homeScore);
  return (
    <button className={'mrow' + (live ? ' live' : '') + (my ? ' mine' : '')} data-nav="" onClick={onPick}>
      <span className="mrow-when">
        {live ? <span className="badge-live" style={{ fontSize: 11, padding: '3px 7px' }}>{m.detail || 'Ao vivo'}</span> : m.state === 'post' ? <small>Fim</small> : fmtTime(m.start)}
        {day && !live && <small>{whenLabel(m.start, false)}</small>}
        {showLeague && <small style={{ color: lc(m.league)[1] }}>{m.league.name}</small>}
      </span>
      <span className={'mrow-team r' + (hw ? ' win' : '')}>
        <span className="mrow-n">{m.home.name}</span>
        <Crest team={m.home} size={28} />
      </span>
      <span className={'mrow-score' + (live ? ' live' : '')}>{started ? `${m.homeScore} × ${m.awayScore}` : '×'}</span>
      <span className={'mrow-team' + (aw ? ' win' : '')}>
        <Crest team={m.away} size={28} />
        <span className="mrow-n">{m.away.name}</span>
      </span>
      <span className="mrow-ch">
        {m.note ? <small className="mrow-note">{m.note}</small> : null}
        {channel ? <span>▶ {channel}</span> : m.state === 'pre' ? <span className="muted">canal provável</span> : null}
        {reminder && <span style={{ color: T.warn }}> ⏰</span>}
        {my && <span style={{ color: T.warn }}> ★</span>}
      </span>
    </button>
  );
}

/** Partidas agrupadas por dia ("Hoje", "sáb 14/11"). */
function DayGroups({ matches, rowProps }: { matches: Match[]; rowProps: (m: Match) => Omit<Parameters<typeof MatchRow>[0], 'm'> }) {
  const groups: { day: number; list: Match[] }[] = [];
  for (const m of matches) {
    const d = dayStart(m.start);
    const g = groups[groups.length - 1];
    if (g && g.day === d) g.list.push(m);
    else groups.push({ day: d, list: [m] });
  }
  return (
    <>
      {groups.map((g) => (
        <div key={g.day} className="dgroup">
          <span className="dgroup-t">{whenLabel(g.day, false)}{dayStart(Date.now()) === g.day ? '' : ''}</span>
          {g.list.map((m) => (
            <MatchRow key={m.league.id + m.id} m={m} {...rowProps(m)} />
          ))}
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- Hub

export interface SportsCtx {
  mine: string[];
  scores: Score[];
  /** Canal do jogo no guia (nome) e se tem lembrete. */
  channelOf: (m: Match) => string | undefined;
  reminderOf: (m: Match) => boolean;
  onMatch: (m: Match) => void;
}

export function SportsHub({ leagues, ready, ctx, liveGuide, f1, onLeague, onGuideGame, onTeams, onGuide }: { leagues: League[]; ready: boolean; ctx: SportsCtx; liveGuide: Game[]; f1: F1Data | null; onLeague: (id: string) => void; onGuideGame: (g: Game) => void; onTeams: () => void; onGuide: () => void }) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const root = useRef<HTMLDivElement>(null);
  const now = Date.now();
  const all = useMemo(() => {
    const list = leagues.flatMap((l) => l.matches).concat(liveExtras(leagues, ctx.scores));
    return list.sort((a, b) => a.start - b.start);
  }, [leagues, ctx.scores]);

  // Ao vivo e a seguir: ao vivo, depois os próximos (até 36 h), depois os que acabaram há pouco.
  const live = all.filter((m) => m.state === 'in');
  const soon = all.filter((m) => m.state === 'pre' && m.start > now - 3 * 3600000 && m.start < now + 36 * 3600000);
  const recent = all.filter((m) => m.state === 'post' && m.start > now - 5 * 3600000).reverse();
  let upNext = [...live, ...soon, ...recent];
  if (upNext.length < 4) upNext = upNext.concat(all.filter((m) => m.state === 'pre' && m.start >= now + 36 * 3600000).slice(0, 10 - upNext.length));
  type Item = { k: string; m?: Match; g?: Game };
  const items: Item[] = upNext.slice(0, 10).map((m) => ({ k: 'm' + m.league.id + m.id, m }));
  // Outros esportes ao vivo no guia (NBA, UFC, tênis…), sem jogo do calendário correspondente.
  for (const g of liveGuide) if (items.length < 10 && !all.some((m) => m.state === 'in' && ctx.channelOf(m) && g.channels.some((c) => c.name === ctx.channelOf(m)))) items.splice(live.length, 0, { k: 'g' + g.key, g });

  const myNext = ctx.mine.length ? all.filter((m) => m.state !== 'post' && (isMyTeam(m.home.name, ctx.mine) || isMyTeam(m.away.name, ctx.mine))).slice(0, 10) : [];
  const today = dayStart(now);
  let todayList = all.filter((m) => dayStart(m.start) === today || m.state === 'in');
  let todayTitle = 'Hoje';
  if (!todayList.length) {
    const nx = all.find((m) => m.start > now);
    if (nx) {
      todayList = all.filter((m) => dayStart(m.start) === dayStart(nx.start));
      todayTitle = whenLabel(nx.start, false);
    }
  }

  useEffect(() => {
    requestAnimationFrame(() => focusFirst(root.current));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cardW = mobile ? 240 : 300;
  return (
    <div ref={root} className="scroll-y sports-hub" style={{ position: 'absolute', left: 0, right: 0, top: L.top + 48, bottom: mobile ? L.bottom : 0, paddingBottom: 30 }}>
      {!ready && <div className="muted" style={{ padding: `20px ${L.px}px`, fontSize: 16 }}>Carregando o calendário dos campeonatos…</div>}
      <Carousel
        title="Ao vivo e a seguir"
        subtitle={live.length ? `${live.length} ${live.length > 1 ? 'jogos' : 'jogo'} agora` : 'próximos jogos'}
        items={items}
        keyOf={(it) => it.k}
        minWidth={cardW}
        empty={ready ? 'Nenhum jogo nas próximas horas.' : 'Carregando…'}
        render={(it, _i, w) => (it.m ? <MatchCard m={it.m} w={w} channel={ctx.channelOf(it.m)} reminder={ctx.reminderOf(it.m)} onPick={() => ctx.onMatch(it.m!)} /> : <GuideCard g={it.g!} w={w} onPick={() => onGuideGame(it.g!)} />)}
      />
      {f1 && (
        <Carousel
          title="Fórmula 1"
          subtitle="próximo GP, pilotos, equipes e calendário"
          items={[f1]}
          keyOf={() => 'f1'}
          minWidth={L.W}
          render={(x, _i, w) => <F1Card f={x} w={w} onPick={() => onLeague('f1')} />}
        />
      )}
      <Carousel
        title="Campeonatos"
        subtitle="calendário, tabela e times"
        items={leagues}
        keyOf={(l) => l.def.id}
        minWidth={mobile ? 200 : 250}
        render={(l, _i, w) => <LeagueCard league={l} w={w} onPick={() => onLeague(l.def.id)} />}
      />
      <Carousel
        title="Meus times"
        subtitle={ctx.mine.length ? ctx.mine.slice(0, 4).join(', ') + (ctx.mine.length > 4 ? '…' : '') : 'lembrete automático e aviso de gol'}
        items={[...myNext.map((m) => ({ k: m.league.id + m.id, m })), { k: 'edit' } as { k: string; m?: Match }]}
        keyOf={(x) => x.k}
        minWidth={cardW}
        render={(x, _i, w) =>
          x.m ? (
            <MatchCard m={x.m} w={w} channel={ctx.channelOf(x.m)} reminder={ctx.reminderOf(x.m)} onPick={() => ctx.onMatch(x.m!)} />
          ) : (
            <button className="tile grow mcard" data-nav="" style={{ width: w }} onClick={onTeams}>
              <span className="mcard-art edit-teams">
                <b>☆</b>
                <span>{ctx.mine.length ? 'Editar meus times' : 'Escolher meus times'}</span>
              </span>
              <span className="tile-name mcard-name">{ctx.mine.length ? `${ctx.mine.length} ${ctx.mine.length > 1 ? 'times' : 'time'}` : 'Nenhum time ainda'}</span>
              <span className="tile-sub">lembrete de todos os jogos</span>
            </button>
          )
        }
      />
      <section className="carousel today-sec" style={{ marginTop: mobile ? 20 : 30, padding: `0 ${L.px}px` }}>
        <div className="carousel-head">
          <span className="title" style={{ fontSize: mobile ? 19 : 24 }}>{todayTitle}</span>
          <span className="carousel-sub">{todayList.length} {todayList.length === 1 ? 'jogo' : 'jogos'} · horário de Brasília</span>
          <div className="spacer" />
          <button className="see-all" data-nav="" onClick={onGuide}>Guia de jogos dos canais</button>
        </div>
        <div className="today-list">
          {todayList.length ? (
            todayList.map((m) => <MatchRow key={m.league.id + m.id} m={m} channel={ctx.channelOf(m)} mine={ctx.mine} reminder={ctx.reminderOf(m)} showLeague onPick={() => ctx.onMatch(m)} />)
          ) : (
            <span className="muted" style={{ fontSize: 16 }}>{ready ? 'Sem jogos dos campeonatos hoje.' : 'Carregando…'}</span>
          )}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- Página do campeonato

type Section = 'geral' | 'calendario' | 'tabela' | 'chaves' | 'destaques' | 'times';

export function LeaguePage({ league: base, ctx, onBack, onToggleTeam }: { league: League; ctx: SportsCtx; onBack: () => void; onToggleTeam: (name: string) => void }) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const [extra, setExtra] = useState<League | null>(null);
  const league = base.partial && extra ? extra : base;
  const def = league.def;
  const [c1, c2] = def.c;
  const isCup = def.kind === 'copa';
  const stages = useMemo(() => stagesOf(league), [league]);
  const knockout = stages.filter((s) => s.order >= 9 && s.order !== 9.5);
  const sections: [Section, string][] = [['geral', 'Visão geral'], ['calendario', 'Calendário']];
  if (isCup && knockout.length) sections.push(['chaves', 'Chaves']);
  if (league.tables.length) sections.push(['tabela', isCup ? (league.tables.length > 1 ? 'Grupos' : 'Tabela') : 'Tabela']);
  if (league.scorers.length || league.matches.some((m) => m.state === 'post')) sections.push(['destaques', 'Destaques']);
  sections.push(['times', 'Times']);
  const [sec, setSec] = useState<Section>('geral');
  const [teamOpen, setTeamOpen] = useState<Team | null>(null);
  const menu = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const nx = nextMatch(league);
  const cur = stages[currentStage(stages)];

  // Sem o arquivo do GitHub: busca ao menos a tabela.
  useEffect(() => {
    if (!base.partial) return;
    let alive = true;
    partialLeague(def).then((l) => alive && setExtra(l));
    return () => {
      alive = false;
    };
  }, [def.id, base.partial]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    requestAnimationFrame(() => focusFirst(menu.current, '[data-nav-active]'));
    return pushBack(() => {
      onBack();
      return true;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (panel.current) panel.current.scrollTop = 0;
  }, [sec]);

  const rp = (m: Match) => ({ channel: ctx.channelOf(m), mine: ctx.mine, reminder: ctx.reminderOf(m), onPick: () => ctx.onMatch(m) });
  const bannerH = mobile ? 128 : 168;
  const top = L.top + 4;
  const menuW = mobile ? 0 : 230;
  const contentTop = top + bannerH + (mobile ? 56 : 18);

  let body: React.ReactNode;
  if (sec === 'geral') body = <Overview league={league} stages={stages} rp={rp} onSection={setSec} onTeam={setTeamOpen} />;
  else if (sec === 'calendario') body = <Calendar league={league} stages={stages} rp={rp} />;
  else if (sec === 'tabela') body = <Standings league={league} mine={ctx.mine} onTeam={setTeamOpen} />;
  else if (sec === 'destaques') body = <Highlights league={league} mine={ctx.mine} onTeam={setTeamOpen} />;
  else if (sec === 'chaves') body = <Brackets stages={knockout} mine={ctx.mine} />;
  else body = <TeamsGrid league={league} mine={ctx.mine} onTeam={setTeamOpen} />;

  return (
    <>
      <div className="lg-banner" style={{ position: 'absolute', left: L.px, right: L.px, top, height: bannerH, background: `linear-gradient(110deg, ${c1} 0%, ${rgba(c1, 0.92)} 38%, ${rgba(c2, 0.9)} 120%)` }}>
        <span className="lg-banner-glow" style={{ background: `radial-gradient(ellipse 60% 120% at 92% 0%, ${rgba(c2, 0.7)} 0%, rgba(0,0,0,0) 70%)` }} />
        <span className="lg-banner-stripes" />
        <div className="lg-banner-row">
          <LeagueBadge league={league} size={mobile ? 64 : 96} />
          <div className="lg-banner-txt">
            <span className="lg-banner-kicker">{league.season || def.full}</span>
            <span className="lg-banner-name">{def.name === def.full ? def.name : def.full}</span>
            <span className="lg-banner-sub">{cur ? (isCup ? cur.label : `${cur.label} de ${stages.length}`) : league.partial ? 'Calendário indisponível no momento' : ''}</span>
          </div>
          {!mobile && nx && (
            <div className="lg-next">
              <span className="lg-next-k">{nx.state === 'in' ? '● Ao vivo agora' : `Próximo jogo · ${countdown(nx.start)}`}</span>
              <span className="lg-next-m">
                <Crest team={nx.home} size={34} />
                <b>{nx.state === 'pre' ? '×' : `${nx.homeScore} × ${nx.awayScore}`}</b>
                <Crest team={nx.away} size={34} />
              </span>
              <span className="lg-next-t">{nx.home.short || nx.home.name} × {nx.away.short || nx.away.name} · {nx.state === 'in' ? nx.detail : whenLabel(nx.start)}</span>
            </div>
          )}
        </div>
      </div>
      <div
        ref={menu}
        className={mobile ? 'scroll-x lg-menu-m' : 'lg-menu gy-6'}
        data-nav-group=""
        style={mobile ? { position: 'absolute', left: L.px, right: L.px, top: top + bannerH + 10, height: 40, alignItems: 'center' } : { position: 'absolute', left: L.px, top: contentTop, width: menuW, display: 'flex', flexDirection: 'column' }}
      >
        {sections.map(([id, label]) => (
          <button key={id} className={(mobile ? 'chip' : 'lg-mi') + (sec === id ? ' on' : '')} data-nav="" {...(sec === id ? { 'data-nav-active': '' } : {})} onClick={() => setSec(id)} onFocus={() => !mobile && setSec(id)} style={mobile ? { height: 36 } : { borderColor: sec === id ? c2 : undefined }}>
            {label}
          </button>
        ))}
        {!mobile && (
          <button className="lg-mi back" data-nav="" onClick={onBack}>
            ‹ Campeonatos
          </button>
        )}
      </div>
      <div ref={panel} className="glass scroll-y lg-panel" style={{ position: 'absolute', left: L.px + (menuW ? menuW + 22 : 0), right: L.px, top: contentTop, bottom: L.bottom, borderRadius: T.radiusPanel }}>
        {league.partial && !league.tables.length && !league.matches.length ? <span className="muted" style={{ fontSize: 16 }}>Carregando…</span> : body}
        {league.partial && (league.tables.length > 0 || !!extra) && <span className="muted lg-partial">O calendário completo ainda não foi baixado. A tabela vem direto da ESPN.</span>}
      </div>
      {teamOpen && <TeamModal league={league} team={teamOpen} ctx={ctx} onClose={() => setTeamOpen(null)} onToggle={() => onToggleTeam(teamOpen.name)} />}
    </>
  );
}

type RowProps = (m: Match) => Omit<Parameters<typeof MatchRow>[0], 'm'>;

function Overview({ league, stages, rp, onSection, onTeam }: { league: League; stages: ReturnType<typeof stagesOf>; rp: RowProps; onSection: (s: Section) => void; onTeam: (t: Team) => void }) {
  const f = factsOf(league);
  const now = Date.now();
  const next = league.matches.filter((m) => m.state !== 'post' && m.start > now - 3 * 3600000).slice(0, 6);
  const last = league.matches.filter((m) => m.state === 'post').slice(-5).reverse();
  const isCup = league.def.kind === 'copa';
  const cur = stages[currentStage(stages)];
  const tiles: [string, React.ReactNode, string][] = [];
  if (f.leader && !isCup) tiles.push(['Líder', <><Crest team={f.leader.team} size={30} /> <b>{f.leader.team.name}</b></>, `${f.leader.points} pontos em ${f.leader.played} jogos`]);
  if (isCup && cur) tiles.push(['Fase atual', <b>{cur.label}</b>, `${cur.matches.filter((m) => m.state !== 'post').length} jogos a disputar`]);
  if (f.bestAttack && !isCup) tiles.push(['Melhor ataque', <><Crest team={f.bestAttack.team} size={30} /> <b>{f.bestAttack.team.short || f.bestAttack.team.name}</b></>, `${f.bestAttack.gf} gols marcados`]);
  if (f.bestDefense && !isCup) tiles.push(['Melhor defesa', <><Crest team={f.bestDefense.team} size={30} /> <b>{f.bestDefense.team.short || f.bestDefense.team.name}</b></>, `${f.bestDefense.ga} gols sofridos`]);
  if (f.biggestWin) tiles.push(['Maior goleada', <><Crest team={f.biggestWin.home} size={26} /> <b>{f.biggestWin.homeScore} × {f.biggestWin.awayScore}</b> <Crest team={f.biggestWin.away} size={26} /></>, `${f.biggestWin.home.short} × ${f.biggestWin.away.short} · ${f.biggestWin.phase}`]);
  const top = league.scorers[0];
  if (top) tiles.push(['Artilheiro', <><Crest team={top.team} size={30} /> <b>{top.name}</b></>, `${top.total} gols em ${top.games || '?'} jogos`]);
  if (f.played) tiles.push(['Gols na temporada', <b>{f.goals}</b>, `média de ${(f.goals / f.played).toFixed(1).replace('.', ',')} por jogo`]);
  const table = league.tables.length === 1 ? league.tables[0].rows.slice(0, 6) : [];
  const ties = isCup && cur && cur.order >= 9 ? tiesOf(cur) : [];
  return (
    <div className="gy-22" style={{ display: 'flex', flexDirection: 'column' }}>
      {tiles.length > 0 && (
        <div className="facts">
          {tiles.map(([k, v, s]) => (
            <div key={k} className="fact">
              <span className="fact-k">{k}</span>
              <span className="fact-v">{v}</span>
              <span className="fact-s">{s}</span>
            </div>
          ))}
        </div>
      )}
      {next.length > 0 && (
        <div className="ov-block">
          <span className="ov-t">Próximos jogos</span>
          {next.map((m) => <MatchRow key={m.league.id + m.id} m={m} {...rp(m)} day />)}
          <button className="see-all ov-more" data-nav="" onClick={() => onSection('calendario')}>Ver o calendário completo ›</button>
        </div>
      )}
      {ties.length > 0 && (
        <div className="ov-block">
          <span className="ov-t">{cur!.label}</span>
          <TieList ties={ties} mine={[]} />
        </div>
      )}
      {table.length > 0 && (
        <div className="ov-block">
          <span className="ov-t">Classificação</span>
          <StandRows rows={table} mine={[]} onTeam={onTeam} />
          <button className="see-all ov-more" data-nav="" onClick={() => onSection('tabela')}>Ver a tabela completa ›</button>
        </div>
      )}
      {last.length > 0 && (
        <div className="ov-block">
          <span className="ov-t">Últimos resultados</span>
          {last.map((m) => <MatchRow key={m.league.id + m.id} m={m} {...rp(m)} day />)}
        </div>
      )}
      {!next.length && !last.length && !table.length && <span className="muted" style={{ fontSize: 16 }}>Sem dados deste campeonato agora.</span>}
    </div>
  );
}

function Calendar({ league, stages, rp }: { league: League; stages: ReturnType<typeof stagesOf>; rp: RowProps }) {
  const [i, setI] = useState(() => currentStage(stages));
  const s = stages[Math.min(i, stages.length - 1)];
  if (!s) return <span className="muted" style={{ fontSize: 16 }}>{league.partial ? 'O calendário ainda não foi baixado (tente de novo em alguns minutos).' : 'Sem jogos no calendário.'}</span>;
  const isCup = league.def.kind === 'copa';
  const from = s.matches[0].start;
  const to = s.matches[s.matches.length - 1].start;
  return (
    <div className="gy-12" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="cal-head">
        <button className="btn cal-arrow" data-nav="" disabled={i <= 0} onClick={() => setI(i - 1)} aria-label="Anterior">‹</button>
        <div className="cal-title">
          <b>{isCup ? s.label : `${s.label} de ${stages.length}`}</b>
          <span>{whenLabel(from, false)}{dayStart(from) !== dayStart(to) ? ` a ${whenLabel(to, false)}` : ''} · {s.matches.length} jogos</span>
        </div>
        <button className="btn cal-arrow" data-nav="" disabled={i >= stages.length - 1} onClick={() => setI(i + 1)} aria-label="Próxima">›</button>
      </div>
      <div className="cal-dots scroll-x" aria-hidden="true">
        {stages.map((x, k) => (
          <i key={x.key} className={(k === i ? 'on' : '') + (x.matches.some((m) => m.state === 'in') ? ' live' : x.matches.every((m) => m.state === 'post') ? ' done' : '')} />
        ))}
      </div>
      <DayGroups matches={s.matches} rowProps={rp} />
    </div>
  );
}

function StandRows({ rows, mine, onTeam, form }: { rows: StandRow[]; mine: string[]; onTeam: (t: Team) => void; form?: Map<string, FormLetter[]> }) {
  return (
    <div className="srows">
      <div className="srow head">
        <span className="srow-pos" />
        <span className="srow-team">Time</span>
        <span className="srow-n pts">P</span>
        <span className="srow-n">J</span>
        <span className="srow-n">V</span>
        <span className="srow-n">E</span>
        <span className="srow-n">D</span>
        <span className="srow-n wide">SG</span>
        {form && <span className="srow-form">Últimos 5</span>}
      </div>
      {rows.map((r) => (
        <button key={r.team.name + r.rank} className={'srow' + (isMyTeam(r.team.name, mine) ? ' mine' : '')} data-nav="" onClick={() => onTeam(r.team)}>
          <span className="srow-pos" style={r.zone ? { borderLeftColor: r.zone } : undefined}>{r.rank}</span>
          <span className="srow-team">
            <Crest team={r.team} size={26} />
            <span className="srow-tn">{r.team.name}</span>
          </span>
          <span className="srow-n pts">{r.points}</span>
          <span className="srow-n">{r.played}</span>
          <span className="srow-n">{r.wins}</span>
          <span className="srow-n">{r.draws}</span>
          <span className="srow-n">{r.losses}</span>
          <span className="srow-n wide">{r.gd > 0 ? '+' + r.gd : r.gd}</span>
          {form && <FormDots list={(form.get(r.team.name) ?? []).slice(-5)} />}
        </button>
      ))}
    </div>
  );
}

function Standings({ league, mine, onTeam }: { league: League; mine: string[]; onTeam: (t: Team) => void }) {
  const form = useMemo(() => formOf(league), [league]);
  return (
    <div className="gy-22" style={{ display: 'flex', flexDirection: 'column' }}>
      {league.tables.map((t) => (
        <div key={t.name} className="ov-block">
          {league.tables.length > 1 && <span className="ov-t">{t.name}</span>}
          <StandRows rows={t.rows} mine={mine} onTeam={onTeam} form={league.def.kind === 'liga' && form.size ? form : undefined} />
        </div>
      ))}
      {league.tables.some((t) => t.rows.some((r) => r.zone)) && <span className="muted" style={{ fontSize: 13 }}>A cor ao lado da posição marca as zonas (classificação, rebaixamento).</span>}
    </div>
  );
}

function TieList({ ties, mine }: { ties: ReturnType<typeof tiesOf>; mine: string[] }) {
  return (
    <div className="ties">
      {ties.map((t) => {
        const legs = t.legs;
        return (
          <div key={t.a.name + t.b.name} className={'tie' + (isMyTeam(t.a.name, mine) || isMyTeam(t.b.name, mine) ? ' mine' : '')} data-nav="" tabIndex={0}>
            {[t.a, t.b].map((x) => (
              <span key={x.name} className={'tie-team' + (t.winner === x.name ? ' win' : t.winner ? ' out' : '')}>
                <Crest team={x} size={26} />
                <span className="tie-n">{x.name}</span>
                {legs.map((m) => (
                  <span key={m.league.id + m.id} className="tie-g">{m.state === 'pre' ? '–' : m.home.name === x.name ? m.homeScore : m.awayScore}</span>
                ))}
              </span>
            ))}
            <span className="tie-info">
              {legs.map((m, k) => (k ? ' · ' : '') + (m.state === 'pre' ? whenLabel(m.start) : m.state === 'in' ? 'ao vivo' : legs.length > 1 ? (k ? 'volta' : 'ida') : 'jogo único')).join('')}
              {legs[legs.length - 1].note && legs[legs.length - 1].state === 'post' ? ` · ${legs[legs.length - 1].note!.replace(/^(Ida|Volta) · /, '')}` : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Brackets({ stages, mine }: { stages: ReturnType<typeof stagesOf>; mine: string[] }) {
  const list = stages.slice().reverse();
  return (
    <div className="gy-22" style={{ display: 'flex', flexDirection: 'column' }}>
      {list.map((s) => (
        <div key={s.key} className="ov-block">
          <span className="ov-t">{s.label}</span>
          <TieList ties={tiesOf(s)} mine={mine} />
        </div>
      ))}
    </div>
  );
}

function TeamsGrid({ league, mine, onTeam }: { league: League; mine: string[]; onTeam: (t: Team) => void }) {
  // Times da tabela primeiro (ordem de classificação); nas copas, os que ainda jogam primeiro.
  const fromTable = league.tables.flatMap((t) => t.rows.map((r) => r.team));
  const names = new Set<string>();
  const list: Team[] = [];
  const now = Date.now();
  const alive = league.def.kind === 'copa' ? league.teams.filter((t) => league.matches.some((m) => m.start > now - 2 * 3600000 && (m.home.name === t.name || m.away.name === t.name))) : [];
  for (const t of [...alive, ...fromTable, ...league.teams.slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))]) {
    if (names.has(t.name)) continue;
    names.add(t.name);
    list.push(t);
  }
  if (!list.length) return <span className="muted" style={{ fontSize: 16 }}>Sem times ainda.</span>;
  return (
    <div className="teams-grid">
      {list.map((t) => (
        <button key={t.name} className={'team-btn' + (isMyTeam(t.name, mine) ? ' mine' : '')} data-nav="" onClick={() => onTeam(t)}>
          <Crest team={t} size={44} />
          <span>{t.name}</span>
          {isMyTeam(t.name, mine) && <i>★</i>}
        </button>
      ))}
    </div>
  );
}

function TeamModal({ league, team, ctx, onClose, onToggle }: { league: League; team: Team; ctx: SportsCtx; onClose: () => void; onToggle: () => void }) {
  const L = useLayout();
  const list = matchesOfTeam(league, team.name);
  const next = list.filter((m) => m.state !== 'post').slice(0, 4);
  const last = list.filter((m) => m.state === 'post').slice(-4).reverse();
  const row = league.tables.flatMap((t) => t.rows).find((r) => r.team.name === team.name);
  const following = isMyTeam(team.name, ctx.mine);
  return (
    <Modal title={team.name} onClose={onClose} width={Math.min(820, L.W - 24)}>
      <div className="gx-14" style={{ display: 'flex', alignItems: 'center' }}>
        <Crest team={team} size={64} />
        <div className="gy-4" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{league.def.name}</span>
          {row && <span className="muted" style={{ fontSize: 14 }}>{row.rank}º lugar · {row.points} pontos · {row.wins}V {row.draws}E {row.losses}D</span>}
        </div>
        <button className={'btn' + (following ? '' : ' primary')} data-nav="" onClick={onToggle} style={following ? { color: T.warn } : undefined}>
          {following ? '★ Seguindo' : '☆ Seguir'}
        </button>
      </div>
      <div className="scroll-y gy-14" style={{ display: 'flex', flexDirection: 'column', maxHeight: Math.round(L.H * 0.55) }}>
        {next.length > 0 && (
          <div className="ov-block">
            <span className="ov-t">Próximos jogos</span>
            {next.map((m) => <MatchRow key={m.league.id + m.id} m={m} channel={ctx.channelOf(m)} mine={ctx.mine} reminder={ctx.reminderOf(m)} day onPick={() => ctx.onMatch(m)} />)}
          </div>
        )}
        {last.length > 0 && (
          <div className="ov-block">
            <span className="ov-t">Últimos resultados</span>
            {last.map((m) => <MatchRow key={m.league.id + m.id} m={m} channel={undefined} mine={ctx.mine} reminder={false} day onPick={() => ctx.onMatch(m)} />)}
          </div>
        )}
        {!next.length && !last.length && <span className="muted">Sem jogos deste time no calendário.</span>}
      </div>
      <span className="muted" style={{ fontSize: 13 }}>Seguindo, o time entra em Meus times: lembrete automático dos jogos e aviso de gol.</span>
    </Modal>
  );
}

/** Bolinhas dos últimos jogos: V verde, E cinza, D vermelho. */
function FormDots({ list }: { list: FormLetter[] }) {
  return (
    <span className="srow-form">
      {list.map((r, i) => (
        <i key={i} className={'fd ' + r}>{r}</i>
      ))}
    </span>
  );
}

function LeaderRows({ list, unit, mine, onTeam }: { list: Leader[]; unit: string; mine: string[]; onTeam: (t: Team) => void }) {
  const max = list[0]?.total || 1;
  return (
    <div className="srows">
      {list.map((p, i) => (
        <button key={p.name + i} className={'srow' + (isMyTeam(p.team.name, mine) ? ' mine' : '')} data-nav="" onClick={() => onTeam(p.team)}>
          <span className="srow-pos">{i + 1}</span>
          <span className="srow-team">
            <Crest team={p.team} size={26} />
            <span className="srow-tn" style={{ fontWeight: 800 }}>{p.name}</span>
            <span className="f1-team muted">{p.team.name}</span>
          </span>
          <span className="f1-meter"><i style={{ width: Math.round((p.total / max) * 100) + '%' }} /></span>
          <span className="srow-n wide muted">{p.games ? p.games + ' j' : ''}</span>
          <span className="srow-n pts" style={{ width: 86, whiteSpace: 'nowrap' }}>{p.total} {unit}</span>
        </button>
      ))}
    </div>
  );
}

/** Destaques (etapa 3): artilheiros, assistências e sequências atuais. */
function Highlights({ league, mine, onTeam }: { league: League; mine: string[]; onTeam: (t: Team) => void }) {
  const streaks = useMemo(() => streaksOf(league), [league]);
  return (
    <div className="gy-22" style={{ display: 'flex', flexDirection: 'column' }}>
      {streaks.length > 0 && (
        <div className="facts">
          {streaks.map((s) => (
            <button key={s.label} className="fact fact-btn" data-nav="" onClick={() => onTeam(s.team)}>
              <span className="fact-k">{s.label}</span>
              <span className="fact-v"><Crest team={s.team} size={30} /> <b>{s.team.name}</b></span>
              <span className="fact-s">{s.label === 'Invicto há' || s.label === 'Sem vencer há' ? `${s.count} jogos` : `${s.count} jogos seguidos`}</span>
            </button>
          ))}
        </div>
      )}
      {league.scorers.length > 0 && (
        <div className="ov-block">
          <span className="ov-t">Artilheiros</span>
          <LeaderRows list={league.scorers} unit="gols" mine={mine} onTeam={onTeam} />
        </div>
      )}
      {league.assists.length > 0 && (
        <div className="ov-block">
          <span className="ov-t">Assistências</span>
          <LeaderRows list={league.assists} unit="ass." mine={mine} onTeam={onTeam} />
        </div>
      )}
      {!streaks.length && !league.scorers.length && <span className="muted" style={{ fontSize: 16 }}>Os destaques aparecem quando a temporada começa.</span>}
    </div>
  );
}
