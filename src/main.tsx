import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installNavigation } from './ui/nav';
import { LITE } from './core/platform';
import './styles.css';

// Na TV LG, efeitos de vidro (blur) pesam: usa a versão "leve".
if (LITE) {
  document.documentElement.classList.add('lite');
}

installNavigation();
createRoot(document.getElementById('root')!).render(<App />);
