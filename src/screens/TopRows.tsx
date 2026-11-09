import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Channel } from '../core/types';
import type { Ranked } from '../core/tops';
import { logoUrl, type Streaming } from '../core/vod';
import { Carousel } from '../ui/Carousel';
import { LayoutContext, useLayout } from '../ui/layout';
import { rgba } from '../ui/bits';
import { focusFirst } from '../ui/nav';
import { PosterCard } from './Vod';

// Filmes/Séries › Top e streaming escolhido: as listas uma embaixo da outra,
// cada uma num carrossel (como no Início). A coluna da esquerda leva até a
// lista; descer com o controle alinha a lista em foco no alto (nada cortado).

export interface Row {
  id: string;
  title: string;
  src: string;
  items: Ranked[];
  /** Mostra a posição (1, 2, 3…) na capa. */
  ranked: boolean;
}

export interface StackedHandle {
  /** Rola até a lista (sem tirar o foco da coluna). */
  show: (id: string) => void;
  /** Rola e põe o foco na primeira capa da lista. */
  enter: (id: string) => void;
}

const PAD = 14; // folga lateral para a capa em foco crescer sem ser cortada

export const StackedRows = forwardRef<StackedHandle, {
  rows: Row[];
  width: number;
  banner?: React.ReactNode;
  /** Última seção, com a altura da tela (ex.: grade com todo o conteúdo do streaming). */
  tail?: React.ReactNode;
  onSeen?: (id: string) => void;
  onPick: (item: Channel) => void;
}>(function StackedRows({ rows, width, banner, tail, onSeen, onPick }, ref) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const box = useRef<HTMLDivElement>(null);
  const secs = useRef<Record<string, HTMLDivElement | null>>({});
  const tailRef = useRef<HTMLDivElement>(null);
  const [viewH, setViewH] = useState(600);
  useEffect(() => {
    const m = () => box.current && setViewH(box.current.clientHeight || 600);
    m();
    window.addEventListener('resize', m);
    return () => window.removeEventListener('resize', m);
  }, []);
  const scrollTo = (id: string) => {
    const b = box.current;
    const el = secs.current[id];
    if (!b || !el) return;
    // A primeira lista mantém o banner à vista; as outras sobem até o alto.
    b.scrollTop = rows[0]?.id === id ? 0 : Math.max(0, el.offsetTop - 4);
  };
  useImperativeHandle(ref, () => ({
    show: scrollTo,
    enter: (id) => {
      scrollTo(id);
      focusFirst(secs.current[id]);
    },
  }));
  // Carrossel calcula o tamanho pela "tela": aqui a tela é a coluna da direita.
  const inner = { ...L, W: width + PAD * 2, px: PAD };
  return (
    <div ref={box} className="scroll-y stacked" style={{ position: 'absolute', top: 0, bottom: 0, left: -PAD, width: width + PAD * 2, paddingTop: 4 }}>
      {banner && <div style={{ padding: `0 ${PAD}px` }}>{banner}</div>}
      <LayoutContext.Provider value={inner}>
        {rows.map((r) => (
          <div
            key={r.id}
            ref={(el) => {
              secs.current[r.id] = el;
            }}
            onFocus={() => {
              scrollTo(r.id);
              onSeen?.(r.id);
            }}
          >
            <Carousel
              title={r.title}
              subtitle={r.src}
              items={r.items}
              keyOf={(x) => x.item.id}
              minWidth={mobile ? 104 : 118}
              render={(x, _i, w) => (
                <button className="tile grow" data-nav="" style={{ width: w }} onClick={() => onPick(x.item)} aria-label={(r.ranked ? `${x.rank}º ` : '') + x.item.name}>
                  <PosterCard item={x.item} w={w} rank={r.ranked ? x.rank : undefined} />
                </button>
              )}
            />
          </div>
        ))}
        {tail ? (
          // A grade ocupa a tela inteira: ao entrar nela, a página encaixa no alto e a grade rola por dentro.
          <div
            ref={tailRef}
            style={{ height: viewH - 8, padding: `0 ${PAD}px` }}
            onFocus={() => {
              if (box.current && tailRef.current) box.current.scrollTop = tailRef.current.offsetTop - 4;
            }}
          >
            {tail}
          </div>
        ) : (
          <div style={{ height: mobile ? 40 : 220 }} />
        )}
      </LayoutContext.Provider>
    </div>
  );
});

// ---------------------------------------------------------------- Banner do streaming

type Motif = 'stripes' | 'glow' | 'arc' | 'rings';
const MOTIF: Record<string, Motif> = {
  netflix: 'stripes', lionsgate: 'stripes', amc: 'stripes',
  hbo: 'glow', apple: 'glow', star: 'glow', hulu: 'glow',
  disney: 'arc', prime: 'arc', paramount: 'arc', discovery: 'arc', directv: 'arc',
  globoplay: 'rings', crunchyroll: 'rings', funimation: 'rings', claro: 'rings', sbt: 'rings',
};

const TAGLINE: Record<string, string> = {
  netflix: 'O que o Brasil está maratonando agora',
  hbo: 'Grandes histórias, direto do HBO Max',
  disney: 'Magia, heróis e galáxias distantes',
  apple: 'Originais premiados da Apple',
  prime: 'O catálogo do Prime Video na sua tela',
  paramount: 'Uma montanha de entretenimento',
  globoplay: 'Novelas, séries e filmes brasileiros',
  crunchyroll: 'Os animes do momento',
  claro: 'Lançamentos e clássicos do Claro Vídeo',
};

function motifLayer(s: Streaming, m: Motif): React.ReactNode {
  if (m === 'stripes')
    return (
      <div
        className="sb-layer"
        style={{
          background: `repeating-linear-gradient(115deg, ${rgba(s.accent, 0.22)} 0px, ${rgba(s.accent, 0.22)} 16px, rgba(0,0,0,0) 16px, rgba(0,0,0,0) 54px)`,
          WebkitMaskImage: 'linear-gradient(to left, #000 0%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0) 75%)',
          maskImage: 'linear-gradient(to left, #000 0%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0) 75%)',
        }}
      />
    );
  if (m === 'rings')
    return <div className="sb-layer" style={{ background: `repeating-radial-gradient(circle at 82% 50%, ${rgba(s.accent, 0.24)} 0px, ${rgba(s.accent, 0.24)} 2px, rgba(0,0,0,0) 3px, rgba(0,0,0,0) 30px)`, opacity: 0.9 }} />;
  if (m === 'arc')
    return (
      <>
        <div className="sb-arc" style={{ borderColor: rgba('#FFFFFF', 0.55), boxShadow: `0 0 34px ${rgba(s.accent2, 0.9)}, 0 0 90px ${rgba(s.accent, 0.6)}, inset 0 0 60px ${rgba(s.accent2, 0.45)}` }} />
        <div className="sb-arc two" style={{ borderColor: rgba(s.accent2, 0.35) }} />
      </>
    );
  return <div className="sb-layer" style={{ background: `radial-gradient(ellipse 45% 90% at 78% 20%, ${rgba(s.accent, 0.6)} 0%, rgba(0,0,0,0) 70%), radial-gradient(ellipse 40% 80% at 96% 95%, ${rgba(s.accent2, 0.55)} 0%, rgba(0,0,0,0) 70%)` }} />;
}

/** Faixa do streaming escolhido: cores da marca, desenho próprio, logotipo em marca-d'água e brilho passando. */
export function StreamBanner({ s, count, kindLabel, top, genres }: { s: Streaming; count: number; kindLabel: string; top: boolean; genres: number }) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const motif = MOTIF[s.id] ?? 'glow';
  const h = mobile ? 132 : 196;
  const logoH = mobile ? 38 : 62;
  const logoW = s.logo ? Math.min(mobile ? 200 : 360, Math.round((logoH * s.logo.w) / s.logo.h)) : 0;
  return (
    <div
      className="sbanner"
      style={{
        height: h,
        background: `radial-gradient(ellipse 55% 120% at 100% 0%, ${rgba(s.accent, 0.45)} 0%, rgba(0,0,0,0) 70%), linear-gradient(110deg, ${s.bg} 0%, ${s.bg} 38%, ${rgba(s.accent2, 0.9)} 100%)`,
      }}
    >
      {motifLayer(s, motif)}
      <div className="sb-aurora" style={{ background: `radial-gradient(circle, ${rgba(s.accent, 0.55)} 0%, rgba(0,0,0,0) 65%)` }} />
      {s.logo && <img className="sb-water" src={logoUrl(s.id, 'mono')} alt="" aria-hidden="true" draggable={false} />}
      <div className="sb-sweep" />
      <div className="sb-edge" style={{ background: `linear-gradient(90deg, rgba(0,0,0,0) 0%, ${s.accent} 35%, ${s.accent2} 70%, rgba(0,0,0,0) 100%)` }} />
      <div className="sb-content" style={{ padding: mobile ? '0 20px' : '0 44px' }}>
        {s.logo ? (
          <img className="sb-logo" src={logoUrl(s.id, 'color')} alt={s.name} style={{ height: logoH, width: logoW }} draggable={false} />
        ) : (
          <span className="title" style={{ fontSize: mobile ? 30 : 46, fontWeight: 800 }}>{s.name}</span>
        )}
        <span className="sb-tag" style={{ fontSize: mobile ? 14 : 19 }}>{TAGLINE[s.id] ?? `O melhor do ${s.name}, com o que está na sua lista`}</span>
        {!mobile && (
          <div className="sb-chips">
            {count > 0 && <span>▶ {count.toLocaleString('pt-BR')} {kindLabel} na sua lista</span>}
            {top && <span>🔥 Top 10</span>}
            {genres > 0 && <span>{genres} gêneros</span>}
          </div>
        )}
      </div>
    </div>
  );
}
