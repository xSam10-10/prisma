// Legendas (0.29.0): estilo (tamanho, cor e fundo, em Ajustes › Player) e
// legenda externa .srt/.vtt carregada do aparelho, com ajuste de sincronia.
// Sem variáveis CSS (TV de 2017): a regra ::cue vai numa folha própria.

export type SubSize = 'p' | 'm' | 'g' | 'gg';
export type SubColor = 'white' | 'yellow';
export type SubBg = 'none' | 'shadow' | 'box';

const SIZE: Record<SubSize, string> = { p: '80%', m: '100%', g: '125%', gg: '150%' };

/** Regra ::cue com o estilo escolhido. */
export function cueCss(size: SubSize, color: SubColor, bg: SubBg): string {
  const c = color === 'yellow' ? '#FFE14D' : '#FFFFFF';
  const back = bg === 'box' ? 'rgba(0, 0, 0, 0.78)' : 'rgba(0, 0, 0, 0)';
  const shadow = bg === 'shadow' ? '0 0 4px #000000, 0 2px 3px #000000, 0 0 10px rgba(0, 0, 0, 0.8)' : 'none';
  return `video::cue { font-size: ${SIZE[size]}; color: ${c}; background-color: ${back}; text-shadow: ${shadow}; font-family: 'Inter', Arial, sans-serif; line-height: 1.25; }`;
}

export function applyCueStyle(size: SubSize = 'm', color: SubColor = 'white', bg: SubBg = 'shadow'): void {
  let el = document.getElementById('prisma-cue') as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = 'prisma-cue';
    document.head.appendChild(el);
  }
  el.textContent = cueCss(size, color, bg);
}

/** Converte SubRip (.srt) em WebVTT; um .vtt passa direto. */
export function srtToVtt(text: string): string {
  const t = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (/^WEBVTT/.test(t)) return t + '\n';
  const blocks = t.split(/\n{2,}/).map((b) => {
    const lines = b.split('\n');
    // Tira o número da legenda (linha só com dígitos antes do tempo).
    if (/^\d+$/.test(lines[0].trim()) && lines[1] && lines[1].includes('-->')) lines.shift();
    if (lines[0]) lines[0] = lines[0].replace(/(\d\d:\d\d:\d\d),(\d{3})/g, '$1.$2');
    return lines.join('\n');
  });
  return 'WEBVTT\n\n' + blocks.filter((b) => b.includes('-->')).join('\n\n') + '\n';
}

/** Lê o arquivo escolhido e devolve um endereço local (blob) em WebVTT. */
export function loadSubtitleFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => {
      const raw = String(r.result ?? '');
      // Legendas brasileiras antigas vêm em Latin-1: se a leitura em UTF-8 quebrou acentos, relê.
      if (/\uFFFD/.test(raw)) {
        const r2 = new FileReader();
        r2.onload = () => resolve(URL.createObjectURL(new Blob([srtToVtt(String(r2.result ?? ''))], { type: 'text/vtt' })));
        r2.onerror = () => reject(r2.error);
        r2.readAsText(file, 'ISO-8859-1');
        return;
      }
      resolve(URL.createObjectURL(new Blob([srtToVtt(raw)], { type: 'text/vtt' })));
    };
    r.readAsText(file, 'UTF-8');
  });
}

/** Adianta (negativo) ou atrasa (positivo) todas as falas de uma trilha. */
export function shiftTrack(track: TextTrack, seconds: number): void {
  const cues = track.cues;
  if (!cues) return;
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i];
    c.startTime = Math.max(0, c.startTime + seconds);
    c.endTime = Math.max(c.startTime + 0.1, c.endTime + seconds);
  }
}
