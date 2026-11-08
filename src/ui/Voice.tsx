import { useEffect, useRef, useState } from 'react';
import { IS_WEBOS } from '../core/platform';

// Comando de voz para campos de texto (Web Speech API).
// Só aparece onde o aparelho reconhece fala:
//  · navegadores Chrome/Edge no computador e no Android → sim;
//  · programa de Windows (Electron) → não: o Chromium do Electron não tem o
//    serviço de reconhecimento do Google, então o botão fica escondido;
//  · TV LG → o teclado da própria TV já tem o microfone do controle;
//  · app Android/Google TV (futuro) → plugin nativo de reconhecimento.

type Rec = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function recognizer(): (new () => Rec) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function voiceSupported(): boolean {
  if (IS_WEBOS) return false;
  if (/electron/i.test(navigator.userAgent)) return false;
  return !!recognizer();
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'Permita o uso do microfone para usar a voz.',
  'service-not-allowed': 'Este aparelho não liberou o reconhecimento de voz.',
  'no-speech': 'Não ouvi nada. Tente de novo.',
  'audio-capture': 'Nenhum microfone encontrado.',
  network: 'O reconhecimento de voz precisa de internet.',
};

/** Botão de microfone: ao falar, entrega o texto reconhecido. */
export function VoiceButton({ onText, size = 36 }: { onText: (text: string) => void; size?: number }) {
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState('');
  const rec = useRef<Rec | null>(null);
  useEffect(() => () => rec.current?.abort(), []);
  if (!voiceSupported()) return null;

  const start = () => {
    if (on) {
      rec.current?.stop();
      return;
    }
    const R = recognizer();
    if (!R) return;
    const r = new R();
    r.lang = 'pt-BR';
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.continuous = false;
    r.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      onText(text.trim());
    };
    r.onerror = (e) => setMsg(ERRORS[e.error] ?? 'Não foi possível usar a voz agora.');
    r.onend = () => setOn(false);
    rec.current = r;
    setMsg('');
    setOn(true);
    try {
      r.start();
    } catch {
      setOn(false);
    }
  };

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        className={'voice-btn' + (on ? ' on' : '')}
        data-nav=""
        aria-label={on ? 'Parar de ouvir' : 'Falar'}
        title={on ? 'Ouvindo… toque para parar' : 'Falar'}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onClick={start}
      >
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      </button>
      {(on || msg) && <span className="voice-tip">{on ? 'Ouvindo…' : msg}</span>}
    </span>
  );
}
