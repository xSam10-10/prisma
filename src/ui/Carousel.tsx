import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLayout } from './layout';

// Carrossel do Início: mostra só cards inteiros (calcula quantos cabem e
// estica para preencher a largura), no máximo 10 itens. Anda por:
//  · controle remoto: o foco passa do último visível → a fileira desliza;
//  · mouse: setas ‹ › ao lado do título;
//  · toque: arrastar para o lado.
// Toda fileira nova do Início deve usar este componente.

export const CAROUSEL_MAX = 10;

/** Título editorial: "Top 10 Netflix" → **Top 10** Netflix; "Porque você assistiu X" → Porque você assistiu **X**. */
function editorial(t: string): ReactNode {
  const top = t.match(/^(Top 10)\s+(.+)$/);
  if (top) return (<><b>{top[1]}</b> <span className="t-light">{top[2]}</span></>);
  const because = t.match(/^(Porque você assistiu)\s+(.+)$/);
  if (because) return (<><span className="t-light">{because[1]}</span> <b>{because[2]}</b></>);
  return t;
}

/**
 * Ao focar um card, rola a página (contêiner .scroll-y mais próximo) até a
 * fileira INTEIRA aparecer — título e card já crescido pelo foco —, para nada
 * ficar cortado em cima ou embaixo, descendo ou subindo.
 */
export function revealSection(item: HTMLElement) {
  let sec: HTMLElement | null = item;
  while (sec && !(sec.classList && sec.classList.contains('carousel'))) sec = sec.parentElement;
  let p = sec ? sec.parentElement : null;
  while (p && !(p.classList.contains('scroll-y') || p.classList.contains('stage'))) p = p.parentElement;
  if (!sec || !p || !p.classList.contains('scroll-y')) return;
  const sr = sec.getBoundingClientRect();
  const pr = p.getBoundingClientRect();
  const k = pr.height / (p.clientHeight || pr.height) || 1; // escala do palco
  const m = 10;
  if (sr.top < pr.top + m) p.scrollTop -= (pr.top + m - sr.top) / k;
  else if (sr.bottom > pr.bottom - m) p.scrollTop += Math.min(sr.bottom - pr.bottom + m, sr.top - pr.top - m) / k;
}

interface Props<T> {
  title: string;
  /** Linha menor ao lado do título (ex.: de onde vem a lista). */
  subtitle?: string;
  items: T[];
  keyOf: (item: T) => string;
  render: (item: T, index: number, width: number) => ReactNode;
  /** Largura mínima de cada card (unidades de projeto). */
  minWidth?: number;
  empty?: ReactNode;
  /** Botão "Ver todos" no título: abre todos os itens (ex.: resultados da busca). */
  onAll?: () => void;
}

export function Carousel<T>({ title, subtitle, items, keyOf, render, minWidth, empty, onAll }: Props<T>) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const gap = mobile ? 14 : 22;
  const minW = minWidth ?? (mobile ? 150 : 250);
  const avail = L.W - L.px * 2;
  const list = items.slice(0, CAROUSEL_MAX);
  const perView = Math.max(1, Math.floor((avail + gap) / (minW + gap)));
  const itemW = Math.floor((avail - gap * (perView - 1)) / perView);
  const maxStart = Math.max(0, list.length - perView);
  const [start, setStart] = useState(0);
  const s = Math.min(start, maxStart);
  const pages = Math.ceil(list.length / perView);
  const page = Math.min(pages - 1, Math.round(s / perView));

  useEffect(() => {
    if (start > maxStart) setStart(maxStart);
  }, [start, maxStart]);

  const go = (d: number) => setStart((v) => Math.max(0, Math.min(maxStart, Math.min(v, maxStart) + d * perView)));

  // Arrastar com o dedo
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const t = touch.current;
    touch.current = null;
    if (!t) return;
    const dx = e.changedTouches[0].clientX - t.x;
    const dy = e.changedTouches[0].clientY - t.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  };

  const pad = mobile ? 10 : 14; // folga para o card em foco crescer sem ser cortado (menor que o espaço entre cards)
  return (
    <section className="carousel" style={{ marginTop: mobile ? 20 : 30 }}>
      <div className="carousel-head" style={{ padding: `0 ${L.px}px` }}>
        <span className="title" style={{ fontSize: mobile ? 19 : 24, flexShrink: 0 }}>{editorial(title)}</span>
        {subtitle && !mobile ? <span className="carousel-sub">{subtitle}</span> : null}
        <div className="spacer" />
        {onAll && pages > 1 && (
          <button className="see-all" data-nav="" onClick={onAll}>
            Ver todos · {items.length}
          </button>
        )}
        {pages > 1 && (
          <>
            <div className="dots" aria-hidden="true">
              {Array.from({ length: pages }, (_, i) => <i key={i} className={i === page ? 'on' : ''} />)}
            </div>
            {!mobile && (
              <>
                <button className="arrow-btn" tabIndex={-1} aria-label="Anteriores" disabled={s === 0} onClick={() => go(-1)}>‹</button>
                <button className="arrow-btn" tabIndex={-1} aria-label="Próximos" disabled={s >= maxStart} onClick={() => go(1)}>›</button>
              </>
            )}
          </>
        )}
      </div>
      {list.length ? (
        <div
          className="carousel-view"
          data-nav-row=""
          style={{ margin: `${mobile ? 6 : 10}px ${L.px - pad}px 0`, padding: pad }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onScroll={(e) => {
            // TVs antigas rolam o contêiner ao focar um card escondido; quem desloca é o trilho.
            const el = e.currentTarget;
            if (el.scrollLeft) el.scrollLeft = 0;
          }}
        >
          <div className="carousel-track" style={{ transform: `translateX(${-s * (itemW + gap)}px)`, WebkitTransform: `translateX(${-s * (itemW + gap)}px)` }}>
            {list.map((it, i) => (
              <div
                key={keyOf(it)}
                className="carousel-item"
                style={{ width: itemW, marginRight: i < list.length - 1 ? gap : 0 }}
                onFocus={(e) => {
                  revealSection(e.currentTarget);
                  // Foco foi para um card fora da vista: desliza até ele.
                  if (i < s) setStart(i);
                  else if (i >= s + perView) setStart(i - perView + 1);
                }}
              >
                {render(it, i, itemW)}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="muted" style={{ fontSize: 16, padding: `10px ${L.px}px 0` }}>{empty}</div>
      )}
    </section>
  );
}
