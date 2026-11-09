import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Engine } from '../core/engine';
import { isLocked } from '../core/parental';
import { IS_ANDROID } from '../core/platform';
import type { Channel, EpgEntry } from '../core/types';
import { Modal } from '../ui/Dialog';
import { ChannelLogo, fmtTime, useLogo } from '../ui/bits';
import { progressOf } from '../core/epg';

// Barra do canal "clássica" (tela cheia), no visual dos receptores de IPTV:
// logo grande à esquerda; número e nome; Atual / próximo; data; linha do
// programa com o horário; dicas de teclas e uma fileira de funções com ◀ ▶.

// ---------- Ícones (traço, cor do texto) ----------
const sv = (d: ReactNode) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);
export const BarIcon = {
  pip: sv(<><rect x="2.5" y="4" width="19" height="15" rx="2" /><rect x="11.5" y="11" width="8" height="6" rx="1" fill="currentColor" stroke="none" /></>),
  hd: (
    <svg width="26" height="24" viewBox="0 0 26 24" aria-hidden="true">
      <rect x="1.5" y="5" width="23" height="14" rx="3" fill="currentColor" />
      <text x="13" y="16.2" textAnchor="middle" fontSize="10" fontWeight="900" fontStyle="italic" className="hd-t" style={{ fontFamily: 'Arial, sans-serif' }}>HD</text>
    </svg>
  ),
  last: sv(<><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>),
  aspect: sv(<><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M7 9V8h2M17 9V8h-2M7 15v1h2M17 15v1h-2" /></>),
  heart: (on: boolean) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20s-7.5-4.6-9.2-9.1C1.7 7.8 3.7 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.3 0 5.3 3.3 4.2 6.4C19.5 15.4 12 20 12 20z" />
    </svg>
  ),
  lock: (on: boolean) => sv(<><rect x="5" y="10.5" width="14" height="10" rx="2" fill={on ? 'currentColor' : 'none'} /><path d={on ? 'M8 10.5V7.5a4 4 0 0 1 8 0v3' : 'M8 10.5V7.5a4 4 0 0 1 7.6-1.7'} /></>),
  audio: sv(<><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M7 13.5h4M13 13.5h4M7 10h10" /></>),
  hide: sv(<><path d="M3 12s3.5-6.5 9-6.5S21 12 21 12s-3.5 6.5-9 6.5S3 12 3 12z" /><circle cx="12" cy="12" r="2.6" /><path d="M4 20 20 4" /></>),
  folder: sv(<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />),
  list: sv(<><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1" fill="currentColor" /><circle cx="3.5" cy="12" r="1" fill="currentColor" /><circle cx="3.5" cy="18" r="1" fill="currentColor" /></>),
  up: sv(<path d="m6 15 6-6 6 6" />),
  down: sv(<path d="m6 9 6 6 6-6" />),
  cloud: (
    <svg width="20" height="16" viewBox="0 0 24 18" fill="currentColor" aria-hidden="true">
      <path d="M19 7.5A7 7 0 0 0 5.6 6 5.5 5.5 0 0 0 6 17h12.5a4.75 4.75 0 0 0 .5-9.5z" />
      <path d="M12 6.5v7M9 10.5l3 3 3-3" stroke="#3a3f4a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  ),
};

export interface BarAction {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  /** Menu que abre acima do ícone (PIP, HD, Adicionar…). */
  menu?: ReactNode;
}

/** Logo grande sem moldura (como no receptor); sem imagem, usa o selo do canal. */
function BigLogo({ ch, mobile }: { ch: Channel; mobile: boolean }) {
  const { src, onError } = useLogo(ch);
  const w = mobile ? 64 : 150;
  const h = mobile ? 48 : 96;
  return (
    <div className="cbar-logo" style={{ width: w, height: h }}>
      {src ? <img src={src} onError={onError} alt="" style={{ maxWidth: w, maxHeight: h }} /> : <ChannelLogo ch={ch} size={Math.min(w, h)} />}
    </div>
  );
}

function fmtDate(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function ClassicBar(props: {
  channel: Channel;
  cur?: EpgEntry;
  next?: EpgEntry;
  now: number;
  quality?: string;
  fitLabel: string;
  actions: BarAction[];
  openMenu: string | null;
  mobile: boolean;
  padX: number;
  padB: number;
  onInfo: () => void;
  infoOpen: boolean;
  barRef: React.RefObject<HTMLDivElement>;
  /** Celular em pé: ícones numa fileira própria embaixo. */
  stack?: boolean;
}) {
  const { channel, cur, next, now, quality, fitLabel, actions, openMenu, mobile, padX, padB, onInfo, infoOpen, barRef, stack = mobile } = props;
  const range = cur ? `${fmtTime(cur.start)}-${fmtTime(cur.end)}` : '00:00-23:59';
  const pct = cur ? progressOf(cur, now) * 100 : 0;
  const icons = (
    <div className="cbar-icons">
      {actions.map((a) => (
        <div key={a.id} className="cbar-ic-wrap">
          <button className={'cbar-ic' + (openMenu === a.id ? ' open' : '')} data-nav="" aria-label={a.label} title={a.label} onClick={a.onClick} data-ic={a.id}>
            {a.icon}
            <span className="cbar-ic-lbl">{a.label}</span>
          </button>
          {openMenu === a.id && a.menu}
        </div>
      ))}
    </div>
  );
  return (
    <div ref={barRef} className={'cbar' + (mobile ? ' m' : '') + (mobile && !stack ? ' ml' : '')} style={{ paddingLeft: padX, paddingRight: padX, paddingBottom: padB }}>
      {infoOpen && (
        <div className="cbar-info">
          <span className="cbar-info-t">{cur ? cur.title : channel.name}</span>
          <span className="cbar-info-h">{cur ? `${fmtTime(cur.start)} – ${fmtTime(cur.end)} · ${channel.group}` : channel.group}</span>
          <span className="cbar-info-d">{cur?.description || 'Sem descrição no guia de programação.'}</span>
          {next && <span className="cbar-info-h" style={{ marginTop: 10 }}>Depois, às {fmtTime(next.start)}: {next.title}</span>}
        </div>
      )}
      <div className="cbar-row">
        <BigLogo ch={channel} mobile={mobile} />
        <div className="cbar-main">
          <div className="cbar-l1">
            <span className="cbar-num">{channel.number || ''}</span>
            <span className="cbar-name">{channel.name}</span>
            {!mobile && <span className="cbar-date">{fmtDate(now)}</span>}
          </div>
          <div className="cbar-l2">
            <span className="cbar-atual">
              <span className="cbar-k">Atual:</span> {cur?.title ?? ''}
            </span>
            {!mobile && (
              <span className="cbar-prox">
                <span className="cbar-k2">próximo:</span> {next ? `${fmtTime(next.start)} ${next.title}` : ''}
              </span>
            )}
          </div>
          <div className="cbar-l3">
            <div className="cbar-line"><div style={{ width: pct + '%' }} /></div>
            <span className="cbar-time">{range}</span>
          </div>
          <div className="cbar-l4">
            {!mobile && (
              <>
                <button className="cbar-hint-btn" onClick={onInfo} aria-pressed={infoOpen}>
                  <span className="cbar-key">Menu</span> info
                </button>
                {quality && <span className="cbar-tag">{quality}</span>}
                <span className="cbar-tag">{fitLabel}</span>
                <span className="cbar-arrows"><span>◀</span><span>▶</span></span>
                <span className="cbar-hint">Seleção de funções</span>
              </>
            )}
            <div style={{ flexGrow: 1 }} />
            {!stack && icons}
          </div>
        </div>
      </div>
      {stack && icons}
    </div>
  );
}

/** Relógio e velocidade (canto superior direito). */
export function BarTop({ now, speed, padX, padT }: { now: number; speed?: number; padX: number; padT: number }) {
  const sp = speed === undefined ? '' : speed >= 1024 ? `${(speed / 1024).toFixed(speed >= 10240 ? 0 : 1)}MB/S` : `${Math.round(speed)}KB/S`;
  return (
    <div className="cbar-top" style={{ right: padX, top: padT }}>
      <span className="cbar-clock">{fmtTime(now)}</span>
      {sp && (
        <span className="cbar-speed">
          {BarIcon.cloud} {sp}
        </span>
      )}
    </div>
  );
}

/** Menu que abre acima de um ícone da barra. */
export function BarMenu({ children }: { children: ReactNode }) {
  return (
    <div className="cbar-pop" data-nav-scope="" role="menu">
      {children}
    </div>
  );
}
export function MenuItem({ children, onClick, on, def }: { children: ReactNode; onClick: () => void; on?: boolean; def?: boolean }) {
  return (
    <button className={'cbar-pop-it' + (on ? ' on' : '')} data-nav="" data-nav-default={def ? '' : undefined} role="menuitem" onClick={onClick}>
      {children}
    </button>
  );
}
/** Linha "Desl [chave] Lig". */
export function MenuToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button className="cbar-pop-it cbar-tg-row" data-nav="" role="menuitemcheckbox" aria-checked={on} onClick={onClick}>
      <span>Desl</span>
      <span className={'cbar-tg' + (on ? ' on' : '')}><span /></span>
      <span>Lig</span>
    </button>
  );
}

// ---------- Janela PIP ----------

/** Posição da janela pelo número (0 embaixo à direita, 1 em cima à direita, 2 em cima à esquerda). */
export function pipSlotStyle(slot: number, o: { w: number; side: number; top: number; bottom: number | string }): React.CSSProperties {
  const s: React.CSSProperties = { width: o.w + '%' };
  if (slot === 0 || slot === 1) s.right = o.side;
  else s.left = o.side;
  if (slot === 0) s.bottom = o.bottom;
  else s.top = o.top;
  return s;
}

export function PipWindow({ ch, style, small, selected, onSwap, onClose }: { ch: Channel; style: React.CSSProperties; small: boolean; selected?: boolean; onSwap: () => void; onClose: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [st, setSt] = useState<'loading' | 'playing' | 'error' | 'locked'>('loading');
  const [urlIdx, setUrlIdx] = useState(0);
  const urls = [ch.url, ...(ch.altUrls ?? [])].filter(Boolean);
  useEffect(() => {
    if (isLocked(ch.id)) {
      setSt('locked');
      return;
    }
    const v = ref.current!;
    v.muted = true; // som só da tela principal
    setSt('loading');
    const e = new Engine(v, (ev) => {
      if (ev.type === 'playing') setSt('playing');
      else if (ev.type === 'error') {
        if (urlIdx + 1 < urls.length) setUrlIdx(urlIdx + 1);
        else setSt('error');
      }
    });
    const u = urls[urlIdx];
    e.play(u, ch, 0, IS_ANDROID && !/\.ts(\?|$)/i.test(u));
    return () => e.destroy();
  }, [ch.id, urlIdx]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={'pip' + (small ? ' small' : '') + (selected ? ' sel' : '')} style={style} onClick={onSwap} title="Trocar com a tela principal">
      <video ref={ref} playsInline autoPlay muted />
      <span className="pip-lbl">
        {ch.number ? ch.number + ' ' : ''}
        {ch.name}
      </span>
      {st === 'loading' && <div className="pip-st"><div className="spinner" style={{ width: 26, height: 26 }} /></div>}
      {st === 'error' && <div className="pip-st">Sem sinal</div>}
      {st === 'locked' && <div className="pip-st">🔒 Bloqueado</div>}
      <button
        className="pip-x"
        aria-label={`Fechar janela ${ch.name}`}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        ✕
      </button>
    </div>
  );
}

// ---------- Senha (bloquear canal) ----------
export function PinDialog({ title, help, onSubmit, onClose }: { title: string; help: string; onSubmit: (pin: string) => string | null; onClose: () => void }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => {
    requestAnimationFrame(() => inp.current?.focus());
  }, []);
  const submit = () => {
    if (!/^\d{4}$/.test(pin)) return setErr('A senha tem 4 números.');
    const e = onSubmit(pin);
    if (e) {
      setErr(e);
      setPin('');
    }
  };
  return (
    <Modal title={title} onClose={onClose} width={460}>
      <span className="muted" style={{ fontSize: 15, lineHeight: 1.4 }}>{help}</span>
      <div className="field">
        <input
          ref={inp}
          data-nav=""
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          aria-label="Senha de 4 números"
          onChange={(e) => {
            setErr('');
            setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.keyCode === 13) submit();
          }}
          style={{ fontSize: 28, letterSpacing: 12, textAlign: 'center' }}
        />
      </div>
      {err && <span style={{ color: '#FF6B3D', fontSize: 15, fontWeight: 700 }}>{err}</span>}
      <div className="wrap-row" style={{ display: 'flex' }}>
        <button className="btn primary" data-nav="" onClick={submit}>Confirmar</button>
        <button className="btn" data-nav="" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  );
}
