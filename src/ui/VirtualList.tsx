import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { KEY, dirOf, isEnter } from './nav';

// Lista que só desenha as linhas visíveis: aguenta listas com milhares de
// canais na TV. É um único ponto de foco; cima/baixo andam dentro dela e
// esquerda/direita saem para a navegação espacial.

interface Props<T> {
  items: T[];
  index: number;
  onIndex: (i: number) => void;
  onPick: (item: T, i: number) => void;
  render: (item: T, i: number, selected: boolean) => ReactNode;
  rowHeight?: number;
  gap?: number;
  empty?: ReactNode;
  navDefault?: boolean;
  label?: string;
}

export interface VirtualListHandle {
  focus: () => void;
}

function VirtualListInner<T>(
  { items, index, onIndex, onPick, render, rowHeight = 62, gap = 4, empty, navDefault, label }: Props<T>,
  ref: React.Ref<VirtualListHandle>,
) {
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(400);
  const [top, setTop] = useState(0);
  const step = rowHeight + gap;

  useImperativeHandle(ref, () => ({ focus: () => box.current?.focus({ preventScroll: true }) }));

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setHeight(el.clientHeight || 400);
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  // Mantém o item selecionado à vista, com uma linha de folga.
  useEffect(() => {
    const y = index * step;
    if (y < top + step && index > 0) setTop(Math.max(0, y - step));
    else if (index === 0) setTop(0);
    else if (y + rowHeight > top + height - step) setTop(y + rowHeight - height + step);
  }, [index, height]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxTop = Math.max(0, items.length * step - gap - height);
  const t = Math.min(top, maxTop);
  const first = Math.max(0, Math.floor(t / step) - 2);
  const last = Math.min(items.length - 1, Math.ceil((t + height) / step) + 2);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const d = dirOf(e);
    const pageRows = Math.max(1, Math.floor(height / step) - 1);
    if (d === 'up' && index > 0) {
      e.preventDefault();
      onIndex(index - 1);
    } else if (d === 'down' && index < items.length - 1) {
      e.preventDefault();
      onIndex(index + 1);
    } else if (e.keyCode === KEY.CH_UP && index > 0) {
      e.preventDefault();
      onIndex(Math.max(0, index - pageRows));
    } else if (e.keyCode === KEY.CH_DOWN && index < items.length - 1) {
      e.preventDefault();
      onIndex(Math.min(items.length - 1, index + pageRows));
    } else if (isEnter(e) && items[index]) {
      e.preventDefault();
      onPick(items[index], index);
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    setTop((v) => Math.max(0, Math.min(maxTop, v + e.deltaY)));
  };

  const rows: ReactNode[] = [];
  for (let i = first; i <= last; i++) {
    rows.push(
      <div
        key={i}
        className={'row' + (i === index ? ' sel' : '')}
        style={{ top: i * step - t, height: rowHeight }}
        onClick={() => {
          onIndex(i);
          onPick(items[i], i);
          box.current?.focus({ preventScroll: true });
        }}
      >
        {render(items[i], i, i === index)}
      </div>,
    );
  }

  return (
    <div
      ref={box}
      className="vlist"
      tabIndex={0}
      data-nav=""
      data-nav-default={navDefault ? '' : undefined}
      aria-label={label}
      role="listbox"
      onKeyDown={onKeyDown}
      onWheel={onWheel}
    >
      {items.length ? rows : empty}
    </div>
  );
}

export const VirtualList = forwardRef(VirtualListInner) as <T>(
  p: Props<T> & { ref?: React.Ref<VirtualListHandle> },
) => ReturnType<typeof VirtualListInner>;
