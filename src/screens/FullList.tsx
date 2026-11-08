import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { canCatchup } from '../core/catchup';
import { reminders, toggleReminder } from '../core/games';
import { orderedSections, sectionChannels, useSections } from '../core/sections';
import { categoriesOf } from '../core/source';
import { prefGet } from '../core/storage';
import type { Channel, Playlist } from '../core/types';
import { ChannelLogo, fmtTime } from '../ui/bits';
import { useLayout } from '../ui/layout';
import { KEY, dirOf, isBack, isEnter } from '../ui/nav';
import { normalizeText } from './LiveTV';
import { SchedulePanel } from './Schedule';

// Lista de canais por cima do vídeo em tela cheia (como no app de referência):
//  OK (na tela cheia)  → abre esta lista
//  ◀                   → menu lateral: Buscar, Agendar programação, Favoritos,
//                        Lista de canais e os grupos/seções
//  ▶ (no menu)         → volta para a lista
//  ▶ (na lista)        → programação do canal por dia (dias antes e depois)
//  OK num canal        → assiste · Voltar fecha

const FAV = '__fav__';
const ALL = '__all__';
/** Canais que gravam (voltar na programação) — como o grupo "Playback" do app de referência. */
const REC = '__rec__';
type Col = 'menu' | 'list' | 'sched';
interface Item {
  id: string;
  label: string;
  icon?: ReactNode;
  kind: 'search' | 'agenda' | 'group' | 'guide' | 'now';
  lock?: boolean;
}

const ic = (d: ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);
const IC = {
  search: ic(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
  clock: ic(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  star: ic(<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />),
  rec: ic(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" fill="currentColor" /></>),
  mosaic: ic(<><rect x="3" y="4" width="8" height="7" rx="1" /><rect x="13" y="4" width="8" height="7" rx="1" /><rect x="3" y="13" width="8" height="7" rx="1" /><rect x="13" y="13" width="8" height="7" rx="1" /></>),
  grid: ic(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16" /></>),
  list: ic(<><path d="M9 6h12M9 12h12M9 18h12" /><circle cx="4.5" cy="6" r="1" fill="currentColor" /><circle cx="4.5" cy="12" r="1" fill="currentColor" /><circle cx="4.5" cy="18" r="1" fill="currentColor" /></>),
};

export function FullList({ playlist, live, current, isFav, onPick, onPlayVod, onClose, onOpenGuide, onOpenNow, variant = 'classic' }: {
  playlist: Playlist;
  live: Channel[];
  current?: Channel;
  isFav: (c: Channel) => boolean;
  /** Assistir um canal (a lista vira a ordem do ▲▼ na tela cheia). */
  onPick: (c: Channel, list: Channel[]) => void;
  onPlayVod: (item: Channel) => void;
  onClose: () => void;
  /** Grade de todos os canais (Guia de 7 dias). */
  onOpenGuide?: (channels: Channel[], index: number) => void;
  /** "Agora na TV": mosaico do grupo. */
  onOpenNow?: (channels: Channel[], title: string) => void;
  /** Visual: clássico (cinza, igual à barra clássica) ou Prisma (escuro, cores do tema). */
  variant?: 'classic' | 'prisma';
}) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const { data: secData } = useSections();
  const native = useMemo(() => categoriesOf(live, 'live'), [live]);
  const sections = useMemo(() => orderedSections(native, secData, live), [native, secData, live]);
  const menu: Item[] = useMemo(
    () => [
      { id: 'search', label: 'Buscar', icon: IC.search, kind: 'search' },
      { id: 'agenda', label: 'Agendar programação', icon: IC.clock, kind: 'agenda' },
      { id: FAV, label: 'Favoritos', icon: IC.star, kind: 'group' },
      { id: ALL, label: 'Lista de canais', icon: IC.list, kind: 'group' },
      { id: REC, label: 'Gravações', icon: IC.rec, kind: 'group' },
      { id: 'now', label: 'Agora na TV', icon: IC.mosaic, kind: 'now' },
      { id: 'guide', label: 'Guia de 7 dias', icon: IC.grid, kind: 'guide' },
      ...sections.map((s) => ({ id: s.id, label: s.name, kind: 'group' as const, lock: /adult|\+18|xxx/i.test(s.name) })),
    ],
    [sections],
  );

  // Grupo inicial: o mesmo escolhido na tela Ao vivo.
  const [group, setGroup] = useState<string>(() => {
    const g = prefGet<string>('live.cat', ALL);
    return g === FAV || g === ALL || g === REC || sections.some((s) => s.id === g) ? g : ALL;
  });
  const [view, setView] = useState<'group' | 'search' | 'agenda'>('group');
  const [query, setQuery] = useState('');
  const [col, setCol] = useState<Col>('list');
  const [mi, setMi] = useState(() => Math.max(0, menu.findIndex((m) => m.id === group)));
  const [, force] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  const channels = useMemo(() => {
    if (view === 'search') {
      const q = normalizeText(query.trim());
      if (!q) return [];
      const num = /^\d+$/.test(q) ? Number(q) : NaN;
      return live.filter((c) => c.number === num || normalizeText(c.fullName ?? c.name).includes(q));
    }
    if (group === FAV) return live.filter((c) => isFav(c));
    if (group === ALL) return live;
    if (group === REC) return live.filter(canCatchup);
    return sectionChannels(group, live, secData);
  }, [view, query, group, live, secData, isFav]);
  const agenda = useMemo(() => (view === 'agenda' ? [...reminders()].sort((a, b) => a.start - b.start) : []), [view, col]); // eslint-disable-line react-hooks/exhaustive-deps

  const [idx, setIdx] = useState(0);
  // Ao trocar de grupo: começa no canal que está passando (se estiver nele).
  useEffect(() => {
    const i = current ? channels.findIndex((c) => c.id === current.id) : -1;
    setIdx(Math.max(0, i));
  }, [group, view]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (idx >= Math.max(1, view === 'agenda' ? agenda.length : channels.length)) setIdx(0);
  }, [channels.length, agenda.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    root.current?.focus();
  }, []);
  // Menu lateral: rola para o grupo escolhido ficar sempre à vista (lista de grupos longa).
  useEffect(() => {
    const box = railRef.current;
    if (!box) return;
    if (col !== 'menu') {
      box.scrollTop = 0;
      return;
    }
    const el = box.querySelector<HTMLElement>('.flist-mi.sel');
    if (!el) return;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (top < box.scrollTop + 60) box.scrollTop = Math.max(0, top - 60);
    else if (bottom > box.scrollTop + box.clientHeight - 60) box.scrollTop = bottom - box.clientHeight + 60;
  }, [mi, col]);

  const count = view === 'agenda' ? agenda.length : channels.length;
  const title = view === 'search' ? 'Buscar' : view === 'agenda' ? 'Agendar programação' : group === FAV ? 'Favoritos' : group === ALL ? 'Lista de canais' : group === REC ? 'Gravações' : sections.find((s) => s.id === group)?.name ?? '';

  const chooseMenu = (i: number, enter: boolean) => {
    const it = menu[i];
    setMi(i);
    if (it.kind === 'group') {
      setView('group');
      setGroup(it.id);
      if (enter) setCol('list');
    } else if (it.kind === 'agenda') {
      setView('agenda');
      if (enter) setCol('list');
    } else if (it.kind === 'now') {
      if (enter) onOpenNow?.(channels.length ? channels : live, title);
    } else if (it.kind === 'guide') {
      if (enter) onOpenGuide?.(channels.length ? channels : live, Math.max(0, idx));
    } else if (it.kind === 'search') {
      setView('search');
      if (enter) {
        setCol('list');
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    }
  };
  const pick = (i: number) => {
    if (view === 'agenda') {
      const r = agenda[i];
      if (!r) return;
      const c = live.find((x) => x.id === r.channelId);
      if (r.start <= Date.now() + 5 * 60000 && c) onPick(c, channels.length ? channels : live);
      else {
        // Programa futuro: OK cancela o lembrete.
        toggleReminder({ key: r.key, title: r.title, league: '', start: r.start, end: r.start, channels: c ? [c] : [] });
        force((x) => x + 1);
        setView('agenda');
      }
      return;
    }
    const c = channels[i];
    if (c) onPick(c, channels);
  };

  // Teclas (antes da navegação geral e do player).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('.modal-back')) return;
      if (col === 'sched') return; // o painel de programação cuida das teclas
      const inSearch = document.activeElement === searchRef.current;
      const d = dirOf(e);
      let handled = true;
      if (inSearch) {
        if (d === 'down' || isEnter(e)) {
          searchRef.current?.blur();
          root.current?.focus();
        } else if (isBack(e)) {
          searchRef.current?.blur();
          root.current?.focus();
          setCol('menu');
        } else return; // digitação normal
      } else if (col === 'menu') {
        if (d === 'up') chooseMenu(Math.max(0, mi - 1), false);
        else if (d === 'down') chooseMenu(Math.min(menu.length - 1, mi + 1), false);
        else if (d === 'right' || isEnter(e)) chooseMenu(mi, true);
        else if (isBack(e)) setCol('list');
        else if (d === 'left') {
          /* já na borda */
        } else handled = false;
      } else {
        if (d === 'up') {
          if (idx > 0) setIdx(idx - 1);
          else if (view === 'search') searchRef.current?.focus();
        } else if (d === 'down') setIdx(Math.min(count - 1, idx + 1));
        else if (e.keyCode === KEY.CH_UP) setIdx(Math.max(0, idx - 10));
        else if (e.keyCode === KEY.CH_DOWN) setIdx(Math.min(count - 1, idx + 10));
        else if (d === 'left') setCol('menu');
        else if (d === 'right') {
          if (view !== 'agenda' && channels[idx]) setCol('sched');
        } else if (isEnter(e)) pick(idx);
        else if (isBack(e)) onClose();
        else handled = false;
      }
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  // Janela de linhas visíveis (lista grande na TV).
  const ROW = mobile ? 50 : 46;
  const visible = Math.max(5, Math.floor((L.H - 130) / ROW));
  const first = Math.max(0, Math.min(idx - Math.floor(visible / 2), count - visible));
  const expanded = col === 'menu';
  const railW = expanded ? (mobile ? 200 : 250) : mobile ? 48 : 60;
  const listW = mobile ? Math.min(330, L.W - railW - 8) : 400;
  const pad = L.safeY;

  return (
    <div ref={root} className={'flist' + (expanded ? ' open' : '') + (variant === 'prisma' ? ' prisma' : '')} tabIndex={-1} data-nav-scope="" style={{ paddingTop: pad, paddingBottom: pad }} onClick={(e) => e.stopPropagation()}>
      <div className="flist-rail" style={{ width: railW }}>
        <div className="flist-rail-in" ref={railRef}>
          {menu.slice(0, expanded ? menu.length : 7).map((m, i) => (
            <button
              key={m.id}
              className={'flist-mi' + (i === mi && expanded ? ' sel' : '') + ((m.kind === 'group' && view === 'group' && group === m.id) || (m.kind !== 'group' && view === m.kind) ? ' on' : '') + (m.icon ? '' : ' grp')}
              onClick={() => {
                if (!expanded) {
                  setCol('menu');
                  setMi(i);
                } else chooseMenu(i, true);
                root.current?.focus();
              }}
              title={m.label}
            >
              {m.icon ? <span className="flist-mi-ic">{m.icon}</span> : null}
              {expanded && <span className="flist-mi-t">{m.label}</span>}
              {expanded && m.lock && <span className="flist-mi-lock" aria-hidden="true">🔒</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="flist-list" style={{ width: listW }}>
        <div className="flist-head">{title}</div>
        {view === 'search' && (
          <div className="flist-search">
            <input ref={searchRef} value={query} placeholder="Nome ou número do canal" onChange={(e) => setQuery(e.target.value)} aria-label="Buscar canal" />
          </div>
        )}
        <div className="flist-rows" style={{ height: visible * ROW }}>
          {view === 'agenda'
            ? agenda.slice(first, first + visible).map((r, k) => {
                const i = first + k;
                return (
                  <div key={r.key} className={'flist-row' + (i === idx && col === 'list' ? ' sel' : '')} style={{ height: ROW }} onClick={() => { setIdx(i); pick(i); }}>
                    <span className="flist-ag-time">{new Date(r.start).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} {fmtTime(r.start)}</span>
                    <span className="flist-name">{r.title}</span>
                  </div>
                );
              })
            : channels.slice(first, first + visible).map((c, k) => {
                const i = first + k;
                const playing = current?.id === c.id;
                return (
                  <div
                    key={c.id}
                    className={'flist-row' + (i === idx && col !== 'menu' ? ' sel' : '') + (playing ? ' playing' : '')}
                    style={{ height: ROW }}
                    onClick={() => {
                      setIdx(i);
                      setCol('list');
                      pick(i);
                    }}
                  >
                    <ChannelLogo ch={c} size={mobile ? 30 : 32} />
                    <span className="flist-num">{c.number ?? ''}</span>
                    <span className="flist-name">
                      {playing ? '▶ ' : ''}
                      {c.name}
                    </span>
                    {isFav(c) && <span className="flist-ic fav" aria-label="Favorito">♥</span>}
                    {canCatchup(c) && <span className="flist-ic" aria-label="Tem gravação">⟲</span>}
                  </div>
                );
              })}
          {count === 0 && (
            <div className="flist-empty">
              {view === 'search' ? (query ? 'Nenhum canal encontrado.' : 'Digite o nome ou o número do canal.') : view === 'agenda' ? 'Nenhum programa agendado. Na programação (▶ num canal), OK num programa futuro agenda o aviso.' : group === FAV ? 'Nenhum favorito ainda.' : 'Nenhum canal aqui.'}
            </div>
          )}
        </div>
        <div className="flist-hint">
          {col === 'menu' ? '▲▼ escolher · ▶ voltar para os canais' : view === 'agenda' ? 'OK: assistir (se já começou) ou cancelar o aviso · ◀ grupos' : '◀ grupos · ▶ programação · OK assistir · Voltar fecha'}
        </div>
      </div>
      {col === 'sched' && channels[idx] && (
        <SchedulePanel
          playlist={playlist}
          channel={channels[idx]}
          rect={{ left: railW + listW + 10, top: 16 + pad, right: 16, bottom: 16 + pad }}
          onClose={() => {
            setCol('list');
            requestAnimationFrame(() => root.current?.focus());
          }}
          onWatch={(c) => onPick(c, channels)}
          onPlayVod={onPlayVod}
        />
      )}
    </div>
  );
}
