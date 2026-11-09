import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installNavigation } from './ui/nav';
import { LITE } from './core/platform';
import './styles.css';

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
}

installNavigation();
createRoot(document.getElementById('root')!).render(<App />);
