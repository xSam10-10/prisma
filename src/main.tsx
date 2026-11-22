import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installNavigation } from './ui/nav';
import { LITE } from './core/platform';
import { cloudPullOnStart } from './core/cloud';
import { installLiteImages } from './ui/liteImages';
import { idbDel } from './core/storage';
import './fonts.css';
import './styles.css';
import './sports.css';
import './stream.css';

// TV LG (Chrome 38) não tem Element.closest.
if (!Element.prototype.closest) {
  Element.prototype.closest = function (this: Element, sel: string): Element | null {
    let el: Element | null = this;
    while (el && el.nodeType === 1) {
      if (el.matches(sel)) return el;
      el = el.parentElement;
    }
    return null;
  } as typeof Element.prototype.closest;
}

// Na TV LG, efeitos de vidro (blur) pesam: usa a versão "leve".
if (LITE) {
  document.documentElement.classList.add('lite');
  // 1.0.2: imagens do TMDB em tamanho menor (decodificar pesava muito na TV).
  installLiteImages();
  // Capas de adultos não são buscadas na TV: apaga as que já estavam guardadas (libera espaço).
  setTimeout(() => {
    for (let i = 0; i < 16; i++) void idbDel('adultc' + i);
  }, 20000);
}

installNavigation();
// Nuvem (0.30.0): antes de abrir, traz o que mudou nos outros aparelhos (no máximo 3,5 s).
cloudPullOnStart(3500).then(() => createRoot(document.getElementById('root')!).render(<App />));
