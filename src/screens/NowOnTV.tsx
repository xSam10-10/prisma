import { useEffect, useRef, useState } from 'react';
import { progressOf } from '../core/epg';
import type { Channel, Playlist } from '../core/types';
import { ChannelLogo, fmtTime } from '../ui/bits';
import { useLayout } from '../ui/layout';
import { KEY, dirOf, isBack, isEnter, pushBack } from '../ui/nav';
import { useClock, useEpg } from '../ui/useEpg';

// "Agora na TV": mosaico com o que está passando em cada canal do grupo,
// com a barra de progresso e o que vem a seguir. Setas andam, OK assiste.

function Card({ playlist, ch, sel, playing, now, onClick }: { playlist: Playlist; ch: Channel; sel: boolean; playing: boolean; now: number; onClick: () => void }) {
  const epg = useEpg(playlist, ch, 120);
  const cur = epg?.[0];
  const next = epg?.[1];
  return (
    <div className={'now-card' + (sel ? ' sel' : '') + (playing ? ' playing' : '')} onClick={onClick}>
      <div className="now-head">
        <ChannelLogo ch={ch} size={36} />
        <span className="now-ch">
          {ch.number ? ch.number + ' ' : ''}
          {ch.name}
        </span>
      </div>
      {epg === null ? (
        <span className="now-title muted">…</span>
      ) : cur ? (
        <>
          <span className="now-title">{cur.title}</span>
          <div className="progress" style={{ marginTop: 6 }}>
            <div style={{ width: `${progressOf(cur, now) * 100}%` }} />
          </div>
          <span className="now-next">
            {fmtTime(cur.start)}–{fmtTime(cur.end)}
            {next ? ` · depois: ${next.title}` : ''}
          </span>
        </>
      ) : (
        <span className="now-title muted">Sem guia de programação</span>
      )}
    </div>
  );
}

export function NowOnTV({ playlist, title, channels, current, onWatch, onClose }: {
  playlist: Playlist;
  title: string;
  channels: Channel[];
  current?: Channel;
  onWatch: (c: Channel) => void;
  onClose: () => void;
}) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const cols = mobile ? 2 : L.W > 1500 ? 5 : 4;
  const CARD_H = mobile ? 132 : 150;
  const rows = Math.max(2, Math.floor((L.H - 130 - L.safeY * 2) / (CARD_H + 14)));
  const [idx, setIdx] = useState(() => Math.max(0, channels.findIndex((c) => c.id === current?.id)));
  const now = useClock();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    root.current?.focus();
    return pushBack(() => {
      onClose();
      return true;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = dirOf(e);
      let h = true;
      if (d === 'left') setIdx((i) => Math.max(0, i - 1));
      else if (d === 'right') setIdx((i) => Math.min(channels.length - 1, i + 1));
      else if (d === 'up') setIdx((i) => Math.max(0, i - cols));
      else if (d === 'down') setIdx((i) => Math.min(channels.length - 1, i + cols));
      else if (e.keyCode === KEY.CH_UP) setIdx((i) => Math.max(0, i - cols * rows));
      else if (e.keyCode === KEY.CH_DOWN) setIdx((i) => Math.min(channels.length - 1, i + cols * rows));
      else if (isEnter(e)) channels[idx] && onWatch(channels[idx]);
      else if (isBack(e)) onClose();
      else h = false;
      if (h) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  // Mostra só as linhas à vista (o grupo pode ter centenas de canais).
  const row = Math.floor(idx / cols);
  const firstRow = Math.max(0, Math.min(row - Math.floor(rows / 2), Math.ceil(channels.length / cols) - rows));
  const first = firstRow * cols;
  const shown = channels.slice(first, first + rows * cols);

  return (
    <div ref={root} className="now-tv" tabIndex={-1} data-nav-scope="" style={{ padding: `${24 + L.safeY}px ${L.px}px` }}>
      <div className="now-top">
        <span className="title" style={{ fontSize: mobile ? 22 : 30 }}>Agora na TV</span>
        <span className="muted caps" style={{ fontSize: 15, marginLeft: 14 }}>{title} · {channels.length} canais</span>
        <span className="muted" style={{ fontSize: 14, marginLeft: 'auto' }}>{mobile ? '' : 'Setas escolhem · OK assiste · Voltar fecha'}</span>
        {mobile && (
          <button className="btn" onClick={onClose} style={{ marginLeft: 'auto' }}>
            Fechar
          </button>
        )}
      </div>
      <div className="now-grid">
        {shown.map((c, k) => (
          <div key={c.id} className="now-cell" style={{ width: `${100 / cols}%`, height: CARD_H + 14 }}>
            <Card playlist={playlist} ch={c} sel={first + k === idx} playing={current?.id === c.id} now={now} onClick={() => onWatch(c)} />
          </div>
        ))}
      </div>
      {!channels.length && <span className="muted" style={{ fontSize: 16 }}>Nenhum canal neste grupo.</span>}
    </div>
  );
}
