import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { catchupItem, inArchive } from '../core/catchup';
import { hasReminder, toggleReminder } from '../core/games';
import { channelSchedule, dayStart, programmesOn, scheduleDays } from '../core/schedule';
import type { Channel, EpgEntry, Playlist } from '../core/types';
import { ChannelLogo, fmtTime } from '../ui/bits';
import { dirOf, focusEl, isBack, isEnter, pushBack } from '../ui/nav';

// Programação do canal por dia — abre com a seta → na lista de canais
// (como no app de referência): coluna de dias (Hoje em destaque) e, ao lado,
// os programas do dia. OK: assistir agora, assistir a gravação (programa que
// já passou, quando a lista grava) ou agendar lembrete (programa futuro).

const WEEK = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const z = (n: number) => String(n).padStart(2, '0');

export function SchedulePanel({ playlist, channel, rect, anchor, onClose, onWatch, onPlayVod }: {
  playlist: Playlist;
  channel: Channel;
  rect: React.CSSProperties;
  /** Elemento da tela (para achar o deslocamento dela no palco). */
  anchor?: React.RefObject<HTMLElement>;
  onClose: () => void;
  onWatch: (c: Channel) => void;
  onPlayVod: (item: Channel) => void;
}) {
  const [list, setList] = useState<EpgEntry[] | null>(null);
  const now = Date.now();
  const today = dayStart(now);
  const days = useMemo(() => scheduleDays(list ?? [], channel, now), [list, channel]); // eslint-disable-line react-hooks/exhaustive-deps
  const [day, setDay] = useState(today);
  const [col, setCol] = useState<'days' | 'progs'>('days');
  const [pi, setPi] = useState(0);
  const [, force] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const progBox = useRef<HTMLDivElement>(null);
  const dayBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setList(null);
    channelSchedule(playlist, channel).then((l) => alive && setList(l));
    return () => {
      alive = false;
    };
  }, [channel.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    requestAnimationFrame(() => focusEl(box.current));
    return pushBack(() => {
      onClose();
      return true;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const progs = list ? programmesOn(list, day) : [];
  // Ao trocar de dia: no dia de hoje, começa no programa de agora.
  useEffect(() => {
    const i = day === today ? progs.findIndex((e) => e.start <= now && now < e.end) : 0;
    setPi(Math.max(0, i));
  }, [day, list]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mantém o programa escolhido à vista.
  useEffect(() => {
    const el = progBox.current?.querySelector<HTMLElement>('.sch-prog.sel');
    if (el && progBox.current) {
      const b = progBox.current;
      if (el.offsetTop < b.scrollTop) b.scrollTop = el.offsetTop - 8;
      else if (el.offsetTop + el.offsetHeight > b.scrollTop + b.clientHeight) b.scrollTop = el.offsetTop + el.offsetHeight - b.clientHeight + 8;
    }
  }, [pi, col, day, list]);
  // E o dia escolhido à vista na coluna de dias.
  useEffect(() => {
    const b = dayBox.current;
    const el = b?.querySelector<HTMLElement>('.sch-day.on');
    if (b && el) b.scrollTop = Math.max(0, el.offsetTop - (b.clientHeight - el.offsetHeight) / 2);
  }, [day, days.length]);

  const kindOf = (e: EpgEntry): 'now' | 'past-rec' | 'past' | 'future' => {
    if (e.start <= now && now < e.end) return 'now';
    if (e.end <= now) return e.archive || inArchive(channel, e, now) ? 'past-rec' : 'past';
    return 'future';
  };
  const act = (e: EpgEntry) => {
    const k = kindOf(e);
    if (k === 'now') onWatch(channel);
    else if (k === 'past-rec') {
      const it = catchupItem(playlist, { ...channel, catchupDays: channel.catchupDays || 7 }, e);
      if (it) onPlayVod(it);
    } else if (k === 'future') {
      toggleReminder({ key: `g:${channel.id}:${e.start}`, title: `${e.title} · ${channel.name}`, league: '', start: e.start, end: e.end, channels: [channel] });
      force((x) => x + 1);
    }
  };

  const onKeyDown = (ev: React.KeyboardEvent) => {
    const d = dirOf(ev);
    const di = days.indexOf(day);
    let handled = true;
    if (col === 'days') {
      if (d === 'up' && di > 0) setDay(days[di - 1]);
      else if (d === 'down' && di < days.length - 1) setDay(days[di + 1]);
      else if ((d === 'right' || isEnter(ev)) && progs.length) setCol('progs');
      else if (d === 'left' || isBack(ev)) onClose();
      else if (d) {
        /* fim da coluna */
      } else handled = false;
    } else {
      if (d === 'up') pi > 0 ? setPi(pi - 1) : di > 0 && (setDay(days[di - 1]), setCol('progs'));
      else if (d === 'down') pi < progs.length - 1 ? setPi(pi + 1) : di < days.length - 1 && setDay(days[di + 1]);
      else if (d === 'left' || isBack(ev)) setCol('days');
      else if (isEnter(ev) && progs[pi]) act(progs[pi]);
      else if (d) {
        /* nada à direita */
      } else handled = false;
    }
    if (handled) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  };

  const first = list && list.length ? list[0].start : 0;
  const last = list && list.length ? list[list.length - 1].end : 0;
  const fmtD = (t: number) => `${z(new Date(t).getDate())}/${z(new Date(t).getMonth() + 1)}`;

  const stage = typeof document !== 'undefined' ? document.querySelector('.stage') : null;
  // As coordenadas vêm da tela (Ao vivo); no palco, soma o deslocamento dela (menu lateral da estrutura C).
  const [shift, setShift] = useState(0);
  useEffect(() => {
    const host = anchor?.current;
    if (!host || !stage) return;
    const k = stage.getBoundingClientRect().width / ((stage as HTMLElement).offsetWidth || 1) || 1;
    setShift(Math.round((host.getBoundingClientRect().left - stage.getBoundingClientRect().left) / k));
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps
  const placed: React.CSSProperties = { ...rect, left: typeof rect.left === 'number' ? rect.left + shift : rect.left, right: typeof rect.right === 'number' ? rect.right : rect.right };
  const panel = (
    <div ref={box} className="sch" style={placed} tabIndex={0} data-nav-scope="" onKeyDown={onKeyDown} role="dialog" aria-label={`Programação de ${channel.name}`}>
      <div className="sch-daycol">
        <span className="sch-arrow" aria-hidden="true">⌃</span>
      <div className="sch-days" ref={dayBox}>
        {days.map((t) => {
          const label = t === today ? 'Hoje' : `${z(new Date(t).getDate())}/${z(new Date(t).getMonth() + 1)}`;
          const has = !!list && programmesOn(list, t).length > 0;
          return (
            <button
              key={t}
              className={'sch-day' + (t === day ? ' on' : '') + (t === day && col === 'days' ? ' foc' : '') + (has ? '' : ' empty')}
              onClick={() => {
                setDay(t);
                setCol('days');
                focusEl(box.current);
              }}
            >
              <span className="sch-d1">{label}</span>
              <span className="sch-d2">{WEEK[new Date(t).getDay()]}</span>
            </button>
          );
        })}
      </div>
        <span className="sch-arrow" aria-hidden="true">⌄</span>
      </div>
      <div className="sch-main">
        <div className="sch-head">
          <ChannelLogo ch={channel} size={34} />
          <div className="sch-htxt">
          <span className="sch-title">{channel.number ? channel.number + ' ' : ''}{channel.name}</span>
          <span className="sch-cover">
            {list && list.length ? `Guia: ${fmtD(first)} a ${fmtD(last)}` : ''}
            {channel.catchupDays ? ` · gravação: ${channel.catchupDays} ${channel.catchupDays === 1 ? 'dia' : 'dias'}` : ''}
          </span>
          </div>
        </div>
        <div className="sch-progs" ref={progBox}>
          {list === null ? (
            [0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 58, marginBottom: 8 }} />)
          ) : !list.length ? (
            <div className="sch-empty">
              <span className="title" style={{ fontSize: 20 }}>Sem guia de programação</span>
              <span className="muted">A sua lista não envia programação para este canal. Outros canais podem ter.</span>
            </div>
          ) : !progs.length ? (
            <div className="sch-empty">
              <span className="title" style={{ fontSize: 20 }}>Nada neste dia</span>
              <span className="muted">
                A lista só enviou programação de {fmtD(first)} a {fmtD(last)} para este canal.
              </span>
            </div>
          ) : (
            progs.map((e, i) => {
              const k = kindOf(e);
              const rem = k === 'future' && hasReminder(`g:${channel.id}:${e.start}`);
              return (
                <div
                  key={e.start}
                  className={'sch-prog ' + k + (i === pi && col === 'progs' ? ' sel' : '')}
                  onClick={() => {
                    setPi(i);
                    setCol('progs');
                    focusEl(box.current);
                    act(e);
                  }}
                >
                  <div className="sch-when">
                    <span className="sch-time">{fmtTime(e.start)} – {fmtTime(e.end)}</span>
                    <span className="sch-tag">
                      {k === 'now' ? '● AO VIVO' : k === 'past-rec' ? '▶ Gravação' : k === 'future' ? (rem ? '⏰ Agendado' : '') : ''}
                    </span>
                  </div>
                  <div className="sch-txt">
                    <span className="sch-name">{e.title}</span>
                    {i === pi && col === 'progs' && e.description && <span className="sch-desc">{e.description}</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="sch-hint">Pressione OK para assistir a gravação (programas que já passaram) ou agendar um lembrete (programas futuros) · ◀ volta</div>
      </div>
    </div>
  );
  // Desenhado direto no palco, por cima do vídeo pequeno da tela Ao vivo.
  return stage ? createPortal(panel, stage) : panel;
}
