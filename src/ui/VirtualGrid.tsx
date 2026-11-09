import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { KEY, dirOf, focusEl, isEnter } from './nav';

// Grade de capas que só desenha as fileiras visíveis (milhares de títulos).
// Um único ponto de foco: as setas andam dentro da grade; na borda esquerda
// e no alto, saem para a navegação espacial (categorias à esquerda, busca ou
// carrosséis em cima); à direita e embaixo, ficam paradas.

interface Props<T> {
  items: T[];
  index: number;
  onIndex: (i: number) => void;
  onPick: (item: T, i: number) => void;
  render: (item: T, i: number, selected: boolean, w: number) => ReactNode;
  minCellW: number;
  /** altura = largura × ratio + extra (título embaixo) */
  ratio: number;
  extraH?: number;
  gap?: number;
  empty?: ReactNode;
  label?: string;
}

export interface VirtualGridHandle {
  focus: () => void;
}

function GridInner<T>({ items, index, onIndex, onPick, render, minCellW, ratio, extraH = 0, gap = 16, empty, label }: Props<T>, ref: React.Ref<VirtualGridHandle>) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });
  const [top, setTop] = useState(0);
  useImperativeHandle(ref, () => ({ focus: () => focusEl(box.current) }));

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth || 800, h: el.clientHeight || 500 });
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const pad = 10; // folga para o card em foco crescer
  const inner = size.w - pad * 2;
  const cols = Math.max(1, Math.floor((inner + gap) / (minCellW + gap)));
  const cellW = Math.floor((inner - gap * (cols - 1)) / cols);
  const cellH = Math.round(cellW * ratio + extraH);
  const step = cellH + gap;
  const rows = Math.ceil(items.length / cols);
  const maxTop = Math.max(0, rows * step - gap + pad * 2 - size.h);

  // mantém a fileira selecionada à vista
  useEffect(() => {
    const r = Math.floor(index / cols);
    const y = r * step + pad;
    // Fileira em foco sempre inteira e alinhada no alto (sem a de cima cortada pela metade).
    if (y < top + pad || y + cellH > top + size.h - pad) setTop(Math.max(0, Math.min(maxTop, y - pad)));
  }, [index, cols, step, size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = Math.min(top, maxTop);
  const firstRow = Math.max(0, Math.floor((t - pad) / step) - 1);
  const lastRow = Math.min(rows - 1, Math.ceil((t + size.h) / step) + 1);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const d = dirOf(e);
    const col = index % cols;
    let next = -1;
    if (d === 'left' && col > 0) next = index - 1;
    else if (d === 'right' && col < cols - 1 && index < items.length - 1) next = index + 1;
    else if (d === 'up' && index - cols >= 0) next = index - cols;
    else if (d === 'down' && index + cols < items.length) next = index + cols;
    else if (d === 'down' && Math.floor(index / cols) < rows - 1) next = items.length - 1;
    else if (e.keyCode === KEY.CH_DOWN) next = Math.min(items.length - 1, index + cols * 3);
    else if (e.keyCode === KEY.CH_UP) next = Math.max(0, index - cols * 3);
    else if (isEnter(e) && items[index]) {
      e.preventDefault();
      onPick(items[index], index);
      return;
    }
    if (next >= 0) {
      e.preventDefault();
      onIndex(next);
    } else if (d === 'right' || d === 'down') {
      // Na última capa / última fileira: fica parado (não "escapa" para botões ou para a coluna).
      // Só ◀ (1ª coluna) e ▲ (1ª fileira) saem da grade.
      e.preventDefault();
    }
  };

  const touch = useRef<{ y: number; top: number; moved: boolean } | null>(null);

  const cells: ReactNode[] = [];
  for (let r = firstRow; r <= lastRow; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (i >= items.length) break;
      cells.push(
        <div
          key={i}
          className={'gcell' + (i === index ? ' sel' : '')}
          style={{ left: pad + c * (cellW + gap), top: pad + r * step - t, width: cellW, height: cellH }}
          onClick={() => {
            if (touch.current?.moved) return;
            onIndex(i);
            onPick(items[i], i);
          }}
        >
          {render(items[i], i, i === index, cellW)}
        </div>,
      );
    }
  }

  return (
    <div
      ref={box}
      className="vgrid"
      tabIndex={0}
      data-nav=""
      aria-label={label}
      onKeyDown={onKeyDown}
      onWheel={(e) => setTop((v) => Math.max(0, Math.min(maxTop, v + e.deltaY)))}
      onTouchStart={(e) => (touch.current = { y: e.touches[0].clientY, top: t, moved: false })}
      onTouchMove={(e) => {
        const st = touch.current;
        if (!st || !box.current) return;
        const k = box.current.getBoundingClientRect().height / (box.current.clientHeight || 1) || 1;
        const dy = (st.y - e.touches[0].clientY) / k;
        if (Math.abs(dy) > 6) st.moved = true;
        setTop(Math.max(0, Math.min(maxTop, st.top + dy)));
      }}
    >
      {items.length ? cells : empty}
    </div>
  );
}

export const VirtualGrid = forwardRef(GridInner) as <T>(p: Props<T> & { ref?: React.Ref<VirtualGridHandle> }) => ReturnType<typeof GridInner>;
