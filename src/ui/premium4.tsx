import { useEffect, useRef, useState } from 'react';

// Visual premium IV (0.23.0): capa que cresce até virar o detalhe, "Ainda está assistindo?",
// faixa "Dia de jogo" no Início.

const isLite = () => document.documentElement.classList.contains('lite');

// ---------------------------------------------------------------- Capa → detalhe

let origin: { r: { left: number; top: number; width: number; height: number }; img?: string; bg: string; t: number } | null = null;

// OK/clique numa capa: guarda onde ela estava. O detalhe que abrir logo em seguida
// começa desse retângulo e cresce até a tela inteira.
if (typeof document !== 'undefined') {
  document.addEventListener(
    'click',
    (e) => {
      const t = e.target as HTMLElement | null;
      const btn = t && t.closest ? (t.closest('button') as HTMLElement | null) : null;
      const art = btn ? (btn.querySelector('.poster-art') as HTMLElement | null) : null;
      if (!art) return;
      const r = art.getBoundingClientRect();
      if (!r.width) return;
      const img = art.querySelector('img') as HTMLImageElement | null;
      origin = { r: { left: r.left, top: r.top, width: r.width, height: r.height }, img: img && img.complete && img.naturalWidth ? img.src : undefined, bg: art.style.background, t: Date.now() };
    },
    true,
  );
}

/** Camada que sai da capa clicada e cresce até cobrir a tela, revelando o detalhe por baixo. */
export function ZoomFrom() {
  const [o] = useState(() => (origin && Date.now() - origin.t < 900 && !isLite() ? origin : null));
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    origin = null;
    if (!o) return;
    const a = requestAnimationFrame(() => requestAnimationFrame(() => setPhase(1)));
    const b = setTimeout(() => setPhase(2), 430);
    const c = setTimeout(() => setPhase(3), 800);
    return () => {
      cancelAnimationFrame(a);
      clearTimeout(b);
      clearTimeout(c);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!o || phase === 3) return null;
  const full = phase >= 1;
  return (
    <div
      className={'zoom-from' + (phase === 2 ? ' out' : '')}
      aria-hidden="true"
      style={
        full
          ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight, borderRadius: 0, background: o.bg || '#111' }
          : { left: o.r.left, top: o.r.top, width: o.r.width, height: o.r.height, background: o.bg || '#111' }
      }
    >
      {o.img && <img src={o.img} alt="" referrerPolicy="no-referrer" />}
    </div>
  );
}

// ---------------------------------------------------------------- Ainda está assistindo?

/** Card depois de vários episódios seguidos sem mexer no controle. */
export function StillWatching({ title, poster, onContinue, onStop }: { title: string; poster?: string; onContinue: () => void; onStop: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const b = box.current?.querySelector<HTMLElement>('[data-nav-default]');
    b?.focus();
  }, []);
  return (
    <div className="still" ref={box} data-nav-scope="">
      {poster && <img className="still-bg" src={poster} alt="" referrerPolicy="no-referrer" />}
      <div className="still-shade" />
      <div className="still-card">
        {poster && <img className="still-poster" src={poster} alt="" referrerPolicy="no-referrer" />}
        <div className="still-txt">
          <span className="paused-tag">Pausado</span>
          <b className="still-q">Ainda está assistindo?</b>
          <span className="still-sub">{title}</span>
          <div className="still-btns">
            <button className="btn primary" data-nav="" data-nav-default="" onClick={onContinue}>▶ Continuar</button>
            <button className="btn" data-nav="" onClick={onStop}>Parar por hoje</button>
          </div>
        </div>
      </div>
    </div>
  );
}
