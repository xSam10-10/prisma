import { prefGet } from '../core/storage';

// Sons de navegação (opcional, Ajustes › Aparência): clique bem suave, sem arquivos de áudio.

type AC = AudioContext;
let ac: AC | null = null;

/** Clique bem suave ao mover o foco (Ajustes › Aparência › Sons de navegação). */
export function navSound(kind: 'move' | 'ok' = 'move'): void {
  if (!prefGet<{ navSounds?: boolean }>('settings', {}).navSounds) return;
  try {
    const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ac = ac ?? new Ctor();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = kind === 'ok' ? 660 : 1250;
    const t = ac.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(kind === 'ok' ? 0.07 : 0.035, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'ok' ? 0.09 : 0.04));
    o.connect(g);
    g.connect(ac.destination);
    o.start(t);
    o.stop(t + 0.1);
  } catch {
    /* sem áudio */
  }
}

