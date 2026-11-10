import { useEffect, useRef, useState } from 'react';
import { myTeams } from '../core/games';
import { isMyTeam, loadScores, pinnedScores, type Score } from '../core/scores';
import { useLayout } from './layout';

// Placar flutuante (0.26.0): por cima do vídeo em tela cheia, mostra os jogos
// fixados ("📌 Placar na tela" no detalhe do jogo) e os jogos dos Meus times que
// estão ao vivo. Atualiza a cada 30 s; o placar pisca quando sai gol.

export function ScoreBug() {
  const L = useLayout();
  const [scores, setScores] = useState<Score[]>([]);
  const last = useRef(new Map<string, string>());
  const [flash, setFlash] = useState<string>('');
  useEffect(() => {
    let alive = true;
    const tick = () =>
      loadScores()
        .then((s) => {
          if (!alive) return;
          setScores(s);
          // Gol: placar mudou desde a última leitura.
          for (const x of s) {
            const k = x.path + '|' + x.id;
            const v = x.homeScore + '-' + x.awayScore;
            const old = last.current.get(k);
            if (old !== undefined && old !== v && x.state === 'in') {
              setFlash(k);
              setTimeout(() => alive && setFlash(''), 12000);
            }
            last.current.set(k, v);
          }
        })
        .catch(() => undefined);
    tick();
    const t = setInterval(tick, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  const pins = pinnedScores();
  const mine = myTeams();
  const shown: Score[] = [];
  for (const p of pins) {
    const s = scores.find((x) => x.id === p.id && x.path === p.path);
    if (s && s.state !== 'pre') shown.push(s);
  }
  if (mine.length)
    for (const s of scores)
      if (shown.length < 2 && s.state === 'in' && (isMyTeam(s.home, mine) || isMyTeam(s.away, mine)) && !shown.some((x) => x.id === s.id && x.path === s.path)) shown.push(s);
  if (!shown.length) return null;
  return (
    <div className="scorebug-wrap" style={{ right: 24 + L.safeX, top: 24 + L.safeY }} aria-live="polite">
      {shown.slice(0, 2).map((s) => {
        const k = s.path + '|' + s.id;
        return (
          <div key={k} className={'scorebug' + (flash === k ? ' goal' : '') + (s.state === 'post' ? ' over' : '')}>
            <span className="sb-team">
              {s.homeLogo ? <img src={s.homeLogo} alt="" referrerPolicy="no-referrer" /> : null}
              <b>{abbr(s.home)}</b>
            </span>
            <span className="sb-score">
              {s.homeScore}
              <i>–</i>
              {s.awayScore}
            </span>
            <span className="sb-team">
              <b>{abbr(s.away)}</b>
              {s.awayLogo ? <img src={s.awayLogo} alt="" referrerPolicy="no-referrer" /> : null}
            </span>
            <span className="sb-min">{flash === k ? 'GOL!' : s.state === 'post' ? 'Fim' : s.detail}</span>
          </div>
        );
      })}
    </div>
  );
}

/** "Atlético Mineiro" → "ATL", "São Paulo" → "SÃO". */
function abbr(name: string): string {
  const w = name.replace(/^(fc|ec|sc|cr|ca|ac)\s+/i, '').trim();
  return w.slice(0, 3).toUpperCase();
}
