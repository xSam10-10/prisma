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

describe('modo Marcante', () => {
  it('todos os streamings têm estilo completo (fonte, capa, foco, botões e fileiras)', async () => {
    const { STREAM_STYLE, styleOf, skinCss } = await import('../src/ui/streamStyle');
    for (const s of STREAMINGS) {
      const st = styleOf(s);
      expect(STREAM_STYLE[s.id], s.id).toBeTruthy();
      expect(st.font.length).toBeGreaterThan(2);
      expect(['portrait', 'landscape']).toContain(st.shape);
      expect(['grow', 'lift', 'ring', 'glow']).toContain(st.focus);
      expect(st.play.length).toBeGreaterThan(2);
      expect(st.topRow('filmes').length).toBeGreaterThan(2);
      const css = skinCss(s, st);
      expect(css).toContain(st.font);
      expect(css).not.toMatch(/var\(--/); // TV de 2017: sem variáveis CSS
    }
    expect(styleOf(STREAMINGS.find((s) => s.id === 'netflix')!).shape).toBe('portrait');
    expect(styleOf(STREAMINGS.find((s) => s.id === 'disney')!).shape).toBe('landscape');
  });
  it('o ajuste antigo (liga/desliga da 0.27) vira um dos três modos', async () => {
    const { loadSettings } = await import('../src/core/settings');
    const store: Record<string, string> = {};
    (globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k], clear: () => undefined, key: () => null, length: 0 } as Storage;
    store['prisma.settings'] = JSON.stringify({ v18: true, streamSkin: true });
    expect(loadSettings().streamSkin).toBe('marcante');
    store['prisma.settings'] = JSON.stringify({ v18: true, streamSkin: false });
    expect(loadSettings().streamSkin).toBe('off');
    store['prisma.settings'] = JSON.stringify({ v18: true, streamSkin: 'cores' });
    expect(loadSettings().streamSkin).toBe('cores');
    store['prisma.settings'] = JSON.stringify({ v18: true });
    expect(loadSettings().streamSkin).toBe('marcante');
  });
});
