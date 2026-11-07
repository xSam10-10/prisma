import { createContext, useContext, useLayoutEffect, useState } from 'react';
import type { Settings } from '../core/settings';

// Sistema de tela adaptável do PRISMA.
//
// O app desenha numa "área de desenho" medida em unidades de projeto e
// ampliada para a tela real. Em vez de uma área fixa (com faixas pretas),
// a área acompanha a proporção da tela:
//
//  · Forma "tv" (TV, computador, ultrawide, tablet deitado):
//    o lado menor vale 720 × 1280 unidades e o outro cresce.
//      16:9  (1080p, 4K)      → 1280 × 720
//      21:9  (ultrawide)      → 1680 × 720
//      32:9  (super ultrawide)→ 2560 × 720
//      16:10 / 4:3            → 1280 × 800 / 1280 × 960
//  · Forma "mobile" (celular em pé ou deitado, telas pequenas):
//    o lado menor vale cerca de 400 unidades e o layout é o de celular
//    (barra de abas embaixo, vídeo em cima).
//
// Telas 4K/alta densidade não mudam a forma: só a escala (o texto fica nítido).

export type Form = 'tv' | 'mobile';

export interface Layout {
  form: Form;
  /** Área de desenho em unidades de projeto. */
  W: number;
  H: number;
  /** Fator de ampliação unidades → pixels CSS. */
  scale: number;
  landscape: boolean;
  /** Margens: laterais, topo (abaixo do menu) e base. */
  px: number;
  top: number;
  bottom: number;
  /** Margem de segurança extra (TV que corta as bordas). */
  safeX: number;
  safeY: number;
  /** Tela real em pixels CSS e densidade. */
  realW: number;
  realH: number;
  dpr: number;
}

export function computeLayout(w: number, h: number, s: Pick<Settings, 'layoutForm' | 'uiScale' | 'safeMargin'>, dpr = 1): Layout {
  w = Math.max(1, w);
  h = Math.max(1, h);
  const landscape = w >= h;
  // Celular: tela estreita (em pé) ou baixa (deitado).
  const autoForm: Form = w < 900 || h < 500 ? 'mobile' : 'tv';
  const form = s.layoutForm === 'auto' ? autoForm : s.layoutForm;
  const k = Math.min(1.3, Math.max(0.7, s.uiScale || 1));

  let scale: number;
  if (form === 'tv') {
    scale = Math.min(w / 1280, h / 720) * k;
  } else {
    scale = Math.min(1.8, Math.max(0.75, Math.min(w, h) / 400)) * k;
  }
  const W = w / scale;
  const H = h / scale;
  const m = Math.min(0.08, Math.max(0, s.safeMargin || 0));
  const safeX = Math.round(W * m);
  const safeY = Math.round(H * m);

  if (form === 'tv') {
    return { form, W, H, scale, landscape, px: 64 + safeX, top: 100 + safeY, bottom: 36 + safeY, safeX, safeY, realW: w, realH: h, dpr };
  }
  // Celular: cabeçalho de 56 e barra de abas flutuante embaixo.
  return { form, W, H, scale, landscape, px: 14 + safeX, top: 60 + safeY, bottom: 84 + safeY, safeX, safeY, realW: w, realH: h, dpr };
}

export const LayoutContext = createContext<Layout>(computeLayout(1280, 720, { layoutForm: 'auto', uiScale: 1, safeMargin: 0 }));

export function useLayout(): Layout {
  return useContext(LayoutContext);
}

/** Mede a janela e recalcula ao redimensionar, girar o celular ou trocar de monitor. */
export function useViewportLayout(s: Pick<Settings, 'layoutForm' | 'uiScale' | 'safeMargin'>): Layout {
  const measure = () => computeLayout(window.innerWidth, window.innerHeight, s, window.devicePixelRatio || 1);
  const [layout, setLayout] = useState<Layout>(measure);
  useLayoutEffect(() => {
    const on = () => setLayout(measure());
    on();
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    // Mudança de densidade (arrastar a janela para outro monitor).
    let mq: MediaQueryList | null = null;
    const watchDpr = () => {
      mq?.removeListener?.(onDpr);
      mq = window.matchMedia ? window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`) : null;
      mq?.addListener?.(onDpr);
    };
    const onDpr = () => {
      on();
      watchDpr();
    };
    watchDpr();
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
      mq?.removeListener?.(onDpr);
    };
  }, [s.layoutForm, s.uiScale, s.safeMargin]); // eslint-disable-line react-hooks/exhaustive-deps
  return layout;
}
