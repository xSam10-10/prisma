import { useEffect, useMemo, useRef, useState } from 'react';
import { cachedGames, hasReminder, isSportsChannel, likelyChannels, toggleReminder, type Game } from '../core/games';
import { f1Of, loadSports, nextRace, raceWeek, teamColor, type F1Data, type F1Race, type F1Session, type SportsFeed } from '../core/sports';
import type { Channel, Playlist } from '../core/types';
import { focusFirst, pushBack } from '../ui/nav';
import { useLayout } from '../ui/layout';
import { fmtTime, rgba } from '../ui/bits';
import { T } from '../ui/tokens';
import { pop, toast } from '../ui/premium2';

// Fórmula 1 (0.26.0): página própria (próximo GP com o fim de semana e lembrete por
// sessão, pilotos, equipes, último GP com pódio e calendário) + "Semana do GP" no Início.
// Dados: Jolpica (sucessora do Ergast), dentro de prisma-sports.json.

const F1_RED = '#E10600';
const DAY = 86400000;

function dayStart(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
export function when(ms: number, withTime = true): string {
  const d = dayStart(ms);
  const today = dayStart(Date.now());
  const t = withTime ? ' ' + fmtTime(ms) : '';
  if (d === today) return 'Hoje' + t;
  if (d === today + DAY) return 'Amanhã' + t;
  const x = new Date(ms);
  const wd = x.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  return `${wd} ${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}${t}`;
}
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
/** Duração aproximada de cada sessão (para saber se está "ao vivo"). */
const SESSION_MIN: Record<string, number> = { TL1: 60, TL2: 60, TL3: 60, QS: 45, SPR: 60, CLA: 60, GP: 120 };
function sessionState(s: F1Session, now = Date.now()): 'pre' | 'in' | 'post' {
  if (now < s.start) return 'pre';
  return now < s.start + (SESSION_MIN[s.code] ?? 60) * 60000 ? 'in' : 'post';
}

/** Jogo (para lembrete e canal) de uma sessão do GP: acha no guia ou usa os canais prováveis. */
export function sessionGame(f: F1Data, r: F1Race, s: F1Session, sports: Channel[]): Game {
  const fromGuide = cachedGames().find((g) => /f[oó]rmula ?1|\bf1\b|grande pr[eê]mio|\bgp\b/i.test(g.title) && Math.abs(g.start - s.start) < 75 * 60000);
  return {
    key: `f1|${f.season}|${r.round}|${s.code}`,
    title: `Fórmula 1: ${r.name} · ${s.label}`,
    league: 'Fórmula 1',
    start: s.start,
    end: s.start + (SESSION_MIN[s.code] ?? 60) * 60000,
    channels: fromGuide && !fromGuide.likely ? fromGuide.channels : likelyChannels('Fórmula 1', sports),
    likely: !fromGuide || fromGuide.likely,
  };
}

/** Dados da F1 (mesmo arquivo dos campeonatos). */
export function useF1(): F1Data | null {
  const [feed, setFeed] = useState<SportsFeed | null>(null);
  useEffect(() => {
    let alive = true;
    loadSports().then((f) => alive && setFeed(f));
    return () => {
      alive = false;
    };
  }, []);
  return useMemo(() => f1Of(feed), [feed]);
}

// ---------------------------------------------------------------- Cartão no hub de Jogos

export function F1Card({ f, w, onPick }: { f: F1Data; w: number; onPick: () => void }) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const r = nextRace(f);
  const leader = f.drivers[0];
  return (
    <button className="tile grow f1card" data-nav="" style={{ width: w }} onClick={onPick} aria-label="Fórmula 1">
      <span className="f1card-art" style={{ height: mobile ? 150 : 176, background: `linear-gradient(115deg, ${F1_RED} 0%, ${rgba(F1_RED, 0.75)} 30%, #15151E 72%)` }}>
        <span className="f1-stripes" />
        <span className="f1card-l">
          <span className="f1-tag">F1 · Temporada {f.season}</span>
          <span className="f1card-name">{r ? r.name : 'Temporada encerrada'}</span>
          <span className="f1card-sub">{r ? `${r.circuit} · ${r.city}` : leader ? `Campeão: ${leader.name}` : ''}</span>
        </span>
        {r && !mobile && (
          <span className="f1card-r">
            <span className="f1card-k">Corrida</span>
            <b>{when(r.start)}</b>
            <span className="f1card-c">{countdown(r.start)}</span>
          </span>
        )}
        {leader && !mobile && (
          <span className="f1card-r">
            <span className="f1card-k">Líder</span>
            <b>{leader.code || leader.name}</b>
            <span className="f1card-c">{leader.points} pontos</span>
          </span>
        )}
      </span>
      <span className="tile-sub">{r ? `Rodada ${r.round} de ${f.races[f.races.length - 1].round} · treinos, classificação e corrida com lembrete` : 'Classificação final e calendário'}</span>
    </button>
  );
}

// ---------------------------------------------------------------- Página da F1

type Sec = 'gp' | 'pilotos' | 'equipes' | 'ultimo' | 'calendario';

export function F1Page({ f, playlist, onWatch, onBack }: { f: F1Data; playlist: Playlist; onWatch: (c: Channel, list: Channel[]) => void; onBack: () => void }) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const [sec, setSec] = useState<Sec>('gp');
  const [, bump] = useState(0);
  const menu = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const sports = useMemo(() => playlist.items.filter(isSportsChannel), [playlist]);
  const r = nextRace(f);
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
  // Atualiza contagens e "ao vivo" a cada 30 s.
  useEffect(() => {
    const t = setInterval(() => bump((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const sections: [Sec, string][] = [
    ['gp', r ? 'Próximo GP' : 'Temporada'],
    ['pilotos', 'Pilotos'],
    ['equipes', 'Equipes'],
    ...(f.last ? ([['ultimo', 'Último GP']] as [Sec, string][]) : []),
    ['calendario', 'Calendário'],
  ];
  const bannerH = mobile ? 128 : 168;
  const top = L.top + 4;
  const menuW = mobile ? 0 : 230;
  const contentTop = top + bannerH + (mobile ? 56 : 18);
  const race = r ?? f.races[f.races.length - 1];
  const gpSession = race?.sessions.find((s) => s.code === 'GP');

  let body: React.ReactNode;
  if (sec === 'gp') body = race ? <Weekend f={f} r={race} sports={sports} onWatch={onWatch} onChange={() => bump((x) => x + 1)} /> : null;
  else if (sec === 'pilotos') body = <Drivers f={f} />;
  else if (sec === 'equipes') body = <Teams f={f} />;
  else if (sec === 'ultimo') body = <LastGP f={f} />;
  else body = <Season f={f} />;

  return (
    <>
      <div className="lg-banner" style={{ position: 'absolute', left: L.px, right: L.px, top, height: bannerH, background: `linear-gradient(110deg, ${F1_RED} 0%, ${rgba(F1_RED, 0.85)} 30%, #15151E 75%)` }}>
        <span className="f1-stripes" />
        <div className="lg-banner-row">
          <span className="f1-badge" style={{ width: mobile ? 64 : 96, height: mobile ? 64 : 96, borderRadius: mobile ? 32 : 48, fontSize: mobile ? 24 : 36 }}>F1</span>
          <div className="lg-banner-txt">
            <span className="lg-banner-kicker">Fórmula 1 · Temporada {f.season}</span>
            <span className="lg-banner-name">{r ? r.name : 'Temporada encerrada'}</span>
            <span className="lg-banner-sub">{r ? `Rodada ${r.round} de ${f.races[f.races.length - 1].round} · ${r.circuit}` : `${f.races.length} GPs`}</span>
          </div>
          {!mobile && r && gpSession && (
            <div className="lg-next">
              <span className="lg-next-k">{sessionState(gpSession) === 'in' ? '● Corrida ao vivo' : `Corrida · ${countdown(gpSession.start)}`}</span>
              <span className="f1-next-t">{when(gpSession.start)}</span>
              <span className="lg-next-t">{r.city} · {r.country}</span>
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
          <button key={id} className={(mobile ? 'chip' : 'lg-mi') + (sec === id ? ' on' : '')} data-nav="" {...(sec === id ? { 'data-nav-active': '' } : {})} onClick={() => setSec(id)} onFocus={() => !mobile && setSec(id)} style={mobile ? { height: 36 } : { borderColor: sec === id ? F1_RED : undefined }}>
            {label}
          </button>
        ))}
        {!mobile && (
          <button className="lg-mi back" data-nav="" onClick={onBack}>
            ‹ Jogos
          </button>
        )}
      </div>
      <div ref={panel} className="glass scroll-y lg-panel" style={{ position: 'absolute', left: L.px + (menuW ? menuW + 22 : 0), right: L.px, top: contentTop, bottom: L.bottom, borderRadius: T.radiusPanel }}>
        {body}
      </div>
    </>
  );
}

function Weekend({ f, r, sports, onWatch, onChange }: { f: F1Data; r: F1Race; sports: Channel[]; onWatch: (c: Channel, list: Channel[]) => void; onChange: () => void }) {
  const games = r.sessions.map((s) => sessionGame(f, r, s, sports));
  const allOn = games.filter((g) => g.start > Date.now()).every((g) => hasReminder(g.key));
  const future = games.filter((g) => g.start > Date.now());
  const ch = games.find((g) => g.channels.length)?.channels[0];
  return (
    <div className="gy-14" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="ov-block">
        <span className="ov-t">Fim de semana · horário de Brasília</span>
        {r.sessions.map((s, i) => {
          const g = games[i];
          const st = sessionState(s);
          const rem = hasReminder(g.key);
          return (
            <button
              key={s.code}
              className={'mrow f1s' + (st === 'in' ? ' live' : '') + (s.code === 'GP' ? ' race' : '')}
              data-nav=""
              onClick={(e) => {
                if (st === 'in' && g.channels[0]) return onWatch(g.channels[0], g.channels);
                if (st === 'post') return;
                const on = toggleReminder(g);
                pop(e.currentTarget);
                toast(on ? `Vamos avisar: ${s.label}` : 'Lembrete desligado', on ? '🔔' : '✕');
                onChange();
              }}
            >
              <span className="f1s-day">{when(s.start, false)}</span>
              <span className="f1s-time">{fmtTime(s.start)}</span>
              <span className="f1s-label">{s.label}</span>
              <span className="f1s-st">
                {st === 'in' ? <span className="badge-live" style={{ fontSize: 11, padding: '3px 7px' }}>Ao vivo</span> : st === 'post' ? <span className="muted">Encerrado</span> : <span className="muted">{countdown(s.start)}</span>}
              </span>
              <span className="mrow-ch">
                {st === 'in' ? (g.channels[0] ? <span>▶ {g.likely ? 'provável: ' : ''}{g.channels[0].name}</span> : <span className="muted">canal não encontrado</span>) : st === 'pre' ? <span style={rem ? { color: T.warn } : undefined}>{rem ? '🔔 Lembrete ligado' : '🔔 Lembrar'}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
      <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap' }}>
        {future.length > 0 && (
          <button
            className="btn primary"
            data-nav=""
            onClick={(e) => {
              for (const g of future) if (allOn ? hasReminder(g.key) : !hasReminder(g.key)) toggleReminder(g);
              pop(e.currentTarget);
              toast(allOn ? 'Lembretes do GP desligados' : `Vamos avisar as ${future.length} sessões`, allOn ? '✕' : '🔔');
              onChange();
            }}
          >
            {allOn ? '🔕 Desligar lembretes do GP' : '🔔 Lembrar todas as sessões'}
          </button>
        )}
        {ch && (
          <button className="btn" data-nav="" onClick={() => onWatch(ch, games.find((g) => g.channels.length)!.channels)}>
            ▶ {ch.name}
          </button>
        )}
      </div>
      <span className="muted" style={{ fontSize: 13 }}>
        {games.some((g) => !g.likely) ? 'Canal encontrado no guia da sua lista.' : 'Canal provável (o GP ainda não apareceu no guia da sua lista).'} OK numa sessão liga ou desliga o lembrete; durante a sessão, abre o canal.
      </span>
      {f.drivers.length > 0 && (
        <div className="ov-block">
          <span className="ov-t">Briga pelo título</span>
          <DriverRows list={f.drivers.slice(0, 5)} max={f.drivers[0].points} />
        </div>
      )}
    </div>
  );
}

function DriverRows({ list, max }: { list: F1Data['drivers']; max: number }) {
  return (
    <div className="srows">
      {list.map((d) => (
        <div key={d.code + d.pos} className="srow f1row" data-nav="" tabIndex={0}>
          <span className="srow-pos">{d.pos}</span>
          <span className="f1-bar" style={{ background: teamColor(d.teamId) }} />
          <span className="srow-team">
            <b className="f1-code">{d.code}</b>
            <span className="srow-tn">{d.name}</span>
            <span className="f1-team muted">{d.team}</span>
          </span>
          <span className="f1-meter"><i style={{ width: `${max ? Math.round((d.points / max) * 100) : 0}%`, background: teamColor(d.teamId) }} /></span>
          <span className="srow-n">{d.wins ? `${d.wins}🏆` : ''}</span>
          <span className="srow-n pts wide">{d.points}</span>
        </div>
      ))}
    </div>
  );
}

function Drivers({ f }: { f: F1Data }) {
  if (!f.drivers.length) return <span className="muted" style={{ fontSize: 16 }}>A classificação aparece depois da primeira corrida.</span>;
  return (
    <div className="ov-block">
      <span className="ov-t">Classificação de pilotos · depois da rodada {f.round}</span>
      <DriverRows list={f.drivers} max={f.drivers[0].points} />
    </div>
  );
}

function Teams({ f }: { f: F1Data }) {
  if (!f.teams.length) return <span className="muted" style={{ fontSize: 16 }}>A classificação aparece depois da primeira corrida.</span>;
  const max = f.teams[0].points;
  return (
    <div className="ov-block">
      <span className="ov-t">Classificação de equipes</span>
      <div className="srows">
        {f.teams.map((t) => (
          <div key={t.id} className="srow f1row" data-nav="" tabIndex={0}>
            <span className="srow-pos">{t.pos}</span>
            <span className="f1-bar" style={{ background: teamColor(t.id) }} />
            <span className="srow-team">
              <span className="srow-tn" style={{ fontWeight: 800 }}>{t.name}</span>
              <span className="f1-team muted">{f.drivers.filter((d) => d.teamId === t.id).map((d) => d.code).join(' · ')}</span>
            </span>
            <span className="f1-meter"><i style={{ width: `${max ? Math.round((t.points / max) * 100) : 0}%`, background: teamColor(t.id) }} /></span>
            <span className="srow-n">{t.wins ? `${t.wins}🏆` : ''}</span>
            <span className="srow-n pts wide">{t.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LastGP({ f }: { f: F1Data }) {
  const last = f.last!;
  const podium = [last.results[1], last.results[0], last.results[2]].filter(Boolean);
  return (
    <div className="gy-18" style={{ display: 'flex', flexDirection: 'column' }}>
      <span className="ov-t">{last.name} · rodada {last.round}</span>
      <div className="podium">
        {podium.map((p) => (
          <div key={p.code} className={'pod p' + p.pos} data-nav="" tabIndex={0} style={{ borderTopColor: teamColor(p.teamId) }}>
            <span className="pod-pos">{p.pos}º</span>
            <b className="pod-code">{p.code}</b>
            <span className="pod-name">{p.name}</span>
            <span className="pod-team" style={{ color: teamColor(p.teamId) }}>{p.team}</span>
            <span className="pod-time muted">{p.time}</span>
          </div>
        ))}
      </div>
      <div className="srows">
        {last.results.slice(3).map((p) => (
          <div key={p.code} className="srow f1row" data-nav="" tabIndex={0}>
            <span className="srow-pos">{p.pos}</span>
            <span className="f1-bar" style={{ background: teamColor(p.teamId) }} />
            <span className="srow-team">
              <b className="f1-code">{p.code}</b>
              <span className="srow-tn">{p.name}</span>
              <span className="f1-team muted">{p.team}</span>
            </span>
            <span className="srow-n wide muted" style={{ width: 120 }}>{p.time}</span>
            <span className="srow-n pts">{p.points ? `+${p.points}` : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Season({ f }: { f: F1Data }) {
  const nx = nextRace(f);
  return (
    <div className="ov-block">
      <span className="ov-t">Calendário {f.season} · {f.races.length} GPs</span>
      <div className="srows">
        {f.races.map((r) => {
          const first = r.sessions[0]?.start ?? r.start;
          const isNext = nx?.round === r.round;
          return (
            <div key={r.round} className={'srow f1cal' + (isNext ? ' next' : '') + (r.winner ? ' done' : '')} data-nav="" tabIndex={0}>
              <span className="srow-pos">{r.round}</span>
              <span className="srow-team">
                <span className="srow-tn" style={{ fontWeight: 800 }}>{r.name}</span>
                <span className="f1-team muted">{r.city} · {r.country}</span>
              </span>
              <span className="f1cal-d">{dayStart(first) === dayStart(r.start) ? when(r.start, false) : `${when(first, false)} a ${when(r.start, false)}`}</span>
              <span className="f1cal-w">
                {r.winner ? (
                  <>
                    <span className="f1-dot" style={{ background: teamColor(r.winner.team) }} />
                    🏆 {r.winner.name}
                  </>
                ) : isNext ? (
                  <span style={{ color: F1_RED, fontWeight: 800 }}>Próximo · {countdown(r.start)}</span>
                ) : (
                  <span className="muted">{fmtTime(r.start)}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Semana do GP (Início)

export function RaceWeek({ playlist, onWatch, onOpen }: { playlist: Playlist; onWatch: (c: Channel, list: Channel[]) => void; onOpen: () => void }) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const f = useF1();
  const [, bump] = useState(0);
  useEffect(() => {
    const t = setInterval(() => bump((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);
  const sports = useMemo(() => playlist.items.filter(isSportsChannel), [playlist]);
  const r = raceWeek(f);
  if (!f || !r) return null;
  const now = Date.now();
  const cur = r.sessions.find((s) => sessionState(s, now) === 'in');
  const next = cur ?? r.sessions.find((s) => s.start > now);
  const race = r.sessions.find((s) => s.code === 'GP');
  const g = next ? sessionGame(f, r, next, sports) : null;
  const rem = g ? hasReminder(g.key) : false;
  return (
    <div className="gameday" style={{ padding: `${mobile ? 6 : 10}px ${L.px}px 4px` }}>
      <div className={'gd-card f1week' + (cur ? ' live' : '')} style={{ background: `linear-gradient(110deg, ${rgba(F1_RED, 0.85)} 0%, ${rgba(F1_RED, 0.35)} 40%, rgba(21,21,30,0.95) 100%)`, borderColor: rgba(F1_RED, 0.7) }}>
        <div className="gd-head">
          <span className="gd-tag">🏁 Semana do GP</span>
          <span className="gd-league">Fórmula 1 · Rodada {r.round}</span>
          <span className={'gd-count' + (cur ? ' live' : '')}>{cur ? `● ${cur.label} ao vivo` : next ? `${next.label} ${countdown(next.start)}` : 'Encerrado'}</span>
        </div>
        <div className="f1w-row">
          <span className="f1-badge" style={{ width: mobile ? 44 : 64, height: mobile ? 44 : 64, borderRadius: mobile ? 22 : 32, fontSize: mobile ? 17 : 24 }}>F1</span>
          <span className="f1w-txt">
            <b>{r.name}</b>
            <span>{r.circuit} · {race ? `Corrida ${when(race.start)}` : ''}</span>
          </span>
        </div>
        <div className="gd-foot">
          {g?.channels[0] && <span className="gd-ch">📺 {g.likely ? 'Provável: ' : ''}{g.channels[0].name}</span>}
          <button className="btn primary" data-nav="" onClick={onOpen}>🏁 Ver o fim de semana</button>
          {cur && g?.channels[0] && (
            <button className="btn" data-nav="" onClick={() => onWatch(g.channels[0], g.channels)}>▶ Assistir</button>
          )}
          {!cur && g && (
            <button
              className="btn"
              data-nav=""
              onClick={(e) => {
                const on = toggleReminder(g);
                pop(e.currentTarget);
                toast(on ? `Vamos avisar: ${next!.label}` : 'Lembrete desligado', on ? '🔔' : '✕');
                bump((x) => x + 1);
              }}
            >
              {rem ? `🔔 ${next!.label}: lembrete ligado` : `🔔 Lembrar ${next!.label.toLowerCase()}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Abrir uma parte da aba Jogos a partir de outra tela (ex.: a F1 pelo Início). */
let pendingView: string | null = null;
export function openSportsView(v: string): void {
  pendingView = v;
}
export function takeSportsView(): string | null {
  const v = pendingView;
  pendingView = null;
  return v;
}
