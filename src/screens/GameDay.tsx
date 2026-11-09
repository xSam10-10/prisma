import { useEffect, useState } from 'react';
import { cachedGames, hasReminder, loadGames, myTeams, teamsOf, toggleReminder, type Game } from '../core/games';
import { isMyTeam, loadScores, sameTeam, scoreFor, type Score } from '../core/scores';
import type { Channel, Playlist } from '../core/types';
import { fmtTime, rgba } from '../ui/bits';
import { useLayout } from '../ui/layout';
import { pop, toast } from '../ui/premium2';

// "Dia de jogo" (0.23.0): quando um dos Meus times joga hoje, faixa no alto do Início
// com as cores do time, contagem regressiva, canal e placar ao vivo.

function pickGame(games: Game[], mine: string[]): Game | null {
  const n = Date.now();
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const list = games.filter((x) => x.end > n && x.start < end.getTime() && teamsOf(x).some((t) => isMyTeam(t, mine)));
  list.sort((a, b) => a.start - b.start);
  return list[0] ?? null;
}

function countdown(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  return h ? `${h}h${(m % 60 < 10 ? '0' : '') + (m % 60)}` : `${m} min`;
}

export function GameDay({ playlist, onWatch }: { playlist: Playlist; onWatch: (c: Channel, list: Channel[]) => void }) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const [g, setG] = useState<Game | null>(null);
  const [score, setScore] = useState<Score | undefined>();
  const [now, setNow] = useState(Date.now());
  const [, bump] = useState(0);
  useEffect(() => {
    const mine = myTeams();
    if (!mine.length) return;
    let alive = true;
    const c = cachedGames();
    if (c.length) setG(pickGame(c, mine));
    // Sem jogos lidos ainda: busca com calma, depois que o Início já apareceu.
    const t = setTimeout(
      () =>
        loadGames(playlist)
          .then((gs) => alive && setG(pickGame(gs, mine)))
          .catch(() => undefined),
      c.length ? 0 : 3500,
    );
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [playlist]);
  useEffect(() => {
    if (!g) return;
    let alive = true;
    const tick = () => loadScores().then((s) => alive && setScore(scoreFor(g, s))).catch(() => undefined);
    tick();
    const a = setInterval(tick, 60000);
    const b = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      alive = false;
      clearInterval(a);
      clearInterval(b);
    };
  }, [g?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!g) return null;
  const teams = teamsOf(g);
  const mine = myTeams();
  const myName = teams.find((t) => isMyTeam(t, mine)) ?? teams[0];
  const myColor = score ? (sameTeam(myName, score.home) ? score.homeColor : score.awayColor) : undefined;
  const color = myColor && myColor.length === 7 ? myColor : '#2E7D32';
  const live = score ? score.state === 'in' : now >= g.start && now < g.end;
  const over = score?.state === 'post';
  const ch = g.channels[0];
  const rem = hasReminder(g.key);
  return (
    <div className="gameday" style={{ padding: `${mobile ? 6 : 10}px ${L.px}px 4px` }}>
      <div className={'gd-card' + (live ? ' live' : '')} style={{ background: `linear-gradient(110deg, ${rgba(color, 0.62)} 0%, ${rgba(color, 0.22)} 45%, rgba(18,18,26,0.92) 100%)`, borderColor: rgba(color, 0.7) }}>
        <div className="gd-head">
          <span className="gd-tag">⚽ Dia de jogo</span>
          <span className="gd-league">{g.league}</span>
          <span className={'gd-count' + (live ? ' live' : '')}>{over ? 'Encerrado' : live ? '● Ao vivo agora' : `Começa em ${countdown(g.start - now)} · ${fmtTime(g.start)}`}</span>
        </div>
        <div className="gd-row">
          {(() => {
            const homeFirst = !score || sameTeam(teams[0] ?? '', score.home) || !sameTeam(teams[0] ?? '', score.away);
            const side = (k: 0 | 1) => {
              const isHome = homeFirst ? k === 0 : k === 1;
              return { name: teams[k] ?? (k === 0 ? g.title : ''), logo: score ? (isHome ? score.homeLogo : score.awayLogo) : undefined, goals: score ? (isHome ? score.homeScore : score.awayScore) : '' };
            };
            const a = side(0);
            const b = side(1);
            const started = !!score && score.state !== 'pre';
            return (
              <>
                <span className="gd-team">
                  {a.logo ? <img src={a.logo} alt="" referrerPolicy="no-referrer" /> : <span className="gd-ini">{a.name.slice(0, 1)}</span>}
                  <b>{a.name}</b>
                </span>
                <span className="gd-score">
                  {started ? (
                    <>
                      {a.goals}
                      <i>×</i>
                      {b.goals}
                    </>
                  ) : (
                    <i>×</i>
                  )}
                  {live && score && <small>{score.detail}</small>}
                </span>
                <span className="gd-team r">
                  <b>{b.name}</b>
                  {b.logo ? <img src={b.logo} alt="" referrerPolicy="no-referrer" /> : <span className="gd-ini">{b.name.slice(0, 1)}</span>}
                </span>
              </>
            );
          })()}
        </div>
        <div className="gd-foot">
          {ch ? <span className="gd-ch">📺 {g.likely ? 'Provável: ' : ''}{ch.name}</span> : <span className="gd-ch">Canal ainda não encontrado no guia</span>}
          {ch && (
            <button className="btn primary" data-nav="" onClick={() => onWatch(ch, g.channels)}>
              ▶ {live ? 'Assistir ao vivo' : 'Ir para o canal'}
            </button>
          )}
          {!live && !over && (
            <button
              className="btn"
              data-nav=""
              onClick={(e) => {
                const on = toggleReminder(g);
                pop(e.currentTarget);
                toast(on ? 'Vamos avisar no começo do jogo' : 'Lembrete desligado', on ? '🔔' : '✕');
                bump((x) => x + 1);
              }}
            >
              {rem ? '🔔 Lembrete ligado' : '🔔 Lembrar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
