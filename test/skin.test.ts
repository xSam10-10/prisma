import { describe, expect, it } from 'vitest';
import { STREAMINGS } from '../src/core/vod';
import { skinTheme, THEMES } from '../src/ui/themes';

describe('visual de cada streaming', () => {
  it('quem tem tema próprio usa o tema; os outros ganham um tema com as cores deles', () => {
    expect(skinTheme(STREAMINGS.find((s) => s.id === 'netflix')!).id).toBe('netflix');
    const p = skinTheme(STREAMINGS.find((s) => s.id === 'paramount')!);
    expect(p.id).toBe('s-paramount');
    expect(p.bg).toBe('#00112E');
    expect(p.primary).toBe('#0064FF');
    expect(p.onPrimary).toBe('#FFFFFF');
  });
  it('todos os streamings têm um tema legível', () => {
    for (const s of STREAMINGS) {
      const t = skinTheme(s);
      expect(t.bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(t.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      // Destaque claro → texto escuro no botão (ex.: Hulu, Crunchyroll); destaque escuro → texto branco.
      expect(['#0B0B10', '#FFFFFF', '#000000', '#0B0B12', '#0F171E']).toContain(t.onPrimary);
    }
    expect(skinTheme(STREAMINGS.find((s) => s.id === 'hulu')!).onPrimary).toBe('#0B0B10');
    expect(skinTheme(STREAMINGS.find((s) => s.id === 'claro')!).square).toBe(true);
    expect(THEMES.length).toBeGreaterThan(5);
  });
});
