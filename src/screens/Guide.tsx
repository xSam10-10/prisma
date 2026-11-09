import { useEffect, useMemo, useRef, useState } from 'react';
import { canCatchup, catchupItem, inArchive } from '../core/catchup';
import { hasReminder, toggleReminder } from '../core/games';
import type { Channel, EpgEntry, Playlist } from '../core/types';
import { hasXmltv, loadXmltv, programmesOf } from '../core/xmltv';
import { ChannelLogo, fmtTime } from '../ui/bits';
import { useLayout } from '../ui/layout';
import { KEY, dirOf, focusEl, isEnter, pushBack } from '../ui/nav';
import { T } from '../ui/tokens';
import { lookup, tmdbKey } from '../core/tmdb';

// Guia de programação em grade: canais nas linhas, horário nas colunas.
// ◀ ▶ programa anterior/seguinte · ▲ ▼ canal · OK: assistir / gravação / lembrete.

const SPAN = 3 * 3600 * 1000; // 3 horas na tela
const ROW = 64;

function dayStart(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
const DAY = 86400000;

export function Guide({ playlist, channels, startIndex, onWatch, onPlayVod, onClose }: {
  playlist: Playlist;
  channels: Channel[];
  startIndex: number;
  onWatch: (c: Channel) => void;
  onPlayVod: (item: Channel) => void;
  onClose: () => void;
}) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const now = Date.now();
  const [ready, setReady] = useState(hasXmltv());
  const [row, setRow] = useState(Math.max(0, startIndex));
  const [cursor, setCursor] = useState(now); // horário "em foco"
  const [t0, setT0] = useState(now - 30 * 60000 - (now % (30 * 60000)));
  const [, force] = useState(0);
  const grid = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    loadXmltv(playlist).then(() => alive && setReady(true));
    requestAnimationFrame(() => focusEl(grid.current));
    const pop = pushBack(() => {
      onClose();
      return true;
    });
    return () => {
      alive = false;
      pop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const progs = (c: Channel): EpgEntry[] => programmesOf(c);
  const selCh = channels[row];
  const selList = selCh ? progs(selCh) : [];
  const selIdx = selList.findIndex((e) => e.start <= cursor && cursor < e.end);
  const sel = selIdx >= 0 ? selList[selIdx] : undefined;

  // Mantém o programa selecionado à vista
  useEffect(() => {
    if (cursor < t0 + 10 * 60000) setT0(cursor - 15 * 60000);
    else if (cursor > t0 + SPAN - 20 * 60000) setT0(cursor - SPAN + 45 * 60000);
  }, [cursor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dias: até 3 dias atrás (se algum canal grava) e 7 à frente.
  const anyArchive = useMemo(() => channels.some(canCatchup), [channels]);
  const today = dayStart(now);
  const days = useMemo(() => {
    const out: number[] = [];
    for (let k = anyArchive ? -3 : 0; k <= 6; k++) out.push(today + k * DAY);
    return out;
  }, [today, anyArchive]);

  const goDay = (d: number) => {
    const target = d === today ? now : d + 20 * 3600 * 1000; // outro dia: começa às 20h
    setCursor(target);
    setT0(target - 30 * 60000);
  };

  const act = (c: Channel, e?: EpgEntry) => {
    if (!e || (e.start <= now && now < e.end)) return onWatch(c);
    if (e.end <= now) {
      const it = catchupItem(playlist, c, e);
      if (it) onPlayVod(it);
      return;
    }
    toggleReminder({ key: `g:${c.id}:${e.start}`, title: `${e.title} · ${c.name}`, league: '', start: e.start, end: e.end, channels: [c] });
    force((x) => x + 1);
  };

  const onKeyDown = (ev: React.KeyboardEvent) => {
    const d = dirOf(ev);
    if (d === 'right' || d === 'left') {
      ev.preventDefault();
      if (sel) {
        const n = selList[selIdx + (d === 'right' ? 1 : -1)];
        if (n) setCursor(Math.max(n.start, Math.min(n.end - 60000, n.start + 60000)));
        else setCursor(cursor + (d === 'right' ? 30 : -30) * 60000);
      } else setCursor(cursor + (d === 'right' ? 30 : -30) * 60000);
    } else if (d === 'down' && row < channels.length - 1) {
      ev.preventDefault();
      setRow(row + 1);
    } else if (d === 'up' && row > 0) {
      ev.preventDefault();
      setRow(row - 1);
    } else if (ev.keyCode === KEY.CH_DOWN) {
      ev.preventDefault();
      setRow(Math.min(channels.length - 1, row + 6));
    } else if (ev.keyCode === KEY.CH_UP) {
      ev.preventDefault();
      setRow(Math.max(0, row - 6));
    } else if (isEnter(ev) && selCh) {
      ev.preventDefault();
      act(selCh, sel);
    }
  };

  // Geometria
  const top = (mobile ? 12 : 30) + L.safeY;
  const infoH = mobile ? 120 : 204;
  const gridTop = top + 64 + infoH + 12;
  const chW = mobile ? 120 : 230;
  const gridW = L.W - L.px * 2 - chW;
  const ppm = gridW / (SPAN / 60000); // pixels por minuto
  const x = (ms: number) => ((ms - t0) / 60000) * ppm;
  const gridH = L.H - gridTop - (mobile ? 16 : 36) - L.safeY - 34;
  const rowsVisible = Math.max(1, Math.floor(gridH / ROW));
  const firstRow = Math.max(0, Math.min(row - Math.floor(rowsVisible / 2), channels.length - rowsVisible));
  const ticks: number[] = [];
  for (let t = t0 - (t0 % (30 * 60000)); t < t0 + SPAN; t += 30 * 60000) if (t >= t0) ticks.push(t);

  const status = sel ? (sel.start <= now && now < sel.end ? 'live' : sel.end <= now ? 'past' : 'future') : null;
  // Arte do programa em foco: a do guia ou, sem ela, a do TMDB (filmes e séries; não telejornal/esporte).
  const [art, setArt] = useState<string | undefined>();
  useEffect(() => {
    setArt(undefined);
    if (!sel || sel.image || mobile || !tmdbKey() || /jornal|not[ií]cia|futebol|esporte|ao vivo|campeonato|\bx\b|×|programa[cç][aã]o|encerramento|pol[ií]tica|missa|culto|igreja/i.test(sel.title)) return;
    let alive = true;
    const name = sel.title.replace(/^(sess[aã]o da tarde|coruj[aã]o|tela quente|temperatura m[aá]xima|domingo maior|cinema especial|supercine)\s*[:\-–]\s*/i, '').trim();
    const t = setTimeout(async () => {
      for (const kind of ['movie', 'series'] as const) {
        const r = await lookup({ id: `epg:${kind}:${name}`, kind, name, group: '', url: '' }).catch(() => null);
        if (r?.backdrop) {
          if (alive) setArt(r.backdrop);
          return;
        }
      }
    }, 450);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [sel?.title, sel?.start]); // eslint-disable-line react-hooks/exhaustive-deps
  const heroImg = sel?.image || art;
  const archived = !!(selCh && sel && inArchive(selCh, sel, now));

  return (
    <div className="guide" data-nav-scope="">
      <div className="scroll-x" style={{ position: 'absolute', left: L.px, right: L.px, top, height: 52, alignItems: 'center' }}>
        <span className="title" style={{ fontSize: mobile ? 22 : 28, marginRight: 14, flexShrink: 0 }}>Guia</span>
        {days.map((d) => {
          const on = dayStart(cursor) === d;
          const label = d === today ? 'Hoje' : d === today + DAY ? 'Amanhã' : d === today - DAY ? 'Ontem' : new Date(d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
          return (
            <button key={d} className={'chip' + (on ? ' on' : '')} data-nav="" onClick={() => goDay(d)} style={d < today ? { opacity: 0.85 } : undefined}>
              {d < today ? '↺ ' : ''}{label}
            </button>
          );
        })}
        <button className="chip" data-nav="" style={{ color: T.live }} onClick={() => { setCursor(now); setT0(now - 30 * 60000); }}>● Agora</button>
        <button className="chip" data-nav="" onClick={onClose}>Fechar</button>
      </div>

      {/* Detalhes do programa selecionado */}
      <div className="guide-info" style={{ left: L.px, right: L.px, top: top + 64, height: infoH }}>
        {heroImg && !mobile && <img key={heroImg} className="guide-info-img" src={heroImg} alt="" referrerPolicy="no-referrer" />}
        {selCh && (
          <>
            <ChannelLogo ch={selCh} size={mobile ? 48 : 72} />
            <div className="gy-6 guide-info-txt" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flexGrow: 1, maxWidth: mobile ? undefined : '58%' }}>
              <span className="muted caps" style={{ fontSize: 14, fontWeight: 700 }}>
                {selCh.number} · {selCh.name}
                {sel ? ` · ${new Date(sel.start).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })} ${fmtTime(sel.start)} – ${fmtTime(sel.end)}` : ''}
              </span>
              <span className="title" style={{ fontSize: mobile ? 20 : 38, lineHeight: 1.08 }}>{sel ? sel.title : ready ? 'Sem programação neste horário' : 'Carregando o guia…'}</span>
              {sel?.description && !mobile && <span className="muted guide-desc">{sel.description}</span>}
              <span style={{ fontSize: 14, fontWeight: 700, color: status === 'live' ? T.live : archived ? T.primary : T.warn }}>
                {status === 'live'
                  ? '● Ao vivo agora · OK para assistir'
                  : status === 'past'
                    ? archived
                      ? '↺ Gravado · OK para assistir desde o início'
                      : 'Já passou · este canal não guarda gravações'
                    : status === 'future'
                      ? sel && hasReminder(`g:${selCh.id}:${sel.start}`)
                        ? '⏰ Lembrete ativado · OK para desligar'
                        : 'Em breve · OK para criar lembrete'
                      : ''}
              </span>
              {status === 'live' && sel && !mobile && (
                <span className="guide-live-prog">
                  <i><b style={{ width: `${Math.max(0, Math.min(1, (now - sel.start) / (sel.end - sel.start))) * 100}%` }} /></i>
                  termina em {Math.max(1, Math.round((sel.end - now) / 60000))} min
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Grade */}
      <div
        ref={grid}
        className="guide-grid"
        tabIndex={0}
        data-nav=""
        onKeyDown={onKeyDown}
        style={{ left: L.px, right: L.px, top: gridTop, height: gridH + 34 }}
        onWheel={(e) => setT0((v) => v + (e.deltaY > 0 ? 30 : -30) * 60000)}
      >
        <div className="guide-times" style={{ left: chW, height: 30 }}>
          {ticks.map((t) => (
            <span key={t} style={{ left: x(t) }}>{fmtTime(t)}</span>
          ))}
        </div>
        {now > t0 && now < t0 + SPAN && (
          <div className="guide-now" style={{ left: chW + x(now), top: 30, height: gridH }}>
            <span className="guide-now-tag">{fmtTime(now)}</span>
          </div>
        )}
        {!ready && <div className="muted" style={{ position: 'absolute', left: chW + 20, top: 60, fontSize: 16 }}>Baixando o guia completo da lista…</div>}
        {ready && !hasXmltv() && (
          <div className="muted" style={{ position: 'absolute', left: chW + 20, top: 60, right: 20, fontSize: 16 }}>
            A sua lista não trouxe o guia completo (XMLTV). O “agora / a seguir” continua aparecendo na tela Ao vivo.
          </div>
        )}
        {channels.slice(firstRow, firstRow + rowsVisible).map((c, k) => {
          const r = firstRow + k;
          const y = 34 + k * ROW;
          const list = progs(c).filter((e) => e.end > t0 && e.start < t0 + SPAN);
          return (
            <div key={c.id} className={'guide-row' + (r === row ? ' on' : '')} style={{ top: y, height: ROW - 6 }}>
              <div className="guide-ch" style={{ width: chW - 8 }} onClick={() => { setRow(r); focusEl(grid.current); }}>
                <ChannelLogo ch={c} size={36} />
                {!mobile && <span className="caps">{c.name}</span>}
                {canCatchup(c) && <span title="Guarda gravações" style={{ color: T.primary, fontSize: 13 }}>↺</span>}
              </div>
              {list.map((e) => {
                const left = Math.max(0, x(e.start));
                const right = Math.min(gridW, x(e.end));
                const isSel = r === row && sel === e;
                const st = e.start <= now && now < e.end ? ' live' : e.end <= now ? ' past' : '';
                return (
                  <div
                    key={e.start}
                    className={'guide-prog' + st + (isSel ? ' sel' : '')}
                    style={{ left: chW + left, width: Math.max(4, right - left - 4) }}
                    onClick={() => {
                      setRow(r);
                      setCursor(Math.max(e.start, Math.min(e.end - 60000, now)));
                      focusEl(grid.current);
                      if (isSel) act(c, e);
                    }}
                  >
                    {st === ' live' && e.image && right - left > 140 && <img className="guide-img" src={e.image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
                    <span>{e.title}</span>
                    <small>{fmtTime(e.start)}</small>
                    {st === ' live' && <i className="guide-prog-bar" style={{ width: `${Math.max(0, Math.min(1, (now - e.start) / (e.end - e.start))) * 100}%` }} />}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
