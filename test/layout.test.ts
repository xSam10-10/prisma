import { describe, expect, it } from 'vitest';
import { computeLayout } from '../src/ui/layout';

const auto = { layoutForm: 'auto' as const, uiScale: 1, safeMargin: 0 };

describe('computeLayout', () => {
  it('TV 1080p e 4K: 1280×720, só muda a escala', () => {
    const a = computeLayout(1920, 1080, auto);
    expect([a.form, Math.round(a.W), Math.round(a.H), a.scale]).toEqual(['tv', 1280, 720, 1.5]);
    const b = computeLayout(3840, 2160, auto);
    expect([b.form, Math.round(b.W), Math.round(b.H), b.scale]).toEqual(['tv', 1280, 720, 3]);
  });

  it('ultrawide 21:9 e 32:9: a área cresce na largura, sem faixas', () => {
    const a = computeLayout(3440, 1440, auto);
    expect([Math.round(a.W), Math.round(a.H)]).toEqual([1720, 720]);
    const b = computeLayout(5120, 1440, auto);
    expect([Math.round(b.W), Math.round(b.H)]).toEqual([2560, 720]);
  });

  it('16:10 e 4:3: a área cresce na altura', () => {
    expect(Math.round(computeLayout(1280, 800, auto).H)).toBe(800);
    expect(Math.round(computeLayout(1024, 768, auto).H)).toBe(960);
  });

  it('celular em pé e deitado usam a forma de celular', () => {
    const p = computeLayout(390, 844, auto);
    expect(p.form).toBe('mobile');
    expect(Math.round(p.W)).toBe(400);
    const l = computeLayout(844, 390, auto);
    expect([l.form, l.landscape]).toEqual(['mobile', true]);
  });

  it('respeita os Ajustes (forma forçada, tamanho e margem)', () => {
    expect(computeLayout(390, 844, { ...auto, layoutForm: 'tv' }).form).toBe('tv');
    const big = computeLayout(1920, 1080, { ...auto, uiScale: 1.2 });
    expect(Math.round(big.W)).toBe(1067);
    const safe = computeLayout(1920, 1080, { ...auto, safeMargin: 0.05 });
    expect(safe.px).toBe(64 + 64);
  });
});
